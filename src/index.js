require("dotenv").config();
const {
  fetchSearchResults,
  isUrlProcessedBefore,
  markUrlAsProcessed,
} = require("./search");
const { scrapeMultipleUrls } = require("./scraper");
const { processArticles } = require("./summarizer");
const { sendArticleSummaries } = require("./messenger");

/**
 * Main function to execute the entire process
 * @param {string} searchQuery - The search query to use
 * @param {number} numResults - Number of results to process
 * @param {number} daysAgo - Restrict results to past X days
 */
async function main(
  searchQuery = "IT news in education sector",
  numResults = 8,
  daysAgo = 1
) {
  try {
    console.log(
      `Starting the process with query: "${searchQuery}", looking at past ${daysAgo} day(s)`
    );
    console.log(`Date: ${new Date().toLocaleDateString()}`);

    // Step 1: Fetch search results from Google Custom Search API
    console.log("\n=== STEP 1: Fetching search results ===");
    const searchResults = await fetchSearchResults(
      searchQuery,
      numResults,
      daysAgo
    );

    if (!searchResults.length) {
      console.error("No search results found. Exiting process.");
      return;
    }

    console.log(`Found ${searchResults.length} search results.`);

    // Filter out URLs that have been processed before
    const newResults = [];
    for (const result of searchResults) {
      const alreadyProcessed = await isUrlProcessedBefore(result.url);
      if (!alreadyProcessed) {
        newResults.push(result);
      } else {
        console.log(`Skipping previously processed URL: ${result.url}`);
      }
    }

    if (!newResults.length) {
      console.log(
        "All search results have been processed previously. Try increasing daysAgo parameter or using a different query."
      );
      return;
    }

    console.log(`Proceeding with ${newResults.length} new results.`);

    // Step 2: Scrape content from each URL
    console.log("\n=== STEP 2: Scraping content from URLs ===");
    const scrapedResults = await scrapeMultipleUrls(newResults);

    if (!scrapedResults.length) {
      console.error("No content could be scraped. Exiting process.");
      return;
    }

    console.log(
      `Successfully scraped content from ${scrapedResults.length} URLs.`
    );

    // Step 3: Process and summarize the content using Google Gemini
    console.log("\n=== STEP 3: Generating summaries with Gemini ===");
    const processedArticles = await processArticles(scrapedResults);

    if (!processedArticles.length) {
      console.error("No summaries could be generated. Exiting process.");
      return;
    }

    console.log(
      `Successfully generated ${processedArticles.length} article summaries.`
    );

    // Mark URLs as processed after successful processing
    for (const article of processedArticles) {
      await markUrlAsProcessed(article.url);
      console.log(`Marked as processed: ${article.url}`);
    }

    // Step 4: Send the combined summaries via WhatsApp
    console.log("\n=== STEP 4: Sending summaries via WhatsApp ===");
    await sendArticleSummaries(processedArticles);

    console.log("\n=== Process completed successfully! ===");
  } catch (error) {
    console.error("Error in main process:", error.message);
    process.exit(1);
  }
}

// Suggested optimal EdTech search queries
const recommendedQueries = [
  "new EdTech teaching methods applications",
  "innovative classroom technology techniques",
  "AI transforming teaching learning methods",
  "practical EdTech tools improving student outcomes",
  "how technology is changing classroom teaching methods",
];

// Allow command line arguments for search query and number of results
if (require.main === module) {
  const args = process.argv.slice(2);
  const searchQuery = args[0] || recommendedQueries[0]; // Use first recommended query as default
  const numResults = parseInt(args[1]) || 8;
  const daysAgo = parseInt(args[2]) || 1;

  main(searchQuery, numResults, daysAgo).catch((error) => {
    console.error("Unhandled error in main process:", error);
    process.exit(1);
  });
}

module.exports = { main };
