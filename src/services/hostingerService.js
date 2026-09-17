/**
 * Hostinger API Service
 * Integration with the Hostinger public API for VPS, domain and DNS management
 * Docs: https://developer.hostinger.com
 */

const axios = require("axios");

class HostingerService {
  constructor() {
    this.apiKey = process.env.HOSTINGER_API_KEY || "";
    this.baseUrl = process.env.HOSTINGER_API_URL || "https://developers.hostinger.com";
    this.configured = Boolean(this.apiKey);

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });

    console.log("✅ Hostinger Service initialized" + (this.configured ? "" : " (not configured)"));
  }

  handleError(context, error) {
    console.error(`Hostinger API Error (${context}):`, error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      status: error.response?.status,
    };
  }

  requireConfig() {
    if (!this.configured) {
      return {
        success: false,
        configured: false,
        error: "Set HOSTINGER_API_KEY to enable Hostinger integration",
      };
    }
    return null;
  }

  /**
   * Check API connection status
   */
  async checkConnection() {
    const notConfigured = this.requireConfig();
    if (notConfigured) {
      return { ...notConfigured, success: true, connected: false };
    }

    try {
      await this.client.get("/api/domains/v1/portfolio");
      return { success: true, connected: true, configured: true, message: "Hostinger API connected" };
    } catch (error) {
      return { ...this.handleError("Connection Check", error), connected: false, configured: true };
    }
  }

  // ─── Domains ────────────────────────────────────────────────────────────────

  /**
   * List all domains in the account portfolio
   */
  async listDomains() {
    const notConfigured = this.requireConfig();
    if (notConfigured) return notConfigured;

    try {
      const response = await this.client.get("/api/domains/v1/portfolio");
      return { success: true, data: response.data };
    } catch (error) {
      return this.handleError("List Domains", error);
    }
  }

  // ─── DNS ────────────────────────────────────────────────────────────────────

  /**
   * Get DNS records for a domain
   */
  async getDnsRecords(domain) {
    const notConfigured = this.requireConfig();
    if (notConfigured) return notConfigured;

    try {
      const response = await this.client.get(`/api/dns/v1/zones/${encodeURIComponent(domain)}`);
      return { success: true, data: response.data };
    } catch (error) {
      return this.handleError("Get DNS Records", error);
    }
  }

  /**
   * Update DNS records for a domain
   * @param {string} domain
   * @param {Array} zone - records, e.g. [{ name, type, ttl, records: [{ content }] }]
   * @param {boolean} overwrite - replace matching records instead of appending
   */
  async updateDnsRecords(domain, zone, overwrite = true) {
    const notConfigured = this.requireConfig();
    if (notConfigured) return notConfigured;

    try {
      const response = await this.client.put(
        `/api/dns/v1/zones/${encodeURIComponent(domain)}`,
        { overwrite, zone }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return this.handleError("Update DNS Records", error);
    }
  }

  // ─── VPS ────────────────────────────────────────────────────────────────────

  /**
   * List all virtual machines
   */
  async listVirtualMachines() {
    const notConfigured = this.requireConfig();
    if (notConfigured) return notConfigured;

    try {
      const response = await this.client.get("/api/vps/v1/virtual-machines");
      return { success: true, data: response.data };
    } catch (error) {
      return this.handleError("List VPS", error);
    }
  }

  /**
   * Get a single virtual machine
   */
  async getVirtualMachine(vmId) {
    const notConfigured = this.requireConfig();
    if (notConfigured) return notConfigured;

    try {
      const response = await this.client.get(`/api/vps/v1/virtual-machines/${vmId}`);
      return { success: true, data: response.data };
    } catch (error) {
      return this.handleError("Get VPS", error);
    }
  }

  /**
   * Start / stop / restart a virtual machine
   * @param {string|number} vmId
   * @param {"start"|"stop"|"restart"} action
   */
  async setVirtualMachineState(vmId, action) {
    const notConfigured = this.requireConfig();
    if (notConfigured) return notConfigured;

    if (!["start", "stop", "restart"].includes(action)) {
      return { success: false, error: `Invalid VPS action: ${action}` };
    }

    try {
      const response = await this.client.post(`/api/vps/v1/virtual-machines/${vmId}/${action}`);
      return { success: true, data: response.data };
    } catch (error) {
      return this.handleError(`VPS ${action}`, error);
    }
  }

  // ─── Billing ────────────────────────────────────────────────────────────────

  /**
   * List active subscriptions
   */
  async listSubscriptions() {
    const notConfigured = this.requireConfig();
    if (notConfigured) return notConfigured;

    try {
      const response = await this.client.get("/api/billing/v1/subscriptions");
      return { success: true, data: response.data };
    } catch (error) {
      return this.handleError("List Subscriptions", error);
    }
  }
}

module.exports = HostingerService;
