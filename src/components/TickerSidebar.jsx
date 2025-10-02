import { useState } from 'react';
import { Plus, X, RefreshCw } from 'lucide-react';

const TickerSidebar = ({ 
  tickers, 
  selectedTicker, 
  onTickerSelect, 
  onAddTicker, 
  onRemoveTicker,
  summaries 
}) => {
  const [newTicker, setNewTicker] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAddTicker = async (e) => {
    e.preventDefault();
    if (newTicker.trim() && !tickers.includes(newTicker.toUpperCase())) {
      setIsAdding(true);
      await onAddTicker(newTicker.trim());
      setNewTicker('');
      setIsAdding(false);
    }
  };

  const getSentimentColor = (sentiment) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive': return '#10b981';
      case 'negative': return '#ef4444';
      case 'mixed': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getMarketImpactIcon = (impact) => {
    switch (impact?.toLowerCase()) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  return (
    <div className="ticker-sidebar">
      <div className="sidebar-header">
        <h3>Stock Tickers</h3>
        <span className="ticker-count">{tickers.length}</span>
      </div>

      <form onSubmit={handleAddTicker} className="add-ticker-form">
        <div className="input-group">
          <input
            type="text"
            value={newTicker}
            onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
            placeholder="Add ticker (e.g., AAPL)"
            className="ticker-input"
            disabled={isAdding}
          />
          <button 
            type="submit" 
            className="add-btn"
            disabled={isAdding || !newTicker.trim()}
          >
            {isAdding ? (
              <RefreshCw className="icon spinning" />
            ) : (
              <Plus className="icon" />
            )}
          </button>
        </div>
      </form>

      <div className="ticker-list">
        {tickers.map((ticker) => {
          const summary = summaries[ticker];
          const isSelected = selectedTicker === ticker;
          
          return (
            <div
              key={ticker}
              className={`ticker-item ${isSelected ? 'selected' : ''}`}
              onClick={() => onTickerSelect(ticker)}
            >
              <div className="ticker-main">
                <div className="ticker-header">
                  <span className="ticker-symbol">{ticker}</span>
                  <button
                    className="remove-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveTicker(ticker);
                    }}
                  >
                    <X className="icon" />
                  </button>
                </div>
                
                {summary && (
                  <div className="ticker-meta">
                    <div className="sentiment-indicator">
                      <div 
                        className="sentiment-dot"
                        style={{ backgroundColor: getSentimentColor(summary.summary?.sentiment) }}
                      ></div>
                      <span className="sentiment-text">
                        {summary.summary?.sentiment || 'neutral'}
                      </span>
                    </div>
                    
                    <div className="market-impact">
                      <span className="impact-icon">
                        {getMarketImpactIcon(summary.summary?.marketImpact)}
                      </span>
                      <span className="impact-text">
                        {summary.summary?.marketImpact || 'unknown'}
                      </span>
                    </div>
                  </div>
                )}
                
                {summary && (
                  <div className="last-updated">
                    Updated: {new Date(summary.timestamp).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {tickers.length === 0 && (
        <div className="empty-state">
          <p>No tickers added yet</p>
          <p className="empty-subtitle">Add a stock symbol to get started</p>
        </div>
      )}
    </div>
  );
};

export default TickerSidebar;