const { DexIntegrationError } = require("../errors");

function unsupported(operation) {
  throw new DexIntegrationError(
    "UNSUPPORTED_PROTOCOL_ON_CHAIN",
    `Uniswap V4 ${operation} is unavailable until official PoolManager and periphery routing deployments are configured for this chain`,
    400
  );
}

async function findPools() {
  unsupported("pool lookup");
}

async function quote() {
  unsupported("quotes");
}

function buildSwapTx() {
  unsupported("swap transaction preparation");
}

function buildAddLiquidityTx() {
  unsupported("add liquidity transaction preparation");
}

function buildRemoveLiquidityTx() {
  unsupported("remove liquidity transaction preparation");
}

module.exports = {
  requiredFields: ["poolManager", "router", "positionManager"],
  findPools,
  quote,
  buildSwapTx,
  buildAddLiquidityTx,
  buildRemoveLiquidityTx,
};
