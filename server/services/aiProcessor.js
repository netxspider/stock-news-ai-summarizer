import { GoogleGenerativeAI } from '@google/generative-ai';

export class AIProcessor {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Use the working gemini-2.5-flash model from your curl command
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    });
    this.requestCount = 0;
    this.lastRequestTime = Date.now();
    this.maxRequestsPerMinute = 15; // Conservative rate limiting
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

    try {
      await this.rateLimit();

      const articlesText = articles.map((article, index) => 
        `${index + 1}. Title: ${article.title}
Source: ${article.source}
Published: ${article.publishedAt}
Content: ${article.content || 'No content available'}
URL: ${article.url}
---`
      ).join('\n');

      const prompt = `As a financial news analyst, select the top 5-7 most relevant and credible articles from the following list for stock market analysis. Consider:

1. Credibility of source (Polygon > Finviz > TradingView for reliability)
2. Recency of publication
3. Content relevance to stock performance
4. Market impact potential
5. Avoid duplicate information

Articles:
${articlesText}

Respond with ONLY a JSON array of the article numbers you selected (e.g., [1, 3, 5, 7, 9]). No explanation needed.`;

      console.log(`🤖 Making Gemini request for article selection (${articles.length} articles)`);
      
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();

      console.log(`\n🟢 GEMINI ARTICLE SELECTION RESPONSE:`);
      console.log('─'.repeat(60));
      console.log(`📊 Response: "${text}"`);
      console.log('─'.repeat(60));

      // Parse the response to get selected indices
      let selectedIndices;
      try {
        // Try to extract JSON array from the response
        const jsonMatch = text.match(/\[[\d\s,]+\]/);
        if (jsonMatch) {
          selectedIndices = JSON.parse(jsonMatch[0]);
        } else {
          // Fallback: extract numbers from text
          selectedIndices = text.match(/\d+/g)?.map(Number) || [];
        }
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
        // Fallback: return first 6 articles
        return articles.slice(0, 6);
      }

      // Convert to 0-based indices and filter valid ones
      const selectedArticles = selectedIndices
        .map(num => num - 1) // Convert to 0-based
        .filter(index => index >= 0 && index < articles.length)
        .slice(0, 7) // Ensure max 7 articles
        .map(index => articles[index]);

      console.log(`✅ Selected ${selectedArticles.length} articles from ${articles.length} total via Gemini`);
      console.log(`📋 Selected articles:`, selectedArticles.map((a, i) => `${i+1}. ${a.title.substring(0, 60)}...`));
      console.log('═'.repeat(60));
      
      return selectedArticles.length > 0 ? selectedArticles : articles.slice(0, 6);

    } catch (error) {
      console.error('🚨 ERROR in Gemini article selection:', error);
      console.log(`🔄 Falling back to manual selection`);
      // Fallback: return first 6 articles sorted by source credibility
      const prioritizedArticles = articles
        .sort((a, b) => {
          const sourceOrder = { 'Polygon': 3, 'Finviz': 2, 'TradingView': 1 };
          return (sourceOrder[b.source] || 0) - (sourceOrder[a.source] || 0);
        })
        .slice(0, 6);
      
      return prioritizedArticles;
    }
  }

  async generateSummary(ticker, articles, historicalData = null) {
    if (!articles || articles.length === 0) {
      return {
        summary: `No recent news available for ${ticker}. Please check back later for the latest updates.`,
        keyPoints: [],
        sentiment: 'neutral',
        articlesAnalyzed: 0,
        whatChangedToday: 'No recent news to analyze changes.'
      };
    }

    try {
      await this.rateLimit();
      
      // Prepare current articles for analysis
      const articlesToAnalyze = articles.slice(0, 25); // Increased limit for better analysis
      const todayArticlesText = articlesToAnalyze.map((article, index) => 
        `${index + 1}. "${article.title}"
   Source: ${article.source}${article.provider ? ` (${article.provider})` : ''}
   Published: ${new Date(article.publishedAt).toLocaleDateString()}
   Content: ${(article.content || article.title).substring(0, 200)}...`
      ).join('\n\n');

      // Prepare historical context if available
      let historicalContext = '';
      if (historicalData && historicalData.length > 0) {
        const historicalArticles = historicalData.slice(0, 15);
        historicalContext = `\n\nFOR COMPARISON - Historical News (Past 7 days):
${historicalArticles.map((article, index) => 
  `${index + 1}. "${article.title}" (${new Date(article.publishedAt).toLocaleDateString()})`
).join('\n')}`;
      }

      const prompt = `As a senior financial analyst, analyze today's news about ${ticker}.

TODAY'S NEWS:
${todayArticlesText}${historicalContext}

Provide comprehensive analysis in exactly this JSON format:

{
  "summary": "Detailed 3-4 paragraph daily summary covering all key developments and their implications",
  "keyPoints": ["Point 1", "Point 2", "Point 3", "Point 4", "Point 5"],
  "sentiment": "positive/negative/neutral",
  "sentimentReasoning": "Brief explanation",
  "whatChangedToday": "Comprehensive analysis of new developments and changes",
  "marketImplications": "Detailed potential stock impact assessment",
  "marketImpact": "high/medium/low",
  "confidence": "high/medium/low"
}

IMPORTANT: 
- Provide complete, comprehensive analysis
- Return ONLY valid JSON with no truncation
- No markdown formatting, just the JSON object
- Ensure all JSON fields are properly closed`;

      this.requestCount++;
      console.log(`🤖 Making enhanced Gemini API request for ${ticker} (${this.requestCount}/${this.maxRequestsPerMinute})`);
      console.log(`📝 Request details: ${articlesToAnalyze.length} articles, ${historicalData ? historicalData.length : 0} historical`);
      
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      let text = response.text();

      console.log(`\n🟢 GEMINI RESPONSE FOR ${ticker}:`);
      console.log('─'.repeat(80));
      console.log(`📊 Response length: ${text.length} characters`);
      console.log(`🔤 Raw response:\n${text}`);
      console.log('─'.repeat(80));

      // Clean up the response to extract JSON
      const originalText = text;
      text = text.replace(/```json\n?/, '').replace(/\n?```/, '').trim();
      
      if (originalText !== text) {
        console.log(`🧹 Cleaned response (removed markdown):\n${text}`);
        console.log('─'.repeat(40));
      }
      
      try {
        const parsed = JSON.parse(text);
        console.log(`✅ Successfully parsed JSON response for ${ticker}`);
        console.log(`📋 Parsed data:`, JSON.stringify(parsed, null, 2));
        console.log('═'.repeat(80));
        
        const finalResult = {
          ...parsed,
          articlesAnalyzed: articlesToAnalyze.length,
          totalArticles: articles.length,
          historicalArticlesUsed: historicalData ? historicalData.length : 0,
          lastUpdated: new Date().toISOString(),
          ticker: ticker
        };
        
        console.log(`🎯 Final enhanced result for ${ticker}:`, JSON.stringify(finalResult, null, 2));
        return finalResult;
      } catch (parseError) {
        console.error(`❌ JSON parsing failed for ${ticker}. Attempting recovery...`);
        
        // Try to fix incomplete JSON
        let fixedText = text;
        try {
          // Try to extract and reconstruct JSON from partial response
          if (text.includes('"summary":')) {
            // Extract what we can and create a valid JSON
            const summaryMatch = text.match(/"summary":\s*"([^"]*(?:[^"\\]|\\.)*)/);
            const keyPointsMatch = text.match(/"keyPoints":\s*(\[[^\]]*\])/);
            const sentimentMatch = text.match(/"sentiment":\s*"([^"]*)"/);
            const marketImpactMatch = text.match(/"marketImpact":\s*"([^"]*)"/);
            const whatChangedMatch = text.match(/"whatChangedToday":\s*"([^"]*(?:[^"\\]|\\.)*)/);
            const marketImplicationsMatch = text.match(/"marketImplications":\s*"([^"]*(?:[^"\\]|\\.)*)/);
            
            const reconstructed = {
              summary: summaryMatch ? summaryMatch[1].replace(/\\"/g, '"') : "Analysis in progress - partial data received",
              keyPoints: keyPointsMatch ? JSON.parse(keyPointsMatch[1]) : ["Analysis continues", "Partial data received"],
              sentiment: sentimentMatch ? sentimentMatch[1] : "neutral",
              sentimentReasoning: "Partial analysis - full response was truncated",
              whatChangedToday: whatChangedMatch ? whatChangedMatch[1].replace(/\\"/g, '"') : "Recent developments are being analyzed. Please refresh for complete analysis.",
              marketImplications: marketImplicationsMatch ? marketImplicationsMatch[1].replace(/\\"/g, '"') : "Market analysis available but truncated",
              marketImpact: marketImpactMatch ? marketImpactMatch[1] : "medium",
              confidence: "low"
            };
            
            console.log(`🔧 Reconstructed JSON for ${ticker}:`, JSON.stringify(reconstructed, null, 2));
            
            return {
              ...reconstructed,
              articlesAnalyzed: articlesToAnalyze.length,
              totalArticles: articles.length,
              historicalArticlesUsed: historicalData ? historicalData.length : 0,
              lastUpdated: new Date().toISOString(),
              ticker: ticker,
              _recovered: true
            };
          }
        } catch (recoveryError) {
          console.error(`❌ Recovery attempt failed for ${ticker}:`, recoveryError);
        }
        console.error(`❌ Failed to parse Gemini response for ${ticker}:`, parseError);
        console.log(`📏 Raw response length: ${text.length} characters`);
        console.log(`🔍 Attempting to parse: "${text.substring(0, 200)}..."`);
        console.log('─'.repeat(40));
        
        // Fallback: create structured response from text
        return {
          summary: text.substring(0, 500) + '...',
          keyPoints: this.extractKeyPoints(text),
          sentiment: this.extractSentiment(text),
          whatChangedToday: this.extractWhatChanged(text),
          marketImplications: this.extractMarketImplications(text),
          articlesAnalyzed: articlesToAnalyze.length,
          totalArticles: articles.length,
          lastUpdated: new Date().toISOString(),
          ticker: ticker,
          fallback: true
        };
      }

    } catch (error) {
      console.error(`🚨 ERROR generating summary for ${ticker}:`, error);
      console.log(`🔍 Error type: ${error.constructor.name}`);
      console.log(`📄 Error message: ${error.message}`);
      if (error.response) {
        console.log(`📡 API Response status: ${error.response.status}`);
        console.log(`📝 API Response data:`, error.response.data);
      }
      console.log('═'.repeat(80));
      
      // Enhanced fallback summary
      const recentTitles = articles.slice(0, 3).map(a => a.title);
      const fallbackResult = {
        summary: `Analysis of ${articles.length} recent articles about ${ticker}. Recent developments include: ${recentTitles.join('; ')}. For detailed analysis, please check individual sources.`,
        keyPoints: recentTitles,
        sentiment: 'neutral',
        whatChangedToday: 'Unable to analyze changes due to processing error.',
        marketImplications: 'Analysis temporarily unavailable.',
        articlesAnalyzed: articles.length,
        error: error.message,
        lastUpdated: new Date().toISOString(),
        ticker: ticker
      };
      
      console.log(`🔄 Using fallback result for ${ticker}:`, JSON.stringify(fallbackResult, null, 2));
      return fallbackResult;
    }
  }

  extractKeyPoints(text) {
    // Simple extraction of bullet points or numbered items
    const bulletPattern = /[•\-\*]\s*(.+)$/gm;
    const numberPattern = /^\d+\.\s*(.+)$/gm;
    
    const bullets = [...text.matchAll(bulletPattern)];
    const numbers = [...text.matchAll(numberPattern)];
    
    const points = [...bullets, ...numbers].map(match => match[1].trim()).slice(0, 5);
    
    return points.length > 0 ? points : ['Market activity continues', 'News developments ongoing', 'Investor attention warranted'];
  }

  extractSentiment(text) {
    const positive = /(positive|bullish|optimistic|growth|increase|up|gain|strong|good|excellent|surge|rally|beat|exceeds)/gi;
    const negative = /(negative|bearish|pessimistic|decline|decrease|down|loss|weak|bad|poor|fall|drop|miss|below)/gi;
    
    const positiveMatches = (text.match(positive) || []).length;
    const negativeMatches = (text.match(negative) || []).length;
    
    if (positiveMatches > negativeMatches) return 'positive';
    if (negativeMatches > positiveMatches) return 'negative';
    return 'neutral';
  }

  extractWhatChanged(text) {
    // Look for change indicators in the text
    const changePatterns = [
      /what changed[^.!?]*[.!?]/gi,
      /new developments?[^.!?]*[.!?]/gi,
      /today['s\s][^.!?]*[.!?]/gi,
      /recently[^.!?]*[.!?]/gi
    ];
    
    for (const pattern of changePatterns) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        return matches[0].trim();
      }
    }
    
    return 'Recent developments indicate continued market activity.';
  }

  extractMarketImplications(text) {
    // Look for market implication indicators
    const implicationPatterns = [
      /market implications?[^.!?]*[.!?]/gi,
      /stock.*impact[^.!?]*[.!?]/gi,
      /investors?[^.!?]*[.!?]/gi,
      /price.*target[^.!?]*[.!?]/gi
    ];
    
    for (const pattern of implicationPatterns) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        return matches[0].trim();
      }
    }
    
    return 'Market implications remain to be determined.';
  }
}