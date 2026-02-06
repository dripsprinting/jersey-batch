
-- Fix foreign key relationships to allow PostgREST to resolve joins between public tables
-- Most 400/422 errors in the Admin dashboard are due to joining public.customers to auth.users via reseller_id
-- We should join to public.profiles instead, which acts as the public proxy for user data.

-- 1. Update customers table to point to profiles
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_reseller_id_fkey;
ALTER TABLE public.customers 
ADD CONSTRAINT customers_reseller_id_fkey 
FOREIGN KEY (reseller_id) REFERENCES public.profiles(id);

-- 2. Verify transactions table references
-- It already references public.customers(id), which is correct.
-- Ensure RLS allows admins to see everything
DROP POLICY IF EXISTS "Admins can do everything with transactions" ON public.transactions;
CREATE POLICY "Admins can do everything with transactions" 
ON public.transactions FOR ALL TO authenticated 
USING ( 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
  OR 
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- 3. Ensure profiles are viewable by admins for the join
DROP POLICY IF EXISTS "Profiles are viewable by admins" ON public.profiles;
CREATE POLICY "Profiles are viewable by admins" 
ON public.profiles FOR SELECT TO authenticated 
USING ( true ); -- We already have a "viewable by everyone" policy but let's be explicit if needed
