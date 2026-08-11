import { BackendClient } from "./backend-client.js";
import { CommandPolicy } from "./command-policy.js";
import { loadConfig } from "./config.js";
import { FiberNodeConnector } from "./connector.js";
import { FiberRpcClient } from "./fiber-rpc.js";
import { createLogger } from "./logger.js";
import { createProtocol } from "./protocol.js";
import { errorMessage } from "./utils.js";

const abortController = new AbortController();
for (const signalName of ["SIGINT", "SIGTERM"]) {
  process.once(signalName, () => abortController.abort());
}

try {
  const config = loadConfig();
  const logger = createLogger({
    level: config.logLevel,
    format: config.logFormat,
  });
  const protocol = createProtocol(config);
  const connector = new FiberNodeConnector({
    config,
    logger,
    commandPolicy: new CommandPolicy(config.allowedMethods),
    fiberRpc: new FiberRpcClient({
      url: config.fiberRpcUrl,
      bearerToken: config.fiberRpcBearerToken,
      timeoutMs: config.fiberRpcTimeoutMs,
    }),
    backend: new BackendClient({
      baseUrl: config.backendUrl,
      protocol,
      timeoutMs: config.backendTimeoutMs,
    }),
  });
  await connector.start(abortController.signal);
} catch (error) {
  console.error(errorMessage(error));
  process.exitCode = 1;
}
