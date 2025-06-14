/**
 * Base scraper class that all site-specific scrapers should extend
 */
class BaseScraper {
    constructor(name, baseUrl) {
        this.name = name;
        this.baseUrl = baseUrl;
        this.enabled = true;
        this.timeout = 30000; // 30 seconds timeout
    }
    
    /**
     * Search for content on the site
     * @param {string} query - Search query
     * @param {string} type - Content type (movie/series)
     * @returns {Array} Array of meta objects
     */
    async search(query, type) {
        throw new Error(`Search method not implemented for ${this.name}`);
    }
    
    /**
     * Get popular/trending content
     * @param {string} type - Content type (movie/series)
     * @param {string} genre - Optional genre filter
     * @returns {Array} Array of meta objects
     */
    async getPopular(type, genre = null) {
        throw new Error(`getPopular method not implemented for ${this.name}`);
    }
    
    /**
     * Get detailed metadata for specific content
     * @param {string} id - Content ID
     * @param {string} type - Content type
     * @returns {Object} Meta object with detailed info
     */
    async getMeta(id, type) {
        throw new Error(`getMeta method not implemented for ${this.name}`);
    }
    
    /**
     * Get streaming links for content
     * @param {string} id - Content ID
     * @param {string} type - Content type
     * @returns {Array} Array of stream objects
     */
    async getStreams(id, type) {
        throw new Error(`getStreams method not implemented for ${this.name}`);
    }
    
    /**
     * Create a standardized meta object
     * @param {Object} data - Raw data from scraper
     * @returns {Object} Standardized meta object
     */
    createMeta(data) {
        return {
            id: data.id || `scraped:${this.name}:${data.title?.replace(/[^a-zA-Z0-9]/g, '')}`,
            type: data.type || 'movie',
            name: data.title || 'Unknown Title',
            poster: data.poster || null,
            background: data.background || data.poster || null,
            year: data.year || null,
            imdbRating: data.rating || null,
            description: data.description || null,
            genre: data.genres || [],
            cast: data.cast || [],
            director: data.director || [],
            writer: data.writer || [],
            runtime: data.runtime || null,
            country: data.country || null,
            language: data.language || null,
            // Additional metadata for series
            ...(data.type === 'series' && {
                videos: data.episodes || []
            })
        };
    }
    
    /**
     * Create a standardized stream object
     * @param {Object} data - Raw stream data
     * @returns {Object} Standardized stream object
     */
    createStream(data) {
        return {
            url: data.url,
            title: data.title || `${this.name} - ${data.quality || 'Unknown Quality'}`,
            quality: data.quality || null,
            qualityNote: data.qualityNote || null,
            language: data.language || null,
            subtitles: data.subtitles || [],
            behaviorHints: {
                notWebReady: data.notWebReady || false,
                bingeGroup: data.bingeGroup || null
            },
            // Additional metadata
            source: this.name,
            server: data.server || null,
            size: data.size || null
        };
    }
    
    /**
     * Utility method to make HTTP requests with proper headers
     * @param {string} url - URL to fetch
     * @param {Object} options - Request options
     * @returns {Object} Response object
     */
    async makeRequest(url, options = {}) {
        const fetch = require('node-fetch');
        
        const defaultHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        };
        
        const requestOptions = {
            timeout: this.timeout,
            headers: { ...defaultHeaders, ...(options.headers || {}) },
            ...options
        };
        
        try {
            const response = await fetch(url, requestOptions);
            return response;
        } catch (error) {
            console.error(`Request failed for ${url}:`, error.message);
            throw error;
        }
    }
    
    /**
     * Extract video URLs from various embed formats
     * @param {string} html - HTML content
     * @returns {Array} Array of video URLs
     */
    extractVideoUrls(html) {
        const urls = [];
        
        // Common video URL patterns
        const patterns = [
            // Direct video files
            /https?:\/\/[^"'\s]+\.(?:mp4|mkv|avi|mov|wmv|flv|webm|m4v)/gi,
            // HLS streams
            /https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/gi,
            // DASH streams
            /https?:\/\/[^"'\s]+\.mpd[^"'\s]*/gi,
            // Common streaming patterns
            /https?:\/\/[^"'\s]*(?:stream|video|play)[^"'\s]*\.(?:php|html|aspx?)[^"'\s]*/gi
        ];
        
        for (const pattern of patterns) {
            const matches = html.match(pattern);
            if (matches) {
                urls.push(...matches);
            }
        }
        
        return [...new Set(urls)]; // Remove duplicates
    }
    
    /**
     * Clean and validate URLs
     * @param {string} url - URL to clean
     * @param {string} baseUrl - Base URL for relative links
     * @returns {string} Cleaned URL
     */
    cleanUrl(url, baseUrl = this.baseUrl) {
        if (!url) return null;
        
        // Handle relative URLs
        if (url.startsWith('/')) {
            return new URL(url, baseUrl).href;
        }
        
        // Handle protocol-relative URLs
        if (url.startsWith('//')) {
            return `https:${url}`;
        }
        
        return url;
    }
    
    /**
     * Extract quality information from text
     * @param {string} text - Text to analyze
     * @returns {string} Quality string (e.g., "1080p", "720p")
     */
    extractQuality(text) {
        if (!text) return null;
        
        const qualityPatterns = [
            /(\d{3,4}p)/i,
            /(4K|UHD)/i,
            /(HD|SD)/i,
            /(CAM|TS|TC|SCR|R5|DVDRip|BRRip|BluRay)/i
        ];
        
        for (const pattern of qualityPatterns) {
            const match = text.match(pattern);
            if (match) {
                return match[1].toUpperCase();
            }
        }
        
        return null;
    }
}

module.exports = BaseScraper;

