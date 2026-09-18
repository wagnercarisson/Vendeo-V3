# Phase 49: Ativação e Orientação Contextual de Campos — Pattern Map

**Mapeado:** 2026-09-18
**Arquivos analisados:** 11 a criar/modificar (+ 8 testes co-migrados/regressão)
**Análogos encontrados:** 10 / 11 (1 sem análogo exato: indicador "Recomendado")

> **Fase de apresentação/conteúdo.** Nenhum análogo de pipeline é necessário. Todos os padrões abaixo são de **conteúdo puro**, **primitivo de campo** e **renderização de formulário/seção**.
>
> **Observação de divergência com o CONTEXT/UI-SPEC:** o CONTEXT afirma "não há `<details>`/disclosure no código atual" e o UI-SPEC cita `cn`. Verificação real em 2026-09-18: **existem** dois usos de `<details>`/`<summary>` (`evaluation-form.tsx:293`, `reviews/page.tsx:192`) e **não existe** utilitário `cn` no repo — as classes são concatenadas por template literal. Os análogos reais estão documentados abaixo.

---

## File Classification

| Arquivo novo/modificado | Papel | Fluxo de dados | Análogo mais próximo | Qualidade |
|---|---|---|---|---|
| `src/lib/store-onboarding/field-guidance.ts` **(novo)** | utility (conteúdo puro) | transform | `src/lib/store-onboarding/reason-text.ts` | exact (papel) / role-match (forma) |
| `src/lib/campaign/field-guidance.ts` **(novo)** | utility (conteúdo puro) | transform | `src/lib/store-onboarding/reason-text.ts` + `src/lib/constants.ts` | role-match |
| `src/components/ui/field-hint.tsx` **(novo)** *(ou `src/components/campaign/`)* | component (primitivo de campo) | request-response (render) | `src/app/(app)/admin/laboratorio/_components/lab-textarea.tsx` | exact |
| `src/components/ui/expandable-help.tsx` **(novo)** *(ou `src/components/campaign/`)* | component (disclosure) | event-driven | `src/app/(app)/admin/laboratorio/_components/evaluation-form.tsx:293-306` (`<details>`) + `src/components/shell/account-menu.tsx:41-60` (`aria-expanded`) | role-match |
| Indicador "Recomendado" **(novo, pode ser inline no label)** | component (estado textual) | request-response | `src/components/ui/badge.tsx` | partial |
| `src/components/flow/store-identity-form.tsx` | component (form CRUD) | request-response | ele mesmo (blocos a alterar) | exact |
| `src/components/flow/campaign-input-form.tsx` | component (form) | request-response | ele mesmo + `store-identity-form.tsx` (labelClass/erro) | exact |
| `src/components/campaign/mandatory-artwork-field.tsx` | component (campo) | request-response | ele mesmo + `lab-textarea.tsx` | exact |
| `src/components/flow/campaign-brief-review.tsx` | component (revisão) | transform (apresentação) | ele mesmo (seções já existentes) | exact |
| `src/components/campaign/illustrative-notice-field.tsx` | component | — | **NÃO modificar** (sem mudança requerida) | — |
| `src/components/campaign/validity-field.tsx` | component | — | **NÃO modificar** (regressão apenas) | — |
| `src/lib/store-onboarding/__tests__/field-guidance.test.ts` **(novo)** | test | — | `src/lib/store-onboarding/__tests__/reason-text.test.ts` | exact |
| `src/lib/campaign/__tests__/field-guidance.test.ts` **(novo)** | test | — | `src/lib/store-onboarding/__tests__/reason-text.test.ts` | exact |
| `src/components/ui/__tests__/expandable-help.test.tsx` **(novo)** | test | — | `src/__tests__/components/shell/account-menu.test.tsx:70-75` | role-match |

---

## Pattern Assignments

### `src/lib/store-onboarding/field-guidance.ts` + `src/lib/campaign/field-guidance.ts` (utility, conteúdo puro)

**Análogo primário:** `src/lib/store-onboarding/reason-text.ts` (43 linhas)

**Estilo de header + import de tipo irmão** (`reason-text.ts:1-11`):
```typescript
/**
 * Copy de bloqueio das abas do onboarding (F36, D16) — texto curto de ação
 * ("o que falta") por aba/motivo.
 *
 * Módulo puro: sem runtime de UI, sem ambiente de servidor, sem imports de
 * side-effect. Usado no aviso `blockedNotice`, no tooltip/aria-label do CTA
 * desktop "Continuar para Direção Visual" e no microcopy visível do "Continuar"
 * mobile (onde não há hover confiável).
 */

import type { OnboardingTab, TabBlockReason } from "./tabs";
```

**Estilo de mapa tipado + função pura de derivação** (`reason-text.ts:13-17` e `:23-42`):
```typescript
const TAB_LABEL: Record<OnboardingTab, string> = {
  dados: "Dados",
  posicionamento: "Posicionamento",
  "direcao-visual": "Direção Visual",
};

export function tabBlockReasonText(
  tab: OnboardingTab,
  reason: TabBlockReason | undefined,
  label?: string,
): string {
  const name = label ?? TAB_LABEL[tab];
  switch (reason) {
    case "needs_tone_of_voice":
      return `Defina o tom de voz para liberar ${name}.`;
    // ...
    default:
      return `Complete esta etapa para liberar ${name}.`;
  }
}
```

**Estilo de `as const` + tipo derivado (para as 8 descrições de tom de voz)** — `src/lib/constants.ts:1-17`:
```typescript
export const STORE_SEGMENTS = [
  { value: "moda-calcados-acessorios", label: "Moda, Calçados e Acessórios" },
  // ...
] as const;

export type StoreSegment = (typeof STORE_SEGMENTS)[number]["value"];
```

**Regras a seguir no módulo novo:**
- Cabeçalho JSDoc citando a fase/decision (D5/D6/D7/D8/D9/D10/D14) e declarando "módulo puro: sem JSX, sem side-effects".
- **Sem** `"use client"`, **sem** imports de React, **sem** `server-only`.
- Conteúdo como `Record<Chave, string>` tipado (chave = união de literais, nunca `string` solto) + funções puras de derivação (ex.: `priceFeedbackMessage(originalCents, discountedCents)`).
- `src/lib/campaign/field-guidance.ts` deve **importar `inferIntent`** de `@/components/flow/use-campaign-form`? **NÃO** — isso criaria dependência de módulo client. A correspondência com `inferIntent`/`availableOptions` é provada **em teste** (ver D14), não em runtime. O módulo novo recebe números e devolve string.

---

### `src/components/ui/field-hint.tsx` (component, primitivo de campo)

**Análogo exato:** `src/app/(app)/admin/laboratorio/_components/lab-textarea.tsx` (71 linhas)

**Padrão `useId` + `aria-describedby` com join de ids** (`lab-textarea.tsx:29-35`):
```typescript
const generatedId = useId();
const textareaId = id ?? generatedId;
const errorId = `${textareaId}-error`;
const hintId = `${textareaId}-hint`;
const describedBy = [error ? errorId : null, hint ? hintId : null]
  .filter(Boolean)
  .join(" ");
```

**Padrão de hint visível (só quando não há erro) + erro com `role="alert"`** (`lab-textarea.tsx:54-68`):
```typescript
{hint && !error && (
  <p id={hintId} className="text-xs text-text-muted font-body">
    {hint}
  </p>
)}
{error && (
  <p
    id={errorId}
    role="alert"
    className="flex items-center gap-1 text-xs text-accent-red font-body"
  >
    <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    {error}
  </p>
)}
```
> **Divergência registrada:** a fonte real `lab-textarea.tsx` usa `text-text-muted` no hint, mas a UI-SPEC da F49 (§Typography/§Color) manda `text-text-secondary` (`#94A3B8`, contraste 6,96:1/7,87:1) para hint/feedback — `text-text-muted` (`#64748B`) é insuficiente para instruções. Os primitivos e campos da F49 usam **`text-text-secondary`**; o erro continua em `accent.red`.

**Padrão de classe de label do formulário** (`store-identity-form.tsx:1342`, `lab-textarea.tsx:39-44`):
```typescript
const labelClass = "block text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2";
```

**Regras a seguir:**
- `FieldHint` é **apresentacional**: recebe `id` (obrigatório, derivado pelo campo consumidor a partir de `useId`) + `children`/`text`; renderiza `<p id={id} className="text-xs text-text-secondary font-body mt-1">`. **Não** gera o próprio `useId` — quem gera é o campo consumidor; o `id` do **próprio campo** permanece estático.
- Assinatura sugerida (consistente com `LabTextareaProps`): `interface FieldHintProps { id: string; children: React.ReactNode; tone?: "secondary" | "amber"; className?: string }`. O `tone` é resolvido por **mapa** (`{ secondary: "text-text-secondary", amber: "text-accent-amber" }`, default `"secondary"`), **nunca** por classe de cor concorrente concatenada.
- **Sem `cn`:** o repo não possui utilitário `cn`. Concatene com template literal, como em `lab-textarea.tsx:49-51`.
- Ícones sempre `lucide-react` com `aria-hidden="true"`; nunca emoji.
- Touch target: hint é texto, mas qualquer controle associado (disclosure) usa `min-h-[44px]`.

---

### `src/components/ui/expandable-help.tsx` (component, disclosure)

**Análogo A — `<details>`/`<summary>` nativo já usado no repo** (`src/app/(app)/admin/laboratorio/_components/evaluation-form.tsx:292-307`):
```typescript
{history.length > 0 && (
  <details className="rounded-lg border border-border bg-bg-deep/40 p-3">
    <summary className="cursor-pointer font-heading text-xs uppercase tracking-wider text-text-secondary">
      Histórico de avaliações ({history.length})
    </summary>
    <div className="mt-3 space-y-2">
      {/* conteúdo revelado */}
    </div>
  </details>
)}
```

**Análogo B — `<button aria-expanded>` + região condicional** (`src/components/shell/account-menu.tsx:41-60`):
```typescript
<button
  type="button"
  onClick={() => setIsOpen(!isOpen)}
  aria-haspopup="true"
  aria-expanded={isOpen}
  aria-label="Menu da conta"
  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-0 rounded-lg px-2 py-1.5 text-sm text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors duration-200 font-body sm:gap-2 sm:px-3"
>
  {/* ... */}
  <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
</button>

{isOpen && (
  <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-border bg-bg-surface p-1 shadow-lg z-50">
    {/* ... */}
  </div>
)}
```

**Regras a seguir (D2/D13):**
- Duas opções aceitáveis; **preferir `<button aria-expanded>` + região condicional** para controle explícito de `aria-controls`/estado e testabilidade por `getByRole("button", { name: ... })` + `toHaveAttribute("aria-expanded", ...)` (mesmo estilo de `account-menu.test.tsx:70-75`).
- Estado **colapsado por padrão**: `useState(false)`. A região revelada **permanece no DOM** ocultada com o atributo `hidden` quando colapsada (recomendado) — assim `aria-controls` **sempre** aponta para um elemento existente. Alternativa aceitável: `<details>/<summary>` nativo (sem `aria-controls`). Nunca apontar `aria-controls` para um elemento inexistente.
- Acionável por teclado (é um `<button type="button">`), foco visível via `focus:ring-2 focus:ring-accent-blue/20` (padrão dos campos) ou `focus-visible:`.
- `min-h-[44px]` no gatilho (F22/D13).
- Props sugeridas: `{ summary: string; children: React.ReactNode; id?: string }` — o `aria-controls` referencia o id da região.
- Ícone: `ChevronDown` de `lucide-react` com rotação (`rotate-180`) quando aberto — padrão `account-menu.tsx:51`.
- **Proibido:** tooltip como único veículo, lista permanente de regras, altura permanente ocupada quando colapsado.

---

### Indicador "Recomendado" (estado textual, D3)

**Análogo parcial:** `src/components/ui/badge.tsx` (23 linhas)

**Padrão de badge com mapa de variantes** (`badge.tsx:8-22`):
```typescript
const variantClasses: Record<BadgeVariant, string> = {
  ready: "bg-accent-green/10 text-accent-green",
  // ...
};

export function Badge({ variant = "default", children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium font-heading ${variantClasses[variant]}`}
    >
      {children}
    </span>
  );
}
```

**Precedente de estado textual no próprio label** (`store-identity-form.tsx:1650` e `campaign-input-form.tsx:375-378`):
```typescript
<label htmlFor="subsegment" className={labelClass}>
  Subsegmento{" "}
  <span className="font-normal normal-case tracking-normal text-text-disabled">
    (opcional)
  </span>
</label>
```

**Regras a seguir (D3/D13):**
- "Recomendado" é **textual** e não bloqueante. Duas implementações aceitáveis: (a) `<span>` inline no label, seguindo o precedente `(opcional)` acima; (b) reuso do `Badge` existente com um novo `variant` — **evitar** criar variante nova em `badge.tsx` se isso alterar contrato de componente compartilhado; preferir `<span>` local.
- Nunca comunicar estado **apenas** por cor; `aria-label`/texto visível obrigatório.
- Tipografia: `text-[11px]`/`text-xs`, `font-heading font-medium`, `uppercase tracking-wide` (UI-SPEC §Typography).

---

### `src/components/flow/store-identity-form.tsx` (component, form CRUD)

**Blocos exatos a alterar:**

**1. Import do módulo de conteúdo novo** (após `store-identity-form.tsx:16`):
```typescript
import { tabBlockReasonText } from "@/lib/store-onboarding/reason-text";
// + import { STORE_FIELD_GUIDANCE, TONE_OF_VOICE_DESCRIPTIONS, ... } from "@/lib/store-onboarding/field-guidance";
```

**2. `TONE_OF_VOICE_OPTIONS`** (`store-identity-form.tsx:37-46`) — **manter** o array; a descrição contextual vem do módulo puro (D14), não deste array:
```typescript
const TONE_OF_VOICE_OPTIONS = [
  { value: 'profissional', label: 'Profissional' },
  { value: 'moderno', label: 'Moderno' },
  { value: 'elegante', label: 'Elegante' },
  { value: 'divertido', label: 'Divertido' },
  { value: 'acolhedor', label: 'Acolhedor' },
  { value: 'jovem', label: 'Jovem' },
  { value: 'tradicional', label: 'Tradicional' },
  { value: 'luxuoso', label: 'Luxuoso' },
] as const;
```

**3. Classes compartilhadas** (`store-identity-form.tsx:1328-1342`) — reusar `inputClass`/`selectClass`/`labelClass` para manter paridade visual:
```typescript
const inputClass = (field: string) =>
  `w-full bg-bg-surface border rounded-lg min-h-[44px] px-3.5 py-2.5 text-text-primary text-sm font-body placeholder:text-text-muted transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-blue/20 ${
    touched[field] && fieldErrors[field]
      ? "border-accent-red"
      : "border-border-light hover:border-text-muted"
  }`;

const labelClass = "block text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2";
```

**4. Atalhos fiscais → nome (PRESERVAR exatamente)** (`store-identity-form.tsx:1607-1622`):
```typescript
{cnpjLookupStatus === 'resolved' && cnpjLookupData && (
  <div className="mt-2 flex flex-wrap gap-2">
    {cnpjLookupData.nome_fantasia ? (
      <button type="button" onClick={() => setField("name", cnpjLookupData.nome_fantasia as string)}
        className="text-xs text-accent-blue hover:text-accent-blue/80 font-body underline transition-colors">
        Usar nome fantasia como nome da loja
      </button>
    ) : null}
    {cnpjLookupData.razao_social ? (
      <button type="button" onClick={() => setField("name", cnpjLookupData.razao_social as string)}
        className="text-xs text-accent-blue hover:text-accent-blue/80 font-body underline transition-colors">
        Usar razão social como nome da loja
      </button>
    ) : null}
  </div>
)}
```

**5. `Nome da Loja` — padrão label + input + erro** (`store-identity-form.tsx:1628-1634`). É **aqui** que entra o hint de nome público e `aria-describedby`/`aria-required`:
```typescript
<div>
  <label htmlFor="name" className={labelClass}>Nome da Loja *</label>
  <input id="name" type="text" value={formData.name} onChange={(e) => setField("name", e.target.value)} onBlur={() => handleBlur("name")} placeholder="Ex: Minha Loja" maxLength={60} className={inputClass("name")} />
  {touched.name && fieldErrors.name && (
    <p className="mt-1.5 flex items-center gap-1.5 text-accent-red text-xs"><AlertCircle className="w-3.5 h-3.5" />{fieldErrors.name}</p>
  )}
</div>
```

**6. Card informativo Posicionamento** (`store-identity-form.tsx:1949-1954`):
```typescript
<div className="mb-6 flex items-start gap-3 bg-bg-elevated border border-border rounded-lg px-4 py-3">
  <Sparkles className="w-5 h-5 text-accent-green shrink-0 mt-0.5" />
  <p className="text-text-secondary text-sm font-body flex-1">
    Essas informações ajudam o Vendeo a criar artes com linguagem, estilo e argumentos mais próximos da sua loja.
  </p>
</div>
```

**7. Tom de Voz + Posicionamento + Descrição Curta + Slogan** (`store-identity-form.tsx:1956-1978`) — bloco completo a receber hints/descrição contextual/recomendado/expansível:
```typescript
<div className="space-y-4">
  <div>
    <label htmlFor="tone_of_voice" className={labelClass}>Tom de Voz</label>
    <select id="tone_of_voice" value={formData.tone_of_voice} onChange={(e) => setField("tone_of_voice", e.target.value)} className="w-full bg-bg-surface border border-border-light rounded-lg min-h-[44px] px-3.5 py-2.5 text-text-primary text-sm font-body transition-colors duration-200 hover:border-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue/20">
      <option value="">Selecione</option>
      {TONE_OF_VOICE_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
  <div>
    <label htmlFor="positioning" className={labelClass}>Posicionamento</label>
    <input id="positioning" type="text" value={formData.positioning} onChange={(e) => setField("positioning", e.target.value)} placeholder="Ex: A melhor loja de..." className="w-full bg-bg-surface border border-border-light rounded-lg min-h-[44px] px-3.5 py-2.5 text-text-primary text-sm font-body placeholder:text-text-muted transition-colors duration-200 hover:border-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue/20" />
  </div>
  <div>
    <label htmlFor="short_description" className={labelClass}>Descrição Curta</label>
    <textarea id="short_description" value={formData.short_description} onChange={(e) => setField("short_description", e.target.value)} placeholder="Descreva sua loja em poucas palavras..." rows={3} className="w-full bg-bg-surface border border-border-light rounded-lg min-h-[44px] px-3.5 py-2.5 text-text-primary text-sm font-body placeholder:text-text-muted transition-colors duration-200 hover:border-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue/20 resize-none" />
  </div>
  <div>
    <label htmlFor="slogan" className={labelClass}>Slogan</label>
    <input id="slogan" type="text" value={formData.slogan} onChange={(e) => setField("slogan", e.target.value)} placeholder="Ex: Sua loja de confiança" className="w-full bg-bg-surface border border-border-light rounded-lg min-h-[44px] px-3.5 py-2.5 text-text-primary text-sm font-body placeholder:text-text-muted transition-colors duration-200 hover:border-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue/20" />
  </div>
</div>
```

**Regras a seguir:**
- **Não** introduzir `required` nativo; adicionar apenas `aria-required="true"` no input obrigatório (`name`, `segment`).
- **Não** tocar em `useStoreForm`/`setField`/`handleBlur`/auto-save/draft/drift — apenas apresentação.
- `aria-describedby` aponta para os ids de hint (`FieldHint`) e erro; manter o `<p>` de erro existente com `AlertCircle`.
- A subseção "Dados fiscais" é agrupamento visual (wrapper `<div>`/heading) em volta de CNPJ/Razão Social/Nome Fantasia (`:1584-1623`) — **sem** mover campos para fora da aba Dados e **sem** alterar o lookup.
- Placeholder de Posicionamento muda de `Ex: A melhor loja de...` para começo de frase útil (`Ex: Somos uma loja de...`) — co-migrar asserções se houver.

---

### `src/components/flow/campaign-input-form.tsx` (component, form)

**Blocos exatos a alterar:**

**1. Imports** (`campaign-input-form.tsx:1-24`) — adicionar import do módulo puro de campanha + primitivos de ajuda.

**2. Seção Produto / Descrição do produto** (`campaign-input-form.tsx:337-406`). O bloco de label + textarea + contador é o alvo do rename conceitual e do novo placeholder:
```typescript
<div>
  <label
    htmlFor="description"
    className="block text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2"
  >
    Descrição{" "}
    <span className="font-normal normal-case tracking-normal text-text-disabled">
      (opcional)
    </span>
  </label>
  <div className="relative">
    <textarea
      id="description"
      value={fields.description}
      onChange={(e) => setField("description", e.target.value)}
      onBlur={() => handleBlur("description")}
      placeholder="Ex: 20% OFF em todo o estoque"
      maxLength={120}
      rows={3}
      disabled={isSubmitting}
      className={`min-h-[44px] w-full bg-bg-surface border rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-body placeholder:text-text-muted transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-blue/20 resize-none ${
        touched.description && fieldErrors.description
          ? "border-accent-red"
          : "border-border-light hover:border-text-muted"
      }`}
    />
    <p className="text-xs text-text-muted text-right mt-1">
      {fields.description.length}/120
    </p>
  </div>
  {touched.description && fieldErrors.description && (
    <p className="mt-1.5 flex items-center gap-1.5 text-accent-red text-xs">
      <AlertCircle className="w-3.5 h-3.5" />
      {fieldErrors.description}
    </p>
  )}
</div>
```
→ manter `fields.description`, `maxLength={120}`, contador `{fields.description.length}/120`; trocar label para "Descrição do produto", placeholder para exemplo real de produto e adicionar hint.

**3. Bloco permanente das 3 regras de preço — a SUBSTITUIR pela ajuda expansível** (`campaign-input-form.tsx:427-432`):
```typescript
<div className="mb-3 space-y-0.5 text-text-muted text-xs font-body leading-relaxed">
  <p>Os campos de preço definem a intenção da campanha:</p>
  <p>Preço original + preço final = Oferta</p>
  <p>Somente preço final = Oferta ou Destaque</p>
  <p>Sem nenhum preço preenchido = Destaque ou Exclusividade</p>
</div>
```

**4. Campos de preço** (`campaign-input-form.tsx:433-464` original / `:466-494` final). Padrão label + input + erro a preservar (labels passam a "Preço anterior (original)" / "Preço de venda (final)"):
```typescript
<div>
  <label
    htmlFor="originalPrice"
    className="block text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2"
  >
    Preço Original{" "}
    <span className="font-normal normal-case tracking-normal text-text-disabled">
      (opcional)
    </span>
  </label>
  <input
    id="originalPrice"
    type="text"
    inputMode="decimal"
    value={displayPriceOriginal}
    onChange={(e) => handlePriceOriginalChange(e.target.value)}
    onBlur={() => handleBlur("originalPriceCents")}
    placeholder="R$ 0,00"
    disabled={isSubmitting}
    className={`min-h-[44px] w-full bg-bg-surface border rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-body placeholder:text-text-muted transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-blue/20 ${
      touched.originalPriceCents && fieldErrors.originalPriceCents
        ? "border-accent-red"
        : "border-border-light hover:border-text-muted"
    }`}
  />
  {touched.originalPriceCents && fieldErrors.originalPriceCents && (
    <p className="mt-1.5 flex items-center gap-1.5 text-accent-red text-xs">
      <AlertCircle className="w-3.5 h-3.5" />
      {fieldErrors.originalPriceCents}
    </p>
  )}
</div>
```

**5. `IntentSelector` — NÃO ALTERAR** (`campaign-input-form.tsx:242-292`). Apenas referência para o feedback dinâmico espelhar `availableOptions` (`:544-553`):
```typescript
availableOptions={
  (() => {
    const inferred = inferIntent(fields.originalPriceCents, fields.discountedPriceCents);
    if (inferred === "offer") return ["offer"];
    if (fields.discountedPriceCents !== undefined && (fields.discountedPriceCents ?? 0) > 0) {
      return ["offer", "spotlight"];
    }
    return ["spotlight", "exclusive"];
  })()
}
```
→ O feedback dinâmico (D9) deve ser uma função pura no módulo `field-guidance.ts` que **produz a mesma classificação** de 4 estados, com o estado "só anterior" → mensagem neutra. Não alterar esta expressão.

**6. Seção Avisos + `MandatoryArtworkField`** (`campaign-input-form.tsx:590-602`):
```typescript
<h2 className="text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2">
  Avisos e texto obrigatório
</h2>

<IllustrativeNoticeField
  checked={fields.showIllustrativeNotice}
  onChange={(c) => setField("showIllustrativeNotice", c)}
/>

<MandatoryArtworkField
  value={fields.mandatoryArtworkTextFree}
  onChange={(v) => setField("mandatoryArtworkTextFree", v)}
/>
```

**Regras a seguir:**
- **Não** alterar `setField`/`handleBlur`/`buildCampaignGenerationBody`/`ValidityField`/`IntentSelector`.
- O feedback de preço é **somente leitura derivada** — nenhum `setField`, nenhuma validação nova, nenhum bloqueio do botão.
- `aria-describedby` dos campos de preço aponta para o hint + o feedback.
- `aria-required="true"` em `productName` e nos campos obrigatórios para `offer` (sem `required` nativo).

---

### `src/components/campaign/mandatory-artwork-field.tsx` (component, campo)

**Arquivo completo atual** (34 linhas) — todo o corpo é o alvo:
```typescript
"use client";

interface MandatoryArtworkFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export function MandatoryArtworkField({ value, onChange }: MandatoryArtworkFieldProps) {
  return (
    <div>
      <label
        htmlFor="mandatoryArtworkText"
        className="block text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2"
      >
        Texto obrigatório na arte{" "}
        <span className="font-normal normal-case tracking-normal text-text-disabled">
          (opcional)
        </span>
      </label>
      <textarea
        id="mandatoryArtworkText"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Consulte condições na loja. Promoção não cumulativa."
        maxLength={200}
        rows={2}
        className="min-h-[44px] w-full bg-bg-surface border border-border-light rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-body placeholder:text-text-muted transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-blue/20 resize-none hover:border-text-muted"
      />
      <p className="text-xs text-text-muted mt-1">
        Use para regras, restrições ou informações que precisam aparecer na arte.
      </p>
    </div>
  );
}
```

**Mudanças (D10/D11):** label → "Informações obrigatórias na arte"; placeholder multi-linha com exemplo real incluindo uma restrição (`Intensidade 8\nTorra clássica\nVenda proibida para menores`); microcopy positiva ("Informe características, detalhes ou restrições que precisam aparecer na imagem. Use preferencialmente uma linha para cada item."); `rows` maior (≥ 3); `id`/`aria-describedby` para a microcopy.

**Regras a seguir:**
- **Manter** `id="mandatoryArtworkText"`, `value`/`onChange`, `maxLength={200}` — contrato com `campaign-input-form.tsx:599-602` e o campo legado.
- **NÃO** adicionar `required`, validação, checkbox wrapper ou fluxo secundário.
- **NÃO** adicionar avisos negativos ("Não repita preço/validade/aviso ilustrativo").
- Para o placeholder multi-linha, usar string com `\n` (atributo `placeholder` suporta quebras em `<textarea>`) ou `defaultValue` textual — não introduzir JSX complexo.

---

### `src/components/flow/campaign-brief-review.tsx` (component, revisão)

**Blocos exatos a alterar (apresentação apenas):**

**1. Derivação atual dos avisos** (`campaign-brief-review.tsx:69-76`) — **manter** `buildMandatoryArtworkText` intocado:
```typescript
const intent = inferIntent(fields.originalPriceCents, fields.discountedPriceCents);
const validity = fields.campaignIntent === "offer" ? buildValidityDisplayText(fields) : undefined;
const mandatoryArtworkText = buildMandatoryArtworkText(
  fields.showIllustrativeNotice,
  fields.mandatoryArtworkTextFree,
);
const primaryImage = preparedImages?.find((img) => img.role === "primary") ?? preparedImages?.[0];
const referenceImages = preparedImages?.filter((img) => img.role !== "primary") ?? [];
```

**2. Seção Produto** (`campaign-brief-review.tsx:138-146`) — rótulo "Descrição do produto" pode ser exibido aqui:
```typescript
<section aria-label="Produto" className="bg-bg-surface border border-border rounded-xl p-4">
  <h3 className="text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-3">
    Produto
  </h3>
  <p className="text-text-primary text-base font-heading font-semibold">{fields.productName}</p>
  {fields.description && (
    <p className="text-text-secondary text-sm font-body mt-1">{fields.description}</p>
  )}
</section>
```

**3. Seção Oferta — rótulos de preço a alinhar** (`campaign-brief-review.tsx:163-178`):
```typescript
{fields.originalPriceCents > 0 && (
  <div className="flex items-center gap-2">
    <dt className="text-text-muted text-sm font-body w-28 shrink-0">Preço original</dt>
    <dd className="text-text-secondary text-sm font-body line-through">
      {formatCurrencyBRL(fields.originalPriceCents)}
    </dd>
  </div>
)}
{fields.discountedPriceCents !== undefined && fields.discountedPriceCents > 0 && (
  <div className="flex items-center gap-2">
    <dt className="text-text-muted text-sm font-body w-28 shrink-0">Preço final</dt>
    <dd className="text-text-primary text-sm font-body font-semibold">
      {formatCurrencyBRL(fields.discountedPriceCents)}
    </dd>
  </div>
)}
```
→ renomear `dt` para "Preço anterior" / "Preço de venda" (D12). `validity` permanece em item próprio (`:179-184`).

**4. Seção Avisos — HOJE concatenada num único parágrafo** (`campaign-brief-review.tsx:227-246`):
```typescript
<section aria-label="Avisos" className="bg-bg-surface border border-border rounded-xl p-4">
  <h3 className="text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-3">
    Avisos
  </h3>
  <div className="flex items-start gap-2">
    <span
      aria-hidden="true"
      className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
        fields.showIllustrativeNotice
          ? "bg-accent-green border-accent-green text-white"
          : "border-border-light bg-bg-surface"
      }`}
    >
      {fields.showIllustrativeNotice && <Check className="w-3 h-3" />}
    </span>
    <p className="text-text-primary text-sm font-body">
      {mandatoryArtworkText ?? "Sem avisos adicionais."}
    </p>
  </div>
</section>
```
→ separar em **itens distintos e rotulados**: (a) linha do aviso ilustrativo quando `fields.showIllustrativeNotice`; (b) bloco "Informações obrigatórias na arte" quando `fields.mandatoryArtworkTextFree.trim()` não vazio; (c) fallback "Sem avisos adicionais." quando nenhum. **Derivar de `fields`, nunca de `mandatoryArtworkText` concatenado** para separar categorias.

**Regras a seguir:**
- **Não** alterar `buildMandatoryArtworkText`, `inferIntent`, `buildValidityDisplayText`, o body, o snapshot ou o HTTP.
- Manter `aria-label` das `<section>` e o padrão visual `bg-bg-surface border border-border rounded-xl p-4` + `h3` uppercase.
- Cada item separado usa o mesmo padrão de linha `flex items-start gap-2` + `<p className="text-text-primary text-sm font-body">`.
- Não renderizar a seção Tema enquanto `creativeContext.themeId` for null.

---

### Consumidores/fences — assinaturas exatas para testes de não-mudança

**`src/components/flow/use-campaign-form.ts`** — importar **do mesmo caminho** nos testes novos (não duplicar):

```typescript
// :119-135
export interface CampaignFormFields {
  productName: string;
  description: string;
  originalPriceCents: number;
  discountedPriceCents: number | undefined;
  badge: string;
  campaignIntent: CampaignIntent;
  preserveImageContext: boolean;
  productImages: CampaignProductFormImage[];
  mandatoryArtworkText: string; // compat/derivado: espelho de mandatoryArtworkTextFree, NUNCA o texto final concatenado (D3)
  showIllustrativeNotice: boolean;
  mandatoryArtworkTextFree: string;
  validityMode: ValidityMode;
  validityStartDate: string;
  validityEndDate: string;
  validityCustomText: string;
}

// :379-403
export function buildValidityDisplayText(fields: {
  validityMode: ValidityMode;
  validityStartDate: string;
  validityEndDate: string;
  validityCustomText: string;
}): string | undefined

// :405-415
export function buildMandatoryArtworkText(
  showNotice: boolean,
  freeText: string
): string | undefined

// :417-427
export function inferIntent(
  originalPriceCents: number,
  discountedPriceCents: number | undefined | null
): CampaignIntent

// :466-475 (+ corpo até :496)
export function buildCampaignGenerationBody(
  fields: CampaignFormFields,
  preparedImages: PreparedCampaignImage[],
  storeId: string,
  options?: {
    inputValidationOverride?: {
      productImageCheck: "brief_review_confirmed" | "user_confirmed_continue";
    };
  }
): Record<string, unknown>
```
> Nota: `buildMandatoryArtworkText` usa `ILLUSTRATIVE_NOTICE_TEXT` de `@/lib/campaign/constants` (`:409`) — o teste de não-mudança pode afirmar as 4 combinações exatas (padrão já existente em `use-campaign-form-notice.test.ts:146-150`).

**`src/lib/store-onboarding/tabs.ts`** — `computeTabUnlock` (`:62-101`); o caso `needs_tone_of_voice` está em `:93-94`:
```typescript
export function computeTabUnlock(
  tab: OnboardingTab,
  ctx: TabUnlockContext,
): { unlocked: boolean; reason?: TabBlockReason }
// ...
if (!ctx.toneOfVoice.trim()) {
  return { unlocked: false, reason: "needs_tone_of_voice" };
}
```

**`src/lib/store-onboarding/reason-text.ts`** — `tabBlockReasonText(tab, reason, label?)` (`:23-42`); caso `needs_tone_of_voice` (`:34-35`).

**`src/lib/image-generation/services/art-director-briefing.ts`** — fence verificado: **nenhuma ocorrência de `description`** no arquivo (grep em 2026-09-18). Teste de não-mudança: o briefing do diretor **não** contém `product.description`.

**`src/lib/copy/mapper.ts:106`** — consumidor real da descrição:
```typescript
description: brief.product.description,
```
Teste de correspondência (D14): `mapBriefToCopyDirectorInput(brief).description === brief.product.description` e a string **não** aparece em `art-director-briefing`.

---

### Testes existentes a co-migrar (estilo de query)

| Arquivo | Estilo de query real | Asserções a co-migrar |
|---|---|---|
| `src/components/flow/__tests__/campaign-input-form-price-helper.test.tsx` | `screen.getByLabelText("Preço Final")` (`:115`); `screen.getByText("Preço Final")` + `.textContent` (`:120-129`); `getByText` das 3 regras (`:134-137`) | labels de preço; bloco permanente de 3 regras → ajuda expansível |
| `src/components/flow/__tests__/campaign-input-form.test.tsx` | `screen.getByText("Informe uma data válida (dd/mm/aaaa)")` (`:118`); mock de `use-campaign-form` com `importOriginal` (`:24-70`) | microcopy/labels; mock precisa incluir novos campos se algum for lido |
| `src/components/flow/__tests__/campaign-brief-review.test.tsx` | `getByText("Tênis Runner Pro")`, `getByText(/Imagem meramente ilustrativa/)`, `getByText(/Frete grátis acima de R\$ 199/)` (`:97-136`) | separação de categorias na seção Avisos |
| `src/components/flow/__tests__/use-campaign-form-notice.test.ts` | imports diretos + `expect(buildMandatoryArtworkText(...)).toBe(...)` (`:146-150`) | **fence** — não mudar comportamento |
| `src/components/flow/__tests__/use-campaign-form-review.test.ts` | imports `buildCampaignGenerationBody`/`buildValidityDisplayText`/`buildMandatoryArtworkText` (`:7`); fixtures `showIllustrativeNotice`/`mandatoryArtworkTextFree` (`:278-279`, `:345-346`) | **fence** — body idêntico |
| `src/components/flow/__tests__/store-identity-form.aceite-legal.test.tsx` | `fireEvent.change(screen.getByLabelText(/Nome da Loja/i), ...)` (`:130`); `getByLabelText(/^Segmento/i)` (`:133`); `findByRole("heading", { name: "Posicionamento" })` (`:196`) | labels da aba Dados/Posicionamento |
| `src/components/flow/__tests__/store-identity-form.drift-tabs.test.ts` | `screen.getByText("Direção visual desatualizada")` (`:633`); fixtures com `slogan: "Slogan"` (`:116-128`, `:394`) | microcopy de drift; **não** alterar comportamento |
| `src/components/flow/__tests__/store-tabs.test.tsx` | `screen.getByRole("tab", { name: /Posicionamento/ })` (`:63-64`); `getByRole("tabpanel")` (`:72`); `getByText("Pendente")` (`:197`) | labels de abas — não devem mudar |
| `src/components/flow/__tests__/store-page-client.test.tsx` | `screen.getByTestId("store-identity-form")` (`:30`) | render do form — regressão |
| `src/components/campaign/__tests__/validity-field.test.tsx` | `screen.getByLabelText("Data final")` (`:24`); `getByText("Informe uma data válida (dd/mm/aaaa)")` (`:105`) | **regressão** — `validity-field.tsx` NÃO é modificado |

**Estilo de teste de módulo puro (novo):** copiar de `src/lib/store-onboarding/__tests__/reason-text.test.ts` (40 linhas) — `import { describe, it, expect } from "vitest"` + import relativo `../field-guidance` + `expect(fn(...)).toBe(...)`. **Sem** `@vitest-environment jsdom`, **sem** Testing Library.

**Estilo de teste de disclosure (novo):** `src/__tests__/components/shell/account-menu.test.tsx:70-75`:
```typescript
const trigger = screen.getByRole("button", { name: /.../ });
expect(trigger.getAttribute("aria-expanded")).toBe("false");
// após clique/teclado:
expect(trigger.getAttribute("aria-expanded")).toBe("true");
```

---

## Shared Patterns

### Associação campo↔ajuda por `aria-describedby`
**Fonte:** `src/app/(app)/admin/laboratorio/_components/lab-textarea.tsx:29-35` e `lab-select.tsx:31-37`
**Aplicar a:** todos os campos com hint/descrição/feedback (Nome da Loja, Tom de Voz, Posicionamento, Descrição Curta, Slogan, Descrição do produto, Preços, Informações obrigatórias)
```typescript
const helpBase = useId();
const hintId = `${helpBase}-hint`;
const descriptionId = `${helpBase}-description`;
const feedbackId = `${helpBase}-feedback`;
const errorId = `${helpBase}-error`;
const describedBy = [
  hintId,
  hasDescription ? descriptionId : null,
  feedback ? feedbackId : null,
  error ? errorId : null,
].filter(Boolean).join(" ");
// ...
aria-invalid={error ? true : undefined}
aria-describedby={describedBy || undefined}
```
> **Padrão canônico F49 (correção de acessibilidade):** o **id do próprio campo** permanece estático e canônico (`name`, `tone_of_voice`, `positioning`, `description`, `discountedPrice`, `mandatoryArtworkText`, …) para preservar `htmlFor`/`getByLabelText`; apenas os **ids de ajuda** derivam de `useId()` (`${helpBase}-hint|-description|-feedback|-error`). O campo consumidor é quem chama `useId` — `FieldHint` continua apresentacional (recebe `id`). O erro existente passa a ter `id={errorId}` e entra no `aria-describedby`; `aria-invalid` é preservado/explicitado nos campos com erro. Todos os textos aplicáveis (hint + descrição contextual + feedback + erro) entram no `aria-describedby` via `.filter(Boolean).join(" ")`.

### Erro de campo
**Fonte:** `store-identity-form.tsx:1631-1633`, `campaign-input-form.tsx:362-367`
**Aplicar a:** todos os campos com validação existente (inalterado)
```typescript
{touched.name && fieldErrors.name && (
  <p className="mt-1.5 flex items-center gap-1.5 text-accent-red text-xs">
    <AlertCircle className="w-3.5 h-3.5" />
    {fieldErrors.name}
  </p>
)}
```

### Hint/feedback (texto auxiliar)
**Fonte:** `lab-textarea.tsx:54-58` (classe de cor ajustada pela UI-SPEC F49)
**Aplicar a:** hints curtos, descrição contextual de opção e feedback dinâmico
```typescript
<p id={hintId} className="text-xs text-text-secondary font-body">
  {hint}
</p>
```
> **Correção de contraste (F49):** hint e feedback usam **`text-text-secondary`** (`#94A3B8`, 6,96:1/7,87:1). A fonte `lab-textarea.tsx` usa `text-text-muted`, mas a UI-SPEC/F49 manda `secondary` — nunca usar `text-text-muted` em instruções. O `FieldHint` resolve isso pelo mapa de `tone` (default `"secondary"`), sem classe de cor concorrente.
> Feedback neutro de "só preço anterior" usa `tone="amber"` (`text-accent-amber`, UI-SPEC §Color: orientação, não erro).

### Classes de campo (paridade visual)
**Fonte:** `store-identity-form.tsx:1328-1342` e `campaign-input-form.tsx:356-360`
**Aplicar a:** todos os inputs/selects/textareas tocados
```typescript
`min-h-[44px] w-full bg-bg-surface border rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-body placeholder:text-text-muted transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-blue/20 ${
  touched[field] && fieldErrors[field] ? "border-accent-red" : "border-border-light hover:border-text-muted"
}`
```

### Seção (cabeçalho)
**Fonte:** `campaign-input-form.tsx:337-339`, `campaign-brief-review.tsx:139-141`
**Aplicar a:** agrupamentos/seções novas
```typescript
<h3 className="text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-3">
  {titulo}
</h3>
```

### Sem `cn` — concatenação por template literal
**Fonte:** todo o repo (grep por `export function cn` = 0 resultados)
**Aplicar a:** todos os primitivos novos. **Não** criar dependência `clsx`/`tailwind-merge`.

---

## No Analog Found

| Arquivo | Papel | Fluxo | Motivo |
|---|---|---|---|
| Indicador "Recomendado" (componente dedicado) | component | request-response | Não existe primitivo de estado textual recomendado; `Badge` (`src/components/ui/badge.tsx`) tem semântica de status de campanha. **Planner deve usar `<span>` inline no label** (padrão `(opcional)` de `store-identity-form.tsx:1650`) ou estender `Badge` com cautela. |
| `src/lib/campaign/field-guidance.ts` (função de feedback de preço) | utility | transform | Não existe módulo de microcopy de campanha; usar `reason-text.ts` como molde de forma, e derivar o feedback de 4 estados conforme D9 (sem importar `inferIntent` — correspondência provada em teste). |

## Metadata

**Escopo da busca de análogos:** `src/lib/store-onboarding/**`, `src/lib/campaign/**`, `src/lib/constants.ts`, `src/lib/copy/**`, `src/components/ui/**`, `src/components/campaign/**`, `src/components/flow/**`, `src/app/(app)/admin/laboratorio/_components/**`, `src/components/shell/**`, `src/lib/image-generation/services/art-director-briefing.ts`.
**Arquivos escaneados:** ~30 (leitura integral ou por blocos não sobrepostos).
**Padrões extraídos:** 2026-09-18.
**Verificações de fence (2026-09-18):** `art-director-briefing.ts` sem `description`; `computeTabUnlock` → `needs_tone_of_voice` em `tabs.ts:93-94`; `buildMandatoryArtworkText`/`inferIntent`/`buildCampaignGenerationBody` presentes e intocados; `validity-field.tsx` não modificado.
**Divergências do CONTEXT/UI-SPEC registradas:** existem `<details>` (`evaluation-form.tsx:293`, `reviews/page.tsx:192`); não existe utilitário `cn`; `campaign-input-form.tsx` tem **684** linhas (CONTEXT dizia 651) e `store-identity-form.tsx` tem **2735** (CONTEXT dizia 2601) — nenhuma afeta o escopo.
