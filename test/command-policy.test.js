import test from "node:test";
import assert from "node:assert/strict";
import { CommandPolicy } from "../src/command-policy.js";

test("accepts an enabled safe command", () => {
  const policy = new CommandPolicy(["new_invoice"]);
  const command = { id: "command-1", method: "new_invoice", params: [{}] };
  assert.equal(policy.assert(command), command);
});

test("rejects a safe command disabled by local policy", () => {
  const policy = new CommandPolicy(["get_invoice"]);
  assert.throws(
    () => policy.assert({ id: "command-1", method: "new_invoice", params: [] }),
    /disabled by policy/,
  );
});

test("rejects arbitrary Fiber RPC commands", () => {
  const policy = new CommandPolicy();
  assert.throws(
    () => policy.assert({ id: "command-1", method: "send_payment", params: [] }),
    /Unsupported Fiber command/,
  );
});
