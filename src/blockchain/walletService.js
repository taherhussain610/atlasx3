const { ethers } = require("ethers");
const { Keypair } = require("@solana/web3.js");
const bip39 = require("bip39");
const { TronWeb } = require("tronweb");

/**
 * Wallet Generation Service
 * Provides functionality for creating and managing cryptocurrency wallets
 */

class WalletService {
  /**
   * Generate a new mnemonic phrase (seed phrase)
   * @returns {string} 12-word mnemonic phrase
   */
  static generateMnemonic() {
    return bip39.generateMnemonic();
  }

  /**
   * Validate a mnemonic phrase
   * @param {string} mnemonic - The mnemonic phrase to validate
   * @returns {boolean} True if valid
   */
  static validateMnemonic(mnemonic) {
    return bip39.validateMnemonic(mnemonic);
  }

  /**
   * Validate a TRON Base58Check address
   * @param {string} address - TRON address
   * @returns {boolean} True if valid
   */
  static isValidTronAddress(address) {
    if (typeof address !== "string" || !address.trim()) {
      return false;
    }

    try {
      return TronWeb.isAddress(address.trim());
    } catch {
      return false;
    }
  }

  /**
   * Generate Ethereum wallet from mnemonic
   * @param {string} mnemonic - Mnemonic phrase
   * @param {number} index - Account index (default: 0)
   * @returns {object} Wallet with address and private key
   */
  static generateEthereumWallet(mnemonic = null, index = 0) {
    const seed = mnemonic || this.generateMnemonic();
    const path = `m/44'/60'/0'/0/${index}`;
    const wallet = ethers.HDNodeWallet.fromPhrase(seed, undefined, path);

    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: seed,
      path,
      type: "ethereum",
    };
  }

  /**
   * Generate BSC wallet (same as Ethereum)
   * @param {string} mnemonic - Mnemonic phrase
   * @param {number} index - Account index
   * @returns {object} Wallet with address and private key
   */
  static generateBscWallet(mnemonic = null, index = 0) {
    const wallet = this.generateEthereumWallet(mnemonic, index);
    return {
      ...wallet,
      type: "bsc",
    };
  }

  /**
   * Generate Solana wallet
   * @returns {object} Wallet with address and keypair
   */
  static generateSolanaWallet() {
    const keypair = Keypair.generate();
    return {
      address: keypair.publicKey.toString(),
      secretKey: Buffer.from(keypair.secretKey).toString("hex"),
      type: "solana",
    };
  }

  /**
   * Generate Solana wallet from mnemonic
   * @param {string} mnemonic - Mnemonic phrase
   * @param {number} index - Account index
   * @returns {object} Wallet with address
   */
  static generateSolanaWalletFromMnemonic(mnemonic = null, index = 0) {
    const seed = mnemonic || this.generateMnemonic();
    const seedBuffer = bip39.mnemonicToSeedSync(seed);
    const path = `m/44'/501'/${index}'/0'`;

    // Derive Solana keypair from seed
    const derivedSeed = seedBuffer.slice(0, 32);
    const keypair = Keypair.fromSeed(derivedSeed);

    return {
      address: keypair.publicKey.toString(),
      secretKey: Buffer.from(keypair.secretKey).toString("hex"),
      mnemonic: seed,
      path,
      type: "solana",
    };
  }

  /**
   * Import wallet from private key (Ethereum/BSC)
   * @param {string} privateKey - Private key
   * @returns {object} Wallet object
   */
  static importEthereumWallet(privateKey) {
    try {
      const wallet = new ethers.Wallet(privateKey);
      return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        type: "ethereum",
      };
    } catch (error) {
      throw new Error("Invalid private key", { cause: error });
    }
  }

  /**
   * Import Solana wallet from secret key
   * @param {string} secretKey - Secret key (hex string)
   * @returns {object} Wallet object
   */
  static importSolanaWallet(secretKey) {
    try {
      const secretKeyBuffer = Buffer.from(secretKey, "hex");
      const keypair = Keypair.fromSecretKey(secretKeyBuffer);
      return {
        address: keypair.publicKey.toString(),
        secretKey,
        type: "solana",
      };
    } catch (error) {
      throw new Error("Invalid secret key", { cause: error });
    }
  }

  /**
   * Generate TRON wallet
   * @returns {object} Wallet with address and private key
   */
  static generateTronWallet() {
    try {
      const tronWeb = new TronWeb({
        fullHost: "https://api.trongrid.io",
        headers: { "TRON-PRO-API-KEY": "" },
        privateKey: "0000000000000000000000000000000000000000000000000000000000000000",
      });
      const account = tronWeb.createAccount();
      return {
        address: account.address.base58,
        privateKey: account.privateKey,
        type: "tron",
      };
    } catch (error) {
      // Fallback: Generate random private key and derive address
      const crypto = require("crypto");
      const privateKey = crypto.randomBytes(32).toString("hex");
      const tronWeb = new TronWeb({
        fullHost: "https://api.trongrid.io",
        headers: { "TRON-PRO-API-KEY": "" },
        privateKey: privateKey,
      });
      return {
        address: tronWeb.address.fromPrivateKey(privateKey),
        privateKey: privateKey,
        type: "tron",
      };
    }
  }

  /**
   * Import TRON wallet from private key
   * @param {string} privateKey - Private key
   * @returns {object} Wallet object
   */
  static importTronWallet(privateKey) {
    try {
      const tronWeb = new TronWeb({
        fullHost: "https://api.trongrid.io",
      });
      const address = tronWeb.address.fromPrivateKey(privateKey);
      return {
        address,
        privateKey,
        type: "tron",
      };
    } catch (error) {
      throw new Error("Invalid TRON private key", { cause: error });
    }
  }

  /**
   * Generate multi-chain wallet from single mnemonic
   * @param {string} mnemonic - Optional mnemonic phrase
   * @returns {object} Wallets for multiple blockchains
   */
  static generateMultiChainWallet(mnemonic = null) {
    const seed = mnemonic || this.generateMnemonic();

    return {
      mnemonic: seed,
      ethereum: this.generateEthereumWallet(seed, 0),
      bsc: this.generateBscWallet(seed, 0),
      solana: this.generateSolanaWalletFromMnemonic(seed, 0),
      tron: this.generateTronWallet(),
    };
  }
}

module.exports = WalletService;
