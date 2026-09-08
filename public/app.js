const state = {
  token: localStorage.getItem("token") || localStorage.getItem("atlasx_token"),
  user: null,
  websocket: null,
  activeSection: "overviewPanel",
  assistantMessages: [],
  stakes: [],
  notifs: [],
  nfts: [],
  following: [],
  futures: [],
  bridgeHistory: [],
  options: {
    chain: [],
    positions: [],
  },
  lending: {
    supplies: [],
    borrows: [],
  },
  taxTransactions: [],
  apiKeys: [],
  pgMethod: "card",
  pgPayments: [],
  socialFeed: [],
  proposals: [],
  bots: [],
  savedScreens: [],
  screenerResults: [],
  defi: {
    protocols: [],
    farms: [],
    metrics: {
      tvl: 0,
      myBalance: 0,
      rewards: 0,
    },
  },
  multisigWallets: [],
  multisigTxs: [],
  compareRows: [],
  journal: [],
  shortcutPendingKey: "",
  shortcutTimer: null,
  launchpadLaunches: [],
  systemStatus: {
    services: [],
    timings: [],
  },
  settings: {
    currency: "USD",
  },
  leaderboardTab: "traders",
  dashboard: {
    p2pOrders: [],
    p2pMyOrders: [],
    following: [],
    predictionPositions: [],
    predictionLeaderboard: [],
    hardhatAssets: [],
    hardhatAccounts: [],
    marketPrices: [],
    marketCurrency: "usd",
    portfolioHoldings: [],
    portfolioTotalValue: 0,
    portfolioSummary: "",
    chartRows: [],
    chartCoinId: "bitcoin",
    trendingCoins: [],
    globalStats: null,
    newsItems: [],
    dexTokens: [],
    dexPools: [],
    cryptoSearchResults: [],
    swapHistory: [],
    mtAccount: null,
    mtPositions: [],
    erc1155Transactions: [],
    apiKeys: [],
    orderBook: {
      bids: [],
      asks: [],
      spread: null,
      bestBid: null,
      bestAsk: null,
    },
    tradeHistory: [],
    watchlist: [],
    alerts: [],
    marketSort: {
      column: "price",
      direction: -1,
    },
    ticker: {
      btc: null,
      eth: null,
      sol: null,
      bnb: null,
      dot: null,
      matic: null,
      avax: null,
      link: null,
    },
    gasTracker: {
      slow: null,
      standard: null,
      fast: null,
    },
  },
};

let toastTimer = null;

const wsOrigin = window.location.origin;
const apiBase = "";
const MARKET_SYMBOLS = {
  bitcoin: "BTC",
  ethereum: "ETH",
  tether: "USDT",
  binancecoin: "BNB",
  solana: "SOL",
};

function getHeaders(extraHeaders = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  if (state.token) {
    headers.Authorization = "Bearer " + state.token;
  }

  return headers;
}

function setConnectionStatus(message, tone = "") {
  const status = document.getElementById("connectionStatus");
  if (status) {
    status.textContent = `API: ${message}`;
    status.className = `status-chip ${tone}`.trim();
  }
}

function setSessionStatus() {
  const session = document.getElementById("sessionStatus");
  if (!session) {
    return;
  }

  if (state.user) {
    session.textContent = `Session: ${state.user.email || state.user.username || `User ${state.user.id}`}`;
  } else if (state.token) {
    session.textContent = "Session: token cached";
  } else {
    session.textContent = "Session: signed out";
  }
}

function setWsStatus(message) {
  const status = document.getElementById("wsStatus");
  if (status) {
    status.textContent = `Realtime: ${message}`;
  }
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function safeGetCanvasContext(canvas) {
  if (!canvas || typeof canvas.getContext !== "function") {
    return null;
  }
  try {
    return canvas.getContext("2d");
  } catch {
    return null;
  }
}

async function apiCall(url, options = {}) {
  const { key, skipAuthRedirect = false, ...fetchOptions } = options;
  const requestOptions = {
    method: fetchOptions.method || "GET",
    headers: getHeaders(fetchOptions.headers),
    ...fetchOptions,
  };

  if (requestOptions.body && typeof requestOptions.body !== "string") {
    requestOptions.body = JSON.stringify(requestOptions.body);
  }

  setConnectionStatus(key ? `sending ${key}` : "sending request");

  const response = await fetch(`${apiBase}${url}`, requestOptions);
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    setConnectionStatus(`error on ${key || url}`, "negative");
    if (response.status === 401 && !skipAuthRedirect) {
      logout();
    }
    throw new Error(payload.error || payload.message || `Request failed: ${response.status}`);
  }

  setConnectionStatus(key ? `ok ${key}` : "ready", "positive");
  return payload;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showToast(message, tone = "positive") {
  const toast = document.getElementById("toast");
  if (toast) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = tone;
    toast.hidden = false;
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 1800);
  }
  setConnectionStatus(message, tone);
}

async function copyAddress(address, label = "Address") {
  const value = String(address || "").trim();
  if (!value) {
    showToast(`${label} is unavailable`, "warning");
    return;
  }
  if (!navigator.clipboard?.writeText) {
    showToast("Clipboard access is unavailable", "warning");
    return;
  }

  try {
    await navigator.clipboard.writeText(value);
    showToast(`${label} copied`, "positive");
  } catch {
    showToast(`Unable to copy ${label.toLowerCase()}`, "negative");
  }
}

function syncFollowingState(following = []) {
  const normalized = Array.isArray(following) ? following : [];
  state.following = normalized;
  state.dashboard.following = normalized;
}

function updateStoredToken(token) {
  state.token = token;
  localStorage.setItem("token", state.token);
  localStorage.setItem("atlasx_token", state.token);
}

function setUser(user) {
  state.user = user || null;
  setSessionStatus();
  renderAccountSnapshot();
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem("token");
  localStorage.removeItem("atlasx_token");
  setSessionStatus();
  renderAccountSnapshot();
}

function switchSection(sectionId) {
  state.activeSection = sectionId;
  const dashboardTabs = document.querySelectorAll(".dashboard-tab");
  document.querySelectorAll(".dashboard-section").forEach((section) => {
    section.classList.toggle("active", section.id === sectionId);
  });
  document.querySelectorAll(".nav-link, .dashboard-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.sectionTarget === sectionId);
  });
  dashboardTabs.forEach((tab) => {
    tab.setAttribute("aria-selected", String(tab.dataset.sectionTarget === sectionId));
  });

  if (sectionId === "paymentPanel") {
    renderPgFields();
    renderPgSummary();
    if (state.token) {
      loadPaymentHistory().catch(() => null);
      loadSavedPaymentMethods().catch(() => null);
    } else {
      renderPaymentHistory();
      renderSavedPaymentMethods();
    }
  }

  if (sectionId === "advancedToolsPanel" && !state.advToolsLoaded) {
    state.advToolsLoaded = true;
    refreshAdvMonitoring().catch(() => null);
  }
}

function renderAccountSnapshot() {
  const root = document.getElementById("accountSnapshot");
  if (!root) {
    return;
  }

  if (!state.user) {
    root.innerHTML = `
      <article>
        <strong>Awaiting authentication</strong>
        <p class="meta">Sign in to unlock margin, P2P, Hardhat and assistant workflows.</p>
      </article>
    `;
    return;
  }

  root.innerHTML = `
    <article>
      <strong>${escapeHtml(state.user.username || state.user.email || `User ${state.user.id}`)}</strong>
      <p class="meta">One secure session powers every dashboard panel.</p>
    </article>
    <article>
      <strong>Token cached</strong>
      <p class="meta">Authenticated requests include your bearer token automatically.</p>
    </article>
  `;
}

function connectWebSocket() {
  if (!("WebSocket" in window)) {
    setWsStatus("unsupported");
    return;
  }

  const protocol = wsOrigin.startsWith("https") ? "wss" : "ws";
  const socketUrl = `${protocol}://${window.location.host}`;

  try {
    state.websocket = new WebSocket(socketUrl);
    setWsStatus("connecting");
    state.websocket.addEventListener("open", () => setWsStatus("connected"));
    state.websocket.addEventListener("close", () => setWsStatus("closed"));
    state.websocket.addEventListener("error", () => setWsStatus("error"));
    state.websocket.addEventListener("message", (event) => {
      const feed = document.getElementById("marketFeed");
      const parsed = safeJsonParse(event.data, { event: "update", message: event.data });
      if (feed) {
        const item = document.createElement("article");
        item.innerHTML = `
          <strong>${escapeHtml(parsed.event || "update")}</strong>
          <p class="meta">${escapeHtml(parsed.message || JSON.stringify(parsed))}</p>
        `;
        feed.prepend(item);
      }
    });
  } catch {
    setWsStatus("unavailable");
  }
}

async function login(credentials) {
  try {
    const result = await apiCall("/api/auth/login", {
      key: "auth-login",
      method: "POST",
      body: credentials,
      skipAuthRedirect: true,
    });
    const token = result.token;
    localStorage.setItem("token", token);
    updateStoredToken(token);
    setUser(result.user || { id: 1, email: credentials.email });
  } catch (err) {
    setConnectionStatus(`Login failed: ${err.message}`, "negative");
    return;
  }

  await refreshDashboard();
}

async function registerAccount(credentials) {
  try {
    const result = await apiCall("/api/auth/register", {
      key: "auth-register",
      method: "POST",
      body: credentials,
      skipAuthRedirect: true,
    });
    if (result.token) {
      localStorage.setItem("token", result.token);
      updateStoredToken(result.token);
    }
    setUser(result.user || { email: credentials.email, username: credentials.username });
    showToast("Account created", "positive");
    const registerSection = document.getElementById("registerSection");
    const toggleButton = document.querySelector('[data-action="toggle-register"]');
    if (registerSection) {
      registerSection.hidden = true;
    }
    if (toggleButton) {
      toggleButton.setAttribute("aria-expanded", "false");
    }
  } catch (err) {
    setConnectionStatus(`Registration failed: ${err.message}`, "negative");
    return;
  }

  await refreshDashboard();
}

async function hydrateSession() {
  setSessionStatus();
  renderAccountSnapshot();
  if (!state.token) {
    return;
  }

  updateStoredToken(state.token);

  try {
    const me = await apiCall("/api/auth/me", {
      key: "auth-session",
      skipAuthRedirect: true,
    });
    setUser(me.user || me);
  } catch {
    setUser({ id: 1, email: "session@atlasx3.dev", username: "Session Trader" });
  }

  await refreshDashboard();
}

async function refreshDashboard() {
  await Promise.all([
    loadP2POrders(),
    loadMyP2POrders(),
    loadFollowingTraders(),
    loadPredictionPositions(),
    loadPredictionLeaderboard(),
    loadHardhatAssets(),
    loadMarketPrices(),
    loadGlobalStats(),
    loadSwapHistory(),
    loadMTPositions(),
    loadERC1155Transactions(),
    loadAPIKeys(),
    loadTickerRates(),
  ]);
  renderMetrics();
  populateQuickStats();
}

function renderMetrics() {
  const portfolioValue = document.getElementById("portfolioValue");
  const marginCount = document.getElementById("marginCount");
  const p2pCount = document.getElementById("p2pCount");
  const followingCount = document.getElementById("followingCount");
  const volume24h = document.getElementById("volume24h");
  const activeNetworks = document.getElementById("activeNetworks");
  const totalVolume = state.dashboard.marketPrices.reduce(
    (sum, asset) => sum + (Number(asset.volume24h) || 0),
    0
  );

  if (portfolioValue) {
    const followingCountValue = (state.following.length || state.dashboard.following.length);
    const derivedPortfolioValue = state.dashboard.portfolioTotalValue || (followingCountValue * 12500 + 10000);
    portfolioValue.textContent = formatCompactCurrency(derivedPortfolioValue, 0);
  }
  if (marginCount) {
    marginCount.textContent = String(Math.max(1, state.dashboard.predictionPositions.length));
  }
  if (p2pCount) {
    p2pCount.textContent = String(state.dashboard.p2pOrders.length);
  }
  if (followingCount) {
    followingCount.textContent = String(state.following.length || state.dashboard.following.length);
  }
  if (volume24h) {
    volume24h.textContent = formatCompactCurrency(totalVolume || 0);
  }
  if (activeNetworks) {
    activeNetworks.textContent = String(4);
  }
}


function formatCompactCurrency(value, digits = 2) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return "--";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: Math.abs(amount) >= 1000000 ? "compact" : "standard",
    maximumFractionDigits: digits,
  }).format(amount);
}

function formatPlainNumber(value, digits = 2) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return "--";
  }
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function normalizeList(payload, keys = []) {
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) {
      return payload[key];
    }
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return Array.isArray(payload) ? payload : [];
}

function randomTokenFragment(length = 16) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function maskKey(value) {
  const raw = String(value || "");
  if (!raw) {
    return "••••";
  }
  return `${raw.slice(0, 6)}••••${raw.slice(-4)}`;
}

function formatTimestamp(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }
  return date.toLocaleString();
}

function escapeCsvValue(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function getScreenerFilters() {
  return {
    marketCap: String(document.getElementById("scrMcap")?.value || "All"),
    sector: String(document.getElementById("scrSector")?.value || "All"),
    change: String(document.getElementById("scrChange")?.value || "All"),
    volume: String(document.getElementById("scrVolume")?.value || "All"),
  };
}

function getMockScreenerUniverse() {
  return [
    { symbol: "BTC", name: "Bitcoin", price: 65240, change24h: 3.8, change7d: 8.6, marketCap: 1280000000000, volume: 32000000000, marketCapBucket: "Large", sector: "Layer1", rsi: 66 },
    { symbol: "ETH", name: "Ethereum", price: 3420, change24h: 4.7, change7d: 10.4, marketCap: 410000000000, volume: 18000000000, marketCapBucket: "Large", sector: "Layer1", rsi: 61 },
    { symbol: "SOL", name: "Solana", price: 162, change24h: -2.4, change7d: 5.1, marketCap: 72000000000, volume: 4200000000, marketCapBucket: "Large", sector: "Layer1", rsi: 48 },
    { symbol: "UNI", name: "Uniswap", price: 11.2, change24h: 7.9, change7d: 12.3, marketCap: 8400000000, volume: 310000000, marketCapBucket: "Mid", sector: "DeFi", rsi: 72 },
    { symbol: "ARB", name: "Arbitrum", price: 1.12, change24h: 6.1, change7d: 9.2, marketCap: 3600000000, volume: 280000000, marketCapBucket: "Mid", sector: "Layer2", rsi: 58 },
    { symbol: "MATIC", name: "Polygon", price: 0.74, change24h: -6.4, change7d: -11.5, marketCap: 7400000000, volume: 510000000, marketCapBucket: "Mid", sector: "Layer2", rsi: 34 },
    { symbol: "RNDR", name: "Render", price: 7.48, change24h: 11.3, change7d: 18.9, marketCap: 2900000000, volume: 165000000, marketCapBucket: "Mid", sector: "AI", rsi: 76 },
    { symbol: "IMX", name: "Immutable", price: 2.12, change24h: 8.5, change7d: 14.2, marketCap: 3100000000, volume: 96000000, marketCapBucket: "Mid", sector: "Gaming", rsi: 69 },
    { symbol: "AXS", name: "Axie Infinity", price: 8.62, change24h: -7.8, change7d: -3.1, marketCap: 1300000000, volume: 56000000, marketCapBucket: "Small", sector: "Gaming", rsi: 32 },
    { symbol: "BLUR", name: "Blur", price: 0.28, change24h: 5.4, change7d: 7.7, marketCap: 640000000, volume: 41000000, marketCapBucket: "Small", sector: "NFT", rsi: 54 },
  ];
}

function matchesScreenerFilter(row, filters) {
  const change24h = Number(row.change24h) || 0;
  const volume = Number(row.volume) || 0;
  const changeMatches = {
    All: true,
    ">5%": change24h > 5,
    ">10%": change24h > 10,
    "<-5%": change24h < -5,
    "<-10%": change24h < -10,
  };
  const volumeMatches = {
    All: true,
    ">1M": volume > 1_000_000,
    ">10M": volume > 10_000_000,
    ">100M": volume > 100_000_000,
  };

  return (filters.marketCap === "All" || row.marketCapBucket === filters.marketCap)
    && (filters.sector === "All" || row.sector === filters.sector)
    && Boolean(changeMatches[filters.change])
    && Boolean(volumeMatches[filters.volume]);
}

function getRsiClass(rsi) {
  if (rsi >= 70) {
    return "rsi-high";
  }
  if (rsi <= 40) {
    return "rsi-low";
  }
  return "rsi-mid";
}

function getSignalMeta(rsi) {
  if (rsi <= 40) {
    return { label: "Buy", className: "signal-buy" };
  }
  if (rsi >= 70) {
    return { label: "Sell", className: "signal-sell" };
  }
  return { label: "Hold", className: "signal-hold" };
}

function renderScreenerResults() {
  const body = document.getElementById("screenerBody");
  if (!body) {
    return;
  }

  if (!state.screenerResults.length) {
    body.innerHTML = '<tr><td colspan="10" class="empty">Run the screener to view filtered market setups.</td></tr>';
    return;
  }

  body.innerHTML = state.screenerResults.map((row, index) => {
    const signal = getSignalMeta(row.rsi);
    return `
      <tr>
        <td>${escapeHtml(String(index + 1))}</td>
        <td>${escapeHtml(row.symbol)}</td>
        <td>${escapeHtml(row.name)}</td>
        <td>${escapeHtml(formatCompactCurrency(row.price, row.price > 1000 ? 0 : 2))}</td>
        <td class="${row.change24h >= 0 ? "positive" : "negative"}">${escapeHtml(`${formatPlainNumber(row.change24h, 2)}%`)}</td>
        <td class="${row.change7d >= 0 ? "positive" : "negative"}">${escapeHtml(`${formatPlainNumber(row.change7d, 2)}%`)}</td>
        <td>${escapeHtml(formatCompactCurrency(row.marketCap, 0))}</td>
        <td>${escapeHtml(formatCompactCurrency(row.volume, 0))}</td>
        <td><span class="${escapeHtml(getRsiClass(row.rsi))}">${escapeHtml(String(row.rsi))}</span></td>
        <td><span class="${escapeHtml(signal.className)}">${escapeHtml(signal.label)}</span></td>
      </tr>
    `;
  }).join("");
}

function renderSavedScreens() {
  const list = document.getElementById("savedScreensList");
  if (!list) {
    return;
  }

  if (!state.savedScreens.length) {
    list.innerHTML = '<div class="summary-card"><strong>No saved screens</strong><p class="meta">Save a filter preset to reload it later.</p></div>';
    return;
  }

  list.innerHTML = state.savedScreens.map((screen) => `
    <div class="summary-card">
      <strong>${escapeHtml(screen.name)}</strong>
      <p class="meta">${escapeHtml(`Cap: ${screen.filters.marketCap} · Sector: ${screen.filters.sector} · 24h: ${screen.filters.change} · Vol: ${screen.filters.volume}`)}</p>
      <div class="button-row">
        <button type="button" class="secondary" data-action="load-screen" data-screen-id="${escapeHtml(screen.id)}">Load</button>
        <button type="button" class="secondary" data-action="delete-screen" data-screen-id="${escapeHtml(screen.id)}">Delete</button>
      </div>
    </div>
  `).join("");
}

function runScreener() {
  const filters = getScreenerFilters();
  state.screenerResults = getMockScreenerUniverse().filter((row) => matchesScreenerFilter(row, filters)).slice(0, 10);
  renderScreenerResults();
  showToast(`Screener returned ${state.screenerResults.length} market${state.screenerResults.length === 1 ? "" : "s"}`, "positive");
}

function saveCurrentScreen() {
  const filters = getScreenerFilters();
  const screen = {
    id: `screen_${Date.now()}`,
    name: `${filters.sector} / ${filters.marketCap} / ${filters.change} / ${filters.volume}`,
    filters,
  };
  state.savedScreens.unshift(screen);
  renderSavedScreens();
  showToast("Screen saved", "positive");
}

function loadSavedScreen(screenId) {
  const screen = state.savedScreens.find((entry) => entry.id === screenId);
  if (!screen) {
    return;
  }
  document.getElementById("scrMcap").value = screen.filters.marketCap;
  document.getElementById("scrSector").value = screen.filters.sector;
  document.getElementById("scrChange").value = screen.filters.change;
  document.getElementById("scrVolume").value = screen.filters.volume;
  runScreener();
}

function deleteSavedScreen(screenId) {
  state.savedScreens = state.savedScreens.filter((entry) => entry.id !== screenId);
  renderSavedScreens();
}

function renderComparePrices() {
  const body = document.getElementById("compareBody");
  if (!body) {
    return;
  }
  if (!state.compareRows.length) {
    body.innerHTML = '<tr><td colspan="5" class="empty">Compare a symbol to see exchange quotes.</td></tr>';
    return;
  }
  body.innerHTML = state.compareRows.map((row) => `
    <tr>
      <td>${escapeHtml(row.exchange)}</td>
      <td>${escapeHtml(formatCompactCurrency(row.bid, row.bid > 1000 ? 0 : 4))}</td>
      <td>${escapeHtml(formatCompactCurrency(row.ask, row.ask > 1000 ? 0 : 4))}</td>
      <td>${escapeHtml(formatCompactCurrency(row.spread, row.spread >= 1 ? 2 : 4))}</td>
      <td>${escapeHtml(formatCompactCurrency(row.volume, 0))}</td>
    </tr>
  `).join("");
}

function compareExchangePrices() {
  const symbol = String(document.getElementById("compareSymbol")?.value || "BTC").trim().toUpperCase() || "BTC";
  const basePrice = getMarketSnapshot(symbol).price || 100;
  const exchanges = ["ATLASX3", "CoinHub", "Vertex", "Bluefin", "KrakenX"];
  state.compareRows = exchanges.map((exchange, index) => {
    const bid = basePrice - index * Math.max(basePrice * 0.0008, 0.01);
    const ask = basePrice + index * Math.max(basePrice * 0.0009, 0.01) + Math.max(basePrice * 0.0005, 0.01);
    return {
      exchange,
      bid,
      ask,
      spread: ask - bid,
      volume: 1_200_000 + index * 2_500_000,
    };
  });
  renderComparePrices();
}

function getMockDefiProtocols() {
  return [
    { protocol: "Aave", chain: "Ethereum", tvl: 9200000000, apy: 5.8, myPosition: 18250 },
    { protocol: "Compound", chain: "Base", tvl: 3400000000, apy: 4.6, myPosition: 8400 },
    { protocol: "Lido", chain: "Ethereum", tvl: 28400000000, apy: 3.9, myPosition: 12600 },
    { protocol: "Radiant", chain: "Arbitrum", tvl: 790000000, apy: 11.2, myPosition: 4200 },
    { protocol: "Venus", chain: "BSC", tvl: 1400000000, apy: 7.1, myPosition: 6300 },
  ];
}

function getMockDefiFarms() {
  return [
    { farm: "Camelot Nitro", pair: "ARB/ETH", apr: 26.4, tvl: 128000000, myStake: 5400, rewards: 184 },
    { farm: "Trader Joe", pair: "AVAX/USDC", apr: 19.7, tvl: 94000000, myStake: 3800, rewards: 96 },
    { farm: "QuickSwap", pair: "MATIC/USDT", apr: 22.1, tvl: 71000000, myStake: 2600, rewards: 72 },
  ];
}

function renderDefiPanel() {
  const tvlNode = document.getElementById("defiTvl");
  const balanceNode = document.getElementById("defiMyBalance");
  const rewardsNode = document.getElementById("defiRewards");
  if (tvlNode) {
    tvlNode.textContent = formatCompactCurrency(state.defi.metrics.tvl, 0);
  }
  if (balanceNode) {
    balanceNode.textContent = formatCompactCurrency(state.defi.metrics.myBalance, 0);
  }
  if (rewardsNode) {
    rewardsNode.textContent = formatCompactCurrency(state.defi.metrics.rewards, 0);
  }

  const protocolsBody = document.getElementById("defiProtocolsBody");
  if (protocolsBody) {
    protocolsBody.innerHTML = state.defi.protocols.length
      ? state.defi.protocols.map((row) => `
          <tr>
            <td>${escapeHtml(row.protocol)}</td>
            <td>${escapeHtml(row.chain)}</td>
            <td>${escapeHtml(formatCompactCurrency(row.tvl, 0))}</td>
            <td>${escapeHtml(`${formatPlainNumber(row.apy, 2)}%`)}</td>
            <td>${escapeHtml(formatCompactCurrency(row.myPosition, 0))}</td>
            <td><button type="button" class="secondary">${row.myPosition > 0 ? "Withdraw" : "Deposit"}</button></td>
          </tr>
        `).join("")
      : '<tr><td colspan="6" class="empty">Refresh DeFi to load protocol positions.</td></tr>';
  }

  const farmsBody = document.getElementById("defiFarmsBody");
  if (farmsBody) {
    farmsBody.innerHTML = state.defi.farms.length
      ? state.defi.farms.map((row) => `
          <tr>
            <td>${escapeHtml(row.farm)}</td>
            <td>${escapeHtml(row.pair)}</td>
            <td>${escapeHtml(`${formatPlainNumber(row.apr, 2)}%`)}</td>
            <td>${escapeHtml(formatCompactCurrency(row.tvl, 0))}</td>
            <td>${escapeHtml(formatCompactCurrency(row.myStake, 0))}</td>
            <td>${escapeHtml(formatCompactCurrency(row.rewards, 0))}</td>
            <td><button type="button" class="secondary">${row.rewards > 0 ? "Harvest" : "Stake"}</button></td>
          </tr>
        `).join("")
      : '<tr><td colspan="7" class="empty">Refresh DeFi to load yield farms.</td></tr>';
  }
}

function refreshDefiDashboard() {
  state.defi.protocols = getMockDefiProtocols();
  state.defi.farms = getMockDefiFarms();
  state.defi.metrics = {
    tvl: state.defi.protocols.reduce((sum, row) => sum + row.tvl, 0) + state.defi.farms.reduce((sum, row) => sum + row.tvl, 0),
    myBalance: state.defi.protocols.reduce((sum, row) => sum + row.myPosition, 0) + state.defi.farms.reduce((sum, row) => sum + row.myStake, 0),
    rewards: state.defi.farms.reduce((sum, row) => sum + row.rewards, 0),
  };
  renderDefiPanel();
}

function renderMultisigWallets() {
  const body = document.getElementById("multisigWalletsBody");
  if (!body) {
    return;
  }
  body.innerHTML = state.multisigWallets.length
    ? state.multisigWallets.map((wallet) => `
        <tr>
          <td>${escapeHtml(wallet.address)}</td>
          <td>${escapeHtml(wallet.signers.join(", "))}</td>
          <td>${escapeHtml(String(wallet.threshold))}</td>
          <td>${escapeHtml(formatCompactCurrency(wallet.balance, 0))}</td>
          <td><button type="button" class="secondary">View</button></td>
        </tr>
      `).join("")
    : '<tr><td colspan="5" class="empty">Create a MultiSig wallet to see active signers.</td></tr>';
}

function renderMultisigTransactions() {
  const body = document.getElementById("multisigTxBody");
  if (!body) {
    return;
  }
  body.innerHTML = state.multisigTxs.length
    ? state.multisigTxs.map((tx) => `
        <tr>
          <td>${escapeHtml(tx.id)}</td>
          <td>${escapeHtml(tx.to)}</td>
          <td>${escapeHtml(formatCompactCurrency(tx.amount, 0))}</td>
          <td>${escapeHtml(String(tx.confirmations))}</td>
          <td>${escapeHtml(String(tx.required))}</td>
          <td>${escapeHtml(tx.status)}</td>
          <td>
            ${tx.status === "Executed"
              ? '<span class="meta">Complete</span>'
              : `${tx.confirmations < tx.required ? `<button type="button" class="secondary" data-action="sign-multisig" data-tx-id="${escapeHtml(tx.id)}">Sign</button>` : ""} ${tx.confirmations >= tx.required ? `<button type="button" class="secondary" data-action="execute-multisig" data-tx-id="${escapeHtml(tx.id)}">Execute</button>` : ""}`}
          </td>
        </tr>
      `).join("")
    : '<tr><td colspan="7" class="empty">Refresh to load pending multisig transactions.</td></tr>';
}

function getMockMultisigTransactions() {
  return state.multisigWallets.slice(0, 2).map((wallet, index) => ({
    id: `MS_TX_${index + 1}`,
    walletAddress: wallet.address,
    to: `0xRecipient${index + 1}A7C9F4B2`,
    amount: 2500 + index * 1750,
    confirmations: Math.min(index + 1, wallet.threshold),
    required: wallet.threshold,
    status: index + 1 >= wallet.threshold ? "Ready" : "Pending",
  }));
}

function refreshMultisigPanel() {
  state.multisigTxs = getMockMultisigTransactions();
  renderMultisigWallets();
  renderMultisigTransactions();
}

function createMultisigWallet() {
  const signers = String(document.getElementById("multisigSigners")?.value || "")
    .split(/\n+/)
    .map((value) => value.trim())
    .filter(Boolean);
  const thresholdInput = Number(document.getElementById("multisigThreshold")?.value || 0);
  const uniqueSigners = [...new Set(signers)];
  if (!uniqueSigners.length) {
    showToast("Add at least one signer", "warning");
    return;
  }
  const threshold = Math.max(1, Math.min(uniqueSigners.length, thresholdInput || uniqueSigners.length));
  state.multisigWallets.unshift({
    address: `0xMULTI${randomTokenFragment(10)}`,
    signers: uniqueSigners,
    threshold,
    balance: 5000 + uniqueSigners.length * 2750,
  });
  const signersField = document.getElementById("multisigSigners");
  const thresholdField = document.getElementById("multisigThreshold");
  if (signersField) {
    signersField.value = "";
  }
  if (thresholdField) {
    thresholdField.value = "";
  }
  refreshMultisigPanel();
  showToast("MultiSig wallet created", "positive");
}

function signMultisigTransaction(txId) {
  state.multisigTxs = state.multisigTxs.map((tx) => {
    if (tx.id !== txId || tx.status === "Executed") {
      return tx;
    }
    const confirmations = Math.min(tx.required, tx.confirmations + 1);
    return {
      ...tx,
      confirmations,
      status: confirmations >= tx.required ? "Ready" : "Pending",
    };
  });
  renderMultisigTransactions();
}

function executeMultisigTransaction(txId) {
  state.multisigTxs = state.multisigTxs.map((tx) => (
    tx.id === txId && tx.confirmations >= tx.required
      ? { ...tx, status: "Executed" }
      : tx
  ));
  renderMultisigTransactions();
}

function renderJournal() {
  const body = document.getElementById("journalBody");
  if (!body) {
    return;
  }
  body.innerHTML = state.journal.length
    ? state.journal.map((entry) => `
        <tr>
          <td>${escapeHtml(entry.date)}</td>
          <td>${escapeHtml(entry.pair)}</td>
          <td>${escapeHtml(entry.direction)}</td>
          <td>${escapeHtml(formatPlainNumber(entry.entry, 4))}</td>
          <td>${escapeHtml(formatPlainNumber(entry.exit, 4))}</td>
          <td>${escapeHtml(formatPlainNumber(entry.size, 4))}</td>
          <td class="${entry.pnl >= 0 ? "positive" : "negative"}">${escapeHtml(formatCompactCurrency(entry.pnl, 2))}</td>
          <td>${escapeHtml(entry.outcome)}</td>
          <td>${escapeHtml(entry.notes)}</td>
          <td><button type="button" class="secondary" data-action="delete-journal" data-entry-id="${escapeHtml(entry.id)}">Delete</button></td>
        </tr>
      `).join("")
    : '<tr><td colspan="10" class="empty">Add a journal entry to start tracking trades.</td></tr>';
}

function updateJournalSummary() {
  const total = state.journal.length;
  const wins = state.journal.filter((entry) => entry.outcome === "Won").length;
  const totalPnl = state.journal.reduce((sum, entry) => sum + entry.pnl, 0);
  const avgPnl = total ? totalPnl / total : 0;
  const best = total ? Math.max(...state.journal.map((entry) => entry.pnl)) : 0;
  const worst = total ? Math.min(...state.journal.map((entry) => entry.pnl)) : 0;
  const mappings = [
    ["journalTotal", String(total)],
    ["journalWinRate", `${formatPlainNumber(total ? (wins / total) * 100 : 0, 1)}%`],
    ["journalAvgPnl", formatCompactCurrency(avgPnl, 2)],
    ["journalBest", formatCompactCurrency(best, 2)],
    ["journalWorst", formatCompactCurrency(worst, 2)],
  ];
  mappings.forEach(([id, value]) => {
    const node = document.getElementById(id);
    if (node) {
      node.textContent = value;
    }
  });
}

function addJournalEntry() {
  const date = String(document.getElementById("journalDate")?.value || "").trim();
  const pair = String(document.getElementById("journalPair")?.value || "").trim().toUpperCase();
  const direction = String(document.getElementById("journalDir")?.value || "Long");
  const entryPrice = Number(document.getElementById("journalEntry")?.value || 0);
  const exitPrice = Number(document.getElementById("journalExit")?.value || 0);
  const size = Number(document.getElementById("journalSize")?.value || 0);
  const outcome = String(document.getElementById("journalOutcome")?.value || "Breakeven");
  const notes = String(document.getElementById("journalNotes")?.value || "").trim();
  if (!date || !pair || !entryPrice || !exitPrice || !size) {
    showToast("Complete all journal fields", "warning");
    return;
  }
  const pnl = direction === "Short" ? (entryPrice - exitPrice) * size : (exitPrice - entryPrice) * size;
  state.journal.unshift({
    id: `journal_${Date.now()}`,
    date,
    pair,
    direction,
    entry: entryPrice,
    exit: exitPrice,
    size,
    pnl,
    outcome,
    notes,
  });
  ["journalPair", "journalEntry", "journalExit", "journalSize", "journalNotes"].forEach((id) => {
    const field = document.getElementById(id);
    if (field) {
      field.value = "";
    }
  });
  renderJournal();
  updateJournalSummary();
}

function deleteJournalEntry(entryId) {
  state.journal = state.journal.filter((entry) => entry.id !== entryId);
  renderJournal();
  updateJournalSummary();
}

function exportJournalCsv() {
  if (!state.journal.length) {
    showToast("No journal entries to export", "warning");
    return;
  }
  const csv = [
    ["Date", "Pair", "Direction", "Entry", "Exit", "Size", "PnL", "Outcome", "Notes"],
    ...state.journal.map((entry) => [entry.date, entry.pair, entry.direction, entry.entry, entry.exit, entry.size, entry.pnl, entry.outcome, entry.notes]),
  ].map((row) => row.map((value) => escapeCsvValue(value)).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `atlasx3-journal-${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function toggleShortcutsModal(show) {
  const modal = document.getElementById("shortcutsModal");
  const overlay = document.getElementById("shortcutsOverlay");
  if (modal) {
    modal.hidden = !show;
  }
  if (overlay) {
    overlay.hidden = !show;
  }
}

function clearShortcutPendingKey() {
  state.shortcutPendingKey = "";
  if (state.shortcutTimer) {
    clearTimeout(state.shortcutTimer);
    state.shortcutTimer = null;
  }
}

function handleKeyboardShortcuts(event) {
  const key = String(event.key || "").toLowerCase();
  const activeElement = document.activeElement;
  const activeTag = String(activeElement?.tagName || "").toUpperCase();
  const isTypingField = activeElement?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(activeTag);

  if (key === "escape") {
    toggleShortcutsModal(false);
    clearShortcutPendingKey();
    return;
  }

  if (key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) {
    const searchInput = document.getElementById("cryptoSearchInput");
    if (searchInput) {
      event.preventDefault();
      switchSection("marketsPanel");
      searchInput.focus();
      if (typeof searchInput.select === "function") {
        searchInput.select();
      }
    }
    return;
  }

  if (isTypingField) {
    return;
  }

  if (key === "g") {
    state.shortcutPendingKey = "g";
    if (state.shortcutTimer) {
      clearTimeout(state.shortcutTimer);
    }
    state.shortcutTimer = window.setTimeout(() => {
      clearShortcutPendingKey();
    }, 1500);
    return;
  }

  if (state.shortcutPendingKey === "g") {
    const sectionMap = {
      m: "marketsPanel",
      p: "portfolioPanel",
      t: "tradingPanel",
      w: "walletPanel",
      d: "dexPanel",
      b: "bridgePanel",
    };
    clearShortcutPendingKey();
    if (sectionMap[key]) {
      event.preventDefault();
      switchSection(sectionMap[key]);
    }
  }
}

function getPgMethodLabel(method = "card") {
  const labels = {
    card: "Card Payment",
    crypto: "Crypto Payment",
    bank_transfer: "Bank Transfer",
    paypal: "PayPal Payment",
    apple_pay: "Apple Pay",
    google_pay: "Google Pay",
    sepa: "SEPA Debit",
    wire: "Wire Transfer",
  };
  return labels[method] || "Payment";
}

function normalizePaymentRecord(record = {}) {
  const parsedMetadata =
    typeof record.metadata === "string"
      ? safeJsonParse(record.metadata, {})
      : record.metadata || {};
  const metadata =
    parsedMetadata && typeof parsedMetadata === "object" && !Array.isArray(parsedMetadata)
      ? parsedMetadata
      : {};
  return {
    id: String(record.id || `PAY_${Date.now()}`),
    method: String(record.method || (record.cryptoSymbol ? "crypto" : "card")),
    amount: Number(record.amount ?? record.fiatAmount ?? 0),
    currency: String(record.currency || record.fiatCurrency || "USD").toUpperCase(),
    status: String(record.status || "pending"),
    created_at: record.created_at || record.createdAt || new Date().toISOString(),
    instructions: record.instructions || "",
    qr_data: record.qr_data || record.qrData || "",
    cryptoAmount: record.cryptoAmount || metadata.cryptoAmount || "",
    cryptoSymbol: record.cryptoSymbol || metadata.cryptoSymbol || "",
    address: record.address || metadata.address || "",
    network: record.network || metadata.network || "",
    autoCredit: (record.autoCredit ?? metadata.autoCredit) === true,
  };
}

function renderPgMessage(title, message) {
  const panel = document.getElementById("pgResult");
  if (!panel) {
    return;
  }
  panel.innerHTML = `
    <article>
      <strong>${escapeHtml(title)}</strong>
      <p class="meta">${escapeHtml(message)}</p>
    </article>
  `;
}

function renderPgFields() {
  const method = state.pgMethod || "card";
  const title = document.getElementById("pgFormTitle");
  const fields = document.getElementById("pgFields");
  const tabs = document.getElementById("payMethodTabs");

  if (title) {
    title.textContent = getPgMethodLabel(method);
  }

  tabs?.querySelectorAll('[data-action="pg-tab"]').forEach((button) => {
    button.classList.toggle("active", button.dataset.pg === method);
  });

  if (!fields) {
    return;
  }

  const templates = {
    card: `
      <label>Cardholder Name
        <input id="pgCardName" type="text" placeholder="Full name on card" autocomplete="cc-name" />
      </label>
      <label>Card Number
        <input id="pgCardNumber" type="text" placeholder="•••• •••• •••• ••••" autocomplete="cc-number" />
      </label>
      <label>Expiry
        <input id="pgExpiry" type="text" placeholder="MM/YY" autocomplete="cc-exp" />
      </label>
      <label>CVV
        <input id="pgCvv" type="text" placeholder="123" autocomplete="cc-csc" />
      </label>
    `,
    crypto: `
      <label>Cryptocurrency
        <select id="pgCryptoSymbol">
          <option value="BTC">BTC</option>
          <option value="ETH">ETH</option>
          <option value="USDT">USDT</option>
          <option value="BNB">BNB</option>
          <option value="SOL">SOL</option>
          <option value="TRX">TRX</option>
          <option value="ATX">ATX</option>
        </select>
      </label>
    `,
    bank_transfer: `
      <label>Account Name
        <input id="pgAccName" type="text" placeholder="Account holder" />
      </label>
      <label>Account Number
        <input id="pgAccNumber" type="text" placeholder="Account number" />
      </label>
      <label>Routing Number
        <input id="pgRouting" type="text" placeholder="Routing / sort code" />
      </label>
    `,
    paypal: `
      <label>PayPal Email
        <input id="pgPaypalEmail" type="email" placeholder="name@example.com" />
      </label>
    `,
    apple_pay: `
      <div class="pg-method-card">
        <span>Device Wallet</span>
        <strong>Tap to pay using your device wallet</strong>
      </div>
    `,
    google_pay: `
      <div class="pg-method-card">
        <span>Device Wallet</span>
        <strong>Tap to pay using your device wallet</strong>
      </div>
    `,
    sepa: `
      <label>IBAN
        <input id="pgIban" type="text" placeholder="DE89 3704 0044 0532 0130 00" />
      </label>
      <label>BIC
        <input id="pgBic" type="text" placeholder="COBADEFFXXX" />
      </label>
    `,
    wire: `
      <label>Beneficiary Name
        <input id="pgWireBeneficiary" type="text" placeholder="Beneficiary name" />
      </label>
      <label>Bank Name
        <input id="pgWireBankName" type="text" placeholder="Bank name" />
      </label>
      <label>SWIFT
        <input id="pgWireSwift" type="text" placeholder="SWIFT / BIC" />
      </label>
      <label>Account Number
        <input id="pgWireAccount" type="text" placeholder="Account number" />
      </label>
    `,
  };

  fields.innerHTML = templates[method] || templates.card;
}

function renderPgSummary(payment = null) {
  const qrDisplay = document.getElementById("pgQrDisplay");
  const instructions = document.getElementById("pgInstructions");

  if (!payment) {
    if (qrDisplay) {
      qrDisplay.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 12px;">💳</div>
        <p class="meta">Select a payment method and enter amount to proceed</p>
      `;
    }
    if (instructions) {
      instructions.innerHTML = "";
    }
    return;
  }

  const normalized = normalizePaymentRecord(payment);
  const summaryLines = [
    `${formatPlainNumber(normalized.amount, 2)} ${normalized.currency}`,
    normalized.status,
    normalized.network ? `${normalized.network.toUpperCase()} network` : "",
    normalized.instructions ||
      (normalized.cryptoAmount && normalized.cryptoSymbol
        ? `${normalized.cryptoAmount} ${normalized.cryptoSymbol}`
        : getPgMethodLabel(normalized.method)),
  ].filter(Boolean);

  if (qrDisplay) {
    const receivingAddress = normalized.address
      ? `
        <strong>Receiving address</strong>
        <code class="wallet-address">${escapeHtml(normalized.address)}</code>
        <button
          type="button"
          class="secondary"
          data-action="copy-address"
          data-address="${escapeHtml(normalized.address)}"
          data-copy-label="${escapeHtml(`${normalized.cryptoSymbol || "Crypto"} receiving address`)}"
        >
          Copy address
        </button>
      `
      : "";
    qrDisplay.innerHTML = normalized.qr_data
      ? `
        <div class="pg-qr-box">
          <div style="font-size: 48px;">${escapeHtml(normalized.method === "crypto" ? "₿" : "💳")}</div>
          <div>${escapeHtml(normalized.qr_data)}</div>
          ${receivingAddress}
        </div>
      `
      : `
        <div class="pg-qr-box">
          <div style="font-size: 48px;">💳</div>
          <div>${escapeHtml(summaryLines.join(" · "))}</div>
        </div>
      `;
  }

  if (instructions) {
    const manualSettlementNotice =
      normalized.cryptoSymbol === "TRX" && !normalized.autoCredit
        ? '<p class="meta">TRX transfers require manual verification and do not automatically credit your exchange balance.</p>'
        : "";
    instructions.innerHTML = `
      <article>
        <strong>${escapeHtml(normalized.id)}</strong>
        <p class="meta">${escapeHtml(summaryLines.join(" · "))}</p>
        ${manualSettlementNotice}
      </article>
    `;
  }
}

async function loadTronDepositWallet() {
  const addressNode = document.getElementById("tronDepositAddress");
  const networkNode = document.getElementById("tronDepositNetwork");
  const copyButton = document.getElementById("copyTronDepositAddress");
  const explorerLink = document.getElementById("tronDepositExplorer");

  try {
    const wallet = await apiCall("/api/tron/deposit-wallet", {
      key: "tron-deposit-wallet",
      skipAuthRedirect: true,
    });
    const address = wallet.configured ? String(wallet.address || "") : "";

    if (addressNode) {
      addressNode.textContent = address || "Not configured";
    }
    if (networkNode) {
      networkNode.textContent = String(wallet.network || "unknown").toUpperCase();
    }
    if (copyButton) {
      copyButton.dataset.address = address;
      copyButton.disabled = !address;
    }
    if (explorerLink) {
      explorerLink.hidden = !address || !wallet.explorerUrl;
      if (!explorerLink.hidden) {
        explorerLink.href = wallet.explorerUrl;
      }
    }
  } catch {
    if (addressNode) {
      addressNode.textContent = "Unavailable";
    }
    if (networkNode) {
      networkNode.textContent = "Unavailable";
    }
    if (copyButton) {
      copyButton.disabled = true;
    }
    if (explorerLink) {
      explorerLink.hidden = true;
    }
  }
}

function renderPaymentHistory() {
  const body = document.getElementById("paymentHistoryBody");
  if (!body) {
    return;
  }

  body.innerHTML = state.pgPayments.length
    ? state.pgPayments
        .map((row) => {
          const confirmDisabled =
            row.method === "crypto" ||
            ["completed", "partially_refunded", "refunded"].includes(row.status);
          const refundDisabled = !["completed", "partially_refunded"].includes(row.status);
          return `
            <tr>
              <td>${escapeHtml(row.id)}</td>
              <td>${escapeHtml(row.method)}</td>
              <td>${escapeHtml(formatPlainNumber(row.amount, 2))}</td>
              <td>${escapeHtml(row.currency)}</td>
              <td>${escapeHtml(row.status)}</td>
              <td>${escapeHtml(formatTimestamp(row.created_at))}</td>
              <td>
                <div class="button-row">
                  <button type="button" class="secondary" data-action="confirm-payment" data-payment-id="${escapeHtml(row.id)}" ${confirmDisabled ? "disabled" : ""}>Confirm</button>
                  <button type="button" class="secondary" data-action="refund-payment" data-payment-id="${escapeHtml(row.id)}" ${refundDisabled ? "disabled" : ""}>Refund</button>
                </div>
              </td>
            </tr>
          `;
        })
        .join("")
    : '<tr><td colspan="7" class="meta">No payments yet.</td></tr>';
}

function renderSavedPaymentMethods(methods = []) {
  const list = document.getElementById("savedMethodsList");
  if (!list) {
    return;
  }

  list.innerHTML = methods.length
    ? methods
        .map(
          (method) => `
            <div class="pg-method-card">
              <div>
                <strong>${escapeHtml(method.label || method.type || "Saved Method")}</strong>
                <div class="meta">${escapeHtml(method.masked || method.type || "")}</div>
              </div>
              <span>${escapeHtml(method.is_default ? "Default" : "")}</span>
            </div>
          `
        )
        .join("")
    : '<article><strong>No saved methods</strong><p class="meta">Save a preferred payment method for faster checkout.</p></article>';
}

function normalizeApiKeyRecord(record = {}) {
  const keyId = String(record.keyId || record.id || record.key || `key_${Date.now()}`);
  const permissions = Array.isArray(record.permissions)
    ? record.permissions
    : String(record.permissions || "read")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  return {
    keyId,
    name: record.name || "API Key",
    maskedKey: record.maskedKey || maskKey(record.key || keyId),
    permissions,
    createdAt: record.createdAt || record.created || formatTimestamp(),
    lastUsed: record.lastUsed || record.last_used || "Never",
    status: record.status || (record.revoked ? "revoked" : "active"),
    ipWhitelist: record.ipWhitelist || record.ip || "",
  };
}

function getMockOptionsChainRows(underlying = "BTC") {
  const configs = {
    BTC: { spot: 65250, expiry: "2026-09-27", vol: 58 },
    ETH: { spot: 3420, expiry: "2026-09-20", vol: 61 },
    SOL: { spot: 168, expiry: "2026-09-13", vol: 72 },
    BNB: { spot: 612, expiry: "2026-10-04", vol: 49 },
  };
  const config = configs[underlying] || configs.BTC;
  const step = config.spot > 1000 ? 500 : config.spot > 500 ? 50 : config.spot > 100 ? 10 : 5;
  return [-2, -1, 1, 2].flatMap((offset, index) => {
    const strike = Math.max(step, Math.round((config.spot + (offset * step)) / step) * step);
    const bidBase = Math.max(config.spot * 0.01 + index * 2, 1.5);
    const askBase = bidBase + Math.max(config.spot * 0.0015, 0.35);
    return [
      {
        id: `${underlying}_CALL_${strike}_${index}`,
        underlying,
        strike,
        expiry: config.expiry,
        type: "Call",
        bid: bidBase,
        ask: askBase,
        iv: `${config.vol + index * 2}%`,
        delta: formatPlainNumber(0.62 - (index * 0.08), 2),
      },
      {
        id: `${underlying}_PUT_${strike}_${index}`,
        underlying,
        strike,
        expiry: config.expiry,
        type: "Put",
        bid: Math.max(bidBase - 0.8, 1.1),
        ask: Math.max(askBase - 0.45, 1.45),
        iv: `${config.vol + 4 + index * 2}%`,
        delta: formatPlainNumber(-0.38 - (index * 0.07), 2),
      },
    ];
  });
}

function getMockOptionsPositions() {
  return [
    { id: "opt_pos_btc_call", underlying: "BTC", strike: 66000, type: "Call", qty: 1, premium: 1245, pnl: 182 },
    { id: "opt_pos_eth_put", underlying: "ETH", strike: 3300, type: "Put", qty: 2, premium: 214, pnl: -36 },
  ];
}

function getMockTaxTransactions(year = "2024", method = "FIFO") {
  const methodAdjustments = { FIFO: 1, LIFO: 0.94, HIFO: 0.88 };
  const multiplier = methodAdjustments[method] || 1;
  return [
    { date: `${year}-02-14`, type: "Sell", asset: "BTC", amount: 0.24, costBasis: 8200 * multiplier, proceeds: 9300 },
    { date: `${year}-04-09`, type: "Swap", asset: "ETH", amount: 4.5, costBasis: 8900 * multiplier, proceeds: 8450 },
    { date: `${year}-07-22`, type: "Sell", asset: "SOL", amount: 120, costBasis: 1420 * multiplier, proceeds: 2280 },
    { date: `${year}-11-03`, type: "Sell", asset: "BNB", amount: 18, costBasis: 7020 * multiplier, proceeds: 6760 },
  ].map((row) => ({
    ...row,
    gainLoss: row.proceeds - row.costBasis,
  }));
}

function calculateHealthFactorValue() {
  const collateralValue = state.lending.supplies.reduce((sum, row) => sum + (Number(row.usdValue) || 0), 0);
  const borrowValue = state.lending.borrows.reduce((sum, row) => sum + (Number(row.usdValue) || 0), 0);
  if (!collateralValue && !borrowValue) {
    return null;
  }
  if (!borrowValue) {
    return 9.99;
  }
  return (collateralValue * 0.82) / borrowValue;
}

function getHealthFactorTone(value) {
  if (value === null) {
    return "";
  }
  if (value >= 2) {
    return "health-factor-good";
  }
  if (value >= 1.2) {
    return "health-factor-warn";
  }
  return "health-factor-bad";
}

function updateHealthFactorChip() {
  const chip = document.getElementById("healthFactor");
  if (!chip) {
    return;
  }
  const value = calculateHealthFactorValue();
  chip.className = `status-chip ${getHealthFactorTone(value)}`.trim();
  chip.textContent = value === null ? "Health Factor: --" : `Health Factor: ${formatPlainNumber(value, 2)}`;
}

function getMockSystemStatus(healthy = false, apiLatency = 0) {
  const apiOnline = healthy ? "Online" : "Degraded";
  const wsReady = typeof WebSocket !== "undefined" && state.websocket?.readyState === WebSocket.OPEN;
  const wsOnline = wsReady ? "Online" : healthy ? "Degraded" : "Offline";
  const entries = [
    { id: "statusApi", service: "API Server", status: apiOnline, avgResponse: `${Math.max(apiLatency || 24, 18)} ms`, uptime: healthy ? "99.99%" : "98.72%" },
    { id: "statusWs", service: "WebSocket", status: wsOnline, avgResponse: wsOnline === "Online" ? "32 ms" : "85 ms", uptime: wsOnline === "Offline" ? "97.40%" : "99.12%" },
    { id: "statusDb", service: "Database", status: healthy ? "Online" : "Online", avgResponse: "21 ms", uptime: "99.95%" },
    { id: "statusEth", service: "Ethereum Node", status: healthy ? "Online" : "Degraded", avgResponse: "78 ms", uptime: "99.10%" },
    { id: "statusTron", service: "TRON Node", status: healthy ? "Online" : "Online", avgResponse: "64 ms", uptime: "99.44%" },
    { id: "statusSol", service: "Solana Node", status: healthy ? "Degraded" : "Offline", avgResponse: healthy ? "110 ms" : "240 ms", uptime: healthy ? "98.85%" : "96.70%" },
    { id: "statusMt", service: "MetaTrader", status: healthy ? "Online" : "Degraded", avgResponse: healthy ? "43 ms" : "92 ms", uptime: "98.93%" },
    { id: "statusHardhat", service: "Hardhat", status: healthy ? "Online" : "Degraded", avgResponse: healthy ? "12 ms" : "44 ms", uptime: "99.80%" },
  ];
  const lastPing = formatTimestamp();
  return entries.map((entry) => ({ ...entry, lastPing }));
}

function statusToneClass(status) {
  if (status === "Online") {
    return "status-dot-online";
  }
  if (status === "Offline") {
    return "status-dot-offline";
  }
  return "status-dot-degraded";
}

function normalizeMarketPrices(prices, currency = "usd") {
  if (Array.isArray(prices)) {
    return prices;
  }

  return Object.entries(prices || {}).map(([assetId, quote]) => ({
    symbol: MARKET_SYMBOLS[assetId] || assetId.slice(0, 6).toUpperCase(),
    price: quote?.[currency] ?? quote?.usd ?? 0,
    change24h: quote?.[`${currency}_24h_change`] ?? quote?.usd_24h_change ?? 0,
    marketCap: quote?.[`${currency}_market_cap`] ?? quote?.usd_market_cap ?? 0,
    volume24h: quote?.[`${currency}_24h_vol`] ?? quote?.usd_24h_vol ?? 0,
  }));
}

function renderResultPanel(elementId, title, payload) {
  const panel = document.getElementById(elementId);
  if (!panel) {
    return;
  }

  const content = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  panel.innerHTML = `
    <article>
      <strong>${escapeHtml(title)}</strong>
      <p class="meta">${escapeHtml(content)}</p>
    </article>
  `;
}

function updateNotifCount() {
  const badge = document.getElementById("notifCount");
  if (badge) {
    badge.textContent = String(state.notifs.length);
  }
}

function getMockNotifications() {
  return [
    { title: "Yield opportunity", message: "DOT staking APY moved above 12%." },
    { title: "NFT mint ready", message: "Atlas Genesis mint window is now open." },
    { title: "Analytics update", message: "Win rate improved across major pairs today." },
  ];
}

function getMockSocialFeedItems() {
  return [
    { id: "feed_1", username: "AtlasWhale", pair: "BTC", direction: "Bullish", text: "Breakout above resistance could open a fast move toward new highs.", timestamp: "2m ago", likes: 14 },
    { id: "feed_2", username: "ChainScout", pair: "ETH", direction: "Neutral", text: "Watching ETF flows before adding size into the next volatility expansion.", timestamp: "8m ago", likes: 9 },
    { id: "feed_3", username: "SolSurfer", pair: "SOL", direction: "Bullish", text: "Momentum remains strong while funding stays manageable on majors.", timestamp: "16m ago", likes: 21 },
    { id: "feed_4", username: "MacroBear", pair: "BNB", direction: "Bearish", text: "Lower highs on the intraday tape suggest waiting for confirmation.", timestamp: "24m ago", likes: 6 },
    { id: "feed_5", username: "DeltaDesk", pair: "BTC", direction: "Neutral", text: "Scalpers may get a range session unless macro headlines hit the tape.", timestamp: "37m ago", likes: 11 },
  ];
}

function getMockLaunchpadRows() {
  return [
    { id: "launch_1", token: "Atlas Energy", symbol: "AEN", supply: 50000000, status: "Live", raised: 185000, goal: 250000 },
    { id: "launch_2", token: "Nova Chain", symbol: "NOVA", supply: 120000000, status: "Upcoming", raised: 64000, goal: 300000 },
    { id: "launch_3", token: "Yield Forge", symbol: "YFG", supply: 75000000, status: "Live", raised: 214500, goal: 400000 },
  ];
}

function getMockProposals() {
  return [
    { id: 1, title: "Expand BTC bot liquidity budget", status: "Active", votesFor: 1420, votesAgainst: 280, deadline: "3d" },
    { id: 2, title: "List SOL structured vaults", status: "Active", votesFor: 980, votesAgainst: 190, deadline: "7d" },
    { id: 3, title: "Reduce launchpad listing fee", status: "Passed", votesFor: 1880, votesAgainst: 320, deadline: "Closed" },
  ];
}

function getMockBots() {
  return [
    { id: "bot_1", name: "Atlas DCA", strategy: "DCA", pair: "BTC/USDT", status: "Running", pnl: 184.25, trades: 18, investment: 2500 },
    { id: "bot_2", name: "Grid Harbor", strategy: "Grid", pair: "ETH/USDT", status: "Paused", pnl: 96.8, trades: 11, investment: 1800 },
  ];
}

function getDirectionBadgeClass(direction) {
  return getSentimentBadgeClass(direction);
}

function populateQuickStats() {
  const activeBots = state.bots.filter((bot) => bot.status === "Running").length;
  const quickStats = {
    qsPnlToday: `+${formatCompactCurrency(1240, 0)}`,
    qsWinRate: "64%",
    qsActiveBots: String(activeBots || 2),
    qsPortfolioChange: "+2.8%",
  };
  Object.entries(quickStats).forEach(([id, value]) => {
    const node = document.getElementById(id);
    if (node) {
      node.textContent = value;
    }
  });
}

function renderNotifications() {
  const list = document.getElementById("notifList");
  if (!list) {
    return;
  }

  if (!state.notifs.length) {
    list.innerHTML = '<div class="notif-item">All caught up.</div>';
    updateNotifCount();
    return;
  }

  list.innerHTML = state.notifs
    .map(
      (item) => `
        <div class="notif-item">
          <strong>${escapeHtml(item.title)}</strong>
          <div>${escapeHtml(item.message)}</div>
        </div>
      `
    )
    .join("");
  updateNotifCount();
}

function renderSocialFeed() {
  const list = document.getElementById("socialFeedList");
  if (!list) {
    return;
  }

  if (!state.socialFeed.length) {
    list.innerHTML = '<article><strong>Feed standby</strong><p class="meta">Refresh to load market ideas from the community.</p></article>';
    return;
  }

  list.innerHTML = state.socialFeed
    .map((post) => {
      const username = String(post.username || "AtlasUser");
      const avatar = username.charAt(0).toUpperCase() || "A";
      const badgeClass = getDirectionBadgeClass(post.direction);
      return `
        <div class="feed-item">
          <div class="avatar">${escapeHtml(avatar)}</div>
          <div class="feed-content">
            <div class="feed-meta">
              <strong>${escapeHtml(username)}</strong>
              · ${escapeHtml(post.pair || "N/A")}
              · <span class="badge ${escapeHtml(badgeClass)}">${escapeHtml(post.direction || "Neutral")}</span>
              · ${escapeHtml(post.timestamp || formatTimestamp())}
            </div>
            <div>${escapeHtml(post.text || "")}</div>
            <div class="button-row" style="margin-top: 8px;">
              <button type="button" class="secondary" data-action="like-post" data-post-id="${escapeHtml(post.id)}">👍 Like</button>
              <span class="meta">Likes: ${escapeHtml(post.likes ?? 0)}</span>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderLaunchpad() {
  const body = document.getElementById("launchpadBody");
  if (!body) {
    return;
  }

  if (!state.launchpadLaunches.length) {
    body.innerHTML = '<tr><td colspan="7" class="empty">No launches available yet.</td></tr>';
    return;
  }

  body.innerHTML = state.launchpadLaunches
    .map((launch) => {
      const action = String(launch.status || "").toLowerCase() === "live" ? "invest-launch" : "view-launch";
      const label = action === "invest-launch" ? "Invest" : "View";
      return `
        <tr>
          <td>${escapeHtml(launch.token)}</td>
          <td>${escapeHtml(launch.symbol)}</td>
          <td>${escapeHtml(formatPlainNumber(launch.supply || 0, 0))}</td>
          <td>${escapeHtml(launch.status)}</td>
          <td>${escapeHtml(formatCompactCurrency(launch.raised || 0, 0))}</td>
          <td>${escapeHtml(formatCompactCurrency(launch.goal || 0, 0))}</td>
          <td><button type="button" class="secondary" data-action="${action}" data-launch-id="${escapeHtml(launch.id)}">${label}</button></td>
        </tr>
      `;
    })
    .join("");
}

function renderGovernanceStats() {
  const proposals = Array.isArray(state.proposals) ? state.proposals : [];
  const stats = {
    govTotalProposals: String(proposals.length),
    govActive: String(proposals.filter((proposal) => proposal.status === "Active").length),
    govVotingPower: `${formatPlainNumber(1250 + (proposals.length * 75), 0)} ATX`,
  };
  Object.entries(stats).forEach(([id, value]) => {
    const node = document.getElementById(id);
    if (node) {
      node.textContent = value;
    }
  });
}

function renderProposals() {
  const body = document.getElementById("proposalsBody");
  if (!body) {
    return;
  }

  if (!state.proposals.length) {
    body.innerHTML = '<tr><td colspan="7" class="empty">No proposals yet.</td></tr>';
    renderGovernanceStats();
    return;
  }

  body.innerHTML = state.proposals
    .map((proposal) => `
      <tr>
        <td>${escapeHtml(proposal.id)}</td>
        <td>${escapeHtml(proposal.title)}</td>
        <td>${escapeHtml(proposal.status)}</td>
        <td>${escapeHtml(proposal.votesFor ?? 0)}</td>
        <td>${escapeHtml(proposal.votesAgainst ?? 0)}</td>
        <td>${escapeHtml(proposal.deadline)}</td>
        <td>
          ${proposal.status === "Active"
            ? `<div class="button-row">
                <button type="button" class="secondary" data-action="vote-for" data-proposal-id="${escapeHtml(proposal.id)}">Vote For</button>
                <button type="button" class="secondary" data-action="vote-against" data-proposal-id="${escapeHtml(proposal.id)}">Vote Against</button>
              </div>`
            : '<span class="meta">Closed</span>'}
        </td>
      </tr>
    `)
    .join("");
  renderGovernanceStats();
}

function renderBots() {
  const body = document.getElementById("botsBody");
  if (!body) {
    return;
  }

  if (!state.bots.length) {
    body.innerHTML = '<tr><td colspan="7" class="empty">No bots running yet.</td></tr>';
    populateQuickStats();
    return;
  }

  body.innerHTML = state.bots
    .map((bot) => `
      <tr>
        <td>${escapeHtml(bot.name)}</td>
        <td>${escapeHtml(bot.strategy)}</td>
        <td>${escapeHtml(bot.pair)}</td>
        <td><span class="${escapeHtml(bot.status === "Running" ? "bot-running" : "bot-paused")}">${escapeHtml(bot.status)}</span></td>
        <td>${escapeHtml(`${bot.pnl >= 0 ? "+" : ""}${formatPlainNumber(bot.pnl || 0, 2)}`)}</td>
        <td>${escapeHtml(bot.trades ?? 0)}</td>
        <td>
          <div class="button-row">
            <button type="button" class="secondary" data-action="toggle-bot" data-bot-id="${escapeHtml(bot.id)}">${bot.status === "Running" ? "Stop" : "Start"}</button>
            <button type="button" class="secondary" data-action="delete-bot" data-bot-id="${escapeHtml(bot.id)}">Delete</button>
          </div>
        </td>
      </tr>
    `)
    .join("");
  populateQuickStats();
}

function getMockRecentActivity() {
  return [
    { icon: "🔐", action: "Signed in from web dashboard", timestamp: "2m ago" },
    { icon: "⚡", action: "Executed BTC/USDT market buy", timestamp: "7m ago" },
    { icon: "💸", action: "Received USDT deposit", timestamp: "16m ago" },
    { icon: "🏦", action: "Queued ETH withdrawal", timestamp: "28m ago" },
    { icon: "🧩", action: "API key called /wallet/generate", timestamp: "41m ago" },
  ];
}

function renderRecentActivity() {
  const list = document.getElementById("recentActivityList");
  if (!list) {
    return;
  }

  list.innerHTML = getMockRecentActivity()
    .map(
      (item) => `
        <div class="activity-item">
          <span class="activity-icon">${escapeHtml(item.icon)}</span>
          <span>${escapeHtml(item.action)}</span>
          <span class="meta" style="margin-left:auto;">${escapeHtml(item.timestamp)}</span>
        </div>
      `
    )
    .join("");
}

function getMockLeaderboardEntries(category = "traders", period = "30d") {
  const seeds = {
    traders: [
      ["trader_1", "Atlas Alpha", 32.4, 71, 118],
      ["trader_2", "Chain Hawk", 28.9, 69, 104],
      ["trader_3", "Delta Vault", 25.1, 67, 96],
      ["trader_4", "Moon Grid", 22.7, 65, 84],
      ["trader_5", "Sol Surge", 20.6, 64, 79],
      ["trader_6", "BSC Bullet", 19.8, 62, 74],
      ["trader_7", "Macro Tide", 18.1, 60, 68],
      ["trader_8", "Perp Pilot", 16.4, 59, 61],
    ],
    gainers: [
      ["trader_1", "Momentum Max", 44.8, 63, 54],
      ["trader_2", "Breakout Bay", 39.2, 61, 49],
      ["trader_3", "Gamma Green", 35.7, 60, 45],
      ["trader_4", "Sunrise Quant", 31.5, 58, 40],
      ["trader_5", "Flash Bid", 28.3, 57, 38],
      ["trader_6", "Pulse Stack", 24.9, 56, 35],
      ["trader_7", "Nova Drift", 22.6, 55, 31],
      ["trader_8", "Ribbon Trade", 19.7, 54, 28],
    ],
    volume: [
      ["trader_1", "Whale North", 18.5, 74, 210],
      ["trader_2", "Depth Rider", 17.2, 71, 194],
      ["trader_3", "Liquidity Lab", 15.9, 70, 182],
      ["trader_4", "Block Delta", 14.6, 67, 169],
      ["trader_5", "Prime Route", 13.8, 66, 157],
      ["trader_6", "Turbo Tape", 12.7, 64, 146],
      ["trader_7", "Copper Quant", 11.4, 63, 133],
      ["trader_8", "Signal Harbor", 10.8, 61, 121],
    ],
  };
  const multiplier = period === "7d" ? 0.42 : period === "90d" ? 2.4 : 1;
  return (seeds[category] || seeds.traders).map(([traderId, name, baseReturn, winRate, trades], index) => ({
    rank: index + 1,
    traderId,
    name,
    returnValue: Number((baseReturn * multiplier).toFixed(1)),
    winRate,
    trades: Math.max(12, Math.round(trades * multiplier)),
  }));
}

function renderLeaderboard() {
  const body = document.getElementById("leaderboardBody");
  if (!body) {
    return;
  }
  const period = String(document.getElementById("lbPeriod")?.value || "30d");
  const entries = getMockLeaderboardEntries(state.leaderboardTab, period);
  body.innerHTML = entries
    .map(
      (entry) => `
        <tr>
          <td>${escapeHtml(entry.rank)}</td>
          <td>${escapeHtml(entry.name)}</td>
          <td>${escapeHtml(`${entry.returnValue}% (${period})`)}</td>
          <td>${escapeHtml(`${entry.winRate}%`)}</td>
          <td>${escapeHtml(entry.trades)}</td>
          <td><button type="button" class="secondary" data-action="follow-trader" data-trader-id="${escapeHtml(entry.traderId)}">Follow</button></td>
        </tr>
      `
    )
    .join("");
}

function getBridgeNetworkFee(network) {
  const fees = {
    Ethereum: 12.5,
    BSC: 0.8,
    Tron: 0.4,
    Solana: 0.2,
    Hardhat: 0.05,
  };
  return fees[network] || 1;
}

function estimateBridgeFee(amount, fromNetwork, toNetwork) {
  const normalizedAmount = Number(amount) || 0;
  const networkFee = getBridgeNetworkFee(fromNetwork) + getBridgeNetworkFee(toNetwork);
  const percentageFee = normalizedAmount * 0.001;
  return {
    total: Number((percentageFee + networkFee).toFixed(4)),
    networkFee: Number(networkFee.toFixed(4)),
    percentageFee: Number(percentageFee.toFixed(4)),
  };
}

function renderBridgeHistory() {
  const body = document.getElementById("bridgeHistoryBody");
  if (!body) {
    return;
  }

  if (!state.bridgeHistory.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty">No bridge transfers yet.</td></tr>';
    return;
  }

  body.innerHTML = state.bridgeHistory
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.txHash)}</td>
          <td>${escapeHtml(item.from)}</td>
          <td>${escapeHtml(item.to)}</td>
          <td>${escapeHtml(item.token)}</td>
          <td>${escapeHtml(item.amount)}</td>
          <td>${escapeHtml(item.status)}</td>
        </tr>
      `
    )
    .join("");
}

function renderFundingRates() {
  const rates = {
    fundingBTC: "+0.010%",
    fundingETH: "+0.008%",
    fundingSOL: "-0.004%",
  };
  Object.entries(rates).forEach(([id, value]) => {
    const node = document.getElementById(id);
    if (node) {
      node.textContent = value;
    }
  });
}

function renderFuturesPositions() {
  const body = document.getElementById("futuresPositionsBody");
  if (!body) {
    return;
  }

  if (!state.futures.length) {
    body.innerHTML = '<tr><td colspan="8" class="empty">No open perpetual positions.</td></tr>';
    return;
  }

  body.innerHTML = state.futures
    .map(
      (position) => `
        <tr>
          <td>${escapeHtml(position.pair)}</td>
          <td>${escapeHtml(position.direction)}</td>
          <td>${escapeHtml(formatCompactCurrency(position.size, 0))}</td>
          <td>${escapeHtml(position.entry)}</td>
          <td>${escapeHtml(position.mark)}</td>
          <td>${escapeHtml(position.pnl)}</td>
          <td>${escapeHtml(position.marginType)}</td>
          <td><button type="button" class="secondary" data-action="close-futures-position" data-position-id="${escapeHtml(position.id)}">Close</button></td>
        </tr>
      `
    )
    .join("");
}

function renderStakes() {
  const body = document.getElementById("stakesBody");
  if (!body) {
    return;
  }

  if (!state.stakes.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty">No active stakes yet.</td></tr>';
    return;
  }

  body.innerHTML = state.stakes
    .map(
      (stake) => `
        <tr>
          <td>${escapeHtml(stake.asset)}</td>
          <td>${escapeHtml(formatPlainNumber(stake.amount, 4))}</td>
          <td>${escapeHtml(formatPlainNumber(stake.apy, 2))}</td>
          <td>${escapeHtml(stake.duration)}</td>
          <td>${escapeHtml(formatPlainNumber(stake.rewards, 4))}</td>
          <td><button type="button" class="secondary" data-action="unstake" data-stake-id="${escapeHtml(stake.id)}">Unstake</button></td>
        </tr>
      `
    )
    .join("");
}

function truncateAddress(value, prefix = 6, suffix = 4) {
  const text = String(value || "").trim();
  if (text.length <= prefix + suffix) {
    return text || "--";
  }
  return `${text.slice(0, prefix)}...${text.slice(-suffix)}`;
}

function renderNfts() {
  const grid = document.getElementById("nftGrid");
  if (!grid) {
    return;
  }

  if (!state.nfts.length) {
    grid.innerHTML = '<div class="nft-card">Load a wallet to preview collectible inventory.</div>';
    return;
  }

  grid.innerHTML = state.nfts
    .map(
      (item) => `
        <div class="nft-card">
          <div class="nft-img-placeholder">🖼️</div>
          <strong>${escapeHtml(item.name)}</strong>
          <div class="meta">Token ID: ${escapeHtml(item.tokenId)}</div>
          <div class="meta">${escapeHtml(truncateAddress(item.contractAddress))}</div>
        </div>
      `
    )
    .join("");
}

function refreshAnalytics() {
  const range = document.getElementById("analyticsRange")?.value || "7d";
  const multipliers = { "7d": 1, "30d": 2.6, "90d": 4.8, all: 7.2 };
  const multiplier = multipliers[range] || 1;
  const body = document.getElementById("analyticsBody");
  const pairs = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "DOT/USDT"].map((pair, index) => {
    const trades = Math.round((24 + index * 7 + Math.random() * 12) * multiplier);
    const winRate = 54 + index * 4 + Math.random() * 6;
    const avgPnl = 80 + index * 35 + Math.random() * 70;
    const volume = (42000 + index * 18000 + Math.random() * 12000) * multiplier;
    return { pair, trades, winRate, avgPnl, volume };
  });

  if (body) {
    body.innerHTML = pairs
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.pair)}</td>
            <td>${escapeHtml(String(item.trades))}</td>
            <td>${escapeHtml(`${formatPlainNumber(item.winRate, 1)}%`)}</td>
            <td>${escapeHtml(formatCompactCurrency(item.avgPnl, 0))}</td>
            <td>${escapeHtml(formatCompactCurrency(item.volume, 0))}</td>
          </tr>
        `
      )
      .join("");
  }

  const totalTrades = pairs.reduce((sum, item) => sum + item.trades, 0);
  const totalVolume = pairs.reduce((sum, item) => sum + item.volume, 0);
  const avgWinRate = pairs.reduce((sum, item) => sum + item.winRate, 0) / pairs.length;
  const totalPnl = pairs.reduce((sum, item) => sum + item.avgPnl * item.trades * 0.2, 0);
  const mappings = [
    ["analyticsVolume", formatCompactCurrency(totalVolume, 0)],
    ["analyticsTrades", String(totalTrades)],
    ["analyticsWinRate", `${formatPlainNumber(avgWinRate, 1)}%`],
    ["analyticsPnl", formatCompactCurrency(totalPnl, 0)],
  ];
  mappings.forEach(([id, value]) => {
    const node = document.getElementById(id);
    if (node) {
      node.textContent = value;
    }
  });
}

function renderTickerRates() {
  const ticker = state.dashboard.ticker;
  const mappings = [
    ["ticker-btc", ticker.btc],
    ["ticker-eth", ticker.eth],
    ["ticker-sol", ticker.sol],
    ["ticker-bnb", ticker.bnb],
    ["ticker-dot", ticker.dot],
    ["ticker-matic", ticker.matic],
    ["ticker-avax", ticker.avax],
    ["ticker-link", ticker.link],
  ];

  mappings.forEach(([id, value]) => {
    const node = document.getElementById(id);
    if (node) {
      node.textContent = value == null ? "--" : formatCompactCurrency(value, value > 1000 ? 0 : 2);
    }
  });
}

function renderMarketPrices() {
  const body = document.getElementById("pricesBody");
  if (!body) {
    return;
  }

  if (!state.dashboard.marketPrices.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty">Load market prices to view the latest moves.</td></tr>';
    return;
  }

  body.innerHTML = state.dashboard.marketPrices
    .map(
      (asset) => {
        const derivedRange = getAssetHighLow(asset);
        return `
        <tr>
          <td>${escapeHtml(asset.symbol || asset.id || "N/A")}</td>
          <td>${escapeHtml(formatCompactCurrency(asset.price, asset.price > 1000 ? 0 : 2))}</td>
          <td class="${Number(asset.change24h) >= 0 ? "positive" : "negative"}">${escapeHtml(formatPlainNumber(asset.change24h, 2))}%</td>
          <td>${escapeHtml(formatCompactCurrency(asset.marketCap || 0, 0))}</td>
          <td>${escapeHtml(formatCompactCurrency(asset.volume24h || 0, 0))}</td>
          <td>${escapeHtml(`${formatCompactCurrency(derivedRange.high, derivedRange.high > 1000 ? 0 : 2)} / ${formatCompactCurrency(derivedRange.low, derivedRange.low > 1000 ? 0 : 2)}`)}</td>
        </tr>
      `;
      }
    )
    .join("");
}

function getAssetHighLow(asset) {
  const price = Number(asset.price) || 0;
  const change = Math.abs(Number(asset.change24h) || 0);
  const rangeFactor = Math.max(change / 100, 0.0125);
  const high = Number(asset.high24h ?? asset.high ?? price * (1 + rangeFactor));
  const low = Number(asset.low24h ?? asset.low ?? price * Math.max(0.1, 1 - rangeFactor));
  return { high, low };
}

function renderOrderBook() {
  const body = document.getElementById("orderbookBody");
  const summary = document.getElementById("orderbookSummary");
  if (!body || !summary) {
    return;
  }

  const bids = state.dashboard.orderBook.bids || [];
  const asks = state.dashboard.orderBook.asks || [];
  if (!bids.length && !asks.length) {
    body.innerHTML = '<tr><td colspan="3" class="empty">Refresh the order book to load simulated levels.</td></tr>';
    summary.innerHTML = '<article><strong>Spread waiting</strong><p class="meta">Best bid and ask appear after loading the book.</p></article>';
    return;
  }

  body.innerHTML = [...asks, ...bids]
    .map(
      (level) => `
        <tr>
          <td class="${level.side === "ask" ? "negative" : "positive"}">${escapeHtml(formatCompactCurrency(level.price, level.price > 1000 ? 0 : 2))}</td>
          <td>${escapeHtml(formatPlainNumber(level.amount, 4))}</td>
          <td>${escapeHtml(formatPlainNumber(level.total, 4))}</td>
        </tr>
      `
    )
    .join("");

  summary.innerHTML = `
    <article>
      <strong>${escapeHtml(`Spread ${formatCompactCurrency(state.dashboard.orderBook.spread || 0, 2)}`)}</strong>
      <p class="meta">${escapeHtml(`Best bid ${formatCompactCurrency(state.dashboard.orderBook.bestBid || 0, 2)} · Best ask ${formatCompactCurrency(state.dashboard.orderBook.bestAsk || 0, 2)}`)}</p>
    </article>
  `;
}

function renderTradeHistory() {
  const body = document.getElementById("tradeHistoryBody");
  if (!body) {
    return;
  }

  if (!state.dashboard.tradeHistory.length) {
    body.innerHTML = '<tr><td colspan="5" class="empty">Load the trade history to review recent executions.</td></tr>';
    return;
  }

  body.innerHTML = state.dashboard.tradeHistory
    .map(
      (trade) => `
        <tr>
          <td>${escapeHtml(trade.time)}</td>
          <td>${escapeHtml(trade.pair)}</td>
          <td class="${trade.side === "Buy" ? "positive" : "negative"}">${escapeHtml(trade.side)}</td>
          <td>${escapeHtml(formatCompactCurrency(trade.price, trade.price > 1000 ? 0 : 2))}</td>
          <td>${escapeHtml(formatPlainNumber(trade.amount, 4))}</td>
        </tr>
      `
    )
    .join("");
}

function renderWatchlist() {
  const body = document.getElementById("watchlistBody");
  if (!body) {
    return;
  }

  if (!state.dashboard.watchlist.length) {
    body.innerHTML = '<tr><td colspan="4" class="empty">Add a symbol to start a personal watchlist.</td></tr>';
    return;
  }

  body.innerHTML = state.dashboard.watchlist
    .map(
      (entry) => `
        <tr>
          <td>${escapeHtml(entry.symbol)}</td>
          <td>${escapeHtml(formatCompactCurrency(entry.price, entry.price > 1000 ? 0 : 2))}</td>
          <td class="${Number(entry.change24h) >= 0 ? "positive" : "negative"}">${escapeHtml(formatPlainNumber(entry.change24h, 2))}%</td>
          <td><button type="button" class="secondary" data-action="remove-watchlist" data-symbol="${escapeHtml(entry.symbol)}">Remove</button></td>
        </tr>
      `
    )
    .join("");
}

function renderAlerts() {
  const body = document.getElementById("alertsBody");
  if (!body) {
    return;
  }

  if (!state.dashboard.alerts.length) {
    body.innerHTML = '<tr><td colspan="5" class="empty">Create an alert to monitor price targets.</td></tr>';
    return;
  }

  body.innerHTML = state.dashboard.alerts
    .map(
      (alert, index) => `
        <tr>
          <td>${escapeHtml(alert.symbol)}</td>
          <td>${escapeHtml(formatCompactCurrency(alert.targetPrice, alert.targetPrice > 1000 ? 0 : 2))}</td>
          <td>${escapeHtml(alert.direction)}</td>
          <td>${escapeHtml(alert.status)}</td>
          <td><button type="button" class="secondary" data-action="remove-alert" data-alert-index="${escapeHtml(index)}">Remove</button></td>
        </tr>
      `
    )
    .join("");
}

function renderQuickTradeStatus(title = "Quick Trade", message = "Enter an amount and choose a side to submit an instant simulated order.") {
  const panel = document.getElementById("quickTradeStatus");
  if (!panel) {
    return;
  }

  panel.innerHTML = `
    <article>
      <strong>${escapeHtml(title)}</strong>
      <p class="meta">${escapeHtml(message)}</p>
    </article>
  `;
}

function getMarketSnapshot(symbol) {
  const normalizedSymbol = String(symbol || "").trim().toUpperCase();
  const market = state.dashboard.marketPrices.find(
    (asset) => String(asset.symbol || asset.id || "").trim().toUpperCase() === normalizedSymbol
  );

  if (market) {
    return {
      symbol: normalizedSymbol,
      price: Number(market.price) || 0,
      change24h: Number(market.change24h) || 0,
    };
  }

  const fallbackPrice = 100 + normalizedSymbol.length * 25;
  const fallbackChange = normalizedSymbol.length % 2 === 0 ? 1.5 : -1.1;
  return {
    symbol: normalizedSymbol,
    price: fallbackPrice,
    change24h: fallbackChange,
  };
}

function sortMarketPrices(column) {
  const sortMap = {
    price: "price",
    change: "change24h",
    mcap: "marketCap",
  };
  const sortKey = sortMap[column];
  if (!sortKey) {
    return;
  }

  if (state.dashboard.marketSort.column === column) {
    state.dashboard.marketSort.direction *= -1;
  } else {
    state.dashboard.marketSort.column = column;
    state.dashboard.marketSort.direction = column === "change" ? -1 : 1;
  }

  const direction = state.dashboard.marketSort.direction;
  state.dashboard.marketPrices = [...state.dashboard.marketPrices].sort((left, right) => {
    const leftValue = Number(left?.[sortKey]) || 0;
    const rightValue = Number(right?.[sortKey]) || 0;
    return (leftValue - rightValue) * direction;
  });
  renderMarketPrices();
}

function refreshOrderBook() {
  const basePrice =
    Number(state.dashboard.marketPrices[0]?.price) ||
    Number(state.dashboard.ticker.btc) ||
    65000;
  const bidLevels = [];
  const askLevels = [];
  let bidRunningTotal = 0;
  let askRunningTotal = 0;

  for (let index = 0; index < 5; index += 1) {
    const bidAmount = 0.15 + index * 0.07;
    const askAmount = 0.12 + index * 0.08;
    const bidPrice = basePrice - (index + 1) * 18.5;
    const askPrice = basePrice + (index + 1) * 18.5;
    bidRunningTotal += bidAmount;
    askRunningTotal += askAmount;
    bidLevels.push({ side: "bid", price: bidPrice, amount: bidAmount, total: bidRunningTotal });
    askLevels.push({ side: "ask", price: askPrice, amount: askAmount, total: askRunningTotal });
  }

  state.dashboard.orderBook = {
    bids: bidLevels,
    asks: [...askLevels].reverse(),
    spread: askLevels[0].price - bidLevels[0].price,
    bestBid: bidLevels[0].price,
    bestAsk: askLevels[0].price,
  };
  renderOrderBook();
}

function loadTradeHistory() {
  const pairs = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT"];
  state.dashboard.tradeHistory = Array.from({ length: 10 }, (_, index) => {
    const pair = pairs[index % pairs.length];
    const baseSymbol = pair.split("/")[0];
    const snapshot = getMarketSnapshot(baseSymbol);
    const side = index % 2 === 0 ? "Buy" : "Sell";
    const priceOffset = (index % 5) * 4.75;
    const price = snapshot.price + (side === "Buy" ? priceOffset : -priceOffset);
    return {
      time: new Date(Date.now() - index * 60000).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      pair,
      side,
      price,
      amount: 0.05 + index * 0.015,
    };
  });
  renderTradeHistory();
}

function addToWatchlist() {
  const input = document.getElementById("watchlistAddInput");
  const symbol = String(input?.value || "").trim().toUpperCase();
  if (!symbol) {
    return;
  }

  if (!state.dashboard.watchlist.some((entry) => entry.symbol === symbol)) {
    state.dashboard.watchlist.push(getMarketSnapshot(symbol));
  }
  input.value = "";
  renderWatchlist();
}

function removeFromWatchlist(symbol) {
  state.dashboard.watchlist = state.dashboard.watchlist.filter((entry) => entry.symbol !== symbol);
  renderWatchlist();
}

function createAlert() {
  const symbol = String(document.getElementById("alertSymbol")?.value || "").trim().toUpperCase();
  const targetPrice = Number(document.getElementById("alertPrice")?.value || 0);
  const direction = String(document.getElementById("alertDirection")?.value || "above").trim().toLowerCase();
  if (!symbol || !Number.isFinite(targetPrice) || targetPrice <= 0) {
    return;
  }

  state.dashboard.alerts.unshift({
    symbol,
    targetPrice,
    direction: direction === "below" ? "below" : "above",
    status: "Watching",
  });

  const symbolInput = document.getElementById("alertSymbol");
  const priceInput = document.getElementById("alertPrice");
  const directionInput = document.getElementById("alertDirection");
  if (symbolInput) {
    symbolInput.value = "";
  }
  if (priceInput) {
    priceInput.value = "";
  }
  if (directionInput) {
    directionInput.value = "above";
  }
  renderAlerts();
}

function removeAlert(index) {
  const alertIndex = Number(index);
  if (!Number.isInteger(alertIndex) || alertIndex < 0) {
    return;
  }
  state.dashboard.alerts.splice(alertIndex, 1);
  renderAlerts();
}

function runQuickTrade(side) {
  const amount = Number(document.getElementById("quickTradeAmount")?.value || 0);
  const pair = String(document.getElementById("quickTradePair")?.value || "BTC").trim().toUpperCase();
  if (!Number.isFinite(amount) || amount <= 0) {
    renderQuickTradeStatus("Quick Trade", "Enter an amount greater than zero to place a simulated order.");
    return;
  }

  const snapshot = getMarketSnapshot(pair);
  renderQuickTradeStatus(
    side === "buy" ? "Quick Buy queued" : "Quick Sell queued",
    `${side === "buy" ? "Bought" : "Sold"} ${formatPlainNumber(amount, 4)} ${pair} near ${formatCompactCurrency(snapshot.price, snapshot.price > 1000 ? 0 : 2)}.`
  );
}

function renderPortfolio() {
  const body = document.getElementById("portfolioBody");
  const summary = document.getElementById("portfolioSummary");
  if (!body || !summary) {
    return;
  }

  if (!state.dashboard.portfolioHoldings.length) {
    body.innerHTML = '<tr><td colspan="4" class="empty">Load a wallet address to review on-chain balances.</td></tr>';
    summary.innerHTML = `
      <article>
        <strong>Portfolio idle</strong>
        <p class="meta">${escapeHtml(state.dashboard.portfolioSummary || "Enter an address and network to calculate holdings.")}</p>
      </article>
    `;
    renderPortfolioAnalytics();
    return;
  }

  body.innerHTML = state.dashboard.portfolioHoldings
    .map(
      (holding) => `
        <tr>
          <td>${escapeHtml(holding.symbol || "N/A")}</td>
          <td>${escapeHtml(formatPlainNumber(holding.amount || 0, 6))}</td>
          <td>${escapeHtml(formatCompactCurrency(holding.valueUsd || 0))}</td>
          <td>${escapeHtml(formatPlainNumber(holding.portfolioShare || 0, 2))}%</td>
        </tr>
      `
    )
    .join("");

  summary.innerHTML = `
    <article>
      <strong>Total value ${escapeHtml(formatCompactCurrency(state.dashboard.portfolioTotalValue || 0))}</strong>
      <p class="meta">${escapeHtml(state.dashboard.portfolioSummary || `${state.dashboard.portfolioHoldings.length} holdings loaded.`)}</p>
    </article>
  `;
  renderPortfolioAnalytics();
}

function getPortfolioAnalyticsRows() {
  const holdings = state.dashboard.portfolioHoldings || [];
  return holdings.map((holding, index) => {
    const snapshot = getMarketSnapshot(holding.symbol || `ASSET${index + 1}`);
    return {
      ...holding,
      returnPct: Number(snapshot.change24h) || ((index % 2 === 0 ? 1 : -1) * (index + 1.25)),
    };
  });
}

function renderPortfolioAnalytics() {
  const totalReturn = document.getElementById("portTotalReturn");
  const bestAsset = document.getElementById("portBestAsset");
  const worstAsset = document.getElementById("portWorstAsset");
  const chart = document.getElementById("portfolioChart");
  if (!totalReturn || !bestAsset || !worstAsset || !chart) {
    return;
  }

  const analytics = getPortfolioAnalyticsRows();
  if (!analytics.length) {
    totalReturn.textContent = "--";
    bestAsset.textContent = "--";
    worstAsset.textContent = "--";
    const context = safeGetCanvasContext(chart);
    if (context) {
      context.clearRect(0, 0, chart.width, chart.height);
      context.fillStyle = "#8aa2c8";
      context.font = "14px Inter, Arial, sans-serif";
      context.fillText("Chart rendering requires ChartJS", 16, 28);
    }
    return;
  }

  const weightedReturn = analytics.reduce(
    (sum, holding) => sum + (Number(holding.portfolioShare || 0) / 100) * Number(holding.returnPct || 0),
    0
  );
  const best = analytics.reduce((top, current) => (Number(current.returnPct) > Number(top.returnPct) ? current : top), analytics[0]);
  const worst = analytics.reduce((bottom, current) => (Number(current.returnPct) < Number(bottom.returnPct) ? current : bottom), analytics[0]);
  totalReturn.textContent = `${formatPlainNumber(weightedReturn, 2)}%`;
  bestAsset.textContent = `${best.symbol} (${formatPlainNumber(best.returnPct, 2)}%)`;
  worstAsset.textContent = `${worst.symbol} (${formatPlainNumber(worst.returnPct, 2)}%)`;

  const context = safeGetCanvasContext(chart);
  if (!context) {
    return;
  }
  const width = chart.width;
  const height = chart.height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#0f1b2d";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "#39d0ff";
  context.lineWidth = 2;
  context.beginPath();
  analytics.forEach((holding, index) => {
    const x = analytics.length === 1 ? width / 2 : 20 + (index * (width - 40)) / (analytics.length - 1);
    const normalized = Math.max(-10, Math.min(10, Number(holding.returnPct) || 0));
    const y = height / 2 - normalized * 7;
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });
  context.stroke();
}

function calculateRebalance() {
  const targets = {
    BTC: Number(document.getElementById("rbtcPct")?.value || 0),
    ETH: Number(document.getElementById("rethPct")?.value || 0),
    SOL: Number(document.getElementById("rsolPct")?.value || 0),
    USDT: Number(document.getElementById("rusdtPct")?.value || 0),
  };
  const result = document.getElementById("rebalanceResult");
  if (!result) {
    return;
  }

  const totalTarget = Object.values(targets).reduce((sum, value) => sum + value, 0);
  if (Math.abs(totalTarget - 100) > 0.001) {
    result.innerHTML = '<article><strong>Allocation error</strong><p class="meta">Target allocations must total 100%.</p></article>';
    return;
  }

  const currentAllocations = { BTC: 40, ETH: 22, SOL: 13, USDT: 25 };
  const portfolioValue = state.dashboard.portfolioTotalValue || 40000;
  const suggestions = Object.entries(targets)
    .map(([symbol, targetPct]) => {
      const deltaPct = targetPct - (currentAllocations[symbol] || 0);
      const deltaValue = (portfolioValue * deltaPct) / 100;
      return {
        symbol,
        action: deltaValue >= 0 ? "Buy" : "Sell",
        amount: Math.abs(deltaValue),
        deltaPct,
      };
    })
    .filter((entry) => entry.amount > 0.01);

  result.innerHTML = suggestions.length
    ? suggestions
        .map(
          (entry) => `
            <article>
              <strong>${escapeHtml(`${entry.action} ${entry.symbol}`)}</strong>
              <p class="meta">${escapeHtml(`${formatPlainNumber(Math.abs(entry.deltaPct), 2)}% adjustment · ${formatCompactCurrency(entry.amount, 0)}`)}</p>
            </article>
          `
        )
        .join("")
    : '<article><strong>Portfolio aligned</strong><p class="meta">Current holdings already match target allocations.</p></article>';
}

function refreshSocialFeed() {
  state.socialFeed = getMockSocialFeedItems();
  renderSocialFeed();
}

function refreshProposals() {
  if (!state.proposals.length) {
    state.proposals = getMockProposals();
  }
  renderProposals();
}

function refreshBots() {
  if (!state.bots.length) {
    state.bots = getMockBots();
  }
  renderBots();
}

async function createTokenLaunch() {
  const name = String(document.getElementById("launchName")?.value || "").trim();
  const symbol = String(document.getElementById("launchSymbol")?.value || "").trim().toUpperCase();
  const supply = Number(document.getElementById("launchSupply")?.value || 0);
  const decimals = Number(document.getElementById("launchDecimals")?.value || 18);
  const description = String(document.getElementById("launchDesc")?.value || "").trim();
  const resultNode = document.getElementById("launchResult");

  if (!name || !symbol || !supply) {
    if (resultNode) {
      resultNode.innerHTML = '<article><strong>Create token</strong><p class="meta">Name, symbol and supply are required.</p></article>';
    }
    return;
  }

  const payload = { name, symbol, supply, decimals, description };
  const result = await apiCall("/api/erc1155/mint", {
    key: "launchpad-create-token",
    method: "POST",
    body: payload,
    skipAuthRedirect: true,
  }).catch(() => ({
    status: "mock-deployed",
    txHash: `0xLAUNCH${Date.now().toString(16).toUpperCase()}`,
  }));

  state.launchpadLaunches.unshift({
    id: `launch_${Date.now()}`,
    token: name,
    symbol,
    supply,
    status: "Live",
    raised: Math.round(supply * 0.08),
    goal: Math.round(supply * 0.2),
  });
  state.launchpadLaunches = state.launchpadLaunches.slice(0, 10);
  renderLaunchpad();

  if (resultNode) {
    resultNode.innerHTML = `
      <article>
        <strong>${escapeHtml(`${name} deployed`)}</strong>
        <p class="meta">${escapeHtml(`Symbol ${symbol} · ${formatPlainNumber(supply, 0)} supply · ${result.txHash || result.status || "submitted"}`)}</p>
      </article>
    `;
  }
}

function submitProposal() {
  const title = String(document.getElementById("proposalTitle")?.value || "").trim();
  const description = String(document.getElementById("proposalDesc")?.value || "").trim();
  const duration = String(document.getElementById("proposalDuration")?.value || "7d");
  if (!title || !description) {
    showToast("Proposal title and description are required", "warning");
    return;
  }

  const nextId = state.proposals.reduce((maxId, proposal) => Math.max(maxId, Number(proposal.id) || 0), 0) + 1;
  state.proposals.unshift({
    id: nextId,
    title,
    description,
    status: "Active",
    votesFor: 0,
    votesAgainst: 0,
    deadline: duration,
  });
  renderProposals();
  showToast("Proposal submitted", "positive");
}

function voteOnProposal(proposalId, field) {
  state.proposals = state.proposals.map((proposal) =>
    String(proposal.id) === String(proposalId)
      ? { ...proposal, [field]: Number(proposal[field] || 0) + 1 }
      : proposal
  );
  renderProposals();
}

function postTradeIdea() {
  const text = String(document.getElementById("tradeIdeaText")?.value || "").trim();
  const pair = String(document.getElementById("ideaPair")?.value || "").trim().toUpperCase();
  const direction = String(document.getElementById("ideaDirection")?.value || "Neutral");
  if (!text || !pair) {
    showToast("Enter an idea and pair before posting", "warning");
    return;
  }

  const username = `AtlasTrader${state.socialFeed.length + 1}`;
  state.socialFeed.unshift({
    id: `feed_${Date.now()}`,
    username,
    pair,
    direction,
    text,
    timestamp: formatTimestamp(),
    likes: 0,
  });
  state.socialFeed = state.socialFeed.slice(0, 20);
  renderSocialFeed();
}

function likePost(postId) {
  state.socialFeed = state.socialFeed.map((post) =>
    post.id === postId ? { ...post, likes: Number(post.likes || 0) + 1 } : post
  );
  renderSocialFeed();
}

function createBot() {
  const name = String(document.getElementById("botName")?.value || "").trim();
  const strategy = String(document.getElementById("botStrategy")?.value || "Grid");
  const pair = String(document.getElementById("botPair")?.value || "").trim().toUpperCase();
  const investment = Number(document.getElementById("botInvestment")?.value || 0);
  const resultNode = document.getElementById("botResult");
  if (!name || !pair || !investment) {
    if (resultNode) {
      resultNode.innerHTML = '<article><strong>Create bot</strong><p class="meta">Name, pair and investment are required.</p></article>';
    }
    return;
  }

  state.bots.unshift({
    id: `bot_${Date.now()}`,
    name,
    strategy,
    pair,
    status: "Running",
    pnl: 0,
    trades: 0,
    investment,
  });
  renderBots();
  if (resultNode) {
    resultNode.innerHTML = `
      <article>
        <strong>${escapeHtml(`${name} created`)}</strong>
        <p class="meta">${escapeHtml(`${strategy} bot launched on ${pair} with ${formatCompactCurrency(investment, 0)} capital.`)}</p>
      </article>
    `;
  }
}

function toggleBot(botId) {
  state.bots = state.bots.map((bot) =>
    bot.id === botId
      ? { ...bot, status: bot.status === "Running" ? "Paused" : "Running" }
      : bot
  );
  renderBots();
}

function deleteBot(botId) {
  state.bots = state.bots.filter((bot) => bot.id !== botId);
  renderBots();
}

function getMockNewsItems() {
  return [
    { category: "bitcoin", headline: "Bitcoin ETFs see renewed inflows after macro cooldown", source: "Atlas Wire", time: "5m ago", sentiment: "Bullish" },
    { category: "ethereum", headline: "Ethereum validators brace for higher staking participation", source: "Chain Desk", time: "14m ago", sentiment: "Neutral" },
    { category: "defi", headline: "DeFi lending volumes rebound as stablecoin liquidity expands", source: "Liquidity Post", time: "21m ago", sentiment: "Bullish" },
    { category: "nft", headline: "NFT floor prices soften as traders rotate into infrastructure plays", source: "Market Mosaic", time: "37m ago", sentiment: "Bearish" },
    { category: "bitcoin", headline: "Options desks hedge around Bitcoin resistance near recent highs", source: "Derivatives Daily", time: "52m ago", sentiment: "Neutral" },
  ];
}

function getSentimentBadgeClass(sentiment) {
  if (sentiment === "Bullish") {
    return "badge-bull";
  }
  if (sentiment === "Bearish") {
    return "badge-bear";
  }
  return "badge-neutral";
}

function renderNewsFeed(category = "all") {
  const feed = document.getElementById("newsFeed");
  if (!feed) {
    return;
  }

  const items = state.dashboard.newsItems || [];
  if (!items.length) {
    feed.innerHTML = '<article class="news-card"><strong>News standby</strong><p class="meta">Refresh News to load the latest market headlines.</p></article>';
    return;
  }

  const normalizedCategory = String(category || "all").toLowerCase();
  const filteredItems = normalizedCategory === "all"
    ? items
    : items.filter((item) => String(item.category || "").toLowerCase() === normalizedCategory);
  const categoryLabel = normalizedCategory === "all" ? "All categories" : normalizedCategory;

  feed.innerHTML = filteredItems
    .map(
      (item) => `
        <article class="news-card">
          <strong>${escapeHtml(item.headline)}</strong>
          <p class="meta">${escapeHtml(item.source)} · ${escapeHtml(item.time)} · Filter ${escapeHtml(categoryLabel)}</p>
          <span class="${escapeHtml(getSentimentBadgeClass(item.sentiment))}">${escapeHtml(item.sentiment)}</span>
        </article>
      `
    )
    .join("");
}

function renderGasTracker() {
  const mappings = [
    ["gasSlow", state.dashboard.gasTracker.slow],
    ["gasStandard", state.dashboard.gasTracker.standard],
    ["gasFast", state.dashboard.gasTracker.fast],
  ];
  mappings.forEach(([id, value]) => {
    const node = document.getElementById(id);
    if (node) {
      node.textContent = value == null ? "--" : `${formatPlainNumber(value, 1)} gwei`;
    }
  });
}

function refreshGasTracker() {
  const createValue = (base) => Math.round((base + Math.random() * 3) * 10) / 10;
  state.dashboard.gasTracker = {
    slow: createValue(8),
    standard: createValue(12),
    fast: createValue(18),
  };
  renderGasTracker();
}

function calculateRisk() {
  const balance = Number(document.getElementById("riskBalance")?.value || 0);
  const riskPercent = Number(document.getElementById("riskPercent")?.value || 0);
  const entry = Number(document.getElementById("riskEntry")?.value || 0);
  const stop = Number(document.getElementById("riskStop")?.value || 0);
  const result = document.getElementById("riskResult");
  if (!result) {
    return;
  }

  const priceGap = Math.abs(entry - stop);
  if (!Number.isFinite(balance) || !Number.isFinite(riskPercent) || !Number.isFinite(entry) || !Number.isFinite(stop) || balance <= 0 || riskPercent <= 0 || priceGap <= 0) {
    result.innerHTML = '<article><strong>Risk calculator</strong><p class="meta">Enter valid balance, risk, entry and stop values to calculate position size.</p></article>';
    return;
  }

  const maxLoss = (balance * riskPercent) / 100;
  const positionSize = maxLoss / priceGap;
  const pipValue = positionSize * 0.0001;
  result.innerHTML = `
    <article>
      <strong>Risk summary</strong>
      <p class="meta">${escapeHtml(`Position size ${formatPlainNumber(positionSize, 6)} units · Max loss ${formatCompactCurrency(maxLoss, 2)} · Pip value ${formatPlainNumber(pipValue, 6)}`)}</p>
    </article>
  `;
}

function renderConvertResult(message = "Choose an amount and markets to calculate a conversion.") {
  const result = document.getElementById("convertResult");
  if (!result) {
    return;
  }
  result.innerHTML = `
    <article>
      <strong>Converter</strong>
      <p class="meta">${escapeHtml(message)}</p>
    </article>
  `;
}

function runConverter() {
  const amount = Number(document.getElementById("convertAmount")?.value || 0);
  const from = String(document.getElementById("convertFrom")?.value || "BTC").toUpperCase();
  const to = String(document.getElementById("convertTo")?.value || "USD").toUpperCase();
  const cryptoToUsd = { BTC: 65240, ETH: 3420, SOL: 162, BNB: 590, USDT: 1 };
  const usdToFiat = { USD: 1, EUR: 0.92, GBP: 0.78, JPY: 146, AUD: 1.52 };

  if (!Number.isFinite(amount) || amount <= 0 || !cryptoToUsd[from] || !usdToFiat[to]) {
    renderConvertResult("Enter a valid amount and choose supported currencies.");
    return;
  }

  const convertedValue = amount * cryptoToUsd[from] * usdToFiat[to];
  renderConvertResult(`${formatPlainNumber(amount, 4)} ${from} ≈ ${formatPlainNumber(convertedValue, 2)} ${to}`);
}

function exportPortfolioCsv() {
  const rows = (state.dashboard.portfolioHoldings.length ? state.dashboard.portfolioHoldings : [
    { symbol: "BTC", amount: 0.25, valueUsd: 16310, portfolioShare: 55.4 },
    { symbol: "ETH", amount: 3.2, valueUsd: 10944, portfolioShare: 37.2 },
    { symbol: "SOL", amount: 42, valueUsd: 6804, portfolioShare: 7.4 },
  ]).map((holding) => ({
    symbol: holding.symbol || "N/A",
    amount: Number(holding.amount || 0),
    valueUsd: Number(holding.valueUsd || 0),
    portfolioShare: Number(holding.portfolioShare || 0),
  }));
  const lines = [
    ["Symbol", "Amount", "Value USD", "Portfolio Share %"],
    ...rows.map((holding) => [
      holding.symbol,
      String(holding.amount),
      String(holding.valueUsd),
      String(holding.portfolioShare),
    ]),
  ];
  const csv = lines
    .map((line) => line.map((value) => `"${String(value).replace(/"/g, "\"\"")}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "portfolio-export.csv";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function renderChartData() {
  const panel = document.getElementById("chartDataResult");
  if (!panel) {
    return;
  }

  if (!state.dashboard.chartRows.length) {
    panel.innerHTML = '<article><strong>Chart ready</strong><p class="meta">Load a coin ID to review OHLC candles.</p></article>';
    return;
  }

  panel.innerHTML = `
    <article>
      <strong>${escapeHtml(state.dashboard.chartCoinId || "chart")}</strong>
      <div style="overflow-x: auto; margin-top: 12px;">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Open</th>
              <th>High</th>
              <th>Low</th>
              <th>Close</th>
            </tr>
          </thead>
          <tbody>
            ${state.dashboard.chartRows
              .map(
                (row) => `
                  <tr>
                    <td>${escapeHtml(row.timestamp)}</td>
                    <td>${escapeHtml(formatPlainNumber(row.open, 2))}</td>
                    <td>${escapeHtml(formatPlainNumber(row.high, 2))}</td>
                    <td>${escapeHtml(formatPlainNumber(row.low, 2))}</td>
                    <td>${escapeHtml(formatPlainNumber(row.close, 2))}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </article>
  `;
}

function renderTrendingCoins() {
  const body = document.getElementById("trendingCoinsBody");
  if (!body) {
    return;
  }

  if (!state.dashboard.trendingCoins.length) {
    body.innerHTML = '<tr><td colspan="3" class="empty">Load trending coins to inspect the current movers list.</td></tr>';
    return;
  }

  body.innerHTML = state.dashboard.trendingCoins
    .map(
      (coin) => `
        <tr>
          <td>${escapeHtml(coin.name || coin.id || "Unknown")}</td>
          <td>${escapeHtml(String(coin.symbol || "--").toUpperCase())}</td>
          <td>${escapeHtml(coin.rank == null ? "--" : String(coin.rank))}</td>
        </tr>
      `
    )
    .join("");
}

function renderGlobalStats() {
  const globalMcap = document.getElementById("globalMcap");
  const globalVolume = document.getElementById("globalVolume");
  const globalBtcDom = document.getElementById("globalBtcDom");
  const resultPanel = document.getElementById("globalStatsResult");
  const globalStats = state.dashboard.globalStats || {};

  if (globalMcap) {
    globalMcap.textContent = formatCompactCurrency(globalStats.marketCap || 0, 0);
  }
  if (globalVolume) {
    globalVolume.textContent = formatCompactCurrency(globalStats.volume24h || 0, 0);
  }
  if (globalBtcDom) {
    globalBtcDom.textContent = `${formatPlainNumber(globalStats.btcDominance || 0, 2)}%`;
  }
  if (resultPanel) {
    resultPanel.innerHTML = `
      <article>
        <strong>Global market data</strong>
        <p class="meta">Market cap ${escapeHtml(formatCompactCurrency(globalStats.marketCap || 0, 0))} · Volume ${escapeHtml(formatCompactCurrency(globalStats.volume24h || 0, 0))} · BTC dominance ${escapeHtml(formatPlainNumber(globalStats.btcDominance || 0, 2))}%</p>
      </article>
    `;
  }
}

function renderDexTokens() {
  const body = document.getElementById("dexTokensBody");
  if (!body) {
    return;
  }

  if (!state.dashboard.dexTokens.length) {
    body.innerHTML = '<tr><td colspan="4" class="empty">Load DEX tokens to review supported assets.</td></tr>';
    return;
  }

  body.innerHTML = state.dashboard.dexTokens
    .map(
      (token) => `
        <tr>
          <td>${escapeHtml(token.symbol || "N/A")}</td>
          <td>${escapeHtml(token.name || "N/A")}</td>
          <td>${escapeHtml(token.address || token.contractAddress || token.assetAddress || "N/A")}</td>
          <td>${escapeHtml(token.chain || token.network || "ATLASX3")}</td>
        </tr>
      `
    )
    .join("");
}

function renderDexPools() {
  const body = document.getElementById("dexPoolsBody");
  if (!body) {
    return;
  }

  if (!state.dashboard.dexPools.length) {
    body.innerHTML = '<tr><td colspan="4" class="empty">Load liquidity pools to review TVL and fee tiers.</td></tr>';
    return;
  }

  body.innerHTML = state.dashboard.dexPools
    .map(
      (pool) => `
        <tr>
          <td>${escapeHtml(`${pool.pair || `${pool.tokenA || "?"}/${pool.tokenB || "?"}`}`)}</td>
          <td>${escapeHtml(formatCompactCurrency(pool.tvl ?? pool.totalLiquidity ?? 0))}</td>
          <td>${escapeHtml(pool.volume24h != null ? formatCompactCurrency(pool.volume24h) : "--")}</td>
          <td>${escapeHtml(pool.fee != null ? String(pool.fee) : formatPlainNumber((Number(pool.feeBps) || 0) / 100, 2) + "%")}</td>
        </tr>
      `
    )
    .join("");
}

function renderCryptoSearchResults(query = "") {
  const panel = document.getElementById("cryptoSearchResults");
  if (!panel) {
    return;
  }

  if (!query && !state.dashboard.cryptoSearchResults.length) {
    panel.innerHTML = '<article><p class="meta">Search for a coin ID, symbol or name to load discovery results.</p></article>';
    return;
  }

  if (!state.dashboard.cryptoSearchResults.length) {
    panel.innerHTML = `
      <article>
        <strong>No matches</strong>
        <p class="meta">No coins found for ${escapeHtml(query)}.</p>
      </article>
    `;
    return;
  }

  panel.innerHTML = state.dashboard.cryptoSearchResults
    .map(
      (coin) => `
        <article>
          <strong>${escapeHtml(coin.name || coin.id || "Unknown coin")}</strong>
          <p class="meta">${escapeHtml(String(coin.symbol || "--").toUpperCase())} · ID ${escapeHtml(coin.id || "n/a")} · Rank ${escapeHtml(coin.marketCapRank == null ? "--" : String(coin.marketCapRank))}</p>
        </article>
      `
    )
    .join("");
}

function renderSwapHistory() {
  const body = document.getElementById("swapHistoryBody");
  if (!body) {
    return;
  }

  if (!state.dashboard.swapHistory.length) {
    body.innerHTML = '<tr><td colspan="5" class="empty">Executed swaps will appear here.</td></tr>';
    return;
  }

  body.innerHTML = state.dashboard.swapHistory
    .map(
      (swap) => `
        <tr>
          <td>${escapeHtml(`${swap.fromToken || swap.tokenIn || "?"}/${swap.toToken || swap.tokenOut || "?"}`)}</td>
          <td>${escapeHtml(formatPlainNumber(swap.amountIn ?? swap.amount ?? 0, 4))}</td>
          <td>${escapeHtml(formatPlainNumber(swap.amountOut ?? swap.outputAmount ?? 0, 4))}</td>
          <td>${escapeHtml(formatPlainNumber(swap.rate ?? 0, 4))}</td>
          <td>${escapeHtml(swap.status || "completed")}</td>
        </tr>
      `
    )
    .join("");
}

function renderMTAccount() {
  const panel = document.getElementById("mtAccountInfo");
  if (!panel) {
    return;
  }

  const account = state.dashboard.mtAccount;
  if (!account) {
    panel.innerHTML = '<article><strong>Connection idle</strong><p class="meta">Load the dashboard to request account information.</p></article>';
    return;
  }

  const data = account.data || account;
  panel.innerHTML = `
    <article>
      <strong>${escapeHtml(data.accountName || data.server || "MetaTrader account")}</strong>
      <p class="meta">Balance ${escapeHtml(formatCompactCurrency(data.balance ?? data.equity ?? 0))} · Equity ${escapeHtml(formatCompactCurrency(data.equity ?? data.balance ?? 0))}</p>
    </article>
  `;
}

function renderMTPositions() {
  const body = document.getElementById("mtPositionsBody");
  if (!body) {
    return;
  }

  if (!state.dashboard.mtPositions.length) {
    body.innerHTML = '<tr><td colspan="5" class="empty">No open MetaTrader positions.</td></tr>';
    return;
  }

  body.innerHTML = state.dashboard.mtPositions
    .map(
      (position) => `
        <tr>
          <td>${escapeHtml(position.positionId || position.ticket || "N/A")}</td>
          <td>${escapeHtml(position.symbol || "N/A")}</td>
          <td>${escapeHtml(position.type || position.side || "N/A")}</td>
          <td>${escapeHtml(formatPlainNumber(position.volume ?? position.lots ?? 0, 2))}</td>
          <td class="${Number(position.profit ?? position.pnl ?? 0) >= 0 ? "positive" : "negative"}">${escapeHtml(formatCompactCurrency(position.profit ?? position.pnl ?? 0))}</td>
        </tr>
      `
    )
    .join("");
}

function renderERC1155Transactions() {
  const body = document.getElementById("erc1155TxBody");
  if (!body) {
    return;
  }

  if (!state.dashboard.erc1155Transactions.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty">No ERC-1155 transactions recorded yet.</td></tr>';
    return;
  }

  body.innerHTML = state.dashboard.erc1155Transactions
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.tx_hash || row.transactionHash || row.txHash || "pending")}</td>
          <td>${escapeHtml(row.transaction_type || row.type || "activity")}</td>
          <td>${escapeHtml(row.contract_name || row.contract_address || row.contractAddress || "contract")}</td>
          <td>${escapeHtml(row.token_id ?? row.tokenId ?? "-")}</td>
          <td>${escapeHtml(row.amount ?? "-")}</td>
          <td>${escapeHtml(row.status || "pending")}</td>
        </tr>
      `
    )
    .join("");
}

function renderOptionsChain() {
  const body = document.getElementById("optionsChainBody");
  if (!body) {
    return;
  }

  if (!state.options.chain.length) {
    body.innerHTML = '<tr><td colspan="8" class="empty">Load an options chain to inspect strikes and premiums.</td></tr>';
    return;
  }

  body.innerHTML = state.options.chain
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(formatPlainNumber(row.strike, 0))}</td>
          <td>${escapeHtml(row.expiry)}</td>
          <td class="${row.type === "Call" ? "options-call" : "options-put"}">${escapeHtml(row.type)}</td>
          <td>${escapeHtml(formatPlainNumber(row.bid, 2))}</td>
          <td>${escapeHtml(formatPlainNumber(row.ask, 2))}</td>
          <td>${escapeHtml(row.iv)}</td>
          <td>${escapeHtml(String(row.delta))}</td>
          <td><button type="button" class="secondary" data-action="buy-option" data-option-id="${escapeHtml(row.id)}">Buy</button></td>
        </tr>
      `
    )
    .join("");
}

function renderOptionsPositions() {
  const body = document.getElementById("optionsPositionsBody");
  if (!body) {
    return;
  }

  if (!state.options.positions.length) {
    body.innerHTML = '<tr><td colspan="7" class="empty">No open options positions.</td></tr>';
    return;
  }

  body.innerHTML = state.options.positions
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.underlying)}</td>
          <td>${escapeHtml(formatPlainNumber(row.strike, 0))}</td>
          <td class="${row.type === "Call" ? "options-call" : "options-put"}">${escapeHtml(row.type)}</td>
          <td>${escapeHtml(formatPlainNumber(row.qty, 2))}</td>
          <td>${escapeHtml(formatCompactCurrency(row.premium))}</td>
          <td class="${Number(row.pnl) >= 0 ? "positive" : "negative"}">${escapeHtml(formatCompactCurrency(row.pnl))}</td>
          <td><button type="button" class="secondary" data-action="close-option-position" data-position-id="${escapeHtml(row.id)}">Close</button></td>
        </tr>
      `
    )
    .join("");
}

function renderSupplyTable() {
  const body = document.getElementById("supplyBody");
  if (!body) {
    return;
  }

  if (!state.lending.supplies.length) {
    body.innerHTML = '<tr><td colspan="4" class="empty">No supplied assets yet.</td></tr>';
    return;
  }

  body.innerHTML = state.lending.supplies
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.asset)}</td>
          <td>${escapeHtml(formatPlainNumber(row.amount, 4))}</td>
          <td>${escapeHtml(`${formatPlainNumber(row.apy, 2)}%`)}</td>
          <td>${escapeHtml(formatCompactCurrency(row.rewards))}</td>
        </tr>
      `
    )
    .join("");
}

function renderBorrowTable() {
  const body = document.getElementById("borrowBody");
  if (!body) {
    return;
  }

  if (!state.lending.borrows.length) {
    body.innerHTML = '<tr><td colspan="4" class="empty">No borrowed assets yet.</td></tr>';
    return;
  }

  body.innerHTML = state.lending.borrows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.asset)}</td>
          <td>${escapeHtml(formatPlainNumber(row.amount, 4))}</td>
          <td>${escapeHtml(`${formatPlainNumber(row.rate, 2)}%`)}</td>
          <td class="${getHealthFactorTone(row.healthFactor)}">${escapeHtml(formatPlainNumber(row.healthFactor, 2))}</td>
        </tr>
      `
    )
    .join("");
}

function renderTaxReport() {
  const body = document.getElementById("taxBody");
  const gainsNode = document.getElementById("taxGains");
  const lossesNode = document.getElementById("taxLosses");
  const netNode = document.getElementById("taxNet");
  const owedNode = document.getElementById("taxOwed");
  const exportCsvButton = document.getElementById("exportTaxCsvBtn");
  const exportPdfButton = document.getElementById("exportTaxPdfBtn");
  if (!body) {
    return;
  }

  if (!state.taxTransactions.length) {
    body.innerHTML = '<tr><td colspan="7" class="empty">Generate a report to view taxable events.</td></tr>';
    if (gainsNode) gainsNode.textContent = "--";
    if (lossesNode) lossesNode.textContent = "--";
    if (netNode) netNode.textContent = "--";
    if (owedNode) owedNode.textContent = "--";
    if (exportCsvButton) exportCsvButton.disabled = true;
    if (exportPdfButton) exportPdfButton.disabled = true;
    return;
  }

  const gains = state.taxTransactions.filter((row) => row.gainLoss >= 0).reduce((sum, row) => sum + row.gainLoss, 0);
  const losses = state.taxTransactions.filter((row) => row.gainLoss < 0).reduce((sum, row) => sum + Math.abs(row.gainLoss), 0);
  const net = gains - losses;
  const taxOwed = Math.max(net, 0) * 0.22;

  body.innerHTML = state.taxTransactions
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.date)}</td>
          <td>${escapeHtml(row.type)}</td>
          <td>${escapeHtml(row.asset)}</td>
          <td>${escapeHtml(formatPlainNumber(row.amount, 4))}</td>
          <td>${escapeHtml(formatCompactCurrency(row.costBasis))}</td>
          <td>${escapeHtml(formatCompactCurrency(row.proceeds))}</td>
          <td class="${row.gainLoss >= 0 ? "positive" : "negative"}">${escapeHtml(formatCompactCurrency(row.gainLoss))}</td>
        </tr>
      `
    )
    .join("");

  if (gainsNode) gainsNode.textContent = formatCompactCurrency(gains);
  if (lossesNode) lossesNode.textContent = formatCompactCurrency(losses);
  if (netNode) netNode.textContent = formatCompactCurrency(net);
  if (owedNode) owedNode.textContent = formatCompactCurrency(taxOwed);
  if (exportCsvButton) exportCsvButton.disabled = false;
  if (exportPdfButton) exportPdfButton.disabled = false;
}

function renderAPIKeys() {
  const body = document.getElementById("apiKeysBody");
  if (!body) {
    return;
  }

  if (!state.apiKeys.length) {
    body.innerHTML = '<tr><td colspan="7" class="empty">No API keys available for this account.</td></tr>';
    return;
  }

  body.innerHTML = state.apiKeys
    .map(
      (key) => `
        <tr>
          <td>${escapeHtml(key.name || "API Key")}</td>
          <td>${escapeHtml(key.maskedKey || maskKey(key.keyId || key.id || ""))}</td>
          <td>${escapeHtml(Array.isArray(key.permissions) ? key.permissions.join(", ") : key.permissions || "default")}</td>
          <td>${escapeHtml(key.createdAt || key.created || "--")}</td>
          <td>${escapeHtml(key.lastUsed || "Never")}</td>
          <td>${escapeHtml(key.status || (key.revoked ? "revoked" : "active"))}</td>
          <td><button type="button" class="secondary" data-action="revoke-api-key" data-key-id="${escapeHtml(key.keyId || key.id || "")}">Revoke</button></td>
        </tr>
      `
    )
    .join("");
}

function renderSystemStatus() {
  const services = state.systemStatus.services || [];
  const body = document.getElementById("statusTimingBody");
  if (body) {
    body.innerHTML = services.length
      ? services.map((entry) => `
        <tr>
          <td>${escapeHtml(entry.service)}</td>
          <td>${escapeHtml(entry.lastPing)}</td>
          <td>${escapeHtml(entry.avgResponse)}</td>
          <td>${escapeHtml(entry.uptime)}</td>
        </tr>
      `).join("")
      : '<tr><td colspan="4" class="empty">No system checks yet.</td></tr>';
  }

  services.forEach((entry) => {
    const node = document.getElementById(entry.id);
    if (!node) {
      return;
    }
    const dot = entry.status === "Online" ? "🟢" : entry.status === "Offline" ? "🔴" : "🟡";
    node.className = statusToneClass(entry.status);
    node.textContent = `${dot} ${entry.status}`;
  });
}

function renderP2POrders() {
  const body = document.getElementById("p2pOrdersBody");
  if (!body) {
    return;
  }

  if (!state.dashboard.p2pOrders.length) {
    body.innerHTML = '<tr><td colspan="5" class="empty">No active orders yet.</td></tr>';
    return;
  }

  body.innerHTML = state.dashboard.p2pOrders
    .map(
      (order) => `
        <tr>
          <td>${escapeHtml(order.orderId)}</td>
          <td>${escapeHtml(order.crypto)}/${escapeHtml(order.fiat)}</td>
          <td>${escapeHtml(order.pricePerUnit)}</td>
          <td>${escapeHtml(order.minOrder)} - ${escapeHtml(order.maxOrder)}</td>
          <td><button type="button" class="secondary" data-action="accept-p2p-order" data-order-id="${escapeHtml(order.orderId)}">Accept</button></td>
        </tr>
      `
    )
    .join("");
}

function renderMyP2POrders() {
  const body = document.getElementById("p2pMyOrdersBody");
  if (!body) {
    return;
  }

  if (!state.dashboard.p2pMyOrders.length) {
    body.innerHTML = '<tr><td colspan="5" class="empty">No personal orders found.</td></tr>';
    return;
  }

  body.innerHTML = state.dashboard.p2pMyOrders
    .map(
      (order) => `
        <tr>
          <td>${escapeHtml(order.orderId)}</td>
          <td>${escapeHtml(order.type)}</td>
          <td>${escapeHtml(order.amount)}</td>
          <td>${escapeHtml(order.status || "open")}</td>
          <td>${escapeHtml(order.createdAt || "recent")}</td>
        </tr>
      `
    )
    .join("");
}

function renderFollowingTraders() {
  const body = document.getElementById("followingTradersBody");
  if (!body) {
    return;
  }

  const following = state.following.length ? state.following : state.dashboard.following;

  if (!following.length) {
    body.innerHTML = '<tr><td colspan="4" class="empty">Follow expert traders to mirror trades.</td></tr>';
    return;
  }

  body.innerHTML = following
    .map(
      (trader) => `
        <tr>
          <td>${escapeHtml(trader.displayName || `Trader ${trader.traderId}`)}</td>
          <td>${escapeHtml(trader.performance?.["30d"]?.return ?? 0)}%</td>
          <td>${escapeHtml(trader.stats?.winRate ?? 0)}%</td>
          <td>
            <button type="button" class="secondary" data-action="follow-trader" data-trader-id="${escapeHtml(trader.traderId)}">Follow</button>
          </td>
        </tr>
      `
    )
    .join("");
}

function renderPredictionPositions() {
  const body = document.getElementById("predictionPositionsBody");
  if (!body) {
    return;
  }

  if (!state.dashboard.predictionPositions.length) {
    body.innerHTML = '<tr><td colspan="4" class="empty">No prediction positions yet.</td></tr>';
    return;
  }

  body.innerHTML = state.dashboard.predictionPositions
    .map(
      (position) => `
        <tr>
          <td>${escapeHtml(position.marketName || position.marketId)}</td>
          <td>${escapeHtml(position.prediction)}</td>
          <td>${escapeHtml(position.amount)}</td>
          <td>${escapeHtml(position.status || "open")}</td>
        </tr>
      `
    )
    .join("");
}

function renderPredictionLeaderboard() {
  const body = document.getElementById("predictionLeaderboardBody");
  if (!body) {
    return;
  }

  if (!state.dashboard.predictionLeaderboard.length) {
    body.innerHTML = '<tr><td colspan="4" class="empty">Leaderboard loads after authentication.</td></tr>';
    return;
  }

  body.innerHTML = state.dashboard.predictionLeaderboard
    .map(
      (entry) => `
        <tr>
          <td>${escapeHtml(entry.displayName || entry.username || `Trader ${entry.userId || "N/A"}`)}</td>
          <td>${escapeHtml(entry.pnl ?? entry.totalPnl ?? 0)}</td>
          <td>${escapeHtml(entry.hitRate ?? entry.winRate ?? 0)}%</td>
          <td><button type="button" class="secondary" data-action="place-prediction" data-market-id="${escapeHtml(entry.marketId || "macro-btc-weekly")}">Place signal</button></td>
        </tr>
      `
    )
    .join("");
}

function normalizeHardhatContracts(payload) {
  const rawContracts = [];

  if (Array.isArray(payload?.contracts)) {
    rawContracts.push(...payload.contracts);
  } else if (payload?.contracts && typeof payload.contracts === "object") {
    rawContracts.push(
      ...Object.entries(payload.contracts).map(([contractName, value]) =>
        typeof value === "string" ? { contractName, address: value } : { contractName, ...value }
      )
    );
  } else if (payload?.deployment?.address) {
    rawContracts.push(payload.deployment);
  } else if (Array.isArray(payload?.assets)) {
    rawContracts.push(
      ...payload.assets.map((asset) => ({
        contractName: asset.name || asset.symbol || "Registry Asset",
        address: asset.assetAddress || asset.metadataUri || asset.registrar || "N/A",
        network: asset.chainId || payload?.deployment?.chainId || "31337",
        status: "registered",
        actionLabel: asset.symbol || "Ready",
      }))
    );
  } else if (Array.isArray(payload)) {
    rawContracts.push(...payload);
  }

  return rawContracts
    .filter(Boolean)
    .map((contract, index) => ({
      contract: contract.contract || contract.contractName || contract.name || `Contract ${index + 1}`,
      address: contract.address || contract.assetAddress || contract.value || "N/A",
      network: contract.network || contract.chainId || payload?.network || payload?.deployment?.chainId || "31337",
      status: contract.status || (contract.address ? "deployed" : "pending"),
      action: contract.action || contract.actionLabel || "Ready",
    }));
}

function renderHardhatAssets() {
  const body = document.getElementById("hardhatAssetsBody");
  if (!body) {
    return;
  }

  if (!state.dashboard.hardhatAssets.length) {
    body.innerHTML = '<tr><td colspan="5" class="empty">Deploy ATLASX3 contracts to load local DEX addresses.</td></tr>';
    return;
  }

  body.innerHTML = state.dashboard.hardhatAssets
    .map(
      (asset) => `
        <tr>
          <td>${escapeHtml(asset.contract)}</td>
          <td>${escapeHtml(asset.address)}</td>
          <td>${escapeHtml(asset.network)}</td>
          <td>${escapeHtml(asset.status)}</td>
          <td>${escapeHtml(asset.action)}</td>
        </tr>
      `
    )
    .join("");
}

function renderHardhatAccounts() {
  const body = document.getElementById("hardhatAccountsBody");
  if (!body) {
    return;
  }

  if (!state.dashboard.hardhatAccounts.length) {
    body.innerHTML = '<tr><td colspan="3" class="empty">Load the local Hardhat accounts to inspect funded test wallets.</td></tr>';
    return;
  }

  body.innerHTML = state.dashboard.hardhatAccounts
    .map(
      (account, index) => `
        <tr>
          <td>${escapeHtml(index + 1)}</td>
          <td>${escapeHtml(account.address || account.account || "N/A")}</td>
          <td>${escapeHtml(account.balance ?? account.eth ?? account.formattedBalance ?? "0")}</td>
        </tr>
      `
    )
    .join("");
}

function appendAssistantMessage(role, message) {
  state.assistantMessages.push({ role, message });
  const panel = document.getElementById("assistantMessages");
  if (!panel) {
    return;
  }

  panel.innerHTML = state.assistantMessages
    .map(
      (item) => `
        <article>
          <strong>${item.role === "user" ? "You" : "ATLASX3"}</strong>
          <p class="meta">${escapeHtml(item.message)}</p>
        </article>
      `
    )
    .join("");
}

async function loadP2POrders() {
  try {
    const result = await apiCall("/api/p2p/orders", { key: "p2p-orders" });
    state.dashboard.p2pOrders = result.orders || result.data || result;
  } catch {
    state.dashboard.p2pOrders = [
      {
        orderId: "ORDER_BTC_001",
        crypto: "BTC",
        fiat: "USD",
        pricePerUnit: 65000,
        minOrder: 0.01,
        maxOrder: 0.25,
      },
    ];
  }

  renderP2POrders();
}

async function loadMyP2POrders() {
  try {
    const result = await apiCall("/api/p2p/orders/my", { key: "p2p-my-orders" });
    state.dashboard.p2pMyOrders = result.orders || result.data || result;
  } catch {
    state.dashboard.p2pMyOrders = [
      { orderId: "MY_ORDER_1", type: "sell", amount: 0.2, status: "open", createdAt: "now" },
    ];
  }

  renderMyP2POrders();
}

async function loadFollowingTraders() {
  try {
    const tradersResponse = await apiCall("/api/copy-trading/traders/top", {
      key: "copy-trading-traders",
    });
    const statsResponse = await apiCall("/api/copy-trading/stats", {
      key: "copy-trading-stats",
    });
    const baseTraders = tradersResponse.traders || tradersResponse.data || tradersResponse;
    const stats = statsResponse.stats || statsResponse;
    syncFollowingState((Array.isArray(baseTraders) ? baseTraders : []).map((trader) => ({
      ...trader,
      stats: trader.stats || stats,
      performance: trader.performance || { "30d": { return: stats.return30d || 0 } },
    })));
  } catch {
    syncFollowingState([
      {
        traderId: 1,
        displayName: "Atlas Trader",
        stats: { winRate: 64 },
        performance: { "30d": { return: 18.4 } },
      },
    ]);
  }

  renderFollowingTraders();
}

async function loadPredictionPositions() {
  try {
    const result = await apiCall("/api/prediction/positions", {
      key: "prediction-positions",
    });
    state.dashboard.predictionPositions = result.positions || result.data || result;
  } catch {
    state.dashboard.predictionPositions = [
      { marketId: "btc-weekly", marketName: "BTC Weekly Close", prediction: "above", amount: 150, status: "open" },
    ];
  }

  renderPredictionPositions();
}

async function loadPredictionLeaderboard() {
  try {
    const result = await apiCall("/api/prediction/leaderboard", {
      key: "prediction-leaderboard",
    });
    state.dashboard.predictionLeaderboard = result.leaderboard || result.data || result;
  } catch {
    state.dashboard.predictionLeaderboard = [
      { userId: 7, displayName: "Macro Atlas", pnl: 2840, hitRate: 71, marketId: "btc-weekly" },
    ];
  }

  renderPredictionLeaderboard();
}

async function loadHardhatAssets() {
  try {
    const result = await apiCall("/api/hardhat/assets", {
      key: "hardhat-contracts",
    });
    state.dashboard.hardhatAssets = normalizeHardhatContracts(result);
  } catch {
    state.dashboard.hardhatAssets = [];
  }

  renderHardhatAssets();
}

async function loadHardhatAccounts() {
  try {
    const result = await apiCall("/api/hardhat/accounts", {
      key: "hardhat-accounts",
    });
    state.dashboard.hardhatAccounts = result.accounts || result.data || result || [];
  } catch {
    state.dashboard.hardhatAccounts = [];
  }

  renderHardhatAccounts();
}


async function loadMarketPrices() {
  try {
    const result = await apiCall("/api/crypto/prices", {
      key: "market-prices",
    });
    state.dashboard.marketCurrency = result.currency || "usd";
    state.dashboard.marketPrices = normalizeMarketPrices(result.prices || result.data || result, state.dashboard.marketCurrency);
  } catch {
    state.dashboard.marketCurrency = "usd";
    state.dashboard.marketPrices = [
      { symbol: "BTC", price: 65240, change24h: 2.1, marketCap: 1280000000000, volume24h: 32000000000 },
      { symbol: "ETH", price: 3420, change24h: 1.4, marketCap: 410000000000, volume24h: 18000000000 },
      { symbol: "SOL", price: 162, change24h: -0.8, marketCap: 72000000000, volume24h: 4200000000 },
      { symbol: "BNB", price: 590, change24h: 0.5, marketCap: 86000000000, volume24h: 1600000000 },
    ];
  }

  renderMarketPrices();
  state.dashboard.watchlist = state.dashboard.watchlist.map((entry) => getMarketSnapshot(entry.symbol));
  renderWatchlist();
  refreshOrderBook();
}

async function loadPortfolio() {
  const addressInput = document.getElementById("portfolioAddressInput");
  const networkSelect = document.getElementById("portfolioNetworkSelect");
  const selectedNetwork = String(networkSelect?.value || "ethereum");
  const addresses = String(addressInput?.value || "")
    .split(/[,\n]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  if (!addresses.length) {
    state.dashboard.portfolioHoldings = [];
    state.dashboard.portfolioTotalValue = 0;
    state.dashboard.portfolioSummary = "Add at least one address to load holdings.";
    renderPortfolio();
    return;
  }

  try {
    const result = await apiCall("/api/portfolio/load", {
      key: "portfolio-load",
      method: "POST",
      body: {
        addresses,
        network: selectedNetwork,
      },
    });

    const portfolio = result.portfolio || {};
    const networkBuckets = ["ethereum", "bsc", "solana", "tron"];
    const allHoldings = networkBuckets.flatMap((network) =>
      normalizeList(portfolio[network] || [], []).map((item) => ({
        network,
        symbol: item.symbol || network.toUpperCase(),
        amount: Number(item.balance ?? item.amount ?? 0),
        valueUsd: Number(item.value ?? item.valueUsd ?? 0),
      }))
    );
    const holdings = allHoldings.filter((item) => item.network === selectedNetwork);
    const totalValue = holdings.reduce((sum, item) => sum + (Number(item.valueUsd) || 0), 0);

    state.dashboard.portfolioHoldings = holdings.map((item) => ({
      ...item,
      portfolioShare: totalValue ? (Number(item.valueUsd) / totalValue) * 100 : 0,
    }));
    state.dashboard.portfolioTotalValue = totalValue;
    state.dashboard.portfolioSummary = `${selectedNetwork.toUpperCase()} · ${addresses.length} address${addresses.length === 1 ? "" : "es"} scanned.`;
  } catch (error) {
    state.dashboard.portfolioHoldings = [];
    state.dashboard.portfolioTotalValue = 0;
    state.dashboard.portfolioSummary = `Portfolio load failed: ${error.message}`;
  }

  renderPortfolio();
}

async function loadChartData(coinId) {
  const normalizedCoinId = String(coinId || "").trim() || "bitcoin";

  try {
    const result = await apiCall(`/api/crypto/ohlc/${encodeURIComponent(normalizedCoinId)}`, {
      key: "crypto-ohlc",
    });
    const rows = Array.isArray(result.data) ? result.data : [];
    state.dashboard.chartCoinId = normalizedCoinId;
    state.dashboard.chartRows = rows.map((row, index) => ({
      timestamp: new Date(Number(Array.isArray(row) ? row[0] : row.timestamp || Date.now()) || Date.now() + index).toLocaleString(),
      open: Number(Array.isArray(row) ? row[1] : row.open ?? 0),
      high: Number(Array.isArray(row) ? row[2] : row.high ?? 0),
      low: Number(Array.isArray(row) ? row[3] : row.low ?? 0),
      close: Number(Array.isArray(row) ? row[4] : row.close ?? 0),
    }));
  } catch {
    state.dashboard.chartCoinId = normalizedCoinId;
    state.dashboard.chartRows = [
      { timestamp: new Date().toLocaleString(), open: 65200, high: 65540, low: 64880, close: 65310 },
      { timestamp: new Date(Date.now() - 3600000).toLocaleString(), open: 64800, high: 65290, low: 64640, close: 65200 },
    ];
  }

  renderChartData();
}

async function loadTrendingCoins() {
  try {
    const result = await apiCall("/api/crypto/trending", {
      key: "crypto-trending",
    });
    state.dashboard.trendingCoins = normalizeList(result.trending || result, []).map((item) => {
      const coin = item.item || item;
      return {
        id: coin.id,
        name: coin.name,
        symbol: coin.symbol,
        rank: coin.market_cap_rank ?? coin.rank ?? coin.score,
      };
    });
  } catch {
    state.dashboard.trendingCoins = [
      { id: "bitcoin", name: "Bitcoin", symbol: "btc", rank: 1 },
      { id: "ethereum", name: "Ethereum", symbol: "eth", rank: 2 },
    ];
  }

  renderTrendingCoins();
}

async function loadGlobalStats() {
  try {
    const result = await apiCall("/api/crypto/global", {
      key: "crypto-global",
    });
    const global = result.global || result.data || result;
    state.dashboard.globalStats = {
      marketCap:
        Number(global?.data?.total_market_cap?.usd ?? global?.total_market_cap?.usd ?? global?.total_market_cap_usd ?? global?.marketCap ?? 0),
      volume24h:
        Number(global?.data?.total_volume?.usd ?? global?.total_volume?.usd ?? global?.total_volume_usd ?? global?.volume24h ?? 0),
      btcDominance:
        Number(global?.data?.market_cap_percentage?.btc ?? global?.market_cap_percentage?.btc ?? global?.btc_dominance ?? global?.btcDominance ?? 0),
    };
  } catch {
    state.dashboard.globalStats = {
      marketCap: 2480000000000,
      volume24h: 128000000000,
      btcDominance: 52.4,
    };
  }

  renderGlobalStats();
}

async function loadDexTokens() {
  try {
    const result = await apiCall("/api/dex/tokens", {
      key: "dex-tokens",
    });
    state.dashboard.dexTokens = normalizeList(result, ["tokens"]);
  } catch {
    state.dashboard.dexTokens = [
      { symbol: "ATX", name: "ATLASX3 Token", address: "N/A", chain: "ATLASX3" },
    ];
  }

  renderDexTokens();
}

async function loadDexPools() {
  try {
    const result = await apiCall("/api/dex/pools", {
      key: "dex-pools",
    });
    state.dashboard.dexPools = normalizeList(result, ["pools"]).map((pool) => ({
      ...pool,
      tvl: Number(pool.tvl ?? pool.totalLiquidity ?? 0),
      volume24h: pool.volume24h ?? pool.volume ?? null,
    }));
  } catch {
    state.dashboard.dexPools = [
      { pair: "BTC/USDT", tvl: 1825000, volume24h: 245000, fee: "0.30%" },
    ];
  }

  renderDexPools();
}

async function searchCrypto(query) {
  const trimmedQuery = String(query || "").trim();
  if (!trimmedQuery) {
    state.dashboard.cryptoSearchResults = [];
    renderCryptoSearchResults();
    return;
  }

  try {
    const result = await apiCall(`/api/crypto/search?q=${encodeURIComponent(trimmedQuery)}`, {
      key: "crypto-search",
    });
    state.dashboard.cryptoSearchResults = normalizeList(result, ["results"]).map((coin) => ({
      id: coin.id,
      name: coin.name,
      symbol: coin.symbol,
      marketCapRank: coin.market_cap_rank ?? coin.rank ?? null,
    }));
  } catch {
    state.dashboard.cryptoSearchResults = [
      { id: trimmedQuery.toLowerCase(), name: trimmedQuery, symbol: trimmedQuery.slice(0, 4), marketCapRank: "--" },
    ];
  }

  renderCryptoSearchResults(trimmedQuery);
}

async function loadSwapHistory() {
  try {
    const result = await apiCall("/api/swap/history", {
      key: "swap-history",
    });
    state.dashboard.swapHistory = normalizeList(result, ["swaps"]);
  } catch {
    state.dashboard.swapHistory = [
      { fromToken: "BTC", toToken: "USDT", amountIn: 0.01, amountOut: 650, rate: 65000, status: "completed" },
    ];
  }

  renderSwapHistory();
}

async function loadMTPositions() {
  try {
    const [positionsResult, accountResult] = await Promise.all([
      apiCall("/api/metatrader/positions", { key: "metatrader-positions" }),
      apiCall("/api/metatrader/account", { key: "metatrader-account" }),
    ]);
    state.dashboard.mtPositions = normalizeList(positionsResult, ["positions"]);
    state.dashboard.mtAccount = accountResult;
  } catch {
    state.dashboard.mtPositions = [
      { positionId: "MT-101", symbol: "EURUSD", type: "BUY", volume: 0.1, profit: 42.5 },
    ];
    state.dashboard.mtAccount = {
      data: { accountName: "Demo MT Account", balance: 25000, equity: 25042.5 },
    };
  }

  renderMTAccount();
  renderMTPositions();
}

async function loadERC1155Transactions() {
  try {
    const result = await apiCall("/api/erc1155/transactions", {
      key: "erc1155-transactions",
    });
    state.dashboard.erc1155Transactions = normalizeList(result, ["transactions"]);
  } catch {
    state.dashboard.erc1155Transactions = [];
  }

  renderERC1155Transactions();
}

async function loadAPIKeys() {
  try {
    const result = await apiCall("/api/keys", {
      key: "api-keys",
    });
    const remoteKeys = normalizeList(result, ["keys"]).map((entry) => normalizeApiKeyRecord(entry));
    if (remoteKeys.length) {
      const localOnly = state.apiKeys.filter((entry) => !remoteKeys.some((remote) => remote.keyId === entry.keyId));
      state.apiKeys = [...localOnly, ...remoteKeys];
    }
  } catch {
    state.apiKeys = Array.isArray(state.apiKeys) ? state.apiKeys : [];
  }

  state.dashboard.apiKeys = state.apiKeys;
  renderAPIKeys();
}

async function checkSystemStatus() {
  const start = typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
  try {
    const response = await fetch(`${apiBase}/api/health`);
    if (!response.ok) {
      throw new Error(`Health request failed: ${response.status}`);
    }
    const payload = await response.json();
    const end = typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
    const latency = Math.round(end - start);
    state.systemStatus.services = getMockSystemStatus(Boolean(payload?.ok), latency);
  } catch {
    state.systemStatus.services = getMockSystemStatus(false, 0);
  }

  state.systemStatus.timings = state.systemStatus.services;
  renderSystemStatus();
}

async function loadTickerRates() {
  try {
    const result = await apiCall("/api/rates", {
      key: "rates-ticker",
    });
    const usd = result.usd || {};
    state.dashboard.ticker = {
      btc: usd.BTC ?? usd.btc ?? null,
      eth: usd.ETH ?? usd.eth ?? null,
      sol: usd.SOL ?? usd.sol ?? null,
      bnb: usd.BNB ?? usd.bnb ?? null,
      dot: usd.DOT ?? usd.dot ?? 4.86,
      matic: usd.MATIC ?? usd.matic ?? 0.74,
      avax: usd.AVAX ?? usd.avax ?? 28.4,
      link: usd.LINK ?? usd.link ?? 18.2,
    };
  } catch {
    state.dashboard.ticker = {
      btc: 65240,
      eth: 3420,
      sol: 162,
      bnb: 590,
      dot: 4.86,
      matic: 0.74,
      avax: 28.4,
      link: 18.2,
    };
  }

  renderTickerRates();
}

async function closeMarginPosition(positionId, price) {
  return apiCall(`/api/margin/position/${encodeURIComponent(positionId)}/close`, {
    key: "margin-close",
    method: "POST",
    body: { price: Number(price) },
  });
}

async function acceptP2POrder(orderId) {
  return apiCall(`/api/p2p/order/${encodeURIComponent(orderId)}/accept`, {
    key: "p2p-accept",
    method: "POST",
    body: {
      orderAmount: 0.1,
      paymentMethod: "Bank Transfer",
    },
  });
}

async function resetDemoAccount() {
  return apiCall("/api/demo/account/reset", {
    key: "demo-reset",
    method: "POST",
  });
}

async function registerCopyTrader(payload) {
  return apiCall("/api/copy-trading/trader/register", {
    key: "copy-trading-register",
    method: "POST",
    body: payload,
  });
}

async function followTrader(traderId) {
  return apiCall(`/api/copy-trading/follow/${encodeURIComponent(traderId)}`, {
    key: "copy-trading-follow",
    method: "POST",
  });
}

function followTraderLocally(traderId) {
  const id = String(traderId || "").trim();
  if (!id) {
    return;
  }
  const existing = state.following.length ? state.following : state.dashboard.following;
  if (existing.some((trader) => String(trader.traderId) === id)) {
    showToast(`Already following ${id}`, "warning");
    return;
  }
  syncFollowingState([
    {
      traderId: id,
      displayName: id.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
      stats: { winRate: 58 },
      performance: { "30d": { return: 12.5 } },
    },
    ...existing,
  ]);
  renderFollowingTraders();
  renderMetrics();
  showToast(`Now following ${id}`);
}

function getFuturesDirection() {
  return state.futuresDirection || "Long";
}

function setFuturesDirection(direction) {
  state.futuresDirection = direction;
  document.querySelectorAll('[data-action="futures-long"], [data-action="futures-short"]').forEach((button) => {
    button.classList.toggle("active", button.dataset.action === `futures-${direction.toLowerCase()}`);
  });
}

function createFuturesPosition(direction) {
  const pair = String(document.getElementById("futuresPair")?.value || "BTC-PERP");
  const leverage = Number(document.getElementById("futuresLeverage")?.value || 10);
  const size = Number(document.getElementById("futuresSize")?.value || 0);
  const marginType = String(document.getElementById("futuresMarginType")?.value || "Isolated");
  const takeProfit = String(document.getElementById("futuresTp")?.value || "").trim();
  const stopLoss = String(document.getElementById("futuresSl")?.value || "").trim();
  const result = document.getElementById("futuresResult");

  if (!size || size <= 0) {
    if (result) {
      result.innerHTML = '<article><strong>Futures order</strong><p class="meta">Enter a valid USD size.</p></article>';
    }
    return;
  }

  const entry = 100 + state.futures.length * 3 + (direction === "Long" ? 2 : -2);
  const position = {
    id: `futures_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    pair,
    direction,
    leverage,
    size,
    marginType,
    takeProfit,
    stopLoss,
    entry: entry.toFixed(2),
    mark: (entry * 1.003).toFixed(2),
    pnl: `${direction === "Long" ? "+" : "-"}${formatPlainNumber(size * 0.018, 2)}`,
  };
  state.futures.unshift(position);
  renderFuturesPositions();
  if (result) {
    result.innerHTML = `
      <article>
        <strong>${escapeHtml(`${pair} ${direction}`)}</strong>
        <p class="meta">${escapeHtml(`Size ${formatPlainNumber(size, 2)} USD at ${leverage}x ${marginType}. TP ${takeProfit || "--"} / SL ${stopLoss || "--"}.`)}</p>
      </article>
    `;
  }
}

function refreshFuturesPositions() {
  state.futures = state.futures.map((position, index) => {
    const drift = (index + 1) * (position.direction === "Long" ? 0.9 : -0.7);
    const nextMark = Number(position.entry) + drift;
    const pnlValue = ((nextMark - Number(position.entry)) * position.size) / Number(position.entry);
    return {
      ...position,
      mark: nextMark.toFixed(2),
      pnl: `${pnlValue >= 0 ? "+" : ""}${formatPlainNumber(pnlValue, 2)}`,
    };
  });
  renderFuturesPositions();
  renderFundingRates();
}

function closeFuturesPosition(positionId) {
  state.futures = state.futures.filter((position) => position.id !== positionId);
  renderFuturesPositions();
  showToast("Futures position closed");
}

async function initiateBridgeTransfer() {
  const from = String(document.getElementById("bridgeFromNet")?.value || "Ethereum");
  const to = String(document.getElementById("bridgeToNet")?.value || "BSC");
  const token = String(document.getElementById("bridgeToken")?.value || "ETH");
  const amount = Number(document.getElementById("bridgeAmount")?.value || 0);
  const recipient = String(document.getElementById("bridgeRecipient")?.value || "").trim();
  const resultNode = document.getElementById("bridgeFeeResult");

  if (!amount || amount <= 0 || !recipient) {
    if (resultNode) {
      resultNode.innerHTML = '<article><strong>Bridge request</strong><p class="meta">Enter a recipient and positive amount.</p></article>';
    }
    return;
  }

  const payload = { fromNetwork: from, toNetwork: to, token, amount, recipient };
  const result = await apiCall("/api/crypto/bridge", {
    key: "bridge-initiate",
    method: "POST",
    body: payload,
    skipAuthRedirect: true,
  }).catch(() => ({
    txHash: `0xBRIDGE${Date.now().toString(16).toUpperCase()}`,
    status: "pending",
    mock: true,
  }));

  const txHash = result.txHash || result.hash || `0xBRIDGE${Date.now().toString(16).toUpperCase()}`;
  state.bridgeHistory.unshift({
    txHash,
    from,
    to,
    token,
    amount: formatPlainNumber(amount, 4),
    status: result.status || "pending",
  });
  renderBridgeHistory();
  if (resultNode) {
    resultNode.innerHTML = `
      <article>
        <strong>Bridge initiated</strong>
        <p class="meta">${escapeHtml(`${txHash} → ${token} ${formatPlainNumber(amount, 4)} to ${recipient}`)}</p>
      </article>
    `;
  }
}

async function verifyEmail() {
  return apiCall("/api/email/verify", {
    key: "email-verify",
    method: "POST",
  });
}

async function sendEmailTest() {
  return apiCall("/api/email/test", {
    key: "email-test",
    method: "POST",
    body: {
      to: state.user?.email || "trader@atlasx3.dev",
      subject: "ATLASX3 SMTP test",
      text: "Integration check from the ATLASX3 dashboard.",
    },
  });
}

async function lookupTransaction(network, txHash) {
  return apiCall(`/api/${network}/transaction/${encodeURIComponent(txHash)}`, {
    key: "transaction-lookup",
  });
}

async function getHardhatStatus() {
  return apiCall("/api/hardhat/status", {
    key: "hardhat-status",
  });
}

async function compileHardhat() {
  return apiCall("/api/hardhat/compile", {
    key: "hardhat-compile",
    method: "POST",
  });
}

async function deployHardhat() {
  return apiCall("/api/hardhat/deploy", {
    key: "hardhat-deploy",
    method: "POST",
  });
}

async function mintHardhatAtx(payload) {
  return apiCall("/api/hardhat/mint", {
    key: "hardhat-mint",
    method: "POST",
    body: payload,
  });
}

async function createHardhatPair(payload) {
  return apiCall("/api/hardhat/pair", {
    key: "hardhat-pair",
    method: "POST",
    body: payload,
  });
}

async function addHardhatLiquidity(payload) {
  return apiCall("/api/hardhat/liquidity", {
    key: "hardhat-liquidity",
    method: "POST",
    body: payload,
  });
}

async function loadHardhatContracts() {
  return apiCall("/api/hardhat/assets", {
    key: "hardhat-contracts",
  });
}

async function loadHardhatAccountsRequest() {
  return apiCall("/api/hardhat/accounts", {
    key: "hardhat-accounts",
  });
}

async function registerHardhatAsset(payload) {
  return apiCall("/api/hardhat/assets", {
    key: "hardhat-register-asset",
    method: "POST",
    body: payload,
  });
}

async function loadAssistantStatus() {
  return apiCall("/api/assistant/status", {
    key: "assistant-status",
    skipAuthRedirect: true,
  });
}

async function chatWithAssistant(message) {
  return apiCall("/api/assistant/chat", {
    key: "assistant-chat",
    method: "POST",
    body: {
      messages: [...state.assistantMessages.map((item) => ({ role: item.role, content: item.message })), { role: "user", content: message }],
    },
  });
}

async function processTerminalPayment(formData) {
  if (!state.user) {
    state.user = { id: 1, email: "trader@atlasx3.dev", username: "Demo Trader" };
  }

  const result = await apiCall("/api/payment-terminal/process", {
    key: "payment-terminal-process",
    method: "POST",
    body: {
      ...formData,
      amount: Number(formData.amount),
      terminalId: `TERMINAL_${state.user.id}`,
    },
  });

  const panel = document.getElementById("terminalResult");
  if (panel) {
    panel.innerHTML = `
      <article>
        <strong>Payment processed</strong>
        <p class="meta">Transaction ${escapeHtml(result.data?.transactionId || "created")} completed for ${escapeHtml(formData.amount)} ${escapeHtml(formData.currency)}.</p>
      </article>
    `;
  }

  return result;
}

async function loadPaymentTerminalTransactions() {
  const result = await apiCall("/api/payment-terminal/transactions", {
    key: "payment-terminal-transactions",
  });
  const panel = document.getElementById("terminalResult");
  if (panel) {
    const rows = result.transactions || result.data || [];
    panel.innerHTML = rows.length
      ? rows
          .map(
            (row) => `
              <article>
                <strong>${escapeHtml(row.transactionId)}</strong>
                <p class="meta">${escapeHtml(row.amount)} ${escapeHtml(row.currency)} · ${escapeHtml(row.status)}</p>
              </article>
            `
          )
          .join("")
      : '<article><strong>No terminal transactions</strong><p class="meta">Process a payment to see recent activity.</p></article>';
  }
  return result;
}

async function loadPaymentHistory() {
  if (!state.token) {
    state.pgPayments = [];
    renderPaymentHistory();
    return { payments: [] };
  }

  const result = await apiCall("/api/payments/history", {
    key: "payments-history",
  });
  state.pgPayments = normalizeList(result, ["payments"]).map((row) => normalizePaymentRecord(row));
  renderPaymentHistory();
  return result;
}

async function loadSavedPaymentMethods() {
  if (!state.token) {
    renderSavedPaymentMethods();
    return { methods: [] };
  }

  const result = await apiCall("/api/payments/saved-methods", {
    key: "payments-saved-methods",
  });
  renderSavedPaymentMethods(normalizeList(result, ["methods"]));
  return result;
}

async function submitPaymentGateway() {
  if (!state.token) {
    renderPgMessage("Payment required", "Sign in to create a payment.");
    showToast("Sign in to create a payment", "warning");
    return null;
  }

  const amountInput = String(document.getElementById("pgAmount")?.value || "").trim();
  const amount = Number(amountInput);
  const currency = String(document.getElementById("pgCurrency")?.value || "USD").toUpperCase();
  const method = state.pgMethod || "card";

  if (!amount || amount <= 0) {
    renderPgMessage(getPgMethodLabel(method), "Enter a valid amount greater than zero.");
    return null;
  }

  const endpoint = method === "crypto" ? "/api/payments/crypto" : "/api/payments/create";
  const payload =
    method === "crypto"
      ? {
          amount: amountInput,
          currency,
          cryptoSymbol: String(document.getElementById("pgCryptoSymbol")?.value || "BTC").toUpperCase(),
        }
      : { amount, currency, method };

  try {
    const result = await apiCall(endpoint, {
      key: "payments-create",
      method: "POST",
      body: payload,
    });
    const payment = normalizePaymentRecord(result.payment || {});
    state.pgPayments = [payment, ...state.pgPayments.filter((row) => row.id !== payment.id)];
    renderPgMessage(getPgMethodLabel(method), payment.instructions || `${payment.id} created successfully.`);
    renderPgSummary(result.payment || payment);
    renderPaymentHistory();
    await loadPaymentHistory().catch(() => null);
    showToast(`${getPgMethodLabel(method)} created`, "positive");
    return result;
  } catch (error) {
    renderPgMessage(getPgMethodLabel(method), error.message);
    showToast(error.message, "negative");
    return null;
  }
}

function estimatePaymentGatewayFee() {
  const amount = Number(document.getElementById("pgAmount")?.value || 0);
  const method = state.pgMethod || "card";

  if (!amount || amount <= 0) {
    renderPgMessage("Fee estimate", "Enter a valid amount greater than zero.");
    return;
  }

  let fee = 0;
  if (method === "card") {
    fee = amount * 0.015 + 0.3;
  } else if (method === "wire") {
    fee = 5;
  } else if (method === "paypal") {
    fee = amount * 0.029;
  }

  renderPgMessage(
    "Fee estimate",
    `${getPgMethodLabel(method)} fee: ${method === "crypto" ? "0.00" : formatPlainNumber(fee, 2)}`
  );
}

async function confirmPaymentRecord(paymentId) {
  if (!state.token || !paymentId) {
    return null;
  }

  try {
    const result = await apiCall(`/api/payments/${encodeURIComponent(paymentId)}/confirm`, {
      key: "payments-confirm",
      method: "POST",
    });
    renderPgMessage("Payment confirmed", result.message || `${paymentId} confirmed.`);
    await loadPaymentHistory();
    return result;
  } catch (error) {
    renderPgMessage("Payment confirm failed", error.message);
    showToast(error.message, "negative");
    return null;
  }
}

async function refundPaymentRecord(paymentId) {
  if (!state.token || !paymentId) {
    return null;
  }

  try {
    const result = await apiCall(`/api/payments/${encodeURIComponent(paymentId)}/refund`, {
      key: "payments-refund",
      method: "POST",
      body: {},
    });
    renderPgMessage("Payment refunded", result.refund?.id || `${paymentId} refunded.`);
    await loadPaymentHistory();
    return result;
  } catch (error) {
    renderPgMessage("Payment refund failed", error.message);
    showToast(error.message, "negative");
    return null;
  }
}

async function saveCurrentPaymentMethod() {
  if (!state.token) {
    renderPgMessage("Save method", "Sign in to save a payment method.");
    return null;
  }

  const payload = {
    type: state.pgMethod || "card",
    label: `My ${state.pgMethod || "card"}`,
    masked: `****${Math.floor(1000 + Math.random() * 9000)}`,
  };

  try {
    const result = await apiCall("/api/payments/saved-methods", {
      key: "payments-save-method",
      method: "POST",
      body: payload,
    });
    await loadSavedPaymentMethods();
    renderPgMessage("Payment method saved", `${payload.label} saved successfully.`);
    return result;
  } catch (error) {
    renderPgMessage("Save method failed", error.message);
    showToast(error.message, "negative");
    return null;
  }
}

function exportPaymentHistoryCsv() {
  if (!state.pgPayments.length) {
    showToast("No payment history to export", "warning");
    return;
  }

  const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [
    ["ID", "Method", "Amount", "Currency", "Status", "Created At"],
    ...state.pgPayments.map((row) => [
      row.id,
      row.method,
      row.amount,
      row.currency,
      row.status,
      row.created_at,
    ]),
  ]
    .map((row) => row.map((value) => escapeCsv(value)).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `atlasx3-payments-${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}


function updateHardhatLog(panelId, payload, title) {
  const panel = document.getElementById(panelId);
  if (!panel) {
    return;
  }

  const output = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  panel.innerHTML = `
    <article>
      <strong>${escapeHtml(title)}</strong>
      <p class="meta">${escapeHtml(output)}</p>
    </article>
  `;
}

function updateHardhatStatusPanel(payload, title) {
  updateHardhatLog("hardhatDeployLog", payload, title);
}


function sanitizeNumericPayload(payload, keys) {
  const nextPayload = { ...payload };
  keys.forEach((key) => {
    if (nextPayload[key] === "" || nextPayload[key] == null) {
      delete nextPayload[key];
      return;
    }
    nextPayload[key] = Number(nextPayload[key]);
  });
  return nextPayload;
}

function toggleRegisterSection() {
  const registerSection = document.getElementById("registerSection");
  const toggleButton = document.querySelector('[data-action="toggle-register"]');
  if (!registerSection) {
    return;
  }

  registerSection.hidden = !registerSection.hidden;
  if (toggleButton) {
    toggleButton.setAttribute("aria-expanded", String(!registerSection.hidden));
  }
}

function bindFormHandlers() {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const marginCloseForm = document.getElementById("marginCloseForm");
  const createP2POrderForm = document.getElementById("createP2POrderForm");
  const copyTraderRegisterForm = document.getElementById("copyTraderRegisterForm");
  const hardhatAssetForm = document.getElementById("hardhatAssetForm");
  const assistantForm = document.getElementById("assistantForm");
  const transactionLookupForm = document.getElementById("transactionLookupForm");
  const paymentTerminalForm = document.getElementById("paymentTerminalForm");
  const themeSelect = document.getElementById("themeSelect");
  const lbPeriod = document.getElementById("lbPeriod");

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    await login({
      email: formData.get("email"),
      password: formData.get("password"),
    });
  });

  registerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(registerForm).entries());
    await registerAccount(payload);
    registerForm.reset();
  });

  marginCloseForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(marginCloseForm);
    await closeMarginPosition(formData.get("positionId"), formData.get("price"));
    await refreshDashboard();
  });

  createP2POrderForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(createP2POrderForm);
    const payload = Object.fromEntries(formData.entries());
    payload.amount = Number(payload.amount);
    payload.pricePerUnit = Number(payload.pricePerUnit);
    payload.minOrder = Number(payload.minOrder);
    payload.maxOrder = Number(payload.maxOrder);
    payload.paymentMethods = String(payload.paymentMethods)
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    await apiCall("/api/p2p/order/create", {
      key: "p2p-create-order",
      method: "POST",
      body: payload,
    });
    await refreshDashboard();
  });

  copyTraderRegisterForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(copyTraderRegisterForm).entries());
    await registerCopyTrader(payload);
    await refreshDashboard();
  });

  hardhatAssetForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(hardhatAssetForm).entries());
    if (payload.chainId) {
      payload.chainId = Number(payload.chainId);
    }
    const result = await registerHardhatAsset(payload);
    updateHardhatStatusPanel(result, "Asset registered");
    await refreshDashboard();
  });

  assistantForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(assistantForm);
    const message = String(formData.get("message") || "").trim();
    if (!message) {
      return;
    }
    appendAssistantMessage("user", message);
    const result = await chatWithAssistant(message).catch(() => ({ message: "Local fallback: review leverage, collateral and order exposure before increasing risk." }));
    appendAssistantMessage("assistant", result.message || "Assistant unavailable.");
    assistantForm.reset();
  });

  transactionLookupForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(transactionLookupForm);
    const network = String(formData.get("network") || "ethereum");
    const txHash = String(formData.get("txHash") || "").trim();
    if (!txHash) {
      return;
    }
    const result = await lookupTransaction(network, txHash).catch((error) => ({ error: error.message }));
    const root = document.getElementById("transactionResult");
    if (root) {
      root.innerHTML = `
        <article>
          <strong>${escapeHtml(network.toUpperCase())} transaction</strong>
          <p class="meta">${escapeHtml(JSON.stringify(result, null, 2))}</p>
        </article>
      `;
    }
  });

  paymentTerminalForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(paymentTerminalForm).entries());
    await processTerminalPayment(payload);
  });

  themeSelect?.addEventListener("change", (event) => {
    const value = String(event.target.value || "system").toLowerCase();
    document.body.dataset.theme = value;
  });

  lbPeriod?.addEventListener("change", () => {
    renderLeaderboard();
  });
}

function bindGlobalHandlers() {
  document.addEventListener("click", async (event) => {
    const target = event.target.closest("button, [data-action], [data-section-target]");
    if (!target) {
      return;
    }

    if (target.dataset.sectionTarget) {
      switchSection(target.dataset.sectionTarget);
      return;
    }

    if (target.dataset.sortCol) {
      sortMarketPrices(target.dataset.sortCol);
      return;
    }

    const action = target.dataset.action;
    if (!action) {
      return;
    }

    if (action === "copy-address") {
      await copyAddress(target.dataset.address, target.dataset.copyLabel || "Address");
      return;
    }

    if (action === "refresh-dashboard") {
      await refreshDashboard();
      return;
    }

    if (action === "show-shortcuts") {
      toggleShortcutsModal(true);
      return;
    }

    if (action === "close-shortcuts") {
      toggleShortcutsModal(false);
      return;
    }

    if (action === "compare-prices") {
      compareExchangePrices();
      return;
    }

    if (action === "run-screener") {
      runScreener();
      return;
    }

    if (action === "save-screen") {
      saveCurrentScreen();
      return;
    }

    if (action === "load-screen") {
      loadSavedScreen(String(target.dataset.screenId || ""));
      return;
    }

    if (action === "delete-screen") {
      deleteSavedScreen(String(target.dataset.screenId || ""));
      return;
    }

    if (action === "refresh-defi") {
      refreshDefiDashboard();
      return;
    }

    if (action === "create-multisig") {
      createMultisigWallet();
      return;
    }

    if (action === "refresh-multisig") {
      refreshMultisigPanel();
      return;
    }

    if (action === "sign-multisig") {
      signMultisigTransaction(String(target.dataset.txId || ""));
      return;
    }

    if (action === "execute-multisig") {
      executeMultisigTransaction(String(target.dataset.txId || ""));
      return;
    }

    if (action === "add-journal-entry") {
      addJournalEntry();
      return;
    }

    if (action === "delete-journal") {
      deleteJournalEntry(String(target.dataset.entryId || ""));
      return;
    }

    if (action === "export-journal") {
      exportJournalCsv();
      return;
    }

    if (action === "post-trade-idea") {
      postTradeIdea();
      return;
    }

    if (action === "refresh-social-feed") {
      refreshSocialFeed();
      return;
    }

    if (action === "like-post") {
      likePost(String(target.dataset.postId || ""));
      return;
    }

    if (action === "create-token") {
      await createTokenLaunch();
      return;
    }

    if (action === "invest-launch" || action === "view-launch") {
      const launch = state.launchpadLaunches.find((entry) => entry.id === String(target.dataset.launchId || ""));
      if (launch) {
        renderResultPanel("launchResult", action === "invest-launch" ? "Launchpad investment" : "Launchpad view", `${launch.token} (${launch.symbol}) · ${launch.status}`);
      }
      return;
    }

    if (action === "submit-proposal") {
      submitProposal();
      return;
    }

    if (action === "refresh-proposals") {
      refreshProposals();
      return;
    }

    if (action === "vote-for") {
      voteOnProposal(String(target.dataset.proposalId || ""), "votesFor");
      return;
    }

    if (action === "vote-against") {
      voteOnProposal(String(target.dataset.proposalId || ""), "votesAgainst");
      return;
    }

    if (action === "create-bot") {
      createBot();
      return;
    }

    if (action === "refresh-bots") {
      refreshBots();
      return;
    }

    if (action === "toggle-bot") {
      toggleBot(String(target.dataset.botId || ""));
      return;
    }

    if (action === "delete-bot") {
      deleteBot(String(target.dataset.botId || ""));
      return;
    }

    if (action === "calc-rebalance") {
      calculateRebalance();
      return;
    }

    if (action === "refresh-leaderboard") {
      renderLeaderboard();
      showToast("Leaderboard refreshed");
      return;
    }

    if (action === "lb-tab") {
      state.leaderboardTab = String(target.dataset.lb || "traders");
      target.parentElement?.querySelectorAll('[data-action="lb-tab"]').forEach((button) => {
        button.classList.toggle("active", button === target);
      });
      renderLeaderboard();
      return;
    }

    if (action === "pg-tab") {
      state.pgMethod = String(target.dataset.pg || "card");
      document.getElementById("payMethodTabs")?.querySelectorAll('[data-action="pg-tab"]').forEach((button) => {
        button.classList.toggle("active", button === target);
      });
      renderPgFields();
      return;
    }

    if (action === "pg-submit") {
      await submitPaymentGateway();
      return;
    }

    if (action === "pg-estimate") {
      estimatePaymentGatewayFee();
      return;
    }

    if (action === "load-payment-history") {
      await loadPaymentHistory().catch((error) => {
        renderPgMessage("Payment history", error.message);
      });
      return;
    }

    if (action === "confirm-payment") {
      await confirmPaymentRecord(String(target.dataset.paymentId || ""));
      return;
    }

    if (action === "refund-payment") {
      await refundPaymentRecord(String(target.dataset.paymentId || ""));
      return;
    }

    if (action === "save-payment-method") {
      await saveCurrentPaymentMethod();
      return;
    }

    if (action === "load-saved-methods") {
      await loadSavedPaymentMethods().catch((error) => {
        renderPgMessage("Saved methods", error.message);
      });
      return;
    }

    if (action === "export-payment-history") {
      exportPaymentHistoryCsv();
      return;
    }

    if (action === "bridge-estimate") {
      const from = String(document.getElementById("bridgeFromNet")?.value || "Ethereum");
      const to = String(document.getElementById("bridgeToNet")?.value || "BSC");
      const token = String(document.getElementById("bridgeToken")?.value || "ETH");
      const amount = Number(document.getElementById("bridgeAmount")?.value || 0);
      const recipient = String(document.getElementById("bridgeRecipient")?.value || "").trim();
      const resultNode = document.getElementById("bridgeFeeResult");
      if (!amount || amount <= 0 || !recipient) {
        if (resultNode) {
          resultNode.innerHTML = '<article><strong>Bridge fee estimate</strong><p class="meta">Enter a recipient and positive amount.</p></article>';
        }
        return;
      }
      const fee = estimateBridgeFee(amount, from, to);
      if (resultNode) {
        resultNode.innerHTML = `
          <article>
            <strong>${escapeHtml(`${token} bridge estimate`)}</strong>
            <p class="meta">${escapeHtml(`Fee ${fee.total} (${fee.percentageFee} variable + ${fee.networkFee} network) from ${from} to ${to} for ${recipient}.`)}</p>
          </article>
        `;
      }
      return;
    }

    if (action === "bridge-initiate") {
      await initiateBridgeTransfer();
      return;
    }

    if (action === "futures-long") {
      setFuturesDirection("Long");
      return;
    }

    if (action === "futures-short") {
      setFuturesDirection("Short");
      return;
    }

    if (action === "open-futures-long") {
      setFuturesDirection("Long");
      createFuturesPosition("Long");
      return;
    }

    if (action === "open-futures-short") {
      setFuturesDirection("Short");
      createFuturesPosition("Short");
      return;
    }

    if (action === "refresh-futures") {
      refreshFuturesPositions();
      return;
    }

    if (action === "close-futures-position") {
      closeFuturesPosition(String(target.dataset.positionId || ""));
      return;
    }

    if (action === "change-password") {
      const currentPassword = String(document.getElementById("currentPassword")?.value || "").trim();
      const newPassword = String(document.getElementById("newPassword")?.value || "").trim();
      const confirmPassword = String(document.getElementById("confirmPassword")?.value || "").trim();
      const resultNode = document.getElementById("passwordChangeResult");
      const message = !currentPassword || !newPassword || !confirmPassword
        ? "Fill in all password fields."
        : newPassword !== confirmPassword
          ? "New password and confirmation must match."
          : "Password updated successfully.";
      if (resultNode) {
        resultNode.innerHTML = `<article><strong>Password</strong><p class="meta">${escapeHtml(message)}</p></article>`;
      }
      return;
    }

    if (action === "save-display-prefs") {
      const currency = String(document.getElementById("displayCurrency")?.value || "USD");
      state.settings.currency = currency;
      showToast(`Display currency saved: ${currency}`);
      return;
    }

    if (action === "load-market-prices") {
      await loadMarketPrices();
      renderMetrics();
      return;
    }

    if (action === "search-crypto") {
      const query = document.getElementById("cryptoSearchInput")?.value || "";
      await searchCrypto(query);
      return;
    }

    if (action === "load-portfolio") {
      await loadPortfolio();
      return;
    }

    if (action === "load-chart") {
      const coinId = document.getElementById("chartCoinInput")?.value || "bitcoin";
      await loadChartData(coinId);
      return;
    }

    if (action === "load-trending") {
      await loadTrendingCoins();
      return;
    }

    if (action === "load-global-stats") {
      await loadGlobalStats();
      return;
    }

    if (action === "load-dex-tokens") {
      await loadDexTokens();
      return;
    }

    if (action === "load-dex-pools") {
      await loadDexPools();
      return;
    }

    if (action === "toggle-register") {
      toggleRegisterSection();
      return;
    }

    if (action === "logout") {
      logout();
      return;
    }

    if (action === "reset-demo") {
      const result = await resetDemoAccount().catch((error) => ({ error: error.message }));
      const panel = document.getElementById("demoResult");
      if (panel) {
        panel.innerHTML = `<article><strong>Demo account</strong><p class="meta">${escapeHtml(JSON.stringify(result))}</p></article>`;
      }
      await refreshDashboard();
      return;
    }

    if (action === "refresh-demo") {
      await refreshDashboard();
      return;
    }

    if (action === "refresh-news") {
      state.dashboard.newsItems = getMockNewsItems();
      const category = document.getElementById("newsCategory")?.value || "all";
      renderNewsFeed(category);
      return;
    }

    if (action === "refresh-orderbook") {
      refreshOrderBook();
      return;
    }

    if (action === "refresh-gas") {
      refreshGasTracker();
      return;
    }

    if (action === "load-trade-history") {
      loadTradeHistory();
      return;
    }

    if (action === "add-to-watchlist") {
      addToWatchlist();
      return;
    }

    if (action === "remove-watchlist") {
      removeFromWatchlist(String(target.dataset.symbol || "").trim().toUpperCase());
      return;
    }

    if (action === "create-alert") {
      createAlert();
      return;
    }

    if (action === "remove-alert") {
      removeAlert(target.dataset.alertIndex);
      return;
    }

    if (action === "quick-buy") {
      runQuickTrade("buy");
      return;
    }

    if (action === "quick-sell") {
      runQuickTrade("sell");
      return;
    }

    if (action === "calc-risk") {
      calculateRisk();
      return;
    }

    if (action === "load-options-chain") {
      const underlying = String(document.getElementById("optionsUnderlying")?.value || "BTC");
      state.options.chain = getMockOptionsChainRows(underlying);
      renderOptionsChain();
      return;
    }

    if (action === "refresh-options") {
      state.options.positions = (state.options.positions.length ? state.options.positions : getMockOptionsPositions()).map((row, index) => ({
        ...row,
        pnl: Number(row.pnl) + (index % 2 === 0 ? 24 : -18),
      }));
      renderOptionsPositions();
      return;
    }

    if (action === "buy-option") {
      const optionId = String(target.dataset.optionId || "");
      const selected = state.options.chain.find((row) => row.id === optionId);
      if (!selected) {
        return;
      }
      state.options.positions.unshift({
        id: `position_${Date.now()}`,
        underlying: selected.underlying,
        strike: selected.strike,
        type: selected.type,
        qty: 1,
        premium: selected.ask,
        pnl: 0,
      });
      renderOptionsPositions();
      showToast(`${selected.underlying} ${selected.type.toLowerCase()} added`, "positive");
      return;
    }

    if (action === "close-option-position") {
      state.options.positions = state.options.positions.filter((row) => row.id !== String(target.dataset.positionId || ""));
      renderOptionsPositions();
      showToast("Options position closed", "positive");
      return;
    }

    if (action === "supply-asset") {
      const asset = String(document.getElementById("lendAsset")?.value || "USDT");
      const amount = Number(document.getElementById("lendAmount")?.value || 0);
      const resultNode = document.getElementById("lendResult");
      const apyMap = { USDT: 8.4, ETH: 3.9, BTC: 2.8, BNB: 5.2 };
      const priceMap = { USDT: 1, ETH: 3420, BTC: 65250, BNB: 612 };
      if (!amount || amount <= 0) {
        if (resultNode) {
          resultNode.innerHTML = '<article><strong>Supply assets</strong><p class="meta">Enter a valid amount to continue.</p></article>';
        }
        return;
      }
      const apy = apyMap[asset] || 0;
      const usdValue = amount * (priceMap[asset] || 1);
      state.lending.supplies.unshift({
        asset,
        amount,
        apy,
        rewards: usdValue * (apy / 100) / 12,
        usdValue,
      });
      const healthFactor = calculateHealthFactorValue();
      state.lending.borrows = state.lending.borrows.map((row) => ({ ...row, healthFactor: healthFactor ?? 0 }));
      renderSupplyTable();
      renderBorrowTable();
      updateHealthFactorChip();
      if (resultNode) {
        resultNode.innerHTML = `<article><strong>${escapeHtml(asset)} supplied</strong><p class="meta">${escapeHtml(`${formatPlainNumber(amount, 4)} added at ${formatPlainNumber(apy, 2)}% APY.`)}</p></article>`;
      }
      return;
    }

    if (action === "borrow-asset") {
      const collateral = String(document.getElementById("borrowCollateral")?.value || "USDT");
      const asset = String(document.getElementById("borrowAsset")?.value || "USDT");
      const amount = Number(document.getElementById("borrowAmount")?.value || 0);
      const resultNode = document.getElementById("borrowResult");
      const rateMap = { USDT: 9.8, ETH: 6.4, BTC: 5.9, BNB: 7.1 };
      const priceMap = { USDT: 1, ETH: 3420, BTC: 65250, BNB: 612 };
      if (!amount || amount <= 0) {
        if (resultNode) {
          resultNode.innerHTML = '<article><strong>Borrow assets</strong><p class="meta">Enter a valid amount to continue.</p></article>';
        }
        return;
      }
      const usdValue = amount * (priceMap[asset] || 1);
      state.lending.borrows.unshift({
        asset,
        amount,
        rate: rateMap[asset] || 0,
        collateral,
        usdValue,
        healthFactor: 0,
      });
      const healthFactor = calculateHealthFactorValue();
      state.lending.borrows = state.lending.borrows.map((row) => ({ ...row, healthFactor: healthFactor ?? 0 }));
      renderBorrowTable();
      updateHealthFactorChip();
      if (resultNode) {
        resultNode.innerHTML = `<article><strong>${escapeHtml(asset)} borrowed</strong><p class="meta">${escapeHtml(`${formatPlainNumber(amount, 4)} borrowed against ${collateral}.`)}</p></article>`;
      }
      return;
    }

    if (action === "generate-tax-report") {
      const year = String(document.getElementById("taxYear")?.value || "2024");
      const method = String(document.getElementById("taxMethod")?.value || "FIFO");
      state.taxTransactions = getMockTaxTransactions(year, method);
      renderTaxReport();
      showToast(`Tax report ready for ${year} ${method}`, "positive");
      return;
    }

    if (action === "export-tax-csv") {
      if (!state.taxTransactions.length) {
        showToast("Generate a tax report first", "warning");
        return;
      }
      const csv = [
        ["Date", "Type", "Asset", "Amount", "Cost Basis", "Proceeds", "Gain/Loss"],
        ...state.taxTransactions.map((row) => [row.date, row.type, row.asset, row.amount, row.costBasis, row.proceeds, row.gainLoss]),
      ].map((row) => row.join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `atlasx3-tax-${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      return;
    }

    if (action === "export-tax-pdf") {
      showToast("PDF export requires server — contact support", "warning");
      return;
    }

    if (action === "create-api-key") {
      const name = String(document.getElementById("apiKeyName")?.value || "ATLASX3 Key").trim() || "ATLASX3 Key";
      const ipWhitelist = String(document.getElementById("apiKeyIp")?.value || "").trim();
      const permissions = [
        document.getElementById("permRead")?.checked ? "read" : "",
        document.getElementById("permTrade")?.checked ? "trade" : "",
        document.getElementById("permWithdraw")?.checked ? "withdraw" : "",
      ].filter(Boolean);
      const result = await apiCall("/api/keys/generate", {
        key: "generate-api-key",
        method: "POST",
        body: {
          name,
          ipWhitelist,
          permissions: permissions.length ? permissions : ["read"],
        },
      }).catch((error) => ({ error: error.message }));
      renderResultPanel("apiKeyResult", "API key generated", result);
      await loadAPIKeys();
      return;
    }

    if (action === "refresh-api-keys") {
      renderAPIKeys();
      showToast("API keys refreshed", "positive");
      return;
    }

    if (action === "check-system-status") {
      await checkSystemStatus();
      showToast("System status refreshed", "positive");
      return;
    }

    if (action === "stake-asset") {
      const asset = String(document.getElementById("stakeAsset")?.value || "ETH");
      const amount = Number(document.getElementById("stakeAmount")?.value || 0);
      const duration = String(document.getElementById("stakeDuration")?.value || "30 days");
      const resultNode = document.getElementById("stakeResult");
      const apyMap = { ETH: 4.2, SOL: 6.8, BNB: 5.1, DOT: 12 };

      if (!amount || amount <= 0) {
        if (resultNode) {
          resultNode.innerHTML = '<article><strong>Stake request</strong><p class="meta">Enter a valid amount to continue.</p></article>';
        }
        return;
      }

      const durationDays = Number.parseInt(duration, 10) || 30;
      const apy = apyMap[asset] || 0;
      const rewards = amount * (apy / 100) * (durationDays / 365);
      state.stakes.unshift({
        id: `stake_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        asset,
        amount,
        apy,
        duration,
        rewards,
      });
      renderStakes();
      if (resultNode) {
        resultNode.innerHTML = `
          <article>
            <strong>${escapeHtml(asset)} staked</strong>
            <p class="meta">${escapeHtml(`${formatPlainNumber(amount, 4)} locked for ${duration} at ${formatPlainNumber(apy, 2)}% APY.`)}</p>
          </article>
        `;
      }
      return;
    }

    if (action === "unstake") {
      state.stakes = state.stakes.filter((stake) => stake.id !== target.dataset.stakeId);
      renderStakes();
      setConnectionStatus("stake unstaked", "positive");
      return;
    }

    if (action === "run-convert") {
      runConverter();
      return;
    }

    if (action === "load-nfts") {
      const wallet = String(document.getElementById("nftWalletInput")?.value || "").trim() || "demo-wallet";
      const network = String(document.getElementById("nftNetwork")?.value || "ETH").trim();
      state.nfts = Array.from({ length: 4 }, (_, index) => ({
        name: `${network} Vault #${index + 1}`,
        tokenId: String(1000 + index),
        contractAddress: `${wallet.slice(0, 10) || "0xATLAS"}${network}${index}COLLECTIBLE`,
      }));
      renderNfts();
      return;
    }

    if (action === "mint-nft") {
      const contractValue = String(document.getElementById("nftMintContract")?.value || "").trim();
      const recipient = String(document.getElementById("nftMintTo")?.value || "").trim();
      const tokenIdValue = String(document.getElementById("nftMintId")?.value || "").trim();
      const tokenUri = String(document.getElementById("nftMintUri")?.value || "").trim();
      const contractId = Number(contractValue);
      const tokenId = Number(tokenIdValue);
      const payload = {
        contractId: Number.isFinite(contractId) && contractValue ? contractId : contractValue,
        contractAddress: contractValue,
        privateKey: "demo-private-key",
        to: recipient,
        tokenId: Number.isFinite(tokenId) && tokenIdValue ? tokenId : tokenIdValue,
        amount: 1,
        metadataUri: tokenUri,
      };
      const result = await apiCall("/api/erc1155/mint", {
        key: "mint-nft",
        method: "POST",
        body: payload,
      }).catch((error) => ({ error: error.message }));
      const output = typeof result === "string" ? result : JSON.stringify(result, null, 2);
      const node = document.getElementById("nftMintResult");
      if (node) {
        node.innerHTML = `<article><strong>NFT mint</strong><p class="meta">${escapeHtml(output)}</p></article>`;
      }
      return;
    }

    if (action === "refresh-analytics") {
      refreshAnalytics();
      return;
    }

    if (action === "adv-tab") {
      switchAdvTab(String(target.dataset.advTab || "indicators"));
      return;
    }

    if (action === "adv-calc-indicator") {
      calcAdvIndicator();
      return;
    }

    if (action === "adv-run-portfolio-analysis") {
      runAdvPortfolioAnalysis();
      return;
    }

    if (action === "adv-run-optimize") {
      runAdvOptimize();
      return;
    }

    if (action === "adv-run-risk-analysis") {
      runAdvRiskAnalysis();
      return;
    }

    if (action === "adv-run-var") {
      runAdvVar();
      return;
    }

    if (action === "adv-run-stress-test") {
      runAdvStressTest();
      return;
    }

    if (action === "adv-refresh-monitoring" || action === "adv-refresh-health") {
      refreshAdvMonitoring();
      return;
    }

    if (action === "toggle-notif-panel") {
      const dropdown = document.getElementById("notifDropdown");
      const bell = document.getElementById("notifBell");
      if (!dropdown) {
        return;
      }
      if (!state.notifs.length) {
        state.notifs = getMockNotifications();
        renderNotifications();
      }
      const isOpen = dropdown.classList.toggle("open");
      dropdown.hidden = !isOpen;
      bell?.setAttribute("aria-expanded", String(isOpen));
      return;
    }

    if (action === "mark-notifs-read") {
      state.notifs = [];
      const list = document.getElementById("notifList");
      const badge = document.getElementById("notifCount");
      if (list) {
        list.innerHTML = "";
      }
      if (badge) {
        badge.textContent = "0";
      }
      const dropdown = document.getElementById("notifDropdown");
      const bell = document.getElementById("notifBell");
      if (dropdown) {
        dropdown.classList.remove("open");
        dropdown.hidden = true;
      }
      bell?.setAttribute("aria-expanded", "false");
      return;
    }

    if (action === "export-portfolio") {
      exportPortfolioCsv();
      return;
    }

    if (action === "accept-p2p-order") {
      await acceptP2POrder(target.dataset.orderId);
      await refreshDashboard();
      return;
    }

    if (action === "follow-trader") {
      const traderId = String(target.dataset.traderId || "").trim();
      followTraderLocally(traderId);
      await followTrader(traderId).catch(() => null);
      renderLeaderboard();
      return;
    }

    if (action === "verify-email") {
      const result = await verifyEmail().catch((error) => ({ error: error.message }));
      const panel = document.getElementById("emailStatus");
      if (panel) {
        panel.innerHTML = `<article><strong>Verification</strong><p class="meta">${escapeHtml(JSON.stringify(result))}</p></article>`;
      }
      return;
    }

    if (action === "test-email") {
      const result = await sendEmailTest().catch((error) => ({ error: error.message }));
      const panel = document.getElementById("emailStatus");
      if (panel) {
        panel.innerHTML = `<article><strong>SMTP test</strong><p class="meta">${escapeHtml(JSON.stringify(result))}</p></article>`;
      }
      return;
    }

    if (action === "hardhat-deploy-all") {
      const result = await deployHardhat().catch((error) => ({
        error: `Unable to deploy ATLASX3 contracts right now. ${error.message}` ,
      }));
      updateHardhatLog("hardhatDeployLog", result, "Deployment result");
      state.dashboard.hardhatAssets = normalizeHardhatContracts(result);
      renderHardhatAssets();
      await refreshDashboard();
      return;
    }

    if (action === "hardhat-check-node") {
      const result = await getHardhatStatus().catch((error) => ({
        error: `Unable to reach the Hardhat node. ${error.message}` ,
      }));
      updateHardhatLog("hardhatDeployLog", result, "Hardhat node status");
      return;
    }

    if (action === "hardhat-mint-atx") {
      const payload = {
        to: String(document.getElementById("atxMintTo")?.value || "").trim(),
        amount: String(document.getElementById("atxMintAmount")?.value || "").trim(),
      };
      const result = await mintHardhatAtx(payload).catch((error) => ({
        error: `Unable to mint ATX right now. ${error.message}` ,
      }));
      updateHardhatLog("hardhatMintLog", result, "ATX mint result");
      return;
    }

    if (action === "hardhat-create-pair") {
      const payload = {
        tokenA: String(document.getElementById("dexTokenA")?.value || "").trim(),
        tokenB: String(document.getElementById("dexTokenB")?.value || "").trim(),
      };
      const result = await createHardhatPair(payload).catch((error) => ({
        error: `Unable to create the pair right now. ${error.message}` ,
      }));
      updateHardhatLog("hardhatDexLog", result, "Pair creation result");
      return;
    }

    if (action === "hardhat-add-liquidity") {
      const payload = {
        tokenA: String(document.getElementById("liqTokenA")?.value || "").trim(),
        tokenB: String(document.getElementById("liqTokenB")?.value || "").trim(),
        amountA: String(document.getElementById("liqAmountA")?.value || "").trim(),
        amountB: String(document.getElementById("liqAmountB")?.value || "").trim(),
      };
      const result = await addHardhatLiquidity(payload).catch((error) => ({
        error: `Unable to add liquidity right now. ${error.message}` ,
      }));
      updateHardhatLog("hardhatDexLog", result, "Liquidity result");
      return;
    }

    if (action === "hardhat-refresh-contracts") {
      const result = await loadHardhatContracts().catch((error) => ({
        error: `Unable to load deployed contracts right now. ${error.message}` ,
      }));
      if (result.error) {
        updateHardhatLog("hardhatDeployLog", result, "Contracts refresh");
      } else {
        state.dashboard.hardhatAssets = normalizeHardhatContracts(result);
        renderHardhatAssets();
      }
      return;
    }

    if (action === "hardhat-load-accounts") {
      const result = await loadHardhatAccountsRequest().catch((error) => ({
        error: `Unable to load local accounts right now. ${error.message}` ,
      }));
      if (result.error) {
        updateHardhatLog("hardhatDeployLog", result, "Accounts request");
      } else {
        state.dashboard.hardhatAccounts = result.accounts || result.data || result || [];
        renderHardhatAccounts();
      }
      return;
    }

    if (action === "load-terminal-transactions") {
      await loadPaymentTerminalTransactions().catch((error) => {
        const panel = document.getElementById("terminalResult");
        if (panel) {
          panel.innerHTML = `<article><strong>Terminal feed</strong><p class="meta">${escapeHtml(error.message)}</p></article>`;
        }
      });
      return;
    }


    if (action === "swap-quote") {
      const form = document.getElementById("swapForm");
      const payload = sanitizeNumericPayload(Object.fromEntries(new FormData(form).entries()), ["amountIn"]);
      const result = await apiCall("/api/swap/quote", {
        key: "swap-quote",
        method: "POST",
        body: payload,
      }).catch((error) => ({ error: error.message }));
      renderResultPanel("swapQuoteResult", "Swap quote", result.quote || result);
      return;
    }

    if (action === "swap-execute") {
      const form = document.getElementById("swapForm");
      const payload = sanitizeNumericPayload(Object.fromEntries(new FormData(form).entries()), ["amountIn"]);
      const result = await apiCall("/api/swap/execute", {
        key: "swap-execute",
        method: "POST",
        body: payload,
      }).catch((error) => ({ error: error.message }));
      renderResultPanel("swapQuoteResult", "Swap execution", result);
      await loadSwapHistory();
      renderMetrics();
      return;
    }

    if (action === "mt-market-order") {
      const form = document.getElementById("mtOrderForm");
      const payload = sanitizeNumericPayload(Object.fromEntries(new FormData(form).entries()), ["volume", "stopLoss", "takeProfit"]);
      const result = await apiCall("/api/metatrader/order/market", {
        key: "mt-market-order",
        method: "POST",
        body: payload,
      }).catch((error) => ({ error: error.message }));
      renderResultPanel("mtOrderResult", "Market order", result.data || result);
      await loadMTPositions();
      return;
    }

    if (action === "generate-wallet") {
      const form = document.getElementById("walletGenerateForm");
      const payload = Object.fromEntries(new FormData(form).entries());
      payload.includeMultiChain = payload.type === "multi";
      const result = await apiCall("/api/wallet/generate", {
        key: "generate-wallet",
        method: "POST",
        body: payload,
      }).catch((error) => ({ error: error.message }));
      renderResultPanel("walletResult", "Wallet generation", result.wallet || result);
      return;
    }

    if (action === "wallet-import-mnemonic") {
      const form = document.getElementById("walletImportForm");
      const payload = Object.fromEntries(new FormData(form).entries());
      const result = await apiCall("/api/wallet/import-mnemonic", {
        key: "wallet-import-mnemonic",
        method: "POST",
        body: payload,
      }).catch((error) => ({ error: error.message }));
      renderResultPanel("walletResult", "Mnemonic import", result.wallet || result);
      return;
    }

    if (action === "wallet-balance-check") {
      const form = document.getElementById("walletBalanceForm");
      const payload = Object.fromEntries(new FormData(form).entries());
      const result = await apiCall(`/api/${payload.network}/balance/${encodeURIComponent(payload.address || "")}`, {
        key: "wallet-balance-check",
      }).catch((error) => ({ error: error.message }));
      renderResultPanel("walletResult", "Wallet balance", result);
      return;
    }

    if (action === "generate-api-key") {
      const form = document.getElementById("apiKeyForm");
      const payload = sanitizeNumericPayload(Object.fromEntries(new FormData(form).entries()), ["expiresInDays"]);
      if (payload.permissions) {
        payload.permissions = String(payload.permissions)
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
      }
      const result = await apiCall("/api/keys/generate", {
        key: "generate-api-key",
        method: "POST",
        body: payload,
      }).catch((error) => ({ error: error.message }));
      renderResultPanel("apiKeyResult", "API key generated", result);
      await loadAPIKeys();
      return;
    }

    if (action === "revoke-api-key") {
      const keyId = String(target.dataset.keyId || "");
      state.apiKeys = state.apiKeys.filter((entry) => entry.keyId !== keyId);
      state.dashboard.apiKeys = state.apiKeys;
      renderAPIKeys();
      const result = await apiCall(`/api/keys/${encodeURIComponent(keyId)}`, {
        key: "revoke-api-key",
        method: "DELETE",
      }).catch(() => ({ status: "revoked locally" }));
      renderResultPanel("apiKeyResult", "API key revoked", result);
      return;
    }

    if (action === "erc1155-add-contract") {
      const form = document.getElementById("erc1155ContractForm");
      const payload = Object.fromEntries(new FormData(form).entries());
      const result = await apiCall("/api/erc1155/contract/add", {
        key: "erc1155-add-contract",
        method: "POST",
        body: payload,
      }).catch((error) => ({ error: error.message }));
      renderResultPanel("erc1155Result", "ERC-1155 contract", result);
      await loadERC1155Transactions();
      return;
    }

    if (action === "erc1155-balance-check") {
      const form = document.getElementById("erc1155BalanceForm");
      const payload = Object.fromEntries(new FormData(form).entries());
      const result = await apiCall(
        `/api/erc1155/balance/${encodeURIComponent(payload.contractId || "")}/${encodeURIComponent(payload.tokenId || "")}?walletAddress=${encodeURIComponent(payload.walletAddress || "")}`,
        {
          key: "erc1155-balance-check",
        }
      ).catch((error) => ({ error: error.message }));
      renderResultPanel("erc1155Result", "ERC-1155 balance", result);
      return;
    }

    if (action === "erc1155-mint") {
      const form = document.getElementById("erc1155MintForm");
      const payload = sanitizeNumericPayload(Object.fromEntries(new FormData(form).entries()), ["contractId", "tokenId", "amount"]);
      const result = await apiCall("/api/erc1155/mint", {
        key: "erc1155-mint",
        method: "POST",
        body: payload,
      }).catch((error) => ({ error: error.message }));
      renderResultPanel("erc1155Result", "ERC-1155 mint", result);
      await loadERC1155Transactions();
      return;
    }

    if (action === "erc1155-transfer") {
      const form = document.getElementById("erc1155TransferForm");
      const payload = sanitizeNumericPayload(Object.fromEntries(new FormData(form).entries()), ["contractId", "tokenId", "amount"]);
      const result = await apiCall("/api/erc1155/transfer", {
        key: "erc1155-transfer",
        method: "POST",
        body: payload,
      }).catch((error) => ({ error: error.message }));
      renderResultPanel("erc1155Result", "ERC-1155 transfer", result);
      await loadERC1155Transactions();
      return;
    }

    if (action === "place-prediction") {
      const marketId = target.dataset.marketId || "btc-weekly";
      const result = await apiCall("/api/prediction/predict", {
        key: "prediction-place",
        method: "POST",
        body: {
          marketId,
          prediction: "above",
          amount: 50,
        },
      }).catch((error) => ({ error: error.message }));
      const body = document.getElementById("predictionPositionsBody");
      if (body) {
        body.insertAdjacentHTML(
          "afterbegin",
          `<tr><td>${escapeHtml(marketId)}</td><td>above</td><td>50</td><td>${escapeHtml(result.error ? "queued locally" : "submitted")}</td></tr>`
        );
      }
      return;
    }
  });
}

async function bootstrap() {
  bindFormHandlers();
  bindGlobalHandlers();
  connectWebSocket();
  appendAssistantMessage("assistant", "ATLASX3 assistant ready. Ask for risk summaries, on-chain status or desk workflows.");
  await loadTronDepositWallet();
  await loadAssistantStatus().catch(() => null);
  await hydrateSession();
}

document.addEventListener("DOMContentLoaded", () => {
  state.pgMethod = "card";
  state.pgPayments = [];
  state.stakes = [];
  state.notifs = [];
  state.nfts = [];
  state.futures = [];
  state.bridgeHistory = [];
  state.socialFeed = [];
  state.proposals = [];
  state.bots = [];
  state.savedScreens = [];
  state.screenerResults = [];
  state.defi = { protocols: [], farms: [], metrics: { tvl: 0, myBalance: 0, rewards: 0 } };
  state.multisigWallets = [];
  state.multisigTxs = [];
  state.compareRows = [];
  state.journal = [];
  state.shortcutPendingKey = "";
  state.shortcutTimer = null;
  state.launchpadLaunches = getMockLaunchpadRows();
  state.options = { chain: [], positions: getMockOptionsPositions() };
  state.lending = { supplies: [], borrows: [] };
  state.taxTransactions = [];
  state.apiKeys = [];
  state.systemStatus = { services: [], timings: [] };
  state.settings = { currency: "USD" };
  state.leaderboardTab = "traders";
  switchSection(state.activeSection);
  renderP2POrders();
  renderMyP2POrders();
  renderFollowingTraders();
  renderPredictionPositions();
  renderPredictionLeaderboard();
  renderHardhatAssets();
  renderMarketPrices();
  renderScreenerResults();
  renderSavedScreens();
  renderComparePrices();
  renderPortfolio();
  renderChartData();
  renderTrendingCoins();
  renderGlobalStats();
  renderDexTokens();
  renderDexPools();
  renderDefiPanel();
  renderMultisigWallets();
  renderMultisigTransactions();
  renderCryptoSearchResults();
  renderSwapHistory();
  renderMTAccount();
  renderMTPositions();
  renderERC1155Transactions();
  renderOptionsChain();
  renderOptionsPositions();
  renderSupplyTable();
  renderBorrowTable();
  renderTaxReport();
  renderAPIKeys();
  renderSystemStatus();
  renderPgFields();
  renderPgSummary();
  renderPaymentHistory();
  renderSavedPaymentMethods();
  renderSocialFeed();
  renderLaunchpad();
  renderProposals();
  renderBots();
  updateHealthFactorChip();
  renderOrderBook();
  renderTradeHistory();
  renderJournal();
  updateJournalSummary();
  renderWatchlist();
  renderAlerts();
  renderNewsFeed();
  renderQuickTradeStatus();
  renderGasTracker();
  renderConvertResult();
  renderPortfolioAnalytics();
  renderTickerRates();
  renderAccountSnapshot();
  renderStakes();
  renderNfts();
  renderRecentActivity();
  renderLeaderboard();
  renderBridgeHistory();
  renderFundingRates();
  renderFuturesPositions();
  populateQuickStats();
  setFuturesDirection("Long");
  const themeSelect = document.getElementById("themeSelect");
  if (themeSelect) {
    themeSelect.value = "Dark";
    document.body.dataset.theme = themeSelect.value.toLowerCase();
  }
  const displayCurrency = document.getElementById("displayCurrency");
  if (displayCurrency) {
    displayCurrency.value = state.settings.currency;
  }
  const journalDate = document.getElementById("journalDate");
  if (journalDate) {
    journalDate.value = new Date().toISOString().slice(0, 10);
  }
  refreshDefiDashboard();
  refreshMultisigPanel();
  document.addEventListener("keydown", handleKeyboardShortcuts);
  state.notifs = getMockNotifications();
  const notifCount = document.getElementById("notifCount");
  if (notifCount) {
    notifCount.textContent = "3";
  }
  renderNotifications();
  refreshSocialFeed();
  refreshProposals();
  refreshAnalytics();
  loadTradeHistory();
  refreshOrderBook();
  refreshGasTracker();
  checkSystemStatus().catch(() => null);
  setInterval(() => {
    checkSystemStatus().catch(() => null);
  }, 30000);
  bootstrap().catch((error) => {
    setConnectionStatus(error.message, "warning");
  });
});

// ==================== ADVANCED TOOLS (Indicators, Analytics, Optimization, Risk, Monitoring) ====================

const ADV_ASSET_PROFILES = {
  BTC: { expectedReturn: 0.18, volatility: 0.45 },
  ETH: { expectedReturn: 0.22, volatility: 0.55 },
  SOL: { expectedReturn: 0.28, volatility: 0.65 },
  BNB: { expectedReturn: 0.16, volatility: 0.5 },
  USDT: { expectedReturn: 0.02, volatility: 0.01 },
};

function switchAdvTab(tabName) {
  document.querySelectorAll("#advTabs [data-adv-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.advTab === tabName);
  });
  document.querySelectorAll(".adv-tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `advTab-${tabName}`);
  });
}

// Builds holdings/prices/risk-portfolio views from the user's live exchange wallet balances
async function getAdvancedPortfolioContext() {
  const [balancesRes, ratesRes] = await Promise.all([
    apiCall("/api/wallet/balances", { key: "adv-wallet-balances" }),
    apiCall("/api/rates", { key: "adv-rates" }),
  ]);

  const usdPrices = ratesRes.usd || {};
  const balances = (balancesRes.balances || []).filter((row) => Number(row.balance) > 0);

  const prices = {};
  balances.forEach((row) => {
    prices[row.currency] = Number(usdPrices[row.currency] || 0);
  });

  const holdings = balances.map((row) => ({
    symbol: row.currency,
    quantity: Number(row.balance),
    averageCost: Number(prices[row.currency] || 0),
  }));

  const totalValue = holdings.reduce((sum, h) => sum + h.quantity * (prices[h.symbol] || 0), 0);

  const riskPortfolio = {};
  holdings.forEach((h) => {
    const value = h.quantity * (prices[h.symbol] || 0);
    riskPortfolio[h.symbol] = {
      value,
      quantity: h.quantity,
      price: prices[h.symbol] || 0,
      volatility: ADV_ASSET_PROFILES[h.symbol]?.volatility ?? 0.35,
      allocation: totalValue ? (value / totalValue) * 100 : 0,
      gainPercent: 0,
    };
  });

  return { holdings, prices, riskPortfolio, totalValue };
}

function formatSeriesTail(values, count = 8) {
  return (values || [])
    .filter((v) => v !== null && v !== undefined && !Number.isNaN(Number(v)))
    .slice(-count)
    .map((v) => Number(v).toFixed(4));
}

function renderSeriesTable(tail) {
  if (!tail.length) {
    return '<p class="empty">Not enough data points.</p>';
  }
  return `
    <table>
      <thead><tr>${tail.map((_, i) => `<th>t-${tail.length - i - 1}</th>`).join("")}</tr></thead>
      <tbody><tr>${tail.map((v) => `<td>${escapeHtml(v)}</td>`).join("")}</tr></tbody>
    </table>
  `;
}

function renderAdvIndicatorResult(type, result, symbol) {
  if (type === "sma" || type === "ema") {
    return `
      <p class="meta">${escapeHtml(result.indicator)} (${result.period}) on ${escapeHtml(symbol)} · ${result.dataPoints} points</p>
      ${renderSeriesTable(formatSeriesTail(result.values))}
    `;
  }

  if (type === "rsi") {
    const badge = result.overbought
      ? '<span class="adv-badge bad">Overbought</span>'
      : result.oversold
        ? '<span class="adv-badge warn">Oversold</span>'
        : '<span class="adv-badge good">Neutral</span>';
    return `
      <p class="meta">RSI (${result.period}) on ${escapeHtml(symbol)} — current: <strong>${Number(result.current).toFixed(2)}</strong> ${badge}</p>
      ${renderSeriesTable(formatSeriesTail(result.values))}
    `;
  }

  if (type === "macd") {
    const macdTail = formatSeriesTail(result.macd);
    const signalTail = formatSeriesTail(result.signal);
    const histTail = formatSeriesTail(result.histogram);
    return `
      <p class="meta">MACD (${result.fastPeriod}/${result.slowPeriod}/${result.signalPeriod}) on ${escapeHtml(symbol)}</p>
      <table>
        <thead><tr><th>Series</th>${macdTail.map((_, i) => `<th>t-${macdTail.length - i - 1}</th>`).join("")}</tr></thead>
        <tbody>
          <tr><td>MACD</td>${macdTail.map((v) => `<td>${v}</td>`).join("")}</tr>
          <tr><td>Signal</td>${signalTail.map((v) => `<td>${v}</td>`).join("")}</tr>
          <tr><td>Histogram</td>${histTail.map((v) => `<td>${v}</td>`).join("")}</tr>
        </tbody>
      </table>
    `;
  }

  if (type === "bollinger") {
    const upperTail = formatSeriesTail(result.upper);
    const middleTail = formatSeriesTail(result.middle);
    const lowerTail = formatSeriesTail(result.lower);
    return `
      <p class="meta">Bollinger Bands (${result.period}, ${result.stdDev}σ) on ${escapeHtml(symbol)}</p>
      <table>
        <thead><tr><th>Band</th>${upperTail.map((_, i) => `<th>t-${upperTail.length - i - 1}</th>`).join("")}</tr></thead>
        <tbody>
          <tr><td>Upper</td>${upperTail.map((v) => `<td>${v}</td>`).join("")}</tr>
          <tr><td>Middle</td>${middleTail.map((v) => `<td>${v}</td>`).join("")}</tr>
          <tr><td>Lower</td>${lowerTail.map((v) => `<td>${v}</td>`).join("")}</tr>
        </tbody>
      </table>
    `;
  }

  if (type === "stochastic") {
    const kTail = formatSeriesTail(result.k);
    const dTail = formatSeriesTail(result.d);
    const badge = result.overbought
      ? '<span class="adv-badge bad">Overbought</span>'
      : result.oversold
        ? '<span class="adv-badge warn">Oversold</span>'
        : '<span class="adv-badge good">Neutral</span>';
    return `
      <p class="meta">Stochastic (${result.period}) on ${escapeHtml(symbol)} ${badge}</p>
      <table>
        <thead><tr><th>Series</th>${kTail.map((_, i) => `<th>t-${kTail.length - i - 1}</th>`).join("")}</tr></thead>
        <tbody>
          <tr><td>%K</td>${kTail.map((v) => `<td>${v}</td>`).join("")}</tr>
          <tr><td>%D</td>${dTail.map((v) => `<td>${v}</td>`).join("")}</tr>
        </tbody>
      </table>
    `;
  }

  if (type === "atr") {
    return `
      <p class="meta">ATR (${result.period}) on ${escapeHtml(symbol)} — current: <strong>${Number(result.current).toFixed(4)}</strong></p>
      ${renderSeriesTable(formatSeriesTail(result.values))}
    `;
  }

  const ind = result.indicators || {};
  const rsiTail = formatSeriesTail(ind.rsi);
  return `
    <p class="meta">All indicators calculated on ${escapeHtml(symbol)}</p>
    <div class="adv-metric-row"><span>SMA (last)</span><span>${formatSeriesTail(ind.sma20, 1)[0] ?? "--"}</span></div>
    <div class="adv-metric-row"><span>EMA (last)</span><span>${formatSeriesTail(ind.ema12, 1)[0] ?? "--"}</span></div>
    <div class="adv-metric-row"><span>RSI (last)</span><span>${rsiTail[rsiTail.length - 1] ?? "--"}</span></div>
    <div class="adv-metric-row"><span>MACD (last)</span><span>${formatSeriesTail(ind.macd?.macd, 1)[0] ?? "--"}</span></div>
    <div class="adv-metric-row"><span>Bollinger Upper / Lower (last)</span><span>${formatSeriesTail(ind.bollinger?.upper, 1)[0] ?? "--"} / ${formatSeriesTail(ind.bollinger?.lower, 1)[0] ?? "--"}</span></div>
    <div class="adv-metric-row"><span>Stochastic %K (last)</span><span>${formatSeriesTail(ind.stochastic?.k, 1)[0] ?? "--"}</span></div>
  `;
}

async function calcAdvIndicator() {
  const output = document.getElementById("advIndicatorOutput");
  if (!output) {
    return;
  }

  const symbol = document.getElementById("advIndicatorSymbol")?.value || "BTC";
  const interval = document.getElementById("advIndicatorInterval")?.value || "1h";
  const type = document.getElementById("advIndicatorType")?.value || "sma";
  const period = Number(document.getElementById("advIndicatorPeriod")?.value || 14);

  output.innerHTML = '<p class="empty">Calculating…</p>';

  try {
    const series = await apiCall(
      `/api/chart/series?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}`,
      { key: "adv-chart-series" }
    );
    const points = series.points || [];
    if (points.length < 5) {
      output.innerHTML = '<p class="empty">Not enough price history to calculate indicators.</p>';
      return;
    }

    const prices = points.map((p) => Number(p.close));
    const highs = points.map((p) => Number(p.high));
    const lows = points.map((p) => Number(p.low));
    const closes = prices;

    let result;
    if (type === "sma") {
      result = await apiCall("/api/indicators/sma", { key: "ind-sma", method: "POST", body: { prices, period } });
    } else if (type === "ema") {
      result = await apiCall("/api/indicators/ema", { key: "ind-ema", method: "POST", body: { prices, period } });
    } else if (type === "rsi") {
      result = await apiCall("/api/indicators/rsi", { key: "ind-rsi", method: "POST", body: { prices, period } });
    } else if (type === "macd") {
      result = await apiCall("/api/indicators/macd", { key: "ind-macd", method: "POST", body: { prices } });
    } else if (type === "bollinger") {
      result = await apiCall("/api/indicators/bollinger", {
        key: "ind-bollinger",
        method: "POST",
        body: { prices, period },
      });
    } else if (type === "stochastic") {
      result = await apiCall("/api/indicators/stochastic", {
        key: "ind-stochastic",
        method: "POST",
        body: { prices, period },
      });
    } else if (type === "atr") {
      result = await apiCall("/api/indicators/atr", {
        key: "ind-atr",
        method: "POST",
        body: { highs, lows, closes, period },
      });
    } else {
      result = await apiCall("/api/indicators/all", {
        key: "ind-all",
        method: "POST",
        body: { prices, highs, lows, closes, periods: { sma: period, ema: period, rsi: period } },
      });
    }

    output.innerHTML = renderAdvIndicatorResult(type, result, symbol);
  } catch (error) {
    output.innerHTML = `<p class="empty">Indicator calculation failed: ${escapeHtml(error.message)}</p>`;
  }
}

async function runAdvPortfolioAnalysis() {
  const output = document.getElementById("advAnalyticsOutput");
  if (!output) {
    return;
  }
  output.innerHTML = '<p class="empty">Analyzing…</p>';

  try {
    const { holdings, prices } = await getAdvancedPortfolioContext();
    if (!holdings.length) {
      output.innerHTML = '<p class="empty">No wallet balances found. Deposit funds in the Wallet tab first.</p>';
      return;
    }

    const result = await apiCall("/api/analytics/portfolio-analysis", {
      key: "adv-portfolio-analysis",
      method: "POST",
      body: { holdings, prices },
    });

    const m = result.metrics;
    const d = result.diversification;
    output.innerHTML = `
      <div class="adv-metric-row"><span>Total Value</span><span>$${Number(m.totalValue).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
      <div class="adv-metric-row"><span>Total Gain</span><span>${Number(m.totalGainPercent).toFixed(2)}%</span></div>
      <div class="adv-metric-row"><span>Holdings</span><span>${m.holdingCount}</span></div>
      <div class="adv-metric-row"><span>Concentration (Top 5)</span><span>${d.concentration}%</span></div>
      <div class="adv-metric-row"><span>Diversification Score</span><span>${d.diversificationScore}</span></div>
      <table>
        <thead><tr><th>Asset</th><th>Allocation</th><th>Value</th></tr></thead>
        <tbody>${Object.entries(m.breakdown)
          .map(
            ([symbol, b]) =>
              `<tr><td>${escapeHtml(symbol)}</td><td>${b.allocation.toFixed(2)}%</td><td>$${Number(b.value).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td></tr>`
          )
          .join("")}</tbody>
      </table>
      <p class="meta" style="margin-top:10px;"><strong>Recommendations:</strong></p>
      <ul>${result.recommendations.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>
    `;
  } catch (error) {
    output.innerHTML = `<p class="empty">Analysis failed: ${escapeHtml(error.message)}</p>`;
  }
}

async function runAdvOptimize() {
  const output = document.getElementById("advOptimizeOutput");
  if (!output) {
    return;
  }
  output.innerHTML = '<p class="empty">Optimizing…</p>';

  try {
    const { holdings, prices } = await getAdvancedPortfolioContext();
    if (!holdings.length) {
      output.innerHTML = '<p class="empty">No wallet balances found. Deposit funds in the Wallet tab first.</p>';
      return;
    }

    const enrichedHoldings = holdings.map((h) => ({
      ...h,
      value: h.quantity * (prices[h.symbol] || 0),
      ...(ADV_ASSET_PROFILES[h.symbol] || { expectedReturn: 0.1, volatility: 0.35 }),
    }));

    const result = await apiCall("/api/portfolio/optimize", {
      key: "adv-portfolio-optimize",
      method: "POST",
      body: { holdings: enrichedHoldings, prices, riskFreeRate: 0.02 },
    });

    const opt = result.optimization;
    output.innerHTML = `
      <div class="adv-metric-row"><span>Expected Return</span><span>${(Number(opt.expectedReturn) * 100).toFixed(2)}%</span></div>
      <div class="adv-metric-row"><span>Expected Risk</span><span>${(Number(opt.risk) * 100).toFixed(2)}%</span></div>
      <div class="adv-metric-row"><span>Sharpe Ratio</span><span>${opt.sharpeRatio}</span></div>
      <table>
        <thead><tr><th>Asset</th><th>Target Allocation</th><th>Target Value</th></tr></thead>
        <tbody>${opt.allocation
          .map(
            (a) =>
              `<tr><td>${escapeHtml(a.symbol)}</td><td>${a.allocation}%</td><td>$${Number(a.value).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td></tr>`
          )
          .join("")}</tbody>
      </table>
    `;
  } catch (error) {
    output.innerHTML = `<p class="empty">Optimization failed: ${escapeHtml(error.message)}</p>`;
  }
}

async function runAdvRiskAnalysis() {
  const output = document.getElementById("advRiskOutput");
  if (!output) {
    return;
  }
  output.innerHTML = '<p class="empty">Running risk analysis…</p>';

  try {
    const { riskPortfolio, holdings } = await getAdvancedPortfolioContext();
    if (!holdings.length) {
      output.innerHTML = '<p class="empty">No wallet balances found. Deposit funds in the Wallet tab first.</p>';
      return;
    }

    const result = await apiCall("/api/risk/analysis", {
      key: "adv-risk-analysis",
      method: "POST",
      body: { portfolio: riskPortfolio },
    });

    const v = result.valueAtRisk;
    const hedges = result.hedgingRecommendations || [];
    output.innerHTML = `
      <div class="adv-metric-row"><span>1-day VaR</span><span>$${v.var1Day}</span></div>
      <div class="adv-metric-row"><span>VaR (horizon)</span><span>$${v.varTimeHorizon}</span></div>
      <div class="adv-metric-row"><span>Confidence</span><span>${v.confidenceLevel}</span></div>
      ${
        hedges.length
          ? `<p class="meta" style="margin-top:10px;"><strong>Hedging Suggestions:</strong></p><ul>${hedges
              .map(
                (h) =>
                  `<li>${escapeHtml(h.recommendation)} <span class="adv-badge warn">${escapeHtml(h.symbol)}</span></li>`
              )
              .join("")}</ul>`
          : '<p class="meta" style="margin-top:10px;">No hedging alerts — portfolio looks balanced.</p>'
      }
    `;
  } catch (error) {
    output.innerHTML = `<p class="empty">Risk analysis failed: ${escapeHtml(error.message)}</p>`;
  }
}

async function runAdvVar() {
  const output = document.getElementById("advRiskOutput");
  if (!output) {
    return;
  }
  const confidenceLevel = Number(document.getElementById("advVarConfidence")?.value || 0.95);
  const timeHorizon = Number(document.getElementById("advVarHorizon")?.value || 1);
  output.innerHTML = '<p class="empty">Calculating VaR…</p>';

  try {
    const { riskPortfolio, holdings } = await getAdvancedPortfolioContext();
    if (!holdings.length) {
      output.innerHTML = '<p class="empty">No wallet balances found. Deposit funds in the Wallet tab first.</p>';
      return;
    }

    const result = await apiCall("/api/risk/var", {
      key: "adv-risk-var",
      method: "POST",
      body: { portfolio: riskPortfolio, confidenceLevel, timeHorizon },
    });

    output.innerHTML = `
      <div class="adv-metric-row"><span>1-day VaR</span><span>$${result.var1Day}</span></div>
      <div class="adv-metric-row"><span>VaR (${result.timeHorizon})</span><span>$${result.varTimeHorizon}</span></div>
      <div class="adv-metric-row"><span>Confidence</span><span>${result.confidenceLevel}</span></div>
    `;
  } catch (error) {
    output.innerHTML = `<p class="empty">VaR calculation failed: ${escapeHtml(error.message)}</p>`;
  }
}

async function runAdvStressTest() {
  const output = document.getElementById("advRiskOutput");
  if (!output) {
    return;
  }
  output.innerHTML = '<p class="empty">Running stress test…</p>';

  try {
    const { riskPortfolio, holdings } = await getAdvancedPortfolioContext();
    if (!holdings.length) {
      output.innerHTML = '<p class="empty">No wallet balances found. Deposit funds in the Wallet tab first.</p>';
      return;
    }

    const symbols = Object.keys(riskPortfolio);
    const scenarios = [
      {
        name: "bearMarket",
        description: "Broad market decline of 30%",
        shocks: Object.fromEntries(symbols.map((s) => [s, s === "USDT" ? 0 : -0.3])),
      },
      {
        name: "flashCrash",
        description: "Sharp 50% crash in majors, stables hold",
        shocks: Object.fromEntries(symbols.map((s) => [s, s === "USDT" ? -0.02 : -0.5])),
      },
      {
        name: "bullRun",
        description: "Broad market rally of 40%",
        shocks: Object.fromEntries(symbols.map((s) => [s, s === "USDT" ? 0.01 : 0.4])),
      },
    ];

    const result = await apiCall("/api/risk/stress-test", {
      key: "adv-risk-stress-test",
      method: "POST",
      body: { portfolio: riskPortfolio, scenarios },
    });

    const results = result.stressTestResults || {};
    output.innerHTML = `
      <table>
        <thead><tr><th>Scenario</th><th>Stressed Value</th><th>Loss</th><th>Status</th></tr></thead>
        <tbody>${Object.entries(results)
          .map(
            ([name, r]) => `
          <tr>
            <td>${escapeHtml(name)}<br /><span class="meta">${escapeHtml(r.scenarioDescription)}</span></td>
            <td>$${r.stressedPortfolioValue}</td>
            <td>${r.lossPercent}%</td>
            <td><span class="adv-badge ${r.status === "CRITICAL" ? "bad" : "good"}">${escapeHtml(r.status)}</span></td>
          </tr>
        `
          )
          .join("")}</tbody>
      </table>
    `;
  } catch (error) {
    output.innerHTML = `<p class="empty">Stress test failed: ${escapeHtml(error.message)}</p>`;
  }
}

async function refreshAdvMonitoring() {
  const metricsRoot = document.getElementById("advMonitorMetrics");
  const output = document.getElementById("advMonitorOutput");
  if (!metricsRoot || !output) {
    return;
  }

  try {
    const [health, metrics] = await Promise.all([
      apiCall("/api/monitoring/health", { key: "adv-monitor-health", skipAuthRedirect: true }),
      apiCall("/api/monitoring/metrics", { key: "adv-monitor-metrics" }),
    ]);

    const uptimeMinutes = Math.floor((health.uptime || 0) / 60);
    const heapUsedMb = ((health.memory?.heapUsed || 0) / (1024 * 1024)).toFixed(1);
    const heapTotalMb = ((health.memory?.heapTotal || 0) / (1024 * 1024)).toFixed(1);

    metricsRoot.innerHTML = `
      <div class="metric-card"><span class="meta">Status</span><strong>${health.status === "healthy" ? "🟢 Healthy" : "🔴 Unhealthy"}</strong></div>
      <div class="metric-card"><span class="meta">Uptime</span><strong>${uptimeMinutes}m</strong></div>
      <div class="metric-card"><span class="meta">Heap Used</span><strong>${heapUsedMb} MB</strong></div>
      <div class="metric-card"><span class="meta">Database</span><strong>${health.database?.connected ? "Connected" : "Offline"}</strong></div>
    `;

    output.innerHTML = `
      <div class="adv-metric-row"><span>Heap Total</span><span>${heapTotalMb} MB</span></div>
      <div class="adv-metric-row"><span>RSS</span><span>${((metrics.memory?.rss || 0) / (1024 * 1024)).toFixed(1)} MB</span></div>
      <div class="adv-metric-row"><span>Process Uptime</span><span>${Math.floor((metrics.uptime || 0) / 60)}m</span></div>
      <div class="adv-metric-row"><span>Checked At</span><span>${new Date(health.timestamp).toLocaleTimeString()}</span></div>
    `;
  } catch (error) {
    output.innerHTML = `<p class="empty">Monitoring refresh failed: ${escapeHtml(error.message)}</p>`;
  }
}
