CREATE TABLE IF NOT EXISTS public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) >= 2 AND char_length(name) <= 60),
  segment TEXT NOT NULL CHECK (segment = ANY(ARRAY[
    'moda-vestuario',
    'alimentacao-bebidas',
    'beleza-estetica',
    'saude-farmacia',
    'casa-decoracao',
    'eletronicos-tecnologia',
    'petshop',
    'servicos',
    'variedades',
    'outros'
  ])),
  city TEXT,
  state TEXT,
  brand_color TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- REVERT: DROP TABLE IF EXISTS public.stores;
