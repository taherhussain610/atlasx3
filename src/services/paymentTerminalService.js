/**
 * Payment Terminal Service
 * Handles debit/credit card payments with EMV protocols
 * Protocols: 101.1, 101.2, 101.3, 201.1, 201.2, 201.3
 */

const crypto = require("crypto");
const EventEmitter = require("events");

class PaymentTerminalService extends EventEmitter {
  constructor() {
    super();
    this.terminals = new Map();
    this.transactions = new Map();
    this.supportedProtocols = {
      101.1: "EMV Contact - Chip Card Read",
      101.2: "EMV Contact - PIN Verification",
      101.3: "EMV Contact - Online Authorization",
      201.1: "EMV Contactless - NFC Read",
      201.2: "EMV Contactless - Tap to Pay",
      201.3: "EMV Contactless - Mobile Wallet",
    };

    // Initialize terminal status
    this.terminalStatus = {
      online: true,
      protocols: Object.keys(this.supportedProtocols),
      lastHeartbeat: new Date(),
      transactionsToday: 0,
      activeTerminals: 0,
    };
  }

  /**
   * Initialize Payment Terminal
   */
  initializeTerminal(terminalId, config = {}) {
    const terminal = {
      id: terminalId,
      status: "active",
      protocols: this.supportedProtocols,
      config: {
        merchantId: config.merchantId || "MERCHANT_001",
        terminalType: config.terminalType || "INTEGRATED",
        enabledProtocols:
          config.enabledProtocols || Object.keys(this.supportedProtocols),
        maxAmount: config.maxAmount || 10000,
        currency: config.currency || "USD",
        ...config,
      },
      initialized: new Date(),
      lastActivity: new Date(),
    };

    this.terminals.set(terminalId, terminal);
    this.terminalStatus.activeTerminals = this.terminals.size;

    return {
      success: true,
      terminal,
      message: "Payment terminal initialized successfully",
    };
  }

  /**
   * Protocol 101.1: EMV Contact - Chip Card Read
   */
  async protocol_101_1_ChipCardRead(cardData) {
    try {
      // Simulate chip card reading
      const chipData = {
        protocol: "101.1",
        cardType: cardData.cardType || "CHIP",
        pan: this.maskCardNumber(cardData.cardNumber),
        cardholderName: cardData.cardholderName,
        expiryDate: cardData.expiryDate,
        chipData: {
          applicationId: this.generateAID(),
          cryptogram: this.generateCryptogram(),
          terminalVerificationResults: "8000000000",
          transactionStatusInformation: "0000",
        },
        readTimestamp: new Date().toISOString(),
      };

      return {
        success: true,
        protocol: "101.1",
        data: chipData,
        message: "Chip card read successfully",
      };
    } catch (error) {
      return {
        success: false,
        protocol: "101.1",
        error: error.message,
      };
    }
  }

  /**
   * Protocol 101.2: EMV Contact - PIN Verification
   */
  async protocol_101_2_PINVerification(cardData, pin) {
    try {
      // Simulate PIN verification
      const pinBlock = this.encryptPIN(pin, cardData.cardNumber);

      const verification = {
        protocol: "101.2",
        pinVerified: true, // In production, verify against card issuer
        pinBlock,
        verificationMethod: "ONLINE_PIN",
        pinTries: 1,
        maxPinTries: 3,
        cvmResults: "420300", // Cardholder Verification Method results
        timestamp: new Date().toISOString(),
      };

      return {
        success: true,
        protocol: "101.2",
        data: verification,
        message: "PIN verified successfully",
      };
    } catch (error) {
      return {
        success: false,
        protocol: "101.2",
        error: error.message,
      };
    }
  }

  /**
   * Protocol 101.3: EMV Contact - Online Authorization
   */
  async protocol_101_3_OnlineAuthorization(transactionData, persist = true) {
    try {
      // Simulate online authorization request
      const authRequest = {
        protocol: "101.3",
        transactionId: this.generateTransactionId(),
        amount: transactionData.amount,
        currency: transactionData.currency || "USD",
        merchantId: transactionData.merchantId,
        terminalId: transactionData.terminalId,
        userId: transactionData.userId,
        cardData: {
          pan: this.maskCardNumber(transactionData.cardNumber),
          expiryDate: transactionData.expiryDate,
        },
        authCode: this.generateAuthCode(),
        responseCode: "00", // Approved
        timestamp: new Date().toISOString(),
      };

      // Store transaction
      if (persist) {
        this.transactions.set(authRequest.transactionId, {
          ...authRequest,
          status: "authorized",
        });
        this.terminalStatus.transactionsToday++;
      }

      return {
        success: true,
        protocol: "101.3",
        data: authRequest,
        message: "Transaction authorized",
      };
    } catch (error) {
      return {
        success: false,
        protocol: "101.3",
        error: error.message,
      };
    }
  }

  /**
   * Protocol 201.1: EMV Contactless - NFC Read
   */
  async protocol_201_1_NFCRead(nfcData) {
    try {
      const contactlessData = {
        protocol: "201.1",
        cardType: "CONTACTLESS",
        technology: "NFC_TYPE_A",
        pan: this.maskCardNumber(nfcData.cardNumber),
        track2Data: this.generateTrack2Data(nfcData),
        applicationLabel: "VISA CREDIT",
        applicationPreferredName: nfcData.cardholderName,
        readTimestamp: new Date().toISOString(),
      };

      return {
        success: true,
        protocol: "201.1",
        data: contactlessData,
        message: "NFC card read successfully",
      };
    } catch (error) {
      return {
        success: false,
        protocol: "201.1",
        error: error.message,
      };
    }
  }

  /**
   * Protocol 201.2: EMV Contactless - Tap to Pay
   */
  async protocol_201_2_TapToPay(paymentData, persist = true) {
    try {
      // Simulate tap to pay transaction
      const tapTransaction = {
        protocol: "201.2",
        transactionId: this.generateTransactionId(),
        userId: paymentData.userId,
        amount: paymentData.amount,
        currency: paymentData.currency || "USD",
        cardData: {
          pan: this.maskCardNumber(paymentData.cardNumber),
          applicationCryptogram: this.generateCryptogram(),
          applicationTransactionCounter: this.generateATC(),
        },
        contactlessIndicator: "TAP",
        cvmPerformed: paymentData.amount > 50 ? "SIGNATURE" : "NO_CVM",
        authCode: this.generateAuthCode(),
        responseCode: "00",
        timestamp: new Date().toISOString(),
      };

      if (persist) {
        this.transactions.set(tapTransaction.transactionId, {
          ...tapTransaction,
          status: "completed",
        });
        this.terminalStatus.transactionsToday++;
      }

      return {
        success: true,
        protocol: "201.2",
        data: tapTransaction,
        message: "Tap to pay transaction completed",
      };
    } catch (error) {
      return {
        success: false,
        protocol: "201.2",
        error: error.message,
      };
    }
  }

  /**
   * Protocol 201.3: EMV Contactless - Mobile Wallet
   */
  async protocol_201_3_MobileWallet(walletData, persist = true) {
    try {
      // Simulate mobile wallet payment (Apple Pay, Google Pay, Samsung Pay)
      const mobileWalletTransaction = {
        protocol: "201.3",
        transactionId: this.generateTransactionId(),
        userId: walletData.userId,
        walletType: walletData.walletType || "APPLE_PAY",
        amount: walletData.amount,
        currency: walletData.currency || "USD",
        tokenData: {
          dpan: this.generateDPAN(), // Device Primary Account Number
          cryptogram: this.generateCryptogram(),
          eci: "07", // Electronic Commerce Indicator
        },
        biometricAuth: walletData.biometricAuth || true,
        authCode: this.generateAuthCode(),
        responseCode: "00",
        timestamp: new Date().toISOString(),
      };

      if (persist) {
        this.transactions.set(mobileWalletTransaction.transactionId, {
          ...mobileWalletTransaction,
          status: "completed",
        });
        this.terminalStatus.transactionsToday++;
      }

      return {
        success: true,
        protocol: "201.3",
        data: mobileWalletTransaction,
        message: `${walletData.walletType} payment completed`,
      };
    } catch (error) {
      return {
        success: false,
        protocol: "201.3",
        error: error.message,
      };
    }
  }

  /**
   * Process Card Payment (Auto-detect protocol)
   */
  async processPayment(paymentData) {
    try {
      const {
        cardNumber,
        expiryDate,
        cvv,
        cardholderName,
        amount,
        currency,
        paymentMethod,
        pin,
      } = paymentData;

      // Validate card data
      if (!this.validateCard(cardNumber, expiryDate, cvv)) {
        throw new Error("Invalid card data");
      }
      if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
        throw new Error("Invalid payment amount");
      }

      const terminal = this.terminals.get(paymentData.terminalId);
      const maxAmount = Number(terminal?.config?.maxAmount || 10000);
      if (Number(amount) > maxAmount) {
        throw new Error(
          `Payment amount exceeds terminal limit of ${maxAmount}`,
        );
      }

      if (!this.terminals.has(paymentData.terminalId)) {
        throw new Error("Payment terminal is not initialized");
      }

      const enabledProtocols = terminal.config.enabledProtocols || [];
      const requiredProtocol = {
        CHIP: "101.3",
        CONTACTLESS: "201.2",
        MOBILE_WALLET: "201.3",
        MANUAL: "101.3",
      }[paymentMethod || "MANUAL"];
      if (!enabledProtocols.includes(requiredProtocol)) {
        throw new Error(
          `Protocol ${requiredProtocol} is not enabled for this terminal`,
        );
      }

      let result;

      // Determine protocol based on payment method
      switch (paymentMethod) {
        case "CHIP": {
          // Use protocols 101.1, 101.2, 101.3
          await this.protocol_101_1_ChipCardRead({
            cardNumber,
            cardholderName,
            expiryDate,
          });
          if (pin) {
            const pinVerify = await this.protocol_101_2_PINVerification(
              { cardNumber },
              pin,
            );
            if (!pinVerify.success) throw new Error("PIN verification failed");
          }
          result = await this.protocol_101_3_OnlineAuthorization({
            cardNumber,
            expiryDate,
            amount,
            currency,
            merchantId: "MERCHANT_001",
            terminalId:
              paymentData.terminalId || `TERMINAL_${paymentData.userId}`,
            userId: paymentData.userId,
          });
          break;
        }

        case "CONTACTLESS":
          // Use protocol 201.2
          result = await this.protocol_201_2_TapToPay({
            cardNumber,
            amount,
            currency,
            userId: paymentData.userId,
          });
          break;

        case "MOBILE_WALLET":
          // Use protocol 201.3
          result = await this.protocol_201_3_MobileWallet({
            walletType: paymentData.walletType || "APPLE_PAY",
            amount,
            currency,
            userId: paymentData.userId,
          });
          break;

        case "MANUAL":
        default:
          // Manual entry - use online authorization
          result = await this.protocol_101_3_OnlineAuthorization({
            cardNumber,
            expiryDate,
            amount,
            currency,
            merchantId: "MERCHANT_001",
            terminalId:
              paymentData.terminalId || `TERMINAL_${paymentData.userId}`,
            userId: paymentData.userId,
          });
          break;
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get Transaction Details
   */
  getTransaction(transactionId, userId) {
    const transaction = this.transactions.get(transactionId);
    if (!transaction || (userId && transaction.userId !== userId)) {
      return null;
    }
    return transaction;
  }

  /**
   * Get All Transactions
   */
  getAllTransactions(userId) {
    const allTransactions = Array.from(this.transactions.values());
    return allTransactions.filter((t) => !userId || t.userId === userId);
  }

  /**
   * Get Terminal Status
   */
  getTerminalStatus() {
    return {
      ...this.terminalStatus,
      lastHeartbeat: new Date(),
    };
  }

  /**
   * Get Supported Protocols
   */
  getSupportedProtocols() {
    return this.supportedProtocols;
  }

  /**
   * Refund Transaction
   */
  async refundTransaction(transactionId, amount, userId) {
    const transaction = this.getTransaction(transactionId, userId);
    if (!transaction) {
      throw new Error("Transaction not found");
    }

    const refund = {
      refundId: this.generateTransactionId(),
      originalTransactionId: transactionId,
      amount: amount || transaction.amount,
      currency: transaction.currency,
      status: "refunded",
      timestamp: new Date().toISOString(),
    };

    transaction.refund = refund;
    transaction.status = "refunded";

    return {
      success: true,
      refund,
      message: "Refund processed successfully",
    };
  }

  // Helper Methods

  validateCard(cardNumber, expiryDate, cvv) {
    const sanitized = String(cardNumber || "").replace(/\s/g, "");
    if (!/^\d{13,19}$/.test(sanitized)) return false;
    if (!/^\d{3,4}$/.test(String(cvv || ""))) return false;

    const expiryMatch = String(expiryDate || "").match(
      /^(0[1-9]|1[0-2])\/(\d{2})$/,
    );
    if (!expiryMatch) return false;
    const expiryMonth = Number(expiryMatch[1]);
    const expiryYear = 2000 + Number(expiryMatch[2]);
    const now = new Date();
    if (
      expiryYear < now.getFullYear() ||
      (expiryYear === now.getFullYear() && expiryMonth < now.getMonth() + 1)
    ) {
      return false;
    }

    let sum = 0;
    let isEven = false;
    for (let i = sanitized.length - 1; i >= 0; i--) {
      let digit = parseInt(sanitized[i]);
      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  maskCardNumber(cardNumber) {
    const cleaned = cardNumber.replace(/\s/g, "");
    return `${cleaned.slice(0, 6)}${"*".repeat(cleaned.length - 10)}${cleaned.slice(-4)}`;
  }

  generateTransactionId() {
    return `TXN${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }

  generateAuthCode() {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
  }

  generateAID() {
    return `A0000000${Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0")}`;
  }

  generateCryptogram() {
    return crypto.randomBytes(8).toString("hex").toUpperCase();
  }

  generateATC() {
    return Math.floor(Math.random() * 65535)
      .toString(16)
      .toUpperCase()
      .padStart(4, "0");
  }

  generateDPAN() {
    const prefix = "5123";
    const suffix = "4567";
    const middle = Math.floor(Math.random() * 100000000)
      .toString()
      .padStart(8, "0");
    return `${prefix}${middle}${suffix}`;
  }

  generateTrack2Data(cardData) {
    const pan = this.maskCardNumber(cardData.cardNumber);
    const expiry = cardData.expiryDate.replace(/\//g, "");
    return `${pan}=${expiry}101${"0".repeat(10)}`;
  }

  encryptPIN(pin, pan) {
    // Simplified PIN block encryption (use proper HSM in production)
    const pinBlock = `0${pin.length}${pin}${"F".repeat(14 - pin.length - 1)}`;
    return crypto
      .createHash("sha256")
      .update(pinBlock + pan)
      .digest("hex")
      .substr(0, 16)
      .toUpperCase();
  }
}

module.exports = PaymentTerminalService;
