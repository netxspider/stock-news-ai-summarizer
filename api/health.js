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
    return res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      environment: {
        hasPolygonKey: !!process.env.POLYGON_API_KEY,
        hasGeminiKey: !!process.env.GEMINI_API_KEY,
        useRealAI: process.env.USE_REAL_AI === 'true',
        nodeEnv: process.env.NODE_ENV,
        isVercel: !!process.env.VERCEL
      },
      message: 'API is working!'
    });
  }

  res.status(405).json({ error: 'Method not allowed' });
}