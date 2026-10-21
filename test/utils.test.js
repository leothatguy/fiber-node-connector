import test from "node:test";
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { getEventListeners } from "node:events";
import { sleep } from "../src/utils.js";

test("sleep leaves no abort listener behind once it finishes", async () => {
  const controller = new AbortController();
  for (let index = 0; index < 20; index += 1) {
    await sleep(1, controller.signal);
  }
  assert.equal(getEventListeners(controller.signal, "abort").length, 0);
});

test("sleep ends early when the signal aborts", async () => {
  const controller = new AbortController();
  const started = Date.now();
  setTimeout(() => controller.abort(), 10);
  await sleep(10_000, controller.signal);
  assert.ok(Date.now() - started < 1_000);
});

test("an idle connector keeps running until it is signalled", async () => {
  const child = fork(new URL("../test-support/idle-connector.js", import.meta.url), {
    stdio: ["ignore", "ignore", "pipe", "ipc"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const messages = [];
  child.on("message", (message) => messages.push(message));
  const exited = new Promise((resolve) => child.once("exit", resolve));

  await new Promise((resolve) => child.once("message", resolve));
  // Several heartbeat intervals with nothing but the loops' own timers alive.
  const early = await Promise.race([
    exited.then((code) => ({ code })),
    new Promise((resolve) => setTimeout(() => resolve(null), 400)),
  ]);
  assert.equal(early, null, `connector exited on its own: ${JSON.stringify(early)} ${stderr}`);

  child.kill("SIGTERM");
  assert.equal(await exited, 0, stderr);
  const report = messages.find((message) => typeof message === "object");
  assert.ok(report.heartbeats >= 3, `only ${report.heartbeats} heartbeats`);
});
