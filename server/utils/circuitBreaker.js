// server/utils/circuitBreaker.js
const { createLogger } = require('./logger');
const logger = createLogger('circuit-breaker');

/**
 * Circuit Breaker Pattern Implementation
 * Helps prevent cascading failures and provides fallback mechanisms
 */
class CircuitBreaker {
  /**
   * Constructor
   * @param {Function} fn - The function to wrap with circuit breaker
   * @param {Object} options - Configuration options
   */
  constructor(fn, options = {}) {
    this.fn = fn;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
    
    // Default options
    this.options = {
      failureThreshold: options.failureThreshold || 5,
      resetTimeout: options.resetTimeout || 30000, // ms
      halfOpenSuccessThreshold: options.halfOpenSuccessThreshold || 2,
      monitorInterval: options.monitorInterval || 10000, // ms
      fallbackFunction: options.fallbackFunction || null
    };
    
    logger.info('Circuit breaker initialized');
    
    // Start monitoring if enabled
    if (this.options.monitorInterval > 0) {
      this.startMonitoring();
    }
  }
  
  /**
   * Start monitoring the circuit breaker state
   */
  startMonitoring() {
    this.monitorInterval = setInterval(() => {
      if (this.state === 'OPEN' && Date.now() > this.nextAttempt) {
        logger.info('Circuit transitioning from OPEN to HALF_OPEN');
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      }
    }, this.options.monitorInterval);
  }
  
  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }
  }
  
  /**
   * Fire event - track circuit state changes
   * @param {string} event - Event name
   */
  fireEvent(event) {
    switch(event) {
      case 'SUCCESS':
        this.onSuccess();
        break;
      case 'FAILURE':
        this.onFailure();
        break;
      default:
        break;
    }
  }
  
  /**
   * Handle successful calls
   */
  onSuccess() {
    this.failureCount = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      
      if (this.successCount >= this.options.halfOpenSuccessThreshold) {
        logger.info('Circuit transitioning from HALF_OPEN to CLOSED');
        this.state = 'CLOSED';
        this.successCount = 0;
      }
    }
  }
  
  /**
   * Handle failed calls
   */
  onFailure() {
    this.failureCount++;
    
    if ((this.state === 'CLOSED' && this.failureCount >= this.options.failureThreshold) ||
        this.state === 'HALF_OPEN') {
      logger.warn(`Circuit OPEN after ${this.failureCount} failures`);
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.options.resetTimeout;
    }
  }
  
  /**
   * Call the wrapped function with circuit breaker logic
   * @param {...any} args - Arguments to pass to the wrapped function
   * @returns {Promise} - Promise resolving to the function result
   */
  async call(...args) {
    if (this.state === 'OPEN') {
      if (Date.now() > this.nextAttempt) {
        this.state = 'HALF_OPEN';
        logger.info('Circuit transitioning from OPEN to HALF_OPEN');
      } else {
        logger.warn('Circuit OPEN, using fallback');
        if (this.options.fallbackFunction) {
          return this.options.fallbackFunction(...args);
        }
        throw new Error('Circuit is OPEN and no fallback provided');
      }
    }
    
    try {
      const result = await this.fn(...args);
      this.fireEvent('SUCCESS');
      return result;
    } catch (error) {
      this.fireEvent('FAILURE');
      logger.error(`Circuit breaker caught error: ${error.message}`);
      
      if (this.options.fallbackFunction) {
        logger.info('Using fallback function');
        return this.options.fallbackFunction(...args);
      }
      
      throw error;
    }
  }
  
  /**
   * Call the wrapped function and return its result
   * Allows the circuit breaker to be called like a function
   */
  async exec(...args) {
    return this.call(...args);
  }
}

module.exports = { CircuitBreaker };
