const assert = require("node:assert/strict");
const test = require("node:test");

const { EvmDexService, PROTOCOLS, normalizeProtocol, DexIntegrationError } = require("../src/services/evmDex");

const ETH_RPC = "http://127.0.0.1:8545";
const ADDRESS_A = "0x1111111111111111111111111111111111111111";
const ADDRESS_B = "0x2222222222222222222222222222222222222222";
const WALLET = "0x3333333333333333333333333333333333333333";

function createService() {
  return new EvmDexService({
    env: {
      ETH_RPC_URL: ETH_RPC,
    },
  });
}

test("protocol aliases normalize correctly", () => {
  assert.equal(normalizeProtocol("v2"), PROTOCOLS.UNISWAP_V2);
  assert.equal(normalizeProtocol("uniswap-v3"), PROTOCOLS.UNISWAP_V3);
  assert.equal(normalizeProtocol("Infinity"), PROTOCOLS.PANCAKESWAP_INFINITY);
});

test("support matrix reports configured vs unsupported protocol combinations", () => {
  const service = createService();
  const support = service.getSupportMatrix();
  const ethereum = support.networks.find((entry) => entry.chainId === 1);

  assert.ok(ethereum);
  assert.equal(ethereum.rpcConfigured, true);
  assert.equal(
    ethereum.protocols.find((entry) => entry.protocol === PROTOCOLS.UNISWAP_V2)?.supported,
    true
  );
  assert.equal(
    ethereum.protocols.find((entry) => entry.protocol === PROTOCOLS.UNISWAP_V4)?.supported,
    false
  );
});

test("quote validation rejects malformed token addresses", async () => {
  const service = createService();

  await assert.rejects(
    service.buildQuote({
      chainId: 1,
      protocol: "uniswap_v2",
      tokenIn: "bad-address",
      tokenOut: ADDRESS_B,
      amountIn: "1",
      tokenInDecimals: 18,
      tokenOutDecimals: 18,
      slippageBps: 100,
    }),
    (error) => error instanceof DexIntegrationError && error.code === "INVALID_ADDRESS"
  );
});

test("swap transaction preparation builds a wallet-ready request", () => {
  const service = createService();
  const deadline = Math.floor(Date.now() / 1000) + 1200;

  const prepared = service.buildSwapTx({
    chainId: 1,
    protocol: "uniswap_v2",
    walletAddress: WALLET,
    tokenIn: ADDRESS_A,
    tokenOut: ADDRESS_B,
    amountIn: "1",
    minimumAmountOut: "0.9",
    tokenInDecimals: 18,
    tokenOutDecimals: 18,
    deadline,
  });

  assert.equal(prepared.chainId, 1);
  assert.equal(prepared.protocol, PROTOCOLS.UNISWAP_V2);
  assert.equal(prepared.txRequest.from, WALLET);
  assert.equal(prepared.txRequest.chainId, 1);
  assert.equal(prepared.txRequest.to, "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D");
  assert.match(prepared.txRequest.data, /^0x38ed1739/);
});

test("unsupported protocol on chain returns structured error code", () => {
  const service = createService();
  const deadline = Math.floor(Date.now() / 1000) + 1200;

  assert.throws(
    () =>
      service.buildSwapTx({
        chainId: 1,
        protocol: "uniswap_v4",
        walletAddress: WALLET,
        tokenIn: ADDRESS_A,
        tokenOut: ADDRESS_B,
        amountIn: "1",
        minimumAmountOut: "0.5",
        tokenInDecimals: 18,
        tokenOutDecimals: 18,
        deadline,
      }),
    (error) => error instanceof DexIntegrationError && error.code === "UNSUPPORTED_PROTOCOL_ON_CHAIN"
  );
});
