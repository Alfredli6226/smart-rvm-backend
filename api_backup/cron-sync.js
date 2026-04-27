import { runScheduledSync } from './data-sync.js';

// This is a serverless function that can be called by Vercel Cron or similar
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Verify cron secret (for security)
  const cronSecret = req.headers['x-cron-secret'] || req.query.secret;
  const expectedSecret = process.env.CRON_SECRET;
  
  if (expectedSecret && cronSecret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('Cron job triggered:', new Date().toISOString());
    
    // Run the scheduled sync
    const result = await runScheduledSync();
    
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      result
    });
  } catch (error) {
    console.error('Cron job failed:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// For direct execution (e.g., via node)
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Running cron sync directly...');
  runScheduledSync()
    .then(result => {
      console.log('Cron sync completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Cron sync failed:', error);
      process.exit(1);
    });
}