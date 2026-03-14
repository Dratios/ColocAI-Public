-- Migration V2 : Mises à jour demandées par l'utilisateur

-- 1. Renommer 'Toi' en 'Marin' et réinitialiser les scores pour que ce soit égal
UPDATE public.users SET pseudo = 'Marin' WHERE pseudo = 'Toi';
UPDATE public.users SET score = 0, mercato_balance = 0;

-- 2. Ajouter la gestion des quantités à l'inventaire
ALTER TABLE public.inventory ADD COLUMN quantity DECIMAL DEFAULT 1.0;
ALTER TABLE public.inventory ADD COLUMN unit TEXT DEFAULT 'unité';

-- 3. Créer une table pour gérer les articles S.O.S personnalisables
CREATE TABLE IF NOT EXISTS public.sos_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  icon TEXT NOT NULL
);

-- Insérer les items par défaut s'ils n'existent pas déjà
INSERT INTO public.sos_items (name, icon) VALUES
  ('Papier toilette', '🧻'),
  ('Liquide vaisselle', '🧼'),
  ('Éponges', '🧽'),
  ('Sacs poubelle', '🗑️');

-- Permissions pour les sos_items
ALTER TABLE public.sos_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read sos_items" ON public.sos_items FOR SELECT USING (true);
CREATE POLICY "Allow public insert sos_items" ON public.sos_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update sos_items" ON public.sos_items FOR UPDATE USING (true);
CREATE POLICY "Allow public delete sos_items" ON public.sos_items FOR DELETE USING (true);

-- 4. Créer une table pour la liste de courses dédiée
CREATE TABLE IF NOT EXISTS public.shopping_list (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_name TEXT NOT NULL,
  added_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_bought BOOLEAN DEFAULT FALSE
);

-- Permissions pour la liste de courses
ALTER TABLE public.shopping_list ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read shopping_list" ON public.shopping_list FOR SELECT USING (true);
CREATE POLICY "Allow public insert shopping_list" ON public.shopping_list FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update shopping_list" ON public.shopping_list FOR UPDATE USING (true);
CREATE POLICY "Allow public delete shopping_list" ON public.shopping_list FOR DELETE USING (true);
