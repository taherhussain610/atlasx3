/**
 * Prediction Markets Service
 * Binary options and prediction markets for crypto events
 */

class PredictionMarketsService {
  constructor() {
    this.markets = new Map(); // marketId -> market data
    this.positions = new Map(); // userId -> positions array
    this.leaderboard = new Map(); // userId -> stats
    
    // Initialize some default markets
    this.initializeDefaultMarkets();
  }

  /**
   * Initialize default prediction markets
   */
  initializeDefaultMarkets() {
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;

    const markets = [
      {
        symbol: 'BTC',
        question: 'Will BTC price be above $66,000 in 1 hour?',
        duration: oneHour,
        threshold: 66000,
        direction: 'above'
      },
      {
        symbol: 'ETH',
        question: 'Will ETH price be above $3,500 in 4 hours?',
        duration: 4 * oneHour,
        threshold: 3500,
        direction: 'above'
      },
      {
        symbol: 'BNB',
        question: 'Will BNB price be above $610 in 24 hours?',
        duration: oneDay,
        threshold: 610,
        direction: 'above'
      }
    ];

    for (const market of markets) {
      this.createMarket(market);
    }
  }

  /**
   * Create prediction market
   */
  createMarket(config) {
    const {
      symbol,
      question,
      duration,
      threshold,
      direction,      // 'above' | 'below'
      category,       // 'price' | 'volume' | 'event'
      metadata
    } = config;

    const marketId = `market_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    const endTime = startTime + duration;

    const market = {
      marketId,
      symbol,
      question,
      category: category || 'price',
      threshold,
      direction: direction || 'above',
      startPrice: null,
      startTime,
      endTime,
      duration,
      status: 'active',
      
      // Pools
      yesPool: 0,
      noPool: 0,
      totalPool: 0,
      
      // Odds
      yesOdds: 50,
      noOdds: 50,
      
      // Participants
      participants: 0,
      positions: [],
      
      // Result
      result: null,
      finalPrice: null,
      settledAt: null,
      
      metadata: metadata || {},
      createdAt: Date.now()
    };

    this.markets.set(marketId, market);
    
    // Schedule auto-settlement
    setTimeout(() => this.settleMarket(marketId), duration);

    return market;
  }

  /**
   * Get active markets
   */
  getActiveMarkets(filters = {}) {
    const { symbol, category } = filters;
    const markets = [];

    for (const market of this.markets.values()) {
      if (market.status !== 'active') continue;
      if (symbol && market.symbol !== symbol) continue;
      if (category && market.category !== category) continue;

      markets.push(market);
    }

    // Sort by end time
    markets.sort((a, b) => a.endTime - b.endTime);

    return markets;
  }

  /**
   * Get market details
   */
  getMarket(marketId) {
    return this.markets.get(marketId);
  }

  /**
   * Place prediction
   */
  placePrediction(userId, marketId, prediction, amount) {
    const market = this.markets.get(marketId);
    if (!market) {
      throw new Error('Market not found');
    }

    if (market.status !== 'active') {
      throw new Error('Market is not active');
    }

    if (Date.now() >= market.endTime) {
      throw new Error('Market has closed');
    }

    if (prediction !== 'yes' && prediction !== 'no') {
      throw new Error('Invalid prediction. Must be "yes" or "no"');
    }

    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    // Update pools
    if (prediction === 'yes') {
      market.yesPool += amount;
    } else {
      market.noPool += amount;
    }
    market.totalPool += amount;

    // Recalculate odds
    this.calculateOdds(market);

    // Calculate potential payout
    const currentOdds = prediction === 'yes' ? market.yesOdds : market.noOdds;
    const potentialPayout = amount * (100 / currentOdds);

    // Create position
    const positionId = `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const position = {
      positionId,
      userId,
      marketId,
      prediction,
      amount,
      odds: currentOdds,
      potentialPayout,
      status: 'open',
      result: null,
      payout: 0,
      createdAt: Date.now()
    };

    // Store position
    if (!this.positions.has(userId)) {
      this.positions.set(userId, []);
    }
    this.positions.get(userId).push(position);

    market.positions.push(positionId);
    market.participants = new Set(market.positions.map(p => p.userId)).size;

    return { market, position };
  }

  /**
   * Calculate market odds
   */
  calculateOdds(market) {
    if (market.totalPool === 0) {
      market.yesOdds = 50;
      market.noOdds = 50;
      return;
    }

    // Odds based on pool ratio
    market.yesOdds = (market.yesPool / market.totalPool) * 100;
    market.noOdds = (market.noPool / market.totalPool) * 100;

    // Ensure odds are reasonable
    market.yesOdds = Math.max(5, Math.min(95, market.yesOdds));
    market.noOdds = Math.max(5, Math.min(95, market.noOdds));
  }

  /**
   * Settle market
   */
  async settleMarket(marketId, finalPrice = null) {
    const market = this.markets.get(marketId);
    if (!market) {
      throw new Error('Market not found');
    }

    if (market.status === 'settled') {
      return market;
    }

    // Get final price (in production, fetch from price oracle)
    if (finalPrice === null) {
      // For demo, use simulated price
      const prices = {
        'BTC': 65000 + Math.random() * 2000,
        'ETH': 3400 + Math.random() * 200,
        'BNB': 600 + Math.random() * 20,
        'SOL': 190 + Math.random() * 20
      };
      finalPrice = prices[market.symbol] || market.threshold;
    }

    market.finalPrice = finalPrice;

    // Determine result
    let result;
    if (market.direction === 'above') {
      result = finalPrice > market.threshold ? 'yes' : 'no';
    } else {
      result = finalPrice < market.threshold ? 'yes' : 'no';
    }

    market.result = result;
    market.status = 'settled';
    market.settledAt = Date.now();

    // Settle all positions
    const winningPool = result === 'yes' ? market.yesPool : market.noPool;
    const totalPrizePool = market.totalPool;

    for (const userId of this.positions.keys()) {
      const positions = this.positions.get(userId) || [];
      
      for (const position of positions) {
        if (position.marketId !== marketId) continue;
        if (position.status !== 'open') continue;

        const won = position.prediction === result;
        
        if (won) {
          // Calculate payout: (position amount / winning pool) * total pool
          position.payout = (position.amount / winningPool) * totalPrizePool;
          position.profit = position.payout - position.amount;
        } else {
          position.payout = 0;
          position.profit = -position.amount;
        }

        position.result = won ? 'win' : 'loss';
        position.status = 'settled';
        position.settledAt = Date.now();

        // Update leaderboard
        this.updateLeaderboard(userId, won, position.profit);
      }
    }

    return market;
  }

  /**
   * Update leaderboard
   */
  updateLeaderboard(userId, won, profit) {
    let stats = this.leaderboard.get(userId);
    
    if (!stats) {
      stats = {
        userId,
        totalPredictions: 0,
        correctPredictions: 0,
        totalProfit: 0,
        winRate: 0,
        rank: 0
      };
    }

    stats.totalPredictions += 1;
    if (won) {
      stats.correctPredictions += 1;
    }
    stats.totalProfit += profit;
    stats.winRate = (stats.correctPredictions / stats.totalPredictions) * 100;

    this.leaderboard.set(userId, stats);

    // Recalculate ranks
    this.updateRanks();
  }

  /**
   * Update ranks
   */
  updateRanks() {
    const sorted = Array.from(this.leaderboard.values())
      .sort((a, b) => b.totalProfit - a.totalProfit);

    sorted.forEach((stats, index) => {
      stats.rank = index + 1;
      this.leaderboard.set(stats.userId, stats);
    });
  }

  /**
   * Get user positions
   */
  getUserPositions(userId, status = null) {
    const positions = this.positions.get(userId) || [];
    
    if (status) {
      return positions.filter(p => p.status === status);
    }
    
    return positions;
  }

  /**
   * Get user statistics
   */
  getUserStats(userId) {
    const stats = this.leaderboard.get(userId);
    const positions = this.positions.get(userId) || [];

    const openPositions = positions.filter(p => p.status === 'open');
    const settledPositions = positions.filter(p => p.status === 'settled');
    const wonPositions = settledPositions.filter(p => p.result === 'win');

    return {
      leaderboard: stats || {
        userId,
        totalPredictions: 0,
        correctPredictions: 0,
        totalProfit: 0,
        winRate: 0,
        rank: 0
      },
      positions: {
        total: positions.length,
        open: openPositions.length,
        settled: settledPositions.length,
        won: wonPositions.length
      },
      recentPositions: positions.slice(-10).reverse()
    };
  }

  /**
   * Get leaderboard
   */
  getLeaderboard(limit = 100) {
    const sorted = Array.from(this.leaderboard.values())
      .sort((a, b) => b.totalProfit - a.totalProfit)
      .slice(0, limit);

    return sorted;
  }

  /**
   * Get market history
   */
  getMarketHistory(symbol = null, limit = 50) {
    let markets = Array.from(this.markets.values())
      .filter(m => m.status === 'settled');

    if (symbol) {
      markets = markets.filter(m => m.symbol === symbol);
    }

    markets.sort((a, b) => b.settledAt - a.settledAt);

    return markets.slice(0, limit);
  }

  /**
   * Cancel market (admin)
   */
  cancelMarket(marketId, reason) {
    const market = this.markets.get(marketId);
    if (!market) {
      throw new Error('Market not found');
    }

    if (market.status === 'settled') {
      throw new Error('Cannot cancel settled market');
    }

    // Refund all positions
    for (const userId of this.positions.keys()) {
      const positions = this.positions.get(userId) || [];
      
      for (const position of positions) {
        if (position.marketId !== marketId) continue;
        if (position.status !== 'open') continue;

        position.status = 'cancelled';
        position.payout = position.amount; // Refund
        position.profit = 0;
        position.cancelReason = reason;
      }
    }

    market.status = 'cancelled';
    market.cancelReason = reason;
    market.cancelledAt = Date.now();

    return market;
  }
}

module.exports = PredictionMarketsService;
