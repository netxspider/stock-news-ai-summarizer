import axios from 'axios';
import * as cheerio from 'cheerio';

export class NewsCollector {
  constructor() {
    this.polygonApiKey = process.env.POLYGON_API_KEY;
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes cache
  }

  async collectNews(ticker) {
    const cacheKey = ticker;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      console.log(`Using cached news for ${ticker}`);
      return cached.data;
    }

    const allNews = [];

    try {
      // Collect from all sources in parallel
      const [tradingViewNews, finvizNews, polygonNews] = await Promise.allSettled([
        this.scrapeTradingView(ticker),
        this.scrapeFinviz(ticker),
        this.fetchPolygonNews(ticker)
      ]);

      if (tradingViewNews.status === 'fulfilled') {
        allNews.push(...tradingViewNews.value);
      } else {
        console.error('TradingView scraping failed:', tradingViewNews.reason);
      }

      if (finvizNews.status === 'fulfilled') {
        allNews.push(...finvizNews.value);
      } else {
        console.error('Finviz scraping failed:', finvizNews.reason);
      }

      if (polygonNews.status === 'fulfilled') {
        allNews.push(...polygonNews.value);
      } else {
        console.error('Polygon API failed:', polygonNews.reason);
      }

      // Additional filtering to ensure ticker relevance
      const tickerLower = ticker.toLowerCase();
      const relevantNews = allNews.filter(article => {
        const titleLower = article.title.toLowerCase();
        const contentLower = (article.content || '').toLowerCase();
        
        return titleLower.includes(tickerLower) ||
               contentLower.includes(tickerLower) ||
               titleLower.includes('earnings') ||
               titleLower.includes('revenue') ||
               titleLower.includes('analyst') ||
               titleLower.includes('price target') ||
               titleLower.includes('upgrade') ||
               titleLower.includes('downgrade');
      });

      const uniqueNews = this.removeDuplicates(relevantNews);
      
      console.log(`${ticker}: Total collected: ${allNews.length}, Relevant: ${relevantNews.length}, Unique: ${uniqueNews.length}`);

      // Cache the results
      this.cache.set(cacheKey, {
        data: uniqueNews,
        timestamp: Date.now()
      });

      return uniqueNews;
      
    } catch (error) {
      console.error(`Error collecting news for ${ticker}:`, error);
      return [];
    }
  }

  async scrapeTradingView(ticker) {
    try {
      const url = `https://in.tradingview.com/symbols/NASDAQ-${ticker}/news/`;
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      };

      const response = await axios.get(url, { 
        headers,
        timeout: 15000,
        validateStatus: status => status < 500
      });

      if (response.status !== 200) {
        console.log(`TradingView returned status ${response.status} for ${ticker}`);
        return [];
      }

      const $ = cheerio.load(response.data);
      const news = [];

      console.log(`TradingView: Extracting news for ${ticker} using enhanced methods...`);
      
      // Method 1: Extract from embedded JSON in scripts
      let foundInScripts = false;
      $('script').each((i, element) => {
        if (news.length >= 15) return false;
        
        const scriptContent = $(element).html();
        if (!scriptContent) return;
        
        try {
          // Look for news data patterns in scripts
          const newsPatterns = [
            /window\.__INITIAL_STATE__\s*=\s*({.+?});/,
            /window\.__PRELOADED_STATE__\s*=\s*({.+?});/,
            /"news":\s*(\[.+?\])/,
            /"articles":\s*(\[.+?\])/,
            /"feed":\s*(\[.+?\])/
          ];
          
          for (const pattern of newsPatterns) {
            const match = scriptContent.match(pattern);
            if (match) {
              try {
                const data = JSON.parse(match[1]);
                const articles = this.extractNewsFromObject(data, ticker);
                if (articles.length > 0) {
                  news.push(...articles);
                  foundInScripts = true;
                  console.log(`TradingView: Found ${articles.length} articles in script data`);
                }
              } catch (e) {
                // Continue to next pattern
              }
            }
          }
          
          // Also look for individual news objects
          const jsonObjects = scriptContent.match(/\{[^{}]*"title"[^{}]*"[^{}]*\}/g);
          if (jsonObjects) {
            jsonObjects.forEach(jsonStr => {
              try {
                const newsObj = JSON.parse(jsonStr);
                if (newsObj.title && this.isRelevantNews(newsObj.title, ticker)) {
                  news.push({
                    title: newsObj.title,
                    url: newsObj.url || newsObj.link || url,
                    source: 'TradingView',
                    provider: newsObj.provider || newsObj.source || 'TradingView',
                    publishedAt: newsObj.published_at || newsObj.publishedAt || new Date().toISOString(),
                    content: newsObj.description || newsObj.title
                  });
                  foundInScripts = true;
                }
              } catch (e) {
                // Invalid JSON, continue
              }
            });
          }
          
        } catch (error) {
          // Continue to next script
        }
      });

      console.log(`TradingView: Script extraction found ${news.length} articles`);
      
      // Method 2: DOM-based extraction if script method didn't work
      if (!foundInScripts || news.length === 0) {
        console.log(`TradingView: Trying DOM-based extraction...`);
        
        // Try to find news feed elements
        const feedSelectors = [
          '[class*="news"] table tr',
          '[class*="feed"] tr',
          'table[class*="table"] tr',
          '.js-news-stream tr',
          'tbody tr'
        ];
        
        for (const selector of feedSelectors) {
          const rows = $(selector);
          if (rows.length > 1) { // Skip header row
            console.log(`TradingView: Found ${rows.length} rows with ${selector}`);
            
            rows.each((i, row) => {
              if (news.length >= 15) return false;
              
              const $row = $(row);
              const cells = $row.find('td');
              
              if (cells.length >= 3) {
                const timeText = $(cells[0]).text().trim();
                const symbolText = $(cells[1]).text().trim();
                const headlineElement = $(cells[2]);
                const providerText = cells.length > 3 ? $(cells[3]).text().trim() : '';
                
                const headline = headlineElement.text().trim();
                const link = headlineElement.find('a').attr('href') || '';
                
                if (this.isValidNewsHeadline(headline, timeText) && 
                    this.isRelevantNews(headline, ticker)) {
                  
                  const article = this.createNewsItem(headline, link, url, timeText, providerText);
                  news.push(article);
                  console.log(`TradingView DOM: ${headline.substring(0, 80)}...`);
                }
              }
            });
            
            if (news.length > 0) break;
          }
        }
      }
      
      // Method 3: Alternative API endpoint (sometimes TradingView exposes JSON endpoints)
      if (news.length === 0) {
        try {
          console.log(`TradingView: Trying alternative news API...`);
          const apiUrl = `https://news-headlines.tradingview.com/headlines/yahoo/symbol/${ticker}`;
          const apiResponse = await axios.get(apiUrl, { 
            headers: this.headers,
            timeout: 10000,
            validateStatus: status => status < 500
          });
          
          if (apiResponse.status === 200 && apiResponse.data) {
            const apiNews = this.parseAlternativeAPI(apiResponse.data, ticker);
            news.push(...apiNews);
            console.log(`TradingView API: Found ${apiNews.length} articles`);
          }
        } catch (error) {
          console.log(`TradingView API failed: ${error.message}`);
        }
      }

      // Multiple strategies to find news content
      let newsFound = news.length > 0;
      
      // Strategy 1: Look for news in the main content area with specific selectors
      const newsSelectors = [
        'table tr:has(td:contains("ago"))',  // Rows with time indicators
        'tr:has(td:contains("minutes ago"))', 
        'tr:has(td:contains("hours ago"))',
        '[class*="row"]:has([class*="time"])',
        '[class*="news-item"]',
        '[data-testid*="news"]'
      ];
      
      for (const selector of newsSelectors) {
        const elements = $(selector);
        console.log(`TradingView: Found ${elements.length} elements with selector: ${selector}`);
        
        if (elements.length > 0) {
          elements.each((i, element) => {
            if (news.length >= 15) return false;
            
            const $element = $(element);
            
            // Try to extract news from this element
            const cells = $element.find('td');
            if (cells.length >= 3) {
              // Table row approach
              const timeText = $(cells[0]).text().trim();
              const symbolText = $(cells[1]).text().trim();
              const headlineElement = $(cells[2]);
              const providerText = cells.length > 3 ? $(cells[3]).text().trim() : '';
              
              let headline = headlineElement.text().trim();
              const link = headlineElement.find('a');
              let articleUrl = link.attr('href') || '';
              
              if (headline && headline.length > 15 && timeText.includes('ago')) {
                console.log(`Found potential news: ${headline.substring(0, 50)}... (${timeText})`);
                
                const isRelevant = this.checkRelevance(headline, ticker, symbolText);
                
                if (isRelevant) {
                  news.push(this.createNewsItem(headline, articleUrl, url, timeText, providerText));
                  newsFound = true;
                }
              }
            } else {
              // Non-table approach - look for news-like content
              const headlineElement = $element.find('a, [class*="title"], [class*="headline"]').first();
              const timeElement = $element.find('[class*="time"], [datetime]').first();
              
              if (headlineElement.length) {
                const headline = headlineElement.text().trim();
                const articleUrl = headlineElement.attr('href') || '';
                const timeText = timeElement.text().trim() || timeElement.attr('datetime') || '';
                
                if (headline && headline.length > 15) {
                  const isRelevant = this.checkRelevance(headline, ticker);
                  
                  if (isRelevant) {
                    news.push(this.createNewsItem(headline, articleUrl, url, timeText));
                    newsFound = true;
                  }
                }
              }
            }
          });
          
          if (newsFound) break;
        }
      }
      
      // Strategy 2: Target specific TradingView news content patterns
      if (!newsFound) {
        console.log(`TradingView: Trying specific news content patterns...`);
        
        // Look for common news headline patterns
        const headlinePatterns = [
          'a[href*="/news/"]',
          '[class*="headline"] a',
          '[class*="title"] a', 
          'td a[href*="news"]',
          'span:contains("ago") + * a',
          'div:contains("Reuters") a',
          'div:contains("Bloomberg") a',
          'div:contains("MarketWatch") a'
        ];
        
        headlinePatterns.forEach(pattern => {
          if (news.length >= 10) return;
          
          $(pattern).each((i, element) => {
            if (news.length >= 10) return false;
            
            const $el = $(element);
            const headline = $el.text().trim();
            const href = $el.attr('href');
            
            // Look for real news headlines (not navigation)
            if (headline && 
                headline.length > 25 && 
                headline.length < 300 &&
                !headline.toLowerCase().includes('tradingview') &&
                !headline.toLowerCase().includes('chart') &&
                !headline.toLowerCase().includes('symbol') &&
                headline.includes(' ')) {
              
              const isRelevant = this.checkRelevance(headline, ticker);
              
              if (isRelevant) {
                // Find associated time element
                const timeElement = $el.closest('tr, div').find(':contains("ago")').first();
                const timeText = timeElement.text().trim();
                
                news.push(this.createNewsItem(headline, href, url, timeText));
                console.log(`TradingView pattern found: ${headline.substring(0, 80)}...`);
                newsFound = true;
              }
            }
          });
        });
      }
      
      // Strategy 3: Look for any text that looks like real news
      if (!newsFound) {
        console.log(`TradingView: Searching for news-like content...`);
        
        $('*').each((i, element) => {
          if (news.length >= 5) return false;
          
          const $el = $(element);
          const text = $el.text().trim();
          
          // Match patterns that look like real news headlines
          const newsPatterns = [
            /\b(says?|reports?|announces?|reveals?)\b/i,
            /\b(earnings?|revenue|profit|loss)\b/i,
            /\b(upgrade|downgrade|target|analyst)\b/i,
            /\b(deal|agreement|merger|acquisition)\b/i,
            /\b(lawsuit|court|legal|rights)\b/i
          ];
          
          const looksLikeNews = newsPatterns.some(pattern => pattern.test(text));
          
          if (looksLikeNews && 
              text.length > 30 && 
              text.length < 200 &&
              !text.toLowerCase().includes('tradingview') &&
              !text.toLowerCase().includes('chart')) {
            
            const isRelevant = this.checkRelevance(text, ticker);
            
            if (isRelevant) {
              const link = $el.find('a').first();
              const articleUrl = link.attr('href') || '';
              
              news.push(this.createNewsItem(text, articleUrl, url));
              console.log(`TradingView news pattern found: ${text.substring(0, 80)}...`);
            }
          }
        });
      }



      console.log(`TradingView: Found ${news.length} articles for ${ticker}`);
      return news;
      
    } catch (error) {
      console.error(`TradingView scraping error for ${ticker}:`, error.message);
      return [];
    }
  }

  checkRelevance(text, ticker, symbolText = '') {
    const textLower = text.toLowerCase();
    const tickerLower = ticker.toLowerCase();
    
    const companyNames = {
      'AAPL': 'apple',
      'MSFT': 'microsoft', 
      'GOOGL': 'google|alphabet',
      'AMZN': 'amazon',
      'TSLA': 'tesla',
      'META': 'meta|facebook',
      'NVDA': 'nvidia'
    };
    
    const companyPattern = companyNames[ticker] || tickerLower;
    const companyRegex = new RegExp(companyPattern, 'i');
    
    return textLower.includes(tickerLower) ||
           companyRegex.test(text) ||
           symbolText.includes(ticker) ||
           textLower.includes('earnings') ||
           textLower.includes('revenue') ||
           textLower.includes('analyst') ||
           textLower.includes('upgrade') ||
           textLower.includes('downgrade');
  }

  createNewsItem(headline, articleUrl, baseUrl, timeText = '', providerText = '') {
    // Build full URL if needed
    if (articleUrl && !articleUrl.startsWith('http')) {
      articleUrl = articleUrl.startsWith('/') ? 
                  `https://in.tradingview.com${articleUrl}` : 
                  `https://in.tradingview.com/${articleUrl}`;
    }

    // Parse time to get approximate publishedAt
    let publishedAt = new Date().toISOString();
    if (timeText.includes('minutes ago')) {
      const minutes = parseInt(timeText.match(/\d+/)[0]);
      publishedAt = new Date(Date.now() - minutes * 60 * 1000).toISOString();
    } else if (timeText.includes('hours ago')) {
      const hours = parseInt(timeText.match(/\d+/)[0]);
      publishedAt = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    }

    return {
      title: headline,
      url: articleUrl || baseUrl,
      source: 'TradingView',
      provider: providerText || 'TradingView',
      publishedAt: publishedAt,
      content: headline,
      timeAgo: timeText
    };
  }

  extractNewsFromObject(data, ticker) {
    const articles = [];
    
    // Recursively search for news articles in the data structure
    const findArticles = (obj, path = '') => {
      if (typeof obj !== 'object' || obj === null) return;
      
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (Array.isArray(value)) {
          // Check if this array contains news articles
          value.forEach((item, index) => {
            if (typeof item === 'object' && item.title) {
              if (this.isRelevantNews(item.title, ticker)) {
                articles.push({
                  title: item.title,
                  url: item.url || item.link || '',
                  source: 'TradingView',
                  provider: item.provider || item.source || 'TradingView',
                  publishedAt: item.published_at || item.publishedAt || item.time || new Date().toISOString(),
                  content: item.description || item.summary || item.title
                });
              }
            } else {
              findArticles(item, `${currentPath}[${index}]`);
            }
          });
        } else if (typeof value === 'object') {
          findArticles(value, currentPath);
        }
      }
    };
    
    findArticles(data);
    return articles;
  }

  isValidNewsHeadline(headline, timeText) {
    return headline && 
           headline.length > 20 && 
           headline.length < 300 &&
           !headline.toLowerCase().includes('more in news flow') &&
           !headline.toLowerCase().includes('time symbol headline') &&
           !headline.toLowerCase().includes('tradingview') &&
           headline.includes(' '); // Must have spaces (not just symbols)
  }

  isRelevantNews(text, ticker) {
    const textLower = text.toLowerCase();
    const tickerLower = ticker.toLowerCase();
    
    const companyNames = {
      'AAPL': 'apple',
      'MSFT': 'microsoft', 
      'GOOGL': 'google|alphabet',
      'AMZN': 'amazon',
      'TSLA': 'tesla',
      'META': 'meta|facebook',
      'NVDA': 'nvidia'
    };
    
    const companyPattern = companyNames[ticker] || tickerLower;
    const companyRegex = new RegExp(companyPattern, 'i');
    
    return textLower.includes(tickerLower) ||
           companyRegex.test(text) ||
           textLower.includes('earnings') ||
           textLower.includes('revenue') ||
           textLower.includes('analyst') ||
           textLower.includes('upgrade') ||
           textLower.includes('downgrade') ||
           textLower.includes('price target');
  }

  parseAlternativeAPI(data, ticker) {
    const articles = [];
    
    try {
      if (data.items && Array.isArray(data.items)) {
        data.items.forEach(item => {
          if (item.title && this.isRelevantNews(item.title, ticker)) {
            articles.push({
              title: item.title,
              url: item.link || '',
              source: 'TradingView',
              provider: item.provider || 'Yahoo Finance',
              publishedAt: item.published_at || new Date().toISOString(),
              content: item.title
            });
          }
        });
      }
    } catch (error) {
      console.log(`Error parsing alternative API data: ${error.message}`);
    }
    
    return articles;
  }

  async scrapeFinviz(ticker) {
    try {
      console.log(`Finviz: Scraping news for ${ticker}...`);
      
      const url = `https://finviz.com/quote.ashx?t=${ticker}&p=d`;
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://finviz.com/',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      };

      const response = await axios.get(url, { 
        headers,
        timeout: 15000,
        validateStatus: status => status < 500
      });

      if (response.status !== 200) {
        console.log(`Finviz returned status ${response.status} for ${ticker}`);
        return [];
      }

      const $ = cheerio.load(response.data);
      const news = [];
      
      // Get company name for better filtering
      const companyName = $('.fullview-title').text().trim();
      console.log(`Finviz: Company name detected: ${companyName}`);

      // Enhanced news table scraping
      const newsTable = $('.fullview-news-outer table, #news-table, table.fullview-news-outer');
      
      if (newsTable.length === 0) {
        console.log('Finviz: No news table found, trying alternative selectors...');
        
        // Try alternative news containers
        const alternativeSelectors = [
          '.news-link-container',
          '.news-link-left',
          '[class*="news"] a',
          'table tr:has(a[href*="news"])'
        ];
        
        for (const selector of alternativeSelectors) {
          const elements = $(selector);
          if (elements.length > 0) {
            console.log(`Finviz: Found ${elements.length} elements with ${selector}`);
            
            elements.each((i, element) => {
              if (news.length >= 15) return false;
              
              const $element = $(element);
              const $link = $element.is('a') ? $element : $element.find('a').first();
              
              if ($link.length) {
                const title = $link.text().trim();
                const href = $link.attr('href');
                
                if (this.isValidFinvizNews(title, href, ticker)) {
                  news.push({
                    title: title,
                    url: href,
                    source: 'Finviz',
                    publishedAt: new Date().toISOString(),
                    content: title
                  });
                  
                  console.log(`Finviz alt: ${title.substring(0, 80)}...`);
                }
              }
            });
            
            if (news.length > 0) break;
          }
        }
      } else {
        // Primary news table processing
        newsTable.find('tr').each((i, element) => {
          if (news.length >= 15) return false;

          const $row = $(element);
          const cells = $row.find('td');

          if (cells.length >= 2) {
            const dateCell = $(cells[0]);
            const newsCell = $(cells[cells.length - 1]); // Last cell contains news

            const dateText = dateCell.text().trim();
            const $link = newsCell.find('a').first();

            if ($link.length) {
              const title = $link.text().trim();
              const href = $link.attr('href');

              if (this.isValidFinvizNews(title, href, ticker)) {
                const publishedAt = this.parseFinvizDate(dateText);
                
                news.push({
                  title: title,
                  url: href,
                  source: 'Finviz',
                  publishedAt: publishedAt,
                  content: title,
                  dateText: dateText
                });
                
                console.log(`Finviz: ${title.substring(0, 80)}... (${dateText})`);
              }
            }
          }
        });
      }

      console.log(`Finviz: Found ${news.length} relevant articles for ${ticker}`);
      return news;
      
    } catch (error) {
      console.error(`Finviz scraping error for ${ticker}:`, error.message);
      return [];
    }
  }

  async fetchPolygonNews(ticker) {
    if (!this.polygonApiKey) {
      console.log('Polygon: API key not configured');
      return [];
    }

    try {
      console.log(`Polygon: Fetching news for ${ticker}...`);
      
      // Enhanced Polygon API call with proper parameters
      const baseUrl = 'https://api.polygon.io/v2/reference/news';
      const params = new URLSearchParams({
        'ticker': ticker,
        'limit': '50', // Get more articles
        'sort': 'published_utc',
        'order': 'desc',
        'apikey': this.polygonApiKey
      });
      
      // Add date range for recent news (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      params.append('published_utc.gte', sevenDaysAgo.toISOString().split('T')[0]);
      
      const url = `${baseUrl}?${params.toString()}`;
      
      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'Authorization': `Bearer ${this.polygonApiKey}`,
          'User-Agent': 'Stock-News-AI-Summarizer/1.0'
        },
        validateStatus: status => status < 500
      });

      console.log(`Polygon: Response status ${response.status}`);

      if (response.status === 401 || response.status === 403) {
        console.error(`Polygon: Authentication failed (${response.status})`);
        console.error('Response:', response.data);
        return [];
      }

      if (response.status !== 200) {
        console.error(`Polygon: API returned status ${response.status}`);
        console.error('Response data:', response.data);
        return [];
      }

      const data = response.data;
      
      if (!data || !data.results || !Array.isArray(data.results)) {
        console.log(`Polygon: No results found for ${ticker}`);
        console.log('Response structure:', Object.keys(data || {}));
        return [];
      }

      // Filter and process articles
      const news = [];
      data.results.forEach(article => {
        if (!article.title) return;
        
        // Check relevance before adding
        if (this.isRelevantNews(article.title, ticker)) {
          news.push({
            title: article.title,
            url: article.article_url || article.amp_url || '',
            source: 'Polygon',
            provider: article.publisher?.name || 'Polygon',
            publishedAt: article.published_utc,
            content: article.description || article.title,
            author: article.author,
            tickers: article.tickers || [ticker]
          });
        }
      });

      console.log(`Polygon: Found ${news.length} relevant articles out of ${data.results.length} total for ${ticker}`);
      return news;
      
    } catch (error) {
      if (error.response) {
        console.error(`Polygon API error for ${ticker}:`);
        console.error(`Status: ${error.response.status}`);
        console.error(`Data:`, error.response.data);
      } else if (error.code === 'ECONNABORTED') {
        console.error(`Polygon API timeout for ${ticker}`);
      } else {
        console.error(`Polygon API error for ${ticker}:`, error.message);
      }
      return [];
    }
  }

  removeDuplicates(articles) {
    const seen = new Set();
    const unique = [];

    for (const article of articles) {
      // Create a fingerprint for deduplication
      const fingerprint = article.title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 50)
        .trim();

      if (fingerprint && !seen.has(fingerprint)) {
        seen.add(fingerprint);
        unique.push(article);
      }
    }

    return unique.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  }

  isValidFinvizNews(title, href, ticker) {
    if (!title || !href || title.length < 10) return false;
    
    // Check if it's a valid news link
    const validNewsLink = href.includes('http') || href.includes('news') || href.includes('reuters') || href.includes('bloomberg');
    
    if (!validNewsLink) return false;
    
    // Check relevance
    return this.isRelevantNews(title, ticker);
  }

  parseFinvizDate(dateText) {
    try {
      // Handle different Finviz date formats
      const formats = [
        /(\w+)-(\d+)-(\d+)/, // Dec-01-24
        /(\d+)\/(\d+)\/(\d+)/, // 12/01/24
        /(\w+)\s+(\d+),?\s+(\d+)/ // Dec 01, 2024
      ];

      for (const format of formats) {
        const match = dateText.match(format);
        if (match) {
          if (format.source.includes('\\w')) {
            // Month name format
            const [, month, day, year] = match;
            const monthMap = {
              'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
              'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
            };
            const fullYear = parseInt(year) < 100 ? 2000 + parseInt(year) : parseInt(year);
            return new Date(fullYear, monthMap[month], parseInt(day)).toISOString();
          } else {
            // Numeric format
            const [, month, day, year] = match;
            const fullYear = parseInt(year) < 100 ? 2000 + parseInt(year) : parseInt(year);
            return new Date(fullYear, parseInt(month) - 1, parseInt(day)).toISOString();
          }
        }
      }
    } catch (e) {
      // Fallback to current date
    }
    
    return new Date().toISOString();
  }
}