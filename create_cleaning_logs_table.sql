-- Create cleaning_logs table for issue reports
CREATE TABLE IF NOT EXISTS public.cleaning_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_no TEXT,
    cleaner_name TEXT,
    status TEXT NOT NULL DEFAULT 'ISSUE_REPORTED',
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.cleaning_logs ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read
CREATE POLICY "Allow read access to cleaning_logs" 
ON public.cleaning_logs FOR SELECT 
TO authenticated 
USING (true);

-- Allow all authenticated users to insert
CREATE POLICY "Allow insert access to cleaning_logs" 
ON public.cleaning_logs FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Allow all authenticated users to update
CREATE POLICY "Allow update access to cleaning_logs" 
ON public.cleaning_logs FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_cleaning_logs_status ON public.cleaning_logs(status);
CREATE INDEX IF NOT EXISTS idx_cleaning_logs_created_at ON public.cleaning_logs(created_at DESC);

COMMENT ON TABLE public.cleaning_logs IS 'Table for storing issue reports from agents/collectors';
