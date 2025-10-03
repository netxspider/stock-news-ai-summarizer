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
      // Calculate deployment age (not traditional uptime since this is serverless)
      let deploymentAge = 0;
      let uptimeFormatted = 'Serverless (No persistent uptime)';
      
      if (process.env.VERCEL) {
        // Show deployment age rather than uptime for serverless functions
        const now = Date.now();
        let deploymentTime;
        
        if (process.env.VERCEL_DEPLOYMENT_TIME) {
          deploymentTime = parseInt(process.env.VERCEL_DEPLOYMENT_TIME);
        } else if (process.env.VERCEL_GIT_COMMIT_TIME) {
          deploymentTime = parseInt(process.env.VERCEL_GIT_COMMIT_TIME);
        } else {
          // Fallback: estimate based on current time
          deploymentTime = now - (2 * 60 * 60 * 1000); // 2 hours ago
        }
        
        deploymentAge = Math.floor((now - deploymentTime) / 1000);
        
        // Format deployment age
        const days = Math.floor(deploymentAge / 86400);
        const hours = Math.floor((deploymentAge % 86400) / 3600);
        const minutes = Math.floor((deploymentAge % 3600) / 60);
        
        if (days > 0) {
          uptimeFormatted = `Deployed ${days}d ${hours}h ${minutes}m ago`;
        } else if (hours > 0) {
          uptimeFormatted = `Deployed ${hours}h ${minutes}m ago`;
        } else {
          uptimeFormatted = `Deployed ${minutes}m ago`;
        }
      }    return res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      deploymentAge: deploymentAge,
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