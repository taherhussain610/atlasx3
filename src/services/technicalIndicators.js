/**
 * Technical Indicators Service
 * Provides common technical analysis indicators for trading strategies
 */

class TechnicalIndicators {
  /**
   * Calculate Simple Moving Average (SMA)
   * @param {Array<number>} data - Price data
   * @param {number} period - Period for SMA
   * @returns {Array<number>} SMA values
   */
  static calculateSMA(data, period) {
    if (data.length < period) return [];
    
    const sma = [];
    for (let i = period - 1; i < data.length; i++) {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
    return sma;
  }

  /**
   * Calculate Exponential Moving Average (EMA)
   * @param {Array<number>} data - Price data
   * @param {number} period - Period for EMA
   * @returns {Array<number>} EMA values
   */
  static calculateEMA(data, period) {
    if (data.length < period) return [];
    
    const k = 2 / (period + 1);
    const ema = [];
    
    // Start with SMA for first value
    const firstSMA = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    ema.push(firstSMA);
    
    // Calculate EMA for remaining values
    for (let i = period; i < data.length; i++) {
      const value = data[i] * k + ema[ema.length - 1] * (1 - k);
      ema.push(value);
    }
    
    return ema;
  }

  /**
   * Calculate Relative Strength Index (RSI)
   * @param {Array<number>} data - Price data
   * @param {number} period - Period for RSI (typically 14)
   * @returns {Array<number>} RSI values
   */
  static calculateRSI(data, period = 14) {
    if (data.length < period + 1) return [];
    
    const rsi = [];
    const changes = [];
    
    // Calculate price changes
    for (let i = 1; i < data.length; i++) {
      changes.push(data[i] - data[i - 1]);
    }
    
    // Calculate initial average gains and losses
    let avgGain = 0;
    let avgLoss = 0;
    
    for (let i = 0; i < period; i++) {
      if (changes[i] > 0) avgGain += changes[i];
      else avgLoss += Math.abs(changes[i]);
    }
    
    avgGain /= period;
    avgLoss /= period;
    
    // Calculate RSI
    for (let i = period; i < changes.length; i++) {
      const currentChange = changes[i];
      
      if (currentChange > 0) {
        avgGain = (avgGain * (period - 1) + currentChange) / period;
        avgLoss = (avgLoss * (period - 1)) / period;
      } else {
        avgGain = (avgGain * (period - 1)) / period;
        avgLoss = (avgLoss * (period - 1) + Math.abs(currentChange)) / period;
      }
      
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }
    
    return rsi;
  }

  /**
   * Calculate Moving Average Convergence Divergence (MACD)
   * @param {Array<number>} data - Price data
   * @param {number} fastPeriod - Fast EMA period (typically 12)
   * @param {number} slowPeriod - Slow EMA period (typically 26)
   * @param {number} signalPeriod - Signal line period (typically 9)
   * @returns {Object} MACD values
   */
  static calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const fastEMA = this.calculateEMA(data, fastPeriod);
    const slowEMA = this.calculateEMA(data, slowPeriod);
    
    const macdLine = [];
    const minLength = Math.min(fastEMA.length, slowEMA.length);
    
    for (let i = 0; i < minLength; i++) {
      macdLine.push(fastEMA[fastEMA.length - minLength + i] - slowEMA[slowEMA.length - minLength + i]);
    }
    
    const signalLine = this.calculateEMA(macdLine, signalPeriod);
    const histogram = [];
    
    for (let i = 0; i < signalLine.length; i++) {
      histogram.push(macdLine[macdLine.length - signalLine.length + i] - signalLine[i]);
    }
    
    return {
      macd: macdLine,
      signal: signalLine,
      histogram: histogram
    };
  }

  /**
   * Calculate Bollinger Bands
   * @param {Array<number>} data - Price data
   * @param {number} period - Period for MA (typically 20)
   * @param {number} stdDev - Standard deviation multiplier (typically 2)
   * @returns {Object} Bollinger Bands values
   */
  static calculateBollingerBands(data, period = 20, stdDev = 2) {
    const sma = this.calculateSMA(data, period);
    const upper = [];
    const lower = [];
    
    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / period;
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
      const sd = Math.sqrt(variance);
      
      upper.push(sma[i - period + 1] + (stdDev * sd));
      lower.push(sma[i - period + 1] - (stdDev * sd));
    }
    
    return {
      upper: upper,
      middle: sma,
      lower: lower
    };
  }

  /**
   * Calculate Stochastic Oscillator
   * @param {Array<number>} highs - High prices
   * @param {Array<number>} lows - Low prices
   * @param {Array<number>} closes - Close prices
   * @param {number} period - Period (typically 14)
   * @returns {Array<number>} %K values
   */
  static calculateStochastic(highs, lows, closes, period = 14) {
    const stochastic = [];
    
    for (let i = period - 1; i < closes.length; i++) {
      const highSlice = highs.slice(i - period + 1, i + 1);
      const lowSlice = lows.slice(i - period + 1, i + 1);
      
      const highest = Math.max(...highSlice);
      const lowest = Math.min(...lowSlice);
      
      const range = highest - lowest;
      const k = range === 0 ? 0 : ((closes[i] - lowest) / range) * 100;
      stochastic.push(k);
    }
    
    return stochastic;
  }

  /**
   * Calculate Average True Range (ATR)
   * @param {Array<number>} highs - High prices
   * @param {Array<number>} lows - Low prices
   * @param {Array<number>} closes - Close prices
   * @param {number} period - Period (typically 14)
   * @returns {Array<number>} ATR values
   */
  static calculateATR(highs, lows, closes, period = 14) {
    const tr = [];
    
    for (let i = 1; i < closes.length; i++) {
      const high = highs[i];
      const low = lows[i];
      const prevClose = closes[i - 1];
      
      const trueRange = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      
      tr.push(trueRange);
    }
    
    return this.calculateSMA(tr, period);
  }

  /**
   * Detect support and resistance levels
   * @param {Array<number>} data - Price data
   * @param {number} window - Window size for detecting levels
   * @returns {Object} Support and resistance levels
   */
  static detectSupportResistance(data, window = 20) {
    const support = [];
    const resistance = [];
    
    for (let i = window; i < data.length - window; i++) {
      const slice = data.slice(i - window, i + window + 1);
      const current = data[i];
      
      const isSupport = slice.every(price => price >= current) || 
                       slice.filter(price => price < current).length < 3;
      const isResistance = slice.every(price => price <= current) || 
                          slice.filter(price => price > current).length < 3;
      
      if (isSupport) support.push({ index: i, level: current });
      if (isResistance) resistance.push({ index: i, level: current });
    }
    
    return { support, resistance };
  }

  /**
   * Calculate Volume Weighted Average Price (VWAP)
   * @param {Array<number>} prices - Price data
   * @param {Array<number>} volumes - Volume data
   * @returns {Array<number>} VWAP values
   */
  static calculateVWAP(prices, volumes) {
    const vwap = [];
    let cumulativePV = 0;
    let cumulativeVolume = 0;
    
    for (let i = 0; i < prices.length; i++) {
      cumulativePV += prices[i] * volumes[i];
      cumulativeVolume += volumes[i];
      vwap.push(cumulativePV / cumulativeVolume);
    }
    
    return vwap;
  }
}

module.exports = TechnicalIndicators;
