import { RefreshCw, TrendingUp } from 'lucide-react';

const Header = ({ onRefreshAll, refreshing }) => {
  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-left">
          <TrendingUp className="header-icon" />
          <h1>Stock News AI Summarizer</h1>
          <span className="beta-badge">BETA</span>
        </div>
        
        <div className="header-right">
          <div className="status-indicator">
            <div className="status-dot active"></div>
            <span>Live Data</span>
          </div>
          
          <button 
            className={`refresh-all-btn ${refreshing ? 'refreshing' : ''}`}
            onClick={onRefreshAll}
            disabled={refreshing}
          >
            <RefreshCw className={`refresh-icon ${refreshing ? 'spinning' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh All'}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;