# Alinhamento Fase 4.6.2.1 — Snapshot Fields Realignment

## Nomenclatura das Fases 4.6

```
4.6  — Store Form Adjusts                    (fase mãe)
 ├── 4.6.1 — Text Only Coverage              (concluída)
 ├── 4.6.2 — Visual Direction Drift Detection
 │    └── 4.6.2.1 — Snapshot Fields Realignment  ← esta micro-fase
 ├── 4.6.3 — Logo fluxo                      (concluída)
 ├── 4.6.4 — Visual Signature fluxo          (concluída)
 ├── 4.6.5 — Logo State Lifecycle            (concluída)
 ├── 4.6.6 — Store Form Migrations
 └── 4.6.7 — Visual Signature Retry
```

---

## Propósito

Alterar o que é capturado nos snapshots dos `store_brand_profiles` — de 6 campos (incluindo cores) para 7 campos textuais. As cores são derivadas do logo ou da inferência e não devem estar no retrato dos dados-fonte da loja.

**O que esta fase faz:** altera o que é **persistido** em `metadata.input_snapshot`, `metadata.drift_dismissed_snapshot` e `metadata.attempt_snapshot`, e faz a adaptação mínima dos consumidores de drift para manter a detecção operacional com a política provisória de 4 campos. As cores (`brand_color`, `accent_color`) deixam de ser comparadas — é um ajuste intencional de política, não só de persistência.

---

## Modelo de Três Camadas

Para evitar que os 3 novos campos se tornem gatilhos de drift imediatamente, o código passa a ter três camadas conceituais. Duas são implementadas como constantes; a terceira (CRITICAL_FIELDS) fica como reserva conceitual para a fase 4.6.2.2:

```typescript
// Captura — todos os campos persistidos no snapshot
const SNAPSHOT_FIELDS = [
  'segment', 'subsegment', 'tone_of_voice', 'name',
  'positioning', 'short_description', 'slogan',
] as const;

// Drift — política PROVISÓRIA: só os 4 que já existiam
// Positioning, short_description e slogan são registrados
// mas permanecem inertes até a próxima fase.
const DRIFT_FIELDS = [
  'segment', 'subsegment', 'tone_of_voice', 'name',
] as const;

// Crítico — política futura por identity_state
// (reservado para fase 4.6.2.2)
```

| Camada | Uso | Campos | Implementada |
|--------|-----|--------|-------------|
| `SNAPSHOT_FIELDS` | Estrutura do snapshot, `currentVisualState`, `snapshotsEqual` | 7 campos | ✅ Sim |
| `DRIFT_FIELDS` | `computeDriftStatus`, comparação de `dismissSnapshot`, `detectDrift` inline | 4 campos provisórios | ✅ Sim |
| `CRITICAL_FIELDS` | Reservado para filtragem por estado | `['name', 'segment']` (mantido) | ❌ Não (futuro) |

**Implicação direta:**

| Função | Usa | Motivo |
|--------|-----|--------|
| `computeDriftStatus` | `DRIFT_FIELDS` | Só 4 campos disparam drift |
| `detectDrift` (restore) | `DRIFT_FIELDS` | Mesma política de drift |
| `computeDriftStatusForHistory` (history) | `DRIFT_FIELDS` | Mesma política de drift |
| `snapshotsEqual` | `SNAPSHOT_FIELDS` | Igualdade estrutural do objeto inteiro — evita re-render |
| Comparação de `dismissSnapshot` | `DRIFT_FIELDS` | Só compara campos de drift para decidir se é o mesmo drift |
| Persistência de `dismissSnapshot` | `SNAPSHOT_FIELDS` | Armazena 7 campos para uso futuro |

Os 3 novos campos são capturados em todos os snapshots mas não geram drift.

---

## Mudança Central

### Snapshot atual (6 campos)
```json
{
  "segment": "moda-feminina",
  "subsegment": "moda-feminina",
  "tone_of_voice": "elegante",
  "name": "Maria Boutique",
  "brand_color": "#C41E3A",
  "accent_color": "#2D2D2D"
}
```

### Novo snapshot (7 campos)
```json
{
  "segment": "moda-feminina",
  "subsegment": "moda-feminina",
  "tone_of_voice": "elegante",
  "name": "Maria Boutique",
  "positioning": "Premium, sofisticado",
  "short_description": "Moda feminina com estilo europeu",
  "slogan": "Elegância que transforma"
}
```

| Mudança | Campos |
|---------|--------|
| ✅ Mantidos | `segment`, `subsegment`, `tone_of_voice`, `name` |
| ➕ Adicionados | `positioning`, `short_description`, `slogan` |
| ➖ Removidos | `brand_color`, `accent_color` |

### Motivação

- **Cores** são derivadas do logo (BrandDirector) ou da inferência (text-only). São output da direção visual, não dados-fonte editáveis.
- **Positioning, short_description e slogan** são inputs textuais que alimentam o prompt de inferência. Alterá-los pode justificar realinhamento — mas a política de quando disparam drift é decidida na fase 4.6.2.2.

---

## Onde os Snapshots Vivem

**Não há um único local.** Existem snapshots com propósitos diferentes:

| Local | Tipo | Escopo desta fase |
|-------|------|-------------------|
| `store_brand_profiles.metadata.input_snapshot` | Brand profile | ✅ **Muda** — 6 → 7 campos |
| `store_brand_profiles.metadata.drift_dismissed_snapshot` | Brand profile | ✅ **Muda** — mesmos 7 campos |
| `store_brand_profiles.metadata.attempt_snapshot` | Brand profile (auditoria) | ✅ **Muda** — mesmos 7 campos |
| `store_visual_signatures.metadata.input_snapshot` | Visual signature | ❌ **Não muda** — contrato próprio de 11 campos |

O snapshot da assinatura visual (`VisualSignatureMetadataInputSnapshot` em `types.ts:154`) tem 11 campos e serve ao validador de restauração da VS (`drift-validator.ts`). É um sistema separado e **não é alterado nesta fase**.

Nenhuma migration necessária — `metadata` já é JSONB.

---

## Helper Único

Para eliminar construções duplicadas e garantir que todos os caminhos de criação de brand profile capturem exatamente a mesma estrutura, um único helper:

```typescript
// src/lib/snapshot.ts  (novo arquivo)

export interface StoreProfileInputSnapshot {
  segment: string | null;
  subsegment: string | null;
  tone_of_voice: string | null;
  name: string | null;
  positioning: string | null;
  short_description: string | null;
  slogan: string | null;
}

// Para leitura de snapshots históricos que podem não ter os 7 campos
export type StoredProfileSnapshot = Partial<StoreProfileInputSnapshot>;

export function buildStoreProfileInputSnapshot(
  store: Pick<Store, 'segment' | 'subsegment' | 'tone_of_voice' | 'name' | 'positioning' | 'short_description' | 'slogan'>
): StoreProfileInputSnapshot {
  return {
    segment: store.segment,
    subsegment: store.subsegment ?? null,
    tone_of_voice: store.tone_of_voice ?? null,
    name: store.name,
    positioning: store.positioning ?? null,
    short_description: store.short_description ?? null,
    slogan: store.slogan ?? null,
  };
}
```

`computeDriftStatus` pode receber `StoredProfileSnapshot` (ou `Partial<StoreProfileInputSnapshot>`) para aceitar snapshots históricos sem coercion. O helper sempre retorna o contrato completo (7 campos).

Usado por: `POST /logo`, `POST /logo/restore`, `POST /brand-profile/realign`, `POST /brand-profile/infer`, `POST /visual-signature/approve` (somente para o brand profile metadata). Também por `currentVisualState()` em `drift.ts`, que delega a construção ao helper. `DriftSnapshot` é um alias de `StoreProfileInputSnapshot`.

---

## Decisões Arquiteturais

### Decisão: `SNAPSHOT_FIELDS` ≠ `DRIFT_FIELDS`

Campos capturados e campos que disparam drift são conceitos separados. O snapshot registra tudo que pode um dia ser relevante; o drift compara apenas o subconjunto definido pela política atual. Isso permite evoluir a política sem alterar a captura.

### Decisão: `DRIFT_FIELDS` provisório = 4 campos originais

`segment`, `subsegment`, `tone_of_voice`, `name`. Os 3 novos campos (`positioning`, `short_description`, `slogan`) são capturados mas inertes. A fase 4.6.2.2 define a política completa por `identity_state`.

### Decisão: `attempt_snapshot` segue o mesmo contrato

Em `POST /logo` (linha 415) e `POST /logo/restore` (linha 282), o `attempt_snapshot` também captura os 7 dados-fonte. Continua sendo exclusivamente para auditoria — nunca usado como baseline de drift.

### Decisão: `currentVisualState` delega ao helper

Não depende mais do profile (`brand_colors_chosen`, `safe_color_tokens`, `inferred_accent_color`). Delega a construção para `buildStoreProfileInputSnapshot(store)`. `DriftSnapshot = StoreProfileInputSnapshot` — alias, mesmo contrato. Isso elimina duplicação e garante que os dois tipos nunca divergem.

### Decisão: Snapshot da Visual Signature NÃO é alterado

O tipo `VisualSignatureMetadataInputSnapshot` (11 campos) permanece intacto. O validador `validateDrift` no `drift-validator.ts` continua operando com seu próprio contrato (name, segment + conditional city, state, slogan). Unificação é escopo futuro.

### Decisão: Sem versionamento explícito no snapshot

O `DRIFT_FIELDS` provisório (4 campos) já resolve a compatibilidade retroativa: snapshots antigos sem `positioning`/`short_description`/`slogan` nunca são comparados nesses campos porque eles não estão em `DRIFT_FIELDS`. Versionamento explícito (`input_snapshot_version`) seria mais robusto para evoluções futuras, mas adiciona complexidade sem necessidade imediata. Reavaliar na fase 4.6.2.2 se a política de drift exigir distinção entre versões de snapshot.

---

## Backward Compat — Cenário Real

Snapshots antigos (6 campos, sem `positioning`/`short_description`/`slogan`) convivem com os novos. `computeDriftStatus` itera sobre `DRIFT_FIELDS` = `['segment', 'subsegment', 'tone_of_voice', 'name']` — campos que existem em TODOS os snapshots, antigos e novos.

**Cenário que daria problema (se usássemos `SNAPSHOT_FIELDS`):**

```
Loja antiga:
  store.positioning = "Premium"
  inputSnapshot antigo = { segment, subsegment, ..., brand_color, accent_color }
                              ↑ não tem "positioning"

  normalizeSnapshotValue(store.positioning)  → "Premium"
  normalizeSnapshotValue(inputSnapshot.positioning) → normalizeSnapshotValue(undefined) → ""

  "Premium" !== ""  → FALSO DRIFT ✗
```

Isso é evitado porque `DRIFT_FIELDS` não inclui `positioning`. O campo existe no snapshot atual (lido da store) mas não é comparado.

**Efeito prático:** snapshots antigos permanecem compatíveis e não geram falso drift pelos 3 novos campos. As cores (`brand_color`, `accent_color`) deixam de disparar drift — é um ajuste intencional de política, não uma quebra. Os 3 novos campos só passam a ser comparados quando forem adicionados a `DRIFT_FIELDS` em fase futura.

---

## Arquivos Afetados

### Novo arquivo

| Arquivo | Conteúdo |
|---------|----------|
| `src/lib/snapshot.ts` | `StoreProfileInputSnapshot` interface + `buildStoreProfileInputSnapshot()` helper |

### Core — tipos e funções

| Arquivo | O que muda |
|---------|-----------|
| `src/lib/drift.ts` | `SENSITIVE_FIELDS` substituído por `SNAPSHOT_FIELDS` (7) + `DRIFT_FIELDS` (4). `DriftSnapshot` = `StoreProfileInputSnapshot` (alias, mesmo contrato). `currentVisualState` delega ao helper. `computeDriftStatus` usa `DRIFT_FIELDS`. |

### Frontend

| Arquivo | O que muda |
|---------|-----------|
| `src/components/flow/use-drift-detection.ts` | `store` Pick expandido (`positioning`, `short_description`, `slogan`). `snapshotsEqual` usa `SNAPSHOT_FIELDS` (7). `allFields` (drift) usa `DRIFT_FIELDS` (4). `dismissSnapshot` **persiste** com `SNAPSHOT_FIELDS` (7) mas é **comparado** com `DRIFT_FIELDS` (4). `criticalFields` = `['name', 'segment']` (mantido). |
| `src/components/flow/store-identity-form.tsx` (linha 127) | `driftStore` expandido para incluir `positioning`, `short_description`, `slogan` do `formData`. Se não for expandido, a mudança no Pick do `useDriftDetection` quebra TypeScript. |

### Endpoints — persistência do snapshot

| Arquivo | Linhas | O que muda |
|---------|--------|-----------|
| `src/app/api/store/[id]/logo/route.ts` | 240-247, 322-329, 413-416 | `inputSnapshot` e `attempt_snapshot` usam `buildStoreProfileInputSnapshot(store)`. Metadata não resolve mais `brand_color`/`accent_color`. |
| `src/app/api/store/[id]/logo/restore/route.ts` | 15-24, 117-124, 242-248, 280-283 | `detectDrift()` usa `DRIFT_FIELDS`. `currentSnapshot` usa helper. `attempt_snapshot` usa helper. |
| `src/app/api/store/[id]/brand-profile/realign/route.ts` | 124-131, 247-254 | Ambos os paths usam `buildStoreProfileInputSnapshot(store)`. |
| `src/app/api/store/[id]/brand-profile/infer/route.ts` | 112-119 | `inputSnapshot` usa helper. |
| `src/app/api/store/[id]/visual-signature/approve/route.ts` | 218-222, 333-337 | `input_snapshot` no `store_brand_profiles.metadata` usa helper. O `inputSnapshot` da VS (linhas 65-77) permanece com 11 campos — não é alterado. |
| `src/app/api/store/[id]/logo/history/route.ts` | 12-24, 77-84 | `computeDriftStatusForHistory` usa `DRIFT_FIELDS`. `currentStore` construído com helper. |

### Fora de escopo (não mudam)

| Arquivo | Motivo |
|---------|--------|
| `src/app/api/store/[id]/visual-signature/route.ts` | Leitura de VS — não cria brand profile snapshot. |
| `src/app/api/store/[id]/visual-signature/restore/route.ts` | Usa o validador de drift da VS, sistema separado. |
| `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts` | Cria snapshot em `store_visual_signatures`, não em `store_brand_profiles`. |
| `src/lib/visual-signature/types.ts` | `VisualSignatureMetadataInputSnapshot` mantém 11 campos. |
| `src/lib/visual-signature/drift-validator.ts` | Validador separado da VS. |

### Testes

> **Cuidado:** o teste do helper (`snapshot.test.ts`) valida a função pura, mas não garante que o hook `use-drift-detection` envia 7 campos no payload de dismiss. Essa cobertura deve vir de um teste do hook ou de um helper extraído para construir o payload de dismiss — escopo desta fase apenas identificar a lacuna, não implementar o teste de componente.

| Arquivo | O que muda |
|---------|-----------|
| `src/app/api/store/[id]/visual-signature/approve/__tests__/approve-route.test.ts` | Snapshots mockados com `input_snapshot` no brand profile metadata refletem 7 campos. |
| **Novo:** `src/lib/__tests__/snapshot.test.ts` | Testes do helper: retorna exatamente 7 chaves; null tratado como null; estrutura consistente. `dismissSnapshot` persiste exatamente as 7 chaves, mas é comparado apenas por `DRIFT_FIELDS` (4). |
| **Novo:** `src/lib/__tests__/drift.test.ts` | Testes de backward compat: snapshot antigo sem `positioning` + loja com `positioning` preenchido → NÃO gera drift. Mudança apenas de cor (`brand_color`) → NÃO gera drift. `computeDriftStatus` só compara `DRIFT_FIELDS`. |

---

## Comportamento Detalhado

### Logo upload (`POST /api/store/[id]/logo`)

```typescript
// ANTES (linhas 240-247)
const inputSnapshot = {
  segment: store.segment,
  subsegment: store.subsegment,
  tone_of_voice: store.tone_of_voice,
  name: store.name,
  brand_color: store.brand_color,
  accent_color: accentColor,        // resolvido do profile anterior
};

// DEPOIS
const inputSnapshot = buildStoreProfileInputSnapshot(store);

// attempt_snapshot (linha 415) também usa o helper
```

O metadata do profile (linhas 322-329) não precisa mais resolver `brand_color`/`accent_color` — o snapshot agora contém apenas dados-fonte.

### Logo restore (`POST /api/store/[id]/logo/restore`)

`detectDrift()` (linhas 15-24) passa a usar `DRIFT_FIELDS` da `drift.ts` em vez de hardcoded. `currentSnapshot` (linhas 117-124) usa `buildStoreProfileInputSnapshot`. O snapshot salvo no novo profile (linhas 242-248) e o `attempt_snapshot` (linha 282) também.

### Brand profile realign (`POST /api/store/[id]/brand-profile/realign`)

Ambos os paths (logo e text-only) usam `buildStoreProfileInputSnapshot(store)`. A resolução de `brand_color`/`accent_color` que existe no path logo deixa de ser necessária no snapshot.

### Brand profile infer (`POST /api/store/[id]/brand-profile/infer`)

`inputSnapshot` (linhas 112-119) usa helper. `resolvedBrandColor` e `accentColor` (linhas 107-110) deixam de ser usados no snapshot — ainda podem ser necessários para o corpo da inferência, mas não para o retrato.

### Visual signature approve (`POST /api/store/[id]/visual-signature/approve`)

**Importante:** o snapshot de 11 campos `VisualSignatureMetadataInputSnapshot` (linhas 65-77) **não muda** — ele ainda serve ao `validateDrift` da VS. Apenas o `input_snapshot` escrito no `store_brand_profiles.metadata` (linhas 218-222, 333-337) passa a usar `buildStoreProfileInputSnapshot(store)`:

```typescript
// ANTES (linha 218)
input_snapshot: {
  ...inputSnapshot,        // spread dos 11 campos da VS
  brand_color: pColor,
  accent_color: aColor,
}

// DEPOIS
input_snapshot: buildStoreProfileInputSnapshot(store)
```

### currentVisualState (`src/lib/drift.ts`)

```typescript
// ANTES — precisava do profile para resolver accent_color
export function currentVisualState(
  store: Pick<Store, 'segment' | 'subsegment' | 'tone_of_voice' | 'name' | 'brand_color'>,
  profile: Pick<BrandProfileRecord, 'brand_colors_chosen' | 'safe_color_tokens' | 'inferred_accent_color'> | null,
): DriftSnapshot { ... }

// DEPOIS — delega ao helper único
// DriftSnapshot = StoreProfileInputSnapshot  (alias, mesmo contrato)
export function currentVisualState(
  store: Pick<Store, 'segment' | 'subsegment' | 'tone_of_voice' | 'name' | 'positioning' | 'short_description' | 'slogan'>,
): DriftSnapshot {
  return buildStoreProfileInputSnapshot(store);
}
```

`DriftSnapshot` passa a ser um alias de `StoreProfileInputSnapshot` — os dois contratos nunca divergem.

### use-drift-detection (`src/components/flow/use-drift-detection.ts`)

```typescript
// ANTES
Pick<Store, 'id' | 'segment' | 'subsegment' | 'tone_of_voice' | 'name' | 'brand_color'>

// DEPOIS
Pick<Store, 'id' | 'segment' | 'subsegment' | 'tone_of_voice' | 'name' | 'positioning' | 'short_description' | 'slogan'>
```

`snapshotsEqual` (definida no próprio hook, linha 10) usa `SNAPSHOT_FIELDS` (igualdade estrutural do snapshot inteiro — evita re-render).  
`allFields` na detecção de drift usa `DRIFT_FIELDS` (4 campos).  
`dismissSnapshot` **persiste** os 7 campos (`SNAPSHOT_FIELDS`) para uso futuro, mas a **comparação** contra o store atual usa `DRIFT_FIELDS` (4) para decidir se é o mesmo drift já dispensado.

### store-identity-form (`src/components/flow/store-identity-form.tsx:127`)

```typescript
// ANTES
const driftStore = useMemo(() => storeId ? {
  id: storeId,
  segment: formData.segment,
  subsegment: formData.subsegment,
  tone_of_voice: formData.tone_of_voice,
  name: formData.name,
  brand_color: formData.brand_color,
} : null, [...]);

// DEPOIS
const driftStore = useMemo(() => storeId ? {
  id: storeId,
  segment: formData.segment,
  subsegment: formData.subsegment,
  tone_of_voice: formData.tone_of_voice,
  name: formData.name,
  positioning: formData.positioning ?? null,
  short_description: formData.short_description ?? null,
  slogan: formData.slogan ?? null,
} : null, [...]);
```

---

## Fora de Escopo (fase 4.6.2.2)

| Item | Motivo |
|------|--------|
| Política de drift por `identity_state` — quais campos disparam drift em cada estado | `DRIFT_FIELDS` provisório com 4 campos. A política condicional (logo vs text_only vs VS) é a fase 4.6.2.2. |
| Unificação do drift validator do VS com o sistema de drift do brand profile | Sistemas separados. Unificação é escopo futuro e requer validação cuidadosa do impacto no restore de VS. |
| `VisualSignatureMetadataInputSnapshot` | Não é alterado. O snapshot da VS continua com 11 campos. |
| Alteração nos prompts de inferência | Escopo de fases de IA. |
| Versionamento explícito no snapshot (`input_snapshot_version`) | Reavaliar na 4.6.2.2 se a política exigir distinguir versões de snapshot. |
| Backfill de snapshots antigos | Não necessário — `DRIFT_FIELDS` (4 campos) resolve compatibilidade. |
| `criticalFields` condicional por estado | `criticalFields = ['name', 'segment']` mantido. A filtragem por estado é 4.6.2.2. |

---

## Checklist de Implementação

- [ ] Criar `src/lib/snapshot.ts` com `StoreProfileInputSnapshot` + `buildStoreProfileInputSnapshot()`
- [ ] `src/lib/drift.ts`: `SENSITIVE_FIELDS` → `SNAPSHOT_FIELDS` (7) + `DRIFT_FIELDS` (4)
- [ ] `src/lib/drift.ts`: `DriftSnapshot` atualizado com novos campos
- [ ] `src/lib/drift.ts`: `currentVisualState` simplificado (sem profile, lê só da store)
- [ ] `src/lib/drift.ts`: `computeDriftStatus` usa `DRIFT_FIELDS`
- [ ] `src/components/flow/use-drift-detection.ts`: Pick expandido, `DRIFT_FIELDS` no drift, `SNAPSHOT_FIELDS` na persistência do `dismissSnapshot` + `snapshotsEqual`
- [ ] `src/components/flow/store-identity-form.tsx`: `driftStore` com positioning, short_description, slogan
- [ ] `POST /logo`: `inputSnapshot` e `attempt_snapshot` usam helper
- [ ] `POST /logo/restore`: `detectDrift` usa `DRIFT_FIELDS`, snapshots usam helper
- [ ] `POST /brand-profile/realign`: ambos os paths usam helper
- [ ] `POST /brand-profile/infer`: `inputSnapshot` usa helper
- [ ] `POST /visual-signature/approve`: `input_snapshot` no brand profile metadata usa helper (VS snapshot de 11 campos intacto)
- [ ] `GET /logo/history`: `computeDriftStatusForHistory` usa `DRIFT_FIELDS`
- [ ] Testes do helper (`snapshot.test.ts`): exatamente 7 chaves, null tratado, estrutura consistente; `dismissSnapshot` persiste 7 chaves mas comparado por `DRIFT_FIELDS`
- [ ] Testes de drift (`drift.test.ts`): backward compat — snapshot antigo sem positioning + loja com positioning ≠ falso drift; mudança só de cor não gera drift
- [ ] Testes do approve route: snapshots mockados refletem 7 campos
- [ ] Build TypeScript passa sem erros
- [ ] Atualizar specs canônicas OpenSpec (`visual-direction-drift-detection/spec.md`, `logo-upload/spec.md`, `store-brand-profile/spec.md`) com delta desta fase

---

## Histórico de Decisões

| Data | Decisão |
|------|---------|
| 2026-06-26 | Snapshot unificado para 7 campos: `segment`, `subsegment`, `tone_of_voice`, `name`, `positioning`, `short_description`, `slogan`. Válido para todos os `identity_state`. |
| 2026-06-26 | `brand_color` e `accent_color` removidos do snapshot por serem dados derivados, não dados-fonte. |
| 2026-06-26 | Três camadas: `SNAPSHOT_FIELDS` (captura) / `DRIFT_FIELDS` (política provisória de 4 campos) / `CRITICAL_FIELDS` (reservado para fase futura). |
| 2026-06-26 | `DRIFT_FIELDS` provisório = `segment`, `subsegment`, `tone_of_voice`, `name`. Positioning, short_description e slogan são capturados mas inertes. |
| 2026-06-26 | `attempt_snapshot` segue o mesmo contrato de 7 campos. Exclusivamente para auditoria, nunca baseline de drift. |
| 2026-06-26 | `currentVisualState` delega ao helper `buildStoreProfileInputSnapshot`. `DriftSnapshot = StoreProfileInputSnapshot` (alias). |
| 2026-06-26 | Snapshot da Visual Signature NÃO é alterado. `VisualSignatureMetadataInputSnapshot` mantém 11 campos. |
| 2026-06-26 | Helper único `buildStoreProfileInputSnapshot(store)` garante estrutura consistente em todos os caminhos de criação de brand profile. |
| 2026-06-26 | Sem versionamento explícito no snapshot. `DRIFT_FIELDS` de 4 campos já resolve compatibilidade retroativa. Reavaliar versionamento na 4.6.2.2. |
| 2026-06-26 | Sem backfill de snapshots antigos. `DRIFT_FIELDS` garante que snapshots antigos não disparam falso drift nos 3 novos campos. Cores (`brand_color`, `accent_color`) deixam de disparar drift — ajuste intencional de política. |
| 2026-06-26 | `dismissSnapshot` persiste com `SNAPSHOT_FIELDS` (7) e compara com `DRIFT_FIELDS` (4). Armazena para futuro, compara só o que importa hoje. |
| 2026-06-26 | `snapshotsEqual` vive no hook (não em `drift.ts`) e usa `SNAPSHOT_FIELDS`. É igualdade estrutural para React, não política de drift. |
| 2026-06-26 | Política de drift por `identity_state` e `criticalFields` condicional adiadas para 4.6.2.2. |
