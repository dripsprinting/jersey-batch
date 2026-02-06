
-- ===== BUILD ERROR FIXES: Add missing columns =====

-- Add missing columns to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS player_name_front text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS player_name_back text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'Basketball Jersey';

-- Copy existing player_name data to player_name_back for any existing records
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'orders' AND column_name = 'player_name') THEN
        UPDATE public.orders SET player_name_back = player_name WHERE player_name_back IS NULL;
    END IF;
END $$;

-- Make style a text column to support fabric types (Aircool, Polydex, etc.)
ALTER TABLE public.orders ALTER COLUMN style TYPE text USING style::text;
ALTER TABLE public.orders ALTER COLUMN style SET DEFAULT 'Polydex';

-- Add missing columns to customers table
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS fb_link text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS design_url text;

-- ===== SECURITY FIX 1: Create admin role system (fixes SUPA_rls_policy_always_true) =====

CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Security definer function to check roles without recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- ===== SECURITY FIX 2: Tighten orders UPDATE/DELETE to admin only =====

DROP POLICY IF EXISTS "Authenticated users can update orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can delete orders" ON public.orders;

CREATE POLICY "Admins can update orders"
ON public.orders FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete orders"
ON public.orders FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ===== SECURITY FIX 3: Add validation constraints for customers (fixes customers_unrestricted_insert) =====

ALTER TABLE public.customers ADD CONSTRAINT team_name_length CHECK (char_length(team_name) <= 200);
ALTER TABLE public.customers ADD CONSTRAINT contact_phone_length CHECK (contact_phone IS NULL OR char_length(contact_phone) <= 30);
ALTER TABLE public.customers ADD CONSTRAINT fb_link_length CHECK (fb_link IS NULL OR char_length(fb_link) <= 500);
ALTER TABLE public.customers ADD CONSTRAINT design_url_length CHECK (design_url IS NULL OR char_length(design_url) <= 2000);
ALTER TABLE public.customers ADD CONSTRAINT contact_email_length CHECK (contact_email IS NULL OR char_length(contact_email) <= 255);
