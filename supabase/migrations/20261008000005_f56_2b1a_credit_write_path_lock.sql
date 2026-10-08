-- F56.2b1a — Correção pós-revisão (WR-04): escrita direta removida da tabela
-- financeira. `service_role` recebe apenas SELECT; INSERT/UPDATE/DELETE passam a
-- existir SOMENTE pelas RPCs SECURITY DEFINER (atomicidade/CAS preservados).
-- LOCAL-ONLY; aplicada na instância isolada aprovada. Sem `db push` remoto.

REVOKE ALL ON TABLE public.product_1_1_campaign_credit_operations FROM service_role;
GRANT SELECT ON TABLE public.product_1_1_campaign_credit_operations TO service_role;

-- =============================================================================
-- REVERT (repõe escrita direta; NÃO recomendado)
-- =============================================================================
-- REVOKE ALL ON TABLE public.product_1_1_campaign_credit_operations FROM service_role;
-- GRANT SELECT, INSERT, UPDATE ON TABLE public.product_1_1_campaign_credit_operations TO service_role;
