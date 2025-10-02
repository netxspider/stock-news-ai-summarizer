import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import { NewsCollector } from '../server/services/newsCollector.js';
import { AIProcessor } from '../server/services/aiProcessor.js';
import { MockAIProcessor } from '../server/services/mockAIProcessor.js';
import { DataStorage } from '../server/services/productionDataStorage.js';

dotenv.config();

const app = express();

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
app.get('/tickers', asyncHandler(async (req, res) => {
  const tickers = await dataStorage.getTickers();
  res.json(tickers);
}));

// Get latest summary for all tickers
app.get('/summaries', asyncHandler(async (req, res) => {
  const tickers = await dataStorage.getTickers();
  const allSummaries = {};
  
  for (const ticker of tickers) {
    const summaries = await dataStorage.getSummaries(ticker);
    if (summaries.length > 0) {
      allSummaries[ticker] = summaries[0]; // Latest summary
    }
  }
  
  res.json(allSummaries);
}));

// Health check endpoint
app.get('/health', asyncHandler(async (req, res) => {
  const storageStats = await dataStorage.getStorageStats();
  const tickers = await dataStorage.getTickers();
  
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
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
}));

// Add ticker with immediate news scraping
app.post('/tickers', asyncHandler(async (req, res) => {
  const { ticker } = req.body;
  if (!ticker) {
    return res.status(400).json({ error: 'Ticker is required' });
  }
  
  const upperTicker = ticker.toUpperCase();
  
  // Add ticker to database
  await dataStorage.addTicker(upperTicker);
  
  // For now, just return success - news processing can be added later
  res.json({ 
    success: true, 
    ticker: upperTicker,
    message: 'Ticker added successfully'
  });
}));

// Remove ticker
app.delete('/tickers/:ticker', asyncHandler(async (req, res) => {
  const { ticker } = req.params;
  await dataStorage.removeTicker(ticker.toUpperCase());
  res.json({ success: true });
}));

// Get news summaries for a ticker
app.get('/summaries/:ticker', asyncHandler(async (req, res) => {
  const { ticker } = req.params;
  const summaries = await dataStorage.getSummaries(ticker.toUpperCase());
  res.json(summaries);
}));

// Manual refresh for a ticker (simplified for now)
app.post('/refresh/:ticker', asyncHandler(async (req, res) => {
  const { ticker } = req.params;
  // For now, just return success - actual refresh logic can be added later
  res.json({ success: true, message: `Refresh initiated for ${ticker}` });
}));

// Manual refresh for all tickers
app.post('/refresh-all', asyncHandler(async (req, res) => {
  res.json({ success: true, message: 'Refresh initiated for all tickers' });
}));

// Get processing status for a ticker
app.get('/status/:ticker', asyncHandler(async (req, res) => {
  const { ticker } = req.params;
  const summaries = await dataStorage.getSummaries(ticker.toUpperCase());
  
  if (summaries.length > 0) {
    const summary = summaries[0];
    res.json({
      ticker: ticker.toUpperCase(),
      isProcessing: summary.isProcessing || false,
      status: summary.meta?.processingStatus || 'complete',
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
}));

// Test endpoint for debugging
app.get('/test', asyncHandler(async (req, res) => {
  const tickers = await dataStorage.getTickers();
  const summaries = await dataStorage.getAllSummaries();
  
  res.json({ 
    message: 'API is working!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    isVercel: !!process.env.VERCEL,
    hasEnvVars: {
      gemini: !!process.env.GEMINI_API_KEY,
      polygon: !!process.env.POLYGON_API_KEY,
      useRealAI: process.env.USE_REAL_AI
    },
    dataStatus: {
      tickerCount: tickers.length,
      summaryKeys: Object.keys(summaries),
      availableTickers: tickers
    }
  });
}));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('API error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// For Vercel serverless functions
export default app;