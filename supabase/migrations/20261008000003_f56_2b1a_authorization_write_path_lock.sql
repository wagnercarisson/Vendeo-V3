-- F56.2b1a — Correção pós-revisão: escrita de autorização SOMENTE pelas RPCs.
-- A migration 20261008000001 concedia INSERT direto à service_role, permitindo
-- contornar a recusa de estágio habilitador efetuada pela RPC auditada. Esta
-- migration remove a escrita direta (INSERT/UPDATE/DELETE) e mantém apenas SELECT
-- para leitura do histórico. As RPCs SECURITY DEFINER continuam sendo o único
-- caminho de escrita (executam como o owner, não como service_role).
--
-- LOCAL-ONLY; sem `db push` remoto. Já aplicada no workdir isolado aprovado.

REVOKE ALL ON TABLE public.product_flow_stage_authorizations FROM service_role;
GRANT SELECT ON TABLE public.product_flow_stage_authorizations TO service_role;

-- =============================================================================
-- REVERT (repõe o comportamento anterior; NÃO recomendado)
-- =============================================================================
-- REVOKE ALL ON TABLE public.product_flow_stage_authorizations FROM service_role;
-- GRANT SELECT, INSERT ON TABLE public.product_flow_stage_authorizations TO service_role;
