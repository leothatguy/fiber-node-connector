export class BackendClient {
  constructor({ baseUrl, protocol, timeoutMs = 15_000, fetchImpl = fetch }) {
    this.baseUrl = baseUrl;
    this.protocol = protocol;
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl;
  }

  heartbeat(status) {
    return this.post(
      this.protocol.paths.heartbeat,
      this.protocol.heartbeatBody(status),
    );
  }

  async poll() {
    const response = await this.post(
      this.protocol.paths.poll,
      this.protocol.pollBody(),
    );
    return response?.command ?? null;
  }

  complete(commandId, payload) {
    return this.post(
      this.protocol.paths.result(commandId),
      this.protocol.resultBody(payload),
    );
  }

  async post(path, body) {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.protocol.headers,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Backend ${path} failed with HTTP ${response.status}${text ? `: ${text}` : ""}`,
      );
    }
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }
}
