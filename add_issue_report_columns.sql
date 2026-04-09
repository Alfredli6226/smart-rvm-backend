-- Add columns for issue reports to cleaning_logs table
ALTER TABLE public.cleaning_logs 
ADD COLUMN IF NOT EXISTS issue_category TEXT,
ADD COLUMN IF NOT EXISTS urgency_level TEXT DEFAULT 'Medium',
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Create index for faster queries on new columns
CREATE INDEX IF NOT EXISTS idx_cleaning_logs_issue_category ON public.cleaning_logs(issue_category);
CREATE INDEX IF NOT EXISTS idx_cleaning_logs_urgency_level ON public.cleaning_logs(urgency_level);

COMMENT ON COLUMN public.cleaning_logs.issue_category IS 'Category of issue: Vandalism, Access Issue, Cleaning Required, Hardware Damage';
COMMENT ON COLUMN public.cleaning_logs.urgency_level IS 'Urgency level: Low, Medium, Critical';
COMMENT ON COLUMN public.cleaning_logs.photo_url IS 'URL to uploaded photo proof';
