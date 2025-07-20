import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

/**
 * Extracts bullet points and their sources from the summary
 * @param {string} summary - The summary text with bullet points and sources
 * @returns {Object} - Object containing date and extracted points with links
 */
function extractPointsAndSources(summary) {
  if (!summary) {
    return null;
  }

  const today = new Date();
  const date = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Split by bullet points (lines starting with *)
  const lines = summary.split("\n");
  const points = [];
  const links = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // If this is a bullet point
    if (line.startsWith("*")) {
      points.push(line.substring(2).trim()); // Remove the "* " prefix

      // Look for the source in the next line or two
      let foundSource = false;

      // Check next two lines for source
      for (let j = 1; j <= 2; j++) {
        if (i + j < lines.length) {
          const nextLine = lines[i + j].trim();
          if (nextLine.startsWith("Source:")) {
            // Extract URL from the source line
            const sourceMatch = nextLine.match(
              /Source:\s+\[?(https?:\/\/[^\s\]]+)/
            );
            if (sourceMatch && sourceMatch[1]) {
              links.push(sourceMatch[1]);
              foundSource = true;
              break;
            }
          }
        }
      }

      if (!foundSource) {
        links.push("");
      }
    }
  }

  // Ensure we have exactly 8 points and links (pad with non-empty strings if needed)
  while (points.length < 8)
    points.push("No additional EdTech updates available");
  while (links.length < 8) links.push("No source available");

  // Truncate if more than 8
  const result = {
    date,
    first_point: points[0].substring(0, 1000),
    first_link: links[0],
    second_point: points[1].substring(0, 1000),
    second_link: links[1],
    third_point: points[2].substring(0, 1000),
    third_link: links[2],
    fourth_point: points[3].substring(0, 1000),
    fourth_link: links[3],
    fifth_point: points[4].substring(0, 1000),
    fifth_link: links[4],
    sixth_point: points[5].substring(0, 1000),
    sixth_link: links[5],
    seventh_point: points[6].substring(0, 1000),
    seventh_link: links[6],
    eigth_point: points[7].substring(0, 1000),
    eigth_link: links[7],
  };

  return result;
}

/**
 * Sends a WhatsApp message via Meta Cloud API
 * @param {Object} templateData - The data to populate the template
 * @returns {Promise<Object>} - Result of the sending operation
 */
async function sendWhatsAppMessage(templateData) {
  try {
    // Always output the formatted message to console for testing/backup
    console.log("\n========= TEMPLATE DATA =========");
    console.log(JSON.stringify(templateData, null, 2));
    console.log("===================================\n");

    // Check if Meta Cloud API is configured
    if (
      !process.env.WHATSAPP_TOKEN ||
      !process.env.WHATSAPP_PHONE_NUMBER_ID ||
      !process.env.WHATSAPP_RECIPIENT_NUMBER
    ) {
      console.warn(
        "Meta Cloud API environment variables not fully configured. Message not sent."
      );
      return { status: "not_sent", reason: "configuration_missing" };
    }

    const url = `https://graph.facebook.com/v23.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

    // Parameters must be in the exact order they appear in the template
    // Without the name property - just using type and text as per API requirements
    const parameters = [
      { type: "text", text: templateData.date },
      { type: "text", text: templateData.first_point },
      { type: "text", text: templateData.first_link },
      { type: "text", text: templateData.second_point },
      { type: "text", text: templateData.second_link },
      { type: "text", text: templateData.third_point },
      { type: "text", text: templateData.third_link },
      { type: "text", text: templateData.fourth_point },
      { type: "text", text: templateData.fourth_link },
      { type: "text", text: templateData.fifth_point },
      { type: "text", text: templateData.fifth_link },
      { type: "text", text: templateData.sixth_point },
      { type: "text", text: templateData.sixth_link },
      { type: "text", text: templateData.seventh_point },
      { type: "text", text: templateData.seventh_link },
      { type: "text", text: templateData.eigth_point },
      { type: "text", text: templateData.eigth_link },
    ];

    const payload = {
      messaging_product: "whatsapp",
      to: process.env.WHATSAPP_RECIPIENT_NUMBER,
      type: "template",
      template: {
        name: "edtech_alerts",
        language: { code: "en_US" },
        components: [
          {
            type: "body",
            parameters: parameters,
          },
        ],
      },
    };

    try {
      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      });
      console.log("✅ WhatsApp message sent successfully");
      return response.data;
    } catch (apiError) {
      console.error(
        "❌ WhatsApp API error:",
        apiError.response?.data || apiError.message
      );
      throw apiError;
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
    if (!articles || articles.length === 0) {
      console.warn("No articles to send");
      return { status: "not_sent", reason: "no_articles" };
    }

    // Extract bullet points and links from the summary
    const templateData = extractPointsAndSources(articles[0].summary);

    if (!templateData) {
      console.error("Failed to extract points and sources from summary");
      return { status: "not_sent", reason: "extraction_failed" };
    }

    try {
      const result = await sendWhatsAppMessage(templateData);
      console.log("Successfully sent EdTech trends summary via WhatsApp");
      return result;
    } catch (sendError) {
      console.error("Failed to send via WhatsApp API:", sendError.message);
      return { status: "failed", error: sendError.message };
    }
  } catch (error) {
    console.error("Error processing article summaries:", error.message);
    throw error;
  }
}

export { extractPointsAndSources, sendWhatsAppMessage, sendArticleSummaries };
