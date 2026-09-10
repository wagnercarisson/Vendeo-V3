# Phase 37.2: Correção Única por Não Conformidade - Pattern Map

**Mapped:** 2026-09-10
**Files analyzed:** 21 (11 novos, 10 modificados)
**Analogs found:** 19 / 21 (2 parciais)

> Fonte da verdade: `openspec/changes/fase-37-2-correcao-unica-por-nao-conformidade/` (design.md D1–D10, tasks.md 19 seções, 9 specs). Este mapa ancora cada arquivo novo/modificado no analog real do repositório com trechos concretos. **Nunca reutilizar** as RPCs dormentes `begin_campaign_correction`/`cancel_campaign_correction`/`complete_campaign_regeneration` (`supabase/migrations/20260905000001_f37_2_correction_rpcs.sql`) — servem só de referência de padrão de lock/transação.

## File Classification

| Novo/Modificado | Arquivo | Role | Data Flow | Analog mais próximo | Match |
|-----------------|---------|------|-----------|---------------------|-------|
| NEW | `supabase/migrations/20260906000001_f37_2_create_campaign_correction_tables.sql` (M1) | migration | DDL/schema | `supabase/migrations/20260901000001_f37_1_create_campaign_art_versions.sql` | exact |
| NEW | `supabase/migrations/20260906000002_f37_2_correction_rpcs.sql` (M2+M3) | migration | transacional (RPC) | `20260901000002_f37_1_approve_campaign_art_version_rpc.sql` + dormente `20260905000001` | exact |
| NEW | `supabase/migrations/20260906000003_f37_2_generation_events_type.sql` (M4) | migration | DDL/CHECK | `20260825000001_create_store_campaign_themes.sql:304-316` | exact |
| NEW | `src/lib/campaign/correction-reports.ts` | service + persistence + orchestrator | CRUD + orquestração v2 | `src/lib/campaign/persistence.ts` + `display.ts` | role-match |
| NEW | `src/lib/campaign/correction-intent-service.ts` | service (IA textual) | request-response (JSON+Zod) | `src/lib/copy/copy-director-service.ts` + `image-generation/services/input-validation-service.ts` | exact |
| NEW | `src/app/api/campaign/[id]/problem-report/route.ts` | route | streaming NDJSON + request-response | `src/app/api/campaign/generate-image/route.ts` + `[id]/approve/route.ts` | exact |
| NEW | `src/components/campaign/campaign-problem-modal.tsx` | component (client modal) | request-response/UI | `src/components/changelog/changelog-announcement.tsx` + `campaign/campaign-approval-view.tsx` | role-match |
| NEW | `src/app/(app)/admin/campaign-reports/page.tsx` | admin page (server) | read/CRUD | `src/app/(app)/admin/access-requests/page.tsx` | exact |
| NEW | `src/app/(app)/admin/campaign-reports/[reportId]/page.tsx` | admin page (server detail) | read | `admin/reviews/review-detail.tsx` + `admin/ai-operation-costs/page.tsx` | role-match |
| NEW | `src/app/api/admin/campaign-reports/[reportId]/route.ts` (marcar revisado) | admin route | request-response | `src/app/api/admin/access-requests/[id]/route.ts` | exact |
| MOD | `src/lib/campaign/types.ts` | types | — | self (`CampaignArtVersion`) | exact |
| MOD | `src/lib/campaign/persistence.ts` | persistence | CRUD | self (seção F37.1) | exact |
| MOD | `src/lib/campaign/display.ts` | domain | transform | self (`computeApprovalState`) | exact |
| MOD | `src/components/campaign/campaign-approval-view.tsx` | component | UI | self (botão primário) | exact |
| MOD | `src/app/(app)/campanhas/[id]/page.tsx` | server page | read | self (bloco F37.1) | exact |
| MOD | `src/app/(app)/campanhas/[id]/client.tsx` | client component | UI | self (branch `pending`) | exact |
| MOD | `src/app/api/campaign/[id]/approve/route.ts` | route | request-response | self (RPC approve) | exact |
| MOD | `src/lib/image-generation/services/image-generation-service.ts` | service | pipeline/event-driven (hook) | self (`generateWithRetry`/`assemblePrompt`) | exact |
| MOD | `src/lib/visual-signature/types.ts` | types | — | self (union `GenerationEventType`) | exact |
| MOD | `src/app/(app)/admin/layout.tsx` | layout/config | — | self (nav) | exact |
| MOD (parcial) | `src/lib/image-generation/services/art-director-briefing.ts` | helper puro | transform | self (blocos condicionais) | partial |

---

## Pattern Assignments

### `supabase/migrations/20260906000001_f37_2_create_campaign_correction_tables.sql` (M1 — migration, DDL)

**Analog:** `supabase/migrations/20260901000001_f37_1_create_campaign_art_versions.sql`

**Cabeçalho + DDL da tabela** (linhas 1-33) — replicar: comentário de propósito, `CREATE TABLE IF NOT EXISTS`, PK `gen_random_uuid()`, FKs `ON DELETE CASCADE`, CHECKs inline, `UNIQUE`:
```sql
CREATE TABLE IF NOT EXISTS public.campaign_art_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  version_number smallint NOT NULL CHECK (version_number BETWEEN 1 AND 3),
  status text NOT NULL CHECK (status IN ('pending','approved','rejected')),
  correction_in_progress boolean NOT NULL DEFAULT false,
  ...
  UNIQUE (campaign_id, version_number)
);
```
Para a F37.2: `campaign_correction_reports` (`UNIQUE(campaign_id)`, `status CHECK IN ('open','generation_started','v2_generated','failed_no_v2')`) + `campaign_correction_submissions` (**sem `campaign_id`**, `attempt_number smallint NOT NULL`, `UNIQUE(report_id, attempt_number)`, `analysis_state CHECK`, `analysis_expires_at NOT NULL`).

**RLS service_role-only** (linhas 35-50):
```sql
ALTER TABLE public.campaign_art_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage campaign art versions"
  ON public.campaign_art_versions FOR ALL TO service_role
  USING (true) WITH CHECK (true);
REVOKE ALL ON TABLE public.campaign_art_versions FROM anon;
REVOKE ALL ON TABLE public.campaign_art_versions FROM authenticated;
REVOKE ALL ON TABLE public.campaign_art_versions FROM service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.campaign_art_versions TO service_role;
```

**Troca idempotente do CHECK `asset_status` (`superseded`) + CHECKs semânticos da filha** (padrão `DO $$` das linhas 67-78):
```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'campaigns_approved_requires_version'
      AND conrelid = 'public.campaigns'::regclass
  ) THEN
    ALTER TABLE public.campaigns
      ADD CONSTRAINT campaigns_approved_requires_version
      CHECK (approval_status <> 'approved' OR approved_version_id IS NOT NULL);
  END IF;
END $$;
```
Para `asset_status`: `DO $$ ... IF EXISTS (pg_constraint conname='campaign_art_versions_asset_status_check') THEN DROP CONSTRAINT ... END IF; ADD CONSTRAINT ... CHECK (asset_status IN ('active','discarded','superseded')) $$;`. CHECKs da filha: (a) `completed_at` só quando `analysis_state <> 'analyzing'`; (b) `eligible` exige `category IS NOT NULL` e `trim(normalized_instruction) <> ''`; (c) `blocked|unclear|analysis_failed` exigem `category IS NULL AND normalized_instruction IS NULL`.

**Seção REVERT comentada** (linhas 98-111) — obrigatória, ordem reversa.

---

### `supabase/migrations/20260906000002_f37_2_correction_rpcs.sql` (M2+M3 — RPCs)

**Analogs:** `20260901000002_f37_1_approve_campaign_art_version_rpc.sql` (esqueleto) + dormente `20260905000001_f37_2_correction_rpcs.sql` (padrão de lock e transação — **não reutilizar a função**).

**Esqueleto de função SECURITY DEFINER** (approve RPC, linhas 22-47):
```sql
CREATE OR REPLACE FUNCTION public.approve_campaign_art_version(
  p_campaign_id uuid, p_version_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE ...
BEGIN
  IF p_campaign_id IS NULL OR p_version_id IS NULL THEN
    RAISE EXCEPTION 'missing_params';
  END IF;

  SELECT status, asset_status, campaign_id, storage_path
    INTO v_status, v_asset_status, v_campaign_id, v_storage_path
    FROM public.campaign_art_versions
   WHERE id = p_version_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'version_not_found'; END IF;
  ...
```
Erros por `RAISE EXCEPTION '<codigo>'` e mapeamento por `msg.includes(...)` na rota (linhas 72-84).

**Padrão de locks candidata → campanha → relato** (dormente, `begin_campaign_correction` linhas 69-94): travar candidata ativa `pending`/`active` com `ORDER BY version_number LIMIT 1 FOR UPDATE`, depois campanha `FOR UPDATE`, depois relato. **A F37.2 inverte a ordem do dormente** (que trava campanha primeiro) para **candidata → campanha → relato** (uniforme com consumo/approve — anti-deadlock).

**Padrão INSERT + demote atômico** (dormente `complete_campaign_regeneration` linhas 229-269): `INSERT ... RETURNING id INTO v_new_version_id;` depois `UPDATE ... WHERE id = v_version_id`. Para `complete_campaign_correction_v2`: inserir v2 (`version_number=2`, `pending`, `active`, `brief_snapshot` **copiado da v1 travada** — nunca do cliente), demover v1 para `asset_status='superseded'` **preservando `storage_path`** (NÃO `discarded`/`storage_path=NULL`), `report.status='v2_generated'`/`generated_version_id`.

**REVOKE/GRANT + REVERT** (linhas 94-103 / 282-305):
```sql
REVOKE EXECUTE ON FUNCTION public.<fn>(<args>) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.<fn>(<args>) TO service_role;
```

RPCs a criar (nomes próprios): `begin_campaign_correction_submission`, `consume_campaign_correction_opportunity`, `complete_campaign_correction_v2`, `fail_campaign_correction_v2`, `complete_campaign_correction_analysis`, `recover_campaign_correction_generation`, `approve_campaign_candidate` (chama a RPC F37.1 intacta na mesma transação). **Nunca `CREATE OR REPLACE` sobre as RPCs F37.1/dormentes.**

---

### `supabase/migrations/20260906000003_f37_2_generation_events_type.sql` (M4 — CHECK)

**Analog:** `supabase/migrations/20260825000001_create_store_campaign_themes.sql:304-316`
```sql
ALTER TABLE public.generation_events
  DROP CONSTRAINT IF EXISTS chk_generation_events_type;
ALTER TABLE public.generation_events
  ADD CONSTRAINT chk_generation_events_type
  CHECK (generation_type IN (
    'campaign_pipeline','campaign_copy','campaign_input_validation',
    'campaign_image','campaign_image_review',
    'visual_signature','visual_signature_image','visual_signature_validation',
    'brand_profile_without_logo','brand_profile_with_logo',
    'brand_profile_vision','brand_profile_text',
    'theme_direction','theme_generation'
  ));
```
Acrescentar `'campaign_correction_analysis'` (13º/15º valor) + REVERT comentado (linhas 338-345). Idempotente, aditivo, retrocompatível.

---

### `src/lib/campaign/correction-reports.ts` (service/persistence/orquestrador, CRUD + v2)

**Analogs:** `src/lib/campaign/persistence.ts` + `src/lib/campaign/display.ts`

**Imports + cabeçalho** (persistence.ts:1-9):
```typescript
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { transcodeToJpeg } from "./image-processor";
import type { CampaignArtVersion, CampaignRecord, ... } from "./types";
```

**Leitura por campaignId/relatório** (persistence.ts:134-148 `getCampaign` e 254-268 `listArtVersions`):
```typescript
const { data, error } = await supabaseAdmin
  .from("campaign_art_versions")
  .select("*")
  .eq("campaign_id", campaignId)
  .order("version_number", { ascending: true });
if (error) throw new Error(error.message);
return (data ?? []) as CampaignArtVersion[];
```
Aplicar a `getCorrectionReport(campaignId)` (`.maybeSingle()`), `listCorrectionSubmissions(reportId)` (`.order("attempt_number")`), `listCorrectionReports({filters,page})`, `getCorrectionReportDetail(reportId)`.

**Escrita via RPC** (não UPDATE TS direto — D3): `completeCorrectionAnalysis`/`finalizeSubmission` chamam `supabaseAdmin.rpc("complete_campaign_correction_analysis", {...})`; o orquestrador chama `begin`/`consume`/`complete_v2`/`fail`/`recover`.

**Mark reviewed (ortogonal)** — `markReportReviewedBySupport(reportId, actorId)`: `update({ reviewed_by_support_at, reviewed_by_support_user })` no relato.

**Orquestrador da v2** (design D5): baixar imagens F41 (`media.images[].storagePath`) do bucket `campaign-images` e reconverter em data URLs. Analog de download de storage (brand-profile/realign route:415-425):
```typescript
const { data: fileData } = await supabase.download(storagePath);
if (fileData) {
  const buffer = Buffer.from(await fileData.arrayBuffer());
}
// montar data URL: `data:${mimeType};base64,${buffer.toString("base64")}`
```
**Não existe helper pronto `storagePathToDataUrl`** — criar no módulo (ver "No Analog Found").

---

### `src/lib/campaign/correction-intent-service.ts` (service IA textual, JSON+Zod)

**Analogs:** `src/lib/copy/copy-director-service.ts` (estrutura) + `src/lib/image-generation/services/input-validation-service.ts` (parse defensivo).

**Parse defensivo JSON + Zod** (copy-director-service.ts:14-22):
```typescript
function parseViaJson(raw: string): CopyDirectorResult | null {
  try {
    const parsed = JSON.parse(raw);
    return CopyDirectorResultSchema.parse(parsed);
  } catch {
    return null;
  }
}
```

**Classe + chamada ao provider + onCall best-effort** (copy-director-service.ts:51-111):
```typescript
export class CopyDirectorService {
  private readonly provider: TextProvider;
  constructor(provider: TextProvider, promptLoader?: PromptLoader) { ... }

  async generateCopy(input, options?, onCall?) {
    const startTime = Date.now();
    const result = await this.provider.generateText(prompt, {
      system: SYSTEM_PROMPT, temperature: 0.7, maxTokens: 1000, signal: options?.signal,
    });
    const durationMs = Date.now() - startTime;
    this.invokeOnCall(onCall, {
      provider: this.provider.name, model: result.model, usage: result.usage, durationMs,
    });
    return this.parseResult(result.content);
  }
}
```
`onCall` best-effort (linhas 117-137): `Promise.resolve(onCall(info)).catch(...)` — nunca quebra. **Na F37.2 o `provider` do evento = `textProvider.name`** (design D2 achado 4).

**Limpeza de markdown/fences antes do JSON.parse** (input-validation-service.ts:256-269 `cleanJsonResponse`): strip ```` ```json ````/```` ``` ```` + extrair do primeiro `{` ao último `}`.

**Contrato Zod** (`CorrectionAnalysisResultSchema`): `analysisState: "eligible"|"blocked"|"unclear"`, `category?`, `normalizedInstruction?`, `guidance`; campos inesperados rejeitados (`.strict()` — padrão `GenerateImageRequestSchema`). JSON inválido/fora do schema → `unclear`; timeout/transporte/vazio → `analysis_failed`.

**Factory do provider** (`src/lib/text-provider/factory.ts:6-22`): `createTextProvider()`; `TextProvider.generateText` sem `jsonMode` (`src/lib/text-provider/types.ts:1-17`).

**Saneamento de conteúdo não confiável:** `sanitizePromptText` de `art-director-briefing.ts:55-57` (`{{`→`{`, `}}`→`}`).

---

### `src/app/api/campaign/[id]/problem-report/route.ts` (route, NDJSON + request-response)

**Analogs:** `src/app/api/campaign/generate-image/route.ts` + `src/app/api/campaign/[id]/approve/route.ts`

**Guards + apiHandler** (approve/route.ts:24-50):
```typescript
export const POST = apiHandler(async (request, { params }) => {
  requireSameOrigin(request);
  const user = await requireApiUser();
  const { id } = await params;
  if (!UUID_V4_REGEX.test(id)) return NextResponse.json({ error: "Invalid campaign ID" }, { status: 400 });
  const campaign = await getCampaign(id);
  if (!campaign) return notFound("Campaign not found");
  await requireOwnership(campaign.store_id, user.userId);
  if (!(await isCampaignApprovalEnabled())) return NextResponse.json({ error: "Approval flow disabled" }, { status: 403 });
  if (campaign.status !== "ready") return NextResponse.json({ error: "Campaign not ready" }, { status: 409 });
```
Depois: zod strict `{ text }` → vazio/só pontuação **400** (sem caso/IA) → `rpc("begin_campaign_correction_submission", ...)` → análise → conclusão via RPC.

**NDJSON stream** (generate-image/route.ts:520-537):
```typescript
const encoder = new TextEncoder();
const stream = new ReadableStream({
  async start(controller) {
    const emit = (event: Record<string, unknown>) => {
      try { controller.enqueue(encoder.encode(JSON.stringify(event) + "\n")); } catch { /* closed */ }
    };
    ...
  },
});
return new Response(stream, { status: 200, headers: { "Content-Type": "application/x-ndjson" } });
```

**Registro call-level do custo** (generate-image/route.ts:592-639): `resolveAiCost({ provider, model, usage, generationType })` + `new AiCostTracker().record({ operationRunId, operationRunType: "campaign_delivery", traceId, storeId, userId, campaignId, generationType, provider, model, attemptNumber, durationMs, status, errorType, tokens, cost, usdBrlRateAtGeneration, creditValueBrlAtGeneration })` dentro de `try/catch` (best-effort). Para a análise: `generationType: "campaign_correction_analysis"`, `attemptNumber = attempt_number` da submissão.

**Fluxo eligible** (padrão generate-image:721-758 `imageTask`): `imageService.generateImage(brief, context, onPhase, signal, onMetrics)` com `onMetricsEvent` mapeando fases → `recordCall`. **O hook `onBeforeImageProviderCall` é o ponto que dispara `consume_campaign_correction_opportunity`.** Fases: `input_validation` (`skipped` via `brief_review_confirmed`) → `image_generation` → `done`/`error`.

**Falha pós-provider** (padrão generate-image:859-883): emitir `{ type: "error", ... }` e chamar `rpc("fail_campaign_correction_v2", ...)` + remoção best-effort de asset órfão (`deleteCampaignImage` — persistence.ts:150-161).

**Sucesso da v2** (padrão generate-image:854-858): `emit({ type: "result", campaignId, campaignUrl })` após `complete_campaign_correction_v2`.

**Sem reserva de crédito** — NÃO replicar o bloco `reserveCredit` (generate-image:487-516).

---

### `src/components/campaign/campaign-problem-modal.tsx` (client modal)

**Analogs:** `src/components/changelog/changelog-announcement.tsx` (dialog) + `src/components/campaign/campaign-approval-view.tsx` (fetch + refresh)

**Shell do modal acessível** (changelog-announcement.tsx:68-81):
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
  <div role="dialog" aria-modal="true" aria-label={...}
       className="w-full max-w-[480px] rounded-xl border border-border bg-bg-elevated p-6 shadow-xl">
    ...
  </div>
</div>
```
Adicionar handlers de **ESC/backdrop** e botão X (touch ≥ 44px — changelog-announcement.tsx:31-40 usa `min-h-[44px] min-w-[44px]`).

**Fetch + `router.refresh()` + estados PT-BR** (campaign-approval-view.tsx:31-49):
```tsx
const router = useRouter();
const [isSubmitting, setIsSubmitting] = useState(false);
const [error, setError] = useState<string | null>(null);
const handleSubmit = useCallback(async () => {
  setIsSubmitting(true); setError(null);
  try {
    const res = await fetch(`/api/campaign/${campaignId}/problem-report`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Falha"); }
    router.refresh();
  } catch { setError("Não foi possível enviar. Tente novamente."); setIsSubmitting(false); }
}, [...]);
```
Validação **no clique** (vazio/só pontuação → erro amigável, sem chamar a API). Botões `[Enviar para análise]`/`[Cancelar]` com `Button` (`src/components/ui/button.tsx`), preview via `<img ... className="object-contain" />`.

---

### `src/app/(app)/admin/campaign-reports/page.tsx` (admin lista, server)

**Analog:** `src/app/(app)/admin/access-requests/page.tsx`

**Guarda + searchParams + paginação** (linhas 35-72):
```tsx
export default async function AdminAccessRequestsPage({ searchParams }) {
  try { await requireAdmin(); } catch {
    return <div className="rounded-lg border border-destructive/30 ...">Acesso negado...</div>;
  }
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));
  const pageSize = 20; const offset = (page - 1) * pageSize;
  const { data, error, count } = await supabaseAdmin
    .from("access_requests").select("*", { count: "exact" })
    .eq("status", activeTab).order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);
  if (error) return <div className="text-destructive">Erro ao carregar: {error.message}</div>;
```
**Tabs/filtros via `<Link>`** (linhas 84-98) e **paginação `<Link>`** (linhas 175-191). Tabela com `EmptyState` (linhas 100-112). `export const dynamic = "force-dynamic";` (linha 11). Server page chama serviços internos (`listCorrectionReports`) — **sem chamar a própria API**.

---

### `src/app/(app)/admin/campaign-reports/[reportId]/page.tsx` (admin detalhe, server)

**Analogs:** `admin/reviews/review-detail.tsx` (dl grid informado×oficial/histórico) + `admin/ai-operation-costs/page.tsx` (link ao run)

**Grid de detalhe** (review-detail.tsx:55-108): `dl` com `grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2` + pares `dt`/`dd` — aplicar a v1 × v2 lado a lado, status/consumo, timestamps.
**Histórico de tentativas** (review-detail.tsx:110-125): `ul` ordenado; na F37.2 por `attempt_number` (texto → `analysis_state` → `category` → `instruction` → timestamps).
**Signed URLs service_role** (display.ts:63-78):
```typescript
const { data, error } = await supabaseAdmin.storage.from("campaign-images").createSignedUrl(storagePath, 3600);
if (error) throw new Error(error.message);
return data.signedUrl;
```
Gerar para v1 (`superseded`, path preservado) e v2. **`operation_run_id` linkável** ao painel F38.2: `/admin/ai-operation-costs?operationRunId=<uuid>` (page.tsx:35 `operationRunId` em searchParams). **Aprovação derivada** de `campaigns.approved_version_id`/`approved_at` — sem campos espelhados no relato.

---

### `src/app/api/admin/campaign-reports/[reportId]/route.ts` (marcar revisado)

**Analog:** `src/app/api/admin/access-requests/[id]/route.ts:16-62`
```typescript
export const POST = apiHandler(async (request, { params }) => {
  const admin = await requireAdmin();
  requireSameOrigin(request);
  const { id } = await params;
  const parsed = ReviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const { data, error } = await supabaseAdmin.rpc("...", { ... });
  if (error) { /* mapear */ }
  return NextResponse.json({ success: true, ... });
});
```
A marcação "revisado pelo suporte" é **ortogonal** — não muda `status`/`rejection_count`/versões/aprovação.

---

### MODIFICADOS — pontos de inserção (self analogs)

#### `src/lib/campaign/types.ts`
`ArtAssetStatus` — trocar o literal em `CampaignArtVersion.asset_status` (linha 20): `"active" | "discarded"` → `"active" | "discarded" | "superseded"` (spec `campaign-art-versions`). Adicionar `CorrectionReportStatus`, `CorrectionAnalysisState`, `CorrectionReport`, `CorrectionSubmission` (com `attempt_number`, `analysis_expires_at`, `completed_at`). Manter `CampaignRecord` (linhas 30-49).

#### `src/lib/campaign/persistence.ts`
Adicionar seção após a de versões (linhas 223-268): funções de correção (`getCorrectionReport`, `listCorrectionSubmissions`, `createCorrectionReport` para testes, `completeCorrectionAnalysis`, `listCorrectionReports`, `getCorrectionReportDetail`, `markReportReviewedBySupport`). Reusar padrão de erro `if (error) throw new Error(error.message)`.

#### `src/lib/campaign/display.ts`
`ApprovalDisplayState` (linhas 16-21) e `computeApprovalState` (140-166) já derivam `regenerating` — **manter**. `CampaignPageProps.approval` (36-41) passa a carregar `pending` v1/v2 e `regenerating`. `isDeliveryReleased` (170-180) e `getActiveCandidateArtVersion` (185-189) intactos.

#### `src/components/campaign/campaign-approval-view.tsx`
Onde hoje há só o botão primário (linhas 74-87), adicionar o botão secundário **[Informar problema]** (abre o modal) e a guarda de UX (desabilitar `[Aprovar arte]` com caso em processamento). Props ganham `hasOpportunity`/candidata v1.

#### `src/app/(app)/campanhas/[id]/page.tsx`
No bloco `if (campaign.status === "ready")` (linhas 45-59): antes de `computeApprovalState`, se derivar `regenerating`, chamar `recover_campaign_correction_generation` (best-effort); **se `recovered:true`, RECARREGAR campanha/versões (nova leitura) antes de recalcular**. Passar props `pending` (v1/v2) e `regenerating`.

#### `src/app/(app)/campanhas/[id]/client.tsx`
No branch de render (linhas 55-67): adicionar `props.approval?.state.status === "regenerating"` → `<RegeneratingView/>` (progresso v2, **sem** `ReadyView`); `pending` v2 → `CampaignApprovalView` sem `[Informar problema]`.

#### `src/app/api/campaign/[id]/approve/route.ts`
Antes do `rpc` (linhas 67-70): chamar `recover_campaign_correction_generation` (best-effort). Trocar o alvo para `rpc("approve_campaign_candidate", { p_campaign_id: id, p_version_id: parsed.data.versionId })`. Mapear `correction_in_progress` → 409 (junto de `version_not_pending`/`version_not_active`, linhas 77-82). Resposta 200 inalterada (88-91).

#### `src/lib/image-generation/services/image-generation-service.ts`
- Assinatura `generateImage` (linhas 89-95): hook opcional/aditivo `onBeforeImageProviderCall?: () => Promise<void>` (ou opção de execução). Ausência = comportamento atual.
- Ponto do hook: em `generateWithRetry` (linhas 869-881), **iteração `attempt === 0`**, imediatamente antes de `this.imageProvider.generateImage(...)`, **fire-once**.
- Bloco único de não conformidade: em `assemblePrompt` (linhas 757-775) — concatenar bloco condicional ao basePrompt (padrão dos blocos CORRECT/REGENERATE), **sem editar os `.md`**.
- `input_validation` `skipped` via `brief_review_confirmed`: já suportado (linhas 165-179). Revisor intocado (linhas 405-434).

#### `src/lib/visual-signature/types.ts`
Union `GenerationEventType` (linhas 101-113): adicionar `'campaign_correction_analysis'` (12 → 13 valores). Refletir no CHECK M4.

#### `src/app/(app)/admin/layout.tsx`
Adicionar `<Link href="/admin/campaign-reports">Relatos de correção</Link>` na `<nav>` (linhas 22-53).

#### `src/lib/image-generation/services/art-director-briefing.ts` (parcial)
Padrão de bloco condicional que retorna `""` quando ausente (ex.: `constraintsSection` linhas 484-494; `commercialDetailsSection` 335-352). Usar `sanitizePromptText` (55-57) na instrução normalizada. **Não editar os 4 `.md`.**

---

## Shared Patterns

### Guards de rota autenticada
**Fonte:** `src/app/api/campaign/[id]/approve/route.ts:28-50`
**Aplicar a:** `problem-report/route.ts`, `approve/route.ts` (modificado)
```typescript
requireSameOrigin(request);                    // CSRF
const user = await requireApiUser();           // auth
if (!UUID_V4_REGEX.test(id)) return ...400;
const campaign = await getCampaign(id);
if (!campaign) return notFound("Campaign not found");
await requireOwnership(campaign.store_id, user.userId);  // 404 se não-dono
if (!(await isCampaignApprovalEnabled())) return ...403; // flag off
if (campaign.status !== "ready") return ...409;
```

### RPC via supabaseAdmin + mapeamento por mensagem
**Fonte:** `src/app/api/campaign/[id]/approve/route.ts:67-84`
**Aplicar a:** `problem-report`, `approve`, admin review
```typescript
const { data, error } = await supabaseAdmin.rpc("<nome>", { p_... });
if (error) {
  const msg = error.message ?? "";
  if (msg.includes("version_not_found") || msg.includes("version_campaign_mismatch")) return notFound(...);
  if (msg.includes("version_not_pending") || msg.includes("version_not_active")) return NextResponse.json({ error: "..." }, { status: 409 });
  return NextResponse.json({ error: msg }, { status: 500 });
}
```

### Migration idempotente + RLS service_role + REVERT
**Fonte:** `20260901000001_f37_1_create_campaign_art_versions.sql`
**Aplicar a:** M1, M2, M3, M4
- `CREATE TABLE IF NOT EXISTS`; `ADD COLUMN IF NOT EXISTS`; `CREATE INDEX IF NOT EXISTS`.
- CHECKs evolutivos via `DO $$ ... IF EXISTS (pg_constraint) ... END $$` ou `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT`.
- RLS `FOR ALL TO service_role`; `REVOKE ALL FROM anon/authenticated/service_role`; `GRANT SELECT, INSERT, UPDATE TO service_role`.
- Seção **REVERT** comentada ao final (ordem reversa).

### RPC SECURITY DEFINER
**Fonte:** `20260901000002_f37_1_approve_campaign_art_version_rpc.sql:22-30`
**Aplicar a:** todas as RPCs novas
```sql
CREATE OR REPLACE FUNCTION public.<fn>(...) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$ ... $$;
REVOKE EXECUTE ON FUNCTION public.<fn>(...) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.<fn>(...) TO service_role;
```

### Custo call-level best-effort
**Fonte:** `src/app/api/campaign/generate-image/route.ts:592-639`
**Aplicar a:** `correction-intent-service.ts` (análise) e orquestrador da v2
```typescript
const cost = await resolveAiCost({ provider, model, usage, generationType });
await new AiCostTracker().record({
  operationRunId, operationRunType: "campaign_delivery", traceId,
  storeId, userId, campaignId, generationType,
  provider, model, attemptNumber, durationMs, status, errorType, tokens: usage, cost,
  usdBrlRateAtGeneration, creditValueBrlAtGeneration,
});
// dentro de try/catch — nunca derruba o fluxo
```
`AiCostTracker.record` já é best-effort internamente (`src/lib/ai-cost/tracker.ts:34-88`).

### Leitura de flag fail-closed
**Fonte:** `src/lib/feature-flags/feature-flag-service.ts:157-159`
**Aplicar a:** `problem-report` e `approve`
`isCampaignApprovalEnabled()` → falha/not-found = `false` (comportamento atual preservado).

### JSON estrito + parse defensivo + Zod
**Fonte:** `src/lib/copy/copy-director-service.ts:14-22` + `input-validation-service.ts:256-269`
**Aplicar a:** `correction-intent-service.ts`
System prompt pede JSON estrito; `JSON.parse` com limpeza de fences; `Schema.parse` (`.strict()`); falha → fallback (`unclear`).

### Página admin server-side
**Fonte:** `src/app/(app)/admin/access-requests/page.tsx:35-72, 175-191`
**Aplicar a:** `admin/campaign-reports/page.tsx` e `[reportId]/page.tsx`
`requireAdmin` (try/catch → bloco de acesso negado), `supabaseAdmin` direto (sem chamar a própria API), filtros/paginação via `searchParams` + `<Link>`, `export const dynamic = "force-dynamic"`.

### Signed URL service_role
**Fonte:** `src/lib/campaign/display.ts:63-78`
**Aplicar a:** detalhe admin (v1 `superseded` + v2)
`supabaseAdmin.storage.from("campaign-images").createSignedUrl(path, 3600)`.

---

## No Analog Found

Arquivos/trechos sem analog direto (usar RESEARCH.md/design.md como base):

| Trecho | Role | Data Flow | Razão |
|--------|------|-----------|-------|
| Helper `storagePath → data URL` (imagens F41 na v2) | utility | file-I/O | Não existe helper pronto. O único analog é download de storage (`brand-profile/realign/route.ts:415-425`, `download/route.ts:44-47`) — a conversão em data URL deve ser criada em `correction-reports.ts`. |
| Recuperação preguiçosa com reload de estado (`recover` + nova leitura) | orchestration | request-response | Não há padrão de "re-derivar após nova leitura" no repositório; implementar conforme design D4/revisão 6 achado 1. |
| Testes RPC-por-fonte das novas RPCs | test | — | O padrão existe (`src/__tests__/api/campaign-approve-route.test.ts:97-112` — `readFileSync` da migration + `expect(sql).toContain(...)`), mas os testes das RPCs novas serão escritos por tarefa (tasks §13/§14/§15). |

---

## Metadata

**Analog search scope:** `src/lib/campaign`, `src/lib/copy`, `src/lib/image-generation`, `src/lib/text-provider`, `src/lib/visual-signature`, `src/lib/ai-cost`, `src/lib/feature-flags`, `src/app/api/campaign`, `src/app/api/admin`, `src/app/(app)/admin`, `src/app/(app)/campanhas`, `src/components/campaign`, `src/components/changelog`, `supabase/migrations`.
**Files scanned:** ~35 (20 lidos integralmente + greps direcionados).
**Pattern extraction date:** 2026-09-10
**Padded phase output:** `.planning/phases/37.2-correcao-unica-por-nao-conformidade/37-2-PATTERNS.md`
