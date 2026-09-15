/**
 * MetaTrader API Service
 * Integration with MetaTrader API for forex and CFD trading
 */

const axios = require("axios");

class MetaTraderService {
  constructor() {
    this.apiKey = process.env.METATRADER_API_KEY || "";
    this.baseUrl = process.env.METATRADER_API_URL || "https://api.metatrader.com/v1";
    this.configured = Boolean(this.apiKey);

    // Configure axios instance with API key
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });

    // Trading state
    this.positions = new Map(); // positionId -> position data
    this.orders = new Map(); // orderId -> order data
    this.accountInfo = null;
    this.symbols = new Map(); // symbol -> symbol info
    this.priceCache = new Map(); // symbol -> price data

    console.log("✅ MetaTrader Service initialized");
  }

  /**
   * Get account information
   */
  async getAccountInfo() {
    try {
      const response = await this.client.get("/account/info");
      this.accountInfo = response.data;
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error("MetaTrader API Error (Account Info):", error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Get account balance and equity
   */
  async getAccountBalance() {
    try {
      const response = await this.client.get("/account/balance");
      return {
        success: true,
        data: {
          balance: response.data.balance,
          equity: response.data.equity,
          margin: response.data.margin,
          freeMargin: response.data.freeMargin,
          marginLevel: response.data.marginLevel,
          profit: response.data.profit,
          currency: response.data.currency || "USD",
        },
      };
    } catch (error) {
      console.error("MetaTrader API Error (Balance):", error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Get available symbols (currency pairs, CFDs)
   */
  async getSymbols() {
    try {
      const response = await this.client.get("/symbols");

      // Cache symbols
      response.data.symbols?.forEach((symbol) => {
        this.symbols.set(symbol.name, symbol);
      });

      return {
        success: true,
        data: response.data.symbols || [],
      };
    } catch (error) {
      console.error("MetaTrader API Error (Symbols):", error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Get symbol information
   */
  async getSymbolInfo(symbol) {
    try {
      const response = await this.client.get(`/symbols/${symbol}`);
      this.symbols.set(symbol, response.data);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error(`MetaTrader API Error (Symbol ${symbol}):`, error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Get current price for a symbol
   */
  async getPrice(symbol) {
    try {
      const response = await this.client.get(`/quotes/${symbol}`);

      const priceData = {
        symbol,
        bid: response.data.bid,
        ask: response.data.ask,
        spread: response.data.spread,
        timestamp: response.data.timestamp || Date.now(),
      };

      // Cache price
      this.priceCache.set(symbol, priceData);

      return {
        success: true,
        data: priceData,
      };
    } catch (error) {
      console.error(`MetaTrader API Error (Price ${symbol}):`, error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Get historical price data (OHLCV)
   */
  async getHistoricalData(symbol, timeframe = "1h", limit = 100) {
    try {
      const response = await this.client.get(`/quotes/${symbol}/history`, {
        params: { timeframe, limit },
      });

      return {
        success: true,
        data: response.data.candles || [],
      };
    } catch (error) {
      console.error(`MetaTrader API Error (History ${symbol}):`, error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Place a market order
   */
  async placeMarketOrder(params) {
    const {
      symbol,
      type, // 'buy' or 'sell'
      volume, // Lot size
      stopLoss, // Optional stop loss price
      takeProfit, // Optional take profit price
      comment, // Optional order comment
    } = params;

    try {
      const response = await this.client.post("/orders/market", {
        symbol,
        type: type.toUpperCase(),
        volume,
        stopLoss,
        takeProfit,
        comment: comment || `Market ${type} order`,
      });

      const order = response.data;
      this.orders.set(order.orderId, order);

      return {
        success: true,
        data: order,
      };
    } catch (error) {
      console.error("MetaTrader API Error (Market Order):", error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Place a pending order
   */
  async placePendingOrder(params) {
    const {
      symbol,
      type, // 'buy_limit', 'sell_limit', 'buy_stop', 'sell_stop'
      volume, // Lot size
      price, // Entry price
      stopLoss, // Optional stop loss price
      takeProfit, // Optional take profit price
      expiration, // Optional expiration time
      comment, // Optional order comment
    } = params;

    try {
      const response = await this.client.post("/orders/pending", {
        symbol,
        type: type.toUpperCase(),
        volume,
        price,
        stopLoss,
        takeProfit,
        expiration,
        comment: comment || `Pending ${type} order`,
      });

      const order = response.data;
      this.orders.set(order.orderId, order);

      return {
        success: true,
        data: order,
      };
    } catch (error) {
      console.error("MetaTrader API Error (Pending Order):", error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Modify an existing order
   */
  async modifyOrder(orderId, modifications) {
    try {
      const response = await this.client.put(`/orders/${orderId}`, modifications);

      const order = response.data;
      this.orders.set(orderId, order);

      return {
        success: true,
        data: order,
      };
    } catch (error) {
      console.error(`MetaTrader API Error (Modify Order ${orderId}):`, error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Close an order/position
   */
  async closeOrder(orderId, volume = null) {
    try {
      const response = await this.client.post(`/orders/${orderId}/close`, {
        volume, // Partial close if specified
      });

      // Remove from orders map if fully closed
      if (!volume || response.data.status === "closed") {
        this.orders.delete(orderId);
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error(`MetaTrader API Error (Close Order ${orderId}):`, error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Cancel a pending order
   */
  async cancelOrder(orderId) {
    try {
      const response = await this.client.delete(`/orders/${orderId}`);
      this.orders.delete(orderId);

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error(`MetaTrader API Error (Cancel Order ${orderId}):`, error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Get all open positions
   */
  async getOpenPositions() {
    try {
      const response = await this.client.get("/positions");

      // Update positions map
      this.positions.clear();
      response.data.positions?.forEach((position) => {
        this.positions.set(position.positionId, position);
      });

      return {
        success: true,
        data: response.data.positions || [],
      };
    } catch (error) {
      console.error("MetaTrader API Error (Open Positions):", error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Get all pending orders
   */
  async getPendingOrders() {
    try {
      const response = await this.client.get("/orders/pending");

      return {
        success: true,
        data: response.data.orders || [],
      };
    } catch (error) {
      console.error("MetaTrader API Error (Pending Orders):", error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Get trade history
   */
  async getTradeHistory(startDate = null, endDate = null) {
    try {
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await this.client.get("/history/trades", { params });

      return {
        success: true,
        data: response.data.trades || [],
      };
    } catch (error) {
      console.error("MetaTrader API Error (Trade History):", error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Get position details
   */
  async getPositionDetails(positionId) {
    try {
      const response = await this.client.get(`/positions/${positionId}`);
      this.positions.set(positionId, response.data);

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error(`MetaTrader API Error (Position ${positionId}):`, error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Calculate position profit/loss
   */
  calculatePnL(position, currentPrice) {
    const { type, volume, openPrice } = position;
    const priceDiff = type === "BUY" ? currentPrice - openPrice : openPrice - currentPrice;

    return priceDiff * volume;
  }

  /**
   * Get trading statistics
   */
  async getTradingStats() {
    try {
      const [positionsResult, historyResult, balanceResult] = await Promise.all([
        this.getOpenPositions(),
        this.getTradeHistory(),
        this.getAccountBalance(),
      ]);

      if (!positionsResult.success || !historyResult.success || !balanceResult.success) {
        throw new Error("Failed to fetch trading statistics");
      }

      const positions = positionsResult.data;
      const history = historyResult.data;
      const balance = balanceResult.data;

      // Calculate statistics
      const totalTrades = history.length;
      const profitableTrades = history.filter((t) => t.profit > 0).length;
      const losingTrades = history.filter((t) => t.profit < 0).length;
      const winRate = totalTrades > 0 ? (profitableTrades / totalTrades) * 100 : 0;

      const totalProfit = history.reduce((sum, t) => sum + (t.profit || 0), 0);
      const averageProfit = totalTrades > 0 ? totalProfit / totalTrades : 0;

      return {
        success: true,
        data: {
          account: balance,
          openPositions: positions.length,
          totalTrades,
          profitableTrades,
          losingTrades,
          winRate: winRate.toFixed(2),
          totalProfit: totalProfit.toFixed(2),
          averageProfit: averageProfit.toFixed(2),
        },
      };
    } catch (error) {
      console.error("MetaTrader API Error (Trading Stats):", error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Check API connection status
   */
  async checkConnection() {
    if (!this.configured) {
      return {
        success: true,
        connected: false,
        configured: false,
        message: "Set METATRADER_API_KEY to enable MetaTrader integration",
      };
    }

    try {
      await this.client.get("/ping");
      return {
        success: true,
        connected: true,
        configured: true,
        message: "MetaTrader API connected",
      };
    } catch (error) {
      console.error("MetaTrader API Error (Connection Check):", error.message);
      return {
        success: false,
        connected: false,
        configured: true,
        error: error.message,
      };
    }
  }

  /**
   * Format order/position for display
   */
  formatPosition(position) {
    return {
      id: position.positionId || position.orderId,
      symbol: position.symbol,
      type: position.type,
      volume: position.volume,
      openPrice: position.openPrice || position.price,
      currentPrice: position.currentPrice,
      profit: position.profit,
      stopLoss: position.stopLoss,
      takeProfit: position.takeProfit,
      openTime: position.openTime,
      comment: position.comment,
    };
  }
}

module.exports = MetaTraderService;
