// ===== Withdrawal Request — Creates record in withdrawals table =====
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, msg: 'Method not allowed' });

  const { phone, amount, userId } = req.body || {};

  if (!amount || amount <= 0) return res.status(400).json({ success: false, msg: 'Invalid amount' });
  if (!phone && !userId) return res.status(400).json({ success: false, msg: 'Phone or user ID required' });

  // Round to whole number
  const finalAmount = Math.floor(Number(amount));

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    let userRecord = null;
    let finalUserId = userId;

    // Look up user by phone if no userId provided
    if (!finalUserId && phone) {
      const { data: users } = await supabase
        .from('users')
        .select('id, user_id')
        .eq('phone', phone)
        .limit(1);

      if (users && users.length > 0) {
        finalUserId = users[0].id;
      } else {
        // Try without leading 0
        const altPhone = phone.startsWith('0') ? phone.substring(1) : '0' + phone;
        const { data: altUsers } = await supabase
          .from('users')
          .select('id, user_id')
          .eq('phone', altPhone)
          .limit(1);
        if (altUsers && altUsers.length > 0) {
          finalUserId = altUsers[0].id;
        }
      }
    }

    // Get default merchant ID
    if (!finalUserId) {
      // Create a withdrawal record with just the phone as identifier
      const { data: insertRes, error } = await supabase
        .from('withdrawals')
        .insert({
          user_id: phone || 'unknown',
          merchant_id: '11111111-1111-1111-1111-111111111111',
          amount: finalAmount,
          status: 'PENDING',
        })
        .select();

      if (error) return res.status(500).json({ success: false, msg: 'Database error' });

      return res.json({ success: true, msg: 'Withdrawal recorded', id: insertRes?.[0]?.id });
    }

    // Get merchant ID from user's wallets
    const { data: wallets } = await supabase
      .from('merchant_wallets')
      .select('merchant_id')
      .eq('user_id', finalUserId)
      .limit(1);

    const merchantId = wallets?.[0]?.merchant_id || '11111111-1111-1111-1111-111111111111';

    // Create withdrawal record
    const { data: insertRes, error } = await supabase
      .from('withdrawals')
      .insert({
        user_id: finalUserId,
        merchant_id: merchantId,
        amount: finalAmount,
        status: 'PENDING',
      })
      .select();

    if (error) return res.status(500).json({ success: false, msg: 'Database error: ' + error.message });

    return res.json({ success: true, msg: 'Withdrawal recorded', id: insertRes?.[0]?.id });
  } catch (err) {
    console.error('Withdrawal error:', err);
    return res.status(500).json({ success: false, msg: 'Internal error' });
  }
}
