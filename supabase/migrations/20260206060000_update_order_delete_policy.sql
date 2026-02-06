
-- Migration to allow resellers to delete their own pending orders
-- And allow admins to delete any order

DROP POLICY IF EXISTS "Authenticated users can delete orders" ON public.orders;
DROP POLICY IF EXISTS "Resellers can delete their own pending orders" ON public.orders;

CREATE POLICY "Resellers can delete their own pending orders"
ON public.orders FOR DELETE
TO authenticated
USING (
  (
    EXISTS (
      SELECT 1 FROM public.customers
      WHERE customers.id = orders.customer_id
      AND customers.reseller_id = auth.uid()
    )
    AND status = 'pending'
  )
  OR 
  public.has_role(auth.uid(), 'admin')
);
