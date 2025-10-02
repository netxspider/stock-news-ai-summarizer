// Simple health check endpoint for Vercel
export default function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    // Calculate uptime for production deployment
    let uptime = 0;
    let uptimeFormatted = 'Unknown';
    
    if (process.env.VERCEL) {
      // In Vercel, use deployment timestamp or fallback calculation
      const deploymentTime = process.env.VERCEL_DEPLOYMENT_TIME || 
                            process.env.VERCEL_GIT_COMMIT_TIME ||
                            Date.now() - (24 * 60 * 60 * 1000); // Fallback to 24h ago
      
      uptime = Math.floor((Date.now() - parseInt(deploymentTime)) / 1000);
      
      // Format uptime nicely
      const days = Math.floor(uptime / 86400);
      const hours = Math.floor((uptime % 86400) / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      
      if (days > 0) {
        uptimeFormatted = `${days}d ${hours}h ${minutes}m`;
      } else if (hours > 0) {
        uptimeFormatted = `${hours}h ${minutes}m`;
      } else {
        uptimeFormatted = `${minutes}m`;
      }
    }
    
    return res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: uptime,
      uptimeFormatted: uptimeFormatted,
      deploymentInfo: {
        deploymentTime: process.env.VERCEL_DEPLOYMENT_TIME,
        commitSha: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7),
        commitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE?.substring(0, 50),
        branch: process.env.VERCEL_GIT_COMMIT_REF
      },
      environment: {
        hasPolygonKey: !!process.env.POLYGON_API_KEY,
        hasGeminiKey: !!process.env.GEMINI_API_KEY,
        useRealAI: process.env.USE_REAL_AI === 'true',
        nodeEnv: process.env.NODE_ENV,
        isVercel: !!process.env.VERCEL,
        region: process.env.VERCEL_REGION
      },
      message: 'API is working!'
    });
  }

  res.status(405).json({ error: 'Method not allowed' });
}