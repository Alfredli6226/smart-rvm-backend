import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const start = Date.now();

  try {
    // 1. Lightweight DB Query (Keeps DB connection warm)
    // asking for count is very fast and cheap
    const { count, error } = await supabase
      .from('machines')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    const duration = Date.now() - start;
    
    // Log this so you can see it in Vercel Logs if you ever need to debug
    console.log(`💓 Heartbeat Success! Duration: ${duration}ms`);
    
    return res.status(200).json({ 
      status: 'Alive', 
      db_status: 'Connected', 
      duration: `${duration}ms` 
    });

  } catch (error: any) {
    console.error("💔 Heartbeat Failed:", error.message);
    return res.status(500).json({ error: error.message });
  }
}