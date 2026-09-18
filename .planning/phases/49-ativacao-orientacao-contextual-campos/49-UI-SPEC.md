---
phase: 49
slug: ativacao-orientacao-contextual-campos
status: approved
shadcn_initialized: false
preset: none
created: 2026-09-18
source: openspec/changes/fase-49-ativacao-orientacao-contextual-campos/ (design D2/D3/D4/D5/D6/D7/D9/D10/D11/D12/D13 + specs contextual-field-help / store-field-orientation / campaign-field-orientation / store-identity-ui / campaign-input-ui / mandatory-artwork-text / campaign-brief-review) + openspec/design-system/MASTER.md
---

# Phase 49 — UI Design Contract (Ativação e Orientação Contextual de Campos)

> Contrato visual e de interação da orientação contextual nos formulários de **loja** (`/loja`) e **campanha** (`/campanhas/nova`, incluindo a revisão F43). Consolidado a partir dos artefatos OpenSpec; **não introduz novas decisões de produto nem redesign**. A fonte da verdade do projeto prevalece: **dark OLED, Poppins/Open Sans, lucide-react, sem emojis, sem light mode**.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (Tailwind + `src/components/ui/` primitives) |
| Preset | not applicable |
| Component library | none — primitivos locais de ajuda de campo (`FieldHint`, `ExpandableHelp`, indicador "Recomendado"); localização final `src/components/ui/` × `src/components/campaign/` decidida na execução |
| Icon library | `lucide-react` (obrigatório; proibido emoji) |
| Font | Poppins (headings/labels), Open Sans (body) |

**Primitivos globais reutilizados:** `button`, `card`, `badge`, `input`, `empty-state`, `error-state`, `page-header`, `skeleton`, `loading-skeleton`, `pagination`.

**Primitivos de ajuda (D2):** `FieldHint` (texto associado por `aria-describedby`), `ExpandableHelp` (disclosure `<button aria-expanded>` + região revelada, ou `<details>/<summary>` nativo), descrição contextual renderizada pelo próprio componente do select, feedback dinâmico como texto derivado de função pura. **Não** promover a API genérica de formulário/context/registry.

**Precedente de a11y:** `src/app/(app)/admin/laboratorio/_components/lab-textarea.tsx` (`useId` + `aria-describedby` de erro + hint, `min-h` de toque ≥ 44px).

---

## Spacing Scale

Valores declarados (múltiplos de 4), conforme MASTER §4:

| Token | Value | Usage |
|-------|-------|-------|
| 2xs | 4px | Gaps de ícone, espaçamento inline apertado |
| xs | 8px | Espaçamento inline, gaps pequenos |
| sm | 12px | Padding de botão compacto |
| md | 16px | Padding de card padrão |
| lg | 24px | Padding de seção, entre cards |
| xl | 32px | Entre seções |
| 2xl | 48px | Margens de página, gaps grandes |
| 3xl | 64px | Padding de header/hero |

Exceptions: none. Hints/descrições/feedbacks usam `mt-1`/`mt-2` (8–12px) e não alteram o ritmo vertical dos campos.

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14–16px (`text-sm`/`text-base`) | Open Sans 400/500 | 1.5 |
| Label | 12px (`text-xs`) | Poppins 500 | 1.4 |
| Heading (seção) | 16–20px (`text-base`/`text-lg`) | Poppins 600 | 1.3 |
| Hint / feedback | 12–13px (`text-xs`/`text-sm`) | Open Sans 400 | 1.4 |
| Estado (Recomendado/opcional) | 11–12px (`text-[11px]`/`text-xs`) | Poppins 500, uppercase tracking-wide | 1.3 |

Regras: hint e feedback em `text-text-muted`; mensagens de erro mantêm o padrão existente (`accent.red` + `AlertCircle`); o estado "Recomendado" é **textual** (nunca só cor).

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#020617` (`bg.deep`) | Fundo de página |
| Secondary (30%) | `#0F172A` (`bg.surface`) / `#1E293B` (`bg.elevated`) | Cards, seções, disclosure expandido |
| Accent (10%) | `#22C55E` (`accent.green`) | CTA principal de cada formulário apenas |
| Info/secondary | `#3B82F6` (`accent.blue`) | Links de ajuda, foco (`ring-2`), estados de opção selecionada |
| Warning | `#F59E0B` (`accent.amber`) | Feedback neutro de "só preço anterior" (orientação, não erro) |
| Destructive | `#EF4444` (`accent.red`) | Erros de validação existentes (inalterados) |

Texto: `#F8FAFC` (primary), `#94A3B8` (secondary), `#64748B` (muted), `#475569` (disabled). Bordas: `#1E293B` (DEFAULT), `#334155` (light). Contraste mínimo 7:1 no fundo escuro.

Accent reserved for: CTA principal de cada tela. Estados obrigatório/recomendado/opcional e ajuda **nunca** dependem apenas de cor.

---

## Screens & States (inventário)

| Rota | Papel | Estados obrigatórios |
|------|-------|----------------------|
| `/loja` — aba Dados | Subseção "Dados fiscais" (CNPJ/Razão Social/Nome Fantasia) separada do `Nome da Loja` (nome público); atalhos preservados | criação vs edição; lookup em andamento ("Consultando dados cadastrais..."); dados resolvidos (read-only + atalhos); draft sem CNPJ (aviso fiscal existente); erro de lookup existente |
| `/loja` — aba Posicionamento | Tom de Voz (crítico) + descrição contextual da opção; Posicionamento (label/hint/exemplo expansível); Descrição Curta (recomendada); Slogan (opcional) | sem seleção de tom (sem descrição); tom selecionado (descrição exibida); ajuda expansível colapsada/expandida; campos recomendados sinalizados; bloqueio real da Direção Visual (`needs_tone_of_voice`) inalterado |
| `/campanhas/nova` — Produto | "Descrição do produto" (mesmo campo/body) | vazio; preenchido; contador/maxLength 120 existente |
| `/campanhas/nova` — Oferta | "Preço de venda (final)" / "Preço anterior (original)" + hint; ajuda expansível "Como os preços mudam a campanha?"; feedback dinâmico | 4 estados de preço (dois, só venda, só anterior→neutro, nenhum); ajuda colapsada/expandida; `IntentSelector`/`ValidityField` existentes inalterados |
| `/campanhas/nova` — Avisos | Checkbox ilustrativo + "Informações obrigatórias na arte" (multi-linha, visível) | checkbox on/off; texto vazio/multi-linha; ambos coexistentes |
| Revisão do brief (F43) | Categorias separáveis: aviso ilustrativo, informações obrigatórias, validade, preços/oferta | ambos avisos presentes; só um presente; nenhum; rótulos alinhados; custo/saldo existentes |

**Layout:** mesma estrutura de seções já existente; hints curtos abaixo do campo; ajuda expansível **colapsada por padrão** (não ocupa altura permanente); mobile empilha sem scroll horizontal; touch targets ≥ 44×44px.

---

## Interaction Contract

- **Hint inline (D2a):** texto auxiliar de 1 linha sempre visível, associado ao campo por `aria-describedby` (id de `useId`).
- **Descrição contextual (D2b):** exibida apenas quando há opção selecionada; sem seleção → nada renderizado (ex.: Tom de Voz).
- **Ajuda expansível (D2c):** disclosure acionável por teclado, `aria-expanded` coerente, foco visível, revela/colapsa sem recarregar; colapsada por padrão. Usada em: exemplo de Posicionamento e "Como os preços mudam a campanha?".
- **Feedback dinâmico (D2d):** recalculado a partir dos valores atuais; reflete o comportamento real. Preços: dois → "A campanha será apresentada como oferta: de R$ X por R$ Y."; só venda → "Com apenas o preço de venda, você poderá escolher entre Oferta e Destaque."; **só anterior** → "Informe o preço de venda para completar a oferta." (neutro, **não** "Sem preço..."); nenhum → "Sem preço, a campanha será de Destaque ou Exclusividade.".
- **Estados (D3):** obrigatório = `*` + validação controlada atual + `aria-required="true"` (**sem** `required` nativo); recomendado = badge textual "Recomendado" (não bloqueante); opcional = `(opcional)`. Slogan **não** é recomendado.
- **A11y (D13):** `aria-describedby` liga campo↔hint/erro/feedback; `aria-invalid` preservado; disclosure com `aria-expanded`; sem dependência de hover/tooltip exclusivo; touch ≥ 44px.
- **Feedback visual:** transições 150–300ms; `cursor-pointer` em elementos clicáveis; erros existentes inalterados (`accent.red` + `AlertCircle`).
- **Proibido (D2/D10/D11):** listas permanentes de regras; avisos negativos preventivos; tooltip como único veículo; validador semântico/regex de intenção; prometer efeito que o pipeline não produz.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Nome da Loja (hint) | "Este é o nome público da sua loja. Ele aparece no Vendeo e é usado para identificar e assinar suas campanhas." |
| Dados fiscais (helper) | Dados cadastrais/oficiais (Receita Federal) usados para verificação/readiness |
| Tom de Voz (hint) | "Define como sua loja se comunica. O Vendeo usa essa escolha nos títulos, legendas e no clima visual das campanhas." |
| Tom de Voz (descrições) | 8 frases positivas (ex.: profissional → "Direta, confiável e sem exageros."; moderno → "Atual, objetiva e com energia contemporânea."; luxuoso → "Sofisticada, exclusiva e com senso de premium.") — redação final na execução |
| Posicionamento (label) | "Como você quer que sua loja seja percebida?" + termo secundário "Posicionamento da marca" |
| Posicionamento (hint/exemplo) | público/proposta/diferencial; exemplo "Somos uma loja de [categoria] para [público], reconhecida por [diferencial]." |
| Descrição do produto | "Descreva características, benefícios ou formas de uso que ajudam a apresentar o produto na comunicação da campanha." |
| Preços (labels/hints) | "Preço de venda (final)" / "Preço anterior (original)" + hint curto por campo |
| Ajuda de preços | "Como os preços mudam a campanha?" (3 regras reais) |
| Informações obrigatórias | "Informe características ou detalhes que precisam aparecer na imagem. Use uma linha para cada item." |
| Revisão (rótulos) | "Imagem meramente ilustrativa" · "Informações obrigatórias na arte" · "Preço anterior" · "Preço de venda" |

Tom: PT-BR, positivo e educativo, sem advertências negativas. Sem emojis.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable |
| third-party | none | not applicable |

Sem dependências novas de UI; primitivos locais + primitivos existentes + `lucide-react`.

---

## Non-Change Contract (fences)

- **Não muda:** body/validação/contrato HTTP, `buildCampaignGenerationBody`, `buildMandatoryArtworkText`, snapshot `campaign_brief_v1`, `GenerateImageRequestSchema`, helpers de `use-campaign-form.ts`, auto-save/draft, drift, `computeTabUnlock`/`reason-text`, prompts, pipeline, banco/storage.
- `src/components/campaign/validity-field.tsx` **não** é modificado (apenas regressão).
- Revisão do brief: separação de categorias **apenas de apresentação**, derivada de `showIllustrativeNotice`/`mandatoryArtworkTextFree`.
- Mobile: sem scroll horizontal (320px/375px), ajuda colapsada, touch ≥ 44px; UAT avalia **ausência de poluição**.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** consolidado da base OpenSpec em 2026-09-18 (autorizado pelo usuário) — **pendente de revisão humana final** junto com os demais artefatos da F49.
