# Phase 48.2.3: Fidelidade experimental da bancada — Pattern Map

**Mapped:** 2026-09-29
**Files analyzed:** 13 arquivos novos (incl. CLI + módulos puros + rotas + UI + testes) + 11 seams de modificação aditiva
**Analogs found:** 24 / 24 (nenhum sem analog; 1 seam de bootstrap provavelmente sem código novo)
**Fonte:** `48.2.3-CONTEXT.md` (D1–D21 + cross-cutting), `48.2.3-UI-SPEC.md`, OpenSpec `fase-48-2-3-fidelidade-experimental-bancada` (design D1–D21 / tasks 1–8 / 9 specs) e o precedente direto `48.2.2-fundacao-bancada-geracao/48-2-2-PATTERNS.md`.
**Idioma:** PT-BR

> Todos os caminhos e números de linha abaixo foram verificados contra o código atual. Nenhum analog foi inventado. Onde um arquivo novo ainda **não tem nome canônico**, o nome sugerido é explicitamente marcado como **"nome a critério do plano"**; o **analog** é sempre real e existente.
>
> **Precedente:** a F48.2.2 entregou a bancada (`src/lib/lab/bench/**`, `supabase/lab/bench-schema.sql`, `scripts/lab/48-2-2-bench-bootstrap.mjs`, `src/app/api/admin/laboratorio/bancada/**`, `src/app/(app)/admin/laboratorio/bancada/**`). A F48.2.3 **estende** esses mesmos seams; o PATTERNS da F48.2.2 continua válido para a forma dos arquivos, e este documento foca nos **novos contratos** (import, paridade, briefing, cor, compositor, preflight).
>
> **Fronteiras intocadas nesta fase (verificadas por `base..HEAD` — Plano 08):** `src/components/campaign/types.ts` (`BrandProfileSnapshot`), `src/lib/store-identity-service.ts` (`resolveStoreIdentity`), `src/lib/image-generation/services/art-director-briefing.ts`, `src/lib/ai/adapters/registry.ts`, `src/lib/ai/adapters/images.ts`, `src/lib/ai/model-registry.ts`, `prompts/**`, `campaign-images`, formulário produtivo (`src/components/flow/**`) e pipeline de campanha (`src/lib/campaign/**`). **Nenhuma** dessas linhas é editada; o `use-campaign-form.ts` é lido/importado apenas para reuso dos helpers puros exportados. A prova de que permaneceram inalteradas é **temporal** (`base..HEAD`), não um gate de conteúdo congelado.

---

## File Classification

| Arquivo novo/modificado | Papel | Fluxo de dados | Analog mais próximo | Qualidade |
|-------------------------|-------|----------------|---------------------|-----------|
| `scripts/lab/48-2-3-bench-import-stores.mjs` (novo) | utility/CLI | batch + file-I/O (leitura remota → escrita local) | `scripts/lab/48-2-2-bench-bootstrap.mjs` (+ `scripts/lab/48-cleanup-artifacts.mjs`) | exato (mesmo diretório/estrutura) |
| `src/lib/lab/bench/domain/form-rules.ts` (novo) | domain | transform | `src/lib/campaign/field-guidance.ts` + helpers puros de `src/components/flow/use-campaign-form.ts` + `src/lib/constants.ts` | exato (reuso de módulos puros) |
| `src/lib/lab/bench/domain/experimental-briefing.ts` (novo) | domain | transform | `src/lib/image-generation/services/art-director-briefing.ts` (seções) + `branding-service.ts` (contrato) | role-match |
| `src/lib/lab/bench/domain/resolve-bench-brand-color.ts` (novo) | domain | transform | `src/lib/store-identity-service.ts:30-115` (precedência cromática) | exato (paridade) |
| `src/lib/lab/bench/domain/prompt-composer.ts` (novo) | domain | transform | `src/lib/image-generation/services/art-director-briefing.ts` + `src/lib/lab/gateway/lab-prompt-loader.ts` | role-match |
| `src/app/api/admin/laboratorio/bancada/briefing/route.ts` (novo) | route | request-response | `src/app/api/admin/laboratorio/bancada/branding/route.ts` | exato |
| `src/app/api/admin/laboratorio/bancada/compose/route.ts` (**nome a critério do plano**) | route | request-response | `.../estimate/route.ts` + `.../runs/route.ts` | role-match |
| `src/app/(app)/admin/laboratorio/bancada/_components/bench-preflight-panel.tsx` (**nome a critério do plano**) | component | request-response | `_components/bench-prompt-editor.tsx` + `bench-execution-panel.tsx` | exato |
| `src/app/(app)/admin/laboratorio/bancada/_components/bench-brand-color-indicator.tsx` (**nome a critério do plano**) | component | transform | `_components/bench-branding-panel.tsx` | role-match |
| `src/lib/lab/bench/__tests__/form-parity.contract.test.ts` (**nome a critério do plano**) | test | transform | `__tests__/bench-boundary.contract.test.ts` | exato |
| `src/lib/lab/bench/__tests__/prompt-composer.contract.test.ts` (**nome a critério do plano**) | test | transform | `__tests__/bench-execution.contract.test.ts` (`RecordingAdapter`) | exato |
| `src/lib/lab/bench/__tests__/bench-import.contract.test.ts` (**nome a critério do plano**) | test | batch | `__tests__/bench-boundary.contract.test.ts` + `scripts/lab/__tests__/48-cleanup-artifacts.test.mjs` | role-match |
| `src/lib/lab/bench/__tests__/resolve-bench-brand-color.test.ts` (**nome a critério do plano**) | test | transform | `__tests__/campaign-snapshot.test.ts` | role-match |
| **M1** `src/lib/lab/bench/domain/branding-service.ts` | service | CRUD (somente leitura) | (self, aditivo) | seam |
| **M2** `src/lib/lab/bench/domain/campaign-snapshot.ts` | domain | transform | (self, aditivo) | seam |
| **M3** `src/lib/lab/bench/domain/schemas.ts` | domain | transform | (self, aditivo) | seam |
| **M4** `src/lib/lab/bench/persistence/bench-run-service.ts` | service | CRUD | (self, aditivo) | seam |
| **M5** `supabase/lab/bench-schema.sql` | migration/DDL | batch | (self, aditivo) | seam |
| **M6** `scripts/lab/48-2-2-bench-bootstrap.mjs` | utility | batch | (self, provável no-op) | seam |
| **M7** `src/app/api/admin/laboratorio/bancada/runs/route.ts` | route | request-response + streaming | (self, aditivo) | seam |
| **M8** `src/app/api/admin/laboratorio/bancada/runs/[id]/route.ts` | route | request-response | (self, aditivo) | seam |
| **M9** UI `_components/*` da bancada | component | request-response | (self, aditivo) | seam |
| **M10** `src/lib/lab/__tests__/recording-supabase-client.ts` + `lab-isolation.contract.test.ts` | test | — | (self, aditivo) | seam |
| **M11** `src/lib/ai/__tests__/architecture-guard.test.ts` | test | — | (self, aditivo) | seam |

---

## Pattern Assignments

### 1. `scripts/lab/48-2-3-bench-import-stores.mjs` — CLI de importação (novo)

**Papel:** utility/CLI · **Fluxo:** batch + file-I/O (origem remota somente-leitura → destino local transacional) · **Analog:** `scripts/lab/48-2-2-bench-bootstrap.mjs` (+ `scripts/lab/48-cleanup-artifacts.mjs`)

**Módulo sem efeito colateral no import + `main(argv, env)` testável + `invokedDirectly`** (`48-2-2-bench-bootstrap.mjs:233-277`):
```javascript
export async function main(argv = process.argv.slice(2), env = process.env) {
  const revert = argv.includes("--revert");
  const skipCatalog = argv.includes("--no-catalog");
  const connection = resolveLocalConnection(env);
  // ...
  return { host: connection.hostname, applied: true, reverted: false, catalog };
}

const invokedDirectly =
  typeof process.argv[1] === "string" &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main()
    .then((summary) => { console.log(JSON.stringify(summary, null, 2)); })
    .catch((error) => {
      console.error(`[bench-bootstrap] ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    });
}
```

**Guarda local-only antes de qualquer I/O — `assertLocalHost` (canonicalização)** (`48-2-2-bench-bootstrap.mjs:37-76`; mesma função em `48-cleanup-artifacts.mjs:165-190`):
```javascript
const LOCAL_HOST_PATTERN = /^(localhost|127\.0\.0\.1|::1|0\.0\.0\.0)$/i;
export const PRODUCTION_DOMAINS = ["supabase.co", "supabase.in", "supabase.com"];

export function assertLocalHost(rawUrl, origin) {
  let hostname;
  try {
    hostname = new URL(rawUrl).hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.+$/, "");
  } catch {
    throw new BenchBootstrapBlockedError(`Recusando URL invalida (${origin}): ${rawUrl}`);
  }
  if (PRODUCTION_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) {
    throw new BenchBootstrapBlockedError(`Recusando host de producao (${origin}): ${hostname}`);
  }
  if (!LOCAL_HOST_PATTERN.test(hostname)) {
    throw new BenchBootstrapBlockedError(`Recusando host nao local (${origin}): ${hostname}`);
  }
  return hostname;
}
```

**Conexão local pelo `supabase status -o env`** (`48-2-2-bench-bootstrap.mjs:78-117`) — o destino local usa `BENCH_DB_URL`/`SUPABASE_DB_URL` validados; a origem usa **exclusivamente** env vars `BENCH_IMPORT_SOURCE_URL`/`BENCH_IMPORT_SOURCE_SERVICE_ROLE_KEY` (D2), nunca persistidas/logadas.

**O que espelhar (novo):**
- Assinatura `main(argv, env)` pura e testável; `--store <uuid>` repetível / `--stores <csv>`; sem IDs → erro; `--all` → recusado (D3). `--dry-run` **offline por padrão** (Checkpoint A).
- **Dois clientes** (D2): cliente de origem que expõe **somente** `.select`/storage `.download` (nenhum método de mutação no caminho) e cliente de destino local com todas as escritas. A canonicalização do destino reusa `assertLocalHost`.
- Allowlist de tabelas/colunas/buckets (D4) — tabelas `stores`/`store_brand_profiles`/`store_brand_assets`/`store_visual_signatures`, buckets `store-logos`/`store-brand-assets`/`visual-signatures`.
- Estado atual pelo comportamento produtivo (D5): único perfil `status='synced'` (qualquer `source`, incl. `text_only`); ausência = ausência; >1 synced = recusa com erro sanitizado.
- Proprietário sintético por loja via admin API local `supabase.auth.admin.createUser` com e-mail determinístico `bench-store+<storeId>@bench.local` (D6).
- Paths **versionados/content-addressed** (checksum), transação SQL única de troca de referências, remoção dos antigos **após o commit**, falha antes do commit remove **apenas** os novos (D8/D9).
- Upsert idempotente `{ id, label }` em `fixtures/lab/bench/stores.json` (D10) e auditoria em `lab_bench_store_imports` (D11).
- Sanitização de logs/erros/`detail` via `sanitizeAiErrorMessage` (D12).

**Teste de fronteira/negativos (analog `scripts/lab/__tests__/48-cleanup-artifacts.test.mjs:1-224`):** funções puras exportadas (`parseArtifactStoragePath`, `partitionArtifacts`) testadas sem I/O; o import testa `main` com fakes, recusa de loja não-teste, `--all`, escrita remota (detector), múltiplos synced e ausência de chamada de IA.

---

### 2. `src/lib/lab/bench/domain/form-rules.ts` — paridade programática do formulário (novo)

**Papel:** domain · **Fluxo:** transform · **Analog:** `src/lib/campaign/field-guidance.ts` + helpers puros exportados por `src/components/flow/use-campaign-form.ts` + `src/lib/constants.ts` + `src/lib/formatters.ts` + `src/lib/campaign/brief.ts`

**Módulo puro, sem JSX/UI/server-only** (`field-guidance.ts:1-17`):
```typescript
/**
 * Módulo puro: sem JSX, sem runtime de UI, sem ambiente de servidor, sem
 * imports de side-effect. Fonte única das strings consumidas pelo formulário de
 * campanha e pelos testes — nenhuma cópia divergente.
 */
import { formatCurrencyBRL } from "@/lib/formatters";
```

**Regra de derivação de intenção (fonte da verdade produtiva)** (`use-campaign-form.ts:417-427`) — replicar com teste de paridade:
```typescript
export function inferIntent(
  originalPriceCents: number,
  discountedPriceCents: number | undefined | null
): CampaignIntent {
  const hasOriginal = originalPriceCents > 0;
  const hasDiscounted = (discountedPriceCents ?? 0) > 0;
  if (hasOriginal && hasDiscounted) return "offer";
  if (hasDiscounted) return "spotlight";
  return "exclusive";
}
```

**Texto de validade + aviso ilustrativo + concatenação obrigatória** (`use-campaign-form.ts:379-415`):
```typescript
export function buildValidityDisplayText(fields: {
  validityMode: ValidityMode; validityStartDate: string; validityEndDate: string; validityCustomText: string;
}): string | undefined {
  switch (fields.validityMode) {
    case "": return undefined;
    case "until-date": return fields.validityEndDate ? `até ${formatDateDisplay(fields.validityEndDate)}` : undefined;
    case "range": return fields.validityStartDate && fields.validityEndDate
      ? `de ${formatDateDisplay(fields.validityStartDate)} até ${formatDateDisplay(fields.validityEndDate)}` : undefined;
    case "today": return "somente hoje";
    case "stock": return "enquanto durarem os estoques";
    case "custom": return fields.validityCustomText.replace(/^Oferta válida[:\s-]*/i, "").trim() || undefined;
    default: return undefined;
  }
}

export function buildMandatoryArtworkText(showNotice: boolean, freeText: string): string | undefined {
  const notice = showNotice ? ILLUSTRATIVE_NOTICE_TEXT : "";
  const free = freeText.trim();
  if (notice && free) return `${notice}\n${free}`;
  if (notice) return notice;
  if (free) return free;
  return undefined;
}
```

**Selo por intenção + limpeza por mudança de intenção** (`src/lib/constants.ts:185-189`; `use-campaign-form.ts:665-673`):
```typescript
export const BADGE_OPTIONS_BY_INTENT: Record<CampaignIntent, readonly string[]> = {
  offer: BADGE_OPTIONS_OFFER,
  spotlight: BADGE_OPTIONS_SPOTLIGHT,
  exclusive: BADGE_OPTIONS_EXCLUSIVE,
};
// use-campaign-form.ts:667-672 — limpeza automática:
if (badge && !BADGE_OPTIONS_BY_INTENT[fields.campaignIntent].includes(badge)) {
  setFields((prev) => ({ ...prev, badge: "" }));
}
if (fields.campaignIntent === "offer" && fields.preserveImageContext) {
  setFields((prev) => ({ ...prev, preserveImageContext: false }));
}
```

**Limites e validação de imagem produtivos** (`use-campaign-form.ts:250-255`; `src/lib/image-generation/config.ts:15`):
```typescript
const validTypes = ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"];
// ...
if (file.size > 5 * 1024 * 1024) {
  return "Arquivo muito grande. Máximo 5MB";
}
export const MAX_CAMPAIGN_IMAGES = 4; // 1 primary + 3 auxiliares
```

**Normalização monetária por dígitos→centavos** (`src/lib/formatters.ts:35-40` e `parseCurrencyBRL:42-69`) — reusar `formatCurrencyBRL`/`parseCurrencyBRL`; nome 60 e descrição 120 conforme `campaign-input-form.tsx:405,444`.

**O que espelhar (novo):** `form-rules.ts` **reutiliza** `field-guidance`, `formatters`, `constants`, `campaign/brief`, `brief-schema`, `image-generation/schema`, `campaign/types` e os helpers puros exportados pelo hook (`inferIntent`, `buildValidityDisplayText`, `buildMandatoryArtworkText`, `buildCampaignGenerationBody`). O hook e o formulário produtivo **não** são editados (D13). Onde o compartilhamento aumentar risco, replicar com **teste explícito de paridade**. Inclui `preserveImageContext` (disponível só em Destaque/Exclusivo, limpo ao mudar para Oferta).

**Paridade de snapshot pelos mappers produtivos** (`src/lib/campaign/brief.ts:155-247`):
```typescript
export function buildCampaignBriefFromFlat(input: GenerateImageRequest, _storeId: string, source: CampaignBriefSource = "web_form"): CampaignBrief {
  // ... creativeContext.preserveImageContext:
  //   campaignIntent === "offer" ? false : (input.preserveImageContext ?? false)
}
export function buildCampaignBriefSnapshot(brief: CampaignBrief): CampaignBriefSnapshot {
  return { schemaVersion: CampaignBriefSchemaVersion, product: { ...brief.product }, commercial: { ...brief.commercial }, /* ... */ };
}
```

---

### 3. `src/lib/lab/bench/domain/experimental-briefing.ts` — briefing estruturado (novo)

**Papel:** domain · **Fluxo:** transform · **Analog:** `src/lib/image-generation/services/art-director-briefing.ts` (montagem de seções/valores) + `branding-service.ts` (contrato local)

**Padrão de montagem por blocos, omitindo vazios** (`art-director-briefing.ts:225-254, 278-333`):
```typescript
export function buildBrandProfileSection(brandProfile: BrandProfileSnapshot | null): string {
  if (!brandProfile) return '';
  const rows: string[] = ['| Campo | Valor |', '|-------|-------|'];
  if (brandProfile.campaign_guidelines) rows.push(`| **Diretrizes de campanha** | ${brandProfile.campaign_guidelines} |`);
  if (brandProfile.campaign_brief) rows.push(`| **Brief do Diretor de Marca** | ${brandProfile.campaign_brief} |`);
  if (brandProfile.brand_personality) rows.push(`| **Personalidade da marca** | ${brandProfile.brand_personality} |`);
  if (brandProfile.visual_style) rows.push(`| **Estilo visual** | ${brandProfile.visual_style} |`);
  if (brandProfile.visual_tone) rows.push(`| **Tom visual** | ${brandProfile.visual_tone} |`);
  return rows.length > 2 ? note + rows.join('\n') : '';
}

export function campaignFactsSection(brief, context, effectiveProductName): string {
  const bullets: string[] = [];
  const storeName = (context.store.name ?? "").trim();
  if (storeName) bullets.push(`- **Loja:** ${storeName}`);
  // ... preço de/por via formatPriceBRL, validade, badge, etc.
  return bullets.join("\n");
}
```

**Helpers puros a reutilizar** (`art-director-briefing.ts:39-57`):
```typescript
export function formatPriceBRL(cents: number | undefined): string { /* ... */ }
export function sanitizePromptText(value: string): string {
  return value.replace(/\{\{/g, "{").replace(/\}\}/g, "}");
}
```

**Contrato de branding local já disponível (tipografia)** (`branding-service.ts:56-80`): `BenchBrandingContract` já expõe `typographyDirection`, `safeColorTokens`, `brandColorsChosen`, `logoColorsDetected`, `visualStyle`, `visualTone`, `brandPersonality`, `campaignGuidelines`, `campaignBrief`, `profileSource`, `profileStatus`.

**O que espelhar (novo):** `experimental-briefing.ts` monta o briefing **estruturado** (direção visual consolidada + `typography_direction` + `brandColor` resolvido) como **entrada do compositor**, sem ser o texto final. Não altera `art-director-briefing.ts` nem `BrandProfileSnapshot` (D15). Reusa `formatPriceBRL`/`sanitizePromptText` quando aplicável.

---

### 4. `src/lib/lab/bench/domain/resolve-bench-brand-color.ts` — precedência cromática produtiva (novo)

**Papel:** domain · **Fluxo:** transform · **Analog:** `src/lib/store-identity-service.ts:30-115` (precedência **efetiva**)

**Precedência produtiva efetiva — fonte exata da paridade** (`store-identity-service.ts:30, 85-115`):
```typescript
let brandColor = store.brand_color ?? getDefaultBrandColor(store.segment);
// ...
const { data: profileData } = await supabaseAdmin
  .from('store_brand_profiles').select('*')
  .eq('store_id', store.id).eq('status', 'synced').maybeSingle();

if (profile) {
  if (profile.source === 'text_only' && profile.status === 'synced') {
    if (profile.safe_color_tokens?.primary && /^#[0-9A-Fa-f]{6}$/.test(profile.safe_color_tokens.primary)) {
      brandColor = profile.safe_color_tokens.primary;
    } else if (profile.inferred_primary_color && /^#[0-9A-Fa-f]{6}$/.test(profile.inferred_primary_color)) {
      brandColor = profile.inferred_primary_color;
    }
  }
  if (profile.brand_colors_chosen?.length > 0) {
    const primaryColor = profile.brand_colors_chosen[0];
    if (primaryColor && /^#[0-9A-Fa-f]{6}$/.test(primaryColor)) brandColor = primaryColor;
  } else if (profile.safe_color_tokens?.primary) {
    const tokenColor = profile.safe_color_tokens.primary;
    if (/^#[0-9A-Fa-f]{6}$/.test(tokenColor)) brandColor = tokenColor;
  }
}
```

> **Ordem efetiva consolidada (D16):** (1) `brand_colors_chosen[0]` válido → (2) `safe_color_tokens.primary` válido → (3) `inferred_primary_color` válido **apenas em `text_only`** → (4) `stores.brand_color` → (5) `getDefaultBrandColor(segment)`. **Ausência de synced = ausência de perfil**; o bloco `without_logo` (`store-identity-service.ts:117-150`) é **inalcançável** e **não** deve ser replicado.

**O que espelhar (novo):** `resolveBenchBrandColor(profile, store)` **puro**, com validação `/^#[0-9A-Fa-f]{6}$/`, reproduzindo exatamente a precedência acima. Teste de paridade aciona a resolução produtiva sobre fixtures e afirma igualdade de `brandColor` (D16). `resolveStoreIdentity` **não** é editado.

---

### 5. `src/lib/lab/bench/domain/prompt-composer.ts` — compositor determinístico + preflight (novo)

**Papel:** domain · **Fluxo:** transform · **Analog:** `art-director-briefing.ts` (builders de seção) + `src/lib/lab/gateway/lab-prompt-loader.ts` (preservação/interpolação do prompt)

**Padrão de seção que omite vazio e preserva texto do operador** (`art-director-briefing.ts:354-385`):
```typescript
export function requiredArtworkTextSection(merchantText: string): string {
  const text = sanitizePromptText((merchantText ?? "").trim());
  if (!text) return "";
  const lines = ["## Texto Obrigatório na Arte", "", "O texto abaixo foi informado pelo lojista ..."];
  if (text.includes("\n")) lines.push("", "Se o texto tiver mais de uma linha ...");
  lines.push("", `"${text}"`);
  return lines.join("\n");
}
export function illustrativeNoticeSection(illustrativeNotice: string): string {
  const notice = (illustrativeNotice ?? "").trim();
  if (!notice) return "";
  return ["## Aviso Ilustrativo", "", "Quando houver aviso ilustrativo ...", `Texto do aviso: "${notice}"`].join("\n");
}
```

**Preservação integral do prompt-base (sem filtragem lexical)** (`lab-prompt-loader.ts:21-45`):
```typescript
function interpolate(content: string, variables?: Record<string, string>): string {
  if (!variables) return content;
  let result = content;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}
```

**O que espelhar (novo):** `prompt-composer.ts` **puro e sem IA** (D17/D19) com os 7 blocos canônicos travados — `[IDENTIDADE E DIREÇÃO VISUAL]`, `[DIREÇÃO TIPOGRÁFICA]`, `[PRODUTO E IMAGENS DE REFERÊNCIA]`, `[CONDIÇÕES COMERCIAIS]`, `[INTENÇÃO E FORMATO]`, `[INSTRUÇÕES DO PROMPT-BASE]`, `[RESTRIÇÕES E TEXTOS OBRIGATÓRIOS]`. Um dado → um bloco; **blocos vazios omitidos**; sem repetição deliberada; sem deduplicação semântica; **prompt-base preservado integralmente** (sem filtragem de "teste"/"comparação"/"avaliação"); sem contexto experimental no **conteúdo gerado**; **versão estática do compositor** exportada (evidência D20). Não substitui o futuro template criativo de Oferta 1:1.

**Preflight (D17):** `compor → prompt compilado visível → editar → aprovar → (só então) estimar/confirmar`; invalidação por mudança de entradas ou edição pós-aprovação; execução envia **exatamente** o texto aprovado.

---

### 6. `src/app/api/admin/laboratorio/bancada/briefing/route.ts` — `GET /briefing` (novo)

**Papel:** route · **Fluxo:** request-response · **Analog:** `src/app/api/admin/laboratorio/bancada/branding/route.ts`

**Ordem obrigatória dos guards: admin → ambiente → manifesto antes de qualquer leitura** (`branding/route.ts:65-105`):
```typescript
export const GET = apiHandler(async (request: Request) => {
  await requireAdmin();
  try { assertLabEnvironment(); }
  catch (error) {
    if (error instanceof LabEnvironmentError) {
      return NextResponse.json(labEnvironmentDeniedBody(error.reason), { status: 403 });
    }
    throw error;
  }
  const storeId = new URL(request.url).searchParams.get("storeId") ?? "";
  if (!storeId) return NextResponse.json({ error: "invalid_payload", details: ["storeId"] }, { status: 400 });

  // Manifesto ANTES de qualquer leitura de branding/tabela/storage.
  try { await assertBenchTestStore({ client: supabaseAdmin, storeId }); }
  catch (error) {
    if (error instanceof BenchStoreManifestError) return NextResponse.json({ error: error.code }, { status: 400 });
    throw error;
  }
  // ... loadBenchBranding + resposta
});
```

**O que espelhar (novo):** `GET /briefing` retorna o **briefing estruturado** (direção visual + tipografia + `brandColor` resolvido), sem secrets; valida o manifesto antes de qualquer leitura (D15/D16 + spec `lab-admin-api`). Reusa `loadBenchBranding` e o signer restrito para assets.

---

### 7. `src/app/api/admin/laboratorio/bancada/compose/route.ts` — composição/preview/aprovação (novo, **nome a critério do plano**)

**Papel:** route · **Fluxo:** request-response · **Analog:** `estimate/route.ts` (GET com manifesto + preset) + `runs/route.ts` (POST com confirmação explícita)

**Confirmação explícita 422 antes do parse completo** (`runs/route.ts:104-127`):
```typescript
let raw: unknown = null;
try { raw = await request.json(); } catch { raw = null; }
if (raw === null || typeof raw !== "object" || (raw as Record<string, unknown>).confirmed !== true) {
  return NextResponse.json({ error: "confirmation_required" }, { status: 422 });
}
const parsed = BenchRunInputSchema.safeParse(raw);
if (!parsed.success) {
  return NextResponse.json({ error: "invalid_payload", details: parsed.error.issues }, { status: 400 });
}
```

**Manifesto antes da resolução + preset habilitado** (`estimate/route.ts:48-71`):
```typescript
try { await assertBenchTestStore({ client: supabaseAdmin, storeId }); }
catch (error) {
  if (error instanceof BenchStoreManifestError) return NextResponse.json({ error: error.code }, { status: 400 });
  throw error;
}
let preset;
try { preset = resolveBenchPreset(presetId); }
catch (error) {
  if (error instanceof BenchPresetError) return NextResponse.json({ error: "preset_not_enabled", reason: error.reason }, { status: 400 });
  throw error;
}
```

**O que espelhar (novo):** rota(s) que expõem o **prompt compilado** (blocos canônicos) e a **aprovação explícita**, sem secrets; a geração **sem preflight aprovado é recusada**; `prompt_sent` = prompt final aprovado (spec `lab-admin-api` + D17). Compor é puro — nenhuma chamada de IA na composição.

---

### 8. `.../bancada/_components/bench-preflight-panel.tsx` — preflight na UI (novo, **nome a critério do plano**)

**Papel:** component · **Fluxo:** request-response · **Analog:** `_components/bench-prompt-editor.tsx` + `bench-execution-panel.tsx`

**Editor de prompt existente (a evoluir para o preflight)** (`bench-prompt-editor.tsx:19-45`):
```tsx
export function BenchPromptEditor({ value, onChange, disabled = false }: BenchPromptEditorProps) {
  return (
    <section data-testid="bench-prompt-editor" className="rounded-xl border border-border bg-bg-surface p-5" aria-labelledby="bench-prompt-title">
      <h2 id="bench-prompt-title" className="mb-4 font-heading text-lg font-semibold text-text-primary">Prompt</h2>
      <LabTextarea label="Prompt" value={value} disabled={disabled} rows={6}
        hint="Prompt manual — o branding não é concatenado automaticamente."
        onChange={(event) => onChange(event.target.value)} />
    </section>
  );
}
```

**Barreira financeira separada da aprovação + estimativa → confirmação** (`bench-execution-panel.tsx:95-138, 326-347`):
```tsx
function validateBeforeGenerate(): string | null {
  if (!uploadReady) return "Envie as imagens do produto antes de gerar.";
  if (prompt.trim().length === 0) return "Escreva o prompt antes de gerar.";
  // ...
}
// ...
<ConfirmDialog open={confirmOpen} title="Confirmar geração" confirmLabel="Confirmar geração"
  cancelLabel="Cancelar" busy={running} onCancel={() => setConfirmOpen(false)} onConfirm={handleConfirm}
  description={/* aviso de chamada paga + cobertura de pricing */} />
```

**Primitivos locais a reutilizar (não recriar):** `../../_components/lab-textarea`, `lab-select`, `lab-radio-group`, `confirm-dialog`, `disabled-notice`; globais `src/components/ui/`: `button`, `card`, `badge`, `input`, `empty-state`, `error-state`, `page-header`, `skeleton`, `loading-skeleton`. Ícones `lucide-react`, sem emojis.

**O que espelhar (novo):** painel que compõe → exibe o **prompt compilado** (blocos canônicos, incluindo `[DIREÇÃO TIPOGRÁFICA]`) → permite **edição** → exige **"Aprovar prompt"** → **só então** habilita estimativa/confirmação. Estado `accent.amber` "Prompt invalidado — recomponha e aprove" ao mudar entradas/prompt; confirmação financeira **separada** (UI-SPEC §Interaction Contract + D17).

---

### 9. `.../bancada/_components/bench-brand-color-indicator.tsx` — `brandColor` resolvido (novo, **nome a critério do plano**)

**Papel:** component · **Fluxo:** transform · **Analog:** `_components/bench-branding-panel.tsx`

**Padrão de linha de dado mono + label uppercase** (`bench-branding-panel.tsx:64-73, 143-144`):
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
<DataRow label="Origem do perfil" value={branding.profileSource ?? EMPTY} />
```

**O que espelhar (novo):** indicador **somente leitura** do `brandColor` resolvido — swatch + valor mono (JetBrains Mono 500), label "Cor da marca (resolvida)", idêntico ao produtivo, **sem** nova precedência nem expansão de paleta (UI-SPEC + D16). Pode ser embutido no `bench-branding-panel.tsx`.

---

### 10–13. Testes novos (paridade, compositor, import, cor)

**Papel:** test · **Analog:** `__tests__/bench-boundary.contract.test.ts` + `__tests__/bench-execution.contract.test.ts` + `scripts/lab/__tests__/48-cleanup-artifacts.test.mjs`

**Cliente gravador compartilhado (detector de fronteira)** (`__tests__/bench-boundary.contract.test.ts:209-315`; helper em `src/lib/lab/__tests__/recording-supabase-client.ts`):
```typescript
const recording = createRecordingClient(seed());
// ... fluxo completo ...
expect(recording.accessLog.filter((entry) => !ALLOWED_ENTRY_RE.test(entry))).toEqual([]);
for (const target of FORBIDDEN_TARGETS) {
  expect(recording.accessLog.filter((entry) => entry.includes(target)), `nenhum acesso a ${target}`).toEqual([]);
}
expect(recording.accessLog.filter((entry) => /credit/i.test(entry))).toEqual([]);
```

**Adapter gravador — prova de `prompt_sent` = aprovado (D17/D21)** (`__tests__/bench-execution.contract.test.ts:76-91, 202-210`):
```typescript
class RecordingAdapter implements AiAdapter {
  readonly protocol = "images" as const;
  readonly calls: Array<{ request: AiInvocationRequest; target: AiModelTarget }> = [];
  async invoke(request, target) { this.calls.push({ request, target }); return this.result; }
}
// ...
expect(adapter.calls).toHaveLength(1);
expect(call.request.prompt).toBe("prompt manual");
```

**O que espelhar (novo):**
- **Paridade do formulário** (matriz de fixtures): intenção derivada, normalização monetária, selo por intenção, `preserveImageContext` (disponibilidade/valor padrão/envio/limpeza), texto de validade, concatenação de avisos, papéis/limites de imagem; e que o produtivo não mudou (D13/D14).
- **Compositor**: blocos corretos, tipografia no `[DIREÇÃO TIPOGRÁFICA]`, `preserveImageContext` no `[PRODUTO E IMAGENS DE REFERÊNCIA]`, blocos vazios omitidos, prompt-base preservado (sem filtragem lexical), ausência de contexto experimental **por origem**, invalidação, `prompt_sent` idêntico ao aprovado via adapter gravador (D19/D20/D21).
- **Import**: negativos de fronteira — escrita remota falha, loja não-teste recusada, IDs implícitos/`--all` recusados, campanhas/usuários/créditos/histórico não lidos, URLs assinadas não persistidas, múltiplos synced recusam, idempotência (mesmos checksums/paths), falha antes do commit remove só os novos (D2–D12).
- **Cor**: `resolveBenchBrandColor` igual à resolução produtiva sobre fixtures; ausência de synced preserva `stores.brand_color`/segmento; contrato produtivo intocado (D16).

---

## Modified Files — seam exato (aditivo, sem quebrar o existente)

### M1. `src/lib/lab/bench/domain/branding-service.ts` — `readBrandProfile` alinhado ao único synced

**Seam:** `readBrandProfile` em **linhas 177-210** (hoje lê `status='synced'` e, se ausente, faz fallback `source='without_logo'`).

```typescript
// linhas 196-209 (HOJE) — fallback `without_logo` que DEVE sair (D5):
const fallback = await client
  .from("store_brand_profiles").select(PROFILE_COLUMNS)
  .eq("store_id", storeId).eq("source", "without_logo")
  .order("updated_at", { ascending: false }).limit(1).maybeSingle();
if (fallback.error) throw new Error(`bench_branding_profile_read_failed:${fallback.error.message}`);
const fallbackRow = asRow(fallback.data);
return fallbackRow ? mapProfile(fallbackRow as unknown as BrandProfileFields) : null;
```

**Adicionar:** ler **o único perfil `status='synced'`** (qualquer `source`, incl. `text_only`); ausência de synced = **ausência de perfil** (sem fallback `without_logo`). O contrato exposto (`BenchBrandingContract`, linhas 56-80) **não muda de forma**.
**O que deve permanecer inalterado:** `loadBenchBranding` (283-355), `toBenchBrandingSnapshot` (369-375), `readActiveBrandAssets` (213-227), `readActiveVisualSignature` (230-246), o signer restrito e o `import "server-only"`.

### M2. `src/lib/lab/bench/domain/campaign-snapshot.ts` — contrato fiel + `preserveImageContext`

**Seam:** `buildBenchCampaignSnapshot` em **linhas 77-111**; `resolveBenchIntent` em **37-53**; `BenchCampaignSnapshot` em **57-71**; `assertBenchCampaignSnapshot` em **130-170**.

**Adicionar:** substituir os limites divergentes por contrato fiel (nome 60, descrição 120, 1+3 imagens, 5MB, tipos produtivos, selo/intenção/validade/aviso/texto obrigatório) e **`preserveImageContext`** (enviado apenas em Destaque/Exclusivo); construir o snapshot com `buildCampaignBriefFromFlat`/`buildCampaignBriefSnapshot` (puros) + config + `intentResolvedFrom` (D14).
**O que deve permanecer inalterado:** a assinatura `assertBenchCampaignSnapshot` (código `missing_campaign_snapshot`) e o caráter **puro** (sem I/O, sem serviço produtivo).

### M3. `src/lib/lab/bench/domain/schemas.ts` — payload fiel + evidência

**Seam:** `BenchProductSchema` em **linhas 85-94**; `BenchOfferSchema` em **96-103**; `BenchRunInputSchema` em **179-207**; `parseBenchRunInput` em **216-220**.

```typescript
// linhas 85-103 (HOJE) — limites divergentes:
export const BenchProductSchema = z.object({
  name: z.string().min(1).max(200),
  priceCents: z.number().int().min(0).optional(),
  originalPriceCents: z.number().int().min(0).optional(),
  description: z.string().max(2000).optional(),
}).strict();
export const BenchOfferSchema = z.object({ text: z.string().min(1).max(2000), validUntil: z.string().max(80).optional() }).strict();
```

**Adicionar:** limites produtivos (nome 60, descrição 120, informações obrigatórias 200), `preserveImageContext`, selo/intenção/validade, e campos de **evidência do preflight** (prompt-base, blocos, prompt compilado, prompt final aprovado, versão do compositor) em `BenchRunInputSchema`/snapshot (D14/D20).
**O que deve permanecer inalterado:** `.strict()`, `isBenchInputReference` (169-177), `parseBenchRunInput`/`parseBenchConfig` e `BenchBrandingSnapshotSchema` (129-157).

### M4. `src/lib/lab/bench/persistence/bench-run-service.ts` — evidência do preflight

**Seam:** `setBenchRunInput` em **linhas 251-301**; `finalizeBenchRun` em **366-411**; `BenchRunRecord` em **89-120**; `mapBenchRunRow` em **122-155**.

```typescript
// linhas 273-289 (HOJE) — update em `draft`; adicionar os campos de evidência:
const update: Record<string, unknown> = { campaign_snapshot: params.campaignSnapshot, updated_at: new Date().toISOString() };
if (params.promptSent !== undefined) update.prompt_sent = params.promptSent;
// ... demais campos
const { data, error } = await params.client.from(BENCH_RUNS_TABLE).update(update)
  .eq("id", params.runId).eq("status", "draft").select("id");
```

**Adicionar:** persistir a evidência mínima (prompt-base, blocos, prompt compilado, prompt final aprovado, versão do compositor) **reusando** `lab_bench_runs`/`prompt_sent`/`campaign_snapshot`; `prompt_sent` idêntico ao aprovado (D20).
**O que deve permanecer inalterado:** o CAS `draft → pending` (`confirmBenchRun` 312-330), `markBenchRunRunning` (338-357), `finalizeBenchRun` CAS (401-410), `reconcileStaleBenchRuns` (428-523) e o índice global de geração ativa.

### M5. `supabase/lab/bench-schema.sql` — `lab_bench_store_imports` + colunas de evidência

**Seam:** `CREATE TABLE public.lab_bench_runs` em **linhas 34-67**; bloco **REVERT** em **191-206**.

```sql
-- linhas 34-67 (HOJE) — adicionar colunas de evidência do preflight (aditivas, NULLABLE):
CREATE TABLE IF NOT EXISTS public.lab_bench_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (...)),
  -- ... campaign_snapshot, branding_snapshot, config, prompt_sent, ...
);
```

**Adicionar:** tabela `lab_bench_store_imports` (`id`, `store_id`, `source_host` canonicalizado, `imported_at`, `imported_by`, `source_updated_at`, `asset_count`, `status`, `detail` jsonb saneado) + RLS/grants service-role + **linhas de REVERT** correspondentes (D11). Colunas de evidência do preflight em `lab_bench_runs` com REVERT.
**O que deve permanecer inalterado:** o índice `uq_lab_bench_runs_one_active_global` (97-99), os triggers de imutabilidade/no-delete (136-184) e o fato de o DDL viver **fora** de `supabase/migrations/` (D17).

### M6. `scripts/lab/48-2-2-bench-bootstrap.mjs` — aplicar/reverter o DDL aditivo

**Seam:** `applyBenchSchema` em **linhas 165-170**; `extractRevertStatements` em **132-152**.

```javascript
export async function applyBenchSchema(dbUrl, schemaPath = BENCH_SCHEMA_PATH) {
  const sql = readBenchSchema(schemaPath);
  await withClient(dbUrl, async (client) => { await client.query(sql); });
}
export function extractRevertStatements(sql) {
  const lines = sql.split(/\r?\n/);
  const markerIndex = lines.findIndex((line) => /^--\s*REVERT\b/.test(line));
  // ... coleta linhas `-- <sql>;`
}
```

**Análise:** `applyBenchSchema` executa **o arquivo inteiro** e `extractRevertStatements` coleta **todas** as linhas `-- <sql>;` após o marcador `REVERT`. Logo, o DDL aditivo (M5) é aplicado/revertido **automaticamente**, desde que suas instruções REVERT sejam adicionadas no mesmo arquivo. O bootstrap provavelmente **não precisa de alteração de código** — apenas confirmação no plano (task 2.2). Se o plano quiser explicitar, adicionar uma nota no cabeçalho, sem alterar as funções.
**O que deve permanecer inalterado:** `assertLocalHost` (61-76), `resolveLocalConnection` (102-117), `main` (233-260), `insertBenchCatalogRows`/`revertBenchCatalogRows` e o `invokedDirectly` (262-277).

### M7. `src/app/api/admin/laboratorio/bancada/runs/route.ts` — preflight aprovado obrigatório + evidência

**Seam:** `POST` em **linhas 90-312**; parse/confirmação em **104-127**; fixação do input em **202-226**.

```typescript
// linhas 202-226 (HOJE) — adicionar os campos de evidência e a exigência de preflight aprovado:
await setBenchRunInput({
  client: supabaseAdmin, runId: existing.id,
  campaignSnapshot, brandingSnapshot, config,
  promptSent: input.prompt, references: input.references,
  provider: preset.provider, protocol: preset.protocol, model: preset.model,
  size: preset.size, quality: preset.quality,
  intent: config.intencao, contentType: config.tipoConteudo, structure: config.estrutura, theme: config.tema,
});
```

**Adicionar:** exigir **preflight aprovado** e persistir a evidência do preflight; o `prompt_sent` enviado é **exatamente** o prompt final aprovado (D17/D20). O payload fiel (incl. `preserveImageContext`) entra via `BenchRunInputSchema` (M3).
**O que deve permanecer inalterado:** ordem admin → ambiente → `confirmation_required` 422 → parse 400 → resolução do draft → `assertBenchTestStore` antes da leitura (175-183) → CAS `draft → pending` (228-236) → stream NDJSON com **exatamente um** terminal (241-311).

### M8. `src/app/api/admin/laboratorio/bancada/runs/[id]/route.ts` — payload fiel + evidência

**Seam:** resposta em **linhas 74-106**.

**Adicionar:** refletir o payload fiel e a **evidência do preflight** (prompt-base, blocos, prompt compilado, prompt final aprovado, versão do compositor) além do já exposto (`promptSent`, `campaignSnapshot`, `brandingSnapshot`).
**O que deve permanecer inalterado:** guards (38-49), `getBenchRun` (53), assinatura de artefatos (`signArtifact` 25-34) e o formato de `artifacts`.

### M9. UI `src/app/(app)/admin/laboratorio/bancada/_components/*` — formulário fiel + preflight + `brandColor`

**Seams:**
- `bench-campaign-form.tsx` — **arquivo inteiro (1-107)**: hoje só tem 3 campos (`productName`/`productDescription`/`offerText`); evoluir para o formulário fiel (nome 60, descrição 120, 1+3 imagens, de/por, selo, intenção, "Preservar imagem original", validade, aviso, informações obrigatórias) reusando `input`/`lab-textarea`/`lab-select`/`lab-radio-group`.
- `bench-workbench.tsx` — **linhas 68-233**: dono do estado entre painéis; adicionar estado do preflight (composto/editado/aprovado/invalidado) e a propagação do prompt aprovado; **invalidação centralizada** via ponto único `invalidatePreflight()` que incrementa `preflightRevision` (contador/revisão **em memória**, sem hashes persistidos — D20) para **todas** as entradas usadas na composição: loja/briefing; produto/campanha; imagens/referências; intenção/formato/config; prompt-base; e prompt final **após aprovação** — não apenas `handleStoreChange` (100-107), que passa a chamar o ponto único.
- `bench-prompt-editor.tsx` — **1-46**: base do painel de preflight (substituir/estender).
- `bench-branding-panel.tsx` — **83-207**: adicionar o `brandColor` resolvido (M9/§9).
- `bench-execution-panel.tsx` — **95-138, 181-253, 326-347**: gate "Aprove o prompt compilado antes de estimar ou gerar."; confirmação financeira **separada** da aprovação.

**O que deve permanecer inalterado:** `page.tsx` (server component; guards + leitura server-side), `bench-store-selector.tsx`, `bench-preset-selector.tsx`, `bench-image-upload.tsx`, `bench-estimate-panel.tsx`, `bench-evidence-panel.tsx` (apenas extensões aditivas), e a regra **desktop-only, sem comparação lado a lado e sem votação**.

### M10. `src/lib/lab/__tests__/recording-supabase-client.ts` + `lab-isolation.contract.test.ts` — allowlist aditiva

**Seams (recording-supabase-client.ts):**
- `ALLOWED_TABLES` — **linhas 269-287**
- `READ_ONLY_TABLES` — **linhas 316-323**
- `ALLOWED_ENTRY_RE` — **linhas 325-326**
- `FORBIDDEN_TARGETS` — **linhas 329-337**
- `createRecordingClient` — **linhas 403-469**

```typescript
// linhas 269-287 (HOJE) — adicionar aditivamente:
export const ALLOWED_TABLES = new Set([
  /* ... */ "lab_bench_runs", "lab_bench_artifacts",
  "stores", "store_brand_profiles", "store_brand_assets", "store_visual_signatures",
]);
```

**Adicionar (aditivo e estreito):** `lab_bench_store_imports` (destino da auditoria local) ao `ALLOWED_TABLES`; reforçar que a **origem remota** não é acessada pelo runtime (o comando de importação vive em `scripts/lab/**`, fora do client de teste); atualizar `ALLOWED_ENTRY_RE` com a nova tabela; manter `campaign-images`/lojas remotas em `FORBIDDEN_TARGETS`.
**O que deve permanecer inalterado:** `forbiddenProductionAccess` (345-347), `wrapReadOnlyTable` (350-364), `wrapReadOnlyBucket` (379-397), `createRecordingClient` (403-469) e os self-tests negativos existentes (em `bench-boundary.contract.test.ts:424-491`).

### M11. `src/lib/ai/__tests__/architecture-guard.test.ts` — gates aditivos do contexto bancada

**Seam:** região do laboratório em **linhas 133-234** (`labFiles` em 139; `benchFiles` em 245; gates em 252-265).

```typescript
// linhas 245-265 (HOJE) — gates já cobrem bench/**; adicionar, se necessário:
const benchFiles = files.filter((file) => file.startsWith("src/lib/lab/bench/"));
// gera: sem generation_events, sem provider de imagem produtivo, sem chave de provider, sem escrita em prompts/
```

**Adicionar:** gate explícito de que o compositor/módulos novos da bancada **não introduzem contexto experimental** e que o prompt-base não sofre filtragem (verificação por origem); e que nenhum módulo da bancada acessa origem remota no runtime.
**O que deve permanecer inalterado:** todas as regras globais (86-131) e os gates F48.1/F48.2.1 (154-234) — **nenhuma regra pode ser afrouxada**.

---

## Shared Patterns (cross-cutting)

### Autenticação e ordem de guards
**Fonte:** `src/lib/admin/require-admin.ts:6-19`, `src/lib/lab/environment-guard.ts:169-183`, `src/lib/auth/api-handler.ts:6-17`
**Aplicar a:** TODAS as rotas da bancada (novas e modificadas).
```typescript
export const GET = apiHandler(async () => {
  await requireAdmin();                              // 1) 403 se não-admin
  try { assertLabEnvironment(); }                    // 2) 403 se ambiente bloqueado
  catch (error) {
    if (error instanceof LabEnvironmentError) return NextResponse.json(labEnvironmentDeniedBody(error.reason), { status: 403 });
    throw error;
  }
  // 3) `assertBenchTestStore` ANTES de qualquer leitura com `storeId`; só então lab_*/storage/provider.
});
```

### Manifesto como única fonte de elegibilidade
**Fonte:** `src/lib/lab/bench/domain/store-manifest.ts:255-291` (`assertBenchTestStore`)
**Aplicar a:** `GET /briefing`, composição/aprovação e `POST /runs`.
```typescript
const manifest = params.manifest ?? (await loadBenchStoreManifest()).stores;
if (!manifest.some((entry) => entry.id === params.storeId)) {
  throw new BenchStoreManifestError(STORE_NOT_IN_MANIFEST, params.storeId);
}
// ... select local; ausente ⇒ BENCH_STORE_NOT_MATERIALIZED
```

### Erro sanitizado na origem (uma única vez)
**Fonte:** `src/lib/ai/types.ts:213-218` (`sanitizeAiErrorMessage`)
**Aplicar a:** importação (logs/erros/`detail`), `finalizeBenchRun` (banco) e evento `error` do stream NDJSON. Nunca persistir/emitir chave, URL ou token.

### Cliente Supabase por parâmetro (testabilidade)
**Fonte:** `src/lib/lab/bench/persistence/bench-run-service.ts:1-42`, `src/lib/lab/api/experiment-queries.ts:11-24`
**Aplicar a:** todo serviço da bancada. `supabaseAdmin` só nas rotas/páginas; o comando de importação usa **dois clientes explícitos** (origem read-only + destino local).

### Compositor puro e determinístico
**Fonte:** `src/lib/image-generation/services/art-director-briefing.ts` (builders), `src/lib/lab/gateway/lab-prompt-loader.ts:21-45` (preservação)
**Aplicar a:** `prompt-composer.ts`, `experimental-briefing.ts`, `form-rules.ts`, `resolve-bench-brand-color.ts`. Sem I/O, sem `process.env`, sem provider; prompt-base preservado sem filtragem lexical.

### Preflight aprovado = `prompt_sent`
**Fonte:** `src/app/api/admin/laboratorio/bancada/runs/route.ts:202-236` + `bench-execution-panel.tsx:181-253`
**Aplicar a:** `POST /runs` e UI. Nenhuma transformação após a aprovação; confirmação financeira **separada** da aprovação do prompt.

### Test doubles em memória
**Fonte:** `src/lib/lab/__tests__/recording-supabase-client.ts:403-469`, `src/lib/lab/api/__tests__/fake-supabase-client.ts`, `__tests__/bench-execution.contract.test.ts:76-91` (`RecordingAdapter`)
**Aplicar a:** todos os testes novos. **Nenhuma chamada de rede e nenhuma chamada paga em testes/CI.**

### NDJSON — exatamente um terminal
**Fonte:** `src/app/api/admin/laboratorio/experiments/[id]/runs/route.ts:143-180`, `bench-execution-panel.tsx:140-179`
**Aplicar a:** `POST /api/admin/laboratorio/bancada/runs` (mantido). O serviço é o único dono de `done`/`error`; `Content-Type: application/x-ndjson`.

---

## No Analog Found

| Arquivo | Papel | Fluxo | Motivo |
|---------|-------|-------|--------|
| Cliente de origem remota **somente-leitura por construção** (dentro de `48-2-3-bench-import-stores.mjs`) | utility/adapter | request-response (read) | Não existe cliente remoto de leitura dedicado no repositório; o analog é a **composição** de `assertLocalHost` (destino) + o client Supabase por parâmetro + a allowlist de `recording-supabase-client.ts`. O planner deve tratar como composição, não cópia 1:1. |
| Tabela `lab_bench_store_imports` | migration/DDL | batch | Não existe; seguir o padrão DDL de `lab_bench_runs`/`lab_bench_artifacts` em `supabase/lab/bench-schema.sql:34-125` (RLS service-role + grants + REVERT). |
| Blocos canônicos `[IDENTIDADE E DIREÇÃO VISUAL]`… | domain | transform | Não existem blocos nomeados no produtivo (o produtivo usa seções Markdown do Diretor). O analog de **forma** é `art-director-briefing.ts`; os **nomes/trava** vêm da spec `lab-bench-prompt-preflight` (D19). |

---

## Anti-patterns / do-not-touch (inalterados nesta fase, verificados por `base..HEAD`)

| Arquivo | Por quê |
|---------|---------|
| `src/components/campaign/types.ts` (`BrandProfileSnapshot`) | Contrato produtivo de snapshot; a lacuna de tipografia é fechada no contrato da bancada (D15/D16) |
| `src/lib/store-identity-service.ts` (`resolveStoreIdentity`) | Mapper produtivo de `brandColor`; a bancada replica a precedência com teste de paridade, sem editar (D16) |
| `src/lib/image-generation/services/art-director-briefing.ts` | Prompt do Diretor de produção; a bancada monta seu próprio briefing/compositor (D15) |
| `src/lib/ai/adapters/registry.ts`, `src/lib/ai/adapters/images.ts` | Registry e adapter `Images` produtivos; o adapter da bancada vive em `bench-images.ts` e só é registrado no runtime da bancada (D8) |
| `src/lib/ai/model-registry.ts` (`MODEL_ALLOWLIST`) | Allowlist produtiva; a bancada usa a própria (`BENCH_MODEL_ALLOWLIST`) |
| `src/components/flow/use-campaign-form.ts` e `campaign-input-form.tsx` | Formulário/hook produtivos: **apenas importar** helpers puros exportados; **não** editar (D13) |
| `prompts/**` | Prompts oficiais; nenhum arquivo do lab escreve neles (gate `architecture-guard.test.ts:218-224`) |
| `supabase/migrations/**` | O DDL da bancada **não** entra na cadeia de migrations remotas (D17) |
| `campaign-images` (bucket) | Proibido ler/reutilizar; só `lab-artifacts` com prefixo `bench/` e os buckets de branding locais (D4/D7) |

**Proibido no código da bancada** (herdado dos gates): `generation_events`, `AiCostTracker.record`, provider de imagem de produção, SDK/wire fora de `src/lib/ai/adapters/**`, chaves de provider (`OPENAI_API_KEY`/`GEMINI_API_KEY`), `ai_model_selection`, `campaign_image_review`, escrita em `ai_model_catalog`/`prompts/`, `campaigns`, `campaign_art_versions`, `admin_audit_log`, `credit_*`.

---

## Metadata

**Escopo da busca de analogs:** `src/lib/lab/bench/**`, `src/lib/lab/**`, `src/lib/store-identity-service.ts`, `src/lib/campaign/**`, `src/lib/image-generation/**`, `src/lib/constants.ts`, `src/lib/formatters.ts`, `src/components/flow/**`, `src/components/campaign/**`, `src/app/api/admin/laboratorio/bancada/**`, `src/app/(app)/admin/laboratorio/bancada/**`, `supabase/lab/**`, `scripts/lab/**`, `scripts/uat/**`, `fixtures/lab/bench/**`.
**Arquivos lidos para extração:** 30+ (analogs, seams, testes, DDL, scripts, specs).
**Arquivos com analog exato:** 13; role-match/composição: 10; sem analog (composição explícita): 3.
**Data de extração:** 2026-09-29.
**Fonte da verdade:** `openspec/changes/fase-48-2-3-fidelidade-experimental-bancada/` (proposal/design D1–D21/tasks 1–8/9 specs) + `48.2.3-CONTEXT.md` + `48.2.3-UI-SPEC.md` + precedente `48-2-2-PATTERNS.md`.
