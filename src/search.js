import axios from "axios";
import dotenv from "dotenv";
import fs from "fs/promises";

dotenv.config();

/**
 * Fetches search results from Google Custom Search API
 * @param {string} query - The search query
 * @param {number} numResults - Number of results to retrieve
 * @param {number} daysAgo - Restrict results to past X days (default: 1)
 * @returns {Promise<Array>} - Array of search result objects
 */
async function fetchSearchResults(query, numResults = 8, daysAgo = 1) {
  try {
    // Add date restriction parameter
    const dateRestrict = `d${daysAgo}`; // Restrict to past X days

    // Format date for better results
    const today = new Date();
    const formattedDate = today.toISOString().split("T")[0]; // YYYY-MM-DD format

    // Append date to query for better recency
    const enhancedQuery = `${query} after:${formattedDate}`;

    console.log(
      `Searching for: "${enhancedQuery}" with date restriction: ${dateRestrict}`
    );

    const response = await axios.get(
      "https://www.googleapis.com/customsearch/v1",
      {
        params: {
          key: process.env.GOOGLE_API_KEY,
          cx: process.env.GOOGLE_CSE_ID,
          q: enhancedQuery,
          num: numResults,
          dateRestrict: dateRestrict,
          sort: "date", // Sort by date if available in your CSE configuration
        },
      }
    );

    if (!response.data.items || response.data.items.length === 0) {
      console.log(
        "No search results found. Trying without strict date filtering..."
      );
      // Fallback: Try again with less strict date filtering
      return await fallbackSearch(query, numResults, daysAgo);
    }

    // Extract relevant information from search results
    const searchResults = response.data.items.map((item) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      date:
        item.pagemap?.metatags?.[0]?.["article:published_time"] ||
        item.pagemap?.metatags?.[0]?.["og:updated_time"] ||
        "Unknown",
    }));

    console.log(`Successfully fetched ${searchResults.length} search results.`);
    return searchResults;
  } catch (error) {
    console.error("Error fetching search results:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
      console.error("Response status:", error.response.status);
    }

    // Try fallback search if the error is related to date restrictions
    return await fallbackSearch(query, numResults, daysAgo + 2);
  }
}

/**
 * Fallback search with less strict date filtering
 * @param {string} query - The search query
 * @param {number} numResults - Number of results to retrieve
 * @param {number} expandedDays - Expanded number of days to look back
 * @returns {Promise<Array>} - Array of search result objects
 */
async function fallbackSearch(query, numResults, expandedDays) {
  try {
    console.log(
      `Trying fallback search with expanded date range: ${expandedDays} days...`
    );

    const dateRestrict = `d${expandedDays}`; // Expanded date range

    const response = await axios.get(
      "https://www.googleapis.com/customsearch/v1",
      {
        params: {
          key: process.env.GOOGLE_API_KEY,
          cx: process.env.GOOGLE_CSE_ID,
          q: query,
          num: numResults,
          dateRestrict: dateRestrict,
        },
      }
    );

    if (!response.data.items || response.data.items.length === 0) {
      console.log("No results found even with expanded date range.");
      return [];
    }

    // Extract relevant information from search results
    const searchResults = response.data.items.map((item) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      date:
        item.pagemap?.metatags?.[0]?.["article:published_time"] ||
        item.pagemap?.metatags?.[0]?.["og:updated_time"] ||
        "Unknown",
    }));

    console.log(`Fallback search found ${searchResults.length} results.`);
    return searchResults;
  } catch (error) {
    console.error("Error in fallback search:", error.message);
    return [];
  }
}

/**
 * Checks if a URL has been processed before
 * @param {string} url - The URL to check
 * @param {string} cacheFilePath - Path to the cache file
 * @returns {Promise<boolean>} - True if URL was previously processed
 */
async function isUrlProcessedBefore(
  url,
  cacheFilePath = "./processed_urls.json"
) {
  try {
    // Create cache file if it doesn't exist
    let processedUrls = [];
    try {
      const data = await fs.readFile(cacheFilePath, "utf8");
      processedUrls = JSON.parse(data);
    } catch (err) {
      if (err.code === "ENOENT") {
        await fs.writeFile(cacheFilePath, JSON.stringify([]), "utf8");
      } else {
        throw err;
      }
    }

    return processedUrls.includes(url);
  } catch (error) {
    console.error("Error checking processed URLs:", error.message);
    return false; // Assume not processed in case of error
  }
}

/**
 * Saves a URL to the processed list
 * @param {string} url - The URL to save
 * @param {string} cacheFilePath - Path to the cache file
 */
async function markUrlAsProcessed(
  url,
  cacheFilePath = "./processed_urls.json"
) {
  try {
    let processedUrls = [];
    try {
      const data = await fs.readFile(cacheFilePath, "utf8");
      processedUrls = JSON.parse(data);
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }

    if (!processedUrls.includes(url)) {
      processedUrls.push(url);
      // Keep only last 1000 URLs to prevent file from growing too large
      if (processedUrls.length > 1000) {
        processedUrls = processedUrls.slice(processedUrls.length - 1000);
      }
      await fs.writeFile(cacheFilePath, JSON.stringify(processedUrls), "utf8");
    }
  } catch (error) {
    console.error("Error saving processed URL:", error.message);
  }
}

export { fetchSearchResults, isUrlProcessedBefore, markUrlAsProcessed };
