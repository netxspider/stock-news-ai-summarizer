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
import { DataStorage } from './services/productionDataStorage.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`, req.query);
  next();
});

// Async error handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Initialize services
const newsCollector = new NewsCollector();
// Use MockAIProcessor for demonstration (replace with AIProcessor when Gemini API is working)
const aiProcessor = process.env.USE_REAL_AI === 'true' ? new AIProcessor() : new MockAIProcessor();
const dataStorage = new DataStorage();

// Initialize data storage
console.log('Initializing data storage...');
dataStorage.init().then(() => {
  console.log('Data storage initialized successfully');
}).catch(error => {
  console.error('Failed to initialize data storage:', error);
});

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

// Add ticker with immediate news scraping
app.post('/api/tickers', async (req, res) => {
  try {
    const { ticker } = req.body;
    if (!ticker) {
      return res.status(400).json({ error: 'Ticker is required' });
    }
    
    const upperTicker = ticker.toUpperCase();
    
    // Add ticker to database
    await dataStorage.addTicker(upperTicker);
    
    // Immediately collect and return raw news data (Step 1)
    console.log(`� Collecting news for new ticker: ${upperTicker}`);
    const newsData = await newsCollector.collectNews(upperTicker);
    
    if (newsData.length > 0) {
      // Store a preliminary summary with just raw news data
      const preliminarySummary = {
        ticker: upperTicker,
        summary: null, // Will be populated by AI processing
        articles: newsData.slice(0, 20),
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        sources: newsData.map(item => ({
          url: item.url,
          headline: item.title,
          source: item.source,
          provider: item.provider,
          publishedAt: item.publishedAt,
          timeAgo: item.timeAgo
        })),
        isProcessing: true, // Flag to indicate AI processing is pending
        meta: {
          totalArticlesFound: newsData.length,
          articlesAnalyzed: 0,
          processingStatus: 'collecting_news'
        }
      };
      
      await dataStorage.storeSummary(upperTicker, preliminarySummary);
      
      // Start AI processing in background (Step 2)
      processAISummary(upperTicker, newsData).catch(error => {
        console.error(`❌ AI processing failed for ${upperTicker}:`, error);
      });
      
      res.json({ 
        success: true, 
        ticker: upperTicker,
        message: 'News collected, AI processing started',
        data: preliminarySummary
      });
    } else {
      res.json({ 
        success: true, 
        ticker: upperTicker,
        message: 'Ticker added but no news found'
      });
    }
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

// Get processing status for a ticker
app.get('/api/status/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const summaries = await dataStorage.getSummaries(ticker.toUpperCase());
    
    if (summaries.length > 0) {
      const summary = summaries[0];
      res.json({
        ticker: ticker.toUpperCase(),
        isProcessing: summary.isProcessing || false,
        status: summary.meta?.processingStatus || 'unknown',
        articlesFound: summary.meta?.totalArticlesFound || 0,
        lastUpdated: summary.timestamp
      });
    } else {
      res.json({
        ticker: ticker.toUpperCase(),
        isProcessing: false,
        status: 'not_found',
        articlesFound: 0,
        lastUpdated: null
      });
    }
  } catch (error) {
    console.error('Error fetching processing status:', error);
    res.status(500).json({ error: 'Failed to fetch processing status' });
  }
});

// Manual refresh for a ticker with progressive loading
app.post('/api/refresh/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const upperTicker = ticker.toUpperCase();
    
    // Immediately collect and return raw news data
    console.log(`📰 Refreshing news for ticker: ${upperTicker}`);
    const newsData = await newsCollector.collectNews(upperTicker);
    
    if (newsData.length > 0) {
      // Store preliminary data first
      const preliminarySummary = {
        ticker: upperTicker,
        summary: null,
        articles: newsData.slice(0, 20),
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        sources: newsData.map(item => ({
          url: item.url,
          headline: item.title,
          source: item.source,
          provider: item.provider,
          publishedAt: item.publishedAt,
          timeAgo: item.timeAgo
        })),
        isProcessing: true,
        meta: {
          totalArticlesFound: newsData.length,
          articlesAnalyzed: 0,
          processingStatus: 'refreshing_news'
        }
      };
      
      await dataStorage.storeSummary(upperTicker, preliminarySummary);
      
      // Start AI processing in background
      processAISummary(upperTicker, newsData).catch(error => {
        console.error(`❌ AI processing failed for ${upperTicker}:`, error);
      });
    }
    
    res.json({ success: true, message: 'News refresh started' });
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

// Progressive AI processing function (Step 2: AI Analysis)
async function processAISummary(ticker, newsData) {
  try {
    console.log(`🤖 Starting AI processing for ${ticker}...`);
    
    // Store current news in history for future comparisons
    await dataStorage.storeNewsHistory(ticker, newsData);
    
    // Get 7-day historical news for comparison
    const historicalNews = await dataStorage.getNewsHistory(ticker, 7);
    console.log(`📅 Found ${historicalNews.length} historical articles for ${ticker} (7 days)`);
    
    // Process with enhanced AI using current news and 7-day historical context
    const selectedArticles = newsData.slice(0, 20); // Take top 20 for analysis
    console.log(`🎯 Selected ${selectedArticles.length} articles for AI analysis`);
    
    // Update status to show AI processing
    const existingSummary = await dataStorage.getSummaries(ticker);
    if (existingSummary.length > 0) {
      existingSummary[0].meta.processingStatus = 'generating_ai_summary';
      await dataStorage.storeSummary(ticker, existingSummary[0]);
    }
    
    // Generate enhanced summary with "What Changed Today" analysis
    const summary = await aiProcessor.generateSummary(ticker, selectedArticles, historicalNews);
    
    // Create final enhanced summary data with AI analysis
    const finalSummaryData = {
      ticker,
      summary,
      articles: selectedArticles,
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
      sources: newsData.map(item => ({
        url: item.url,
        headline: item.title,
        source: item.source,
        provider: item.provider,
        publishedAt: item.publishedAt,
        timeAgo: item.timeAgo
      })),
      isProcessing: false, // AI processing complete
      meta: {
        totalArticlesFound: newsData.length,
        articlesAnalyzed: selectedArticles.length,
        historicalArticlesUsed: historicalNews.length,
        daysOfHistoryAnalyzed: 7,
        processingTime: new Date().toISOString(),
        processingStatus: 'complete',
        enhancedFeatures: {
          tradingViewScraping: true,
          finvizEnhanced: true,
          polygonAPI: true,
          geminiAnalysis: true,
          historicalComparison: true
        }
      }
    };
    
    // Store the final enhanced summary
    await dataStorage.storeSummary(ticker, finalSummaryData);
    
    console.log(`✅ AI processing completed for ${ticker}:`);
    console.log(`   📊 ${newsData.length} articles found, ${selectedArticles.length} analyzed`);
    console.log(`   📅 ${historicalNews.length} historical articles used for comparison`);
    console.log(`   🤖 AI summary generated with "What Changed Today" analysis`);
  } catch (error) {
    console.error(`❌ Error in AI processing for ${ticker}:`, error);
    
    // Update error state
    const existingSummary = await dataStorage.getSummaries(ticker);
    if (existingSummary.length > 0) {
      existingSummary[0].isProcessing = false;
      existingSummary[0].meta.processingStatus = 'error';
      existingSummary[0].meta.error = error.message;
      await dataStorage.storeSummary(ticker, existingSummary[0]);
    }
    
    throw error;
  }
}

// Enhanced processing function for a single ticker with 7-day history (legacy support)
async function processTickerNews(ticker) {
  try {
    console.log(`🔄 Processing enhanced news for ${ticker}...`);
    
    // Collect fresh news from all enhanced sources
    const newsData = await newsCollector.collectNews(ticker);
    
    if (newsData.length === 0) {
      console.log(`⚠️ No news found for ${ticker}`);
      return;
    }
    
    console.log(`📰 Collected ${newsData.length} articles for ${ticker} from enhanced sources`);
    
    // Use the new progressive approach
    await processAISummary(ticker, newsData);
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
app.get('/api/health', async (req, res) => {
  try {
    const storageStats = await dataStorage.getStorageStats();
    const tickers = await dataStorage.getTickers();
    
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: {
        hasPolygonKey: !!process.env.POLYGON_API_KEY,
        hasGeminiKey: !!process.env.GEMINI_API_KEY,
        useRealAI: process.env.USE_REAL_AI === 'true',
        nodeEnv: process.env.NODE_ENV,
        isVercel: !!process.env.VERCEL
      },
      data: {
        tickersCount: tickers.length,
        tickers: tickers,
        ...storageStats
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
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