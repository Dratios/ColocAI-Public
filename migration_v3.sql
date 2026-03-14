-- Migration V3: Add planned_meals table for Meal Planning AI

CREATE TABLE IF NOT EXISTS public.planned_meals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  ingredients_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.planned_meals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to planned_meals" ON public.planned_meals FOR SELECT USING (true);
CREATE POLICY "Allow public insert to planned_meals" ON public.planned_meals FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to planned_meals" ON public.planned_meals FOR UPDATE USING (true);
CREATE POLICY "Allow public delete to planned_meals" ON public.planned_meals FOR DELETE USING (true);
