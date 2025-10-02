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
    
    // Auto-process default tickers that don't have summaries
    await autoProcessDefaultTickers();
    
    initialized = true;
  }
};

// Auto-process default tickers that don't have data
const autoProcessDefaultTickers = async () => {
  try {
    const tickers = await dataStorage.getTickers();
    console.log(`🔄 Checking ${tickers.length} tickers for auto-processing...`);
    
    for (const ticker of tickers) {
      const summaries = await dataStorage.getSummaries(ticker);
      
      // If ticker has no summary or is very old (>1 day), process it
      const needsProcessing = summaries.length === 0 || 
        (summaries[0] && new Date() - new Date(summaries[0].timestamp) > 24 * 60 * 60 * 1000);
      
      if (needsProcessing) {
        console.log(`📰 Auto-processing default ticker: ${ticker}`);
        // Process in background without waiting
        processTickerNewsAsync(ticker).catch(error => {
          console.error(`❌ Auto-processing failed for ${ticker}:`, error);
        });
      } else {
        console.log(`✅ Ticker ${ticker} already has recent data`);
      }
    }
  } catch (error) {
    console.error('❌ Error in auto-processing default tickers:', error);
  }
};

// Progressive AI processing function (async - doesn't block response)
const processAISummaryAsync = async (ticker, newsData) => {
  try {
    console.log(`🤖 Starting AI processing for ${ticker}...`);
    
    // Store current news in history for future comparisons
    await dataStorage.storeNewsHistory(ticker, newsData);
    
    // Get 7-day historical news for comparison
    const historicalNews = await dataStorage.getNewsHistory(ticker, 7);
    console.log(`📅 Found ${historicalNews.length} historical articles for ${ticker} (7 days)`);
    
    // Process with AI using current news and 7-day historical context
    const selectedArticles = newsData.slice(0, 20);
    console.log(`🎯 Selected ${selectedArticles.length} articles for AI analysis`);
    
    // Update status to show AI processing
    const existingSummary = await dataStorage.getSummaries(ticker);
    if (existingSummary.length > 0) {
      existingSummary[0].meta.processingStatus = 'generating_ai_summary';
      await dataStorage.storeSummary(ticker, existingSummary[0]);
    }
    
    // Generate AI summary
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
  }
};

// Process ticker news (async wrapper)
const processTickerNewsAsync = async (ticker) => {
  try {
    console.log(`🔄 Processing enhanced news for ${ticker}...`);
    
    const newsData = await newsCollector.collectNews(ticker);
    
    if (newsData.length === 0) {
      console.log(`⚠️ No news found for ${ticker}`);
      return;
    }
    
    console.log(`📰 Collected ${newsData.length} articles for ${ticker} from enhanced sources`);
    
    // Use the progressive approach
    await processAISummaryAsync(ticker, newsData);
  } catch (error) {
    console.error(`❌ Error processing ${ticker}:`, error);
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
    
    const { method, url } = req;
    
    // Parse the URL to get the path
    const urlObj = new URL(url, 'https://example.com');
    let path = urlObj.pathname;
    
    // Remove /api prefix if present
    if (path.startsWith('/api')) {
      path = path.substring(4);
    }
    
    // Ensure path starts with /
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
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
        } else {
          // If no summary exists, trigger background processing
          console.log(`📰 No summary found for ${ticker}, triggering background processing...`);
          processTickerNewsAsync(ticker).catch(error => {
            console.error(`❌ Background processing failed for ${ticker}:`, error);
          });
          
          // Return placeholder data indicating processing
          allSummaries[ticker] = {
            ticker: ticker,
            summary: null,
            articles: [],
            timestamp: new Date().toISOString(),
            date: new Date().toISOString().split('T')[0],
            sources: [],
            isProcessing: true,
            meta: {
              totalArticlesFound: 0,
              articlesAnalyzed: 0,
              processingStatus: 'initializing'
            }
          };
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

    // Initialize default tickers endpoint
    if (method === 'POST' && path === '/init-defaults') {
      try {
        const tickers = await dataStorage.getTickers();
        console.log(`🚀 Manually initializing ${tickers.length} default tickers...`);
        
        // Process each ticker in background
        for (const ticker of tickers) {
          processTickerNewsAsync(ticker).catch(error => {
            console.error(`❌ Initialization failed for ${ticker}:`, error);
          });
        }
        
        return res.json({ 
          success: true, 
          message: `Initialization started for ${tickers.length} tickers`,
          tickers: tickers
        });
      } catch (error) {
        console.error('Error initializing default tickers:', error);
        return res.status(500).json({ error: 'Failed to initialize default tickers' });
      }
    }

    if (method === 'POST' && path === '/tickers') {
      const { ticker } = req.body;
      if (!ticker) {
        return res.status(400).json({ error: 'Ticker is required' });
      }
      
      const upperTicker = ticker.toUpperCase();
      
      // Add ticker to database
      await dataStorage.addTicker(upperTicker);
      
      // Immediately collect news data
      console.log(`📰 Collecting news for new ticker: ${upperTicker}`);
      try {
        const newsData = await newsCollector.collectNews(upperTicker);
        
        if (newsData.length > 0) {
          // Store preliminary data first (progressive loading)
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
              processingStatus: 'collecting_news'
            }
          };
          
          await dataStorage.storeSummary(upperTicker, preliminarySummary);
          
          // Start AI processing in background (but don't wait for it)
          processAISummaryAsync(upperTicker, newsData).catch(error => {
            console.error(`❌ AI processing failed for ${upperTicker}:`, error);
          });
          
          return res.json({ 
            success: true, 
            ticker: upperTicker,
            message: 'News collected, AI processing started',
            data: preliminarySummary
          });
        } else {
          return res.json({ 
            success: true, 
            ticker: upperTicker,
            message: 'Ticker added but no news found'
          });
        }
      } catch (error) {
        console.error(`Error collecting news for ${upperTicker}:`, error);
        return res.json({ 
          success: true, 
          ticker: upperTicker,
          message: 'Ticker added, news collection failed'
        });
      }
    }

    // Handle ticker refresh
    if (method === 'POST' && path.startsWith('/refresh/')) {
      const ticker = path.replace('/refresh/', '').toUpperCase();
      
      try {
        console.log(`📰 Refreshing news for ticker: ${ticker}`);
        const newsData = await newsCollector.collectNews(ticker);
        
        if (newsData.length > 0) {
          const preliminarySummary = {
            ticker: ticker,
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
          
          await dataStorage.storeSummary(ticker, preliminarySummary);
          
          // Start AI processing
          processAISummaryAsync(ticker, newsData).catch(error => {
            console.error(`❌ AI processing failed for ${ticker}:`, error);
          });
        }
        
        return res.json({ success: true, message: 'News refresh started' });
      } catch (error) {
        console.error(`Error refreshing ${ticker}:`, error);
        return res.status(500).json({ error: 'Failed to refresh ticker data' });
      }
    }

    // Handle refresh all
    if (method === 'POST' && path === '/refresh-all') {
      try {
        const tickers = await dataStorage.getTickers();
        console.log(`Processing ${tickers.length} tickers...`);
        
        // Process each ticker (but don't wait for completion)
        for (const ticker of tickers) {
          processTickerNewsAsync(ticker).catch(error => {
            console.error(`❌ Background processing failed for ${ticker}:`, error);
          });
        }
        
        return res.json({ success: true, message: 'Refresh initiated for all tickers' });
      } catch (error) {
        console.error('Error refreshing all tickers:', error);
        return res.status(500).json({ error: 'Failed to refresh all tickers' });
      }
    }

    // Get processing status for a ticker
    if (method === 'GET' && path.startsWith('/status/')) {
      const ticker = path.replace('/status/', '').toUpperCase();
      const summaries = await dataStorage.getSummaries(ticker);
      
      if (summaries.length > 0) {
        const summary = summaries[0];
        return res.json({
          ticker: ticker,
          isProcessing: summary.isProcessing || false,
          status: summary.meta?.processingStatus || 'complete',
          articlesFound: summary.meta?.totalArticlesFound || 0,
          lastUpdated: summary.timestamp
        });
      } else {
        return res.json({
          ticker: ticker,
          isProcessing: false,
          status: 'not_found',
          articlesFound: 0,
          lastUpdated: null
        });
      }
    }

    // Get summaries for a specific ticker
    if (method === 'GET' && path.startsWith('/summaries/')) {
      const ticker = path.replace('/summaries/', '').toUpperCase();
      const summaries = await dataStorage.getSummaries(ticker);
      return res.json(summaries);
    }

    // Delete a ticker
    if (method === 'DELETE' && path.startsWith('/tickers/')) {
      const ticker = path.replace('/tickers/', '').toUpperCase();
      
      try {
        await dataStorage.removeTicker(ticker);
        await dataStorage.removeSummary(ticker);
        
        return res.json({ 
          success: true, 
          message: `Ticker ${ticker} removed successfully`
        });
      } catch (error) {
        console.error(`Error removing ticker ${ticker}:`, error);
        return res.status(500).json({ 
          error: 'Failed to remove ticker',
          message: error.message
        });
      }
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