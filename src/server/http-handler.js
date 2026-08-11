import { GatewayError } from "./errors.js";

export function createConnectorHttpHandler(
  gateway,
  { prefix = "/v1/connectors", maxBodyBytes = 1_000_000 } = {},
) {
  const normalizedPrefix = normalizePrefix(prefix);

  return async function handleConnectorRequest(request, response) {
    const url = new URL(request.url, "http://connector.local");
    if (!url.pathname.startsWith(`${normalizedPrefix}/`)) return false;

    try {
      if (request.method !== "POST") {
        throw new GatewayError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
      }
      const token = readBearerToken(request.headers.authorization);
      const body = await readJsonBody(request, maxBodyBytes);

      if (url.pathname === `${normalizedPrefix}/heartbeat`) {
        writeJson(response, 200, gateway.heartbeat(token, body));
        return true;
      }
      if (url.pathname === `${normalizedPrefix}/poll`) {
        writeJson(response, 200, { command: gateway.poll(token) });
        return true;
      }
      const match = url.pathname.match(
        new RegExp(`^${escapeRegExp(normalizedPrefix)}/commands/([^/]+)/result$`),
      );
      if (match) {
        writeJson(response, 200, {
          accepted: gateway.complete(token, decodeURIComponent(match[1]), body),
        });
        return true;
      }

      throw new GatewayError("Connector route not found", 404, "NOT_FOUND");
    } catch (error) {
      const statusCode = error instanceof GatewayError ? error.statusCode : 500;
      writeJson(response, statusCode, {
        error: {
          code: error instanceof GatewayError ? error.code : "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : String(error),
        },
      });
      return true;
    }
  };
}

export async function readJsonBody(request, maxBodyBytes = 1_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) {
      throw new GatewayError("Request body is too large", 413, "BODY_TOO_LARGE");
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new GatewayError("Request body must be valid JSON", 400, "INVALID_JSON");
  }
}

export function writeJson(response, statusCode, body) {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
  });
  response.end(payload);
}

export function readBearerToken(value) {
  const match = /^Bearer\s+(.+)$/i.exec(value ?? "");
  if (!match) {
    throw new GatewayError("Missing bearer token", 401, "TOKEN_MISSING");
  }
  return match[1];
}

function normalizePrefix(value) {
  const prefixed = value.startsWith("/") ? value : `/${value}`;
  return prefixed.replace(/\/$/, "");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
