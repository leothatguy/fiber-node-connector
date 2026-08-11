# Fiber Node Connector

Fiber Node Connector is a small outbound agent that connects a private CKB Fiber node to a remote application backend. The merchant runs one container beside the Fiber node and supplies configuration at startup. The backend never needs inbound access to the merchant network or Fiber RPC.

```text
Remote application backend
          ^
          | outbound HTTPS heartbeat, poll, and result calls
          |
Fiber Node Connector -> private JSON-RPC -> merchant Fiber node
```

The connector is not a wallet, custodian, or unrestricted JSON-RPC proxy. Its hardcoded maximum capabilities are:

- `node_info`
- `list_channels`
- `new_invoice`
- `get_invoice`

Methods such as `send_payment`, channel opening, channel closing, and key management are not available to the backend.

## Current state

The standalone implementation is functional, locally buildable, and configured for tagged public image releases through GitHub Actions.

Included:

- generic versioned connector protocol;
- node and channel readiness heartbeats;
- outbound command polling;
- strict Fiber RPC capability policy;
- retry backoff and graceful shutdown;
- command-result replay protection in the agent;
- framework-neutral backend gateway;
- command leasing and redelivery in the reference gateway;
- reference HTTP backend;
- Docker packaging;
- protocol and integration tests.

The included gateway stores state in memory and is intended for development, tests, and integration examples. A production multi-replica backend should implement the same gateway contract with Redis or PostgreSQL.

## Quick start

### 1. Run the reference backend

```bash
npm run example:backend
```

Development defaults:

```text
Backend URL: http://127.0.0.1:8787
Connector ID: merchant-demo
Connector token: development-connector-token
Admin token: development-admin-token
```

### 2. Configure the connector

```bash
cp .env.example .env
```

For the reference backend:

```env
BACKEND_URL=http://127.0.0.1:8787
CONNECTOR_TOKEN=development-connector-token
CONNECTOR_ID=merchant-demo
FIBER_RPC_URL=http://127.0.0.1:8227
```

### 3. Run locally

```bash
npm start
```

Or build and run the container on Linux:

```bash
docker build -t fiber-node-connector:local .

docker run -d \
  --name fiber-node-connector \
  --restart unless-stopped \
  --network host \
  --env-file .env \
  fiber-node-connector:local
```

Do not combine `--rm` with `--restart unless-stopped` for a persistent merchant connector.

### 4. Query the connected node through the backend

Status:

```bash
curl http://127.0.0.1:8787/admin/connector \
  -H 'authorization: Bearer development-admin-token'
```

Execute an allowed command:

```bash
curl -X POST http://127.0.0.1:8787/admin/commands \
  -H 'authorization: Bearer development-admin-token' \
  -H 'content-type: application/json' \
  --data '{"method":"node_info","params":[]}'
```

The reference backend blocks while the connector polls, executes the Fiber RPC request, and returns the result.

## Run the public image

After the first tagged release, node owners can run the published image without source code or a local build:

```bash
docker pull ghcr.io/<github-owner>/fiber-node-connector:latest

docker run -d \
  --name fiber-node-connector \
  --restart unless-stopped \
  --network host \
  --env-file connector.env \
  ghcr.io/<github-owner>/fiber-node-connector:latest
```

Any application can use the same image by implementing Protocol v1 and issuing a connector ID and token to the node owner.

## Network arrangements

### Fiber node on the Linux host

Use `--network host` and:

```env
FIBER_RPC_URL=http://127.0.0.1:8227
```

### Fiber node in another container

Put both containers on a private Docker network and use the Fiber service name:

```env
FIBER_RPC_URL=http://fiber:8227
```

### Fiber node on another private machine

Use a LAN or VPN address:

```env
FIBER_RPC_URL=http://10.0.0.20:8227
```

Do not expose the Fiber RPC publicly. Fiber peer-to-peer reachability and Fiber RPC access are separate concerns.

## Documentation

- [Protocol v1](docs/protocol-v1.md)
- [Backend integration](docs/backend-integration.md)
- [Deployment](docs/deployment.md)
- [Releasing](docs/releasing.md)
- [Security model](docs/security.md)

## Verification

```bash
npm test
docker build -t fiber-node-connector:local .
```
