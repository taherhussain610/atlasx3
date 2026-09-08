const DEFAULT_AI_URL = "https://api.openai.com/v1/chat/completions";
const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 12;

class AssistantService {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.AI_API_KEY || "";
    this.apiUrl = options.apiUrl || process.env.AI_API_URL || DEFAULT_AI_URL;
    this.model = options.model || process.env.AI_MODEL || "gpt-4o-mini";
  }

  getStatus() {
    return {
      configured: Boolean(this.apiKey),
      provider: process.env.AI_PROVIDER || "openai-compatible",
      model: this.model,
    };
  }

  normalizeMessages(messages) {
    if (!Array.isArray(messages)) {
      throw new Error("messages must be an array");
    }

    return messages
      .slice(-MAX_HISTORY_MESSAGES)
      .filter((message) => message && ["user", "assistant"].includes(message.role))
      .map((message) => ({
        role: message.role,
        content: String(message.content || "")
          .trim()
          .slice(0, MAX_MESSAGE_LENGTH),
      }))
      .filter((message) => message.content);
  }

  buildSystemPrompt(context) {
    return [
      "You are the ATLASX3 exchange assistant.",
      "Give concise, factual help about wallets, markets, orders, margin, P2P, swaps, demo trading, and platform navigation.",
      "You may summarize the supplied account context, but never invent balances, prices, transactions, or blockchain confirmations.",
      "Never request or expose passwords, private keys, seed phrases, API keys, or card security data.",
      "Never place, cancel, or modify trades. Explain that the user must use the platform controls for actions.",
      `Authenticated account context: ${JSON.stringify(context)}`,
    ].join(" ");
  }

  getLocalReply(message, context) {
    const normalized = message.toLowerCase();
    if (/balance|portfolio|funds|wallet/.test(normalized)) {
      const balances = Object.entries(context.balances || {})
        .map(([currency, balance]) => `${currency}: ${balance}`)
        .join(", ");
      return `Your current ATLASX3 account balances are ${balances || "not available"}. I can explain deposits, withdrawals, and wallet linking, but I cannot move funds for you.`;
    }
    if (/margin|leverage|liquidat/.test(normalized)) {
      return "Margin trading uses collateral and leverage, which can liquidate a position when losses reach the maintenance threshold. Review leverage, stop-loss, take-profit, and liquidation price before opening a position.";
    }
    if (/buy|sell|order|trade|spot/.test(normalized)) {
      return "Use the Trading tab to preview a quote, set slippage, review the route, and submit an order. I can help explain the fields, but I do not execute trades.";
    }
    if (/trc.?20|usdt|erc.?1155/.test(normalized)) {
      return "ATLASX3 includes TRON and ERC-1155 tooling. The ATLASX3 USDT ERC-1155 representation is configured with a 50,000,000 supply and a reference value of $1 per token. Native TRC-20 transfers require a deployed TRON contract address.";
    }
    return "I can help with ATLASX3 wallet balances, blockchain integrations, market quotes, trading orders, margin risk, P2P, swaps, demo trading, and dashboard navigation. Ask about one of those areas.";
  }

  async reply(messages, context = {}) {
    const normalizedMessages = this.normalizeMessages(messages);
    const latest = normalizedMessages.at(-1);
    if (!latest) {
      throw new Error("At least one message is required");
    }

    if (!this.apiKey) {
      return { message: this.getLocalReply(latest.content, context), source: "local" };
    }

    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        max_tokens: 500,
        messages: [
          { role: "system", content: this.buildSystemPrompt(context) },
          ...normalizedMessages,
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error?.message || `AI provider returned HTTP ${response.status}`);
    }

    const message = payload.choices?.[0]?.message?.content?.trim();
    if (!message) {
      throw new Error("AI provider returned an empty response");
    }
    return { message, source: "provider" };
  }
}

module.exports = AssistantService;
