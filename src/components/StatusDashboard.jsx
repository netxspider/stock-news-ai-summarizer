import { useState, useEffect } from 'react';
import { Activity, Clock, Database, Zap } from 'lucide-react';

const StatusDashboard = ({ apiUrl }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [apiUrl]);

  const checkStatus = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/health`);
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Status check failed:', error);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const formatUptime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return <div className="status-loading">Checking status...</div>;
  }

  return (
    <div className="status-dashboard">
      <div className="status-header">
        <Activity className="status-icon" />
        <h4>System Status</h4>
      </div>
      
      <div className="status-grid">
        <div className="status-item">
          <div className="status-indicator">
            <div className={`status-dot ${status ? 'online' : 'offline'}`}></div>
          </div>
          <div className="status-details">
            <span className="status-label">API Status</span>
            <span className="status-value">{status ? 'Online' : 'Offline'}</span>
          </div>
        </div>
        
        {status && (
          <>
            <div className="status-item">
              <Clock className="status-metric-icon" />
              <div className="status-details">
                <span className="status-label">Uptime</span>
                <span className="status-value">{formatUptime(status.uptime)}</span>
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
          </>
        )}
      </div>
    </div>
  );
};

export default StatusDashboard;