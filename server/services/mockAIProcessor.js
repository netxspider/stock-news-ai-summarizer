// Mock AI Processor for demonstration - replace with real Gemini when API is working

export class MockAIProcessor {
  constructor() {
    this.requestCount = 0;
    this.lastRequestTime = Date.now();
    this.maxRequestsPerMinute = 15;
  }

  async rateLimit() {
    const now = Date.now();
    if (now - this.lastRequestTime < 60000) {
      if (this.requestCount >= this.maxRequestsPerMinute) {
        const waitTime = 60000 - (now - this.lastRequestTime);
        console.log(`Rate limit reached, waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        this.requestCount = 0;
        this.lastRequestTime = Date.now();
      }
    } else {
      this.requestCount = 0;
      this.lastRequestTime = now;
    }
    this.requestCount++;
  }

  async selectTopArticles(articles) {
    if (articles.length === 0) {
      return [];
    }

    if (articles.length <= 7) {
      return articles;
    }

    // Mock intelligent selection - prioritize by source and recency
    const prioritizedArticles = articles
      .sort((a, b) => {
        const sourceOrder = { 'Polygon': 3, 'Finviz': 2, 'TradingView': 1 };
        const sourceScore = (sourceOrder[b.source] || 0) - (sourceOrder[a.source] || 0);
        if (sourceScore !== 0) return sourceScore;
        
        // If same source priority, sort by recency
        return new Date(b.publishedAt) - new Date(a.publishedAt);
      })
      .slice(0, 6);

    console.log(`Mock AI: Selected ${prioritizedArticles.length} articles from ${articles.length} total`);
    return prioritizedArticles;
  }

  async generateSummary(ticker, articles, historicalSummaries = []) {
    if (!Array.isArray(articles) || articles.length === 0) {
      return {
        summary: `No recent news available for ${ticker} analysis.`,
        whatChangedToday: 'No significant changes detected.',
        keyPoints: [],
        sentiment: 'neutral',
        marketImpact: 'minimal'
      };
    }

    await this.rateLimit();

    // Generate a mock summary based on available articles
    const sources = [...new Set(articles.map(a => a.source))];
    const headlines = articles.map(a => a.title);
    
    // Analyze sentiment based on keywords
    const text = articles.map(a => a.title + ' ' + (a.content || '')).join(' ').toLowerCase();
    let sentiment = 'neutral';
    let marketImpact = 'medium';
    
    // Simple sentiment analysis
    const positiveWords = ['up', 'rise', 'gain', 'growth', 'profit', 'beats', 'strong', 'positive', 'bull', 'surge', 'boost'];
    const negativeWords = ['down', 'fall', 'loss', 'decline', 'drops', 'weak', 'negative', 'bear', 'crash', 'plunge', 'tumble'];
    
    const positiveCount = positiveWords.reduce((count, word) => count + (text.includes(word) ? 1 : 0), 0);
    const negativeCount = negativeWords.reduce((count, word) => count + (text.includes(word) ? 1 : 0), 0);
    
    if (positiveCount > negativeCount + 1) {
      sentiment = 'positive';
    } else if (negativeCount > positiveCount + 1) {
      sentiment = 'negative';
    } else if (positiveCount > 0 && negativeCount > 0) {
      sentiment = 'mixed';
    }

    // Determine market impact
    const impactWords = ['earnings', 'revenue', 'acquisition', 'merger', 'lawsuit', 'regulation', 'breakthrough', 'partnership', 'launch'];
    const hasImpactWords = impactWords.some(word => text.includes(word));
    
    if (hasImpactWords || articles.length > 6) {
      marketImpact = 'high';
    } else if (articles.length > 3) {
      marketImpact = 'medium';
    } else {
      marketImpact = 'low';
    }

    // Analyze historical trends if available
    let historicalAnalysis = '';
    let sentimentTrend = 'stable';
    
    if (historicalSummaries.length > 0) {
      const recentSummaries = historicalSummaries.slice(0, 3); // Last 3 days
      const historicalSentiments = recentSummaries
        .map(s => s.summary?.sentiment || s.sentiment)
        .filter(Boolean);
      
      const historicalImpacts = recentSummaries
        .map(s => s.summary?.marketImpact || s.marketImpact)
        .filter(Boolean);

      // Determine sentiment trend
      if (historicalSentiments.length > 0) {
        const lastSentiment = historicalSentiments[0];
        if (sentiment !== lastSentiment) {
          sentimentTrend = sentiment === 'positive' ? 'improving' : 
                          sentiment === 'negative' ? 'declining' : 'shifting';
        }
      }

      historicalAnalysis = `Historical comparison shows ${sentimentTrend} sentiment trend with ` +
        `${historicalSentiments.length} previous sessions analyzed. `;
    }

    const currentDate = new Date().toLocaleDateString();
    
    const summary = `${currentDate} ${ticker} Analysis: Comprehensive review of ${articles.length} key developments from ${sources.join(', ')}. ` +
      `Current market sentiment for ${ticker} reflects ${sentiment} outlook driven by ${headlines.length > 3 ? 'multiple' : 'select'} business developments. ` +
      `Analysis indicates ${marketImpact} market impact potential based on news significance and coverage volume. ` +
      `${historicalAnalysis}Key focus areas include operational updates, strategic initiatives, and market positioning changes affecting ${ticker} investor sentiment.`;

    let whatChangedToday = '';
    
    if (historicalSummaries.length > 0) {
      const recentSummary = historicalSummaries[0];
      const lastSentiment = recentSummary.summary?.sentiment || recentSummary.sentiment || 'unknown';
      const lastImpact = recentSummary.summary?.marketImpact || recentSummary.marketImpact || 'unknown';
      
      whatChangedToday = `Significant shift from yesterday's ${lastSentiment} sentiment to today's ${sentiment} outlook. ` +
        `Market impact assessment changed from ${lastImpact} to ${marketImpact}. ` +
        `New developments include ${articles.length} fresh stories with ${sources.length} different source perspectives. ` +
        `${sentimentTrend === 'stable' ? 'Sentiment remains consistent' : `Trend is ${sentimentTrend}`} compared to recent sessions. ` +
        `Key change drivers: ${headlines.slice(0, 2).map(h => h.substring(0, 50) + '...').join('; ')}.`;
    } else {
      whatChangedToday = `Today marks initial analysis with ${articles.length} breaking developments from ${sources.join(', ')}. ` +
        `Current sentiment establishes ${sentiment} baseline with ${marketImpact} market impact potential. ` +
        `Emerging themes focus on ${headlines.slice(0, 2).map(h => h.substring(0, 40)).join(' and ')}.`;
    }

    const keyPoints = [
      `${articles.length} news stories analyzed with ${sentiment} sentiment`,
      `Market impact assessed as ${marketImpact} based on content analysis`,
      `Primary sources: ${sources.join(', ')}`,
      ...headlines.slice(0, 2).map(headline => {
        return headline.length > 80 ? headline.substring(0, 77) + '...' : headline;
      })
    ].slice(0, 5);

    return {
      summary,
      whatChangedToday,
      keyPoints,
      sentiment,
      marketImpact
    };
  }
}