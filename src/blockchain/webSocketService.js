const { Server } = require("socket.io");

/**
 * WebSocket Service for Real-Time Updates
 * Provides real-time price updates, transaction notifications, and order updates
 */

class WebSocketService {
  constructor(httpServer, options = {}) {
    this.authenticate = options.authenticate;
    this.io = new Server(httpServer, {
      cors: {
        origin: options.corsOrigin || false,
        methods: ["GET", "POST"]
      }
    });
    this.connectedClients = new Map();
    this.io.use(async (socket, next) => {
      try {
        const token = String(socket.handshake.auth?.token || "");
        if (!token || typeof this.authenticate !== "function") {
          throw new Error("Authentication required");
        }
        const user = await this.authenticate(token);
        if (!user?.id) {
          throw new Error("Invalid token user");
        }
        socket.data.user = user;
        next();
      } catch {
        next(new Error("Authentication failed"));
      }
    });
    this.setupEventHandlers();
  }

  /**
   * Setup WebSocket event handlers
   */
  setupEventHandlers() {
    this.io.on("connection", (socket) => {
      console.log(`Client connected: ${socket.id}`);
      const userId = socket.data.user.id;
      this.connectedClients.set(socket.id, {
        socket,
        userId,
        subscriptions: new Set()
      });
      socket.join(`user:${userId}`);
      socket.emit("authenticated", { success: true, userId });

      socket.on("subscribe", (data) => {
        this.handleSubscription(socket, data);
      });

      socket.on("unsubscribe", (data) => {
        this.handleUnsubscription(socket, data);
      });

      socket.on("ping", () => {
        socket.emit("pong", { timestamp: Date.now() });
      });

      socket.on("disconnect", () => {
        console.log(`Client disconnected: ${socket.id}`);
        this.connectedClients.delete(socket.id);
      });
    });
  }

  isAllowedChannel(channel) {
    return channel === "market" || /^price:[A-Z0-9_-]{2,15}$/.test(channel);
  }

  /**
   * Handle subscription to channels
   * @param {object} socket - Socket instance
   * @param {object} data - Subscription data
   */
  handleSubscription(socket, data) {
    const client = this.connectedClients.get(socket.id);
    const channel = String(data?.channel || "");
    if (!client || !this.isAllowedChannel(channel)) {
      socket.emit("subscriptionError", { error: "Unsupported channel" });
      return;
    }
    client.subscriptions.add(channel);
    socket.join(channel);
    socket.emit("subscribed", { channel });
    console.log(`Client ${socket.id} subscribed to ${channel}`);
  }

  /**
   * Handle unsubscription from channels
   * @param {object} socket - Socket instance
   * @param {object} data - Unsubscription data
   */
  handleUnsubscription(socket, data) {
    const client = this.connectedClients.get(socket.id);
    const channel = String(data?.channel || "");
    if (client && this.isAllowedChannel(channel)) {
      client.subscriptions.delete(channel);
      socket.leave(channel);
      socket.emit("unsubscribed", { channel });
      console.log(`Client ${socket.id} unsubscribed from ${channel}`);
    }
  }

  /**
   * Broadcast price update to all subscribed clients
   * @param {string} symbol - Cryptocurrency symbol
   * @param {object} priceData - Price data
   */
  broadcastPriceUpdate(symbol, priceData) {
    this.io.to(`price:${symbol}`).emit("priceUpdate", {
      symbol,
      ...priceData,
      timestamp: Date.now()
    });
  }

  /**
   * Send balance update to specific user
   * @param {number} userId - User ID
   * @param {object} balanceData - Balance data
   */
  sendBalanceUpdate(userId, balanceData) {
    this.io.to(`user:${userId}`).emit("balanceUpdate", {
      ...balanceData,
      timestamp: Date.now()
    });
  }

  /**
   * Send transaction notification to user
   * @param {number} userId - User ID
   * @param {object} transaction - Transaction data
   */
  sendTransactionNotification(userId, transaction) {
    this.io.to(`user:${userId}`).emit("transaction", {
      ...transaction,
      timestamp: Date.now()
    });
  }

  /**
   * Send order update to user
   * @param {number} userId - User ID
   * @param {object} order - Order data
   */
  sendOrderUpdate(userId, order) {
    this.io.to(`user:${userId}`).emit("orderUpdate", {
      ...order,
      timestamp: Date.now()
    });
  }

  /**
   * Broadcast market update
   * @param {object} marketData - Market data
   */
  broadcastMarketUpdate(marketData) {
    this.io.to("market").emit("marketUpdate", {
      ...marketData,
      timestamp: Date.now()
    });
  }

  /**
   * Send notification to user
   * @param {number} userId - User ID
   * @param {object} notification - Notification data
   */
  sendNotification(userId, notification) {
    this.io.to(`user:${userId}`).emit("notification", {
      ...notification,
      timestamp: Date.now()
    });
  }

  /**
   * Broadcast to all connected clients
   * @param {string} event - Event name
   * @param {object} data - Event data
   */
  broadcastToAll(event, data) {
    this.io.emit(event, {
      ...data,
      timestamp: Date.now()
    });
  }

  /**
   * Get connected clients count
   * @returns {number} Number of connected clients
   */
  getConnectedClientsCount() {
    return this.connectedClients.size;
  }

  /**
   * Get client subscriptions
   * @param {string} socketId - Socket ID
   * @returns {Array} Array of subscriptions
   */
  getClientSubscriptions(socketId) {
    const client = this.connectedClients.get(socketId);
    return client ? Array.from(client.subscriptions) : [];
  }

  /**
   * Disconnect all clients
   */
  disconnectAll() {
    this.io.disconnectSockets();
    this.connectedClients.clear();
  }

  /**
   * Get statistics
   * @returns {object} WebSocket statistics
   */
  getStats() {
    const clients = Array.from(this.connectedClients.values());
    return {
      totalClients: clients.length,
      authenticatedClients: clients.filter(c => c.userId).length,
      totalSubscriptions: clients.reduce((sum, c) => sum + c.subscriptions.size, 0)
    };
  }

  /**
   * Broadcast message to a specific channel
   * @param {string} channel - Channel name
   * @param {string} event - Event name
   * @param {object} data - Data to send
   */
  broadcast(channel, event, data) {
    this.io.to(channel).emit(event, {
      ...data,
      timestamp: Date.now()
    });
  }

  /**
   * Send message to a specific user
   * @param {number} userId - User ID
   * @param {string} event - Event name
   * @param {object} data - Data to send
   */
  sendToUser(userId, event, data) {
    this.io.to(`user:${userId}`).emit(event, {
      ...data,
      timestamp: Date.now()
    });
  }
}

module.exports = WebSocketService;
