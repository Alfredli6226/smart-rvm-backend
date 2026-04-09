-- Restore Sunway College as a merchant
-- Run this SQL in your Supabase SQL Editor to restore the Sunway College merchant

-- First, let's check the actual columns in the merchants table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'merchants';

-- Check if there are any machines that might have been linked to Sunway College
SELECT 
    m.device_no, 
    m.name as machine_name, 
    m.merchant_id
FROM machines m
WHERE m.merchant_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM merchants WHERE id = m.merchant_id);

-- Insert Sunway College merchant (use a fixed UUID for consistency)
INSERT INTO merchants (
    id,
    name,
    currency_symbol,
    rate_plastic,
    is_active,
    created_at
)
VALUES (
    '11111111-1111-1111-1111-111111111111',  -- Fixed UUID for easy identification
    'Sunway College',
    'RM',
    0.50,  -- rate_plastic per kg
    true,  -- is_active
    NOW()
)
ON CONFLICT DO NOTHING;

-- If the above conflict occurred, let's get the existing ID
SELECT id, name, currency_symbol, is_active, created_at 
FROM merchants 
WHERE name ILIKE '%sunway%';
