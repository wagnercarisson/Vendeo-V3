# Phase 40: Campos Comerciais e Avisos do Brief — Pattern Map

**Mapped:** 2026-08-14
**Files analyzed:** 22 (3 new, 7 modified code/prompt, 6 test co-migrations, 6 runbook trackings)
**Analogs found:** 16 / 16 code targets; 6/6 runbook targets (doc-edit, no code analog)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/campaign/constants.ts` (NEW) | constant/utility (neutral module) | static (imported by form components; literal referenced by prompts) | `src/lib/constants.ts` (neutral export-only module) | exact |
| `src/components/campaign/illustrative-notice-field.tsx` (NEW) | UI component (checkbox) | form state (`showIllustrativeNotice` boolean) → body | `src/components/campaign/mandatory-artwork-field.tsx` (field component) + checkbox at `campaign-input-form.tsx:488-501` | role-match |
| `src/components/campaign/validity-field.tsx` (NEW) | UI component (mode selector + date inputs + custom text) | form state (mode/dates/text) → `displayText` → body `validity` | `IntentSelector` `campaign-input-form.tsx:196-246` (mode cards) + badge `select` `:427-470` + date inputs `ai-operation-costs-filters.tsx:132-146` | role-match |
| `src/components/flow/use-campaign-form.ts` (MOD) | form hook (state + body assembly) | form state → HTTP body → `consumeStream` | self (body build 625-638, `EMPTY_FIELDS` 133-143, restore 252-274, autosave 277-293) | self-analog |
| `src/components/flow/campaign-input-form.tsx` (MOD) | form UI (section grouping) | render fields → submit | self (`MandatoryArtworkField` 503-506, checkbox 488-501, Descrição 389-425) | self-analog |
| `src/components/campaign/mandatory-artwork-field.tsx` (MOD) | UI component | form state → body | self (placeholder line 24 only) | self-analog |
| `prompts/campaign-image-director.md` (MOD) | prompt/config | static template → prompt variables | self (hardcode :130 → condicional; linha :132 mantida) | self-analog |
| `prompts/campaign-image-director-offer.md` (MOD) | prompt/config | static template → prompt variables | self (hardcode :131 → condicional; linha :133 mantida) | self-analog |
| `prompts/campaign-image-director-spotlight.md` (MOD) | prompt/config | static template → prompt variables | self (hardcode :129 → condicional; linha :131 mantida) | self-analog |
| `prompts/campaign-image-director-exclusive.md` (MOD) | prompt/config | static template → prompt variables | self (hardcode :138 → condicional; linha :140 mantida) | self-analog |
| `src/lib/campaign/__tests__/brief.test.ts` (MOD) | test | contract unit (checkbox/validade via constante) | self (`baseBrief` 11-42, validity/legalNotice cases 144-192) | self-analog |
| `src/components/flow/__tests__/use-campaign-form-navigation.test.ts` (MOD) | test | form unit (EMPTY_FIELDS/navegação) | self (restore mock shape 61-71) | self-analog |
| `src/app/api/campaign/generate-image/__tests__/route.test.ts` (MOD) | test | co-migration (fixtures `validity`/`mandatoryArtworkText`) | self (fixtures 530, 775-807) | self-analog |
| `src/lib/image-generation/services/__tests__/image-generation-service.test.ts` (MOD) | test | co-migration (fixtures singular/plural + golden 38 keys) | self (`createMinimalBrief` 17-32, `EXPECTED_KEYS` 516-527, plural fixtures 242/272/339) | self-analog |
| `src/lib/image-generation/services/__tests__/image-review-service.test.ts` (MOD) | test | co-migration (fixtures + seções) | self (`ImageReviewInput` literals 36-42, plural fixture 193, singular 266) | self-analog |
| `src/app/(app)/campanhas/nova/__tests__/campaign-flow-credits.test.tsx` (MOD) | test | co-migration (mocks do form) | self (mock `MandatoryArtworkField: () => null` 76-78; `useCampaignForm` mock 24-60) | self-analog |
| `ROADMAP.md` (root) + 5 `.planning/*.md` | config/doc | runbook (D1) | self (existing listing/reference tables) | doc-edit |

> **Nota de path:** o `campaign-flow-credits.test.tsx` **não** está em `src/components/flow/__tests__/` — está em `src/app/(app)/campanhas/nova/__tests__/campaign-flow-credits.test.tsx`. O CONTEXT.md (`:154`) abrevia o path; o planner deve usar o path real.

---

## Pattern Assignments

### `src/lib/campaign/constants.ts` (NEW — módulo neutro de constantes)

**Analog:** `src/lib/constants.ts` (1-80) — módulo `export const` puro, sem imports de `server-only`, consumido pelo frontend.

**WHY — the pattern being replicated:** O `src/lib/constants.ts` é a prova viva de módulo compartilhado cliente/servidor: só `export const` tipados + `export type` derivados, zero side effects, zero imports do domínio. A F40 (D2) exige que `ILLUSTRATIVE_NOTICE_TEXT` viva em módulo **neutro** — sem `server-only`, sem importar o builder/domínio do brief — para o frontend importar sem arrastar zod/supabase.

**Pattern to copy — export-const-with-literal (style de `src/lib/constants.ts:1-17`):**
```typescript
export const STORE_SEGMENTS = [ ... ] as const;
export type StoreSegment = (typeof STORE_SEGMENTS)[number]["value"];
```

**Expected F40 content (task 2.1) — único export do arquivo:**
```typescript
export const ILLUSTRATIVE_NOTICE_TEXT = "Imagem meramente ilustrativa";
```
- **Sem** `"use client"`, **sem** `import "server-only"`, **sem** import de `@/lib/campaign/brief` ou `brief-schema`.
- Consumidores: `illustrative-notice-field.tsx` (rótulo), `mandatory-artwork-field.tsx` (placeholder, task 2.3), `use-campaign-form.ts` (concatenação D3, task 3.4), `brief.test.ts` (task 8.8), fixtures (task 10.2).
- Os prompts (`.md`) **não importam** a constante — usam o literal canônico singular (garantido pelo teste 14, task 8.6).

**Data flow:** static; nenhum dado atravessa — é fonte de verdade da string canônica.

---

### `src/components/campaign/illustrative-notice-field.tsx` (NEW — checkbox control)

**Analog:** `src/components/campaign/mandatory-artwork-field.tsx` (1-31) para o esqueleto de campo (label + `htmlFor` + classes do design system); checkbox `campaign-input-form.tsx:488-501` para o controle em si.

**WHY — the pattern being replicated:** Campos de formulário são componentes `"use client"` com props `{ value, onChange }` e o padrão de label do design system (uppercase tracking-wider). O checkbox existente de `preserveImageContext` (`:488-501`) mostra o estilo canônico de checkbox do form.

**Component skeleton pattern (from `mandatory-artwork-field.tsx:1-8`):**
```typescript
"use client";

interface MandatoryArtworkFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export function MandatoryArtworkField({ value, onChange }: MandatoryArtworkFieldProps) {
```

**Checkbox control pattern (from `campaign-input-form.tsx:488-501` — preserveImageContext):**
```tsx
<label className="flex items-start gap-3 cursor-pointer">
  <input
    type="checkbox"
    checked={fields.preserveImageContext}
    onChange={(e) => setField("preserveImageContext", e.target.checked)}
    disabled={isSubmitting}
    className="mt-0.5 h-4 w-4 rounded border-border-light bg-bg-surface text-accent-green focus:ring-accent-green/20"
  />
  <span className="text-text-primary text-sm font-body">
    Preservar imagem original
  </span>
</label>
```

**F40 expected (task 2.2):** props `{ checked: boolean; onChange: (checked: boolean) => void }` (default marcado é responsabilidade do form state — `EMPTY_FIELDS` com `showIllustrativeNotice: true`, task 3.1); label "Exibir 'Imagem meramente ilustrativa'" (usando `ILLUSTRATIVE_NOTICE_TEXT` — nunca literal solto); classes do design system acima.

**Data flow:** form state boolean → body (concatenação D3 no submit).

---

### `src/components/campaign/validity-field.tsx` (NEW — 6 modos → displayText)

**Analog:** `IntentSelector` em `campaign-input-form.tsx:196-246` (seleção por cards/radio com `labels: Record<T, string>`); badge `select` `:427-470` (dropdown com opção placeholder); date inputs `src/app/(app)/admin/ai-operation-costs/ai-operation-costs-filters.tsx:132-146` (único `type="date"` no código); textarea de Descrição `campaign-input-form.tsx:389-425` (texto livre com contador).

**WHY — the pattern being replicated:** O `IntentSelector` mostra o padrão de "modos" do form (label map + radio cards), que é exatamente o que os 6 modos de validade precisam (Sem validade / Até uma data / De... até... / Somente hoje / Enquanto durarem os estoques / Texto personalizado). O form não tem componente de "modo+datas" — a composição é nova, mas cada peça (radio card, date input, textarea) tem analog exato.

**Mode-selector pattern (from `IntentSelector` `campaign-input-form.tsx:207-243`):**
```tsx
const labels: Record<CampaignIntent, string> = {
  offer: "Oferta",
  spotlight: "Destaque",
  exclusive: "Exclusivo",
};
// ...
{availableOptions.map((intent) => (
  <label key={intent} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
    value === intent
      ? "border-accent-green bg-accent-green/5"
      : "border-border-light hover:border-text-muted"
  }`}>
    <input type="radio" name="campaignIntent" value={intent} checked={value === intent}
      onChange={() => onChange(intent)} disabled={disabled}
      className="h-4 w-4 accent-accent-green" />
    <span className="text-text-primary text-sm font-body flex-1">{labels[intent]}</span>
  </label>
))}
```

**Date-input pattern (from `ai-operation-costs-filters.tsx:132-146`):**
```tsx
<input
  type="date"
  value={form.periodStart ?? ""}
  onChange={(e) => set("periodStart", e.target.value || null)}
  aria-label="Período início"
  className={inputClasses}
/>
<span className="text-muted-foreground">até</span>
<input
  type="date"
  value={form.periodEnd ?? ""}
  onChange={(e) => set("periodEnd", e.target.value || null)}
  aria-label="Período fim"
  className={inputClasses}
/>
```

**F40 expected (tasks 4.1-4.4):** props `{ mode, dates, customText, onChange }` (ou granular: `onModeChange`/`onDateChange`/`onCustomTextChange` — siga o estilo `setField` do form); gera `displayText` determinístico `dd/mm` (`até 30/09`, `de 25/09 até 30/09`, `somente hoje`, `enquanto durarem os estoques`, personalizado normalizado); **NUNCA** emite `endDate` (ISO) — datas só viram `displayText` (D4/F39 D8). A normalização leve do texto personalizado (limpar prefixo "Oferta válida", D5/task 4.4) é um `trim`+`replace` puro — pode ser helper local no componente ou no hook (ver pattern de `normalizeValidity` pitfall abaixo).

**Data flow:** form state → displayText → body `validity` (só `offer`, task 3.3).

---

### `src/components/flow/use-campaign-form.ts` (MOD — form state + body assembly)

**Analog:** self — todos os pontos de mudança têm analog exato no próprio arquivo.

**WHY — the pattern being replicated:** O hook é a fonte do estado do form. A F40 (D2/D3/D4) adiciona campos ao state (`showIllustrativeNotice`, `mandatoryArtworkTextFree`, modo de validade + datas + texto personalizado), e muda **apenas a montagem do body** (`:625-638`) — a concatenação checkbox×texto e o `validity` condicional a `offer` acontecem aí.

**`CampaignFormFields` + `FieldErrors` — adicionar campos (atual 75-100):**
```typescript
export interface CampaignFormFields {
  productName: string;
  description: string;
  originalPriceCents: number;
  discountedPriceCents: number | undefined;
  badge: string;
  campaignIntent: CampaignIntent;
  preserveImageContext: boolean;
  imageFile: File | null;
  mandatoryArtworkText: string;   // ← compat/derivado: NUNCA o texto final concatenado (D3)
  showIllustrativeNotice: boolean;        // NOVO (default true)
  mandatoryArtworkTextFree: string;       // NOVO
  validityMode: string;                   // NOVO (6 modos)
  validityStartDate: string;              // NOVO (dd/mm string ou ISO — UI only)
  validityEndDate: string;                // NOVO
  validityCustomText: string;             // NOVO
}
```

**`EMPTY_FIELDS` (atual 133-143) — novo default marcado (task 3.1/3.7):**
```typescript
const EMPTY_FIELDS: CampaignFormFields = {
  ...
  mandatoryArtworkText: "",
  showIllustrativeNotice: true,     // D2: default marcado preserva comportamento atual
  mandatoryArtworkTextFree: "",
  validityMode: "none",
  validityStartDate: "",
  validityEndDate: "",
  validityCustomText: "",
};
```

**Body assembly — ponto ÚNICO de concatenação (atual 625-638; tasks 3.3/3.4):**
```typescript
const body: Record<string, unknown> = {
  storeId,
  productName: frozenFields.productName,
  originalPriceCents: frozenFields.originalPriceCents,
  discountedPriceCents: frozenFields.discountedPriceCents,
  description: frozenFields.description || undefined,
  badgeText: frozenFields.badge,
  campaignIntent: frozenFields.campaignIntent,
  ...(frozenFields.campaignIntent === "offer"
    ? {}
    : { preserveImageContext: frozenFields.preserveImageContext }),
  mandatoryArtworkText: frozenFields.mandatoryArtworkText || undefined,   // ← substituir
  productImageDataUrl: imageDataUrl,
};
```
→ F40 substitui a linha `mandatoryArtworkText` por concatenação D3 (ver Shared Patterns) e adiciona `validity` condicional a `offer`:
```typescript
...(frozenFields.campaignIntent === "offer"
  ? { validity: buildValidityDisplayText(frozenFields) }   // undefined → omitido
  : {}),
```
**Pitfall D3:** `mandatoryArtworkText` NUNCA é salvo concatenado no draft/autosave — se persistir no state, é compat/derivado (`EMPTY_FIELDS`/restore reconstroem de `showIllustrativeNotice` + `mandatoryArtworkTextFree`).

**Restore/autosave (atual 252-274 / 277-293):** o `useInputPreservation<CampaignFormFields>` serializa o objeto inteiro em `sessionStorage` — adicionar campos novos é automático (JSON.stringify/parse), mas **mocks de teste** que fazem `mockRestoreFormState.mockReturnValue({...})` precisam dos novos campos (task 10.4). `setFields((prev) => ({ ...prev, ...rest, imageFile: null }))` (`:257`) já espalha campos novos sem mudança de código.

**Intent-change cleanup (atual 329-337) — padrão a replicar para "troca de intent preserva rascunho" (D4, task 3.5):** o efeito que limpa badge inválido por intent (`:329-337`) é o modelo: na troca `offer` → `spotlight`/`exclusive`, **não** limpar o estado de validade (preservar) — o body condiciona o envio (`campaignIntent === "offer"`). Voltar a `offer` restaura porque o state nunca foi limpo.

**Reset (atual 652):** `setFields(EMPTY_FIELDS)` já cobre os novos campos automaticamente.

**Data flow:** form state → HTTP body (via `consumeStream` `:440-557`, inalterado) → `GenerateImageRequestSchema` (já aceita `validity`/`mandatoryArtworkText` — zero mudança de contrato, D9).

---

### `src/components/flow/campaign-input-form.tsx` (MOD — agrupamento + novos campos)

**Analog:** self — seções existentes do form.

**WHY — the pattern being replicated:** O form renderiza campos com labels do design system e agrupa por ordem de fluxo. A F40 (D8/task 5.1) reorganiza em Produto / Oferta / Avisos e texto obrigatório e injeta os dois novos campos.

**Seção "Avisos e texto obrigatório" — onde `MandatoryArtworkField` vive hoje (503-506):**
```tsx
<MandatoryArtworkField
  value={fields.mandatoryArtworkText}
  onChange={(v) => setField("mandatoryArtworkText", v)}
/>
```
→ F40 (task 5.2): `IllustrativeNoticeField` (checkbox) + `MandatoryArtworkField` (textarea) **coexistindo**, ambos alimentados pelos campos separados:
```tsx
<IllustrativeNoticeField
  checked={fields.showIllustrativeNotice}
  onChange={(v) => setField("showIllustrativeNotice", v)}
/>
<MandatoryArtworkField
  value={fields.mandatoryArtworkTextFree}
  onChange={(v) => setField("mandatoryArtworkTextFree", v)}
/>
```
**Pitfall:** o `MandatoryArtworkField` passa a receber `mandatoryArtworkTextFree` (não `mandatoryArtworkText`).

**Seção "Validade da oferta" — condicional de intent (D4, task 5.3):** o padrão condicional por intent já existe:
```tsx
{fields.campaignIntent !== "offer" && (  // ← preserva imagem — espelhar inverso p/ validade
  <label className="flex items-start gap-3 cursor-pointer">...
```
→ F40: `{fields.campaignIntent === "offer" && (<ValidityField ... />)}` — a seção **só renderiza para offer** (o mesmo gate do body).

**Checkbox renderizado condicionalmente — pattern para verificar que `validity` não aparece em non-offer (488-501):**
```tsx
{fields.campaignIntent !== "offer" && (
  <label className="flex items-start gap-3 cursor-pointer">
    <input type="checkbox" ... />
    <span className="text-text-primary text-sm font-body">Preservar imagem original</span>
  </label>
)}
```

**Descrição (389-425) — inalterada** (D8): permanece na seção Produto, `maxLength 120`, contador `:415-417` (`{fields.description.length}/120`). **Não** criar `campaignDetails`.

**Data flow:** render → submit → hook (body assembly).

---

### `src/components/campaign/mandatory-artwork-field.tsx` (MOD — placeholder com constante)

**Analog:** self (arquivo inteiro, 31 linhas).

**WHY — the pattern being replicated:** mudança de 1 linha (task 2.3) — o placeholder referenciando a constante singular.

**Exact line to change (line 24):**
```tsx
placeholder="Ex: Imagens meramente ilustrativas"
```
→
```tsx
placeholder={`Ex: ${ILLUSTRATIVE_NOTICE_TEXT}`}
```
(+ import `import { ILLUSTRATIVE_NOTICE_TEXT } from "@/lib/campaign/constants";`). Manter `maxLength={200}` (`:25`), `rows={2}` (`:26`), classes (`:27`) e estrutura de label (`:11-19`) intactas.

**Pitfall D2:** a constante é **singular** ("Imagem meramente ilustrativa") — o placeholder atual é **plural**. O prefixo "Ex: " permanece; só a frase canônica muda.

**Data flow:** form state → body.

---

### Prompts do diretor (MOD ×4 — hardcode → bloco condicional, D6)

**Analog:** self — a linha a remover e a linha condicional a manter existem nos 4 arquivos com números de linha ligeiramente diferentes.

**Remover (instrução incondicional UAT-3):**
- `prompts/campaign-image-director.md:130`
- `prompts/campaign-image-director-offer.md:131`
- `prompts/campaign-image-director-spotlight.md:129`
- `prompts/campaign-image-director-exclusive.md:138`

Texto exato a remover (idêntico nos 4):
```
SEMPRE acrescente a arte o seguinte texto (esse texto pode ser minúsculo mas deve ser legível - e deve ser posicionado nas margens da arte, horizontal ou vertical): "Imagem meramente ilustrativa"
```

**Inserir no mesmo local — bloco condicional de composição (D6, texto exato do CONTEXT `:171-174`):**
```
Quando houver texto obrigatório/aviso legal informado, exiba exatamente esse texto na arte.
Se o aviso for "Imagem meramente ilustrativa", posicione-o com tipografia mínima, mas visível e legível, em área lateral horizontal ou vertical, sem competir com oferta, produto e preço.
```

**Manter (linha condicional do texto obrigatório — NÃO tocar):**
- `campaign-image-director.md:132`, `-offer.md:133`, `-spotlight.md:131`, `-exclusive.md:140`

Texto mantido (idêntico nos 4):
```
Se o campo "Texto obrigatório na arte" estiver preenchido ({{mandatoryArtworkText}}), inclua esse texto na arte de forma visível e legível, em tipografia mínima adequada para leitura em dispositivo móvel. Não o repita na legenda.
```

**Pitfalls:**
- `-spotlight.md:129` está **antes** da linha do `-offer` (129 vs 131) e `-exclusive.md:138` depois — conferir o offset ao editar (o bloco a remover tem 1 linha, igual nos 4).
- O template offer/base `campaign-image-director-offer.md:83` (`**Validade da oferta:** {{validity}}`) **não muda** (D5) — a superfície compõe o rótulo.
- O conjunto de variáveis/keys do prompt permanece idêntico (`EXPECTED_KEYS = 38`, task 9.5) — o texto muda intencionalmente (D6).

**Data flow:** static; `PromptLoader` (`src/lib/image-generation/prompt-loader.ts`) carrega + resolve `{{vars}}` — inalterado.

---

### Testes — co-migrações (MOD)

**`src/lib/campaign/__tests__/brief.test.ts`** — Analog: self. Novos casos de checkbox/validade (task 8.8) usam a **constante via `constants.ts`** (não literal):
```typescript
import { ILLUSTRATIVE_NOTICE_TEXT } from "../constants";
// ...
it("enabled=true + text → getCampaignLegalNotice retorna o texto (compat mandatoryArtworkText)", () => {
  const brief = baseBrief({
    commercial: {
      intent: "offer",
      discountedPriceCents: 1990,
      legalNotice: { enabled: true, text: ILLUSTRATIVE_NOTICE_TEXT },
    },
  });
  expect(getCampaignLegalNotice(brief)?.text).toBe(ILLUSTRATIVE_NOTICE_TEXT);
});
```
Pattern do fixture: `baseBrief(overrides)` com spread-last (`brief.test.ts:11-42`); casos existentes de validade/legalNotice em `:144-192` são o molde.

**`src/components/flow/__tests__/use-campaign-form-navigation.test.ts`** — Analog: self. Os `mockRestoreFormState.mockReturnValue({...})` (`:61-71`, `:100-110`, `:140-150`) espelham `CampaignFormFields` completo — **novos campos quebram o teste** (task 10.4): adicionar `showIllustrativeNotice: true`, `mandatoryArtworkTextFree: ""`, `validityMode`, `validityStartDate/EndDate`, `validityCustomText` aos 3 mocks. O `EMPTY_FIELDS` do hook também é coberto por este arquivo via `renderHook`.

**`src/app/api/campaign/generate-image/__tests__/route.test.ts`** — Analog: self. Fixtures com `mandatoryArtworkText` (`:530`, `:775`, `:796`, `:807`) e a asserção de mapper (`:785` `legalNotice: { enabled: true, text: ... }`) normalizam para `ILLUSTRATIVE_NOTICE_TEXT` (singular). O `VALID_REQUEST_BODY`/`makeRequest` (`:200-201`) ganha casos com `validity` (task 10.1). **Padrão de mock imutável:** `setupSuccessMocks` (`:204-259`) e o mock de `buildCampaignBrief` (`:218-221`) permanecem — o domínio entra via mapper puro, não via mock (mesma regra da F39).

**`src/lib/image-generation/services/__tests__/image-generation-service.test.ts`** — Analog: self. `createMinimalBrief` (`:17-32`) recebe `validity`/`mandatoryArtworkText` via `overrides` (já faz — `:542-543`, `:584`). **Co-migração plural→singular** (task 10.2): `:242`, `:272`, `:339` (`'Imagens meramente ilustrativas'` → `ILLUSTRATIVE_NOTICE_TEXT`). Golden tests (`:515-580`): `EXPECTED_KEYS` de 38 keys (`:516-527`) permanece — o teste 20 (task 9.5) preenche os novos campos e re-asserta `keys.sort()` + `toHaveLength(38)` + `vars.validity`/`vars.mandatoryArtworkText`.

**`src/lib/image-generation/services/__tests__/image-review-service.test.ts`** — Analog: self. `ImageReviewInput` literals (`:36-42`) já usam `legalNoticeText`/`validityText` (F39). Co-migração plural→singular: `:193`/`:199`. Novo caso (teste 21, task 9.6): `legalNoticeText: ILLUSTRATIVE_NOTICE_TEXT` → `vars.mandatoryArtworkTextSection` contém a constante (`:266-270` é o molde singular já existente).

**`src/app/(app)/campanhas/nova/__tests__/campaign-flow-credits.test.tsx`** — Analog: self. **Co-migração obrigatória de mocks** (task 5.5/10.5):
1. O mock de `useCampaignForm` (`:28-58`) retorna objeto `fields` que espelha `CampaignFormFields` — adicionar os novos campos (`:29-39`).
2. O mock de `MandatoryArtworkField: () => null` (`:76-78`) **não cobre** os novos componentes — adicionar mocks de `IllustrativeNoticeField` e `ValidityField`:
```tsx
vi.mock("@/components/campaign/illustrative-notice-field", () => ({
  IllustrativeNoticeField: () => null,
}));
vi.mock("@/components/campaign/validity-field", () => ({
  ValidityField: () => null,
}));
```
Sem isso, os novos componentes renderizam de verdade no jsdom e o teste pode quebrar (e.g. `type="date"`/selects).

---

## Shared Patterns

### Concatenação do body — transporte normalizado D3 (aplica-se a `use-campaign-form.ts`)
**Source:** tasks 3.4 + CONTEXT `:39`. Regra canônica de montagem do `mandatoryArtworkText` final (só no submit):
```typescript
// marcado + texto → "Imagem meramente ilustrativa\n<texto>"
// marcado sem texto → ILLUSTRATIVE_NOTICE_TEXT
// desmarcado + texto → só o texto
// desmarcado + sem texto → undefined (campo ausente)
function buildMandatoryArtworkText(
  showNotice: boolean,
  freeText: string
): string | undefined {
  const notice = showNotice ? ILLUSTRATIVE_NOTICE_TEXT : "";
  const free = freeText.trim();
  if (notice && free) return `${notice}\n${free}`;
  if (notice) return notice;
  if (free) return free;
  return undefined;
}
```
**Campo ausente → `undefined`** (não `""`) — o mapper `buildCampaignBriefFromFlat` (`brief.ts:157-159`) só fabrica `legalNotice` quando a string é truthy; ausente → `legalNotice` ausente → `enabled=false` → nada na arte (regra de ausência F39 D9 preservada).

### `validity` — displayText nu + gate por intent (aplica-se a `use-campaign-form.ts` + `validity-field.tsx`)
**Source:** D4/D5 + tasks 3.3/4.4. O `displayText` é **frase nua sem prefixo** (`até 30/09`, `de 25/09 até 30/09`, `somente hoje`, `enquanto durarem os estoques`). **Duas superfícies compõem o rótulo uma única vez** — a F40 NÃO mexe nelas:
- `buildCommercialRepertoire` → `- Oferta válida: ${displayText}` (`image-generation-service.ts:738-740`)
- template offer/base → `**Validade da oferta:** {{validity}}` (`campaign-image-director-offer.md:83`)

Helper puro de modos→displayText (determinístico, testável isoladamente — testes 1-6, tasks 7.1-7.6):
```typescript
function buildValidityDisplayText(fields: CampaignFormFields): string | undefined {
  switch (fields.validityMode) {
    case "none": return undefined;
    case "until": return `até ${formatDDMM(fields.validityEndDate)}`;
    case "range": return `de ${formatDDMM(fields.validityStartDate)} até ${formatDDMM(fields.validityEndDate)}`;
    case "today": return "somente hoje";
    case "while-stock-lasts": return "enquanto durarem os estoques";
    case "custom":
      return fields.validityCustomText
        .replace(/^Oferta válida\s*:?\s*/i, "")   // normalização leve D5
        .trim() || undefined;
    default: return undefined;
  }
}
```
Formato `dd/mm` de `type="date"` (ISO `yyyy-mm-dd`): `date.split("-").reverse().slice(0, 2).join("/")`. `endDate` (ISO) NUNCA é enviado (D4/F39 D8).

### Regra de ausência (D4/D5/D9 — aplica-se a body, mapper e testes)
`Sem validade` → `validity` **ausente** no body (não `""`, não `{ enabled: false }`). Mapper já trata: `brief.ts:153-155` só cria `validity` quando `input.validity` é truthy. Testes: `expect(body.validity).toBeUndefined()` e `expect(brief.commercial.validity).toBeUndefined()` (molde `brief.test.ts:188-191`).

### Autosave/restore preserva intenção (D3 — aplica-se a `use-campaign-form.ts` + testes de navegação)
O `useInputPreservation` (`src/hooks/use-input-preservation.ts:7-36`) serializa `CampaignFormFields` inteiro — campos novos persistem automaticamente. **Pitfall:** se `mandatoryArtworkText` (concatenado) fosse salvo, "checkbox marcado + texto livre" viraria indistinguível de texto livre digitado com a frase — por isso o state guarda `showIllustrativeNotice`/`mandatoryArtworkTextFree` separados e **nunca** persiste o texto final concatenado (D3). Teste 15 (task 8.7) cobre o restore.

### Mock co-migração (D2/D3 — aplica-se a todos os testes que renderizam o form)
Qualquer arquivo que mocka `use-campaign-form` (`campaign-flow-credits.test.tsx:24-60`) ou restaura estado (`use-campaign-form-navigation.test.ts:61-71`) espelha `CampaignFormFields` — novos campos = mocks quebrados até co-migrados na mesma fase (F40-16). Qualquer teste que renderiza `CampaignInputForm` precisa de mocks para os novos componentes (`IllustrativeNoticeField`, `ValidityField`).

### Placeholder/fixtures normalizadas singular (D2 — aplica-se a `mandatory-artwork-field.tsx` + 3 arquivos de teste)
`ILLUSTRATIVE_NOTICE_TEXT = "Imagem meramente ilustrativa"` (singular). Referências **plurais** a migrar no mesmo commit: placeholder (`mandatory-artwork-field.tsx:24`), fixtures `image-generation-service.test.ts:242/272/339`, `image-review-service.test.ts:193`, `route.test.ts:530/775/796/807`. Teste 14 (task 8.6) garante zero strings soltas divergentes.

### Error handling (form — sem mudança)
`handleSubmit` (`use-campaign-form.ts:559-646`) mantém a estrutura try/catch + `consumeStream` (`:440-557`) — os novos campos entram apenas no objeto `body`; erros 400/409/stream são tratados como hoje. Nenhum novo caminho de erro é criado (validação de validade é leve, sem requireds novos — task 3.7).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `validity-field.tsx` composição "modo + datas + texto" | UI component | form state → displayText | Nenhum componente de form combina radio-cards + date inputs + textarea; compor das peças existentes (IntentSelector + ai-operation-costs-filters date inputs + textarea de Descrição) |
| Prompt reframe (bloco condicional) | prompt | static | Mudança de texto de prompt, não de padrão — analog é o próprio prompt (linha a remover/mantida) |
| Teste 17 (bloco condicional presente nos 4 prompts) | test | contract unit (conteúdo de `.md`) | Nenhum teste atual lê arquivos de prompt como fixture de assert; padrão mais próximo é o `validatePrompts` de `image-generation-service.test.ts:84-103` (mock loader retornando prompt) — o teste de `.md` real exigirá `fs.readFileSync` (novo para a suíte do form, mas trivial) |

---

## Metadata

**Analog search scope:** `src/components/campaign/`, `src/components/flow/`, `src/lib/campaign/`, `src/lib/image-generation/services/`, `src/lib/image-generation/services/__tests__/`, `src/app/api/campaign/generate-image/__tests__/`, `src/app/(app)/campanhas/nova/__tests__/`, `src/lib/constants.ts`, `src/hooks/`, `src/app/(app)/admin/ai-operation-costs/`, `prompts/`, `.planning/phases/39-brief-estruturado-campanha/`
**Files scanned:** 22 code + 8 spec/dir files (15 read in full or targeted ranges)
**Pattern extraction date:** 2026-08-14
**Key precedent referenced:** F39 (domínio `CampaignBrief`, mapper `buildCampaignBriefFromFlat`, snapshot `campaign_brief_v1` — sem mudança de contrato D9), F39 D1 (renumeração de trackings), UAT-3 (herança do hardcode de prompt)
