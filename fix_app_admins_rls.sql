-- ===========================================
-- Fix RLS Policy for app_admins table
-- Allows Super Admins to manage admin records
-- Safe version - won't affect existing policies
-- ===========================================

-- Enable RLS if not already enabled
ALTER TABLE app_admins ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read all admins
DROP POLICY IF EXISTS "Allow authenticated read app_admins v2" ON app_admins;
CREATE POLICY "Allow authenticated read app_admins v2" ON app_admins
    FOR SELECT 
    TO authenticated
    USING (true);

-- Policy: Allow Super Admins to insert new admins
DROP POLICY IF EXISTS "Allow Super Admin insert app_admins v2" ON app_admins;
CREATE POLICY "Allow Super Admin insert app_admins v2" ON app_admins
    FOR INSERT 
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM app_admins 
            WHERE email = auth.jwt()->>'email' 
            AND role = 'SUPER_ADMIN'
        )
    );

-- Policy: Allow Super Admins to update admins
DROP POLICY IF EXISTS "Allow Super Admin update app_admins v2" ON app_admins;
CREATE POLICY "Allow Super Admin update app_admins v2" ON app_admins
    FOR UPDATE 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM app_admins 
            WHERE email = auth.jwt()->>'email' 
            AND role = 'SUPER_ADMIN'
        )
    );

-- Policy: Allow Super Admins to delete admins
DROP POLICY IF EXISTS "Allow Super Admin delete app_admins v2" ON app_admins;
CREATE POLICY "Allow Super Admin delete app_admins v2" ON app_admins
    FOR DELETE 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM app_admins 
            WHERE email = auth.jwt()->>'email' 
            AND role = 'SUPER_ADMIN'
        )
    );

-- Policy: Allow users to update their own profile
DROP POLICY IF EXISTS "Allow user update own profile v2" ON app_admins;
CREATE POLICY "Allow user update own profile v2" ON app_admins
    FOR UPDATE 
    TO authenticated
    USING (email = auth.jwt()->>'email');

-- Show success
SELECT 'RLS policies created successfully' AS result;
