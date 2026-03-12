import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import crypto from 'crypto';

const API_BASE = "https://api.autogcm.com";

// Helper for AutoGCM Call
async function fetchAutoGCMBalance(phone: string, merchantNo: string, secret: string) {
    const timestamp = Date.now().toString();
    const sign = crypto.createHash('md5').update(merchantNo + secret + timestamp).digest('hex');
    try {
        const res = await axios.post(API_BASE + '/api/open/v1/user/account/sync', { phone }, {
            headers: { "merchant-no": merchantNo, "timestamp": timestamp, "sign": sign },
            timeout: 5000
        });
        return { phone, balance: Number(res?.data?.data?.integral || 0), error: null };
    } catch (e) { 
        return { phone, balance: 0, error: true }; 
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // ... CORS Headers ...
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    // Support both array (Batch) and single object (Single Sync)
    let users = req.body.users;
    if (!users && req.body.userId) {
        users = [{ userId: req.body.userId, phone: req.body.phone }];
    }

    if (!users || !Array.isArray(users)) return res.status(400).json({ error: "Invalid payload" });

    const userIds = users.map(u => u.userId);
    const results = [];

    try {
        // 1. EXTERNAL: Fetch AutoGCM Balances
        const merchantNo = process.env.VITE_MERCHANT_NO!;
        const secret = process.env.VITE_API_SECRET!;
        
        const vendorPromises = users.map(u => fetchAutoGCMBalance(u.phone, merchantNo, secret));
        const vendorResults = await Promise.all(vendorPromises);
        const vendorMap = new Map(vendorResults.map(i => [i.phone, i]));

        // 2. INTERNAL: Bulk Fetch Supabase Data
        const { data: reviews } = await supabase.from('submission_reviews')
            .select('user_id, calculated_value')
            .in('user_id', userIds)
            .eq('status', 'VERIFIED');
            
        const { data: externalTxns } = await supabase.from('wallet_transactions')
            .select('user_id, amount')
            .in('user_id', userIds)
            .eq('transaction_type', 'EXTERNAL_SPEND');

        // We count EXTERNAL_SYNC withdrawals to ensure our math is correct
        const { data: externalWithdrawals } = await supabase.from('withdrawals')
            .select('user_id, amount')
            .in('user_id', userIds)
            .eq('account_number', 'EXTERNAL_SYNC') 
            .neq('status', 'REJECTED');

        const { data: wallets } = await supabase.from('merchant_wallets')
            .select('id, user_id, merchant_id, current_balance')
            .in('user_id', userIds);

        // 3. PROCESS EACH USER
        for (const user of users) {
            const vendorData = vendorMap.get(user.phone);
            if (vendorData?.error) {
                results.push({ userId: user.userId, status: 'ERROR', msg: 'AutoGCM API Failed' });
                continue;
            }

            const vendorBalance = vendorData!.balance;

            // --- CALCULATE MIRROR BALANCE ---
            const userReviews = reviews?.filter(r => r.user_id === user.userId) || [];
            const userTxns = externalTxns?.filter(t => t.user_id === user.userId) || [];
            const userWithdrawals = externalWithdrawals?.filter(w => w.user_id === user.userId) || [];
            
            const totalEarned = userReviews.reduce((sum, r) => sum + Number(r.calculated_value), 0);
            const oldSpent = userTxns.reduce((sum, t) => sum + Number(t.amount), 0);
            const newSpent = userWithdrawals.reduce((sum, w) => sum + Number(w.amount), 0);
            
            const comparisonBalance = Number((totalEarned + oldSpent - newSpent).toFixed(2));
            const diff = Number((vendorBalance - comparisonBalance).toFixed(2));

            // --- AUTOMATIC DEDUCTION LOGIC ---
            if (diff < -0.5) {
                // User spent points externally.
                const wallet = wallets?.find(w => w.user_id === user.userId);
                
                if (wallet) {
                    const adjustment = Math.abs(diff);

                    // A. Update Wallet IMMEDIATELY (Deduct Points)
                    const { error: walletError } = await supabase.from('merchant_wallets')
                        .update({ current_balance: wallet.current_balance - adjustment })
                        .eq('id', wallet.id);

                    if (!walletError) {
                        // B. Insert History Record
                        // ✅ FIX: Removed 'admin_note' which caused the crash
                        await supabase.from('withdrawals').insert({
                            user_id: user.userId,
                            merchant_id: wallet.merchant_id,
                            amount: adjustment,
                            status: 'EXTERNAL_SYNC',
                            bank_name: 'AutoGCM App',
                            account_number: 'EXTERNAL_SYNC',
                            account_holder_name: 'External Spending'
                        });
                        
                        results.push({ userId: user.userId, status: 'RISK_DETECTED', adjustment, msg: 'Auto-deducted' });
                    } else {
                        results.push({ userId: user.userId, status: 'DB_ERROR' });
                    }
                } else {
                     results.push({ userId: user.userId, status: 'MISSING_WALLET' });
                }
            } else if (diff > 0.5) {
                results.push({ userId: user.userId, status: 'MISSING_RECORDS' });
            } else {
                results.push({ userId: user.userId, status: 'MATCHED' });
            }
        }

        return res.json({ results });

    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}