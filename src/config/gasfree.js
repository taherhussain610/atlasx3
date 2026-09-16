const DEFAULT_GASFREE_BASE_URL = "https://developer.gasfree.io";

/**
 * @typedef {"mainnet" | "testnet"} GasFreeTronNetwork
 */

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
function loadGasFreeConfig(env = process.env) {
  const enabled = parseBoolean(env.GASFREE_ENABLED, false);
  const baseUrl = (env.GASFREE_BASE_URL || DEFAULT_GASFREE_BASE_URL).trim();
  const config = {
    enabled,
    baseUrl,
    credentials: {
      mainnet: {
        apiKey: (env.GASFREE_TRON_MAINNET_API_KEY || "").trim(),
        apiSecret: (env.GASFREE_TRON_MAINNET_API_SECRET || "").trim(),
      },
      testnet: {
        apiKey: (env.GASFREE_TRON_TESTNET_API_KEY || "").trim(),
        apiSecret: (env.GASFREE_TRON_TESTNET_API_SECRET || "").trim(),
      },
    },
  };

  if (!enabled) {
    return config;
  }

  const missingVars = [];
  if (!config.baseUrl) {
    missingVars.push("GASFREE_BASE_URL");
  }

  if (!config.credentials.mainnet.apiKey) {
    missingVars.push("GASFREE_TRON_MAINNET_API_KEY");
  }
  if (!config.credentials.mainnet.apiSecret) {
    missingVars.push("GASFREE_TRON_MAINNET_API_SECRET");
  }
  if (!config.credentials.testnet.apiKey) {
    missingVars.push("GASFREE_TRON_TESTNET_API_KEY");
  }
  if (!config.credentials.testnet.apiSecret) {
    missingVars.push("GASFREE_TRON_TESTNET_API_SECRET");
  }

  if (missingVars.length > 0) {
    throw new Error(
      `GasFree is enabled but required environment variables are missing: ${missingVars.join(", ")}`
    );
  }

  return config;
}

/**
 * @param {string} tronNetwork
 * @returns {GasFreeTronNetwork}
 */
function resolveGasFreeNetwork(tronNetwork) {
  return tronNetwork === "mainnet" ? "mainnet" : "testnet";
}

/**
 * @param {{ credentials: { mainnet: { apiKey: string, apiSecret: string }, testnet: { apiKey: string, apiSecret: string } } }} config
 * @param {GasFreeTronNetwork} network
 */
function getGasFreeCredentials(config, network) {
  if (!config.credentials || !config.credentials[network]) {
    throw new Error(`Unsupported GasFree network '${network}'. Use 'mainnet' or 'testnet'.`);
  }
  return config.credentials[network];
}

module.exports = {
  DEFAULT_GASFREE_BASE_URL,
  loadGasFreeConfig,
  resolveGasFreeNetwork,
  getGasFreeCredentials,
};
