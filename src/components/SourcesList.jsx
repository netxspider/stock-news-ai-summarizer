import { ExternalLink } from 'lucide-react';

const SourcesList = ({ sources, ticker }) => {
  // Debug logging
  console.log('SourcesList received:', { sources, ticker });

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
      <p className="sources-subtitle">Headlines used for today's summary ({sources.length} sources)</p>
      
      <div className="sources-list">
        {sources.map((source, index) => {
          // Debug each source
          console.log(`Source ${index}:`, source);
          
          // Ensure we have valid source data
          if (!source || !source.headline) {
            console.warn(`Invalid source at index ${index}:`, source);
            return null;
          }

          return (
            <div key={index} className="source-item">
              <div className="source-header">
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
                {(() => {
                  // Validate and fix URL before rendering link
                  if (!source.url) {
                    console.warn(`No URL for source ${index}`);
                    return null;
                  }
                  
                  let validUrl = source.url.trim();
                  console.log(`Processing URL for source ${index}:`, validUrl);
                  
                  // Add protocol if missing
                  if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
                    validUrl = 'https://' + validUrl;
                    console.log(`Added protocol: ${validUrl}`);
                  }
                  
                  try {
                    // Test if URL is valid
                    new URL(validUrl);
                    console.log(`Valid URL created: ${validUrl}`);
                    return (
                      <a 
                        href={validUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="source-link"
                        onClick={(e) => {
                          console.log('Link clicked:', validUrl);
                          // Allow default behavior
                        }}
                      >
                        <ExternalLink className="link-icon" />
                      </a>
                    );
                  } catch (error) {
                    console.warn('Invalid URL after processing:', validUrl, error);
                    return (
                      <span className="source-link disabled" title={`Invalid URL: ${source.url}`}>
                        <ExternalLink className="link-icon" />
                      </span>
                    );
                  }
                })()}
              </div>
              
              <div className="source-meta">
                <span className="source-url">
                  {(() => {
                    if (!source.url) return 'No URL available';
                    try {
                      let urlToShow = source.url;
                      if (!urlToShow.startsWith('http')) {
                        urlToShow = 'https://' + urlToShow;
                      }
                      return new URL(urlToShow).hostname;
                    } catch (error) {
                      // Fallback for invalid URLs - try to extract domain manually
                      const match = source.url.match(/https?:\/\/([^\/]+)/);
                      return match ? match[1] : source.url.substring(0, 50) + '...';
                    }
                  })()}
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