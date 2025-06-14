const fs = require('fs');
const path = require('path');
const config = require('./Config');

/**
 * Logging utility with multiple levels and outputs
 */
class Logger {
    constructor() {
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
        
        this.currentLevel = this.levels[config.get('logging.level')] || this.levels.info;
        this.enableConsole = config.get('logging.enableConsole');
        this.enableFile = config.get('logging.enableFile');
        this.logFile = config.get('logging.logFile');
        
        // Create logs directory if file logging is enabled
        if (this.enableFile) {
            const logDir = path.dirname(this.logFile);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
        }
    }
    
    /**
     * Log an error message
     * @param {string} message - Log message
     * @param {*} data - Additional data to log
     */
    error(message, data = null) {
        this.log('error', message, data);
    }
    
    /**
     * Log a warning message
     * @param {string} message - Log message
     * @param {*} data - Additional data to log
     */
    warn(message, data = null) {
        this.log('warn', message, data);
    }
    
    /**
     * Log an info message
     * @param {string} message - Log message
     * @param {*} data - Additional data to log
     */
    info(message, data = null) {
        this.log('info', message, data);
    }
    
    /**
     * Log a debug message
     * @param {string} message - Log message
     * @param {*} data - Additional data to log
     */
    debug(message, data = null) {
        this.log('debug', message, data);
    }
    
    /**
     * Core logging method
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param {*} data - Additional data to log
     */
    log(level, message, data = null) {
        if (this.levels[level] > this.currentLevel) {
            return; // Skip if level is higher than current level
        }
        
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level: level.toUpperCase(),
            message,
            ...(data && { data })
        };
        
        const logLine = this.formatLogEntry(logEntry);
        
        // Console output
        if (this.enableConsole) {
            this.outputToConsole(level, logLine);
        }
        
        // File output
        if (this.enableFile) {
            this.outputToFile(logLine);
        }
    }
    
    /**
     * Format log entry for output
     * @param {Object} entry - Log entry object
     * @returns {string} Formatted log line
     */
    formatLogEntry(entry) {
        let line = `[${entry.timestamp}] ${entry.level}: ${entry.message}`;
        
        if (entry.data) {
            if (typeof entry.data === 'object') {
                line += ` | ${JSON.stringify(entry.data)}`;
            } else {
                line += ` | ${entry.data}`;
            }
        }
        
        return line;
    }
    
    /**
     * Output to console with appropriate colors
     * @param {string} level - Log level
     * @param {string} line - Formatted log line
     */
    outputToConsole(level, line) {
        const colors = {
            error: '\\x1b[31m', // Red
            warn: '\\x1b[33m',  // Yellow
            info: '\\x1b[36m',  // Cyan
            debug: '\\x1b[37m'  // White
        };
        
        const reset = '\\x1b[0m';
        const coloredLine = `${colors[level] || ''}${line}${reset}`;
        
        if (level === 'error') {
            console.error(coloredLine);
        } else if (level === 'warn') {
            console.warn(coloredLine);
        } else {
            console.log(coloredLine);
        }
    }
    
    /**
     * Output to file
     * @param {string} line - Formatted log line
     */
    outputToFile(line) {
        try {
            fs.appendFileSync(this.logFile, line + '\\n');
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }
    
    /**
     * Create a child logger with a prefix
     * @param {string} prefix - Prefix for all log messages
     * @returns {Object} Child logger
     */
    child(prefix) {
        return {
            error: (message, data) => this.error(`[${prefix}] ${message}`, data),
            warn: (message, data) => this.warn(`[${prefix}] ${message}`, data),
            info: (message, data) => this.info(`[${prefix}] ${message}`, data),
            debug: (message, data) => this.debug(`[${prefix}] ${message}`, data)
        };
    }
}

/**
 * Error handling utilities
 */
class ErrorHandler {
    constructor(logger) {
        this.logger = logger;
        this.errorCounts = new Map();
        this.setupGlobalHandlers();
    }
    
    /**
     * Set up global error handlers
     */
    setupGlobalHandlers() {
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            this.logger.error('Uncaught Exception:', {
                message: error.message,
                stack: error.stack
            });
            
            // Give time for logs to be written
            setTimeout(() => {
                process.exit(1);
            }, 1000);
        });
        
        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            this.logger.error('Unhandled Rejection:', {
                reason: reason instanceof Error ? reason.message : reason,
                stack: reason instanceof Error ? reason.stack : null,
                promise: promise.toString()
            });
        });
        
        // Handle SIGTERM and SIGINT for graceful shutdown
        process.on('SIGTERM', () => {
            this.logger.info('Received SIGTERM, shutting down gracefully');
            this.gracefulShutdown();
        });
        
        process.on('SIGINT', () => {
            this.logger.info('Received SIGINT, shutting down gracefully');
            this.gracefulShutdown();
        });
    }
    
    /**
     * Handle and log errors with context
     * @param {Error} error - Error object
     * @param {string} context - Context where error occurred
     * @param {Object} metadata - Additional metadata
     * @returns {Object} Standardized error response
     */
    handleError(error, context, metadata = {}) {
        const errorKey = `${context}:${error.message}`;
        const count = this.errorCounts.get(errorKey) || 0;
        this.errorCounts.set(errorKey, count + 1);
        
        const errorInfo = {
            message: error.message,
            stack: error.stack,
            context,
            count: count + 1,
            timestamp: new Date().toISOString(),
            ...metadata
        };
        
        this.logger.error(`Error in ${context}:`, errorInfo);
        
        return {
            success: false,
            error: {
                message: error.message,
                context,
                timestamp: errorInfo.timestamp
            }
        };
    }
    
    /**
     * Wrap async function with error handling
     * @param {Function} fn - Async function to wrap
     * @param {string} context - Context for error reporting
     * @returns {Function} Wrapped function
     */
    wrapAsync(fn, context) {
        return async (...args) => {
            try {
                return await fn(...args);
            } catch (error) {
                this.handleError(error, context, { args });
                throw error;
            }
        };
    }
    
    /**
     * Retry function with exponential backoff
     * @param {Function} fn - Function to retry
     * @param {number} maxAttempts - Maximum retry attempts
     * @param {number} baseDelay - Base delay in milliseconds
     * @param {string} context - Context for logging
     * @returns {*} Function result
     */
    async retry(fn, maxAttempts = 3, baseDelay = 1000, context = 'unknown') {
        let lastError;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                
                if (attempt === maxAttempts) {
                    this.logger.error(`Final retry attempt failed for ${context}:`, {
                        attempt,
                        maxAttempts,
                        error: error.message
                    });
                    break;
                }
                
                const delay = baseDelay * Math.pow(2, attempt - 1);
                this.logger.warn(`Retry attempt ${attempt}/${maxAttempts} failed for ${context}, retrying in ${delay}ms:`, {
                    error: error.message
                });
                
                await this.sleep(delay);
            }
        }
        
        throw lastError;
    }
    
    /**
     * Sleep for specified milliseconds
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise} Promise that resolves after delay
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Get error statistics
     * @returns {Object} Error statistics
     */
    getStats() {
        const stats = {
            totalErrors: 0,
            errorsByContext: {},
            topErrors: []
        };
        
        for (const [key, count] of this.errorCounts.entries()) {
            const [context] = key.split(':');
            stats.totalErrors += count;
            stats.errorsByContext[context] = (stats.errorsByContext[context] || 0) + count;
        }
        
        stats.topErrors = Array.from(this.errorCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([key, count]) => ({ error: key, count }));
        
        return stats;
    }
    
    /**
     * Graceful shutdown handler
     */
    gracefulShutdown() {
        this.logger.info('Starting graceful shutdown...');
        
        // Close any open connections, cleanup resources, etc.
        setTimeout(() => {
            this.logger.info('Graceful shutdown completed');
            process.exit(0);
        }, 5000);
    }
}

// Create singleton instances
const logger = new Logger();
const errorHandler = new ErrorHandler(logger);

module.exports = {
    Logger,
    ErrorHandler,
    logger,
    errorHandler
};

