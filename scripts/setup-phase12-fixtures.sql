-- ============================================================================
-- setup-phase12-fixtures.sql — Setup de dados de teste para UAT da Fase 12
-- ============================================================================
-- Execute no SQL Editor do Supabase Studio (modo service_role/superuser).
-- Cria 2 usuários + 2 lojas + campanhas de teste + imagem de exemplo.
--
-- USO:
--   1. Abra o SQL Editor no Supabase Studio (local ou remoto de dev)
--   2. Cole e execute este script inteiro (uma vez)
--   3. Depois faça login como cada usuário para testar RLS
-- ============================================================================

-- Limpeza de execuções anteriores (idempotente)
DELETE FROM public.campaigns WHERE store_id IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');
DELETE FROM public.stores WHERE id IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');

-- ============================================================================
-- 1. CRIAR USUÁRIOS NO auth.users
-- ============================================================================
-- Senha para ambos: "teste123"
-- Nota: No Supabase local, INSERT direto em auth.users funciona.

-- Usuário 1 — dono da Loja A
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password,
  email_confirmed_at, confirmation_sent_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, aud, role
)
SELECT
  '00000000-0000-0000-0000-00000000000a',
  '00000000-0000-0000-0000-000000000000',
  'teste1@vendeo.test',
  crypt('teste123', gen_salt('bf')),
  now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Proprietário Teste 1"}',
  now(), now(), 'authenticated', 'authenticated'
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'teste1@vendeo.test'
);

-- Usuário 2 — dono da Loja B
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password,
  email_confirmed_at, confirmation_sent_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, aud, role
)
SELECT
  '00000000-0000-0000-0000-00000000000b',
  '00000000-0000-0000-0000-000000000000',
  'teste2@vendeo.test',
  crypt('teste123', gen_salt('bf')),
  now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Proprietário Teste 2"}',
  now(), now(), 'authenticated', 'authenticated'
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'teste2@vendeo.test'
);

-- Identity (necessário para o Supabase Auth reconhecer o usuário)
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
SELECT
  id, id,
  jsonb_build_object('sub', id::text, 'email', email),
  'email', id::text,
  now(), now(), now()
FROM auth.users
WHERE email IN ('teste1@vendeo.test', 'teste2@vendeo.test')
  AND NOT EXISTS (
    SELECT 1 FROM auth.identities WHERE auth.identities.user_id = auth.users.id
  );

-- ============================================================================
-- 2. CRIAR LOJAS
-- ============================================================================

-- Loja A (do usuário 1) — padaria
INSERT INTO public.stores (id, user_id, name, segment, subsegment)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-00000000000a',
  'Loja Teste A - Padaria do Zé',
  'padaria-confeitaria-doces',
  'padaria'
)
ON CONFLICT (id) DO NOTHING;

-- Loja B (do usuário 2) — boutí­que
INSERT INTO public.stores (id, user_id, name, segment, subsegment)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-00000000000b',
  'Loja Teste B - Boutique da Maria',
  'moda-calcados-acessorios',
  'roupas-femininas'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. CRIAR CAMPANHAS DE TESTE
-- ============================================================================

-- Campanha 1 — Loja A, status=ready
INSERT INTO public.campaigns (
  store_id, status, product_name,
  input_snapshot, storage_path
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'ready',
  'Pão Francês Promoção',
  '{"product_name":"Pão Francês","offer":"Leve 3 pague 2","price":"R$ 0,50"}',
  '00000000-0000-0000-0000-000000000001/campanha-ready.png'
);

-- Campanha 2 — Loja A, status=generating
INSERT INTO public.campaigns (
  store_id, status, product_name,
  input_snapshot, storage_path
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'generating',
  'Bolo de Cenoura',
  '{"product_name":"Bolo de Cenoura","offer":"Novo sabor","price":"R$ 12,90"}',
  '00000000-0000-0000-0000-000000000001/campanha-generating.png'
);

-- Campanha 3 — Loja A, status=error
INSERT INTO public.campaigns (
  store_id, status, product_name,
  input_snapshot, storage_path, error_message
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'error',
  'Croissant',
  '{"product_name":"Croissant","offer":"Promoção","price":"R$ 3,50"}',
  '00000000-0000-0000-0000-000000000001/campanha-error.png',
  'Falha na renderização: template não encontrado'
);

-- Campanha 4 — Loja B, status=ready (para testar isolamento)
INSERT INTO public.campaigns (
  store_id, status, product_name,
  input_snapshot, storage_path
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  'ready',
  'Vestido Floral',
  '{"product_name":"Vestido Floral","offer":"Coleção Verão","price":"R$ 89,90"}',
  '00000000-0000-0000-0000-000000000002/campanha-vestido.png'
);

-- ============================================================================
-- 4. CRIAR IMAGEM DE EXEMPLO NO STORAGE
-- ============================================================================
INSERT INTO storage.objects (bucket_id, name, owner, owner_id, metadata)
VALUES (
  'campaign-images',
  '00000000-0000-0000-0000-000000000001/campanha-ready.png',
  '00000000-0000-0000-0000-00000000000a',
  '00000000-0000-0000-0000-00000000000a',
  '{"size": 67, "mimetype": "image/png", "cacheControl": "3600"}'
)
ON CONFLICT (bucket_id, name) DO NOTHING;
