const BaseScraper = require('./BaseScraper');
const cheerio = require('cheerio');

/**
 * Template scraper for CinemaOS.live
 * Modern streaming site with potential API endpoints
 */
class CinemaOSScraper extends BaseScraper {
    constructor() {
        super('CinemaOS', 'https://cinemaos.live');
        this.searchUrl = 'https://cinemaos.live/search';
        this.apiUrl = 'https://cinemaos.live/api/v1';
    }
    
    async search(query, type) {
        try {
            console.log(`[${this.name}] Searching for: ${query} (${type})`);
            
            // Try API search first
            const apiResults = await this.searchViaAPI(query, type);
            if (apiResults.length > 0) {
                return apiResults;
            }
            
            // Fallback to HTML scraping
            const searchUrl = `${this.searchUrl}?q=${encodeURIComponent(query)}&type=${type}`;
            const response = await this.makeRequest(searchUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const html = await response.text();
            return this.parseSearchResults(html, type);
            
        } catch (error) {
            console.error(`[${this.name}] Search error:`, error);
            return [];
        }
    }
    
    async searchViaAPI(query, type) {
        try {
            const apiUrl = `${this.apiUrl}/search?q=${encodeURIComponent(query)}&type=${type}`;
            const response = await this.makeRequest(apiUrl, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                return this.parseAPISearchResults(data);
            }
            
            return [];
            
        } catch (error) {
            console.log(`[${this.name}] API search failed:`, error.message);
            return [];
        }
    }
    
    parseAPISearchResults(data) {
        const results = [];
        
        if (data && data.results) {
            for (const item of data.results) {
                results.push(this.createMeta({
                    id: this.generateId(item.slug || item.id),
                    type: item.type,
                    title: item.title,
                    year: item.year,
                    poster: item.poster_url,
                    rating: item.imdb_rating,
                    description: item.plot,
                    sourceUrl: `${this.baseUrl}/${item.type}/${item.slug}`
                }));
            }
        }
        
        return results;
    }
    
    parseSearchResults(html, type) {
        const $ = cheerio.load(html);
        const results = [];
        
        // TODO: Update selectors based on actual site structure
        $('.movie-card, .series-card, .content-card').each((i, element) => {
            const $el = $(element);
            
            const title = $el.find('.card-title, .title').text().trim();
            const year = this.extractYear($el.find('.year, .release-year').text());
            const poster = this.cleanUrl($el.find('img').attr('src') || $el.find('img').attr('data-src'));
            const link = this.cleanUrl($el.find('a').attr('href'));
            const rating = this.extractRating($el.find('.rating, .imdb-score').text());
            
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
            // Try API first
            let apiUrl = `${this.apiUrl}/popular?type=${type}`;
            if (genre) {
                apiUrl += `&genre=${encodeURIComponent(genre)}`;
            }
            
            const response = await this.makeRequest(apiUrl, {
                headers: { 'Accept': 'application/json' }
            });
            
            if (response.ok) {
                const data = await response.json();
                return this.parseAPISearchResults(data);
            }
            
            // Fallback to HTML
            const htmlUrl = `${this.baseUrl}/${type}${genre ? `?genre=${genre}` : ''}`;
            const htmlResponse = await this.makeRequest(htmlUrl);
            const html = await htmlResponse.text();
            
            return this.parseSearchResults(html, type);
            
        } catch (error) {
            console.error(`[${this.name}] getPopular error:`, error);
            return [];
        }
    }
    
    async getMeta(id, type) {
        try {
            const url = this.getUrlFromId(id);
            if (!url) return null;
            
            // Try API endpoint first
            const slug = this.extractSlugFromUrl(url);
            if (slug) {
                const apiMeta = await this.getMetaViaAPI(slug, type);
                if (apiMeta) return apiMeta;
            }
            
            // Fallback to HTML scraping
            const response = await this.makeRequest(url);
            const html = await response.text();
            
            return this.parseMetaFromHTML(html, id, type);
            
        } catch (error) {
            console.error(`[${this.name}] getMeta error:`, error);
            return null;
        }
    }
    
    async getMetaViaAPI(slug, type) {
        try {
            const apiUrl = `${this.apiUrl}/${type}/${slug}`;
            const response = await this.makeRequest(apiUrl, {
                headers: { 'Accept': 'application/json' }
            });
            
            if (response.ok) {
                const data = await response.json();
                return this.createMeta({
                    id: this.generateId(data.slug),
                    type: data.type,
                    title: data.title,
                    year: data.year,
                    poster: data.poster_url,
                    background: data.backdrop_url,
                    rating: data.imdb_rating,
                    description: data.plot,
                    genres: data.genres,
                    cast: data.cast,
                    director: data.director,
                    runtime: data.runtime,
                    sourceUrl: `${this.baseUrl}/${type}/${slug}`
                });
            }
            
            return null;
            
        } catch (error) {
            console.error(`[${this.name}] API getMeta error:`, error);
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
            
            // Method 1: Extract from embedded players
            const playerUrls = this.extractPlayerUrls(html);
            for (const playerUrl of playerUrls) {
                const playerStreams = await this.extractFromPlayer(playerUrl);
                streams.push(...playerStreams);
            }
            
            // Method 2: Look for direct video URLs
            const directUrls = this.extractVideoUrls(html);
            for (const videoUrl of directUrls) {
                streams.push(this.createStream({
                    url: videoUrl,
                    quality: this.extractQuality(videoUrl),
                    server: 'Direct',
                    title: `${this.name} - Direct Stream`
                }));
            }
            
            // Method 3: API endpoints for streams
            const slug = this.extractSlugFromUrl(url);
            if (slug) {
                const apiStreams = await this.getStreamsViaAPI(slug, type);
                streams.push(...apiStreams);
            }
            
            return streams;
            
        } catch (error) {
            console.error(`[${this.name}] getStreams error:`, error);
            return [];
        }
    }
    
    async getStreamsViaAPI(slug, type) {
        try {
            const apiUrl = `${this.apiUrl}/${type}/${slug}/streams`;
            const response = await this.makeRequest(apiUrl, {
                headers: { 'Accept': 'application/json' }
            });
            
            if (response.ok) {
                const data = await response.json();
                const streams = [];
                
                if (data.streams) {
                    for (const stream of data.streams) {
                        streams.push(this.createStream({
                            url: stream.url,
                            quality: stream.quality,
                            server: stream.server || 'API',
                            title: `${this.name} - ${stream.quality || 'Unknown'}`
                        }));
                    }
                }
                
                return streams;
            }
            
            return [];
            
        } catch (error) {
            console.error(`[${this.name}] API getStreams error:`, error);
            return [];
        }
    }
    
    extractPlayerUrls(html) {
        const $ = cheerio.load(html);
        const playerUrls = [];
        
        // Look for common player patterns
        $('iframe[src*="player"], iframe[src*="embed"], .player-frame').each((i, element) => {
            const src = $(element).attr('src') || $(element).attr('data-src');
            if (src) {
                playerUrls.push(this.cleanUrl(src));
            }
        });
        
        // Look for JavaScript player initialization
        const scriptMatches = html.match(/player[^"']*["']([^"']+)/gi);
        if (scriptMatches) {
            for (const match of scriptMatches) {
                const urlMatch = match.match(/["']([^"']+)["']/);
                if (urlMatch && urlMatch[1].startsWith('http')) {
                    playerUrls.push(urlMatch[1]);
                }
            }
        }
        
        return [...new Set(playerUrls)];
    }
    
    async extractFromPlayer(playerUrl) {
        try {
            const response = await this.makeRequest(playerUrl, {
                headers: { 'Referer': this.baseUrl }
            });
            
            const html = await response.text();
            const videoUrls = this.extractVideoUrls(html);
            
            return videoUrls.map(url => this.createStream({
                url,
                quality: this.extractQuality(url),
                server: this.extractServerName(playerUrl),
                title: `${this.name} - ${this.extractServerName(playerUrl)}`
            }));
            
        } catch (error) {
            console.error(`[${this.name}] Player extraction error:`, error);
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
    
    generateId(identifier) {
        return `scraped:${this.name.toLowerCase()}:${Buffer.from(identifier.toString()).toString('base64').slice(0, 16)}`;
    }
    
    getUrlFromId(id) {
        try {
            const base64Part = id.split(':')[2];
            const identifier = Buffer.from(base64Part, 'base64').toString();
            
            // If it's already a URL, return it
            if (identifier.startsWith('http')) {
                return identifier;
            }
            
            // Otherwise, construct URL from slug
            return `${this.baseUrl}/movie/${identifier}`; // Default to movie, adjust as needed
            
        } catch (error) {
            return null;
        }
    }
    
    extractSlugFromUrl(url) {
        try {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
            return pathParts[pathParts.length - 1]; // Last part is usually the slug
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
    
    parseMetaFromHTML(html, id, type) {
        const $ = cheerio.load(html);
        
        const title = $('.movie-title, .series-title, h1').first().text().trim();
        const year = this.extractYear($('.year, .release-date').text());
        const poster = this.cleanUrl($('.poster img, .movie-poster img').attr('src'));
        const background = this.cleanUrl($('.backdrop, .background-image').attr('src')) || poster;
        const rating = this.extractRating($('.rating, .imdb-rating').text());
        const description = $('.description, .plot, .overview').text().trim();
        const runtime = this.extractRuntime($('.runtime, .duration').text());
        const genres = this.extractGenres($('.genres, .genre').text());
        
        return this.createMeta({
            id,
            type,
            title,
            year,
            poster,
            background,
            rating,
            description,
            runtime,
            genres
        });
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
}

module.exports = CinemaOSScraper;

