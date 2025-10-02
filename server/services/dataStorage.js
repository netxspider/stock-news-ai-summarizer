import fs from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class DataStorage {
  constructor() {
    this.dataDir = join(__dirname, '../../data');
    this.tickersFile = join(this.dataDir, 'tickers.json');
    this.summariesDir = join(this.dataDir, 'summaries');
    this.newsHistoryDir = join(this.dataDir, 'news-history');
    this.maxHistoryDays = 7;
    this.init();
  }

  async init() {
    try {
      // Create directories if they don't exist
      await fs.mkdir(this.dataDir, { recursive: true });
      await fs.mkdir(this.summariesDir, { recursive: true });
      await fs.mkdir(this.newsHistoryDir, { recursive: true });
      
      // Initialize tickers file if it doesn't exist
      try {
        await fs.access(this.tickersFile);
      } catch (error) {
        await fs.writeFile(this.tickersFile, JSON.stringify([], null, 2));
      }
    } catch (error) {
      console.error('Error initializing data storage:', error);
    }
  }

  async getTickers() {
    try {
      const data = await fs.readFile(this.tickersFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading tickers:', error);
      return []; // Start with no tickers by default
    }
  }

  async addTicker(ticker) {
    try {
      const tickers = await this.getTickers();
      const upperTicker = ticker.toUpperCase();
      
      if (!tickers.includes(upperTicker)) {
        tickers.push(upperTicker);
        await fs.writeFile(this.tickersFile, JSON.stringify(tickers, null, 2));
      }
    } catch (error) {
      console.error('Error adding ticker:', error);
      throw error;
    }
  }

  async removeTicker(ticker) {
    try {
      const tickers = await this.getTickers();
      const upperTicker = ticker.toUpperCase();
      const index = tickers.indexOf(upperTicker);
      
      if (index > -1) {
        tickers.splice(index, 1);
        await fs.writeFile(this.tickersFile, JSON.stringify(tickers, null, 2));
      }
    } catch (error) {
      console.error('Error removing ticker:', error);
      throw error;
    }
  }

  async storeSummary(ticker, summaryData) {
    try {
      const tickerFile = join(this.summariesDir, `${ticker}.json`);
      let summaries = [];
      
      // Read existing summaries
      try {
        const data = await fs.readFile(tickerFile, 'utf-8');
        summaries = JSON.parse(data);
      } catch (error) {
        // File doesn't exist, start with empty array
      }
      
      // Add new summary at the beginning
      summaries.unshift({
        ...summaryData,
        id: Date.now(),
        date: new Date().toISOString().split('T')[0]
      });
      
      // Keep only last 7 days
      summaries = summaries.slice(0, 7);
      
      await fs.writeFile(tickerFile, JSON.stringify(summaries, null, 2));
    } catch (error) {
      console.error('Error storing summary:', error);
      throw error;
    }
  }

  async getSummaries(ticker, days = 7) {
    try {
      const tickerFile = join(this.summariesDir, `${ticker}.json`);
      const data = await fs.readFile(tickerFile, 'utf-8');
      const summaries = JSON.parse(data);
      
      return summaries.slice(0, days);
    } catch (error) {
      // Return empty array if file doesn't exist
      return [];
    }
  }

  async getAllSummaries() {
    try {
      const tickers = await this.getTickers();
      const allSummaries = {};
      
      for (const ticker of tickers) {
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

  async cleanupOldData() {
    try {
      const tickers = await this.getTickers();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      for (const ticker of tickers) {
        const summaries = await this.getSummaries(ticker, 100); // Get all
        const recentSummaries = summaries.filter(summary => {
          const summaryDate = new Date(summary.timestamp);
          return summaryDate > sevenDaysAgo;
        });
        
        if (recentSummaries.length !== summaries.length) {
          const tickerFile = join(this.summariesDir, `${ticker}.json`);
          await fs.writeFile(tickerFile, JSON.stringify(recentSummaries, null, 2));
        }
      }
    } catch (error) {
      console.error('Error cleaning up old data:', error);
    }
  }

  async storeNewsHistory(ticker, articles) {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const historyFile = join(this.newsHistoryDir, `${ticker.toLowerCase()}-${today}.json`);
      
      const historyData = {
        ticker,
        date: today,
        timestamp: new Date().toISOString(),
        articles: articles.map(article => ({
          ...article,
          storedAt: new Date().toISOString()
        })),
        totalArticles: articles.length
      };

      await fs.writeFile(historyFile, JSON.stringify(historyData, null, 2));
      console.log(`Stored ${articles.length} articles for ${ticker} history on ${today}`);

      // Clean up old history files (keep only last 7 days)
      await this.cleanOldHistory(ticker);
      
      return true;
    } catch (error) {
      console.error(`Error storing news history for ${ticker}:`, error);
      return false;
    }
  }

  async getNewsHistory(ticker, days = 7) {
    try {
      const historicalArticles = [];
      const today = new Date();
      
      for (let i = 1; i <= days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const historyFile = join(this.newsHistoryDir, `${ticker.toLowerCase()}-${dateStr}.json`);
        
        try {
          const data = await fs.readFile(historyFile, 'utf8');
          const historyData = JSON.parse(data);
          
          if (historyData.articles && Array.isArray(historyData.articles)) {
            historicalArticles.push(...historyData.articles.map(article => ({
              ...article,
              historyDate: dateStr,
              daysAgo: i
            })));
          }
        } catch (fileError) {
          // File doesn't exist for this date, continue
          console.log(`No history file found for ${ticker} on ${dateStr}`);
        }
      }

      console.log(`Retrieved ${historicalArticles.length} historical articles for ${ticker} (${days} days)`);
      return historicalArticles;
      
    } catch (error) {
      console.error(`Error retrieving news history for ${ticker}:`, error);
      return [];
    }
  }

  async cleanOldHistory(ticker) {
    try {
      const files = await fs.readdir(this.newsHistoryDir);
      const tickerFiles = files.filter(file => file.startsWith(`${ticker.toLowerCase()}-`));
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.maxHistoryDays);
      
      for (const file of tickerFiles) {
        const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          const fileDate = new Date(dateMatch[1]);
          if (fileDate < cutoffDate) {
            await fs.unlink(join(this.newsHistoryDir, file));
            console.log(`Cleaned old history file: ${file}`);
          }
        }
      }
    } catch (error) {
      console.error(`Error cleaning old history for ${ticker}:`, error);
    }
  }

  async getStorageStats() {
    try {
      const summaryFiles = await fs.readdir(this.summariesDir);
      const historyFiles = await fs.readdir(this.newsHistoryDir);
      
      return {
        summaryCount: summaryFiles.length,
        historyCount: historyFiles.length,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting storage stats:', error);
      return { summaryCount: 0, historyCount: 0, lastUpdated: null };
    }
  }
}