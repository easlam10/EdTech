const express = require("express");
const { fetchPageContent } = require("./fetchPageContent");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Puppeteer Scraper is running!");
});

// Example endpoint: /scrape?url=https://example.com
app.get("/scrape", async (req, res) => {
  const url = req.query.url;
  if (!url) {
    return res.status(400).json({ error: "Missing url query parameter" });
  }
  try {
    const html = await fetchPageContent(url);
    res.status(200).send(html);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
