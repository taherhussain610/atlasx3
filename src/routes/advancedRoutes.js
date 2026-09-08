/**
 * Technical Indicators & Advanced Analytics API Routes
 * Provides all technical analysis and advanced analytics endpoints
 */

module.exports = function createAdvancedRoutes(app, { 
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
}) {
  const broadcastWs = new WebSocketBroadcaster(wsService);

  // ==================== TECHNICAL INDICATORS ENDPOINTS ====================

  /**
   * POST /api/indicators/sma
   * Calculate Simple Moving Average
   */
  app.post("/api/indicators/sma", auth, (req, res) => {
    try {
      const { prices, period } = req.body;
      if (!prices || !Array.isArray(prices) || prices.length === 0) {
        return res.status(400).json({ error: "Prices array is required and must not be empty" });
      }
      if (!period || period < 2) {
        return res.status(400).json({ error: "Period must be at least 2" });
      }

      const sma = TechnicalIndicators.calculateSMA(prices, period);
      res.json({
        indicator: "SMA",
        period,
        values: sma,
        dataPoints: sma.length,
      });
    } catch (error) {
      console.error("SMA calculation error:", error);
      res.status(500).json({ error: "Failed to calculate SMA" });
    }
  });

  /**
   * POST /api/indicators/ema
   * Calculate Exponential Moving Average
   */
  app.post("/api/indicators/ema", auth, (req, res) => {
    try {
      const { prices, period } = req.body;
      if (!prices || !Array.isArray(prices) || prices.length === 0) {
        return res.status(400).json({ error: "Prices array is required and must not be empty" });
      }
      if (!period || period < 2) {
        return res.status(400).json({ error: "Period must be at least 2" });
      }

      const ema = TechnicalIndicators.calculateEMA(prices, period);
      res.json({
        indicator: "EMA",
        period,
        values: ema,
        dataPoints: ema.length,
      });
    } catch (error) {
      console.error("EMA calculation error:", error);
      res.status(500).json({ error: "Failed to calculate EMA" });
    }
  });

  /**
   * POST /api/indicators/rsi
   * Calculate Relative Strength Index
   */
  app.post("/api/indicators/rsi", auth, (req, res) => {
    try {
      const { prices, period = 14 } = req.body;
      if (!prices || !Array.isArray(prices) || prices.length === 0) {
        return res.status(400).json({ error: "Prices array is required and must not be empty" });
      }

      const rsi = TechnicalIndicators.calculateRSI(prices, period);
      const current = rsi.length > 0 ? rsi[rsi.length - 1] : 0;

      res.json({
        indicator: "RSI",
        period,
        values: rsi,
        current,
        overbought: current > 70,
        oversold: current < 30,
        dataPoints: rsi.length,
      });
    } catch (error) {
      console.error("RSI calculation error:", error);
      res.status(500).json({ error: "Failed to calculate RSI" });
    }
  });

  /**
   * POST /api/indicators/macd
   * Calculate Moving Average Convergence Divergence
   */
  app.post("/api/indicators/macd", auth, (req, res) => {
    try {
      const { prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9 } = req.body;
      if (!prices || !Array.isArray(prices) || prices.length === 0) {
        return res.status(400).json({ error: "Prices array is required and must not be empty" });
      }

      const macd = TechnicalIndicators.calculateMACD(prices, fastPeriod, slowPeriod, signalPeriod);
      res.json({
        indicator: "MACD",
        fastPeriod,
        slowPeriod,
        signalPeriod,
        macd: macd.macd,
        signal: macd.signal,
        histogram: macd.histogram,
        dataPoints: macd.macd.length,
      });
    } catch (error) {
      console.error("MACD calculation error:", error);
      res.status(500).json({ error: "Failed to calculate MACD" });
    }
  });

  /**
   * POST /api/indicators/bollinger
   * Calculate Bollinger Bands
   */
  app.post("/api/indicators/bollinger", auth, (req, res) => {
    try {
      const { prices, period = 20, stdDev = 2 } = req.body;
      if (!prices || !Array.isArray(prices) || prices.length === 0) {
        return res.status(400).json({ error: "Prices array is required and must not be empty" });
      }

      const bands = TechnicalIndicators.calculateBollingerBands(prices, period, stdDev);
      res.json({
        indicator: "BOLLINGER_BANDS",
        period,
        stdDev,
        upper: bands.upper,
        middle: bands.middle,
        lower: bands.lower,
        dataPoints: bands.upper.length,
      });
    } catch (error) {
      console.error("Bollinger Bands calculation error:", error);
      res.status(500).json({ error: "Failed to calculate Bollinger Bands" });
    }
  });

  /**
   * POST /api/indicators/stochastic
   * Calculate Stochastic Oscillator
   */
  app.post("/api/indicators/stochastic", auth, (req, res) => {
    try {
      const { highs, lows, closes, period = 14, smoothK = 3, smoothD = 3 } = req.body;
      if (
        !Array.isArray(highs) ||
        !Array.isArray(lows) ||
        !Array.isArray(closes) ||
        closes.length < period ||
        highs.length !== closes.length ||
        lows.length !== closes.length
      ) {
        return res.status(400).json({
          error: "Equal-length highs, lows, and closes arrays with enough data are required",
        });
      }

      const rawK = TechnicalIndicators.calculateStochastic(highs, lows, closes, period);
      const k = smoothK > 1 ? TechnicalIndicators.calculateSMA(rawK, smoothK) : rawK;
      const d = smoothD > 1 ? TechnicalIndicators.calculateSMA(k, smoothD) : k;
      res.json({
        indicator: "STOCHASTIC",
        period,
        smoothK,
        smoothD,
        k,
        d,
        overbought: k.length > 0 && k[k.length - 1] > 80,
        oversold: k.length > 0 && k[k.length - 1] < 20,
        dataPoints: k.length,
      });
    } catch (error) {
      console.error("Stochastic Oscillator calculation error:", error);
      res.status(500).json({ error: "Failed to calculate Stochastic Oscillator" });
    }
  });

  /**
   * POST /api/indicators/atr
   * Calculate Average True Range
   */
  app.post("/api/indicators/atr", auth, (req, res) => {
    try {
      const { highs, lows, closes, period = 14 } = req.body;
      if (!highs || !lows || !closes) {
        return res
          .status(400)
          .json({ error: "Highs, lows, and closes arrays are required" });
      }

      const atr = TechnicalIndicators.calculateATR(highs, lows, closes, period);
      res.json({
        indicator: "ATR",
        period,
        values: atr,
        current: atr.length > 0 ? atr[atr.length - 1] : 0,
        dataPoints: atr.length,
      });
    } catch (error) {
      console.error("ATR calculation error:", error);
      res.status(500).json({ error: "Failed to calculate ATR" });
    }
  });

  /**
   * POST /api/indicators/all
   * Calculate all common technical indicators at once
   */
  app.post("/api/indicators/all", auth, (req, res) => {
    try {
      const { prices, highs, lows, closes, periods = {} } = req.body;
      if (!prices || !Array.isArray(prices) || prices.length === 0) {
        return res.status(400).json({ error: "Prices array is required and must not be empty" });
      }

      const indicators = {
        sma20: TechnicalIndicators.calculateSMA(prices, periods.sma || 20),
        ema12: TechnicalIndicators.calculateEMA(prices, periods.ema || 12),
        rsi: TechnicalIndicators.calculateRSI(prices, periods.rsi || 14),
        macd: TechnicalIndicators.calculateMACD(prices),
        bollinger: TechnicalIndicators.calculateBollingerBands(prices),
      };

      if (
        Array.isArray(highs) &&
        Array.isArray(lows) &&
        Array.isArray(closes) &&
        highs.length === closes.length &&
        lows.length === closes.length
      ) {
        const rawK = TechnicalIndicators.calculateStochastic(
          highs,
          lows,
          closes,
          periods.stochastic || 14
        );
        const k = TechnicalIndicators.calculateSMA(rawK, periods.smoothK || 3);
        indicators.stochastic = {
          k,
          d: TechnicalIndicators.calculateSMA(k, periods.smoothD || 3),
        };
        indicators.atr = TechnicalIndicators.calculateATR(highs, lows, closes);
      }

      res.json({
        indicators,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("All indicators calculation error:", error);
      res.status(500).json({ error: "Failed to calculate indicators" });
    }
  });

  // ==================== ADVANCED ANALYTICS ENDPOINTS ====================

  /**
   * POST /api/analytics/portfolio-analysis
   * Comprehensive portfolio analysis
   */
  app.post("/api/analytics/portfolio-analysis", auth, (req, res) => {
    try {
      const { holdings, prices } = req.body;
      const validation = RequestValidator.validatePortfolioParams(req.body);
      if (!validation.valid) {
        return res.status(400).json({ errors: validation.errors });
      }

      const metrics = advancedAnalyticsService.calculatePortfolioMetrics(holdings, prices);
      const diversification = advancedAnalyticsService.generateDiversificationReport(
        holdings,
        metrics.breakdown
      );

      const recommendations = [];
      if (Number(diversification.concentration) > 70) {
        recommendations.push("Portfolio is highly concentrated - consider diversifying into more assets");
      }
      if (metrics.totalGainPercent < 0) {
        recommendations.push("Portfolio is currently at a loss - review stop-loss and risk limits");
      }
      if (holdings.length < 3) {
        recommendations.push("Consider holding at least 3-5 assets for better diversification");
      }
      if (recommendations.length === 0) {
        recommendations.push("Portfolio allocation looks healthy");
      }

      broadcastWs.broadcastAnalyticsUpdate(req.user.id, { metrics, diversification });

      res.json({
        metrics,
        diversification,
        recommendations,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Portfolio analysis error:", error);
      res.status(500).json({ error: "Failed to analyze portfolio" });
    }
  });

  /**
   * POST /api/analytics/performance-metrics
   * Calculate detailed performance metrics
   */
  app.post("/api/analytics/performance-metrics", auth, (req, res) => {
    try {
      const { returns, riskFreeRate = 0.02, confidence = 0.95 } = req.body;
      if (!returns || !Array.isArray(returns) || returns.length < 2) {
        return res.status(400).json({ error: "Returns array with at least 2 values is required" });
      }

      const metrics = advancedAnalyticsService.calculateRiskMetrics(returns, riskFreeRate);
      const cvar = riskManagementService.calculateCVaR([...returns], confidence);
      const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const maxDrawdownDecimal = Number(metrics.maxDrawdown) / 100;
      const calmarRatio = maxDrawdownDecimal > 0 ? avgReturn / maxDrawdownDecimal : 0;

      res.json({
        sharpeRatio: Number(metrics.sharpeRatio),
        sortinoRatio: Number(metrics.sortinoRatio),
        maxDrawdown: Number(metrics.maxDrawdown),
        volatility: Number(metrics.volatility),
        calmarRatio: Number(calmarRatio.toFixed(4)),
        cvar,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Performance metrics error:", error);
      res.status(500).json({ error: "Failed to calculate performance metrics" });
    }
  });

  /**
   * GET /api/analytics/user-stats
   * Get user's analytics statistics
   */
  app.get("/api/analytics/user-stats", auth, (req, res) => {
    try {
      const userId = req.user.id;
      const totals = db
        .prepare("SELECT COUNT(*) AS totalTransactions FROM transactions WHERE user_id = ?")
        .get(userId);
      const byType = db
        .prepare(
          "SELECT type, COUNT(*) AS count, SUM(amount) AS total FROM transactions WHERE user_id = ? GROUP BY type ORDER BY count DESC"
        )
        .all(userId);
      const balances = db
        .prepare("SELECT currency, balance FROM balances WHERE user_id = ? ORDER BY currency")
        .all(userId);

      res.json({
        totalTransactions: totals.totalTransactions,
        byType,
        balances,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("User stats error:", error);
      res.status(500).json({ error: "Failed to get user statistics" });
    }
  });

  // ==================== PORTFOLIO OPTIMIZATION ENDPOINTS ====================

  /**
   * POST /api/portfolio/optimize
   * Get optimized portfolio allocation
   */
  app.post("/api/portfolio/optimize", auth, (req, res) => {
    try {
      const { holdings, prices = {}, riskFreeRate = 0.02 } = req.body;
      if (!holdings || !Array.isArray(holdings) || holdings.length === 0) {
        return res.status(400).json({ error: "Holdings array is required" });
      }

      const optimization = portfolioOptimizationService.findOptimalPortfolio(
        holdings,
        prices,
        riskFreeRate
      );
      res.json({
        optimization,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Portfolio optimization error:", error);
      res.status(500).json({ error: "Failed to optimize portfolio" });
    }
  });

  /**
   * POST /api/portfolio/rebalance
   * Generate rebalancing recommendations
   */
  app.post("/api/portfolio/rebalance", auth, (req, res) => {
    try {
      const { currentHoldings, targetAllocation } = req.body;
      if (!currentHoldings || !targetAllocation) {
        return res
          .status(400)
          .json({ error: "Current holdings and target allocation are required" });
      }

      const rebalancing = riskManagementService.recommendRebalancing(
        currentHoldings,
        targetAllocation
      );
      res.json({
        rebalancing,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Rebalancing error:", error);
      res.status(500).json({ error: "Failed to generate rebalancing plan" });
    }
  });

  // ==================== ADVANCED RISK MANAGEMENT ENDPOINTS ====================

  /**
   * POST /api/risk/analysis
   * Comprehensive risk analysis
   */
  app.post("/api/risk/analysis", auth, (req, res) => {
    try {
      const { portfolio } = req.body;
      if (!portfolio) {
        return res.status(400).json({ error: "Portfolio is required" });
      }

      const valueAtRisk = riskManagementService.calculateVaR(portfolio);
      const hedgingRecommendations = riskManagementService.generateHedgingRecommendations(portfolio);

      res.json({
        valueAtRisk,
        hedgingRecommendations,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Risk analysis error:", error);
      res.status(500).json({ error: "Failed to analyze risk" });
    }
  });

  /**
   * POST /api/risk/scenario-analysis
   * Perform scenario analysis
   */
  app.post("/api/risk/scenario-analysis", auth, (req, res) => {
    try {
      const { portfolio, scenarios } = req.body;
      if (!portfolio || !scenarios) {
        return res.status(400).json({ error: "Portfolio and scenarios are required" });
      }

      const scenarioResults = riskManagementService.stressTestPortfolio(portfolio, scenarios);
      res.json({
        scenarios: scenarioResults,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Scenario analysis error:", error);
      res.status(500).json({ error: "Failed to perform scenario analysis" });
    }
  });

  // ==================== ADVANCED MONITORING ENDPOINTS ====================

  /**
   * GET /api/monitoring/health
   * System health check
   */
  app.get("/api/monitoring/health", (req, res) => {
    try {
      const health = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        database: { connected: db.open },
        circuitBreaker: cryptoDataCircuitBreaker.getStatus(),
        cache: advancedCacheManager.getStats(),
      };
      res.json(health);
    } catch (error) {
      res.status(503).json({ status: "unhealthy", error: error.message });
    }
  });

  /**
   * GET /api/monitoring/metrics
   * Get application metrics
   */
  app.get("/api/monitoring/metrics", auth, (req, res) => {
    try {
      const metrics = {
        timestamp: new Date().toISOString(),
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        cpu: process.cpuUsage(),
        requests: metricsCollector.getMetrics(),
        cache: advancedCacheManager.getStats(),
      };
      res.json(metrics);
    } catch (error) {
      console.error("Metrics error:", error);
      res.status(500).json({ error: "Failed to get metrics" });
    }
  });

  return {
    broadcastWs,
  };
};
