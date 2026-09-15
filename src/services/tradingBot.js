const TechnicalIndicators = require('./technicalIndicators');

/**
 * AI Trading Bot Service
 * Automated trading bot with multiple strategies and risk management
 */

class TradingBot {
  constructor(config = {}) {
    this.botId = config.botId || `bot_${Date.now()}`;
    this.userId = config.userId;
    this.strategy = config.strategy || 'sma_crossover';
    this.symbol = config.symbol || 'BTC';
    this.tradingPair = config.tradingPair || 'BTC/USDT';
    this.interval = config.interval || '5m';
    this.capital = config.capital || 1000;
    this.riskPerTrade = config.riskPerTrade || 2; // Percentage
    this.maxPositions = config.maxPositions || 3;
    this.stopLoss = config.stopLoss || 2; // Percentage
    this.takeProfit = config.takeProfit || 5; // Percentage
    
    this.isRunning = false;
    this.positions = [];
    this.trades = [];
    this.priceData = [];
    this.performance = {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      totalProfit: 0,
      totalLoss: 0,
      winRate: 0,
      profitFactor: 0,
      maxDrawdown: 0,
      sharpeRatio: 0
    };
    
    this.intervalHandle = null;
  }

  /**
   * Start the trading bot
   */
  async start() {
    if (this.isRunning) {
      throw new Error('Bot is already running');
    }
    
    this.isRunning = true;
    console.log(`🤖 Trading Bot ${this.botId} started with ${this.strategy} strategy`);
    
    // Initial price data fetch
    await this.updatePriceData();
    
    // Start trading loop
    this.intervalHandle = setInterval(async () => {
      if (this.isRunning) {
        await this.tradingLoop();
      }
    }, this.getIntervalMs());
    
    return {
      success: true,
      botId: this.botId,
      message: 'Bot started successfully'
    };
  }

  /**
   * Stop the trading bot
   */
  stop() {
    if (!this.isRunning) {
      throw new Error('Bot is not running');
    }
    
    this.isRunning = false;
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    
    console.log(`🛑 Trading Bot ${this.botId} stopped`);
    
    return {
      success: true,
      message: 'Bot stopped successfully',
      performance: this.getPerformance()
    };
  }

  /**
   * Main trading loop
   */
  async tradingLoop() {
    try {
      // Update price data
      await this.updatePriceData();
      
      // Check existing positions
      this.checkPositions();
      
      // Generate trading signals
      const signal = this.generateSignal();
      
      // Execute trade if signal is valid
      if (signal && this.canOpenPosition()) {
        await this.executeTrade(signal);
      }
      
    } catch (error) {
      console.error(`Trading loop error: ${error.message}`);
    }
  }

  /**
   * Update price data from market
   */
  async updatePriceData() {
    try {
      // In a real implementation, this would fetch from an exchange API
      // For demo, we'll simulate price updates
      const currentPrice = await this.fetchCurrentPrice();
      
      this.priceData.push({
        timestamp: Date.now(),
        open: currentPrice * 0.998,
        high: currentPrice * 1.002,
        low: currentPrice * 0.997,
        close: currentPrice,
        volume: Math.random() * 1000000
      });
      
      // Keep last 200 candles
      if (this.priceData.length > 200) {
        this.priceData.shift();
      }
      
    } catch (error) {
      console.error(`Error updating price data: ${error.message}`);
    }
  }

  /**
   * Fetch current price
   */
  async fetchCurrentPrice() {
    // Simulate price for demo - in production, fetch from exchange API
    const basePrice = this.symbol === 'BTC' ? 45000 : 
                     this.symbol === 'ETH' ? 2500 : 
                     this.symbol === 'BNB' ? 350 : 1;
    
    const volatility = 0.001;
    const randomChange = (Math.random() - 0.5) * 2 * volatility;
    
    return basePrice * (1 + randomChange);
  }

  /**
   * Generate trading signal based on selected strategy
   */
  generateSignal() {
    if (this.priceData.length < 50) return null;
    
    const closes = this.priceData.map(d => d.close);
    const highs = this.priceData.map(d => d.high);
    const lows = this.priceData.map(d => d.low);
    const volumes = this.priceData.map(d => d.volume);
    
    switch (this.strategy) {
      case 'sma_crossover':
        return this.smaCrossoverStrategy(closes);
      case 'rsi_oversold':
        return this.rsiOversoldStrategy(closes);
      case 'macd_crossover':
        return this.macdCrossoverStrategy(closes);
      case 'bollinger_bounce':
        return this.bollingerBounceStrategy(closes);
      case 'mean_reversion':
        return this.meanReversionStrategy(closes);
      case 'trend_following':
        return this.trendFollowingStrategy(closes, highs, lows);
      case 'breakout':
        return this.breakoutStrategy(highs, lows, closes, volumes);
      default:
        return this.smaCrossoverStrategy(closes);
    }
  }

  /**
   * SMA Crossover Strategy
   */
  smaCrossoverStrategy(closes) {
    const sma20 = TechnicalIndicators.calculateSMA(closes, 20);
    const sma50 = TechnicalIndicators.calculateSMA(closes, 50);
    
    if (sma20.length < 2 || sma50.length < 2) return null;
    
    const currentSma20 = sma20[sma20.length - 1];
    const prevSma20 = sma20[sma20.length - 2];
    const currentSma50 = sma50[sma50.length - 1];
    const prevSma50 = sma50[sma50.length - 2];
    
    // Golden cross - buy signal
    if (prevSma20 <= prevSma50 && currentSma20 > currentSma50) {
      return {
        action: 'BUY',
        price: closes[closes.length - 1],
        reason: 'SMA Golden Cross',
        confidence: 0.75
      };
    }
    
    // Death cross - sell signal
    if (prevSma20 >= prevSma50 && currentSma20 < currentSma50) {
      return {
        action: 'SELL',
        price: closes[closes.length - 1],
        reason: 'SMA Death Cross',
        confidence: 0.75
      };
    }
    
    return null;
  }

  /**
   * RSI Oversold/Overbought Strategy
   */
  rsiOversoldStrategy(closes) {
    const rsi = TechnicalIndicators.calculateRSI(closes, 14);
    if (rsi.length === 0) return null;
    
    const currentRsi = rsi[rsi.length - 1];
    const currentPrice = closes[closes.length - 1];
    
    // Oversold - buy signal
    if (currentRsi < 30) {
      return {
        action: 'BUY',
        price: currentPrice,
        reason: `RSI Oversold (${currentRsi.toFixed(2)})`,
        confidence: 0.8
      };
    }
    
    // Overbought - sell signal
    if (currentRsi > 70) {
      return {
        action: 'SELL',
        price: currentPrice,
        reason: `RSI Overbought (${currentRsi.toFixed(2)})`,
        confidence: 0.8
      };
    }
    
    return null;
  }

  /**
   * MACD Crossover Strategy
   */
  macdCrossoverStrategy(closes) {
    const macd = TechnicalIndicators.calculateMACD(closes);
    if (macd.macd.length < 2) return null;
    
    const currentMacd = macd.macd[macd.macd.length - 1];
    const currentSignal = macd.signal[macd.signal.length - 1];
    const prevMacd = macd.macd[macd.macd.length - 2];
    const prevSignal = macd.signal[macd.signal.length - 2];
    
    // Bullish crossover - buy signal
    if (prevMacd <= prevSignal && currentMacd > currentSignal) {
      return {
        action: 'BUY',
        price: closes[closes.length - 1],
        reason: 'MACD Bullish Crossover',
        confidence: 0.8
      };
    }
    
    // Bearish crossover - sell signal
    if (prevMacd >= prevSignal && currentMacd < currentSignal) {
      return {
        action: 'SELL',
        price: closes[closes.length - 1],
        reason: 'MACD Bearish Crossover',
        confidence: 0.8
      };
    }
    
    return null;
  }

  /**
   * Bollinger Bands Bounce Strategy
   */
  bollingerBounceStrategy(closes) {
    const bb = TechnicalIndicators.calculateBollingerBands(closes, 20, 2);
    if (bb.lower.length === 0) return null;
    
    const currentPrice = closes[closes.length - 1];
    const lowerBand = bb.lower[bb.lower.length - 1];
    const upperBand = bb.upper[bb.upper.length - 1];
    
    // Price touches lower band - buy signal
    if (currentPrice <= lowerBand * 1.01) {
      return {
        action: 'BUY',
        price: currentPrice,
        reason: 'Bollinger Lower Band Bounce',
        confidence: 0.75
      };
    }
    
    // Price touches upper band - sell signal
    if (currentPrice >= upperBand * 0.99) {
      return {
        action: 'SELL',
        price: currentPrice,
        reason: 'Bollinger Upper Band Bounce',
        confidence: 0.75
      };
    }
    
    return null;
  }

  /**
   * Mean Reversion Strategy
   */
  meanReversionStrategy(closes) {
    const sma20 = TechnicalIndicators.calculateSMA(closes, 20);
    if (sma20.length === 0) return null;
    
    const currentPrice = closes[closes.length - 1];
    const mean = sma20[sma20.length - 1];
    const deviation = ((currentPrice - mean) / mean) * 100;
    
    // Price far below mean - buy signal
    if (deviation < -3) {
      return {
        action: 'BUY',
        price: currentPrice,
        reason: `Mean Reversion (${deviation.toFixed(2)}% below MA)`,
        confidence: 0.7
      };
    }
    
    // Price far above mean - sell signal
    if (deviation > 3) {
      return {
        action: 'SELL',
        price: currentPrice,
        reason: `Mean Reversion (${deviation.toFixed(2)}% above MA)`,
        confidence: 0.7
      };
    }
    
    return null;
  }

  /**
   * Trend Following Strategy
   */
  trendFollowingStrategy(closes, highs, lows) {
    const ema50 = TechnicalIndicators.calculateEMA(closes, 50);
    const atr = TechnicalIndicators.calculateATR(highs, lows, closes, 14);
    
    if (ema50.length < 2 || atr.length === 0) return null;
    
    const currentPrice = closes[closes.length - 1];
    const currentEma = ema50[ema50.length - 1];
    const prevEma = ema50[ema50.length - 2];
    
    // Strong uptrend - buy signal
    if (currentPrice > currentEma && currentEma > prevEma) {
      return {
        action: 'BUY',
        price: currentPrice,
        reason: 'Uptrend Confirmed',
        confidence: 0.75
      };
    }
    
    // Strong downtrend - sell signal
    if (currentPrice < currentEma && currentEma < prevEma) {
      return {
        action: 'SELL',
        price: currentPrice,
        reason: 'Downtrend Confirmed',
        confidence: 0.75
      };
    }
    
    return null;
  }

  /**
   * Breakout Strategy
   */
  breakoutStrategy(highs, lows, closes, volumes) {
    if (highs.length < 20) return null;
    
    const recent20Highs = highs.slice(-20, -1);
    const recent20Lows = lows.slice(-20, -1);
    const recentVolumes = volumes.slice(-20, -1);
    
    const resistanceLevel = Math.max(...recent20Highs);
    const supportLevel = Math.min(...recent20Lows);
    const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
    
    const currentPrice = closes[closes.length - 1];
    const currentVolume = volumes[volumes.length - 1];
    
    // Resistance breakout with volume - buy signal
    if (currentPrice > resistanceLevel && currentVolume > avgVolume * 1.5) {
      return {
        action: 'BUY',
        price: currentPrice,
        reason: 'Resistance Breakout with Volume',
        confidence: 0.85
      };
    }
    
    // Support breakdown with volume - sell signal
    if (currentPrice < supportLevel && currentVolume > avgVolume * 1.5) {
      return {
        action: 'SELL',
        price: currentPrice,
        reason: 'Support Breakdown with Volume',
        confidence: 0.85
      };
    }
    
    return null;
  }

  /**
   * Execute trade based on signal
   */
  async executeTrade(signal) {
    try {
      const position = {
        id: `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        symbol: this.symbol,
        action: signal.action,
        entryPrice: signal.price,
        size: this.calculatePositionSize(signal.price),
        timestamp: Date.now(),
        reason: signal.reason,
        status: 'OPEN',
        stopLoss: this.calculateStopLoss(signal.action, signal.price),
        takeProfit: this.calculateTakeProfit(signal.action, signal.price)
      };
      
      this.positions.push(position);
      
      console.log(`📈 ${signal.action} ${this.symbol} @ ${signal.price.toFixed(2)} - ${signal.reason}`);
      
      return position;
    } catch (error) {
      console.error(`Error executing trade: ${error.message}`);
      return null;
    }
  }

  /**
   * Calculate position size based on risk management
   */
  calculatePositionSize(price) {
    const riskAmount = this.capital * (this.riskPerTrade / 100);
    const positionSize = riskAmount / (price * (this.stopLoss / 100));
    return Math.floor(positionSize * 100) / 100;
  }

  /**
   * Calculate stop loss price
   */
  calculateStopLoss(action, entryPrice) {
    if (action === 'BUY') {
      return entryPrice * (1 - this.stopLoss / 100);
    } else {
      return entryPrice * (1 + this.stopLoss / 100);
    }
  }

  /**
   * Calculate take profit price
   */
  calculateTakeProfit(action, entryPrice) {
    if (action === 'BUY') {
      return entryPrice * (1 + this.takeProfit / 100);
    } else {
      return entryPrice * (1 - this.takeProfit / 100);
    }
  }

  /**
   * Check existing positions for stop loss or take profit
   */
  checkPositions() {
    if (this.priceData.length === 0) return;
    
    const currentPrice = this.priceData[this.priceData.length - 1].close;
    
    this.positions.forEach(position => {
      if (position.status !== 'OPEN') return;
      
      let shouldClose = false;
      let closeReason = '';
      
      if (position.action === 'BUY') {
        if (currentPrice <= position.stopLoss) {
          shouldClose = true;
          closeReason = 'Stop Loss Hit';
        } else if (currentPrice >= position.takeProfit) {
          shouldClose = true;
          closeReason = 'Take Profit Hit';
        }
      } else {
        if (currentPrice >= position.stopLoss) {
          shouldClose = true;
          closeReason = 'Stop Loss Hit';
        } else if (currentPrice <= position.takeProfit) {
          shouldClose = true;
          closeReason = 'Take Profit Hit';
        }
      }
      
      if (shouldClose) {
        this.closePosition(position, currentPrice, closeReason);
      }
    });
  }

  /**
   * Close a position
   */
  closePosition(position, exitPrice, reason) {
    position.status = 'CLOSED';
    position.exitPrice = exitPrice;
    position.exitTimestamp = Date.now();
    position.closeReason = reason;
    
    const profitLoss = position.action === 'BUY' 
      ? (exitPrice - position.entryPrice) * position.size
      : (position.entryPrice - exitPrice) * position.size;
    
    const profitLossPercent = ((profitLoss / (position.entryPrice * position.size)) * 100);
    
    position.profitLoss = profitLoss;
    position.profitLossPercent = profitLossPercent;
    
    this.trades.push(position);
    this.updatePerformance(position);
    
    console.log(`💰 Closed ${position.action} ${this.symbol} - P/L: ${profitLoss.toFixed(2)} (${profitLossPercent.toFixed(2)}%) - ${reason}`);
  }

  /**
   * Update performance metrics
   */
  updatePerformance(trade) {
    this.performance.totalTrades++;
    
    if (trade.profitLoss > 0) {
      this.performance.wins++;
      this.performance.totalProfit += trade.profitLoss;
    } else {
      this.performance.losses++;
      this.performance.totalLoss += Math.abs(trade.profitLoss);
    }
    
    this.performance.winRate = (this.performance.wins / this.performance.totalTrades) * 100;
    this.performance.profitFactor = this.performance.totalLoss === 0 
      ? this.performance.totalProfit 
      : this.performance.totalProfit / this.performance.totalLoss;
  }

  /**
   * Check if bot can open new position
   */
  canOpenPosition() {
    const openPositions = this.positions.filter(p => p.status === 'OPEN').length;
    return openPositions < this.maxPositions;
  }

  /**
   * Get interval in milliseconds
   */
  getIntervalMs() {
    const intervals = {
      '1m': 60000,
      '5m': 300000,
      '15m': 900000,
      '1h': 3600000,
      '4h': 14400000,
      '1d': 86400000
    };
    return intervals[this.interval] || 300000;
  }

  /**
   * Get bot status
   */
  getStatus() {
    return {
      botId: this.botId,
      userId: this.userId,
      isRunning: this.isRunning,
      strategy: this.strategy,
      symbol: this.symbol,
      tradingPair: this.tradingPair,
      interval: this.interval,
      capital: this.capital,
      openPositions: this.positions.filter(p => p.status === 'OPEN').length,
      totalPositions: this.positions.length,
      performance: this.getPerformance()
    };
  }

  /**
   * Get performance metrics
   */
  getPerformance() {
    return {
      ...this.performance,
      netProfit: this.performance.totalProfit - this.performance.totalLoss,
      averageWin: this.performance.wins > 0 ? this.performance.totalProfit / this.performance.wins : 0,
      averageLoss: this.performance.losses > 0 ? this.performance.totalLoss / this.performance.losses : 0
    };
  }

  /**
   * Get recent trades
   */
  getRecentTrades(limit = 10) {
    return this.trades.slice(-limit).reverse();
  }

  /**
   * Get open positions
   */
  getOpenPositions() {
    return this.positions.filter(p => p.status === 'OPEN');
  }
}

module.exports = TradingBot;
