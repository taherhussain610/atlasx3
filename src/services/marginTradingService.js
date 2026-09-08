/**
 * Margin Trading Service
 * Provides leveraged trading with risk management
 */

class MarginTradingService {
  constructor() {
    this.positions = new Map(); // positionId -> position data
    this.marginAccounts = new Map(); // userId -> margin account
    
    // Leverage limits by risk tier
    this.leverageLimits = {
      low: 3,      // Conservative: 3x
      medium: 10,  // Moderate: 10x
      high: 20,    // Aggressive: 20x
      extreme: 50  // Expert: 50x
    };
    
    // Maintenance margin ratio
    this.maintenanceMargin = 0.05; // 5%
    
    // Interest rates (annual percentage)
    this.borrowRates = {
      'BTC': 0.08,   // 8%
      'ETH': 0.10,   // 10%
      'BNB': 0.12,   // 12%
      'SOL': 0.15,   // 15%
      'USDT': 0.05   // 5%
    };
  }

  /**
   * Initialize margin account for user
   */
  initializeMarginAccount(userId, initialBalance = 0, riskTier = 'medium') {
    const account = {
      userId,
      balance: initialBalance,
      borrowed: 0,
      equity: initialBalance,
      marginLevel: 100,
      riskTier,
      maxLeverage: this.leverageLimits[riskTier],
      positions: [],
      borrowHistory: [],
      createdAt: Date.now()
    };
    
    this.marginAccounts.set(userId, account);
    return account;
  }

  /**
   * Get margin account
   */
  getMarginAccount(userId) {
    return this.marginAccounts.get(userId);
  }

  /**
   * Open leveraged position
   */
  openPosition(userId, config) {
    const account = this.marginAccounts.get(userId);
    if (!account) {
      throw new Error('Margin account not initialized');
    }

    const {
      symbol,
      side,           // 'long' or 'short'
      collateral,     // Collateral amount
      leverage,       // Leverage multiplier
      entryPrice,
      stopLoss,
      takeProfit
    } = config;

    const normalizedSide = String(side || '').toLowerCase();
    const normalizedCollateral = Number(collateral);
    const normalizedLeverage = Number(leverage);
    const normalizedEntryPrice = Number(entryPrice);
    if (!symbol || !['long', 'short'].includes(normalizedSide)) {
      throw new Error('A symbol and valid position side are required');
    }
    if (!Number.isFinite(normalizedCollateral) || normalizedCollateral <= 0) {
      throw new Error('Collateral must be a positive number');
    }
    if (!Number.isFinite(normalizedLeverage) || normalizedLeverage < 1) {
      throw new Error('Leverage must be at least 1');
    }
    if (!Number.isFinite(normalizedEntryPrice) || normalizedEntryPrice <= 0) {
      throw new Error('Entry price must be a positive number');
    }

    // Validate leverage
    if (normalizedLeverage > account.maxLeverage) {
      throw new Error(`Max leverage for your risk tier is ${account.maxLeverage}x`);
    }

    // Calculate position size
    const positionSize = normalizedCollateral * normalizedLeverage;
    const borrowedAmount = positionSize - normalizedCollateral;

    // Check available balance
    if (normalizedCollateral > account.balance) {
      throw new Error('Insufficient collateral balance');
    }

    // Create position
    const positionId = `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const position = {
      positionId,
      userId,
      symbol,
      side: normalizedSide,
      collateral: normalizedCollateral,
      leverage: normalizedLeverage,
      positionSize,
      borrowedAmount,
      entryPrice: normalizedEntryPrice,
      currentPrice: normalizedEntryPrice,
      stopLoss,
      takeProfit,
      unrealizedPnL: 0,
      realizedPnL: 0,
      liquidationPrice: this.calculateLiquidationPrice(
        normalizedSide,
        normalizedEntryPrice,
        normalizedLeverage
      ),
      interestAccrued: 0,
      status: 'open',
      openedAt: Date.now(),
      closedAt: null
    };

    // Update account
    account.balance -= normalizedCollateral;
    account.borrowed += borrowedAmount;
    account.positions.push(positionId);
    
    // Store position
    this.positions.set(positionId, position);
    
    // Update margin level
    this.updateMarginLevel(userId);

    return position;
  }

  /**
   * Calculate liquidation price
   */
  calculateLiquidationPrice(side, entryPrice, leverage) {
    const maintenanceMargin = this.maintenanceMargin;
    
    if (side === 'long') {
      // Long liquidation: entry * (1 - 1/leverage + maintenanceMargin)
      return entryPrice * (1 - (1 / leverage) + maintenanceMargin);
    } else {
      // Short liquidation: entry * (1 + 1/leverage - maintenanceMargin)
      return entryPrice * (1 + (1 / leverage) - maintenanceMargin);
    }
  }

  /**
   * Update position with current price
   */
  updatePosition(positionId, currentPrice) {
    const position = this.positions.get(positionId);
    if (!position || position.status !== 'open') {
      return null;
    }

    position.currentPrice = currentPrice;

    // Calculate unrealized PnL
    const priceDiff = position.side === 'long' 
      ? currentPrice - position.entryPrice
      : position.entryPrice - currentPrice;
    
    position.unrealizedPnL = (priceDiff / position.entryPrice) * position.positionSize;

    // Calculate accrued interest
    const timeElapsed = (Date.now() - position.openedAt) / (1000 * 60 * 60 * 24 * 365); // years
    const baseAsset = position.symbol.split('/')[0];
    const rate = this.borrowRates[baseAsset] || 0.10;
    position.interestAccrued = position.borrowedAmount * rate * timeElapsed;

    // Check for liquidation
    if (this.shouldLiquidate(position)) {
      this.liquidatePosition(positionId);
    }

    // Check stop loss / take profit
    if (position.stopLoss && 
        ((position.side === 'long' && currentPrice <= position.stopLoss) ||
         (position.side === 'short' && currentPrice >= position.stopLoss))) {
      this.closePosition(positionId, currentPrice, 'stop_loss');
    }

    if (position.takeProfit &&
        ((position.side === 'long' && currentPrice >= position.takeProfit) ||
         (position.side === 'short' && currentPrice <= position.takeProfit))) {
      this.closePosition(positionId, currentPrice, 'take_profit');
    }

    return position;
  }

  /**
   * Check if position should be liquidated
   */
  shouldLiquidate(position) {
    if (position.side === 'long') {
      return position.currentPrice <= position.liquidationPrice;
    } else {
      return position.currentPrice >= position.liquidationPrice;
    }
  }

  /**
   * Liquidate position
   */
  liquidatePosition(positionId) {
    const position = this.positions.get(positionId);
    if (!position) return null;

    return this.closePosition(positionId, position.liquidationPrice, 'liquidation');
  }

  /**
   * Close position
   */
  closePosition(positionId, closePrice, reason = 'manual') {
    const position = this.positions.get(positionId);
    if (!position || position.status !== 'open') {
      throw new Error('Position not found or already closed');
    }
    const normalizedClosePrice = Number(closePrice);
    if (!Number.isFinite(normalizedClosePrice) || normalizedClosePrice <= 0) {
      throw new Error('Close price must be a positive number');
    }

    const account = this.marginAccounts.get(position.userId);
    
    // Calculate final PnL
    const priceDiff = position.side === 'long'
      ? normalizedClosePrice - position.entryPrice
      : position.entryPrice - normalizedClosePrice;
    
    const grossPnL = (priceDiff / position.entryPrice) * position.positionSize;
    const netPnL = grossPnL - position.interestAccrued;

    // Update position
    position.currentPrice = normalizedClosePrice;
    position.realizedPnL = netPnL;
    position.status = 'closed';
    position.closedAt = Date.now();
    position.closeReason = reason;

    // Return borrowed amount and settle PnL
    const returnAmount = position.collateral + netPnL;
    
    // Update account
    account.balance += Math.max(0, returnAmount); // Can't be negative
    account.borrowed -= position.borrowedAmount;
    account.positions = account.positions.filter(id => id !== positionId);

    // Update margin level
    this.updateMarginLevel(position.userId);

    return position;
  }

  /**
   * Update margin level for account
   */
  updateMarginLevel(userId) {
    const account = this.marginAccounts.get(userId);
    if (!account) return;

    // Calculate total equity (balance + unrealized PnL)
    let totalUnrealizedPnL = 0;
    for (const posId of account.positions) {
      const pos = this.positions.get(posId);
      if (pos && pos.status === 'open') {
        totalUnrealizedPnL += pos.unrealizedPnL;
      }
    }

    account.equity = account.balance + totalUnrealizedPnL;

    // Margin Level = Equity / Borrowed * 100
    if (account.borrowed > 0) {
      account.marginLevel = (account.equity / account.borrowed) * 100;
    } else {
      account.marginLevel = 100;
    }

    return account;
  }

  /**
   * Get all positions for user
   */
  getUserPositions(userId, status = null) {
    const positions = [];
    for (const [posId, pos] of this.positions.entries()) {
      if (pos.userId === userId) {
        if (status === null || pos.status === status) {
          positions.push(pos);
        }
      }
    }
    return positions;
  }

  /**
   * Get position details
   */
  getPosition(positionId) {
    return this.positions.get(positionId);
  }

  /**
   * Add collateral to position
   */
  addCollateral(positionId, amount) {
    const position = this.positions.get(positionId);
    if (!position || position.status !== 'open') {
      throw new Error('Position not found or already closed');
    }

    const account = this.marginAccounts.get(position.userId);
    if (amount > account.balance) {
      throw new Error('Insufficient balance');
    }

    position.collateral += amount;
    account.balance -= amount;
    
    // Recalculate liquidation price
    const effectiveLeverage = position.positionSize / position.collateral;
    position.liquidationPrice = this.calculateLiquidationPrice(
      position.side, 
      position.entryPrice, 
      effectiveLeverage
    );

    this.updateMarginLevel(position.userId);

    return position;
  }

  /**
   * Get margin trading statistics
   */
  getStatistics(userId) {
    const account = this.marginAccounts.get(userId);
    if (!account) return null;

    const allPositions = this.getUserPositions(userId);
    const openPositions = allPositions.filter(p => p.status === 'open');
    const closedPositions = allPositions.filter(p => p.status === 'closed');

    const totalPnL = closedPositions.reduce((sum, p) => sum + p.realizedPnL, 0);
    const winningTrades = closedPositions.filter(p => p.realizedPnL > 0).length;
    const losingTrades = closedPositions.filter(p => p.realizedPnL < 0).length;
    const liquidations = closedPositions.filter(p => p.closeReason === 'liquidation').length;

    return {
      account: {
        balance: account.balance,
        borrowed: account.borrowed,
        equity: account.equity,
        marginLevel: account.marginLevel,
        riskTier: account.riskTier,
        maxLeverage: account.maxLeverage
      },
      positions: {
        total: allPositions.length,
        open: openPositions.length,
        closed: closedPositions.length
      },
      performance: {
        totalPnL,
        winningTrades,
        losingTrades,
        liquidations,
        winRate: closedPositions.length > 0 
          ? (winningTrades / closedPositions.length) * 100 
          : 0
      },
      openPositions: openPositions.map(p => ({
        positionId: p.positionId,
        symbol: p.symbol,
        side: p.side,
        leverage: p.leverage,
        entryPrice: p.entryPrice,
        currentPrice: p.currentPrice,
        unrealizedPnL: p.unrealizedPnL,
        liquidationPrice: p.liquidationPrice
      }))
    };
  }
}

module.exports = MarginTradingService;
