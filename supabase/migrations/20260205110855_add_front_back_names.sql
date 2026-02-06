-- Rename player_name to player_name_back and add player_name_front
ALTER TABLE public.orders RENAME COLUMN player_name TO player_name_back;
ALTER TABLE public.orders ADD COLUMN player_name_front TEXT;
