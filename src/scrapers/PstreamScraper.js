const BaseScraper = require('./BaseScraper');
const cheerio = require('cheerio');
const { JSDOM } = require('jsdom');

/**
 * Pstream.org scraper implementation
 * This serves as a detailed example for implementing other scrapers
 */
class PstreamScraper extends BaseScraper {
    constructor() {
        super('Pstream', 'https://pstream.org');
        this.searchUrl = 'https://pstream.org/search';
        this.movieUrl = 'https://pstream.org/movies';
        this.seriesUrl = 'https://pstream.org/series';
    }
    
    /**
     * Search for content on Pstream
     * @param {string} query - Search query
     * @param {string} type - Content type (movie/series)
     * @returns {Array} Array of meta objects
     */
    async search(query, type) {
        try {
            console.log(`[${this.name}] Searching for: ${query} (${type})`);
            
            // Construct search URL
            const searchUrl = `${this.searchUrl}?q=${encodeURIComponent(query)}`;
            
            const response = await this.makeRequest(searchUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const html = await response.text();
            const $ = cheerio.load(html);
            const results = [];
            
            // Parse search results
            // Note: These selectors are examples and need to be adjusted based on actual site structure
            $('.search-result, .movie-item, .series-item').each((i, element) => {
                try {
                    const $el = $(element);
                    
                    const title = $el.find('.title, h3, h4, .movie-title').first().text().trim();
                    const year = this.extractYear($el.find('.year, .release-date').text());
                    const poster = this.cleanUrl($el.find('img').attr('src') || $el.find('img').attr('data-src'));
                    const link = this.cleanUrl($el.find('a').attr('href'));
                    const rating = this.extractRating($el.find('.rating, .imdb-rating').text());
                    const description = $el.find('.description, .plot').text().trim();
                    
                    // Determine content type from URL or class
                    let contentType = type;
                    if (link && (link.includes('/series/') || link.includes('/tv/'))) {
                        contentType = 'series';
                    } else if (link && (link.includes('/movie/') || link.includes('/film/'))) {
                        contentType = 'movie';
                    }
                    
                    if (title && link) {
                        const meta = this.createMeta({
                            id: this.generateId(link),
                            type: contentType,
                            title,
                            year,
                            poster,
                            rating,
                            description,
                            sourceUrl: link
                        });
                        
                        results.push(meta);
                    }
                } catch (error) {
                    console.error(`[${this.name}] Error parsing search result:`, error);
                }
            });
            
            console.log(`[${this.name}] Found ${results.length} search results`);
            return results;
            
        } catch (error) {
            console.error(`[${this.name}] Search error:`, error);
            return [];
        }
    }
    
    /**
     * Get popular content from Pstream
     * @param {string} type - Content type (movie/series)
     * @param {string} genre - Optional genre filter
     * @returns {Array} Array of meta objects
     */
    async getPopular(type, genre = null) {
        try {
            console.log(`[${this.name}] Getting popular ${type} content`);
            
            let url = type === 'series' ? this.seriesUrl : this.movieUrl;
            if (genre) {
                url += `?genre=${encodeURIComponent(genre)}`;
            }
            
            const response = await this.makeRequest(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const html = await response.text();
            const $ = cheerio.load(html);
            const results = [];
            
            // Parse popular content
            $('.movie-item, .series-item, .content-item').each((i, element) => {
                try {
                    const $el = $(element);
                    
                    const title = $el.find('.title, h3, h4, .movie-title').first().text().trim();
                    const year = this.extractYear($el.find('.year, .release-date').text());
                    const poster = this.cleanUrl($el.find('img').attr('src') || $el.find('img').attr('data-src'));
                    const link = this.cleanUrl($el.find('a').attr('href'));
                    const rating = this.extractRating($el.find('.rating, .imdb-rating').text());
                    
                    if (title && link) {
                        const meta = this.createMeta({
                            id: this.generateId(link),
                            type,
                            title,
                            year,
                            poster,
                            rating,
                            sourceUrl: link
                        });
                        
                        results.push(meta);
                    }
                } catch (error) {
                    console.error(`[${this.name}] Error parsing popular content:`, error);
                }
            });
            
            console.log(`[${this.name}] Found ${results.length} popular items`);
            return results;
            
        } catch (error) {
            console.error(`[${this.name}] getPopular error:`, error);
            return [];
        }
    }
    
    /**
     * Get detailed metadata for specific content
     * @param {string} id - Content ID
     * @param {string} type - Content type
     * @returns {Object} Meta object with detailed info
     */
    async getMeta(id, type) {
        try {
            const url = this.getUrlFromId(id);
            if (!url) {
                console.error(`[${this.name}] Could not extract URL from ID: ${id}`);
                return null;
            }
            
            console.log(`[${this.name}] Getting metadata for: ${url}`);
            
            const response = await this.makeRequest(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const html = await response.text();
            const $ = cheerio.load(html);
            
            // Extract detailed metadata
            const title = $('.movie-title, .series-title, h1').first().text().trim();
            const year = this.extractYear($('.year, .release-date').text());
            const poster = this.cleanUrl($('.poster img, .movie-poster img').attr('src'));
            const background = this.cleanUrl($('.backdrop, .background-image').attr('src')) || poster;
            const rating = this.extractRating($('.rating, .imdb-rating').text());
            const description = $('.description, .plot, .overview').text().trim();
            const runtime = this.extractRuntime($('.runtime, .duration').text());
            const genres = this.extractGenres($('.genres, .genre').text());
            const cast = this.extractCast($('.cast, .actors').text());
            const director = this.extractDirector($('.director').text());
            
            // For series, extract episodes
            let episodes = [];
            if (type === 'series') {
                episodes = this.extractEpisodes($, url);
            }
            
            const meta = this.createMeta({
                id,
                type,
                title,
                year,
                poster,
                background,
                rating,
                description,
                runtime,
                genres,
                cast,
                director,
                episodes,
                sourceUrl: url
            });
            
            console.log(`[${this.name}] Retrieved metadata for: ${title}`);
            return meta;
            
        } catch (error) {
            console.error(`[${this.name}] getMeta error:`, error);
            return null;
        }
    }
    
    /**
     * Get streaming links for content
     * @param {string} id - Content ID
     * @param {string} type - Content type
     * @returns {Array} Array of stream objects
     */
    async getStreams(id, type) {
        try {
            const url = this.getUrlFromId(id);
            if (!url) {
                console.error(`[${this.name}] Could not extract URL from ID: ${id}`);
                return [];
            }
            
            console.log(`[${this.name}] Getting streams for: ${url}`);
            
            const response = await this.makeRequest(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const html = await response.text();
            const streams = [];
            
            // Method 1: Extract direct video URLs from HTML
            const directUrls = this.extractVideoUrls(html);
            for (const videoUrl of directUrls) {
                streams.push(this.createStream({
                    url: videoUrl,
                    quality: this.extractQuality(videoUrl),
                    server: 'Direct',
                    title: `${this.name} - Direct Stream`
                }));
            }
            
            // Method 2: Extract embed URLs and resolve them
            const embedUrls = this.extractEmbedUrls(html);
            for (const embedUrl of embedUrls) {
                try {
                    const resolvedStreams = await this.resolveEmbedUrl(embedUrl);
                    streams.push(...resolvedStreams);
                } catch (error) {
                    console.error(`[${this.name}] Error resolving embed:`, error);
                }
            }
            
            // Method 3: Use Puppeteer for JavaScript-heavy sites (if needed)
            if (streams.length === 0) {
                console.log(`[${this.name}] No streams found with basic scraping, trying Puppeteer...`);
                const puppeteerStreams = await this.getStreamsWithPuppeteer(url);
                streams.push(...puppeteerStreams);
            }
            
            console.log(`[${this.name}] Found ${streams.length} streams`);
            return streams;
            
        } catch (error) {
            console.error(`[${this.name}] getStreams error:`, error);
            return [];
        }
    }
    
    /**
     * Extract embed URLs from HTML
     * @param {string} html - HTML content
     * @returns {Array} Array of embed URLs
     */
    extractEmbedUrls(html) {
        const $ = cheerio.load(html);
        const embedUrls = [];
        
        // Common embed selectors
        $('iframe, embed, object').each((i, element) => {
            const src = $(element).attr('src') || $(element).attr('data-src');
            if (src) {
                embedUrls.push(this.cleanUrl(src));
            }
        });
        
        // Extract from JavaScript variables
        const scriptMatches = html.match(/(?:src|url|link)["']?\s*[:=]\s*["']([^"']+\.(?:mp4|m3u8|mpd))/gi);
        if (scriptMatches) {
            for (const match of scriptMatches) {
                const urlMatch = match.match(/["']([^"']+)["']/);
                if (urlMatch) {
                    embedUrls.push(this.cleanUrl(urlMatch[1]));
                }
            }
        }
        
        return [...new Set(embedUrls)];
    }
    
    /**
     * Resolve embed URL to actual stream URLs
     * @param {string} embedUrl - Embed URL to resolve
     * @returns {Array} Array of stream objects
     */
    async resolveEmbedUrl(embedUrl) {
        try {
            console.log(`[${this.name}] Resolving embed: ${embedUrl}`);
            
            const response = await this.makeRequest(embedUrl, {
                headers: {
                    'Referer': this.baseUrl
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const html = await response.text();
            const streams = [];
            
            // Extract video URLs from embed page
            const videoUrls = this.extractVideoUrls(html);
            for (const videoUrl of videoUrls) {
                streams.push(this.createStream({
                    url: videoUrl,
                    quality: this.extractQuality(videoUrl),
                    server: this.extractServerName(embedUrl),
                    title: `${this.name} - ${this.extractServerName(embedUrl)}`
                }));
            }
            
            return streams;
            
        } catch (error) {
            console.error(`[${this.name}] Error resolving embed URL:`, error);
            return [];
        }
    }
    
    /**
     * Use Puppeteer for JavaScript-heavy sites
     * @param {string} url - Page URL
     * @returns {Array} Array of stream objects
     */
    async getStreamsWithPuppeteer(url) {
        try {
            const puppeteer = require('puppeteer');
            
            console.log(`[${this.name}] Using Puppeteer for: ${url}`);
            
            const browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            
            const page = await browser.newPage();
            
            // Set user agent and viewport
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            await page.setViewport({ width: 1920, height: 1080 });
            
            // Intercept network requests to capture video URLs
            const videoUrls = [];
            await page.setRequestInterception(true);
            
            page.on('request', (request) => {
                const url = request.url();
                if (url.match(/\.(mp4|mkv|avi|mov|wmv|flv|webm|m4v|m3u8|mpd)(\?|$)/i)) {
                    videoUrls.push(url);
                }
                request.continue();
            });
            
            // Navigate to page and wait for content
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            
            // Click play buttons or video elements to trigger loading
            try {
                await page.click('.play-button, .video-player, video', { timeout: 5000 });
                await page.waitForTimeout(3000);
            } catch (error) {
                // Ignore click errors
            }
            
            // Extract video URLs from page content
            const pageVideoUrls = await page.evaluate(() => {
                const urls = [];
                
                // Check video elements
                document.querySelectorAll('video, source').forEach(el => {
                    if (el.src) urls.push(el.src);
                    if (el.getAttribute('data-src')) urls.push(el.getAttribute('data-src'));
                });
                
                // Check for URLs in scripts
                document.querySelectorAll('script').forEach(script => {
                    const content = script.textContent || script.innerText;
                    const matches = content.match(/https?:\/\/[^"'\\s]+\\.(?:mp4|m3u8|mpd)/gi);
                    if (matches) urls.push(...matches);
                });
                
                return urls;
            });
            
            videoUrls.push(...pageVideoUrls);
            
            await browser.close();
            
            // Create stream objects
            const streams = [];
            for (const videoUrl of [...new Set(videoUrls)]) {
                streams.push(this.createStream({
                    url: videoUrl,
                    quality: this.extractQuality(videoUrl),
                    server: 'Puppeteer',
                    title: `${this.name} - Browser Extracted`
                }));
            }
            
            console.log(`[${this.name}] Puppeteer found ${streams.length} streams`);
            return streams;
            
        } catch (error) {
            console.error(`[${this.name}] Puppeteer error:`, error);
            return [];
        }
    }
    
    // Utility methods
    
    generateId(url) {
        return `scraped:${this.name.toLowerCase()}:${Buffer.from(url).toString('base64').slice(0, 16)}`;
    }
    
    getUrlFromId(id) {
        try {
            const base64Part = id.split(':')[2];
            return Buffer.from(base64Part, 'base64').toString();
        } catch (error) {
            return null;
        }
    }
    
    extractYear(text) {
        if (!text) return null;
        const match = text.match(/(\d{4})/);
        return match ? parseInt(match[1]) : null;
    }
    
    extractRating(text) {
        if (!text) return null;
        const match = text.match(/(\d+\.?\d*)/);
        return match ? parseFloat(match[1]) : null;
    }
    
    extractRuntime(text) {
        if (!text) return null;
        const match = text.match(/(\d+)\s*(?:min|minutes?)/i);
        return match ? `${match[1]} min` : null;
    }
    
    extractGenres(text) {
        if (!text) return [];
        return text.split(/[,|]/).map(g => g.trim()).filter(g => g.length > 0);
    }
    
    extractCast(text) {
        if (!text) return [];
        return text.split(/[,|]/).map(c => c.trim()).filter(c => c.length > 0);
    }
    
    extractDirector(text) {
        if (!text) return [];
        return text.split(/[,|]/).map(d => d.trim()).filter(d => d.length > 0);
    }
    
    extractServerName(url) {
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch (error) {
            return 'Unknown Server';
        }
    }
    
    extractEpisodes($, baseUrl) {
        const episodes = [];
        
        $('.episode, .episode-item').each((i, element) => {
            const $el = $(element);
            const title = $el.find('.episode-title, .title').text().trim();
            const number = $el.find('.episode-number, .number').text().trim();
            const season = $el.find('.season-number, .season').text().trim();
            const link = this.cleanUrl($el.find('a').attr('href'));
            
            if (title && link) {
                episodes.push({
                    id: this.generateId(link),
                    title,
                    season: season ? parseInt(season) : 1,
                    episode: number ? parseInt(number) : i + 1,
                    overview: $el.find('.description, .overview').text().trim(),
                    thumbnail: this.cleanUrl($el.find('img').attr('src'))
                });
            }
        });
        
        return episodes;
    }
}

module.exports = PstreamScraper;

