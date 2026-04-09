-- Create advertisements table for digital advertising feature
CREATE TABLE IF NOT EXISTS advertisements (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  media_url TEXT NOT NULL,
  media_type VARCHAR(10) NOT NULL CHECK (media_type IN ('image', 'video')),
  duration INTEGER CHECK (duration IS NULL OR (media_type = 'video' AND duration <= 30)),
  assigned_machines BIGINT[] DEFAULT '{}',
  contact_number VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'inactive' CHECK (status IN ('active', 'inactive')),
  created_by BIGINT NOT NULL REFERENCES app_admins(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policy for platform owner access
ALTER TABLE advertisements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform owners can manage all advertisements" ON advertisements
  FOR ALL USING (true) WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_admins 
      WHERE app_admins.id = auth.uid()::BIGINT 
      AND app_admins.role = 'SUPER_ADMIN'
    )
  );