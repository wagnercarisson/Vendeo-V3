# Phase 48.2.4: Experimento determinístico Oferta 1:1 — Pattern Map

**Mapped:** 2026-09-30
**Files analyzed:** 13 artefatos novos/grupos (módulos puros + DDL + rota + UI + testes) + 17 seams de modificação aditiva
**Analogs found:** 30 / 30 (nenhum arquivo sem analog; 6 peças genuinamente novas tratadas como **composição** explícita)
**Fonte:** `48.2.4-CONTEXT.md` (D1–D18 + cross-cutting), `48.2.4-UI-SPEC.md`, OpenSpec `fase-48-2-4-experimento-deterministico-oferta-1-1` (design D1–D18 / tasks 1–9 / 10 specs) e o precedente direto `48.2.3-fidelidade-experimental-bancada/48-2-3-PATTERNS.md`.
**Idioma:** PT-BR

> Todos os caminhos e números de linha abaixo foram **re-verificados** contra o código atual (2026-09-30). Nenhum analog foi inventado. Onde um arquivo novo ainda **não tem nome canônico**, o nome sugerido é explicitamente marcado como **"nome a critério do plano"**; o **analog** é sempre real e existente.
>
> **Precedente:** a F48.2.3 entregou o compositor mínimo (`prompt-composer.ts`, `COMPOSER_VERSION = "48.2.3-prompt-composer-v1"`), o briefing estruturado, o preflight (compor → editar → aprovar) e a evidência do prompt. A F48.2.4 **refatora** esse compositor em **núcleo + políticas versionadas**, **transporta a identidade canônica** ao modelo, adiciona **prompt-base padrão versionado** e habilita **tentativas imutáveis** com linhagem explícita. O PATTERNS da F48.2.3 continua válido para a **forma** dos arquivos; este documento foca nos **novos contratos** (políticas, prompt-base, identidade, branding mínimo, tentativas).
>
> **Fronteiras intocadas nesta fase (verificadas por `base..HEAD` — Plano de gate/Base SHA):** adapter `Images` produtivo (`src/lib/ai/adapters/images.ts`), `defaultAdapterRegistry` (`src/lib/ai/adapters/registry.ts`), caminho `Responses` produtivo, `store-identity-service` produtivo (`src/lib/store-identity-service.ts`), `art-director-briefing.ts`, `MODEL_ALLOWLIST` (`src/lib/ai/model-registry.ts`), `prompts/**`, formulário/pipeline produtivos e `supabase/migrations/**`. **Nenhuma** dessas linhas é editada; a prova é **temporal** (`base..HEAD`), não um congelamento de conteúdo.

---

## File Classification

| Arquivo novo/modificado | Papel | Fluxo de dados | Analog mais próximo | Qualidade |
|-------------------------|-------|----------------|---------------------|-----------|
| `src/lib/lab/bench/domain/policies/**` (novo) — registry + `types` + políticas `oferta`/`1:1`/`produto`/`peca-unica`/`nenhum` | domain | transform (puro, determinístico) | `config-registry.ts:45-212` + `preset-registry.ts:31-175` + builders por bloco de `prompt-composer.ts:91-163` | exato (registry em código) |
| `src/lib/lab/bench/domain/policies/resolve-bench-prompt-policies.ts` (**nome a critério do plano**) | domain | transform (fail-closed) | `resolveBenchConfig` (`config-registry.ts:153-184`) + `resolveBenchPreset` (`preset-registry.ts:170-175`) | exato (fail-closed) |
| `src/lib/lab/bench/domain/identity-direction.ts` (novo) | domain | transform (puro) | `art-director-briefing.ts:387-437` (`identityReferenceSection`) | role-match |
| `src/lib/lab/bench/domain/prompt-base.ts` (novo) | domain | transform (puro, chaveado por recorte) | `preset-registry.ts:56-126` (`BENCH_PRESETS`) + `config-registry.ts:85-92` (`DEFAULT_BENCH_CONFIG`) | role-match |
| `src/lib/lab/bench/domain/branding-prompt-mapping.ts` (**nome a critério do plano**) | domain | transform (seleção por prioridade) | `experimental-briefing.ts:95-160` + `prompt-composer.ts:91-103` (`identityLines`) + `resolve-bench-brand-color.ts` | exato (determinístico) |
| `src/lib/lab/bench/persistence/duplicate-bench-run-inputs.ts` (**nome a critério do plano**) | service | file-I/O (download + reupload local) | `persistBenchArtifact` (`bench-artifact-service.ts:131-223`) + `buildBenchInputArtifactPath:75-87` | role-match |
| DDL aditivo em `supabase/lab/bench-schema.sql` (colunas `policy_versions`, `prompt_base_version`, `identity_reference`, `attempt_of_run_id` + REVERT) | migration/DDL | batch | bloco ALTER de evidência `bench-schema.sql:80-84` + REVERT `:241-265` | exato |
| `src/app/api/admin/laboratorio/bancada/runs/[id]/attempts/route.ts` (novo) | route | request-response | `inputs/route.ts:40-171` (reserva `draft`) + `runs/[id]/route.ts:36-113` (params `id`) | exato |
| `.../bancada/_components/bench-policies-panel.tsx` (**nome a critério do plano**) | component | transform (read-only) | `bench-branding-panel.tsx:79-88,160-173` (`DataRow`) | exato |
| `.../bancada/_components/bench-prompt-base-editor.tsx` (**nome a critério do plano**) | component | transform | `bench-prompt-editor.tsx:20-46` | exato |
| `.../bancada/_components/bench-attempts-panel.tsx` (**nome a critério do plano**) | component | request-response | `bench-evidence-panel.tsx:88-198` + `bench-preflight-panel.tsx:115-136` | role-match |
| `src/lib/lab/bench/__tests__/prompt-policy.contract.test.ts` (**nome a critério do plano**) | test | transform | `bench-execution.contract.test.ts` (determinismo/negativos) | role-match |
| `src/lib/lab/bench/__tests__/identity-transport.contract.test.ts` (**nome a critério do plano**) | test | file-I/O | `bench-execution.contract.test.ts:76-91` (`RecordingAdapter`) | role-match |
| `src/lib/lab/bench/__tests__/run-history.contract.test.ts` (**nome a critério do plano**) | test | CRUD | `bench-boundary.contract.test.ts` + `recording-supabase-client.ts:407-473` | role-match |
| `scripts/**` ou `src/lib/lab/__tests__/production-untouched.contract.test.ts` (**nome a critério do plano**) — gate Base SHA | test | batch | `lab-isolation.contract.test.ts` (detector) + `architecture-guard.test.ts` | role-match |
| **M1** `src/lib/lab/bench/domain/prompt-composer.ts` | domain | transform | (self, refatoração núcleo) | seam |
| **M2** `src/lib/lab/bench/domain/schemas.ts` | domain | transform | (self, aditivo) | seam |
| **M3** `src/lib/lab/bench/persistence/bench-run-service.ts` | service | CRUD | (self, aditivo) | seam |
| **M4** `src/lib/lab/bench/gateway/runtime.ts` | gateway | request-response | (self, aditivo) | seam |
| **M5** `src/lib/ai/adapters/bench-images.ts` | adapter | file-I/O | (self, aditivo) | seam |
| **M6** `src/lib/lab/bench/execution/bench-execution-service.ts` | service | request-response | (self, aditivo) | seam |
| **M7** `supabase/lab/bench-schema.sql` | migration/DDL | batch | (self, aditivo) | seam |
| **M8** `scripts/lab/48-2-2-bench-bootstrap.mjs` | utility | batch | (self, provável no-op) | seam |
| **M9** `src/app/api/admin/laboratorio/bancada/compose/route.ts` | route | request-response | (self, aditivo) | seam |
| **M10** `src/app/api/admin/laboratorio/bancada/runs/route.ts` | route | request-response + streaming | (self, aditivo) | seam |
| **M11** `src/app/api/admin/laboratorio/bancada/runs/[id]/route.ts` | route | request-response | (self, aditivo) | seam |
| **M12** UI `.../bancada/_components/*` (workbench/preflight/branding/evidence) | component | request-response | (self, aditivo) | seam |
| **M13** `src/lib/lab/__tests__/recording-supabase-client.ts` + `lab-isolation.contract.test.ts` | test | — | (self, aditivo) | seam |
| **M14** `src/lib/ai/__tests__/architecture-guard.test.ts` | test | — | (self, aditivo) | seam |
| **M15** `.../bancada/__tests__/bench-api.contract.test.ts` + `bench-ui.contract.test.tsx` | test | — | (self, aditivo) | seam |

---

## Pattern Assignments

### 1. `src/lib/lab/bench/domain/policies/**` — registry de políticas versionadas (novo)

**Papel:** domain · **Fluxo:** transform puro/determinístico · **Analog:** `config-registry.ts:45-212` (registry em código com `enabled`/`reason`) + `preset-registry.ts:31-175` (tipo do artefato + resolução) + os builders por bloco de `prompt-composer.ts:91-163`

**Forma do registry (dimensão → entradas habilitadas/desabilitadas com motivo)** (`config-registry.ts:45-82`):
```typescript
export const BENCH_CONFIG_REGISTRY: Record<BenchRegistryDimension, readonly BenchRegistryEntry[]> = {
  pipeline: [
    { id: "manual-direto", label: "Manual direto", enabled: true },
    { id: "ia-assistido", label: "IA assistido (futuro)", enabled: false, reason: FORA_DO_RECORTE },
  ],
  formato: [
    { id: "1:1", label: "Quadrado 1:1", enabled: true },
    { id: "9:16", label: "Vertical 9:16", enabled: false, reason: FORA_DO_RECORTE },
  ],
  intencao: [
    { id: "oferta", label: "Oferta", enabled: true },
    { id: "destaque", label: "Destaque", enabled: false, reason: FORA_DO_RECORTE },
    { id: "exclusivo", label: "Exclusivo", enabled: false, reason: FORA_DO_RECORTE },
  ],
  // tipoConteudo/estrutura/tema análogos (L64-81)
};
```

**Forma do artefato versionado + erro determinístico** (`preset-registry.ts:31-43,134-145`):
```typescript
export interface BenchPreset {
  id: string; label: string; capability: AiCapability; provider: AiProvider;
  model: string; protocol: AiProtocol; quality: string; size: string;
  enabled: boolean; reason?: string;
}
export class BenchPresetError extends Error {
  readonly code = "preset_not_enabled" as const;
  readonly presetId: string; readonly reason?: string;
  constructor(presetId: string, reason?: string) { /* ... */ }
}
```

**O que espelhar (novo):** cada política é um módulo puro e versionado `{ id, dimension, value, version, contributions(context) }` que **declara em quais blocos canônicos contribui** e as linhas que produz (D1). Blocos canônicos travados vêm de `prompt-composer.ts:39-61` (`PROMPT_BLOCK_LABELS`/`PROMPT_BLOCK_ORDER`). Habilitar **somente** `oferta`, `1:1`, `produto`, `peca-unica`, `nenhum`; as demais dimensões/valores permanecem **desabilitados com motivo** (`fora_do_primeiro_recorte`). Nenhum CHECK por valor no banco (a autoridade é o registry em código). O núcleo **não** contém regra de dimensão (D1); acrescentar dimensões futuras = adicionar política + habilitar valor.

**Contribuições por política (D3/D4/D5), em linguagem natural (D7):**
- `oferta` → `[CONDIÇÕES COMERCIAIS]` (hierarquia comercial, **sem posições fixas**) + `[INTENÇÃO E FORMATO]` ("Oferta").
- `1:1` → `[INTENÇÃO E FORMATO]` ("quadrado 1:1", composição quadrada, **sem congelar layout**).
- `produto` → `[PRODUTO E IMAGENS DE REFERÊNCIA]`.
- `peca-unica` → `[INTENÇÃO E FORMATO]` ("peça única").
- `nenhum` (tema) → **nenhuma linha** (omitida do prompt), mas **resolvida/versionada/registrada** na evidência.

---

### 2. `resolveBenchPromptPolicies(config)` — resolução explícita fail-closed (novo)

**Papel:** domain · **Fluxo:** transform fail-closed · **Analog:** `resolveBenchConfig` (`config-registry.ts:153-184`) + `resolveBenchPreset` (`preset-registry.ts:170-175`)

**Resolução por dimensão com erro determinístico** (`config-registry.ts:163-181`):
```typescript
for (const dimension of BENCH_REGISTRY_DIMENSIONS) {
  const value = parsed.data[dimension];
  const entry = findEntry(dimension, value);
  if (!entry) {
    throw new BenchConfigRegistryError({ dimension, value, code: "config_registry_unknown_value" });
  }
  if (!entry.enabled) {
    throw new BenchConfigRegistryError({
      dimension, value, code: "config_registry_value_disabled", reason: entry.reason,
    });
  }
}
```

**Resolução de preset habilitado** (`preset-registry.ts:170-175`):
```typescript
export function resolveBenchPreset(id: string): BenchPreset {
  const preset = BENCH_PRESETS.find((candidate) => candidate.id === id);
  if (!preset) throw new BenchPresetError(id, "preset_inexistente");
  if (!preset.enabled) throw new BenchPresetError(id, preset.reason);
  return preset;
}
```

**O que espelhar (novo):** `resolveBenchPromptPolicies(config)` percorre `intencao`, `formato`, `tipoConteudo`, `estrutura`, `tema` e resolve a política habilitada de cada uma pelo registry. Se uma dimensão habilitada **não** possuir política implementada, lança **`bench_policy_not_implemented`** **antes** de qualquer chamada paga (D2), sem fallback/improvisação. As versões resolvidas integram a evidência. Testes negativos para cada dimensão desabilitada (Destaque, Exclusivo, 9:16, serviço, informativo, tema, carrossel) — tasks 3.9.

---

### 3. `src/lib/lab/bench/domain/identity-direction.ts` — orientação textual de fidelidade (novo)

**Papel:** domain · **Fluxo:** transform puro · **Analog:** `art-director-briefing.ts:387-437` (`identityReferenceSection`)

**Padrão de orientação por estado de identidade, sem posição fixa** (`art-director-briefing.ts:404-434`):
```typescript
if (state === "logo" || state === "visual_signature") {
  const isFeminine = state === "visual_signature";
  const element = isFeminine ? "assinatura visual" : "logotipo";
  const positionAdjective = isFeminine ? "secundária" : "secundário";
  if (hasAsset) {
    parts.push(
      `Assinar a campanha com ${article} ${element} da loja ${participle} como imagem de referência, reproduzindo o ativo com fidelidade. NÃO editar, redesenhar, distorcer, reinterpretar, completar nem inventar elementos do ativo. Manter ... dentro da área segura da arte ... A posição é livre na composição, desde que ... permaneça legível, reconhecível e ${positionAdjective} ao conteúdo principal da peça.`
    );
  }
} else {
  parts.push("Não colocar logotipo nem gerar assinatura visual. Usar as cores e a linguagem visual da loja como referência de direção, sem inventar elementos de identidade.");
}
```

**O que espelhar (novo):** `identity-direction.ts` é uma **contribuição de identidade dedicada** (D9), **separada** do núcleo e das políticas de recorte. Quando há referência de identidade, adiciona ao bloco `[IDENTIDADE E DIREÇÃO VISUAL]` a orientação de **reprodução fiel** (sem redesenhar/distorcer/completar/reinterpretar), mantendo-a **secundária** e **sem posição fixa**. O núcleo permanece **neutro** (não gera orientação de identidade). O texto segue o tom determinístico do produtivo, mas **não** reutiliza `art-director-briefing.ts` diretamente (arquivo produtivo intocado).

---

### 4. `src/lib/lab/bench/domain/prompt-base.ts` — prompt-base padrão versionado (novo)

**Papel:** domain · **Fluxo:** transform puro chaveado por recorte · **Analog:** `preset-registry.ts:56-126` (`BENCH_PRESETS`, artefato versionado em código) + `config-registry.ts:85-92` (`DEFAULT_BENCH_CONFIG`)

**Constante de recorte travado** (`config-registry.ts:85-92`):
```typescript
export const DEFAULT_BENCH_CONFIG: BenchRecorteConfig = {
  pipeline: "manual-direto", formato: "1:1", intencao: "oferta",
  tipoConteudo: "produto", estrutura: "peca-unica", tema: "nenhum",
};
```

**O que espelhar (novo):** `prompt-base.ts` expõe `BENCH_DEFAULT_PROMPT_BASE` + `BENCH_DEFAULT_PROMPT_BASE_VERSION`, **resolvidos por configuração** (chaveado pelo recorte multidimensional), mesmo havendo só o perfil Oferta 1:1 (D6). O conteúdo do padrão contém **somente instruções complementares** — sem repetir hierarquia de oferta nem formato 1:1 (já nas políticas). A UI carrega o padrão inicialmente; o operador pode editá-lo. O compositor **preserva integralmente** o prompt-base (padrão ou editado); a evidência registra **versão do padrão** e **conteúdo efetivamente usado**. Nenhuma geração/revisão por IA. **Alternativa rejeitada:** constante global única (não escalaria para outros recortes).

---

### 5. `branding-prompt-mapping.ts` — seleção determinística por prioridade (novo, **nome a critério do plano**)

**Papel:** domain · **Fluxo:** transform determinístico · **Analog:** `experimental-briefing.ts:95-160` + `prompt-composer.ts:91-103` (`identityLines`) + `resolve-bench-brand-color.ts`

**Comportamento atual a CORRIGIR — emite os cinco campos** (`prompt-composer.ts:91-103`, D8):
```typescript
function identityLines(briefing: BenchExperimentalBriefing): string[] {
  const lines: string[] = [];
  pushLine(lines, "Loja", briefing.storeName);
  pushLine(lines, "Segmento", briefing.segment);
  pushLine(lines, "Cor da marca", briefing.brandColor);
  const direction = briefing.visualDirection;
  pushLine(lines, "Brief da marca", direction.campaignBrief);
  pushLine(lines, "Diretrizes de campanha", direction.campaignGuidelines);
  pushLine(lines, "Estilo visual", direction.visualStyle);
  pushLine(lines, "Tom visual", direction.visualTone);
  pushLine(lines, "Personalidade da marca", direction.brandPersonality); // 5 campos simultâneos — ERRADO por D8
  return lines;
}
```

**Contrato de direção visual consolidada já disponível** (`experimental-briefing.ts:28-34,134-141`):
```typescript
export interface BenchExperimentalVisualDirection {
  campaignBrief: string | null;
  campaignGuidelines: string | null;
  visualStyle: string | null;
  visualTone: string | null;
  brandPersonality: string | null;
}
```

**O que espelhar (novo):** o mapeamento passa a enviar a **menor representação** que preserva a direção visual (D8):
- **Sempre:** `storeName` + `brandColor` resolvido.
- **Direção visual (um único campo)** pela cadeia `campaignBrief` → `campaignGuidelines` → `visualStyle` → `visualTone` → `brandPersonality` (usar o **primeiro não vazio**; **nunca** os cinco).
- **Direção tipográfica** (`typographyDirection`) no bloco próprio `[DIREÇÃO TIPOGRÁFICA]`.
- **Todos os demais** (`segment`, `subsegment`, `toneOfVoice`, `positioning`, `shortDescription`, `slogan`, `safeColorTokens`, `brandColorsChosen`, `inferredPrimaryColor`, `storeBrandColor`, `logoColorsDetected`, `profileSource`, `profileStatus`) permanecem **apenas na evidência**.

Puramente determinístico, **sem** dedup semântica/embedding e **sem** IA. **Alternativa rejeitada:** dedup só por igualdade textual (os cinco usam frases diferentes para ideias semelhantes — todos entrariam).

---

### 6. `duplicate-bench-run-inputs.ts` — reuso seguro de entradas (novo, **nome a critério do plano**)

**Papel:** service · **Fluxo:** file-I/O (download + reupload local) · **Analog:** `persistBenchArtifact` (`bench-artifact-service.ts:131-223`) + `buildBenchInputArtifactPath:75-87`

**Path de entrada e persistência com rollback** (`bench-artifact-service.ts:75-87,131-162`):
```typescript
export function buildBenchInputArtifactPath(params: { runId: string; index: number; mimeType: string }): string {
  const ext = extensionForMimeType(params.mimeType);
  if (!Number.isInteger(params.index) || params.index < 0) throw new Error(INVALID_BENCH_ARTIFACT_PATH);
  const storagePath = `${BENCH_ARTIFACT_PATH_PREFIX}/${params.runId}/inputs/${params.index}.${ext}`;
  assertLabArtifactPath(storagePath);
  return storagePath;
}
// persistBenchArtifact: valida buffer/MIME → monta/valida path → checksum → upload (upsert:false) → insert metadados
//   → em falha: rollback best-effort (`storage.remove`) + finalizeRun injetado
```

**Guard de path do próprio run** (`schemas.ts:219-227`, `isBenchInputReference`):
```typescript
function isBenchInputReference(reference: string, runId: string): boolean {
  if (reference.includes("..") || reference.includes("\\") || reference.includes("://")) return false;
  const prefix = `${BENCH_REFERENCE_PREFIX}${runId}/inputs/`;
  if (!reference.startsWith(prefix)) return false;
  const rest = reference.slice(prefix.length);
  return rest.length > 0 && !rest.startsWith("/") && !rest.includes("//");
}
```

**O que espelhar (novo):** `duplicateBenchRunInputs({ client, fromRunId, toRunId })` copia os objetos de entrada do run anterior para o prefixo do novo run (`bench/{novoRunId}/inputs/{index}.{ext}`) via **download + `persistBenchArtifact`**, preservando MIME/dimensões/checksum (D12). O **guard de path não é relaxado** (`BenchRunInputSchema` continua exigindo o prefixo do próprio run). **Alternativa rejeitada:** aceitar referências de outro run (enfraqueceria o isolamento); novo upload manual (o objetivo é evitar reupload).

---

### 7. DDL aditivo — `supabase/lab/bench-schema.sql` (novas colunas + REVERT)

**Papel:** migration/DDL · **Fluxo:** batch · **Analog:** bloco ALTER de evidência (`bench-schema.sql:80-84`) + REVERT (`:241-265`)

**Padrão aditivo idempotente das colunas de evidência** (`bench-schema.sql:80-84`):
```sql
ALTER TABLE public.lab_bench_runs ADD COLUMN IF NOT EXISTS prompt_base TEXT;
ALTER TABLE public.lab_bench_runs ADD COLUMN IF NOT EXISTS prompt_compiled TEXT;
ALTER TABLE public.lab_bench_runs ADD COLUMN IF NOT EXISTS prompt_approved TEXT;
ALTER TABLE public.lab_bench_runs ADD COLUMN IF NOT EXISTS prompt_blocks JSONB;
ALTER TABLE public.lab_bench_runs ADD COLUMN IF NOT EXISTS composer_version TEXT;
```

**Bloco REVERT (instruções comentadas após o marcador)** (`bench-schema.sql:241-265`):
```sql
-- =============================================================================
-- REVERT (ordem reversa de criação — executar com `--revert` ou manualmente)
-- =============================================================================
-- ALTER TABLE public.lab_bench_runs DROP COLUMN IF EXISTS composer_version;
-- ...
-- DROP TABLE IF EXISTS public.lab_bench_runs CASCADE;
```

**Trigger de imutabilidade a estender** (`bench-schema.sql:165-172`):
```sql
IF OLD.status NOT IN ('draft','pending') THEN
  IF NEW.campaign_snapshot IS DISTINCT FROM OLD.campaign_snapshot
     OR NEW.branding_snapshot IS DISTINCT FROM OLD.branding_snapshot
     OR NEW.config IS DISTINCT FROM OLD.config
     OR NEW.prompt_sent IS DISTINCT FROM OLD.prompt_sent THEN
    RAISE EXCEPTION 'lab_bench_run_snapshot_immutable';
  END IF;
END IF;
```

**O que espelhar (novo, D14):** adicionar colunas **nullable** em `lab_bench_runs` com `ADD COLUMN IF NOT EXISTS`:
- `policy_versions JSONB` (versões das políticas),
- `prompt_base_version TEXT` (versão do prompt-base padrão),
- `identity_reference JSONB` (`{ kind, variantType, storagePath }` — **sem URL assinada**),
- `attempt_of_run_id UUID REFERENCES public.lab_bench_runs(id)` (linhagem explícita; primeira geração `NULL`).

Estender a **imutabilidade** a partir de `running` para `policy_versions`/`prompt_base_version`/`identity_reference`; `attempt_of_run_id` deve ser imutável desde a criação. Adicionar as linhas de **REVERT** correspondentes. **Nenhuma tabela nova**; `supabase db push` **não** carrega a bancada (DDL fora de `supabase/migrations/`). Aplicação pelo bootstrap local (M8).

---

### 8. `runs/[id]/attempts/route.ts` — nova tentativa (novo)

**Papel:** route · **Fluxo:** request-response · **Analog:** `inputs/route.ts:40-171` (reserva `draft` via `reserveBenchRun`) + `runs/[id]/route.ts:36-113` (params `id`)

**Ordem de guards + reserva do draft** (`inputs/route.ts:40-104`):
```typescript
export const POST = apiHandler(async (request: Request) => {
  const admin = await requireAdmin();
  try { assertLabEnvironment(); }
  catch (error) {
    if (error instanceof LabEnvironmentError)
      return NextResponse.json(labEnvironmentDeniedBody(error.reason), { status: 403 });
    throw error;
  }
  // ... valida operationId (UUID) ...
  let reserved: { runId: string; idempotent: boolean };
  try {
    reserved = await reserveBenchRun({ client, operationId, createdBy: admin.userId });
  } catch (error) { /* missing_operation_id 400 / idempotency_conflict 409 */ }
});
```

**Params dinâmicos** (`runs/[id]/route.ts:36-51`):
```typescript
export const GET = apiHandler(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    await requireAdmin();
    // ... guarda de ambiente ...
    const { id } = await params;
    const run = await getBenchRun({ client: supabaseAdmin, runId: id });
    if (!run) return NextResponse.json({ error: "run_not_found" }, { status: 404 });
  },
);
```

**O que espelhar (novo):** `POST /runs/[id]/attempts` cria um **novo run `draft`** (`reserveBenchRun` com **novo** `operationId`) a partir de um run anterior, copia as entradas (`duplicateBenchRunInputs`) e grava `attempt_of_run_id` apontando para o run de origem (D12/D13). Devolve `runId` + `references` + dados da campanha para prefill. Guards na ordem `requireAdmin()` → `assertLabEnvironment()` → `assertBenchTestStore` antes de qualquer leitura com `storeId`. Nenhuma chamada paga aqui.

---

### 9. UI — painel de políticas/versões (novo, **nome a critério do plano**)

**Papel:** component · **Fluxo:** read-only · **Analog:** `bench-branding-panel.tsx:79-88,160-173` (`DataRow` + linhas de identidade)

**Linha de dado mono + label uppercase** (`bench-branding-panel.tsx:79-88,160-173`):
```tsx
function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wider text-text-muted font-heading">{label}</dt>
      <dd className="text-sm text-text-primary font-body">{value}</dd>
    </div>
  );
}
// ...
<DataRow label="Estado da identidade" value={branding.identityState} />
<DataRow label="Asset de identidade" value={branding.identityReference ? `${kind} · ${variantType}` : EMPTY} />
```

**O que espelhar (novo, D16/UI-SPEC §Interaction):** exibe as **políticas habilitadas** (id + versão: `oferta`, `1:1`, `produto`, `peca-unica`, `nenhum`), a **versão do compositor** e a **versão do prompt-base padrão**; valores desabilitados sinalizados com motivo. Dados técnicos/versões em JetBrains Mono 500. Reutiliza primitivos locais (`lab-textarea`, `lab-select`) e globais (`card`, `badge`); **não** criar novos primitivos experimentais. Sem comparação lado a lado/votação.

---

### 10. UI — editor do prompt-base padrão + linha de identidade + tentativas (novo)

**Papel:** component · **Fluxo:** transform/request-response · **Analog:** `bench-prompt-editor.tsx:20-46` (editor do prompt-base) + `bench-evidence-panel.tsx:88-198` (painel de lista) + `bench-preflight-panel.tsx:115-136` (ações)

**Editor de prompt-base existente a evoluir** (`bench-prompt-editor.tsx:20-46`):
```tsx
export function BenchPromptEditor({ value, onChange, disabled = false }: BenchPromptEditorProps) {
  return (
    <section data-testid="bench-prompt-editor" className="rounded-xl border border-border bg-bg-surface p-5" aria-labelledby="bench-prompt-title">
      <h2 id="bench-prompt-title" className="mb-4 font-heading text-lg font-semibold text-text-primary">Prompt</h2>
      <LabTextarea label="Prompt" value={value} disabled={disabled} rows={6}
        hint="Prompt-base manual — o compositor o preserva integralmente no bloco [INSTRUÇÕES DO PROMPT-BASE]."
        onChange={(event) => onChange(event.target.value)} />
    </section>
  );
}
```

**Padrão de lista com badge de status + ação** (`bench-evidence-panel.tsx:100-110`):
```tsx
<Card className="space-y-4 p-5">
  <div className="flex items-center justify-between gap-2">
    <h2 className="font-heading text-lg font-semibold text-text-primary">Evidências</h2>
    {run && <Badge variant={run.status === "succeeded" ? "ready" : "default"}>{run.status}</Badge>}
  </div>
```

**O que espelhar (novo):**
- **Prompt-base padrão:** o padrão versionado é carregado inicialmente no editor (`bench-prompt-editor.tsx`) e pode ser editado antes de compor (D6/UI-SPEC).
- **Referência canônica de identidade:** linha read-only `{ kind, variantType, storagePath }` — **sem** exibir/persistir URL assinada (D10/UI-SPEC).
- **Tentativas anteriores + "Nova tentativa":** lista enxuta por linhagem explícita (`attempt_of_run_id`), ordenada por criação, com resultado/status; botão **"Nova tentativa"** (CTA) que chama `POST /runs/[id]/attempts`. Empty state "Nenhuma tentativa anterior". Desktop-only; **sem** lado a lado/votação/ranking.

---

### 11. Testes novos — determinismo/negativos, byte a byte, identidade, tentativa, Base SHA

**Papel:** test · **Analog:** `bench-execution.contract.test.ts:76-91` (`RecordingAdapter`) + `recording-supabase-client.ts:407-473` + `lab-isolation.contract.test.ts` + `architecture-guard.test.ts`

**Adapter gravador — prova byte a byte de `prompt_sent`** (`bench-execution.contract.test.ts:76-91`):
```typescript
class RecordingAdapter implements AiAdapter {
  readonly protocol = "images" as const;
  readonly calls: Array<{ request: AiInvocationRequest; target: AiModelTarget }> = [];
  result: AiInvocationResult = { imageBase64: "ZmFrZS1pbWFnZQ==", mimeType: "image/png", model: "gpt-image-2" };
  error?: Error;
  async invoke(request: AiInvocationRequest, target: AiModelTarget): Promise<AiInvocationResult> {
    this.calls.push({ request, target });
    if (this.error) throw this.error;
    return this.result;
  }
}
```

**Cliente gravador + allowlist + detector produtivo** (`recording-supabase-client.ts:269-291,320-341,407-473`):
```typescript
export const ALLOWED_TABLES = new Set([
  /* ... */ "lab_bench_runs", "lab_bench_artifacts", "lab_bench_store_imports",
  "stores", "store_brand_profiles", "store_brand_assets", "store_visual_signatures",
]);
export const READ_ONLY_TABLES = new Set([
  "ai_model_catalog", "stores", "store_brand_profiles", "store_brand_assets", "store_visual_signatures",
]);
export const FORBIDDEN_TARGETS = [
  "campaigns", "campaign_art_versions", "generation_events", "ai_model_selection",
  "admin_audit_log", "credit_transactions", "campaign-images",
];
```

**Gates estáticos do bounded context da bancada** (`architecture-guard.test.ts:260-283,339-362`):
```typescript
const benchFiles = files.filter((file) => file.startsWith("src/lib/lab/bench/"));
// ... gate: sem generation_events, sem AiCostTracker.record, sem provider de imagem de produção,
//     sem SDK/wire, sem chave de provider, sem ai_model_selection, sem escrita em ai_model_catalog/prompts/
```

**O que espelhar (novo):**
- **Políticas:** mesma entrada ⇒ mesma saída; contribuições por bloco; versões registradas; **negativos** — cada combinação não habilitada (Destaque, Exclusivo, 9:16, serviço, informativo, tema, carrossel) falha com `bench_policy_not_implemented` **antes da chamada paga** (tasks 3.8/3.9).
- **`prompt_sent` byte a byte:** `RecordingAdapter` prova que o texto enviado é exatamente o prompt final aprovado (task 7.6).
- **Identidade:** `logo`/`visual_signature`/`text_only` + referência indisponível (`bench_identity_reference_unavailable`) **antes da chamada paga** (task 6.6).
- **Nova tentativa/imutabilidade:** novo run, run anterior imutável, reuso de entradas sob o prefixo do novo run, isolamento por paths (task 7.6).
- **Base SHA:** `git diff $BASE..HEAD` dos caminhos produtivos vazio (base ausente ⇒ falha) — tasks 1.5/9.4.

---

## Modified Files — seam exato (aditivo, sem quebrar o existente)

### M1. `src/lib/lab/bench/domain/prompt-composer.ts` — refatoração em núcleo (D1/D7)

**Seam:** `COMPOSER_VERSION` em **L35**; `PROMPT_BLOCK_LABELS`/`PROMPT_BLOCK_ORDER` em **L39-61**; builders por bloco em **L91-163**; `composePromptBlocks` em **L171-195**; `composePrompt` em **L201-203**.

```typescript
// L91-103 (HOJE) — identityLines emite os cinco campos; CORRIGIR por D8 (delega ao branding-prompt-mapping):
function identityLines(briefing: BenchExperimentalBriefing): string[] {
  const lines: string[] = [];
  pushLine(lines, "Loja", briefing.storeName);
  pushLine(lines, "Segmento", briefing.segment);          // sai do prompt (fica só na evidência)
  pushLine(lines, "Cor da marca", briefing.brandColor);
  pushLine(lines, "Brief da marca", direction.campaignBrief);        // os cinco simultâneos — sai
  pushLine(lines, "Diretrizes de campanha", direction.campaignGuidelines);
  pushLine(lines, "Estilo visual", direction.visualStyle);
  pushLine(lines, "Tom visual", direction.visualTone);
  pushLine(lines, "Personalidade da marca", direction.brandPersonality);
  return lines;
}
```

**Adicionar:** `prompt-composer.ts` passa a ser o **núcleo** (`composePromptBlocks`) que recebe briefing + prompt-base + **lista de contribuições de política** (de `resolveBenchPromptPolicies`) e monta os 7 blocos canônicos na ordem travada, omite vazios, preserva o prompt-base verbatim e **registra as versões**. O núcleo **não** contém regra específica de dimensão (D1). `COMPOSER_VERSION` é atualizada (nova versão da fase).
**O que deve permanecer inalterado:** a ordem travada dos blocos (`PROMPT_BLOCK_ORDER` L53-61), a omissão de blocos vazios (L187-192), a preservação verbatim do prompt-base (`promptBaseLines` L154-157) e o caráter **puro/sem IA** (sem I/O, sem provider).

### M2. `src/lib/lab/bench/domain/schemas.ts` — evidência de versões/identidade/tentativa

**Seam:** `BenchIdentityReferenceSchema` em **L151-159**; `BenchPreflightEvidenceSchema` em **L235-248**; `BenchRunInputSchema` em **L252-280**; `parseBenchRunInput` em **L291-295**.

```typescript
// L235-248 (HOJE) — evidência do preflight; ADICIONAR policyVersions/promptBaseVersion/identityReference:
export const BenchPreflightEvidenceSchema = z.object({
  promptBase: z.string(),
  promptCompiled: z.string(),
  promptApproved: z.string().min(1),
  promptBlocks: z.record(z.string(), z.string()),
  composerVersion: z.string().min(1),
}).strict();
```

**Adicionar:** `policyVersions` (mapa dimensão→versão), `promptBaseVersion`, `identityReference` (`{ kind, variantType, storagePath }`, **sem URL**) na evidência; campos opcionais de `attemptOfRunId` no contrato de persistência. Manter `.strict()`.
**O que deve permanecer inalterado:** `isBenchInputReference` (L219-227, guard de path), `BenchProductSchema`/`BenchOfferSchema` (L92-124), `BenchBrandingSnapshotSchema` (L167-205), `parseBenchRunInput`/`parseBenchConfig`.

### M3. `src/lib/lab/bench/persistence/bench-run-service.ts` — persistência das novas evidências + linhagem

**Seam:** `BenchRunRecord` em **L89-126**; `mapBenchRunRow` em **L128-166**; `reserveBenchRun` em **L220-253**; `setBenchRunInput` em **L262-329** (`promptApproved ⇒ prompt_sent` em **L300-305**); `finalizeBenchRun` em **L394-439**; `reconcileStaleBenchRuns` em **L456-552**.

```typescript
// L300-305 (HOJE) — prompt_sent = promptApproved; manter e ADICIONAR policyVersions/promptBaseVersion/identityReference:
if (params.promptApproved !== undefined) {
  update.prompt_approved = params.promptApproved;
  update.prompt_sent = params.promptApproved;
} else if (params.promptSent !== undefined) {
  update.prompt_sent = params.promptSent;
}
```

**Adicionar:** campos `policyVersions`, `promptBaseVersion`, `identityReference` e `attemptOfRunId` em `BenchRunRecord`/`mapBenchRunRow`/`setBenchRunInput`; `reserveBenchRun` aceita `attemptOfRunId` opcional; **nova** função de leitura de linhagem (raiz + descendentes por `attempt_of_run_id`, ordenada por `created_at`).
**O que deve permanecer inalterado:** o CAS `draft → pending` (`confirmBenchRun` L340-358), `markBenchRunRunning` (L366-385), o CAS terminal de `finalizeBenchRun` (L429-438), `reconcileStaleBenchRuns` e o índice global de geração ativa.

### M4. `src/lib/lab/bench/gateway/runtime.ts` — transporte de `identityImageUrl`

**Seam:** `createBenchAdapterRegistry` em **L32-44**; `createBenchGateway` em **L50-60**; `buildBenchInvocationRequest` em **L71-85**.

```typescript
// L71-85 (HOJE) — identityImageUrl deliberadamente omitido; ADICIONAR (D10):
export function buildBenchInvocationRequest(params: {
  preset: BenchPreset; prompt: string;
  productImagesDataUrls?: readonly string[];
  signal?: AbortSignal; timeout?: number;
}): AiInvocationRequest {
  return {
    prompt: params.prompt,
    productImagesDataUrls: params.productImagesDataUrls ? [...params.productImagesDataUrls] : [],
    size: params.preset.size,
    quality: params.preset.quality,
    ...(params.signal ? { signal: params.signal } : {}),
    ...(params.timeout !== undefined ? { timeout: params.timeout } : {}),
  };
}
```

**Adicionar:** `buildBenchInvocationRequest` aceita e inclui `identityImageUrl` (data URL) resolvido em `POST /runs` a partir da referência canônica (D10).
**O que deve permanecer inalterado:** `createBenchAdapterRegistry` (registra `BenchImagesAdapter` **apenas** aqui), `createBenchGateway` (single-shot) e o fato de `defaultAdapterRegistry` **não** ser alterado.

### M5. `src/lib/ai/adapters/bench-images.ts` — anexar identidade como última referência (D10)

**Seam:** `BenchImagesAdapter` em **L37-98**; ordem das referências em **L44-58**; comentário que ignora `identityImageUrl` em **L60-61**; `dataUrlToFile` em **L100-112**.

```typescript
// L52-61 (HOJE) — [primary, ...adicionais]; identityImageUrl IGNORADO; ADICIONAR identidade como último arquivo:
const files: unknown[] = [await dataUrlToFile(toFile, primaryDataUrl, "product")];
for (let i = 1; i < productImages.length; i++) {
  const referenceDataUrl = productImages[i];
  if (referenceDataUrl === primaryDataUrl) continue;
  files.push(await dataUrlToFile(toFile, referenceDataUrl, `reference-${i}`));
}
// O logo/assinatura do branding NÃO é enviado: `request.identityImageUrl` é deliberadamente ignorado.
```

**Adicionar:** quando `request.identityImageUrl` estiver presente, anexar como o **último** arquivo, após as imagens do produto (ordem documentada: principal → adicionais → identidade). `text_only` não envia imagem.
**O que deve permanecer inalterado:** o adapter `Images` **produtivo** (`src/lib/ai/adapters/images.ts`) e o `defaultAdapterRegistry` — **byte a byte**; este adapter da bancada continua registrado **apenas** no runtime da bancada.

### M6. `src/lib/lab/bench/execution/bench-execution-service.ts` — repasse de `identityImageUrl`

**Seam:** `BenchExecutionRequest` em **L42-49**; `executeBenchRun` em **L120-214**; chamada a `buildBenchInvocationRequest` em **L129-135**.

```typescript
// L129-135 (HOJE) — não passa identidade; ADICIONAR identityImageUrl:
const invocationRequest = buildBenchInvocationRequest({
  preset, prompt: params.request.prompt,
  productImagesDataUrls: params.request.productImagesDataUrls,
  signal: params.request.signal, timeout: params.request.timeout,
});
```

**Adicionar:** `BenchExecutionRequest` ganha `identityImageUrl?` e `executeBenchRun` o repassa a `buildBenchInvocationRequest`. Falha de identidade indisponível ocorre **antes** (`bench_identity_reference_unavailable`), em `POST /runs`.
**O que deve permanecer inalterado:** single-shot (uma invocação), resolução de custo local, finalização sanitizada.

### M7. `supabase/lab/bench-schema.sql` — colunas aditivas + REVERT (ver §7)

**Seam:** `CREATE TABLE lab_bench_runs` em **L37-70**; bloco ALTER de evidência em **L80-84**; trigger de imutabilidade em **L153-182**; REVERT em **L241-265**.
**O que deve permanecer inalterado:** índice `uq_lab_bench_runs_one_active_global` (L114-116), triggers no-delete (L187-201), `lab_bench_store_imports` (L216-239) e o fato de o DDL viver **fora** de `supabase/migrations/`.

### M8. `scripts/lab/48-2-2-bench-bootstrap.mjs` — aplicação do DDL aditivo (provável no-op)

**Seam:** `assertLocalHost` em **L61-76**; `extractRevertStatements` em **L132-152**; `applyBenchSchema` em **L165-170**; `main` em **L233-260**; `invokedDirectly` em **L262-277**.

**Análise:** `applyBenchSchema` executa **o arquivo inteiro** (`bench-schema.sql`) e `extractRevertStatements` coleta **todas** as linhas `-- <sql>;` após o marcador `REVERT`. O DDL aditivo (M7) é aplicado/revertido **automaticamente**, desde que suas instruções REVERT sejam adicionadas no mesmo arquivo. O bootstrap **provavelmente não precisa de alteração de código** — apenas confirmação no plano (task 2.2).
**O que deve permanecer inalterado:** `assertLocalHost`, `resolveLocalConnection`, `main`, `insertBenchCatalogRows`/`revertBenchCatalogRows` e o `invokedDirectly`.

### M9. `src/app/api/admin/laboratorio/bancada/compose/route.ts` — políticas/versões no `POST /compose`

**Seam:** `POST` em **L43-159**; guards em **L44-87**; resolução de config/preset em **L112-135**; composição em **L144-148**; resposta em **L150-158**.

```typescript
// L144-158 (HOJE) — compõe e devolve composerVersion; ADICIONAR policyVersions/promptBase padrão (D15):
const composition = composePromptBlocks({ briefing, promptBase, references });
return NextResponse.json({
  compiledPrompt: composition.text,
  blocks: composition.blocks,
  composerVersion: COMPOSER_VERSION,
  briefing,
  approved: raw.approved === true,
});
```

**Adicionar:** resolver as políticas (fail-closed) e retornar prompt compilado, blocos, **versões das políticas**, **versão do prompt-base padrão** e o prompt-base padrão (D15). `bench_policy_not_implemented` → erro antes da chamada paga.
**O que deve permanecer inalterado:** ordem admin → ambiente → `storeId` 400 → `assertBenchTestStore` antes da leitura (L79-87) → composição **pura/sem IA**.

### M10. `src/app/api/admin/laboratorio/bancada/runs/route.ts` — revalidação server-side + identidade + evidências

**Seam:** `POST` em **L90-340**; confirmação 422 em **L111-118**; parse em **L120-127**; preflight obrigatório em **L129-148**; resolução do draft em **L150-180**; preset em **L182-194**; manifesto em **L196-204**; `setBenchRunInput` em **L223-254**; CAS em **L256-264**; stream NDJSON em **L266-339**.

```typescript
// L143-148 (HOJE) — exige input.prompt === promptApproved; REFORÇAR: recompor e comparar com preflight.promptCompiled (D11):
if (input.prompt !== approvedPrompt) {
  return NextResponse.json({ error: "invalid_payload", details: ["prompt"] }, { status: 400 });
}
```

**Adicionar (D11/D15):** antes de qualquer chamada paga, **recompor** o prompt a partir das entradas atuais e exigir igualdade com `preflight.promptCompiled`; divergência ⇒ `409 approval_invalidated`. Resolver e transportar a identidade canônica (falha `bench_identity_reference_unavailable` antes da chamada); persistir as novas evidências (`policyVersions`/`promptBaseVersion`/`identityReference`) e passar `identityImageUrl` a `executeBenchRun`.
**O que deve permanecer inalterado:** ordem admin → ambiente → `confirmation_required` 422 → parse 400 → resolução do draft por `operation_id` → `assertBenchTestStore` antes da leitura (L196-204) → CAS `draft → pending` (L256-264) → stream NDJSON com **exatamente um** terminal (L266-339).

### M11. `src/app/api/admin/laboratorio/bancada/runs/[id]/route.ts` — versões/identidade/linhagem no detalhe

**Seam:** `GET` em **L36-113**; guards em **L38-49**; resposta em **L74-112**.

```typescript
// L74-110 (HOJE) — resposta; ADICIONAR policyVersions/promptBaseVersion/identityReference/attempts (D15):
return NextResponse.json({
  run: { /* ... promptBase, promptCompiled, promptApproved, promptBlocks, composerVersion, ... */ },
  artifacts,
});
```

**Adicionar:** versões (compositor/políticas/prompt-base padrão), `prompt_base` usado, `identityReference`, custo calculado×reportado e a **lista de tentativas por linhagem explícita**.
**O que deve permanecer inalterado:** guards (L38-49), `getBenchRun` (L53) com reconciliação preguiçosa, assinatura de artefatos (`signArtifact` L25-34) e o formato de `artifacts`.

### M12. UI `.../bancada/_components/*` — políticas/prompt-base/identidade/tentativas

**Seams:**
- `bench-workbench.tsx` — **L117-399**: dono do estado. Adicionar estado de políticas/versões/prompt-base padrão, `identityReference` e tentativas; `invalidatePreflight` (**L165-173**) já é o ponto único de invalidação — manter e estender às novas entradas (prompt-base, config multidimensional, modelo/qualidade). `handleCompose` (**L207-249**) consome o `POST /compose` estendido.
- `bench-preflight-panel.tsx` — **L24-177**: exibir as versões (compositor/políticas/prompt-base padrão) junto ao prompt compilado; manter o estado `invalidated` (`accent.amber`).
- `bench-branding-panel.tsx` — **L160-173**: exibir a **referência canônica de identidade** transportada (`{ kind, variantType, storagePath }` — **sem** URL assinada).
- `bench-prompt-editor.tsx` — **L20-46**: carregar o prompt-base padrão inicialmente e mantê-lo editável.
- `bench-evidence-panel.tsx` — **L88-198**: exibir prompt-base usado, versão do prompt-base padrão, versões, `prompt_sent`, referência de identidade, custo calculado e reportado **separados**.
- `page.tsx` — **L53-117**: server component; lê lojas/presets/políticas server-side; guarda de ambiente antes de qualquer leitura.

**O que deve permanecer inalterado:** `bench-store-selector.tsx`, `bench-preset-selector.tsx`, `bench-image-upload.tsx`, `bench-estimate-panel.tsx`, `bench-brand-color-indicator.tsx`, `disabled-notice` e a regra **desktop-only, sem comparação lado a lado e sem votação**.

### M13. `src/lib/lab/__tests__/recording-supabase-client.ts` + `lab-isolation.contract.test.ts` — allowlist aditiva

**Seams:** `ALLOWED_TABLES` **L269-291**; `READ_ONLY_TABLES` **L320-327**; `ALLOWED_ENTRY_RE` **L329-330**; `FORBIDDEN_TARGETS` **L333-341**; `createRecordingClient` **L407-473**.

**Adicionar:** `lab_bench_runs`/`lab_bench_artifacts`/`lab_bench_store_imports` já constam (L280-285). As novas colunas **não** criam tabelas novas — **nenhuma** mudança de allowlist necessária além de reforçar `bench_identity_reference_unavailable` e a ausência de URL assinada persistida nos testes de isolamento.
**O que deve permanecer inalterado:** `forbiddenProductionAccess` (L349-351), `wrapReadOnlyTable` (L354-368), `wrapReadOnlyBucket` (L383-401), `createRecordingClient` (L407-473) e `FORBIDDEN_TARGETS` (campanha/créditos/telemetria).

### M14. `src/lib/ai/__tests__/architecture-guard.test.ts` — gates aditivos

**Seam:** `labFiles` em **L154**; gates globais em **L165-249**; `benchFiles` em **L260**; gates do bench em **L262-283**; fronteira de import/uso em **L292-362**.

```typescript
// L260 (HOJE) — cobertura de src/lib/lab/bench/** já existe; ADICIONAR, se necessário:
const benchFiles = files.filter((file) => file.startsWith("src/lib/lab/bench/"));
```

**Adicionar:** gate de que os módulos novos (políticas/prompt-base/branding-mapping/identity-direction) **não introduzem contexto experimental** no conteúdo gerado e **não** sofrem filtragem lexical; e que o `prompt-composer.ts`/políticas permanecem **puros/sem IA** e sem acesso remoto.
**O que deve permanecer inalterado:** todas as regras globais (L86-249) e os gates F48.1/F48.2.1/F48.2.3 — **nenhuma regra pode ser afrouxada**.

### M15. `bench-api.contract.test.ts` + `bench-ui.contract.test.tsx` — cobertura aditiva

**Seam:** `bench-api.contract.test.ts` (mock de rotas via `vi.hoisted`) e `bench-ui.contract.test.tsx` (componentes). Adicionar cobertura para: `POST /compose` (políticas/versões), `POST /runs/[id]/attempts`, `GET /runs/[id]` (versões/identidade/linhagem), painéis de políticas/identidade/tentativas e o botão "Nova tentativa". Manter os mocks existentes sem afrouxar guardas.

---

## Shared Patterns (cross-cutting)

### Autenticação e ordem de guards
**Fonte:** `src/lib/admin/require-admin.ts:6` (`requireAdmin`), `src/lib/lab/environment-guard.ts:169-183` (`assertLabEnvironment`/`labEnvironmentDeniedBody`), `src/lib/auth/api-handler.ts`
**Aplicar a:** TODAS as rotas da bancada (novas e modificadas).
```typescript
export const POST = apiHandler(async (request: Request) => {
  await requireAdmin();                              // 1) 403 se não-admin
  try { assertLabEnvironment(); }                    // 2) 403 se ambiente bloqueado
  catch (error) {
    if (error instanceof LabEnvironmentError)
      return NextResponse.json(labEnvironmentDeniedBody(error.reason), { status: 403 });
    throw error;
  }
  // 3) `assertBenchTestStore` ANTES de qualquer leitura com `storeId`; só então lab_*/storage/provider.
});
```

### Manifesto como única fonte de elegibilidade
**Fonte:** `src/lib/lab/bench/domain/store-manifest.ts:280` (`assertBenchTestStore`), `:142` (`BenchStoreManifestError`)
**Aplicar a:** `POST /compose`, `POST /runs`, `POST /runs/[id]/attempts`, `GET /runs/[id]`, `GET /estimate`, `GET /branding`, `GET /briefing`.
```typescript
try { await assertBenchTestStore({ client: supabaseAdmin, storeId }); }
catch (error) {
  if (error instanceof BenchStoreManifestError)
    return NextResponse.json({ error: error.code }, { status: 400 });
  throw error;
}
```

### Erro sanitizado na origem (uma única vez)
**Fonte:** `src/lib/ai/types.ts:213-218` (`sanitizeAiErrorMessage`)
**Aplicar a:** `finalizeBenchRun`, evento `error` do stream NDJSON e qualquer log. Nunca persistir/emitir chave, URL ou token. A URL assinada da identidade é **transitória** e **não** é persistida — snapshot apenas `{ kind, variantType, storagePath }`.

### Cliente Supabase por parâmetro (testabilidade)
**Fonte:** `src/lib/lab/bench/persistence/bench-run-service.ts:1-26`, `bench-artifact-service.ts:1-34`
**Aplicar a:** todo serviço da bancada. `supabaseAdmin` só nas rotas/páginas; testes usam fakes em memória (`recording-supabase-client.ts:407-473`).

### Compositor puro, determinístico e sem IA
**Fonte:** `src/lib/lab/bench/domain/prompt-composer.ts` (builders), `src/lib/lab/gateway/lab-prompt-loader.ts` (preservação do prompt)
**Aplicar a:** `prompt-composer.ts` (núcleo), `policies/**`, `prompt-base.ts`, `identity-direction.ts`, `branding-prompt-mapping.ts`. Sem I/O, sem `process.env`, sem provider; prompt-base preservado sem filtragem lexical; cada condição comercial/texto obrigatório **uma única vez** no conteúdo gerado (fora do prompt-base).

### Fail-closed antes da chamada paga
**Fonte:** `config-registry.ts:153-184` + `preset-registry.ts:170-175`
**Aplicar a:** `resolveBenchPromptPolicies` (`bench_policy_not_implemented`), transporte de identidade (`bench_identity_reference_unavailable`) e revalidação do preflight (`409 approval_invalidated`). Sem fallback/improvisação.

### Preflight aprovado = `prompt_sent` (byte a byte)
**Fonte:** `src/app/api/admin/laboratorio/bancada/runs/route.ts:129-148,223-254` + `bench-run-service.ts:300-305`
**Aplicar a:** `POST /runs` e UI. Nenhuma transformação após a aprovação; confirmação financeira **separada** da aprovação do prompt.

### Test doubles em memória
**Fonte:** `recording-supabase-client.ts:407-473`, `bench-execution.contract.test.ts:76-91` (`RecordingAdapter`)
**Aplicar a:** todos os testes novos. **Nenhuma chamada de rede e nenhuma chamada paga em testes/CI.**

### NDJSON — exatamente um terminal
**Fonte:** `src/app/api/admin/laboratorio/bancada/runs/route.ts:266-339`
**Aplicar a:** `POST /api/admin/laboratorio/bancada/runs` (mantido). O serviço é o único dono de `done`/`error`; `Content-Type: application/x-ndjson`.

---

## No Analog Found

Peças genuinamente novas, tratadas como **composição explícita** (o planner deve tratar como composição, não cópia 1:1):

| Peça | Papel | Fluxo | Motivo |
|------|-------|-------|--------|
| Registry de **políticas versionadas** `{ id, dimension, value, version, contributions(context) }` | domain | transform | Não existe registry de contribuições por bloco no repo. O analog de **forma** é a composição `config-registry.ts` (registry em código) + `preset-registry.ts` (artefato versionado) + builders de `prompt-composer.ts`. |
| `resolveBenchPromptPolicies` com `bench_policy_not_implemented` | domain | transform fail-closed | Não há resolução de políticas; o analog é a **composição** de `resolveBenchConfig` + `resolveBenchPreset` (mesmo padrão de erro determinístico). |
| `prompt-base.ts` **resolvido por configuração** | domain | transform | Não existe módulo de conteúdo chaveado pelo recorte. Seguir o padrão de artefato versionado de `preset-registry.ts` + `DEFAULT_BENCH_CONFIG`. |
| `duplicateBenchRunInputs` (cópia entre prefixos de run) | service | file-I/O | `bench-artifact-service.ts` **não** possui helper de cópia; o analog é `persistBenchArtifact` (download + upload + metadados). |
| Linhagem de tentativas (`attempt_of_run_id`, raiz + descendentes) | persistence | CRUD | Não existe consulta de linhagem no repo; usar o padrão de leitura por client-por-parâmetro de `bench-run-service.ts`. |
| Gate de produção intocada por **Base SHA** (`git diff $BASE..HEAD`) | test | batch | Não existe gate temporal no repo; o analog é o detector de isolamento (`lab-isolation.contract.test.ts`) + os gates estáticos de `architecture-guard.test.ts`. |

---

## Anti-patterns / do-not-touch (inalterados nesta fase, verificados por `base..HEAD`)

| Arquivo | Por quê |
|---------|---------|
| `src/lib/ai/adapters/images.ts` (`ImagesAdapter` produtivo) | O transporte de identidade ocorre **somente** no adapter da bancada (`bench-images.ts`); o produtivo permanece **byte a byte** intocado (D10/D17) |
| `src/lib/ai/adapters/registry.ts` (`defaultAdapterRegistry`) | Registry padrão intocado; o adapter da bancada é registrado **apenas** no runtime da bancada (D10) |
| Caminho `Responses` produtivo | Intocado; nenhuma alteração de protocolo produtivo (D17) |
| `src/lib/store-identity-service.ts` (`resolveStoreIdentity`) | Mapper produtivo de identidade/brandColor; a bancada replica a precedência sem editar (D8/D16) |
| `src/lib/image-generation/services/art-director-briefing.ts` | Prompt do Diretor de produção; a bancada monta seu próprio compositor/identity-direction (D9) |
| `src/lib/ai/model-registry.ts` (`MODEL_ALLOWLIST`) | Allowlist produtiva; a bancada usa `BENCH_MODEL_ALLOWLIST` |
| `prompts/**` | Prompts oficiais; nenhum arquivo do lab escreve neles (gate `architecture-guard.test.ts`) |
| `supabase/migrations/**` | O DDL da bancada **não** entra na cadeia de migrations remotas (D14/D17); vive em `supabase/lab/bench-schema.sql` |
| `campaign-images` (bucket) | Proibido ler/reutilizar; só `lab-artifacts` com prefixo `bench/` e os buckets de branding locais |
| Pipeline/formulário produtivos de campanha (`src/lib/campaign/**` fora de `{brief,brief-schema,types,constants}`, `src/components/flow/**`) | Apenas importar módulos puros; **não** editar (gate `architecture-guard.test.ts:292-362`) |

**Proibido no código da bancada** (herdado dos gates): `generation_events`, `AiCostTracker.record`, provider de imagem de produção, SDK/wire fora de `src/lib/ai/adapters/**`, chaves de provider (`OPENAI_API_KEY`/`GEMINI_API_KEY`), `ai_model_selection`, `campaign_image_review`, escrita em `ai_model_catalog`/`prompts/`, `campaigns`, `campaign_art_versions`, `admin_audit_log`, `credit_*`, `campaign-images`.

**Proibido nesta fase** (escopo): Destaque/Exclusivo/9:16/serviços/informativos/temas/carrossel/mobile; comparação cega/lado a lado; votação/ranking/promoção automática; avaliação automática/revisor de IA; geração/revisão de prompt por IA; deduplicação semântica/embedding; nova tabela de experimentos/candidatas/revisores/avaliações; `supabase db push`; qualquer chamada de IA em testes/CI/execução autônoma.

---

## Metadata

**Escopo da busca de analogs:** `src/lib/lab/bench/**` (domain/persistence/gateway/execution), `src/lib/lab/**` (`environment-guard`, `recording-supabase-client`), `src/lib/ai/**` (`types.ts`, `adapters/bench-images.ts`, `adapters/registry.ts`), `src/lib/image-generation/services/art-director-briefing.ts`, `src/lib/store-identity-service.ts`, `src/app/api/admin/laboratorio/bancada/**`, `src/app/(app)/admin/laboratorio/**`, `supabase/lab/**`, `scripts/lab/**`.
**Arquivos lidos para extração:** 30+ (analogs, seams, testes, DDL, scripts, specs).
**Arquivos com analog exato:** 12; role-match/composição: 12; sem analog (composição explícita): 6.
**Data de extração:** 2026-09-30.
**Fonte da verdade:** `openspec/changes/fase-48-2-4-experimento-deterministico-oferta-1-1/` (proposal/design D1–D18/tasks 1–9/10 specs) + `48.2.4-CONTEXT.md` + `48.2.4-UI-SPEC.md` + precedente `48-2-3-PATTERNS.md`.
