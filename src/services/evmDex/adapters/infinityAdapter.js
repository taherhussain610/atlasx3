const { DexIntegrationError } = require("../errors");

function unsupported(operation) {
  throw new DexIntegrationError(
    "UNSUPPORTED_PROTOCOL_ON_CHAIN",
    `PancakeSwap Infinity ${operation} is unavailable until official Infinity deployments and router/periphery contracts are configured for this chain`,
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
  requiredFields: ["poolManager", "router"],
  findPools,
  quote,
  buildSwapTx,
  buildAddLiquidityTx,
  buildRemoveLiquidityTx,
};
