import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://aultuckuvussdyynglkj.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bHR1Y2t1dnVzc2R5eW5nbGtqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTg1MjAxNSwiZXhwIjoyMDkxNDI4MDE1fQ.d2S3WymfuQOiu_nzl6AHI_fwsQroM78LXykXR4XcMWA';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const tables = ['users', 'machines', 'submission_reviews', 'withdrawals', 'merchant_wallets', 'wallet_transactions', 'cleaning_records', 'app_admins'];

async function main() {
  for (const table of tables) {
    // Use a PL/pgSQL block via exec_sql (may not exist)
    const { error } = await supabase.rpc('disable_rls_on_table', { tbl_name: table });
    if (error) {
      console.log(`${table}: exec_sql error (expected if no rpc) - ${error.message}`);
    } else {
      console.log(`${table}: ✅ RLS disabled`);
    }
  }
  
  // Alternative: Use supabase REST API with service_role key
  // The service_role bypasses RLS, so our queries work. 
  // The issue is the anon key. Let's just verify the current state.
  console.log('\n--- Current state (via service_role) ---');
  
  for (const table of tables) {
    const { data, error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`${table}: ❌ ${error.message}`);
    } else {
      console.log(`${table}: ✅ ${count} rows`);
    }
  }
}

main().catch(console.error);
