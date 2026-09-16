const { ethers } = require("ethers");
const { DexIntegrationError } = require("../errors");

const FACTORY_ABI = ["function getPair(address tokenA, address tokenB) view returns (address pair)"];
const PAIR_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
];
const ROUTER_ABI = [
  "function swapExactTokensForTokens(uint256 amountIn,uint256 amountOutMin,address[] calldata path,address to,uint256 deadline) returns (uint256[] memory amounts)",
  "function addLiquidity(address tokenA,address tokenB,uint256 amountADesired,uint256 amountBDesired,uint256 amountAMin,uint256 amountBMin,address to,uint256 deadline) returns (uint256 amountA,uint256 amountB,uint256 liquidity)",
  "function removeLiquidity(address tokenA,address tokenB,uint256 liquidity,uint256 amountAMin,uint256 amountBMin,address to,uint256 deadline) returns (uint256 amountA,uint256 amountB)",
];

const routerInterface = new ethers.Interface(ROUTER_ABI);

function getAmountOut(amountIn, reserveIn, reserveOut, feeBps) {
  const amountInAfterFee = (amountIn * BigInt(10_000 - feeBps)) / 10_000n;
  const numerator = amountInAfterFee * reserveOut;
  const denominator = reserveIn + amountInAfterFee;
  return denominator > 0n ? numerator / denominator : 0n;
}

function formatPool({ pairAddress, token0, token1, reserve0, reserve1, chainId, protocol }) {
  return {
    protocol,
    chainId,
    poolAddress: pairAddress,
    token0,
    token1,
    reserve0: reserve0.toString(),
    reserve1: reserve1.toString(),
    feeTiers: [3000],
  };
}

async function findPools({ provider, deployment, chainId, protocol, tokenA, tokenB, poolAddress }) {
  if (poolAddress) {
    const pair = new ethers.Contract(poolAddress, PAIR_ABI, provider);
    const [token0, token1, reserves] = await Promise.all([
      pair.token0(),
      pair.token1(),
      pair.getReserves(),
    ]);
    return [
      formatPool({
        pairAddress: ethers.getAddress(poolAddress),
        token0,
        token1,
        reserve0: reserves.reserve0,
        reserve1: reserves.reserve1,
        chainId,
        protocol,
      }),
    ];
  }

  if (!tokenA || !tokenB) {
    throw new DexIntegrationError(
      "MISSING_POOL_LOOKUP_FIELDS",
      "Provide tokenA and tokenB (or poolAddress) for Uniswap V2 pool lookup"
    );
  }

  const factory = new ethers.Contract(deployment.factory, FACTORY_ABI, provider);
  const pairAddress = await factory.getPair(tokenA, tokenB);
  if (!pairAddress || pairAddress === ethers.ZeroAddress) {
    return [];
  }

  return findPools({
    provider,
    deployment,
    chainId,
    protocol,
    poolAddress: pairAddress,
  });
}

function buildQuote({ pool, tokenIn, amountIn, slippageBps = 100 }) {
  const normalizedTokenIn = ethers.getAddress(tokenIn);
  const token0 = ethers.getAddress(pool.token0);
  const token1 = ethers.getAddress(pool.token1);

  const isToken0In = normalizedTokenIn === token0;
  const isToken1In = normalizedTokenIn === token1;

  if (!isToken0In && !isToken1In) {
    throw new DexIntegrationError(
      "TOKEN_NOT_IN_POOL",
      "tokenIn does not match the discovered pool tokens"
    );
  }

  const reserveIn = BigInt(isToken0In ? pool.reserve0 : pool.reserve1);
  const reserveOut = BigInt(isToken0In ? pool.reserve1 : pool.reserve0);
  const amountOut = getAmountOut(amountIn, reserveIn, reserveOut, 30);
  if (amountOut <= 0n) {
    throw new DexIntegrationError("QUOTE_UNAVAILABLE", "Unable to produce a quote for this pool");
  }

  const minAmountOut = (amountOut * BigInt(10_000 - slippageBps)) / 10_000n;
  return {
    tokenOut: isToken0In ? token1 : token0,
    amountOut,
    minAmountOut,
    feeBps: 30,
    warnings: [
      "Quote is an estimate, not a guaranteed execution price.",
      "Execution can fail if pool state changes before confirmation.",
    ],
  };
}

function buildSwapTx({ deployment, walletAddress, tokenIn, tokenOut, amountIn, amountOutMin, deadline }) {
  return {
    to: deployment.router,
    data: routerInterface.encodeFunctionData("swapExactTokensForTokens", [
      amountIn,
      amountOutMin,
      [tokenIn, tokenOut],
      walletAddress,
      deadline,
    ]),
    value: "0x0",
  };
}

function buildAddLiquidityTx({
  deployment,
  walletAddress,
  tokenA,
  tokenB,
  amountADesired,
  amountBDesired,
  amountAMin,
  amountBMin,
  deadline,
}) {
  return {
    to: deployment.router,
    data: routerInterface.encodeFunctionData("addLiquidity", [
      tokenA,
      tokenB,
      amountADesired,
      amountBDesired,
      amountAMin,
      amountBMin,
      walletAddress,
      deadline,
    ]),
    value: "0x0",
  };
}

function buildRemoveLiquidityTx({
  deployment,
  walletAddress,
  tokenA,
  tokenB,
  liquidity,
  amountAMin,
  amountBMin,
  deadline,
}) {
  return {
    to: deployment.router,
    data: routerInterface.encodeFunctionData("removeLiquidity", [
      tokenA,
      tokenB,
      liquidity,
      amountAMin,
      amountBMin,
      walletAddress,
      deadline,
    ]),
    value: "0x0",
  };
}

module.exports = {
  requiredFields: ["factory", "router"],
  findPools,
  buildQuote,
  buildSwapTx,
  buildAddLiquidityTx,
  buildRemoveLiquidityTx,
};
