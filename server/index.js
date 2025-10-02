import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

import { NewsCollector } from './services/newsCollector.js';
import { AIProcessor } from './services/aiProcessor.js';
import { MockAIProcessor } from './services/mockAIProcessor.js';
import { DataStorage } from './services/dataStorage.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services
const newsCollector = new NewsCollector();
// Use MockAIProcessor for demonstration (replace with AIProcessor when Gemini API is working)
const aiProcessor = process.env.USE_REAL_AI === 'true' ? new AIProcessor() : new MockAIProcessor();
const dataStorage = new DataStorage();

// Routes

// Get all tickers
app.get('/api/tickers', async (req, res) => {
  try {
    const tickers = await dataStorage.getTickers();
    res.json(tickers);
  } catch (error) {
    console.error('Error fetching tickers:', error);
    res.status(500).json({ error: 'Failed to fetch tickers' });
  }
});

// Add ticker
app.post('/api/tickers', async (req, res) => {
  try {
    const { ticker } = req.body;
    if (!ticker) {
      return res.status(400).json({ error: 'Ticker is required' });
    }
    
    await dataStorage.addTicker(ticker.toUpperCase());
    res.json({ success: true, ticker: ticker.toUpperCase() });
  } catch (error) {
    console.error('Error adding ticker:', error);
    res.status(500).json({ error: 'Failed to add ticker' });
  }
});

// Remove ticker
app.delete('/api/tickers/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    await dataStorage.removeTicker(ticker.toUpperCase());
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing ticker:', error);
    res.status(500).json({ error: 'Failed to remove ticker' });
  }
});

// Get news summaries for a ticker
app.get('/api/summaries/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const summaries = await dataStorage.getSummaries(ticker.toUpperCase());
    res.json(summaries);
  } catch (error) {
    console.error('Error fetching summaries:', error);
    res.status(500).json({ error: 'Failed to fetch summaries' });
  }
});

// Get latest summary for all tickers
app.get('/api/summaries', async (req, res) => {
  try {
    const tickers = await dataStorage.getTickers();
    const allSummaries = {};
    
    for (const ticker of tickers) {
      const summaries = await dataStorage.getSummaries(ticker);
      if (summaries.length > 0) {
        allSummaries[ticker] = summaries[0]; // Latest summary
      }
    }
    
    res.json(allSummaries);
  } catch (error) {
    console.error('Error fetching all summaries:', error);
    res.status(500).json({ error: 'Failed to fetch summaries' });
  }
});

// Manual refresh for a ticker
app.post('/api/refresh/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    await processTickerNews(ticker.toUpperCase());
    res.json({ success: true });
  } catch (error) {
    console.error('Error refreshing ticker:', error);
    res.status(500).json({ error: 'Failed to refresh ticker data' });
  }
});

// Manual refresh for all tickers
app.post('/api/refresh-all', async (req, res) => {
  try {
    await processAllTickers();
    res.json({ success: true });
  } catch (error) {
    console.error('Error refreshing all tickers:', error);
    res.status(500).json({ error: 'Failed to refresh all tickers' });
  }
});

// Main processing function for a single ticker
async function processTickerNews(ticker) {
  try {
    console.log(`Processing news for ${ticker}...`);
    
    // Collect fresh news from all sources
    const newsData = await newsCollector.collectNews(ticker);
    
    if (newsData.length === 0) {
      console.log(`No news found for ${ticker}`);
      return;
    }
    
    console.log(`Collected ${newsData.length} articles for ${ticker}`);
    
    // Get historical data for trend analysis (last 7 days excluding today)
    const historicalSummaries = await dataStorage.getSummaries(ticker, 7);
    console.log(`Found ${historicalSummaries.length} historical summaries for ${ticker}`);
    
    // Process with AI using both current news and historical context
    const selectedArticles = await aiProcessor.selectTopArticles(newsData);
    console.log(`Selected ${selectedArticles.length} top articles for analysis`);
    
    // Generate dynamic summary with historical comparison
    const summary = await aiProcessor.generateSummary(selectedArticles, historicalSummaries);
    
    // Create comprehensive summary data
    const summaryData = {
      summary,
      articles: selectedArticles,
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
      sources: newsData.map(item => ({
        url: item.url,
        headline: item.title,
        source: item.source,
        publishedAt: item.publishedAt
      })),
      meta: {
        totalArticlesFound: newsData.length,
        articlesAnalyzed: selectedArticles.length,
        historicalDaysUsed: historicalSummaries.length,
        processingTime: new Date().toISOString()
      }
    };
    
    // Store the complete summary
    await dataStorage.storeSummary(ticker, summaryData);
    
    console.log(`✅ Successfully processed ${ticker} with ${newsData.length} articles and ${historicalSummaries.length} historical summaries`);
  } catch (error) {
    console.error(`❌ Error processing ${ticker}:`, error);
    throw error;
  }
}

// Process all tickers
async function processAllTickers() {
  try {
    const tickers = await dataStorage.getTickers();
    console.log(`Processing ${tickers.length} tickers...`);
    
    for (const ticker of tickers) {
      await processTickerNews(ticker);
      // Add small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('All tickers processed successfully');
  } catch (error) {
    console.error('Error processing all tickers:', error);
    throw error;
  }
}

// Schedule daily updates at 8 AM IST (2:30 AM UTC)
cron.schedule('30 2 * * *', async () => {
  console.log('Running scheduled news update at 8 AM IST...');
  try {
    await processAllTickers();
  } catch (error) {
    console.error('Scheduled update failed:', error);
  }
}, {
  timezone: "Asia/Kolkata"
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: {
      hasPolygonKey: !!process.env.POLYGON_API_KEY,
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      useRealAI: process.env.USE_REAL_AI === 'true'
    }
  });
});

// Test endpoint for debugging
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Server is working!',
    timestamp: new Date().toISOString() 
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server with better error handling
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📅 Scheduled updates at 8 AM IST (2:30 AM UTC)`);
  console.log(`🔗 API available at: http://localhost:${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    process.exit(1);
  } else {
    console.error('❌ Server startup error:', err);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔄 Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

export default app;