import {
  CONNECTOR_VERSION,
  GENERIC_PROTOCOL_VERSION,
} from "./constants.js";

export function createProtocol(config) {
  const prefix = normalizePrefix(config.apiPrefix ?? "/v1/connectors");
  return Object.freeze({
    name: "generic-v1",
    paths: {
      heartbeat: `${prefix}/heartbeat`,
      poll: `${prefix}/poll`,
      result: (id) => `${prefix}/commands/${encodeURIComponent(id)}/result`,
    },
    headers: {
      Authorization: `Bearer ${config.connectorToken}`,
      "X-Fiber-Connector-Version": CONNECTOR_VERSION,
    },
    heartbeatBody(status) {
      return {
        protocolVersion: GENERIC_PROTOCOL_VERSION,
        connectorId: config.connectorId,
        capabilities: config.allowedMethods,
        ...status,
      };
    },
    pollBody() {
      return {
        protocolVersion: GENERIC_PROTOCOL_VERSION,
        connectorId: config.connectorId,
        capabilities: config.allowedMethods,
      };
    },
    resultBody(payload) {
      return {
        protocolVersion: GENERIC_PROTOCOL_VERSION,
        connectorId: config.connectorId,
        completedAt: new Date().toISOString(),
        ...payload,
      };
    },
  });
}

function normalizePrefix(value) {
  const prefixed = value.startsWith("/") ? value : `/${value}`;
  return prefixed.replace(/\/$/, "");
}
