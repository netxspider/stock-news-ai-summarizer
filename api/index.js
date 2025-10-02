import { NewsCollector } from '../server/services/newsCollector.js';
import { AIProcessor } from '../server/services/aiProcessor.js';
import { MockAIProcessor } from '../server/services/mockAIProcessor.js';
import { DataStorage } from '../server/services/productionDataStorage.js';

// Initialize services globally
const newsCollector = new NewsCollector();
const aiProcessor = process.env.USE_REAL_AI === 'true' ? new AIProcessor() : new MockAIProcessor();
const dataStorage = new DataStorage();

// Initialize data storage
let initialized = false;
const initializeStorage = async () => {
  if (!initialized) {
    console.log('Initializing data storage...');
    await dataStorage.init();
    console.log('Data storage initialized successfully');
    initialized = true;
  }
};

// Main serverless function handler
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    await initializeStorage();
    
    const { url, method } = req;
    const path = url.replace('/api', '');
    
    console.log(`${new Date().toISOString()} ${method} ${path}`);
    
    // Route handling
    if (method === 'GET' && path === '/health') {
      const storageStats = await dataStorage.getStorageStats();
      const tickers = await dataStorage.getTickers();
      
      return res.json({ 
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
    }
    
    if (method === 'GET' && path === '/tickers') {
      const tickers = await dataStorage.getTickers();
      return res.json(tickers);
    }
    
    if (method === 'GET' && path === '/summaries') {
      const tickers = await dataStorage.getTickers();
      const allSummaries = {};
      
      for (const ticker of tickers) {
        const summaries = await dataStorage.getSummaries(ticker);
        if (summaries.length > 0) {
          allSummaries[ticker] = summaries[0];
        }
      }
      
      return res.json(allSummaries);
    }

    
    if (method === 'GET' && path === '/test') {
      const tickers = await dataStorage.getTickers();
      const summaries = await dataStorage.getAllSummaries();
      
      return res.json({ 
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
    }

    if (method === 'POST' && path === '/tickers') {
      const { ticker } = req.body;
      if (!ticker) {
        return res.status(400).json({ error: 'Ticker is required' });
      }
      
      const upperTicker = ticker.toUpperCase();
      await dataStorage.addTicker(upperTicker);
      
      return res.json({ 
        success: true, 
        ticker: upperTicker,
        message: 'Ticker added successfully'
      });
    }

    // Handle other routes...
    return res.status(404).json({ 
      error: 'Not Found',
      path: path,
      message: `Route ${method} ${path} not found`
    });
    
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}