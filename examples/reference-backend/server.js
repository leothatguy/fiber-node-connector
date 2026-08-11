import { createServer } from "node:http";
import {
  ConnectorGateway,
  createConnectorHttpHandler,
  GatewayError,
  readBearerToken,
  readJsonBody,
  writeJson,
} from "../../src/server/index.js";

const port = Number.parseInt(process.env.PORT ?? "8787", 10);
const connectorId = process.env.CONNECTOR_ID ?? "merchant-demo";
const connectorToken = process.env.CONNECTOR_TOKEN ?? "development-connector-token";
const adminToken = process.env.ADMIN_TOKEN ?? "development-admin-token";

const gateway = new ConnectorGateway();
gateway.registerConnector({ connectorId, token: connectorToken });
const connectorHandler = createConnectorHttpHandler(gateway);

const server = createServer(async (request, response) => {
  if (await connectorHandler(request, response)) return;

  try {
    const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
    if (request.method === "GET" && url.pathname === "/health") {
      writeJson(response, 200, { ok: true });
      return;
    }

    requireAdmin(request);
    if (request.method === "GET" && url.pathname === "/admin/connector") {
      writeJson(response, 200, gateway.getStatus(connectorId));
      return;
    }
    if (request.method === "POST" && url.pathname === "/admin/commands") {
      const body = await readJsonBody(request);
      const result = await gateway.execute(
        body.connectorId ?? connectorId,
        body.method,
        body.params ?? [],
      );
      writeJson(response, 200, { result });
      return;
    }
    writeJson(response, 404, { error: { code: "NOT_FOUND", message: "Not found" } });
  } catch (error) {
    writeJson(response, error instanceof GatewayError ? error.statusCode : 500, {
      error: {
        code: error instanceof GatewayError ? error.code : "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Reference backend: http://127.0.0.1:${port}`);
  console.log(`Connector ID: ${connectorId}`);
});

function requireAdmin(request) {
  if (readBearerToken(request.headers.authorization) !== adminToken) {
    throw new GatewayError("Invalid admin token", 401, "ADMIN_TOKEN_INVALID");
  }
}
