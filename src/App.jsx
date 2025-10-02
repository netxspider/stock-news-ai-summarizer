import { useState, useEffect } from 'react';
import './App.css';
import TickerSidebar from './components/TickerSidebar';
import NewsSummary from './components/NewsSummary';
import SourcesList from './components/SourcesList_new';
import Header from './components/Header';
import StatusDashboard from './components/StatusDashboard';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [tickers, setTickers] = useState([]);
  const [summaries, setSummaries] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_URL || (
    import.meta.env.PROD ? '' : 'http://localhost:3001'
  );

  useEffect(() => {
    fetchTickers();
    fetchAllSummaries();
  }, []);

    const fetchTickers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tickers`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setTickers(Array.isArray(data) ? data : []);
      if (data.length > 0 && !selectedTicker) {
        setSelectedTicker(data[0]);
      }
    } catch (error) {
      console.error('Error fetching tickers:', error);
      // Set default tickers if API fails
      const defaultTickers = ['AAPL', 'MSFT', 'GOOGL'];
      setTickers(defaultTickers);
      if (!selectedTicker) {
        setSelectedTicker(defaultTickers[0]);
      }
    }
  };

    const fetchAllSummaries = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/summaries`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setSummaries(data || {});
    } catch (error) {
      console.error('Error fetching summaries:', error);
      setSummaries({});
    } finally {
      setLoading(false);
    }
  };

  const addTicker = async (ticker) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tickers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ticker }),
      });

      if (response.ok) {
        const responseData = await response.json();
        await fetchTickers();
        const upperTicker = ticker.toUpperCase();
        setSelectedTicker(upperTicker);
        
        // If we got preliminary data, update the summaries immediately
        if (responseData.data) {
          setSummaries(prev => ({
            ...prev,
            [upperTicker]: responseData.data
          }));
        }
        
        // Set up polling to check for AI processing completion
        const pollForAICompletion = () => {
          let attempts = 0;
          const maxAttempts = 30; // Poll for up to 60 seconds
          
          const checkInterval = setInterval(async () => {
            attempts++;
            
            try {
              const statusResponse = await fetch(`${API_BASE_URL}/api/status/${upperTicker}`);
              const statusData = await statusResponse.json();
              
              // Fetch latest summaries to get updated data
              await fetchAllSummaries();
              
              // Stop polling if AI processing is complete or max attempts reached
              if (!statusData.isProcessing || attempts >= maxAttempts) {
                clearInterval(checkInterval);
              }
            } catch (error) {
              console.error('Error checking processing status:', error);
              if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
              }
            }
          }, 2000);
        };
        
        pollForAICompletion();
      }
    } catch (error) {
      console.error('Error adding ticker:', error);
    }
  };

  const removeTicker = async (ticker) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tickers/${ticker}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchTickers();
        if (selectedTicker === ticker) {
          setSelectedTicker(tickers[0] !== ticker ? tickers[0] : tickers[1] || null);
        }
      }
    } catch (error) {
      console.error('Error removing ticker:', error);
    }
  };

  const refreshTicker = async (ticker) => {
    try {
      setRefreshing(true);
      const response = await fetch(`${API_BASE_URL}/api/refresh/${ticker}`, {
        method: 'POST',
      });

      if (response.ok) {
        // Immediately fetch updated summaries (will show scraped news)
        await fetchAllSummaries();
        
        // Set up polling to check for AI processing completion
        const pollForAICompletion = () => {
          let attempts = 0;
          const maxAttempts = 30; // Poll for up to 60 seconds
          
          const checkInterval = setInterval(async () => {
            attempts++;
            
            try {
              const statusResponse = await fetch(`${API_BASE_URL}/api/status/${ticker}`);
              const statusData = await statusResponse.json();
              
              // Fetch latest summaries to get updated AI data
              await fetchAllSummaries();
              
              // Stop polling if AI processing is complete or max attempts reached
              if (!statusData.isProcessing || attempts >= maxAttempts) {
                clearInterval(checkInterval);
                setRefreshing(false);
              }
            } catch (error) {
              console.error('Error checking processing status:', error);
              if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                setRefreshing(false);
              }
            }
          }, 2000);
        };
        
        pollForAICompletion();
      }
    } catch (error) {
      console.error('Error refreshing ticker:', error);
      setRefreshing(false);
    }
  };

  const refreshAll = async () => {
    try {
      setRefreshing(true);
      const response = await fetch(`${API_BASE_URL}/api/refresh-all`, {
        method: 'POST',
      });

      if (response.ok) {
        await fetchAllSummaries();
      }
    } catch (error) {
      console.error('Error refreshing all tickers:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const currentSummary = selectedTicker ? summaries[selectedTicker] : null;

  return (
    <div className="app">
      <Header 
        onRefreshAll={refreshAll}
        refreshing={refreshing}
      />
      
      <div className="main-content">
        <div className="left-panel">
          <ErrorBoundary>
            {currentSummary && (
              <SourcesList 
                sources={currentSummary.sources || []}
                ticker={selectedTicker}
              />
            )}
          </ErrorBoundary>
        </div>

        <div className="center-panel">
          <ErrorBoundary>
            {loading ? (
              <div className="loading">
                <div className="loading-spinner"></div>
                <p>Loading summaries...</p>
              </div>
            ) : currentSummary ? (
              <NewsSummary 
                summary={currentSummary}
                ticker={selectedTicker}
                onRefresh={() => refreshTicker(selectedTicker)}
                refreshing={refreshing}
              />
            ) : (
              <div className="no-data">
                <h2>No data available</h2>
                <p>Select a ticker from the sidebar or add a new one to get started.</p>
              </div>
            )}
          </ErrorBoundary>
        </div>

        <div className="right-panel">
          <ErrorBoundary>
            <TickerSidebar
              tickers={tickers}
              selectedTicker={selectedTicker}
              onTickerSelect={setSelectedTicker}
              onAddTicker={addTicker}
              onRemoveTicker={removeTicker}
              summaries={summaries}
            />
          </ErrorBoundary>
          
          <ErrorBoundary>
            <StatusDashboard apiUrl={API_BASE_URL} />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}

export default App;
