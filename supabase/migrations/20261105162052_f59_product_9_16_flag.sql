-- F59 / 59-10 — LOCAL-ONLY, AINDA NÃO APLICADA.
-- Registra a chave global do Produto vertical 9:16 DESLIGADA.
-- A aplicação exige autorização específica e é permitida SOMENTE em homolog.
-- Nenhum schema, constraint, RPC, permissão ou política é modificado.
-- Reaplicação preserva qualquer estado já gerenciado: ON CONFLICT DO NOTHING.

INSERT INTO public.feature_flags (key, enabled, description)
VALUES (
  'product_9_16_enabled',
  false,
  'Registra a preparação inativa do Produto vertical 9:16. Não ativa geração, roteamento, provider, crédito, entrega ou download; apenas permite administração futura da flag.'
)
ON CONFLICT (key) DO NOTHING;

-- REVERT (somente se a chave nunca tiver sido operada e com registro da decisão)
-- DELETE FROM public.feature_flags WHERE key = 'product_9_16_enabled';
