# Railway Deployment Guide for EdTech News Aggregator

This guide provides step-by-step instructions for deploying the EdTech News Aggregator to Railway.

## Prerequisites

1. A Railway account (https://railway.app)
2. MongoDB Atlas database (or any MongoDB database)
3. Google Custom Search API key
4. Google Gemini API key
5. A WhatsApp account for sending messages

## Deployment Steps

### 1. Create a New Project in Railway

1. Log in to your Railway account
2. Click "New Project" > "Deploy from GitHub repo"
3. Select your GitHub repository
4. Allow Railway to connect to your GitHub account if prompted

### 2. Configure Environment Variables

Add the following environment variables in Railway's dashboard under the "Variables" tab:

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/whatsapp
MONGODB_DB_NAME=whatsapp
GOOGLE_API_KEY=your_google_api_key
GOOGLE_CSE_ID=your_custom_search_engine_id
GEMINI_API_KEY=your_gemini_api_key
DEFAULT_RECIPIENT_NUMBER=923334567890
```

### 3. Initial Deployment

1. Railway will automatically detect the Nixpacks configuration from the `nixpacks.toml` file
2. The first deployment will build and launch your application
3. You'll need to scan the QR code for WhatsApp Web authentication - check the logs for the QR code

### 4. WhatsApp Authentication

The first time you run the application, you'll need to authenticate with WhatsApp:

1. Go to the "Deployments" tab in Railway
2. Click on the latest deployment
3. View the logs
4. Look for the QR code in the logs and scan it with your WhatsApp app
5. After scanning, the session will be saved in MongoDB for future use

### 5. Set up Scheduled Runs (Optional)

For automated runs, you can use Railway's Cron service:

1. Go to "New Service" > "Cron Job"
2. Configure it to hit your service's endpoint
3. Set your desired schedule (e.g., `0 8 * * *` for daily at 8 AM)

## Troubleshooting

- **Puppeteer Issues**: Make sure the nixpacks.toml file is in the root directory of your project.
- **MongoDB Connection**: Check that your MongoDB URI is correct and the IP address is whitelisted.
- **WhatsApp Authentication**: If the QR code doesn't appear in logs, try restarting the deployment.
- **Deployment Size**: Railway has a maximum deployment size limit. If you exceed it, consider removing unnecessary files or using .railwayignore.

## Additional Resources

- Railway Documentation: https://docs.railway.app
- Puppeteer Nixpacks Documentation: https://github.com/Railway/nixpacks/tree/main/docs/providers/puppeteer
