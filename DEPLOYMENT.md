# Stock News AI Summarizer Deployment Guide

## Cloud Hosting Options (Under $5/month)

### 1. Railway (Recommended)
- **Cost**: $5/month for hobby plan
- **Features**: Automatic deployments, environment variables, custom domains
- **Setup**:
  1. Connect GitHub repository to Railway
  2. Set environment variables in Railway dashboard
  3. Deploy both frontend and backend

### 2. Render
- **Cost**: Free tier available, $7/month for paid plans
- **Features**: Auto-deploy from Git, custom domains, environment variables
- **Setup**:
  1. Create web service for backend (Node.js)
  2. Create static site for frontend
  3. Set environment variables

### 3. Vercel + Railway/Heroku
- **Cost**: Vercel free + Railway $5/month = $5/month total
- **Frontend**: Deploy to Vercel (free)
- **Backend**: Deploy to Railway or Heroku

### 4. DigitalOcean App Platform
- **Cost**: $5/month for basic droplet
- **Features**: Managed hosting, automatic scaling

## Deployment Steps

### Frontend (Vercel)
1. Push code to GitHub
2. Connect repository to Vercel
3. Set environment variables:
   - `VITE_API_URL=https://your-backend-url.com`
4. Deploy automatically

### Backend (Railway)
1. Create new project on Railway
2. Connect GitHub repository
3. Set environment variables:
   - `POLYGON_API_KEY=your_key`
   - `GEMINI_API_KEY=your_key`
   - `PORT=3001`
4. Deploy from `server/` directory

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