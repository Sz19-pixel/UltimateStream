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
// غير كود الـ Manifest إلى هذا
app.get("/manifest.json", (req, res) => {
    const manifest = {
        id: "com.ultimate-stream",
        version: "1.0.0",
        name: "Ultimate Stream Addon",
        description: "Stremio addon for Ultimate Stream content",
        resources: ["stream"],
        types: ["movie", "series"],
        idPrefixes: ["tt"] // أضف هذا الحقل
    };
    res.json(manifest); // احذف الـ headers المنفردة
});

// إضافة هذا الجزء الجديد - Stremio Stream Route
app.get('/stream/:type/:id.json', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    
    try {
        const { type, id } = req.params;
        let streams = [];

        // Get streams from scrapers
        const scrapedStreams = await scraperManager.getStreams(id);
        if (scrapedStreams && scrapedStreams.length > 0) {
            streams = streams.concat(scrapedStreams);
        }

        // Get streams from torrents
        const torrentStreams = await torrentManager.getStreams(id);
        if (torrentStreams && torrentStreams.length > 0) {
            streams = streams.concat(torrentStreams);
        }

        res.json({ streams: streams });
    } catch (error) {
        console.error('Error:', error);
        res.json({ streams: [] });
    }
});

// API Routes
app.get("/api/scrapers", (req, res) => {
    const scrapers = scraperManager.getEnabledScrapers();
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
