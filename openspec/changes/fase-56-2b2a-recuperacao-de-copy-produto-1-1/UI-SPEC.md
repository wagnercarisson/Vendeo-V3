---
phase: B2.1
change: fase-56-2b2a-recuperacao-de-copy-produto-1-1
status: proposed-for-review
created: 2026-10-13
reviewed_at: null
shadcn_initialized: false
preset: none
---

# B2.1 — UI Design Contract: Recuperação de copy (Produto 1:1)

> Visual and interaction contract for **B2.1 — Recuperação de copy**.
> Rotina: `gsd-ui-researcher` propõe; `gsd-ui-checker` valida; **revisão humana obrigatória**.
> Fonte de verdade: `openspec/design-system/MASTER.md` + `openspec/design-system/pages/campaign-preview.md`,
> a UI-SPEC da b1b (`56.2.2-UI-SPEC.md`) e a change `fase-56-2b2a-recuperacao-de-copy-produto-1-1/`
> (proposal, design B2A-D1..D6, specs `product-1-1-copy-recovery`, tasks).

---

## Scope Guardrails (read first)

Esta fatia conecta **um** conjunto de controles visíveis: a **recuperação da copy** na página de
resultado persistido da campanha. Nada de imagem/estorno/D13 (B2.2), nada de autorização/teste real
(B2.3), nada de aprovação/reprovação/correção (F56.3).

**Âncora visual primária:** a ação **`Gerar os textos novamente`** (CTA secundária/outline,
oferecida **somente** quando a copy está pendente/falha). A entrega da imagem não muda.

**In scope (this contract covers):**

1. A **superfície de copy** no resultado persistido (`/campanhas/[id]`), com os estados
   **pendente / tentando / falha (auto esgotada) / concluída**.
2. A **ação manual de recuperação** (até 3 tentativas manuais; 6 no total por entrega), com
   **contador visível** e **anti-duplicação**.
3. Feedback **seguro** (sem motivo interno) e a distinção explícita de que a recuperação
   **não** regenera a imagem nem consome outro crédito.
4. A condição **sem retomada automática** (fechar o navegador interrompe o ciclo; retomada manual).

**Explicitamente fora de escopo (não desenhar/construir aqui):**

- Recuperação **de imagem**, estorno, D13 e o aviso de crédito estornado — **B2.2**.
- Autorização estreita, teste real e preview — **B2.3**.
- Aprovação/reprovação/correção e edição livre — **F56.3**.
- O botão legado `Regenerar`/`Tentar Novamente` da campanha **inteira** (fluxo legado /
  `campaign-preview.md`): **não** é a recuperação de copy e **não** deve ser reutilizado para ela.
- Novo design token, light mode ou biblioteca de componentes.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none — custom design system (`openspec/design-system/MASTER.md`) |
| Component library | none (primitivos em `src/components/ui/*`; sem radix/base-ui) |
| Icon library | `lucide-react` (**sem emojis** — MASTER §12) |
| Font | `Poppins` (headings/labels) + `Open Sans` (body) + `JetBrains Mono` (dados/IDs) |
| Theme | Dark Mode (OLED) — **sem light mode** |

**Reuse, do not reinvent.**

- `src/app/(app)/campanhas/[id]/client.tsx` — view de resultado persistido + poll `router.refresh()` 5s.
- `src/components/flow/generation-progress.tsx` — shell de estado (reuso visual; **não** usar o
  estado “resultado desconhecido” aqui).
- `src/components/ui/*` — `Button`, `Card`, `Badge`, `Alert`/banner classes.

**Patterns to copy verbatim (MASTER + b1b UI-SPEC):**

- Botão secundário/outline: `min-h-[44px] px-6 py-2.5 border border-border-light text-text-primary rounded-lg hover:bg-bg-elevated transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed`.
- Botão primário (só para CTA principal de tela): `bg-accent-green text-white font-heading font-semibold`.
- Sucesso: `text-accent-green` + `Check`.
- Erro/validação: `text-accent-red` + `AlertCircle`, `role="alert"`.
- Atenção/falha de copy: **amber** (`accent-amber`) para “não conseguimos gerar os textos” —
  falha de copy **não** é falha da campanha e **não** bloqueia a arte.
- Spinner: `Loader2` (`animate-spin`), usado só no estado “tentando”.
- Contador/IDs: `JetBrains Mono` 12px.

---

## Spacing & Sizing

Reuso integral do MASTER §4 e da UI-SPEC da b1b (múltiplos de 4). Sem token novo.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | gap ícone↔texto |
| sm | 8px | label→controle |
| md | 16px | padding de card, gaps (`gap-3`/`gap-4`) |
| lg | 24px | padding de seção (`space-y-6`) |

- **Touch/click targets:** mínimo **44px** de altura em todo controle interativo.
- Largura: a superfície de copy segue o container do resultado (`max-w-2xl`, espelhando
  `campanhas/[id]/client.tsx`).

---

## Typography

Reuso do MASTER §3 e da UI-SPEC da b1b. Sem novo tamanho/peso.

| Role | Size | Weight | Font |
|------|------|--------|------|
| Corpo | 14px (`text-sm`) | 400 | Open Sans |
| Label/Caption | 12px (`text-xs`) | 500, uppercase, `tracking-wider` | Poppins |
| Título de card | 14px (`text-sm`) | 500 | Poppins |
| Heading de seção | 20px (`text-xl`) | 600 | Poppins |
| Contador/IDs (`Tentativa 4 de 6`) | 12px (`text-xs`) | 500 | JetBrains Mono |

---

## Color

60/30/10 (MASTER §2). **Dark OLED apenas; sem `#FFFFFF` de fundo.**

| Role | Value | Usage nesta fatia |
|------|-------|-------------------|
| Dominante (60%) | `#020617` `bg-bg-deep` | fundo da página |
| Secundário (30%) | `#0F172A` `bg-bg-surface` / `#1E293B` `bg-bg-elevated` | card de copy |
| Accent (10%) | `#22C55E` `accent-green` | **reservado**: sucesso da copy (`Textos gerados.`) |
| Informação | `#3B82F6` `accent-blue` | estado **tentando** (em andamento) |
| Atenção | `#F59E0B` `accent-amber` | copy em **falha** (atenção, **não** erro da campanha) |
| Destrutivo/erro | `#EF4444` `accent-red` | apenas erro de rede/validação do acionamento |

**Regra semântica:** falha de **copy** ≠ falha da **campanha**. A copy falha em **amber**; a arte
entregue permanece visível e baixável, **inalterada**. Nunca usar vermelho para “não conseguimos
gerar os textos”.

---

## Surface — Recuperação de copy

**Onde:** página de resultado persistido `/campanhas/[id]` (`src/app/(app)/campanhas/[id]/client.tsx`),
bloco de copy abaixo/junto da arte. **Não** cria rota nova.

**Anatomia:**

```
<CopyStatusPanel>                                   (card, bg-bg-surface)
  ├─ A. Eyebrow "Copy da campanha" + estado atual   (badge)
  ├─ B. Texto entregue (quando concluída)           (Open Sans 14px; somente leitura nesta fatia)
  ├─ C. Feedback seguro (sem motivo interno)         (Open Sans 14px)
  ├─ D. Contador de tentativas                        (JetBrains Mono 12px)
  ├─ E. Ação manual "Gerar os textos novamente"       (secondary/outline; condicional)
  ├─ F. Aviso de escopo                               (não regenera imagem; sem novo crédito)
  └─ G. Ajuda de suporte (quando o limite é atingido)
```

**Estados (badge + ícone + cor):**

| Estado | Badge | Cor | Feedback | Ação |
|--------|-------|-----|----------|------|
| `pendente` | `Gerando os textos...` | blue | spinner + `Loader2` | botão desabilitado |
| `tentando` | `Tentando novamente...` | blue | spinner + `Loader2` | botão desabilitado (anti-clique) |
| `falha` (auto esgotada) | `Não conseguimos gerar os textos` | amber | `AlertTriangle` + texto seguro | **`Gerar os textos novamente`** habilitado (se ainda há manual) |
| `concluída` | `Textos prontos` | green | `Check` + texto entregue | nenhuma ação de recuperação |

**Regras duras:**

- A recuperação **só** aparece quando a copy está **pendente/falha**; copy **concluída encerra** — o
  botão **não** é renderizado em `concluída` (B2A-D1).
- **Nunca regenera/altera a imagem**; a arte `delivered` permanece visível e baixável durante toda
  a recuperação (`Falha de copy não bloqueia arte entregue`).
- **Nunca** consome crédito adicional; nunca cria nova campanha.
- **Sem retomada automática:** se o navegador fechar, o ciclo automático **para**; ao retornar, a UI
  mostra o estado persistido e a retomada é **manual**. Proibido texto como “pode fechar a página”,
  “continuaremos” ou “retomaremos”.
- **Anti-duplicação:** enquanto `tentando`, o botão fica `disabled`; clique duplo/reload/reenvio **não**
  duplica tentativa nem reinicia contador (estado é server-side).
- **Limite:** `concluída` encerra; ao esgotar **6 tentativas** (3 automáticas + 3 manuais), o botão
  passa a `disabled` e exibe a ajuda de suporte; **não** há 7ª tentativa.
- **Feedback seguro:** nunca revelar motivo interno; usar mensagem comercial curta.

---

## Interaction & State Contract

| Estado | Comportamento |
|--------|---------------|
| Carregamento da página | Lê o **estado persistido** da copy; nunca infere por tempo. |
| `pendente` | Spinner; sem ação manual ainda durante o ciclo automático. |
| `tentando` (manual) | Botão `disabled`; uma única tentativa efetiva; contador avança **uma** vez. |
| `falha` (auto esgotada) | Exibe amber + CTA manual; contador mostra “Tentativas automáticas: 3 de 3”. |
| Clique manual | Envia **uma** tentativa; contador manual 1→2→3; **não** reinicia o ciclo automático. |
| Limite manual atingido | Botão `disabled`; mensagem de suporte. |
| `concluída` | Rende o texto entregue; sem CTA de recuperação. |
| Erro de rede/validação | Inline error (`accent-red`, `role="alert"`), sem alterar o estado persistido. |
| Reconexão/reload | Re-lê o estado persistido; nunca promete continuidade. |
| Reduced motion | Transições 150–300ms; `motion-safe:`/`motion-reduce:`; spinner é a única animação contínua. |

---

## Copywriting Contract

PT-BR, linguagem comercial simples, **sem emojis, sem jargão técnico** (MASTER §1).

| Elemento | Copy |
|----------|------|
| Eyebrow | `Copy da campanha` |
| Estado `pendente` | `Gerando os textos...` |
| Estado `tentando` | `Tentando novamente...` |
| Estado `falha` (feedback) | `Não conseguimos gerar os textos desta campanha.` |
| Estado `concluída` | `Textos prontos.` |
| Contador (auto) | `Tentativas automáticas: {n} de 3` |
| Contador (manual) | `Tentativas manuais: {m} de 3` |
| CTA manual | `Gerar os textos novamente` |
| Aviso de escopo | `Isso gera apenas os textos. A imagem da campanha não muda e nenhum crédito adicional é usado.` |
| Limite atingido | `Você atingiu o limite de tentativas. Fale com o suporte para continuar.` |
| Ajuda de suporte | `Falar com o suporte` |
| Erro de acionamento | `Não foi possível tentar novamente agora. Tente de novo em instantes.` |
| Sem retomada (nota) | (não renderizar promessa de continuidade) |

---

## Component Inventory

Reuso de primitivos; criar apenas compostos finos de tela.

| Component | Kind | Source / Notes |
|-----------|------|----------------|
| `Button` | reuse | `src/components/ui/button.tsx` (`secondary` para o CTA manual; `disabled` em `tentando`/limite) |
| `Card` | reuse | `src/components/ui/card.tsx` para o painel de copy |
| `Badge` | reuse | `src/components/ui/badge.tsx` (blue=pendente/tentando, amber=falha, green=concluída) |
| `Alert`/banner | reuse | classes de banner MASTER (`rounded-lg border ... p-3 text-xs`) |
| `CopyStatusPanel` | screen-local | badge + texto seguro + contador + CTA manual + aviso |
| Contador de tentativas | screen-local | JetBrains Mono 12px |

Ícones (lucide, `aria-hidden` quando decorativos): `Loader2` (pendente/tentando), `AlertTriangle`
(falha de copy), `Check` (concluída), `RotateCcw` (CTA manual), `LifeBuoy`/`Mail` (suporte).
**Sem emoji.**

---

## Accessibility

- Foco visível: `focus:ring-2 ring-accent-blue` (MASTER §11).
- Estado com **ícone + texto** (não apenas cor): falha vs. pendente differem por ícone/copy.
- Botão com `aria-disabled` quando `tentando`/limite; `aria-live="polite"` no feedback de estado.
- Alvos ≥44px; HTML semântico (`<section aria-labelledby>`).
- `prefers-reduced-motion` respeitado.
- Contador e IDs em JetBrains Mono, texto selecionável.

---

## Traceability (UI ↔ B2.1)

| Elemento de UI | Requisito / Decisão |
|----------------|---------------------|
| CTA manual só em pendente/falha; copy concluída encerra | `Ação de nova tentativa somente no estado pendente/falha` (B2A-D1) |
| Contador + limite 6 (3+3), clique = 1 tentativa | `Política de recuperação de copy por tentativas` (B2A-D2) |
| Anti-duplicação (disabled em `tentando`) | `Anti-duplicação e contabilização de chamadas` |
| Feedback seguro sem motivo interno | `Estados persistidos e feedback seguro` |
| Aviso “não muda a imagem / sem novo crédito” | `A recuperação tenta somente os textos e não regenera a imagem` |
| Sem retomada automática | `Sem retomada após fechar o navegador` (B2A-D3) |
| Ação exige autenticação/ownership (server-side; UI desabilitada sem sessão) | `Ação autenticada com ownership` |

---

## Non-Blocking Recommendations (agent discretion)

Registradas, não bloqueiam. Upstream não respondeu; usam defaults sensatos:

1. **Nome do painel** — `Copy da campanha` (alternativa: `Textos da campanha`). [default]
2. **CTA manual** — `Gerar os textos novamente`; **não** reutilizar `Regenerar`/`Tentar Novamente`
   do fluxo legado (evita sugerir regeneração da imagem). [default]
3. **Contador** — mostrar `automáticas` e `manuais` separadamente para deixar o teto de 6 claro. [default]
4. **Ajuda de suporte** — `mailto:` via prop de suporte da página (como na b1b). [default]
5. **Edição do texto entregue** — exibir somente leitura nesta fatia; edição livre/ajustes são
   concern separado (não fazem parte da recuperação). [default]
6. **Sem controle de ativação** — nenhuma flag/toggle nesta superfície. [locked]

---

## Checker / Review Status

- [ ] Dimension 1 Copywriting
- [ ] Dimension 2 Visuals
- [ ] Dimension 3 Color
- [ ] Dimension 4 Typography
- [ ] Dimension 5 Spacing
- [ ] Dimension 6 Registry Safety

**Status:** `proposed-for-review` — aguardando `gsd-ui-checker` e **revisão humana**. Nenhum plano,
implementação ou registro GSD foi iniciado a partir deste documento.
