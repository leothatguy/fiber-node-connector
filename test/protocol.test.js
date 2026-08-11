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
