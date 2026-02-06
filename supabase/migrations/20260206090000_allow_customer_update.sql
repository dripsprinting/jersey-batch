
-- Allow resellers to update their own customers (needed for due_date, etc.)
DROP POLICY IF EXISTS "Resellers can update their own customers" ON public.customers;
CREATE POLICY "Resellers can update their own customers"
ON public.customers FOR UPDATE
TO authenticated
USING (reseller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (reseller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
