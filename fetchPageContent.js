import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
import { load } from "cheerio";

puppeteer.use(StealthPlugin());

async function fetchPageContent(url) {
  const isHeroku = !!process.env.DYNO;

  const launchOptions = {
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--single-process",
      "--no-zygote",
      "--disable-setuid-sandbox",
      "--disable-accelerated-2d-canvas",
      "--disable-web-security",
    ],
    defaultViewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
    timeout: 30000, // Add launch timeout
  };

  // Enhanced executable path handling for Heroku
  if (isHeroku) {
    const possiblePaths = [
      process.env.PUPPETEER_EXECUTABLE_PATH,
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium-browser",
      "/app/.apt/usr/bin/google-chrome",
      "/app/.apt/opt/google/chrome/chrome",
      "/app/.chrome/bin/chrome",
    ].filter(Boolean);

    for (const path of possiblePaths) {
      try {
        if (path && fs.existsSync(path)) {
          launchOptions.executablePath = path;
          console.log(`Using Chrome executable at: ${path}`);
          break;
        }
      } catch (err) {
        console.log(`Error checking path ${path}:`, err.message);
      }
    }

    if (!launchOptions.executablePath) {
      console.warn("Could not find Chrome executable, falling back to default");
    }
  }

  let browser;
  try {
    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    // Set realistic user agent and other stealth options
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
    });

    // Configure page behavior for better stealth
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => false,
      });
    });

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    const html = await page.content();
    // Example usage of cheerio:
    // const $ = load(html);
    // ...
    return html;
  } catch (error) {
    console.error("Error during scraping:", error);
    throw error;
  } finally {
    if (browser) {
      await browser
        .close()
        .catch((e) => console.error("Error closing browser:", e));
    }
  }
}

export { fetchPageContent };
