const PstreamScraper = require('./PstreamScraper');
// Import other scrapers as they are implemented
// const WecinaScraper = require('./WecinaScraper');
// const HexaWatchScraper = require('./HexaWatchScraper');
// ... etc

/**
 * Manages all scrapers and provides unified interface
 */
class ScraperManager {
    constructor() {
        this.scrapers = [];
        this.initializeScrapers();
    }
    
    /**
     * Initialize all available scrapers
     */
    initializeScrapers() {
        // Add Pstream scraper
        this.scrapers.push(new PstreamScraper());
        
        // TODO: Add other scrapers as they are implemented
        // this.scrapers.push(new WecinaScraper());
        // this.scrapers.push(new HexaWatchScraper());
        // this.scrapers.push(new CinemaOSScraper());
        // this.scrapers.push(new VidoraScraper());
        // this.scrapers.push(new NunflixScraper());
        // this.scrapers.push(new UiraScraper());
        // this.scrapers.push(new BingeflixScraper());
        // this.scrapers.push(new PaheScraper());
        
        console.log(`ScraperManager initialized with ${this.scrapers.length} scrapers`);
        this.scrapers.forEach(scraper => {
            console.log(`- ${scraper.name}: ${scraper.enabled ? 'enabled' : 'disabled'}`);
        });
    }
    
    /**
     * Get all enabled scrapers
     * @returns {Array} Array of enabled scrapers
     */
    getEnabledScrapers() {
        return this.scrapers.filter(scraper => scraper.enabled);
    }
    
    /**
     * Search across all scrapers
     * @param {string} query - Search query
     * @param {string} type - Content type (movie/series)
     * @returns {Array} Combined results from all scrapers
     */
    async search(query, type) {
        console.log(`ScraperManager: Searching for "${query}" (${type})`);
        
        const enabledScrapers = this.getEnabledScrapers();
        const allResults = [];
        
        // Search in parallel across all scrapers
        const searchPromises = enabledScrapers.map(async (scraper) => {
            try {
                const results = await scraper.search(query, type);
                return results.map(result => ({
                    ...result,
                    source: scraper.name
                }));
            } catch (error) {
                console.error(`Search error in ${scraper.name}:`, error);
                return [];
            }
        });
        
        const results = await Promise.all(searchPromises);
        
        // Combine and deduplicate results
        for (const scraperResults of results) {
            allResults.push(...scraperResults);
        }
        
        // Remove duplicates based on title similarity
        const deduplicatedResults = this.deduplicateResults(allResults);
        
        console.log(`ScraperManager: Found ${deduplicatedResults.length} unique results from ${enabledScrapers.length} scrapers`);
        return deduplicatedResults;
    }
    
    /**
     * Get popular content across all scrapers
     * @param {string} type - Content type (movie/series)
     * @param {string} genre - Optional genre filter
     * @returns {Array} Combined popular content from all scrapers
     */
    async getPopular(type, genre = null) {
        console.log(`ScraperManager: Getting popular ${type} content${genre ? ` (${genre})` : ''}`);
        
        const enabledScrapers = this.getEnabledScrapers();
        const allResults = [];
        
        // Get popular content in parallel
        const popularPromises = enabledScrapers.map(async (scraper) => {
            try {
                const results = await scraper.getPopular(type, genre);
                return results.map(result => ({
                    ...result,
                    source: scraper.name
                }));
            } catch (error) {
                console.error(`getPopular error in ${scraper.name}:`, error);
                return [];
            }
        });
        
        const results = await Promise.all(popularPromises);
        
        // Combine results
        for (const scraperResults of results) {
            allResults.push(...scraperResults);
        }
        
        // Remove duplicates and sort by popularity/rating
        const deduplicatedResults = this.deduplicateResults(allResults);
        const sortedResults = deduplicatedResults.sort((a, b) => {
            // Sort by IMDB rating if available, otherwise by year
            if (a.imdbRating && b.imdbRating) {
                return b.imdbRating - a.imdbRating;
            }
            if (a.year && b.year) {
                return b.year - a.year;
            }
            return 0;
        });
        
        console.log(`ScraperManager: Found ${sortedResults.length} popular items from ${enabledScrapers.length} scrapers`);
        return sortedResults;
    }
    
    /**
     * Get metadata for specific content
     * @param {string} id - Content ID
     * @param {string} type - Content type
     * @returns {Object} Meta object or null
     */
    async getMeta(id, type) {
        console.log(`ScraperManager: Getting metadata for ${id} (${type})`);
        
        // Determine which scraper to use based on ID
        const scraper = this.getScraperFromId(id);
        if (!scraper) {
            console.error(`ScraperManager: No scraper found for ID ${id}`);
            return null;
        }
        
        try {
            const meta = await scraper.getMeta(id, type);
            if (meta) {
                meta.source = scraper.name;
            }
            return meta;
        } catch (error) {
            console.error(`ScraperManager: getMeta error for ${id}:`, error);
            return null;
        }
    }
    
    /**
     * Get streams for specific content
     * @param {string} id - Content ID
     * @param {string} type - Content type
     * @returns {Array} Array of stream objects
     */
    async getStreams(id, type) {
        console.log(`ScraperManager: Getting streams for ${id} (${type})`);
        
        // Determine which scraper to use based on ID
        const scraper = this.getScraperFromId(id);
        if (!scraper) {
            console.error(`ScraperManager: No scraper found for ID ${id}`);
            return [];
        }
        
        try {
            const streams = await scraper.getStreams(id, type);
            
            // Add source information to each stream
            return streams.map(stream => ({
                ...stream,
                source: scraper.name
            }));
            
        } catch (error) {
            console.error(`ScraperManager: getStreams error for ${id}:`, error);
            return [];
        }
    }
    
    /**
     * Get scraper instance from content ID
     * @param {string} id - Content ID
     * @returns {Object} Scraper instance or null
     */
    getScraperFromId(id) {
        // Extract scraper name from ID format: scraped:scrapername:...
        const parts = id.split(':');
        if (parts.length < 2 || parts[0] !== 'scraped') {
            return null;
        }
        
        const scraperName = parts[1].toLowerCase();
        return this.scrapers.find(scraper => 
            scraper.name.toLowerCase() === scraperName
        );
    }
    
    /**
     * Remove duplicate results based on title similarity
     * @param {Array} results - Array of meta objects
     * @returns {Array} Deduplicated results
     */
    deduplicateResults(results) {
        const seen = new Map();
        const deduplicated = [];
        
        for (const result of results) {
            // Create a normalized key for comparison
            const normalizedTitle = this.normalizeTitle(result.name || result.title);
            const key = `${normalizedTitle}:${result.year || 'unknown'}:${result.type}`;
            
            if (!seen.has(key)) {
                seen.set(key, true);
                deduplicated.push(result);
            } else {
                // If we've seen this title before, prefer the one with better metadata
                const existingIndex = deduplicated.findIndex(item => {
                    const existingKey = `${this.normalizeTitle(item.name || item.title)}:${item.year || 'unknown'}:${item.type}`;
                    return existingKey === key;
                });
                
                if (existingIndex >= 0) {
                    const existing = deduplicated[existingIndex];
                    
                    // Prefer result with poster, higher rating, or more complete metadata
                    if ((!existing.poster && result.poster) ||
                        (!existing.imdbRating && result.imdbRating) ||
                        (result.imdbRating > existing.imdbRating) ||
                        (result.description && result.description.length > (existing.description || '').length)) {
                        deduplicated[existingIndex] = result;
                    }
                }
            }
        }
        
        return deduplicated;
    }
    
    /**
     * Normalize title for comparison
     * @param {string} title - Original title
     * @returns {string} Normalized title
     */
    normalizeTitle(title) {
        if (!title) return '';
        
        return title
            .toLowerCase()
            .replace(/[^a-z0-9\\s]/g, '') // Remove special characters
            .replace(/\\s+/g, ' ') // Normalize whitespace
            .trim();
    }
    
    /**
     * Get scraper statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        return {
            totalScrapers: this.scrapers.length,
            enabledScrapers: this.getEnabledScrapers().length,
            scrapers: this.scrapers.map(scraper => ({
                name: scraper.name,
                enabled: scraper.enabled,
                baseUrl: scraper.baseUrl
            }))
        };
    }
    
    /**
     * Enable or disable a scraper
     * @param {string} name - Scraper name
     * @param {boolean} enabled - Enable/disable flag
     */
    setScraperEnabled(name, enabled) {
        const scraper = this.scrapers.find(s => s.name.toLowerCase() === name.toLowerCase());
        if (scraper) {
            scraper.enabled = enabled;
            console.log(`${scraper.name} scraper ${enabled ? 'enabled' : 'disabled'}`);
        }
    }
}

module.exports = ScraperManager;

