// src/utils/fetchWithPuppeteer.js
const chromium = require("@sparticuz/chromium");

let puppeteer;
const isServerless = !!(
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.VERCEL ||
  process.env.FUNCTIONS_WORKER_RUNTIME
);

/**
 * Robust fetch using Puppeteer. Options:
 *  - waitForSelectors: array of CSS selectors to wait for (first found wins)
 *  - timeout: ms (default 60000)
 */
async function fetchWithPuppeteer(url, options = {}) {
  options.waitForSelectors = options.waitForSelectors || [];
  options.timeout = options.timeout || 60000;

  // Lazy require to allow local dev (puppeteer) or serverless (puppeteer-core)
  let browser;
  try {
    if (isServerless) {
      puppeteer = require("puppeteer-core");
    } else {
      try {
        puppeteer = require("puppeteer");
      } catch (e) {
        // fallback to puppeteer-core + sparticuz if puppeteer not installed locally
        puppeteer = require("puppeteer-core");
      }
    }

    const launchOptions = isServerless
      ? {
          args: chromium.args.concat([
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
          ]),
          defaultViewport: chromium.defaultViewport,
          executablePath: await chromium.executablePath(),
          headless: chromium.headless,
          ignoreHTTPSErrors: true,
        }
      : {
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
          ignoreHTTPSErrors: true,
        };

    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    // set sensible viewport & headers
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({
      "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
      referer: "https://jkt48.com/",
    });

    // small evasions
    await page.evaluateOnNewDocument(() => {
      try {
        Object.defineProperty(navigator, "webdriver", { get: () => false });
      } catch (e) {}
      try {
        Object.defineProperty(navigator, "languages", { get: () => ["id-ID", "en-US"] });
      } catch (e) {}
      try {
        Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
      } catch (e) {}
    });

    // increase navigation timeout
    page.setDefaultNavigationTimeout(options.timeout);

    // use domcontentloaded first (more reliable with CF), then wait for selector(s)
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: options.timeout });

    // wait for at least one of requested selectors (if provided)
    let selectorFound = false;
    if (options.waitForSelectors.length) {
      // try each selector with a smaller timeout; first found breaks
      const perSelectorTimeout = Math.min(12000, Math.max(5000, Math.floor(options.timeout / 4)));
      for (const sel of options.waitForSelectors) {
        try {
          await page.waitForSelector(sel, { timeout: perSelectorTimeout });
          selectorFound = true;
          break;
        } catch (err) {
          // ignore and try next selector
        }
      }
    }

    // if nothing found, give the page a short extra wait (Cloudflare challenge sometimes)
    if (!selectorFound) {
      await page.waitForTimeout(3000);
    }

    const html = await page.content();

    await browser.close();
    return html;
  } catch (err) {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {}
    }
    // rethrow with more context
    throw new Error(`fetchWithPuppeteer failed: ${err.message}`);
  }
}

module.exports = { fetchWithPuppeteer };
