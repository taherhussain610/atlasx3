const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

const { loadGasFreeConfig, resolveGasFreeNetwork } = require("../src/config/gasfree");
const { GasFreeApiError, GasFreeClient } = require("../src/services/gasfreeClient");

test("GasFree config defaults to disabled when toggle is absent", () => {
  const config = loadGasFreeConfig({});
  assert.equal(config.enabled, false);
  assert.equal(config.baseUrl, "https://developer.gasfree.io");
});

test("GasFree config throws clear error when enabled and required vars are missing", () => {
  assert.throws(
    () => loadGasFreeConfig({ GASFREE_ENABLED: "true" }),
    /GasFree is enabled but required environment variables are missing:/
  );
});

test("GasFree network mapping uses testnet for non-mainnet TRON networks", () => {
  assert.equal(resolveGasFreeNetwork("mainnet"), "mainnet");
  assert.equal(resolveGasFreeNetwork("shasta"), "testnet");
  assert.equal(resolveGasFreeNetwork("nile"), "testnet");
});

test("GasFree client builds signed auth headers with expected signature", () => {
  const config = loadGasFreeConfig({
    GASFREE_ENABLED: "true",
    GASFREE_BASE_URL: "https://developer.gasfree.io",
    GASFREE_TRON_MAINNET_API_KEY: "main-key",
    GASFREE_TRON_MAINNET_API_SECRET: "main-secret",
    GASFREE_TRON_TESTNET_API_KEY: "test-key",
    GASFREE_TRON_TESTNET_API_SECRET: "test-secret",
  });
  const client = new GasFreeClient(config, { httpClient: { request: async () => ({ data: {} }) } });
  const headers = client.buildAuthHeaders({
    network: "mainnet",
    method: "POST",
    path: "/v1/tron/transactions/submit",
    body: { amount: 1 },
    timestamp: "1234567890",
  });
  const expectedPayload =
    "1234567890:POST:/v1/tron/transactions/submit:{\"amount\":1}";
  const expectedSignature = crypto
    .createHmac("sha256", "main-secret")
    .update(expectedPayload)
    .digest("hex");

  assert.equal(headers["x-api-key"], "main-key");
  assert.equal(headers["x-timestamp"], "1234567890");
  assert.equal(headers["x-signature"], expectedSignature);
});

test("GasFree client sends signed request using configured base conventions", async () => {
  const config = loadGasFreeConfig({
    GASFREE_ENABLED: "true",
    GASFREE_BASE_URL: "https://developer.gasfree.io",
    GASFREE_TRON_MAINNET_API_KEY: "main-key",
    GASFREE_TRON_MAINNET_API_SECRET: "main-secret",
    GASFREE_TRON_TESTNET_API_KEY: "test-key",
    GASFREE_TRON_TESTNET_API_SECRET: "test-secret",
  });

  let capturedRequest;
  const client = new GasFreeClient(config, {
    httpClient: {
      async request(requestConfig) {
        capturedRequest = requestConfig;
        return { data: { ok: true } };
      },
    },
  });

  const response = await client.request({
    network: "mainnet",
    method: "POST",
    path: "/v1/tron/transactions/estimate",
    data: { to: "TAddress", amount: 1.25 },
    timestamp: "1111",
  });

  assert.deepEqual(response, { ok: true });
  assert.equal(capturedRequest.url, "/v1/tron/transactions/estimate");
  assert.equal(capturedRequest.method, "POST");
  assert.equal(capturedRequest.headers["x-api-key"], "main-key");
});

test("GasFree client wraps upstream errors with status and payload", async () => {
  const config = loadGasFreeConfig({
    GASFREE_ENABLED: "true",
    GASFREE_BASE_URL: "https://developer.gasfree.io",
    GASFREE_TRON_MAINNET_API_KEY: "main-key",
    GASFREE_TRON_MAINNET_API_SECRET: "main-secret",
    GASFREE_TRON_TESTNET_API_KEY: "test-key",
    GASFREE_TRON_TESTNET_API_SECRET: "test-secret",
  });
  const upstreamError = new Error("request failed");
  upstreamError.response = { status: 401, data: { message: "invalid signature" } };

  const client = new GasFreeClient(config, {
    httpClient: {
      async request() {
        throw upstreamError;
      },
    },
  });

  await assert.rejects(
    () =>
      client.request({
        network: "mainnet",
        method: "GET",
        path: "/status",
      }),
    (error) => {
      assert.ok(error instanceof GasFreeApiError);
      assert.equal(error.statusCode, 401);
      assert.equal(error.message, "invalid signature");
      return true;
    }
  );
});
