// Not a test file: kept outside test/ so `node --test` does not run it.
// Runs the connector loops with in-memory clients and nothing else holding the
// event loop open, exactly as src/index.js does: only a signal stops it.
import { FiberNodeConnector } from "../src/connector.js";

let heartbeats = 0;
const connector = new FiberNodeConnector({
  config: { heartbeatMs: 50, pollMs: 50, retryMinMs: 50, retryMaxMs: 200 },
  backend: {
    heartbeat: async () => {
      heartbeats += 1;
    },
    poll: async () => null,
    complete: async () => {},
  },
  fiberRpc: {
    call: async (method) =>
      method === "node_info" ? { pubkey: "03ab" } : { channels: [] },
  },
  commandPolicy: { assert() {} },
  logger: { info() {}, warn() {} },
});

const abortController = new AbortController();
process.once("SIGTERM", () => abortController.abort());
process.send?.("started");
await connector.start(abortController.signal);
process.send?.({ heartbeats });
