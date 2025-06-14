const express = require('express');
const app = express();
const cors = require('cors');
const { ScraperManager } = require('./src/scrapers/ScraperManager');
const { TorrentManager } = require('./src/torrents/TorrentManager');

// Enable CORS for all routes
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Initialize managers
const scraperManager = new ScraperManager();
const torrentManager = new TorrentManager();

// Basic health check route
app.get('/', (req, res) => {
    res.json({ status: 'Server is running' });
});

// API Routes
app.get('/api/scrapers', (req, res) => {
    const scrapers = scraperManager.getScrapers();
    res.json(scrapers);
});

app.get('/api/torrents', (req, res) => {
    const torrents = torrentManager.getSources();
    res.json(torrents);
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
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
