# Itens Adiados — Fase 48.2.3 (bancada experimental)

Itens fora do escopo do plano 48-2-3-05 detectados durante a execução. **Não** foram corrigidos por pertencerem a outro plano.

## 1. `architecture-guard.test.ts` — allowlist de módulos de campanha da bancada

- **Teste:** `src/lib/ai/__tests__/architecture-guard.test.ts` → "a bancada e o comando não importam o pipeline/rotas produtivas de campanha".
- **Falha (pré-existente):** `src/lib/lab/bench/domain/form-rules.ts → src/lib/campaign/constants`.
- **Causa:** `form-rules.ts` (criado no Plano 48-2-3-04) importa `ILLUSTRATIVE_NOTICE_TEXT` de `@/lib/campaign/constants`, mas a allowlist `BENCH_ALLOWED_CAMPAIGN_MODULES` (definida no Plano 48-2-3-01) contém apenas `["brief", "brief-schema", "types"]`.
- **Confirmação de que é pré-existente:** no commit base `aa972708`, `form-rules.ts` já importava `@/lib/campaign/constants` e a allowlist já era `["brief", "brief-schema", "types"]`.
- **Escopo:** pertence aos planos 48-2-3-01/48-2-3-04; **não** foi tocado pelo plano 48-2-3-05 (nenhum arquivo do plano 05 aparece na violação).
- **Ação sugerida:** adicionar `"constants"` à `BENCH_ALLOWED_CAMPAIGN_MODULES` (módulo genuinamente puro) ou remover o import — decisão do plano que introduziu `form-rules.ts`.
