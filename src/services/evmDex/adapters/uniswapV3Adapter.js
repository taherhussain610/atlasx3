const { ethers } = require("ethers");
const { DexIntegrationError } = require("../errors");

const FACTORY_ABI = [
  "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)",
];
const POOL_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function fee() view returns (uint24)",
  "function liquidity() view returns (uint128)",
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
];
const QUOTER_ABI = [
  "function quoteExactInputSingle(address tokenIn,address tokenOut,uint24 fee,uint256 amountIn,uint160 sqrtPriceLimitX96) returns (uint256 amountOut)",
  "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut,uint160,uint32,uint256)",
];
const SWAP_ROUTER_ABI = [
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
];
const POSITION_MANAGER_ABI = [
  "function increaseLiquidity((uint256 tokenId,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,uint256 deadline) params) payable returns (uint128 liquidity,uint256 amount0,uint256 amount1)",
  "function decreaseLiquidity((uint256 tokenId,uint128 liquidity,uint256 amount0Min,uint256 amount1Min,uint256 deadline) params) payable returns (uint256 amount0,uint256 amount1)",
];

const swapRouterInterface = new ethers.Interface(SWAP_ROUTER_ABI);
const positionManagerInterface = new ethers.Interface(POSITION_MANAGER_ABI);

async function loadPoolState(provider, poolAddress, chainId, protocol) {
  const pool = new ethers.Contract(poolAddress, POOL_ABI, provider);
  const [token0, token1, fee, liquidity, slot0] = await Promise.all([
    pool.token0(),
    pool.token1(),
    pool.fee(),
    pool.liquidity(),
    pool.slot0(),
  ]);

  return {
    protocol,
    chainId,
    poolAddress: ethers.getAddress(poolAddress),
    token0,
    token1,
    feeTier: Number(fee),
    liquidity: liquidity.toString(),
    tick: Number(slot0.tick),
    sqrtPriceX96: slot0.sqrtPriceX96.toString(),
  };
}

async function findPools({ provider, deployment, chainId, protocol, tokenA, tokenB, feeTier, poolAddress }) {
  if (poolAddress) {
    return [await loadPoolState(provider, poolAddress, chainId, protocol)];
  }

  if (!tokenA || !tokenB) {
    throw new DexIntegrationError(
      "MISSING_POOL_LOOKUP_FIELDS",
      "Provide tokenA and tokenB (or poolAddress) for Uniswap V3 pool lookup"
    );
  }

  const feeTiers = feeTier
    ? [Number(feeTier)]
    : Array.isArray(deployment.feeTiers) && deployment.feeTiers.length
      ? deployment.feeTiers
      : [500, 3000, 10000];

  const factory = new ethers.Contract(deployment.factory, FACTORY_ABI, provider);
  const discovered = [];

  for (const fee of feeTiers) {
    const pool = await factory.getPool(tokenA, tokenB, fee);
    if (pool && pool !== ethers.ZeroAddress) {
      discovered.push(await loadPoolState(provider, pool, chainId, protocol));
    }
  }

  return discovered;
}

async function quote({ provider, deployment, tokenIn, tokenOut, feeTier, amountIn, slippageBps = 100 }) {
  if (!deployment.quoter) {
    throw new DexIntegrationError(
      "QUOTER_NOT_CONFIGURED",
      "Uniswap V3 quote support requires a configured quoter contract"
    );
  }

  const quoter = new ethers.Contract(deployment.quoter, QUOTER_ABI, provider);
  let amountOut;

  try {
    amountOut = await quoter.quoteExactInputSingle.staticCall(
      tokenIn,
      tokenOut,
      Number(feeTier),
      amountIn,
      0
    );
  } catch {
    const result = await quoter["quoteExactInputSingle((address,address,uint256,uint24,uint160))"].staticCall({
      tokenIn,
      tokenOut,
      amountIn,
      fee: Number(feeTier),
      sqrtPriceLimitX96: 0,
    });
    amountOut = result?.amountOut ?? result?.[0];
  }

  if (!amountOut || BigInt(amountOut) <= 0n) {
    throw new DexIntegrationError("QUOTE_UNAVAILABLE", "Unable to produce a V3 quote");
  }

  const minAmountOut = (BigInt(amountOut) * BigInt(10_000 - slippageBps)) / 10_000n;
  return {
    amountOut: BigInt(amountOut),
    minAmountOut,
    warnings: [
      "Quote is an estimate, not a guaranteed execution price.",
      "Execution can fail if pool price moves outside your slippage tolerance.",
    ],
  };
}

function buildSwapTx({
  deployment,
  walletAddress,
  tokenIn,
  tokenOut,
  feeTier,
  deadline,
  amountIn,
  amountOutMin,
}) {
  return {
    to: deployment.swapRouter,
    data: swapRouterInterface.encodeFunctionData("exactInputSingle", [
      {
        tokenIn,
        tokenOut,
        fee: Number(feeTier),
        recipient: walletAddress,
        deadline,
        amountIn,
        amountOutMinimum: amountOutMin,
        sqrtPriceLimitX96: 0,
      },
    ]),
    value: "0x0",
  };
}

function buildAddLiquidityTx({
  deployment,
  tokenId,
  amount0Desired,
  amount1Desired,
  amount0Min,
  amount1Min,
  deadline,
}) {
  return {
    to: deployment.positionManager,
    data: positionManagerInterface.encodeFunctionData("increaseLiquidity", [
      {
        tokenId,
        amount0Desired,
        amount1Desired,
        amount0Min,
        amount1Min,
        deadline,
      },
    ]),
    value: "0x0",
  };
}

function buildRemoveLiquidityTx({ deployment, tokenId, liquidity, amount0Min, amount1Min, deadline }) {
  return {
    to: deployment.positionManager,
    data: positionManagerInterface.encodeFunctionData("decreaseLiquidity", [
      {
        tokenId,
        liquidity,
        amount0Min,
        amount1Min,
        deadline,
      },
    ]),
    value: "0x0",
  };
}

module.exports = {
  requiredFields: ["factory", "swapRouter", "positionManager"],
  findPools,
  quote,
  buildSwapTx,
  buildAddLiquidityTx,
  buildRemoveLiquidityTx,
};
