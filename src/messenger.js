const twilio = require("twilio");
require("dotenv").config();

// Initialize Twilio client
let client;
try {
  client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
} catch (error) {
  console.warn("Warning: Failed to initialize Twilio client:", error.message);
}

/**
 * Extracts clean domain names from URLs
 * @param {string} url - The URL to process
 * @returns {string} - Clean domain name
 */
function extractDomainName(url) {
  try {
    const urlObj = new URL(url);
    // Get domain without subdomain like www
    let domain = urlObj.hostname.replace(/^www\./i, "");
    return domain;
  } catch (error) {
    return url; // Return original if parsing fails
  }
}

/**
 * Formats an array of article summaries into a single message
 * @param {Array<Object>} articles - Array of articles with summaries
 * @returns {string} - Formatted message
 */
function formatMessage(articles) {
  if (!articles || articles.length === 0) {
    return "No EdTech news found.";
  }

  // Get current date for the daily update
  const today = new Date();
  const dateFormatted = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Since all articles now have the same summary (we consolidated them),
  // we'll just use the first article's summary
  const summary = articles[0].summary;

  // Build the header and message
  let message = `📱 *EDTECH UPDATE* 📱\n*${dateFormatted}*\n\n`;
  message += summary + "\n";

  // No need to add the separate source list since sources are now included with each bullet point

  return message;
}

/**
 * Sends a WhatsApp message via Twilio
 * @param {string} message - The message to send
 * @returns {Promise<Object>} - Result of the sending operation
 */
async function sendWhatsAppMessage(message) {
  try {
    // Always output the formatted message to console for testing/backup
    console.log("\n========= FORMATTED MESSAGE =========");
    console.log(message);
    console.log("===================================\n");

    // Check if Twilio is configured
    if (
      !process.env.TWILIO_ACCOUNT_SID ||
      !process.env.TWILIO_AUTH_TOKEN ||
      !process.env.TWILIO_PHONE_NUMBER ||
      !process.env.RECIPIENT_PHONE_NUMBER
    ) {
      console.warn(
        "Twilio environment variables not fully configured. Message not sent."
      );
      return { status: "not_sent", reason: "configuration_missing" };
    }

    // Check if client was initialized
    if (!client) {
      console.warn("Twilio client not initialized. Message not sent.");
      return { status: "not_sent", reason: "client_not_initialized" };
    }

    // Ensure message is within WhatsApp's character limit
    const MAX_LENGTH = 1600;
    let messageToSend = message;

    if (message.length > MAX_LENGTH) {
      // Truncate if necessary rather than splitting
      messageToSend = message.substring(0, MAX_LENGTH - 3) + "...";
      console.warn(
        `Message too long (${message.length} chars), truncated to ${messageToSend.length} chars`
      );
    }

    try {
      const result = await client.messages.create({
        from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
        body: messageToSend,
        to: `whatsapp:${process.env.RECIPIENT_PHONE_NUMBER}`,
      });

      console.log(`Message sent with SID: ${result.sid}`);
      return result;
    } catch (twilioError) {
      console.error("Twilio API Error:", twilioError.message);

      // Check for network connectivity issues
      if (
        twilioError.message.includes("EAI_AGAIN") ||
        twilioError.message.includes("ENOTFOUND") ||
        twilioError.message.includes("ETIMEDOUT")
      ) {
        console.error(
          "Network connectivity issue detected. Please check your internet connection."
        );
      }

      throw twilioError;
    }
  } catch (error) {
    console.error("Error sending WhatsApp message:", error.message);
    throw new Error(`Failed to send WhatsApp message: ${error.message}`);
  }
}

/**
 * Process and send articles as WhatsApp message
 * @param {Array<Object>} articles - Array of articles with summaries
 * @returns {Promise<Object>} - Result of the sending operation
 */
async function sendArticleSummaries(articles) {
  try {
    const message = formatMessage(articles);

    try {
      const result = await sendWhatsAppMessage(message);
      console.log("Successfully sent EdTech trends summary via WhatsApp");
      return result;
    } catch (sendError) {
      console.error(
        "Failed to send via WhatsApp, but message was formatted successfully."
      );
      // We still return the formatted message even if sending failed
      return { status: "format_only", formattedMessage: message };
    }
  } catch (error) {
    console.error("Error in formatting article summaries:", error.message);
    throw error;
  }
}

module.exports = { formatMessage, sendWhatsAppMessage, sendArticleSummaries };
