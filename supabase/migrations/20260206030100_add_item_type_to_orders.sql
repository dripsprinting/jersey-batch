-- Create a new migration to add item_type to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'Set';

-- Update existing records to 'Set' if they are null
UPDATE public.orders SET item_type = 'Set' WHERE item_type IS NULL;
