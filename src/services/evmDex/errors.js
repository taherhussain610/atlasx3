class DexIntegrationError extends Error {
  constructor(code, message, status = 400, details = null) {
    super(message);
    this.name = "DexIntegrationError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

module.exports = {
  DexIntegrationError,
};
