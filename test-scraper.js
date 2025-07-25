import puppeteer from "puppeteer";

async function testScrape() {
  let browser = null;

  try {
    const url = "https://www.edtechdigest.com/2025/06/19/edsby-4/";
    console.log(`Test scraping: ${url}`);

    // Launch browser with the same configuration as the main scraper
    browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      executablePath:
        "/app/node_modules/whatsapp-web.js/node_modules/puppeteer-core/.local-chromium/linux-1045629/chrome-linux/chrome",
      headless: true,
    });

    const page = await browser.newPage();

    // Set timeout for navigation
    await page.setDefaultNavigationTimeout(60000);

    // Block unnecessary resources to speed up loading
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const resourceType = request.resourceType();
      if (["image", "stylesheet", "font", "media"].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Set user agent to avoid being blocked
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );

    // Navigate to the URL
    console.log("Navigating to URL...");
    await page.goto(url, { waitUntil: "domcontentloaded" });

    // Extract some text content
    const pageTitle = await page.title();
    console.log("Page title:", pageTitle);

    // Get some text content from the page
    const headingText = await page.evaluate(() => {
      const heading = document.querySelector("h1");
      return heading ? heading.innerText : "No heading found";
    });

    console.log("Main heading:", headingText);

    // Get the first paragraph text
    const paragraphText = await page.evaluate(() => {
      const paragraph = document.querySelector("p");
      return paragraph
        ? paragraph.innerText.substring(0, 200) + "..."
        : "No paragraph found";
    });

    console.log("First paragraph sample:", paragraphText);

    console.log("Scraping test completed successfully!");
  } catch (error) {
    console.error(`Error during test scraping:`, error.message);
  } finally {
    if (browser) {
      await browser.close();
      console.log("Browser closed");
    }
  }
}

// Run the test function
testScrape();
