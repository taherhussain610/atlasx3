const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const WalletService = require("../src/blockchain/walletService");
const EmailService = require("../src/services/emailService");
const APIKeysService = require("../src/services/apiKeysService");
const CopyTradingService = require("../src/services/copyTradingService");
const DemoTradingService = require("../src/services/demoTradingService");
const MarginTradingService = require("../src/services/marginTradingService");
const PaymentGatewayService = require("../src/services/paymentGatewayService");
const PaymentTerminalService = require("../src/services/paymentTerminalService");
const P2PTradingService = require("../src/services/p2pTradingService");
const TokenSwapService = require("../src/services/tokenSwapService");
const AssistantService = require("../src/services/assistantService");

const appSource = fs.readFileSync(
  path.join(__dirname, "..", "public", "app.js"),
  "utf8",
);
const indexSource = fs.readFileSync(
  path.join(__dirname, "..", "public", "index.html"),
  "utf8",
);
const serverSource = fs.readFileSync(
  path.join(__dirname, "..", "src", "server.js"),
  "utf8",
);
const envExampleSource = fs.readFileSync(
  path.join(__dirname, "..", ".env.example"),
  "utf8",
);
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"),
);
const hardhatContractSource = fs.readFileSync(
  path.join(__dirname, "..", "hardhat", "contracts", "ERCAssetRegistry.sol"),
  "utf8",
);

test("MailRCLD SMTP status is safe and reports transport readiness", () => {
  const service = new EmailService();
  const status = service.getStatus();

  assert.equal(typeof status.credentialsConfigured, "boolean");
  assert.equal(typeof status.port, "number");
  assert.equal(Object.hasOwn(status, "password"), false);
  assert.equal(Object.hasOwn(status, "user"), false);
  assert.equal(typeof status.tracking.opens, "boolean");
  assert.equal(typeof status.tracking.inbox, "boolean");
  assert.ok(status.tracking.campaignId);
});

test("MailRCLD messages include tracking headers and an explicit envelope", async () => {
  const service = new EmailService();
  let message;
  service.enabled = true;
  service.from = "verified@example.com";
  service.transporter = {
    async sendMail(payload) {
      message = payload;
      return { messageId: "test-message-id" };
    },
  };

  const sent = await service.sendEmail({
    to: "recipient@example.com",
    subject: "SMTP test",
    text: "MailRCLD test",
    campaignId: "test-campaign",
  });

  assert.equal(sent, true);
  assert.deepEqual(message.envelope, {
    from: "verified@example.com",
    to: "recipient@example.com",
  });
  assert.deepEqual(message.headers, {
    "mld-track-opens": "false",
    "mld-track-inbox": "true",
    "mld-track-campaign-id": "test-campaign",
  });
});

test("MailRCLD sender rejection returns an actionable safe error", async () => {
  const service = new EmailService();
  service.enabled = true;
  service.transporter = {
    async sendMail() {
      const error = new Error("Message failed");
      error.response =
        "554 5.0.0 Error: transaction failed: invalid sender: no valid From address found";
      throw error;
    },
  };

  assert.equal(
    await service.sendEmail({
      to: "recipient@example.com",
      subject: "SMTP test",
      text: "MailRCLD test",
    }),
    false,
  );
  assert.equal(
    service.getLastError(),
    "MailRCLD rejected SMTP_FROM. Verify this sender address in the MailRCLD dashboard.",
  );
});

test("wallet import derives all supported addresses from a valid mnemonic", () => {
  const mnemonic =
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
  const wallet = WalletService.generateMultiChainWallet(mnemonic);

  assert.equal(wallet.mnemonic, mnemonic);
  assert.equal(
    wallet.ethereum.address,
    "0x9858EfFD232B4033E47d90003D41EC34EcaEda94",
  );
  assert.equal(wallet.bsc.address, wallet.ethereum.address);
  assert.ok(wallet.solana.address);
  assert.ok(wallet.tron.address);
});

test("ATLASX3 routes TRX payments to its configured receiving wallet", async () => {
  const address = "TXntJR1XuF3VeY6uZZ3i8uRYTLy6g7mMmZ";
  assert.equal(packageJson.name, "atlasx3");
  assert.equal(WalletService.isValidTronAddress(address), true);
  assert.equal(WalletService.isValidTronAddress("T-invalid"), false);
  assert.match(
    envExampleSource,
    new RegExp(`TRON_MAINNET_DEPOSIT_ADDRESS=${address}`),
  );
  assert.match(indexSource, /<title>ATLASX3<\/title>/);
  assert.match(indexSource, /id="tronDepositAddress"/);
  assert.match(appSource, /\/api\/tron\/deposit-wallet/);
  assert.match(serverSource, /app\.get\("\/api\/tron\/deposit-wallet"/);
  assert.match(serverSource, /row\.method === "crypto"/);
  assert.match(appSource, /row\.method === "crypto"/);

  const service = new PaymentGatewayService({
    tronDepositAddress: address,
    tronNetwork: "mainnet",
  });
  const trxPayment = await service.createCryptoPayment({
    amount: 12,
    currency: "USD",
    cryptoAmount: "12.123456",
    cryptoSymbol: "TRX",
  });
  assert.equal(trxPayment.address, address);
  assert.equal(trxPayment.cryptoAmount, "12.123456");
  assert.equal(
    trxPayment.qrData,
    `trx:${address}?amount=${trxPayment.cryptoAmount}`,
  );
  assert.equal(trxPayment.network, "mainnet");
  assert.equal(trxPayment.autoCredit, false);
  assert.equal(trxPayment.quoteMode, "manual");

  const btcPayment = await service.createCryptoPayment({
    amount: 100,
    currency: "USD",
    cryptoSymbol: "BTC",
  });
  assert.match(
    btcPayment.qrData,
    new RegExp(`^btc:${btcPayment.address}\\?amount=`),
  );

  await assert.rejects(
    new PaymentGatewayService().createCryptoPayment({
      amount: 12,
      currency: "USD",
      cryptoAmount: "12",
      cryptoSymbol: "TRX",
    }),
    /TRX receiving wallet is not configured/,
  );
  await assert.rejects(
    service.createCryptoPayment({
      amount: 12,
      currency: "USD",
      cryptoAmount: "0.1234567",
      cryptoSymbol: "TRX",
    }),
    /no more than 6 decimal places/,
  );
});

test("margin positions expose the fields consumed by the UI", () => {
  const service = new MarginTradingService();
  service.initializeMarginAccount(1, 10000, "medium");
  const position = service.openPosition(1, {
    symbol: "BTC/USDT",
    side: "long",
    collateral: 100,
    leverage: 2,
    entryPrice: 100,
    stopLoss: 95,
    takeProfit: 110,
  });

  assert.ok(position.positionId);
  assert.equal(position.positionSize, 200);
  assert.equal(
    service.closePosition(position.positionId, 110).status,
    "closed",
  );
});

test("P2P orders can be accepted with their published contract", () => {
  const service = new P2PTradingService();
  const order = service.createOrder(1, {
    type: "sell",
    crypto: "BTC",
    fiat: "USD",
    amount: 1,
    pricePerUnit: 65000,
    minOrder: 0.1,
    maxOrder: 1,
    paymentMethods: ["Bank Transfer"],
  });
  const trade = service.acceptOrder(order.orderId, 2, 0.1, "Bank Transfer");

  assert.equal(trade.orderId, order.orderId);
  assert.equal(trade.cryptoAmount, 0.1);
});

test("swap quote, execution, and history use one field contract", () => {
  const service = new TokenSwapService();
  const quote = service.getQuote("BTC", "USDT", 0.01);
  const swap = service.executeSwap(1, "BTC", "USDT", 0.01);

  assert.ok(Number.isFinite(quote.rate));
  assert.ok(Number.isFinite(swap.rate));
  assert.equal(service.getSwapHistory(1)[0].rate, swap.rate);
});

test("assistant provides a safe local response without an AI provider key", async () => {
  const service = new AssistantService({ apiKey: "" });
  const result = await service.reply(
    [{ role: "user", content: "Explain margin risk" }],
    {
      username: "test-user",
      balances: { USDT: "100" },
    },
  );

  assert.equal(result.source, "local");
  assert.match(result.message, /collateral|leverage/i);
});

test("demo spot trades update balances and performance", () => {
  const service = new DemoTradingService();
  const result = service.executeDemoTrade(1, {
    type: "spot",
    action: "buy",
    fromCurrency: "USDT",
    toCurrency: "BTC",
    amount: 0.01,
    price: 65000,
  });
  const performance = service.getDemoPerformance(1);

  assert.equal(result.trade.status, "completed");
  assert.equal(performance.performance.totalTrades, 1);
});

test("copy trader fields match the table renderer", () => {
  const service = new CopyTradingService();
  const trader = service.registerTrader(1, { displayName: "Atlas Trader" });

  assert.equal(trader.traderId, 1);
  assert.equal(trader.stats.winRate, 0);
  assert.equal(trader.performance["30d"].return, 0);
});

test("generated API keys can be listed and revoked by key ID", () => {
  const service = new APIKeysService();
  const created = service.generateAPIKey(1, { name: "Automation" });

  assert.ok(created.apiSecret);
  assert.equal(service.getUserAPIKeys(1)[0].keyId, created.keyId);
  assert.deepEqual(service.revokeAPIKey(1, created.keyId), {
    success: true,
    keyId: created.keyId,
  });
  assert.deepEqual(service.getUserAPIKeys(1), []);
});

test("payment terminal transactions are masked and isolated by user", async () => {
  const service = new PaymentTerminalService();
  service.initializeTerminal("TERMINAL_7");
  const result = await service.processPayment({
    userId: 7,
    terminalId: "TERMINAL_7",
    paymentMethod: "MANUAL",
    cardNumber: "4532015112830366",
    expiryDate: "12/29",
    cvv: "123",
    cardholderName: "TEST USER",
    amount: 25,
    currency: "USD",
  });

  assert.equal(result.success, true);
  assert.equal(result.data.userId, 7);
  assert.match(result.data.cardData.pan, /^453201\*+0366$/);
  assert.equal(
    JSON.stringify(
      service.getTransaction(result.data.transactionId, 7),
    ).includes("4532015112830366"),
    false,
  );
  assert.equal(service.getTransaction(result.data.transactionId, 8), null);
  assert.deepEqual(service.getAllTransactions(8), []);
  await assert.rejects(
    service.refundTransaction(result.data.transactionId, null, 8),
    /Transaction not found/,
  );
  assert.equal(
    (await service.refundTransaction(result.data.transactionId, null, 7))
      .success,
    true,
  );
});

test("payment terminal validates card fields and terminal limits", async () => {
  const service = new PaymentTerminalService();
  service.initializeTerminal("TERMINAL_7", { maxAmount: 100 });
  const validBase = {
    userId: 7,
    terminalId: "TERMINAL_7",
    paymentMethod: "MANUAL",
    cardNumber: "4532015112830366",
    expiryDate: "12/29",
    cvv: "123",
    cardholderName: "TEST USER",
    amount: 25,
    currency: "USD",
  };

  assert.equal(
    (await service.processPayment({ ...validBase, expiryDate: "01/20" }))
      .success,
    false,
  );
  assert.equal(
    (await service.processPayment({ ...validBase, cvv: "12" })).success,
    false,
  );
  assert.equal(
    (await service.processPayment({ ...validBase, amount: 101 })).success,
    false,
  );
  assert.match(
    (
      await service.processPayment({
        ...validBase,
        terminalId: "TERMINAL_MISSING",
      })
    ).error,
    /not initialized/,
  );
});

test("direct payment protocol probes do not create transaction history", async () => {
  const service = new PaymentTerminalService();
  const result = await service.protocol_201_2_TapToPay(
    {
      userId: 7,
      cardNumber: "4532015112830366",
      amount: 10,
      currency: "USD",
    },
    false,
  );

  assert.equal(result.success, true);
  assert.equal(result.data.userId, 7);
  assert.deepEqual(service.getAllTransactions(7), []);
});

test("frontend routes remain aligned with implemented endpoints", () => {
  assert.match(
    appSource,
    /\/api\/margin\/position\/\$\{encodeURIComponent\(positionId\)\}\/close/,
  );
  assert.match(
    appSource,
    /\/api\/p2p\/order\/\$\{encodeURIComponent\(orderId\)\}\/accept/,
  );
  assert.match(appSource, /\/api\/demo\/account\/reset/);
  assert.match(appSource, /\/api\/copy-trading\/trader\/register/);
  assert.match(
    appSource,
    /\/api\/copy-trading\/follow\/\$\{encodeURIComponent\(traderId\)\}/,
  );
  assert.match(appSource, /method: "DELETE"/);
  assert.doesNotMatch(serverSource, /service\.sendNative\(/);
  assert.match(serverSource, /service\.sendNativeToken\(/);
  assert.match(
    serverSource,
    /WalletService\.generateMultiChainWallet\(mnemonic\)/,
  );
  assert.match(serverSource, /app\.get\("\/api\/bsc\/transaction\/:hash"/);
  assert.match(
    appSource,
    /`\/api\/\$\{network\}\/transaction\/\$\{encodeURIComponent\(txHash\)\}`/,
  );
  assert.match(appSource, /const wsOrigin = window\.location\.origin/);
  assert.doesNotMatch(
    appSource,
    /new WebSocketManager\("http:\/\/localhost:4000"\)/,
  );
  assert.match(serverSource, /app\.post\("\/api\/email\/verify"/);
  assert.match(serverSource, /app\.post\("\/api\/email\/test"/);
  assert.match(serverSource, /app\.get\("\/api\/assistant\/status"/);
  assert.match(serverSource, /app\.post\("\/api\/assistant\/chat"/);
  assert.match(serverSource, /app\.get\("\/api\/hardhat\/contracts"/);
  assert.match(serverSource, /app\.get\("\/api\/hardhat\/accounts"/);
  assert.match(serverSource, /accounts: node\.accounts \|\| \[\]/);
  assert.match(appSource, /\/api\/hardhat\/accounts/);
  assert.match(appSource, /\/api\/hardhat\/assets/);
  assert.match(indexSource, /id="assistantForm"/);
  assert.match(appSource, /\/api\/email\/verify/);
  assert.match(appSource, /\/api\/email\/test/);
  assert.match(serverSource, /key: "email-verify"/);
  assert.match(serverSource, /key: "email-test"/);
  assert.match(appSource, /key: "email-verify"/);
  assert.match(appSource, /key: "email-test"/);
  assert.doesNotMatch(serverSource, /req\.userId/);
  assert.match(
    serverSource,
    /CREATE TABLE IF NOT EXISTS payment_terminal_transactions/,
  );
  assert.match(serverSource, /listPaymentTerminalTransactionsStmt/);
  assert.match(serverSource, /refundPaymentTerminalTransactionStmt/);
  assert.match(serverSource, /partially_refunded/);
  assert.match(serverSource, /remainingAmount/);
  assert.match(
    serverSource,
    /initializeTerminal\(`TERMINAL_\$\{req\.user\.id\}`/,
  );
  assert.match(serverSource, /terminalId: `TERMINAL_\$\{req\.user\.id\}`/);
  assert.match(serverSource, /key: "payment-terminal-process"/);
  assert.match(serverSource, /key: "payment-terminal-transactions"/);
  assert.match(appSource, /key: "payment-terminal-process"/);
  assert.match(appSource, /key: "payment-terminal-transactions"/);
  assert.doesNotMatch(serverSource, /parseStoredNumber|\btoAtomic\(/);
  assert.doesNotMatch(
    serverSource,
    /\bwebSocketService\.(?:connectedClients|broadcast|sendToUser)/,
  );
  assert.match(serverSource, /wsService\.broadcast\(channel, event, data\)/);
  assert.match(appSource, /await refreshDashboard\(\)/);
});

test("advanced panels share the authenticated application session", () => {
  assert.match(appSource, /localStorage\.setItem\("token", token\)/);
  assert.match(appSource, /localStorage\.setItem\("token", state\.token\)/);
  assert.match(appSource, /localStorage\.removeItem\("token"\)/);
  assert.match(appSource, /terminalId: `TERMINAL_\$\{state\.user\.id\}`/);
  assert.match(appSource, /document\.querySelectorAll\("\.dashboard-tab"\)/);
  assert.doesNotMatch(appSource, /const allowed = new Set\(\["overviewPanel"/);
});

test("Hardhat registry workflow is available through authenticated API and UI contracts", () => {
  assert.match(indexSource, /id="hardhatPanel"/);
  assert.match(indexSource, /id="hardhatAssetForm"/);
  assert.match(indexSource, /id="hardhatAssetsBody"/);
  assert.match(appSource, /\/api\/hardhat\/status/);
  assert.match(appSource, /\/api\/hardhat\/compile/);
  assert.match(appSource, /\/api\/hardhat\/deploy/);
  assert.match(appSource, /\/api\/hardhat\/assets/);
  assert.match(serverSource, /app\.get\("\/api\/hardhat\/status", auth/);
  assert.match(serverSource, /app\.post\("\/api\/hardhat\/deploy", auth/);
  assert.match(serverSource, /body\("symbol"\)/);
  assert.match(hardhatContractSource, /contract AtlasXAssetRegistry/);
  assert.match(hardhatContractSource, /function registerAsset/);
  assert.match(hardhatContractSource, /function totalAssets/);
  assert.match(hardhatContractSource, /function assetAt/);
});

test("every P2P navigation tab has a functional panel", () => {
  assert.match(indexSource, /id="p2pSellTab"/);
  assert.match(indexSource, /id="p2pMyOrdersTab"/);
  assert.match(indexSource, /id="createP2POrderForm"/);
  assert.match(indexSource, /id="p2pMyOrdersBody"/);
  assert.match(appSource, /createP2POrderForm/);
});

test("advanced tab tables load from their published APIs", () => {
  assert.match(appSource, /async function loadFollowingTraders\(\)/);
  assert.match(appSource, /\/api\/copy-trading\/stats/);
  assert.match(appSource, /async function loadPredictionPositions\(\)/);
  assert.match(appSource, /\/api\/prediction\/positions/);
  assert.match(appSource, /async function loadPredictionLeaderboard\(\)/);
  assert.match(appSource, /\/api\/prediction\/leaderboard/);
});

test("generated controls remain compatible with the application content security policy", () => {
  assert.doesNotMatch(appSource, /\son(?:click|change|submit)=/i);
  assert.match(appSource, /data-action="place-prediction"/);
  assert.match(appSource, /document\.addEventListener\("click"/);
});
