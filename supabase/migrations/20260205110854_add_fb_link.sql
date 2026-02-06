-- Add fb_link to customers table and allow contact_email to be null or removed from UI usage
ALTER TABLE public.customers ADD COLUMN fb_link TEXT;
