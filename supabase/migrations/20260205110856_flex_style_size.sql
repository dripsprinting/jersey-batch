-- Change style and size columns to TEXT for flexibility
-- First remove the default values that depend on the types
ALTER TABLE public.orders ALTER COLUMN style DROP DEFAULT;
ALTER TABLE public.orders ALTER COLUMN size DROP DEFAULT;

ALTER TABLE public.orders 
ALTER COLUMN style TYPE TEXT,
ALTER COLUMN size TYPE TEXT;

-- Drop the old enums since they are no longer used
DROP TYPE IF EXISTS public.jersey_style;
DROP TYPE IF EXISTS public.jersey_size;
