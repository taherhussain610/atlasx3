const { ethers } = require("ethers");
const { DexIntegrationError } = require("./errors");
const { buildChainRegistry, normalizeProtocol, PROTOCOLS, parseFeeTiers } = require("./chainRegistry");
const uniswapV2Adapter = require("./adapters/uniswapV2Adapter");
const uniswapV3Adapter = require("./adapters/uniswapV3Adapter");
const uniswapV4Adapter = require("./adapters/uniswapV4Adapter");
const infinityAdapter = require("./adapters/infinityAdapter");

const protocolLabels = Object.freeze({
  [PROTOCOLS.UNISWAP_V2]: "Uniswap V2",
  [PROTOCOLS.UNISWAP_V3]: "Uniswap V3",
  [PROTOCOLS.UNISWAP_V4]: "Uniswap V4",
  [PROTOCOLS.PANCAKESWAP_INFINITY]: "PancakeSwap Infinity",
});

const protocolOperations = Object.freeze({
  [PROTOCOLS.UNISWAP_V2]: ["pool_lookup", "quote", "prepare_swap", "prepare_add_liquidity", "prepare_remove_liquidity"],
  [PROTOCOLS.UNISWAP_V3]: ["pool_lookup", "quote", "prepare_swap", "prepare_add_liquidity", "prepare_remove_liquidity"],
  [PROTOCOLS.UNISWAP_V4]: ["pool_lookup", "quote", "prepare_swap", "prepare_add_liquidity", "prepare_remove_liquidity"],
  [PROTOCOLS.PANCAKESWAP_INFINITY]: ["pool_lookup", "quote", "prepare_swap", "prepare_add_liquidity", "prepare_remove_liquidity"],
});

const adapters = Object.freeze({
  [PROTOCOLS.UNISWAP_V2]: uniswapV2Adapter,
  [PROTOCOLS.UNISWAP_V3]: uniswapV3Adapter,
  [PROTOCOLS.UNISWAP_V4]: uniswapV4Adapter,
  [PROTOCOLS.PANCAKESWAP_INFINITY]: infinityAdapter,
});

function normalizeChainId(value) {
  const chainId = Number(value);
  return Number.isInteger(chainId) && chainId > 0 ? chainId : null;
}

function toAtomicAmount(amount, decimals) {
  try {
    return ethers.parseUnits(String(amount), Number(decimals));
  } catch {
    throw new DexIntegrationError("INVALID_AMOUNT", "Invalid amount for token decimals");
  }
}

function validateAddress(value, fieldName) {
  if (!value || !ethers.isAddress(String(value).trim())) {
    throw new DexIntegrationError("INVALID_ADDRESS", `Invalid ${fieldName} address`);
  }
  return ethers.getAddress(String(value).trim());
}

function toDeadlineTimestamp(deadline) {
  const parsed = Number(deadline);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new DexIntegrationError("INVALID_DEADLINE", "deadline must be a future unix timestamp");
  }

  const now = Math.floor(Date.now() / 1000);
  if (parsed <= now) {
    throw new DexIntegrationError("INVALID_DEADLINE", "deadline must be in the future");
  }

  return Math.floor(parsed);
}

function normalizeSlippageBps(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 5000) {
    throw new DexIntegrationError("INVALID_SLIPPAGE", "slippageBps must be between 0 and 5000");
  }
  return Math.round(parsed);
}

class EvmDexService {
  constructor(options = {}) {
    this.registry = buildChainRegistry(options.env);
    this.providers = new Map();
  }

  getChain(chainIdInput) {
    const chainId = normalizeChainId(chainIdInput);
    if (!chainId) {
      throw new DexIntegrationError("INVALID_CHAIN_ID", "chainId must be a positive integer");
    }

    const chain = this.registry.find((item) => item.chainId === chainId);
    if (!chain) {
      throw new DexIntegrationError("UNSUPPORTED_CHAIN", `Unsupported chainId ${chainId}`);
    }

    return chain;
  }

  getAdapter(protocolInput) {
    const protocol = normalizeProtocol(protocolInput);
    if (!protocol) {
      throw new DexIntegrationError("UNSUPPORTED_PROTOCOL", "Unsupported DEX protocol");
    }
    return {
      protocol,
      adapter: adapters[protocol],
    };
  }

  getDeployment(chain, protocol, adapter) {
    const deployment = chain.deployments[protocol];
    if (!deployment) {
      throw new DexIntegrationError(
        "UNSUPPORTED_PROTOCOL_ON_CHAIN",
        `${protocolLabels[protocol]} is not configured on chain ${chain.chainId}`
      );
    }

    const missingField = (adapter.requiredFields || []).find((field) => !deployment[field]);
    if (missingField) {
      throw new DexIntegrationError(
        "UNSUPPORTED_PROTOCOL_ON_CHAIN",
        `${protocolLabels[protocol]} is missing ${missingField} on chain ${chain.chainId}`
      );
    }

    return deployment;
  }

  getProvider(chain) {
    if (!chain.rpcUrl) {
      throw new DexIntegrationError(
        "RPC_NOT_CONFIGURED",
        `Missing RPC configuration for chain ${chain.chainId}. Set ${chain.rpcEnvKey} or EVM_CHAIN_${chain.chainId}_RPC_URL.`
      );
    }

    if (!this.providers.has(chain.chainId)) {
      this.providers.set(chain.chainId, new ethers.JsonRpcProvider(chain.rpcUrl, chain.chainId));
    }

    return this.providers.get(chain.chainId);
  }

  getSupportMatrix() {
    return {
      protocols: Object.values(PROTOCOLS).map((protocol) => ({
        key: protocol,
        label: protocolLabels[protocol],
      })),
      networks: this.registry.map((chain) => ({
        chainId: chain.chainId,
        key: chain.key,
        name: chain.name,
        rpcConfigured: Boolean(chain.rpcUrl),
        rpcEnvKey: chain.rpcEnvKey,
        nativeCurrency: chain.nativeCurrency,
        explorerBaseUrl: chain.explorerBaseUrl,
        protocols: Object.values(PROTOCOLS).map((protocol) => {
          const adapter = adapters[protocol];
          const deployment = chain.deployments[protocol];
          const missingField = deployment
            ? (adapter.requiredFields || []).find((field) => !deployment[field])
            : "deployment";

          return {
            protocol,
            label: protocolLabels[protocol],
            supported: Boolean(chain.rpcUrl && deployment && !missingField),
            operations: protocolOperations[protocol],
            reason: chain.rpcUrl
              ? missingField
                ? `Missing ${missingField} configuration`
                : null
              : `Missing RPC URL in ${chain.rpcEnvKey} or EVM_CHAIN_${chain.chainId}_RPC_URL`,
          };
        }),
      })),
    };
  }

  async lookupPools(params = {}) {
    const chain = this.getChain(params.chainId);
    const { protocol, adapter } = this.getAdapter(params.protocol);
    const deployment = this.getDeployment(chain, protocol, adapter);
    const provider = this.getProvider(chain);

    const tokenA = params.tokenA ? validateAddress(params.tokenA, "tokenA") : null;
    const tokenB = params.tokenB ? validateAddress(params.tokenB, "tokenB") : null;
    const poolAddress = params.poolAddress ? validateAddress(params.poolAddress, "poolAddress") : null;
    const feeTier = params.feeTier == null ? null : Number(params.feeTier);
    if (feeTier != null && (!Number.isInteger(feeTier) || feeTier <= 0)) {
      throw new DexIntegrationError("INVALID_FEE_TIER", "feeTier must be a positive integer");
    }

    const pools = await adapter.findPools({
      provider,
      deployment,
      chainId: chain.chainId,
      protocol,
      tokenA,
      tokenB,
      feeTier,
      poolAddress,
    });

    return {
      protocol,
      chainId: chain.chainId,
      pools,
      warnings: pools.length
        ? ["Pool data is fetched live and may change between quote and transaction confirmation."]
        : ["No pools were found for the requested inputs on this protocol/chain."],
    };
  }

  async buildQuote(params = {}) {
    const chain = this.getChain(params.chainId);
    const { protocol, adapter } = this.getAdapter(params.protocol);
    const deployment = this.getDeployment(chain, protocol, adapter);
    const provider = this.getProvider(chain);

    const tokenIn = validateAddress(params.tokenIn, "tokenIn");
    const tokenOut = validateAddress(params.tokenOut, "tokenOut");
    const tokenInDecimals = Number(params.tokenInDecimals ?? 18);
    const tokenOutDecimals = Number(params.tokenOutDecimals ?? 18);

    if (!Number.isInteger(tokenInDecimals) || tokenInDecimals < 0 || tokenInDecimals > 36) {
      throw new DexIntegrationError("INVALID_TOKEN_DECIMALS", "tokenInDecimals must be an integer between 0 and 36");
    }

    if (!Number.isInteger(tokenOutDecimals) || tokenOutDecimals < 0 || tokenOutDecimals > 36) {
      throw new DexIntegrationError("INVALID_TOKEN_DECIMALS", "tokenOutDecimals must be an integer between 0 and 36");
    }

    const amountInAtomic = toAtomicAmount(params.amountIn, tokenInDecimals);
    if (amountInAtomic <= 0n) {
      throw new DexIntegrationError("INVALID_AMOUNT", "amountIn must be greater than zero");
    }

    const slippageBps = normalizeSlippageBps(params.slippageBps ?? 100);

    if (protocol === PROTOCOLS.UNISWAP_V2) {
      const lookup = await this.lookupPools({
        chainId: chain.chainId,
        protocol,
        tokenA: tokenIn,
        tokenB: tokenOut,
        poolAddress: params.poolAddress,
      });
      const pool = lookup.pools[0];
      if (!pool) {
        throw new DexIntegrationError("POOL_NOT_FOUND", "No pool found for the requested pair");
      }

      const quote = adapter.buildQuote({
        pool,
        tokenIn,
        amountIn: amountInAtomic,
        slippageBps,
      });

      return {
        protocol,
        chainId: chain.chainId,
        tokenIn,
        tokenOut,
        amountIn: String(params.amountIn),
        amountInAtomic: amountInAtomic.toString(),
        amountOut: ethers.formatUnits(quote.amountOut, tokenOutDecimals),
        amountOutAtomic: quote.amountOut.toString(),
        minimumAmountOut: ethers.formatUnits(quote.minAmountOut, tokenOutDecimals),
        minimumAmountOutAtomic: quote.minAmountOut.toString(),
        feeTier: quote.feeBps,
        warnings: [...quote.warnings, "Set a realistic deadline and slippage for non-guaranteed execution."],
      };
    }

    if (protocol === PROTOCOLS.UNISWAP_V3) {
      const feeTier = Number(params.feeTier);
      if (!Number.isInteger(feeTier) || feeTier <= 0) {
        throw new DexIntegrationError("INVALID_FEE_TIER", "feeTier is required for Uniswap V3 quotes");
      }

      const quote = await adapter.quote({
        provider,
        deployment,
        tokenIn,
        tokenOut,
        feeTier,
        amountIn: amountInAtomic,
        slippageBps,
      });

      return {
        protocol,
        chainId: chain.chainId,
        tokenIn,
        tokenOut,
        feeTier,
        amountIn: String(params.amountIn),
        amountInAtomic: amountInAtomic.toString(),
        amountOut: ethers.formatUnits(quote.amountOut, tokenOutDecimals),
        amountOutAtomic: quote.amountOut.toString(),
        minimumAmountOut: ethers.formatUnits(quote.minAmountOut, tokenOutDecimals),
        minimumAmountOutAtomic: quote.minAmountOut.toString(),
        warnings: [...quote.warnings, "Set a realistic deadline and slippage for non-guaranteed execution."],
      };
    }

    await adapter.quote({ provider, deployment, params });
    throw new DexIntegrationError("UNSUPPORTED_PROTOCOL_ON_CHAIN", "Unsupported quote flow");
  }

  buildSwapTx(params = {}) {
    const chain = this.getChain(params.chainId);
    const { protocol, adapter } = this.getAdapter(params.protocol);
    const deployment = this.getDeployment(chain, protocol, adapter);

    const walletAddress = validateAddress(params.walletAddress, "walletAddress");
    const tokenIn = validateAddress(params.tokenIn, "tokenIn");
    const tokenOut = validateAddress(params.tokenOut, "tokenOut");

    const tokenInDecimals = Number(params.tokenInDecimals ?? 18);
    const tokenOutDecimals = Number(params.tokenOutDecimals ?? 18);
    const amountIn = toAtomicAmount(params.amountIn, tokenInDecimals);
    const minimumAmountOut = toAtomicAmount(params.minimumAmountOut, tokenOutDecimals);
    const deadline = toDeadlineTimestamp(params.deadline);

    if (minimumAmountOut < 0n || minimumAmountOut > amountIn * 10_000_000n) {
      throw new DexIntegrationError("INVALID_AMOUNT", "minimumAmountOut is outside expected bounds");
    }

    let tx;
    if (protocol === PROTOCOLS.UNISWAP_V2) {
      tx = adapter.buildSwapTx({
        deployment,
        walletAddress,
        tokenIn,
        tokenOut,
        amountIn,
        amountOutMin: minimumAmountOut,
        deadline,
      });
    } else if (protocol === PROTOCOLS.UNISWAP_V3) {
      const feeTier = Number(params.feeTier);
      if (!Number.isInteger(feeTier) || feeTier <= 0) {
        throw new DexIntegrationError("INVALID_FEE_TIER", "feeTier is required for Uniswap V3 swaps");
      }
      tx = adapter.buildSwapTx({
        deployment,
        walletAddress,
        tokenIn,
        tokenOut,
        feeTier,
        deadline,
        amountIn,
        amountOutMin: minimumAmountOut,
      });
    } else {
      tx = adapter.buildSwapTx(params);
    }

    return {
      protocol,
      chainId: chain.chainId,
      walletAddress,
      txRequest: {
        ...tx,
        chainId: chain.chainId,
        from: walletAddress,
      },
      warnings: [
        "Prepared transaction is unsigned. Sign and broadcast with your wallet.",
        "Validate wallet network matches chainId before signing.",
      ],
    };
  }

  buildAddLiquidityTx(params = {}) {
    const chain = this.getChain(params.chainId);
    const { protocol, adapter } = this.getAdapter(params.protocol);
    const deployment = this.getDeployment(chain, protocol, adapter);
    const walletAddress = validateAddress(params.walletAddress, "walletAddress");
    const deadline = toDeadlineTimestamp(params.deadline);

    let tx;
    if (protocol === PROTOCOLS.UNISWAP_V2) {
      const tokenA = validateAddress(params.tokenA, "tokenA");
      const tokenB = validateAddress(params.tokenB, "tokenB");
      const decimalsA = Number(params.tokenADecimals ?? 18);
      const decimalsB = Number(params.tokenBDecimals ?? 18);

      tx = adapter.buildAddLiquidityTx({
        deployment,
        walletAddress,
        tokenA,
        tokenB,
        amountADesired: toAtomicAmount(params.amountADesired, decimalsA),
        amountBDesired: toAtomicAmount(params.amountBDesired, decimalsB),
        amountAMin: toAtomicAmount(params.amountAMin, decimalsA),
        amountBMin: toAtomicAmount(params.amountBMin, decimalsB),
        deadline,
      });
    } else if (protocol === PROTOCOLS.UNISWAP_V3) {
      const tokenId = Number(params.tokenId);
      if (!Number.isInteger(tokenId) || tokenId <= 0) {
        throw new DexIntegrationError("INVALID_TOKEN_ID", "tokenId is required for Uniswap V3 liquidity actions");
      }

      tx = adapter.buildAddLiquidityTx({
        deployment,
        tokenId,
        amount0Desired: toAtomicAmount(params.amount0Desired, Number(params.token0Decimals ?? 18)),
        amount1Desired: toAtomicAmount(params.amount1Desired, Number(params.token1Decimals ?? 18)),
        amount0Min: toAtomicAmount(params.amount0Min, Number(params.token0Decimals ?? 18)),
        amount1Min: toAtomicAmount(params.amount1Min, Number(params.token1Decimals ?? 18)),
        deadline,
      });
    } else {
      tx = adapter.buildAddLiquidityTx(params);
    }

    return {
      protocol,
      chainId: chain.chainId,
      walletAddress,
      txRequest: {
        ...tx,
        chainId: chain.chainId,
        from: walletAddress,
      },
      warnings: [
        "Prepared transaction is unsigned. Sign and broadcast with your wallet.",
        "Validate wallet network matches chainId before signing.",
      ],
    };
  }

  buildRemoveLiquidityTx(params = {}) {
    const chain = this.getChain(params.chainId);
    const { protocol, adapter } = this.getAdapter(params.protocol);
    const deployment = this.getDeployment(chain, protocol, adapter);
    const walletAddress = validateAddress(params.walletAddress, "walletAddress");
    const deadline = toDeadlineTimestamp(params.deadline);

    let tx;
    if (protocol === PROTOCOLS.UNISWAP_V2) {
      const tokenA = validateAddress(params.tokenA, "tokenA");
      const tokenB = validateAddress(params.tokenB, "tokenB");
      const decimalsA = Number(params.tokenADecimals ?? 18);
      const decimalsB = Number(params.tokenBDecimals ?? 18);

      tx = adapter.buildRemoveLiquidityTx({
        deployment,
        walletAddress,
        tokenA,
        tokenB,
        liquidity: toAtomicAmount(params.liquidity, 18),
        amountAMin: toAtomicAmount(params.amountAMin, decimalsA),
        amountBMin: toAtomicAmount(params.amountBMin, decimalsB),
        deadline,
      });
    } else if (protocol === PROTOCOLS.UNISWAP_V3) {
      const tokenId = Number(params.tokenId);
      if (!Number.isInteger(tokenId) || tokenId <= 0) {
        throw new DexIntegrationError("INVALID_TOKEN_ID", "tokenId is required for Uniswap V3 liquidity actions");
      }

      tx = adapter.buildRemoveLiquidityTx({
        deployment,
        tokenId,
        liquidity: toAtomicAmount(params.liquidity, 0),
        amount0Min: toAtomicAmount(params.amount0Min, Number(params.token0Decimals ?? 18)),
        amount1Min: toAtomicAmount(params.amount1Min, Number(params.token1Decimals ?? 18)),
        deadline,
      });
    } else {
      tx = adapter.buildRemoveLiquidityTx(params);
    }

    return {
      protocol,
      chainId: chain.chainId,
      walletAddress,
      txRequest: {
        ...tx,
        chainId: chain.chainId,
        from: walletAddress,
      },
      warnings: [
        "Prepared transaction is unsigned. Sign and broadcast with your wallet.",
        "Validate wallet network matches chainId before signing.",
      ],
    };
  }

  static normalizeProtocol = normalizeProtocol;

  static parseFeeTiers = parseFeeTiers;
}

module.exports = {
  EvmDexService,
  normalizeProtocol,
  PROTOCOLS,
  DexIntegrationError,
};
