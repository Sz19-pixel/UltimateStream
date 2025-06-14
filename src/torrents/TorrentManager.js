const cheerio = require('cheerio');
// const parseTorrent = require('parse-torrent'); // Commented out due to compatibility issues
// const magnet = require('magnet-uri'); // Commented out due to compatibility issues

/**
 * Manages torrent-based streaming sources as fallback
 */
class TorrentManager {
    constructor() {
        this.torrentSources = [
            {
                name: 'EZTV',
                baseUrl: 'https://eztvx.to',
                searchUrl: 'https://eztvx.to/search',
                enabled: true
            },
            {
                name: 'ExtraTorrent',
                baseUrl: 'https://ext.to',
                searchUrl: 'https://ext.to/search',
                enabled: true
            },
            {
                name: 'WatchSoMuch',
                baseUrl: 'https://watchsomuch.to',
                searchUrl: 'https://watchsomuch.to/search',
                enabled: true
            }
        ];
        
        this.timeout = 30000; // 30 seconds timeout
        console.log(`TorrentManager initialized with ${this.torrentSources.length} sources`);
    }
    
    /**
     * Get streams from torrent sources
     * @param {string} id - Content ID
     * @param {string} type - Content type (movie/series)
     * @returns {Array} Array of torrent stream objects
     */
    async getStreams(id, type) {
        console.log(`TorrentManager: Getting torrent streams for ${id} (${type})`);
        
        // Extract search query from ID or use fallback
        const searchQuery = this.extractSearchQuery(id);
        if (!searchQuery) {
            console.log('TorrentManager: Could not extract search query from ID');
            return [];
        }
        
        const allStreams = [];
        const enabledSources = this.torrentSources.filter(source => source.enabled);
        
        // Search across all torrent sources in parallel
        const searchPromises = enabledSources.map(async (source) => {
            try {
                const streams = await this.searchTorrentSource(source, searchQuery, type);
                return streams.map(stream => ({
                    ...stream,
                    source: `${source.name} (Torrent)`
                }));
            } catch (error) {
                console.error(`TorrentManager: Error searching ${source.name}:`, error);
                return [];
            }
        });
        
        const results = await Promise.all(searchPromises);
        
        // Combine results
        for (const sourceStreams of results) {
            allStreams.push(...sourceStreams);
        }
        
        // Sort by seeders and quality
        const sortedStreams = allStreams.sort((a, b) => {
            // Prefer higher seeders
            if (a.seeders && b.seeders) {
                return b.seeders - a.seeders;
            }
            // Prefer better quality
            const qualityOrder = { '2160p': 4, '1080p': 3, '720p': 2, '480p': 1 };
            const aQuality = qualityOrder[a.quality] || 0;
            const bQuality = qualityOrder[b.quality] || 0;
            return bQuality - aQuality;
        });
        
        console.log(`TorrentManager: Found ${sortedStreams.length} torrent streams`);
        return sortedStreams.slice(0, 10); // Limit to top 10 results
    }
    
    /**
     * Search a specific torrent source
     * @param {Object} source - Torrent source configuration
     * @param {string} query - Search query
     * @param {string} type - Content type
     * @returns {Array} Array of stream objects
     */
    async searchTorrentSource(source, query, type) {
        console.log(`TorrentManager: Searching ${source.name} for: ${query}`);
        
        try {
            // Construct search URL
            const searchUrl = `${source.searchUrl}?q=${encodeURIComponent(query)}`;
            
            const response = await this.makeRequest(searchUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const html = await response.text();
            
            // Parse results based on source
            let streams = [];
            switch (source.name) {
                case 'EZTV':
                    streams = this.parseEZTVResults(html, source.baseUrl);
                    break;
                case 'ExtraTorrent':
                    streams = this.parseExtraTorrentResults(html, source.baseUrl);
                    break;
                case 'WatchSoMuch':
                    streams = this.parseWatchSoMuchResults(html, source.baseUrl);
                    break;
                default:
                    streams = this.parseGenericTorrentResults(html, source.baseUrl);
            }
            
            console.log(`TorrentManager: Found ${streams.length} results from ${source.name}`);
            return streams;
            
        } catch (error) {
            console.error(`TorrentManager: Error searching ${source.name}:`, error);
            return [];
        }
    }
    
    /**
     * Parse EZTV search results
     * @param {string} html - HTML content
     * @param {string} baseUrl - Base URL
     * @returns {Array} Array of stream objects
     */
    parseEZTVResults(html, baseUrl) {
        const $ = cheerio.load(html);
        const streams = [];
        
        $('.forum_header_border tr').each((i, element) => {
            if (i === 0) return; // Skip header row
            
            const $row = $(element);
            const $cells = $row.find('td');
            
            if ($cells.length >= 5) {
                const title = $cells.eq(1).find('a').text().trim();
                const magnetLink = $cells.eq(2).find('a[href^="magnet:"]').attr('href');
                const size = $cells.eq(3).text().trim();
                const seeders = parseInt($cells.eq(5).text().trim()) || 0;
                const leechers = parseInt($cells.eq(6).text().trim()) || 0;
                
                if (title && magnetLink) {
                    streams.push(this.createTorrentStream({
                        title,
                        magnetLink,
                        size,
                        seeders,
                        leechers,
                        source: 'EZTV'
                    }));
                }
            }
        });
        
        return streams;
    }
    
    /**
     * Parse ExtraTorrent search results
     * @param {string} html - HTML content
     * @param {string} baseUrl - Base URL
     * @returns {Array} Array of stream objects
     */
    parseExtraTorrentResults(html, baseUrl) {
        const $ = cheerio.load(html);
        const streams = [];
        
        $('.tl tr').each((i, element) => {
            if (i === 0) return; // Skip header row
            
            const $row = $(element);
            const $cells = $row.find('td');
            
            if ($cells.length >= 6) {
                const title = $cells.eq(0).find('a').text().trim();
                const magnetLink = $cells.eq(0).find('a[href^="magnet:"]').attr('href');
                const size = $cells.eq(1).text().trim();
                const seeders = parseInt($cells.eq(2).text().trim()) || 0;
                const leechers = parseInt($cells.eq(3).text().trim()) || 0;
                
                if (title && magnetLink) {
                    streams.push(this.createTorrentStream({
                        title,
                        magnetLink,
                        size,
                        seeders,
                        leechers,
                        source: 'ExtraTorrent'
                    }));
                }
            }
        });
        
        return streams;
    }
    
    /**
     * Parse WatchSoMuch search results
     * @param {string} html - HTML content
     * @param {string} baseUrl - Base URL
     * @returns {Array} Array of stream objects
     */
    parseWatchSoMuchResults(html, baseUrl) {
        const $ = cheerio.load(html);
        const streams = [];
        
        $('.table-responsive table tr').each((i, element) => {
            if (i === 0) return; // Skip header row
            
            const $row = $(element);
            const $cells = $row.find('td');
            
            if ($cells.length >= 4) {
                const title = $cells.eq(0).find('a').text().trim();
                const magnetLink = $cells.eq(0).find('a[href^="magnet:"]').attr('href') ||
                                 $row.find('a[href^="magnet:"]').attr('href');
                const size = $cells.eq(1).text().trim();
                const seeders = parseInt($cells.eq(2).text().trim()) || 0;
                const leechers = parseInt($cells.eq(3).text().trim()) || 0;
                
                if (title && magnetLink) {
                    streams.push(this.createTorrentStream({
                        title,
                        magnetLink,
                        size,
                        seeders,
                        leechers,
                        source: 'WatchSoMuch'
                    }));
                }
            }
        });
        
        return streams;
    }
    
    /**
     * Parse generic torrent site results
     * @param {string} html - HTML content
     * @param {string} baseUrl - Base URL
     * @returns {Array} Array of stream objects
     */
    parseGenericTorrentResults(html, baseUrl) {
        const $ = cheerio.load(html);
        const streams = [];
        
        // Look for common torrent result patterns
        $('table tr, .torrent-item, .result-item').each((i, element) => {
            const $el = $(element);
            
            // Try to find title and magnet link
            const title = $el.find('a:not([href^="magnet:"])').first().text().trim() ||
                         $el.find('.title, .name').text().trim();
            const magnetLink = $el.find('a[href^="magnet:"]').attr('href');
            
            if (title && magnetLink) {
                // Extract additional info
                const sizeText = $el.find('.size, .filesize').text().trim() ||
                               $el.text().match(/([0-9.]+\\s*[KMGT]B)/i)?.[1] || '';
                const seedersText = $el.find('.seeders, .seeds').text().trim() ||
                                  $el.text().match(/S:\\s*(\\d+)/i)?.[1] || '0';
                const leechersText = $el.find('.leechers, .peers').text().trim() ||
                                   $el.text().match(/L:\\s*(\\d+)/i)?.[1] || '0';
                
                streams.push(this.createTorrentStream({
                    title,
                    magnetLink,
                    size: sizeText,
                    seeders: parseInt(seedersText) || 0,
                    leechers: parseInt(leechersText) || 0,
                    source: 'Generic'
                }));
            }
        });
        
        return streams;
    }
    
    /**
     * Create a standardized torrent stream object
     * @param {Object} data - Raw torrent data
     * @returns {Object} Standardized stream object
     */
    createTorrentStream(data) {
        const quality = this.extractQuality(data.title);
        const language = this.extractLanguage(data.title);
        
        // Parse magnet link to get more info
        let infoHash = null;
        let trackers = [];
        
        try {
            // Simple magnet link parsing
            const magnetData = this.parseMagnetLink(data.magnetLink);
            infoHash = magnetData.infoHash;
            trackers = magnetData.trackers;
        } catch (error) {
            console.error('Error parsing magnet link:', error);
        }
        
        return {
            // Use HTTP streaming URL for Stremio compatibility
            url: this.createStreamingUrl(data.magnetLink, infoHash),
            title: `${data.source} - ${quality || 'Unknown'} - S:${data.seeders} L:${data.leechers}`,
            quality: quality,
            qualityNote: `${data.size} | Seeds: ${data.seeders} | Peers: ${data.leechers}`,
            language: language,
            
            // Torrent-specific metadata
            infoHash: infoHash,
            magnetUri: data.magnetLink,
            seeders: data.seeders,
            leechers: data.leechers,
            size: data.size,
            
            // Stremio behavior hints
            behaviorHints: {
                notWebReady: false, // We'll provide HTTP streaming
                bingeGroup: `torrent-${data.source.toLowerCase()}`
            },
            
            // Additional metadata
            source: data.source,
            type: 'torrent'
        };
    }
    
    /**
     * Create HTTP streaming URL from magnet link
     * This would typically point to a WebTorrent-to-HTTP bridge
     * @param {string} magnetLink - Magnet URI
     * @param {string} infoHash - Torrent info hash
     * @returns {string} HTTP streaming URL
     */
    createStreamingUrl(magnetLink, infoHash) {
        // In a real implementation, this would point to your WebTorrent-to-HTTP bridge
        // For now, we'll use a placeholder that includes the magnet link
        
        // Option 1: Use a public WebTorrent-to-HTTP service (if available)
        // return `https://webtorrent-bridge.example.com/stream/${infoHash}`;
        
        // Option 2: Use Stremio's built-in torrent support
        return magnetLink;
        
        // Option 3: Self-hosted WebTorrent bridge
        // return `http://localhost:8080/stream?magnet=${encodeURIComponent(magnetLink)}`;
    }
    
    /**
     * Extract search query from content ID
     * @param {string} id - Content ID
     * @returns {string} Search query or null
     */
    extractSearchQuery(id) {
        // This is a simplified implementation
        // In a real scenario, you'd need to map IDs to proper search queries
        
        if (id.startsWith('tt')) {
            // IMDB ID - would need to resolve to title
            return null; // TODO: Implement IMDB ID resolution
        }
        
        if (id.startsWith('scraped:')) {
            // Extract from scraped ID - this is tricky without the original metadata
            return null; // TODO: Implement scraped ID to search query mapping
        }
        
        // Fallback: use ID as search query
        return id.replace(/[^a-zA-Z0-9\\s]/g, ' ').trim();
    }
    
    /**
     * Extract quality from title
     * @param {string} title - Torrent title
     * @returns {string} Quality string
     */
    extractQuality(title) {
        if (!title) return null;
        
        const qualityPatterns = [
            /2160p|4K|UHD/i,
            /1080p|FHD/i,
            /720p|HD/i,
            /480p|SD/i,
            /CAM|TS|TC|SCR|R5|DVDRip|BRRip|BluRay|WEBRip|HDTV/i
        ];
        
        for (const pattern of qualityPatterns) {
            const match = title.match(pattern);
            if (match) {
                return match[0].toUpperCase();
            }
        }
        
        return null;
    }
    
    /**
     * Extract language from title
     * @param {string} title - Torrent title
     * @returns {string} Language code or null
     */
    extractLanguage(title) {
        if (!title) return null;
        
        const languagePatterns = [
            { pattern: /\\b(english|eng)\\b/i, code: 'en' },
            { pattern: /\\b(spanish|esp)\\b/i, code: 'es' },
            { pattern: /\\b(french|fra)\\b/i, code: 'fr' },
            { pattern: /\\b(german|ger)\\b/i, code: 'de' },
            { pattern: /\\b(italian|ita)\\b/i, code: 'it' },
            { pattern: /\\b(portuguese|por)\\b/i, code: 'pt' },
            { pattern: /\\b(russian|rus)\\b/i, code: 'ru' },
            { pattern: /\\b(chinese|chi)\\b/i, code: 'zh' },
            { pattern: /\\b(japanese|jap)\\b/i, code: 'ja' },
            { pattern: /\\b(korean|kor)\\b/i, code: 'ko' }
        ];
        
        for (const { pattern, code } of languagePatterns) {
            if (pattern.test(title)) {
                return code;
            }
        }
        
        return null;
    }
    
    /**
     * Make HTTP request with proper headers
     * @param {string} url - URL to fetch
     * @param {Object} options - Request options
     * @returns {Object} Response object
     */
    async makeRequest(url, options = {}) {
        const fetch = require('node-fetch');
        
        const defaultHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive'
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
            console.error(`TorrentManager: Request failed for ${url}:`, error.message);
            throw error;
        }
    }
    
    /**
     * Simple magnet link parser
     * @param {string} magnetLink - Magnet URI
     * @returns {Object} Parsed magnet data
     */
    parseMagnetLink(magnetLink) {
        if (!magnetLink || !magnetLink.startsWith('magnet:')) {
            throw new Error('Invalid magnet link');
        }
        
        const url = new URL(magnetLink);
        const params = url.searchParams;
        
        // Extract info hash
        const xt = params.get('xt');
        let infoHash = null;
        if (xt && xt.startsWith('urn:btih:')) {
            infoHash = xt.substring(9);
        }
        
        // Extract trackers
        const trackers = params.getAll('tr');
        
        return {
            infoHash,
            trackers,
            name: params.get('dn') || null
        };
    }
    
    /**
     * Get torrent source statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        return {
            totalSources: this.torrentSources.length,
            enabledSources: this.torrentSources.filter(s => s.enabled).length,
            sources: this.torrentSources.map(source => ({
                name: source.name,
                enabled: source.enabled,
                baseUrl: source.baseUrl
            }))
        };
    }
    
    /**
     * Enable or disable a torrent source
     * @param {string} name - Source name
     * @param {boolean} enabled - Enable/disable flag
     */
    setSourceEnabled(name, enabled) {
        const source = this.torrentSources.find(s => s.name.toLowerCase() === name.toLowerCase());
        if (source) {
            source.enabled = enabled;
            console.log(`${source.name} torrent source ${enabled ? 'enabled' : 'disabled'}`);
        }
    }
}

module.exports = TorrentManager;

