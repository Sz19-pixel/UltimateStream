const express = require("express");
const app = express();
const cors = require("cors");
const ScraperManager = require("./src/scrapers/ScraperManager");
const { TorrentManager } = require("./src/torrents/TorrentManager");

// Enable CORS for all routes
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Initialize managers
const scraperManager = new ScraperManager();
const torrentManager = new TorrentManager();

// Basic health check route
app.get("/", (req, res) => {
    res.json({ status: "Server is running" });
});

// Stremio Addon Manifest Route
app.get("/manifest.json", (req, res) => {
    const manifest = {
        id: "com.ultimate-stream", // Unique ID for your addon
        version: "1.0.0",
        name: "Ultimate Stream Addon",
        description: "Stremio addon for Ultimate Stream content",
        resources: ["catalog", "meta", "stream"], // What your addon provides
        types: ["movie", "series"], // Types of content your addon supports
        catalogs: [
            {
                type: "movie",
                id: "ultimate-stream-movies",
                name: "Ultimate Stream Movies",
                extra: [{
                    name: "search",
                    isRequired: false
                }]
            },
            {
                type: "series",
                id: "ultimate-stream-series",
                name: "Ultimate Stream Series",
                extra: [{
                    name: "search",
                    isRequired: false
                }]
            }
        ],
        // You might need to adjust these if your API routes are different
        // For example, if your API is at /api/v1, change /catalog to /api/v1/catalog
        behaviorHints: {
            configurable: true, // Allows users to configure the addon
            // You can add a configuration page if needed, e.g., "configuration_url": "https://your-vercel-url.vercel.app/configure"
        }
    };
    res.json(manifest );
});

// API Routes
app.get("/api/scrapers", (req, res) => {
    const scrapers = scraperManager.getEnabledScrapers(); // Corrected method call
    res.json(scrapers);
});

app.get("/api/torrents", (req, res) => {
    const torrents = torrentManager.getSources();
    res.json(torrents);
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Something went wrong!" });
});

// For local development
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

// Export for Vercel
module.exports = app;
