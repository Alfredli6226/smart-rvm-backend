-- Add is_delivered column to submission_reviews table
-- This tracks whether collector has offloaded waste at processing center

ALTER TABLE public.submission_reviews 
ADD COLUMN IF NOT EXISTS is_delivered BOOLEAN DEFAULT false;

-- Add delivered_at timestamp to track when the offload happened
ALTER TABLE public.submission_reviews 
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- Add delivered_by to track which collector offloaded
ALTER TABLE public.submission_reviews 
ADD COLUMN IF NOT EXISTS delivered_by TEXT;

-- Create index for faster queries on is_delivered
CREATE INDEX IF NOT EXISTS idx_submission_reviews_is_delivered 
ON public.submission_reviews(is_delivered);

COMMENT ON COLUMN public.submission_reviews.is_delivered IS 'Whether the collector has delivered/offloaded this waste at the processing center';
COMMENT ON COLUMN public.submission_reviews.delivered_at IS 'Timestamp when the waste was offloaded';
COMMENT ON COLUMN public.submission_reviews.delivered_by IS 'Email of the collector who offloaded the waste';
