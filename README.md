# EdTech News Aggregator

An automated tool that fetches, scrapes, summarizes, and sends educational technology news updates via WhatsApp.

## Features

- Searches for the latest news articles about educational technology
- Scrapes article content from web pages
- Uses Google's Gemini API to generate concise summaries focused on EdTech trends
- Sends formatted summaries via WhatsApp messaging

## Prerequisites

- Node.js (v14 or higher)
- Google Custom Search API key and Search Engine ID
- Google Gemini API key
- Twilio account with WhatsApp capability

## Setup

1. Clone this repository:

   ```bash
   git clone <repository-url>
   cd edtech-news-aggregator
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following contents:

   ```
   # Google Custom Search API
   GOOGLE_API_KEY=your_google_api_key
   GOOGLE_CSE_ID=your_custom_search_engine_id

   # Google Gemini API
   GEMINI_API_KEY=your_gemini_api_key

   # Twilio API
   TWILIO_ACCOUNT_SID=your_twilio_account_sid
   TWILIO_AUTH_TOKEN=your_twilio_auth_token
   TWILIO_PHONE_NUMBER=your_twilio_whatsapp_number
   RECIPIENT_PHONE_NUMBER=recipient_whatsapp_number
   ```

4. Replace the placeholders in the `.env` file with your actual API keys and credentials.

## Usage

Run the application with default parameters (searches for "IT news in education sector"):

```bash
node src/index.js
```

You can also specify a custom search query and number of results:

```bash
node src/index.js "AI in higher education" 5
```

## How It Works

1. **Search**: The application uses Google Custom Search API to find relevant articles.
2. **Scrape**: Puppeteer and Cheerio are used to extract the main content from each article.
3. **Summarize**: Google's Gemini API processes the content to create focused summaries.
4. **Deliver**: Summaries are formatted and sent via Twilio's WhatsApp API.

## Project Structure

- `src/index.js` - Main application file
- `src/search.js` - Google Custom Search module
- `src/scraper.js` - Web scraping module
- `src/summarizer.js` - Gemini-based summarization module
- `src/messenger.js` - Twilio WhatsApp messaging module

## Error Handling

The application includes comprehensive error handling at each stage:

- Search API failures
- Web scraping challenges (timeouts, 404s)
- Summarization errors
- WhatsApp message delivery issues

## License

MIT
