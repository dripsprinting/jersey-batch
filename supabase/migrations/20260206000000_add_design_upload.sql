-- Add design_url to customers table
ALTER TABLE public.customers ADD COLUMN design_url TEXT;

-- Create a bucket for designs if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('designs', 'designs', true)
ON CONFLICT (id) DO NOTHING;

-- Set up access policy for the designs bucket
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'designs');
CREATE POLICY "Public Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'designs');
