-- Add machine location column for filtering
ALTER TABLE machines ADD COLUMN IF NOT EXISTS location VARCHAR(255);

-- Add index for machine filtering
CREATE INDEX IF NOT EXISTS idx_submission_reviews_device_no ON submission_reviews(device_no);