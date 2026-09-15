/**
 * Demo Trading Service
 * Paper trading with virtual funds for risk-free practice
 */

class DemoTradingService {
  constructor() {
    this.demoAccounts = new Map(); // userId -> demo account
    this.demoTrades = new Map(); // userId -> trades array
    
    // Default starting balance
    this.DEFAULT_BALANCE = {
      'USDT': 100000,  // $100k
      'BTC': 1,
      'ETH': 10,
      'BNB': 100,
      'SOL': 500
    };
  }

  /**
   * Create or reset demo account
   */
  createDemoAccount(userId, customBalance = null) {
    const balance = customBalance || { ...this.DEFAULT_BALANCE };
    
    const account = {
      userId,
      balance,
      initialBalance: { ...balance },
      isDemo: true,
      trades: [],
      performance: {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        totalPnL: 0,
        winRate: 0,
        largestWin: 0,
        largestLoss: 0
      },
      createdAt: Date.now(),
      resetAt: Date.now()
    };

    this.demoAccounts.set(userId, account);
    this.demoTrades.set(userId, []);

    return account;
  }

  /**
   * Get demo account
   */
  getDemoAccount(userId) {
    let account = this.demoAccounts.get(userId);
    if (!account) {
      account = this.createDemoAccount(userId);
    }
    return account;
  }

  /**
   * Reset demo account
   */
  resetDemoAccount(userId) {
    return this.createDemoAccount(userId);
  }

  /**
   * Execute demo trade
   */
  executeDemoTrade(userId, tradeData) {
    const account = this.getDemoAccount(userId);
    const {
      type,           // 'spot' | 'margin' | 'futures'
      action,         // 'buy' | 'sell'
      fromCurrency,
      toCurrency,
      amount,
      price,
      leverage,       // For margin/futures
      stopLoss,
      takeProfit
    } = tradeData;

    // Check balance
    if (action === 'buy') {
      const requiredBalance = type === 'spot' 
        ? amount * price 
        : (amount * price) / (leverage || 1);
      
      const fromBalance = account.balance[fromCurrency] || 0;
      if (fromBalance < requiredBalance) {
        throw new Error(`Insufficient demo balance. Need ${requiredBalance} ${fromCurrency}, have ${fromBalance}`);
      }

      // Deduct from balance
      account.balance[fromCurrency] -= requiredBalance;
      
      // Add to balance
      if (type === 'spot') {
        account.balance[toCurrency] = (account.balance[toCurrency] || 0) + amount;
      }
    } else {
      // Sell
      const fromBalance = account.balance[fromCurrency] || 0;
      if (fromBalance < amount) {
        throw new Error(`Insufficient demo balance. Need ${amount} ${fromCurrency}, have ${fromBalance}`);
      }

      account.balance[fromCurrency] -= amount;
      account.balance[toCurrency] = (account.balance[toCurrency] || 0) + (amount * price);
    }

    // Record trade
    const tradeId = `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const trade = {
      tradeId,
      userId,
      type,
      action,
      fromCurrency,
      toCurrency,
      amount,
      price,
      leverage: leverage || 1,
      stopLoss,
      takeProfit,
      status: type === 'spot' ? 'completed' : 'open',
      pnl: 0,
      timestamp: Date.now()
    };

    const trades = this.demoTrades.get(userId) || [];
    trades.push(trade);
    this.demoTrades.set(userId, trades);

    account.trades.push(tradeId);
    account.performance.totalTrades += 1;

    return { account, trade };
  }

  /**
   * Close demo position (for margin/futures)
   */
  closeDemoPosition(userId, tradeId, closePrice) {
    const trades = this.demoTrades.get(userId) || [];
    const trade = trades.find(t => t.tradeId === tradeId);
    
    if (!trade) {
      throw new Error('Trade not found');
    }

    if (trade.status === 'completed') {
      throw new Error('Trade already closed');
    }

    const account = this.getDemoAccount(userId);

    // Calculate PnL
    const priceDiff = trade.action === 'buy'
      ? closePrice - trade.price
      : trade.price - closePrice;
    
    const pnl = (priceDiff / trade.price) * trade.amount * trade.leverage;
    const pnlPercent = (priceDiff / trade.price) * 100 * trade.leverage;

    trade.closePrice = closePrice;
    trade.pnl = pnl;
    trade.pnlPercent = pnlPercent;
    trade.status = 'completed';
    trade.closedAt = Date.now();

    // Update balance
    const collateral = (trade.amount * trade.price) / trade.leverage;
    const returnAmount = collateral + pnl;
    account.balance[trade.toCurrency] = (account.balance[trade.toCurrency] || 0) + returnAmount;

    // Update performance
    account.performance.totalPnL += pnl;
    if (pnl > 0) {
      account.performance.winningTrades += 1;
      account.performance.largestWin = Math.max(account.performance.largestWin, pnl);
    } else {
      account.performance.losingTrades += 1;
      account.performance.largestLoss = Math.min(account.performance.largestLoss, pnl);
    }
    account.performance.winRate = 
      (account.performance.winningTrades / account.performance.totalTrades) * 100;

    return { account, trade };
  }

  /**
   * Get demo trades
   */
  getDemoTrades(userId, limit = 50) {
    const trades = this.demoTrades.get(userId) || [];
    return trades.slice(-limit).reverse();
  }

  /**
   * Get demo account performance
   */
  getDemoPerformance(userId) {
    const account = this.getDemoAccount(userId);
    const trades = this.demoTrades.get(userId) || [];

    // Calculate total portfolio value
    let totalValue = 0;
    for (const [currency, amount] of Object.entries(account.balance)) {
      // In real app, would fetch current prices
      // For demo, using approximate values
      const prices = {
        'USDT': 1,
        'BTC': 65000,
        'ETH': 3500,
        'BNB': 600,
        'SOL': 200
      };
      totalValue += amount * (prices[currency] || 0);
    }

    // Calculate initial value
    let initialValue = 0;
    for (const [currency, amount] of Object.entries(account.initialBalance)) {
      const prices = { 'USDT': 1, 'BTC': 65000, 'ETH': 3500, 'BNB': 600, 'SOL': 200 };
      initialValue += amount * (prices[currency] || 0);
    }

    const totalReturn = totalValue - initialValue;
    const totalReturnPercent = (totalReturn / initialValue) * 100;

    return {
      account: {
        balance: account.balance,
        initialBalance: account.initialBalance,
        totalValue,
        initialValue,
        totalReturn,
        totalReturnPercent
      },
      performance: {
        ...account.performance,
        totalTrades: trades.length,
        openPositions: trades.filter(t => t.status === 'open').length,
        closedPositions: trades.filter(t => t.status === 'completed').length
      },
      recentTrades: trades.slice(-10).reverse()
    };
  }

  /**
   * Compare demo vs live trading
   */
  compareDemoVsLive(userId, liveTradingStats) {
    const demoPerformance = this.getDemoPerformance(userId);
    
    return {
      demo: {
        totalTrades: demoPerformance.performance.totalTrades,
        winRate: demoPerformance.performance.winRate,
        totalReturn: demoPerformance.account.totalReturn,
        returnPercent: demoPerformance.account.totalReturnPercent
      },
      live: liveTradingStats,
      comparison: {
        tradesDifference: liveTradingStats.totalTrades - demoPerformance.performance.totalTrades,
        winRateDifference: liveTradingStats.winRate - demoPerformance.performance.winRate,
        returnDifference: liveTradingStats.totalReturn - demoPerformance.account.totalReturn
      }
    };
  }

  /**
   * Get leaderboard (top demo traders)
   */
  getLeaderboard(limit = 10) {
    const scores = [];
    
    for (const userId of this.demoAccounts.keys()) {
      const performance = this.getDemoPerformance(userId);
      scores.push({
        userId,
        totalReturn: performance.account.totalReturn,
        returnPercent: performance.account.totalReturnPercent,
        winRate: performance.performance.winRate,
        totalTrades: performance.performance.totalTrades
      });
    }

    // Sort by return percentage
    scores.sort((a, b) => b.returnPercent - a.returnPercent);

    return scores.slice(0, limit);
  }

  /**
   * Enable/disable demo mode
   */
  toggleDemoMode(userId, enabled) {
    const account = this.getDemoAccount(userId);
    account.isDemo = enabled;
    return account;
  }

  /**
   * Check if user is in demo mode
   */
  isDemoMode(userId) {
    const account = this.demoAccounts.get(userId);
    return account ? account.isDemo : false;
  }
}

module.exports = DemoTradingService;
