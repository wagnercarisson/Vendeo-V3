## Why

Hoje o Vendeo gera a campanha e a entrega no exato momento em que ela fica `ready`: o lojista cai direto na página com download + Kit de Publicação (`campanhas/[id]` → `ReadyView`). Não existe passo de aprovação da arte — o valor central ("campanha publicável") é entregue sem confirmação humana, e a primeira geração que não agrada só tem dois caminhos: gerar outra campanha (outro crédito) ou desistir. A **F37 — Revisão e Aprovação da Arte** (v1.5, experimento beta controlado por feature flag) transforma a primeira entrega em um **ciclo de aprovação** guiado. Esta é a **base técnica da fatia 37.1 — Approval Gate + Candidata Única** (D12), que entrega valor parcial: valida o modelo de aprovação **sem tocar no pipeline de imagem** (mitiga regressão no core). Fonte da verdade: `docs/alinhamento-fase-37-revisao-aprovacao-arte.md` (D1, D2, D3 parcial, D7, D8 aprovação, D10, D11, D12, decisões 3/4/5).

## What Changes

- **Flag `campaign_approval_enabled` em `feature_flags` (D1)** — padrão F43/QCW: nova `key` (default `false`, **fail-closed**), leitura via `FeatureFlagService.isCampaignApprovalEnabled()` (fallback seguro), inclusão em `ALL_FEATURE_FLAG_KEYS` → tela admin "Controles operacionais" (motivo obrigatório + auditoria já existentes). **Sem env/launch-config** para a flag principal. Estratégia de correção (text_only × text_plus_reference) **NÃO** entra nesta fatia (decidida na 37.2).
- **Nova tabela `campaign_art_versions` (D7)** — 1 candidata por vez; colunas `status` (`pending|approved|rejected`), `asset_status` (`active|discarded`), `correction_in_progress` (marcador, decisão 5), `storage_path` nullable, `brief_snapshot` (jsonb `campaign_brief_v1`, F39, sem base64), `render_snapshot`, `generation_metadata`, `rejection_reason`, `created_at`, `UNIQUE(campaign_id, version_number)`, índice único parcial **1 `approved` por `campaign_id`**.
- **Colunas em `campaigns` (D7)** — `approval_status` (`pending_approval|approved`), `rejection_count` (smallint 0..2, schema; guard do cap é 37.2), `approved_version_id` (FK opcional), `approved_at`. **Sem backfill** (campanhas `ready` pré-flag permanecem como estão — legacy, D2). **Sem alteração** no CHECK de `generation_events` (telemetria via metadata/campaign_art_versions, D8).
- **`generate-image` insere v1 (D8/D10, mínimo)** — quando a flag está ligada, o `POST /api/campaign/generate-image` passa a **também** inserir `campaign_art_versions` (v1, `pending`, `asset_status='active'`, `brief_snapshot` = snapshot `campaign_brief_v1` persistido). Flag off → comportamento atual inalterado.
- **Estado de aprovação explícito (D2 + decisões 3/5)** — novo `ApprovalDisplayState` (`not_enabled | legacy | pending | approved | regenerating`) + `computeApprovalState(campaign, versions, flagEnabled)` + `isDeliveryReleased(state)` em `src/lib/campaign/display.ts`. **Estado `legacy` explícito:** flag ligada + zero linhas em `campaign_art_versions` → entregue como hoje, sem gate. `regenerating` é **derivado** do marcador `correction_in_progress` (decisão 5) e é **inalcançável nesta fatia** (nenhum fluxo de correção existe ainda) — entra no tipo para o contrato do módulo e para `isDeliveryReleased`, mas **não é exercitado/testado na 37.1** (será na 37.2). Fonte oficial da arte exibida = **candidata ativa** (`asset_status='active'` em `campaign_art_versions`, decisão 3); legado continua usando `campaigns.storage_path`.
- **Download e copy gated (D2 + decisão 4)** — `GET /api/campaign/[id]/download` e `PATCH /api/campaign/[id]/publication-copy` verificam o estado de aprovação: `pending`/`regenerating` (flag on) → **403**; `not_enabled`/`legacy`/`approved` → liberados como hoje.
- **Tela de revisão da candidata (decisões 3/12) + aprovar** — `/campanhas/[id]` com flag ligada e campanha nova não aprovada exibe a **tela de revisão** (`CampaignApprovalView`): arte candidata ativa (sem download, sem copy/Kit de Publicação), botão primário **"Aprovar e liberar campanha"** e botão secundário **"Corrigir" ausente (ou desabilitado) que nunca abre modal** — correção NÃO existe na 37.1. **Nenhuma versão anterior é selecionável/recuperável** (decisão 12).
- **`POST /api/campaign/[id]/approve` (nova rota, D8 transacional)** — guards (ownership + flag + versão alvo válida); transação: aprova a **candidata** (`pending` → `approved`), **defensivo** garante que nenhuma outra linha retenha asset ativo, atualiza `campaigns` (`storage_path` → aprovada, `approved_version_id`, `approved_at`, `approval_status='approved'`), registra telemetria de aprovação **sem novo `generation_type`**. Após aprovar, entrega liberada como hoje (arte aprovada + copys + download).
- **Trackings (D11/D12)** — sem renumeração (F37 já numerada; F38–F43 concluídas; Stripe fora da numeração). Confirmar/preencher trackings: F37 em execução com **fatias 37.1/37.2/37.3** (padrão F38/38.1/38.2).

## Capabilities

### New Capabilities

- `campaign-art-versions`: Modelo de dados e persistência das versões de arte (D7) — tabela `campaign_art_versions` (+ `asset_status` + `correction_in_progress`), colunas em `campaigns` (`approval_status`, `rejection_count`, `approved_version_id`, `approved_at`), índice único parcial 1-approved, tipos (`CampaignArtVersion`, `ArtVersionStatus`, `CampaignApprovalStatus`) e funções `createArtVersion`/`listArtVersions`/`approveArtVersion` (transacional) em `src/lib/campaign/persistence.ts`.
- `campaign-approval-gate`: Estado de aprovação e gate de entrega (D1/D2/D8) — flag `campaign_approval_enabled`; `ApprovalDisplayState`/`computeApprovalState`/`isDeliveryReleased`; tela de revisão da candidata ativa (sem download/copy, "Aprovar e liberar campanha", "Corrigir" ausente/desabilitado); rota `POST /api/campaign/[id]/approve` transacional; gate 403 nas rotas de download e publication-copy.

### Modified Capabilities

- `feature-flag-control`: adiciona a flag `campaign_approval_enabled` (key + `ALL_FEATURE_FLAG_KEYS` + `isCampaignApprovalEnabled()` fail-closed + seed `false`) à infraestrutura F43/QCW existente.
- `ai-image-generation`: `POST /api/campaign/generate-image` passa a inserir a v1 em `campaign_art_versions` quando a flag está ligada (mudança mínima — D10).
- `campaign-download-route`: `GET /api/campaign/[id]/download` passa a retornar **403** quando a entrega não está liberada (`pending`/`regenerating` com flag on); liberado para `not_enabled`/`legacy`/`approved`.
- `publication-copy-route`: `PATCH /api/campaign/[id]/publication-copy` passa a retornar **403** enquanto `pending`/`regenerating` (flag on) — gate também na copy (decisão 4).
- `campaign-page-ui`: `/campanhas/[id]` exibe a **tela de revisão** quando a campanha está pendente (candidata ativa, sem download/copy) e a **entrega** (como hoje) quando aprovada/legacy/flag off.

## Impact

- **Código novo**: `campaign-art-versions` (migration + persistência + tipos), `campaign-approval-gate` (display + rota approve + componente `CampaignApprovalView`).
- **Código modificado**: `src/lib/campaign/types.ts`, `src/lib/campaign/persistence.ts`, `src/lib/campaign/display.ts`, `src/lib/feature-flags/feature-flag-service.ts`, `src/app/api/campaign/generate-image/route.ts`, `src/app/api/campaign/[id]/download/route.ts`, `src/app/api/campaign/[id]/publication-copy/route.ts`, `/campanhas/[id]/page.tsx` + `client.tsx`, admin `feature-flags` (nova key via `ALL_FEATURE_FLAG_KEYS`).
- **Migrations**: `20260901000001_f37_1_create_campaign_art_versions.sql` (tabela nova + colunas em `campaigns` + índices/CHECKs + seed da flag) + `20260901000002_f37_1_seed_campaign_approval_flag.sql` (ou seed embutido). Idempotentes, não destrutivas, **sem backfill**, **sem** mudança no CHECK `chk_generation_events_type`.
- **Sem mudança**: pipeline de imagem (providers, prompts, `ImageGenerationService`), domínio `CampaignBrief`/snapshot `campaign_brief_v1`, fluxo de crédito/reserva (F24/F25/F38), `rejection_count` guard (cap — 37.2), telemetria de custo F38.1/F38.2.
- **Testes novos**: ~17+ testes conforme o checklist do alinhamento para a fatia (estados de aprovação, transação de aprovação, índice único, download/copy gated, v1 no generate-image, revisão renderiza candidata) + regressão dos testes existentes (generate-image, download, publication-copy, admin feature-flags, página da campanha).
- **Verificação**: `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` — zero erros; UAT local com flag ligada/desligada e campanha legada.

---

## FORA DE ESCOPO — fatia 37.1 (design futuro, NÃO requisito implementável desta fatia)

Repetido explicitamente do alinhamento F37 (fatiamento/D12 e "Regras de execução"). Tudo abaixo fica **adiado** para 37.2/37.3 e na 37.1 aparece apenas como contexto/design futuro:

| Item adiado | Fatia |
|---|---|
| **Correction Brief Parser** (`correction-parser.ts`, `CorrectionIntent`, `classifyCorrectionRequest`, decisão 13) | 37.2 |
| **`briefPatch` / `validateBriefPatch`** (correção factual controlada, decisão 10) | 37.3 |
| **Referência de arte na regeração** (arte candidata como referência principal + imagens do produto F41 como auxiliares, decisões 6/7) | 37.2 |
| **Cap de correções** (guard `rejection_count < 2` no `/regenerate`; `rejection_count` só recebe valor aqui — na 37.1 a coluna existe mas nada escreve nela) | 37.2 |
| **Rota `POST /api/campaign/[id]/regenerate`** | 37.2 |
| **Modal de correção em 2 etapas** (`[Aplicar correção]/[Cancelar correção]`, decisão 14) | 37.2 |
| **Prompts `prompts/regen/*`** (decisão 16) | 37.2 |
| **`rebuildBriefFromSnapshot`** (recomposição do brief runtime + reabertura do `operation_run_id`) | 37.2 |
| **Estratégia de correção A/B** (`text_only` × `text_plus_reference`, flag de estratégia) | 37.2 |
| **Correção factual de briefing** (preço/validade/aviso legal/badge/digitação) | 37.3 |
| **`setCorrectionInProgress` / `markVersionRejected` / `discardArtAsset`** (funções de persistência da correção) | 37.2 |
| **Estado `regenerating` exercitado** (o estado entra no tipo do módulo para `isDeliveryReleased`, mas nenhum fluxo o ativa na 37.1) | 37.2 |

**Além disso, não entra no escopo da F37 como um todo** (mantido da seção "Fora do Escopo" do alinhamento): v4+ paga / meia cobrança por correção; nova `operation_key` de crédito (`campaign_regeneration`/`campaign_approval`); galeria de versões aprováveis (variações); rebriefing estratégico livre; estorno/reembolso automático; extração de "core de geração" compartilhado; aprovação colaborativa/multi-approver; notificações push/email; rascunho/autosave de feedback; Stripe/Monetização Pública (diferida v1.7+).
