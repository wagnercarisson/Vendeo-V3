## Why

O snapshot de drift detection atual captura 6 campos, incluindo `brand_color` e `accent_color` — dados derivados do logo ou da inferência, não dados-fonte editáveis pela loja. Isso gera dois problemas: (1) mudanças nas cores (que são output da direção visual) disparam drift indevidamente, e (2) campos textuais reais (`positioning`, `short_description`, `slogan`) que alimentam o prompt de inferência não são capturados, impossibilitando detecção futura de drift nesses campos. Esta fase realinha o snapshot para refletir apenas dados-fonte da loja (7 campos textuais), separa o conceito de captura vs política de drift, e estabelece a base para a fase 4.6.2.2 (política de drift por identity_state).

## What Changes

- Snapshot muda de 6 campos (incluindo `brand_color`, `accent_color`) para 7 campos textuais: `segment`, `subsegment`, `tone_of_voice`, `name`, `positioning`, `short_description`, `slogan`
- `brand_color` e `accent_color` removidos do snapshot por serem dados derivados, não dados-fonte
- Três camadas conceituais: `SNAPSHOT_FIELDS` (captura, 7 campos) / `DRIFT_FIELDS` (política provisória, 4 campos: segment, subsegment, tone_of_voice, name) / `CRITICAL_FIELDS` (reservado para 4.6.2.2)
- `currentVisualState` simplificado: lê exclusivamente da store, sem resolver `accent_color` do profile — delega ao helper `buildStoreProfileInputSnapshot`
- Novo helper único `src/lib/snapshot.ts` centraliza a construção de snapshots em todos os endpoints
- Visual Signature snapshot (`VisualSignatureMetadataInputSnapshot`, 11 campos) NÃO é alterado — sistemas separados
- **BREAKING**: `DriftSnapshot` passa a ser alias de `StoreProfileInputSnapshot` — contratos unificados
- **BREAKING**: Cores deixam de disparar drift — ajuste intencional de política
- Nenhuma migration necessária — `metadata` já é JSONB
- Sem backfill de snapshots antigos — `DRIFT_FIELDS` (4 campos) garante compatibilidade retroativa

## Capabilities

### New Capabilities

- Nenhuma nova capability — a funcionalidade de snapshot é infraestrutura compartilhada (lib), não uma capability isolada

### Modified Capabilities

- `visual-direction-drift-detection`: Snapshot structure muda de 6 para 7 campos; sensitive field set substituído por `SNAPSHOT_FIELDS` + `DRIFT_FIELDS` (4 campos provisórios); `currentVisualState` simplificado; `computeDriftStatus` usa `DRIFT_FIELDS`; `DriftSnapshot` = `StoreProfileInputSnapshot`
- `store-brand-profile`: `input_snapshot`, `drift_dismissed_snapshot` e `attempt_snapshot` mudam para 7 campos; `brand_color`/`accent_color` deixam de ser resolvidos no snapshot; PATCH metadata persiste com `SNAPSHOT_FIELDS` (7), compara com `DRIFT_FIELDS` (4)
- `logo-upload`: `input_snapshot` e `attempt_snapshot` passam a ser construídos via `buildStoreProfileInputSnapshot(store)`, sem resolução de `brand_color`/`accent_color`
- `logo-restore`: `detectDrift` usa `DRIFT_FIELDS` da `drift.ts` em vez de hardcoded; `currentSnapshot` usa helper; `attempt_snapshot` usa helper
- `store-identity-ui`: `driftStore` Pick expandido para incluir `positioning`, `short_description`, `slogan`; `snapshotsEqual` usa `SNAPSHOT_FIELDS` (7); `allFields` (drift) usa `DRIFT_FIELDS` (4)
- `store-form-alteration-tracking`: Dirty state de cores deixa de ser condição para drift; cores são excluídas de `DRIFT_FIELDS`; dirty state enriquece mensagem apenas quando já existe drift nos 4 campos

## Impact

- **Novo arquivo**: `src/lib/snapshot.ts` — `StoreProfileInputSnapshot` + `buildStoreProfileInputSnapshot()`
- **Core**: `src/lib/drift.ts` — `SENSITIVE_FIELDS` → `SNAPSHOT_FIELDS` (7) + `DRIFT_FIELDS` (4); `currentVisualState` simplificado; `computeDriftStatus` usa `DRIFT_FIELDS`; `DriftSnapshot` alias
- **Frontend**: `src/components/flow/use-drift-detection.ts` — Pick expandido, `SNAPSHOT_FIELDS`/`DRIFT_FIELDS`; `src/components/flow/store-identity-form.tsx` — `driftStore` com novos campos
- **Endpoints**: `POST /logo` (240-247, 322-329, 413-416), `POST /logo/restore` (15-24, 117-124, 242-248, 280-283), `POST /brand-profile/realign` (124-131, 247-254), `POST /brand-profile/infer` (112-119), `POST /visual-signature/approve` (218-222, 333-337), `GET /logo/history` (12-24, 77-84) — todos usam helper
- **Testes**: `src/lib/__tests__/snapshot.test.ts` (helper puro), `src/lib/__tests__/drift.test.ts` (backward compat), `approve-route.test.ts` (snapshots mockados com 7 campos)
- **Fora de escopo**: `VisualSignatureMetadataInputSnapshot` (11 campos), `drift-validator.ts`, políticas de drift por `identity_state` (4.6.2.2)
