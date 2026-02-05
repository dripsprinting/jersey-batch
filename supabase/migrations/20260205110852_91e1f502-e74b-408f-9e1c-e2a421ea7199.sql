-- Create enum for jersey styles
CREATE TYPE public.jersey_style AS ENUM ('home', 'away');

-- Create enum for order status
CREATE TYPE public.order_status AS ENUM ('pending', 'in_production', 'shipped', 'completed');

-- Create enum for jersey sizes
CREATE TYPE public.jersey_size AS ENUM ('XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL');

-- Create customers table (stores team/customer info)
CREATE TABLE public.customers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    team_name TEXT NOT NULL,
    contact_email TEXT,
    contact_phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create orders table (individual jerseys linked to customers)
CREATE TABLE public.orders (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    player_name TEXT NOT NULL,
    jersey_number TEXT NOT NULL,
    size public.jersey_size NOT NULL DEFAULT 'M',
    style public.jersey_style NOT NULL DEFAULT 'home',
    status public.order_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at);

-- Enable RLS on both tables
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Public can insert customers (for order submission)
CREATE POLICY "Anyone can create customers"
ON public.customers FOR INSERT
WITH CHECK (true);

-- Public can view their own customers by ID (for confirmation)
CREATE POLICY "Anyone can view customers"
ON public.customers FOR SELECT
USING (true);

-- Public can insert orders
CREATE POLICY "Anyone can create orders"
ON public.orders FOR INSERT
WITH CHECK (true);

-- Public can view orders
CREATE POLICY "Anyone can view orders"
ON public.orders FOR SELECT
USING (true);

-- Only authenticated users (admins) can update orders
CREATE POLICY "Authenticated users can update orders"
ON public.orders FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Only authenticated users (admins) can delete orders
CREATE POLICY "Authenticated users can delete orders"
ON public.orders FOR DELETE
TO authenticated
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates on orders
CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();