-- Create notifications table for storing user notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'INFO',
    reference_id UUID,
    reference_type TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

-- Enable Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own notifications
CREATE POLICY "Allow users to read own notifications" 
ON public.notifications FOR SELECT 
TO authenticated 
USING (user_email = auth.jwt()->>'email');

-- Allow authenticated users to insert notifications
CREATE POLICY "Allow insert access to notifications" 
ON public.notifications FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Allow users to update their own notifications
CREATE POLICY "Allow users to update own notifications" 
ON public.notifications FOR UPDATE 
TO authenticated 
USING (user_email = auth.jwt()->>'email');

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_email ON public.notifications(user_email);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

COMMENT ON TABLE public.notifications IS 'Table for storing user notifications';
