/**
 * Binance API Service
 * Integration with Binance REST API for spot trading and market data
 */

const axios = require("axios");
const crypto = require("crypto");

class BinanceApiService {
  constructor() {
    this.apiKey = process.env.BINANCE_API_KEY || "";
    this.apiSecret = process.env.BINANCE_API_SECRET || "";
    this.baseUrl = process.env.BINANCE_BASE_URL || "https://api.binance.us/api/v3";
    this.testnetUrl = process.env.BINANCE_TESTNET_URL || "https://testnet.binance.vision/api/v3";
    this.useTestnet = process.env.BINANCE_TESTNET === "true";
    this.configured = Boolean(this.apiKey && this.apiSecret);

    // Margin trading config
    this.marginConfig = {
      maxLeverage: 10,
      minMargin: 100,
      liquidationThreshold: 1.05,
    };

    // Trading pairs cache
    this.exchangeInfo = null;
    this.priceCache = new Map();
    this.orderCache = new Map();

    console.log("✅ Binance API Service initialized" + (this.useTestnet ? " (TESTNET)" : ""));
  }

  /**
   * Generate signature for authenticated requests
   */
  generateSignature(data) {
    return crypto.createHmac("sha256", this.apiSecret).update(data).digest("hex");
  }

  /**
   * Make authenticated request
   */
  async authenticatedRequest(method, endpoint, params = {}) {
    if (!this.configured) {
      throw new Error("Binance API credentials not configured");
    }

    const baseUrl = this.useTestnet ? this.testnetUrl : this.baseUrl;
    const timestamp = Date.now();
    const queryData = `timestamp=${timestamp}&${new URLSearchParams(params).toString()}`;
    const signature = this.generateSignature(queryData);

    try {
      const response = await axios({
        method,
        url: `${baseUrl}${endpoint}?${queryData}&signature=${signature}`,
        headers: {
          "X-MBX-APIKEY": this.apiKey,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error("Binance API Error:", error.message);
      return {
        success: false,
        error: error.response?.data?.msg || error.message,
      };
    }
  }

  /**
   * Get account information
   */
  async getAccountInfo() {
    return this.authenticatedRequest("GET", "/account");
  }

  /**
   * Get account trading rules
   */
  async getExchangeInfo() {
    if (this.exchangeInfo) return { success: true, data: this.exchangeInfo };

    try {
      const baseUrl = this.useTestnet ? this.testnetUrl : this.baseUrl;
      const response = await axios.get(`${baseUrl}/exchangeInfo`, { timeout: 30000 });
      this.exchangeInfo = response.data;
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get latest prices for multiple symbols
   */
  async getPrices(symbols = null) {
    try {
      const baseUrl = this.useTestnet ? this.testnetUrl : this.baseUrl;
      const params = symbols ? `?symbols=${JSON.stringify(symbols)}` : "";
      const response = await axios.get(`${baseUrl}/ticker/price${params}`, { timeout: 30000 });
      const data = Array.isArray(response.data) ? response.data : [response.data];

      // Update cache
      data.forEach((item) => {
        this.priceCache.set(item.symbol, {
          price: parseFloat(item.price),
          timestamp: Date.now(),
        });
      });

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Place a limit order
   */
  async placeLimitOrder(symbol, side, quantity, price) {
    const params = {
      symbol,
      side: side.toUpperCase(),
      type: "LIMIT",
      timeInForce: "GTC",
      quantity: String(quantity),
      price: String(price),
    };

    return this.authenticatedRequest("POST", "/order", params);
  }

  /**
   * Place a market order
   */
  async placeMarketOrder(symbol, side, quantity) {
    const params = {
      symbol,
      side: side.toUpperCase(),
      type: "MARKET",
      quantity: String(quantity),
    };

    return this.authenticatedRequest("POST", "/order", params);
  }

  /**
   * Cancel an order
   */
  async cancelOrder(symbol, orderId) {
    const params = { symbol, orderId };
    return this.authenticatedRequest("DELETE", "/order", params);
  }

  /**
   * Get open orders
   */
  async getOpenOrders(symbol = null) {
    const params = symbol ? { symbol } : {};
    return this.authenticatedRequest("GET", "/openOrders", params);
  }

  /**
   * Get order history
   */
  async getOrderHistory(symbol, limit = 500) {
    const params = { symbol, limit };
    return this.authenticatedRequest("GET", "/allOrders", params);
  }

  /**
   * Get trades
   */
  async getTrades(symbol, limit = 500) {
    const params = { symbol, limit };
    return this.authenticatedRequest("GET", "/myTrades", params);
  }

  /**
   * Calculate margin requirements
   */
  calculateMarginRequirement(quantity, price, leverage) {
    const totalValue = quantity * price;
    const marginRequired = totalValue / leverage;
    return {
      totalValue,
      marginRequired,
      availableBalance: marginRequired / this.marginConfig.maxLeverage,
      maxQuantity: (marginRequired * this.marginConfig.maxLeverage) / price,
    };
  }

  /**
   * Calculate position liquidation price
   */
  calculateLiquidationPrice(entryPrice, quantity, collateral, _leverage) {
    const notional = quantity * entryPrice;
    const borrowedAmount = notional - collateral;
    const liquidationThreshold = this.marginConfig.liquidationThreshold;
    const liquidationPrice = (borrowedAmount * liquidationThreshold) / quantity;

    return {
      liquidationPrice,
      marginLevel: collateral / borrowedAmount,
      dangerZone: liquidationPrice > entryPrice * 0.95,
    };
  }

  /**
   * Validate symbol and get trading info
   */
  async getSymbolInfo(symbol) {
    const info = await this.getExchangeInfo();
    if (!info.success) return info;

    const symbolData = info.data.symbols?.find(
      (s) => s.symbol === symbol.toUpperCase()
    );

    if (!symbolData) {
      return { success: false, error: "Symbol not found" };
    }

    const filters = {};
    symbolData.filters?.forEach((f) => {
      filters[f.filterType] = f;
    });

    return {
      success: true,
      data: {
        symbol: symbolData.symbol,
        status: symbolData.status,
        baseAsset: symbolData.baseAsset,
        quoteAsset: symbolData.quoteAsset,
        filters,
      },
    };
  }

  /**
   * Get 24hr ticker stats
   */
  async get24hrStats(symbol) {
    try {
      const baseUrl = this.useTestnet ? this.testnetUrl : this.baseUrl;
      const response = await axios.get(`${baseUrl}/ticker/24hr?symbol=${symbol}`, {
        timeout: 30000,
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get klines (candlestick) data
   */
  async getKlines(symbol, interval = "1h", limit = 500) {
    try {
      const baseUrl = this.useTestnet ? this.testnetUrl : this.baseUrl;
      const response = await axios.get(
        `${baseUrl}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
        { timeout: 30000 }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get order book
   */
  async getOrderBook(symbol, limit = 20) {
    try {
      const baseUrl = this.useTestnet ? this.testnetUrl : this.baseUrl;
      const response = await axios.get(
        `${baseUrl}/depth?symbol=${symbol}&limit=${limit}`,
        { timeout: 30000 }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = BinanceApiService;
