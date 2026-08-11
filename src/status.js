import { normalizeStatus } from "./utils.js";

export async function readFiberStatus(
  fiberRpc,
  { includeNodeAddresses = true } = {},
) {
  const [nodeInfo, channelResult] = await Promise.all([
    fiberRpc.call("node_info", []),
    fiberRpc.call("list_channels", [{}]),
  ]);
  const channels = Array.isArray(channelResult?.channels)
    ? channelResult.channels
    : [];
  const enabledChannels = channels.filter((channel) => channel?.enabled !== false);
  const readyChannels = enabledChannels.filter((channel) => {
    const state =
      channel?.state?.state_name ??
      channel?.state?.status ??
      channel?.state?.state ??
      channel?.state;
    return normalizeStatus(state) === "channelready";
  });
  const addresses = includeNodeAddresses ? readAddresses(nodeInfo) : [];
  const nodePubkey = normalizePubkey(nodeInfo?.pubkey ?? nodeInfo?.node_id);

  return {
    observedAt: new Date().toISOString(),
    available: readyChannels.length > 0,
    reason:
      readyChannels.length > 0 ? null : "Fiber node has no ready channels",
    node: {
      pubkey: nodePubkey,
      name: stringOrNull(nodeInfo?.node_name ?? nodeInfo?.name),
      version: stringOrNull(nodeInfo?.version),
      addresses,
    },
    channels: {
      total: channels.length,
      enabled: enabledChannels.length,
      ready: readyChannels.length,
    },
  };
}

function readAddresses(nodeInfo) {
  const input =
    nodeInfo?.addresses ??
    nodeInfo?.public_addresses ??
    nodeInfo?.announce_addresses ??
    [];
  if (!Array.isArray(input)) return [];
  return input.slice(0, 20).map((address) =>
    typeof address === "string"
      ? address
      : String(address?.address ?? address?.listen_addr ?? ""),
  ).filter(Boolean);
}

function normalizePubkey(value) {
  const text = stringOrNull(value);
  return text?.toLowerCase() ?? null;
}

function stringOrNull(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}
