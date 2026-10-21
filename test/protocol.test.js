import test from "node:test";
import assert from "node:assert/strict";
import { createProtocol } from "../src/protocol.js";

const baseConfig = {
  connectorId: "merchant-1",
  connectorToken: "secret",
  allowedMethods: ["new_invoice", "get_invoice"],
};

test("protocol v1 uses versioned routes and bearer authentication", () => {
  const protocol = createProtocol(baseConfig);
  assert.equal(protocol.paths.heartbeat, "/v1/connectors/heartbeat");
  assert.equal(protocol.paths.poll, "/v1/connectors/poll");
  assert.equal(
    protocol.paths.result("a/b"),
    "/v1/connectors/commands/a%2Fb/result",
  );
  assert.equal(protocol.headers.Authorization, "Bearer secret");
  assert.equal(protocol.pollBody().connectorId, "merchant-1");
});

test("each protocol carries one instance id on every request", () => {
  const first = createProtocol(baseConfig);
  const second = createProtocol(baseConfig);
  assert.match(first.headers["X-Fiber-Connector-Instance"], /^[0-9a-f-]{36}$/);
  assert.equal(first.headers["X-Fiber-Connector-Instance"], first.instanceId);
  assert.notEqual(first.instanceId, second.instanceId);
  assert.equal(
    createProtocol({ ...baseConfig, instanceId: "fixed" }).headers["X-Fiber-Connector-Instance"],
    "fixed",
  );
});
