-- Update stores.segment CHECK constraint with new 13 segment values
-- Must be applied AFTER truncating the database (existing rows may have old values)

ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_segment_check;

ALTER TABLE public.stores ADD CONSTRAINT stores_segment_check
  CHECK (segment = ANY(ARRAY[
    'moda-calcados-acessorios',
    'bebidas-adegas-conveniencia',
    'padaria-confeitaria-doces',
    'beleza-estetica',
    'petshop',
    'variedades-utilidades',
    'mercados-mercearias',
    'restaurantes-lanchonetes',
    'farmacia-saude',
    'casa-decoracao',
    'eletronicos-tecnologia',
    'servicos-locais',
    'outros'
  ]));

-- REVERT:
-- ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_segment_check;
-- ALTER TABLE public.stores ADD CONSTRAINT stores_segment_check
--   CHECK (segment = ANY(ARRAY['moda-vestuario','alimentacao-bebidas','beleza-estetica','saude-farmacia','casa-decoracao','eletronicos-tecnologia','petshop','servicos','variedades','outros']));
