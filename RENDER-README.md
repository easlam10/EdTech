# EdTech News Aggregator Deployment on Render

This guide provides step-by-step instructions for deploying the EdTech News Aggregator to Render with Puppeteer support.

## Files Added for Render Deployment

1. `.puppeteerrc.cjs` - Configuration for Puppeteer cache location
2. `render-build.sh` - Build script for Puppeteer on Render
3. `render.yaml` - Render service configuration

## Deployment Steps

### 1. Push Code to GitHub

Make sure all files are committed and pushed to your GitHub repository.

### 2. Create a New Web Service on Render

1. Sign in to your [Render dashboard](https://dashboard.render.com/)
2. Click "New" and select "Web Service"
3. Connect your GitHub repository
4. Configure the service with the following settings:
   - **Name**: EdTech News Aggregator (or your preferred name)
   - **Environment**: Node
   - **Build Command**: `./render-build.sh`
   - **Start Command**: `node src/index.js`

### 3. Configure Environment Variables

Add the following environment variables in your Render dashboard:

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/whatsapp
MONGODB_DB_NAME=whatsapp
GOOGLE_API_KEY=your_google_api_key
GOOGLE_CSE_ID=your_custom_search_engine_id
GEMINI_API_KEY=your_gemini_api_key
DEFAULT_RECIPIENT_NUMBER=923334567890
```

The following variables will be set automatically by the build script:

```
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/opt/render/.cache/puppeteer/chrome/linux-119.0.6045.105/chrome-linux64/chrome
```

### 4. Deploy Your Service

1. Click "Create Web Service" to deploy your application
2. Render will execute the build script and install all dependencies including Puppeteer

### 5. WhatsApp Authentication

The first time you run the application, you'll need to authenticate with WhatsApp:

1. Go to the "Logs" tab in your Render dashboard
2. Look for the QR code in the logs and scan it with your WhatsApp app
3. After scanning, the session will be saved in MongoDB for future use

### 6. Troubleshooting

If you encounter any issues:

1. **Build Failures**:

   - Check the logs for detailed error messages
   - Ensure your `render-build.sh` file is executable
   - Verify that the paths in the build script match Render's file system structure

2. **Puppeteer Issues**:

   - Check that the Chrome path is correct in both `render.yaml` and the `scraper.js` file
   - Ensure all required Puppeteer args are included

3. **WhatsApp Connection**:
   - If authentication fails, try redeploying the service
   - Make sure MongoDB is properly configured to store the session

### 7. Setting Up Scheduled Runs (Optional)

For automated runs, you can:

1. Create a Cron Job using Render's Cron service
2. Set up a schedule to hit your service's endpoint
3. Configure the job with your desired schedule (e.g., daily at 8 AM)
