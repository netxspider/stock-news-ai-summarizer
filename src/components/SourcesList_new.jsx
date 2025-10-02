import { ExternalLink } from 'lucide-react';

const SourcesList = ({ sources, ticker }) => {
  if (!sources || sources.length === 0) {
    return (
      <div className="sources-panel">
        <h3>News Sources</h3>
        <p className="no-sources">No sources available</p>
      </div>
    );
  }

  return (
    <div className="sources-panel">
      <h3>News Sources for {ticker}</h3>
      <p className="sources-subtitle">Headlines from today's analysis ({sources.length} articles)</p>
      
      <div className="sources-list">
        {sources.map((source, index) => {
          if (!source || !source.headline) {
            return null;
          }

          const getValidUrl = (url) => {
            if (!url) return null;
            let validUrl = url.trim();
            if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
              validUrl = 'https://' + validUrl;
            }
            try {
              new URL(validUrl);
              return validUrl;
            } catch {
              return null;
            }
          };

          const getHostname = (url) => {
            if (!url) return 'No URL available';
            try {
              let urlToShow = url;
              if (!urlToShow.startsWith('http')) {
                urlToShow = 'https://' + urlToShow;
              }
              return new URL(urlToShow).hostname;
            } catch {
              const match = url.match(/https?:\/\/([^\/]+)/);
              return match ? match[1] : url.substring(0, 50) + '...';
            }
          };

          const validUrl = getValidUrl(source.url);

          return (
            <div key={index} className="source-item">
              <div className="source-header">
                <div className="source-content">
                  <h4 className="source-headline">{source.headline}</h4>
                  <div className="source-metadata">
                    {source.source && (
                      <span className={`source-label ${source.source.toLowerCase()}`}>
                        {source.source}
                      </span>
                    )}
                    {source.provider && source.provider !== source.source && (
                      <span className="provider-label">
                        via {source.provider}
                      </span>
                    )}
                    {source.timeAgo && (
                      <span className="time-ago">
                        {source.timeAgo}
                      </span>
                    )}
                  </div>
                </div>
                
                {validUrl ? (
                  <a 
                    href={validUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="source-link"
                    title="Read full article"
                  >
                    <ExternalLink className="link-icon" />
                  </a>
                ) : (
                  <span className="source-link disabled" title="Invalid URL">
                    <ExternalLink className="link-icon" />
                  </span>
                )}
              </div>
              
              <div className="source-meta">
                <span className="source-url">
                  {getHostname(source.url)}
                </span>
              </div>
            </div>
          );
        }).filter(Boolean)}
      </div>
    </div>
  );
};

export default SourcesList;