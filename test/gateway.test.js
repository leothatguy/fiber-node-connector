import test from "node:test";
import assert from "node:assert/strict";
import { ConnectorGateway } from "../src/server/gateway.js";

const heartbeat = {
  connectorId: "merchant-1",
  capabilities: ["node_info", "get_invoice"],
  node: { pubkey: "03abc" },
  channels: { ready: 1 },
};

test("registers, authenticates, reports status, and completes a command", async () => {
  const gateway = new ConnectorGateway();
  gateway.registerConnector({ connectorId: "merchant-1", token: "secret" });
  const status = gateway.heartbeat("secret", heartbeat);
  assert.equal(status.active, true);

  const pending = gateway.execute("merchant-1", "get_invoice", [
    { payment_hash: "0x01" },
  ]);
  const command = gateway.poll("secret");
  assert.equal(command.method, "get_invoice");
  assert.equal(gateway.complete("secret", command.id, {
    ok: true,
    result: { status: "Paid" },
  }), true);
  assert.deepEqual(await pending, { status: "Paid" });
});

test("rejects commands that the connector does not advertise", () => {
  const gateway = new ConnectorGateway();
  gateway.registerConnector({ connectorId: "merchant-1", token: "secret" });
  gateway.heartbeat("secret", heartbeat);
  assert.throws(
    () => gateway.execute("merchant-1", "new_invoice", []),
    /does not advertise capability/,
  );
});

test("rejects a connector ID that does not match the token", () => {
  const gateway = new ConnectorGateway();
  gateway.registerConnector({ connectorId: "merchant-1", token: "secret" });
  assert.throws(
    () => gateway.heartbeat("secret", { ...heartbeat, connectorId: "merchant-2" }),
    /does not match/,
  );
});

test("redelivers a command after its lease expires", async () => {
  const gateway = new ConnectorGateway({ commandLeaseMs: 5, commandTimeoutMs: 500 });
  gateway.registerConnector({ connectorId: "merchant-1", token: "secret" });
  gateway.heartbeat("secret", heartbeat);
  const pending = gateway.execute("merchant-1", "node_info", []);
  const first = gateway.poll("secret");
  await new Promise((resolve) => setTimeout(resolve, 10));
  const second = gateway.poll("secret");
  assert.equal(second.id, first.id);
  gateway.complete("secret", second.id, { ok: true, result: { pubkey: "03abc" } });
  await pending;
});
