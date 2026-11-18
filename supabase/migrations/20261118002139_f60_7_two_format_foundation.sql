-- F60.7 / Plano 60.7-02 — Subfatia A: fundação da entrega conjunta 1:1 + 9:16.
--
-- LOCAL-ONLY / AUTORADA E NAO APLICADA.
-- Forward-only. Proibido executar `supabase db push`, `supabase migration up`,
-- psql, Docker, reset ou qualquer mutação remota a partir desta autoria.
-- A aplicação real pertence ao Gate de banco futuro, com autorização separada,
-- posterior à Subfatia B.
--
-- Escopo:
--   1. Tabela de vínculo `public.product_two_format_deliveries`
--      (entrega de formato ↔ identidade financeira própria).
--   2. RLS habilitada e `service_role` apenas com SELECT; escrita exclusiva
--      pelas RPCs SECURITY DEFINER abaixo.
--   3. Quatro RPCs conjuntas: abertura atômica com as duas reservas de 1
--      crédito, entrega por formato com confirmação + projeção na mesma
--      transação, estorno por formato com evidência de ausência e reparo
--      idempotente de projeção.
--   4. Bloco comentado de rollback operacional não destrutivo (não executado).
--
-- Preservação obrigatória:
--   - `amount = 1` permanece intacto; cada formato usa uma linha financeira de
--     1 crédito (duas linhas por entrega completa), nunca uma linha de valor 2.
--   - Nenhuma RPC existente é redefinida; as autoridades financeiras e de
--     controle são apenas chamadas.
--   - Nenhuma tabela de artefatos, flag, pricing ou migration aplicada é
--     alterada. Sem backfill e sem conversão de dados.
--   - A única tabela existente escrita por estas RPCs é `public.campaigns`,
--     exclusivamente na projeção (`status`, `error_message`, `storage_path`).

-- =============================================================================
-- 1. Tabela de vínculo entrega ↔ formato ↔ operação financeira
-- =============================================================================

CREATE TABLE public.product_two_format_deliveries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id           UUID NOT NULL,
  operation_id          UUID NOT NULL,
  store_id              UUID NOT NULL,
  format                TEXT NOT NULL,
  delivery_operation_id UUID NOT NULL,
  artifact_role         TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ck_p2f_format CHECK (format IN ('1:1', '9:16')),
  CONSTRAINT ck_p2f_role CHECK (artifact_role IN ('square_original', 'vertical')),
  CONSTRAINT ck_p2f_format_role CHECK (
    (format = '1:1' AND artifact_role = 'square_original')
    OR (format = '9:16' AND artifact_role = 'vertical')
  ),
  CONSTRAINT ck_p2f_identity CHECK (
    (format = '9:16' AND delivery_operation_id = operation_id)
    OR (format = '1:1' AND delivery_operation_id <> operation_id)
  ),
  CONSTRAINT uq_p2f_campaign_operation_format UNIQUE (campaign_id, operation_id, format),
  CONSTRAINT uq_p2f_delivery_operation UNIQUE (delivery_operation_id),
  CONSTRAINT fk_p2f_control_operation
    FOREIGN KEY (campaign_id, operation_id)
    REFERENCES public.product_9_16_two_stage_operations (campaign_id, operation_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_p2f_credit_operation
    FOREIGN KEY (campaign_id, delivery_operation_id)
    REFERENCES public.product_1_1_campaign_credit_operations (campaign_id, operation_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_p2f_campaign_id
  ON public.product_two_format_deliveries (campaign_id);

-- Ordem obrigatória na abertura: como `fk_p2f_credit_operation` exige a linha
-- financeira do quadrado, a RPC reserva o crédito do quadrado ANTES de inserir
-- o vínculo `1:1`. A transação única desfaz a reserva se qualquer passo
-- posterior falhar.

-- =============================================================================
-- 2. RLS e grants (service_role apenas SELECT; escrita só por RPC)
-- =============================================================================

ALTER TABLE public.product_two_format_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role reads two format deliveries"
  ON public.product_two_format_deliveries;
CREATE POLICY "Service role reads two format deliveries"
  ON public.product_two_format_deliveries FOR SELECT TO service_role
  USING (true);

REVOKE ALL ON TABLE public.product_two_format_deliveries FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.product_two_format_deliveries FROM service_role;
GRANT SELECT ON TABLE public.product_two_format_deliveries TO service_role;
