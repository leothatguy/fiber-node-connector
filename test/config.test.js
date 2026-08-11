import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.js";

test("loads generic configuration and safe defaults", () => {
  const config = loadConfig({
    BACKEND_URL: "https://api.example.com",
    CONNECTOR_TOKEN: "secret",
    CONNECTOR_ID: "merchant-1",
  });

  assert.equal(config.backendUrl, "https://api.example.com");
  assert.equal(config.fiberRpcUrl, "http://127.0.0.1:8227");
  assert.deepEqual(config.allowedMethods, [
    "node_info",
    "list_channels",
    "new_invoice",
    "get_invoice",
  ]);
});

test("rejects insecure non-loopback backend URLs by default", () => {
  assert.throws(
    () =>
      loadConfig({
        BACKEND_URL: "http://192.168.1.5:3000",
        CONNECTOR_TOKEN: "secret",
        CONNECTOR_ID: "merchant-1",
      }),
    /must use HTTPS/,
  );
});

test("rejects methods outside the hardcoded connector capabilities", () => {
  assert.throws(
    () =>
      loadConfig({
        BACKEND_URL: "http://127.0.0.1:3000",
        CONNECTOR_TOKEN: "secret",
        CONNECTOR_ID: "merchant-1",
        CONNECTOR_ALLOWED_METHODS: "node_info,send_payment",
      }),
    /Unsupported CONNECTOR_ALLOWED_METHODS entry: send_payment/,
  );
});
