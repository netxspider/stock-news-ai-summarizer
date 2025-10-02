import React, { useState } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Minus, Calendar, ChevronDown, ChevronUp } from 'lucide-react';

const NewsSummary = ({ summary, ticker, onRefresh, refreshing }) => {
  const [expandedSections, setExpandedSections] = useState({
    mainSummary: false,
    whatChanged: false
  });

  const isProcessing = summary?.isProcessing;
  const processingStatus = summary?.meta?.processingStatus || 'unknown';

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const truncateText = (text, wordLimit = 40) => {
    if (!text) return '';
    const words = text.trim().split(' ');
    if (words.length <= wordLimit) return text;
    return words.slice(0, wordLimit).join(' ') + '...';
  };

  const parseGeminiResponse = (content) => {
    if (!content) return '';
    
    // If it's already a properly structured object
    if (typeof content === 'object' && content !== null) {
      return content.summary || JSON.stringify(content);
    }
    
    // If it's a string
    if (typeof content === 'string') {
      const trimmed = content.trim();
      
      // If it looks like JSON, try to parse it
      if (trimmed.startsWith('{')) {
        try {
          // Clean up markdown formatting
          let jsonStr = trimmed
            .replace(/```json\s*/g, '')
            .replace(/```\s*$/g, '')
            .replace(/^```\s*/g, '')
            .trim();
          
          const parsed = JSON.parse(jsonStr);
          
          if (parsed && typeof parsed === 'object' && parsed.summary) {
            return parsed.summary;
          }
          
          return jsonStr;
        } catch (e) {
          // If JSON parsing fails, try regex extraction - but use a more comprehensive pattern
          const patterns = [
            // Match complete quoted strings with escaped characters
            /"summary":\s*"((?:[^"\\]|\\.)*)"/,
            // Match partial strings that might be cut off
            /"summary":\s*"([^"]*)/,
            // Case insensitive fallback
            /summary[^:]*:\s*"([^"]*)/i
          ];
          
          for (const pattern of patterns) {
            const match = trimmed.match(pattern);
            if (match && match[1] && match[1].length > 10) {
              return match[1]
                .replace(/\\"/g, '"')
                .replace(/\\n/g, '\n')
                .replace(/\\t/g, '\t')
                .replace(/\\\//g, '/');
            }
          }
          
          // If no patterns match, return the original content
          return trimmed;
        }
      }
      
      // If it doesn't start with {, assume it's plain text
      return content;
    }
    
    return String(content);
  };
  if (!summary) {
    return (
      <div className="news-summary">
        <div className="no-summary">
          <h2>No Summary Available</h2>
          <p>Click refresh to generate a summary for {ticker}</p>
        </div>
      </div>
    );
  }

  const getSentimentIcon = (sentiment) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive': return <TrendingUp className="sentiment-icon positive" />;
      case 'negative': return <TrendingDown className="sentiment-icon negative" />;
      case 'mixed': return <Minus className="sentiment-icon mixed" />;
      default: return <Minus className="sentiment-icon neutral" />;
    }
  };

  const getMarketImpactClass = (impact) => {
    switch (impact?.toLowerCase()) {
      case 'high': return 'impact-high';
      case 'medium': return 'impact-medium';
      case 'low': return 'impact-low';
      default: return 'impact-minimal';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="news-summary">
      <div className="summary-header">
        <div className="header-left">
          <h2>{ticker} News Summary</h2>
          <div className="summary-meta">
            <Calendar className="meta-icon" />
            <span>{formatDate(summary.timestamp)}</span>
          </div>
        </div>
        
        <div className="header-right">
          <button 
            className={`refresh-btn ${refreshing ? 'refreshing' : ''}`}
            onClick={onRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`refresh-icon ${refreshing ? 'spinning' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Processing Status Banner */}
      {isProcessing && (
        <div className="processing-banner">
          <div className="processing-content">
            <div className="processing-spinner"></div>
            <div className="processing-text">
              {processingStatus === 'collecting_news' && 'News scraped successfully! Generating AI analysis...'}
              {processingStatus === 'refreshing_news' && 'News updated! Generating AI analysis...'}
              {processingStatus === 'generating_ai_summary' && 'Creating comprehensive analysis...'}
              {!['collecting_news', 'refreshing_news', 'generating_ai_summary'].includes(processingStatus) && 
                'Processing news analysis...'}
            </div>
          </div>
          <div className="processing-note">
            News articles are available below. AI summary will appear when ready.
          </div>
        </div>
      )}

      <div className="summary-content">
        {/* Sentiment and Market Impact Indicators */}
        <div className="indicators">
          <div className="indicator sentiment">
            {getSentimentIcon(summary.summary?.sentiment)}
            <div className="indicator-content">
              <span className="indicator-label">Sentiment</span>
              <span className="indicator-value">
                {summary.summary?.sentiment || 'Neutral'}
              </span>
            </div>
          </div>
          
          <div className="indicator market-impact">
            <div className={`impact-dot ${getMarketImpactClass(summary.summary?.marketImpact || summary.marketImpact)}`}></div>
            <div className="indicator-content">
              <span className="indicator-label">Market Impact</span>
              <span className="indicator-value">
                {summary.summary?.marketImpact || summary.marketImpact || 'Analyzing...'}
              </span>
            </div>
          </div>
        </div>

        {/* Main Summary */}
        <div className="summary-section main-summary">
          <div className="section-header">
            <h3>Daily Summary</h3>
            {(() => {
              // If still processing, don't show read more button
              if (isProcessing) return null;
              
              // Try multiple ways to access the summary content
              const rawSummaryText = summary.summary?.summary || 
                                   summary.summary || 
                                   summary.dailySummary || 
                                   (typeof summary === 'string' ? summary : '') ||
                                   'No summary available.';
              
              const parsedSummaryText = parseGeminiResponse(rawSummaryText);
              const wordCount = parsedSummaryText.trim().split(' ').length;
              
              return wordCount > 40 && (
                <button 
                  className="read-more-btn"
                  onClick={() => toggleSection('mainSummary')}
                  title={`${wordCount} words`}
                >
                  {expandedSections.mainSummary ? (
                    <>
                      <span>Read Less</span>
                      <ChevronUp className="chevron-icon" />
                    </>
                  ) : (
                    <>
                      <span>Read More ({wordCount} words)</span>
                      <ChevronDown className="chevron-icon" />
                    </>
                  )}
                </button>
              );
            })()}
          </div>
          <div className={`summary-text ${expandedSections.mainSummary ? 'content-expanded' : ''}`}>
            {(() => {
              // Show processing message if AI analysis is not ready
              if (isProcessing) {
                return (
                  <div className="processing-message">
                    <p>📊 <strong>News data collected successfully!</strong></p>
                    <p>Our AI is analyzing {summary.articles?.length || 0} articles to create a comprehensive summary. This usually takes 30-60 seconds.</p>
                    <p>You can view the news sources in the sidebar while waiting.</p>
                  </div>
                );
              }
              
              const rawSummaryText = summary.summary?.summary || 
                                   summary.summary || 
                                   summary.dailySummary || 
                                   (typeof summary === 'string' ? summary : '') ||
                                   'No summary available.';
              const parsedSummaryText = parseGeminiResponse(rawSummaryText);
              
              const displayText = expandedSections.mainSummary ? parsedSummaryText : truncateText(parsedSummaryText);
              

              
              // Format the text to handle line breaks and structure
              return displayText.split('\n').map((paragraph, index) => (
                paragraph.trim() ? <p key={index}>{paragraph.trim()}</p> : null
              )).filter(Boolean);
            })()}
          </div>
        </div>

        {/* What Changed Today */}
        <div className="summary-section what-changed">
          <div className="section-header">
            <h3>What Changed Today</h3>
            {(() => {
              // If still processing, don't show read more button
              if (isProcessing) return null;
              
              const rawChangedText = summary.summary?.whatChangedToday || 
                                   summary.whatChangedToday || 
                                   summary.changes ||
                                   'No significant changes detected.';
              const parsedChangedText = parseGeminiResponse(rawChangedText);
              const wordCount = parsedChangedText.trim().split(' ').length;
              
              return wordCount > 40 && (
                <button 
                  className="read-more-btn"
                  onClick={() => toggleSection('whatChanged')}
                  title={`${wordCount} words`}
                >
                  {expandedSections.whatChanged ? (
                    <>
                      <span>Read Less</span>
                      <ChevronUp className="chevron-icon" />
                    </>
                  ) : (
                    <>
                      <span>Read More ({wordCount} words)</span>
                      <ChevronDown className="chevron-icon" />
                    </>
                  )}
                </button>
              );
            })()}
          </div>
          <div className={`changed-content ${expandedSections.whatChanged ? 'content-expanded' : ''}`}>
            {(() => {
              // Show processing message if AI analysis is not ready
              if (isProcessing) {
                return (
                  <div className="processing-message">
                    <p>🔍 <strong>Comparing with historical data...</strong></p>
                    <p>AI is analyzing changes by comparing today's news with the past 7 days of market activity.</p>
                  </div>
                );
              }
              
              const rawChangedText = summary.summary?.whatChangedToday || 
                                   summary.whatChangedToday || 
                                   summary.changes ||
                                   'No significant changes detected.';
              const parsedChangedText = parseGeminiResponse(rawChangedText);
              const displayText = expandedSections.whatChanged ? parsedChangedText : truncateText(parsedChangedText);
              
              // Format the text to handle line breaks and structure
              return displayText.split('\n').map((paragraph, index) => (
                paragraph.trim() ? <p key={index}>{paragraph.trim()}</p> : null
              )).filter(Boolean);
            })()}
          </div>
        </div>

        {/* Key Points */}
        {(() => {
          const keyPoints = summary.summary?.keyPoints || summary.keyPoints;
          
          if (!keyPoints) return null;
          
          // Handle both array and string formats
          let pointsArray = [];
          if (Array.isArray(keyPoints)) {
            pointsArray = keyPoints;
          } else if (typeof keyPoints === 'string') {
            // Try to parse if it's JSON string
            try {
              const parsed = JSON.parse(keyPoints);
              if (Array.isArray(parsed)) {
                pointsArray = parsed;
              } else {
                // Split by common delimiters if it's a text string
                pointsArray = keyPoints.split(/[•\n\r-]+/).filter(point => point.trim().length > 0);
              }
            } catch (e) {
              // Split by common delimiters if JSON parsing fails
              pointsArray = keyPoints.split(/[•\n\r-]+/).filter(point => point.trim().length > 0);
            }
          }
          
          if (pointsArray.length === 0) return null;
          
          return (
            <div className="summary-section key-points">
              <h3>Key Points</h3>
              <ul className="points-list">
                {pointsArray.map((point, index) => (
                  <li key={index} className="point-item">
                    {typeof point === 'string' ? point.trim() : String(point).trim()}
                  </li>
                ))}
              </ul>
            </div>
          );
        })()}

        {/* Dynamic Data Information */}
        <div className="summary-footer">
          <div className="articles-info">
            <span className="articles-count">
              Analyzed {summary.articles?.length || 0} of {summary.meta?.totalArticlesFound || summary.sources?.length || 0} articles found
            </span>
            <span className="historical-info">
              {summary.meta?.historicalDaysUsed > 0 ? 
                `Compared with ${summary.meta.historicalDaysUsed} days of historical data` :
                'First analysis for this ticker'
              }
            </span>
            <span className="last-updated">
              Generated: {new Date(summary.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewsSummary;