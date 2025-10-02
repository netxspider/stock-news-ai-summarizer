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
    this.init();
  }

  async init() {
    try {
      // Create directories if they don't exist
      await fs.mkdir(this.dataDir, { recursive: true });
      await fs.mkdir(this.summariesDir, { recursive: true });
      
      // Initialize tickers file if it doesn't exist
      try {
        await fs.access(this.tickersFile);
      } catch (error) {
        await fs.writeFile(this.tickersFile, JSON.stringify(['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'], null, 2));
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
      return ['AAPL', 'MSFT', 'GOOGL']; // Default tickers
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
}