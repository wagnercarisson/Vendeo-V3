-- F56.2a — LOCAL-ONLY: registrar as chaves do novo fluxo desligadas.
-- Não executar `supabase db push` remoto. A ativação/roteamento é posterior (F56.2b1).
-- Reaplicação preserva qualquer estado já gerenciado: ON CONFLICT DO NOTHING.

INSERT INTO public.feature_flags (key, enabled, description)
VALUES (
  'product_1_1_test_stores_enabled',
  false,
  'Registra a preparação inativa do Produto 1:1 para lojas de teste. Não ativa geração, roteamento, provider, crédito, entrega ou download.'
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.feature_flags (key, enabled, description)
VALUES (
  'product_1_1_all_stores_enabled',
  false,
  'Registra a preparação inativa do Produto 1:1 para todas as lojas. Não ativa geração, roteamento, provider, crédito, entrega ou download.'
)
ON CONFLICT (key) DO NOTHING;

-- REVERT (somente na instância local descartável, se autorizado)
-- DELETE FROM public.feature_flags
-- WHERE key IN (
--   'product_1_1_test_stores_enabled',
--   'product_1_1_all_stores_enabled'
-- );
