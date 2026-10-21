import test from "node:test";
import assert from "node:assert/strict";
import { FiberNodeConnector } from "../src/connector.js";

function conflict() {
  const error = new Error("Backend /poll failed with HTTP 409");
  error.status = 409;
  return error;
}

function harness(backend) {
  const logs = [];
  const log = (level) => (event, fields) => logs.push({ level, event, fields });
  const connector = new FiberNodeConnector({
    config: { includeNodeAddresses: false },
    backend: { protocol: { instanceId: "i-1" }, ...backend },
    fiberRpc: {
      call: async (method) =>
        method === "node_info" ? { pubkey: "03ab" } : { channels: [] },
    },
    commandPolicy: { assert() {} },
    logger: { info: log("info"), warn: log("warn") },
  });
  return { connector, logs };
}

test("a 409 puts the connector on standby once, and a heartbeat brings it back", async () => {
  let reject = true;
  const { connector, logs } = harness({
    heartbeat: async () => {
      if (reject) throw conflict();
    },
  });

  for (let index = 0; index < 3; index += 1) {
    await assert.rejects(connector.heartbeatOnce(), /409/);
    assert.equal(connector.markStandby(conflict()), true);
  }
  assert.equal(logs.filter((entry) => entry.event === "connector_standby").length, 1);
  assert.equal(logs.some((entry) => entry.level === "warn"), false);

  reject = false;
  await connector.heartbeatOnce();
  assert.equal(connector.standby, false);
  assert.equal(logs.filter((entry) => entry.event === "connector_active").length, 1);
});

test("other backend failures are not standby", () => {
  const { connector } = harness({});
  const error = new Error("HTTP 500");
  error.status = 500;
  assert.equal(connector.markStandby(error), false);
  assert.equal(connector.markStandby(new Error("network down")), false);
});
