// Fix RLS on Supabase tables - run with service_role key
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://aultuckuvussdyynglkj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bHR1Y2t1dnVzc2R5eW5nbGtqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTg1MjAxNSwiZXhwIjoyMDkxNDI4MDE1fQ.d2S3WymfuQOiu_nzl6AHI_fwsQroM78LXykXR4XcMWA';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  const sqlCommands = [
    'ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;',
    'ALTER TABLE public.machines DISABLE ROW LEVEL SECURITY;',
    'ALTER TABLE public.submission_reviews DISABLE ROW LEVEL SECURITY;',
    'ALTER TABLE public.withdrawals DISABLE ROW LEVEL SECURITY;',
    'ALTER TABLE public.merchant_wallets DISABLE ROW LEVEL SECURITY;',
    'ALTER TABLE public.wallet_transactions DISABLE ROW LEVEL SECURITY;',
    'ALTER TABLE public.cleaning_records DISABLE ROW LEVEL SECURITY;',
  ];

  for (const sql of sqlCommands) {
    // Use REST API SQL endpoint
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql })
    });
    const text = await res.text();
    console.log(`${res.status}: ${sql.trim().substring(0, 40)}... => ${text.substring(0, 80)}`);
  }
}

main().catch(console.error);
