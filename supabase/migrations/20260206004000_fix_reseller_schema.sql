
-- Ensure app_role enum exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('admin', 'user');
    END IF;
END $$;

-- Ensure user_roles table exists
CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
);

-- Ensure profiles table exists (for metadata like email and role)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    role TEXT DEFAULT 'reseller' CHECK (role IN ('admin', 'reseller')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Ensure reseller_id exists in customers
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'customers' AND column_name = 'reseller_id') THEN
        ALTER TABLE public.customers ADD COLUMN reseller_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);

-- Customers policies
DROP POLICY IF EXISTS "Resellers can view their own customers" ON public.customers;
CREATE POLICY "Resellers can view their own customers"
ON public.customers FOR SELECT
TO authenticated
USING (reseller_id = auth.uid() OR (SELECT public.has_role(auth.uid(), 'admin')));

-- Ensure anyone can create customers (needed for public order form)
DROP POLICY IF EXISTS "Anyone can create customers" ON public.customers;
CREATE POLICY "Anyone can create customers" ON public.customers FOR INSERT WITH CHECK (true);

-- Ensure Admins can view all customers
DROP POLICY IF EXISTS "Admins can view all customers" ON public.customers;
CREATE POLICY "Admins can view all customers"
ON public.customers FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Orders policies for resellers
DROP POLICY IF EXISTS "Resellers can view their own orders" ON public.orders;
CREATE POLICY "Resellers can view their own orders"
ON public.orders FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.customers
    WHERE customers.id = orders.customer_id
    AND (customers.reseller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);
