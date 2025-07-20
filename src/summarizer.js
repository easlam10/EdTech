import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

// Initialize the Google Generative AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// Using a valid model name
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

/**
 * Summarizes all content in a single request
 * @param {Array<Object>} articles - Array of objects with content
 * @returns {Promise<Array<Object>>} - Array of objects with summaries
 */
async function summarizeAllContent(articles) {
  try {
    if (!articles || articles.length === 0) {
      console.warn("No content to summarize");
      return [];
    }

    // Prepare the combined content, separating each URL's content
    let combinedContent = "";
    const sourceUrls = [];
    const urlToTitleMap = {}; // Map to keep track of URL to title

    for (const article of articles) {
      // Skip if no content
      if (!article.content) {
        continue;
      }

      // Store the source URL
      sourceUrls.push(article.url);

      // Store the title for this URL
      urlToTitleMap[article.url] = article.title;

      // Truncate content if it's too long
      const truncatedContent =
        article.content.length > 4000
          ? article.content.substring(0, 4000) + "..."
          : article.content;

      // Add clear separation between URL contents for the AI to distinguish them
      combinedContent += `\n\n### SOURCE: ${article.url}\n### TITLE: ${article.title}\n### CONTENT:\n${truncatedContent}\n\n--------------------\n`;
    }

    if (combinedContent.length === 0) {
      console.warn("No valid content to summarize");
      return [];
    }

    // Truncate overall content if it's too long (Gemini has token limits)
    const finalContent =
      combinedContent.length > 50000
        ? combinedContent.substring(0, 50000) + "..."
        : combinedContent;

    // Create the prompt for summarization with specific EdTech focus but simple language
    const prompt = `
You are an EdTech newsletter writer for people who speak English as a second language. Your goal is to create a meaningful summary of important EdTech news, trends, and insights that is easy to understand.

Analyze the provided content and create a summary focused on the BROADER EDUCATIONAL ECOSYSTEM:
1. Specific innovative tools and platforms changing education (in AND outside traditional classrooms)
2. Real examples of technology enabling new learning approaches and methods 
3. Practical applications of AI, VR, and other technologies showing positive results in any educational context
4. How specific EdTech tools are solving educational challenges for different stakeholders (students, teachers, parents, institutions)
5. New learning paradigms enabled by technology that go beyond traditional teaching methods
6. Practical examples of technology breaking barriers in education accessibility and reach
7. Self-learning platforms and tools empowering independent learners
8. Industry-education partnerships creating new educational pathways

USE THIS CHAIN-OF-THOUGHT REASONING PROCESS FOR EACH POINT:
Step 1: Identify a specific EdTech application, tool, method or development from the source content
Step 2: Ask yourself: "Is this common knowledge or a generic statement?" If yes, reject it and find something more specific
Step 3: Ask yourself: "Does this mention specific details like product names, organizations, techniques, or measurable outcomes?" If no, reject it
Step 4: Ask yourself: "Would this information be new and valuable to someone in education?" If no, reject it
Step 5: Ask yourself: "Does this represent diverse aspects of education beyond just classroom teaching?" If no, find additional diverse examples
Step 6: Only after passing all checks, format it as a bullet point with simple language

EXTREMELY IMPORTANT REQUIREMENTS:
- Create 8 bullet points total
- ENSURE DIVERSITY: Do not focus only on teachers and classrooms - include diverse aspects of educational technology
- AVOID starting multiple points with "Teachers use..." - vary your starting phrases
- Each bullet point MUST focus on PRACTICAL APPLICATIONS and METHODS, not institutional statistics
- Focus on HOW technology is being used, not just that it exists
- AVOID generic institutional announcements, statistics, or program listings
- AVOID bullet points about schools/universities simply having EdTech programs
- Each bullet point MUST include SPECIFIC techniques, methods, or applications
- Use SIMPLE English (5th grade level)
- Each bullet point should be detailed but under 40 words max
- Use short, simple sentences
- Start each bullet point with * followed by a space
- Add a blank line between each bullet point for better readability
- INCLUDE THE SOURCE URL directly after each bullet point on a new line, indented with two spaces like this:
  Source: [exact URL where this specific information was found]
- DO NOT include any introductory text or headings before the bullet points

Examples of GOOD bullet points with diverse starting phrases:
* Khan Academy's AI tutor helps students learn math at their own pace, providing immediate feedback on complex problems and adjusting difficulty based on performance.
  Source: https://example.com/specific-article-url

* Virtual reality platform ClassVR lets students explore ancient Rome and Egyptian pyramids, increasing history test scores by 27% in pilot schools across California.
  Source: https://example.com/specific-article-url

* Remote learning platform Outschool connects 140,000 students with specialist teachers for courses in coding, robotics, and creative writing that aren't available in their local schools.
  Source: https://example.com/specific-article-url

Examples of BAD bullet points (avoid these):
* Teachers are using technology in the classroom.
* A university has an online learning program.
* Students learn better with computers.
* Technology is changing education.

Content to analyze:
${finalContent}
`;

    // Generate content using Gemini
    const result = await model.generateContent(prompt);
    const bulletPoints = result.response.text().trim();

    console.log("Successfully summarized all content");

    // Create a single processed article with the consolidated summary
    const processedArticle = {
      title: "EdTech Summary with Sources",
      url: null, // No single URL
      summary: bulletPoints, // The complete summary with embedded source URLs
    };

    return [processedArticle]; // Return as an array with a single item for compatibility
  } catch (error) {
    console.error("Error summarizing content:", error.message);
    return [];
  }
}

/**
 * Process and filter content before summarization
 * @param {Array<Object>} articles - Array of objects with content
 * @returns {Promise<Array<Object>>} - Array of objects with summaries
 */
async function processArticles(articles) {
  try {
    if (!articles || articles.length === 0) {
      console.warn("No content to process");
      return [];
    }

    // Only filter out completely empty content
    const validContent = articles.filter(
      (article) => article.content && article.content.trim() !== ""
    );

    if (validContent.length === 0) {
      console.warn("No content to summarize");
      return [];
    }

    console.log(`Processing ${validContent.length} items for summarization`);

    // Get a single summary for all content
    const processedContent = await summarizeAllContent(validContent);
    return processedContent;
  } catch (error) {
    console.error("Error processing content:", error.message);
    return [];
  }
}

export { summarizeAllContent, processArticles };
