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
  let browser = null;
  
  try {
    console.log(`Scraping content from: ${url}`);
    
    // Use the same launch config that worked before
    browser = await puppeteer.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--single-process'
      ],
      executablePath: '/app/node_modules/whatsapp-web.js/node_modules/puppeteer-core/.local-chromium/linux-*/chrome-linux/chrome',
      headless: 'new',
      timeout: 60000
    });

    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);
    
    // Simplified request interception
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Set user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    // Navigation with retries
    let response;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        break;
      } catch (err) {
        console.warn(`Attempt ${attempt + 1} failed: ${err.message}`);
        if (attempt === 2) throw err;
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    // Basic content extraction
    const content = await page.content();
    const $ = load(content);
    
    // Remove unwanted elements
    $('script, style, nav, footer, iframe').remove();
    
    // Get main content
    let text = $('body').text()
      .replace(/\s+/g, ' ')
      .trim();

    return { content: text, publishedDate: null };

  } catch (error) {
    console.error(`Error scraping ${url}:`, error.message);
    return { content: "", publishedDate: null };
  } finally {
    if (browser) await browser.close();
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