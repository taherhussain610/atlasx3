const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright-core");

const baseUrl = process.env.APP_URL || "http://localhost:4000";
const browserCandidates = {
  linux: [
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/microsoft-edge",
  ],
  darwin: [
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ],
  win32: [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ],
};

function resolveBrowserPath() {
  const candidates = process.env.EDGE_PATH
    ? [process.env.EDGE_PATH]
    : browserCandidates[process.platform] || [];
  const browserPath = candidates.find((candidate) => fs.existsSync(candidate));
  assert.ok(
    browserPath,
    `No Chromium-compatible browser found. Set EDGE_PATH to an installed browser executable.`,
  );
  return browserPath;
}

async function isAppReady() {
  try {
    const health = await fetch(`${baseUrl}/api/health`);
    return health.ok;
  } catch {
    return false;
  }
}

async function startAppIfNeeded() {
  if (await isAppReady()) {
    return null;
  }

  assert.equal(
    process.env.APP_URL,
    undefined,
    `Application is not running at configured APP_URL ${baseUrl}`,
  );

  const appRoot = path.join(__dirname, "..");
  const serverProcess = spawn(process.execPath, ["src/server.js"], {
    cwd: appRoot,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverOutput = "";
  serverProcess.stdout.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });
  serverProcess.stderr.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await isAppReady()) {
      return serverProcess;
    }
    if (serverProcess.exitCode !== null) {
      throw new Error(`Application exited during startup.\n${serverOutput}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  serverProcess.kill();
  throw new Error(
    `Application did not become ready at ${baseUrl}.\n${serverOutput}`,
  );
}

async function stopApp(serverProcess) {
  if (!serverProcess || serverProcess.exitCode !== null) {
    return;
  }

  serverProcess.kill();
  await new Promise((resolve) => {
    const forceStop = setTimeout(() => {
      if (serverProcess.exitCode === null) {
        serverProcess.kill("SIGKILL");
      }
      resolve();
    }, 2000);
    serverProcess.once("exit", () => {
      clearTimeout(forceStop);
      resolve();
    });
  });
}

async function assertNoPageOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  assert.ok(
    dimensions.scrollWidth <= dimensions.clientWidth + 1,
    `${label} page overflows horizontally: ${dimensions.scrollWidth}px > ${dimensions.clientWidth}px`,
  );
}

async function run() {
  const serverProcess = await startAppIfNeeded();
  let browser;

  try {
    browser = await chromium.launch({
      executablePath: resolveBrowserPath(),
      headless: true,
    });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Create account" }).click();

    const timestamp = Date.now();
    await page
      .locator('#registerForm input[name="username"]')
      .fill(`ui${timestamp}`);
    await page
      .locator('#registerForm input[name="email"]')
      .fill(`ui-${timestamp}@example.com`);
    await page
      .locator('#registerForm input[name="password"]')
      .fill("Passw0rd!UiSmoke");
    await page.locator('#registerForm button[type="submit"]').click();
    await page
      .locator("#dashboard")
      .waitFor({ state: "visible", timeout: 20000 });
    await page.getByText("Account created", { exact: true }).waitFor({
      state: "visible",
      timeout: 20000,
    });
    assert.equal(await page.locator("#toast").textContent(), "Account created");

    const sessionKeys = await page.evaluate(() => ({
      canonical: localStorage.getItem("atlasx_token"),
      compatibility: localStorage.getItem("token"),
    }));
    assert.ok(sessionKeys.canonical);
    assert.equal(sessionKeys.compatibility, sessionKeys.canonical);
    await page.locator("#toast").waitFor({ state: "hidden" });

    await page.route("**/api/rates", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: '{"error":"Unavailable"}',
      }),
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await page
      .locator("#dashboard")
      .waitFor({ state: "visible", timeout: 20000 });
    const restoredSession = await page.evaluate(() => ({
      canonical: localStorage.getItem("atlasx_token"),
      compatibility: localStorage.getItem("token"),
    }));
    assert.deepEqual(restoredSession, sessionKeys);
    assert.match(
      await page.locator("#sessionStatus").textContent(),
      /^Session: /,
    );
    await page.unroute("**/api/rates");

    const dashboardTabs = page.locator(".dashboard-tab");
    const dashboardTabCount = await dashboardTabs.count();
    assert.equal(dashboardTabCount, 37);
    assert.equal(
      await page.locator('.dashboard-tab[aria-selected="true"]').count(),
      1,
    );
    assert.equal(await page.locator('.dashboard-tab[tabindex="0"]').count(), 1);

    await page.route("**/api/hardhat/status", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          rpcUrl: "http://127.0.0.1:8545",
          node: {
            online: false,
            chainId: null,
            blockNumber: null,
            accountCount: 0,
          },
          compiler: { version: "0.8.28", artifactAvailable: true },
          deployment: null,
          staleDeployment: false,
        }),
      }),
    );

    for (let index = 0; index < dashboardTabCount; index += 1) {
      const tab = dashboardTabs.nth(index);
      const panelId = await tab.getAttribute("data-section-target");
      await tab.click();
      await page.locator(`#${panelId}`).waitFor({ state: "visible" });
    }

    await page
      .locator('.dashboard-tab[data-section-target="hardhatPanel"]')
      .click();
    await page
      .locator("#hardhatStatus")
      .getByText("Offline", { exact: true })
      .waitFor();
    assert.equal(await page.locator("#hardhatCompileBtn").isEnabled(), true);
    assert.equal(await page.locator("#hardhatDeployBtn").isDisabled(), true);

    await dashboardTabs.first().focus();
    await page.keyboard.press("End");
    await page.locator("#assistantPanel").waitFor({ state: "visible" });
    assert.equal(
      await dashboardTabs.last().getAttribute("aria-selected"),
      "true",
    );
    assert.equal(await dashboardTabs.last().getAttribute("tabindex"), "0");

    await page
      .locator('.dashboard-tab[data-section-target="apiKeysPanel"]')
      .click();
    await page.locator("#apiKeyName").fill(`smoke-key-${timestamp}`);
    await page.locator('[data-action="create-api-key"]').click();
    await page.getByText("API key generated", { exact: true }).waitFor({
      state: "visible",
      timeout: 20000,
    });
    await page.locator("#apiKeysBody tr").first().waitFor({ state: "visible" });
    await page.locator("#toast").waitFor({ state: "hidden" });

    await dashboardTabs.last().focus();
    await page.keyboard.press("Home");
    await page.locator("#marketsPanel").waitFor({ state: "visible" });
    assert.equal(
      await dashboardTabs.first().getAttribute("aria-selected"),
      "true",
    );

    await page
      .locator('.dashboard-tab[data-section-target="metatraderPanel"]')
      .click();
    await page.locator("#metatraderPanel").waitFor({ state: "visible" });
    const passiveToastVisible = await page.locator("#toast").isVisible();
    const passiveToastText = await page.locator("#toast").textContent();
    assert.equal(
      passiveToastVisible,
      false,
      `Passive dashboard navigation displayed a toast: ${passiveToastText}`,
    );

    await page
      .locator('.nav-link[data-section-target="settingsPanel"]')
      .click();
    await page
      .locator('#paymentTerminalForm [name="cardNumber"]')
      .fill("4532 0151 1283 0366");
    await page
      .locator('#paymentTerminalForm [name="expiryDate"]')
      .fill("12/29");
    await page.locator('#paymentTerminalForm [name="cvv"]').fill("123");
    await page
      .locator('#paymentTerminalForm [name="cardholderName"]')
      .fill("UI TEST USER");
    await page.locator('#paymentTerminalForm [name="amount"]').fill("25.50");
    await page.locator("#paymentTerminalForm button[type=submit]").click();
    await page
      .locator("#terminalResult")
      .getByText("Payment processed", { exact: true })
      .waitFor({ state: "visible", timeout: 20000 });
    assert.doesNotMatch(
      await page.locator("#terminalResult").textContent(),
      /4532015112830366/,
    );

    await page
      .locator('.dashboard-tab[data-section-target="p2pPanel"]')
      .click();
    await page.locator("#createP2POrderForm").waitFor({ state: "visible" });
    await page
      .locator('.dashboard-tab[data-section-target="p2pOrdersPanel"]')
      .click();
    await page.locator("#p2pMyOrdersBody").waitFor({ state: "visible" });

    await page
      .locator('.dashboard-tab[data-section-target="copyTradingPanel"]')
      .click();
    const unsafeTraderName =
      '<strong data-copy-injection="true">Unsafe Trader</strong>';
    await page.locator("#copyTraderRegisterForm").waitFor({ state: "visible" });
    await page
      .locator('#copyTraderRegisterForm input[name="displayName"]')
      .fill(unsafeTraderName);
    const [copyRegistrationResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/api/copy-trading/trader/register") &&
          response.request().method() === "POST",
      ),
      page.locator('#copyTraderRegisterForm button[type="submit"]').click(),
    ]);
    assert.equal(copyRegistrationResponse.ok(), true);
    assert.equal(
      await page.locator("#copyTradingPanel [data-copy-injection]").count(),
      0,
    );
    await page.locator("#followingTradersBody").waitFor({ state: "visible" });

    await page
      .locator('.dashboard-tab[data-section-target="predictionPanel"]')
      .click();
    await page
      .locator("#predictionPositionsBody")
      .waitFor({ state: "visible" });
    await page
      .locator("#predictionLeaderboardBody")
      .waitFor({ state: "visible" });
    let predictionDialogType;
    page.once("dialog", async (dialog) => {
      predictionDialogType = dialog.type();
      await dialog.dismiss();
    });
    await page.locator('[data-action="place-prediction"]').first().click();
    assert.equal(predictionDialogType, "prompt");

    await assertNoPageOverflow(page, "desktop");
    const desktopScreenshot = path.join(
      os.tmpdir(),
      "atlasx-ui-smoke-desktop.png",
    );
    await page.screenshot({ path: desktopScreenshot, fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .locator('.dashboard-tab[data-section-target="overviewPanel"]')
      .click();
    await assertNoPageOverflow(page, "mobile");
    const mobileScreenshot = path.join(
      os.tmpdir(),
      "atlasx-ui-smoke-mobile.png",
    );
    await page.screenshot({ path: mobileScreenshot, fullPage: true });

    assert.deepEqual(
      pageErrors,
      [],
      `Browser page errors: ${pageErrors.join("; ")}`,
    );
    console.log(
      JSON.stringify(
        {
          dashboardTabs: dashboardTabCount,
          sessionSynchronized: true,
          desktopScreenshot,
          mobileScreenshot,
          pageErrors: pageErrors.length,
        },
        null,
        2,
      ),
    );
  } finally {
    if (browser) {
      await browser.close();
    }
    await stopApp(serverProcess);
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
