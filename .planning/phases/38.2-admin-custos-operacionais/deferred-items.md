# Deferred Items — Phase 38.2 (Admin de Custos Operacionais)

Descobertas fora de escopo dos planos executados, registradas conforme a regra de
scope boundary (não corrigidas aqui; encaminhadas para os planos/verificação adequados).

## 1. [38-2-05] RPC `admin_get_ai_operation_runs` não expõe `generation_type` por run

- **Onde:** Task 4 (aggregations — byStage)
- **Problema:** O contrato do RPC (migration 20260810000003/04, plano 38-2-01)
  expõe por run `cost_sources`, `cost_estimation_notes` e flags `has_*`, mas NÃO
  expõe `generation_type` (a etapa do run). O agregado `byStage` (D3 — "Custo por
  etapa (generation_type)") não é computável em produção a partir do contrato atual.
- **Tratamento aplicado no service (38-2-05):** `deriveAggregations` lê
  `generation_type` do run bruto quando presente (campo opcional no contrato) e
  agrupa sob a chave `"unknown"` quando ausente. Os testes cobrem o caminho com
  `generation_type` presente (mock).
- **Impacto em produção:** `byStage` retornará majoritariamente o bucket `"unknown"`
  até o RPC ser estendido.
- **Correção sugerida (futura):** migration aditiva (CREATE OR REPLACE) expondo
  `array_agg(DISTINCT ge.generation_type)` por run no JSONB do RPC (análogo a
  `cost_sources`), + push remoto. Indicado para 38-2-06 (API — pode incluir o
  campo no contrato) ou 38-2-10 (verificação I1–I6), ou um quick fix dedicado.
- **Não corrigido aqui por:** scope boundary (gap pré-existente no contrato do
  plano 38-2-01; alterar o RPC exigiria migration + push fora do escopo de arquivos
  deste plano).
