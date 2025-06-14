/**
 * Simple in-memory cache manager with TTL support
 * For production, consider using Redis or similar
 */
class CacheManager {
    constructor() {
        this.cache = new Map();
        this.timers = new Map();
        
        // Clean up expired entries every 5 minutes
        setInterval(() => {
            this.cleanup();
        }, 5 * 60 * 1000);
    }
    
    /**
     * Get value from cache
     * @param {string} key - Cache key
     * @returns {*} Cached value or null if not found/expired
     */
    async get(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;
        
        // Check if expired
        if (Date.now() > entry.expires) {
            this.delete(key);
            return null;
        }
        
        return entry.value;
    }
    
    /**
     * Set value in cache with TTL
     * @param {string} key - Cache key
     * @param {*} value - Value to cache
     * @param {number} ttl - Time to live in seconds
     */
    async set(key, value, ttl = 3600) {
        const expires = Date.now() + (ttl * 1000);
        
        // Clear existing timer if any
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
        }
        
        // Set cache entry
        this.cache.set(key, { value, expires });
        
        // Set expiration timer
        const timer = setTimeout(() => {
            this.delete(key);
        }, ttl * 1000);
        
        this.timers.set(key, timer);
    }
    
    /**
     * Delete entry from cache
     * @param {string} key - Cache key
     */
    delete(key) {
        this.cache.delete(key);
        
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
            this.timers.delete(key);
        }
    }
    
    /**
     * Clear all cache entries
     */
    clear() {
        // Clear all timers
        for (const timer of this.timers.values()) {
            clearTimeout(timer);
        }
        
        this.cache.clear();
        this.timers.clear();
    }
    
    /**
     * Clean up expired entries
     */
    cleanup() {
        const now = Date.now();
        const expiredKeys = [];
        
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expires) {
                expiredKeys.push(key);
            }
        }
        
        for (const key of expiredKeys) {
            this.delete(key);
        }
        
        if (expiredKeys.length > 0) {
            console.log(`Cleaned up ${expiredKeys.length} expired cache entries`);
        }
    }
    
    /**
     * Get cache statistics
     */
    getStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}

module.exports = CacheManager;

