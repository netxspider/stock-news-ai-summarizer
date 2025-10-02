import { RefreshCw, TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react';

const NewsSummary = ({ summary, ticker, onRefresh, refreshing }) => {
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
            <div className={`impact-dot ${getMarketImpactClass(summary.summary?.marketImpact)}`}></div>
            <div className="indicator-content">
              <span className="indicator-label">Market Impact</span>
              <span className="indicator-value">
                {summary.summary?.marketImpact || 'Unknown'}
              </span>
            </div>
          </div>
        </div>

        {/* Main Summary */}
        <div className="summary-section main-summary">
          <h3>Daily Summary</h3>
          <div className="summary-text">
            {summary.summary?.summary || 'No summary available.'}
          </div>
        </div>

        {/* What Changed Today */}
        <div className="summary-section what-changed">
          <h3>What Changed Today</h3>
          <div className="changed-content">
            {summary.summary?.whatChangedToday || 'No significant changes detected.'}
          </div>
        </div>

        {/* Key Points */}
        {summary.summary?.keyPoints && summary.summary.keyPoints.length > 0 && (
          <div className="summary-section key-points">
            <h3>Key Points</h3>
            <ul className="points-list">
              {summary.summary.keyPoints.map((point, index) => (
                <li key={index} className="point-item">{point}</li>
              ))}
            </ul>
          </div>
        )}

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