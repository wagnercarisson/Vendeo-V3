## 1. Helper de Snapshot (novo arquivo)

- [ ] 1.1 Criar `src/lib/snapshot.ts` com interface `StoreProfileInputSnapshot` (7 campos textuais)
- [ ] 1.2 Criar tipo `StoredProfileSnapshot = Partial<StoreProfileInputSnapshot>` para leitura de snapshots históricos
- [ ] 1.3 Implementar `buildStoreProfileInputSnapshot(store)` — Pick dos 7 campos da store, null handling consistente
- [ ] 1.4 Definir `SNAPSHOT_FIELDS` constante em `snapshot.ts` (7 campos) — evita dependência circular com drift.ts
- [ ] 1.5 Exportar `StoreProfileInputSnapshot`, `buildStoreProfileInputSnapshot` e `SNAPSHOT_FIELDS`

## 2. Core — src/lib/drift.ts

- [ ] 2.1 Importar `StoreProfileInputSnapshot`, `buildStoreProfileInputSnapshot` e `SNAPSHOT_FIELDS` de `./snapshot`
- [ ] 2.2 Remover `SENSITIVE_FIELDS` — substituído por `SNAPSHOT_FIELDS` (importado) + `DRIFT_FIELDS` (definido aqui)
- [ ] 2.3 Adicionar `DRIFT_FIELDS` (4 campos: segment, subsegment, tone_of_voice, name)
- [ ] 2.4 Alterar `DriftSnapshot` para ser alias de `StoreProfileInputSnapshot` (importado de `./snapshot`)
- [ ] 2.5 Simplificar `currentVisualState`: remover parâmetro `profile`, delegar para `buildStoreProfileInputSnapshot(store)`, retornar `StoreProfileInputSnapshot`
- [ ] 2.6 Atualizar `computeDriftStatus` para iterar sobre `DRIFT_FIELDS` em vez do set anterior
- [ ] 2.7 Atualizar `normalizeSnapshotValue` se necessário para ler tipo `StoredProfileSnapshot`

## 3. Frontend — use-drift-detection.ts

- [ ] 3.1 Expandir Pick do store: adicionar `positioning`, `short_description`, `slogan`; remover `brand_color`
- [ ] 3.2 Atualizar `snapshotsEqual` para usar `SNAPSHOT_FIELDS` (7 campos) em vez do array anterior
- [ ] 3.3 Atualizar `allFields` (drift detection) para usar `DRIFT_FIELDS` (4 campos)
- [ ] 3.4 Atualizar `dismissSnapshot` para persistir com `SNAPSHOT_FIELDS` (7), comparar com `DRIFT_FIELDS` (4)
- [ ] 3.5 Manter `criticalFields = ['name', 'segment']` inalterado
- [ ] 3.6 Atualizar chamada `currentVisualState(store, profile)` → `currentVisualState(store)` (sem profile)

## 4. Frontend — store-identity-form.tsx

- [ ] 4.1 Expandir `driftStore` useMemo: adicionar `positioning`, `short_description`, `slogan` do `formData`; remover `brand_color`
- [ ] 4.2 Valores `?? null` para positioning, short_description, slogan (consistente com helper)
- [ ] 4.3 Atualizar `handleStep2Submit` (linha ~910): `currentVisualState(driftStore ?? { ... }, driftProfile)` → `currentVisualState(driftStore ?? { id: storeId, segment: '', subsegment: '', tone_of_voice: '', name: '', positioning: null, short_description: null, slogan: null })` — remover `driftProfile` e `brand_color` do fallback

## 5. Endpoint — POST /api/store/[id]/logo

- [ ] 5.1 Linhas ~240-247: `inputSnapshot` passa a usar `buildStoreProfileInputSnapshot(store)`
- [ ] 5.2 Linhas ~322-329: metadata não resolve mais `brand_color`/`accent_color` para o snapshot
- [ ] 5.3 Linhas ~413-416: `attempt_snapshot` usa `buildStoreProfileInputSnapshot(store)`

## 6. Endpoint — POST /api/store/[id]/logo/restore

- [ ] 6.1 Linhas ~15-24: `detectDrift()` usa `DRIFT_FIELDS` da `drift.ts` em vez de hardcoded
- [ ] 6.2 Linhas ~117-124: `currentSnapshot` usa `buildStoreProfileInputSnapshot(store)`
- [ ] 6.3 Linhas ~242-248: snapshot salvo no novo profile usa helper
- [ ] 6.4 Linhas ~280-283: `attempt_snapshot` usa helper

## 7. Endpoint — POST /api/store/[id]/brand-profile/realign

- [ ] 7.1 Linhas ~124-131: path logo usa `buildStoreProfileInputSnapshot(store)`
- [ ] 7.2 Linhas ~247-254: path text-only usa `buildStoreProfileInputSnapshot(store)`
- [ ] 7.3 Remover resolução de `brand_color`/`accent_color` que existia no path logo para o snapshot

## 8. Endpoint — POST /api/store/[id]/brand-profile/infer

- [ ] 8.1 Linhas ~112-119: `inputSnapshot` usa `buildStoreProfileInputSnapshot(store)`
- [ ] 8.2 Linhas ~107-110: verificar se `resolvedBrandColor` e `accentColor` ainda são necessários para o corpo da inferência (não para o snapshot)

## 9. Endpoint — POST /api/store/[id]/visual-signature/approve

- [ ] 9.1 Linhas ~218-222: `input_snapshot` no `store_brand_profiles.metadata` usa `buildStoreProfileInputSnapshot(store)`
- [ ] 9.2 Linhas ~333-337: mesmo — substituir spread de 11 campos + brand_color/accent_color por helper
- [ ] 9.3 Confirmar que `VisualSignatureMetadataInputSnapshot` (11 campos, linhas ~65-77) NÃO é alterado

## 10. Endpoint — GET /api/store/[id]/logo/history

- [ ] 10.1 Linhas ~12-24: `currentStore` construído com `buildStoreProfileInputSnapshot(store)`
- [ ] 10.2 Linhas ~77-84: `computeDriftStatusForHistory` usa `DRIFT_FIELDS`

## 11. Testes

- [ ] 11.1 Novo: `src/lib/__tests__/snapshot.test.ts` — helper retorna exatamente 7 chaves; null tratado como null; estrutura consistente; `SNAPSHOT_FIELDS` listado
- [ ] 11.2 Novo: `src/lib/__tests__/drift.test.ts` — backward compat: snapshot antigo sem positioning + loja com positioning ≠ falso drift; mudança só de cor não gera drift; `computeDriftStatus` só compara `DRIFT_FIELDS`
- [ ] 11.3 O dismiss usa diretamente o objeto `currentSnapshot` (que já contém os 7 campos de `SNAPSHOT_FIELDS` via `buildStoreProfileInputSnapshot`). Não é necessário helper separado — `const dismissSnapshot = currentSnapshot` cobre o caso. Esta task foi simplificada durante o planejamento para evitar duplicação de contrato.
- [ ] 11.4 Atualizar: `visual-signature/approve/__tests__/approve-route.test.ts` — snapshots mockados no brand profile metadata refletem 7 campos
- [ ] 11.5 Adicionar em `src/lib/__tests__/drift.test.ts`: testes unitários para `computeDriftStatusForHistory` e `detectDrift` (logo->logo/restore) verificando que comparam apenas `DRIFT_FIELDS` (4), não o conjunto antigo de 6

## 12. Verificação

### Automatizada

- [ ] 12.1 `npm test` — suite de testes passa sem falhas
- [ ] 12.2 `npm run typecheck` — sem erros de tipo
- [ ] 12.3 `npm run lint` — sem warnings novos
- [ ] 12.4 `npm run build` — build de produção compila

### Smoke test manual (Step 2)

- [ ] 12.5 Mudar apenas uma cor no color picker, salvar → `driftStatus` permanece `none` (cor não está em `DRIFT_FIELDS`)
- [ ] 12.6 Mudar `segment` ou `name`, salvar → `driftStatus` passa para `new`
- [ ] 12.7 Dismiss do drift → PATCH metadata persiste 7 campos (`SNAPSHOT_FIELDS`), verificar no banco
- [ ] 12.8 VS approval → `store_brand_profiles.metadata.input_snapshot` tem 7 campos; `store_visual_signatures.metadata.input_snapshot` continua com 11 campos (inalterado)
