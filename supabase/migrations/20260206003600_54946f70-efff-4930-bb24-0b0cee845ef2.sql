
-- 1. Fix PUBLIC_DATA_EXPOSURE: Restrict customer SELECT to admin only
DROP POLICY IF EXISTS "Anyone can view customers" ON public.customers;
CREATE POLICY "Admins can view customers"
ON public.customers FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2. Fix STORAGE_EXPOSURE: Make designs bucket private
INSERT INTO storage.buckets (id, name, public)
VALUES ('designs', 'designs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 3. Fix storage policies - drop public ones, add secure ones
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload" ON storage.objects;

-- Allow anyone to upload designs (public order form requires this)
CREATE POLICY "Anyone can upload designs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'designs');

-- Only authenticated users can view designs (admin dashboard)
CREATE POLICY "Authenticated users can view designs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'designs');

-- 4. Fix MISSING_RLS: Add admin role management policies to user_roles
CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
