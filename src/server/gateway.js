import { createHash, randomUUID } from "node:crypto";
import { SUPPORTED_FIBER_METHODS } from "../constants.js";
import { GatewayError } from "./errors.js";

export class ConnectorGateway {
  constructor({
    heartbeatTtlMs = 30_000,
    commandTimeoutMs = 30_000,
    commandLeaseMs = 10_000,
    maxAttempts = 5,
  } = {}) {
    this.heartbeatTtlMs = heartbeatTtlMs;
    this.commandTimeoutMs = commandTimeoutMs;
    this.commandLeaseMs = commandLeaseMs;
    this.maxAttempts = maxAttempts;
    this.connectors = new Map();
    this.tokenIndex = new Map();
    this.queues = new Map();
    this.commands = new Map();
  }

  registerConnector({ connectorId, token, metadata = {} }) {
    requireString(connectorId, "connectorId");
    requireString(token, "token");
    const tokenHash = hashToken(token);
    const previous = this.connectors.get(connectorId);
    if (previous) this.tokenIndex.delete(previous.tokenHash);

    const connector = {
      connectorId,
      tokenHash,
      metadata: { ...metadata },
      heartbeat: previous?.heartbeat ?? null,
      lastSeenAt: previous?.lastSeenAt ?? null,
      registeredAt: previous?.registeredAt ?? new Date(),
      updatedAt: new Date(),
    };
    this.connectors.set(connectorId, connector);
    this.tokenIndex.set(tokenHash, connectorId);
    return this.publicConnector(connector);
  }

  revokeConnector(connectorId) {
    const connector = this.connectors.get(connectorId);
    if (!connector) return false;
    this.tokenIndex.delete(connector.tokenHash);
    this.connectors.delete(connectorId);
    this.queues.delete(connectorId);
    for (const [commandId, command] of this.commands) {
      if (command.connectorId !== connectorId) continue;
      this.rejectCommand(command, new GatewayError(
        "Connector was revoked",
        503,
        "CONNECTOR_REVOKED",
      ));
      this.commands.delete(commandId);
    }
    return true;
  }

  heartbeat(token, payload) {
    const connector = this.authenticate(token);
    assertPayloadConnector(connector.connectorId, payload);
    connector.heartbeat = structuredClone(payload);
    connector.lastSeenAt = new Date();
    connector.updatedAt = new Date();
    return this.getStatus(connector.connectorId);
  }

  poll(token) {
    const connector = this.authenticate(token);
    this.requeueExpiredLeases(connector.connectorId);
    const queue = this.queues.get(connector.connectorId) ?? [];

    while (queue.length > 0) {
      const commandId = queue.shift();
      const command = this.commands.get(commandId);
      if (!command || command.state === "completed") continue;
      if (command.attempts >= this.maxAttempts) {
        this.rejectCommand(
          command,
          new GatewayError(
            "Connector command exceeded delivery attempts",
            504,
            "COMMAND_ATTEMPTS_EXCEEDED",
          ),
        );
        this.commands.delete(command.id);
        continue;
      }

      command.state = "leased";
      command.attempts += 1;
      command.leasedAt = Date.now();
      command.leaseExpiresAt = Date.now() + this.commandLeaseMs;
      this.saveQueue(connector.connectorId, queue);
      return {
        id: command.id,
        method: command.method,
        params: structuredClone(command.params),
      };
    }

    this.saveQueue(connector.connectorId, queue);
    return null;
  }

  complete(token, commandId, payload) {
    const connector = this.authenticate(token);
    const command = this.commands.get(commandId);
    if (!command) return false;
    if (command.connectorId !== connector.connectorId) {
      throw new GatewayError(
        "Command does not belong to this connector",
        403,
        "COMMAND_FORBIDDEN",
      );
    }

    command.state = "completed";
    command.completedAt = new Date();
    clearTimeout(command.timeout);
    this.commands.delete(commandId);

    if (payload?.ok === false || payload?.error) {
      const message = payload?.error?.message ?? payload?.error ?? "Command failed";
      command.reject(
        new GatewayError(message, 502, payload?.error?.code ?? "COMMAND_FAILED"),
      );
    } else {
      command.resolve(payload?.result);
    }
    return true;
  }

  execute(connectorId, method, params = [], { timeoutMs } = {}) {
    const connector = this.connectors.get(connectorId);
    if (!connector) {
      throw new GatewayError("Connector is not registered", 404, "CONNECTOR_NOT_FOUND");
    }
    if (!this.isActive(connector)) {
      throw new GatewayError("Connector is offline", 503, "CONNECTOR_OFFLINE");
    }
    if (!SUPPORTED_FIBER_METHODS.includes(method)) {
      throw new GatewayError(
        `Unsupported Fiber command: ${method}`,
        400,
        "UNSUPPORTED_COMMAND",
      );
    }
    if (!Array.isArray(params)) {
      throw new GatewayError("Command params must be an array", 400, "INVALID_PARAMS");
    }
    const capabilities = connector.heartbeat?.capabilities;
    if (Array.isArray(capabilities) && !capabilities.includes(method)) {
      throw new GatewayError(
        `Connector does not advertise capability: ${method}`,
        400,
        "CAPABILITY_UNAVAILABLE",
      );
    }

    const commandId = randomUUID();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const command = this.commands.get(commandId);
        if (!command) return;
        this.commands.delete(commandId);
        reject(
          new GatewayError("Connector command timed out", 504, "COMMAND_TIMEOUT"),
        );
      }, timeoutMs ?? this.commandTimeoutMs);
      timeout.unref?.();

      this.commands.set(commandId, {
        id: commandId,
        connectorId,
        method,
        params: structuredClone(params),
        state: "queued",
        attempts: 0,
        leaseExpiresAt: null,
        createdAt: new Date(),
        timeout,
        resolve,
        reject,
      });
      const queue = this.queues.get(connectorId) ?? [];
      queue.push(commandId);
      this.queues.set(connectorId, queue);
    });
  }

  getStatus(connectorId) {
    const connector = this.connectors.get(connectorId);
    if (!connector) return null;
    return {
      ...this.publicConnector(connector),
      active: this.isActive(connector),
      heartbeat: connector.heartbeat ? structuredClone(connector.heartbeat) : null,
      queuedCommandCount: (this.queues.get(connectorId) ?? []).length,
    };
  }

  authenticate(token) {
    if (!token) {
      throw new GatewayError("Missing connector token", 401, "TOKEN_MISSING");
    }
    const connectorId = this.tokenIndex.get(hashToken(token));
    const connector = connectorId ? this.connectors.get(connectorId) : null;
    if (!connector) {
      throw new GatewayError("Invalid connector token", 401, "TOKEN_INVALID");
    }
    return connector;
  }

  requeueExpiredLeases(connectorId) {
    const queue = this.queues.get(connectorId) ?? [];
    const now = Date.now();
    for (const command of this.commands.values()) {
      if (
        command.connectorId !== connectorId ||
        command.state !== "leased" ||
        command.leaseExpiresAt > now ||
        queue.includes(command.id)
      ) {
        continue;
      }
      command.state = "queued";
      command.leaseExpiresAt = null;
      queue.push(command.id);
    }
    this.saveQueue(connectorId, queue);
  }

  isActive(connector) {
    return Boolean(
      connector.lastSeenAt &&
        Date.now() - connector.lastSeenAt.getTime() <= this.heartbeatTtlMs,
    );
  }

  saveQueue(connectorId, queue) {
    if (queue.length === 0) this.queues.delete(connectorId);
    else this.queues.set(connectorId, queue);
  }

  publicConnector(connector) {
    return {
      connectorId: connector.connectorId,
      metadata: { ...connector.metadata },
      registeredAt: connector.registeredAt.toISOString(),
      updatedAt: connector.updatedAt.toISOString(),
      lastSeenAt: connector.lastSeenAt?.toISOString() ?? null,
    };
  }

  rejectCommand(command, error) {
    clearTimeout(command.timeout);
    command.reject(error);
  }
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function requireString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new GatewayError(`${name} is required`, 400, "INVALID_REGISTRATION");
  }
}

function assertPayloadConnector(expected, payload) {
  if (payload?.connectorId && payload.connectorId !== expected) {
    throw new GatewayError(
      "Connector token does not match payload connectorId",
      403,
      "CONNECTOR_ID_MISMATCH",
    );
  }
}
