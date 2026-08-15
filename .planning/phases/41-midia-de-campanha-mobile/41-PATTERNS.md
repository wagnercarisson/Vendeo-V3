# Phase 41: Mídia de Campanha Mobile — Pattern Map

**Mapped:** 2026-08-14
**Files analyzed:** 22 (0 new files, 13 modified code/prompt, 1 modified type/config cluster, 8 test co-migrations)
**Analogs found:** 22 / 22 (12 self-analog exact, 10 self-analog + shared-pattern composition)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/campaign/persistence.ts` (MOD — novos helpers `uploadCampaignInputImage`/`removeCampaignInputs` + `campaignId?` param) | persistence/service | file-I/O (storage upload/list/remove) | self — `uploadCampaignImage` (`:60-84`) + `deleteCampaignImage` (`:143-154`) + `dataUrlToCampaignImage` (`:35-58`); transcode via `src/lib/campaign/image-processor.ts` `transcodeToJpeg` (`:14-30`) | exact |
| `src/lib/image-generation/config.ts` (MOD — `MAX_CAMPAIGN_IMAGES` + teto agregado) | config/constant | static | self — `MAX_PRODUCT_IMAGE_BASE64_SIZE`/`MAX_PRODUCT_IMAGE_FILE_SIZE` (`:27-28`) | exact |
| `src/lib/image-generation/schema.ts` (MOD — `ProductImageInputSchema` + `productImages` + `productImageDataUrl` → optional) | config/schema (validation) | request-response (transporte) | self (`GenerateImageRequestSchema` `:8-37`) + `brief-schema.ts` `mediaSchema` (`:60-86`, superRefine exactly-1-primary) | exact |
| `src/lib/campaign/brief.ts` (MOD — `storagePath?`, mapper multi, snapshot copia `storagePath`, `mimeTypeFromDataUrl`) | model/mapper | transform (flat → domínio → snapshot) | self — mapper single `:161-171`, snapshot builder `:216-235`, `CampaignProductImageInput` `:29-35` | exact |
| `src/lib/campaign/types.ts` (MOD — `CreateCampaignInput` + `campaignId?`/`storagePaths?`) | model | static | self — `CreateCampaignInput` `:26-34` (precedente F38.1 `operationRunId?` opcional) | exact |
| `src/lib/image-generation/providers/types.ts` (MOD — `productImagesDataUrls?: string[]`) | provider type | static | self — `ImageProviderInput` `:6-14` | exact |
| `src/lib/image-generation/providers/openai.ts` (MOD — N `input_image`; fallback gated) | provider | request-response | self — mainline `:63-77` (1 `input_image` `:71-73`), fallback gate `:58-61`, `fallbackToImageApi` `:225-307` (TODO `:282-287`) | exact |
| `src/lib/image-generation/services/image-generation-service.ts` (MOD — ponte `mediaImagesDataUrls`) | service | transform | self — `primaryImageDataUrl` `:983-985`, `generateWithRetry` `:1041-1048`, validação primary `:173-183`, reviewInput `:385-406` | exact |
| `src/lib/image-generation/services/image-review-service.ts` (MOD — `review` recebe primary opcional) | service | request-response | self — `review` `:54-63`, `callVisionModel` `:243-268` (chat.completions content array) | exact |
| `src/components/flow/use-campaign-form.ts` (MOD — state multi, HEIC/EXIF, body) | form hook | form state → HTTP body | self — `compressImage` `:12-74`, `CampaignFormFields` `:78-94`, `EMPTY_FIELDS` `:148-164`, `validateImage` `:197-207`, body `:724-738` | exact |
| `src/components/flow/campaign-image-upload.tsx` (MOD — multi + capture + preview grid + remoção) | UI component | form state | self (arquivo inteiro `:6-85`) + `campaign-input-form.tsx` label/error pattern (`:362-367`) | exact |
| `src/components/flow/campaign-input-form.tsx` (MOD — campo primary + seção "Imagens adicionais") | UI component | render → submit | self — uso de `CampaignImageUpload` `:362-367`, seção Descrição `:324-360`, h2 de seção `:369-371` | exact |
| `src/app/api/campaign/generate-image/route.ts` (MOD — exclusividade, teto, campaignId pré-gerado, upload inputs, cleanup) | controller/route | request-response + file-I/O | self — guards `:117-135`, brief build `:243`, validação `:296-316`, createCampaign `:354-377`, cleanup crédito `:395-399`, upload pós-stream `:689-691` | exact |
| `prompts/campaign-image-director.md` (MOD — bloco 1+N) | prompt/config | static template | self — linha única `:49` (texto a substituir) | exact |
| `prompts/campaign-image-director-offer.md` (MOD) | prompt/config | static template | self — linha única `:49` | exact |
| `prompts/campaign-image-director-spotlight.md` (MOD) | prompt/config | static template | self — linha única `:47` | exact |
| `prompts/campaign-image-director-exclusive.md` (MOD) | prompt/config | static template | self — linha única `:46` | exact |
| `src/lib/campaign/__tests__/brief-mapper.test.ts` (MOD) | test | contract unit (mapper multi + invariante) | self — `flatInput` `:12-24`, caso single-image `:87-95` | exact |
| `src/lib/campaign/__tests__/brief-snapshot.test.ts` (MOD) | test | contract unit (snapshot N + storagePath + leak) | self — `hasBase64Leak` `:13-33`, `flatInput` `:37-46`, shape assertion `:49-60` | exact |
| `src/lib/image-generation/services/__tests__/image-generation-service.test.ts` (MOD) | test | co-migration (golden 38 keys + lista N) | self — `createMinimalBrief` `:17-32`, `EXPECTED_KEYS` `:516-527`, golden `:539-606` | exact |
| `src/lib/image-generation/providers/__tests__/openai-provider.test.ts` (MOD) | test | co-migration (N input_image + fallback gated) | self — `vi.mock("openai")` `:5-19`, fallback test `:33-48` | exact |
| `src/lib/image-generation/services/__tests__/image-review-service.test.ts` (MOD) | test | co-migration (review com primary) | self — review input `:35-52`, Teste 4 usage `:334-348` | exact |
| `src/app/api/campaign/generate-image/__tests__/route.test.ts` (MOD) | test | co-migration (fixtures `productImages`, 400/413, storage, teste 27) | self — `VALID_REQUEST_BODY` `:188-194`, `makeRequest` `:196-202`, `setupSuccessMocks` `:204-259`, "rejects missing productImageDataUrl" `:316-327` | exact |
| `src/components/flow/__tests__/use-campaign-form-navigation.test.ts` (MOD) | test | co-migration (state multi no `EMPTY_FIELDS`/restore) | self — restore mock `:61-77`, `:106-114`, `:152-160`, `:187-195`, `:209-217` | exact |
| `src/app/(app)/campanhas/nova/__tests__/campaign-flow-credits.test.tsx` (MOD) | test | co-migration (mock do upload multi) | self — mock `CampaignImageUpload: () => null` `:94-96`; mock `useCampaignForm` `:28-66` | exact |
| `src/__tests__/concurrency.test.ts` (MOD) | test | co-migration (mock persistence + 2 helpers novos — D5 ambos os fluxos) | self — `vi.mock("@/lib/campaign/persistence")` `:25-32` sem `uploadCampaignInputImage`/`removeCampaignInputs` | exact |
| `src/__tests__/regression-master-switch.test.ts` (MOD) | test | co-migration (mock persistence + 2 helpers novos) | self — `vi.mock("@/lib/campaign/persistence")` `:25-32` sem os helpers | exact |
| `src/__tests__/api/campaign-generate.test.ts` (MOD) | test | co-migration (mock persistence + 2 helpers novos) | self — `vi.mock("@/lib/campaign/persistence")` `:76-83` sem os helpers | exact |

> **Nota de path 1:** o `campaign-flow-credits.test.tsx` **não** está em `src/components/flow/__tests__/` — está em `src/app/(app)/campanhas/nova/__tests__/campaign-flow-credits.test.tsx` (mesmo path real da F40, CONTEXT `:180` abrevia).
>
> **Nota de path 2 (co-migração adicional):** além do `use-campaign-form-navigation.test.ts`, **três outros testes mockam `CampaignFormFields` completo com `imageFile: null` e quebram quando `imageFile` virar array** (não citados no CONTEXT `:180`, mas verificados no código):
> - `src/components/flow/__tests__/use-campaign-form-notice.test.ts` — restore mocks `:61-69`, `:156-163`, `:176-183`
> - `src/components/flow/__tests__/use-campaign-form-validity.test.ts` — restore mock `:115-123`
> - `src/components/flow/__tests__/use-campaign-form-submit-error.test.ts` — usa `VALID_DATA_URL`/`sessionStorage` (verificar `imageFile` ao trocar o campo)
> - `src/components/flow/__tests__/intent-badge-preserve.test.ts` — mocka `useInputPreservation` mas retorna `null` (`:27`); afetado só se o tipo `CampaignFormFields` quebrar a compilação
>
> **Nota de path 3:** `image-generation-service.ts` tem 1207 linhas e `route.ts` 835 — as linhas citadas são os ranges exatos lidos; o planner deve editar por seção, não reler o arquivo inteiro.

---

## Pattern Assignments

### `src/lib/campaign/persistence.ts` (MOD — `uploadCampaignInputImage` + `removeCampaignInputs` + `campaignId?`)

**Analog:** self — `uploadCampaignImage` (`:60-84`) para o upload com `contentType`/`upsert:false`; `deleteCampaignImage` (`:143-154`) para remoção por path; `dataUrlToCampaignImage` (`:35-58`) para parse de dataUrl. Transcode via `transcodeToJpeg` (`src/lib/campaign/image-processor.ts:14-30`).

**WHY — the pattern being replicated:** O bucket `campaign-images` é privado com policies service_role insert/delete + owner select por prefixo `storeId` (D5). O upload de inputs usa **exatamente** o mesmo esqueleto do `uploadCampaignImage` — mesma chamada `.storage.from("campaign-images").upload(...)` — mudando apenas o path (`{storeId}/{campaignId}/inputs/{imageId}.jpg`) e a fonte do buffer (transcode de `sharp`, não parse direto). A limpeza pré-stream (D5) é o espelho do `deleteCampaignImage`, mas com **list + remove por prefixo**.

**Upload pattern — copiar de `uploadCampaignImage` (`:60-84`):**
```typescript
export async function uploadCampaignImage(
  storeId: string,
  campaignId: string,
  image: { buffer: Buffer; mimeType: "image/jpeg" }
): Promise<{ storagePath: string }> {
  if (image.mimeType !== "image/jpeg") {
    throw new Error("Only JPEG images are supported for upload. Expected mimeType: 'image/jpeg'");
  }
  const storagePath = `${storeId}/${campaignId}.jpg`;
  const { error } = await supabaseAdmin
    .storage
    .from("campaign-images")
    .upload(storagePath, image.buffer, {
      contentType: "image/jpeg",
      upsert: false,
    });
  if (error) { throw new Error(error.message); }
  return { storagePath };
}
```

**Transcode pattern — copiar de `transcodeToJpeg` (`image-processor.ts:14-30`):**
```typescript
export async function transcodeToJpeg(
  buffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; mimeType: "image/jpeg" }> {
  if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
    throw new Error(`Unsupported image format: ${mimeType}. Expected PNG, JPEG, or WEBP.`);
  }
  const jpegBuffer = await sharp(buffer)
    .resize(1080, 1080, { fit: "contain", background: "#FFFFFF" })
    .jpeg({ quality: 90 })
    .toBuffer();
  return { buffer: jpegBuffer, mimeType: "image/jpeg" };
}
```

**Removal pattern — copiar de `deleteCampaignImage` (`:143-154`):**
```typescript
export async function deleteCampaignImage(storagePath: string): Promise<void> {
  const { error } = await supabaseAdmin
    .storage
    .from("campaign-images")
    .remove([storagePath]);
  if (error) { throw new Error(error.message); }
}
```

**Expected F41 content (tasks 6.1-6.3):**
1. `createCampaign(storeId, input, campaignId?: string)` — `const campaignId = campaignIdPreGerado ?? crypto.randomUUID();` (`:9` hoje gera interno; o parâmetro opcional mantém regressão).
2. `uploadCampaignInputImage(storeId, campaignId, imageId, { buffer, mimeType })` — `const storagePath = \`${storeId}/${campaignId}/inputs/${imageId}.jpg\`;` → `const jpegImage = await transcodeToJpeg(buffer, mimeType);` → upload com `contentType: "image/jpeg"`, `upsert: false`. O `SUPPORTED_MIME_TYPES` do image-processor (`:4`, png/jpeg/webp) define o que passa no transcode.
3. `removeCampaignInputs(storeId, campaignId)` — `supabaseAdmin.storage.from("campaign-images").list(prefix, { limit: 100 })` → `.remove(paths)`; **no-op** quando lista vazia (sem throw). Retorna `void` ou `{ removed: number }` — siga o estilo de retorno dos helpers existentes (`deleteCampaignImage` retorna `void`).

**Data flow:** request-response (rota) → buffer (transcode) → storage (upload imutável) → path devolvido à rota para preencher `storagePath` do runtime antes do snapshot (D5). List/remove = compensação pré-stream.

---

### `src/lib/image-generation/config.ts` (MOD — `MAX_CAMPAIGN_IMAGES` + teto agregado)

**Analog:** self — bloco `// ─── Payload Size Limits ───` (`:26-28`).

**WHY — the pattern being replicated:** Constantes de limite são `export const` puros sem `server-only` (importadas por schema.ts, route.ts, form, testes). A F41 adiciona o teto **por número de imagens** e o **teto agregado de bytes** no mesmo bloco.

**Pattern to copy (`:26-28`):**
```typescript
// ─── Payload Size Limits ──────────────────────────────────────────────────
export const MAX_PRODUCT_IMAGE_BASE64_SIZE = 4 * 1024 * 1024;
export const MAX_PRODUCT_IMAGE_FILE_SIZE = 1 * 1024 * 1024;
```

**Expected F41 content (tasks 2.1-2.2):**
```typescript
export const MAX_CAMPAIGN_IMAGES = 4; // 1 primary + 3 auxiliares (D3/D10)
export const MAX_PRODUCT_IMAGES_AGGREGATE_BASE64_SIZE = 8 * 1024 * 1024; // teto agregado do productImages[] (D10)
```
- Fonte única do teto (task 2.3): `schema.ts`, `route.ts`, `use-campaign-form.ts` e testes importam de cá — nunca literal `4` espalhado.
- O agregado (8MB = 4 × 4MB nominal, ou valor definido no design) deve ser decidido pelo planner; o CONTEXT só exige "constante de teto agregado".

**Data flow:** static.

---

### `src/lib/image-generation/schema.ts` (MOD — `ProductImageInputSchema` + `productImages` + legado optional)

**Analog:** self — `GenerateImageRequestSchema` (`:8-37`) com `.strict()` em `:37`; domínio `brief-schema.ts` `mediaSchema` (`:60-86`) para o padrão `superRefine` de exactly-1-primary.

**WHY — the pattern being replicated:** O transporte é `z.object({...}).strict()` — o campo novo é **aditivo** (payload antigo passa). O invariante exactly-1-primary **já existe no zod do domínio** (`brief-schema.ts:75-83`); o F41 replica o mesmo `superRefine` no transporte (D2) para rejeitar `productImages` inválido antes do mapper.

**Zod schema pattern — copiar de `brief-schema.ts:60-86` (superRefine exactly-1-primary):**
```typescript
const imageSchema = z
  .object({
    id: z.string().uuid(),
    role: CampaignImageRoleEnum,   // z.enum(["primary", "variation", "combo_item", "reference"])
    source: CampaignImageSourceEnum, // z.enum(["upload", "camera"])
    mimeType: z.string(),
    dataUrl: z.string().optional(),
  })
  .strict();

export const mediaSchema = z
  .object({
    images: z
      .array(imageSchema)
      .min(1, "Imagem do produto é obrigatória")
      .superRefine((images, ctx) => {
        const primaryCount = images.filter((i) => i.role === "primary").length;
        if (primaryCount !== 1) {
          ctx.addIssue({
            code: "custom",
            path: ["images"],
            message: `Deve existir exatamente 1 imagem com role "primary" (recebido: ${primaryCount})`,
          });
        }
      }),
  })
  .strict();
```

**Expected F41 content (tasks 3.1-3.4):**
```typescript
export const ProductImageInputSchema = z.object({
  role: z.enum(["primary", "variation", "combo_item", "reference"]),
  source: z.enum(["upload", "camera"]),
  mimeType: z.string(),
  dataUrl: z.string().min(1),   // base64; snapshot NUNCA persiste
}).strict();                    // sem `id` — rota gera (D2/D5)

// dentro de GenerateImageRequestSchema:
productImageDataUrl: z.string().min(1).optional(),   // ← era required (`:30`)
productImages: z
  .array(ProductImageInputSchema)
  .min(1)
  .max(MAX_CAMPAIGN_IMAGES)
  .superRefine(exactly-1-primary como em mediaSchema)
  .optional(),
// `.strict()` preservado (`:37`)
```

**Pitfall D2:** a obrigatoriedade deixa de ser do Zod (testes antigos que esperavam `zod error` por ausência de `productImageDataUrl` são co-migrados para o **400 da rota** — teste 27, task 14.11; o teste existente `route.test.ts:316-327` já espera 400, mas agora o 400 vem da regra de exclusividade da rota, não do schema).

**Data flow:** request-response (validação de transporte, fronteira da rota).

---

### `src/lib/campaign/brief.ts` (MOD — `storagePath?`, mapper multi, snapshot, `mimeTypeFromDataUrl`)

**Analog:** self — o arquivo inteiro já é o contrato de domínio F39.

**WHY — the pattern being replicated:** O domínio já é multi-imagem-ready. O F41: (1) adiciona `storagePath?: string` ao runtime `CampaignProductImageInput` (`:29-35`); (2) troca o hardcode single do mapper (`:161-171`) por mapeamento item-a-item; (3) faz o snapshot copiar `storagePath` quando presente (`:216-235`); (4) adiciona helper puro `mimeTypeFromDataUrl` (corrige o quirk `"image/jpeg"` fixo).

**Runtime type to change (`:29-35`):**
```typescript
export interface CampaignProductImageInput {
  id: string; // uuid gerado na montagem do brief
  role: CampaignImageRole;
  source: CampaignImageSource;
  mimeType: string;
  dataUrl?: string; // APENAS no transporte, nunca no snapshot
  storagePath?: string; // NOVO (D5) — preenchido pela ROTA após upload, antes do snapshot
}
```
(`CampaignBriefSnapshotImage` `:39-47` já reserva `storagePath?` — shape do snapshot **inalterado**, task 5.2.)

**Mapper single-image — o trecho a substituir (`:161-171`):**
```typescript
const images: CampaignProductImageInput[] = input.productImageDataUrl
  ? [
      {
        id: crypto.randomUUID(),
        role: "primary",
        source: "upload",
        mimeType: "image/jpeg",   // ← quirk F39: fixo mesmo para PNG (D2/D3 corrige)
        dataUrl: input.productImageDataUrl,
      },
    ]
  : [];
```

**Expected F41 content (tasks 4.1-4.4):**
```typescript
// helper puro (task 4.3) — mesmo nível dos outros helpers do módulo:
export function mimeTypeFromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:(image\/(png|jpeg|webp));base64,/);
  return match?.[1] ?? "image/jpeg";
}

// mapper (tasks 4.1-4.2): item-a-item + legado = 1 elemento (zero bifurcação)
const productImages = input.productImages ?? (
  input.productImageDataUrl
    ? [{ role: "primary" as const, source: "upload" as const, mimeType: mimeTypeFromDataUrl(input.productImageDataUrl), dataUrl: input.productImageDataUrl }]
    : []
);
const images: CampaignProductImageInput[] = productImages.map((img) => ({
  id: crypto.randomUUID(),               // rota/domínio gera id (D2)
  role: img.role,                        // espelha o transporte (D3 — auxiliares já vêm como "reference")
  source: img.source,                    // upload | camera do transporte (D4)
  mimeType: img.mimeType || mimeTypeFromDataUrl(img.dataUrl),
  dataUrl: img.dataUrl,
  // storagePath é undefined aqui — a rota preenche APÓS o upload (D5) e ANTES do snapshot
}));
```

**Snapshot builder (`:216-235`) — adicionar `storagePath` no map (task 5.1):**
```typescript
images: brief.media.images.map((i) => ({
  id: i.id,
  role: i.role,
  source: i.source,
  provided: true as const,
  mimeType: i.mimeType,
  ...(i.storagePath ? { storagePath: i.storagePath } : {}),   // NOVO (D5)
})),
```

**Pitfall D5:** a rota preenche `storagePath` **sem cast/objeto paralelo** — o mesmo objeto `CampaignProductImageInput[]` do brief recebe o campo após o upload e antes de `buildCampaignBriefSnapshot` (task 5.3). Nenhuma bifurcação de tipo.

**Data flow:** transform — transporte flat (request) → domínio runtime (com dataUrl em memória) → snapshot persistido (sem base64, com storagePath).

---

### `src/lib/campaign/types.ts` (MOD — `CreateCampaignInput` + `campaignId?`/`storagePaths?`)

**Analog:** self — `CreateCampaignInput` (`:26-34`), com o precedente de campo opcional `operationRunId?` da F38.1.

**WHY — the pattern being replicated:** A F38.1 já mostrou o padrão "campo opcional aditivo em `CreateCampaignInput` sem quebrar a regressão" (`operationRunId?`). O F41 (D5) adiciona `campaignId?` e `storagePaths?` no mesmo estilo — ausentes → comportamento atual.

**Pattern to copy (`:26-34`):**
```typescript
export interface CreateCampaignInput {
  productName: string;
  inputSnapshot: Record<string, unknown>;
  identitySnapshot?: Record<string, unknown>;
  /** F38.1 (D1/D2): operation_run_id do run (campaign_delivery) — persistido na
   * criação da campanha (campaigns.operation_run_id), preparando o reuso cross-request
   * pela F37. Requests independentes nesta fase ainda criam novo run. */
  operationRunId?: string;
}
```

**Expected F41 content (task 6.4):** adicionar `campaignId?: string;` (id pré-gerado pela rota) e `storagePaths?: string[];` (paths dos inputs já enviados, para auditoria/cleanup). Ambos opcionais.

**Data flow:** static (tipos).

---

### `src/lib/image-generation/providers/types.ts` (MOD — `productImagesDataUrls?: string[]`)

**Analog:** self — `ImageProviderInput` (`:6-14`).

**WHY — the pattern being replicated:** O input do provider é uma interface plana de campos opcionais. O F41 (D7) adiciona a lista ordenada `productImagesDataUrls` (posição 0 = primary) **mantendo** `productImageDataUrl?` para o caminho legado — os dois convivem, o provider decide pelo gate (D7).

**Pattern to copy (`:6-14`):**
```typescript
export interface ImageProviderInput {
  prompt: string;
  productImageDataUrl?: string;
  identityImageUrl?: string;
  size?: "1024x1024" | "2048x2048";
  quality?: "low" | "medium" | "high" | "auto";
  signal?: AbortSignal;
  attempt?: number;
}
```

**Expected F41 content (task 8.1):** adicionar `productImagesDataUrls?: string[];` com doc-comment "lista ordenada; posição 0 = primary (D7)". Nada mais muda — `ImageProviderOutput` (`:35-42`) e `ImageProvider` (`:54-62`) intocados.

**Data flow:** static.

---

### `src/lib/image-generation/providers/openai.ts` (MOD — N `input_image` + fallback gated)

**Analog:** self — mainline content array (`:63-77`), fallback gate (`:58-61`), `fallbackToImageApi` (`:225-307`).

**WHY — the pattern being replicated:** O mainline monta um `content` array tipado com `input_text` + `input_image` blocks. O F41 (D7) troca o push único (`:71-73`) por um loop sobre `productImagesDataUrls`. O fallback `images.edit` aceita **1 base image** (limitação documentada em `:282-287`) — vira gate de negócio: SÓ com primary única.

**Mainline single-image — o trecho a expandir (`:63-77`):**
```typescript
const content: (
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail: "auto" | "low" | "high" | "original" }
)[] = [
  { type: "input_text", text: input.prompt },
];

if (input.productImageDataUrl) {
  content.push({ type: "input_image" as const, image_url: input.productImageDataUrl, detail: "auto" as const });
}

if (input.identityImageUrl) {
  content.push({ type: "input_image" as const, image_url: input.identityImageUrl, detail: "low" as const });
}
```

**Expected F41 content (tasks 8.2-8.3):**
```typescript
// mainline: N input_image (primary + auxiliares), posição 0 = primary (D7)
const productImages = input.productImagesDataUrls ?? (input.productImageDataUrl ? [input.productImageDataUrl] : []);
for (const url of productImages) {
  content.push({ type: "input_image" as const, image_url: url, detail: "auto" as const });
}
// identityImageUrl continua detail: "low" (inalterado)

// fallback gate (`:58-61` e `:177-184` pós-erro): SÓ com primary única — helper compartilhado
private isSinglePrimary(input: ImageProviderInput): boolean {
  return input.productImagesDataUrls ? input.productImagesDataUrls.length === 1 : Boolean(input.productImageDataUrl);
}
// gate 1 (pre-response): if (attempt >= 1 && this.isSinglePrimary(input)) → fallback
// gate 2 (post-error):   if (this.isSinglePrimary(input) && this.isResponsesApiError(err)) → fallback
// com auxiliares → retries no Responses; Responses indisponível → erro explícito (sem descartar imagens)
```
`fallbackToImageApi` (`:225-307`) recebe **ajuste mínimo**: o fallback usa apenas `input.productImageDataUrl` (`:232`, `:288-294`), mas `isSinglePrimary` permite fallback com `productImagesDataUrls.length === 1`. Resolver a primary dentro do fallback: `const productImageDataUrl = input.productImageDataUrl ?? input.productImagesDataUrls?.[0];` e usar esse valor no `dataUrlMatch` — legado E novo single-image caem no fallback sem "Invalid productImageDataUrl". A limitação de 1 base image (`:282-287`) permanece.

**Data flow:** request-response — lista de dataUrls → blocks multimodais → Responses API.

---

### `src/lib/image-generation/services/image-generation-service.ts` (MOD — ponte `mediaImagesDataUrls`)

**Analog:** self — `primaryImageDataUrl` (`:983-985`), `generateWithRetry` (`:1041-1048`), validação primary (`:173-183`), reviewInput (`:385-406`).

**WHY — the pattern being replicated:** A ponte atual lê `brief.media.images.find(role === "primary")?.dataUrl`. O F41 (D7) generaliza para `mediaImagesDataUrls(brief)` retornando a **lista ordenada** (posição 0 = primary) e monta o `ImageProviderInput` com a lista (ou legado para 1 imagem).

**Bridge atual (`:983-985`):**
```typescript
// Ponte explícita media.primary.dataUrl → provider/input-validation (F39-16).
// Base64 apenas em memória/transporte — o snapshot nunca o expõe (D6/D7).
private primaryImageDataUrl(brief: CampaignBrief): string | undefined {
  return brief.media.images.find((i) => i.role === "primary")?.dataUrl;
}
```

**Expected F41 content (tasks 9.1-9.2):**
```typescript
private mediaImagesDataUrls(brief: CampaignBrief): string[] {
  return brief.media.images
    .map((img) => ({ img, order: img.role === "primary" ? 0 : 1 }))
    .sort((a, b) => a.order - b.order)
    .map(({ img }) => img.dataUrl)
    .filter((url): url is string => Boolean(url));
}
// `primaryImageDataUrl` pode ser mantido como alias `mediaImagesDataUrls(brief)[0]`
// ou substituído nos 4 call sites (`:177`, `:352`, `:435`, `:483`) — manter o alias
// mínimo evita tocar validação primary-only (D8) e review (D9) no mesmo diff.

// generateWithRetry (`:1041-1048`): montar ImageProviderInput com lista
await this.imageProvider.generateImage({
  prompt: promptText,
  productImagesDataUrls: mediaImagesDataUrls(brief),   // lista ordenada (posição 0 = primary)
  productImageDataUrl,                                  // legado — mantido para 1 imagem (D7)
  identityImageUrl,
  size: IMAGE_GENERATION_SIZE,
  signal,
  attempt,
});
```
**Pitfall D8:** a chamada de validação (`:173-177`) continua `this.primaryImageDataUrl(brief) ?? ""` — primary-only, inalterada. **Pitfall D7/telemetria:** `hadProductImage: !!this.primaryImageDataUrl(brief)` (`:435`, `:483`) continua boolean — não muda.

**Data flow:** transform — domínio `media.images[]` → lista de dataUrls → `ImageProviderInput`.

---

### `src/lib/image-generation/services/image-review-service.ts` (MOD — `review` com primary opcional)

**Analog:** self — `ImageReviewInput` (`:9-25`), `review` (`:54-63`), `callVisionModel` (`:243-268`).

**WHY — the pattern being replicated:** O `callVisionModel` já aceita **uma** imagem (`imageDataUrl`) no content array do `chat.completions`. O F41 (D9) passa a primary **também** como referência de fidelidade — a assinatura de `review` ganha um parâmetro opcional (ou campo no `ImageReviewInput`) e o content array ganha um segundo `image_url` + linha fixa de instrução. Retrocompatível.

**Review atual (`:54-63`) + callVisionModel (`:252-264`):**
```typescript
async review(
  generatedImageDataUrl: string,
  input: ImageReviewInput,
  onCall?: (info: AiCallInfo) => void | Promise<void>
): Promise<ImageReviewResult> {
  const contextVars = this.buildReviewPromptVariables(input);
  const prompt = this.promptLoader.load("campaign-image-reviewer", contextVars);
  // ...
  const { content, usage } = await this.callVisionModel(prompt, generatedImageDataUrl);
  // ...
}

// callVisionModel content:
content: [
  { type: "text", text: prompt },
  {
    type: "image_url",
    image_url: { url: imageDataUrl, detail: "high" },
  },
],
```

**Expected F41 content (task 9.4):** `review(generatedImageDataUrl, input, primaryImageDataUrl?, onCall?)` — quando `primaryImageDataUrl` presente: prompt ganha linha fixa "Compare o produto da arte com a imagem de referência" e content array ganha `{ type: "image_url", image_url: { url: primaryImageDataUrl, detail: "high" } }`. Sem primary → comportamento atual (nenhum teste existente quebra — todos os `service.review('data:image/...', input)` sem 3º/4º arg continuam válidos, ver `image-review-service.test.ts:44`).

**Data flow:** request-response — arte gerada + primary (referência) → vision review.

---

### `src/components/flow/use-campaign-form.ts` (MOD — state multi, HEIC/EXIF, body)

**Analog:** self — `compressImage` (`:12-74`), `CampaignFormFields` (`:78-94`), `EMPTY_FIELDS` (`:148-164`), `validateImage` (`:197-207`), body (`:724-738`), preview effect (`:421-456`).

**WHY — the pattern being replicated:** O hook é a fonte do estado do form. O F41 (D3/D4) troca `imageFile: File | null` por `productImages: Array<{...}>` (primeiro = primary, demais = reference; `id` interno da UI), generaliza `compressImage` para per-item com decode HEIC via canvas + EXIF (`createImageBitmap from-image`), aceita HEIC no `validateImage`, e muda **apenas a montagem do body** (D2): com auxiliares → `productImages[]`; sem → `productImageDataUrl` legado.

**Field type — a mudança central (`:86` + `:78-94`):**
```typescript
export interface CampaignFormFields {
  // ...
  imageFile: File | null;   // ← substituir por:
  productImages: Array<{
    id: string;                  // id INTERNO da UI (uuid) — NUNCA no body (D2/D5)
    role: "primary" | "reference"; // primeiro = primary, demais = reference (D3)
    source: "upload" | "camera";   // conforme a origem real (D4)
    mimeType: string;
    file?: File;
    dataUrl?: string;
  }>;
  // ...
}
```

**`EMPTY_FIELDS` (`:148-164`) — novo default:**
```typescript
productImages: [],   // ← vazio; validação exige primary no submit (sem novo required — D3)
```

**Compress pattern — copiar `compressImage` (`:12-74`) e estender (tasks 11.2):**
- Manter o loop de qualidade/retry JPEG ≤1MB + downscale 1200px (canvas `:21-66`).
- Antes do `img.src` (`:72`): para `image/heic`/`image/heif`, decodificar via `createImageBitmap(file, { imageOrientation: "from-image" })` → `drawImage(bitmap, ...)` (EXIF respeitado, D4) — os browsers que decodificam HEIC para `drawImage` convertem para JPEG no `toBlob`.
- Falha de decode → `reject(new Error("Não foi possível processar a imagem HEIC. Use JPG ou PNG."))` (mensagem PT-BR clara, task 11.3).
- `compressImage` passa a aceitar um item do array (por item) — assinatura `compressImage(file: File, maxSizeBytes?)` mantida, chamada por item.

**`validateImage` (`:197-207`) — aceitar HEIC:**
```typescript
function validateImage(file: File | null): string | null {
  if (!file) return "Imagem do produto é obrigatória";
  const validTypes = ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"];  // +HEIC (D4)
  if (!validTypes.includes(file.type)) {
    return "Formato não suportado. Use PNG, JPG ou WEBP";
  }
  if (file.size > 5 * 1024 * 1024) {
    return "Arquivo muito grande. Máximo 5MB";
  }
  return null;
}
```

**Body assembly — o ponto ÚNICO de mudança (D2, `:724-738`):**
```typescript
// SUBSTITUI `productImageDataUrl: imageDataUrl` (`:737`) por:
const auxiliaries = frozenFields.productImages.slice(1);
if (auxiliaries.length > 0) {
  body.productImages = frozenFields.productImages.map(({ role, source, mimeType, dataUrl }) => ({
    role, source, mimeType, dataUrl,   // SEM id de cliente (D2/D5)
  }));
} else {
  body.productImageDataUrl = <dataUrl da primary>;   // legado (D2)
}
// nunca ambos — a regra de exclusividade da rota 400 se ambos chegarem (D2)
```

**Pitfall preview effect (`:421-456`):** o effect de `URL.createObjectURL` é single-file (`fields.imageFile` `:422`). Para N imagens: ou mantém `imagePreviewUrl` para a primary e a UI gera previews locais por item (via `URL.createObjectURL(item.file)` no componente), ou o array carrega `dataUrl`/objectURL por item. Decisão de UI do planner — o padrão de revoke (`URL.revokeObjectURL` `:427-429`) deve ser replicado por item para evitar leak.

**Restore/autosave (D3, task 11.5):** `useInputPreservation` serializa `CampaignFormFields` inteiro — `productImages` (com `dataUrl` dos itens comprimidos) persiste automaticamente. **Pitfall:** `File` não serializa — o restore deve reconstruir `file: undefined` e usar `dataUrl` (o mesmo `imageFile: null` no restore de hoje, `:334`). A migração de draft legado (`:328`, `const { imageFile: _, ...rest } = legacy`) deve converter `imageFile` → `productImages` de 1 elemento quando o draft antigo tiver o campo.

**Data flow:** form state → HTTP body (via `consumeStream` `:440-557`, inalterado) → `GenerateImageRequestSchema`.

---

### `src/components/flow/campaign-image-upload.tsx` (MOD — multi + capture + preview grid + remoção)

**Analog:** self (arquivo inteiro, `:6-85`) + padrão de label/erro do design system em `campaign-input-form.tsx:362-367`.

**WHY — the pattern being replicated:** O componente é um campo controlado `{ value, onChange }` com label uppercase tracking-wider, dropzone com preview e remoção. O F41 (D4/D10) cresce para multi-arquivo: `capture="environment"` (câmera traseira no mobile), preview grid, remoção por item, origem `source` por item e teto no cliente.

**Skeleton atual (`:6-18`) — props mudam para array:**
```typescript
interface CampaignImageUploadProps {
  imageFile: File | null;   // ← substituir por:
  productImages: Array<{ id: string; role: "primary" | "reference"; source: "upload" | "camera"; file?: File; dataUrl?: string }>;
  error: string | null;
  previewUrl: string | null;   // ← preview grid por item (ou manter preview da primary + grid)
  onSelect: (file: File | null) => void;   // ← onAdd(file, source) + onRemove(id)
}
```

**Input file pattern — adicionar `capture` e `multiple` (`:66-75`):**
```tsx
<input
  ref={inputRef}
  type="file"
  accept=".png,.jpg,.jpeg,.webp,.heic,.heif"
  capture="environment"        // câmera traseira no mobile (D4)
  multiple                    // multi-arquivo (D3)
  className="hidden"
  onChange={(e) => {
    // para cada arquivo: onAdd(file, "upload" | "camera" conforme origem do picker)
    e.target.value = "";
  }}
/>
```
- O preview existente (`:35-52`, img + "Remover imagem") vira **grid**: mapear `productImages` → thumbs + botão remover por item (`URL.createObjectURL(item.file)` ou `item.dataUrl`).
- Teto no cliente (D10): desabilitar o botão/dropzone quando `productImages.length >= MAX_CAMPAIGN_IMAGES` (import da constante de `config.ts`).
- Erros por item (D10): manter o padrão de erro `:77-82` (`AlertCircle` + texto) exibindo o item que falhou.

**Data flow:** form state → hook (`setField("productImages", ...)`).

> **Nota de contrato (decisão 41-07/41-08):** a criação/remoção de itens vive **no hook** (`addImage(file, source)`/`removeImage(id)` exportados no retorno do `useCampaignForm`) — o form apenas repassa `onAdd={addImage}`/`onRemove={removeImage}`. `removeImage` **promove a próxima imagem a `primary`** quando a primary é removida (D3). O form NÃO usa `setField("productImages", ...)` inline (regra-mãe de co-migração — duplicar a regra perderia a promoção e o teto `MAX_CAMPAIGN_IMAGES`).

---

### `src/components/flow/campaign-input-form.tsx` (MOD — primary + seção "Imagens adicionais")

**Analog:** self — uso atual de `CampaignImageUpload` (`:362-367`), seção Descrição (`:324-360`), h2 de seção (`:369-371`).

**WHY — the pattern being replicated:** O form agrupa por seções com h2 uppercase. O F41 (D3/D4, task 11.7) mantém o campo primary (obrigatório) e adiciona a seção "Imagens adicionais" (opcionais, até `MAX_CAMPAIGN_IMAGES - 1`).

**Uso atual do upload (`:362-367`):**
```tsx
<CampaignImageUpload
  imageFile={fields.imageFile}
  error={touched.imageFile ? fieldErrors.imageFile ?? null : null}
  previewUrl={imagePreviewUrl}
  onSelect={(file) => setField("imageFile", file)}
/>
```

**Expected F41 content (task 11.7):**
```tsx
{/* Campo primary — obrigatório (D3) */}
<CampaignImageUpload
  productImages={fields.productImages}
  error={touched.productImages ? fieldErrors.productImages ?? null : null}
  previewUrl={imagePreviewUrl}   // preview da primary (ou grid completo no componente)
  onAdd={(file, source) => setField("productImages", [...fields.productImages, { id: crypto.randomUUID(), role: fields.productImages.length === 0 ? "primary" : "reference", source, mimeType: file.type, file }])}
  onRemove={(id) => setField("productImages", fields.productImages.filter((i) => i.id !== id))}
/>

{/* Seção "Imagens adicionais" — padrão de h2 igual `:369-371` */}
<h2 className="text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2">
  Imagens adicionais
</h2>
<p className="text-text-muted text-xs font-body mb-3">
  Opcional — até {MAX_CAMPAIGN_IMAGES - 1} imagens de apoio (ângulos, variações, combos). A primeira imagem é a principal.
</p>
```
- O h2/label usa as mesmas classes do form (`:369-371` e `:326-328`).
- Se a seção "Imagens adicionais" precisar de controle próprio, o `CampaignImageUpload` renderiza **duas áreas** (primary + adicionais) ou o form renderiza o componente uma vez por papel — decisão de UI do planner; o padrão de props `{ value, onChange }` + label/erro se mantém.

**Data flow:** render → submit → hook (body assembly).

---

### `src/app/api/campaign/generate-image/route.ts` (MOD — exclusividade, teto, campaignId pré-gerado, upload inputs, cleanup)

**Analog:** self — guards pre-stream (`:117-135`), schema parse (`:138-155`), auth/ownership (`:158-159`), clearance (`:162-178`), readiness (`:181-193`), brief build (`:243`), validação (`:296-316`), createCampaign (`:354-377`), cleanup de crédito (`:395-399`), upload pós-stream (`:689-691`).

**WHY — the pattern being replicated:** A rota já tem a sequência pre-stream de guards (presença `:117-123` → tamanho `:126-135` → schema `:138-155` → auth → clearance → readiness). O F41 (D2/D5/D10) adiciona: regra de exclusividade no lugar da presença single, teto agregado, e a **reordenação D5** — pré-gerar `campaignId`, gerar `id` por imagem, **upload dos inputs ANTES do snapshot**, montar snapshot com `storagePath`, chamar `createCampaign` com id pré-gerado, cleanup pré-stream via `removeCampaignInputs`.

**Guard single-image atual — o trecho a substituir (`:117-135`):**
```typescript
// ── Pre-stream: Validate productImageDataUrl presence ───────────
if (!body.productImageDataUrl || typeof body.productImageDataUrl !== "string") {
  return Response.json(
    { error: { message: "Imagem do produto é obrigatória para gerar a campanha visual." } },
    { status: 400 }
  );
}

// ── Pre-stream: Check payload size limit ────────────────────────
if (body.productImageDataUrl.length > MAX_PRODUCT_IMAGE_BASE64_SIZE) {
  return Response.json(
    {
      error: {
        message: `Imagem do produto excede o limite de ${Math.round(MAX_PRODUCT_IMAGE_BASE64_SIZE / (1024 * 1024))}MB. Comprima a imagem e tente novamente.`,
      },
    },
    { status: 413 }
  );
}
```

**Expected F41 content (tasks 7.1-7.6):**
```typescript
// ── Pre-stream: Regra de exclusividade D2 (tabela canônica) ─────
const hasProductImages = Array.isArray(body.productImages) && body.productImages.length > 0;
const hasLegacyDataUrl = typeof body.productImageDataUrl === "string" && body.productImageDataUrl.length > 0;
if (!hasProductImages && !hasLegacyDataUrl) {
  return Response.json({ error: { message: "Imagem do produto é obrigatória" } }, { status: 400 });  // caso 3
}
if (hasProductImages && hasLegacyDataUrl) {
  return Response.json({ error: { message: "Payload ambíguo: envie productImages[] OU productImageDataUrl, não ambos." } }, { status: 400 });  // caso 4
}

// ── Pre-stream: Limites D10 — por item + teto agregado ──────────
// por item: dataUrl.length <= MAX_PRODUCT_IMAGE_BASE64_SIZE → 413 PT-BR indicando item
// agregado: soma dos dataUrls <= MAX_PRODUCT_IMAGES_AGGREGATE_BASE64_SIZE → 413 PT-BR indicando total
// legado single: limite atual `:126-135` permanece para productImageDataUrl

// ── Ordem D5 (tasks 7.3-7.5) — substitui `:354-377` ─────────────
const campaignIdPre = crypto.randomUUID();                       // (1) pré-gera
const imageIds = productImages.map(() => crypto.randomUUID());   // (2) id por imagem (uuid, rota gera)
// (3) upload ANTES do snapshot:
for (const [idx, img] of productImages.entries()) {
  const { buffer } = dataUrlToCampaignImage(img.dataUrl);        // parse (persistence.ts:35-58)
  await uploadCampaignInputImage(storeId, campaignIdPre, imageIds[idx], await transcodeToJpeg(buffer, img.mimeType));
  img.storagePath = `${storeId}/${campaignIdPre}/inputs/${imageIds[idx]}.jpg`;   // preenche runtime (D5)
}
// (4) snapshot COM storagePath:
const inputSnapshot = buildCampaignBriefSnapshot(brief) as unknown as Record<string, unknown>;
// (5) createCampaign com id pré-gerado:
const campaign = await createCampaign(storeId, { productName, inputSnapshot, identitySnapshot, operationRunId }, campaignIdPre);

// ── Limpeza pré-stream (task 7.4): falha em qualquer passo acima ─
try { await removeCampaignInputs(storeId, campaignIdPre); } catch { /* ignore */ }
// falha pós-stream → deleteCampaignImage(storagePath) atual (`:397`) permanece
```
**Pitfalls:**
- O `inputSnapshot` hoje é montado **antes** de `createCampaign` (`:359`) — a F41 mantém a ordem mas insere os uploads **entre** o mapper (`:243`) e o snapshot; o `brief` precisa dos `storagePath` preenchidos antes de `buildCampaignBriefSnapshot`.
- O `recordCall`/telemetria (`AiCostTracker`) permanece 1 evento `campaign_image` (task 7.6) — os uploads de inputs **não** geram eventos de custo.
- Validação primária-only (`:296-316`): `inputValidation.validate(parsed.data.productName, parsed.data.productImageDataUrl, ...)` — para o fluxo novo, passar o dataUrl da imagem **com `role: "primary"`** via `productImages.find((img) => img.role === "primary")!.dataUrl` (NUNCA posição 0 — o mapper preserva a ordem do transporte, e o zod garante exatamente 1 primary, não a ordem); fluxo de 409 inalterado (D8).
- `createCampaign` retorna `{ id, storagePath }` (`:368`) — com `campaignIdPre` o retorno `id` = `campaignIdPre`.

**Data flow:** request-response + file-I/O — body → guards (400/413) → mapper → upload inputs → snapshot → createCampaign → stream → compensação.

---

### Prompts do diretor (MOD ×4 — linha única → bloco descritivo 1+N, D6)

**Analog:** self — a linha única a substituir existe nos 4 arquivos com número de linha diferente; o padrão de teste de conteúdo de `.md` já existe (`prompt-reframe.test.ts:1-57`).

**Linha única a substituir (idêntica nos 4, muda só a numeração):**
- `prompts/campaign-image-director.md:49` — `7. **Imagem de referência do produto:** A imagem do produto foi enviada como referência visual fiel. O produto {{productName}} deve ser o herói visual da composição.`
- `prompts/campaign-image-director-offer.md:49` — idem
- `prompts/campaign-image-director-spotlight.md:47` — idem
- `prompts/campaign-image-director-exclusive.md:46` — **numeração `6.`** (não `7.`)

**Bloco descritivo 1+N (D6, texto hardcoded — SEM placeholder/variável):**
```
- **Imagens de referência do produto:** Foram enviadas 1 imagem principal (herói visual da composição) e N imagens auxiliares de referência (contexto: ângulos, variações, combos). Use a imagem principal como base fiel do produto {{productName}}. Use as imagens auxiliares apenas como contexto visual — NÃO invente conteúdo, detalhes ou ângulos que não estejam nelas.
```

**Pitfalls:**
- **Sem variável nova** (D6): golden `EXPECTED_KEYS = 38` por intent permanece idêntico — as imagens entram como input multimodal, não como variável textual. O texto do prompt muda intencionalmente.
- A segunda menção ("A imagem do produto é uma referência factual protegida.", director `:111`, offer `:112`, spotlight `:110`, exclusive `:119`) **não muda** (D6) — é a linha de proteção factual, não a descritiva.
- Teste 21 (task 14.5) replica o padrão `prompt-reframe.test.ts` (`readFileSync` dos 4 `.md` + `toContain(bloco)`).

**Data flow:** static; `PromptLoader` (`src/lib/image-generation/prompt-loader.ts`) carrega + resolve `{{vars}}` — inalterado.

---

### Testes — co-migrações (MOD)

**`src/lib/campaign/__tests__/brief-mapper.test.ts`** — Analog: self. O fixture `flatInput` (`:12-24`) ganha casos com `productImages` (tests 1-3, tasks 12.1-12.3) e `mimeType` derivado (teste 5, task 12.5). O caso single atual (`:87-95`, `media.images[0].mimeType === "image/jpeg"`) precisa **continuar passando** para o legado (`data:image/jpeg;base64,abc123` → `mimeTypeFromDataUrl` = `image/jpeg` — regressão preservada). Caso de 2 primaries → transporte rejeita (invariante no schema, teste 3) — o mapper **não** valida (D3: zod do domínio garante).

**`src/lib/campaign/__tests__/brief-snapshot.test.ts`** — Analog: self. O `flatInput` (`:37-46`) + `hasBase64Leak` (`:13-33`) são o molde dos testes 6-8 (tasks 12.6-12.8): snapshot com N imagens **sem dataUrl**, com `storagePath` por imagem (`toContain("storagePath")` quando presente, ausente quando não), e exactly-1-primary. Adicionar o helper de fixture que monta `productImages` com 3 itens + `storagePath` preenchido no runtime antes do snapshot.

**`src/lib/image-generation/services/__tests__/image-generation-service.test.ts`** — Analog: self. `createMinimalBrief` (`:17-32`) e `EXPECTED_KEYS` (`:516-527`) permanecem; o golden (teste 20, task 14.4) é o mesmo `expect(keys).toHaveLength(38)` (`:548`) com o mesmo input — D6 garante que multi-imagem não muda o conjunto de variáveis. Novo caso: `mediaImagesDataUrls(brief)` retorna lista ordenada (posição 0 = primary) e o provider recebe `productImagesDataUrls` (task 15.4; o assert atual `:658` `objectContaining({ productImageDataUrl })` é o molde).

**`src/lib/image-generation/providers/__tests__/openai-provider.test.ts`** — Analog: self. O `vi.mock("openai")` (`:5-19`) mocka `responses.create` + `images.edit` + `toFile`. Testes 17-19 (tasks 14.1-14.3): com `productImagesDataUrls: [primary, aux1]` → `responses.create` chamado com content contendo N `input_image`; com auxiliares + `attempt >= 1` → **não** chama `images.edit` (D7); com 1 imagem (legado) → caminho atual. O teste atual de fallback (`:33-48`, `attempt >= 1` → `rejects.toThrow`) continua passando porque o mock do `images.edit` não implementa o retorno.

**`src/lib/image-generation/services/__tests__/image-review-service.test.ts`** — Analog: self. O molde de teste é `service.review('data:image/jpeg;base64,abc', input)` (`:44`). Teste 23 (task 14.7): `service.review(genImage, input, primaryDataUrl)` → `mockLoader.load` chamado com prompt contendo "Compare o produto da arte com a imagem de referência"; sem 3º arg → comportamento atual (todos os testes existentes `:35-354` já cobrem a regressão).

**`src/app/api/campaign/generate-image/__tests__/route.test.ts`** — Analog: self. `VALID_REQUEST_BODY` (`:188-194`), `makeRequest` (`:196-202`), `setupSuccessMocks` (`:204-259`) permanecem; adicionar mocks de `uploadCampaignInputImage`/`removeCampaignInputs` (mesmo estilo de `uploadCampaignImage` `:257`). Testes 4, 24-27 (tasks 12.4, 14.8-14.11): payload ambíguo → 400 (`:316-327` é o molde de assert de 400 da rota); teto agregado/por item → 413; upload pré-snapshot com `campaignId`/`imageId` gerados pela rota + `storagePath` no snapshot; **teste 27**: o teste "rejects missing productImageDataUrl with 400" (`:316-327`) continua válido — o 400 agora vem da regra de exclusividade da rota (que mantém a mensagem "Imagem do produto..."), não do Zod.

**`src/components/flow/__tests__/use-campaign-form-navigation.test.ts`** — Analog: self. Os `mockRestoreFormState.mockReturnValue({...})` (`:61-77`, `:106-114`, `:152-160`, `:187-195`, `:209-217`) espelham `CampaignFormFields` completo — **`imageFile: null` quebra quando o campo vira `productImages`** (task 15.7): substituir por `productImages: []` nos 5 mocks. **Atenção:** os arquivos irmãos `use-campaign-form-notice.test.ts` (`:61-69`, `:156-163`, `:176-183`), `use-campaign-form-validity.test.ts` (`:115-123`) e `use-campaign-form-submit-error.test.ts` têm o mesmo mock e quebram igual (co-migração adicional — ver Nota de path 2).

**`src/app/(app)/campanhas/nova/__tests__/campaign-flow-credits.test.tsx`** — Analog: self. O mock `CampaignImageUpload: () => null` (`:94-96`) **já existe** (F40) — task 11.8/15.8: como o componente muda de props, o mock `() => null` continua funcionando **sem mudança** (novas props são irrelevantes para um mock que renderiza nada). O mock de `useCampaignForm` (`:28-66`) retorna `fields` espelhando `CampaignFormFields` — `imageFile: null` (`:31`) vira `productImages: []`. **Pitfall:** se o form renderizar a seção "Imagens adicionais" condicionalmente ao tamanho de `productImages`, o mock `[]` deve preservar o comportamento atual de render.

---

## Shared Patterns

### Regra de exclusividade D2 (aplica-se a `schema.ts` + `route.ts` + `use-campaign-form.ts` + testes)
Tabela canônica (CONTEXT `:197-203`):

| `productImages` | `productImageDataUrl` | Resultado |
|---|---|---|
| presente | ausente | válido (exatamente 1 `primary` no transporte) |
| ausente | presente | legado (mapper gera 1 primary/upload) |
| ausente | ausente | **400** "Imagem do produto é obrigatória" |
| presente | presente | **400** (payload ambíguo — mutuamente exclusivos) |

- O Zod **não** é a fonte da obrigatoriedade (D2 — preservação comportamental): `productImageDataUrl` vira `optional()` (`schema.ts:30`) e a regra vive na rota (`route.ts:117-135` co-migrado).
- O form nunca emite ambos (D2): com auxiliares → `productImages[]`; sem → `productImageDataUrl` legado.

### Ordem D5 — upload antes do snapshot (aplica-se a `route.ts` + `persistence.ts` + `brief.ts`)
`crypto.randomUUID()` (`campaignId`) → uuid por imagem → `uploadCampaignInputImage` → preencher `storagePath` no runtime (`CampaignProductImageInput`) → `buildCampaignBriefSnapshot` → `createCampaign(storeId, input, campaignIdPre)`. Cleanup pré-stream: `removeCampaignInputs`; pós-stream: `deleteCampaignImage` atual (`route.ts:397`). **Sem migration SQL** — bucket `campaign-images` existente comporta o subpath `{storeId}/{campaignId}/inputs/` (policies service_role insert/delete + owner select por prefixo `storeId` já cobrem).

### `mimeType` real derivado (aplica-se a `brief.ts` + testes)
`mimeTypeFromDataUrl(dataUrl)` (png/jpeg/webp via regex do data URL) corrige o quirk `"image/jpeg"` fixo da F39 (`brief.ts:167`). Teste 5 (task 12.5) + regressão: o legado `data:image/jpeg;base64,...` continua gerando `image/jpeg` (comportamento e shape do pós-F40 preservados; `storagePath` ausente no teste unitário sem upload — aditivo apenas no fluxo de rota F41, D5 nos dois fluxos).

### Golden `EXPECTED_KEYS = 38` preservado (aplica-se aos 4 prompts + `image-generation-service.test.ts`)
D6: as imagens entram como **input multimodal**, não como variável de prompt. O bloco descritivo 1+N é hardcoded nos 4 prompts; o conjunto de variáveis por intent **não muda** (`EXPECTED_KEYS` `:516-527`, `toHaveLength(38)` `:548`). O texto do prompt muda intencionalmente (regressão por intent). Teste 21 (task 14.5) usa `readFileSync` como `prompt-reframe.test.ts:6-8`.

### Fallback `images.edit` gated por primary única (aplica-se a `openai.ts` + `openai-provider.test.ts`)
Limitação pré-existente (`openai.ts:282-287` — 1 base image) vira regra de negócio (D7): `attempt >= 1` só chama `fallbackToImageApi` quando há APENAS a primary; com auxiliares → retries no Responses; Responses indisponível → erro explícito (sem descartar imagens). Telemetria (`AiCostTracker`/`recordCall`) permanece 1 evento `campaign_image`.

### Validação primary-only + review com primary (aplica-se a `input-validation-service.ts` + `image-review-service.ts`)
D8: `InputValidationService.validate(nome, dataUrlDaPrimary)` inalterado — auxiliares não participam; fluxo de 409 inalterado. D9: `review` recebe a primary **opcionalmente** como referência de fidelidade; sem primary → comportamento atual (retrocompatível, nenhum teste existente quebra).

### Mock co-migração (aplica-se a todos os testes que espelham `CampaignFormFields`)
Qualquer arquivo que mocka `use-campaign-form` (`campaign-flow-credits.test.tsx:28-66`) ou restaura estado (`use-campaign-form-navigation.test.ts:61-77`, `use-campaign-form-notice.test.ts:61-69`, `use-campaign-form-validity.test.ts:115-123`) espelha `CampaignFormFields` — `imageFile: File | null` → `productImages: Array<...>` quebra os mocks até co-migrados na mesma fase (F41-15.7/15.8 + os 3 arquivos irmãos). O mock `CampaignImageUpload: () => null` (`campaign-flow-credits.test.tsx:94-96`) sobrevive sem mudança (novas props irrelevantes para mock que renderiza nada).

### Error handling (form — sem mudança de estrutura)
`handleSubmit` (`use-campaign-form.ts:638-746`) mantém try/catch + `consumeStream`; os novos erros de imagem (HEIC decode, limites por item) são erros de **validação do form** (`validateImage`/`validateField` `:197-227`), exibidos no padrão existente (`campaign-input-form.tsx:362-367`). A rota adiciona 400/413 em PT-BR no mesmo padrão dos guards atuais (`route.ts:117-135`).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Decode HEIC via canvas + `createImageBitmap from-image` em `compressImage` | utility (browser) | transform | Nenhum código atual usa `createImageBitmap` ou decodifica HEIC; o padrão de canvas/quality-loop existe (`use-campaign-form.ts:12-74`), mas o decode HEIC é novo — seguir D4 (canvas `drawImage` → `toBlob` JPEG) e documentar `heic2any`/`libheif` como alternativa futura se o UAT com celular real mostrar necessidade |
| Preview grid multi-imagem | UI component | form state | `CampaignImageUpload` atual é single-preview (`:35-52`); o grid por item é composição nova — reusar o padrão de thumb + botão remover existente por item, com `URL.createObjectURL`/revoke por item (padrão `use-campaign-form.ts:421-456`) |
| `superRefine` exactly-1-primary **no transporte** | config/schema | request-response | O `superRefine` existe no domínio (`brief-schema.ts:75-83`) mas **não** no transporte (`schema.ts`); o F41 replica o padrão no transporte (D2) — não é um novo padrão, é reuso com novo alvo |
| Cleanup `removeCampaignInputs` (list+remove por prefixo) | persistence/service | file-I/O | `deleteCampaignImage` (`persistence.ts:143-154`) remove por path conhecido; listar por prefixo `{storeId}/{campaignId}/inputs/` é novo — compor `.list(prefix)` + `.remove(paths)` no mesmo esqueleto |

---

## Metadata

**Analog search scope:** `src/lib/campaign/`, `src/lib/image-generation/` (schema, config, providers, services + `__tests__`), `src/components/flow/`, `src/app/api/campaign/generate-image/` (+ `__tests__`), `src/app/(app)/campanhas/nova/__tests__/`, `prompts/`, `.planning/phases/40-campos-comerciais-avisos-brief/` (template estrutural)
**Files scanned:** 25 code/test targets + 14 support files (all verified to exist; 4 large files read in targeted ranges — `route.ts` 835 linhas, `image-generation-service.ts` 1207 linhas, `use-campaign-form.ts` 830 linhas, `route.test.ts` 1256 linhas)
**Pattern extraction date:** 2026-08-14
**Key precedent referenced:** F40 (form state + body assembly + co-migração de mocks + `prompt-reframe.test.ts` como molde de teste de `.md`), F39 (domínio multi-imagem-ready `media.images[]`, mapper `buildCampaignBriefFromFlat`, snapshot `campaign_brief_v1`), F38.1 (`operationRunId?` opcional em `CreateCampaignInput` + telemetria 1 evento), F38.2.1 (snapshot imutável), F37 (futuro consumidor do snapshot com N imagens e `storagePath`)
