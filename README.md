⚠️ This project is under development. Please do not fork or reuse any part of this code without permission.

All rights reserved. This code is not to be copied, redistributed, or forked without explicit permission from the author 

# Stremio Multi-Source Scraper Addon

A comprehensive Stremio addon that scrapes direct HTTP streaming links from multiple websites with torrent fallback support. Built using Node.js with full Stremio SDK compatibility

## Features

- **Multi-Source Scraping**: Supports scraping from multiple streaming websites
- **Torrent Fallback**: Automatic fallback to torrent sources when direct streams are unavailable
- **Modular Architecture**: Easy to add new scrapers and extend functionality
- **Caching System**: Built-in caching for improved performance
- **Error Handling**: Comprehensive error handling and logging
- **Puppeteer Support**: JavaScript-heavy sites support with headless browser automation
- **Rate Limiting**: Built-in rate limiting to prevent abuse
- **Configuration Management**: Flexible configuration system

## Supported Sources

### Direct Streaming Sites
- **Pstream.org** (Fully implemented example)
- **Wecima.video** (Template provided)
- **Hexa.watch** (Template with API support)
- **CinemaOS.live** (Template ready)
- **Vidora.su** (Template ready)
- **Nunflix.org** (Template ready)
- **Uira.live** (Template ready)
- **Bingeflix.tv** (Template ready)
- **Pahe.ink** (Template ready)

### Torrent Sources (Fallback)
- **EZTV** (eztvx.to)
- **ExtraTorrent** (ext.to)
- **WatchSoMuch** (watchsomuch.to)

## Installation

### Prerequisites
- Node.js 14.0.0 or higher
- npm or yarn package manager

### Quick Start

1. **Clone or download the addon**:
   ```bash
   git clone <repository-url>
   cd stremio-scraper-addon
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the addon**:
   ```bash
   npm start
   ```

4. **Install in Stremio**:
   - Open Stremio
   - Go to Addons
   - Click "Add Addon"
   - Enter: `http://localhost:3000/manifest.json`
   - Click "Install"

## Configuration

The addon can be configured using environment variables or by modifying the `src/utils/Config.js` file.

### Environment Variables

```bash
# Server settings
PORT=3000
TIMEOUT=30000
MAX_CONCURRENT=5

# Cache settings
CACHE_ENABLED=true
CACHE_CATALOG_TTL=3600
CACHE_META_TTL=86400
CACHE_STREAMS_TTL=1800

# Scraper settings
SCRAPERS_ENABLED=pstream,wecima,hexa
USER_AGENT="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
RETRY_ATTEMPTS=3
RETRY_DELAY=1000
PUPPETEER_ENABLED=true

# Torrent settings
TORRENTS_ENABLED=true
TORRENT_SOURCES=eztv,ext,watchsomuch
TORRENT_MAX_RESULTS=10
TORRENT_MIN_SEEDERS=1

# Logging settings
LOG_LEVEL=info
LOG_CONSOLE=true
LOG_FILE=false
LOG_FILE_PATH=./logs/addon.log

# Rate limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
```

## Project Structure

```
stremio-scraper-addon/
├── index.js                 # Main addon entry point
├── package.json             # Dependencies and scripts
├── README.md               # This file
├── src/
│   ├── scrapers/           # Website scrapers
│   │   ├── BaseScraper.js  # Base scraper class
│   │   ├── ScraperManager.js # Scraper coordinator
│   │   ├── PstreamScraper.js # Pstream implementation
│   │   ├── WecinaScraper.js  # Wecima template
│   │   └── HexaWatchScraper.js # HexaWatch template
│   ├── torrents/           # Torrent sources
│   │   └── TorrentManager.js # Torrent coordinator
│   └── utils/              # Utilities
│       ├── CacheManager.js # Caching system
│       ├── Config.js       # Configuration management
│       └── ErrorHandler.js # Error handling and logging
└── logs/                   # Log files (if enabled)
```

## Adding New Scrapers

To add support for a new streaming website, follow these steps:

### 1. Create a New Scraper Class

Create a new file in `src/scrapers/` (e.g., `NewSiteScraper.js`):

```javascript
const BaseScraper = require('./BaseScraper');
const cheerio = require('cheerio');

class NewSiteScraper extends BaseScraper {
    constructor() {
        super('NewSite', 'https://newsite.com');
        this.searchUrl = 'https://newsite.com/search';
    }
    
    async search(query, type) {
        // Implement search functionality
        // Return array of meta objects
    }
    
    async getPopular(type, genre = null) {
        // Implement popular content retrieval
        // Return array of meta objects
    }
    
    async getMeta(id, type) {
        // Implement detailed metadata retrieval
        // Return meta object
    }
    
    async getStreams(id, type) {
        // Implement stream extraction
        // Return array of stream objects
    }
}

module.exports = NewSiteScraper;
```

### 2. Register the Scraper

Add your scraper to `src/scrapers/ScraperManager.js`:

```javascript
const NewSiteScraper = require('./NewSiteScraper');

// In the initializeScrapers method:
this.scrapers.push(new NewSiteScraper());
```

### 3. Key Methods to Implement

#### search(query, type)
- **Purpose**: Search for content on the site
- **Parameters**: 
  - `query`: Search term
  - `type`: 'movie' or 'series'
- **Returns**: Array of meta objects

#### getPopular(type, genre)
- **Purpose**: Get popular/trending content
- **Parameters**:
  - `type`: 'movie' or 'series'
  - `genre`: Optional genre filter
- **Returns**: Array of meta objects

#### getMeta(id, type)
- **Purpose**: Get detailed metadata for specific content
- **Parameters**:
  - `id`: Content ID
  - `type`: 'movie' or 'series'
- **Returns**: Meta object with detailed information

#### getStreams(id, type)
- **Purpose**: Extract streaming links
- **Parameters**:
  - `id`: Content ID
  - `type`: 'movie' or 'series'
- **Returns**: Array of stream objects

### 4. Utility Methods Available

The `BaseScraper` class provides several utility methods:

- `makeRequest(url, options)`: HTTP requests with proper headers
- `extractVideoUrls(html)`: Extract video URLs from HTML
- `cleanUrl(url, baseUrl)`: Clean and validate URLs
- `extractQuality(text)`: Extract quality information
- `createMeta(data)`: Create standardized meta objects
- `createStream(data)`: Create standardized stream objects

## Stream Extraction Techniques

### 1. Direct Video URLs
Look for direct links to video files:
```javascript
const videoUrls = this.extractVideoUrls(html);
```

### 2. Embed URL Resolution
Extract and resolve embed URLs:
```javascript
const embedUrls = this.extractEmbedUrls(html);
for (const embedUrl of embedUrls) {
    const streams = await this.resolveEmbedUrl(embedUrl);
}
```

### 3. JavaScript-Heavy Sites
Use Puppeteer for sites requiring JavaScript:
```javascript
if (this.requiresJavaScript(html)) {
    const streams = await this.getStreamsWithPuppeteer(url);
}
```

### 4. API Endpoints
If the site provides APIs:
```javascript
const response = await this.makeRequest(apiUrl, {
    headers: { 'Accept': 'application/json' }
});
const data = await response.json();
```

## Common Selectors and Patterns

### Search Results
```javascript
$('.search-result, .movie-item, .content-item').each((i, element) => {
    const $el = $(element);
    const title = $el.find('.title, h3, .movie-title').text().trim();
    const link = $el.find('a').attr('href');
    const poster = $el.find('img').attr('src');
});
```

### Video Players
```javascript
// Look for common video player patterns
$('video, iframe[src*="player"], .video-player').each((i, element) => {
    // Extract video source
});
```

### Metadata Extraction
```javascript
const title = $('.movie-title, h1').text().trim();
const year = this.extractYear($('.year, .release-date').text());
const rating = this.extractRating($('.rating, .imdb').text());
const description = $('.description, .plot, .overview').text().trim();
```

## Debugging and Testing

### Enable Debug Logging
Set the log level to debug:
```bash
LOG_LEVEL=debug npm start
```

### Test Individual Scrapers
You can test scrapers individually:
```javascript
const PstreamScraper = require('./src/scrapers/PstreamScraper');
const scraper = new PstreamScraper();

// Test search
scraper.search('avengers', 'movie').then(results => {
    console.log('Search results:', results);
});

// Test streams
scraper.getStreams('some-id', 'movie').then(streams => {
    console.log('Streams:', streams);
});
```

### Common Issues and Solutions

1. **CORS Errors**: Add proper headers to requests
2. **Rate Limiting**: Implement delays between requests
3. **Cloudflare Protection**: Use Puppeteer with proper user agents
4. **Dynamic Content**: Use Puppeteer for JavaScript-rendered content
5. **Captchas**: Implement captcha solving or use different endpoints

## Deployment

### Local Development
```bash
npm run dev  # Uses nodemon for auto-restart
```

### Production Deployment
```bash
npm start
```

### Docker Deployment
```bash
# Build image
npm run docker:build

# Run container
npm run docker:run
```

### Environment-Specific Configuration
Create different configuration files for different environments:
- `config/development.js`
- `config/production.js`
- `config/testing.js`

## Security Considerations

1. **Rate Limiting**: Implement proper rate limiting to prevent abuse
2. **Input Validation**: Validate all user inputs and search queries
3. **Error Handling**: Don't expose internal errors to users
4. **HTTPS**: Use HTTPS in production
5. **Content Filtering**: Implement content filtering if required
6. **Legal Compliance**: Ensure compliance with local laws and regulations

## Performance Optimization

1. **Caching**: Use the built-in caching system effectively
2. **Concurrent Requests**: Limit concurrent requests to prevent overload
3. **Request Timeouts**: Set appropriate timeouts for requests
4. **Memory Management**: Monitor memory usage, especially with Puppeteer
5. **Database**: Consider using a database for persistent caching

## Troubleshooting

### Common Error Messages

1. **"No streams found"**: Check if the scraper selectors are correct
2. **"Request timeout"**: Increase timeout values or check network connectivity
3. **"Puppeteer launch failed"**: Ensure Puppeteer dependencies are installed
4. **"Invalid magnet link"**: Check torrent source parsing logic

### Debug Steps

1. Check addon logs for error messages
2. Test individual scraper methods
3. Verify website structure hasn't changed
4. Check network connectivity and firewall settings
5. Validate configuration settings

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests if applicable
5. Update documentation
6. Submit a pull request

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Disclaimer

This addon is for educational purposes only. Users are responsible for ensuring compliance with local laws and regulations regarding content streaming and copyright. The developers are not responsible for any misuse of this software.

## Support

For support and questions:
1. Check the troubleshooting section
2. Review the logs for error messages
3. Create an issue on the repository
4. Provide detailed information about the problem

---

**Note**: This addon provides a framework for scraping streaming websites. The actual implementation of scrapers depends on the specific structure and requirements of each website. Always respect robots.txt files and terms of service of the websites you're scraping.

