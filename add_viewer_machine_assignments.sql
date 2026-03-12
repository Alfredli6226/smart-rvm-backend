-- ===========================================
-- Table: viewer_machine_assignments
-- Purpose: Assign specific machines to VIEWER users
-- ===========================================

-- Create the assignment table
CREATE TABLE IF NOT EXISTS viewer_machine_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES app_admins(id) ON DELETE CASCADE,
    machine_id INTEGER NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID REFERENCES app_admins(id),
    
    -- Unique constraint: one assignment per admin-machine pair
    UNIQUE(admin_id, machine_id)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_viewer_assignments_admin ON viewer_machine_assignments(admin_id);
CREATE INDEX IF NOT EXISTS idx_viewer_assignments_machine ON viewer_machine_assignments(machine_id);

-- Enable RLS
ALTER TABLE viewer_machine_assignments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own assignments
CREATE POLICY "Users can view own assignments" ON viewer_machine_assignments
    FOR SELECT USING (auth.uid()::text IN (
        SELECT id::text FROM app_admins WHERE id = viewer_machine_assignments.admin_id
    ));

-- Policy: Super Admins can manage all assignments
CREATE POLICY "Super Admins can manage all" ON viewer_machine_assignments
    FOR ALL USING (
        EXISTS (SELECT 1 FROM app_admins WHERE email = auth.jwt()->>'email' AND role = 'SUPER_ADMIN')
    );

-- Comment
COMMENT ON TABLE viewer_machine_assignments IS 'Links VIEWER users to specific machines they should monitor';
