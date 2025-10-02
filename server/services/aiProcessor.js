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
        maxOutputTokens: 2048,
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

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();

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

      console.log(`Selected ${selectedArticles.length} articles from ${articles.length} total`);
      return selectedArticles.length > 0 ? selectedArticles : articles.slice(0, 6);

    } catch (error) {
      console.error('Error in article selection:', error);
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

  async generateSummary(articles, historicalSummaries = []) {
    if (articles.length === 0) {
      return {
        summary: 'No recent news available for analysis.',
        whatChangedToday: 'No significant changes detected.',
        keyPoints: [],
        sentiment: 'neutral',
        marketImpact: 'minimal'
      };
    }

    try {
      await this.rateLimit();

      const articlesText = articles.map(article => 
        `Title: ${article.title}
Source: ${article.source}
Published: ${article.publishedAt}
Content: ${article.content || 'No content available'}
---`
      ).join('\n');

      // Enhanced historical context with sentiment and trend analysis
      const historicalContext = historicalSummaries.length > 0 
        ? `HISTORICAL CONTEXT (Past 7 days):
${historicalSummaries.map((summary, index) => {
  const dayLabel = index === 0 ? 'Yesterday' : `${index + 1} days ago`;
  const summaryData = summary.summary || summary;
  return `${dayLabel}:
- Summary: ${summaryData.summary || 'No summary available'}
- Sentiment: ${summaryData.sentiment || 'unknown'}
- Market Impact: ${summaryData.marketImpact || 'unknown'}
- Key Points: ${Array.isArray(summaryData.keyPoints) ? summaryData.keyPoints.slice(0, 2).join('; ') : 'None'}`;
}).join('\n')}
---`
        : 'No historical data available for comparison.';

      const prompt = `You are a senior financial analyst. Analyze today's news and provide dynamic insights comparing with historical trends.

${historicalContext}

TODAY'S NEWS ARTICLES:
${articlesText}

Create a JSON response with this EXACT structure:
{
  "summary": "Comprehensive analysis of today's key developments (200-300 words). Focus on business fundamentals, financial performance, strategic moves, and market positioning.",
  "whatChangedToday": "CRITICAL: Compare today's developments against the historical context above. Identify NEW trends, sentiment shifts, breaking developments, or changes in business trajectory that differ from previous days. Be specific about what's different from the pattern.",
  "keyPoints": ["3-5 actionable insights for investors"],
  "sentiment": "positive/negative/neutral/mixed",
  "marketImpact": "high/medium/low/minimal"
}

REQUIREMENTS:
1. Make "whatChangedToday" truly dynamic by comparing against historical data
2. If no historical data exists, focus on today's unique developments
3. Identify emerging patterns, sentiment shifts, or breaking news
4. Be specific about changes from previous trading sessions
5. Use professional financial language
6. Ensure all content is based on provided articles only

Respond with ONLY valid JSON, no additional text.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();

      try {
        // Clean the response to extract JSON
        let cleanedText = text;
        
        // Remove markdown code blocks if present
        cleanedText = cleanedText.replace(/```json\n?|\n?```/g, '');
        
        // Find JSON object boundaries
        const startIndex = cleanedText.indexOf('{');
        const endIndex = cleanedText.lastIndexOf('}') + 1;
        
        if (startIndex !== -1 && endIndex > startIndex) {
          cleanedText = cleanedText.substring(startIndex, endIndex);
        }

        const summaryData = JSON.parse(cleanedText);

        // Validate required fields
        const requiredFields = ['summary', 'whatChangedToday', 'keyPoints', 'sentiment', 'marketImpact'];
        for (const field of requiredFields) {
          if (!summaryData[field]) {
            throw new Error(`Missing required field: ${field}`);
          }
        }

        // Ensure keyPoints is an array
        if (!Array.isArray(summaryData.keyPoints)) {
          summaryData.keyPoints = [];
        }

        return summaryData;

      } catch (parseError) {
        console.error('Error parsing AI summary response:', parseError);
        console.error('Raw response:', text);
        
        // Fallback summary
        return {
          summary: `Analysis of ${articles.length} news articles reveals ongoing market developments. Key sources include ${[...new Set(articles.map(a => a.source))].join(', ')}. Recent headlines focus on business operations, market performance, and industry trends.`,
          whatChangedToday: 'Multiple news sources report various developments affecting market sentiment and business operations.',
          keyPoints: articles.slice(0, 4).map(article => article.title),
          sentiment: 'mixed',
          marketImpact: 'medium'
        };
      }

    } catch (error) {
      console.error('Error generating summary:', error);
      
      // Fallback summary
      return {
        summary: `Unable to generate detailed summary. Monitoring ${articles.length} news articles from ${[...new Set(articles.map(a => a.source))].join(', ')}.`,
        whatChangedToday: 'Summary generation temporarily unavailable.',
        keyPoints: articles.slice(0, 3).map(article => article.title),
        sentiment: 'neutral',
        marketImpact: 'unknown'
      };
    }
  }
}