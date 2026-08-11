# Backend integration

An application backend can integrate the connector in two ways.

## Implement Protocol v1 directly

Implement the three endpoints in [Protocol v1](protocol-v1.md). This works with any language or framework.

The backend creates application-specific APIs and translates their operations into allowlisted connector commands. For example, a payment application can expose:

```text
POST /merchants/:id/fiber-invoices
GET  /merchants/:id/fiber-invoices/:paymentHash
GET  /merchants/:id/fiber-node
```

Internally these become `new_invoice`, `get_invoice`, and heartbeat status reads.

## Embed the JavaScript gateway

The included `ConnectorGateway` is dependency-free:

```js
import {
  ConnectorGateway,
  createConnectorHttpHandler,
} from "fiber-node-connector/server";

const gateway = new ConnectorGateway();

gateway.registerConnector({
  connectorId: "merchant-1",
  token: "random-secret-shown-once",
});

const connectorHandler = createConnectorHttpHandler(gateway);
```

Use `connectorHandler(request, response)` before application routes. To access the connected Fiber node:

```js
const nodeInfo = await gateway.execute("merchant-1", "node_info", []);

const invoice = await gateway.execute("merchant-1", "new_invoice", [
  {
    amount: "0x5f5e100",
    currency: "Fibt",
    description: "Order 123",
    expiry: "0xe10",
    payment_preimage: "0x...",
    hash_algorithm: "sha256"
  }
]);
```

The gateway included in this repository stores registrations, heartbeats, and commands in process memory. It is suitable for tests, local development, and understanding the contract. Do not use it unchanged behind multiple backend replicas.

## Production storage adapter

For production, persist these records in Redis or PostgreSQL:

- connector registrations and token hashes;
- latest heartbeat and node binding;
- pending commands;
- delivery lease and attempt count;
- command result or error;
- expiry and completion time.

Use a unique command ID and accept repeated submission of the same result idempotently. Never issue a new command merely because the result response was lost.

## Integrating an existing backend

Existing applications should implement Protocol v1 at `/v1/connectors`, generate a unique connector ID and token for each node owner, and translate application operations into allowlisted commands. The connector does not require application-specific code or a custom image.
