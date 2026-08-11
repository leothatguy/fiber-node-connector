export class FiberRpcClient {
  constructor({ url, bearerToken, timeoutMs = 15_000, fetchImpl = fetch }) {
    this.url = url;
    this.bearerToken = bearerToken;
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl;
  }

  async call(method, params = []) {
    const headers = { "Content-Type": "application/json" };
    if (this.bearerToken) headers.Authorization = `Bearer ${this.bearerToken}`;

    const response = await this.fetchImpl(this.url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        method,
        params,
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Fiber RPC ${method} failed with HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (payload.error) {
      throw new Error(
        `Fiber RPC ${method} failed: ${payload.error.message ?? "unknown error"}`,
      );
    }
    if (!("result" in payload)) {
      throw new Error(`Fiber RPC ${method} returned no result`);
    }
    return payload.result;
  }
}
