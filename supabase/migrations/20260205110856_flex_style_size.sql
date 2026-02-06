-- Change style and size columns to TEXT for flexibility
ALTER TABLE public.orders 
ALTER COLUMN style TYPE TEXT,
ALTER COLUMN size TYPE TEXT;

-- Drop the old enums since they are no longer used
DROP TYPE IF EXISTS public.jersey_style;
DROP TYPE IF EXISTS public.jersey_size;
