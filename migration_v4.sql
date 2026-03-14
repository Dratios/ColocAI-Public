-- Migration V4 : Ajout de la table disliked_foods pour stocker les aversions de la colocation

CREATE TABLE disliked_foods (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: RLS policies can be kept disabled or added if needed.
-- Exemple (décommenter si RLS activé globalement) :
-- ALTER TABLE disliked_foods ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Enable full access for everyone" ON disliked_foods FOR ALL USING (true);
