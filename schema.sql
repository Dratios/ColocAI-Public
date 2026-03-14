-- Supabase Schema for ColocAI

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pseudo TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  mercato_balance INTEGER DEFAULT 0
);

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  base_points INTEGER NOT NULL,
  urgency_multiplier DECIMAL NOT NULL,
  frequency_days INTEGER NOT NULL
);

-- Create chore_history table
CREATE TABLE public.chore_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create inventory table
CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_name TEXT NOT NULL,
  category TEXT,
  added_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expiry_date TIMESTAMP WITH TIME ZONE,
  status TEXT CHECK (status IN ('green', 'orange', 'red'))
);

-- Create events table
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE
);

-- Insert dummy users for the colocation
INSERT INTO public.users (pseudo, score, mercato_balance) VALUES
  ('Armand', 100, 50),
  ('Galaan', 120, 30),
  ('Toi', 90, 80);

-- Insert dummy tasks
INSERT INTO public.tasks (name, base_points, urgency_multiplier, frequency_days) VALUES
  ('Sortir la poubelle', 10, 1.5, 2),
  ('Faire la vaisselle', 15, 1.2, 1),
  ('Nettoyer le sol', 30, 1.0, 7),
  ('Nettoyer la SDB', 40, 1.0, 14);

-- Set up Row Level Security (RLS) policies
-- Allow completely public access for this demo (or you can restrict it later)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chore_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow public insert to users" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to users" ON public.users FOR UPDATE USING (true);
CREATE POLICY "Allow public delete to users" ON public.users FOR DELETE USING (true);

CREATE POLICY "Allow public read access to tasks" ON public.tasks FOR SELECT USING (true);
CREATE POLICY "Allow public insert to tasks" ON public.tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to tasks" ON public.tasks FOR UPDATE USING (true);
CREATE POLICY "Allow public delete to tasks" ON public.tasks FOR DELETE USING (true);

CREATE POLICY "Allow public read access to chore_history" ON public.chore_history FOR SELECT USING (true);
CREATE POLICY "Allow public insert to chore_history" ON public.chore_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to chore_history" ON public.chore_history FOR UPDATE USING (true);
CREATE POLICY "Allow public delete to chore_history" ON public.chore_history FOR DELETE USING (true);

CREATE POLICY "Allow public read access to inventory" ON public.inventory FOR SELECT USING (true);
CREATE POLICY "Allow public insert to inventory" ON public.inventory FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to inventory" ON public.inventory FOR UPDATE USING (true);
CREATE POLICY "Allow public delete to inventory" ON public.inventory FOR DELETE USING (true);

CREATE POLICY "Allow public read access to events" ON public.events FOR SELECT USING (true);
CREATE POLICY "Allow public insert to events" ON public.events FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to events" ON public.events FOR UPDATE USING (true);
CREATE POLICY "Allow public delete to events" ON public.events FOR DELETE USING (true);
