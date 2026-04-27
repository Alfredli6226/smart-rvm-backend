// Script to populate Supabase with mock users data
// This will make the frontend show users (since it queries Supabase directly)

const { createClient } = require('@supabase/supabase-js');

// Mock users data (same as our combined backend)
const MOCK_USERS = [
  {
    id: '1173008',
    nickname: 'Sindylee',
    phone: 'N/A',
    total_weight: 125.6,
    total_points: 1256,
    status: 'active',
    created_at: '2026-03-10T14:30:00Z',
    updated_at: '2026-03-10T14:30:00Z',
    vendor_internal_id: '1173008'
  },
  {
    id: '1404752',
    nickname: 'EcoWarrior',
    phone: 'N/A',
    total_weight: 98.3,
    total_points: 983,
    status: 'active',
    created_at: '2026-03-11T09:15:00Z',
    updated_at: '2026-03-11T09:15:00Z',
    vendor_internal_id: '1404752'
  },
  {
    id: '1378848',
    nickname: 'GreenHero',
    phone: 'N/A',
    total_weight: 87.2,
    total_points: 872,
    status: 'active',
    created_at: '2026-03-12T11:45:00Z',
    updated_at: '2026-03-12T11:45:00Z',
    vendor_internal_id: '1378848'
  },
  {
    id: '1378850',
    nickname: 'RecycleKing',
    phone: 'N/A',
    total_weight: 76.5,
    total_points: 765,
    status: 'active',
    created_at: '2026-03-13T16:20:00Z',
    updated_at: '2026-03-13T16:20:00Z',
    vendor_internal_id: '1378850'
  },
  {
    id: '1380001',
    nickname: 'EarthSaver',
    phone: 'N/A',
    total_weight: 65.8,
    total_points: 658,
    status: 'active',
    created_at: '2026-03-14T08:30:00Z',
    updated_at: '2026-03-14T08:30:00Z',
    vendor_internal_id: '1380001'
  },
  {
    id: '1380002',
    nickname: 'PlasticFree',
    phone: 'N/A',
    total_weight: 54.3,
    total_points: 543,
    status: 'active',
    created_at: '2026-03-15T13:10:00Z',
    updated_at: '2026-03-15T13:10:00Z',
    vendor_internal_id: '1380002'
  },
  {
    id: '1380003',
    nickname: 'GreenMachine',
    phone: 'N/A',
    total_weight: 43.7,
    total_points: 437,
    status: 'active',
    created_at: '2026-03-16T10:25:00Z',
    updated_at: '2026-03-16T10:25:00Z',
    vendor_internal_id: '1380003'
  },
  {
    id: '1380004',
    nickname: 'EcoFriendly',
    phone: 'N/A',
    total_weight: 32.9,
    total_points: 329,
    status: 'active',
    created_at: '2026-03-17T15:40:00Z',
    updated_at: '2026-03-17T15:40:00Z',
    vendor_internal_id: '1380004'
  },
  {
    id: '1380005',
    nickname: 'WasteWarrior',
    phone: 'N/A',
    total_weight: 21.5,
    total_points: 215,
    status: 'active',
    created_at: '2026-03-18T12:05:00Z',
    updated_at: '2026-03-18T12:05:00Z',
    vendor_internal_id: '1380005'
  },
  {
    id: '1380006',
    nickname: 'RecyclePro',
    phone: 'N/A',
    total_weight: 15.2,
    total_points: 152,
    status: 'active',
    created_at: '2026-03-19T17:30:00Z',
    updated_at: '2026-03-19T17:30:00Z',
    vendor_internal_id: '1380006'
  }
];

async function populateSupabase() {
  console.log('🚀 Starting Supabase population...');
  
  // Get Supabase credentials from environment
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in environment variables');
    console.log('Please set:');
    console.log('  - VITE_SUPABASE_URL');
    console.log('  - SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  
  try {
    // First, check if users table exists and has data
    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    if (checkError) {
      console.error('❌ Error checking users table:', checkError.message);
      console.log('Make sure the Supabase project has the users table created.');
      process.exit(1);
    }
    
    if (existingUsers && existingUsers.length > 0) {
      console.log(`✅ Users table already has ${existingUsers.length} users`);
      console.log('Skipping population (data already exists)');
      return;
    }
    
    console.log('📝 Inserting mock users into Supabase...');
    
    // Insert users in batches
    for (let i = 0; i < MOCK_USERS.length; i += 5) {
      const batch = MOCK_USERS.slice(i, i + 5);
      
      const { data, error } = await supabase
        .from('users')
        .insert(batch)
        .select();
      
      if (error) {
        console.error(`❌ Error inserting batch ${i/5 + 1}:`, error.message);
      } else {
        console.log(`✅ Inserted batch ${i/5 + 1}: ${data.length} users`);
      }
    }
    
    console.log('🎉 Supabase population completed!');
    console.log(`✅ Total users inserted: ${MOCK_USERS.length}`);
    console.log('');
    console.log('🔗 Now visit: https://rvm-merchant-platform-main.vercel.app/login');
    console.log('   The Users section should now show data!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

// Run the population
populateSupabase();