// Import TronWeb using named export
const { TronWeb } = require("tronweb");
const axios = require("axios");

/**
 * TRON Blockchain Service
 * Handles TronWeb interactions for TRON network
 */

class TronService {
  constructor(network = "mainnet", apiKey = "", endpoints = {}) {
    this.network = network;
    this.apiKey = apiKey;
    this.tronWeb = null;

    // Set up endpoints based on network
    this.endpoints = endpoints || this.getDefaultEndpoints(network);
    this.jsonrpcUrl = this.endpoints.jsonrpc;
    this.walletUrl = this.endpoints.wallet;
    this.walletsolidityUrl = this.endpoints.walletsolidity;

    // Legacy support
    this.fullHost = this.jsonrpcUrl;
    this.tatumBaseUrl = this.walletUrl.replace("/wallet", "");

    // Initialize TronWeb
    this.initTronWeb();
  }

  /**
   * Get default endpoints for a network
   * @param {string} network - Network name (mainnet, shasta, nile)
   * @returns {object} Endpoints configuration
   */
  getDefaultEndpoints(network) {
    const endpoints = {
      mainnet: {
        jsonrpc: "https://erc-dog-ca66d82b.gateway.tatum.io/jsonrpc",
        wallet: "https://tron-mainnet.gateway.tatum.io/wallet",
        walletsolidity: "https://tron-mainnet.gateway.tatum.io/walletsolidity",
      },
      shasta: {
        jsonrpc: "https://tron-shasta.gateway.tatum.io/jsonrpc",
        wallet: "https://tron-shasta.gateway.tatum.io/wallet",
        walletsolidity: "https://tron-shasta.gateway.tatum.io/walletsolidity",
      },
      nile: {
        jsonrpc: "https://tron-nile.gateway.tatum.io/jsonrpc",
        wallet: "https://tron-nile.gateway.tatum.io/wallet",
        walletsolidity: "https://tron-nile.gateway.tatum.io/walletsolidity",
      },
    };
    return endpoints[network] || endpoints.mainnet;
  }

  /**
   * Initialize TronWeb instance
   */
  initTronWeb() {
    try {
      const headers = this.apiKey ? { "x-api-key": this.apiKey } : {};

      // TronWeb configuration with separate endpoints
      this.tronWeb = new TronWeb({
        fullHost: this.jsonrpcUrl,
        fullNode: this.jsonrpcUrl,
        solidityNode: this.walletsolidityUrl,
        eventServer: this.jsonrpcUrl,
        headers,
      });

      console.log(`✓ TronWeb initialized for ${this.network} network`);
    } catch (error) {
      console.error("Failed to initialize TronWeb:", error);
      this.tronWeb = null;
    }
  }

  /**
   * Get current block number
   * @returns {Promise<number>} Current block number
   */
  async getBlockNumber() {
    const block = await this.tronWeb.trx.getCurrentBlock();
    return block.block_header.raw_data.number;
  }

  /**
   * Get balance of an address
   * @param {string} address - Wallet address
   * @returns {Promise<number>} Balance in TRX
   */
  async getBalance(address) {
    try {
      // Validate address format first
      if (!this.tronWeb.isAddress(address)) {
        throw new Error("Invalid TRON address format");
      }

      const balance = await this.tronWeb.trx.getBalance(address);
      return this.tronWeb.fromSun(balance);
    } catch (error) {
      // If account doesn't exist, return 0 balance
      if (error.message && error.message.includes("Invalid address")) {
        return 0;
      }
      throw error;
    }
  }

  /**
   * Get account info
   * @param {string} address - Account address
   * @returns {Promise<object>} Account information
   */
  async getAccount(address) {
    return await this.tronWeb.trx.getAccount(address);
  }

  /**
   * Get transaction by hash
   * @param {string} txHash - Transaction hash
   * @returns {Promise<object>} Transaction details
   */
  async getTransaction(txHash) {
    return await this.tronWeb.trx.getTransaction(txHash);
  }

  /**
   * Get transaction info (receipt)
   * @param {string} txHash - Transaction hash
   * @returns {Promise<object>} Transaction info
   */
  async getTransactionInfo(txHash) {
    return await this.tronWeb.trx.getTransactionInfo(txHash);
  }

  /**
   * Send TRX
   * @param {string} privateKey - Sender's private key
   * @param {string} to - Recipient address
   * @param {number} amount - Amount in TRX
   * @returns {Promise<object>} Transaction result
   */
  async sendTrx(privateKey, to, amount) {
    const signedTx = await this.createSignedTrxTransaction(privateKey, to, amount);
    return await this.tronWeb.trx.sendRawTransaction(signedTx);
  }

  /**
   * Create a signed TRX transaction without broadcasting it
   * @param {string} privateKey - Sender's private key
   * @param {string} to - Recipient address
   * @param {number} amount - Amount in TRX
   * @returns {Promise<object>} Signed transaction payload
   */
  async createSignedTrxTransaction(privateKey, to, amount) {
    this.tronWeb.setPrivateKey(privateKey);
    const tx = await this.tronWeb.transactionBuilder.sendTrx(
      to,
      this.tronWeb.toSun(amount),
      this.tronWeb.address.fromPrivateKey(privateKey)
    );
    return await this.tronWeb.trx.sign(tx, privateKey);
  }

  /**
   * Get TRC20 token balance
   * @param {string} contractAddress - Token contract address
   * @param {string} walletAddress - Wallet address
   * @returns {Promise<number>} Token balance
   */
  async getTrc20Balance(contractAddress, walletAddress) {
    try {
      const contract = await this.tronWeb.contract().at(contractAddress);
      const balance = await contract.balanceOf(walletAddress).call();
      const decimals = await contract.decimals().call();
      return balance / Math.pow(10, decimals);
    } catch (error) {
      console.error("Error getting TRC20 balance:", error);
      return 0;
    }
  }

  /**
   * Get TRC20 token info
   * @param {string} contractAddress - Token contract address
   * @returns {Promise<object>} Token information
   */
  async getTrc20TokenInfo(contractAddress) {
    try {
      const contract = await this.tronWeb.contract().at(contractAddress);
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        contract.name().call(),
        contract.symbol().call(),
        contract.decimals().call(),
        contract.totalSupply().call(),
      ]);

      return {
        name,
        symbol,
        decimals: parseInt(decimals),
        totalSupply: (totalSupply / Math.pow(10, decimals)).toString(),
      };
    } catch (error) {
      console.error("Error getting TRC20 token info:", error);
      throw error;
    }
  }

  /**
   * Transfer TRC20 tokens
   * @param {string} privateKey - Sender's private key
   * @param {string} contractAddress - Token contract address
   * @param {string} to - Recipient address
   * @param {number} amount - Amount to transfer
   * @returns {Promise<object>} Transaction result
   */
  async transferTrc20(privateKey, contractAddress, to, amount) {
    this.tronWeb.setPrivateKey(privateKey);
    const contract = await this.tronWeb.contract().at(contractAddress);
    const decimals = await contract.decimals().call();
    const value = amount * Math.pow(10, decimals);
    return await contract.transfer(to, value).send();
  }

  /**
   * Get bandwidth info for an account
   * @param {string} address - Account address
   * @returns {Promise<object>} Bandwidth information
   */
  async getBandwidth(address) {
    return await this.tronWeb.trx.getBandwidth(address);
  }

  /**
   * Get energy info for an account
   * @param {string} address - Account address
   * @returns {Promise<object>} Energy information
   */
  async getAccountResources(address) {
    return await this.tronWeb.trx.getAccountResources(address);
  }

  /**
   * Validate TRON address
   * @param {string} address - Address to validate
   * @returns {boolean} True if valid
   */
  isValidAddress(address) {
    return this.tronWeb.isAddress(address);
  }

  /**
   * Convert hex address to base58
   * @param {string} hexAddress - Hex address
   * @returns {string} Base58 address
   */
  hexToBase58(hexAddress) {
    return this.tronWeb.address.fromHex(hexAddress);
  }

  /**
   * Convert base58 address to hex
   * @param {string} base58Address - Base58 address
   * @returns {string} Hex address
   */
  base58ToHex(base58Address) {
    return this.tronWeb.address.toHex(base58Address);
  }

  /**
   * Generate new TRON account
   * @returns {object} Account with address and private key
   */
  generateAccount() {
    const account = this.tronWeb.createAccount();
    return {
      address: account.address.base58,
      privateKey: account.privateKey,
      publicKey: account.publicKey,
    };
  }

  /**
   * Call smart contract method (read-only)
   * @param {string} contractAddress - Contract address
   * @param {string} method - Method name
   * @param {Array} params - Method parameters
   * @returns {Promise<any>} Method result
   */
  async callContractMethod(contractAddress, method, params = []) {
    const contract = await this.tronWeb.contract().at(contractAddress);
    return await contract[method](...params).call();
  }

  /**
   * Execute smart contract transaction
   * @param {string} privateKey - Sender's private key
   * @param {string} contractAddress - Contract address
   * @param {string} method - Method name
   * @param {Array} params - Method parameters
   * @returns {Promise<object>} Transaction result
   */
  async executeContractMethod(privateKey, contractAddress, method, params = []) {
    this.tronWeb.setPrivateKey(privateKey);
    const contract = await this.tronWeb.contract().at(contractAddress);
    return await contract[method](...params).send();
  }

  /**
   * Sign message
   * @param {string} privateKey - Private key
   * @param {string} message - Message to sign
   * @returns {string} Signature
   */
  async signMessage(privateKey, message) {
    this.tronWeb.setPrivateKey(privateKey);
    return await this.tronWeb.trx.sign(message);
  }

  /**
   * Verify signature
   * @param {string} message - Original message
   * @param {string} signature - Signature to verify
   * @param {string} address - Address to verify against
   * @returns {boolean} True if valid
   */
  async verifySignature(message, signature, address) {
    return await this.tronWeb.trx.verifyMessage(message, signature, address);
  }

  /**
   * Get current block using Tatum API (alternative method)
   * @returns {Promise<object>} Current block data
   */
  async getCurrentBlockViaTatum() {
    try {
      const response = await axios.get(`${this.walletUrl}/getnowblock`, {
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-api-key": this.apiKey,
        },
      });
      return response.data;
    } catch (error) {
      // Handle rate limiting gracefully
      if (error.response?.status === 429) {
        console.warn("Tatum API rate limit reached, using fallback");
        return null; // Return null instead of throwing
      }
      console.error("Error fetching current block from Tatum:", error.message);
      throw error;
    }
  }

  /**
   * Get account balance using Tatum API (alternative method)
   * @param {string} address - TRON address
   * @returns {Promise<object>} Account balance data
   */
  async getBalanceViaTatum(address) {
    try {
      const response = await axios.get(`${this.walletUrl}/getaccount`, {
        params: { address },
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-api-key": this.apiKey,
        },
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching balance from Tatum:", error.message);
      throw error;
    }
  }

  /**
   * Get transaction by ID using Tatum API (alternative method)
   * @param {string} txId - Transaction ID
   * @returns {Promise<object>} Transaction data
   */
  async getTransactionViaTatum(txId) {
    try {
      const response = await axios.post(
        `${this.walletUrl}/gettransactionbyid`,
        { value: txId },
        {
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            "x-api-key": this.apiKey,
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching transaction from Tatum:", error.message);
      throw error;
    }
  }

  /**
   * Get block by number using Tatum API
   * @param {number} blockNumber - Block number
   * @returns {Promise<object>} Block data
   */
  async getBlockByNumberViaTatum(blockNumber) {
    try {
      const response = await axios.post(
        `${this.walletUrl}/getblockbynum`,
        { num: blockNumber },
        {
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            "x-api-key": this.apiKey,
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching block from Tatum:", error.message);
      throw error;
    }
  }

  /**
   * Validate account using Tatum API
   * @param {string} address - TRON address to validate
   * @returns {Promise<object>} Validation result
   */
  async validateAddressViaTatum(address) {
    try {
      const response = await axios.post(
        `${this.walletUrl}/validateaddress`,
        { address },
        {
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            "x-api-key": this.apiKey,
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error("Error validating address via Tatum:", error.message);
      throw error;
    }
  }

  /**
   * Make JSON-RPC call to TRON network
   * @param {string} method - RPC method name
   * @param {Array} params - Method parameters
   * @returns {Promise<any>} RPC response
   */
  async jsonRpcCall(method, params = []) {
    try {
      const response = await axios.post(
        this.jsonrpcUrl,
        {
          jsonrpc: "2.0",
          method: method,
          params: params,
          id: Date.now(),
        },
        {
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            "x-api-key": this.apiKey,
          },
        }
      );

      if (response.data.error) {
        throw new Error(response.data.error.message || "JSON-RPC error");
      }

      return response.data.result;
    } catch (error) {
      console.error(`Error calling JSON-RPC method ${method}:`, error.message);
      throw error;
    }
  }

  /**
   * Query using walletsolidity endpoint (for confirmed data)
   * @param {string} endpoint - Endpoint path
   * @param {object} data - Request data
   * @returns {Promise<object>} Response data
   */
  async walletSolidityQuery(endpoint, data = {}) {
    try {
      const response = await axios.post(`${this.walletsolidityUrl}/${endpoint}`, data, {
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-api-key": this.apiKey,
        },
      });
      return response.data;
    } catch (error) {
      console.error(`Error querying walletsolidity ${endpoint}:`, error.message);
      throw error;
    }
  }

  /**
   * Get network information
   * @returns {object} Network configuration
   */
  getNetworkInfo() {
    return {
      network: this.network,
      endpoints: {
        jsonrpc: this.jsonrpcUrl,
        wallet: this.walletUrl,
        walletsolidity: this.walletsolidityUrl,
      },
      apiKey: this.apiKey ? "***" + this.apiKey.slice(-8) : "none",
    };
  }
}

module.exports = TronService;
