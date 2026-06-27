## Context

O snapshot de drift detection atualmente captura 6 campos em `store_brand_profiles.metadata.input_snapshot`, `drift_dismissed_snapshot` e `attempt_snapshot`. Desses 6 campos, `brand_color` e `accent_color` são dados derivados — output da direção visual (BrandDirector, text-only inference), não dados-fonte editáveis pela loja. Isso causa dois problemas:

1. Mudanças nas cores disparam drift indevidamente (ex.: após realinhamento, as cores inferidas podem mudar, mas a loja não editou os dados-fonte)
2. Campos textuais reais (`positioning`, `short_description`, `slogan`) que alimentam o prompt de inferência não são capturados, impossibilitando detecção futura de drift neles

Além disso, a construção de snapshots está duplicada em múltiplos endpoints com resolução inconsistente de `accent_color`. Cada endpoint monta o snapshot manualmente, alguns resolvendo `accent_color` do profile anterior, outros não.

Estado atual:
- `SENSITIVE_FIELDS` = 6 campos hardcoded em `drift.ts` (incluindo `brand_color`, `accent_color`)
- `currentVisualState` recebe `store` + `profile` para resolver `accent_color`
- `DriftSnapshot` = tipo separado de 6 campos
- Construção de snapshot inline em 6+ endpoints (logo, logo/restore, brand-profile/realign, brand-profile/infer, visual-signature/approve, logo/history)
- `attempt_snapshot` em logo e logo/restore também com 6 campos

## Goals / Non-Goals

**Goals:**
- Snapshot unificado para 7 campos textuais: `segment`, `subsegment`, `tone_of_voice`, `name`, `positioning`, `short_description`, `slogan`
- `brand_color` e `accent_color` removidos dos snapshots por serem dados derivados
- Três camadas conceituais: `SNAPSHOT_FIELDS` (captura, 7 campos) / `DRIFT_FIELDS` (política provisória, 4 campos) / `CRITICAL_FIELDS` (reservado)
- Helper único `buildStoreProfileInputSnapshot(store)` usado por todos os endpoints
- `currentVisualState` simplificado: lê exclusivamente da store, delega ao helper
- `DriftSnapshot = StoreProfileInputSnapshot` — alias, mesmo contrato
- `DRIFT_FIELDS` provisório = `['segment', 'subsegment', 'tone_of_voice', 'name']` — 3 novos campos inertes
- `snapshotsEqual` (no hook) usa `SNAPSHOT_FIELDS` (igualdade estrutural)
- `dismissSnapshot` persiste com `SNAPSHOT_FIELDS` (7), compara com `DRIFT_FIELDS` (4)
- Backward compatível: snapshots antigos (sem `positioning`/`short_description`/`slogan`) não geram falso drift

**Non-Goals:**
- Não alterar `VisualSignatureMetadataInputSnapshot` (11 campos) em `visual-signature/types.ts`
- Não alterar `drift-validator.ts` (validador de drift da VS, sistema separado)
- Não implementar política de drift por `identity_state` (fase 4.6.2.2)
- Não implementar versionamento explícito de snapshot (`input_snapshot_version`)
- Não fazer backfill de snapshots antigos
- Não alterar prompts de inferência
- Não alterar `criticalFields` condicional por estado (4.6.2.2)

## Decisions

### D1 — Helper único substitui construção inline

**Decisão:** Criar `src/lib/snapshot.ts` com `StoreProfileInputSnapshot` e `buildStoreProfileInputSnapshot(store)`. Todos os endpoints que constroem snapshot de brand profile usam este helper.

**Alternativa considerada:** Manter construção inline em cada endpoint com resolução consistente de `accent_color`. Rejeitada porque garantiria apenas consistência momentânea — qualquer novo endpoint precisaria replicar a lógica. O helper é type-safe e garante que todos os caminhos produzem exatamente a mesma estrutura.

### D2 — `SNAPSHOT_FIELDS` ≠ `DRIFT_FIELDS`

**Decisão:** Campos capturados e campos que disparam drift são conceitos separados. O snapshot registra tudo que pode um dia ser relevante; o drift compara apenas o subconjunto definido pela política atual. Isso permite evoluir a política sem alterar a captura.

`SNAPSHOT_FIELDS` (7) definido em `snapshot.ts`, usado por: `buildStoreProfileInputSnapshot`, `currentVisualState`, `snapshotsEqual`, persistência de `dismissSnapshot`. `DRIFT_FIELDS` (4) definido em `drift.ts` (importa `SNAPSHOT_FIELDS` de `snapshot.ts`), usado por: `computeDriftStatus`, `detectDrift`, `computeDriftStatusForHistory`, comparação de `dismissSnapshot`.

**Nota de ownership:** `SNAPSHOT_FIELDS` vive em `snapshot.ts` (não em `drift.ts`) para evitar dependência circular — `drift.ts` importa de `snapshot.ts` (helper, tipos), e `snapshot.ts` não deve importar de `drift.ts`.

**Alternativa considerada:** Usar o mesmo conjunto para captura e drift. Rejeitada porque os 3 novos campos entrariam em vigor imediatamente, quebrando compatibilidade com snapshots antigos e exigindo decisão de política que ainda não foi tomada (4.6.2.2).

### D3 — `currentVisualState` simplificado, sem profile

**Decisão:** `currentVisualState` deixa de receber o profile para resolver `accent_color`. Como `brand_color` e `accent_color` não estão mais no snapshot, a função lê apenas da store e delega para `buildStoreProfileInputSnapshot(store)`.

```typescript
// ANTES
export function currentVisualState(
  store: Pick<Store, 'segment' | 'subsegment' | 'tone_of_voice' | 'name' | 'brand_color'>,
  profile: Pick<BrandProfileRecord, ...> | null,
): DriftSnapshot { ... }

// DEPOIS
export function currentVisualState(
  store: Pick<Store, 'segment' | 'subsegment' | 'tone_of_voice' | 'name' | 'positioning' | 'short_description' | 'slogan'>,
): StoreProfileInputSnapshot {
  return buildStoreProfileInputSnapshot(store);
}
```

**Alternativa considerada:** Manter o profile parameter como opcional para compatibilidade. Rejeitada porque o profile não é mais necessário — a simplificação reduz acoplamento e complexidade.

### D4 — `DriftSnapshot` = `StoreProfileInputSnapshot` (alias)

**Decisão:** `DriftSnapshot` passa a ser um alias type para `StoreProfileInputSnapshot`. Os dois contratos nunca divergem porque o snapshot de drift é sempre um snapshot de dados-fonte da loja.

**Alternativa considerada:** Manter `DriftSnapshot` como tipo separado que espelha `StoreProfileInputSnapshot`. Rejeitada porque a manutenção paralela de dois tipos idênticos é fonte de divergência.

### D5 — `attempt_snapshot` segue o mesmo contrato de 7 campos

**Decisão:** Em `POST /logo` e `POST /logo/restore`, o `attempt_snapshot` também captura os 7 dados-fonte via helper. Continua sendo exclusivamente para auditoria — nunca usado como baseline de drift.

**Alternativa considerada:** Manter `attempt_snapshot` com 6 campos (legado). Rejeitada porque criaria duas estruturas diferentes para o mesmo propósito, adicionando complexidade sem benefício.

### D6 — Sem versionamento explícito no snapshot

**Decisão:** O `DRIFT_FIELDS` provisório (4 campos) já resolve a compatibilidade retroativa: snapshots antigos sem `positioning`/`short_description`/`slogan` nunca são comparados nesses campos porque eles não estão em `DRIFT_FIELDS`. Versionamento explícito (`input_snapshot_version`) adicionaria complexidade sem necessidade imediata.

**Alternativa considerada:** Adicionar `input_snapshot_version` para permitir evoluções futuras do schema de snapshot. Rejeitada porque o modelo de três camadas já resolve o problema de compatibilidade de forma mais simples. Reavaliar na 4.6.2.2 se a política de drift exigir distinção entre versões.

### D7 — `dismissSnapshot` persiste com `SNAPSHOT_FIELDS`, compara com `DRIFT_FIELDS`

**Decisão:** O `dismissSnapshot` enviado ao PATCH metadata contém 7 campos (`SNAPSHOT_FIELDS`) para uso futuro. A comparação contra o store atual (para decidir se é o mesmo drift já dispensado) usa apenas `DRIFT_FIELDS` (4 campos). Isso significa que `dismissSnapshot` armazena dados que ainda não são comparados, mas estarão disponíveis quando a política de drift for expandida.

### D8 — `snapshotsEqual` vive no hook, usa `SNAPSHOT_FIELDS`

**Decisão:** A função `snapshotsEqual` (comparação rasa de objetos para React) permanece no hook `use-drift-detection.ts` e usa `SNAPSHOT_FIELDS` (7 campos). É igualdade estrutural para evitar re-render — não é política de drift.

**Alternativa considerada:** Mover para `drift.ts` como utilitário compartilhado. Rejeitada porque `snapshotsEqual` é especificamente para o caso de uso do React (comparação de dependências de hooks), não uma função de drift reutilizável.

## Risks / Trade-offs

- **[Risk] Snapshots antigos (6 campos) sem `positioning`/`short_description`/`slogan`**: Resolvido por `DRIFT_FIELDS` (4 campos) que só compara campos existentes em todos os snapshots. Cores (`brand_color`, `accent_color`) deixam de disparar drift — é ajuste intencional de política, não quebra.
- **[Risk] `computeDriftStatus` recebe `StoredProfileSnapshot` (Partial)**: Assinatura deve aceitar `Partial<StoreProfileInputSnapshot>` para snapshots históricos que podem não ter os 3 novos campos. O helper `buildStoreProfileInputSnapshot` sempre retorna o contrato completo (7 campos).
- **[Risk] Código legado que chama `currentVisualState(store, profile)` quebra**: Mudança de assinatura. Todos os callers precisam ser atualizados para passar apenas `store` (sem `profile`). Identificados em: `use-drift-detection.ts` (linha 51) e `store-identity-form.tsx` (linha 910, dentro de `handleStep2Submit`). `logo/restore/route.ts` e `brand-profile/realign/route.ts` NÃO chamam `currentVisualState` diretamente — usam o helper ou funções de drift.
- **[Trade-off] 3 novos campos inertes até 4.6.2.2**: `positioning`, `short_description` e `slogan` são capturados em todos os snapshots mas não disparam drift. Isso significa que mudanças nesses campos não serão detectadas até a próxima fase. Trade-off aceito: a fase 4.6.2.1 é puramente estrutural; a política de drift é adiada.
- **[Risk] `dismissSnapshot` compara com `DRIFT_FIELDS` (4) mas persiste 7**: Se o usuário dismiss um drift e depois muda apenas `positioning` (campo não comparado), o dismiss continua valendo. Comportamento correto porque a política provisória ignora `positioning`. Quando a política mudar (4.6.2.2), o `dismissSnapshot` já terá os 7 campos armazenados para a nova comparação.
- **[Risk] Integração com `approve-route.test.ts`**: Snapshots mockados no teste do approve route precisam refletir 7 campos em vez de 6 para o brand profile metadata. O snapshot da VS (11 campos) não muda.

## Migration Plan

1. Criar `src/lib/snapshot.ts` com tipos e helper
2. Atualizar `src/lib/drift.ts`: `SENSITIVE_FIELDS` → `SNAPSHOT_FIELDS` (7) + `DRIFT_FIELDS` (4); `DriftSnapshot` alias; `currentVisualState` simplificado; `computeDriftStatus` usa `DRIFT_FIELDS`
3. Atualizar `use-drift-detection.ts`: Pick expandido, `SNAPSHOT_FIELDS`/`DRIFT_FIELDS`, `snapshotsEqual`, `dismissSnapshot`
4. Atualizar `store-identity-form.tsx`: `driftStore` com novos campos
5. Atualizar endpoints (logo, logo/restore, brand-profile/realign, brand-profile/infer, visual-signature/approve, logo/history) para usar helper
6. Testes do helper + drift + approve route
7. Build TypeScript

Rollback: reverter commits. Dados com 7 campos em JSONB são compatíveis estruturalmente com a leitura anterior (campos extras são ignorados pelo parser JSONB), mas não semanticamente com o detector de drift antigo.

**⚠️ Atenção:** Após rollback, o código antigo comparará `brand_color` e `accent_color` novamente (via `SENSITIVE_FIELDS`). Como os snapshots novos não têm esses campos, snapshots criados durante a vigência desta fase terão `brand_color` e `accent_color` como `undefined` no JSONB. A normalização atual trata `undefined`/`null` como string vazia, então se a loja tiver `brand_color` preenchido na store, o código antigo detectará drift falso. Mitigação: (1) aceitar drift falso temporário até que o rollback seja estabilizado, ou (2) manter o código novo rodando até que perfis com snapshot de 7 campos sejam substituídos por perfis novos (via re-inferência ou logo upload).

## Open Questions

- Nenhuma — o alignment doc já respondeu todas as questões durante a elaboração.
