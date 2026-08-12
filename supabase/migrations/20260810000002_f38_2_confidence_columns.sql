-- F38.2 — Colunas de confiança do custo em generation_events (D5)
-- =============================================================================
-- Persistência estruturada da confiança/nota do custo (finding F1): os 4 campos
-- que o resolveAiCost já computa passam a ser gravados como colunas próprias
-- (daqui para frente — sem reclassificar histórico; eventos anteriores ficam
-- NULL e caem em badge genérico): versão da fórmula, nota de estimativa e os
-- dois componentes de custo (texto e tool de imagem) em USD.
--
-- Regras:
--   - IF NOT EXISTS por coluna (retrocompatível, padrão F38.1)
--   - Sem constraint de valor (D5 — valores livres para notas)
--   - Nenhuma coluna existente alterada, nenhum índice adicionado
--   - RLS default-deny mantido; escrita apenas via service_role
--
-- REVERT (comentado) em ordem reversa.
-- =============================================================================
ALTER TABLE public.generation_events
  ADD COLUMN IF NOT EXISTS cost_formula_version TEXT,
  ADD COLUMN IF NOT EXISTS cost_estimation_note TEXT,
  ADD COLUMN IF NOT EXISTS text_component_usd REAL,
  ADD COLUMN IF NOT EXISTS image_tool_component_usd REAL;

-- =============================================================================
-- REVERT (ordem reversa — DROP COLUMN IF EXISTS das 4 colunas de confiança D5:
-- versão da fórmula, nota de estimativa, componente de texto USD e componente
-- de tool de imagem USD)
-- =============================================================================
-- ALTER TABLE public.generation_events DROP COLUMN IF EXISTS (cada coluna acima);