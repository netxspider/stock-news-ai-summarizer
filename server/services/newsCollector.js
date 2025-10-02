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

      console.log(`TradingView: Extracting news articles for ${ticker}...`);
      
      // Multiple strategies to find news content
      let newsFound = false;
      
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

  async scrapeFinviz(ticker) {
    try {
      const url = `https://finviz.com/quote.ashx?t=${ticker}&p=d`;
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://finviz.com/',
      };

      const response = await axios.get(url, { 
        headers,
        timeout: 10000,
        validateStatus: status => status < 500
      });

      if (response.status !== 200) {
        console.log(`Finviz returned status ${response.status} for ${ticker}`);
        return [];
      }

      const $ = cheerio.load(response.data);
      const news = [];
      
      // Get company name for filtering relevance
      const companyName = $('.fullview-title').text().trim();
      const tickerLower = ticker.toLowerCase();

      // Look for news table
      $('.fullview-news-outer table tr').each((i, element) => {
        if (news.length >= 10) return false;

        const $row = $(element);
        const dateCell = $row.find('td').first();
        const newsCell = $row.find('td').last();

        if (dateCell.length && newsCell.length && dateCell.get(0) !== newsCell.get(0)) {
          const dateText = dateCell.text().trim();
          const $link = newsCell.find('a');

          if ($link.length) {
            const title = $link.text().trim();
            const href = $link.attr('href');

            if (title && title.length > 10 && href) {
              // Check relevance to ticker
              const titleLower = title.toLowerCase();
              
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
              
              const isRelevant = titleLower.includes(tickerLower) ||
                                companyRegex.test(title) ||
                                titleLower.includes('earnings') ||
                                titleLower.includes('revenue') ||
                                titleLower.includes('analyst') ||
                                titleLower.includes('price target') ||
                                titleLower.includes('upgrade') ||
                                titleLower.includes('downgrade');

              if (isRelevant) {
                // Parse date
                let publishedAt;
                try {
                  const dateMatch = dateText.match(/(\w+)-(\d+)-(\d+)/);
                  if (dateMatch) {
                    const [, month, day, year] = dateMatch;
                    const monthMap = {
                      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
                      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
                    };
                    publishedAt = new Date(2000 + parseInt(year), monthMap[month], parseInt(day)).toISOString();
                  } else {
                    publishedAt = new Date().toISOString();
                  }
                } catch (e) {
                  publishedAt = new Date().toISOString();
                }

                news.push({
                  title: title,
                  url: href,
                  source: 'Finviz',
                  publishedAt: publishedAt,
                  content: title
                });
                
                console.log(`Finviz found: ${title.substring(0, 80)}...`);
              }
            }
          }
        }
      });

      console.log(`Finviz: Found ${news.length} articles for ${ticker}`);
      return news;
      
    } catch (error) {
      console.error(`Finviz scraping error for ${ticker}:`, error.message);
      return [];
    }
  }

  async fetchPolygonNews(ticker) {
    if (!this.polygonApiKey) {
      console.log('Polygon API key not available');
      return [];
    }

    try {
      const url = `https://api.polygon.io/v2/reference/news?ticker=${ticker}&limit=20&apikey=${this.polygonApiKey}`;
      
      const response = await axios.get(url, {
        timeout: 10000,
        validateStatus: status => status < 500
      });

      if (response.status === 401) {
        console.error(`Polygon API error for ${ticker}: Request failed with status code 401`);
        console.error(`Response status: ${response.status}`);
        console.error(`Response data:`, response.data);
        return [];
      }

      if (response.status !== 200) {
        console.error(`Polygon API returned status ${response.status} for ${ticker}`);
        return [];
      }

      const data = response.data;
      
      if (!data || !data.results || !Array.isArray(data.results)) {
        console.log(`No news results from Polygon API for ${ticker}`);
        return [];
      }

      const news = data.results.map(article => ({
        title: article.title,
        url: article.article_url,
        source: 'Polygon',
        publishedAt: article.published_utc,
        content: article.description || article.title
      }));

      console.log(`Polygon: Found ${news.length} articles for ${ticker}`);
      return news;
      
    } catch (error) {
      if (error.response) {
        console.error(`Polygon API error for ${ticker}: ${error.message}`);
        console.error(`Response status: ${error.response.status}`);
        console.error(`Response data:`, error.response.data);
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
}