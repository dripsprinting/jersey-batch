
-- Add due_date to customers table
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS due_date DATE;
