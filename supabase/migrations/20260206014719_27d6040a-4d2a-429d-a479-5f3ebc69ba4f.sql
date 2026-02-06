
-- Ensure profiles table exists (for metadata like email, NOT for roles)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Ensure reseller_id exists in customers
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'customers' AND column_name = 'reseller_id') THEN
        ALTER TABLE public.customers ADD COLUMN reseller_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Drop old customers SELECT policy that only allowed admins
DROP POLICY IF EXISTS "Admins can view customers" ON public.customers;

-- Resellers can view their own customers, admins can view all
DROP POLICY IF EXISTS "Resellers can view their own customers" ON public.customers;
CREATE POLICY "Resellers can view their own customers"
ON public.customers FOR SELECT
TO authenticated
USING (reseller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Drop old "Anyone can view orders" policy so reseller scoping works
DROP POLICY IF EXISTS "Anyone can view orders" ON public.orders;

-- Resellers can view orders for their customers, admins can view all
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

-- Auto-create profile on signup via trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
