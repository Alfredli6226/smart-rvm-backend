-- ===========================================
-- User Management Schema Updates
-- ===========================================

-- 1. Add status enum column to users table (handles if already exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'status'
    ) THEN
        ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'ACTIVE';
    END IF;
END $$;

-- 2. Add last_active_at for tracking active users
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'last_active_at'
    ) THEN
        ALTER TABLE users ADD COLUMN last_active_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 3. Add updated_at column for tracking edits
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE users ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_total_weight ON users(total_weight DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active_at DESC NULLS LAST);

-- Show success
SELECT 'User management columns added successfully' AS result;