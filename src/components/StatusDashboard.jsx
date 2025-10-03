import { useState, useEffect } from 'react';
import { Activity, Clock, Database, Zap } from 'lucide-react';

const StatusDashboard = ({ apiUrl }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial check immediately
    checkStatus();
    
    // More frequent checks initially, then every 30 seconds
    const quickInterval = setInterval(checkStatus, 5000); // Every 5 seconds for first minute
    const slowInterval = setTimeout(() => {
      clearInterval(quickInterval);
      const normalInterval = setInterval(checkStatus, 30000); // Then every 30 seconds
      return () => clearInterval(normalInterval);
    }, 60000);
    
    return () => {
      clearInterval(quickInterval);
      clearTimeout(slowInterval);
    };
  }, [apiUrl]);

  const checkStatus = async () => {
    try {
      console.log('🔍 StatusDashboard: Checking API status at:', `${apiUrl}/api/health`);
      const response = await fetch(`${apiUrl}/api/health`);
      console.log('📡 StatusDashboard: Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('✅ StatusDashboard: Received data:', data);
      setStatus(data);
    } catch (error) {
      console.error('❌ StatusDashboard: Status check failed:', error);
      console.error('🔍 Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const formatUptime = (seconds) => {
    if (!seconds) return 'Unknown';
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  if (loading) {
    return <div className="status-loading">Checking status...</div>;
  }

  return (
    <div className="status-dashboard">
      <div className="status-header">
        <Activity className="status-icon" />
        <h4>System Status</h4>
        <button 
          onClick={checkStatus} 
          className="refresh-status-btn"
          style={{ marginLeft: '10px', padding: '2px 8px', fontSize: '12px' }}
        >
          🔄 Refresh
        </button>
      </div>
      
      <div className="status-grid">
        <div className="status-item">
          <div className="status-indicator">
            <div className={`status-dot ${status ? 'online' : 'offline'}`}></div>
          </div>
          <div className="status-details">
            <span className="status-label">API Status</span>
            <span className="status-value">
              {status ? 'Online' : 'Offline'}
              {loading && ' (Checking...)'}
            </span>
            <div style={{ fontSize: '10px', opacity: 0.7 }}>
              URL: {apiUrl}/api/health
            </div>
          </div>
        </div>
        
        {status && (
          <>
            <div className="status-item">
              <Clock className="status-metric-icon" />
              <div className="status-details">
                <span className="status-label">Deployment</span>
                <span className="status-value">
                  {status.uptimeFormatted || formatUptime(status.deploymentAge || status.uptime)}
                </span>
              </div>
            </div>
            
            <div className="status-item">
              <Database className="status-metric-icon" />
              <div className="status-details">
                <span className="status-label">Last Update</span>
                <span className="status-value">
                  {new Date(status.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
            
            {status.deploymentInfo?.commitSha && (
              <div className="status-item">
                <Zap className="status-metric-icon" />
                <div className="status-details">
                  <span className="status-label">Deployment</span>
                  <span className="status-value">
                    {status.deploymentInfo.commitSha}
                  </span>
                  <div style={{ fontSize: '10px', opacity: 0.7 }}>
                    {status.deploymentInfo.commitMessage}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default StatusDashboard;