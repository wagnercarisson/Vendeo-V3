---
phase: quick
plan: 260729-t6x
status: complete
completed: 2026-07-30
---

# Quick Task 260729-t6x: Adicionar verificação CNPJ externa ao update-cnpj + unificar fluxo fiscal em /loja

## Commits
- `36ae2a7` — Código: migration + route + frontend + links + testes
- `ded360f` — Docs: PLAN.md + STATE.md

## Tasks
1. ✅ Migration `20260730000001` — estende RPC `update_store_cnpj` com params de verificação (DROP + CREATE + REVERT)
2. ✅ Route `update-cnpj` — `CnpjVerificationService` (BrasilAPI→CNPJá), app-level duplicate check, scoring via `compareBusinessName`, `verification_status` persistido
3. ✅ `/cadastro/cnpj` → redirect server-side para `/loja?required=cadastro-fiscal`
4. ✅ ReadinessBanner, CnpjUpdateBanner, guard campanhas — links para `/loja?required=cadastro-fiscal`
5. ✅ Step 1 universal no `/loja`: CNPJ/razao/nome sempre visíveis, readOnly com badge oficial, botão Reconsultar CNPJ, billing pré-preenchido, navegação check-readiness (cadastro_fiscal→Step1, brand_profile→Step2, ready→returnTo)
6. ✅ Reconsult-cnpj route — persiste `verification_status`, `verification_data`, `cnpj_validation_score`
7. ✅ 15 testes (7 existentes + 8 novos), 141 total, typecheck limpo

## Key decisions
- `unavailable` BLOQUEIA para loja normal (503), permite com `defer` apenas para `is_test_store === true`
- `verification_status`: resolved+compatível→`approved`, resolved+divergente→`review`
- NÃO chama `evaluateFreemiumEligibility` — update-cnpj não concede freemium
- Dados oficiais (razao_social/nome_fantasia) sobrescrevem input do cliente quando lookup `resolved`
- readOnly: sempre se loja tem CNPJ; badge "Dado oficial" apenas se `cnpj_official_data` existe
