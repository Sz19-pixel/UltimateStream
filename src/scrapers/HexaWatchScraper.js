const BaseScraper = require('./BaseScraper');
const cheerio = require('cheerio');

/**
 * HexaWatch scraper implementation
 * Template for modern streaming site with potential JavaScript rendering
 */
class HexaWatchScraper extends BaseScraper {
    constructor() {
        super('HexaWatch', 'https://hexa.watch');
        this.searchUrl = 'https://hexa.watch/search';
        this.apiUrl = 'https://hexa.watch/api'; // If site has API endpoints
    }
    
    async search(query, type) {
        try {
            console.log(`[${this.name}] Searching for: ${query} (${type})`);
            
            // Try API first if available
            const apiResults = await this.searchViaAPI(query, type);
            if (apiResults.length > 0) {
                return apiResults;
            }
            
            // Fallback to HTML scraping
            return await this.searchViaHTML(query, type);
            
        } catch (error) {
            console.error(`[${this.name}] Search error:`, error);
            return [];
        }
    }
    
    async searchViaAPI(query, type) {
        try {
            // TODO: Implement API search if site provides one
            const apiUrl = `${this.apiUrl}/search?q=${encodeURIComponent(query)}&type=${type}`;
            const response = await this.makeRequest(apiUrl, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                return this.parseAPIResults(data, type);
            }
            
            return [];
            
        } catch (error) {
            console.log(`[${this.name}] API search failed, falling back to HTML:`, error.message);
            return [];
        }
    }
    
    async searchViaHTML(query, type) {
        const searchUrl = `${this.searchUrl}?q=${encodeURIComponent(query)}`;
        const response = await this.makeRequest(searchUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const html = await response.text();
        
        // Check if page requires JavaScript rendering
        if (this.requiresJavaScript(html)) {
            console.log(`[${this.name}] Page requires JavaScript, using Puppeteer`);
            return await this.searchWithPuppeteer(searchUrl, type);
        }
        
        return this.parseHTMLResults(html, type);
    }
    
    async searchWithPuppeteer(url, type) {
        try {
            const puppeteer = require('puppeteer');
            
            const browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            
            const page = await browser.newPage();
            await page.setUserAgent(this.userAgent);
            
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            
            // Wait for content to load
            await page.waitForSelector('.search-results, .movie-item, .content-item', { timeout: 10000 });
            
            const html = await page.content();
            await browser.close();
            
            return this.parseHTMLResults(html, type);
            
        } catch (error) {
            console.error(`[${this.name}] Puppeteer search error:`, error);
            return [];
        }
    }
    
    parseAPIResults(data, type) {
        const results = [];
        
        // TODO: Parse API response structure
        if (data && data.results) {
            for (const item of data.results) {
                results.push(this.createMeta({
                    id: this.generateId(item.url || item.id),
                    type: item.type || type,
                    title: item.title || item.name,
                    year: item.year || item.release_date?.substring(0, 4),
                    poster: item.poster || item.image,
                    rating: item.rating || item.vote_average,
                    description: item.description || item.overview,
                    sourceUrl: item.url
                }));
            }
        }
        
        return results;
    }
    
    parseHTMLResults(html, type) {
        const $ = cheerio.load(html);
        const results = [];
        
        // TODO: Update selectors based on actual site structure
        $('.search-result, .movie-card, .content-item').each((i, element) => {
            const $el = $(element);
            
            const title = $el.find('.title, h3, .movie-title').first().text().trim();
            const year = this.extractYear($el.find('.year, .release-date').text());
            const poster = this.cleanUrl($el.find('img').attr('src') || $el.find('img').attr('data-src'));
            const link = this.cleanUrl($el.find('a').attr('href'));
            const rating = this.extractRating($el.find('.rating, .score').text());
            
            if (title && link) {
                results.push(this.createMeta({
                    id: this.generateId(link),
                    type: this.determineType(link, type),
                    title,
                    year,
                    poster,
                    rating,
                    sourceUrl: link
                }));
            }
        });
        
        return results;
    }
    
    async getPopular(type, genre = null) {
        try {
            // Try API endpoint first
            const apiUrl = `${this.apiUrl}/popular?type=${type}${genre ? `&genre=${genre}` : ''}`;
            const response = await this.makeRequest(apiUrl, {
                headers: { 'Accept': 'application/json' }
            });
            
            if (response.ok) {
                const data = await response.json();
                return this.parseAPIResults(data, type);
            }
            
            // Fallback to HTML scraping
            const htmlUrl = `${this.baseUrl}/${type}${genre ? `?genre=${genre}` : ''}`;
            const htmlResponse = await this.makeRequest(htmlUrl);
            const html = await htmlResponse.text();
            
            return this.parseHTMLResults(html, type);
            
        } catch (error) {
            console.error(`[${this.name}] getPopular error:`, error);
            return [];
        }
    }
    
    async getMeta(id, type) {
        try {
            const url = this.getUrlFromId(id);
            if (!url) return null;
            
            const response = await this.makeRequest(url);
            const html = await response.text();
            
            if (this.requiresJavaScript(html)) {
                return await this.getMetaWithPuppeteer(url, type);
            }
            
            return this.parseMetaFromHTML(html, id, type);
            
        } catch (error) {
            console.error(`[${this.name}] getMeta error:`, error);
            return null;
        }
    }
    
    async getStreams(id, type) {
        try {
            const url = this.getUrlFromId(id);
            if (!url) return [];
            
            const response = await this.makeRequest(url);
            const html = await response.text();
            
            let streams = [];
            
            // Extract direct video URLs
            streams.push(...this.extractDirectStreams(html));
            
            // Extract and resolve embed URLs
            const embedUrls = this.extractEmbedUrls(html);
            for (const embedUrl of embedUrls) {
                const embedStreams = await this.resolveEmbedUrl(embedUrl);
                streams.push(...embedStreams);
            }
            
            // Use Puppeteer if no streams found
            if (streams.length === 0 && this.requiresJavaScript(html)) {
                streams = await this.getStreamsWithPuppeteer(url);
            }
            
            return streams;
            
        } catch (error) {
            console.error(`[${this.name}] getStreams error:`, error);
            return [];
        }
    }
    
    requiresJavaScript(html) {
        // Check for indicators that page requires JavaScript
        return html.includes('Please enable JavaScript') ||
               html.includes('document.addEventListener') ||
               html.includes('window.onload') ||
               html.length < 1000; // Very short HTML might indicate JS rendering
    }
    
    extractDirectStreams(html) {
        const streams = [];
        const videoUrls = this.extractVideoUrls(html);
        
        for (const url of videoUrls) {
            streams.push(this.createStream({
                url,
                quality: this.extractQuality(url),
                server: 'Direct',
                title: `${this.name} - Direct Stream`
            }));
        }
        
        return streams;
    }
    
    async resolveEmbedUrl(embedUrl) {
        try {
            const response = await this.makeRequest(embedUrl, {
                headers: { 'Referer': this.baseUrl }
            });
            
            const html = await response.text();
            const videoUrls = this.extractVideoUrls(html);
            
            return videoUrls.map(url => this.createStream({
                url,
                quality: this.extractQuality(url),
                server: this.extractServerName(embedUrl),
                title: `${this.name} - ${this.extractServerName(embedUrl)}`
            }));
            
        } catch (error) {
            console.error(`[${this.name}] Error resolving embed:`, error);
            return [];
        }
    }
    
    // Utility methods
    determineType(url, defaultType) {
        if (url.includes('/series/') || url.includes('/tv/') || url.includes('/show/')) {
            return 'series';
        } else if (url.includes('/movie/') || url.includes('/film/')) {
            return 'movie';
        }
        return defaultType;
    }
    
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
    
    extractServerName(url) {
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch (error) {
            return 'Unknown Server';
        }
    }
}

module.exports = HexaWatchScraper;

