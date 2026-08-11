# Connector Protocol v1

Protocol v1 is an outbound HTTPS contract between a connector and an application backend.

## Authentication

Every connector request uses:

```http
Authorization: Bearer <connector-token>
X-Fiber-Connector-Version: 0.1.0
```

The backend should store only a secure hash of the connector token and bind the token to one connector ID or merchant identity.

## Heartbeat

```http
POST /v1/connectors/heartbeat
```

```json
{
  "protocolVersion": "1",
  "connectorId": "merchant-1",
  "capabilities": ["node_info", "list_channels", "new_invoice", "get_invoice"],
  "observedAt": "2026-07-22T12:00:00.000Z",
  "available": true,
  "reason": null,
  "node": {
    "pubkey": "03...",
    "name": "merchant-node",
    "version": "0.9.0",
    "addresses": []
  },
  "channels": {
    "total": 2,
    "enabled": 2,
    "ready": 1
  }
}
```

The backend should treat a connector as offline when heartbeats exceed its configured TTL.

## Poll

```http
POST /v1/connectors/poll
```

```json
{
  "protocolVersion": "1",
  "connectorId": "merchant-1",
  "capabilities": ["node_info", "list_channels", "new_invoice", "get_invoice"]
}
```

No command:

```json
{ "command": null }
```

Command:

```json
{
  "command": {
    "id": "4b25c79c-54e2-4814-88ca-a2df784e988f",
    "method": "get_invoice",
    "params": [{ "payment_hash": "0x..." }]
  }
}
```

The backend should lease commands and redeliver them after a lease expires. Reusing the same command ID allows the connector to submit its cached result without executing the Fiber method twice.

## Result

```http
POST /v1/connectors/commands/<command-id>/result
```

Success:

```json
{
  "protocolVersion": "1",
  "connectorId": "merchant-1",
  "completedAt": "2026-07-22T12:00:02.000Z",
  "ok": true,
  "result": { "status": "Paid" }
}
```

Failure:

```json
{
  "protocolVersion": "1",
  "connectorId": "merchant-1",
  "completedAt": "2026-07-22T12:00:02.000Z",
  "ok": false,
  "error": {
    "code": "COMMAND_FAILED",
    "message": "Fiber RPC get_invoice failed",
    "retryable": false
  }
}
```

## Backend requirements

A production backend must provide:

- token authentication and connector ownership;
- heartbeat persistence and active-state calculation;
- durable command queues;
- command leasing and redelivery;
- command timeouts and attempt limits;
- idempotent result acceptance;
- connector ID validation;
- audit logs and operational metrics.
