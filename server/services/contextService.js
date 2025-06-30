// server/services/contextService.js
const fs = require('fs').promises;
const path = require('path');
const nlp = require('natural');
const tokenizer = new nlp.WordTokenizer();
const stopwords = ['và', 'hoặc', 'trong', 'là', 'có', 'để', 'với', 'các', 'the', 'and', 'or', 'in', 'is', 'has', 'to', 'with'];
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const axios = require('axios');
const FormData = require('form-data');
const os = require('os');
const crypto = require('crypto');

// Simple similarity comparator implementation (replaces vector-db-lite)
class SimilarityComparator {
  findMostSimilar(query, texts) {
    let bestMatch = null;
    let bestScore = 0;
    
    const queryTokens = this.tokenize(query.toLowerCase());
    
    for (const text of texts) {
      const textTokens = this.tokenize(text.toLowerCase());
      const score = this.calculateSimilarity(queryTokens, textTokens);
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = { text, score };
      }
    }
    
    return bestMatch;
  }
  
  tokenize(text) {
    return tokenizer.tokenize(text)
      .filter(token => token.length > 2 && !stopwords.includes(token));
  }
  
  calculateSimilarity(tokens1, tokens2) {
    if (tokens1.length === 0 || tokens2.length === 0) return 0;
    
    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size; // Jaccard similarity
  }
}

let vectorDB = null;
const EMBEDDING_SERVICE_URL = process.env.EMBEDDING_SERVICE_URL || 'http://embeddings:5003';

/**
 * Service to handle context data for enhanced translation
 */
const contextService = {
  /**
   * Extract text from uploaded documents
   */
  extractTextFromDocument: async (filePath) => {
    try {
      const ext = path.extname(filePath).toLowerCase();
      let text = '';
      
      if (ext === '.txt') {
        text = await fs.readFile(filePath, 'utf-8');
      } else if (ext === '.pdf') {
        // Use pdftotext if available
        try {
          const { stdout } = await exec(`pdftotext "${filePath}" -`);
          text = stdout;
        } catch (error) {
          console.log('PDF extraction failed, trying alternative method');
          text = await fs.readFile(filePath, 'utf-8');
        }
      } else {
        text = await fs.readFile(filePath, 'utf-8');
      }
      
      return text.trim();
    } catch (error) {
      console.error('Error extracting text:', error);
      return '';
    }
  },

  /**
   * Save context data to cache
   */
  saveContextToCache: async (sessionId, context) => {
    try {
      const cacheDir = path.join(__dirname, '../../embeddings-cache');
      await fs.mkdir(cacheDir, { recursive: true });
      
      const cacheFile = path.join(cacheDir, `${sessionId}.json`);
      await fs.writeFile(cacheFile, JSON.stringify(context, null, 2));
      
      console.log(`Context saved for session: ${sessionId}`);
    } catch (error) {
      console.error('Error saving context:', error);
    }
  },

  /**
   * Load context data from cache
   */
  loadContextFromCache: async (sessionId) => {
    try {
      const cacheFile = path.join(__dirname, '../../embeddings-cache', `${sessionId}.json`);
      const data = await fs.readFile(cacheFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  },

  /**
   * Process context for translation enhancement
   */
  processContext: async (text, sessionId) => {
    try {
      // Generate a hash for the text to use as identifier
      const textHash = crypto.createHash('md5').update(text).digest('hex');
      
      const context = {
        id: textHash,
        sessionId,
        text,
        timestamp: new Date().toISOString(),
        summary: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
        keywords: contextService.extractKeywords(text)
      };
      
      await contextService.saveContextToCache(sessionId, context);
      return context;
    } catch (error) {
      console.error('Error processing context:', error);
      return null;
    }
  },

  /**
   * Extract keywords from text
   */
  extractKeywords: (text) => {
    try {
      const tokens = tokenizer.tokenize(text.toLowerCase());
      const filtered = tokens.filter(token => 
        token.length > 3 && 
        !stopwords.includes(token) &&
        /^[a-zA-Záàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵ]+$/.test(token)
      );
      
      // Count frequency and return top keywords
      const frequency = {};
      filtered.forEach(token => {
        frequency[token] = (frequency[token] || 0) + 1;
      });
      
      return Object.keys(frequency)
        .sort((a, b) => frequency[b] - frequency[a])
        .slice(0, 10);
    } catch (error) {
      console.error('Error extracting keywords:', error);
      return [];
    }
  },

  /**
   * Find similar passage in context using embedding service
   */
  findSimilarPassage: async (query, context) => {
    try {
      // Try to use embedding service first
      const response = await axios.post(`${EMBEDDING_SERVICE_URL}/find-similar`, {
        query,
        text: context.text
      }, { timeout: 5000 });
      
      return {
        ...context,
        similarPassage: response.data.similar
      };
    } catch (error) {
      console.log('Embedding service error:', error.message);
      // Fallback to simpler similarity search
      return contextService.findSimilarPassageFallback(query, context);
    }
  },

  /**
   * Fallback similarity search using basic text comparison
   */
  findSimilarPassageFallback: (query, context) => {
    // Initialize vector DB if not exists
    if (!vectorDB) {
      vectorDB = new SimilarityComparator();
    }
    
    // Split context text into paragraphs
    const paragraphs = context.text.split(/\n\s*\n/);
    
    // Find most similar paragraph
    const similar = vectorDB.findMostSimilar(query, paragraphs);
    
    if (similar && similar.score > 0.3) {
      return {
        ...context,
        similarPassage: similar.text.substring(0, 500)
      };
    }
    
    return context;
  },

  /**
   * Get enhanced translation with context
   */
  getEnhancedTranslation: async (text, targetLang, sessionId) => {
    try {
      const context = await contextService.loadContextFromCache(sessionId);
      
      if (context) {
        const enhancedContext = await contextService.findSimilarPassage(text, context);
        return {
          text,
          context: enhancedContext.similarPassage,
          keywords: enhancedContext.keywords
        };
      }
      
      return { text };
    } catch (error) {
      console.error('Error getting enhanced translation:', error);
      return { text };
    }
  }
};

module.exports = contextService;
