import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { BackendClient } from "../src/backend-client.js";
import { CommandPolicy } from "../src/command-policy.js";
import { FiberNodeConnector } from "../src/connector.js";
import { FiberRpcClient } from "../src/fiber-rpc.js";
import { createProtocol } from "../src/protocol.js";
import {
  ConnectorGateway,
  createConnectorHttpHandler,
  writeJson,
} from "../src/server/index.js";

test("connects a remote backend contract to a private Fiber RPC", async (t) => {
  const fiberServer = createServer(async (request, response) => {
    const body = await readBody(request);
    const results = {
      node_info: {
        pubkey: "03ABC",
        node_name: "merchant-node",
        version: "0.9.0",
        addresses: ["/ip4/127.0.0.1/tcp/8228"],
      },
      list_channels: {
        channels: [{ enabled: true, state: { state_name: "CHANNEL_READY" } }],
      },
      new_invoice: {
        invoice_address: "fibt-test-invoice",
        invoice: { data: { payment_hash: "0xpayment" } },
      },
      get_invoice: { status: "Paid" },
    };
    writeJson(response, 200, {
      jsonrpc: "2.0",
      id: body.id,
      result: results[body.method],
    });
  });
  const fiberUrl = await listen(fiberServer);
  t.after(() => fiberServer.close());

  const gateway = new ConnectorGateway();
  gateway.registerConnector({ connectorId: "merchant-1", token: "secret" });
  const connectorHandler = createConnectorHttpHandler(gateway);
  const backendServer = createServer(async (request, response) => {
    if (!(await connectorHandler(request, response))) {
      writeJson(response, 404, { error: "not found" });
    }
  });
  const backendUrl = await listen(backendServer);
  t.after(() => backendServer.close());

  const config = {
    connectorId: "merchant-1",
    connectorToken: "secret",
    backendUrl,
    fiberRpcUrl: fiberUrl,
    allowedMethods: ["node_info", "list_channels", "new_invoice", "get_invoice"],
    includeNodeAddresses: true,
    backendTimeoutMs: 1_000,
    fiberRpcTimeoutMs: 1_000,
  };
  const connector = new FiberNodeConnector({
    config,
    backend: new BackendClient({
      baseUrl: backendUrl,
      protocol: createProtocol(config),
      timeoutMs: 1_000,
    }),
    fiberRpc: new FiberRpcClient({ url: fiberUrl, timeoutMs: 1_000 }),
    commandPolicy: new CommandPolicy(config.allowedMethods),
    logger: silentLogger,
  });

  const status = await connector.heartbeatOnce();
  assert.equal(status.available, true);
  assert.equal(gateway.getStatus("merchant-1").heartbeat.node.pubkey, "03abc");

  const pending = gateway.execute("merchant-1", "new_invoice", [
    { amount: "0x5f5e100" },
  ]);
  assert.equal(await connector.pollOnce(), true);
  assert.equal((await pending).invoice_address, "fibt-test-invoice");
});

const silentLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
