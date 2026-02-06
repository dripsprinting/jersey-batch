-- Add product_type column to orders table
ALTER TABLE public.orders ADD COLUMN product_type TEXT NOT NULL DEFAULT 'Basketball Jersey';
