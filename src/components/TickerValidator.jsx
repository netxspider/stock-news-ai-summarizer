import React, { useState } from 'react';

const TickerValidator = ({ onTickerAdded }) => {
  const [ticker, setTicker] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!ticker.trim()) {
      setValidationResult({ success: false, message: 'Please enter a ticker symbol' });
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    try {
      const response = await fetch('http://localhost:3001/api/tickers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ticker: ticker.trim() }),
      });

      const result = await response.json();

      if (response.ok) {
        setValidationResult({
          success: true,
          message: result.message,
          ticker: result.ticker,
          articleCount: result.articleCount
        });
        setTicker('');
        if (onTickerAdded) {
          onTickerAdded(result.ticker);
        }
      } else {
        setValidationResult({
          success: false,
          message: result.error || 'Failed to add ticker',
        });
      }
    } catch (error) {
      console.error('Error adding ticker:', error);
      setValidationResult({
        success: false,
        message: 'Network error. Please check if the server is running.',
      });
    } finally {
      setIsValidating(false);
    }
  };

  const getValidationIcon = () => {
    if (isValidating) return '⏳';
    if (!validationResult) return '➕';
    return validationResult.success ? '✅' : '❌';
  };

  const getValidationClass = () => {
    if (!validationResult) return '';
    return validationResult.success 
      ? 'border-green-500 bg-green-50 text-green-700'
      : 'border-red-500 bg-red-50 text-red-700';
  };

  return (
    <div className="mb-6 p-4 border rounded-lg bg-white shadow-sm">
      <h3 className="text-lg font-semibold mb-3 text-gray-800">
        Add New Stock Ticker
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="Enter ticker symbol (e.g., AAPL, MSFT)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isValidating}
            maxLength={5}
          />
          <button
            type="submit"
            disabled={isValidating || !ticker.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <span>{getValidationIcon()}</span>
            {isValidating ? 'Validating...' : 'Add Ticker'}
          </button>
        </div>
        
        {validationResult && (
          <div className={`p-3 border rounded-md ${getValidationClass()}`}>
            <p className="font-medium">
              {validationResult.success ? 'Success!' : 'Error'}
            </p>
            <p className="text-sm mt-1">{validationResult.message}</p>
            {validationResult.success && validationResult.articleCount && (
              <p className="text-sm mt-1">
                📰 Found {validationResult.articleCount} articles for analysis
              </p>
            )}
          </div>
        )}
      </form>
      
      <div className="mt-4 p-3 bg-gray-50 rounded-md">
        <h4 className="font-medium text-gray-700 mb-2">Enhanced Validation Features:</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>✓ Format validation (1-5 alphanumeric characters)</li>
          <li>✓ Ticker existence verification via news sources</li>
          <li>✓ Duplicate ticker prevention</li>
          <li>✓ Real-time news availability check</li>
          <li>✓ Immediate analysis initiation upon validation</li>
        </ul>
      </div>
    </div>
  );
};

export default TickerValidator;