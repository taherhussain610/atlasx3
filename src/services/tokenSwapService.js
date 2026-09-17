/**
 * Token Swap Service
 * Quick conversion between cryptocurrencies
 */

class TokenSwapService {
  constructor() {
    this.swapHistory = new Map(); // userId -> swaps
    this.liquidityPools = new Map(); // pair -> pool
    
    // Initialize some default pools
    this.initializeDefaultPools();
  }

  /**
   * Initialize default liquidity pools
   */
  initializeDefaultPools() {
    const pools = [
      { tokenA: 'BTC', tokenB: 'USDT', reserveA: 100, reserveB: 6500000, fee: 0.003 },
      { tokenA: 'ETH', tokenB: 'USDT', reserveA: 1000, reserveB: 3500000, fee: 0.003 },
      { tokenA: 'BNB', tokenB: 'USDT', reserveA: 5000, reserveB: 3000000, fee: 0.003 },
      { tokenA: 'SOL', tokenB: 'USDT', reserveA: 10000, reserveB: 2000000, fee: 0.003 },
      { tokenA: 'BTC', tokenB: 'ETH', reserveA: 100, reserveB: 1857, fee: 0.003 },
      { tokenA: 'ETH', tokenB: 'BNB', reserveA: 1000, reserveB: 5833, fee: 0.003 }
    ];

    for (const pool of pools) {
      const pairId = this.getPairId(pool.tokenA, pool.tokenB);
      this.liquidityPools.set(pairId, {
        ...pool,
        trades: 0,
        volume24h: 0
      });
    }
  }

  /**
   * Get pair ID
   */
  getPairId(tokenA, tokenB) {
    return [tokenA, tokenB].sort().join('/');
  }

  /**
   * Get swap quote
   */
  getQuote(fromToken, toToken, amountIn) {
    const pairId = this.getPairId(fromToken, toToken);
    const pool = this.liquidityPools.get(pairId);

    if (!pool) {
      throw new Error(`No liquidity pool found for ${fromToken}/${toToken}`);
    }

    // Determine direction
    const isAtoB = pool.tokenA === fromToken;
    const reserveIn = isAtoB ? pool.reserveA : pool.reserveB;
    const reserveOut = isAtoB ? pool.reserveB : pool.reserveA;

    // AMM formula: (x * y = k)
    // amountOut = (reserveOut * amountIn * (1-fee)) / (reserveIn + amountIn * (1-fee))
    const amountInWithFee = amountIn * (1 - pool.fee);
    const amountOut = (reserveOut * amountInWithFee) / (reserveIn + amountInWithFee);

    // Calculate price impact
    const priceImpact = (amountIn / reserveIn) * 100;

    // Calculate rate
    const rate = amountOut / amountIn;

    return {
      fromToken,
      toToken,
      amountIn,
      amountOut,
      rate,
      fee: amountIn * pool.fee,
      feePercent: pool.fee * 100,
      priceImpact,
      minimumReceived: amountOut * 0.95, // 5% slippage tolerance
      route: [fromToken, toToken]
    };
  }

  /**
   * Find best route for swap
   */
  findBestRoute(fromToken, toToken, amountIn) {
    // Direct route
    const directPairId = this.getPairId(fromToken, toToken);
    if (this.liquidityPools.has(directPairId)) {
      const directQuote = this.getQuote(fromToken, toToken, amountIn);
      return {
        route: [fromToken, toToken],
        quote: directQuote,
        hops: 1
      };
    }

    // Try routing through USDT
    const intermediatePairs = [
      { via: 'USDT', pairs: [this.getPairId(fromToken, 'USDT'), this.getPairId('USDT', toToken)] },
      { via: 'BTC', pairs: [this.getPairId(fromToken, 'BTC'), this.getPairId('BTC', toToken)] },
      { via: 'ETH', pairs: [this.getPairId(fromToken, 'ETH'), this.getPairId('ETH', toToken)] }
    ];

    let bestRoute = null;
    let bestAmountOut = 0;

    for (const { via, pairs } of intermediatePairs) {
      if (pairs.every(p => this.liquidityPools.has(p))) {
        try {
          // First hop
          const quote1 = this.getQuote(fromToken, via, amountIn);
          // Second hop
          const quote2 = this.getQuote(via, toToken, quote1.amountOut);

          if (quote2.amountOut > bestAmountOut) {
            bestAmountOut = quote2.amountOut;
            bestRoute = {
              route: [fromToken, via, toToken],
              quote: {
                fromToken,
                toToken,
                amountIn,
                amountOut: quote2.amountOut,
                rate: quote2.amountOut / amountIn,
                fee: quote1.fee + quote2.fee,
                feePercent: ((quote1.fee + quote2.fee) / amountIn) * 100,
                priceImpact: quote1.priceImpact + quote2.priceImpact,
                minimumReceived: quote2.amountOut * 0.95,
                route: [fromToken, via, toToken]
              },
              hops: 2
            };
          }
        } catch {
          // Skip if route doesn't work
        }
      }
    }

    if (!bestRoute) {
      throw new Error(`No route found for ${fromToken} -> ${toToken}`);
    }

    return bestRoute;
  }

  /**
   * Execute swap
   */
  executeSwap(userId, fromToken, toToken, amountIn, slippageTolerance = 0.05) {
    const route = this.findBestRoute(fromToken, toToken, amountIn);
    const quote = route.quote;

    // Check slippage
    const expectedOutput = quote.amountOut;
    const minimumOutput = expectedOutput * (1 - slippageTolerance);

    // Execute the swap through each hop
    let currentAmount = amountIn;

    for (let i = 0; i < route.route.length - 1; i++) {
      const from = route.route[i];
      const to = route.route[i + 1];
      
      const pairId = this.getPairId(from, to);
      const pool = this.liquidityPools.get(pairId);

      const isAtoB = pool.tokenA === from;
      const reserveIn = isAtoB ? pool.reserveA : pool.reserveB;
      const reserveOut = isAtoB ? pool.reserveB : pool.reserveA;

      const amountInWithFee = currentAmount * (1 - pool.fee);
      const amountOut = (reserveOut * amountInWithFee) / (reserveIn + amountInWithFee);

      // Update pool reserves
      if (isAtoB) {
        pool.reserveA += currentAmount;
        pool.reserveB -= amountOut;
      } else {
        pool.reserveB += currentAmount;
        pool.reserveA -= amountOut;
      }

      pool.trades += 1;
      pool.volume24h += currentAmount;

      currentAmount = amountOut;
    }

    // Check if we met minimum output
    if (currentAmount < minimumOutput) {
      throw new Error('Slippage tolerance exceeded');
    }

    // Record swap
    const swapId = `swap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const swap = {
      swapId,
      userId,
      fromToken,
      toToken,
      amountIn,
      amountOut: currentAmount,
      rate: currentAmount / amountIn,
      route: route.route,
      fee: quote.fee,
      priceImpact: quote.priceImpact,
      status: 'completed',
      timestamp: Date.now()
    };

    // Store swap history
    if (!this.swapHistory.has(userId)) {
      this.swapHistory.set(userId, []);
    }
    this.swapHistory.get(userId).push(swap);

    return swap;
  }

  /**
   * Get swap history for user
   */
  getSwapHistory(userId, limit = 50) {
    return (this.swapHistory.get(userId) || []).slice(-limit).reverse();
  }

  /**
   * Get all liquidity pools
   */
  getLiquidityPools() {
    const pools = [];
    for (const [pairId, pool] of this.liquidityPools.entries()) {
      pools.push({
        pair: pairId,
        tokenA: pool.tokenA,
        tokenB: pool.tokenB,
        reserveA: pool.reserveA,
        reserveB: pool.reserveB,
        priceAtoB: pool.reserveB / pool.reserveA,
        priceBtoA: pool.reserveA / pool.reserveB,
        fee: pool.fee * 100,
        trades: pool.trades,
        volume24h: pool.volume24h
      });
    }
    return pools;
  }

  /**
   * Get pool details
   */
  getPool(tokenA, tokenB) {
    const pairId = this.getPairId(tokenA, tokenB);
    return this.liquidityPools.get(pairId);
  }

  /**
   * Block trade - execute large swap with guaranteed price
   */
  executeBlockTrade(userId, fromToken, toToken, amountIn, guaranteedRate) {
    // Block trades are executed at guaranteed rates for large volumes
    const amountOut = amountIn * guaranteedRate;
    
    const swapId = `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const swap = {
      swapId,
      userId,
      fromToken,
      toToken,
      amountIn,
      amountOut,
      rate: guaranteedRate,
      type: 'block_trade',
      route: [fromToken, toToken],
      fee: 0, // No fee for block trades
      priceImpact: 0,
      status: 'completed',
      timestamp: Date.now()
    };

    if (!this.swapHistory.has(userId)) {
      this.swapHistory.set(userId, []);
    }
    this.swapHistory.get(userId).push(swap);

    return swap;
  }

  /**
   * Get statistics
   */
  getStatistics(userId = null) {
    if (userId) {
      const swaps = this.swapHistory.get(userId) || [];
      const totalSwaps = swaps.length;
      const totalVolume = swaps.reduce((sum, s) => sum + s.amountIn, 0);
      const avgPriceImpact = swaps.length > 0
        ? swaps.reduce((sum, s) => sum + (s.priceImpact || 0), 0) / swaps.length
        : 0;

      return {
        totalSwaps,
        totalVolume,
        avgPriceImpact,
        recentSwaps: swaps.slice(-10).reverse()
      };
    }

    // Global statistics
    let totalSwaps = 0;
    let totalVolume = 0;
    for (const swaps of this.swapHistory.values()) {
      totalSwaps += swaps.length;
      totalVolume += swaps.reduce((sum, s) => sum + s.amountIn, 0);
    }

    return {
      totalSwaps,
      totalVolume,
      totalPools: this.liquidityPools.size
    };
  }
}

module.exports = TokenSwapService;
