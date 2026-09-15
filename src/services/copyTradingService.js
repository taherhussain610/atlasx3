/**
 * Copy Trading Service
 * Follow and automatically copy trades from successful traders
 */

class CopyTradingService {
  constructor() {
    this.traders = new Map(); // traderId -> trader profile
    this.followers = new Map(); // followerId -> following list
    this.copySettings = new Map(); // followerId_traderId -> settings
    this.tradeSignals = new Map(); // traderId -> recent trades
  }

  /**
   * Register as a trader (signal provider)
   */
  registerTrader(userId, profile) {
    const {
      displayName,
      bio,
      strategy,
      minFollowAmount,
      maxFollowers,
      performanceFee,   // Percentage fee (0-20%)
      riskLevel         // 1-5
    } = profile;

    const trader = {
      traderId: userId,
      displayName: displayName || `Trader${userId}`,
      bio: bio || '',
      strategy: strategy || 'Mixed Strategy',
      minFollowAmount: minFollowAmount || 100,
      maxFollowers: maxFollowers || 1000,
      performanceFee: Math.min(performanceFee || 10, 20), // Max 20%
      riskLevel: Math.max(1, Math.min(riskLevel || 3, 5)),
      followers: [],
      stats: {
        totalFollowers: 0,
        totalCopiedTrades: 0,
        totalVolume: 0,
        winRate: 0,
        avgReturn: 0,
        maxDrawdown: 0,
        sharpeRatio: 0
      },
      performance: {
        '7d': { return: 0, trades: 0 },
        '30d': { return: 0, trades: 0 },
        '90d': { return: 0, trades: 0 },
        'all': { return: 0, trades: 0 }
      },
      isActive: true,
      createdAt: Date.now()
    };

    this.traders.set(userId, trader);
    return trader;
  }

  /**
   * Get trader profile
   */
  getTrader(traderId) {
    return this.traders.get(traderId);
  }

  /**
   * Get all traders (leaderboard)
   */
  getAllTraders(filters = {}) {
    const { minWinRate, maxRiskLevel, minFollowers, sortBy } = filters;
    
    let traders = Array.from(this.traders.values()).filter(t => t.isActive);

    // Apply filters
    if (minWinRate) {
      traders = traders.filter(t => t.stats.winRate >= minWinRate);
    }
    if (maxRiskLevel) {
      traders = traders.filter(t => t.riskLevel <= maxRiskLevel);
    }
    if (minFollowers) {
      traders = traders.filter(t => t.stats.totalFollowers >= minFollowers);
    }

    // Sort
    switch (sortBy) {
      case 'return_7d':
        traders.sort((a, b) => b.performance['7d'].return - a.performance['7d'].return);
        break;
      case 'return_30d':
        traders.sort((a, b) => b.performance['30d'].return - a.performance['30d'].return);
        break;
      case 'followers':
        traders.sort((a, b) => b.stats.totalFollowers - a.stats.totalFollowers);
        break;
      case 'winRate':
        traders.sort((a, b) => b.stats.winRate - a.stats.winRate);
        break;
      default:
        traders.sort((a, b) => b.performance['30d'].return - a.performance['30d'].return);
    }

    return traders;
  }

  /**
   * Follow a trader
   */
  followTrader(followerId, traderId, settings) {
    const trader = this.traders.get(traderId);
    if (!trader) {
      throw new Error('Trader not found');
    }

    if (followerId === traderId) {
      throw new Error('Cannot follow yourself');
    }

    if (!trader.isActive) {
      throw new Error('Trader is not accepting followers');
    }

    if (trader.followers.length >= trader.maxFollowers) {
      throw new Error('Trader has reached maximum followers');
    }

    const {
      copyAmount,          // Amount to allocate for copying
      copyRatio,           // Ratio of trader's position size (0.1 - 1.0)
      maxPositionSize,     // Max size per copied trade
      stopLoss,            // Stop loss percentage
      takeProfit,          // Take profit percentage
      copyMode,            // 'percentage' | 'fixed' | 'proportional'
      onlyProfitable       // Only copy if trader is in profit
    } = settings;

    if (copyAmount < trader.minFollowAmount) {
      throw new Error(`Minimum follow amount is ${trader.minFollowAmount}`);
    }

    const settingsKey = `${followerId}_${traderId}`;
    const copyConfig = {
      followerId,
      traderId,
      copyAmount,
      copyRatio: copyRatio || 0.5,
      maxPositionSize: maxPositionSize || copyAmount * 0.2,
      stopLoss: stopLoss || 5,
      takeProfit: takeProfit || 10,
      copyMode: copyMode || 'proportional',
      onlyProfitable: onlyProfitable || false,
      isActive: true,
      stats: {
        copiedTrades: 0,
        totalProfit: 0,
        winRate: 0
      },
      startedAt: Date.now()
    };

    this.copySettings.set(settingsKey, copyConfig);

    // Update trader followers
    trader.followers.push(followerId);
    trader.stats.totalFollowers = trader.followers.length;

    // Update follower's following list
    if (!this.followers.has(followerId)) {
      this.followers.set(followerId, []);
    }
    this.followers.get(followerId).push(traderId);

    return copyConfig;
  }

  /**
   * Unfollow a trader
   */
  unfollowTrader(followerId, traderId) {
    const settingsKey = `${followerId}_${traderId}`;
    const settings = this.copySettings.get(settingsKey);
    
    if (!settings) {
      throw new Error('Not following this trader');
    }

    settings.isActive = false;
    settings.endedAt = Date.now();

    // Update trader followers
    const trader = this.traders.get(traderId);
    if (trader) {
      trader.followers = trader.followers.filter(f => f !== followerId);
      trader.stats.totalFollowers = trader.followers.length;
    }

    // Update follower's following list
    const following = this.followers.get(followerId) || [];
    this.followers.set(followerId, following.filter(t => t !== traderId));

    return settings;
  }

  /**
   * Update copy settings
   */
  updateCopySettings(followerId, traderId, updates) {
    const settingsKey = `${followerId}_${traderId}`;
    const settings = this.copySettings.get(settingsKey);
    
    if (!settings) {
      throw new Error('Not following this trader');
    }

    Object.assign(settings, updates);
    return settings;
  }

  /**
   * Get copy settings
   */
  getCopySettings(followerId, traderId) {
    const settingsKey = `${followerId}_${traderId}`;
    return this.copySettings.get(settingsKey);
  }

  /**
   * Broadcast trade from trader to followers
   */
  broadcastTrade(traderId, trade) {
    const trader = this.traders.get(traderId);
    if (!trader) return;

    const {
      symbol,
      action,        // 'buy' | 'sell' | 'close'
      price,
      amount
    } = trade;

    // Store trade signal
    if (!this.tradeSignals.has(traderId)) {
      this.tradeSignals.set(traderId, []);
    }
    const signals = this.tradeSignals.get(traderId);
    signals.push({
      ...trade,
      timestamp: Date.now()
    });

    // Keep only last 100 signals
    if (signals.length > 100) {
      signals.shift();
    }

    // Copy to all active followers
    const copiedTrades = [];
    
    for (const followerId of trader.followers) {
      const settingsKey = `${followerId}_${traderId}`;
      const settings = this.copySettings.get(settingsKey);

      if (!settings || !settings.isActive) continue;

      // Check if only copying profitable traders
      if (settings.onlyProfitable && trader.stats.avgReturn < 0) {
        continue;
      }

      // Calculate copy amount based on mode
      let copyAmount;
      switch (settings.copyMode) {
        case 'fixed':
          copyAmount = settings.maxPositionSize;
          break;
        case 'percentage':
          copyAmount = settings.copyAmount * settings.copyRatio;
          break;
        case 'proportional':
        default:
          copyAmount = amount * settings.copyRatio;
          break;
      }

      // Cap at max position size
      copyAmount = Math.min(copyAmount, settings.maxPositionSize);

      // Create copied trade
      const copiedTrade = {
        copiedTradeId: `copy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        followerId,
        traderId,
        originalTrade: trade,
        symbol,
        action,
        price,
        amount: copyAmount,
        stopLoss: settings.stopLoss,
        takeProfit: settings.takeProfit,
        status: 'pending',
        timestamp: Date.now()
      };

      copiedTrades.push(copiedTrade);

      // Update stats
      settings.stats.copiedTrades += 1;
      trader.stats.totalCopiedTrades += 1;
    }

    return copiedTrades;
  }

  /**
   * Update trader performance
   */
  updateTraderPerformance(traderId, tradeResult) {
    const trader = this.traders.get(traderId);
    if (!trader) return;

    const { profit, winRate, return7d, return30d, return90d } = tradeResult;

    // Update stats
    trader.stats.avgReturn = (trader.stats.avgReturn + profit) / 2;
    trader.stats.winRate = winRate;

    // Update performance by period
    trader.performance['7d'].return = return7d || trader.performance['7d'].return;
    trader.performance['30d'].return = return30d || trader.performance['30d'].return;
    trader.performance['90d'].return = return90d || trader.performance['90d'].return;
    trader.performance['all'].trades += 1;

    return trader;
  }

  /**
   * Get follower statistics
   */
  getFollowerStats(followerId) {
    const following = this.followers.get(followerId) || [];
    const stats = {
      totalFollowing: following.length,
      traders: [],
      totalCopiedTrades: 0,
      totalProfit: 0,
      avgWinRate: 0
    };

    for (const traderId of following) {
      const settingsKey = `${followerId}_${traderId}`;
      const settings = this.copySettings.get(settingsKey);
      
      if (settings) {
        stats.totalCopiedTrades += settings.stats.copiedTrades;
        stats.totalProfit += settings.stats.totalProfit;
        
        const trader = this.traders.get(traderId);
        stats.traders.push({
          traderId,
          displayName: trader?.displayName,
          copiedTrades: settings.stats.copiedTrades,
          profit: settings.stats.totalProfit,
          isActive: settings.isActive
        });
      }
    }

    stats.avgWinRate = stats.traders.length > 0
      ? stats.traders.reduce((sum, t) => {
          const trader = this.traders.get(t.traderId);
          return sum + (trader?.stats.winRate || 0);
        }, 0) / stats.traders.length
      : 0;

    return stats;
  }

  /**
   * Get trader's recent signals
   */
  getTraderSignals(traderId, limit = 20) {
    const signals = this.tradeSignals.get(traderId) || [];
    return signals.slice(-limit).reverse();
  }

  /**
   * Calculate trader ranking
   */
  calculateRanking(traderId) {
    const trader = this.traders.get(traderId);
    if (!trader) return 0;

    // Ranking based on multiple factors
    const returnScore = trader.performance['30d'].return * 0.4;
    const winRateScore = trader.stats.winRate * 0.3;
    const followersScore = Math.min(trader.stats.totalFollowers / 10, 100) * 0.2;
    const volumeScore = Math.min(trader.stats.totalVolume / 1000000, 100) * 0.1;

    const totalScore = returnScore + winRateScore + followersScore + volumeScore;
    return Math.round(totalScore * 10) / 10;
  }

  /**
   * Get top traders
   */
  getTopTraders(limit = 10) {
    const traders = Array.from(this.traders.values())
      .filter(t => t.isActive)
      .map(t => ({
        ...t,
        ranking: this.calculateRanking(t.traderId)
      }))
      .sort((a, b) => b.ranking - a.ranking)
      .slice(0, limit);

    return traders;
  }
}

module.exports = CopyTradingService;
