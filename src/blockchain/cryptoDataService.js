const CoinGecko = require("coingecko-api");
const axios = require("axios");

/**
 * Cryptocurrency Price and Market Data Service
 * Provides real-time and historical price data from CoinGecko
 */

class CryptoDataService {
  constructor() {
    this.coinGeckoClient = new CoinGecko();
    this.cache = new Map();
    this.cacheDuration = 60000; // 1 minute cache
  }

  /**
   * Get cached data or fetch new data
   * @param {string} key - Cache key
   * @param {Function} fetchFn - Function to fetch data
   * @returns {Promise<any>} Cached or fresh data
   */
  async getCachedOrFetch(key, fetchFn) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      return cached.data;
    }

    const data = await fetchFn();
    this.cache.set(key, { data, timestamp: Date.now() });
    return data;
  }

  /**
   * Get current prices for multiple cryptocurrencies
   * @param {Array<string>} ids - CoinGecko IDs (e.g., ["bitcoin", "ethereum"])
   * @param {string} vsCurrency - Target currency (default: "usd")
   * @returns {Promise<object>} Price data
   */
  async getPrices(ids, vsCurrency = "usd") {
    const cacheKey = `prices_${ids.join(",")}_${vsCurrency}`;
    return await this.getCachedOrFetch(cacheKey, async () => {
      const response = await this.coinGeckoClient.simple.price({
        ids,
        vs_currencies: [vsCurrency],
        include_24hr_change: true,
        include_24hr_vol: true,
        include_market_cap: true,
        include_last_updated_at: true
      });
      return response.data;
    });
  }

  /**
   * Get detailed coin information
   * @param {string} id - CoinGecko ID
   * @returns {Promise<object>} Detailed coin data
   */
  async getCoinData(id) {
    const cacheKey = `coin_${id}`;
    return await this.getCachedOrFetch(cacheKey, async () => {
      const response = await this.coinGeckoClient.coins.fetch(id, {
        localization: false,
        tickers: false,
        market_data: true,
        community_data: false,
        developer_data: false,
        sparkline: false
      });
      return response.data;
    });
  }

  /**
   * Get market chart data for a coin
   * @param {string} id - CoinGecko ID
   * @param {string} vsCurrency - Target currency
   * @param {number} days - Number of days (1, 7, 14, 30, 90, 180, 365, max)
   * @returns {Promise<object>} Chart data
   */
  async getMarketChart(id, vsCurrency = "usd", days = 7) {
    const response = await this.coinGeckoClient.coins.fetchMarketChart(id, {
      vs_currency: vsCurrency,
      days
    });
    return response.data;
  }

  /**
   * Get OHLC data for charting
   * @param {string} id - CoinGecko ID
   * @param {string} vsCurrency - Target currency
   * @param {number} days - Number of days (1, 7, 14, 30, 90, 180, 365)
   * @returns {Promise<Array>} OHLC data
   */
  async getOHLC(id, vsCurrency = "usd", days = 7) {
    const response = await this.coinGeckoClient.coins.fetchOHLC(id, {
      vs_currency: vsCurrency,
      days
    });
    return response.data;
  }

  /**
   * Get trending coins
   * @returns {Promise<Array>} Trending coins
   */
  async getTrending() {
    const cacheKey = "trending";
    return await this.getCachedOrFetch(cacheKey, async () => {
      const response = await this.coinGeckoClient.trending();
      return response.data.coins;
    });
  }

  /**
   * Get global crypto market data
   * @returns {Promise<object>} Global market data
   */
  async getGlobalData() {
    const cacheKey = "global";
    return await this.getCachedOrFetch(cacheKey, async () => {
      const response = await this.coinGeckoClient.global();
      return response.data.data;
    });
  }

  /**
   * Search for coins
   * @param {string} query - Search query
   * @returns {Promise<Array>} Search results
   */
  async searchCoins(query) {
    const response = await this.coinGeckoClient.search(query);
    return response.data.coins;
  }

  /**
   * Get list of supported coins
   * @returns {Promise<Array>} List of all coins
   */
  async getCoinsList() {
    const cacheKey = "coins_list";
    return await this.getCachedOrFetch(cacheKey, async () => {
      const response = await this.coinGeckoClient.coins.list();
      return response.data;
    });
  }

  /**
   * Get exchange rates
   * @returns {Promise<object>} Exchange rates
   */
  async getExchangeRates() {
    const cacheKey = "exchange_rates";
    return await this.getCachedOrFetch(cacheKey, async () => {
      const response = await this.coinGeckoClient.exchangeRates.all();
      return response.data.rates;
    });
  }

  /**
   * Get supported vs currencies
   * @returns {Promise<Array>} List of supported currencies
   */
  async getSupportedVsCurrencies() {
    const cacheKey = "vs_currencies";
    return await this.getCachedOrFetch(cacheKey, async () => {
      const response = await this.coinGeckoClient.simple.supportedVsCurrencies();
      return response.data;
    });
  }

  /**
   * Get token price by contract address
   * @param {string} platform - Platform (ethereum, binance-smart-chain, solana, etc.)
   * @param {string} contractAddress - Token contract address
   * @param {string} vsCurrency - Target currency
   * @returns {Promise<object>} Token price data
   */
  async getTokenPrice(platform, contractAddress, vsCurrency = "usd") {
    try {
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/token_price/${platform}`,
        {
          params: {
            contract_addresses: contractAddress,
            vs_currencies: vsCurrency,
            include_24hr_change: true,
            include_24hr_vol: true,
            include_market_cap: true
          }
        }
      );
      return response.data[contractAddress.toLowerCase()];
    } catch (error) {
      console.error("Error fetching token price:", error);
      throw error;
    }
  }

  /**
   * Get historical price at specific date
   * @param {string} id - CoinGecko ID
   * @param {string} date - Date in DD-MM-YYYY format
   * @param {string} vsCurrency - Target currency
   * @returns {Promise<object>} Historical price data
   */
  async getHistoricalPrice(id, date, _vsCurrency = "usd") {
    const response = await this.coinGeckoClient.coins.fetchHistory(id, {
      date,
      localization: false
    });
    return response.data.market_data;
  }

  /**
   * Get market data for multiple coins
   * @param {string} vsCurrency - Target currency
   * @param {Array<string>} ids - Array of coin IDs
   * @param {number} perPage - Results per page
   * @param {number} page - Page number
   * @returns {Promise<Array>} Market data
   */
  async getMarketsData(vsCurrency = "usd", ids = [], perPage = 100, page = 1) {
    const response = await this.coinGeckoClient.coins.markets({
      vs_currency: vsCurrency,
      ids: ids.join(","),
      per_page: perPage,
      page,
      sparkline: false,
      price_change_percentage: "24h,7d"
    });
    return response.data;
  }

  /**
   * Convert amount from one currency to another
   * @param {string} fromCurrency - Source currency code
   * @param {string} toCurrency - Target currency code
   * @param {number} amount - Amount to convert
   * @returns {Promise<number>} Converted amount
   */
  async convertCurrency(fromCurrency, toCurrency, amount) {
    const rates = await this.getExchangeRates();
    const fromRate = rates[fromCurrency.toLowerCase()]?.value || 1;
    const toRate = rates[toCurrency.toLowerCase()]?.value || 1;
    return (amount / fromRate) * toRate;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache stats
   * @returns {object} Cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Map common symbols to CoinGecko IDs
   * @param {string} symbol - Crypto symbol (BTC, ETH, etc.)
   * @returns {string} CoinGecko ID
   */
  symbolToId(symbol) {
    const mapping = {
      BTC: "bitcoin",
      ETH: "ethereum",
      USDT: "tether",
      USDC: "usd-coin",
      BNB: "binancecoin",
      SOL: "solana",
      ADA: "cardano",
      XRP: "ripple",
      DOT: "polkadot",
      DOGE: "dogecoin",
      MATIC: "matic-network",
      AVAX: "avalanche-2",
      TRX: "tron",
      LINK: "chainlink",
      UNI: "uniswap"
    };
    return mapping[symbol.toUpperCase()] || symbol.toLowerCase();
  }
}

module.exports = CryptoDataService;
