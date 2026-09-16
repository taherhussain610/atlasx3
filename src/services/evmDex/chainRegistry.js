const { ethers } = require("ethers");

const PROTOCOLS = Object.freeze({
  UNISWAP_V2: "uniswap_v2",
  UNISWAP_V3: "uniswap_v3",
  UNISWAP_V4: "uniswap_v4",
  PANCAKESWAP_INFINITY: "pancakeswap_infinity",
});

const PROTOCOL_ALIASES = Object.freeze({
  uniswap_v2: PROTOCOLS.UNISWAP_V2,
  uniswapv2: PROTOCOLS.UNISWAP_V2,
  "uniswap-v2": PROTOCOLS.UNISWAP_V2,
  v2: PROTOCOLS.UNISWAP_V2,
  uniswap_v3: PROTOCOLS.UNISWAP_V3,
  uniswapv3: PROTOCOLS.UNISWAP_V3,
  "uniswap-v3": PROTOCOLS.UNISWAP_V3,
  v3: PROTOCOLS.UNISWAP_V3,
  uniswap_v4: PROTOCOLS.UNISWAP_V4,
  uniswapv4: PROTOCOLS.UNISWAP_V4,
  "uniswap-v4": PROTOCOLS.UNISWAP_V4,
  v4: PROTOCOLS.UNISWAP_V4,
  infinity: PROTOCOLS.PANCAKESWAP_INFINITY,
  pancakeswap_infinity: PROTOCOLS.PANCAKESWAP_INFINITY,
  "pancakeswap-infinity": PROTOCOLS.PANCAKESWAP_INFINITY,
});

const BASE_CHAIN_REGISTRY = [
  {
    chainId: 1,
    key: "ethereum",
    name: "Ethereum",
    rpcEnvKey: "ETH_RPC_URL",
    explorerBaseUrl: "https://etherscan.io",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    deployments: {
      [PROTOCOLS.UNISWAP_V2]: {
        factory: "0x5C69bEe701ef814A2B6a3EDD4B1652CB9cc5aA6f",
        router: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
      },
      [PROTOCOLS.UNISWAP_V3]: {
        factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
        swapRouter: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
        quoter: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
        positionManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
        feeTiers: [500, 3000, 10000],
      },
      [PROTOCOLS.UNISWAP_V4]: null,
      [PROTOCOLS.PANCAKESWAP_INFINITY]: null,
    },
  },
  {
    chainId: 11155111,
    key: "sepolia",
    name: "Sepolia",
    rpcEnvKey: "EVM_SEPOLIA_RPC_URL",
    explorerBaseUrl: "https://sepolia.etherscan.io",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    deployments: {},
  },
  {
    chainId: 56,
    key: "bsc",
    name: "BNB Smart Chain",
    rpcEnvKey: "BSC_RPC_URL",
    explorerBaseUrl: "https://bscscan.com",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    deployments: {},
  },
  {
    chainId: 97,
    key: "bsc_testnet",
    name: "BSC Testnet",
    rpcEnvKey: "EVM_BSC_TESTNET_RPC_URL",
    explorerBaseUrl: "https://testnet.bscscan.com",
    nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
    deployments: {},
  },
  {
    chainId: 137,
    key: "polygon",
    name: "Polygon",
    rpcEnvKey: "EVM_POLYGON_RPC_URL",
    explorerBaseUrl: "https://polygonscan.com",
    nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
    deployments: {},
  },
  {
    chainId: 8453,
    key: "base",
    name: "Base",
    rpcEnvKey: "EVM_BASE_RPC_URL",
    explorerBaseUrl: "https://basescan.org",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    deployments: {},
  },
  {
    chainId: 42161,
    key: "arbitrum",
    name: "Arbitrum One",
    rpcEnvKey: "EVM_ARBITRUM_RPC_URL",
    explorerBaseUrl: "https://arbiscan.io",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    deployments: {},
  },
];

const DEPLOYMENT_ENV_FIELDS = Object.freeze({
  [PROTOCOLS.UNISWAP_V2]: ["factory", "router"],
  [PROTOCOLS.UNISWAP_V3]: ["factory", "swapRouter", "quoter", "positionManager", "feeTiers"],
  [PROTOCOLS.UNISWAP_V4]: ["poolManager", "router", "positionManager"],
  [PROTOCOLS.PANCAKESWAP_INFINITY]: ["poolManager", "router"],
});

function normalizeProtocol(value) {
  const protocol = String(value || "")
    .trim()
    .toLowerCase();
  return PROTOCOL_ALIASES[protocol] || null;
}

function getProtocolEnvPrefix(protocol) {
  return protocol.toUpperCase();
}

function sanitizeAddress(address) {
  if (!address) {
    return null;
  }
  const trimmed = String(address).trim();
  if (!trimmed || !ethers.isAddress(trimmed)) {
    return null;
  }
  return ethers.getAddress(trimmed);
}

function parseFeeTiers(value, fallback = [500, 3000, 10000]) {
  if (!value) {
    return fallback;
  }

  const tiers = String(value)
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0 && item < 1_000_000);

  return tiers.length ? [...new Set(tiers)] : fallback;
}

function loadProtocolFromEnv(env, chainId, protocol, baseDeployment) {
  const prefix = `DEX_CHAIN_${chainId}_${getProtocolEnvPrefix(protocol)}`;
  const fields = DEPLOYMENT_ENV_FIELDS[protocol] || [];

  const next = {
    ...(baseDeployment || {}),
  };

  let overridden = false;

  for (const field of fields) {
    const key = `${prefix}_${field.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`;
    const value = env[key];
    if (!value) {
      continue;
    }

    overridden = true;

    if (field === "feeTiers") {
      next[field] = parseFeeTiers(value, baseDeployment?.feeTiers || [500, 3000, 10000]);
      continue;
    }

    next[field] = sanitizeAddress(value);
  }

  if (!baseDeployment && !overridden) {
    return null;
  }

  return next;
}

function buildChainRegistry(env = process.env) {
  return BASE_CHAIN_REGISTRY.map((chain) => {
    const deployments = {};
    for (const protocol of Object.values(PROTOCOLS)) {
      deployments[protocol] = loadProtocolFromEnv(
        env,
        chain.chainId,
        protocol,
        chain.deployments[protocol] || null
      );
    }

    const directRpcKey = `EVM_CHAIN_${chain.chainId}_RPC_URL`;

    return {
      ...chain,
      rpcUrl: (env[directRpcKey] || env[chain.rpcEnvKey] || "").trim(),
      deployments,
    };
  });
}

module.exports = {
  PROTOCOLS,
  normalizeProtocol,
  buildChainRegistry,
  parseFeeTiers,
  sanitizeAddress,
};
