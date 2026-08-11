import { errorMessage, nextBackoff, sleep } from "./utils.js";
import { readFiberStatus } from "./status.js";

export class FiberNodeConnector {
  constructor({ config, backend, fiberRpc, commandPolicy, logger }) {
    this.config = config;
    this.backend = backend;
    this.fiberRpc = fiberRpc;
    this.commandPolicy = commandPolicy;
    this.logger = logger;
    this.resultCache = new Map();
  }

  async start(signal) {
    this.logger.info("connector_started", {
      protocol: this.config.protocol,
      connectorId: this.config.connectorId,
      backendUrl: this.config.backendUrl,
      fiberRpcUrl: this.config.fiberRpcUrl,
      capabilities: this.config.allowedMethods,
    });
    await Promise.all([
      this.runHeartbeatLoop(signal),
      this.runPollLoop(signal),
    ]);
    this.logger.info("connector_stopped");
  }

  async heartbeatOnce() {
    let status;
    try {
      status = await readFiberStatus(this.fiberRpc, {
        includeNodeAddresses: this.config.includeNodeAddresses,
      });
    } catch (error) {
      status = {
        observedAt: new Date().toISOString(),
        available: false,
        reason: errorMessage(error),
        node: { pubkey: null, name: null, version: null, addresses: [] },
        channels: { total: 0, enabled: 0, ready: 0 },
      };
    }
    await this.backend.heartbeat(status);
    this.logger.info("heartbeat_sent", {
      nodePubkey: status.node.pubkey,
      readyChannels: status.channels.ready,
      available: status.available,
    });
    return status;
  }

  async pollOnce() {
    const command = await this.backend.poll();
    if (!command) return false;

    let payload = this.resultCache.get(command.id);
    if (!payload) {
      try {
        this.commandPolicy.assert(command);
        const result = await this.fiberRpc.call(command.method, command.params);
        payload = { ok: true, result };
      } catch (error) {
        payload = {
          ok: false,
          error: {
            code: "COMMAND_FAILED",
            message: errorMessage(error),
            retryable: false,
          },
        };
      }
      this.cacheResult(command.id, payload);
    }

    await this.backend.complete(command.id, payload);
    this.logger.info("command_completed", {
      commandId: command.id,
      method: command.method,
      ok: payload.ok,
    });
    return true;
  }

  async runHeartbeatLoop(signal) {
    while (!signal.aborted) {
      try {
        await this.heartbeatOnce();
      } catch (error) {
        this.logger.warn("heartbeat_failed", { error: errorMessage(error) });
      }
      await sleep(this.config.heartbeatMs, signal);
    }
  }

  async runPollLoop(signal) {
    let backoffMs = 0;
    while (!signal.aborted) {
      try {
        const handled = await this.pollOnce();
        backoffMs = 0;
        if (!handled) await sleep(this.config.pollMs, signal);
      } catch (error) {
        backoffMs = nextBackoff(
          backoffMs,
          this.config.retryMinMs,
          this.config.retryMaxMs,
        );
        this.logger.warn("poll_failed", {
          error: errorMessage(error),
          retryInMs: backoffMs,
        });
        await sleep(backoffMs, signal);
      }
    }
  }

  cacheResult(commandId, payload) {
    this.resultCache.set(commandId, payload);
    if (this.resultCache.size <= 100) return;
    const oldest = this.resultCache.keys().next().value;
    if (oldest) this.resultCache.delete(oldest);
  }
}
