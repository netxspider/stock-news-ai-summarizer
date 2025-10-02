import fs from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class ProductionDataStorage {
  constructor() {
    // In-memory storage for production (Vercel functions are stateless)
    this.memoryStorage = {
      tickers: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA'],
      summaries: {},
      newsHistory: {}
    };
    
    this.isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
    console.log(`DataStorage initialized for ${this.isProduction ? 'production' : 'development'} environment`);
  }

  async init() {
    if (this.isProduction) {
      console.log('Production mode: Using in-memory storage');
      return;
    }

    // Development mode: Use file-based storage
    try {
      this.dataDir = join(__dirname, '../../data');
      this.tickersFile = join(this.dataDir, 'tickers.json');
      this.summariesDir = join(this.dataDir, 'summaries');
      this.newsHistoryDir = join(this.dataDir, 'news-history');
      
      // Create directories if they don't exist
      await fs.mkdir(this.dataDir, { recursive: true });
      await fs.mkdir(this.summariesDir, { recursive: true });
      await fs.mkdir(this.newsHistoryDir, { recursive: true });
      
      // Initialize tickers file if it doesn't exist
      try {
        await fs.access(this.tickersFile);
        const data = await fs.readFile(this.tickersFile, 'utf-8');
        this.memoryStorage.tickers = JSON.parse(data);
      } catch (error) {
        await fs.writeFile(this.tickersFile, JSON.stringify(this.memoryStorage.tickers, null, 2));
      }
      
      console.log('Development mode: File-based storage initialized');
    } catch (error) {
      console.error('Error initializing data storage:', error);
    }
  }

  async getTickers() {
    try {
      return this.memoryStorage.tickers;
    } catch (error) {
      console.error('Error reading tickers:', error);
      return ['AAPL', 'MSFT', 'GOOGL']; // Fallback
    }
  }

  async addTicker(ticker) {
    try {
      const upperTicker = ticker.toUpperCase();
      
      if (!this.memoryStorage.tickers.includes(upperTicker)) {
        this.memoryStorage.tickers.push(upperTicker);
        
        // In development, also save to file
        if (!this.isProduction) {
          await fs.writeFile(this.tickersFile, JSON.stringify(this.memoryStorage.tickers, null, 2));
        }
      }
      
      console.log(`Added ticker ${upperTicker}, total tickers:`, this.memoryStorage.tickers.length);
    } catch (error) {
      console.error('Error adding ticker:', error);
      throw error;
    }
  }

  async removeTicker(ticker) {
    try {
      const upperTicker = ticker.toUpperCase();
      const index = this.memoryStorage.tickers.indexOf(upperTicker);
      
      if (index > -1) {
        this.memoryStorage.tickers.splice(index, 1);
        delete this.memoryStorage.summaries[upperTicker];
        
        // In development, also save to file
        if (!this.isProduction) {
          await fs.writeFile(this.tickersFile, JSON.stringify(this.memoryStorage.tickers, null, 2));
        }
      }
      
      console.log(`Removed ticker ${upperTicker}, total tickers:`, this.memoryStorage.tickers.length);
    } catch (error) {
      console.error('Error removing ticker:', error);
      throw error;
    }
  }

  async storeSummary(ticker, summaryData) {
    try {
      const upperTicker = ticker.toUpperCase();
      
      if (!this.memoryStorage.summaries[upperTicker]) {
        this.memoryStorage.summaries[upperTicker] = [];
      }
      
      // Add new summary at the beginning
      this.memoryStorage.summaries[upperTicker].unshift({
        ...summaryData,
        id: Date.now(),
        date: new Date().toISOString().split('T')[0]
      });
      
      // Keep only last 7 summaries
      this.memoryStorage.summaries[upperTicker] = this.memoryStorage.summaries[upperTicker].slice(0, 7);
      
      // In development, also save to file
      if (!this.isProduction) {
        const tickerFile = join(this.summariesDir, `${upperTicker}.json`);
        await fs.writeFile(tickerFile, JSON.stringify(this.memoryStorage.summaries[upperTicker], null, 2));
      }
      
      console.log(`Stored summary for ${upperTicker}, processing status:`, summaryData.isProcessing ? 'in-progress' : 'complete');
    } catch (error) {
      console.error('Error storing summary:', error);
      throw error;
    }
  }

  async getSummaries(ticker, days = 7) {
    try {
      const upperTicker = ticker.toUpperCase();
      const summaries = this.memoryStorage.summaries[upperTicker] || [];
      
      return summaries.slice(0, days);
    } catch (error) {
      console.error('Error getting summaries:', error);
      return [];
    }
  }

  async getAllSummaries() {
    try {
      const allSummaries = {};
      
      for (const ticker of this.memoryStorage.tickers) {
        const summaries = await this.getSummaries(ticker, 1);
        if (summaries.length > 0) {
          allSummaries[ticker] = summaries[0];
        }
      }
      
      return allSummaries;
    } catch (error) {
      console.error('Error getting all summaries:', error);
      return {};
    }
  }

  async storeNewsHistory(ticker, articles) {
    try {
      const upperTicker = ticker.toUpperCase();
      const today = new Date().toISOString().split('T')[0];
      
      if (!this.memoryStorage.newsHistory[upperTicker]) {
        this.memoryStorage.newsHistory[upperTicker] = {};
      }
      
      this.memoryStorage.newsHistory[upperTicker][today] = {
        ticker: upperTicker,
        date: today,
        timestamp: new Date().toISOString(),
        articles: articles.map(article => ({
          ...article,
          storedAt: new Date().toISOString()
        })),
        totalArticles: articles.length
      };
      
      console.log(`Stored ${articles.length} articles for ${upperTicker} history on ${today}`);
      
      // Clean up old history (keep only last 7 days)
      this.cleanOldHistoryFromMemory(upperTicker);
      
      return true;
    } catch (error) {
      console.error(`Error storing news history for ${ticker}:`, error);
      return false;
    }
  }

  async getNewsHistory(ticker, days = 7) {
    try {
      const upperTicker = ticker.toUpperCase();
      const historicalArticles = [];
      const today = new Date();
      
      const tickerHistory = this.memoryStorage.newsHistory[upperTicker] || {};
      
      for (let i = 1; i <= days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayHistory = tickerHistory[dateStr];
        if (dayHistory && dayHistory.articles) {
          historicalArticles.push(...dayHistory.articles.map(article => ({
            ...article,
            historyDate: dateStr,
            daysAgo: i
          })));
        }
      }

      console.log(`Retrieved ${historicalArticles.length} historical articles for ${upperTicker} (${days} days)`);
      return historicalArticles;
      
    } catch (error) {
      console.error(`Error retrieving news history for ${ticker}:`, error);
      return [];
    }
  }

  cleanOldHistoryFromMemory(ticker) {
    try {
      const upperTicker = ticker.toUpperCase();
      const tickerHistory = this.memoryStorage.newsHistory[upperTicker] || {};
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7);
      
      Object.keys(tickerHistory).forEach(dateKey => {
        const date = new Date(dateKey);
        if (date < cutoffDate) {
          delete tickerHistory[dateKey];
        }
      });
    } catch (error) {
      console.error(`Error cleaning old history for ${ticker}:`, error);
    }
  }

  async cleanupOldData() {
    // Clean up old data from memory
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      for (const ticker of this.memoryStorage.tickers) {
        const summaries = this.memoryStorage.summaries[ticker] || [];
        const recentSummaries = summaries.filter(summary => {
          const summaryDate = new Date(summary.timestamp);
          return summaryDate > sevenDaysAgo;
        });
        
        this.memoryStorage.summaries[ticker] = recentSummaries;
        this.cleanOldHistoryFromMemory(ticker);
      }
    } catch (error) {
      console.error('Error cleaning up old data:', error);
    }
  }

  async getStorageStats() {
    try {
      const summaryCount = Object.keys(this.memoryStorage.summaries).length;
      const historyCount = Object.keys(this.memoryStorage.newsHistory).length;
      
      return {
        summaryCount,
        historyCount,
        lastUpdated: new Date().toISOString(),
        environment: this.isProduction ? 'production' : 'development',
        tickersCount: this.memoryStorage.tickers.length
      };
    } catch (error) {
      console.error('Error getting storage stats:', error);
      return { 
        summaryCount: 0, 
        historyCount: 0, 
        lastUpdated: null,
        environment: 'unknown',
        tickersCount: 0
      };
    }
  }
}

// For backward compatibility, export as DataStorage
export { ProductionDataStorage as DataStorage };