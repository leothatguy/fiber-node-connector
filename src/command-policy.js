import { SUPPORTED_FIBER_METHODS } from "./constants.js";

export class CommandPolicy {
  constructor(allowedMethods = SUPPORTED_FIBER_METHODS) {
    for (const method of allowedMethods) {
      if (!SUPPORTED_FIBER_METHODS.includes(method)) {
        throw new Error(`Unsupported Fiber command capability: ${method}`);
      }
    }
    this.allowedMethods = new Set(allowedMethods);
  }

  assert(command) {
    if (!command || typeof command !== "object") {
      throw new Error("Connector command must be an object");
    }
    if (typeof command.id !== "string" || command.id.trim() === "") {
      throw new Error("Connector command id is required");
    }
    if (typeof command.method !== "string") {
      throw new Error("Connector command method is required");
    }
    if (!SUPPORTED_FIBER_METHODS.includes(command.method)) {
      throw new Error(`Unsupported Fiber command: ${command.method}`);
    }
    if (!this.allowedMethods.has(command.method)) {
      throw new Error(`Fiber command is disabled by policy: ${command.method}`);
    }
    if (!Array.isArray(command.params)) {
      throw new Error("Connector command params must be an array");
    }
    return command;
  }
}
