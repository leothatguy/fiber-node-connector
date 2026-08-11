export class GatewayError extends Error {
  constructor(message, statusCode = 400, code = "GATEWAY_ERROR") {
    super(message);
    this.name = "GatewayError";
    this.statusCode = statusCode;
    this.code = code;
  }
}
