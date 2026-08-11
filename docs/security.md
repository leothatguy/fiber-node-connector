# Security model

## Trust boundary

The connector grants a backend limited access to a merchant Fiber node. It must be treated as a security-sensitive agent even though it does not hold the Fiber private key itself.

## Hardcoded maximum capabilities

The connector supports only:

- `node_info`
- `list_channels`
- `new_invoice`
- `get_invoice`

Configuration can disable capabilities but cannot add arbitrary RPC methods. This prevents a compromised backend from enabling payment sending, channel changes, or key-management operations through environment configuration.

## Network direction

The connector initiates all backend traffic. The backend never connects to the connector or Fiber RPC. Keep Fiber RPC on loopback, a private Docker network, LAN, or VPN.

## Tokens

- Generate high-entropy connector tokens.
- Show the raw token once.
- Store only a cryptographic hash on the backend.
- Bind each token to one connector ID.
- Rotate tokens after suspected disclosure.
- Never log connector or Fiber RPC bearer tokens.

## Command delivery

- Use random unique command IDs.
- Lease commands before delivery.
- Redeliver the same command ID after lease expiry.
- Accept repeated result submission idempotently.
- Keep an audit record of command method, connector ID, attempts, and result state.

## Heartbeats

Treat heartbeat data as operational metadata, not proof of payment. Payment state must come from a signed Fiber invoice lookup through `get_invoice` and application settlement rules.

## Public Fiber networking

The Fiber peer-to-peer port and Fiber RPC port have different purposes. Public routing may require a reachable peer-to-peer address. It does not require a public RPC endpoint.
