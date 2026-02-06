
-- Allow resellers to delete their own customers
DROP POLICY IF EXISTS "Resellers can delete their own customers" ON public.customers;
CREATE POLICY "Resellers can delete their own customers"
ON public.customers FOR DELETE
TO authenticated
USING (reseller_id = auth.uid());
