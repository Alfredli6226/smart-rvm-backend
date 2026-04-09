-- Fix: Add CASCADE delete to submission_reviews table
-- This will automatically delete related reviews when a merchant is deleted

-- Drop existing foreign key constraint
ALTER TABLE submission_reviews 
DROP CONSTRAINT IF EXISTS submission_reviews_merchant_id_fkey;

-- Add new constraint with CASCADE delete
ALTER TABLE submission_reviews 
ADD CONSTRAINT submission_reviews_merchant_id_fkey 
FOREIGN KEY (merchant_id) 
REFERENCES merchants(id) 
ON DELETE CASCADE;

-- Verify the constraint was added
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
    ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'submission_reviews';
