-- Migration V6: Add canonical_name for smart grouping
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS canonical_name TEXT;
ALTER TABLE public.shopping_list ADD COLUMN IF NOT EXISTS canonical_name TEXT;

-- Initial filling (optional but helpful)
UPDATE public.inventory SET canonical_name = product_name WHERE canonical_name IS NULL;
UPDATE public.shopping_list SET canonical_name = product_name WHERE canonical_name IS NULL;
