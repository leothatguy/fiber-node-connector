# Deployment

## Persistent Docker process

Use a restart policy for a merchant connector:

```bash
docker run -d \
  --name fiber-node-connector \
  --restart unless-stopped \
  --network host \
  --env-file connector.env \
  fiber-node-connector:local
```

Avoid placing secrets directly in shell history. Use an environment file with restrictive file permissions or a container secret mechanism.

## Remote backend

The backend may run on any host reachable from the merchant machine. Use a valid HTTPS URL:

```env
BACKEND_URL=https://payments.example.com
```

The merchant network needs outbound HTTPS access. No inbound connector port is required.

Plain HTTP is accepted automatically only for loopback backend URLs. A private development backend can opt in explicitly:

```env
CONNECTOR_ALLOW_INSECURE_BACKEND=true
```

Do not use that override for internet-facing deployments.

## Fiber RPC location

- Host process on Linux: use host networking and `http://127.0.0.1:8227`.
- Container: use a shared private Docker network and `http://fiber:8227`.
- Remote private node: use a LAN or VPN address.

If Fiber RPC authentication is enabled:

```env
FIBER_RPC_BEARER_TOKEN=replace-with-node-rpc-token
```

## Logs and shutdown

Use JSON logs in production:

```env
LOG_FORMAT=json
LOG_LEVEL=info
```

The connector handles `SIGTERM` and `SIGINT`, stops its heartbeat and poll loops, and exits without opening a listening port.
