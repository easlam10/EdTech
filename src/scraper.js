const puppeteer = require("puppeteer");
const cheerio = require("cheerio");

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
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
      ],
      timeout: 60000, // Increase browser launch timeout
    });

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
    const $ = cheerio.load(content);

    // Remove elements that don't contain useful content
    $(
      "script, style, nav, footer, header, aside, .sidebar, .footer, .header, .nav, .menu, .ad, .ads, .advertisement, .cookie, .popup"
    ).remove();

    // Extract publication date if available
    const publishedDate = extractPublicationDate($);

    // Extract title for context
    const title = $("title").text() || $("h1").first().text() || "";

    // Extract all text content from the page using a comprehensive approach
    let allText = "";

    // First, try to identify the main article content
    const articleSelectors = [
      "article",
      ".article",
      ".post",
      ".entry",
      ".content",
      "#content",
      ".article-content",
      ".post-content",
      ".entry-content",
      "main",
      "[role='main']",
      ".main-content",
      "#main-content",
      ".body-content",
      "#body-content",
    ];

    let mainContent = "";
    for (const selector of articleSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        // Found a potential main content container
        mainContent = element.text().trim();
        if (mainContent.length > 500) {
          // If we found substantial content, use it
          console.log(`Found main content using selector: ${selector}`);
          break;
        }
      }
    }

    // If we found good main content, use it; otherwise fall back to comprehensive extraction
    if (mainContent.length > 500) {
      allText = title + " " + mainContent;
    } else {
      // Comprehensive extraction approach
      // 1. Get all paragraph text - paragraphs typically contain the main content
      const paragraphText = $("p")
        .map(function () {
          return $(this).text().trim();
        })
        .get()
        .join(" ");

      // 2. Get text from headings which provide structure and important context
      const headingText = $("h1, h2, h3, h4, h5, h6")
        .map(function () {
          return $(this).text().trim();
        })
        .get()
        .join(" ");

      // 3. Get text from list items which often contain important information
      const listText = $("li")
        .map(function () {
          return $(this).text().trim();
        })
        .get()
        .join(" ");

      // 4. Get text from other common content elements
      const otherContentText = $("article, section, main, .content, #content")
        .map(function () {
          // Only get text not already captured in paragraphs or direct div text
          return $(this).clone().find("p, div").remove().end().text().trim();
        })
        .get()
        .join(" ");

      // Combine all the text sources
      allText = `${title} ${headingText} ${paragraphText} ${listText} ${otherContentText}`;
    }

    // If we somehow got no text, fall back to body text
    if (!allText || allText.trim().length < 50) {
      allText = $("body").text().trim();
    }

    // Clean the text
    const cleanText = cleanContent(allText);

    console.log(`Scraped ${cleanText.length} chars from ${url}`);

    return {
      content: cleanText,
      publishedDate: publishedDate,
    };
  } catch (error) {
    console.error(`Error scraping content from ${url}:`, error.message);
    return { content: "", publishedDate: null };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Extracts publication date from common metadata tags
 * @param {Object} $ - Cheerio instance
 * @returns {string} - Publication date if found
 */
function extractPublicationDate($) {
  // Try to find the publication date from metadata tags
  let dateStr =
    $('meta[property="article:published_time"]').attr("content") ||
    $('meta[name="pubdate"]').attr("content") ||
    $('meta[name="publication_date"]').attr("content") ||
    $('meta[name="date"]').attr("content");

  // If no metadata tags, look for time elements
  if (!dateStr) {
    const timeEl = $("time[datetime]").first();
    if (timeEl.length) {
      dateStr = timeEl.attr("datetime");
    }
  }

  if (dateStr) {
    try {
      const date = new Date(dateStr);
      return date.toISOString().split("T")[0]; // Format as YYYY-MM-DD
    } catch (e) {
      return null;
    }
  }

  return null;
}

/**
 * Cleans and formats the extracted content
 * @param {string} text - Raw extracted text
 * @returns {string} - Cleaned text
 */
function cleanContent(text) {
  return text
    .replace(/(\r\n|\n|\r)/gm, " ") // Replace line breaks with spaces
    .replace(/\s+/g, " ") // Replace multiple spaces with a single space
    .replace(/\u00A0/g, " ") // Replace non-breaking spaces
    .trim(); // Remove leading/trailing whitespace
}

/**
 * Scrapes content from multiple URLs
 * @param {Array<Object>} searchResults - Array of search result objects with URLs
 * @returns {Promise<Array<Object>>} - Array of search results with scraped content
 */
async function scrapeMultipleUrls(searchResults) {
  const results = [];

  for (const result of searchResults) {
    try {
      // Skip if the URL is a homepage
      if (isHomepage(result.url)) {
        console.log(`Skipping homepage URL: ${result.url}`);
        continue;
      }

      const { content, publishedDate } = await scrapeContent(result.url);

      // Only include content that has text
      if (content) {
        const scrapedResult = {
          ...result,
          content,
          publishedDate,
        };

        results.push(scrapedResult);
      }
    } catch (error) {
      console.error(`Error processing ${result.url}:`, error.message);
    }
  }

  console.log(
    `Scraped content from ${results.length} URLs out of ${searchResults.length} results`
  );
  return results;
}

module.exports = { scrapeContent, scrapeMultipleUrls };
