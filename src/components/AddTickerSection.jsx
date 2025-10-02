import { useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';

const AddTickerSection = ({ onAddTicker, existingTickers }) => {
  const [newTicker, setNewTicker] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

    // Popular stock suggestions
  const suggestedTickers = [
    'AMZN', 'MSFT', 'TSLA', 'GOOGL', 'AAPL', 'META', 'NFLX', 'NVDA', 
    'AMD', 'BABA', 'CRM', 'ORCL', 'ADBE', 'PYPL', 'SHOP', 'ZOOM',
    'DIS', 'BA', 'JPM', 'V', 'MA', 'WMT', 'PG', 'KO'
  ].filter(ticker => !existingTickers.includes(ticker));

  const handleAddTicker = async (e) => {
    e.preventDefault();
    if (newTicker.trim() && !existingTickers.includes(newTicker.toUpperCase())) {
      setIsAdding(true);
      await onAddTicker(newTicker.trim());
      setNewTicker('');
      setIsAdding(false);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (ticker) => {
    setNewTicker(ticker);
    setShowSuggestions(false);
  };

  return (
    <div className="add-ticker-section">
      <div className="sidebar-header">
        <h3>Add New Ticker</h3>
        <span className="add-ticker-icon">📈</span>
      </div>

      <form onSubmit={handleAddTicker} className="add-ticker-form">
        <div className="input-group">
          <input
            type="text"
            value={newTicker}
            onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Enter ticker symbol (e.g., AAPL)"
            className="ticker-input"
            disabled={isAdding}
            maxLength={5}
          />
          <button 
            type="submit" 
            className="add-btn"
            disabled={isAdding || !newTicker.trim() || existingTickers.includes(newTicker.toUpperCase())}
            title={existingTickers.includes(newTicker.toUpperCase()) ? 'Ticker already exists' : 'Add ticker'}
          >
            {isAdding ? (
              <RefreshCw className="icon spinning" />
            ) : (
              <Plus className="icon" />
            )}
          </button>
        </div>
        
        {existingTickers.includes(newTicker.toUpperCase()) && newTicker.trim() && (
          <div className="error-message">
            {newTicker.toUpperCase()} is already added to your watchlist
          </div>
        )}
        
        {showSuggestions && suggestedTickers.length > 0 && (
          <div className="suggestions-panel">
            <div className="suggestions-header">
              <span>Popular Stocks</span>
              <button 
                type="button"
                onClick={() => setShowSuggestions(false)}
                className="close-suggestions"
              >
                ×
              </button>
            </div>
            <div className="suggestions-grid">
              {suggestedTickers.slice(0, 12).map(ticker => (
                <button
                  key={ticker}
                  type="button"
                  onClick={() => handleSuggestionClick(ticker)}
                  className="suggestion-item"
                >
                  {ticker}
                </button>
              ))}
            </div>
            <div className="suggestions-footer">
              <span className="suggestions-hint">Click on any ticker to select it</span>
            </div>
          </div>
        )}
      </form>

            <div className="add-ticker-help">
        <h4>💡 Tips:</h4>
        <ul>
          <li>Enter valid US stock ticker symbols (e.g., AAPL, TSLA)</li>
          <li>AI analysis takes 10-30 seconds to complete</li>
          <li>Click suggestions above for popular US stocks</li>
          <li>Focus on US-listed companies for best news coverage</li>
        </ul>
      </div>
    </div>
  );
};

export default AddTickerSection;