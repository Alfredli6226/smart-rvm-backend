// API endpoint to populate Supabase with our backend data
// Call: GET /api/populate-data?action=populate-users

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action } = req.query;

  if (action !== 'populate-users') {
    return res.status(400).json({ error: 'Invalid action. Use ?action=populate-users' });
  }

  try {
    // Get Supabase credentials from environment
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ 
        error: 'Supabase credentials missing',
        details: 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in environment'
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Our mock users data (from combined backend)
    const mockUsers = [
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

    console.log('Starting Supabase population...');

    // Check existing users
    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (checkError) {
      console.error('Supabase check error:', checkError);
      return res.status(500).json({ 
        error: 'Supabase connection failed',
        details: checkError.message 
      });
    }

    let insertedCount = 0;
    let skippedCount = 0;

    // Insert users
    for (const user of mockUsers) {
      // Check if user already exists
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`User ${user.nickname} already exists, skipping`);
        skippedCount++;
        continue;
      }

      // Insert new user
      const { error: insertError } = await supabase
        .from('users')
        .insert(user);

      if (insertError) {
        console.error(`Error inserting ${user.nickname}:`, insertError.message);
      } else {
        console.log(`✅ Inserted: ${user.nickname}`);
        insertedCount++;
      }
    }

    console.log(`Population complete: ${insertedCount} inserted, ${skippedCount} skipped`);

    return res.status(200).json({
      success: true,
      message: `Supabase populated with ${insertedCount} users`,
      details: {
        inserted: insertedCount,
        skipped: skippedCount,
        total: mockUsers.length,
        timestamp: new Date().toISOString()
      },
      next_step: 'Refresh https://rvm-merchant-platform-main.vercel.app/login to see users'
    });

  } catch (error) {
    console.error('Population error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
};