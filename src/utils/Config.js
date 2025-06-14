/**
 * Configuration management for the addon
 */
class Config {
    constructor() {
        this.settings = {
            // General settings
            port: process.env.PORT || 3000,
            timeout: parseInt(process.env.TIMEOUT) || 30000,
            maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT) || 5,
            
            // Cache settings
            cacheEnabled: process.env.CACHE_ENABLED !== 'false',
            cacheTTL: {
                catalog: parseInt(process.env.CACHE_CATALOG_TTL) || 3600,    // 1 hour
                meta: parseInt(process.env.CACHE_META_TTL) || 86400,         // 24 hours
                streams: parseInt(process.env.CACHE_STREAMS_TTL) || 1800     // 30 minutes
            },
            
            // Scraper settings
            scrapers: {
                enabled: (process.env.SCRAPERS_ENABLED || 'pstream').split(','),
                userAgent: process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                retryAttempts: parseInt(process.env.RETRY_ATTEMPTS) || 3,
                retryDelay: parseInt(process.env.RETRY_DELAY) || 1000,
                puppeteerEnabled: process.env.PUPPETEER_ENABLED !== 'false'
            },
            
            // Torrent settings
            torrents: {
                enabled: process.env.TORRENTS_ENABLED !== 'false',
                sources: (process.env.TORRENT_SOURCES || 'eztv,ext,watchsomuch').split(','),
                maxResults: parseInt(process.env.TORRENT_MAX_RESULTS) || 10,
                minSeeders: parseInt(process.env.TORRENT_MIN_SEEDERS) || 1
            },
            
            // Logging settings
            logging: {
                level: process.env.LOG_LEVEL || 'info',
                enableConsole: process.env.LOG_CONSOLE !== 'false',
                enableFile: process.env.LOG_FILE === 'true',
                logFile: process.env.LOG_FILE_PATH || './logs/addon.log'
            },
            
            // Rate limiting
            rateLimit: {
                enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
                windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000, // 15 minutes
                maxRequests: parseInt(process.env.RATE_LIMIT_MAX) || 100
            }
        };
    }
    
    /**
     * Get configuration value
     * @param {string} path - Dot-separated path to config value
     * @returns {*} Configuration value
     */
    get(path) {
        return path.split('.').reduce((obj, key) => obj && obj[key], this.settings);
    }
    
    /**
     * Set configuration value
     * @param {string} path - Dot-separated path to config value
     * @param {*} value - Value to set
     */
    set(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((obj, key) => {
            if (!obj[key]) obj[key] = {};
            return obj[key];
        }, this.settings);
        target[lastKey] = value;
    }
    
    /**
     * Get all settings
     * @returns {Object} All configuration settings
     */
    getAll() {
        return { ...this.settings };
    }
    
    /**
     * Validate configuration
     * @returns {Array} Array of validation errors
     */
    validate() {
        const errors = [];
        
        if (this.settings.port < 1 || this.settings.port > 65535) {
            errors.push('Port must be between 1 and 65535');
        }
        
        if (this.settings.timeout < 1000) {
            errors.push('Timeout must be at least 1000ms');
        }
        
        if (this.settings.maxConcurrentRequests < 1) {
            errors.push('Max concurrent requests must be at least 1');
        }
        
        return errors;
    }
}

module.exports = new Config();

