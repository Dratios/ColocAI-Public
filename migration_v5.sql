-- Migration V5: Add quantity and unit to shopping_list and Ensure category exists
ALTER TABLE public.shopping_list ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.shopping_list ADD COLUMN IF NOT EXISTS quantity DECIMAL DEFAULT 1.0;
ALTER TABLE public.shopping_list ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'unité';
