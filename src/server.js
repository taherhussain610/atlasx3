const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const axios = require("axios");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");
const { body, query, validationResult } = require("express-validator");
const http = require("http");
const QRCode = require("qrcode");

// Import blockchain services
const WalletService = require("./blockchain/walletService");
const EthereumService = require("./blockchain/ethereumService");
const SolanaService = require("./blockchain/solanaService");
const TronService = require("./blockchain/tronService");
const CryptoDataService = require("./blockchain/cryptoDataService");
const WebSocketService = require("./blockchain/webSocketService");
const ERC1155Service = require("./blockchain/erc1155Service");
const HardhatService = require("./blockchain/hardhatService");
const EmailService = require("./services/emailService");
const TradingBot = require("./services/tradingBot");

// Import advanced trading services
const MarginTradingService = require("./services/marginTradingService");
const P2PTradingService = require("./services/p2pTradingService");
const TokenSwapService = require("./services/tokenSwapService");
const DemoTradingService = require("./services/demoTradingService");
const CopyTradingService = require("./services/copyTradingService");
const PredictionMarketsService = require("./services/predictionMarketsService");
const APIKeysService = require("./services/apiKeysService");
const MetaTraderService = require("./services/metaTraderService");
const PaymentGatewayService = require("./services/paymentGatewayService");
const PaymentTerminalService = require("./services/paymentTerminalService");
const AssistantService = require("./services/assistantService");

// Import advanced integration services
const BinanceApiService = require("./services/binanceApiService");
const AdvancedAnalyticsService = require("./services/advancedAnalyticsService");
const RiskManagementService = require("./services/riskManagementService");
const PortfolioOptimizationService = require("./services/portfolioOptimizationService");

// Import technical indicators and advanced features
const TechnicalIndicators = require("./services/technicalIndicators");
const {
  PerformanceMonitor,
  AdvancedCacheManager,
  CircuitBreaker,
  RequestValidator,
  createRateLimiters,
  AdvancedErrorHandler,
  QueryOptimizer,
  WebSocketBroadcaster,
  MetricsCollector,
  AdvancedLogger,
} = require("./utils/advancedFeatures");
const createAdvancedRoutes = require("./routes/advancedRoutes");

function resolvePort() {
  const raw = process.env.PORT || "4000";
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid PORT value '${raw}'. Use an integer between 1 and 65535.`);
  }
  return parsed;
}

const PORT = resolvePort();
const APP_NAME = "ATLASX3";
const APP_SERVICE_NAME = "atlasx3-api";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const NODE_ENV = process.env.NODE_ENV || "development";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const SALT_ROUNDS = 10;
const DB_PATH = path.join(__dirname, "..", "data", "exchange.db");
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://solana-mainnet.gateway.tatum.io";
const SOLANA_RPC_API_KEY = process.env.SOLANA_RPC_API_KEY || process.env.TATUM_API_KEY || "";
const BSC_RPC_URL =
  process.env.BSC_RPC_URL ||
  process.env.TATUM_BSC_RPC_URL ||
  "https://bsc-mainnet.gateway.tatum.io";
const BSC_RPC_FALLBACK_URL =
  process.env.BSC_RPC_FALLBACK_URL || "https://cloud-technology-c98ca9cb.gateway.tatum.io";
const BSC_RPC_API_KEY = process.env.BSC_RPC_API_KEY || process.env.TATUM_API_KEY || "";

// TRON Configuration
const TRON_NETWORK = String(process.env.TRON_NETWORK || "mainnet")
  .trim()
  .toLowerCase();
const SUPPORTED_TRON_NETWORKS = ["mainnet", "shasta", "nile"];
if (!SUPPORTED_TRON_NETWORKS.includes(TRON_NETWORK)) {
  throw new Error(`Invalid TRON_NETWORK '${TRON_NETWORK}'. Use mainnet, shasta, or nile.`);
}
const TRON_RPC_API_KEY = process.env.TRON_RPC_API_KEY || process.env.TATUM_API_KEY || "";

// TRON Mainnet Endpoints
const TRON_MAINNET_JSONRPC =
  process.env.TRON_MAINNET_JSONRPC ||
  process.env.TRON_RPC_URL ||
  "https://erc-dog-ca66d82b.gateway.tatum.io/jsonrpc";
const TRON_MAINNET_WALLET =
  process.env.TRON_MAINNET_WALLET || "https://tron-mainnet.gateway.tatum.io/wallet";
const TRON_MAINNET_WALLETSOLIDITY =
  process.env.TRON_MAINNET_WALLETSOLIDITY || "https://tron-mainnet.gateway.tatum.io/walletsolidity";

// TRON Shasta Testnet Endpoints
const TRON_SHASTA_JSONRPC =
  process.env.TRON_SHASTA_JSONRPC || "https://tron-shasta.gateway.tatum.io/jsonrpc";
const TRON_SHASTA_WALLET =
  process.env.TRON_SHASTA_WALLET || "https://tron-shasta.gateway.tatum.io/wallet";
const TRON_SHASTA_WALLETSOLIDITY =
  process.env.TRON_SHASTA_WALLETSOLIDITY || "https://tron-shasta.gateway.tatum.io/walletsolidity";

// TRON Nile Testnet Endpoints
const TRON_NILE_JSONRPC =
  process.env.TRON_NILE_JSONRPC || "https://tron-nile.gateway.tatum.io/jsonrpc";
const TRON_NILE_WALLET =
  process.env.TRON_NILE_WALLET || "https://tron-nile.gateway.tatum.io/wallet";
const TRON_NILE_WALLETSOLIDITY =
  process.env.TRON_NILE_WALLETSOLIDITY || "https://tron-nile.gateway.tatum.io/walletsolidity";

// Build TRON endpoints configuration
const TRON_ENDPOINTS = {
  mainnet: {
    jsonrpc: TRON_MAINNET_JSONRPC,
    wallet: TRON_MAINNET_WALLET,
    walletsolidity: TRON_MAINNET_WALLETSOLIDITY,
  },
  shasta: {
    jsonrpc: TRON_SHASTA_JSONRPC,
    wallet: TRON_SHASTA_WALLET,
    walletsolidity: TRON_SHASTA_WALLETSOLIDITY,
  },
  nile: {
    jsonrpc: TRON_NILE_JSONRPC,
    wallet: TRON_NILE_WALLET,
    walletsolidity: TRON_NILE_WALLETSOLIDITY,
  },
};

const DEFAULT_TRON_MAINNET_DEPOSIT_ADDRESS = "TXntJR1XuF3VeY6uZZ3i8uRYTLy6g7mMmZ";
const TRON_DEPOSIT_ADDRESSES = {
  mainnet: String(
    process.env.TRON_MAINNET_DEPOSIT_ADDRESS || DEFAULT_TRON_MAINNET_DEPOSIT_ADDRESS
  ).trim(),
  shasta: String(process.env.TRON_SHASTA_DEPOSIT_ADDRESS || "").trim(),
  nile: String(process.env.TRON_NILE_DEPOSIT_ADDRESS || "").trim(),
};
const TRON_DEPOSIT_ADDRESS = TRON_DEPOSIT_ADDRESSES[TRON_NETWORK];
if (TRON_DEPOSIT_ADDRESS && !WalletService.isValidTronAddress(TRON_DEPOSIT_ADDRESS)) {
  throw new Error(`Invalid TRON ${TRON_NETWORK} deposit address.`);
}
const TRON_EXPLORER_BASE_URLS = {
  mainnet: "https://tronscan.org/#/address/",
  shasta: "https://shasta.tronscan.org/#/address/",
  nile: "https://nile.tronscan.org/#/address/",
};

async function fetchTrxPaymentQuote({ fiatCurrency }) {
  try {
    const currency = String(fiatCurrency || "").toLowerCase();
    const response = await axios.get("https://api.coingecko.com/api/v3/simple/price", {
      params: {
        ids: "tron",
        vs_currencies: currency,
      },
      timeout: 10000,
    });
    const price = response.data?.tron?.[currency];
    if (!Number.isFinite(Number(price)) || Number(price) <= 0) {
      throw new Error("Price was missing from the quote response");
    }
    return {
      price: String(price),
      provider: "coingecko",
      quotedAt: new Date().toISOString(),
    };
  } catch (error) {
    const quoteError = new Error("Unable to retrieve a live TRX quote");
    quoteError.code = "QUOTE_UNAVAILABLE";
    quoteError.cause = error;
    throw quoteError;
  }
}

const TATUM_DATA_API_URL = process.env.TATUM_DATA_API_URL || "https://api.tatum.io";
const TATUM_DATA_API_KEY = process.env.TATUM_DATA_API_KEY || process.env.TATUM_API_KEY || "";
const BSC_WALLET_CACHE_MS = Number(process.env.BSC_WALLET_CACHE_MS || 15000);
const HARDHAT_RPC_URL = process.env.HARDHAT_RPC_URL || "http://127.0.0.1:8545";

const SUPPORTED = {
  BTC: "bitcoin",
  ETH: "ethereum",
  USDT: "tether",
  SOL: "solana",
  BNB: "binancecoin",
};

const SUPPORTED_CODES = Object.keys(SUPPORTED);
const ATOMIC_SCALE = 100000000n;

if (NODE_ENV === "production" && JWT_SECRET === "dev-secret-change-me") {
  throw new Error("JWT_SECRET must be set to a strong value in production.");
}

const hardhatService = new HardhatService({ rpcUrl: HARDHAT_RPC_URL });

// Ensure the data directory exists before opening the database
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON");

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS balances (
      user_id INTEGER NOT NULL,
      currency TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, currency),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      currency TEXT NOT NULL,
      amount REAL NOT NULL,
      details TEXT,
      counterparty TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_solana_wallets (
      user_id INTEGER PRIMARY KEY,
      address TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_bsc_wallets (
      user_id INTEGER PRIMARY KEY,
      address TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_ethereum_wallets (
      user_id INTEGER PRIMARY KEY,
      address TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_tron_wallets (
      user_id INTEGER PRIMARY KEY,
      address TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_plugin_endpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      api_key TEXT NOT NULL,
      label TEXT NOT NULL,
      method TEXT NOT NULL,
      route TEXT NOT NULL,
      category TEXT,
      description TEXT,
      requires_auth INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, api_key),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS dex_tokens (
      symbol TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      total_supply TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS dex_pools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_a TEXT NOT NULL,
      token_b TEXT NOT NULL,
      reserve_a TEXT NOT NULL,
      reserve_b TEXT NOT NULL,
      fee_bps INTEGER NOT NULL DEFAULT 30,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(token_a, token_b),
      FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS dex_lp_positions (
      user_id INTEGER NOT NULL,
      pool_id INTEGER NOT NULL,
      liquidity TEXT NOT NULL,
      PRIMARY KEY (user_id, pool_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(pool_id) REFERENCES dex_pools(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS exchange_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      label TEXT,
      from_currency TEXT NOT NULL,
      to_currency TEXT NOT NULL,
      amount TEXT NOT NULL,
      target_rate REAL NOT NULL,
      trigger_direction TEXT NOT NULL,
      route_mode TEXT NOT NULL DEFAULT 'auto',
      slippage_bps INTEGER NOT NULL DEFAULT 100,
      preferred_pool_id INTEGER,
      status TEXT NOT NULL DEFAULT 'open',
      last_checked_at TEXT,
      executed_at TEXT,
      executed_rate REAL,
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS trading_bots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_id TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      strategy TEXT NOT NULL,
      symbol TEXT NOT NULL,
      trading_pair TEXT NOT NULL,
      interval TEXT NOT NULL,
      capital REAL NOT NULL,
      risk_per_trade REAL NOT NULL,
      max_positions INTEGER NOT NULL,
      stop_loss REAL NOT NULL,
      take_profit REAL NOT NULL,
      is_running INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bot_trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      position_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      action TEXT NOT NULL,
      entry_price REAL NOT NULL,
      exit_price REAL,
      size REAL NOT NULL,
      stop_loss REAL NOT NULL,
      take_profit REAL NOT NULL,
      profit_loss REAL,
      profit_loss_percent REAL,
      status TEXT NOT NULL,
      reason TEXT,
      close_reason TEXT,
      entry_timestamp INTEGER NOT NULL,
      exit_timestamp INTEGER,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bot_performance (
      bot_id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      total_trades INTEGER NOT NULL DEFAULT 0,
      wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0,
      total_profit REAL NOT NULL DEFAULT 0,
      total_loss REAL NOT NULL DEFAULT 0,
      win_rate REAL NOT NULL DEFAULT 0,
      profit_factor REAL NOT NULL DEFAULT 0,
      max_drawdown REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS margin_accounts (
      user_id INTEGER PRIMARY KEY,
      balance REAL NOT NULL DEFAULT 0,
      collateral REAL NOT NULL DEFAULT 0,
      equity REAL NOT NULL DEFAULT 0,
      margin_level REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS margin_positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL,
      size REAL NOT NULL,
      collateral REAL NOT NULL,
      leverage INTEGER NOT NULL,
      entry_price REAL NOT NULL,
      liquidation_price REAL NOT NULL,
      stop_loss REAL,
      take_profit REAL,
      pnl REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      closed_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS p2p_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      crypto_currency TEXT NOT NULL,
      fiat_currency TEXT NOT NULL,
      amount REAL NOT NULL,
      price REAL NOT NULL,
      min_order REAL,
      max_order REAL,
      payment_methods TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS p2p_trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      buyer_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      payment_sent_at TEXT,
      payment_confirmed_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(order_id) REFERENCES p2p_orders(id) ON DELETE CASCADE,
      FOREIGN KEY(buyer_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(seller_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS token_swaps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      from_token TEXT NOT NULL,
      to_token TEXT NOT NULL,
      amount_in REAL NOT NULL,
      amount_out REAL NOT NULL,
      rate REAL NOT NULL,
      fee REAL NOT NULL,
      route TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS demo_accounts (
      user_id INTEGER PRIMARY KEY,
      balance_usdt REAL NOT NULL DEFAULT 100000,
      balance_btc REAL NOT NULL DEFAULT 1,
      balance_eth REAL NOT NULL DEFAULT 10,
      balance_bnb REAL NOT NULL DEFAULT 100,
      balance_sol REAL NOT NULL DEFAULT 500,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS demo_trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      from_currency TEXT NOT NULL,
      to_currency TEXT NOT NULL,
      amount REAL NOT NULL,
      price REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS traders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      bio TEXT,
      min_follow_amount REAL NOT NULL DEFAULT 100,
      performance_fee REAL NOT NULL DEFAULT 10,
      risk_level INTEGER NOT NULL DEFAULT 3,
      total_followers INTEGER NOT NULL DEFAULT 0,
      total_return_7d REAL NOT NULL DEFAULT 0,
      total_return_30d REAL NOT NULL DEFAULT 0,
      total_return_90d REAL NOT NULL DEFAULT 0,
      win_rate REAL NOT NULL DEFAULT 0,
      total_trades INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS trader_followers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trader_id INTEGER NOT NULL,
      follower_id INTEGER NOT NULL,
      copy_mode TEXT NOT NULL DEFAULT 'percentage',
      copy_amount REAL NOT NULL DEFAULT 100,
      max_position_size REAL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(trader_id) REFERENCES traders(id) ON DELETE CASCADE,
      FOREIGN KEY(follower_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(trader_id, follower_id)
    );

    CREATE TABLE IF NOT EXISTS copy_trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trader_id INTEGER NOT NULL,
      follower_id INTEGER NOT NULL,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL,
      amount REAL NOT NULL,
      price REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(trader_id) REFERENCES traders(id) ON DELETE CASCADE,
      FOREIGN KEY(follower_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS prediction_markets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      close_date TEXT NOT NULL,
      settlement_date TEXT,
      outcome TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      total_pool REAL NOT NULL DEFAULT 0,
      yes_pool REAL NOT NULL DEFAULT 0,
      no_pool REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      market_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      prediction TEXT NOT NULL,
      amount REAL NOT NULL,
      potential_payout REAL NOT NULL,
      actual_payout REAL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      settled_at TEXT,
      FOREIGN KEY(market_id) REFERENCES prediction_markets(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      key TEXT NOT NULL UNIQUE,
      secret TEXT NOT NULL,
      name TEXT NOT NULL,
      tier TEXT NOT NULL DEFAULT 'free',
      permissions TEXT NOT NULL,
      ip_whitelist TEXT,
      rate_limit INTEGER NOT NULL DEFAULT 1000,
      usage_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_used_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payment_terminal_transactions (
      transaction_id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      terminal_id TEXT,
      protocol TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      masked_pan TEXT,
      auth_code TEXT,
      response_code TEXT,
      status TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL,
      refunded_at TEXT,
      refund_amount REAL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_payment_terminal_user_created
      ON payment_terminal_transactions(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS erc1155_contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_address TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      symbol TEXT,
      network TEXT NOT NULL DEFAULT 'ethereum',
      added_by INTEGER NOT NULL,
      is_verified BOOLEAN NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(added_by) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS erc1155_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER NOT NULL,
      token_id TEXT NOT NULL,
      name TEXT,
      description TEXT,
      uri TEXT,
      metadata TEXT,
      total_supply TEXT,
      token_type TEXT NOT NULL DEFAULT 'fungible',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(contract_id, token_id),
      FOREIGN KEY(contract_id) REFERENCES erc1155_contracts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS erc1155_balances (
      user_id INTEGER NOT NULL,
      contract_id INTEGER NOT NULL,
      token_id TEXT NOT NULL,
      balance TEXT NOT NULL DEFAULT '0',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, contract_id, token_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(contract_id) REFERENCES erc1155_contracts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS erc1155_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      contract_id INTEGER NOT NULL,
      token_id TEXT NOT NULL,
      transaction_type TEXT NOT NULL,
      from_address TEXT,
      to_address TEXT,
      amount TEXT NOT NULL,
      tx_hash TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(contract_id) REFERENCES erc1155_contracts(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      method TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL DEFAULT 'pending',
      reference TEXT,
      metadata TEXT DEFAULT '{}',
      qr_data TEXT,
      instructions TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      refunded_at TEXT,
      refund_amount REAL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS payment_methods_saved (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      label TEXT NOT NULL,
      masked TEXT,
      is_default INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS risk_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      risk_tolerance TEXT NOT NULL DEFAULT 'medium',
      portfolio_size REAL NOT NULL,
      max_drawdown_percent REAL NOT NULL DEFAULT 20,
      max_position_size REAL NOT NULL DEFAULT 10,
      max_leverage REAL NOT NULL DEFAULT 2,
      daily_loss_limit REAL NOT NULL DEFAULT 5,
      min_stop_loss_percent REAL NOT NULL DEFAULT 2,
      max_concentration REAL NOT NULL DEFAULT 30,
      correlation_threshold REAL NOT NULL DEFAULT 0.7,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS risk_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      alert_type TEXT NOT NULL,
      threshold REAL NOT NULL,
      action TEXT NOT NULL DEFAULT 'NOTIFY',
      active INTEGER NOT NULL DEFAULT 1,
      triggered_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS portfolio_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      total_value REAL NOT NULL,
      portfolio_data TEXT NOT NULL,
      snapshot_date TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS binance_trading_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      symbol TEXT NOT NULL,
      order_id TEXT NOT NULL,
      side TEXT NOT NULL,
      quantity REAL NOT NULL,
      price REAL NOT NULL,
      commission REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'open',
      executed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS advanced_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      symbol TEXT NOT NULL,
      order_type TEXT NOT NULL,
      side TEXT NOT NULL,
      quantity REAL NOT NULL,
      price REAL,
      stop_price REAL,
      trailing_stop_percent REAL,
      take_profit_price REAL,
      stop_loss_price REAL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS hedge_positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      underlying_symbol TEXT NOT NULL,
      hedge_type TEXT NOT NULL,
      quantity REAL NOT NULL,
      entry_price REAL NOT NULL,
      current_price REAL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS analytics_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      metric_name TEXT NOT NULL,
      metric_value REAL NOT NULL,
      calculated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_risk_profiles_user ON risk_profiles(user_id);
    CREATE INDEX IF NOT EXISTS idx_risk_alerts_user ON risk_alerts(user_id);
    CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_user ON portfolio_snapshots(user_id, snapshot_date DESC);
    CREATE INDEX IF NOT EXISTS idx_binance_history_user ON binance_trading_history(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_advanced_orders_user ON advanced_orders(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_hedge_positions_user ON hedge_positions(user_id);
  `);
}

initDb();

// Trading bot management
const activeBots = new Map(); // botId -> TradingBot instance

// Initialize advanced trading services
const marginTradingService = new MarginTradingService();
const p2pTradingService = new P2PTradingService();
const tokenSwapService = new TokenSwapService();
const demoTradingService = new DemoTradingService();
const copyTradingService = new CopyTradingService();
const predictionMarketsService = new PredictionMarketsService();
const apiKeysService = new APIKeysService();
const metaTraderService = new MetaTraderService();
const paymentGateway = new PaymentGatewayService({
  quoteProvider: fetchTrxPaymentQuote,
  tronDepositAddress: TRON_DEPOSIT_ADDRESS,
  tronNetwork: TRON_NETWORK,
});
const paymentTerminalService = new PaymentTerminalService();
const assistantService = new AssistantService();

// Initialize advanced integration services
const binanceApiService = new BinanceApiService();
const advancedAnalyticsService = new AdvancedAnalyticsService();
const riskManagementService = new RiskManagementService();
const portfolioOptimizationService = new PortfolioOptimizationService();

// Initialize advanced coding utilities
const performanceMonitor = new PerformanceMonitor();
const advancedCacheManager = new AdvancedCacheManager();
const metricsCollector = new MetricsCollector();
const rateLimiters = createRateLimiters();

// Circuit breakers for external API calls
const cryptoDataCircuitBreaker = new CircuitBreaker(
  async (fn) => fn(),
  { failureThreshold: 5, resetTimeout: 60000 }
);

const findUserByEmailStmt = db.prepare("SELECT * FROM users WHERE email = ?");
const findUserByUsernameStmt = db.prepare("SELECT * FROM users WHERE username = ?");
const findUserByIdStmt = db.prepare(
  "SELECT id, username, email, created_at FROM users WHERE id = ?"
);
const insertUserStmt = db.prepare(
  "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)"
);
const upsertBalanceStmt = db.prepare(
  "INSERT INTO balances (user_id, currency, balance) VALUES (?, ?, ?) ON CONFLICT(user_id, currency) DO UPDATE SET balance = excluded.balance"
);
const selectUserBalanceStmt = db.prepare(
  "SELECT balance FROM balances WHERE user_id = ? AND currency = ?"
);
const listBalancesStmt = db.prepare(
  "SELECT currency, balance FROM balances WHERE user_id = ? ORDER BY currency"
);
const addTransactionStmt = db.prepare(
  "INSERT INTO transactions (user_id, type, currency, amount, details, counterparty) VALUES (?, ?, ?, ?, ?, ?)"
);
const listTransactionsStmt = db.prepare(
  "SELECT id, type, currency, amount, details, counterparty, created_at FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT ?"
);
const insertPaymentTerminalTransactionStmt = db.prepare(
  "INSERT INTO payment_terminal_transactions (transaction_id, user_id, terminal_id, protocol, amount, currency, masked_pan, auth_code, response_code, status, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
);
const findPaymentTerminalTransactionStmt = db.prepare(
  "SELECT * FROM payment_terminal_transactions WHERE transaction_id = ? AND user_id = ?"
);
const listPaymentTerminalTransactionsStmt = db.prepare(
  "SELECT * FROM payment_terminal_transactions WHERE user_id = ? ORDER BY created_at DESC"
);
const refundPaymentTerminalTransactionStmt = db.prepare(
  "UPDATE payment_terminal_transactions SET refund_amount = COALESCE(refund_amount, 0) + ?, status = CASE WHEN COALESCE(refund_amount, 0) + ? >= amount THEN 'refunded' ELSE 'partially_refunded' END, refunded_at = CASE WHEN COALESCE(refund_amount, 0) + ? >= amount THEN datetime('now') ELSE refunded_at END WHERE transaction_id = ? AND user_id = ? AND status != 'refunded'"
);
const countPaymentTerminalTransactionsTodayStmt = db.prepare(
  "SELECT COUNT(*) AS count FROM payment_terminal_transactions WHERE user_id = ? AND date(created_at) = date('now')"
);
const getUserSolanaWalletStmt = db.prepare(
  "SELECT address, updated_at FROM user_solana_wallets WHERE user_id = ?"
);
const upsertUserSolanaWalletStmt = db.prepare(
  "INSERT INTO user_solana_wallets (user_id, address, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(user_id) DO UPDATE SET address = excluded.address, updated_at = datetime('now')"
);
const getUserBscWalletStmt = db.prepare(
  "SELECT address, updated_at FROM user_bsc_wallets WHERE user_id = ?"
);
const upsertUserBscWalletStmt = db.prepare(
  "INSERT INTO user_bsc_wallets (user_id, address, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(user_id) DO UPDATE SET address = excluded.address, updated_at = datetime('now')"
);
const getUserEthereumWalletStmt = db.prepare(
  "SELECT address, updated_at FROM user_ethereum_wallets WHERE user_id = ?"
);
const upsertUserEthereumWalletStmt = db.prepare(
  "INSERT INTO user_ethereum_wallets (user_id, address, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(user_id) DO UPDATE SET address = excluded.address, updated_at = datetime('now')"
);
const getUserTronWalletStmt = db.prepare(
  "SELECT address, updated_at FROM user_tron_wallets WHERE user_id = ?"
);
const upsertUserTronWalletStmt = db.prepare(
  "INSERT INTO user_tron_wallets (user_id, address, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(user_id) DO UPDATE SET address = excluded.address, updated_at = datetime('now')"
);
const listUserPluginEndpointsStmt = db.prepare(
  "SELECT api_key, label, method, route, category, description, requires_auth FROM user_plugin_endpoints WHERE user_id = ? ORDER BY api_key"
);
const upsertUserPluginEndpointStmt = db.prepare(
  "INSERT INTO user_plugin_endpoints (user_id, api_key, label, method, route, category, description, requires_auth, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now')) ON CONFLICT(user_id, api_key) DO UPDATE SET label = excluded.label, method = excluded.method, route = excluded.route, category = excluded.category, description = excluded.description, requires_auth = excluded.requires_auth, updated_at = datetime('now')"
);
const deleteUserPluginEndpointStmt = db.prepare(
  "DELETE FROM user_plugin_endpoints WHERE user_id = ? AND api_key = ?"
);
const listDexTokensStmt = db.prepare(
  "SELECT symbol, name, created_by, total_supply, created_at FROM dex_tokens ORDER BY symbol"
);
const findDexTokenBySymbolStmt = db.prepare(
  "SELECT symbol, name, created_by, total_supply, created_at FROM dex_tokens WHERE symbol = ?"
);
const insertDexTokenStmt = db.prepare(
  "INSERT INTO dex_tokens (symbol, name, created_by, total_supply) VALUES (?, ?, ?, ?)"
);
const listDexPoolsStmt = db.prepare(
  "SELECT id, token_a, token_b, reserve_a, reserve_b, fee_bps, created_by, created_at FROM dex_pools ORDER BY id DESC"
);
const findDexPoolByIdStmt = db.prepare(
  "SELECT id, token_a, token_b, reserve_a, reserve_b, fee_bps, created_by, created_at FROM dex_pools WHERE id = ?"
);
const findDexPoolByPairStmt = db.prepare(
  "SELECT id, token_a, token_b, reserve_a, reserve_b, fee_bps, created_by, created_at FROM dex_pools WHERE token_a = ? AND token_b = ?"
);
const insertDexPoolStmt = db.prepare(
  "INSERT INTO dex_pools (token_a, token_b, reserve_a, reserve_b, fee_bps, created_by) VALUES (?, ?, ?, ?, ?, ?)"
);
const updateDexPoolStmt = db.prepare(
  "UPDATE dex_pools SET reserve_a = ?, reserve_b = ? WHERE id = ?"
);
const getLpPositionStmt = db.prepare(
  "SELECT liquidity FROM dex_lp_positions WHERE user_id = ? AND pool_id = ?"
);
const upsertLpPositionStmt = db.prepare(
  "INSERT INTO dex_lp_positions (user_id, pool_id, liquidity) VALUES (?, ?, ?) ON CONFLICT(user_id, pool_id) DO UPDATE SET liquidity = excluded.liquidity"
);
const listLpPositionsStmt = db.prepare(
  "SELECT user_id, pool_id, liquidity FROM dex_lp_positions WHERE user_id = ? ORDER BY pool_id"
);
const sumPoolLiquidityStmt = db.prepare("SELECT liquidity FROM dex_lp_positions WHERE pool_id = ?");
const listExchangeOrdersStmt = db.prepare(
  "SELECT id, user_id, label, from_currency, to_currency, amount, target_rate, trigger_direction, route_mode, slippage_bps, preferred_pool_id, status, last_checked_at, executed_at, executed_rate, last_error, created_at, updated_at FROM exchange_orders WHERE user_id = ? ORDER BY id DESC"
);
const insertExchangeOrderStmt = db.prepare(
  "INSERT INTO exchange_orders (user_id, label, from_currency, to_currency, amount, target_rate, trigger_direction, route_mode, slippage_bps, preferred_pool_id, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', datetime('now'))"
);
const updateExchangeOrderStmt = db.prepare(
  "UPDATE exchange_orders SET status = ?, last_checked_at = datetime('now'), executed_at = CASE WHEN ? IS NULL THEN executed_at ELSE ? END, executed_rate = CASE WHEN ? IS NULL THEN executed_rate ELSE ? END, last_error = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?"
);
const markExchangeOrderCheckedStmt = db.prepare(
  "UPDATE exchange_orders SET last_checked_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND user_id = ?"
);

const bscWalletCache = new Map();

function getBscRpcCandidates() {
  const candidates = [BSC_RPC_URL, BSC_RPC_FALLBACK_URL].filter(Boolean);
  return [...new Set(candidates)];
}

function roundCrypto(amount) {
  return Math.round(amount * 1e8) / 1e8;
}

function normalizeDecimalString(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const str = String(value).trim();
  if (!str) {
    return null;
  }

  if (/e/i.test(str)) {
    const numeric = Number(str);
    if (!Number.isFinite(numeric)) {
      return null;
    }
    return numeric.toFixed(8);
  }

  return str;
}

function decimalToAtomic(value) {
  const normalized = normalizeDecimalString(value);
  if (!normalized) {
    return null;
  }

  const match = normalized.match(/^(-?)(\d+)(?:\.(\d{1,8})\d*)?$/);
  if (!match) {
    return null;
  }

  const [, sign, wholePart, fractionPart = ""] = match;
  const fractionPadded = (fractionPart + "00000000").slice(0, 8);
  const whole = BigInt(wholePart);
  const fraction = BigInt(fractionPadded);
  const atomic = whole * ATOMIC_SCALE + fraction;
  return sign === "-" ? -atomic : atomic;
}

function parseAmountAtomic(value) {
  const atomic = decimalToAtomic(value);
  if (atomic === null || atomic <= 0n) {
    return null;
  }
  return atomic;
}

function parseStoredAtomic(value) {
  if (value === null || value === undefined) {
    return 0n;
  }

  if (typeof value === "string" && value.startsWith("a:")) {
    try {
      return BigInt(value.slice(2));
    } catch {
      return 0n;
    }
  }

  const atomic = decimalToAtomic(value);
  return atomic === null ? 0n : atomic;
}

function coerceToAtomic(value) {
  if (typeof value === "bigint") {
    return value;
  }
  const atomic = decimalToAtomic(value);
  if (atomic === null) {
    throw new Error("Invalid balance amount");
  }
  return atomic;
}

function atomicToStorage(valueAtomic) {
  return `a:${valueAtomic.toString()}`;
}

function atomicToDecimalString(valueAtomic) {
  const negative = valueAtomic < 0n;
  const absolute = negative ? -valueAtomic : valueAtomic;
  const whole = absolute / ATOMIC_SCALE;
  const fraction = absolute % ATOMIC_SCALE;
  const formatted = `${whole.toString()}.${fraction.toString().padStart(8, "0")}`;
  return negative ? `-${formatted}` : formatted;
}

function atomicToNumber(valueAtomic) {
  return Number(atomicToDecimalString(valueAtomic));
}

function normalizeCurrencyCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function getSortedPair(a, b) {
  return [a, b].sort((left, right) => left.localeCompare(right));
}

function normalizeExchangeRouteMode(value) {
  const normalized = String(value || "auto")
    .trim()
    .toLowerCase();
  if (["auto", "market", "dex"].includes(normalized)) {
    return normalized;
  }
  return "auto";
}

function normalizeSlippageBps(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 100;
  }
  return Math.max(0, Math.min(5000, Math.round(numeric)));
}

function getQuoteMinReceived(amountOutAtomic, slippageBps) {
  const safeSlippageBps = normalizeSlippageBps(slippageBps);
  return (amountOutAtomic * BigInt(10000 - safeSlippageBps)) / 10000n;
}

function calculateDexQuoteForPool(pool, fromCurrency, amountAtomic) {
  const isFromA = fromCurrency === pool.token_a;
  const isFromB = fromCurrency === pool.token_b;
  if (!isFromA && !isFromB) {
    return null;
  }

  const reserveIn = parseStoredAtomic(isFromA ? pool.reserve_a : pool.reserve_b);
  const reserveOut = parseStoredAtomic(isFromA ? pool.reserve_b : pool.reserve_a);
  if (reserveIn <= 0n || reserveOut <= 0n) {
    return null;
  }

  const feeBps = BigInt(pool.fee_bps);
  const amountInAfterFee = (amountAtomic * (10000n - feeBps)) / 10000n;
  const numerator = amountInAfterFee * reserveOut;
  const denominator = reserveIn + amountInAfterFee;
  const amountOutAtomic = numerator / denominator;
  if (amountOutAtomic <= 0n) {
    return null;
  }

  const idealOutAtomic = (amountAtomic * reserveOut) / reserveIn;
  const priceImpactBps =
    idealOutAtomic > 0n && idealOutAtomic > amountOutAtomic
      ? Number(((idealOutAtomic - amountOutAtomic) * 10000n) / idealOutAtomic)
      : 0;

  return {
    routeMode: "dex",
    source: `dex-pool-${pool.id}`,
    poolId: pool.id,
    pool,
    fromCurrency,
    toCurrency: isFromA ? pool.token_b : pool.token_a,
    amountInAtomic: amountAtomic,
    amountOutAtomic,
    rate: atomicToNumber(amountOutAtomic) / atomicToNumber(amountAtomic),
    feeBps: pool.fee_bps,
    priceImpactBps,
    reserveIn,
    reserveOut,
    idealOutAtomic,
  };
}

function calculateDexRouteQuote(routePools, fromCurrency, amountAtomic) {
  if (!Array.isArray(routePools) || routePools.length === 0) {
    return null;
  }

  const hops = [];
  let currentCurrency = fromCurrency;
  let currentAmountAtomic = amountAtomic;

  for (const pool of routePools) {
    const hopQuote = calculateDexQuoteForPool(pool, currentCurrency, currentAmountAtomic);
    if (!hopQuote) {
      return null;
    }
    hops.push(hopQuote);
    currentCurrency = hopQuote.toCurrency;
    currentAmountAtomic = hopQuote.amountOutAtomic;
  }

  const aggregateFeeBps = hops.reduce((acc, hop) => acc + Number(hop.feeBps || 0), 0);
  const aggregatePriceImpactBps = hops.reduce(
    (acc, hop) => acc + Number(hop.priceImpactBps || 0),
    0
  );

  return {
    routeMode: "dex",
    source: hops.length === 1 ? `dex-pool-${hops[0].poolId}` : `dex-route-${hops.length}hop`,
    poolId: hops[0].poolId,
    pool: hops[0].pool,
    fromCurrency,
    toCurrency: currentCurrency,
    amountInAtomic: amountAtomic,
    amountOutAtomic: currentAmountAtomic,
    rate: atomicToNumber(currentAmountAtomic) / atomicToNumber(amountAtomic),
    feeBps: aggregateFeeBps,
    priceImpactBps: aggregatePriceImpactBps,
    path: [fromCurrency, ...hops.map((hop) => hop.toCurrency)],
    hops,
  };
}

function calculateMarketQuote(matrix, fromCurrency, toCurrency, amountAtomic) {
  const rate = matrix?.[fromCurrency]?.[toCurrency];
  if (!Number.isFinite(rate) || rate <= 0) {
    return null;
  }

  const amountOutAtomic = parseAmountAtomic(Number(atomicToDecimalString(amountAtomic)) * rate);
  if (!amountOutAtomic) {
    return null;
  }

  return {
    routeMode: "market",
    source: "market-rate",
    poolId: null,
    pool: null,
    fromCurrency,
    toCurrency,
    amountInAtomic: amountAtomic,
    amountOutAtomic,
    rate,
    feeBps: 0,
    priceImpactBps: 0,
  };
}

async function buildExchangeQuote({
  fromCurrency,
  toCurrency,
  amountAtomic,
  routeMode = "auto",
  slippageBps = 100,
  preferredPoolId = null,
  matrix = null,
}) {
  const normalizedRouteMode = normalizeExchangeRouteMode(routeMode);
  const safeSlippageBps = normalizeSlippageBps(slippageBps);
  const pricing = matrix ? { matrix } : await getCrossRates();
  const marketQuote = calculateMarketQuote(pricing.matrix, fromCurrency, toCurrency, amountAtomic);

  const allPools = listDexPoolsStmt.all();
  const directPools = allPools.filter((pool) => {
    const pair = getSortedPair(pool.token_a, pool.token_b);
    return pair[0] === fromCurrency && pair[1] === toCurrency;
  });

  const bridgeTokens = [
    ...new Set(allPools.flatMap((pool) => [pool.token_a, pool.token_b])),
  ].filter((token) => token !== fromCurrency && token !== toCurrency);

  const routeCandidates = [];

  for (const pool of directPools) {
    routeCandidates.push(calculateDexRouteQuote([pool], fromCurrency, amountAtomic));
  }

  for (const bridgeToken of bridgeTokens) {
    const firstLeg = allPools.filter((pool) => {
      const pair = getSortedPair(pool.token_a, pool.token_b);
      return pair[0] === fromCurrency && pair[1] === bridgeToken;
    });
    const secondLeg = allPools.filter((pool) => {
      const pair = getSortedPair(pool.token_a, pool.token_b);
      return pair[0] === bridgeToken && pair[1] === toCurrency;
    });

    for (const firstPool of firstLeg) {
      for (const secondPool of secondLeg) {
        routeCandidates.push(
          calculateDexRouteQuote([firstPool, secondPool], fromCurrency, amountAtomic)
        );
      }
    }
  }

  const dexQuotes = routeCandidates
    .filter(Boolean)
    .filter((quote) =>
      preferredPoolId
        ? quote.path.includes(fromCurrency) &&
          quote.hops.some((hop) => hop.poolId === Number(preferredPoolId))
        : true
    )
    .sort((left, right) => Number(right.amountOutAtomic - left.amountOutAtomic));

  const bestDexQuote = dexQuotes[0] || null;

  let selectedQuote;
  if (normalizedRouteMode === "dex") {
    selectedQuote = bestDexQuote;
  } else if (normalizedRouteMode === "market") {
    selectedQuote = marketQuote;
  } else if (bestDexQuote && marketQuote) {
    selectedQuote =
      bestDexQuote.amountOutAtomic > marketQuote.amountOutAtomic ? bestDexQuote : marketQuote;
  } else {
    selectedQuote = bestDexQuote || marketQuote;
  }

  if (!selectedQuote) {
    throw new Error(`No exchange route available for ${fromCurrency}/${toCurrency}`);
  }

  const minimumReceivedAtomic = getQuoteMinReceived(selectedQuote.amountOutAtomic, safeSlippageBps);

  return {
    routeMode: selectedQuote.routeMode === "dex" ? "dex" : normalizedRouteMode,
    source: selectedQuote.source,
    poolId: selectedQuote.poolId,
    pool: selectedQuote.pool ? formatDexPoolRow(selectedQuote.pool) : null,
    path: selectedQuote.path || [fromCurrency, toCurrency],
    hops: Array.isArray(selectedQuote.hops)
      ? selectedQuote.hops.map((hop) => ({
          poolId: hop.poolId,
          pool: formatDexPoolRow(hop.pool),
          fromCurrency: hop.fromCurrency,
          toCurrency: hop.toCurrency,
          amountIn: atomicToNumber(hop.amountInAtomic),
          amountOut: atomicToNumber(hop.amountOutAtomic),
          feeBps: hop.feeBps,
          priceImpactBps: hop.priceImpactBps,
        }))
      : [],
    fromCurrency,
    toCurrency,
    amountIn: atomicToNumber(amountAtomic),
    amountInAtomic: atomicToStorage(amountAtomic),
    amountOut: atomicToNumber(selectedQuote.amountOutAtomic),
    amountOutAtomic: atomicToStorage(selectedQuote.amountOutAtomic),
    rate: selectedQuote.rate,
    feeBps: selectedQuote.feeBps,
    priceImpactBps: selectedQuote.priceImpactBps,
    minimumReceived: atomicToNumber(minimumReceivedAtomic),
    minimumReceivedAtomic: atomicToStorage(minimumReceivedAtomic),
    slippageBps: safeSlippageBps,
    availableRoutes: {
      market: Boolean(marketQuote),
      dex: dexQuotes.map((quote) => ({
        poolId: quote.poolId,
        path: quote.path,
        amountOut: atomicToNumber(quote.amountOutAtomic),
        priceImpactBps: quote.priceImpactBps,
      })),
    },
  };
}

function toExchangeResult(quote) {
  return {
    routeMode: quote.routeMode,
    source: quote.source,
    poolId: quote.poolId,
    pool: quote.pool,
    path: quote.path,
    hops: quote.hops,
    fromCurrency: quote.fromCurrency,
    toCurrency: quote.toCurrency,
    amountIn: quote.amountIn,
    amountOut: quote.amountOut,
    rate: quote.rate,
    feeBps: quote.feeBps,
    priceImpactBps: quote.priceImpactBps,
    minimumReceived: quote.minimumReceived,
    slippageBps: quote.slippageBps,
    availableRoutes: quote.availableRoutes,
  };
}

function normalizeExchangeTriggerDirection(value) {
  const normalized = String(value || "lte")
    .trim()
    .toLowerCase();
  return normalized === "gte" ? "gte" : "lte";
}

function normalizeExchangeRouteModeList(value) {
  const normalized = normalizeExchangeRouteMode(value);
  return normalized;
}

function formatExchangeOrderRow(row) {
  return {
    id: row.id,
    label: row.label || "",
    fromCurrency: row.from_currency,
    toCurrency: row.to_currency,
    amount: atomicToNumber(parseStoredAtomic(row.amount)),
    targetRate: Number(row.target_rate),
    triggerDirection: row.trigger_direction,
    routeMode: row.route_mode,
    slippageBps: Number(row.slippage_bps || 0),
    preferredPoolId: row.preferred_pool_id || null,
    status: row.status,
    lastCheckedAt: row.last_checked_at,
    executedAt: row.executed_at,
    executedRate:
      row.executed_rate === null || row.executed_rate === undefined
        ? null
        : Number(row.executed_rate),
    lastError: row.last_error || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function executeExchangeTrade({
  userId,
  quote = null,
  fromCurrency,
  toCurrency,
  amountAtomic,
  routeMode = "auto",
  slippageBps = 100,
  preferredPoolId = null,
  matrix = null,
}) {
  const resolvedQuote =
    quote ||
    (await buildExchangeQuote({
      fromCurrency,
      toCurrency,
      amountAtomic,
      routeMode,
      slippageBps,
      preferredPoolId,
      matrix,
    }));

  const convertedAtomic = parseStoredAtomic(resolvedQuote.amountOutAtomic);
  const minimumReceivedAtomic = parseStoredAtomic(resolvedQuote.minimumReceivedAtomic);

  if (convertedAtomic < minimumReceivedAtomic) {
    throw new Error("Quoted output is below the selected slippage protection");
  }

  const actualRouteExecutions = [];

  const exchangeTx = db.transaction(() => {
    const sourceBalance = getBalance(userId, fromCurrency);
    if (sourceBalance < amountAtomic) {
      throw new Error("Insufficient funds");
    }

    const destBalance = getBalance(userId, toCurrency);

    setBalance(userId, fromCurrency, sourceBalance - amountAtomic);
    setBalance(userId, toCurrency, destBalance + convertedAtomic);

    if (
      resolvedQuote.routeMode === "dex" &&
      Array.isArray(resolvedQuote.hops) &&
      resolvedQuote.hops.length > 0
    ) {
      let currentCurrency = fromCurrency;
      let currentAmountAtomic = amountAtomic;

      for (const hop of resolvedQuote.hops) {
        const pool = findDexPoolByIdStmt.get(hop.poolId);
        if (!pool) {
          throw new Error(`Pool #${hop.poolId} not found`);
        }

        const liveQuote = calculateDexQuoteForPool(pool, currentCurrency, currentAmountAtomic);
        if (!liveQuote) {
          throw new Error("Swap output too small");
        }

        const newReserveA =
          pool.token_a === currentCurrency
            ? liveQuote.reserveIn + currentAmountAtomic
            : liveQuote.reserveOut - liveQuote.amountOutAtomic;
        const newReserveB =
          pool.token_b === currentCurrency
            ? liveQuote.reserveIn + currentAmountAtomic
            : liveQuote.reserveOut - liveQuote.amountOutAtomic;

        updateDexPoolStmt.run(atomicToStorage(newReserveA), atomicToStorage(newReserveB), pool.id);

        actualRouteExecutions.push({
          poolId: pool.id,
          fromCurrency: currentCurrency,
          toCurrency: liveQuote.toCurrency,
          amountIn: atomicToNumber(currentAmountAtomic),
          amountOut: atomicToNumber(liveQuote.amountOutAtomic),
        });

        currentCurrency = liveQuote.toCurrency;
        currentAmountAtomic = liveQuote.amountOutAtomic;
      }
    }

    const routeDetails =
      resolvedQuote.routeMode === "dex"
        ? resolvedQuote.path && resolvedQuote.path.length > 2
          ? ` via ${resolvedQuote.path.join(" -> ")}`
          : ` via pool #${resolvedQuote.poolId}`
        : " via market rate";

    addTransactionStmt.run(
      userId,
      "EXCHANGE_DEBIT",
      fromCurrency,
      atomicToNumber(amountAtomic),
      `Exchanged to ${toCurrency}${routeDetails} at rate ${resolvedQuote.rate}`,
      null
    );

    addTransactionStmt.run(
      userId,
      "EXCHANGE_CREDIT",
      toCurrency,
      atomicToNumber(convertedAtomic),
      `Exchanged from ${fromCurrency}${routeDetails} at rate ${resolvedQuote.rate}`,
      null
    );
  });

  exchangeTx();

  return {
    ...toExchangeResult(resolvedQuote),
    amount: atomicToNumber(amountAtomic),
    received: atomicToNumber(convertedAtomic),
    routeExecutions: actualRouteExecutions,
  };
}

async function processExchangeOrders(userId) {
  const { matrix } = await getCrossRates();
  const orders = listExchangeOrdersStmt.all(userId).filter((row) => row.status === "open");
  const results = [];

  for (const orderRow of orders) {
    const order = formatExchangeOrderRow(orderRow);
    const currentRate = matrix?.[order.fromCurrency]?.[order.toCurrency];

    if (!Number.isFinite(currentRate)) {
      markExchangeOrderCheckedStmt.run(order.id, userId);
      continue;
    }

    const shouldExecute =
      order.triggerDirection === "lte"
        ? currentRate <= order.targetRate
        : currentRate >= order.targetRate;

    if (!shouldExecute) {
      markExchangeOrderCheckedStmt.run(order.id, userId);
      continue;
    }

    const amountAtomic = parseStoredAtomic(orderRow.amount);

    try {
      const result = await executeExchangeTrade({
        userId,
        fromCurrency: order.fromCurrency,
        toCurrency: order.toCurrency,
        amountAtomic,
        routeMode: order.routeMode,
        slippageBps: order.slippageBps,
        preferredPoolId: order.preferredPoolId,
        matrix,
      });

      updateExchangeOrderStmt.run(
        "executed",
        new Date().toISOString(),
        new Date().toISOString(),
        currentRate,
        currentRate,
        null,
        order.id,
        userId
      );

      results.push({
        id: order.id,
        status: "executed",
        rate: currentRate,
        result,
      });
    } catch (err) {
      updateExchangeOrderStmt.run(
        "failed",
        null,
        null,
        null,
        null,
        err.message || "Order execution failed",
        order.id,
        userId
      );
      results.push({
        id: order.id,
        status: "failed",
        error: err.message || "Order execution failed",
      });
    }
  }

  return {
    processed: orders.length,
    results,
  };
}

function computeDexRouteExecution(userId, quote) {
  const amountAtomic = parseStoredAtomic(quote.amountInAtomic || quote.amountIn);
  if (!amountAtomic || !Array.isArray(quote.hops) || quote.hops.length === 0) {
    throw new Error("DEX route is not available");
  }

  const sourceBalance = getBalance(userId, quote.fromCurrency);
  if (sourceBalance < amountAtomic) {
    throw new Error("Insufficient funds");
  }

  const hopExecutions = [];
  let currentCurrency = quote.fromCurrency;
  let currentAmountAtomic = amountAtomic;

  for (const hop of quote.hops) {
    const pool = findDexPoolByIdStmt.get(hop.poolId);
    if (!pool) {
      throw new Error(`Pool #${hop.poolId} not found`);
    }

    const liveQuote = calculateDexQuoteForPool(pool, currentCurrency, currentAmountAtomic);
    if (!liveQuote) {
      throw new Error("Swap output too small");
    }

    const newReserveA =
      pool.token_a === currentCurrency
        ? liveQuote.reserveIn + currentAmountAtomic
        : liveQuote.reserveOut - liveQuote.amountOutAtomic;
    const newReserveB =
      pool.token_b === currentCurrency
        ? liveQuote.reserveIn + currentAmountAtomic
        : liveQuote.reserveOut - liveQuote.amountOutAtomic;

    hopExecutions.push({
      poolId: pool.id,
      fromCurrency: currentCurrency,
      toCurrency: liveQuote.toCurrency,
      amountInAtomic: currentAmountAtomic,
      amountOutAtomic: liveQuote.amountOutAtomic,
      newReserveA,
      newReserveB,
    });

    currentCurrency = liveQuote.toCurrency;
    currentAmountAtomic = liveQuote.amountOutAtomic;
  }

  return {
    amountAtomic,
    finalCurrency: currentCurrency,
    finalAmountAtomic: currentAmountAtomic,
    hopExecutions,
  };
}

function integerSqrt(value) {
  if (value < 0n) {
    throw new Error("square root of negative numbers is not supported");
  }
  if (value < 2n) {
    return value;
  }

  let x0 = value;
  let x1 = (x0 + value / x0) / 2n;
  while (x1 < x0) {
    x0 = x1;
    x1 = (x0 + value / x0) / 2n;
  }
  return x0;
}

function totalPoolLiquidityAtomic(poolId) {
  const rows = sumPoolLiquidityStmt.all(poolId);
  return rows.reduce((acc, row) => acc + parseStoredAtomic(row.liquidity), 0n);
}

function formatDexTokenRow(row) {
  return {
    symbol: row.symbol,
    name: row.name,
    createdBy: row.created_by,
    totalSupply: atomicToNumber(parseStoredAtomic(row.total_supply)),
    createdAt: row.created_at,
  };
}

function formatDexPoolRow(row) {
  return {
    id: row.id,
    tokenA: row.token_a,
    tokenB: row.token_b,
    reserveA: atomicToNumber(parseStoredAtomic(row.reserve_a)),
    reserveB: atomicToNumber(parseStoredAtomic(row.reserve_b)),
    feeBps: row.fee_bps,
    createdBy: row.created_by,
    createdAt: row.created_at,
    totalLiquidity: atomicToNumber(totalPoolLiquidityAtomic(row.id)),
  };
}

function isValidSolanaAddress(address) {
  if (typeof address !== "string") {
    return false;
  }
  const trimmed = address.trim();
  const base58 = /^[1-9A-HJ-NP-Za-km-z]+$/;
  return trimmed.length >= 32 && trimmed.length <= 44 && base58.test(trimmed);
}

function isValidEvmAddress(address) {
  if (typeof address !== "string") {
    return false;
  }
  return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
}

function weiToBnb(weiHex) {
  if (!weiHex || typeof weiHex !== "string") {
    return null;
  }

  const normalized = weiHex.startsWith("0x") ? weiHex : `0x${weiHex}`;
  const wei = BigInt(normalized);
  const denominator = 10n ** 18n;
  const whole = wei / denominator;
  const fraction = wei % denominator;
  const asNumber = Number(`${whole}.${fraction.toString().padStart(18, "0")}`);
  return roundCrypto(asNumber);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureUserBalances(userId) {
  const insert = db.prepare(
    "INSERT OR IGNORE INTO balances (user_id, currency, balance) VALUES (?, ?, 0)"
  );

  const tx = db.transaction(() => {
    for (const currency of SUPPORTED_CODES) {
      insert.run(userId, currency);
    }
  });

  tx();
}

function getBalance(userId, currency) {
  const row = selectUserBalanceStmt.get(userId, currency);
  return parseStoredAtomic(row ? row.balance : null);
}

function setBalance(userId, currency, value) {
  const atomic = coerceToAtomic(value);
  upsertBalanceStmt.run(userId, currency, atomicToStorage(atomic));
}

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  return next();
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token) {
    return res.status(401).json({ error: "Missing auth token" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = findUserByIdStmt.get(payload.sub);
    if (!user) {
      return res.status(401).json({ error: "Invalid token user" });
    }
    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

let ratesCache = {
  ts: 0,
  ratesUSD: null,
};

let priceChangeCache = {
  ts: 0,
  interval: "1d",
  changes: null,
};

const TATUM_PRICE_CHANGE_SYMBOL_MAP = {
  USDT: "USDC",
};

function getChartIntervals() {
  return [
    { key: "1m", label: "1 Minute", minutes: 1, step: 1 },
    { key: "5m", label: "5 Minutes", minutes: 5, step: 1 },
    { key: "15m", label: "15 Minutes", minutes: 15, step: 3 },
    { key: "30m", label: "30 Minutes", minutes: 30, step: 5 },
    { key: "1h", label: "1 Hour", minutes: 60, step: 10 },
    { key: "1d", label: "1 Day", minutes: 60 * 24, step: 24 },
    { key: "1w", label: "1 Week", minutes: 60 * 24 * 7, step: 24 * 7 },
    { key: "1mo", label: "1 Month", minutes: 60 * 24 * 30, step: 24 * 7 * 4 },
    { key: "1y", label: "1 Year", minutes: 60 * 24 * 365, step: 24 * 14 },
    { key: "all", label: "All Time", minutes: 60 * 24 * 365 * 3, step: 24 * 30 },
  ];
}

function getIntervalByKey(key) {
  return getChartIntervals().find((interval) => interval.key === key) || getChartIntervals()[4];
}

function getTatumChartConfig(intervalKey) {
  const normalized = String(intervalKey || "1h").toLowerCase();

  switch (normalized) {
    case "1m":
      return { interval: "1m", candles: 50, lookbackMs: 50 * 60 * 1000 };
    case "5m":
      return { interval: "5m", candles: 50, lookbackMs: 50 * 5 * 60 * 1000 };
    case "15m":
      return { interval: "15m", candles: 50, lookbackMs: 50 * 15 * 60 * 1000 };
    case "30m":
      return { interval: "30m", candles: 50, lookbackMs: 50 * 30 * 60 * 1000 };
    case "1h":
      return { interval: "1h", candles: 48, lookbackMs: 48 * 60 * 60 * 1000 };
    case "1d":
      return { interval: "1d", candles: 30, lookbackMs: 30 * 24 * 60 * 60 * 1000 };
    case "1w":
      return { interval: "1w", candles: 26, lookbackMs: 26 * 7 * 24 * 60 * 60 * 1000 };
    case "1mo":
      return { interval: "1M", candles: 24, lookbackMs: 24 * 31 * 24 * 60 * 60 * 1000 };
    case "1y":
      return { interval: "1M", candles: 12, lookbackMs: 12 * 31 * 24 * 60 * 60 * 1000 };
    case "all":
      return { interval: "1M", candles: 50, lookbackMs: 50 * 31 * 24 * 60 * 60 * 1000 };
    default:
      return { interval: "1h", candles: 48, lookbackMs: 48 * 60 * 60 * 1000 };
  }
}

async function fetchTatumOhlcvSeries(symbol, intervalKey) {
  if (!TATUM_DATA_API_KEY) {
    return null;
  }

  const config = getTatumChartConfig(intervalKey);
  const now = Date.now();
  const unixFrom = now - config.lookbackMs;

  let response;
  try {
    response = await axios.get(`${TATUM_DATA_API_URL}/v4/data/rate/symbol/OHLCV/batch`, {
      headers: {
        accept: "application/json",
        "x-api-key": TATUM_DATA_API_KEY,
      },
      params: {
        symbol,
        interval: config.interval,
        unixFrom,
        numberOfCandles: config.candles,
      },
      timeout: 12000,
    });
  } catch (err) {
    const status = err.response?.status;
    const message =
      err.response?.data?.message ||
      (Array.isArray(err.response?.data?.data) ? err.response.data.data.join("; ") : null) ||
      err.message ||
      "Failed to load OHLCV from Tatum";
    const wrapped = new Error(message);
    wrapped.statusCode = status;
    wrapped.code =
      status === 401 || status === 403
        ? "TATUM_AUTH"
        : status === 429
          ? "TATUM_RATE_LIMIT"
          : "TATUM_DATA";
    throw wrapped;
  }

  const rows = Array.isArray(response.data) ? response.data : [];
  if (rows.length === 0) {
    return null;
  }

  const points = rows
    .map((row) => ({
      time: new Date(Number(row.openTime)).toISOString(),
      open: roundCrypto(Number(row.open)),
      high: roundCrypto(Number(row.high)),
      low: roundCrypto(Number(row.low)),
      close: roundCrypto(Number(row.close)),
      volume: roundCrypto(Number(row.volume || 0)),
    }))
    .filter((row) => Number.isFinite(row.open) && Number.isFinite(row.close))
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  if (points.length === 0) {
    return null;
  }

  return {
    source: "tatum-ohlcv-batch",
    providerInterval: config.interval,
    points,
  };
}

function buildChartSeries(basePrice, intervalKey) {
  const interval = getIntervalByKey(intervalKey);
  const totalPoints = Math.min(
    240,
    Math.max(24, Math.floor(interval.minutes / Math.max(1, interval.step)))
  );
  const now = Date.now();
  const series = [];

  let price = basePrice || 1;
  for (let index = totalPoints - 1; index >= 0; index -= 1) {
    const drift = Math.sin(index / 4) * 0.018 + Math.cos(index / 9) * 0.011;
    const open = price * (1 + drift);
    const close = open * (1 + Math.sin(index / 3.5) * 0.007);
    const high = Math.max(open, close) * (1 + 0.008 + (index % 5) * 0.001);
    const low = Math.min(open, close) * (1 - 0.008 - (index % 3) * 0.001);
    series.push({
      time: new Date(now - index * interval.step * 60 * 1000).toISOString(),
      open: roundCrypto(open),
      high: roundCrypto(high),
      low: roundCrypto(low),
      close: roundCrypto(close),
      volume: roundCrypto((1 + (index % 10)) * interval.step * 12.5),
    });
    price = close;
  }

  return {
    interval: interval.key,
    intervalLabel: interval.label,
    points: series,
  };
}

async function fetchRatesUSD() {
  const now = Date.now();
  if (ratesCache.ratesUSD && now - ratesCache.ts < 60 * 1000) {
    return ratesCache.ratesUSD;
  }

  const ids = Object.values(SUPPORTED).join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
  const response = await cryptoDataCircuitBreaker.call(() => axios.get(url, { timeout: 10000 }));

  const mapped = {};
  for (const [symbol, id] of Object.entries(SUPPORTED)) {
    const price = response.data?.[id]?.usd;
    if (!price) {
      throw new Error(`Missing rate for ${symbol}`);
    }
    mapped[symbol] = Number(price);
  }

  ratesCache = { ts: now, ratesUSD: mapped };
  return mapped;
}

function normalizePriceChangeInterval(interval) {
  const value = String(interval || "1d").trim();
  const allowed = new Set([
    "1m",
    "5m",
    "15m",
    "30m",
    "45m",
    "1h",
    "2h",
    "4h",
    "1d",
    "1w",
    "1M",
    "1y",
  ]);
  return allowed.has(value) ? value : "1d";
}

function mapToTatumPriceSymbol(symbol) {
  return TATUM_PRICE_CHANGE_SYMBOL_MAP[symbol] || symbol;
}

async function fetchTatumPriceChanges(interval = "1d") {
  const normalizedInterval = normalizePriceChangeInterval(interval);
  const now = Date.now();

  if (
    priceChangeCache.changes &&
    priceChangeCache.interval === normalizedInterval &&
    now - priceChangeCache.ts < 60 * 1000
  ) {
    return priceChangeCache.changes;
  }

  if (!TATUM_DATA_API_KEY) {
    return null;
  }

  const payload = SUPPORTED_CODES.map((symbol) => ({
    symbol: mapToTatumPriceSymbol(symbol),
    batchId: symbol,
    interval: normalizedInterval,
  }));

  let response;
  try {
    response = await axios.post(`${TATUM_DATA_API_URL}/v4/data/rate/price-change/batch`, payload, {
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-api-key": TATUM_DATA_API_KEY,
      },
      timeout: 12000,
    });
  } catch (err) {
    const status = err.response?.status;
    const message =
      err.response?.data?.message ||
      (Array.isArray(err.response?.data?.data) ? err.response.data.data.join("; ") : null) ||
      err.message ||
      "Failed to load price-change batch from Tatum";
    const wrapped = new Error(message);
    wrapped.statusCode = status;
    wrapped.code =
      status === 401 || status === 403
        ? "TATUM_AUTH"
        : status === 429
          ? "TATUM_RATE_LIMIT"
          : "TATUM_DATA";
    throw wrapped;
  }

  const rows = Array.isArray(response.data) ? response.data : [];
  const changes = {};
  for (const symbol of SUPPORTED_CODES) {
    changes[symbol] = null;
  }

  for (const row of rows) {
    const symbol = normalizeCurrencyCode(row?.batchId || row?.symbol);
    if (!SUPPORTED_CODES.includes(symbol)) {
      continue;
    }

    const percentageChange = Number(row?.percentageChange);
    const absoluteChange = Number(row?.absoluteChange);
    const open = Number(row?.open);
    const close = Number(row?.close);

    changes[symbol] = {
      symbol,
      basePair: row?.basePair || "USD",
      percentageChange: Number.isFinite(percentageChange) ? percentageChange : null,
      absoluteChange: Number.isFinite(absoluteChange) ? absoluteChange : null,
      open: Number.isFinite(open) ? open : null,
      close: Number.isFinite(close) ? close : null,
      openTime: row?.openTime || null,
      closeTime: row?.closeTime || null,
    };
  }

  priceChangeCache = {
    ts: now,
    interval: normalizedInterval,
    changes,
  };

  return changes;
}

async function getCrossRates() {
  const usd = await fetchRatesUSD();
  let priceChange;
  try {
    priceChange = await fetchTatumPriceChanges("1d");
  } catch {
    priceChange = null;
  }
  const matrix = {};

  for (const from of SUPPORTED_CODES) {
    matrix[from] = {};
    for (const to of SUPPORTED_CODES) {
      if (from === to) {
        matrix[from][to] = 1;
      } else {
        matrix[from][to] = roundCrypto(usd[from] / usd[to]);
      }
    }
  }

  return {
    usd,
    matrix,
    priceChange,
    priceChangeInterval: "1d",
    priceChangeSource: priceChange ? "tatum-price-change-batch" : "unavailable",
    fetchedAt: new Date().toISOString(),
  };
}

async function callSolanaRpc(method, params) {
  const headers = { "Content-Type": "application/json" };
  if (SOLANA_RPC_API_KEY) {
    headers["x-api-key"] = SOLANA_RPC_API_KEY;
  }

  let response;
  try {
    response = await axios.post(
      SOLANA_RPC_URL,
      {
        jsonrpc: "2.0",
        id: Date.now(),
        method,
        params,
      },
      {
        timeout: 12000,
        headers,
      }
    );
  } catch (axiosErr) {
    const message =
      axiosErr.response?.data?.message ||
      axiosErr.response?.data?.error ||
      axiosErr.message ||
      "Solana RPC request failed";

    const err = new Error(message);
    if (
      /paid plans only|upgrade your subscription|not available for anonymous access|co\.tatum\.io\/signup|exceeded your limit|too many requests/i.test(
        message
      )
    ) {
      err.code = "TATUM_PLAN_LIMIT";
    }
    throw err;
  }

  if (response.data?.error) {
    const message = response.data.error.message || "Solana RPC error";
    const err = new Error(message);
    if (
      /paid plans only|upgrade your subscription|not available for anonymous access|co\.tatum\.io\/signup/i.test(
        message
      )
    ) {
      err.code = "TATUM_PLAN_LIMIT";
    }
    throw err;
  }

  return response.data?.result;
}

async function callBscRpcViaUrl(rpcUrl, method, params = []) {
  const headers = {
    accept: "application/json",
    "content-type": "application/json",
  };

  if (BSC_RPC_API_KEY) {
    headers["x-api-key"] = BSC_RPC_API_KEY;
  }

  let response;
  try {
    response = await axios.post(
      rpcUrl,
      {
        id: Date.now(),
        jsonrpc: "2.0",
        method,
        params,
      },
      {
        timeout: 12000,
        headers,
      }
    );
  } catch (axiosErr) {
    const message =
      axiosErr.response?.data?.message ||
      axiosErr.response?.data?.error ||
      axiosErr.message ||
      "BSC RPC request failed";

    const err = new Error(message);
    err.statusCode = axiosErr.response?.status;
    err.rawCode = axiosErr.code;
    const retryAfterHeader = axiosErr.response?.headers?.["retry-after"];
    const retryAfterSec = Number.parseInt(retryAfterHeader, 10);
    if (Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
      err.retryAfterSec = retryAfterSec;
    }

    if (/unauthorized|forbidden|api key|authentication|missing/i.test(message)) {
      err.code = "TATUM_AUTH";
    } else if (/exceeded your limit|too many requests|429/i.test(message)) {
      err.code = "TATUM_RATE_LIMIT";
    } else if (
      /ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|network/i.test(
        `${axiosErr.code || ""} ${message}`
      )
    ) {
      err.code = "TATUM_TRANSIENT";
    }

    err.gatewayUrl = rpcUrl;
    throw err;
  }

  if (response.data?.error) {
    const message = response.data.error.message || "BSC RPC error";
    const err = new Error(message);
    if (/unauthorized|forbidden|api key|authentication|missing/i.test(message)) {
      err.code = "TATUM_AUTH";
    } else if (/exceeded your limit|too many requests|429/i.test(message)) {
      err.code = "TATUM_RATE_LIMIT";
    }
    err.gatewayUrl = rpcUrl;
    throw err;
  }

  return response.data?.result;
}

async function callBscRpc(method, params = []) {
  const candidates = getBscRpcCandidates();
  let lastErr = null;

  for (const rpcUrl of candidates) {
    try {
      return await callBscRpcViaUrl(rpcUrl, method, params);
    } catch (err) {
      lastErr = err;
      if (err.code === "TATUM_AUTH") {
        throw err;
      }
    }
  }

  throw lastErr || new Error("BSC RPC request failed");
}

async function callBscRpcWithRetry(method, params = [], maxRetries = 3) {
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      return await callBscRpc(method, params);
    } catch (err) {
      if (!["TATUM_RATE_LIMIT", "TATUM_TRANSIENT"].includes(err.code) || attempt === maxRetries) {
        throw err;
      }

      const retryAfterSec =
        err.code === "TATUM_RATE_LIMIT"
          ? Number.isFinite(err.retryAfterSec) && err.retryAfterSec > 0
            ? err.retryAfterSec
            : Math.min(30, 2 ** attempt * 2)
          : Math.min(8, 2 ** attempt);

      await delay((retryAfterSec + 1) * 1000);
      attempt += 1;
    }
  }

  throw new Error("BSC RPC retry exhausted");
}

async function callTronRpc(method, params = []) {
  const headers = {
    accept: "application/json",
    "content-type": "application/json",
  };

  if (TRON_RPC_API_KEY) {
    headers["x-api-key"] = TRON_RPC_API_KEY;
  }

  let response;
  try {
    response = await axios.post(
      TRON_ENDPOINTS[TRON_NETWORK].jsonrpc,
      {
        id: Date.now(),
        jsonrpc: "2.0",
        method,
        params,
      },
      {
        timeout: 12000,
        headers,
      }
    );
  } catch (axiosErr) {
    const message =
      axiosErr.response?.data?.message ||
      axiosErr.response?.data?.error ||
      axiosErr.message ||
      "Tron RPC request failed";

    const err = new Error(message);
    err.statusCode = axiosErr.response?.status;
    const retryAfterHeader = axiosErr.response?.headers?.["retry-after"];
    const retryAfterSec = Number.parseInt(retryAfterHeader, 10);
    if (Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
      err.retryAfterSec = retryAfterSec;
    }
    if (/unauthorized|forbidden|api key|authentication|missing/i.test(message)) {
      err.code = "TATUM_AUTH";
    } else if (/exceeded your limit|too many requests|429/i.test(message)) {
      err.code = "TATUM_RATE_LIMIT";
    } else if (
      /ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|network/i.test(
        `${axiosErr.code || ""} ${message}`
      )
    ) {
      err.code = "TATUM_TRANSIENT";
    }
    throw err;
  }

  if (response.data?.error) {
    const message = response.data.error.message || "Tron RPC error";
    const err = new Error(message);
    if (/unauthorized|forbidden|api key|authentication|missing/i.test(message)) {
      err.code = "TATUM_AUTH";
    } else if (/exceeded your limit|too many requests|429/i.test(message)) {
      err.code = "TATUM_RATE_LIMIT";
    }
    throw err;
  }

  return response.data?.result;
}

async function callTronRpcWithRetry(method, params = [], maxRetries = 3) {
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      return await callTronRpc(method, params);
    } catch (err) {
      if (!["TATUM_RATE_LIMIT", "TATUM_TRANSIENT"].includes(err.code) || attempt === maxRetries) {
        throw err;
      }

      const retryAfterSec =
        err.code === "TATUM_RATE_LIMIT"
          ? Number.isFinite(err.retryAfterSec) && err.retryAfterSec > 0
            ? err.retryAfterSec
            : Math.min(30, 2 ** attempt * 2)
          : Math.min(8, 2 ** attempt);

      await delay((retryAfterSec + 1) * 1000);
      attempt += 1;
    }
  }

  throw new Error("Tron RPC retry exhausted");
}

function isLikelyTxHash(hash) {
  return /^0x[a-fA-F0-9]{64}$/.test(String(hash || "").trim());
}

function normalizeTxHashForRpc(hash) {
  const trimmed = String(hash || "").trim();
  if (/^0x/i.test(trimmed)) {
    return trimmed;
  }
  return `0x${trimmed}`;
}

function getExplorerTxUrl(network, hash) {
  const normalized = String(hash || "").trim();
  if (network === "bsc") {
    return `https://bscscan.com/tx/${normalized}`;
  }
  if (network === "tron") {
    const baseUrl = TRON_EXPLORER_BASE_URLS[TRON_NETWORK].replace("/address/", "/transaction/");
    return `${baseUrl}${normalized.replace(/^0x/i, "")}`;
  }
  return null;
}

async function verifyBscTransaction(hash) {
  const txHash = normalizeTxHashForRpc(hash);
  if (!isLikelyTxHash(txHash)) {
    throw new Error("Invalid transaction hash format");
  }

  const [chainIdHex, latestBlockHex, tx, receipt] = await Promise.all([
    callBscRpcWithRetry("eth_chainId", [], 1),
    callBscRpcWithRetry("eth_blockNumber", [], 1),
    callBscRpcWithRetry("eth_getTransactionByHash", [txHash], 1),
    callBscRpcWithRetry("eth_getTransactionReceipt", [txHash], 1),
  ]);

  if (!tx) {
    return {
      network: "bsc",
      hash: txHash,
      explorerUrl: getExplorerTxUrl("bsc", txHash),
      found: false,
      chainIdHex,
      message: "Transaction hash not found on BSC network",
    };
  }

  const latestBlock = parseInt(latestBlockHex, 16);
  const txBlock = tx.blockNumber ? parseInt(tx.blockNumber, 16) : null;
  const confirmations = txBlock ? Math.max(0, latestBlock - txBlock + 1) : 0;

  return {
    network: "bsc",
    hash: txHash,
    explorerUrl: getExplorerTxUrl("bsc", txHash),
    found: true,
    chainIdHex,
    blockNumber: txBlock,
    confirmations,
    status:
      receipt?.status === "0x1" ? "success" : receipt?.status === "0x0" ? "failed" : "pending",
    from: tx.from || null,
    to: tx.to || null,
    nonce: tx.nonce ? parseInt(tx.nonce, 16) : null,
    valueHex: tx.value || null,
    gasHex: tx.gas || null,
    gasPriceHex: tx.gasPrice || null,
    txIndex: tx.transactionIndex ? parseInt(tx.transactionIndex, 16) : null,
    blockHash: tx.blockHash || null,
    receipt,
  };
}

async function verifyTronTransaction(hash) {
  const txHash = normalizeTxHashForRpc(hash);
  if (!isLikelyTxHash(txHash)) {
    throw new Error("Invalid transaction hash format");
  }

  const [chainIdHex, latestBlockHex, tx, receipt] = await Promise.all([
    callTronRpcWithRetry("eth_chainId", [], 2),
    callTronRpcWithRetry("eth_blockNumber", [], 2),
    callTronRpcWithRetry("eth_getTransactionByHash", [txHash], 2),
    callTronRpcWithRetry("eth_getTransactionReceipt", [txHash], 2),
  ]);

  if (!tx) {
    return {
      chain: "tron",
      network: TRON_NETWORK,
      hash: txHash,
      explorerUrl: getExplorerTxUrl("tron", txHash),
      found: false,
      chainIdHex,
      message: `Transaction hash not found on TRON ${TRON_NETWORK}`,
    };
  }

  const latestBlock = parseInt(latestBlockHex, 16);
  const txBlock = tx.blockNumber ? parseInt(tx.blockNumber, 16) : null;
  const confirmations = txBlock ? Math.max(0, latestBlock - txBlock + 1) : 0;

  return {
    chain: "tron",
    network: TRON_NETWORK,
    hash: txHash,
    explorerUrl: getExplorerTxUrl("tron", txHash),
    found: true,
    chainIdHex,
    blockNumber: txBlock,
    confirmations,
    status:
      receipt?.status === "0x1" ? "success" : receipt?.status === "0x0" ? "failed" : "pending",
    from: tx.from || null,
    to: tx.to || null,
    nonce: tx.nonce ? parseInt(tx.nonce, 16) : null,
    valueHex: tx.value || null,
    gasHex: tx.gas || null,
    gasPriceHex: tx.gasPrice || null,
    txIndex: tx.transactionIndex ? parseInt(tx.transactionIndex, 16) : null,
    blockHash: tx.blockHash || null,
    receipt,
  };
}

async function fetchBscWalletData(address, { force = false } = {}) {
  const cacheKey = address.toLowerCase();
  const cached = bscWalletCache.get(cacheKey);
  if (!force && cached && Date.now() - cached.ts < BSC_WALLET_CACHE_MS) {
    return cached.data;
  }

  const [blockNumberHex, balanceHex, txCountHex] = await Promise.all([
    callBscRpcWithRetry("eth_blockNumber"),
    callBscRpcWithRetry("eth_getBalance", [address, "latest"]),
    callBscRpcWithRetry("eth_getTransactionCount", [address, "latest"]),
  ]);

  const data = {
    address,
    blockNumberHex,
    blockNumber: parseInt(blockNumberHex, 16),
    bnbBalanceHex: balanceHex,
    bnbBalance: weiToBnb(balanceHex),
    nonceHex: txCountHex,
    nonce: parseInt(txCountHex, 16),
  };

  bscWalletCache.set(cacheKey, { ts: Date.now(), data });
  return data;
}

function syncBscBalanceForUser(userId, walletAddress, bscData) {
  const tx = db.transaction(() => {
    setBalance(userId, "BNB", bscData.bnbBalance || 0);
    addTransactionStmt.run(
      userId,
      "BSC_SYNC",
      "BNB",
      bscData.bnbBalance || 0,
      `Synced internal BNB balance from on-chain address ${walletAddress}`,
      walletAddress
    );
  });

  tx();
}

function syncSolanaBalanceForUser(userId, walletAddress, solData) {
  const tx = db.transaction(() => {
    setBalance(userId, "SOL", solData.balanceSOL);
    addTransactionStmt.run(
      userId,
      "SOLANA_SYNC",
      "SOL",
      solData.balanceSOL,
      `Synced internal SOL balance from on-chain address ${walletAddress}`,
      walletAddress
    );
  });

  tx();
}

function isTatumPlanLimitError(err) {
  return err && err.code === "TATUM_PLAN_LIMIT";
}

function mapSolanaRpcError(err) {
  if (!err) {
    return { code: "SOLANA_UNKNOWN", message: "Unknown Solana RPC error" };
  }

  const message = String(err.message || "Solana RPC request failed");

  if (/unauthorized|forbidden|api key|authentication|missing/i.test(message)) {
    return {
      code: "TATUM_AUTH",
      message: "Solana gateway authentication failed. Set SOLANA_RPC_API_KEY or TATUM_API_KEY.",
    };
  }

  if (/exceeded your limit|too many requests|429/i.test(message)) {
    return { code: "TATUM_RATE_LIMIT", message };
  }

  if (
    /paid plans only|upgrade your subscription|not available for anonymous access|co\.tatum\.io\/signup/i.test(
      message
    )
  ) {
    return { code: "TATUM_PLAN_LIMIT", message };
  }

  if (/ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|network/i.test(message)) {
    return {
      code: "TATUM_TRANSIENT",
      message: "Solana gateway temporarily unavailable. Please retry.",
    };
  }

  return { code: "SOLANA_ERROR", message };
}

async function fetchSolanaAddressData(address, limit = 10) {
  let lamports = null;
  let sol = null;
  let balanceUnavailableReason = null;
  let signatures;

  try {
    const balanceResult = await callSolanaRpc("getBalance", [address, { commitment: "confirmed" }]);
    lamports = Number(balanceResult?.value || 0);
    sol = roundCrypto(lamports / 1_000_000_000);
  } catch (err) {
    if (isTatumPlanLimitError(err)) {
      balanceUnavailableReason = err.message;
    } else {
      throw err;
    }
  }

  try {
    const signaturesResult = await callSolanaRpc("getSignaturesForAddress", [address, { limit }]);
    signatures = Array.isArray(signaturesResult)
      ? signaturesResult.map((item) => ({
          signature: item.signature,
          slot: item.slot,
          err: item.err,
          blockTime: item.blockTime,
        }))
      : [];
  } catch (err) {
    if (isTatumPlanLimitError(err)) {
      if (!balanceUnavailableReason) {
        balanceUnavailableReason = err.message;
      }
      signatures = [];
    } else {
      throw err;
    }
  }

  return {
    address,
    balanceLamports: lamports,
    balanceSOL: sol,
    balanceAvailable: sol !== null,
    balanceUnavailableReason,
    signatures,
  };
}

async function probeBscGateway() {
  try {
    const blockHex = await callBscRpcWithRetry("eth_blockNumber", [], 1);
    return {
      ok: true,
      status: "ok",
      blockNumber: parseInt(blockHex, 16),
      detail: "BSC gateway reachable",
    };
  } catch (err) {
    if (err.code === "TATUM_AUTH") {
      return {
        ok: false,
        status: "auth-error",
        detail: "API key invalid or missing for BSC gateway",
      };
    }

    if (err.code === "TATUM_RATE_LIMIT") {
      return {
        ok: false,
        status: "rate-limited",
        detail: err.message,
      };
    }

    if (err.code === "TATUM_TRANSIENT") {
      return {
        ok: false,
        status: "unavailable",
        detail: "Temporary BSC gateway/network issue",
      };
    }

    return {
      ok: false,
      status: "error",
      detail: err.message || "BSC probe failed",
    };
  }
}

async function probeSolanaGateway() {
  try {
    const result = await callSolanaRpc("getHealth", []);
    return {
      ok: true,
      status: "ok",
      detail: String(result || "ok"),
    };
  } catch (err) {
    if (isTatumPlanLimitError(err)) {
      return {
        ok: false,
        status: "plan-limited",
        detail: err.message,
      };
    }

    const mapped = mapSolanaRpcError(err);

    if (mapped.code === "TATUM_AUTH") {
      return {
        ok: false,
        status: "auth-error",
        detail: mapped.message,
      };
    }

    if (mapped.code === "TATUM_RATE_LIMIT") {
      return {
        ok: false,
        status: "rate-limited",
        detail: mapped.message,
      };
    }

    if (mapped.code === "TATUM_TRANSIENT") {
      return {
        ok: false,
        status: "unavailable",
        detail: mapped.message,
      };
    }

    return {
      ok: false,
      status: "error",
      detail: mapped.message || "Solana probe failed",
    };
  }
}

async function probeTronGateway() {
  try {
    // Use the tronService to get current block
    const blockData = await tronService.getCurrentBlockViaTatum();

    // Handle rate limiting (null return)
    if (blockData === null) {
      return {
        ok: true,
        status: "rate-limited",
        blockNumber: "rate-limited",
        network: TRON_NETWORK,
        detail: `TRON ${TRON_NETWORK} gateway rate-limited but operational`,
      };
    }

    const blockNumber = blockData?.block_header?.raw_data?.number;

    return {
      ok: true,
      status: "ok",
      blockNumber: blockNumber || "unknown",
      network: TRON_NETWORK,
      detail: `TRON ${TRON_NETWORK} gateway reachable`,
    };
  } catch (err) {
    const message = err.response?.data?.message || err.message || "Unknown error";

    if (
      err.response?.status === 401 ||
      err.response?.status === 403 ||
      /unauthorized|forbidden|api key|authentication|missing/i.test(message)
    ) {
      return {
        ok: false,
        status: "auth-error",
        detail: "API key invalid or missing for TRON gateway",
      };
    }

    if (err.response?.status === 429 || /exceeded your limit|too many requests/i.test(message)) {
      return {
        ok: false,
        status: "rate-limited",
        detail: message,
      };
    }

    if (
      /ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|network/i.test(
        `${err.code || ""} ${message}`
      )
    ) {
      return {
        ok: false,
        status: "unavailable",
        detail: "Temporary TRON gateway/network issue",
      };
    }

    return {
      ok: false,
      status: "error",
      detail: message,
    };
  }
}

const app = express();
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://cdn.socket.io", "https://cdn.jsdelivr.net"],
        connectSrc: ["'self'", "ws:", "wss:"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  })
);
app.use(
  cors({
    origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan("dev"));
app.use(express.static(path.join(__dirname, "..", "public")));

// Records per-request timing/error metrics via the advanced monitoring utilities
app.use((req, res, next) => {
  const timerKey = `${req.method}:${req.originalUrl}:${Date.now()}:${Math.random()}`;
  performanceMonitor.startTimer(timerKey);
  res.on("finish", () => {
    const duration = performanceMonitor.endTimer(timerKey);
    metricsCollector.recordRequest(duration);
    if (res.statusCode >= 500) {
      metricsCollector.recordError();
    }
  });
  next();
});

app.get("/api/chart/series", auth, async (req, res, next) => {
  try {
    const symbol = normalizeCurrencyCode(req.query.symbol || "BTC");
    const intervalKey = String(req.query.interval || "1h").toLowerCase();

    if (!SUPPORTED_CODES.includes(symbol) && !findDexTokenBySymbolStmt.get(symbol)) {
      return res.status(400).json({ error: "Unknown chart symbol" });
    }

    const cacheKey = `chart-series:${symbol}:${intervalKey}`;
    const cached = advancedCacheManager.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    const rates = await fetchRatesUSD();
    const basePrice = SUPPORTED_CODES.includes(symbol)
      ? Number(rates[symbol] || 1)
      : Number(rates.USDT || 1);

    let chartPayload = null;
    if (SUPPORTED_CODES.includes(symbol)) {
      try {
        chartPayload = await fetchTatumOhlcvSeries(symbol, intervalKey);
      } catch (err) {
        if (!["TATUM_AUTH", "TATUM_RATE_LIMIT"].includes(err.code)) {
          chartPayload = null;
        } else {
          throw err;
        }
      }
    }

    const fallbackPayload = buildChartSeries(basePrice, intervalKey);
    const points = chartPayload?.points?.length ? chartPayload.points : fallbackPayload.points;

    const payload = {
      symbol,
      basePrice,
      interval: intervalKey,
      intervalLabel: getIntervalByKey(intervalKey).label,
      points,
      source: chartPayload ? chartPayload.source : "synthetic-fallback",
      providerInterval: chartPayload?.providerInterval || null,
      availableIntervals: getChartIntervals(),
    };
    advancedCacheManager.set(cacheKey, payload, 30000);
    res.json(payload);
  } catch (err) {
    if (err.code === "TATUM_AUTH") {
      return res.status(401).json({
        error: "Tatum market data authentication failed. Set TATUM_DATA_API_KEY or TATUM_API_KEY.",
      });
    }
    if (err.code === "TATUM_RATE_LIMIT") {
      return res
        .status(429)
        .json({ error: err.message || "Tatum market data rate limit exceeded" });
    }
    next(err);
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: APP_NAME, service: APP_SERVICE_NAME });
});

app.get("/api/assistant/status", auth, (_req, res) => {
  res.json({ assistant: assistantService.getStatus() });
});

app.post("/api/assistant/chat", auth, async (req, res) => {
  try {
    const messages = req.body?.messages;
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 20) {
      return res.status(400).json({ error: "Provide between 1 and 20 assistant messages" });
    }

    const context = {
      username: req.user.username,
      balances: Object.fromEntries(
        listBalancesStmt.all(req.user.id).map((balance) => [balance.currency, balance.balance])
      ),
    };
    const result = await assistantService.reply(messages, context);
    return res.json({ ...result, assistant: assistantService.getStatus() });
  } catch (error) {
    return res.status(502).json({ error: error.message || "Assistant unavailable" });
  }
});

app.get("/api/port-status", (_req, res) => {
  res.json({
    name: APP_NAME,
    service: APP_SERVICE_NAME,
    port: PORT,
    host: "localhost",
    baseUrl: `http://localhost:${PORT}`,
  });
});

app.get("/api/email/status", auth, (_req, res) => {
  res.json({
    email: emailService.getStatus(),
  });
});

app.post("/api/email/verify", auth, async (_req, res) => {
  const verification = await emailService.verifyConnection();
  res.status(verification.ok ? 200 : 503).json({
    email: emailService.getStatus(),
    verification,
  });
});

app.post("/api/email/test", auth, async (req, res) => {
  const verification = await emailService.verifyConnection();
  if (!verification.ok) {
    return res.status(503).json({ error: verification.error, verification });
  }

  const sent = await emailService.sendEmail({
    to: req.user.email,
    subject: "ERC MailRCLD SMTP test",
    text: `Your ERC MailRCLD SMTP integration is working. Sent at ${new Date().toISOString()}.`,
  });

  if (!sent) {
    return res.status(502).json({
      error:
        emailService.getLastError() || "SMTP accepted the connection but the test email failed",
    });
  }

  return res.json({ sent: true, recipient: req.user.email });
});

function sendHardhatError(res, error) {
  const statusCode = Number(error.statusCode) || 500;
  return res.status(statusCode).json({
    error: statusCode >= 500 && statusCode !== 503 ? "Hardhat operation failed" : error.message,
  });
}

app.get("/api/hardhat/status", auth, async (_req, res) => {
  res.json(await hardhatService.getStatus());
});

app.post("/api/hardhat/compile", auth, async (_req, res) => {
  if (NODE_ENV === "production") {
    return res.status(403).json({ error: "Contract compilation is disabled in production" });
  }

  try {
    const compilation = await hardhatService.compile();
    return res.json({ compilation, status: await hardhatService.getStatus() });
  } catch (error) {
    return sendHardhatError(res, error);
  }
});

app.post("/api/hardhat/deploy", auth, async (_req, res) => {
  try {
    const deployment = await hardhatService.deploy();
    return res.status(201).json({ deployment });
  } catch (error) {
    return sendHardhatError(res, error);
  }
});

app.get("/api/hardhat/assets", auth, async (_req, res) => {
  try {
    return res.json(await hardhatService.listAssets());
  } catch (error) {
    return sendHardhatError(res, error);
  }
});

app.get("/api/hardhat/contracts", auth, async (_req, res) => {
  try {
    return res.json(await hardhatService.listAssets());
  } catch (error) {
    return sendHardhatError(res, error);
  }
});

app.get("/api/hardhat/accounts", auth, async (_req, res) => {
  try {
    const node = await hardhatService.getNodeStatus();
    return res.json({ accounts: node.accounts || [] });
  } catch (error) {
    return sendHardhatError(res, error);
  }
});

app.post(
  "/api/hardhat/assets",
  auth,
  [
    body("symbol")
      .isString()
      .trim()
      .isLength({ min: 1, max: 12 })
      .matches(/^[A-Za-z0-9._-]+$/),
    body("name").isString().trim().isLength({ min: 1, max: 80 }),
    body("metadataUri").optional({ values: "falsy" }).isString().trim().isLength({ max: 240 }),
  ],
  validate,
  async (req, res) => {
    try {
      const result = await hardhatService.registerAsset({
        symbol: req.body.symbol.toUpperCase(),
        name: req.body.name,
        metadataUri: req.body.metadataUri || "",
      });
      return res.status(201).json(result);
    } catch (error) {
      return sendHardhatError(res, error);
    }
  }
);

app.get("/api/plugin/endpoints", (_req, res) => {
  res.json({
    endpoints: [
      {
        key: "health",
        label: "/api/health",
        category: "system",
        description: "Basic service heartbeat",
        method: "GET",
        route: "/api/health",
        requiresAuth: false,
      },
      {
        key: "port-status",
        label: "/api/port-status",
        category: "system",
        description: "Current host and port details",
        method: "GET",
        route: "/api/port-status",
        requiresAuth: false,
      },
      {
        key: "email-status",
        label: "/api/email/status",
        category: "system",
        description: "Email service configuration and status",
        method: "GET",
        route: "/api/email/status",
        requiresAuth: true,
      },
      {
        key: "email-verify",
        label: "/api/email/verify",
        category: "system",
        description: "Verify MailRCLD SMTP authentication and transport readiness",
        method: "POST",
        route: "/api/email/verify",
        requiresAuth: true,
      },
      {
        key: "email-test",
        label: "/api/email/test",
        category: "system",
        description: "Send a MailRCLD test message to the authenticated user",
        method: "POST",
        route: "/api/email/test",
        requiresAuth: true,
      },
      {
        key: "setup-status",
        label: "/api/setup/status",
        category: "diagnostics",
        description: "Gateway and environment readiness checks",
        method: "GET",
        route: "/api/setup/status",
        requiresAuth: true,
      },
      {
        key: "hardhat-status",
        label: "/api/hardhat/status",
        category: "hardhat",
        description: "Local Hardhat node, compiler artifact, and deployment readiness",
        method: "GET",
        route: "/api/hardhat/status",
        requiresAuth: true,
      },
      {
        key: "hardhat-compile",
        label: "/api/hardhat/compile",
        category: "hardhat",
        description: "Compile the ERC asset registry workspace in development",
        method: "POST",
        route: "/api/hardhat/compile",
        requiresAuth: true,
      },
      {
        key: "hardhat-deploy",
        label: "/api/hardhat/deploy",
        category: "hardhat",
        description: "Deploy the ERC asset registry to the configured local Hardhat node",
        method: "POST",
        route: "/api/hardhat/deploy",
        requiresAuth: true,
      },
      {
        key: "hardhat-assets",
        label: "/api/hardhat/assets",
        category: "hardhat",
        description: "List assets stored in the active local registry deployment",
        method: "GET",
        route: "/api/hardhat/assets",
        requiresAuth: true,
      },
      {
        key: "hardhat-register-asset",
        label: "/api/hardhat/assets",
        category: "hardhat",
        description: "Register validated asset metadata in the local registry",
        method: "POST",
        route: "/api/hardhat/assets",
        requiresAuth: true,
      },
      {
        key: "rates",
        label: "/api/rates",
        category: "market",
        description: "Live market rates used by exchange",
        method: "GET",
        route: "/api/rates",
        requiresAuth: true,
      },
      {
        key: "rates-price-change",
        label: "/api/rates/price-change?interval=1d",
        category: "market",
        description: "Batch price-change feed from Tatum market data API",
        method: "GET",
        route: "/api/rates/price-change?interval=1d",
        requiresAuth: true,
      },
      {
        key: "balances",
        label: "/api/wallet/balances",
        category: "wallet",
        description: "Internal ledger balances by currency",
        method: "GET",
        route: "/api/wallet/balances",
        requiresAuth: true,
      },
      {
        key: "transactions",
        label: "/api/transactions?limit=10",
        category: "wallet",
        description: "Recent wallet and exchange transactions",
        method: "GET",
        route: "/api/transactions?limit=10",
        requiresAuth: true,
      },
      {
        key: "bsc-block",
        label: "/api/bsc/block-number",
        category: "bsc",
        description: "Latest BSC block via Tatum gateway",
        method: "GET",
        route: "/api/bsc/block-number",
        requiresAuth: true,
      },
      {
        key: "tron-block",
        label: "/api/tron/block-number",
        category: "tron",
        description: "Latest Tron block via Tatum gateway",
        method: "GET",
        route: "/api/tron/block-number",
        requiresAuth: true,
      },
      {
        key: "tron-tatum-current-block",
        label: "/api/tron/tatum/current-block",
        category: "tron",
        description: "Get current TRON block using Tatum API",
        method: "GET",
        route: "/api/tron/tatum/current-block",
        requiresAuth: true,
      },
      {
        key: "tron-tatum-balance",
        label: "/api/tron/tatum/balance/:address",
        category: "tron",
        description: "Get TRON account balance via Tatum API",
        method: "GET",
        route: "/api/tron/tatum/balance/:address",
        requiresAuth: true,
      },
      {
        key: "tron-tatum-transaction",
        label: "/api/tron/tatum/transaction/:txId",
        category: "tron",
        description: "Get TRON transaction details via Tatum API",
        method: "GET",
        route: "/api/tron/tatum/transaction/:txId",
        requiresAuth: true,
      },
      {
        key: "tron-tatum-block-by-number",
        label: "/api/tron/tatum/block-by-number",
        category: "tron",
        description: "Get TRON block by number via Tatum API",
        method: "POST",
        route: "/api/tron/tatum/block-by-number",
        requiresAuth: true,
      },
      {
        key: "tron-tatum-validate",
        label: "/api/tron/tatum/validate-address",
        category: "tron",
        description: "Validate TRON address via Tatum API",
        method: "POST",
        route: "/api/tron/tatum/validate-address",
        requiresAuth: true,
      },
      {
        key: "verify-tx",
        label: "/api/network/verify-transaction",
        category: "verification",
        description: "Verify transaction hash on BSC or Tron and return explorer link",
        method: "POST",
        route: "/api/network/verify-transaction",
        requiresAuth: true,
      },
      {
        key: "solana-wallet",
        label: "/api/solana/wallet?limit=5",
        category: "solana",
        description: "Imported Solana wallet on-chain snapshot",
        method: "GET",
        route: "/api/solana/wallet?limit=5",
        requiresAuth: true,
        requiresSolanaWallet: true,
      },
      {
        key: "bsc-wallet",
        label: "/api/bsc/wallet",
        category: "bsc",
        description: "Imported BSC wallet on-chain snapshot",
        method: "GET",
        route: "/api/bsc/wallet",
        requiresAuth: true,
        requiresBscWallet: true,
      },
      {
        key: "sync-sol",
        label: "/api/solana/sync-sol-balance",
        category: "solana",
        description: "Sync SOL on-chain balance to internal ledger",
        method: "POST",
        route: "/api/solana/sync-sol-balance",
        requiresAuth: true,
        requiresSolanaWallet: true,
        refreshAfter: true,
      },
      {
        key: "sync-bnb",
        label: "/api/bsc/sync-bnb-balance",
        category: "bsc",
        description: "Sync BNB on-chain balance to internal ledger",
        method: "POST",
        route: "/api/bsc/sync-bnb-balance",
        requiresAuth: true,
        requiresBscWallet: true,
        refreshAfter: true,
      },
      {
        key: "onchain-setup",
        label: "/api/onchain/setup-status",
        category: "onchain",
        description: "Verify imported wallets and gateway readiness for on-chain flows",
        method: "GET",
        route: "/api/onchain/setup-status",
        requiresAuth: true,
        refreshAfter: true,
      },
      {
        key: "onchain-sync-all",
        label: "/api/onchain/sync-all",
        category: "onchain",
        description: "Sync all imported on-chain balances to internal ledger",
        method: "POST",
        route: "/api/onchain/sync-all",
        requiresAuth: true,
        refreshAfter: true,
      },
      {
        key: "dex-tokens",
        label: "/api/dex/tokens",
        category: "dex",
        description: "List launched DEX tokens",
        method: "GET",
        route: "/api/dex/tokens",
        requiresAuth: true,
      },
      {
        key: "dex-pools",
        label: "/api/dex/pools",
        category: "dex",
        description: "List DEX liquidity pools",
        method: "GET",
        route: "/api/dex/pools",
        requiresAuth: true,
      },
      {
        key: "dex-launch-token",
        label: "/api/dex/tokens",
        category: "dex",
        description: "Launch a custom token into internal ledger",
        method: "POST",
        route: "/api/dex/tokens",
        requiresAuth: true,
        refreshAfter: true,
      },
      {
        key: "dex-create-pool",
        label: "/api/dex/pools",
        category: "dex",
        description: "Create liquidity pool for token pair",
        method: "POST",
        route: "/api/dex/pools",
        requiresAuth: true,
        refreshAfter: true,
      },
      {
        key: "dex-swap",
        label: "/api/dex/swap",
        category: "dex",
        description: "Swap token through AMM pool",
        method: "POST",
        route: "/api/dex/swap",
        requiresAuth: true,
        refreshAfter: true,
      },
      {
        key: "exchange-quote",
        label: "/api/exchange/quote",
        category: "exchange",
        description: "Preview market or DEX exchange route with slippage protection",
        method: "POST",
        route: "/api/exchange/quote",
        requiresAuth: true,
      },
      {
        key: "exchange-orders",
        label: "/api/exchange/orders",
        category: "exchange",
        description: "List conditional exchange orders",
        method: "GET",
        route: "/api/exchange/orders",
        requiresAuth: true,
      },
      {
        key: "exchange-orders-process",
        label: "/api/exchange/orders/process",
        category: "exchange",
        description: "Process and execute open conditional exchange orders",
        method: "POST",
        route: "/api/exchange/orders/process",
        requiresAuth: true,
        refreshAfter: true,
      },
      {
        key: "payment-terminal-initialize",
        label: "/api/payment-terminal/initialize",
        category: "payments",
        description: "Initialize the authenticated user's EMV payment terminal",
        method: "POST",
        route: "/api/payment-terminal/initialize",
        requiresAuth: true,
      },
      {
        key: "payment-terminal-status",
        label: "/api/payment-terminal/status",
        category: "payments",
        description: "Get terminal status and today's durable transaction count",
        method: "GET",
        route: "/api/payment-terminal/status",
        requiresAuth: true,
      },
      {
        key: "payment-terminal-process",
        label: "/api/payment-terminal/process",
        category: "payments",
        description: "Process a validated EMV card or mobile-wallet payment",
        method: "POST",
        route: "/api/payment-terminal/process",
        requiresAuth: true,
        refreshAfter: true,
      },
      {
        key: "payment-terminal-transactions",
        label: "/api/payment-terminal/transactions",
        category: "payments",
        description: "List the authenticated user's durable masked payment history",
        method: "GET",
        route: "/api/payment-terminal/transactions",
        requiresAuth: true,
      },
      // ==================== CRYPTO DATA SERVICE ENDPOINTS ====================
      {
        key: "crypto-coins-list",
        label: "/api/crypto/coins-list",
        category: "crypto-data",
        description: "Get complete list of all supported cryptocurrencies",
        method: "GET",
        route: "/api/crypto/coins-list",
        requiresAuth: true,
      },
      {
        key: "crypto-supported-currencies",
        label: "/api/crypto/supported-currencies",
        category: "crypto-data",
        description: "Get list of supported vs currencies for price conversion",
        method: "GET",
        route: "/api/crypto/supported-currencies",
        requiresAuth: true,
      },
      {
        key: "crypto-historical-price",
        label: "/api/crypto/historical-price/:id",
        category: "crypto-data",
        description: "Get historical price for specific coin on a given date",
        method: "GET",
        route: "/api/crypto/historical-price/:id",
        requiresAuth: true,
      },
      {
        key: "crypto-markets",
        label: "/api/crypto/markets",
        category: "crypto-data",
        description: "Get paginated market data for multiple cryptocurrencies",
        method: "GET",
        route: "/api/crypto/markets",
        requiresAuth: true,
      },
      {
        key: "crypto-convert",
        label: "/api/crypto/convert",
        category: "crypto-data",
        description: "Convert currency amounts between different cryptocurrencies",
        method: "POST",
        route: "/api/crypto/convert",
        requiresAuth: true,
      },
      // ==================== ETHEREUM SERVICE ENDPOINTS ====================
      {
        key: "ethereum-transaction-receipt",
        label: "/api/ethereum/transaction-receipt/:hash",
        category: "ethereum",
        description: "Get Ethereum transaction receipt by hash",
        method: "GET",
        route: "/api/ethereum/transaction-receipt/:hash",
        requiresAuth: true,
      },
      {
        key: "ethereum-estimate-gas",
        label: "/api/ethereum/estimate-gas",
        category: "ethereum",
        description: "Estimate gas required for Ethereum transaction",
        method: "POST",
        route: "/api/ethereum/estimate-gas",
        requiresAuth: true,
      },
      {
        key: "ethereum-call-contract",
        label: "/api/ethereum/call-contract",
        category: "ethereum",
        description: "Call Ethereum smart contract method (read-only)",
        method: "POST",
        route: "/api/ethereum/call-contract",
        requiresAuth: true,
      },
      {
        key: "ethereum-execute-contract",
        label: "/api/ethereum/execute-contract",
        category: "ethereum",
        description: "Execute Ethereum smart contract transaction",
        method: "POST",
        route: "/api/ethereum/execute-contract",
        requiresAuth: true,
      },
      // ==================== BSC SERVICE ENDPOINTS ====================
      {
        key: "bsc-transaction-receipt",
        label: "/api/bsc/transaction-receipt/:hash",
        category: "bsc",
        description: "Get BSC transaction receipt by hash",
        method: "GET",
        route: "/api/bsc/transaction-receipt/:hash",
        requiresAuth: true,
      },
      {
        key: "bsc-estimate-gas",
        label: "/api/bsc/estimate-gas",
        category: "bsc",
        description: "Estimate gas required for BSC transaction",
        method: "POST",
        route: "/api/bsc/estimate-gas",
        requiresAuth: true,
      },
      {
        key: "bsc-call-contract",
        label: "/api/bsc/call-contract",
        category: "bsc",
        description: "Call BSC smart contract method (read-only)",
        method: "POST",
        route: "/api/bsc/call-contract",
        requiresAuth: true,
      },
      {
        key: "bsc-execute-contract",
        label: "/api/bsc/execute-contract",
        category: "bsc",
        description: "Execute BSC smart contract transaction",
        method: "POST",
        route: "/api/bsc/execute-contract",
        requiresAuth: true,
      },
      {
        key: "bsc-token-balance",
        label: "/api/bsc/token-balance",
        category: "bsc",
        description: "Get BEP20 token balance for wallet address",
        method: "GET",
        route: "/api/bsc/token-balance",
        requiresAuth: true,
      },
      {
        key: "bsc-token-info",
        label: "/api/bsc/token-info/:address",
        category: "bsc",
        description: "Get BEP20 token information by contract address",
        method: "GET",
        route: "/api/bsc/token-info/:address",
        requiresAuth: true,
      },
      {
        key: "bsc-gas-price",
        label: "/api/bsc/gas-price",
        category: "bsc",
        description: "Get current BSC gas price in Gwei",
        method: "GET",
        route: "/api/bsc/gas-price",
        requiresAuth: true,
      },
      // ==================== SOLANA SERVICE ENDPOINTS ====================
      {
        key: "solana-account-info",
        label: "/api/solana/account-info/:address",
        category: "solana",
        description: "Get Solana account information by address",
        method: "GET",
        route: "/api/solana/account-info/:address",
        requiresAuth: true,
      },
      {
        key: "solana-signature-status",
        label: "/api/solana/signature-status/:signature",
        category: "solana",
        description: "Get Solana transaction signature status",
        method: "GET",
        route: "/api/solana/signature-status/:signature",
        requiresAuth: true,
      },
      {
        key: "solana-recent-blockhash",
        label: "/api/solana/recent-blockhash",
        category: "solana",
        description: "Get most recent Solana blockhash",
        method: "GET",
        route: "/api/solana/recent-blockhash",
        requiresAuth: true,
      },
      {
        key: "solana-airdrop",
        label: "/api/solana/airdrop",
        category: "solana",
        description: "Request SOL airdrop (devnet/testnet only)",
        method: "POST",
        route: "/api/solana/airdrop",
        requiresAuth: true,
      },
      {
        key: "solana-transaction-fee",
        label: "/api/solana/transaction-fee",
        category: "solana",
        description: "Calculate Solana transaction fee in lamports",
        method: "POST",
        route: "/api/solana/transaction-fee",
        requiresAuth: true,
      },
      {
        key: "solana-epoch-info",
        label: "/api/solana/epoch-info",
        category: "solana",
        description: "Get current Solana epoch information",
        method: "GET",
        route: "/api/solana/epoch-info",
        requiresAuth: true,
      },
      {
        key: "solana-performance-samples",
        label: "/api/solana/performance-samples",
        category: "solana",
        description: "Get recent Solana network performance samples",
        method: "GET",
        route: "/api/solana/performance-samples",
        requiresAuth: true,
      },
      {
        key: "solana-token-balance",
        label: "/api/solana/token-balance",
        category: "solana",
        description: "Get SPL token balance for wallet address",
        method: "GET",
        route: "/api/solana/token-balance",
        requiresAuth: true,
      },
      // ==================== TRON SERVICE ENDPOINTS ====================
      {
        key: "tron-transaction-info",
        label: "/api/tron/transaction-info/:hash",
        category: "tron",
        description: "Get detailed TRON transaction information",
        method: "GET",
        route: "/api/tron/transaction-info/:hash",
        requiresAuth: true,
      },
      {
        key: "tron-bandwidth",
        label: "/api/tron/bandwidth/:address",
        category: "tron",
        description: "Get TRON account bandwidth information",
        method: "GET",
        route: "/api/tron/bandwidth/:address",
        requiresAuth: true,
      },
      {
        key: "tron-account-resources",
        label: "/api/tron/account-resources/:address",
        category: "tron",
        description: "Get TRON account energy and bandwidth resources",
        method: "GET",
        route: "/api/tron/account-resources/:address",
        requiresAuth: true,
      },
      {
        key: "tron-sign-message",
        label: "/api/tron/sign-message",
        category: "tron",
        description: "Sign message with TRON private key",
        method: "POST",
        route: "/api/tron/sign-message",
        requiresAuth: true,
      },
      {
        key: "tron-verify-signature",
        label: "/api/tron/verify-signature",
        category: "tron",
        description: "Verify TRON message signature",
        method: "POST",
        route: "/api/tron/verify-signature",
        requiresAuth: true,
      },
      {
        key: "tron-call-contract",
        label: "/api/tron/call-contract",
        category: "tron",
        description: "Call TRON smart contract method (read-only)",
        method: "POST",
        route: "/api/tron/call-contract",
        requiresAuth: true,
      },
      {
        key: "tron-execute-contract",
        label: "/api/tron/execute-contract",
        category: "tron",
        description: "Execute TRON smart contract transaction",
        method: "POST",
        route: "/api/tron/execute-contract",
        requiresAuth: true,
      },
      {
        key: "tron-jsonrpc-call",
        label: "/api/tron/jsonrpc-call",
        category: "tron",
        description: "Make custom TRON JSON-RPC call",
        method: "POST",
        route: "/api/tron/jsonrpc-call",
        requiresAuth: true,
      },
      {
        key: "tron-wallet-solidity-query",
        label: "/api/tron/wallet-solidity-query",
        category: "tron",
        description: "Query TRON wallet solidity endpoint",
        method: "POST",
        route: "/api/tron/wallet-solidity-query",
        requiresAuth: true,
      },
      // ==================== WEBSOCKET SERVICE ENDPOINTS ====================
      {
        key: "websocket-clients",
        label: "/api/websocket/clients",
        category: "websocket",
        description: "Get list of connected WebSocket clients",
        method: "GET",
        route: "/api/websocket/clients",
        requiresAuth: true,
      },
      {
        key: "websocket-broadcast",
        label: "/api/websocket/broadcast",
        category: "websocket",
        description: "Broadcast message to WebSocket channel",
        method: "POST",
        route: "/api/websocket/broadcast",
        requiresAuth: true,
      },
      {
        key: "websocket-send-to-user",
        label: "/api/websocket/send-to-user",
        category: "websocket",
        description: "Send WebSocket message to specific user",
        method: "POST",
        route: "/api/websocket/send-to-user",
        requiresAuth: true,
      },
      // ==================== QR CODE ENDPOINTS ====================
      {
        key: "qrcode-generate",
        label: "/api/qrcode/generate",
        category: "utilities",
        description: "Generate QR code for crypto address (all chains)",
        method: "GET",
        route: "/api/qrcode/generate?address=&chain=",
        requiresAuth: true,
      },
      // ==================== AI TRADING BOT ENDPOINTS ====================
      {
        key: "bot-create",
        label: "/api/bot/create",
        category: "trading-bot",
        description: "Create new AI trading bot",
        method: "POST",
        route: "/api/bot/create",
        requiresAuth: true,
      },
      {
        key: "bot-start",
        label: "/api/bot/:botId/start",
        category: "trading-bot",
        description: "Start trading bot",
        method: "POST",
        route: "/api/bot/:botId/start",
        requiresAuth: true,
      },
      {
        key: "bot-stop",
        label: "/api/bot/:botId/stop",
        category: "trading-bot",
        description: "Stop trading bot",
        method: "POST",
        route: "/api/bot/:botId/stop",
        requiresAuth: true,
      },
      {
        key: "bot-status",
        label: "/api/bot/:botId/status",
        category: "trading-bot",
        description: "Get bot status",
        method: "GET",
        route: "/api/bot/:botId/status",
        requiresAuth: true,
      },
      {
        key: "bot-list",
        label: "/api/bot/list",
        category: "trading-bot",
        description: "List all user bots",
        method: "GET",
        route: "/api/bot/list",
        requiresAuth: true,
      },
      {
        key: "bot-delete",
        label: "/api/bot/:botId",
        category: "trading-bot",
        description: "Delete bot",
        method: "DELETE",
        route: "/api/bot/:botId",
        requiresAuth: true,
      },
      {
        key: "bot-performance",
        label: "/api/bot/:botId/performance",
        category: "trading-bot",
        description: "Get bot performance metrics",
        method: "GET",
        route: "/api/bot/:botId/performance",
        requiresAuth: true,
      },
      {
        key: "bot-trades",
        label: "/api/bot/:botId/trades",
        category: "trading-bot",
        description: "Get bot trade history",
        method: "GET",
        route: "/api/bot/:botId/trades",
        requiresAuth: true,
      },
      {
        key: "bot-positions",
        label: "/api/bot/:botId/positions",
        category: "trading-bot",
        description: "Get bot open positions",
        method: "GET",
        route: "/api/bot/:botId/positions",
        requiresAuth: true,
      },
      {
        key: "bot-strategies",
        label: "/api/bot/strategies",
        category: "trading-bot",
        description: "Get available trading strategies",
        method: "GET",
        route: "/api/bot/strategies",
        requiresAuth: true,
      },
    ],
  });
});

app.get("/api/plugin/custom-endpoints", auth, (req, res) => {
  const rows = listUserPluginEndpointsStmt.all(req.user.id).map((row) => ({
    key: row.api_key,
    label: row.label,
    method: String(row.method || "GET").toUpperCase(),
    route: row.route,
    category: row.category || "custom",
    description: row.description || "",
    requiresAuth: Boolean(row.requires_auth),
    isCustom: true,
  }));

  res.json({ endpoints: rows });
});

app.post(
  "/api/plugin/custom-endpoints",
  [
    body("key").isString().trim().isLength({ min: 2, max: 40 }),
    body("label").isString().trim().isLength({ min: 2, max: 120 }),
    body("method").isIn(["GET", "POST"]),
    body("route").isString().trim().isLength({ min: 2, max: 200 }),
    body("category").optional().isString().trim().isLength({ max: 40 }),
    body("description").optional().isString().trim().isLength({ max: 240 }),
    body("requiresAuth").optional().isBoolean(),
  ],
  validate,
  auth,
  (req, res) => {
    const key = req.body.key.trim();
    const label = req.body.label.trim();
    const method = String(req.body.method).toUpperCase();
    const route = req.body.route.trim();
    const category = req.body.category ? req.body.category.trim() : "custom";
    const description = req.body.description ? req.body.description.trim() : "";
    const requiresAuth = req.body.requiresAuth === false ? 0 : 1;

    if (!/^\/?api\//i.test(route.replace(/^\//, ""))) {
      return res.status(400).json({ error: "Route must start with /api/" });
    }

    upsertUserPluginEndpointStmt.run(
      req.user.id,
      key,
      label,
      method,
      route,
      category,
      description,
      requiresAuth
    );

    return res.json({ message: "Custom plugin API saved", key });
  }
);

app.delete("/api/plugin/custom-endpoints/:key", auth, (req, res) => {
  const key = String(req.params.key || "").trim();
  if (!key) {
    return res.status(400).json({ error: "Missing custom endpoint key" });
  }

  const result = deleteUserPluginEndpointStmt.run(req.user.id, key);
  if (result.changes === 0) {
    return res.status(404).json({ error: "Custom plugin endpoint not found" });
  }

  return res.json({ message: "Custom plugin API removed", key });
});

app.post(
  "/api/auth/register",
  rateLimiters.auth,
  [
    body("username").isString().trim().isLength({ min: 3, max: 24 }),
    body("email").isEmail().normalizeEmail(),
    body("password").isString().isLength({ min: 8 }),
  ],
  validate,
  async (req, res) => {
    const username = req.body.username.trim();
    const email = req.body.email.trim().toLowerCase();
    const password = req.body.password;

    if (findUserByEmailStmt.get(email)) {
      return res.status(409).json({ error: "Email already in use" });
    }

    if (findUserByUsernameStmt.get(username)) {
      return res.status(409).json({ error: "Username already in use" });
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = insertUserStmt.run(username, email, hash);
    const userId = result.lastInsertRowid;

    ensureUserBalances(userId);

    const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "24h" });
    const user = findUserByIdStmt.get(userId);

    // Send welcome email
    emailService
      .sendWelcomeEmail({ username, email })
      .catch((err) => console.error("Failed to send welcome email:", err.message));

    return res.status(201).json({
      token,
      user,
    });
  }
);

app.post(
  "/api/auth/login",
  rateLimiters.auth,
  [body("email").isEmail().normalizeEmail(), body("password").isString().notEmpty()],
  validate,
  async (req, res) => {
    const email = req.body.email.trim().toLowerCase();
    const password = req.body.password;

    const user = findUserByEmailStmt.get(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    ensureUserBalances(user.id);

    const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: "24h" });
    return res.json({
      token,
      user: findUserByIdStmt.get(user.id),
    });
  }
);

app.get("/api/me", auth, (req, res) => {
  const solanaWallet = getUserSolanaWalletStmt.get(req.user.id);
  const bscWallet = getUserBscWalletStmt.get(req.user.id);
  res.json({
    user: req.user,
    supportedCurrencies: SUPPORTED_CODES,
    solanaWalletAddress: solanaWallet?.address || null,
    bscWalletAddress: bscWallet?.address || null,
  });
});

app.get("/api/setup/status", auth, async (_req, res) => {
  const env = {
    jwtSecretSet: Boolean(JWT_SECRET && JWT_SECRET !== "dev-secret-change-me"),
    bscRpcUrlSet: Boolean(BSC_RPC_URL),
    bscApiKeySet: Boolean(BSC_RPC_API_KEY),
    tronRpcUrlSet: Boolean(TRON_ENDPOINTS && TRON_ENDPOINTS[TRON_NETWORK]),
    tronApiKeySet: Boolean(TRON_RPC_API_KEY),
    solanaRpcUrlSet: Boolean(SOLANA_RPC_URL),
    solanaApiKeySet: Boolean(SOLANA_RPC_API_KEY),
    smtpHostSet: Boolean(emailService.getStatus().configured),
    smtpCredentialsSet: Boolean(emailService.getStatus().credentialsConfigured),
  };

  const [bsc, tron, solana] = await Promise.all([
    probeBscGateway(),
    probeTronGateway(),
    probeSolanaGateway(),
  ]);

  res.json({
    checkedAt: new Date().toISOString(),
    env,
    gateways: {
      bsc,
      tron,
      solana,
    },
    email: emailService.getStatus(),
  });
});

app.get("/api/onchain/setup-status", auth, async (req, res) => {
  const bscWallet = getUserBscWalletStmt.get(req.user.id);
  const solanaWallet = getUserSolanaWalletStmt.get(req.user.id);

  const readiness = {
    checkedAt: new Date().toISOString(),
    wallets: {
      bsc: {
        imported: Boolean(bscWallet),
        address: bscWallet?.address || null,
      },
      solana: {
        imported: Boolean(solanaWallet),
        address: solanaWallet?.address || null,
      },
    },
    gateways: {
      bsc: await probeBscGateway(),
      solana: await probeSolanaGateway(),
    },
    chainData: {
      bsc: null,
      solana: null,
    },
  };

  if (bscWallet) {
    try {
      const data = await fetchBscWalletData(bscWallet.address, { force: true });
      readiness.chainData.bsc = {
        ok: true,
        blockNumber: data.blockNumber,
        bnbBalance: data.bnbBalance,
        nonce: data.nonce,
      };
    } catch (err) {
      readiness.chainData.bsc = {
        ok: false,
        error: err.message || "BSC wallet probe failed",
      };
    }
  }

  if (solanaWallet) {
    try {
      const data = await fetchSolanaAddressData(solanaWallet.address, 5);
      readiness.chainData.solana = {
        ok: true,
        balanceSOL: data.balanceSOL,
        balanceAvailable: data.balanceAvailable,
        signatures: Array.isArray(data.signatures) ? data.signatures.length : 0,
        detail: data.balanceUnavailableReason || null,
      };
    } catch (err) {
      readiness.chainData.solana = {
        ok: false,
        error: err.message || "Solana wallet probe failed",
      };
    }
  }

  const readyForSync = readiness.wallets.bsc.imported || readiness.wallets.solana.imported;

  res.json({
    ...readiness,
    readyForSync,
    message: readyForSync
      ? "On-chain setup ready for sync"
      : "Import at least one on-chain wallet (BSC or Solana)",
  });
});

app.post("/api/onchain/sync-all", auth, async (req, res) => {
  const bscWallet = getUserBscWalletStmt.get(req.user.id);
  const solanaWallet = getUserSolanaWalletStmt.get(req.user.id);

  if (!bscWallet && !solanaWallet) {
    return res.status(400).json({
      error: "No imported wallets found. Import BSC and/or Solana address first.",
    });
  }

  const result = {
    syncedAt: new Date().toISOString(),
    bsc: { attempted: Boolean(bscWallet), ok: false },
    solana: { attempted: Boolean(solanaWallet), ok: false },
  };

  if (bscWallet) {
    try {
      const bscData = await fetchBscWalletData(bscWallet.address, { force: true });
      syncBscBalanceForUser(req.user.id, bscWallet.address, bscData);
      result.bsc = {
        attempted: true,
        ok: true,
        address: bscWallet.address,
        bnbBalance: bscData.bnbBalance,
        blockNumber: bscData.blockNumber,
        nonce: bscData.nonce,
      };
    } catch (err) {
      result.bsc = {
        attempted: true,
        ok: false,
        address: bscWallet.address,
        error: err.message || "BSC sync failed",
      };
    }
  }

  if (solanaWallet) {
    try {
      const solData = await fetchSolanaAddressData(solanaWallet.address, 1);
      if (solData.balanceSOL === null) {
        result.solana = {
          attempted: true,
          ok: false,
          address: solanaWallet.address,
          error: "Cannot sync SOL balance because balance RPC is not available for this Tatum plan",
          details: solData.balanceUnavailableReason,
        };
      } else {
        syncSolanaBalanceForUser(req.user.id, solanaWallet.address, solData);
        result.solana = {
          attempted: true,
          ok: true,
          address: solanaWallet.address,
          balanceSOL: solData.balanceSOL,
          balanceLamports: solData.balanceLamports,
        };
      }
    } catch (err) {
      result.solana = {
        attempted: true,
        ok: false,
        address: solanaWallet.address,
        error: err.message || "Solana sync failed",
      };
    }
  }

  const anySuccess = result.bsc.ok || result.solana.ok;
  res.status(anySuccess ? 200 : 502).json({
    message: anySuccess ? "On-chain sync completed" : "On-chain sync failed",
    result,
  });
});

app.get("/api/bsc/config", auth, (_req, res) => {
  res.json({
    rpcUrl: BSC_RPC_URL,
    fallbackRpcUrl: BSC_RPC_FALLBACK_URL,
    usingApiKey: Boolean(BSC_RPC_API_KEY),
  });
});

app.get("/api/tron/deposit-wallet", (_req, res) => {
  res.json({
    address: TRON_DEPOSIT_ADDRESS || null,
    configured: Boolean(TRON_DEPOSIT_ADDRESS),
    currency: "TRX",
    network: TRON_NETWORK,
    explorerUrl: TRON_DEPOSIT_ADDRESS
      ? `${TRON_EXPLORER_BASE_URLS[TRON_NETWORK]}${encodeURIComponent(TRON_DEPOSIT_ADDRESS)}`
      : null,
    autoCredit: false,
  });
});

app.get("/api/tron/config", auth, (_req, res) => {
  const networkInfo = tronService.getNetworkInfo();
  res.json({
    network: networkInfo.network,
    endpoints: networkInfo.endpoints,
    depositAddress: TRON_DEPOSIT_ADDRESS || null,
    depositAddressConfigured: Boolean(TRON_DEPOSIT_ADDRESS),
    usingApiKey: networkInfo.apiKey !== "none",
    apiKeyPreview: networkInfo.apiKey,
  });
});

app.get("/api/tron/block-number", auth, async (_req, res, next) => {
  try {
    const blockHex = await callTronRpcWithRetry("eth_blockNumber", [], 2);
    return res.json({
      source: `tatum-tron-${TRON_NETWORK}-gateway`,
      network: TRON_NETWORK,
      blockNumberHex: blockHex,
      blockNumber: parseInt(blockHex, 16),
    });
  } catch (err) {
    if (err.code === "TATUM_AUTH") {
      return res.status(401).json({
        error: "Tron gateway authentication failed. Set TRON_RPC_API_KEY or TATUM_API_KEY.",
      });
    }
    if (err.code === "TATUM_RATE_LIMIT") {
      return res.status(429).json({ error: err.message });
    }
    if (err.code === "TATUM_TRANSIENT") {
      return res.status(503).json({ error: "Tron gateway temporarily unavailable. Please retry." });
    }
    return next(err);
  }
});

app.get(
  "/api/bsc/verify-transaction",
  [query("hash").isString().trim().notEmpty()],
  validate,
  auth,
  async (req, res, next) => {
    try {
      const payload = await verifyBscTransaction(req.query.hash);
      return res.json(payload);
    } catch (err) {
      if (err.message === "Invalid transaction hash format") {
        return res.status(400).json({ error: err.message });
      }
      if (err.code === "TATUM_AUTH") {
        return res.status(401).json({
          error: "BSC gateway authentication failed. Set BSC_RPC_API_KEY or TATUM_API_KEY.",
        });
      }
      if (err.code === "TATUM_RATE_LIMIT") {
        return res.status(429).json({ error: err.message });
      }
      if (err.code === "TATUM_TRANSIENT") {
        return res
          .status(503)
          .json({ error: "BSC gateway temporarily unavailable. Please retry." });
      }
      return next(err);
    }
  }
);

app.get(
  "/api/tron/verify-transaction",
  [query("hash").isString().trim().notEmpty()],
  validate,
  auth,
  async (req, res, next) => {
    try {
      const payload = await verifyTronTransaction(req.query.hash);
      return res.json(payload);
    } catch (err) {
      if (err.message === "Invalid transaction hash format") {
        return res.status(400).json({ error: err.message });
      }
      if (err.code === "TATUM_AUTH") {
        return res.status(401).json({
          error: "Tron gateway authentication failed. Set TRON_RPC_API_KEY or TATUM_API_KEY.",
        });
      }
      if (err.code === "TATUM_RATE_LIMIT") {
        return res.status(429).json({ error: err.message });
      }
      if (err.code === "TATUM_TRANSIENT") {
        return res
          .status(503)
          .json({ error: "Tron gateway temporarily unavailable. Please retry." });
      }
      return next(err);
    }
  }
);

app.post(
  "/api/network/verify-transaction",
  [body("network").isIn(["bsc", "tron"]), body("hash").isString().trim().notEmpty()],
  validate,
  auth,
  async (req, res, next) => {
    try {
      const network = String(req.body.network || "").toLowerCase();
      const hash = String(req.body.hash || "").trim();

      if (network === "bsc") {
        return res.json(await verifyBscTransaction(hash));
      }

      if (network === "tron") {
        return res.json(await verifyTronTransaction(hash));
      }

      return res.status(400).json({ error: "Unsupported network" });
    } catch (err) {
      if (err.message === "Invalid transaction hash format") {
        return res.status(400).json({ error: err.message });
      }
      if (err.code === "TATUM_AUTH") {
        return res.status(401).json({
          error: "Gateway authentication failed. Set API key env values for selected network.",
        });
      }
      if (err.code === "TATUM_RATE_LIMIT") {
        return res.status(429).json({ error: err.message });
      }
      if (err.code === "TATUM_TRANSIENT") {
        return res.status(503).json({ error: "Gateway temporarily unavailable. Please retry." });
      }
      return next(err);
    }
  }
);

app.get("/api/bsc/block-number", auth, async (_req, res, next) => {
  try {
    const blockHex = await callBscRpcWithRetry("eth_blockNumber");
    return res.json({
      source: "tatum-bsc-mainnet-gateway",
      blockNumberHex: blockHex,
      blockNumber: parseInt(blockHex, 16),
    });
  } catch (err) {
    if (err.code === "TATUM_AUTH") {
      return res.status(401).json({
        error: "BSC gateway authentication failed. Set BSC_RPC_API_KEY or TATUM_API_KEY.",
      });
    }
    if (err.code === "TATUM_RATE_LIMIT") {
      return res.status(429).json({ error: err.message });
    }
    if (err.code === "TATUM_TRANSIENT") {
      return res.status(503).json({ error: "BSC gateway temporarily unavailable. Please retry." });
    }
    return next(err);
  }
});

app.post(
  "/api/bsc/import-address",
  [body("address").isString().trim().notEmpty()],
  validate,
  auth,
  (req, res) => {
    const address = req.body.address.trim();
    if (!isValidEvmAddress(address)) {
      return res.status(400).json({ error: "Invalid BSC/EVM address" });
    }

    upsertUserBscWalletStmt.run(req.user.id, address);
    return res.json({ message: "BSC wallet imported", address });
  }
);

app.get("/api/bsc/wallet", auth, async (req, res, next) => {
  try {
    const wallet = getUserBscWalletStmt.get(req.user.id);
    if (!wallet) {
      return res.status(404).json({ error: "No imported BSC wallet. Import an address first." });
    }

    const data = await fetchBscWalletData(wallet.address, { force: true });
    return res.json({
      source: "tatum-bsc-mainnet-gateway",
      importedAt: wallet.updated_at,
      ...data,
    });
  } catch (err) {
    if (err.code === "TATUM_AUTH") {
      return res.status(401).json({
        error: "BSC gateway authentication failed. Set BSC_RPC_API_KEY or TATUM_API_KEY.",
      });
    }
    if (err.code === "TATUM_RATE_LIMIT") {
      return res.status(429).json({ error: err.message });
    }
    if (err.code === "TATUM_TRANSIENT") {
      return res.status(503).json({ error: "BSC gateway temporarily unavailable. Please retry." });
    }
    return next(err);
  }
});

app.post("/api/bsc/sync-bnb-balance", auth, async (req, res, next) => {
  try {
    const wallet = getUserBscWalletStmt.get(req.user.id);
    if (!wallet) {
      return res.status(404).json({ error: "No imported BSC wallet. Import an address first." });
    }

    const data = await fetchBscWalletData(wallet.address);

    syncBscBalanceForUser(req.user.id, wallet.address, data);

    return res.json({
      message: "Internal BNB balance synced from on-chain data",
      address: wallet.address,
      bnbBalance: data.bnbBalance,
      bnbBalanceHex: data.bnbBalanceHex,
      nonce: data.nonce,
      blockNumber: data.blockNumber,
    });
  } catch (err) {
    if (err.code === "TATUM_AUTH") {
      return res.status(401).json({
        error: "BSC gateway authentication failed. Set BSC_RPC_API_KEY or TATUM_API_KEY.",
      });
    }
    if (err.code === "TATUM_RATE_LIMIT") {
      return res.status(429).json({ error: err.message });
    }
    if (err.code === "TATUM_TRANSIENT") {
      return res.status(503).json({ error: "BSC gateway temporarily unavailable. Please retry." });
    }
    return next(err);
  }
});

app.get("/api/solana/config", auth, (_req, res) => {
  res.json({
    rpcUrl: SOLANA_RPC_URL,
    usingApiKey: Boolean(SOLANA_RPC_API_KEY),
  });
});

app.post(
  "/api/solana/import-address",
  [body("address").isString().trim().notEmpty()],
  validate,
  auth,
  (req, res) => {
    const address = req.body.address.trim();
    if (!isValidSolanaAddress(address)) {
      return res.status(400).json({ error: "Invalid Solana wallet address" });
    }

    upsertUserSolanaWalletStmt.run(req.user.id, address);
    return res.json({ message: "Solana wallet imported", address });
  }
);

app.get(
  "/api/solana/wallet",
  [query("limit").optional().isInt({ min: 1, max: 50 })],
  validate,
  auth,
  async (req, res, next) => {
    try {
      const wallet = getUserSolanaWalletStmt.get(req.user.id);
      if (!wallet) {
        return res
          .status(404)
          .json({ error: "No imported Solana wallet. Import an address first." });
      }

      const limit = Number(req.query.limit || 10);
      const data = await fetchSolanaAddressData(wallet.address, limit);
      return res.json({
        source: "tatum-solana-mainnet-gateway",
        importedAt: wallet.updated_at,
        ...data,
      });
    } catch (err) {
      const mapped = mapSolanaRpcError(err);
      if (mapped.code === "TATUM_AUTH") {
        return res.status(401).json({ error: mapped.message });
      }
      if (mapped.code === "TATUM_RATE_LIMIT") {
        return res.status(429).json({ error: mapped.message });
      }
      if (mapped.code === "TATUM_TRANSIENT") {
        return res.status(503).json({ error: mapped.message });
      }
      return next(err);
    }
  }
);

app.post("/api/solana/sync-sol-balance", auth, async (req, res, next) => {
  try {
    const wallet = getUserSolanaWalletStmt.get(req.user.id);
    if (!wallet) {
      return res.status(404).json({ error: "No imported Solana wallet. Import an address first." });
    }

    const data = await fetchSolanaAddressData(wallet.address, 1);

    if (data.balanceSOL === null) {
      return res.status(402).json({
        error: "Cannot sync SOL balance because balance RPC is not available for this Tatum plan",
        details: data.balanceUnavailableReason,
      });
    }

    syncSolanaBalanceForUser(req.user.id, wallet.address, data);

    return res.json({
      message: "Internal SOL balance synced from on-chain data",
      address: wallet.address,
      balanceSOL: data.balanceSOL,
      balanceLamports: data.balanceLamports,
    });
  } catch (err) {
    const mapped = mapSolanaRpcError(err);
    if (mapped.code === "TATUM_AUTH") {
      return res.status(401).json({ error: mapped.message });
    }
    if (mapped.code === "TATUM_RATE_LIMIT") {
      return res.status(429).json({ error: mapped.message });
    }
    if (mapped.code === "TATUM_TRANSIENT") {
      return res.status(503).json({ error: mapped.message });
    }
    return next(err);
  }
});

app.get("/api/rates", auth, async (_req, res, next) => {
  try {
    const rates = await getCrossRates();
    res.json(rates);
  } catch (err) {
    next(err);
  }
});

app.get(
  "/api/rates/price-change",
  [query("interval").optional().isString().trim().isLength({ min: 2, max: 3 })],
  validate,
  auth,
  async (req, res, next) => {
    try {
      const interval = normalizePriceChangeInterval(req.query.interval || "1d");
      const changes = await fetchTatumPriceChanges(interval);

      return res.json({
        interval,
        source: changes ? "tatum-price-change-batch" : "unavailable",
        changes,
        fetchedAt: new Date().toISOString(),
      });
    } catch (err) {
      if (err.code === "TATUM_AUTH") {
        return res.status(401).json({
          error:
            "Tatum market data authentication failed. Set TATUM_DATA_API_KEY or TATUM_API_KEY.",
        });
      }
      if (err.code === "TATUM_RATE_LIMIT") {
        return res
          .status(429)
          .json({ error: err.message || "Tatum market data rate limit exceeded" });
      }
      return next(err);
    }
  }
);

app.get("/api/dex/tokens", auth, (_req, res) => {
  const tokens = listDexTokensStmt.all().map(formatDexTokenRow);
  res.json({ tokens });
});

app.post(
  "/api/dex/tokens",
  [
    body("symbol").isString().trim().isLength({ min: 2, max: 12 }),
    body("name").isString().trim().isLength({ min: 2, max: 60 }),
    body("supply").isFloat({ gt: 0 }),
  ],
  validate,
  auth,
  (req, res) => {
    const symbol = normalizeCurrencyCode(req.body.symbol);
    const name = String(req.body.name || "").trim();
    const supplyAtomic = parseAmountAtomic(req.body.supply);

    if (!/^[A-Z0-9]{2,12}$/.test(symbol)) {
      return res
        .status(400)
        .json({ error: "Token symbol must be alphanumeric uppercase (2-12 chars)" });
    }

    if (SUPPORTED_CODES.includes(symbol) || findDexTokenBySymbolStmt.get(symbol)) {
      return res.status(409).json({ error: "Token symbol already exists" });
    }

    if (!supplyAtomic) {
      return res.status(400).json({ error: "Invalid supply" });
    }

    const createTx = db.transaction(() => {
      insertDexTokenStmt.run(symbol, name, req.user.id, atomicToStorage(supplyAtomic));
      const current = getBalance(req.user.id, symbol);
      setBalance(req.user.id, symbol, current + supplyAtomic);
      addTransactionStmt.run(
        req.user.id,
        "TOKEN_LAUNCH",
        symbol,
        atomicToNumber(supplyAtomic),
        `Launched token ${symbol}`,
        null
      );
    });

    createTx();

    return res.status(201).json({
      message: "Token launched",
      token: {
        symbol,
        name,
        supply: atomicToNumber(supplyAtomic),
      },
    });
  }
);

app.get("/api/dex/pools", auth, (req, res) => {
  const pools = listDexPoolsStmt.all().map(formatDexPoolRow);
  const lp = listLpPositionsStmt.all(req.user.id).map((row) => ({
    poolId: row.pool_id,
    liquidity: atomicToNumber(parseStoredAtomic(row.liquidity)),
  }));
  res.json({ pools, myPositions: lp });
});

app.post(
  "/api/dex/pools",
  [
    body("tokenA").isString().trim().isLength({ min: 2, max: 12 }),
    body("tokenB").isString().trim().isLength({ min: 2, max: 12 }),
    body("amountA").isFloat({ gt: 0 }),
    body("amountB").isFloat({ gt: 0 }),
    body("feeBps").optional().isInt({ min: 0, max: 300 }),
  ],
  validate,
  auth,
  (req, res) => {
    const tokenAIn = normalizeCurrencyCode(req.body.tokenA);
    const tokenBIn = normalizeCurrencyCode(req.body.tokenB);
    const amountA = parseAmountAtomic(req.body.amountA);
    const amountB = parseAmountAtomic(req.body.amountB);
    const feeBps = Number(req.body.feeBps ?? 30);

    if (tokenAIn === tokenBIn) {
      return res.status(400).json({ error: "Pool tokens must be different" });
    }

    if (!amountA || !amountB) {
      return res.status(400).json({ error: "Invalid initial liquidity amounts" });
    }

    const [tokenA, tokenB] = getSortedPair(tokenAIn, tokenBIn);
    const sortedAmountA = tokenA === tokenAIn ? amountA : amountB;
    const sortedAmountB = tokenB === tokenBIn ? amountB : amountA;

    const knownToken = (symbol) =>
      SUPPORTED_CODES.includes(symbol) || Boolean(findDexTokenBySymbolStmt.get(symbol));
    if (!knownToken(tokenA) || !knownToken(tokenB)) {
      return res.status(404).json({ error: "One or both tokens are not available" });
    }

    if (findDexPoolByPairStmt.get(tokenA, tokenB)) {
      return res.status(409).json({ error: "Pool already exists for this pair" });
    }

    try {
      const result = db.transaction(() => {
        const balA = getBalance(req.user.id, tokenA);
        const balB = getBalance(req.user.id, tokenB);
        if (balA < sortedAmountA || balB < sortedAmountB) {
          throw new Error("Insufficient funds for initial liquidity");
        }

        setBalance(req.user.id, tokenA, balA - sortedAmountA);
        setBalance(req.user.id, tokenB, balB - sortedAmountB);

        const inserted = insertDexPoolStmt.run(
          tokenA,
          tokenB,
          atomicToStorage(sortedAmountA),
          atomicToStorage(sortedAmountB),
          feeBps,
          req.user.id
        );

        const poolId = inserted.lastInsertRowid;
        const mintedLiquidity = integerSqrt(sortedAmountA * sortedAmountB);
        upsertLpPositionStmt.run(req.user.id, poolId, atomicToStorage(mintedLiquidity));

        addTransactionStmt.run(
          req.user.id,
          "POOL_CREATE",
          `${tokenA}/${tokenB}`,
          atomicToNumber(mintedLiquidity),
          `Created LP pool with ${tokenA} and ${tokenB}`,
          null
        );

        return { poolId, mintedLiquidity };
      })();

      const pool = findDexPoolByIdStmt.get(result.poolId);
      return res.status(201).json({
        message: "Liquidity pool created",
        pool: formatDexPoolRow(pool),
        mintedLiquidity: atomicToNumber(result.mintedLiquidity),
      });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
);

app.post(
  "/api/dex/liquidity/add",
  [
    body("poolId").isInt({ min: 1 }),
    body("amountA").isFloat({ gt: 0 }),
    body("amountB").isFloat({ gt: 0 }),
  ],
  validate,
  auth,
  (req, res) => {
    const poolId = Number(req.body.poolId);
    const amountA = parseAmountAtomic(req.body.amountA);
    const amountB = parseAmountAtomic(req.body.amountB);
    if (!amountA || !amountB) {
      return res.status(400).json({ error: "Invalid liquidity amounts" });
    }

    const pool = findDexPoolByIdStmt.get(poolId);
    if (!pool) {
      return res.status(404).json({ error: "Pool not found" });
    }

    try {
      const result = db.transaction(() => {
        const reserveA = parseStoredAtomic(pool.reserve_a);
        const reserveB = parseStoredAtomic(pool.reserve_b);
        const currentA = getBalance(req.user.id, pool.token_a);
        const currentB = getBalance(req.user.id, pool.token_b);
        if (currentA < amountA || currentB < amountB) {
          throw new Error("Insufficient funds for liquidity add");
        }

        const totalLiquidity = totalPoolLiquidityAtomic(poolId);
        const mintedA = (amountA * totalLiquidity) / reserveA;
        const mintedB = (amountB * totalLiquidity) / reserveB;
        const minted = mintedA < mintedB ? mintedA : mintedB;

        if (minted <= 0n) {
          throw new Error("Liquidity contribution too small");
        }

        setBalance(req.user.id, pool.token_a, currentA - amountA);
        setBalance(req.user.id, pool.token_b, currentB - amountB);
        updateDexPoolStmt.run(
          atomicToStorage(reserveA + amountA),
          atomicToStorage(reserveB + amountB),
          poolId
        );

        const existingLp = parseStoredAtomic(getLpPositionStmt.get(req.user.id, poolId)?.liquidity);
        upsertLpPositionStmt.run(req.user.id, poolId, atomicToStorage(existingLp + minted));

        addTransactionStmt.run(
          req.user.id,
          "LP_ADD",
          `${pool.token_a}/${pool.token_b}`,
          atomicToNumber(minted),
          `Added liquidity to pool #${poolId}`,
          null
        );

        return minted;
      })();

      const updatedPool = findDexPoolByIdStmt.get(poolId);
      return res.json({
        message: "Liquidity added",
        pool: formatDexPoolRow(updatedPool),
        mintedLiquidity: atomicToNumber(result),
      });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
);

app.post(
  "/api/dex/liquidity/remove",
  [body("poolId").isInt({ min: 1 }), body("liquidity").isFloat({ gt: 0 })],
  validate,
  auth,
  (req, res) => {
    const poolId = Number(req.body.poolId);
    const burnLiquidity = parseAmountAtomic(req.body.liquidity);
    if (!burnLiquidity) {
      return res.status(400).json({ error: "Invalid liquidity amount" });
    }

    const pool = findDexPoolByIdStmt.get(poolId);
    if (!pool) {
      return res.status(404).json({ error: "Pool not found" });
    }

    try {
      const result = db.transaction(() => {
        const totalLiquidity = totalPoolLiquidityAtomic(poolId);
        const userLp = parseStoredAtomic(getLpPositionStmt.get(req.user.id, poolId)?.liquidity);

        if (userLp < burnLiquidity) {
          throw new Error("Not enough LP liquidity to remove");
        }

        const reserveA = parseStoredAtomic(pool.reserve_a);
        const reserveB = parseStoredAtomic(pool.reserve_b);
        const outA = (reserveA * burnLiquidity) / totalLiquidity;
        const outB = (reserveB * burnLiquidity) / totalLiquidity;

        updateDexPoolStmt.run(
          atomicToStorage(reserveA - outA),
          atomicToStorage(reserveB - outB),
          poolId
        );

        const balanceA = getBalance(req.user.id, pool.token_a);
        const balanceB = getBalance(req.user.id, pool.token_b);
        setBalance(req.user.id, pool.token_a, balanceA + outA);
        setBalance(req.user.id, pool.token_b, balanceB + outB);
        upsertLpPositionStmt.run(req.user.id, poolId, atomicToStorage(userLp - burnLiquidity));

        addTransactionStmt.run(
          req.user.id,
          "LP_REMOVE",
          `${pool.token_a}/${pool.token_b}`,
          atomicToNumber(burnLiquidity),
          `Removed liquidity from pool #${poolId}`,
          null
        );

        return { outA, outB };
      })();

      const updatedPool = findDexPoolByIdStmt.get(poolId);
      return res.json({
        message: "Liquidity removed",
        pool: formatDexPoolRow(updatedPool),
        withdrawn: {
          tokenA: pool.token_a,
          amountA: atomicToNumber(result.outA),
          tokenB: pool.token_b,
          amountB: atomicToNumber(result.outB),
        },
      });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
);

app.post(
  "/api/dex/swap",
  [
    body("poolId").isInt({ min: 1 }),
    body("fromToken").isString().trim().isLength({ min: 2, max: 12 }),
    body("amountIn").isFloat({ gt: 0 }),
  ],
  validate,
  auth,
  (req, res) => {
    const poolId = Number(req.body.poolId);
    const fromToken = normalizeCurrencyCode(req.body.fromToken);
    const amountIn = parseAmountAtomic(req.body.amountIn);
    if (!amountIn) {
      return res.status(400).json({ error: "Invalid swap amount" });
    }

    const pool = findDexPoolByIdStmt.get(poolId);
    if (!pool) {
      return res.status(404).json({ error: "Pool not found" });
    }

    const isFromA = fromToken === pool.token_a;
    const isFromB = fromToken === pool.token_b;
    if (!isFromA && !isFromB) {
      return res.status(400).json({ error: "fromToken must match pool pair" });
    }

    const toToken = isFromA ? pool.token_b : pool.token_a;

    try {
      const result = db.transaction(() => {
        const reserveA = parseStoredAtomic(pool.reserve_a);
        const reserveB = parseStoredAtomic(pool.reserve_b);
        const reserveIn = isFromA ? reserveA : reserveB;
        const reserveOut = isFromA ? reserveB : reserveA;
        const feeBps = BigInt(pool.fee_bps);
        const amountInAfterFee = (amountIn * (10000n - feeBps)) / 10000n;
        const numerator = amountInAfterFee * reserveOut;
        const denominator = reserveIn + amountInAfterFee;
        const amountOut = numerator / denominator;

        if (amountOut <= 0n) {
          throw new Error("Swap output too small");
        }

        const traderInBalance = getBalance(req.user.id, fromToken);
        if (traderInBalance < amountIn) {
          throw new Error("Insufficient funds for swap");
        }

        const traderOutBalance = getBalance(req.user.id, toToken);
        setBalance(req.user.id, fromToken, traderInBalance - amountIn);
        setBalance(req.user.id, toToken, traderOutBalance + amountOut);

        const newReserveIn = reserveIn + amountIn;
        const newReserveOut = reserveOut - amountOut;
        if (newReserveOut <= 0n) {
          throw new Error("Pool reserve too low for swap");
        }

        const newReserveA = isFromA ? newReserveIn : newReserveOut;
        const newReserveB = isFromA ? newReserveOut : newReserveIn;
        updateDexPoolStmt.run(atomicToStorage(newReserveA), atomicToStorage(newReserveB), poolId);

        addTransactionStmt.run(
          req.user.id,
          "DEX_SWAP",
          `${fromToken}->${toToken}`,
          atomicToNumber(amountIn),
          `Swapped ${fromToken} for ${toToken} in pool #${poolId}`,
          null
        );

        return { amountOut, toToken };
      })();

      const updatedPool = findDexPoolByIdStmt.get(poolId);
      return res.json({
        message: "Swap successful",
        pool: formatDexPoolRow(updatedPool),
        fromToken,
        amountIn: atomicToNumber(amountIn),
        toToken: result.toToken,
        amountOut: atomicToNumber(result.amountOut),
      });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
);

app.get("/api/wallet/balances", auth, (req, res) => {
  ensureUserBalances(req.user.id);
  const balances = listBalancesStmt.all(req.user.id).map((row) => ({
    currency: row.currency,
    balance: atomicToNumber(parseStoredAtomic(row.balance)),
  }));
  res.json({ balances });
});

app.post(
  "/api/wallet/deposit",
  [body("currency").isIn(SUPPORTED_CODES), body("amount").isFloat({ gt: 0 })],
  validate,
  auth,
  (req, res) => {
    const currency = req.body.currency;
    const amountAtomic = parseAmountAtomic(req.body.amount);

    if (!amountAtomic) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const tx = db.transaction(() => {
      const current = getBalance(req.user.id, currency);
      const updated = current + amountAtomic;
      setBalance(req.user.id, currency, updated);
      addTransactionStmt.run(
        req.user.id,
        "DEPOSIT",
        currency,
        atomicToNumber(amountAtomic),
        "Manual deposit",
        null
      );
      return updated;
    });

    const balance = atomicToNumber(tx());

    // Send deposit confirmation email
    const user = findUserByIdStmt.get(req.user.id);
    emailService
      .sendDepositConfirmation(user, currency, atomicToNumber(amountAtomic))
      .catch((err) => console.error("Failed to send deposit email:", err.message));

    return res.json({ message: "Deposit successful", currency, balance });
  }
);

app.post(
  "/api/wallet/withdraw",
  [body("currency").isIn(SUPPORTED_CODES), body("amount").isFloat({ gt: 0 })],
  validate,
  auth,
  (req, res) => {
    const currency = req.body.currency;
    const amountAtomic = parseAmountAtomic(req.body.amount);

    if (!amountAtomic) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    try {
      const tx = db.transaction(() => {
        const current = getBalance(req.user.id, currency);
        if (current < amountAtomic) {
          throw new Error("Insufficient funds");
        }

        const updated = current - amountAtomic;
        setBalance(req.user.id, currency, updated);
        addTransactionStmt.run(
          req.user.id,
          "WITHDRAW",
          currency,
          atomicToNumber(amountAtomic),
          "Manual withdraw",
          null
        );
        return updated;
      });

      const balance = atomicToNumber(tx());

      // Send withdrawal confirmation email
      const user = findUserByIdStmt.get(req.user.id);
      emailService
        .sendWithdrawalConfirmation(user, currency, atomicToNumber(amountAtomic), null)
        .catch((err) => console.error("Failed to send withdrawal email:", err.message));

      return res.json({ message: "Withdraw successful", currency, balance });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
);

app.post(
  "/api/wallet/transfer",
  [
    body("toUsername").isString().trim().isLength({ min: 3, max: 24 }),
    body("currency").isIn(SUPPORTED_CODES),
    body("amount").isFloat({ gt: 0 }),
  ],
  validate,
  auth,
  (req, res) => {
    const toUsername = req.body.toUsername.trim();
    const currency = req.body.currency;
    const amountAtomic = parseAmountAtomic(req.body.amount);

    if (!amountAtomic) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const recipient = findUserByUsernameStmt.get(toUsername);
    if (!recipient) {
      return res.status(404).json({ error: "Recipient not found" });
    }

    if (recipient.id === req.user.id) {
      return res.status(400).json({ error: "Cannot transfer to yourself" });
    }

    ensureUserBalances(recipient.id);

    try {
      const transferTx = db.transaction(() => {
        const senderBalance = getBalance(req.user.id, currency);
        if (senderBalance < amountAtomic) {
          throw new Error("Insufficient funds");
        }

        const recipientBalance = getBalance(recipient.id, currency);

        setBalance(req.user.id, currency, senderBalance - amountAtomic);
        setBalance(recipient.id, currency, recipientBalance + amountAtomic);

        addTransactionStmt.run(
          req.user.id,
          "TRANSFER_OUT",
          currency,
          atomicToNumber(amountAtomic),
          `Sent to ${recipient.username}`,
          recipient.username
        );

        addTransactionStmt.run(
          recipient.id,
          "TRANSFER_IN",
          currency,
          atomicToNumber(amountAtomic),
          `Received from ${req.user.username}`,
          req.user.username
        );
      });

      transferTx();

      return res.json({
        message: "Transfer successful",
        to: recipient.username,
        currency,
        amount: atomicToNumber(amountAtomic),
      });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
);

app.post(
  "/api/exchange",
  [
    body("fromCurrency").isIn(SUPPORTED_CODES),
    body("toCurrency").isIn(SUPPORTED_CODES),
    body("amount").isFloat({ gt: 0 }),
    body("routeMode").optional().isIn(["auto", "market", "dex"]),
    body("slippageBps").optional().isFloat({ min: 0, max: 5000 }),
    body("slippagePct").optional().isFloat({ min: 0, max: 50 }),
    body("preferredPoolId").optional().isInt({ min: 1 }),
  ],
  validate,
  auth,
  async (req, res, next) => {
    const fromCurrency = req.body.fromCurrency;
    const toCurrency = req.body.toCurrency;
    const amountAtomic = parseAmountAtomic(req.body.amount);
    const slippageBps = Number.isFinite(Number(req.body.slippageBps))
      ? Number(req.body.slippageBps)
      : Number.isFinite(Number(req.body.slippagePct))
        ? Number(req.body.slippagePct) * 100
        : 100;
    const preferredPoolId = req.body.preferredPoolId ? Number(req.body.preferredPoolId) : null;

    if (!amountAtomic) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    if (fromCurrency === toCurrency) {
      return res.status(400).json({ error: "Currencies must be different" });
    }

    try {
      const result = await executeExchangeTrade({
        userId: req.user.id,
        fromCurrency,
        toCurrency,
        amountAtomic,
        routeMode: req.body.routeMode,
        slippageBps,
        preferredPoolId,
      });

      // Send trade confirmation email
      const user = findUserByIdStmt.get(req.user.id);
      emailService
        .sendTradeConfirmation(
          user,
          fromCurrency,
          toCurrency,
          atomicToNumber(amountAtomic),
          result.received,
          result.rate
        )
        .catch((err) => console.error("Failed to send trade email:", err.message));

      return res.json({
        message: "Exchange successful",
        ...result,
        fromCurrency,
        toCurrency,
      });
    } catch (err) {
      if (err.message === "Insufficient funds") {
        return res.status(400).json({ error: err.message });
      }
      return next(err);
    }
  }
);

app.post(
  "/api/exchange/quote",
  [
    body("fromCurrency").isIn(SUPPORTED_CODES),
    body("toCurrency").isIn(SUPPORTED_CODES),
    body("amount").isFloat({ gt: 0 }),
    body("routeMode").optional().isIn(["auto", "market", "dex"]),
    body("slippageBps").optional().isFloat({ min: 0, max: 5000 }),
    body("slippagePct").optional().isFloat({ min: 0, max: 50 }),
    body("preferredPoolId").optional().isInt({ min: 1 }),
  ],
  validate,
  auth,
  async (req, res, next) => {
    try {
      const quote = await buildExchangeQuote({
        fromCurrency: req.body.fromCurrency,
        toCurrency: req.body.toCurrency,
        amountAtomic: parseAmountAtomic(req.body.amount),
        routeMode: req.body.routeMode,
        slippageBps: Number.isFinite(Number(req.body.slippageBps))
          ? Number(req.body.slippageBps)
          : Number.isFinite(Number(req.body.slippagePct))
            ? Number(req.body.slippagePct) * 100
            : 100,
        preferredPoolId: req.body.preferredPoolId ? Number(req.body.preferredPoolId) : null,
      });

      return res.json({
        message: "Quote generated",
        ...toExchangeResult(quote),
      });
    } catch (err) {
      if (err.message && /No exchange route available/.test(err.message)) {
        return res.status(404).json({ error: err.message });
      }
      return next(err);
    }
  }
);

app.get("/api/exchange/orders", auth, (req, res) => {
  const orders = listExchangeOrdersStmt.all(req.user.id).map(formatExchangeOrderRow);
  res.json({ orders });
});

app.post(
  "/api/exchange/orders",
  [
    body("label").optional().isString().trim().isLength({ max: 80 }),
    body("fromCurrency").isIn(SUPPORTED_CODES),
    body("toCurrency").isIn(SUPPORTED_CODES),
    body("amount").isFloat({ gt: 0 }),
    body("targetRate").isFloat({ gt: 0 }),
    body("triggerDirection").isIn(["lte", "gte"]),
    body("routeMode").optional().isIn(["auto", "market", "dex"]),
    body("slippageBps").optional().isFloat({ min: 0, max: 5000 }),
    body("slippagePct").optional().isFloat({ min: 0, max: 50 }),
    body("preferredPoolId").optional().isInt({ min: 1 }),
  ],
  validate,
  auth,
  (req, res) => {
    const amountAtomic = parseAmountAtomic(req.body.amount);
    if (!amountAtomic) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    if (req.body.fromCurrency === req.body.toCurrency) {
      return res.status(400).json({ error: "Currencies must be different" });
    }

    const label = String(req.body.label || "").trim();
    const targetRate = Number(req.body.targetRate);
    const preferredPoolId = req.body.preferredPoolId ? Number(req.body.preferredPoolId) : null;
    const routeMode = normalizeExchangeRouteModeList(req.body.routeMode);
    const slippageBps = Number.isFinite(Number(req.body.slippageBps))
      ? Number(req.body.slippageBps)
      : Number.isFinite(Number(req.body.slippagePct))
        ? Number(req.body.slippagePct) * 100
        : 100;
    const triggerDirection = normalizeExchangeTriggerDirection(req.body.triggerDirection);

    const inserted = insertExchangeOrderStmt.run(
      req.user.id,
      label || null,
      req.body.fromCurrency,
      req.body.toCurrency,
      atomicToStorage(amountAtomic),
      targetRate,
      triggerDirection,
      routeMode,
      normalizeSlippageBps(slippageBps),
      preferredPoolId
    );

    const row = listExchangeOrdersStmt
      .all(req.user.id)
      .find((item) => item.id === inserted.lastInsertRowid);
    return res.status(201).json({
      message: "Order created",
      order: formatExchangeOrderRow(row),
    });
  }
);

app.post("/api/exchange/orders/process", auth, async (req, res, next) => {
  try {
    const summary = await processExchangeOrders(req.user.id);
    return res.json({
      message: "Exchange orders processed",
      ...summary,
      orders: listExchangeOrdersStmt.all(req.user.id).map(formatExchangeOrderRow),
    });
  } catch (err) {
    return next(err);
  }
});

app.post("/api/exchange/orders/:id/cancel", auth, (req, res) => {
  const orderId = Number(req.params.id);
  const orderRow = db
    .prepare("SELECT id, status FROM exchange_orders WHERE id = ? AND user_id = ?")
    .get(orderId, req.user.id);
  if (!orderRow) {
    return res.status(404).json({ error: "Order not found" });
  }

  if (orderRow.status !== "open") {
    return res.status(400).json({ error: "Only open orders can be canceled" });
  }

  db.prepare(
    "UPDATE exchange_orders SET status = 'canceled', updated_at = datetime('now') WHERE id = ? AND user_id = ?"
  ).run(orderId, req.user.id);
  const order = listExchangeOrdersStmt.all(req.user.id).find((item) => item.id === orderId);
  return res.json({
    message: "Order canceled",
    order: formatExchangeOrderRow(order),
  });
});

app.get(
  "/api/transactions",
  [
    query("limit").optional().isInt({ min: 1, max: 200 }),
    query("type").optional().isString().trim(),
    query("currency").optional().isString().trim(),
  ],
  validate,
  auth,
  (req, res) => {
    const limit = Number(req.query.limit || 50);
    const { clause, values } = QueryOptimizer.buildWhereClause({
      user_id: req.user.id,
      type: req.query.type ? req.query.type.toUpperCase() : null,
      currency: req.query.currency ? normalizeCurrencyCode(req.query.currency) : null,
    });
    const orderClause = QueryOptimizer.buildOrderClause({ id: "DESC" });
    const limitClause = QueryOptimizer.buildLimitClause(limit);

    const rows = db
      .prepare(
        `SELECT id, type, currency, amount, details, counterparty, created_at FROM transactions ${clause} ${orderClause} ${limitClause}`
      )
      .all(...values)
      .map((row) => ({
        ...row,
        amount: roundCrypto(row.amount),
      }));
    res.json({ transactions: rows });
  }
);

// ==================== WALLET GENERATION ENDPOINTS ====================

app.post("/api/wallet/generate", auth, (req, res) => {
  try {
    const { type, includeMultiChain } = req.body;

    // Handle multi-chain wallet generation
    if (includeMultiChain || type === "multi") {
      const wallets = WalletService.generateMultiChainWallet();
      return res.json({
        success: true,
        wallet: {
          mnemonic: wallets.mnemonic,
          ethereum: {
            address: wallets.ethereum.address,
            privateKey: wallets.ethereum.privateKey,
            type: "ethereum",
          },
          bsc: {
            address: wallets.bsc.address,
            privateKey: wallets.bsc.privateKey,
            type: "bsc",
          },
          solana: {
            address: wallets.solana.address,
            privateKey: wallets.solana.privateKey,
            type: "solana",
          },
          tron: {
            address: wallets.tron.address,
            privateKey: wallets.tron.privateKey,
            type: "tron",
          },
        },
        warning: "Store your mnemonic phrase securely. Never share it with anyone.",
      });
    }

    let wallet;
    switch (type) {
      case "ethereum":
        wallet = WalletService.generateEthereumWallet();
        break;
      case "bsc":
        wallet = WalletService.generateBscWallet();
        break;
      case "solana":
        wallet = WalletService.generateSolanaWallet();
        break;
      default:
        return res
          .status(400)
          .json({ error: "Invalid wallet type. Use: ethereum, bsc, solana, or multi" });
    }

    res.json({
      success: true,
      wallet: {
        address: wallet.address,
        privateKey: wallet.privateKey,
        type: wallet.type,
        mnemonic: wallet.mnemonic,
      },
      warning: "Store your credentials securely. Never share them with anyone.",
    });
  } catch (error) {
    console.error("Wallet generation error:", error);
    res.status(500).json({ error: "Failed to generate wallet" });
  }
});

app.post("/api/wallet/validate-mnemonic", (req, res) => {
  try {
    const { mnemonic } = req.body;
    const isValid = WalletService.validateMnemonic(mnemonic);
    res.json({ valid: isValid });
  } catch (error) {
    res.json({ valid: false });
  }
});

// ==================== ETHEREUM/BSC BLOCKCHAIN ENDPOINTS ====================

app.get("/api/ethereum/balance/:address", auth, async (req, res) => {
  try {
    const balance = await ethereumService.getBalance(req.params.address);
    res.json({ address: req.params.address, balance, currency: "ETH" });
  } catch (error) {
    console.error("Error fetching ETH balance:", error);
    res.status(500).json({ error: "Failed to fetch balance" });
  }
});

app.get("/api/bsc/balance/:address", auth, async (req, res) => {
  try {
    const balance = await bscService.getBalance(req.params.address);
    res.json({ address: req.params.address, balance, currency: "BNB" });
  } catch (error) {
    console.error("Error fetching BNB balance:", error);
    res.status(500).json({ error: "Failed to fetch balance" });
  }
});

app.get("/api/ethereum/gas-price", auth, async (req, res) => {
  try {
    const gasPrice = await ethereumService.getGasPrice();
    res.json({ gasPrice, unit: "gwei" });
  } catch (error) {
    console.error("Error fetching gas price:", error);
    res.status(500).json({ error: "Failed to fetch gas price" });
  }
});

app.get("/api/ethereum/block-number", auth, async (req, res) => {
  try {
    const blockNumber = await ethereumService.getBlockNumber();
    res.json({ blockNumber });
  } catch (error) {
    console.error("Error fetching block number:", error);
    res.status(500).json({ error: "Failed to fetch block number" });
  }
});

app.get("/api/ethereum/transaction/:hash", auth, async (req, res) => {
  try {
    const transaction = await ethereumService.getTransaction(req.params.hash);
    res.json({ transaction });
  } catch (error) {
    console.error("Error fetching transaction:", error);
    res.status(500).json({ error: "Failed to fetch transaction" });
  }
});

app.get("/api/ethereum/token-balance", auth, async (req, res) => {
  try {
    const { tokenAddress, walletAddress } = req.query;
    if (!tokenAddress || !walletAddress) {
      return res.status(400).json({ error: "tokenAddress and walletAddress are required" });
    }
    const balance = await ethereumService.getTokenBalance(tokenAddress, walletAddress);
    res.json({ tokenAddress, walletAddress, balance });
  } catch (error) {
    console.error("Error fetching token balance:", error);
    res.status(500).json({ error: "Failed to fetch token balance" });
  }
});

app.get("/api/ethereum/token-info/:address", auth, async (req, res) => {
  try {
    const tokenInfo = await ethereumService.getTokenInfo(req.params.address);
    res.json({ tokenAddress: req.params.address, ...tokenInfo });
  } catch (error) {
    console.error("Error fetching token info:", error);
    res.status(500).json({ error: "Failed to fetch token info" });
  }
});

// ==================== SOLANA BLOCKCHAIN ENDPOINTS ====================

app.get("/api/solana/balance/:address", auth, async (req, res) => {
  try {
    const balance = await solanaService.getBalance(req.params.address);
    res.json({ address: req.params.address, balance, currency: "SOL" });
  } catch (error) {
    console.error("Error fetching SOL balance:", error);
    res.status(500).json({ error: "Failed to fetch balance" });
  }
});

app.get("/api/solana/slot", auth, async (req, res) => {
  try {
    const slot = await solanaService.getSlot();
    res.json({ slot });
  } catch (error) {
    console.error("Error fetching Solana slot:", error);
    res.status(500).json({ error: "Failed to fetch slot" });
  }
});

app.get("/api/solana/transaction/:signature", auth, async (req, res) => {
  try {
    const transaction = await solanaService.getTransaction(req.params.signature);
    res.json({ transaction });
  } catch (error) {
    console.error("Error fetching Solana transaction:", error);
    res.status(500).json({ error: "Failed to fetch transaction" });
  }
});

app.get("/api/solana/token-accounts/:address", auth, async (req, res) => {
  try {
    const tokenAccounts = await solanaService.getTokenAccounts(req.params.address);
    res.json({ address: req.params.address, tokenAccounts });
  } catch (error) {
    console.error("Error fetching token accounts:", error);
    res.status(500).json({ error: "Failed to fetch token accounts" });
  }
});

app.get("/api/solana/recent-transactions/:address", auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const transactions = await solanaService.getRecentTransactions(req.params.address, limit);
    res.json({ address: req.params.address, transactions });
  } catch (error) {
    console.error("Error fetching recent transactions:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

app.post("/api/solana/validate-address", (req, res) => {
  try {
    const { address } = req.body;
    const isValid = solanaService.isValidAddress(address);
    res.json({ address, valid: isValid });
  } catch (error) {
    res.json({ address: req.body.address, valid: false });
  }
});

// ==================== TRON BLOCKCHAIN ENDPOINTS ====================

app.get("/api/tron/balance/:address", auth, async (req, res) => {
  try {
    const balance = await tronService.getBalance(req.params.address);
    res.json({
      success: true,
      address: req.params.address,
      balance,
      currency: "TRX",
    });
  } catch (error) {
    console.error("Error fetching TRX balance:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Failed to fetch balance",
      address: req.params.address,
    });
  }
});

app.get("/api/tron/account/:address", auth, async (req, res) => {
  try {
    const account = await tronService.getAccount(req.params.address);
    res.json({ address: req.params.address, account });
  } catch (error) {
    console.error("Error fetching TRON account:", error);
    res.status(500).json({ error: "Failed to fetch account" });
  }
});

app.get("/api/tron/transaction/:hash", auth, async (req, res) => {
  try {
    const transaction = await tronService.getTransaction(req.params.hash);
    res.json({ transaction });
  } catch (error) {
    console.error("Error fetching TRON transaction:", error);
    res.status(500).json({ error: "Failed to fetch transaction" });
  }
});

app.get("/api/tron/trc20-balance", auth, async (req, res) => {
  try {
    const { contractAddress, walletAddress } = req.query;
    if (!contractAddress || !walletAddress) {
      return res.status(400).json({ error: "contractAddress and walletAddress are required" });
    }
    const balance = await tronService.getTrc20Balance(contractAddress, walletAddress);
    res.json({ contractAddress, walletAddress, balance });
  } catch (error) {
    console.error("Error fetching TRC20 balance:", error);
    res.status(500).json({ error: "Failed to fetch token balance" });
  }
});

app.get("/api/tron/trc20-info/:address", auth, async (req, res) => {
  try {
    const tokenInfo = await tronService.getTrc20TokenInfo(req.params.address);
    res.json({ contractAddress: req.params.address, ...tokenInfo });
  } catch (error) {
    console.error("Error fetching TRC20 token info:", error);
    res.status(500).json({ error: "Failed to fetch token info" });
  }
});

app.post("/api/tron/validate-address", (req, res) => {
  try {
    const { address } = req.body;
    const isValid = tronService.isValidAddress(address);
    res.json({ address, valid: isValid });
  } catch (error) {
    res.json({ address: req.body.address, valid: false });
  }
});

// ==================== TRON TATUM API ENDPOINTS ====================

app.get("/api/tron/tatum/current-block", auth, async (_req, res) => {
  try {
    const block = await tronService.getCurrentBlockViaTatum();
    res.json({ success: true, block });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to fetch current block via Tatum API",
    });
  }
});

app.get("/api/tron/tatum/balance/:address", auth, async (req, res) => {
  try {
    const { address } = req.params;
    const accountData = await tronService.getBalanceViaTatum(address);
    res.json({ success: true, account: accountData });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to fetch balance via Tatum API",
    });
  }
});

app.get("/api/tron/tatum/transaction/:txId", auth, async (req, res) => {
  try {
    const { txId } = req.params;
    const transaction = await tronService.getTransactionViaTatum(txId);
    res.json({ success: true, transaction });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to fetch transaction via Tatum API",
    });
  }
});

app.post("/api/tron/tatum/block-by-number", auth, async (req, res) => {
  try {
    const { blockNumber } = req.body;
    if (!blockNumber && blockNumber !== 0) {
      return res.status(400).json({
        success: false,
        message: "Block number is required",
      });
    }
    const block = await tronService.getBlockByNumberViaTatum(blockNumber);
    res.json({ success: true, block });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to fetch block via Tatum API",
    });
  }
});

app.post("/api/tron/tatum/validate-address", auth, async (req, res) => {
  try {
    const { address } = req.body;
    if (!address) {
      return res.status(400).json({
        success: false,
        message: "Address is required",
      });
    }
    const validation = await tronService.validateAddressViaTatum(address);
    res.json({ success: true, validation });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to validate address via Tatum API",
    });
  }
});

// ==================== CRYPTO PRICE DATA ENDPOINTS ====================

app.get("/api/crypto/prices", auth, async (req, res) => {
  try {
    const { ids, currency } = req.query;
    const coinIds = ids
      ? ids.split(",")
      : ["bitcoin", "ethereum", "tether", "binancecoin", "solana"];
    const vsCurrency = currency || "usd";

    const prices = await cryptoDataService.getPrices(coinIds, vsCurrency);
    res.json({ prices, currency: vsCurrency });
  } catch (error) {
    console.error("Error fetching prices:", error);
    res.status(500).json({ error: "Failed to fetch prices" });
  }
});

app.get("/api/crypto/coin/:id", auth, async (req, res) => {
  try {
    const coinData = await cryptoDataService.getCoinData(req.params.id);
    res.json({ coin: coinData });
  } catch (error) {
    console.error("Error fetching coin data:", error);
    res.status(500).json({ error: "Failed to fetch coin data" });
  }
});

app.get("/api/crypto/market-chart/:id", auth, async (req, res) => {
  try {
    const { currency, days } = req.query;
    const vsCurrency = currency || "usd";
    const chartDays = parseInt(days) || 7;

    const chartData = await cryptoDataService.getMarketChart(req.params.id, vsCurrency, chartDays);
    res.json({ coinId: req.params.id, currency: vsCurrency, days: chartDays, data: chartData });
  } catch (error) {
    console.error("Error fetching market chart:", error);
    res.status(500).json({ error: "Failed to fetch chart data" });
  }
});

app.get("/api/crypto/ohlc/:id", auth, async (req, res) => {
  try {
    const { currency, days } = req.query;
    const vsCurrency = currency || "usd";
    const chartDays = parseInt(days) || 7;

    const ohlcData = await cryptoDataService.getOHLC(req.params.id, vsCurrency, chartDays);
    res.json({ coinId: req.params.id, currency: vsCurrency, days: chartDays, data: ohlcData });
  } catch (error) {
    console.error("Error fetching OHLC data:", error);
    res.status(500).json({ error: "Failed to fetch OHLC data" });
  }
});

app.get("/api/crypto/trending", auth, async (req, res) => {
  try {
    const trending = await cryptoDataService.getTrending();
    res.json({ trending });
  } catch (error) {
    console.error("Error fetching trending coins:", error);
    res.status(500).json({ error: "Failed to fetch trending coins" });
  }
});

app.get("/api/crypto/global", auth, async (req, res) => {
  try {
    const globalData = await cryptoDataService.getGlobalData();
    res.json({ global: globalData });
  } catch (error) {
    console.error("Error fetching global data:", error);
    res.status(500).json({ error: "Failed to fetch global data" });
  }
});

app.get("/api/crypto/search", auth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }
    const results = await cryptoDataService.searchCoins(q);
    res.json({ query: q, results });
  } catch (error) {
    console.error("Error searching coins:", error);
    res.status(500).json({ error: "Failed to search coins" });
  }
});

app.get("/api/crypto/token-price/:platform/:address", auth, async (req, res) => {
  try {
    const { platform, address } = req.params;
    const { currency } = req.query;
    const vsCurrency = currency || "usd";

    const price = await cryptoDataService.getTokenPrice(platform, address, vsCurrency);
    res.json({ platform, address, currency: vsCurrency, price });
  } catch (error) {
    console.error("Error fetching token price:", error);
    res.status(500).json({ error: "Failed to fetch token price" });
  }
});

// ==================== WEBSOCKET STATUS ENDPOINT ====================

app.get("/api/websocket/status", auth, (req, res) => {
  try {
    const stats = wsService.getStats();
    res.json({
      connected: true,
      ...stats,
    });
  } catch (error) {
    res.json({ connected: false, error: error.message });
  }
});

// ==================== TRANSACTION SENDING ENDPOINTS ====================

app.post("/api/ethereum/send", auth, async (req, res) => {
  try {
    const { privateKey, to, amount, network } = req.body;

    if (!privateKey || !to || !amount) {
      return res.status(400).json({ error: "Missing required fields: privateKey, to, amount" });
    }

    const service = network === "bsc" ? bscService : ethereumService;
    const result = await service.sendNativeToken(privateKey, to, amount);

    res.json({
      success: true,
      txHash: result.hash,
      network: network || "ethereum",
      ...result,
    });
  } catch (error) {
    console.error("Error sending transaction:", error);
    res.status(500).json({ error: error.message || "Failed to send transaction" });
  }
});

app.post("/api/ethereum/send-token", auth, async (req, res) => {
  try {
    const { privateKey, tokenAddress, to, amount, network } = req.body;

    if (!privateKey || !tokenAddress || !to || !amount) {
      return res
        .status(400)
        .json({ error: "Missing required fields: privateKey, tokenAddress, to, amount" });
    }

    const service = network === "bsc" ? bscService : ethereumService;
    const result = await service.transferToken(privateKey, tokenAddress, to, amount);

    res.json({
      success: true,
      txHash: result.hash,
      network: network || "ethereum",
      tokenAddress,
      ...result,
    });
  } catch (error) {
    console.error("Error sending token:", error);
    res.status(500).json({ error: error.message || "Failed to send token" });
  }
});

app.post("/api/solana/send", auth, async (req, res) => {
  try {
    const { privateKey, to, amount } = req.body;

    if (!privateKey || !to || !amount) {
      return res.status(400).json({ error: "Missing required fields: privateKey, to, amount" });
    }

    // Convert base58 private key to Uint8Array
    const result = await solanaService.sendSol(privateKey, to, amount);

    res.json({
      success: true,
      signature: result,
      network: "solana",
    });
  } catch (error) {
    console.error("Error sending SOL:", error);
    res.status(500).json({ error: error.message || "Failed to send SOL" });
  }
});

app.post("/api/tron/send", auth, async (req, res) => {
  try {
    const { privateKey, to, amount } = req.body;

    if (!privateKey || !to || !amount) {
      return res.status(400).json({ error: "Missing required fields: privateKey, to, amount" });
    }

    const result = await tronService.sendTrx(privateKey, to, amount);

    res.json({
      success: true,
      txHash: result.txid || result,
      chain: "tron",
      network: TRON_NETWORK,
    });
  } catch (error) {
    console.error("Error sending TRX:", error);
    res.status(500).json({ error: error.message || "Failed to send TRX" });
  }
});

app.post("/api/tron/send-token", auth, async (req, res) => {
  try {
    const { privateKey, tokenAddress, to, amount } = req.body;

    if (!privateKey || !tokenAddress || !to || !amount) {
      return res
        .status(400)
        .json({ error: "Missing required fields: privateKey, tokenAddress, to, amount" });
    }

    const result = await tronService.transferTrc20(privateKey, tokenAddress, to, amount);

    res.json({
      success: true,
      txHash: result.txid || result,
      chain: "tron",
      network: TRON_NETWORK,
      tokenAddress,
    });
  } catch (error) {
    console.error("Error sending TRC20 token:", error);
    res.status(500).json({ error: error.message || "Failed to send TRC20 token" });
  }
});

// ==================== WALLET IMPORT/EXPORT ENDPOINTS ====================

app.post("/api/wallet/import-mnemonic", auth, async (req, res) => {
  try {
    const { mnemonic } = req.body;

    if (!mnemonic) {
      return res.status(400).json({ error: "Mnemonic is required" });
    }

    if (!WalletService.validateMnemonic(mnemonic)) {
      return res.status(400).json({ error: "Invalid mnemonic" });
    }

    const wallet = WalletService.generateMultiChainWallet(mnemonic);

    res.json({
      success: true,
      wallet,
    });
  } catch (error) {
    console.error("Error importing from mnemonic:", error);
    res.status(500).json({ error: error.message || "Failed to import wallet from mnemonic" });
  }
});

app.post("/api/wallet/import-privatekey", auth, async (req, res) => {
  try {
    const { privateKey, chain } = req.body;

    if (!privateKey || !chain) {
      return res.status(400).json({ error: "privateKey and chain are required" });
    }

    const ethers = require("ethers");
    let address;

    if (chain === "ethereum" || chain === "bsc") {
      const wallet = new ethers.Wallet(privateKey);
      address = wallet.address;
    } else if (chain === "solana") {
      const { Keypair } = require("@solana/web3.js");
      const bs58 = require("bs58");
      const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
      address = keypair.publicKey.toString();
    } else if (chain === "tron") {
      const TronWeb = require("tronweb");
      address = TronWeb.address.fromPrivateKey(privateKey);
    } else {
      return res.status(400).json({ error: "Unsupported chain" });
    }

    res.json({
      success: true,
      chain,
      address,
    });
  } catch (error) {
    console.error("Error importing from private key:", error);
    res.status(500).json({ error: error.message || "Failed to import wallet from private key" });
  }
});

app.get("/api/wallet/export", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const balances = listBalancesStmt.all(userId);
    const transactions = listTransactionsStmt.all(userId, 100);

    const exportData = {
      timestamp: new Date().toISOString(),
      user: req.user.username,
      balances,
      transactions,
    };

    res.json({
      success: true,
      data: exportData,
    });
  } catch (error) {
    console.error("Error exporting wallet:", error);
    res.status(500).json({ error: "Failed to export wallet data" });
  }
});

// ==================== BLOCKCHAIN WALLET INTEGRATION ====================

// Link a blockchain address to user account
app.post("/api/blockchain/link-wallet", auth, async (req, res) => {
  try {
    const { chain, address } = req.body;
    const userId = req.user.id;

    if (!chain || !address) {
      return res.status(400).json({ error: "chain and address are required" });
    }

    // Validate address format
    if (chain === "ethereum" || chain === "bsc") {
      if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
        return res.status(400).json({ error: "Invalid Ethereum/BSC address format" });
      }
    }

    // Store address in database
    if (chain === "ethereum") {
      upsertUserEthereumWalletStmt.run(userId, address);
    } else if (chain === "bsc") {
      upsertUserBscWalletStmt.run(userId, address);
    } else if (chain === "solana") {
      upsertUserSolanaWalletStmt.run(userId, address);
    } else if (chain === "tron") {
      upsertUserTronWalletStmt.run(userId, address);
    } else {
      return res
        .status(400)
        .json({ error: "Unsupported chain. Use: ethereum, bsc, solana, or tron" });
    }

    res.json({
      success: true,
      chain,
      address,
      message: `${chain.toUpperCase()} wallet linked successfully`,
    });
  } catch (error) {
    console.error("Error linking wallet:", error);
    res.status(500).json({ error: "Failed to link wallet" });
  }
});

// Get all linked blockchain wallets
app.get("/api/blockchain/linked-wallets", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const ethereumWallet = getUserEthereumWalletStmt.get(userId);
    const bscWallet = getUserBscWalletStmt.get(userId);
    const solanaWallet = getUserSolanaWalletStmt.get(userId);
    const tronWallet = getUserTronWalletStmt.get(userId);

    res.json({
      success: true,
      wallets: {
        ethereum: ethereumWallet || null,
        bsc: bscWallet || null,
        solana: solanaWallet || null,
        tron: tronWallet || null,
      },
    });
  } catch (error) {
    console.error("Error fetching linked wallets:", error);
    res.status(500).json({ error: "Failed to fetch linked wallets" });
  }
});

// Deposit from blockchain (check balance and credit internal account)
app.post("/api/blockchain/deposit", auth, async (req, res) => {
  try {
    const { chain, amount } = req.body;
    const userId = req.user.id;
    const amountAtomic = parseAmountAtomic(amount);

    if (!chain || !amountAtomic) {
      return res.status(400).json({ error: "chain and positive amount are required" });
    }
    const amountNumber = atomicToNumber(amountAtomic);

    // Get linked wallet for this chain
    let walletData;
    let currency;
    let blockchainBalance;

    if (chain === "ethereum") {
      walletData = getUserEthereumWalletStmt.get(userId);
      currency = "ETH";
      if (!walletData) {
        return res.status(400).json({ error: "No Ethereum wallet linked. Link a wallet first." });
      }
      blockchainBalance = parseFloat(await ethereumService.getBalance(walletData.address));
    } else if (chain === "bsc") {
      walletData = getUserBscWalletStmt.get(userId);
      currency = "BNB";
      if (!walletData) {
        return res.status(400).json({ error: "No BSC wallet linked. Link a wallet first." });
      }
      blockchainBalance = parseFloat(await bscService.getBalance(walletData.address));
    } else if (chain === "solana") {
      walletData = getUserSolanaWalletStmt.get(userId);
      currency = "SOL";
      if (!walletData) {
        return res.status(400).json({ error: "No Solana wallet linked. Link a wallet first." });
      }
      blockchainBalance = await solanaService.getBalance(walletData.address);
    } else if (chain === "tron") {
      walletData = getUserTronWalletStmt.get(userId);
      currency = "TRX";
      if (!walletData) {
        return res.status(400).json({ error: "No TRON wallet linked. Link a wallet first." });
      }
      blockchainBalance = await tronService.getBalance(walletData.address);
    } else {
      return res.status(400).json({ error: "Unsupported chain" });
    }

    // Verify blockchain has sufficient balance
    if (blockchainBalance < amountNumber) {
      return res.status(400).json({
        error: `Insufficient blockchain balance. You have ${blockchainBalance} ${currency} on ${chain}, but tried to deposit ${amountNumber} ${currency}`,
        blockchainBalance,
        requestedAmount: amountNumber,
      });
    }

    // Credit internal account
    db.transaction(() => {
      const currentBalance = getBalance(userId, currency);
      setBalance(userId, currency, currentBalance + amountAtomic);
      addTransactionStmt.run(
        userId,
        "BLOCKCHAIN_DEPOSIT",
        currency,
        amountNumber,
        `Deposited from ${chain} blockchain wallet ${walletData.address}`,
        null
      );
    })();

    res.json({
      success: true,
      chain,
      currency,
      amount: amountNumber,
      address: walletData.address,
      blockchainBalance,
      message: `Successfully deposited ${amount} ${currency} from ${chain} blockchain`,
    });
  } catch (error) {
    console.error("Error depositing from blockchain:", error);
    res.status(500).json({ error: error.message || "Failed to deposit from blockchain" });
  }
});

// Withdraw to blockchain (debit internal account and send real transaction)
app.post("/api/blockchain/withdraw", auth, async (req, res) => {
  try {
    const { chain, toAddress, amount, privateKey } = req.body;
    const userId = req.user.id;
    const amountAtomic = parseAmountAtomic(amount);

    if (!chain || !toAddress || !amountAtomic || !privateKey) {
      return res
        .status(400)
        .json({ error: "chain, toAddress, amount, and privateKey are required" });
    }
    const amountNumber = atomicToNumber(amountAtomic);

    // Map chain to currency
    const currencyMap = { ethereum: "ETH", bsc: "BNB", solana: "SOL", tron: "TRX" };
    const currency = currencyMap[chain];

    if (!currency) {
      return res.status(400).json({ error: "Unsupported chain" });
    }

    // Check internal balance
    const currentBalance = getBalance(userId, currency);

    if (currentBalance < amountAtomic) {
      return res.status(400).json({
        error: `Insufficient internal balance. You have ${atomicToNumber(currentBalance)} ${currency}, but tried to withdraw ${amountNumber} ${currency}`,
        currentBalance: atomicToNumber(currentBalance),
        requestedAmount: amountNumber,
      });
    }

    // Send blockchain transaction
    let txResult;
    let txHash;

    try {
      if (chain === "ethereum") {
        txResult = await ethereumService.sendNativeToken(
          privateKey,
          toAddress,
          atomicToDecimalString(amountAtomic)
        );
        txHash = txResult.hash;
      } else if (chain === "bsc") {
        txResult = await bscService.sendNativeToken(
          privateKey,
          toAddress,
          atomicToDecimalString(amountAtomic)
        );
        txHash = txResult.hash;
      } else if (chain === "solana") {
        txHash = await solanaService.sendSol(privateKey, toAddress, amountNumber);
      } else if (chain === "tron") {
        txResult = await tronService.sendTrx(privateKey, toAddress, amountNumber);
        txHash = txResult.txid || txResult;
      }
    } catch (blockchainError) {
      return res.status(500).json({
        error: `Blockchain transaction failed: ${blockchainError.message}`,
        details: blockchainError.message,
      });
    }

    // Debit internal account only after successful blockchain transaction
    db.transaction(() => {
      setBalance(userId, currency, currentBalance - amountAtomic);
      addTransactionStmt.run(
        userId,
        "BLOCKCHAIN_WITHDRAW",
        currency,
        amountNumber,
        `Withdrawn to ${chain} blockchain address ${toAddress}. TxHash: ${txHash}`,
        toAddress
      );
    })();

    res.json({
      success: true,
      chain,
      currency,
      amount: amountNumber,
      toAddress,
      txHash,
      message: `Successfully withdrawn ${amount} ${currency} to ${chain} blockchain`,
      explorerUrl: getExplorerUrl(chain, txHash),
    });
  } catch (error) {
    console.error("Error withdrawing to blockchain:", error);
    res.status(500).json({ error: error.message || "Failed to withdraw to blockchain" });
  }
});

// Helper function to generate explorer URLs
function getExplorerUrl(chain, txHash) {
  const explorers = {
    ethereum: `https://etherscan.io/tx/${txHash}`,
    bsc: `https://bscscan.com/tx/${txHash}`,
    solana: `https://solscan.io/tx/${txHash}`,
    tron: getExplorerTxUrl("tron", txHash),
  };
  return explorers[chain] || null;
}

// ==================== PORTFOLIO ENDPOINTS ====================

app.post("/api/portfolio/load", auth, async (req, res) => {
  try {
    const { addresses } = req.body;

    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return res.status(400).json({ error: "addresses array is required" });
    }

    const portfolio = {
      ethereum: [],
      bsc: [],
      solana: [],
      tron: [],
      totalValue: 0,
    };

    // Get current prices
    const prices = await cryptoDataService.getPrices(
      ["ethereum", "binancecoin", "solana", "tron"],
      "usd"
    );

    // Fetch balances for each address
    for (const addr of addresses) {
      try {
        if (addr.startsWith("0x")) {
          // Ethereum or BSC address
          const ethBalance = await ethereumService.getBalance(addr);
          const bscBalance = await bscService.getBalance(addr);

          if (parseFloat(ethBalance) > 0) {
            portfolio.ethereum.push({
              address: addr,
              balance: ethBalance,
              symbol: "ETH",
              value: parseFloat(ethBalance) * (prices.ethereum?.usd || 0),
            });
          }

          if (parseFloat(bscBalance) > 0) {
            portfolio.bsc.push({
              address: addr,
              balance: bscBalance,
              symbol: "BNB",
              value: parseFloat(bscBalance) * (prices.binancecoin?.usd || 0),
            });
          }
        } else if (addr.startsWith("T")) {
          // TRON address
          const tronBalance = await tronService.getBalance(addr);
          if (parseFloat(tronBalance) > 0) {
            portfolio.tron.push({
              address: addr,
              balance: tronBalance,
              symbol: "TRX",
              value: parseFloat(tronBalance) * (prices.tron?.usd || 0),
            });
          }
        } else {
          // Assume Solana address
          const solBalance = await solanaService.getBalance(addr);
          if (parseFloat(solBalance) > 0) {
            portfolio.solana.push({
              address: addr,
              balance: solBalance,
              symbol: "SOL",
              value: parseFloat(solBalance) * (prices.solana?.usd || 0),
            });
          }
        }
      } catch (error) {
        console.error(`Error fetching balance for ${addr}:`, error.message);
      }
    }

    // Calculate total value
    portfolio.totalValue =
      portfolio.ethereum.reduce((sum, item) => sum + item.value, 0) +
      portfolio.bsc.reduce((sum, item) => sum + item.value, 0) +
      portfolio.solana.reduce((sum, item) => sum + item.value, 0) +
      portfolio.tron.reduce((sum, item) => sum + item.value, 0);

    res.json({
      success: true,
      portfolio,
      prices,
    });
  } catch (error) {
    console.error("Error loading portfolio:", error);
    res.status(500).json({ error: "Failed to load portfolio" });
  }
});

// ============================================================================
// ADDITIONAL CRYPTO DATA SERVICE ENDPOINTS
// ============================================================================

// Get complete coins list
app.get("/api/crypto/coins-list", auth, async (_req, res) => {
  try {
    const coins = await cryptoDataService.getCoinsList();
    res.json({ coins });
  } catch (error) {
    console.error("Error fetching coins list:", error);
    res.status(500).json({ error: "Failed to fetch coins list" });
  }
});

// Get supported vs currencies
app.get("/api/crypto/supported-currencies", auth, async (_req, res) => {
  try {
    const currencies = await cryptoDataService.getSupportedVsCurrencies();
    res.json({ currencies });
  } catch (error) {
    console.error("Error fetching supported currencies:", error);
    res.status(500).json({ error: "Failed to fetch supported currencies" });
  }
});

// Get historical price for specific date
app.get("/api/crypto/historical-price/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { date, vs_currency = "usd" } = req.query;
    const data = await cryptoDataService.getHistoricalPrice(id, date, vs_currency);
    res.json(data);
  } catch (error) {
    console.error("Error fetching historical price:", error);
    res.status(500).json({ error: "Failed to fetch historical price" });
  }
});

// Get markets data with pagination
app.get("/api/crypto/markets", auth, async (req, res) => {
  try {
    const { vs_currency = "usd", ids = [], per_page = 100, page = 1 } = req.query;
    const idsArray = ids ? (Array.isArray(ids) ? ids : ids.split(",")) : [];
    const data = await cryptoDataService.getMarketsData(
      vs_currency,
      idsArray,
      Number(per_page),
      Number(page)
    );
    res.json(data);
  } catch (error) {
    console.error("Error fetching markets data:", error);
    res.status(500).json({ error: "Failed to fetch markets data" });
  }
});

// Convert currency amounts
app.post("/api/crypto/convert", auth, async (req, res) => {
  try {
    const { from, to, amount } = req.body;
    const result = await cryptoDataService.convertCurrency(from, to, Number(amount));
    res.json(result);
  } catch (error) {
    console.error("Error converting currency:", error);
    res.status(500).json({ error: "Failed to convert currency" });
  }
});

// ============================================================================
// ADDITIONAL ETHEREUM SERVICE ENDPOINTS
// ============================================================================

// Get transaction receipt
app.get("/api/ethereum/transaction-receipt/:hash", auth, async (req, res) => {
  try {
    const { hash } = req.params;
    const receipt = await ethereumService.getTransactionReceipt(hash);
    res.json({ receipt });
  } catch (error) {
    console.error("Error fetching transaction receipt:", error);
    res.status(500).json({ error: "Failed to fetch transaction receipt" });
  }
});

// Estimate gas for transaction
app.post("/api/ethereum/estimate-gas", auth, async (req, res) => {
  try {
    const { transaction } = req.body;
    const estimate = await ethereumService.estimateGas(transaction);
    res.json({ estimate });
  } catch (error) {
    console.error("Error estimating gas:", error);
    res.status(500).json({ error: "Failed to estimate gas" });
  }
});

// Call smart contract method (read-only)
app.post("/api/ethereum/call-contract", auth, async (req, res) => {
  try {
    const { contractAddress, abi, method, params = [] } = req.body;
    const result = await ethereumService.callContractMethod(contractAddress, abi, method, params);
    res.json({ result });
  } catch (error) {
    console.error("Error calling contract:", error);
    res.status(500).json({ error: "Failed to call contract method" });
  }
});

// Execute smart contract transaction
app.post("/api/ethereum/execute-contract", auth, async (req, res) => {
  try {
    const { privateKey, contractAddress, abi, method, params = [] } = req.body;
    const receipt = await ethereumService.executeContractMethod(
      privateKey,
      contractAddress,
      abi,
      method,
      params
    );
    res.json({ receipt });
  } catch (error) {
    console.error("Error executing contract:", error);
    res.status(500).json({ error: "Failed to execute contract method" });
  }
});

// ============================================================================
// ADDITIONAL BSC SERVICE ENDPOINTS
// ============================================================================

// Get BSC transaction details
app.get("/api/bsc/transaction/:hash", auth, async (req, res) => {
  try {
    const transaction = await bscService.getTransaction(req.params.hash);
    res.json({ transaction });
  } catch (error) {
    console.error("Error fetching BSC transaction:", error);
    res.status(500).json({ error: "Failed to fetch BSC transaction" });
  }
});

// Get BSC transaction receipt
app.get("/api/bsc/transaction-receipt/:hash", auth, async (req, res) => {
  try {
    const { hash } = req.params;
    const receipt = await bscService.getTransactionReceipt(hash);
    res.json({ receipt });
  } catch (error) {
    console.error("Error fetching BSC transaction receipt:", error);
    res.status(500).json({ error: "Failed to fetch transaction receipt" });
  }
});

// Estimate gas for BSC transaction
app.post("/api/bsc/estimate-gas", auth, async (req, res) => {
  try {
    const { transaction } = req.body;
    const estimate = await bscService.estimateGas(transaction);
    res.json({ estimate });
  } catch (error) {
    console.error("Error estimating BSC gas:", error);
    res.status(500).json({ error: "Failed to estimate gas" });
  }
});

// Call BSC smart contract method (read-only)
app.post("/api/bsc/call-contract", auth, async (req, res) => {
  try {
    const { contractAddress, abi, method, params = [] } = req.body;
    const result = await bscService.callContractMethod(contractAddress, abi, method, params);
    res.json({ result });
  } catch (error) {
    console.error("Error calling BSC contract:", error);
    res.status(500).json({ error: "Failed to call contract method" });
  }
});

// Execute BSC smart contract transaction
app.post("/api/bsc/execute-contract", auth, async (req, res) => {
  try {
    const { privateKey, contractAddress, abi, method, params = [] } = req.body;
    const receipt = await bscService.executeContractMethod(
      privateKey,
      contractAddress,
      abi,
      method,
      params
    );
    res.json({ receipt });
  } catch (error) {
    console.error("Error executing BSC contract:", error);
    res.status(500).json({ error: "Failed to execute contract method" });
  }
});

// Get BEP20 token balance
app.get("/api/bsc/token-balance", auth, async (req, res) => {
  try {
    const { tokenAddress, walletAddress } = req.query;
    const balance = await bscService.getTokenBalance(tokenAddress, walletAddress);
    res.json({ balance, tokenAddress, walletAddress });
  } catch (error) {
    console.error("Error fetching BEP20 token balance:", error);
    res.status(500).json({ error: "Failed to fetch token balance" });
  }
});

// Get BEP20 token info
app.get("/api/bsc/token-info/:address", auth, async (req, res) => {
  try {
    const { address } = req.params;
    const info = await bscService.getTokenInfo(address);
    res.json({ ...info, address });
  } catch (error) {
    console.error("Error fetching BEP20 token info:", error);
    res.status(500).json({ error: "Failed to fetch token info" });
  }
});

// Get BSC gas price
app.get("/api/bsc/gas-price", auth, async (req, res) => {
  try {
    const gasPrice = await bscService.getGasPrice();
    res.json({ gasPrice, unit: "gwei" });
  } catch (error) {
    console.error("Error fetching BSC gas price:", error);
    res.status(500).json({ error: "Failed to fetch gas price" });
  }
});

// ============================================================================
// ADDITIONAL SOLANA SERVICE ENDPOINTS
// ============================================================================

// Get Solana account info
app.get("/api/solana/account-info/:address", auth, async (req, res) => {
  try {
    const { address } = req.params;
    const accountInfo = await solanaService.getAccountInfo(address);
    res.json({ accountInfo, address });
  } catch (error) {
    console.error("Error fetching Solana account info:", error);
    res.status(500).json({ error: "Failed to fetch account info" });
  }
});

// Get signature status
app.get("/api/solana/signature-status/:signature", auth, async (req, res) => {
  try {
    const { signature } = req.params;
    const status = await solanaService.getSignatureStatus(signature);
    res.json({ status, signature });
  } catch (error) {
    console.error("Error fetching signature status:", error);
    res.status(500).json({ error: "Failed to fetch signature status" });
  }
});

// Get recent blockhash
app.get("/api/solana/recent-blockhash", auth, async (_req, res) => {
  try {
    const blockhash = await solanaService.getRecentBlockhash();
    res.json({ blockhash });
  } catch (error) {
    console.error("Error fetching recent blockhash:", error);
    res.status(500).json({ error: "Failed to fetch recent blockhash" });
  }
});

// Request SOL airdrop (devnet/testnet only)
app.post("/api/solana/airdrop", auth, async (req, res) => {
  try {
    const { address, amount = 1 } = req.body;
    const signature = await solanaService.airdrop(address, Number(amount));
    res.json({ signature, address, amount });
  } catch (error) {
    console.error("Error requesting airdrop:", error);
    res.status(500).json({ error: "Failed to request airdrop (may only work on devnet/testnet)" });
  }
});

// Get transaction fee
app.post("/api/solana/transaction-fee", auth, async (req, res) => {
  try {
    const { message } = req.body;
    const fee = await solanaService.getTransactionFee(message);
    res.json({ fee, unit: "lamports" });
  } catch (error) {
    console.error("Error fetching transaction fee:", error);
    res.status(500).json({ error: "Failed to fetch transaction fee" });
  }
});

// Get epoch info
app.get("/api/solana/epoch-info", auth, async (_req, res) => {
  try {
    const epochInfo = await solanaService.getEpochInfo();
    res.json({ epochInfo });
  } catch (error) {
    console.error("Error fetching epoch info:", error);
    res.status(500).json({ error: "Failed to fetch epoch info" });
  }
});

// Get performance samples
app.get("/api/solana/performance-samples", auth, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const samples = await solanaService.getRecentPerformanceSamples(Number(limit));
    res.json({ samples });
  } catch (error) {
    console.error("Error fetching performance samples:", error);
    res.status(500).json({ error: "Failed to fetch performance samples" });
  }
});

// Get SPL token balance
app.get("/api/solana/token-balance", auth, async (req, res) => {
  try {
    const { walletAddress, tokenMintAddress } = req.query;
    const balance = await solanaService.getTokenBalance(walletAddress, tokenMintAddress);
    res.json({ balance, walletAddress, tokenMintAddress });
  } catch (error) {
    console.error("Error fetching SPL token balance:", error);
    res.status(500).json({ error: "Failed to fetch token balance" });
  }
});

// ============================================================================
// ADDITIONAL TRON SERVICE ENDPOINTS
// ============================================================================

// Get TRON transaction info
app.get("/api/tron/transaction-info/:hash", auth, async (req, res) => {
  try {
    const { hash } = req.params;
    const info = await tronService.getTransactionInfo(hash);
    res.json({ info, hash });
  } catch (error) {
    console.error("Error fetching TRON transaction info:", error);
    res.status(500).json({ error: "Failed to fetch transaction info" });
  }
});

// Get TRON bandwidth
app.get("/api/tron/bandwidth/:address", auth, async (req, res) => {
  try {
    const { address } = req.params;
    const bandwidth = await tronService.getBandwidth(address);
    res.json({ bandwidth, address });
  } catch (error) {
    console.error("Error fetching TRON bandwidth:", error);
    res.status(500).json({ error: "Failed to fetch bandwidth" });
  }
});

// Get TRON account resources
app.get("/api/tron/account-resources/:address", auth, async (req, res) => {
  try {
    const { address } = req.params;
    const resources = await tronService.getAccountResources(address);
    res.json({ resources, address });
  } catch (error) {
    console.error("Error fetching TRON account resources:", error);
    res.status(500).json({ error: "Failed to fetch account resources" });
  }
});

// Sign message with TRON private key
app.post("/api/tron/sign-message", auth, async (req, res) => {
  try {
    const { privateKey, message } = req.body;
    const signature = await tronService.signMessage(privateKey, message);
    res.json({ signature, message });
  } catch (error) {
    console.error("Error signing message:", error);
    res.status(500).json({ error: "Failed to sign message" });
  }
});

// Verify TRON signature
app.post("/api/tron/verify-signature", auth, async (req, res) => {
  try {
    const { message, signature, address } = req.body;
    const isValid = await tronService.verifySignature(message, signature, address);
    res.json({ isValid, message, signature, address });
  } catch (error) {
    console.error("Error verifying signature:", error);
    res.status(500).json({ error: "Failed to verify signature" });
  }
});

// Call TRON smart contract method (read-only)
app.post("/api/tron/call-contract", auth, async (req, res) => {
  try {
    const { contractAddress, method, params = [] } = req.body;
    const result = await tronService.callContractMethod(contractAddress, method, params);
    res.json({ result });
  } catch (error) {
    console.error("Error calling TRON contract:", error);
    res.status(500).json({ error: "Failed to call contract method" });
  }
});

// Execute TRON smart contract transaction
app.post("/api/tron/execute-contract", auth, async (req, res) => {
  try {
    const { privateKey, contractAddress, method, params = [] } = req.body;
    const receipt = await tronService.executeContractMethod(
      privateKey,
      contractAddress,
      method,
      params
    );
    res.json({ receipt });
  } catch (error) {
    console.error("Error executing TRON contract:", error);
    res.status(500).json({ error: "Failed to execute contract method" });
  }
});

// TRON JSON-RPC call
app.post("/api/tron/jsonrpc-call", auth, async (req, res) => {
  try {
    const { method, params = [] } = req.body;
    const result = await tronService.jsonRpcCall(method, params);
    res.json({ result });
  } catch (error) {
    console.error("Error making TRON JSON-RPC call:", error);
    res.status(500).json({ error: "Failed to make JSON-RPC call" });
  }
});

// TRON wallet solidity query
app.post("/api/tron/wallet-solidity-query", auth, async (req, res) => {
  try {
    const { endpoint, data = {} } = req.body;
    const result = await tronService.walletSolidityQuery(endpoint, data);
    res.json({ result });
  } catch (error) {
    console.error("Error querying TRON wallet solidity:", error);
    res.status(500).json({ error: "Failed to query wallet solidity" });
  }
});

// ============================================================================
// WEBSOCKET SERVICE ENDPOINTS
// ============================================================================

// Get connected clients count
app.get("/api/websocket/clients", auth, (_req, res) => {
  try {
    const count = wsService.connectedClients.size;
    const clients = Array.from(wsService.connectedClients.entries()).map(([id, client]) => ({
      id,
      userId: client.userId,
      subscriptions: Array.from(client.subscriptions),
    }));
    res.json({ count, clients });
  } catch (error) {
    console.error("Error fetching WebSocket clients:", error);
    res.status(500).json({ error: "Failed to fetch WebSocket clients" });
  }
});

// Broadcast message to channel
app.post("/api/websocket/broadcast", auth, (req, res) => {
  try {
    const { channel, event, data } = req.body;
    wsService.broadcast(channel, event, data);
    res.json({ success: true, channel, event });
  } catch (error) {
    console.error("Error broadcasting message:", error);
    res.status(500).json({ error: "Failed to broadcast message" });
  }
});

// Send message to specific user
app.post("/api/websocket/send-to-user", auth, (req, res) => {
  try {
    const { userId, event, data } = req.body;
    wsService.sendToUser(userId, event, data);
    res.json({ success: true, userId, event });
  } catch (error) {
    console.error("Error sending message to user:", error);
    res.status(500).json({ error: "Failed to send message to user" });
  }
});

// Generate QR code for crypto address
app.get("/api/qrcode/generate", auth, async (req, res) => {
  try {
    const { address, chain } = req.query;

    if (!address) {
      return res.status(400).json({ error: "Address is required" });
    }

    // Validate address format based on chain
    if (chain === "ethereum" || chain === "bsc") {
      if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
        return res.status(400).json({ error: "Invalid Ethereum/BSC address format" });
      }
    }

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(address, {
      errorCorrectionLevel: "M",
      type: "image/png",
      width: 300,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });

    res.json({
      success: true,
      address,
      chain: chain || "unknown",
      qrCode: qrCodeDataUrl,
    });
  } catch (error) {
    console.error("Error generating QR code:", error);
    res.status(500).json({ error: "Failed to generate QR code" });
  }
});

// ========================
// AI TRADING BOT ENDPOINTS
// ========================

/**
 * Create a new trading bot
 */
app.post("/api/bot/create", auth, async (req, res) => {
  try {
    const {
      name,
      strategy,
      symbol,
      tradingPair,
      interval,
      capital,
      riskPerTrade,
      maxPositions,
      stopLoss,
      takeProfit,
    } = req.body;

    if (!name || !strategy || !symbol) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const botConfig = {
      userId: req.user.id,
      strategy,
      symbol,
      tradingPair: tradingPair || `${symbol}/USDT`,
      interval: interval || "5m",
      capital: capital || 1000,
      riskPerTrade: riskPerTrade || 2,
      maxPositions: maxPositions || 3,
      stopLoss: stopLoss || 2,
      takeProfit: takeProfit || 5,
    };

    const bot = new TradingBot(botConfig);

    // Save bot to database
    const insertBot = db.prepare(`
      INSERT INTO trading_bots (bot_id, user_id, name, strategy, symbol, trading_pair, interval, 
                                capital, risk_per_trade, max_positions, stop_loss, take_profit)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertBot.run(
      bot.botId,
      req.user.id,
      name,
      strategy,
      symbol,
      tradingPair || `${symbol}/USDT`,
      interval || "5m",
      capital || 1000,
      riskPerTrade || 2,
      maxPositions || 3,
      stopLoss || 2,
      takeProfit || 5
    );

    res.json({
      success: true,
      bot: {
        botId: bot.botId,
        name,
        ...botConfig,
      },
    });
  } catch (error) {
    console.error("Error creating bot:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Start a trading bot
 */
app.post("/api/bot/:botId/start", auth, async (req, res) => {
  try {
    const { botId } = req.params;

    // Check if bot exists and belongs to user
    const botData = db
      .prepare("SELECT * FROM trading_bots WHERE bot_id = ? AND user_id = ?")
      .get(botId, req.user.id);

    if (!botData) {
      return res.status(404).json({ error: "Bot not found" });
    }

    // Check if bot is already running
    if (activeBots.has(botId)) {
      return res.status(400).json({ error: "Bot is already running" });
    }

    // Create bot instance
    const bot = new TradingBot({
      botId: botData.bot_id,
      userId: botData.user_id,
      strategy: botData.strategy,
      symbol: botData.symbol,
      tradingPair: botData.trading_pair,
      interval: botData.interval,
      capital: botData.capital,
      riskPerTrade: botData.risk_per_trade,
      maxPositions: botData.max_positions,
      stopLoss: botData.stop_loss,
      takeProfit: botData.take_profit,
    });

    // Start the bot
    const result = await bot.start();
    activeBots.set(botId, bot);

    // Update database
    db.prepare(
      "UPDATE trading_bots SET is_running = 1, updated_at = datetime('now') WHERE bot_id = ?"
    ).run(botId);

    res.json(result);
  } catch (error) {
    console.error("Error starting bot:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Stop a trading bot
 */
app.post("/api/bot/:botId/stop", auth, async (req, res) => {
  try {
    const { botId } = req.params;

    const bot = activeBots.get(botId);
    if (!bot) {
      return res.status(404).json({ error: "Bot not found or not running" });
    }

    // Check ownership
    if (bot.userId !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const result = bot.stop();
    activeBots.delete(botId);

    // Update database
    db.prepare(
      "UPDATE trading_bots SET is_running = 0, updated_at = datetime('now') WHERE bot_id = ?"
    ).run(botId);

    // Save performance
    const perf = result.performance;
    db.prepare(
      `
      INSERT OR REPLACE INTO bot_performance 
      (bot_id, user_id, total_trades, wins, losses, total_profit, total_loss, win_rate, profit_factor, max_drawdown, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `
    ).run(
      botId,
      req.user.id,
      perf.totalTrades,
      perf.wins,
      perf.losses,
      perf.totalProfit,
      perf.totalLoss,
      perf.winRate,
      perf.profitFactor,
      perf.maxDrawdown
    );

    res.json(result);
  } catch (error) {
    console.error("Error stopping bot:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get bot status
 */
app.get("/api/bot/:botId/status", auth, async (req, res) => {
  try {
    const { botId } = req.params;

    const bot = activeBots.get(botId);
    if (bot) {
      // Bot is running
      return res.json(bot.getStatus());
    }

    // Bot is not running, get from database
    const botData = db
      .prepare("SELECT * FROM trading_bots WHERE bot_id = ? AND user_id = ?")
      .get(botId, req.user.id);

    if (!botData) {
      return res.status(404).json({ error: "Bot not found" });
    }

    res.json({
      botId: botData.bot_id,
      userId: botData.user_id,
      name: botData.name,
      isRunning: false,
      strategy: botData.strategy,
      symbol: botData.symbol,
      tradingPair: botData.trading_pair,
      interval: botData.interval,
      capital: botData.capital,
      openPositions: 0,
      totalPositions: 0,
    });
  } catch (error) {
    console.error("Error getting bot status:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all user bots
 */
app.get("/api/bot/list", auth, async (req, res) => {
  try {
    const bots = db
      .prepare("SELECT * FROM trading_bots WHERE user_id = ? ORDER BY created_at DESC")
      .all(req.user.id);

    const botsWithStatus = bots.map((bot) => {
      const activeBot = activeBots.get(bot.bot_id);
      return {
        ...bot,
        isRunning: bot.is_running === 1,
        status: activeBot ? activeBot.getStatus() : null,
      };
    });

    res.json({ bots: botsWithStatus });
  } catch (error) {
    console.error("Error listing bots:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete a bot
 */
app.delete("/api/bot/:botId", auth, async (req, res) => {
  try {
    const { botId } = req.params;

    // Stop bot if running
    if (activeBots.has(botId)) {
      const bot = activeBots.get(botId);
      if (bot.userId === req.user.id) {
        bot.stop();
        activeBots.delete(botId);
      }
    }

    // Delete from database
    const result = db
      .prepare("DELETE FROM trading_bots WHERE bot_id = ? AND user_id = ?")
      .run(botId, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Bot not found" });
    }

    res.json({ success: true, message: "Bot deleted successfully" });
  } catch (error) {
    console.error("Error deleting bot:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get bot performance
 */
app.get("/api/bot/:botId/performance", auth, async (req, res) => {
  try {
    const { botId } = req.params;

    const bot = activeBots.get(botId);
    if (bot) {
      return res.json(bot.getPerformance());
    }

    // Get from database
    const perf = db
      .prepare("SELECT * FROM bot_performance WHERE bot_id = ? AND user_id = ?")
      .get(botId, req.user.id);

    if (!perf) {
      return res.json({
        totalTrades: 0,
        wins: 0,
        losses: 0,
        totalProfit: 0,
        totalLoss: 0,
        winRate: 0,
        profitFactor: 0,
        maxDrawdown: 0,
        netProfit: 0,
      });
    }

    res.json({
      totalTrades: perf.total_trades,
      wins: perf.wins,
      losses: perf.losses,
      totalProfit: perf.total_profit,
      totalLoss: perf.total_loss,
      winRate: perf.win_rate,
      profitFactor: perf.profit_factor,
      maxDrawdown: perf.max_drawdown,
      netProfit: perf.total_profit - perf.total_loss,
    });
  } catch (error) {
    console.error("Error getting bot performance:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get bot trades
 */
app.get("/api/bot/:botId/trades", auth, async (req, res) => {
  try {
    const { botId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const bot = activeBots.get(botId);
    if (bot) {
      return res.json({ trades: bot.getRecentTrades(limit) });
    }

    // Get from database
    const trades = db
      .prepare(
        `
      SELECT * FROM bot_trades 
      WHERE bot_id = ? AND user_id = ? 
      ORDER BY entry_timestamp DESC 
      LIMIT ?
    `
      )
      .all(botId, req.user.id, limit);

    res.json({ trades });
  } catch (error) {
    console.error("Error getting bot trades:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get available strategies
 */
app.get("/api/bot/strategies", auth, (req, res) => {
  res.json({
    strategies: [
      {
        id: "sma_crossover",
        name: "SMA Crossover",
        description: "Golden cross (20/50 SMA) buy signal, death cross sell signal",
        risk: "Medium",
        timeframe: "5m-1h",
      },
      {
        id: "rsi_oversold",
        name: "RSI Oversold/Overbought",
        description: "Buy when RSI < 30, sell when RSI > 70",
        risk: "Medium",
        timeframe: "5m-4h",
      },
      {
        id: "macd_crossover",
        name: "MACD Crossover",
        description: "Buy on bullish MACD crossover, sell on bearish",
        risk: "Medium",
        timeframe: "15m-4h",
      },
      {
        id: "bollinger_bounce",
        name: "Bollinger Bands Bounce",
        description: "Buy at lower band, sell at upper band",
        risk: "Low",
        timeframe: "5m-1h",
      },
      {
        id: "mean_reversion",
        name: "Mean Reversion",
        description: "Trade deviations from 20-period SMA",
        risk: "Medium",
        timeframe: "5m-1h",
      },
      {
        id: "trend_following",
        name: "Trend Following",
        description: "Follow strong trends using 50 EMA and ATR",
        risk: "High",
        timeframe: "1h-1d",
      },
      {
        id: "breakout",
        name: "Breakout",
        description: "Trade breakouts with volume confirmation",
        risk: "High",
        timeframe: "15m-4h",
      },
    ],
  });
});

/**
 * Get bot open positions
 */
app.get("/api/bot/:botId/positions", auth, async (req, res) => {
  try {
    const { botId } = req.params;

    const bot = activeBots.get(botId);
    if (!bot) {
      return res.status(404).json({ error: "Bot not found or not running" });
    }

    if (bot.userId !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    res.json({ positions: bot.getOpenPositions() });
  } catch (error) {
    console.error("Error getting bot positions:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// MARGIN TRADING API ENDPOINTS
// ==========================================

/**
 * Initialize margin account
 */
app.post("/api/margin/account/init", auth, async (req, res) => {
  try {
    const { initialBalance, riskTier } = req.body;
    const account = marginTradingService.initializeMarginAccount(
      req.user.id,
      initialBalance || 0,
      riskTier || "medium"
    );
    res.json(account);
  } catch (error) {
    console.error("Error initializing margin account:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get margin account
 */
app.get("/api/margin/account", auth, async (req, res) => {
  try {
    const account = marginTradingService.getMarginAccount(req.user.id);
    if (!account) {
      return res.status(404).json({ error: "Margin account not found" });
    }
    res.json(account);
  } catch (error) {
    console.error("Error getting margin account:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Open margin position
 */
app.post("/api/margin/position/open", auth, async (req, res) => {
  try {
    const validation = RequestValidator.validateTradingParams(req.body);
    if (!validation.valid) {
      return res.status(400).json({ errors: validation.errors });
    }
    const position = marginTradingService.openPosition(req.user.id, req.body);
    res.json(position);
  } catch (error) {
    console.error("Error opening margin position:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Close margin position
 */
app.post("/api/margin/position/:positionId/close", auth, async (req, res) => {
  try {
    const { positionId } = req.params;
    const { closePrice } = req.body;
    const position = marginTradingService.closePosition(positionId, closePrice);
    res.json(position);
  } catch (error) {
    console.error("Error closing margin position:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Get user margin positions
 */
app.get("/api/margin/positions", auth, async (req, res) => {
  try {
    const { status } = req.query;
    const positions = marginTradingService.getUserPositions(req.user.id, status);
    res.json({ positions });
  } catch (error) {
    console.error("Error getting margin positions:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get margin trading statistics
 */
app.get("/api/margin/statistics", auth, async (req, res) => {
  try {
    const stats = marginTradingService.getStatistics(req.user.id);
    res.json(stats);
  } catch (error) {
    console.error("Error getting margin statistics:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// P2P TRADING API ENDPOINTS
// ==========================================

/**
 * Create P2P order
 */
app.post("/api/p2p/order/create", auth, async (req, res) => {
  try {
    const order = p2pTradingService.createOrder(req.user.id, req.body);
    res.json(order);
  } catch (error) {
    console.error("Error creating P2P order:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Get active P2P orders
 */
app.get("/api/p2p/orders", auth, async (req, res) => {
  try {
    const orders = p2pTradingService.getActiveOrders(req.query);
    res.json({ orders });
  } catch (error) {
    console.error("Error getting P2P orders:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get user P2P orders
 */
app.get("/api/p2p/orders/my", auth, async (req, res) => {
  try {
    const { status } = req.query;
    const orders = p2pTradingService.getUserOrders(req.user.id, status);
    res.json({ orders });
  } catch (error) {
    console.error("Error getting user P2P orders:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Accept P2P order
 */
app.post("/api/p2p/order/:orderId/accept", auth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { orderAmount, paymentMethod } = req.body;
    const trade = p2pTradingService.acceptOrder(orderId, req.user.id, orderAmount, paymentMethod);
    res.json(trade);
  } catch (error) {
    console.error("Error accepting P2P order:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Mark payment sent
 */
app.post("/api/p2p/trade/:tradeId/payment-sent", auth, async (req, res) => {
  try {
    const { tradeId } = req.params;
    const { paymentDetails } = req.body;
    const trade = p2pTradingService.markPaymentSent(tradeId, req.user.id, paymentDetails);
    res.json(trade);
  } catch (error) {
    console.error("Error marking payment sent:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Confirm payment received
 */
app.post("/api/p2p/trade/:tradeId/payment-received", auth, async (req, res) => {
  try {
    const { tradeId } = req.params;
    const trade = p2pTradingService.confirmPaymentReceived(tradeId, req.user.id);
    res.json(trade);
  } catch (error) {
    console.error("Error confirming payment:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Get payment methods
 */
app.get("/api/p2p/payment-methods", (_req, res) => {
  try {
    const methods = p2pTradingService.getPaymentMethods();
    res.json({ paymentMethods: methods });
  } catch (error) {
    console.error("Error getting payment methods:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// TOKEN SWAP API ENDPOINTS
// ==========================================

/**
 * Get swap quote
 */
app.post("/api/swap/quote", auth, async (req, res) => {
  try {
    const { fromToken, toToken, amountIn } = req.body;
    const quote = tokenSwapService.getQuote(fromToken, toToken, parseFloat(amountIn));
    res.json({ quote });
  } catch (error) {
    console.error("Error getting swap quote:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Execute swap
 */
app.post("/api/swap/execute", auth, async (req, res) => {
  try {
    const { fromToken, toToken, amountIn, slippageTolerance } = req.body;
    const swap = tokenSwapService.executeSwap(
      req.user.id,
      fromToken,
      toToken,
      amountIn,
      slippageTolerance
    );
    res.json(swap);
  } catch (error) {
    console.error("Error executing swap:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Get swap history
 */
app.get("/api/swap/history", auth, async (req, res) => {
  try {
    const { limit } = req.query;
    const history = tokenSwapService.getSwapHistory(req.user.id, parseInt(limit) || 50);
    res.json({ swaps: history });
  } catch (error) {
    console.error("Error getting swap history:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get liquidity pools
 */
app.get("/api/swap/pools", (_req, res) => {
  try {
    const pools = tokenSwapService.getLiquidityPools();
    res.json({ pools });
  } catch (error) {
    console.error("Error getting pools:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// DEMO TRADING API ENDPOINTS
// ==========================================

/**
 * Get demo account
 */
app.get("/api/demo/account", auth, async (req, res) => {
  try {
    const account = demoTradingService.getDemoAccount(req.user.id);
    res.json(account);
  } catch (error) {
    console.error("Error getting demo account:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Reset demo account
 */
app.post("/api/demo/account/reset", auth, async (req, res) => {
  try {
    const account = demoTradingService.resetDemoAccount(req.user.id);
    res.json(account);
  } catch (error) {
    console.error("Error resetting demo account:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Execute demo trade
 */
app.post("/api/demo/trade", auth, async (req, res) => {
  try {
    const result = demoTradingService.executeDemoTrade(req.user.id, req.body);
    res.json(result);
  } catch (error) {
    console.error("Error executing demo trade:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Get demo performance
 */
app.get("/api/demo/performance", auth, async (req, res) => {
  try {
    const performance = demoTradingService.getDemoPerformance(req.user.id);
    res.json(performance);
  } catch (error) {
    console.error("Error getting demo performance:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Toggle demo mode
 */
app.post("/api/demo/toggle", auth, async (req, res) => {
  try {
    const { enabled } = req.body;
    const account = demoTradingService.toggleDemoMode(req.user.id, enabled);
    res.json(account);
  } catch (error) {
    console.error("Error toggling demo mode:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// COPY TRADING API ENDPOINTS
// ==========================================

/**
 * Register as trader
 */
app.post("/api/copy-trading/trader/register", auth, async (req, res) => {
  try {
    const trader = copyTradingService.registerTrader(req.user.id, req.body);
    res.json(trader);
  } catch (error) {
    console.error("Error registering trader:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Get all traders
 */
app.get("/api/copy-trading/traders", auth, async (req, res) => {
  try {
    const traders = copyTradingService.getAllTraders(req.query);
    res.json({ traders });
  } catch (error) {
    console.error("Error getting traders:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get top traders
 */
app.get("/api/copy-trading/traders/top", auth, async (req, res) => {
  try {
    const { limit } = req.query;
    const traders = copyTradingService.getTopTraders(parseInt(limit) || 10);
    res.json({ traders });
  } catch (error) {
    console.error("Error getting top traders:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Follow trader
 */
app.post("/api/copy-trading/follow/:traderId", auth, async (req, res) => {
  try {
    const { traderId } = req.params;
    const settings = copyTradingService.followTrader(req.user.id, parseInt(traderId), req.body);
    res.json(settings);
  } catch (error) {
    console.error("Error following trader:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Unfollow trader
 */
app.post("/api/copy-trading/unfollow/:traderId", auth, async (req, res) => {
  try {
    const { traderId } = req.params;
    const settings = copyTradingService.unfollowTrader(req.user.id, parseInt(traderId));
    res.json(settings);
  } catch (error) {
    console.error("Error unfollowing trader:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Get follower statistics
 */
app.get("/api/copy-trading/stats", auth, async (req, res) => {
  try {
    const stats = copyTradingService.getFollowerStats(req.user.id);
    res.json(stats);
  } catch (error) {
    console.error("Error getting follower stats:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// PREDICTION MARKETS API ENDPOINTS
// ==========================================

/**
 * Get active markets
 */
app.get("/api/prediction/markets", auth, async (req, res) => {
  try {
    const markets = predictionMarketsService.getActiveMarkets(req.query);
    res.json({ markets });
  } catch (error) {
    console.error("Error getting markets:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get market details
 */
app.get("/api/prediction/market/:marketId", auth, async (req, res) => {
  try {
    const { marketId } = req.params;
    const market = predictionMarketsService.getMarket(marketId);
    if (!market) {
      return res.status(404).json({ error: "Market not found" });
    }
    res.json(market);
  } catch (error) {
    console.error("Error getting market:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Place prediction
 */
app.post("/api/prediction/predict", auth, async (req, res) => {
  try {
    const { marketId, prediction, amount } = req.body;
    const result = predictionMarketsService.placePrediction(
      req.user.id,
      marketId,
      prediction,
      amount
    );
    res.json(result);
  } catch (error) {
    console.error("Error placing prediction:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Get user positions
 */
app.get("/api/prediction/positions", auth, async (req, res) => {
  try {
    const { status } = req.query;
    const positions = predictionMarketsService.getUserPositions(req.user.id, status);
    res.json({ positions });
  } catch (error) {
    console.error("Error getting positions:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get user statistics
 */
app.get("/api/prediction/stats", auth, async (req, res) => {
  try {
    const stats = predictionMarketsService.getUserStats(req.user.id);
    res.json(stats);
  } catch (error) {
    console.error("Error getting stats:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get leaderboard
 */
app.get("/api/prediction/leaderboard", auth, async (req, res) => {
  try {
    const { limit } = req.query;
    const leaderboard = predictionMarketsService.getLeaderboard(parseInt(limit) || 100);
    res.json({ leaderboard });
  } catch (error) {
    console.error("Error getting leaderboard:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// API KEYS MANAGEMENT ENDPOINTS
// ==========================================

/**
 * Generate API key
 */
app.post("/api/keys/generate", auth, async (req, res) => {
  try {
    const apiKey = apiKeysService.generateAPIKey(req.user.id, req.body);
    res.json(apiKey);
  } catch (error) {
    console.error("Error generating API key:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Get user API keys
 */
app.get("/api/keys", auth, async (req, res) => {
  try {
    const keys = apiKeysService.getUserAPIKeys(req.user.id);
    res.json({ keys });
  } catch (error) {
    console.error("Error getting API keys:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update API key
 */
app.put("/api/keys/:keyId", auth, async (req, res) => {
  try {
    const { keyId } = req.params;
    const updatedKey = apiKeysService.updateAPIKey(req.user.id, keyId, req.body);
    res.json(updatedKey);
  } catch (error) {
    console.error("Error updating API key:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Revoke API key
 */
app.delete("/api/keys/:keyId", auth, async (req, res) => {
  try {
    const { keyId } = req.params;
    const result = apiKeysService.revokeAPIKey(req.user.id, keyId);
    res.json(result);
  } catch (error) {
    console.error("Error revoking API key:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Get available permissions
 */
app.get("/api/keys/permissions", auth, async (req, res) => {
  try {
    const permissions = apiKeysService.getAvailablePermissions();
    res.json({ permissions });
  } catch (error) {
    console.error("Error getting permissions:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get available tiers
 */
app.get("/api/keys/tiers", auth, async (req, res) => {
  try {
    const tiers = apiKeysService.getAvailableTiers();
    res.json({ tiers });
  } catch (error) {
    console.error("Error getting tiers:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// METATRADER API ENDPOINTS
// ==========================================

/**
 * Check MetaTrader connection
 */
app.get("/api/metatrader/status", auth, async (req, res) => {
  try {
    const status = await metaTraderService.checkConnection();
    res.json(status);
  } catch (error) {
    console.error("Error checking MetaTrader status:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get account information
 */
app.get("/api/metatrader/account", auth, async (req, res) => {
  try {
    const accountInfo = await metaTraderService.getAccountInfo();
    res.json(accountInfo);
  } catch (error) {
    console.error("Error getting account info:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get account balance
 */
app.get("/api/metatrader/balance", auth, async (req, res) => {
  try {
    const balance = await metaTraderService.getAccountBalance();
    res.json(balance);
  } catch (error) {
    console.error("Error getting balance:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get available symbols
 */
app.get("/api/metatrader/symbols", auth, async (req, res) => {
  try {
    const symbols = await metaTraderService.getSymbols();
    res.json(symbols);
  } catch (error) {
    console.error("Error getting symbols:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get symbol information
 */
app.get("/api/metatrader/symbols/:symbol", auth, async (req, res) => {
  try {
    const { symbol } = req.params;
    const symbolInfo = await metaTraderService.getSymbolInfo(symbol);
    res.json(symbolInfo);
  } catch (error) {
    console.error("Error getting symbol info:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get current price
 */
app.get("/api/metatrader/price/:symbol", auth, async (req, res) => {
  try {
    const { symbol } = req.params;
    const price = await metaTraderService.getPrice(symbol);
    res.json(price);
  } catch (error) {
    console.error("Error getting price:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get historical data
 */
app.get("/api/metatrader/history/:symbol", auth, async (req, res) => {
  try {
    const { symbol } = req.params;
    const { timeframe, limit } = req.query;
    const history = await metaTraderService.getHistoricalData(
      symbol,
      timeframe || "1h",
      parseInt(limit) || 100
    );
    res.json(history);
  } catch (error) {
    console.error("Error getting historical data:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Place market order
 */
app.post("/api/metatrader/order/market", auth, async (req, res) => {
  try {
    const { symbol, type, volume, stopLoss, takeProfit, comment } = req.body;

    if (!symbol || !type || !volume) {
      return res.status(400).json({ error: "Symbol, type, and volume are required" });
    }

    const order = await metaTraderService.placeMarketOrder({
      symbol,
      type,
      volume,
      stopLoss,
      takeProfit,
      comment,
    });

    res.json(order);
  } catch (error) {
    console.error("Error placing market order:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Place pending order
 */
app.post("/api/metatrader/order/pending", auth, async (req, res) => {
  try {
    const { symbol, type, volume, price, stopLoss, takeProfit, expiration, comment } = req.body;

    if (!symbol || !type || !volume || !price) {
      return res.status(400).json({ error: "Symbol, type, volume, and price are required" });
    }

    const order = await metaTraderService.placePendingOrder({
      symbol,
      type,
      volume,
      price,
      stopLoss,
      takeProfit,
      expiration,
      comment,
    });

    res.json(order);
  } catch (error) {
    console.error("Error placing pending order:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Modify order
 */
app.put("/api/metatrader/order/:orderId", auth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const modifications = req.body;

    const order = await metaTraderService.modifyOrder(orderId, modifications);
    res.json(order);
  } catch (error) {
    console.error("Error modifying order:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Close order/position
 */
app.post("/api/metatrader/order/:orderId/close", auth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { volume } = req.body;

    const result = await metaTraderService.closeOrder(orderId, volume);
    res.json(result);
  } catch (error) {
    console.error("Error closing order:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Cancel pending order
 */
app.delete("/api/metatrader/order/:orderId", auth, async (req, res) => {
  try {
    const { orderId } = req.params;

    const result = await metaTraderService.cancelOrder(orderId);
    res.json(result);
  } catch (error) {
    console.error("Error canceling order:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Get open positions
 */
app.get("/api/metatrader/positions", auth, async (req, res) => {
  try {
    const positions = await metaTraderService.getOpenPositions();
    res.json(positions);
  } catch (error) {
    console.error("Error getting positions:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get pending orders
 */
app.get("/api/metatrader/orders/pending", auth, async (req, res) => {
  try {
    const orders = await metaTraderService.getPendingOrders();
    res.json(orders);
  } catch (error) {
    console.error("Error getting pending orders:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get trade history
 */
app.get("/api/metatrader/history", auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const history = await metaTraderService.getTradeHistory(startDate, endDate);
    res.json(history);
  } catch (error) {
    console.error("Error getting trade history:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get position details
 */
app.get("/api/metatrader/positions/:positionId", auth, async (req, res) => {
  try {
    const { positionId } = req.params;
    const position = await metaTraderService.getPositionDetails(positionId);
    res.json(position);
  } catch (error) {
    console.error("Error getting position details:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get trading statistics
 */
app.get("/api/metatrader/stats", auth, async (req, res) => {
  try {
    const stats = await metaTraderService.getTradingStats();
    res.json(stats);
  } catch (error) {
    console.error("Error getting trading stats:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PAYMENT TERMINAL API ENDPOINTS
// Protocols: 101.1, 101.2, 101.3, 201.1, 201.2, 201.3
// ============================================

function mapPaymentTerminalTransaction(row) {
  if (!row) {
    return null;
  }

  const metadata = row.metadata ? JSON.parse(row.metadata) : {};
  return {
    transactionId: row.transaction_id,
    userId: row.user_id,
    terminalId: row.terminal_id,
    protocol: row.protocol,
    amount: row.amount,
    currency: row.currency,
    cardData: row.masked_pan ? { pan: row.masked_pan } : undefined,
    authCode: row.auth_code,
    responseCode: row.response_code,
    status: row.status,
    timestamp: row.created_at,
    refundedAt: row.refunded_at,
    refundAmount: row.refund_amount,
    ...metadata,
  };
}

function persistPaymentTerminalTransaction(userId, data, protocol) {
  const metadata = {};
  if (data.walletType) metadata.walletType = data.walletType;
  if (data.contactlessIndicator) metadata.contactlessIndicator = data.contactlessIndicator;
  if (data.cvmPerformed) metadata.cvmPerformed = data.cvmPerformed;

  insertPaymentTerminalTransactionStmt.run(
    data.transactionId,
    userId,
    data.terminalId || `TERMINAL_${userId}`,
    protocol || data.protocol,
    Number(data.amount),
    data.currency || "USD",
    data.cardData?.pan || null,
    data.authCode || null,
    data.responseCode || null,
    data.status || (protocol === "101.3" ? "authorized" : "completed"),
    JSON.stringify(metadata),
    data.timestamp || new Date().toISOString()
  );
}

// Initialize Payment Terminal
app.post("/api/payment-terminal/initialize", auth, (req, res) => {
  try {
    const { config } = req.body;
    const result = paymentTerminalService.initializeTerminal(`TERMINAL_${req.user.id}`, config);
    res.json(result);
  } catch (error) {
    console.error("Error initializing terminal:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get Terminal Status
app.get("/api/payment-terminal/status", auth, (req, res) => {
  try {
    const status = paymentTerminalService.getTerminalStatus();
    const today = countPaymentTerminalTransactionsTodayStmt.get(req.user.id);
    res.json({ ...status, transactionsToday: today.count });
  } catch (error) {
    console.error("Error getting terminal status:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get Supported Protocols
app.get("/api/payment-terminal/protocols", auth, (req, res) => {
  try {
    const protocols = paymentTerminalService.getSupportedProtocols();
    res.json(protocols);
  } catch (error) {
    console.error("Error getting protocols:", error);
    res.status(500).json({ error: error.message });
  }
});

// Process Card Payment
app.post("/api/payment-terminal/process", auth, async (req, res) => {
  try {
    const paymentData = {
      ...req.body,
      userId: req.user.id,
      terminalId: `TERMINAL_${req.user.id}`,
    };

    const result = await paymentTerminalService.processPayment(paymentData);

    if (!result.success) {
      return res.status(400).json(result);
    }

    if (result.success && result.data) {
      persistPaymentTerminalTransaction(req.user.id, result.data, result.protocol);

      // Store transaction reference in database
      addTransactionStmt.run(
        req.user.id,
        "card_payment",
        result.data.currency || "USD",
        result.data.amount || 0,
        JSON.stringify({
          transactionId: result.data.transactionId,
          protocol: result.protocol,
          authCode: result.data.authCode,
        }),
        null
      );
    }

    res.json(result);
  } catch (error) {
    console.error("Error processing payment:", error);
    res.status(500).json({ error: error.message });
  }
});

// Protocol 101.1: Chip Card Read
app.post("/api/payment-terminal/protocol/101.1", auth, async (req, res) => {
  try {
    const result = await paymentTerminalService.protocol_101_1_ChipCardRead(req.body);
    res.json(result);
  } catch (error) {
    console.error("Error in protocol 101.1:", error);
    res.status(500).json({ error: error.message });
  }
});

// Protocol 101.2: PIN Verification
app.post("/api/payment-terminal/protocol/101.2", auth, async (req, res) => {
  try {
    const { cardData, pin } = req.body;
    const result = await paymentTerminalService.protocol_101_2_PINVerification(cardData, pin);
    res.json(result);
  } catch (error) {
    console.error("Error in protocol 101.2:", error);
    res.status(500).json({ error: error.message });
  }
});

// Protocol 101.3: Online Authorization
app.post("/api/payment-terminal/protocol/101.3", auth, async (req, res) => {
  try {
    const result = await paymentTerminalService.protocol_101_3_OnlineAuthorization(
      { ...req.body, userId: req.user.id },
      false
    );
    res.json(result);
  } catch (error) {
    console.error("Error in protocol 101.3:", error);
    res.status(500).json({ error: error.message });
  }
});

// Protocol 201.1: NFC Read
app.post("/api/payment-terminal/protocol/201.1", auth, async (req, res) => {
  try {
    const result = await paymentTerminalService.protocol_201_1_NFCRead(req.body);
    res.json(result);
  } catch (error) {
    console.error("Error in protocol 201.1:", error);
    res.status(500).json({ error: error.message });
  }
});

// Protocol 201.2: Tap to Pay
app.post("/api/payment-terminal/protocol/201.2", auth, async (req, res) => {
  try {
    const result = await paymentTerminalService.protocol_201_2_TapToPay(
      { ...req.body, userId: req.user.id },
      false
    );
    res.json(result);
  } catch (error) {
    console.error("Error in protocol 201.2:", error);
    res.status(500).json({ error: error.message });
  }
});

// Protocol 201.3: Mobile Wallet
app.post("/api/payment-terminal/protocol/201.3", auth, async (req, res) => {
  try {
    const result = await paymentTerminalService.protocol_201_3_MobileWallet(
      { ...req.body, userId: req.user.id },
      false
    );
    res.json(result);
  } catch (error) {
    console.error("Error in protocol 201.3:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get Transaction Details
app.get("/api/payment-terminal/transaction/:transactionId", auth, (req, res) => {
  try {
    const row = findPaymentTerminalTransactionStmt.get(req.params.transactionId, req.user.id);
    const transaction = mapPaymentTerminalTransaction(row);
    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    res.json(transaction);
  } catch (error) {
    console.error("Error getting transaction:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get All Transactions
app.get("/api/payment-terminal/transactions", auth, (req, res) => {
  try {
    const transactions = listPaymentTerminalTransactionsStmt
      .all(req.user.id)
      .map(mapPaymentTerminalTransaction);
    res.json(transactions);
  } catch (error) {
    console.error("Error getting transactions:", error);
    res.status(500).json({ error: error.message });
  }
});

// Refund Transaction
app.post("/api/payment-terminal/refund/:transactionId", auth, async (req, res) => {
  try {
    const { amount } = req.body;
    const transaction = findPaymentTerminalTransactionStmt.get(
      req.params.transactionId,
      req.user.id
    );
    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    if (transaction.status === "refunded") {
      return res.status(409).json({ error: "Transaction already refunded" });
    }

    const alreadyRefunded = Number(transaction.refund_amount || 0);
    const remainingAmount = Number(transaction.amount) - alreadyRefunded;
    const refundAmount = amount === undefined ? remainingAmount : Number(amount);
    if (!Number.isFinite(refundAmount) || refundAmount <= 0 || refundAmount > remainingAmount) {
      return res.status(400).json({ error: "Invalid refund amount" });
    }

    refundPaymentTerminalTransactionStmt.run(
      refundAmount,
      refundAmount,
      refundAmount,
      req.params.transactionId,
      req.user.id
    );
    const updated = findPaymentTerminalTransactionStmt.get(req.params.transactionId, req.user.id);
    res.json({
      success: true,
      transaction: mapPaymentTerminalTransaction(updated),
      message: "Refund processed successfully",
    });
  } catch (error) {
    console.error("Error processing refund:", error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// ERC-1155 Multi-Token Standard Endpoints
// ========================================

// Add new ERC-1155 contract
app.post("/api/erc1155/contract/add", auth, async (req, res) => {
  try {
    const { contractAddress, name, symbol, network } = req.body;

    if (!contractAddress || !name) {
      return res.status(400).json({ error: "Contract address and name are required" });
    }

    // Get contract info from blockchain
    const contractInfo = await erc1155Service.getContractInfo(contractAddress);

    const stmt = db.prepare(`
      INSERT INTO erc1155_contracts (contract_address, name, symbol, network, added_by)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      contractAddress,
      name,
      symbol || contractInfo.symbol || "",
      network || "ethereum",
      req.user.id
    );

    res.json({
      success: true,
      contractId: result.lastInsertRowid,
      message: "ERC-1155 contract added successfully",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all ERC-1155 contracts
app.get("/api/erc1155/contracts", auth, async (req, res) => {
  try {
    const contracts = db
      .prepare(
        `
      SELECT * FROM erc1155_contracts
      ORDER BY created_at DESC
    `
      )
      .all();

    res.json({ success: true, contracts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single token balance
app.get("/api/erc1155/balance/:contractId/:tokenId", auth, async (req, res) => {
  try {
    const { contractId, tokenId } = req.params;
    const { walletAddress } = req.query;

    const contract = db.prepare("SELECT * FROM erc1155_contracts WHERE id = ?").get(contractId);

    if (!contract) {
      return res.status(404).json({ error: "Contract not found" });
    }

    const result = await erc1155Service.getBalance(
      contract.contract_address,
      walletAddress,
      tokenId
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get batch balances
app.post("/api/erc1155/balance/batch", auth, async (req, res) => {
  try {
    const { contractId, accounts, tokenIds } = req.body;

    const contract = db.prepare("SELECT * FROM erc1155_contracts WHERE id = ?").get(contractId);

    if (!contract) {
      return res.status(404).json({ error: "Contract not found" });
    }

    const result = await erc1155Service.getBalanceBatch(
      contract.contract_address,
      accounts,
      tokenIds
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get token metadata
app.get("/api/erc1155/token/:contractId/:tokenId/metadata", auth, async (req, res) => {
  try {
    const { contractId, tokenId } = req.params;

    const contract = db.prepare("SELECT * FROM erc1155_contracts WHERE id = ?").get(contractId);

    if (!contract) {
      return res.status(404).json({ error: "Contract not found" });
    }

    const result = await erc1155Service.getTokenURI(contract.contract_address, tokenId);

    // Save metadata to database
    if (result.success && result.metadata) {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO erc1155_tokens 
        (contract_id, token_id, uri, metadata, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `);

      stmt.run(contractId, tokenId, result.uri, JSON.stringify(result.metadata));
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check approval status
app.get("/api/erc1155/approval/:contractId", auth, async (req, res) => {
  try {
    const { contractId } = req.params;
    const { owner, operator } = req.query;

    const contract = db.prepare("SELECT * FROM erc1155_contracts WHERE id = ?").get(contractId);

    if (!contract) {
      return res.status(404).json({ error: "Contract not found" });
    }

    const result = await erc1155Service.isApprovedForAll(
      contract.contract_address,
      owner,
      operator
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set approval for all
app.post("/api/erc1155/approval/set", auth, async (req, res) => {
  try {
    const { contractId, privateKey, operator, approved } = req.body;

    const contract = db.prepare("SELECT * FROM erc1155_contracts WHERE id = ?").get(contractId);

    if (!contract) {
      return res.status(404).json({ error: "Contract not found" });
    }

    const result = await erc1155Service.setApprovalForAll(
      contract.contract_address,
      privateKey,
      operator,
      approved
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Transfer single token
app.post("/api/erc1155/transfer", auth, async (req, res) => {
  try {
    const { contractId, privateKey, from, to, tokenId, amount } = req.body;

    const contract = db.prepare("SELECT * FROM erc1155_contracts WHERE id = ?").get(contractId);

    if (!contract) {
      return res.status(404).json({ error: "Contract not found" });
    }

    const result = await erc1155Service.safeTransferFrom(
      contract.contract_address,
      privateKey,
      from,
      to,
      tokenId,
      amount
    );

    // Record transaction in database
    if (result.success) {
      db.prepare(
        `
        INSERT INTO erc1155_transactions 
        (user_id, contract_id, token_id, transaction_type, from_address, to_address, amount, tx_hash, status)
        VALUES (?, ?, ?, 'transfer', ?, ?, ?, ?, 'confirmed')
      `
      ).run(req.user.id, contractId, tokenId, from, to, amount, result.transactionHash);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Transfer batch tokens
app.post("/api/erc1155/transfer/batch", auth, async (req, res) => {
  try {
    const { contractId, privateKey, from, to, tokenIds, amounts } = req.body;

    const contract = db.prepare("SELECT * FROM erc1155_contracts WHERE id = ?").get(contractId);

    if (!contract) {
      return res.status(404).json({ error: "Contract not found" });
    }

    const result = await erc1155Service.safeBatchTransferFrom(
      contract.contract_address,
      privateKey,
      from,
      to,
      tokenIds,
      amounts
    );

    // Record transactions in database
    if (result.success) {
      const stmt = db.prepare(`
        INSERT INTO erc1155_transactions 
        (user_id, contract_id, token_id, transaction_type, from_address, to_address, amount, tx_hash, status)
        VALUES (?, ?, ?, 'batch_transfer', ?, ?, ?, ?, 'confirmed')
      `);

      tokenIds.forEach((tokenId, index) => {
        stmt.run(
          req.user.id,
          contractId,
          tokenId,
          from,
          to,
          amounts[index],
          result.transactionHash
        );
      });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mint single token
app.post("/api/erc1155/mint", auth, async (req, res) => {
  try {
    const { contractId, privateKey, to, tokenId, amount } = req.body;

    const contract = db.prepare("SELECT * FROM erc1155_contracts WHERE id = ?").get(contractId);

    if (!contract) {
      return res.status(404).json({ error: "Contract not found" });
    }

    const result = await erc1155Service.mint(
      contract.contract_address,
      privateKey,
      to,
      tokenId,
      amount
    );

    // Record transaction in database
    if (result.success) {
      db.prepare(
        `
        INSERT INTO erc1155_transactions 
        (user_id, contract_id, token_id, transaction_type, to_address, amount, tx_hash, status)
        VALUES (?, ?, ?, 'mint', ?, ?, ?, 'confirmed')
      `
      ).run(req.user.id, contractId, tokenId, to, amount, result.transactionHash);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mint batch tokens
app.post("/api/erc1155/mint/batch", auth, async (req, res) => {
  try {
    const { contractId, privateKey, to, tokenIds, amounts } = req.body;

    const contract = db.prepare("SELECT * FROM erc1155_contracts WHERE id = ?").get(contractId);

    if (!contract) {
      return res.status(404).json({ error: "Contract not found" });
    }

    const result = await erc1155Service.mintBatch(
      contract.contract_address,
      privateKey,
      to,
      tokenIds,
      amounts
    );

    // Record transactions in database
    if (result.success) {
      const stmt = db.prepare(`
        INSERT INTO erc1155_transactions 
        (user_id, contract_id, token_id, transaction_type, to_address, amount, tx_hash, status)
        VALUES (?, ?, ?, 'batch_mint', ?, ?, ?, 'confirmed')
      `);

      tokenIds.forEach((tokenId, index) => {
        stmt.run(req.user.id, contractId, tokenId, to, amounts[index], result.transactionHash);
      });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Burn tokens
app.post("/api/erc1155/burn", auth, async (req, res) => {
  try {
    const { contractId, privateKey, from, tokenId, amount } = req.body;

    const contract = db.prepare("SELECT * FROM erc1155_contracts WHERE id = ?").get(contractId);

    if (!contract) {
      return res.status(404).json({ error: "Contract not found" });
    }

    const result = await erc1155Service.burn(
      contract.contract_address,
      privateKey,
      from,
      tokenId,
      amount
    );

    // Record transaction in database
    if (result.success) {
      db.prepare(
        `
        INSERT INTO erc1155_transactions 
        (user_id, contract_id, token_id, transaction_type, from_address, amount, tx_hash, status)
        VALUES (?, ?, ?, 'burn', ?, ?, ?, 'confirmed')
      `
      ).run(req.user.id, contractId, tokenId, from, amount, result.transactionHash);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Burn batch tokens
app.post("/api/erc1155/burn/batch", auth, async (req, res) => {
  try {
    const { contractId, privateKey, from, tokenIds, amounts } = req.body;

    const contract = db.prepare("SELECT * FROM erc1155_contracts WHERE id = ?").get(contractId);

    if (!contract) {
      return res.status(404).json({ error: "Contract not found" });
    }

    const result = await erc1155Service.burnBatch(
      contract.contract_address,
      privateKey,
      from,
      tokenIds,
      amounts
    );

    // Record transactions in database
    if (result.success) {
      const stmt = db.prepare(`
        INSERT INTO erc1155_transactions 
        (user_id, contract_id, token_id, transaction_type, from_address, amount, tx_hash, status)
        VALUES (?, ?, ?, 'batch_burn', ?, ?, ?, 'confirmed')
      `);

      tokenIds.forEach((tokenId, index) => {
        stmt.run(req.user.id, contractId, tokenId, from, amounts[index], result.transactionHash);
      });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get total supply of a token
app.get("/api/erc1155/supply/:contractId/:tokenId", auth, async (req, res) => {
  try {
    const { contractId, tokenId } = req.params;

    const contract = db.prepare("SELECT * FROM erc1155_contracts WHERE id = ?").get(contractId);

    if (!contract) {
      return res.status(404).json({ error: "Contract not found" });
    }

    const result = await erc1155Service.getTotalSupply(contract.contract_address, tokenId);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check if token exists
app.get("/api/erc1155/exists/:contractId/:tokenId", auth, async (req, res) => {
  try {
    const { contractId, tokenId } = req.params;

    const contract = db.prepare("SELECT * FROM erc1155_contracts WHERE id = ?").get(contractId);

    if (!contract) {
      return res.status(404).json({ error: "Contract not found" });
    }

    const result = await erc1155Service.exists(contract.contract_address, tokenId);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Estimate gas for transfer
app.post("/api/erc1155/estimate-gas", auth, async (req, res) => {
  try {
    const { contractId, from, to, tokenId, amount } = req.body;

    const contract = db.prepare("SELECT * FROM erc1155_contracts WHERE id = ?").get(contractId);

    if (!contract) {
      return res.status(404).json({ error: "Contract not found" });
    }

    const result = await erc1155Service.estimateTransferGas(
      contract.contract_address,
      from,
      to,
      tokenId,
      amount
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's ERC-1155 transactions
app.get("/api/erc1155/transactions", auth, async (req, res) => {
  try {
    const transactions = db
      .prepare(
        `
      SELECT 
        t.*,
        c.contract_address,
        c.name as contract_name
      FROM erc1155_transactions t
      JOIN erc1155_contracts c ON t.contract_id = c.id
      WHERE t.user_id = ?
      ORDER BY t.created_at DESC
      LIMIT 100
    `
      )
      .all(req.user.id);

    res.json({ success: true, transactions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get transaction receipt
app.get("/api/erc1155/transaction/:txHash", auth, async (req, res) => {
  try {
    const { txHash } = req.params;

    const result = await erc1155Service.getTransactionReceipt(txHash);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Payment Gateway Routes ──────────────────────────────────────────────────

// GET /api/payments/methods — list supported payment methods
app.get("/api/payments/methods", auth, (_req, res) => {
  res.json(paymentGateway.getSupportedMethods());
});

// POST /api/payments/create — create a payment intent
app.post(
  "/api/payments/create",
  auth,
  [
    body("amount").isFloat({ min: 0.01 }).withMessage("amount must be > 0"),
    body("currency")
      .isIn(["USD", "EUR", "GBP", "AED", "AUD", "CAD", "JPY", "CHF"])
      .withMessage("Unsupported currency"),
    body("method")
      .isIn(["card", "bank_transfer", "paypal", "apple_pay", "google_pay", "sepa", "wire"])
      .withMessage("Unsupported method"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    try {
      const { amount, currency, method, metadata = {} } = req.body;
      const payment = await paymentGateway.createPayment({ amount, currency, method, metadata });
      const stmt = db.prepare(
        "INSERT INTO payments (id, user_id, method, amount, currency, status, reference, qr_data, instructions, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      );
      stmt.run(
        payment.id,
        req.user.id,
        method,
        amount,
        currency.toUpperCase(),
        "pending",
        payment.id,
        payment.qrData || null,
        payment.instructions || null,
        JSON.stringify(metadata)
      );
      res.json({ success: true, payment });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// POST /api/payments/crypto — create crypto payment address
app.post(
  "/api/payments/crypto",
  rateLimiters.blockchain,
  auth,
  [
    body("amount")
      .isString()
      .matches(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,8})?$/)
      .withMessage("amount must be a positive decimal string"),
    body("currency").isIn(["USD", "EUR", "GBP", "AED", "AUD", "CAD", "JPY", "CHF"]),
    body("cryptoSymbol").isIn(["BTC", "ETH", "USDT", "BNB", "SOL", "TRX", "ATX"]),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    try {
      const { amount, currency, cryptoSymbol, metadata = {} } = req.body;
      const payment = await paymentGateway.createCryptoPayment({
        amount,
        currency,
        cryptoSymbol,
        metadata,
      });
      const paymentMetadata = {
        ...(metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {}),
        address: payment.address,
        autoCredit: payment.autoCredit,
        cryptoAmount: payment.cryptoAmount,
        cryptoSymbol: payment.cryptoSymbol,
        network: payment.network,
        quote: payment.quote,
        quoteMode: payment.quoteMode,
      };
      const stmt = db.prepare(
        "INSERT INTO payments (id, user_id, method, amount, currency, status, reference, qr_data, instructions, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      );
      stmt.run(
        payment.id,
        req.user.id,
        "crypto",
        amount,
        currency.toUpperCase(),
        "awaiting_payment",
        payment.id,
        payment.qrData,
        `Pay ${payment.cryptoAmount} ${payment.cryptoSymbol}${payment.network ? ` on ${payment.network}` : ""} to ${payment.address}`,
        JSON.stringify(paymentMetadata)
      );
      res.json({ success: true, payment });
    } catch (err) {
      res.status(err.code === "QUOTE_UNAVAILABLE" ? 502 : 400).json({ error: err.message });
    }
  }
);

// GET /api/payments/history — list user's payments
app.get("/api/payments/history", auth, (req, res) => {
  try {
    const rows = db
      .prepare("SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 50")
      .all(req.user.id);
    res.json({ payments: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/payments/saved-methods — list saved payment methods
app.get("/api/payments/saved-methods", auth, (req, res) => {
  try {
    const rows = db
      .prepare("SELECT * FROM payment_methods_saved WHERE user_id = ? ORDER BY is_default DESC, created_at DESC")
      .all(req.user.id);
    res.json({ methods: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/payments/:id — get single payment
app.get("/api/payments/:id", auth, (req, res) => {
  try {
    const row = db.prepare("SELECT * FROM payments WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ error: "Payment not found" });
    res.json({ payment: row });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payments/:id/confirm — mark payment as completed (mock)
app.post("/api/payments/:id/confirm", auth, (req, res) => {
  try {
    const row = db.prepare("SELECT * FROM payments WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ error: "Payment not found" });
    if (row.method === "crypto") {
      return res.status(409).json({
        error: "Crypto payments require on-chain verification and cannot be self-confirmed",
      });
    }
    db.prepare("UPDATE payments SET status = 'completed', completed_at = datetime('now') WHERE id = ?").run(
      req.params.id
    );
    res.json({ success: true, message: "Payment confirmed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payments/:id/refund — refund a payment
app.post("/api/payments/:id/refund", auth, async (req, res) => {
  try {
    const row = db.prepare("SELECT * FROM payments WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ error: "Payment not found" });
    if (!["completed", "partially_refunded"].includes(row.status)) {
      return res.status(400).json({ error: "Only completed payments can be refunded" });
    }
    const refundAmount = Number(req.body.amount || row.amount);
    if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
      return res.status(400).json({ error: "Refund amount must be greater than zero" });
    }
    const alreadyRefunded = Number(row.refund_amount || 0);
    const remainingRefundable = Number(row.amount) - alreadyRefunded;
    if (refundAmount > remainingRefundable) {
      return res.status(400).json({ error: "Refund amount cannot exceed remaining refundable balance" });
    }
    const refund = await paymentGateway.refundPayment({
      paymentId: req.params.id,
      amount: refundAmount,
      reason: req.body.reason,
    });
    const nextRefundTotal = alreadyRefunded + (refund.amount || refundAmount);
    const nextStatus = nextRefundTotal >= Number(row.amount) ? "refunded" : "partially_refunded";
    db.prepare(
      "UPDATE payments SET status = ?, refunded_at = datetime('now'), refund_amount = ? WHERE id = ?"
    ).run(nextStatus, nextRefundTotal, req.params.id);
    res.json({ success: true, refund });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/payments/saved-methods — save a payment method
app.post(
  "/api/payments/saved-methods",
  auth,
  [body("type").notEmpty(), body("label").notEmpty()],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    try {
      const { type, label, masked, isDefault } = req.body;
      if (isDefault) {
        db.prepare("UPDATE payment_methods_saved SET is_default = 0 WHERE user_id = ?").run(req.user.id);
      }
      const result = db
        .prepare(
          "INSERT INTO payment_methods_saved (user_id, type, label, masked, is_default) VALUES (?, ?, ?, ?, ?)"
        )
        .run(req.user.id, type, label, masked || null, isDefault ? 1 : 0);
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// DELETE /api/payments/saved-methods/:id
app.delete("/api/payments/saved-methods/:id", auth, (req, res) => {
  try {
    const result = db.prepare("DELETE FROM payment_methods_saved WHERE id = ? AND user_id = ?").run(
      Number(req.params.id),
      req.user.id
    );
    if (!result.changes) {
      return res.status(404).json({ error: "Saved payment method not found" });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payments/webhook — receive payment provider webhooks
app.post("/api/payments/webhook", express.raw({ type: "application/json" }), (req, res) => {
  if (paymentGateway.autoGeneratedWebhookSecret) {
    return res.status(503).json({ error: "Webhook secret not configured" });
  }
  const sig = req.headers["x-payment-signature"] || "";
  const body = Buffer.isBuffer(req.body)
    ? req.body.toString()
    : typeof req.body === "string"
      ? req.body
      : JSON.stringify(req.body || {});
  if (!paymentGateway.verifyWebhook(body, sig)) {
    return res.status(400).json({ error: "Invalid signature" });
  }
  try {
    const event = JSON.parse(body);
    if (event.type === "payment.completed" && event.paymentId) {
      db.prepare("UPDATE payments SET status = 'completed', completed_at = datetime('now') WHERE id = ?").run(
        event.paymentId
      );
    }
    res.json({ received: true });
  } catch {
    res.status(400).json({ error: "Invalid payload" });
  }
});

// ==================== ADVANCED INTEGRATIONS ROUTES ====================

// ==================== BINANCE API INTEGRATION ====================
/**
 * POST /api/binance/account-info
 * Get Binance account information
 */
app.post("/api/binance/account-info", auth, async (req, res) => {
  try {
    if (!binanceApiService.configured) {
      return res.status(400).json({ error: "Binance API not configured" });
    }
    const result = await binanceApiService.getAccountInfo();
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/binance/prices
 * Get latest prices for symbols
 */
app.post("/api/binance/prices", auth, async (req, res) => {
  try {
    const { symbols } = req.body;
    const result = await binanceApiService.getPrices(symbols);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/binance/order/limit
 * Place limit order on Binance
 */
app.post("/api/binance/order/limit", auth, async (req, res) => {
  try {
    const { symbol, side, quantity, price } = req.body;
    if (!symbol || !side || !quantity || !price) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await binanceApiService.placeLimitOrder(symbol, side, quantity, price);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Store order history
    db.prepare(
      `INSERT INTO binance_trading_history 
       (user_id, symbol, order_id, side, quantity, price, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      req.user.id,
      symbol,
      result.data.orderId || Date.now(),
      side,
      quantity,
      price,
      result.data.status || "open"
    );

    res.json(result.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/binance/order/market
 * Place market order on Binance
 */
app.post("/api/binance/order/market", auth, async (req, res) => {
  try {
    const { symbol, side, quantity } = req.body;
    if (!symbol || !side || !quantity) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await binanceApiService.placeMarketOrder(symbol, side, quantity);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Store order history
    db.prepare(
      `INSERT INTO binance_trading_history 
       (user_id, symbol, order_id, side, quantity, price, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      req.user.id,
      symbol,
      result.data.orderId || Date.now(),
      side,
      quantity,
      0,
      result.data.status || "open"
    );

    res.json(result.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/binance/orders
 * Get Binance trading history
 */
app.get("/api/binance/orders", auth, (req, res) => {
  try {
    const orders = db
      .prepare("SELECT * FROM binance_trading_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 100")
      .all(req.user.id);
    res.json({ orders, total: orders.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== ADVANCED ANALYTICS ROUTES ====================

/**
 * POST /api/analytics/portfolio-metrics
 * Calculate portfolio metrics
 */
app.post("/api/analytics/portfolio-metrics", auth, async (req, res) => {
  try {
    const { holdings, prices } = req.body;
    const metrics = advancedAnalyticsService.calculatePortfolioMetrics(holdings, prices);
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/analytics/risk-metrics
 * Calculate risk metrics (Sharpe ratio, etc.)
 */
app.post("/api/analytics/risk-metrics", auth, async (req, res) => {
  try {
    const { returns, riskFreeRate } = req.body;
    const metrics = advancedAnalyticsService.calculateRiskMetrics(
      returns,
      riskFreeRate || 0.02
    );
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/analytics/trading-patterns
 * Analyze trading patterns
 */
app.post("/api/analytics/trading-patterns", auth, async (req, res) => {
  try {
    const { trades } = req.body;
    const analysis = advancedAnalyticsService.analyzeTradingPatterns(trades);
    res.json(analysis);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/analytics/diversification
 * Generate diversification report
 */
app.post("/api/analytics/diversification", auth, async (req, res) => {
  try {
    const { holdings, breakdown } = req.body;
    const report = advancedAnalyticsService.generateDiversificationReport(holdings, breakdown);
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/analytics/correlation
 * Calculate asset correlation
 */
app.post("/api/analytics/correlation", auth, async (req, res) => {
  try {
    const { asset1Returns, asset2Returns } = req.body;
    const correlation = advancedAnalyticsService.calculateCorrelation(
      asset1Returns,
      asset2Returns
    );
    res.json({ correlation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/analytics/backtest
 * Run strategy backtest
 */
app.post("/api/analytics/backtest", auth, async (req, res) => {
  try {
    const { historicalData, initialCapital } = req.body;
    // Simple strategy for demo
    const strategy = (candle) => {
      if (candle.close > candle.open) return "BUY";
      if (candle.close < candle.open) return "SELL";
      return "HOLD";
    };
    const results = advancedAnalyticsService.runBacktest(strategy, historicalData, initialCapital);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== RISK MANAGEMENT ROUTES ====================

/**
 * POST /api/risk/profile/init
 * Initialize risk profile
 */
app.post("/api/risk/profile/init", auth, async (req, res) => {
  try {
    // Check if risk profile exists
    let profile = db.prepare("SELECT * FROM risk_profiles WHERE user_id = ?").get(req.user.id);

    if (!profile) {
      const config = req.body;
      riskManagementService.initializeRiskProfile(req.user.id, config);
      db.prepare(
        `INSERT INTO risk_profiles 
         (user_id, risk_tolerance, portfolio_size, max_drawdown_percent, 
          max_position_size, max_leverage, daily_loss_limit, min_stop_loss_percent,
          max_concentration, correlation_threshold)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        req.user.id,
        config.riskTolerance || "medium",
        config.portfolioSize || 10000,
        config.maxDrawdownPercent || 20,
        config.maxPositionSize || 10,
        config.maxLeverage || 2,
        config.dailyLossLimit || 5,
        config.minStopLossPercent || 2,
        config.maxConcentration || 30,
        config.correlationThreshold || 0.7
      );

      profile = db.prepare("SELECT * FROM risk_profiles WHERE user_id = ?").get(req.user.id);
    } else {
      riskManagementService.initializeRiskProfile(req.user.id, {
        riskTolerance: profile.risk_tolerance,
        portfolioSize: profile.portfolio_size,
        maxDrawdownPercent: profile.max_drawdown_percent,
        maxPositionSize: profile.max_position_size,
        maxLeverage: profile.max_leverage,
        dailyLossLimit: profile.daily_loss_limit,
        minStopLossPercent: profile.min_stop_loss_percent,
        maxConcentration: profile.max_concentration,
        correlationThreshold: profile.correlation_threshold,
      });
    }

    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/risk/profile
 * Get risk profile
 */
app.get("/api/risk/profile", auth, (req, res) => {
  try {
    const profile = db.prepare("SELECT * FROM risk_profiles WHERE user_id = ?").get(req.user.id);
    if (!profile) {
      return res.status(404).json({ error: "Risk profile not initialized" });
    }
    riskManagementService.initializeRiskProfile(req.user.id, {
      riskTolerance: profile.risk_tolerance,
      portfolioSize: profile.portfolio_size,
      maxDrawdownPercent: profile.max_drawdown_percent,
      maxPositionSize: profile.max_position_size,
      maxLeverage: profile.max_leverage,
      dailyLossLimit: profile.daily_loss_limit,
      minStopLossPercent: profile.min_stop_loss_percent,
      maxConcentration: profile.max_concentration,
      correlationThreshold: profile.correlation_threshold,
    });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/risk/validate-position
 * Validate position against risk limits
 */
app.post("/api/risk/validate-position", auth, async (req, res) => {
  try {
    const { position, portfolio } = req.body;
    const profile = db.prepare("SELECT * FROM risk_profiles WHERE user_id = ?").get(req.user.id);

    if (!profile) {
      return res.status(400).json({ error: "Risk profile not initialized" });
    }

    riskManagementService.initializeRiskProfile(req.user.id, {
      riskTolerance: profile.risk_tolerance,
      portfolioSize: profile.portfolio_size,
      maxDrawdownPercent: profile.max_drawdown_percent,
      maxPositionSize: profile.max_position_size,
      maxLeverage: profile.max_leverage,
      dailyLossLimit: profile.daily_loss_limit,
      minStopLossPercent: profile.min_stop_loss_percent,
      maxConcentration: profile.max_concentration,
      correlationThreshold: profile.correlation_threshold,
    });
    const normalizedPortfolio = Object.fromEntries(
      Object.entries(portfolio || {}).map(([symbol, holding]) => [
        symbol,
        typeof holding === "number" ? holding : holding.value || holding.quantity * holding.price,
      ])
    );
    res.json(riskManagementService.validatePosition(req.user.id, position, normalizedPortfolio));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/risk/alerts/set
 * Set risk alert
 */
app.post("/api/risk/alerts/set", auth, async (req, res) => {
  try {
    const { alertType, threshold, action } = req.body;

    const result = db
      .prepare(
        `INSERT INTO risk_alerts (user_id, alert_type, threshold, action)
         VALUES (?, ?, ?, ?)`
      )
      .run(req.user.id, alertType, threshold, action || "NOTIFY");

    const alert = db.prepare("SELECT * FROM risk_alerts WHERE id = ?").get(result.lastInsertRowid);
    res.json(alert);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/risk/alerts
 * Get active risk alerts
 */
app.get("/api/risk/alerts", auth, (req, res) => {
  try {
    const alerts = db
      .prepare("SELECT * FROM risk_alerts WHERE user_id = ? AND active = 1 ORDER BY created_at DESC")
      .all(req.user.id);
    res.json({ alerts, total: alerts.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/risk/var
 * Calculate Value at Risk
 */
app.post("/api/risk/var", auth, async (req, res) => {
  try {
    const { portfolio, confidenceLevel, timeHorizon } = req.body;
    const normalizedPortfolio = Object.fromEntries(
      Object.entries(portfolio || {}).map(([symbol, holding]) => [
        symbol,
        typeof holding === "number" ? { value: holding } : holding,
      ])
    );
    res.json(
      riskManagementService.calculateVaR(
        normalizedPortfolio,
        confidenceLevel || 0.95,
        timeHorizon || 1
      )
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/risk/stress-test
 * Stress test portfolio
 */
app.post("/api/risk/stress-test", auth, async (req, res) => {
  try {
    const { portfolio, scenarios } = req.body;
    const normalizedPortfolio = Object.fromEntries(
      Object.entries(portfolio || {}).map(([symbol, holding]) => [
        symbol,
        typeof holding === "number"
          ? { value: holding }
          : { ...holding, value: holding.value ?? holding.quantity * holding.price },
      ])
    );
    res.json(
      riskManagementService.stressTestPortfolio(normalizedPortfolio, scenarios || [])
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/risk/rebalance
 * Recommend portfolio rebalancing
 */
app.post("/api/risk/rebalance", auth, async (req, res) => {
  try {
    const { portfolio, targetAllocations } = req.body;
    const rebalancingActions = riskManagementService.recommendRebalancing(
      portfolio || {},
      targetAllocations || {}
    );
    res.json({ rebalancingActions, total: rebalancingActions.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== ADVANCED ORDERS ROUTES ====================

/**
 * POST /api/orders/advanced/create
 * Create advanced order (stop loss, take profit, trailing stop)
 */
app.post("/api/orders/advanced/create", auth, async (req, res) => {
  try {
    const { symbol, orderType, side, quantity, price, stopPrice, trailingStopPercent, takeProfitPrice, stopLossPrice } = req.body;

    const result = db
      .prepare(
        `INSERT INTO advanced_orders 
         (user_id, symbol, order_type, side, quantity, price, stop_price, 
          trailing_stop_percent, take_profit_price, stop_loss_price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        req.user.id,
        symbol,
        orderType,
        side,
        quantity,
        price || null,
        stopPrice || null,
        trailingStopPercent || null,
        takeProfitPrice || null,
        stopLossPrice || null
      );

    const order = db.prepare("SELECT * FROM advanced_orders WHERE id = ?").get(result.lastInsertRowid);
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/orders/advanced
 * Get advanced orders
 */
app.get("/api/orders/advanced", auth, (req, res) => {
  try {
    const { status } = req.query;
    const query = status
      ? "SELECT * FROM advanced_orders WHERE user_id = ? AND status = ? ORDER BY created_at DESC"
      : "SELECT * FROM advanced_orders WHERE user_id = ? ORDER BY created_at DESC";

    const orders = status
      ? db.prepare(query).all(req.user.id, status)
      : db.prepare(query).all(req.user.id);

    res.json({ orders, total: orders.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== PORTFOLIO SNAPSHOT ROUTES ====================

/**
 * POST /api/portfolio/snapshot
 * Save portfolio snapshot
 */
app.post("/api/portfolio/snapshot", auth, async (req, res) => {
  try {
    const { totalValue, portfolioData } = req.body;

    const result = db
      .prepare(
        `INSERT INTO portfolio_snapshots (user_id, total_value, portfolio_data)
         VALUES (?, ?, ?)`
      )
      .run(req.user.id, totalValue, JSON.stringify(portfolioData));

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/portfolio/snapshots
 * Get portfolio snapshots
 */
app.get("/api/portfolio/snapshots", auth, (req, res) => {
  try {
    const snapshots = db
      .prepare("SELECT id, user_id, total_value, snapshot_date FROM portfolio_snapshots WHERE user_id = ? ORDER BY snapshot_date DESC LIMIT 100")
      .all(req.user.id);

    res.json({ snapshots, total: snapshots.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== HEDGE POSITIONS ROUTES ====================

/**
 * POST /api/hedging/position/create
 * Create hedge position
 */
app.post("/api/hedging/position/create", auth, async (req, res) => {
  try {
    const { underlyingSymbol, hedgeType, quantity, entryPrice } = req.body;

    const result = db
      .prepare(
        `INSERT INTO hedge_positions (user_id, underlying_symbol, hedge_type, quantity, entry_price)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(req.user.id, underlyingSymbol, hedgeType, quantity, entryPrice);

    const position = db.prepare("SELECT * FROM hedge_positions WHERE id = ?").get(result.lastInsertRowid);
    res.json(position);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/hedging/positions
 * Get hedge positions
 */
app.get("/api/hedging/positions", auth, (req, res) => {
  try {
    const positions = db
      .prepare("SELECT * FROM hedge_positions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC")
      .all(req.user.id);

    res.json({ positions, total: positions.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== PORTFOLIO OPTIMIZATION ROUTES ====================

/**
 * POST /api/optimization/efficient-frontier
 * Calculate efficient frontier
 */
app.post("/api/optimization/efficient-frontier", auth, async (req, res) => {
  try {
    const { holdings, prices, riskFreeRate } = req.body;
    const frontier = portfolioOptimizationService.calculateEfficientFrontier(
      holdings,
      prices,
      riskFreeRate || 0.02
    );
    res.json({ frontier, total: frontier.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/optimization/optimal-portfolio
 * Find optimal portfolio
 */
app.post("/api/optimization/optimal-portfolio", auth, async (req, res) => {
  try {
    const { holdings, prices, riskFreeRate } = req.body;
    const optimal = portfolioOptimizationService.findOptimalPortfolio(
      holdings,
      prices,
      riskFreeRate || 0.02
    );
    res.json(optimal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/optimization/recommendations
 * Get portfolio recommendations
 */
app.post("/api/optimization/recommendations", auth, async (req, res) => {
  try {
    const { profile, holdings, prices } = req.body;
    const recommendations = portfolioOptimizationService.generateRecommendations(
      profile,
      holdings,
      prices
    );
    res.json({ recommendations, total: recommendations.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/optimization/asset-allocation
 * Get suggested asset allocation
 */
app.post("/api/optimization/asset-allocation", auth, async (req, res) => {
  try {
    const { profile } = req.body;
    const allocation = portfolioOptimizationService.suggestAssetAllocation(profile);
    res.json(allocation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/optimization/min-variance
 * Calculate minimum variance portfolio
 */
app.post("/api/optimization/min-variance", auth, async (req, res) => {
  try {
    const { holdings } = req.body;
    const mvPortfolio = portfolioOptimizationService.calculateMinVariancePortfolio(holdings);
    res.json(mvPortfolio);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/optimization/tax-efficient-rebalance
 * Calculate tax-efficient rebalancing
 */
app.post("/api/optimization/tax-efficient-rebalance", auth, async (req, res) => {
  try {
    const { portfolio, targetAllocation, taxRates } = req.body;
    const taxEfficientPlan = portfolioOptimizationService.calculateTaxEfficientRebalancing(
      portfolio,
      targetAllocation,
      taxRates || {}
    );
    res.json(taxEfficientPlan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/optimization/momentum-rebalance
 * Get momentum-based rebalancing suggestions
 */
app.post("/api/optimization/momentum-rebalance", auth, async (req, res) => {
  try {
    const { portfolio, prices, momentum } = req.body;
    const suggestions = portfolioOptimizationService.suggestMomentumRebalancing(
      portfolio,
      prices,
      momentum || {}
    );
    res.json({ suggestions, total: suggestions.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const server = http.createServer(app);

// Initialize WebSocket Service
const wsService = new WebSocketService(server);

// Initialize Blockchain Services
let ethereumService, bscService, solanaService, tronService, cryptoDataService, erc1155Service;

try {
  const ETH_RPC_URL = process.env.ETH_RPC_URL || "https://ethereum.publicnode.com";
  const ETH_RPC_API_KEY = process.env.ETH_RPC_API_KEY || "";

  ethereumService = new EthereumService(ETH_RPC_URL, ETH_RPC_API_KEY);
  bscService = new EthereumService(BSC_RPC_URL, BSC_RPC_API_KEY);
  solanaService = new SolanaService(SOLANA_RPC_URL, SOLANA_RPC_API_KEY);

  // Initialize TRON service with network and endpoints
  tronService = new TronService(TRON_NETWORK, TRON_RPC_API_KEY, TRON_ENDPOINTS[TRON_NETWORK]);

  cryptoDataService = new CryptoDataService();

  // Initialize ERC-1155 service
  erc1155Service = new ERC1155Service();
  erc1155Service.initialize(ETH_RPC_URL);
  console.log("✓ ERC-1155 service initialized");

  console.log("✓ Blockchain services initialized successfully");
  console.log(`✓ TRON configured for ${TRON_NETWORK} network`);
} catch (error) {
  console.error("Warning: Some blockchain services failed to initialize:", error.message);
}

// Initialize Email Service
const emailService = new EmailService();

// ==================== INITIALIZE ADVANCED FEATURES ====================
// Import and register all advanced trading, analytics, and monitoring endpoints
createAdvancedRoutes(app, {
  auth,
  TechnicalIndicators,
  advancedAnalyticsService,
  portfolioOptimizationService,
  riskManagementService,
  db,
  wsService,
  WebSocketBroadcaster,
  RequestValidator,
  metricsCollector,
  advancedCacheManager,
  cryptoDataCircuitBreaker,
});

console.log("✓ Advanced features integrated (Technical Indicators, Portfolio Optimization, Risk Management)");
console.log("✓ Performance monitoring, caching, and rate limiting enabled");

// 404/SPA fallback must be registered after all routes (including advanced routes) so they aren't shadowed
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API route not found" });
});

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.use((err, req, res, _next) => {
  metricsCollector.recordError();
  const { statusCode, error: errorBody } = AdvancedErrorHandler.createErrorResponse(500, err, {
    method: req.method,
    path: req.originalUrl,
  });
  AdvancedLogger.error(err.message || "Unhandled server error", { path: req.originalUrl });
  res.status(statusCode).json({ error: "Internal server error", ...errorBody });
});

server.listen(PORT, () => {
  console.log(`${APP_NAME} API running on http://localhost:${PORT}`);
  console.log(`${APP_NAME} WebSocket server ready for real-time updates`);
  if (JWT_SECRET === "dev-secret-change-me") {
    console.warn(
      "Warning: using default JWT secret. Set JWT_SECRET in .env for production-like use."
    );
  }
  if (CORS_ORIGIN === "*") {
    console.warn("Warning: CORS_ORIGIN is '*'. Restrict it in production.");
  }
});

server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Set a different PORT in .env and restart.`);
    process.exit(1);
  }
  console.error("Server startup error", err);
  process.exit(1);
});
