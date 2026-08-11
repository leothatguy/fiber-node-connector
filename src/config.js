import { SUPPORTED_FIBER_METHODS } from "./constants.js";

function firstValue(env, names) {
  for (const name of names) {
    const value = env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

function required(env, names, displayName) {
  const value = firstValue(env, names);
  if (!value) throw new Error(`${displayName} is required`);
  return value;
}

function positiveInteger(value, fallback, name) {
  const parsed = Number.parseInt(value ?? String(fallback), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function booleanValue(value, fallback) {
  if (value === undefined) return fallback;
  if (["1", "true", "yes", "on"].includes(value.toLowerCase())) return true;
  if (["0", "false", "no", "off"].includes(value.toLowerCase())) return false;
  throw new Error(`Invalid boolean value: ${value}`);
}

function normalizedUrl(value, name) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`${name} must use http or https`);
  }
  return parsed.toString().replace(/\/$/, "");
}

function isLoopbackUrl(value) {
  const hostname = new URL(value).hostname.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function parseAllowedMethods(value) {
  const methods = (value ?? SUPPORTED_FIBER_METHODS.join(","))
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (methods.length === 0) {
    throw new Error("CONNECTOR_ALLOWED_METHODS must contain at least one method");
  }
  for (const method of methods) {
    if (!SUPPORTED_FIBER_METHODS.includes(method)) {
      throw new Error(`Unsupported CONNECTOR_ALLOWED_METHODS entry: ${method}`);
    }
  }
  return Object.freeze([...new Set(methods)]);
}

export function loadConfig(env = process.env) {
  const backendUrl = normalizedUrl(
    required(env, ["BACKEND_URL"], "BACKEND_URL"),
    "BACKEND_URL",
  );
  const allowInsecureBackend = booleanValue(
    firstValue(env, ["CONNECTOR_ALLOW_INSECURE_BACKEND"]),
    false,
  );
  if (
    new URL(backendUrl).protocol !== "https:" &&
    !isLoopbackUrl(backendUrl) &&
    !allowInsecureBackend
  ) {
    throw new Error(
      "BACKEND_URL must use HTTPS unless it is loopback or CONNECTOR_ALLOW_INSECURE_BACKEND=true",
    );
  }

  const connectorId = required(env, ["CONNECTOR_ID"], "CONNECTOR_ID");

  return Object.freeze({
    backendUrl,
    connectorToken: required(env, ["CONNECTOR_TOKEN"], "CONNECTOR_TOKEN"),
    connectorId,
    fiberRpcUrl: normalizedUrl(
      firstValue(env, ["FIBER_RPC_URL"]) ?? "http://127.0.0.1:8227",
      "FIBER_RPC_URL",
    ),
    fiberRpcBearerToken: firstValue(env, ["FIBER_RPC_BEARER_TOKEN"]),
    allowedMethods: parseAllowedMethods(
      firstValue(env, ["CONNECTOR_ALLOWED_METHODS"]),
    ),
    heartbeatMs: positiveInteger(
      firstValue(env, ["CONNECTOR_HEARTBEAT_MS"]),
      10_000,
      "CONNECTOR_HEARTBEAT_MS",
    ),
    pollMs: positiveInteger(
      firstValue(env, ["CONNECTOR_POLL_MS"]),
      1_500,
      "CONNECTOR_POLL_MS",
    ),
    backendTimeoutMs: positiveInteger(
      firstValue(env, ["CONNECTOR_BACKEND_TIMEOUT_MS"]),
      15_000,
      "CONNECTOR_BACKEND_TIMEOUT_MS",
    ),
    fiberRpcTimeoutMs: positiveInteger(
      firstValue(env, ["FIBER_RPC_TIMEOUT_MS"]),
      15_000,
      "FIBER_RPC_TIMEOUT_MS",
    ),
    retryMinMs: positiveInteger(
      firstValue(env, ["CONNECTOR_RETRY_MIN_MS"]),
      1_000,
      "CONNECTOR_RETRY_MIN_MS",
    ),
    retryMaxMs: positiveInteger(
      firstValue(env, ["CONNECTOR_RETRY_MAX_MS"]),
      30_000,
      "CONNECTOR_RETRY_MAX_MS",
    ),
    includeNodeAddresses: booleanValue(
      firstValue(env, ["CONNECTOR_INCLUDE_NODE_ADDRESSES"]),
      true,
    ),
    apiPrefix: firstValue(env, ["CONNECTOR_API_PREFIX"]),
    logLevel: firstValue(env, ["LOG_LEVEL"]) ?? "info",
    logFormat: firstValue(env, ["LOG_FORMAT"]) ?? "pretty",
  });
}
