// Fallback users API that returns our combined backend data
// This can be used if Supabase is empty

module.exports = async function handler(req, res) {
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
    return res.status(200).end();
  }

  // Mock data from our combined backend
  const MOCK_USERS = [
    { id: '1173008', nickname: 'Sindylee', phone: 'N/A', total_weight: 125.6, total_points: 1256, status: 'active', created_at: '2026-03-10T14:30:00Z' },
    { id: '1404752', nickname: 'EcoWarrior', phone: 'N/A', total_weight: 98.3, total_points: 983, status: 'active', created_at: '2026-03-11T09:15:00Z' },
    { id: '1378848', nickname: 'GreenHero', phone: 'N/A', total_weight: 87.2, total_points: 872, status: 'active', created_at: '2026-03-12T11:45:00Z' },
    { id: '1378850', nickname: 'RecycleKing', phone: 'N/A', total_weight: 76.5, total_points: 765, status: 'active', created_at: '2026-03-13T16:20:00Z' },
    { id: '1380001', nickname: 'EarthSaver', phone: 'N/A', total_weight: 65.8, total_points: 658, status: 'active', created_at: '2026-03-14T08:30:00Z' },
    { id: '1380002', nickname: 'PlasticFree', phone: 'N/A', total_weight: 54.3, total_points: 543, status: 'active', created_at: '2026-03-15T13:10:00Z' },
    { id: '1380003', nickname: 'GreenMachine', phone: 'N/A', total_weight: 43.7, total_points: 437, status: 'active', created_at: '2026-03-16T10:25:00Z' },
    { id: '1380004', nickname: 'EcoFriendly', phone: 'N/A', total_weight: 32.9, total_points: 329, status: 'active', created_at: '2026-03-17T15:40:00Z' },
    { id: '1380005', nickname: 'WasteWarrior', phone: 'N/A', total_weight: 21.5, total_points: 215, status: 'active', created_at: '2026-03-18T12:05:00Z' },
    { id: '1380006', nickname: 'RecyclePro', phone: 'N/A', total_weight: 15.2, total_points: 152, status: 'active', created_at: '2026-03-19T17:30:00Z' }
  ];

  try {
    // Parse query parameters
    const { limit = 20, offset = 0, filter_type = 'all' } = req.query;
    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);

    let filteredUsers = [...MOCK_USERS];

    // Apply filters
    switch (filter_type) {
      case 'top_recyclers':
        filteredUsers = filteredUsers
          .filter(user => user.total_weight > 0)
          .sort((a, b) => b.total_weight - a.total_weight);
        break;
      case 'new_registers':
        filteredUsers = filteredUsers
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'active':
        filteredUsers = filteredUsers.filter(user => user.status === 'active');
        break;
      // 'all' - no filter needed
    }

    // Apply pagination
    const paginatedUsers = filteredUsers.slice(offsetNum, offsetNum + limitNum);

    // Return data in format frontend expects
    return res.status(200).json({
      success: true,
      data: paginatedUsers,
      pagination: {
        filter_type,
        limit: limitNum,
        offset: offsetNum,
        total: filteredUsers.length
      }
    });

  } catch (error) {
    console.error('Users fallback API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};