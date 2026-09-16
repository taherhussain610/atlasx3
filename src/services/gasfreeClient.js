const axios = require("axios");
const crypto = require("crypto");

const { getGasFreeCredentials } = require("../config/gasfree");

class GasFreeApiError extends Error {
  constructor(message, statusCode, responseBody) {
    super(message);
    this.name = "GasFreeApiError";
    this.statusCode = statusCode || null;
    this.responseBody = responseBody || null;
  }
}

class GasFreeClient {
  constructor(config, { httpClient } = {}) {
    this.config = config;
    this.httpClient =
      httpClient ||
      axios.create({
        baseURL: config.baseUrl,
        timeout: 30000,
      });
  }

  buildAuthHeaders({ network, method, path, body, timestamp }) {
    if (!path || typeof path !== "string") {
      throw new GasFreeApiError("GasFree request path is required.");
    }
    const { apiKey, apiSecret } = getGasFreeCredentials(this.config, network);
    const normalizedMethod = String(method || "GET").toUpperCase();
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const ts = timestamp || Date.now().toString();
    const serializedBody = body === undefined || body === null ? "" : JSON.stringify(body);
    const payload = `${ts}:${normalizedMethod}:${normalizedPath}:${serializedBody}`;
    const signature = crypto.createHmac("sha256", apiSecret).update(payload).digest("hex");

    return {
      accept: "application/json",
      "content-type": "application/json",
      "x-api-key": apiKey,
      "x-timestamp": ts,
      "x-signature": signature,
    };
  }

  async request({ network, method = "GET", path, data, params, timestamp }) {
    if (!network) {
      throw new GasFreeApiError("GasFree network is required.");
    }
    if (!path || typeof path !== "string") {
      throw new GasFreeApiError("GasFree request path is required.");
    }
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    try {
      const headers = this.buildAuthHeaders({
        network,
        method,
        path: normalizedPath,
        body: data,
        timestamp,
      });
      const response = await this.httpClient.request({
        url: normalizedPath,
        method,
        params,
        data,
        headers,
      });
      return response.data;
    } catch (error) {
      if (error instanceof GasFreeApiError) {
        throw error;
      }
      const statusCode = error.response?.status;
      const responseBody = error.response?.data;
      const message =
        responseBody?.message ||
        responseBody?.error ||
        error.message ||
        "GasFree request failed";
      throw new GasFreeApiError(message, statusCode, responseBody);
    }
  }

  async estimateTransaction(payload, network) {
    return this.request({
      network,
      method: "POST",
      path: "/v1/tron/transactions/estimate",
      data: payload,
    });
  }

  async sponsorTransaction(payload, network) {
    return this.request({
      network,
      method: "POST",
      path: "/v1/tron/transactions/sponsor",
      data: payload,
    });
  }

  async submitTransaction(payload, network) {
    return this.request({
      network,
      method: "POST",
      path: "/v1/tron/transactions/submit",
      data: payload,
    });
  }
}

module.exports = {
  GasFreeApiError,
  GasFreeClient,
};
