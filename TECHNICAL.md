# Stock News AI Summarizer - Technical Documentation

## Architecture Overview

### System Components

1. **Frontend (React + Vite)**
   - Modern React application with functional components and hooks
   - Real-time updates and state management
   - Professional UI with responsive design
   - Lucide React icons for modern iconography

2. **Backend (Express.js)**
   - RESTful API with automated news collection
   - AI processing with Google Gemini Pro 2.5
   - Scheduled updates using node-cron
   - File-based data storage for cost efficiency

3. **Data Collection Engine**
   - Multi-source web scraping (TradingView, Finviz)
   - Polygon API integration
   - Intelligent deduplication
   - Error handling and fallbacks

4. **AI Processing Pipeline**
   - Two-stage AI processing
   - Article selection based on credibility
   - Comprehensive summary generation
   - Historical context analysis

## API Endpoints

### Tickers Management
- `GET /api/tickers` - Get all tracked tickers
- `POST /api/tickers` - Add new ticker
- `DELETE /api/tickers/:ticker` - Remove ticker

### News Summaries
- `GET /api/summaries` - Get latest summaries for all tickers
- `GET /api/summaries/:ticker` - Get historical summaries for ticker

### Data Updates
- `POST /api/refresh/:ticker` - Manual refresh for specific ticker
- `POST /api/refresh-all` - Manual refresh for all tickers

### System
- `GET /api/health` - Health check endpoint

## Data Flow

1. **Collection Phase**
   - Scrape TradingView news pages
   - Scrape Finviz quote pages  
   - Fetch Polygon API news
   - Deduplicate and sort by recency

2. **Selection Phase**
   - AI analyzes all articles
   - Selects top 5-7 based on credibility and relevance
   - Prioritizes Polygon > Finviz > TradingView

3. **Summary Phase**
   - AI generates comprehensive summary
   - Creates "What Changed Today" section
   - Extracts key points and sentiment
   - Assesses market impact

4. **Storage Phase**
   - Stores in local JSON files
   - Maintains 7-day rolling history
   - Automatic cleanup of old data

## Configuration

### Environment Variables

```env
# API Keys
POLYGON_API_KEY=your_polygon_key
GEMINI_API_KEY=your_gemini_key

# Server Configuration  
PORT=3001
VITE_API_URL=http://localhost:3001
```

### Rate Limiting

- **Gemini API**: 15 requests/minute
- **Polygon API**: 5 calls/minute  
- **News Scraping**: 2-second delays between requests
- **Caching**: 5-minute cache expiry

## Cost Optimization Strategies

### API Usage
- Intelligent caching reduces API calls
- Rate limiting prevents quota overuse
- Batch processing for efficiency
- Error handling with graceful degradation

### Hosting
- Stateless backend for horizontal scaling
- File-based storage (no database costs)
- Efficient bundling and code splitting
- Minimal dependencies

### Automation
- Single daily update cycle
- Smart scheduling (8 AM IST)
- Sequential processing with delays
- Automatic cleanup routines

## Deployment Architecture

### Production Setup
```
Frontend (Vercel/Netlify) -> Backend (Railway/Render) -> APIs (Polygon/Gemini)
                           -> File Storage (Local JSON)
```

### Monitoring
- Health check endpoints
- Error logging and alerting  
- Performance metrics
- API quota monitoring

## Security Features

### Data Protection
- Environment variable isolation
- No sensitive data in client code
- CORS configuration
- Input validation and sanitization

### Rate Protection
- Built-in throttling mechanisms
- Graceful error handling
- Circuit breaker patterns
- Automatic retries with backoff

## Performance Features

### Frontend Optimization
- Code splitting with manual chunks
- Lazy loading of components
- Efficient state management
- Optimized bundle sizes

### Backend Optimization  
- Response caching
- Connection pooling
- Memory-efficient data structures
- Garbage collection optimization

## Error Handling

### Graceful Degradation
- Fallback summaries when AI fails
- Alternative data sources
- Cached responses for outages
- User-friendly error messages

### Monitoring & Alerting
- Structured logging
- Error tracking
- Performance monitoring
- Uptime monitoring

## Scaling Considerations

### Horizontal Scaling
- Stateless backend design
- Load balancer ready
- Database-free architecture
- Container-friendly setup

### Vertical Scaling
- Efficient memory usage
- CPU optimization
- I/O optimization
- Resource monitoring

## Future Enhancements

### Features
- Email/SMS notifications
- Portfolio tracking integration
- Advanced sentiment analysis
- Technical analysis integration

### Technical
- Database migration path
- WebSocket real-time updates
- Mobile app companion
- Advanced caching strategies