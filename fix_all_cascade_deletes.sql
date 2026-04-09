-- Fix: Add CASCADE delete to all tables with merchant_id foreign key
-- Run this in Supabase SQL Editor to allow deleting merchants with existing data

-- Drop and recreate foreign key constraints with CASCADE delete for each table

-- merchant_wallets
ALTER TABLE merchant_wallets 
DROP CONSTRAINT IF EXISTS merchant_wallets_merchant_id_fkey;
ALTER TABLE merchant_wallets 
ADD CONSTRAINT merchant_wallets_merchant_id_fkey 
FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE;

-- app_admins
ALTER TABLE app_admins 
DROP CONSTRAINT IF EXISTS app_admins_merchant_id_fkey;
ALTER TABLE app_admins 
ADD CONSTRAINT app_admins_merchant_id_fkey 
FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE;

-- machines
ALTER TABLE machines 
DROP CONSTRAINT IF EXISTS machines_merchant_id_fkey;
ALTER TABLE machines 
ADD CONSTRAINT machines_merchant_id_fkey 
FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE;

-- withdrawals
ALTER TABLE withdrawals 
DROP CONSTRAINT IF EXISTS withdrawals_merchant_id_fkey;
ALTER TABLE withdrawals 
ADD CONSTRAINT withdrawals_merchant_id_fkey 
FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE;

-- submission_reviews
ALTER TABLE submission_reviews 
DROP CONSTRAINT IF EXISTS submission_reviews_merchant_id_fkey;
ALTER TABLE submission_reviews 
ADD CONSTRAINT submission_reviews_merchant_id_fkey 
FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE;

-- wallet_transactions
ALTER TABLE wallet_transactions 
DROP CONSTRAINT IF EXISTS wallet_transactions_merchant_id_fkey;
ALTER TABLE wallet_transactions 
ADD CONSTRAINT wallet_transactions_merchant_id_fkey 
FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE;

-- cleaning_records (if exists)
ALTER TABLE cleaning_records 
DROP CONSTRAINT IF EXISTS cleaning_records_merchant_id_fkey;
ALTER TABLE cleaning_records 
ADD CONSTRAINT cleaning_records_merchant_id_fkey 
FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE;

-- autogcm_records (if exists)
ALTER TABLE autogcm_records 
DROP CONSTRAINT IF EXISTS autogcm_records_merchant_id_fkey;
ALTER TABLE autogcm_records 
ADD CONSTRAINT autogcm_records_merchant_id_fkey 
FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE;

-- Verify all constraints were added
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.table_name = tc.table_name AND ccu.column_name = kcu.column_name
JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND ccu.table_name = 'merchants';

-- After running this, you can simplify the deleteMerchant function to just:
-- await supabase.from('merchants').delete().eq('id', merchantId);
-- And the CASCADE will automatically delete all related records
