import puppeteer from "puppeteer";
import { load } from "cheerio";

/**
 * Checks if a URL appears to be a homepage or non-article page
 * @param {string} url - The URL to check
 * @returns {boolean} - True if the URL appears to be a homepage or non-article
 */
function isHomepage(url) {
  try {
    // Parse the URL
    const urlObj = new URL(url);
    const path = urlObj.pathname;

    // Common homepage patterns
    const homepagePatterns = [
      /^\/$/, // Just a slash
      /^\/index\.(html|php|asp|jsp)$/i, // index.html, index.php, etc.
      /^\/home\.(html|php|asp|jsp)$/i, // home.html, home.php, etc.
      /^\/default\.(html|php|asp|jsp)$/i, // default.html, etc.
      /^\/welcome\.(html|php|asp|jsp)$/i, // welcome.html, etc.
      /^\/home\/?$/i, // /home or /home/
      /^\/main\/?$/i, // /main or /main/
    ];

    // Check if the path matches homepage patterns
    if (homepagePatterns.some((pattern) => pattern.test(path))) {
      console.log(`Skipping homepage: ${url}`);
      return true;
    }

    // Check if URL is just the domain
    if (path === "" || path === "/") {
      console.log(`Skipping root homepage: ${url}`);
      return true;
    }

    // Check for non-article pages like "about", "contact", etc.
    const nonArticlePatterns = [
      /^\/about\/?$/i,
      /^\/contact\/?$/i,
      /^\/faq\/?$/i,
      /^\/help\/?$/i,
      /^\/support\/?$/i,
      /^\/terms\/?$/i,
      /^\/privacy\/?$/i,
      /^\/login\/?$/i,
      /^\/signup\/?$/i,
      /^\/register\/?$/i,
      /^\/account\/?$/i,
    ];

    if (nonArticlePatterns.some((pattern) => pattern.test(path))) {
      console.log(`Skipping non-article page: ${url}`);
      return true;
    }

    // Default to not being a homepage
    return false;
  } catch (error) {
    console.error(`Error checking if ${url} is homepage:`, error.message);
    return false; // If we can't determine, don't skip
  }
}

/**
 * Scrapes the main content from a URL
 * @param {string} url - The URL to scrape
 * @returns {Promise<Object>} - The extracted text content and metadata
 */
async function scrapeContent(url) {
  // Skip homepages
  if (isHomepage(url)) {
    return { content: "", publishedDate: null };
  }

  let browser = null;

  try {
    console.log(`Scraping content from: ${url}`);

    // Check if running on Render (they provide this env var)
    const isOnRender = process.env.RENDER === "true";

    const puppeteerOptions = {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
      ],
      ignoreDefaultArgs: ["--disable-extensions"],
      timeout: 60000, // Increase browser launch timeout
    };

    // Add Render-specific configuration
    if (isOnRender) {
      console.log("Running on Render, using Render-specific Puppeteer config");
      puppeteerOptions.executablePath =
        process.env.PUPPETEER_EXECUTABLE_PATH ||
        "/opt/render/.cache/puppeteer/chrome/linux-119.0.6045.105/chrome-linux64/chrome";
    }

    browser = await puppeteer.launch(puppeteerOptions);

    const page = await browser.newPage();

    // Increase timeout for navigation
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

    // Navigate to the URL with retry mechanism
    let response = null;
    let attempts = 0;
    const maxAttempts = 3;

    while (!response && attempts < maxAttempts) {
      try {
        attempts++;
        console.log(`Attempt ${attempts} to load ${url}`);

        // Set a shorter timeout for each attempt
        const navigationTimeout = 30000;
        response = await Promise.race([
          page.goto(url, { waitUntil: "domcontentloaded" }),
          new Promise((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(`Navigation timeout after ${navigationTimeout}ms`)
                ),
              navigationTimeout
            )
          ),
        ]);

        // If we get here, navigation succeeded
        break;
      } catch (navigationError) {
        console.warn(
          `Navigation attempt ${attempts} failed: ${navigationError.message}`
        );

        if (attempts >= maxAttempts) {
          console.error(
            `Failed to load page after ${maxAttempts} attempts: ${url}`
          );
          return { content: "", publishedDate: null };
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // Check if the page loaded successfully
    if (!response || (response.status && response.status() !== 200)) {
      console.error(
        `Failed to load page: ${url}, status: ${
          response ? response.status() : "unknown"
        }`
      );
      return { content: "", publishedDate: null };
    }

    // Wait for content to load
    try {
      await page
        .waitForSelector("p, article, .article, .content, #content, main", {
          timeout: 5000,
        })
        .catch(() =>
          console.log("No common content selectors found, proceeding anyway")
        );
    } catch (timeoutError) {
      // Continue anyway, we'll try to extract whatever content is available
      console.log(
        "Timed out waiting for content selectors, proceeding with extraction anyway"
      );
    }

    // Get the page content
    const content = await page.content();

    // Load the content into Cheerio
    const $ = load(content);

    // Remove elements that don't contain useful content
    $(
      "script, style, nav, footer, header, aside, .sidebar, .footer, .header, .nav, .menu, .ad, .ads, .advertisement, .cookie, .popup"
    ).remove();

    // Extract publication date if available
    const publishedDate = extractPublicationDate($);

    // Extract title for context
    const title = $("title").text() || $("h1").first().text() || "";

    // Extract all text content from the page using a comprehensive approach
    let extractedText = "";

    // Try multiple content extraction strategies
    const contentSelectors = [
      "article",
      ".article",
      ".content",
      "#content",
      "main",
      ".post",
      ".entry",
      ".story",
      ".text",
      ".body",
    ];

    // First, try to find content in specific article/content containers
    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        const text = element.text().trim();
        if (text.length > 200) {
          // Found substantial content
          extractedText = text;
          break;
        }
      }
    }

    // If no substantial content found in containers, extract from paragraphs
    if (!extractedText || extractedText.length < 200) {
      const paragraphs = $("p")
        .map((_, el) => $(el).text().trim())
        .get();
      extractedText = paragraphs.join(" ").trim();
    }

    // If still no content, try extracting from all text elements
    if (!extractedText || extractedText.length < 100) {
      const allText = $("body").text().trim();
      extractedText = allText;
    }

    // Clean and process the extracted text
    const cleanedText = cleanContent(extractedText);

    // Check if we have meaningful content
    if (!cleanedText || cleanedText.length < 100) {
      console.log(`Insufficient content extracted from: ${url}`);
      return { content: "", publishedDate: null };
    }

    console.log(
      `Successfully extracted ${cleanedText.length} characters from: ${url}`
    );

    return {
      content: cleanedText,
      publishedDate: publishedDate,
      title: title,
    };
  } catch (error) {
    console.error(`Error scraping ${url}:`, error.message);
    return { content: "", publishedDate: null };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Extracts publication date from the page
 * @param {Object} $ - Cheerio object
 * @returns {string|null} - Publication date or null
 */
function extractPublicationDate($) {
  // Common selectors for publication dates
  const dateSelectors = [
    'meta[property="article:published_time"]',
    'meta[name="publish_date"]',
    'meta[name="date"]',
    'meta[name="pubdate"]',
    'meta[name="publication_date"]',
    "time[datetime]",
    ".date",
    ".published",
    ".pubdate",
    ".timestamp",
  ];

  for (const selector of dateSelectors) {
    const element = $(selector);
    if (element.length > 0) {
      const date =
        element.attr("content") || element.attr("datetime") || element.text();
      if (date) {
        return date.trim();
      }
    }
  }

  return null;
}

/**
 * Cleans and processes extracted text content
 * @param {string} text - Raw extracted text
 * @returns {string} - Cleaned text
 */
function cleanContent(text) {
  if (!text) return "";

  return text
    .replace(/\s+/g, " ") // Replace multiple whitespace with single space
    .replace(/\n+/g, " ") // Replace newlines with spaces
    .replace(/\t+/g, " ") // Replace tabs with spaces
    .trim();
}

/**
 * Scrapes content from multiple URLs
 * @param {Array} searchResults - Array of search result objects
 * @returns {Promise<Array>} - Array of scraped content objects
 */
async function scrapeMultipleUrls(searchResults) {
  const scrapedResults = [];

  for (const result of searchResults) {
    try {
      const scrapedContent = await scrapeContent(result.url);

      if (scrapedContent.content) {
        scrapedResults.push({
          title: result.title,
          url: result.url,
          content: scrapedContent.content,
          publishedDate: scrapedContent.publishedDate || result.date,
        });
      } else {
        console.log(`No content extracted from: ${result.url}`);
      }
    } catch (error) {
      console.error(`Error processing ${result.url}:`, error.message);
    }

    // Add a small delay between requests to be respectful
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log(
    `Successfully scraped content from ${scrapedResults.length} URLs`
  );
  return scrapedResults;
}

export { scrapeMultipleUrls };
