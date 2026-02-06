
-- Transactions table for deposit slips
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method TEXT NOT NULL, 
    reference_number TEXT,
    proof_url TEXT, 
    status TEXT DEFAULT 'pending', 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Styles table for fabric/design catalog
CREATE TABLE IF NOT EXISTS public.styles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, 
    description TEXT,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add some default styles
INSERT INTO public.styles (name, description) VALUES 
('Polydex', 'Standard smooth fabric for basketball jerseys'),
('Aircool Full Mesh', 'Breathable mesh fabric for high ventilation'),
('Spandex', 'Tight-fit stretchy fabric')
ON CONFLICT (name) DO NOTHING;

-- Enable RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.styles ENABLE ROW LEVEL SECURITY;

-- Policies for transactions
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Admins can do everything with transactions" ON public.transactions;
    DROP POLICY IF EXISTS "Resellers can view their own customers transactions" ON public.transactions;
    DROP POLICY IF EXISTS "Resellers can create transactions for their customers" ON public.transactions;
END $$;

CREATE POLICY "Admins can do everything with transactions" 
ON public.transactions FOR ALL TO authenticated 
USING ( (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'admin' );

CREATE POLICY "Resellers can view their own customers transactions"
ON public.transactions FOR SELECT TO authenticated
USING ( 
    EXISTS (
        SELECT 1 FROM customers 
        WHERE customers.id = transactions.customer_id 
        AND customers.reseller_id = auth.uid()
    )
);

CREATE POLICY "Resellers can create transactions for their customers"
ON public.transactions FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM customers 
        WHERE customers.id = customer_id 
        AND customers.reseller_id = auth.uid()
    )
);

-- Policies for styles
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Styles are viewable by everyone" ON public.styles;
    DROP POLICY IF EXISTS "Admins can manage styles" ON public.styles;
END $$;

CREATE POLICY "Styles are viewable by everyone" 
ON public.styles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage styles" 
ON public.styles FOR ALL TO authenticated 
USING ( (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'admin' );
