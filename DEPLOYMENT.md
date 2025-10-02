# Stock News AI Summarizer Deployment Guide

## Vercel Deployment (Recommended - FREE)

### Why Vercel?
- **Cost**: 100% FREE for this project
- **Features**: Serverless functions, automatic deployments, CDN
- **Architecture**: Full-stack deployment (frontend + backend API)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/netxspider/stock-news-ai-summarizer)

## Quick Deployment Steps

### 1. One-Click Deploy
```bash
# Click the Deploy button above OR manually:
npx vercel --prod
```

### 2. Set Environment Variables in Vercel Dashboard
**Required Environment Variables:**
- `GEMINI_API_KEY` - Your Google Gemini API key
- `POLYGON_API_KEY` - Your Polygon.io API key
- `USE_REAL_AI` - Set to `true`
- `NODE_ENV` - Set to `production`

### 3. Get API Keys (Free)

#### Google Gemini API
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create API key
3. Copy to Vercel environment variables

#### Polygon.io API  
1. Sign up at [Polygon.io](https://polygon.io/)
2. Get free API key (5 calls/minute)
3. Copy to Vercel environment variables

## Environment Variables

### Production Frontend (.env.production)
```
VITE_API_URL=https://your-backend-url.com
```

### Production Backend
```
POLYGON_API_KEY=your_polygon_key
GEMINI_API_KEY=your_gemini_key
PORT=3001
NODE_ENV=production
```

## Cost Optimization

### API Usage Limits
- **Gemini API**: 15 requests/minute (free tier)
- **Polygon API**: 5 calls/minute (free tier)
- **Caching**: 5-minute cache for news data

### Scheduled Updates
- Runs once daily at 8 AM IST
- Processes all tickers sequentially
- 2-second delay between requests

### Data Storage
- Uses local JSON files (no database costs)
- Keeps only 7 days of history per ticker
- Automatic cleanup of old data

## Monitoring

### Health Check Endpoint
```
GET /api/health
```

### Log Monitoring
- Server logs API errors
- Rate limiting status
- Processing completion times

## Security

### Rate Limiting
- Built-in request throttling
- Cache to reduce API calls
- Graceful error handling

### Environment Variables
- API keys stored securely
- No sensitive data in client-side code
- CORS configuration for production