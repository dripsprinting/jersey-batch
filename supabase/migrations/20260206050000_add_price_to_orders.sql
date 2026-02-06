-- Add price column to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2) DEFAULT 0;
