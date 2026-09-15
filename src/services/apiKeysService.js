/**
 * API Keys Management Service
 * Generate and manage API keys for programmatic trading
 */

const crypto = require('crypto');

class APIKeysService {
  constructor() {
    this.apiKeys = new Map(); // keyId -> key data
    this.userKeys = new Map(); // userId -> keyIds array
    this.keyUsage = new Map(); // keyId -> usage stats
    
    // Rate limits
    this.rateLimits = {
      free: { requests: 1000, perMinute: 10 },
      basic: { requests: 10000, perMinute: 100 },
      pro: { requests: 100000, perMinute: 1000 },
      unlimited: { requests: Infinity, perMinute: 10000 }
    };
  }

  /**
   * Generate API key
   */
  generateAPIKey(userId, config) {
    const {
      name,
      permissions,      // ['trading', 'reading', 'withdrawal', 'transfer']
      ipWhitelist,     // Array of allowed IP addresses
      tier,            // 'free', 'basic', 'pro', 'unlimited'
      expiresIn        // Expiry time in ms (null = never expires)
    } = config;

    // Generate secure API key and secret
    const apiKey = 'ak_' + crypto.randomBytes(16).toString('hex');
    const apiSecret = 'sk_' + crypto.randomBytes(32).toString('hex');
    const apiSecretHash = crypto.createHash('sha256').update(apiSecret).digest('hex');

    const keyId = `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = expiresIn ? Date.now() + expiresIn : null;

    const keyData = {
      keyId,
      userId,
      name: name || 'API Key',
      apiKey,
      apiSecretHash,  // Store hash, not plain secret
      permissions: permissions || ['reading'],
      ipWhitelist: ipWhitelist || [],
      tier: tier || 'free',
      rateLimit: this.rateLimits[tier || 'free'],
      isActive: true,
      expiresAt,
      createdAt: Date.now(),
      lastUsedAt: null
    };

    this.apiKeys.set(apiKey, keyData);

    // Track user's keys
    if (!this.userKeys.has(userId)) {
      this.userKeys.set(userId, []);
    }
    this.userKeys.get(userId).push(keyId);

    // Initialize usage stats
    this.keyUsage.set(keyId, {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      requestsByEndpoint: {},
      lastHourRequests: 0,
      lastMinuteRequests: 0,
      rateLimitHits: 0
    });

    // Return key and secret (secret shown only once!)
    return {
      keyId,
      apiKey,
      apiSecret,  // ONLY returned on creation!
      ...keyData,
      apiSecretHash: undefined // Don't return hash
    };
  }

  /**
   * Validate API key
   */
  validateAPIKey(apiKey, apiSecret, requiredPermission = null) {
    const keyData = this.apiKeys.get(apiKey);
    
    if (!keyData) {
      return { valid: false, error: 'Invalid API key' };
    }

    if (!keyData.isActive) {
      return { valid: false, error: 'API key is disabled' };
    }

    // Check expiry
    if (keyData.expiresAt && Date.now() > keyData.expiresAt) {
      return { valid: false, error: 'API key has expired' };
    }

    // Validate secret
    const secretHash = crypto.createHash('sha256').update(apiSecret).digest('hex');
    if (secretHash !== keyData.apiSecretHash) {
      return { valid: false, error: 'Invalid API secret' };
    }

    // Check permissions
    if (requiredPermission && !keyData.permissions.includes(requiredPermission)) {
      return { valid: false, error: `Missing required permission: ${requiredPermission}` };
    }

    // Check rate limit
    const usage = this.keyUsage.get(keyData.keyId);
    if (usage && usage.lastMinuteRequests >= keyData.rateLimit.perMinute) {
      usage.rateLimitHits += 1;
      return { valid: false, error: 'Rate limit exceeded' };
    }

    return { valid: true, keyData };
  }

  /**
   * Validate API key with IP check
   */
  validateAPIKeyWithIP(apiKey, apiSecret, ipAddress, requiredPermission = null) {
    const validation = this.validateAPIKey(apiKey, apiSecret, requiredPermission);
    
    if (!validation.valid) {
      return validation;
    }

    const keyData = validation.keyData;

    // Check IP whitelist
    if (keyData.ipWhitelist.length > 0 && !keyData.ipWhitelist.includes(ipAddress)) {
      return { valid: false, error: 'IP address not whitelisted' };
    }

    return validation;
  }

  /**
   * Record API usage
   */
  recordUsage(apiKey, endpoint, success = true) {
    const keyData = this.apiKeys.get(apiKey);
    if (!keyData) return;

    const usage = this.keyUsage.get(keyData.keyId);
    if (!usage) return;

    usage.totalRequests += 1;
    if (success) {
      usage.successfulRequests += 1;
    } else {
      usage.failedRequests += 1;
    }

    // Track by endpoint
    usage.requestsByEndpoint[endpoint] = (usage.requestsByEndpoint[endpoint] || 0) + 1;

    // Update rate limit counters
    usage.lastMinuteRequests += 1;
    usage.lastHourRequests += 1;

    // Update last used
    keyData.lastUsedAt = Date.now();

    // Reset rate limit counters periodically
    setTimeout(() => {
      usage.lastMinuteRequests = Math.max(0, usage.lastMinuteRequests - 1);
    }, 60000); // 1 minute

    setTimeout(() => {
      usage.lastHourRequests = Math.max(0, usage.lastHourRequests - 1);
    }, 3600000); // 1 hour
  }

  /**
   * Get user's API keys
   */
  getUserAPIKeys(userId) {
    const keyIds = this.userKeys.get(userId) || [];
    const keys = [];

    for (const keyId of keyIds) {
      // Find key by keyId
      for (const keyData of this.apiKeys.values()) {
        if (keyData.keyId === keyId) {
          keys.push({
            ...keyData,
            apiSecretHash: undefined, // Don't return hash
            usage: this.keyUsage.get(keyId)
          });
          break;
        }
      }
    }

    return keys;
  }

  /**
   * Get API key details
   */
  getAPIKeyDetails(apiKey) {
    const keyData = this.apiKeys.get(apiKey);
    if (!keyData) return null;

    return {
      ...keyData,
      apiSecretHash: undefined,
      usage: this.keyUsage.get(keyData.keyId)
    };
  }

  /**
   * Update API key
   */
  updateAPIKey(userId, keyId, updates) {
    // Find the key
    let targetKey = null;

    for (const keyData of this.apiKeys.values()) {
      if (keyData.keyId === keyId && keyData.userId === userId) {
        targetKey = keyData;
        break;
      }
    }

    if (!targetKey) {
      throw new Error('API key not found');
    }

    // Allow updating: name, permissions, ipWhitelist, isActive
    const allowedUpdates = ['name', 'permissions', 'ipWhitelist', 'isActive'];
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedUpdates.includes(key)) {
        targetKey[key] = value;
      }
    }

    return targetKey;
  }

  /**
   * Revoke API key
   */
  revokeAPIKey(userId, keyId) {
    // Find and remove the key
    let removed = false;

    for (const [apiKey, keyData] of this.apiKeys.entries()) {
      if (keyData.keyId === keyId && keyData.userId === userId) {
        this.apiKeys.delete(apiKey);
        removed = true;
        break;
      }
    }

    if (!removed) {
      throw new Error('API key not found');
    }

    // Remove from user's keys
    const userKeyIds = this.userKeys.get(userId) || [];
    this.userKeys.set(userId, userKeyIds.filter(id => id !== keyId));

    // Remove usage data
    this.keyUsage.delete(keyId);

    return { success: true, keyId };
  }

  /**
   * Get API key usage statistics
   */
  getUsageStats(keyId) {
    return this.keyUsage.get(keyId);
  }

  /**
   * Get user's total API usage
   */
  getUserUsageStats(userId) {
    const keyIds = this.userKeys.get(userId) || [];
    
    const stats = {
      totalKeys: keyIds.length,
      activeKeys: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rateLimitHits: 0
    };

    for (const keyId of keyIds) {
      const usage = this.keyUsage.get(keyId);
      if (!usage) continue;

      // Find key to check if active
      for (const keyData of this.apiKeys.values()) {
        if (keyData.keyId === keyId) {
          if (keyData.isActive) stats.activeKeys += 1;
          break;
        }
      }

      stats.totalRequests += usage.totalRequests;
      stats.successfulRequests += usage.successfulRequests;
      stats.failedRequests += usage.failedRequests;
      stats.rateLimitHits += usage.rateLimitHits;
    }

    return stats;
  }

  /**
   * Generate webhook secret
   */
  generateWebhookSecret(_userId) {
    const secret = 'whsec_' + crypto.randomBytes(32).toString('hex');
    return secret;
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload, signature, secret) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    const calculatedSignature = hmac.digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(calculatedSignature)
    );
  }

  /**
   * Get available permissions
   */
  getAvailablePermissions() {
    return [
      { id: 'reading', name: 'Read Only', description: 'View account info, balances, and history' },
      { id: 'trading', name: 'Trading', description: 'Place and cancel orders' },
      { id: 'transfer', name: 'Transfer', description: 'Transfer funds between accounts' },
      { id: 'withdrawal', name: 'Withdrawal', description: 'Withdraw funds from account' }
    ];
  }

  /**
   * Get available tiers
   */
  getAvailableTiers() {
    return [
      { 
        id: 'free', 
        name: 'Free', 
        limits: this.rateLimits.free,
        price: 0
      },
      { 
        id: 'basic', 
        name: 'Basic', 
        limits: this.rateLimits.basic,
        price: 9.99
      },
      { 
        id: 'pro', 
        name: 'Professional', 
        limits: this.rateLimits.pro,
        price: 49.99
      },
      { 
        id: 'unlimited', 
        name: 'Unlimited', 
        limits: this.rateLimits.unlimited,
        price: 199.99
      }
    ];
  }
}

module.exports = APIKeysService;
