/**
 * P2P Trading Service
 * Peer-to-peer cryptocurrency trading with escrow
 */

class P2PTradingService {
  constructor() {
    this.orders = new Map(); // orderId -> order data
    this.escrows = new Map(); // tradeId -> escrow data
    this.userRatings = new Map(); // userId -> rating data
    
    // Payment methods
    this.paymentMethods = [
      'Bank Transfer',
      'UPI',
      'PayPal',
      'Wise',
      'Revolut',
      'Cash App',
      'Venmo',
      'Zelle',
      'Western Union',
      'MoneyGram',
      'Skrill',
      'Neteller',
      'Perfect Money',
      'WebMoney',
      'Credit Card',
      'Debit Card'
    ];
  }

  /**
   * Create P2P order (Buy or Sell)
   */
  createOrder(userId, config) {
    const {
      type,              // 'buy' or 'sell'
      crypto,            // 'BTC', 'ETH', etc.
      fiat,              // 'USD', 'EUR', 'INR', etc.
      amount,            // Crypto amount
      pricePerUnit,      // Price per unit in fiat
      minOrder,          // Minimum order amount
      maxOrder,          // Maximum order amount
      paymentMethods,    // Array of accepted payment methods
      paymentWindow,     // Payment window in minutes (default 15)
      terms              // Additional terms/instructions
    } = config;

    const orderId = `p2p_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const totalValue = amount * pricePerUnit;

    const order = {
      orderId,
      userId,
      type,
      crypto,
      fiat,
      amount,
      availableAmount: amount,
      pricePerUnit,
      totalValue,
      minOrder: minOrder || amount * 0.1,
      maxOrder: maxOrder || amount,
      paymentMethods: paymentMethods || [],
      paymentWindow: paymentWindow || 15,
      terms: terms || '',
      status: 'active',
      trades: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.orders.set(orderId, order);
    return order;
  }

  /**
   * Get all active orders
   */
  getActiveOrders(filters = {}) {
    const { type, crypto, fiat, minPrice, maxPrice, paymentMethod } = filters;
    
    const orders = [];
    for (const order of this.orders.values()) {
      if (order.status !== 'active' || order.availableAmount <= 0) continue;

      // Apply filters
      if (type && order.type !== type) continue;
      if (crypto && order.crypto !== crypto) continue;
      if (fiat && order.fiat !== fiat) continue;
      if (minPrice && order.pricePerUnit < minPrice) continue;
      if (maxPrice && order.pricePerUnit > maxPrice) continue;
      if (paymentMethod && !order.paymentMethods.includes(paymentMethod)) continue;

      // Add seller rating
      const rating = this.getUserRating(order.userId);
      orders.push({
        ...order,
        sellerRating: rating
      });
    }

    // Sort by price (best prices first)
    return orders.sort((a, b) => {
      if (a.type === 'sell') {
        return a.pricePerUnit - b.pricePerUnit; // Lower price first for sellers
      } else {
        return b.pricePerUnit - a.pricePerUnit; // Higher price first for buyers
      }
    });
  }

  /**
   * Get user orders
   */
  getUserOrders(userId, status = null) {
    const orders = [];
    for (const order of this.orders.values()) {
      if (order.userId === userId) {
        if (status === null || order.status === status) {
          orders.push(order);
        }
      }
    }
    return orders;
  }

  /**
   * Accept P2P order and create trade
   */
  acceptOrder(orderId, buyerId, orderAmount, paymentMethod) {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status !== 'active') {
      throw new Error('Order is not active');
    }

    if (order.userId === buyerId) {
      throw new Error('Cannot accept your own order');
    }

    if (orderAmount < order.minOrder || orderAmount > order.maxOrder) {
      throw new Error(`Order amount must be between ${order.minOrder} and ${order.maxOrder}`);
    }

    if (orderAmount > order.availableAmount) {
      throw new Error('Insufficient available amount');
    }

    if (!order.paymentMethods.includes(paymentMethod)) {
      throw new Error('Payment method not accepted');
    }

    // Create trade
    const tradeId = `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const cryptoAmount = orderAmount;
    const fiatAmount = orderAmount * order.pricePerUnit;

    const trade = {
      tradeId,
      orderId,
      sellerId: order.type === 'sell' ? order.userId : buyerId,
      buyerId: order.type === 'sell' ? buyerId : order.userId,
      crypto: order.crypto,
      fiat: order.fiat,
      cryptoAmount,
      fiatAmount,
      pricePerUnit: order.pricePerUnit,
      paymentMethod,
      paymentWindow: order.paymentWindow,
      status: 'pending_payment',
      escrowStatus: 'locked',
      dispute: null,
      messages: [],
      timeline: [
        { event: 'trade_created', timestamp: Date.now() }
      ],
      createdAt: Date.now(),
      expiresAt: Date.now() + (order.paymentWindow * 60 * 1000)
    };

    // Lock crypto in escrow
    this.escrows.set(tradeId, {
      tradeId,
      sellerId: trade.sellerId,
      amount: cryptoAmount,
      crypto: order.crypto,
      status: 'locked',
      lockedAt: Date.now()
    });

    // Update order
    order.availableAmount -= cryptoAmount;
    order.trades.push(tradeId);
    order.updatedAt = Date.now();

    if (order.availableAmount <= 0) {
      order.status = 'completed';
    }

    this.orders.set(orderId, order);
    
    return trade;
  }

  /**
   * Buyer marks payment as sent
   */
  markPaymentSent(tradeId, buyerId, paymentDetails) {
    const trade = this.getTrade(tradeId);
    if (!trade) {
      throw new Error('Trade not found');
    }

    if (trade.buyerId !== buyerId) {
      throw new Error('Only buyer can mark payment as sent');
    }

    if (trade.status !== 'pending_payment') {
      throw new Error('Invalid trade status');
    }

    trade.status = 'payment_sent';
    trade.paymentDetails = paymentDetails;
    trade.timeline.push({
      event: 'payment_sent',
      timestamp: Date.now()
    });

    return trade;
  }

  /**
   * Seller confirms payment received
   */
  confirmPaymentReceived(tradeId, sellerId) {
    const trade = this.getTrade(tradeId);
    if (!trade) {
      throw new Error('Trade not found');
    }

    if (trade.sellerId !== sellerId) {
      throw new Error('Only seller can confirm payment');
    }

    if (trade.status !== 'payment_sent') {
      throw new Error('Payment not marked as sent');
    }

    // Release escrow to buyer
    const escrow = this.escrows.get(tradeId);
    if (escrow) {
      escrow.status = 'released';
      escrow.releasedTo = trade.buyerId;
      escrow.releasedAt = Date.now();
    }

    trade.status = 'completed';
    trade.escrowStatus = 'released';
    trade.completedAt = Date.now();
    trade.timeline.push({
      event: 'payment_confirmed',
      timestamp: Date.now()
    });
    trade.timeline.push({
      event: 'crypto_released',
      timestamp: Date.now()
    });

    return trade;
  }

  /**
   * Cancel trade
   */
  cancelTrade(tradeId, userId, reason) {
    const trade = this.getTrade(tradeId);
    if (!trade) {
      throw new Error('Trade not found');
    }

    if (trade.buyerId !== userId && trade.sellerId !== userId) {
      throw new Error('Not authorized to cancel this trade');
    }

    // Can only cancel if payment not sent
    if (trade.status !== 'pending_payment') {
      throw new Error('Cannot cancel trade after payment sent');
    }

    // Release escrow back to seller
    const escrow = this.escrows.get(tradeId);
    if (escrow) {
      escrow.status = 'returned';
      escrow.returnedTo = trade.sellerId;
      escrow.returnedAt = Date.now();
    }

    // Return amount to order
    const order = this.orders.get(trade.orderId);
    if (order) {
      order.availableAmount += trade.cryptoAmount;
      order.status = 'active';
      order.updatedAt = Date.now();
    }

    trade.status = 'cancelled';
    trade.escrowStatus = 'returned';
    trade.cancelReason = reason;
    trade.cancelledBy = userId;
    trade.cancelledAt = Date.now();
    trade.timeline.push({
      event: 'trade_cancelled',
      timestamp: Date.now(),
      reason
    });

    return trade;
  }

  /**
   * Open dispute
   */
  openDispute(tradeId, userId, reason, evidence) {
    const trade = this.getTrade(tradeId);
    if (!trade) {
      throw new Error('Trade not found');
    }

    if (trade.buyerId !== userId && trade.sellerId !== userId) {
      throw new Error('Not authorized');
    }

    if (trade.status === 'completed' || trade.status === 'cancelled') {
      throw new Error('Cannot dispute completed or cancelled trade');
    }

    trade.dispute = {
      openedBy: userId,
      reason,
      evidence,
      status: 'open',
      resolution: null,
      openedAt: Date.now()
    };

    trade.status = 'disputed';
    trade.timeline.push({
      event: 'dispute_opened',
      timestamp: Date.now(),
      by: userId
    });

    return trade;
  }

  /**
   * Resolve dispute (admin action)
   */
  resolveDispute(tradeId, adminId, resolution, winner) {
    const trade = this.getTrade(tradeId);
    if (!trade || !trade.dispute) {
      throw new Error('Trade or dispute not found');
    }

    const escrow = this.escrows.get(tradeId);
    
    // Release escrow based on resolution
    if (winner === 'buyer') {
      escrow.status = 'released';
      escrow.releasedTo = trade.buyerId;
      trade.escrowStatus = 'released';
    } else if (winner === 'seller') {
      escrow.status = 'returned';
      escrow.returnedTo = trade.sellerId;
      trade.escrowStatus = 'returned';
    }

    escrow.resolvedAt = Date.now();

    trade.dispute.status = 'resolved';
    trade.dispute.resolution = resolution;
    trade.dispute.winner = winner;
    trade.dispute.resolvedBy = adminId;
    trade.dispute.resolvedAt = Date.now();

    trade.status = 'resolved';
    trade.timeline.push({
      event: 'dispute_resolved',
      timestamp: Date.now(),
      winner,
      resolution
    });

    return trade;
  }

  /**
   * Add rating for user
   */
  rateUser(tradeId, raterId, ratedUserId, rating, comment) {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const trade = this.getTrade(tradeId);
    if (!trade || trade.status !== 'completed') {
      throw new Error('Can only rate completed trades');
    }

    if (trade.buyerId !== raterId && trade.sellerId !== raterId) {
      throw new Error('Not authorized to rate this trade');
    }

    const userRating = this.userRatings.get(ratedUserId) || {
      userId: ratedUserId,
      totalRating: 0,
      ratingCount: 0,
      averageRating: 0,
      ratings: []
    };

    userRating.ratings.push({
      tradeId,
      raterId,
      rating,
      comment,
      createdAt: Date.now()
    });

    userRating.totalRating += rating;
    userRating.ratingCount += 1;
    userRating.averageRating = userRating.totalRating / userRating.ratingCount;

    this.userRatings.set(ratedUserId, userRating);

    return userRating;
  }

  /**
   * Get user rating
   */
  getUserRating(userId) {
    const rating = this.userRatings.get(userId);
    if (!rating) {
      return {
        userId,
        averageRating: 0,
        ratingCount: 0,
        ratings: []
      };
    }
    return rating;
  }

  /**
   * Get trade details
   */
  getTrade(tradeId) {
    for (const [orderId, order] of this.orders.entries()) {
      for (const tId of order.trades) {
        if (tId === tradeId) {
          // Find trade data (stored separately for better organization)
          // In production, this would be in database
          return { tradeId, orderId, ...order }; // Simplified
        }
      }
    }
    return null;
  }

  /**
   * Get user trades
   */
  getUserTrades(userId, _status = null) {
    const trades = [];
    // In production, query database for trades where buyerId or sellerId = userId
    return trades;
  }

  /**
   * Add message to trade chat
   */
  addMessage(tradeId, userId, message) {
    const trade = this.getTrade(tradeId);
    if (!trade) {
      throw new Error('Trade not found');
    }

    if (trade.buyerId !== userId && trade.sellerId !== userId) {
      throw new Error('Not authorized');
    }

    trade.messages.push({
      userId,
      message,
      timestamp: Date.now()
    });

    return trade;
  }

  /**
   * Get supported payment methods
   */
  getPaymentMethods() {
    return this.paymentMethods;
  }

  /**
   * Get P2P statistics
   */
  getStatistics(userId = null) {
    if (userId) {
      const userOrders = this.getUserOrders(userId);
      const userTrades = this.getUserTrades(userId);
      const rating = this.getUserRating(userId);

      return {
        orders: {
          total: userOrders.length,
          active: userOrders.filter(o => o.status === 'active').length,
          completed: userOrders.filter(o => o.status === 'completed').length
        },
        trades: {
          total: userTrades.length,
          completed: userTrades.filter(t => t.status === 'completed').length,
          disputed: userTrades.filter(t => t.status === 'disputed').length
        },
        rating: {
          average: rating.averageRating,
          count: rating.ratingCount
        }
      };
    }

    // Global statistics
    return {
      totalOrders: this.orders.size,
      activeOrders: Array.from(this.orders.values()).filter(o => o.status === 'active').length,
      totalTrades: this.escrows.size
    };
  }
}

module.exports = P2PTradingService;
