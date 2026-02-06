
-- Update handle_new_user to also populate user_roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  role_to_assign TEXT;
BEGIN
  -- Get role from metadata, default to 'reseller'
  role_to_assign := COALESCE(NEW.raw_user_meta_data->>'requested_role', 'reseller');

  -- Insert into profiles
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, role_to_assign);

  -- Also insert into user_roles if it is an admin
  -- (We map 'reseller' to 'user' in the user_roles table enum if necessary, 
  -- but based on schema, admin is the key one we check for dashboard access)
  IF role_to_assign = 'admin' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  ELSE
    -- Default non-admins to 'user' role in the permissions table
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
  END IF;

  RETURN NEW;
END;
$$;
