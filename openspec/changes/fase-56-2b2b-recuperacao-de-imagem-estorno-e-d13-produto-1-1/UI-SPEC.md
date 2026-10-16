---
phase: B2.2
change: fase-56-2b2b-recuperacao-de-imagem-estorno-e-d13-produto-1-1
status: approved
created: 2026-10-15
checker_reviewed_at: 2026-10-15
reviewed_at: 2026-10-15
shadcn_initialized: false
preset: none
---

# B2.2 — UI Design Contract: Recuperação de imagem, estorno e formulário restaurado (Produto 1:1)

> Visual and interaction contract for **B2.2 — imagem/estorno/D13**.
> Rotina: `gsd-ui-researcher` propõe; `gsd-ui-checker` valida; **revisão humana obrigatória**.
> Fonte de verdade: `openspec/design-system/MASTER.md` + `openspec/design-system/pages/campaign-preview.md`,
> a UI-SPEC da b1b (`56.2.2-UI-SPEC.md`) e a change `fase-56-2b2b-recuperacao-de-imagem-estorno-e-d13-produto-1-1/`
> (proposal, design B2B-D1..D9, specs, tasks, `RECONCILIATION.md`).
>
> **STATUS: APROVADO (2026-10-15) como CONTRATO pré-implementação, exclusivamente no escopo INATIVO.** Este contrato foi revisado por humano; **NÃO** foi implementado. A validação do resultado implementado é checkpoint **posterior e distinto** (UAT da B2.2). Não inicia geração/cobrança; o fluxo permanece **INATIVO** (chaves `false`, autorização `off`).

---

## Scope Guardrails (read first)

Esta fatia toca **a superfície de resultado persistido da campanha** (`/campanhas/[id]`) **somente** no estado
**`refunded`** (falha final comprovada + estorno confirmado) e na **restauração do formulário** para nova
submissão. Nada de recuperação de copy (B2.1) nem autorização/teste real (B2.3). Nada de aprovação/reprovação/
correção (F56.3).

**Âncora visual primária:** o painel de **falha confirmada com estorno**, com a **mensagem exata** e a CTA
**`Voltar aos dados da campanha`**. A arte entregue (quando houver) permanece **inalterada**.

**In scope (this contract covers):**

1. O painel de **`refunded`** em `/campanhas/[id]`, com a mensagem aprovada e a ação de nova submissão.
2. A **restauração do formulário** para nova geração (campos preenchidos; limites de imagem).
3. O feedback **honesto** quando o estorno **não** é confirmado (estado de pendência; **sem** anunciar crédito).
4. Reuso do painel de **resultado desconhecido** existente (sem crédito anunciado).

**Explicitamente fora de escopo (não desenhar/construir aqui):**

- Recuperação **de copy** e seus estados — **B2.1** (arquivada).
- **Superfície administrativa** de resolução de pendência (`/api/admin/product-1-1-pending`): já existe na
  b1b; esta fatia a **estende no backend** (motivo/evidência/auditoria), **sem** novo desenho de tela. **Exceção mínima (adendo 2026-10-15, `RECONCILIATION.md` §10.1):** a fatia **habilita funcionalmente a ação EXISTENTE** da tela admin para uma operação `processing` **no caminho autorizado** (com confirmação e auditoria) — **não** cria tela nem novo componente visual. O contrato visual desta fatia (superfície do lojista, §Surface) permanece **inalterado**.
- Autorização estreita, teste real e preview — **B2.3**.
- Aprovação/reprovação/correção, edição livre e bloqueio de download de artes pendentes — **F56.3**.
- Novo design token, light mode, biblioteca de componentes ou **emoji**.

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

- `src/app/(app)/campanhas/[id]/client.tsx` — view de resultado persistido; `NewFlowFailureView` (estado
  `refunded`, hoje) e `UnknownResultPanel` (resultado desconhecido).
- `src/components/ui/*` — `Button`, `Card`, `Badge`, classes de banner.
- `src/components/flow/use-campaign-form.ts` + `src/hooks/use-input-preservation.ts` — restauração de rascunho
  (sessionStorage) e reidratação a partir do estado server-side.

**Patterns to copy verbatim (MASTER + b1b UI-SPEC):**

- Primitivo real `src/components/ui/button.tsx`: `inline-flex items-center justify-center gap-2 rounded-lg font-heading font-semibold transition-all duration-200 focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50` + `style={{ minHeight: "44px" }}`. Variantes: `primary` = `bg-accent-green text-white hover:brightness-110`; `secondary` = `border border-border text-text-primary bg-transparent hover:bg-bg-elevated`; `ghost` = `bg-transparent text-text-secondary hover:bg-bg-elevated`.
- Botão primário (CTA principal da tela): variante `primary` do primitivo (`bg-accent-green text-white font-heading font-semibold`, `min-height:44px`).
- Botão secundário/outline: variante `secondary` do primitivo (`border border-border text-text-primary`, `min-height:44px`).
- Atenção (falha confirmada): **amber** (`accent-amber`) + `AlertTriangle`/`ShieldAlert`; **erro de rede/validação**: `accent-red` + `AlertCircle`, `role="alert"`.
- IDs/referência de suporte: `JetBrains Mono` 12px.

---

## Spacing & Sizing

Reuso integral do MASTER §4 (múltiplos de 4). **Sem token novo.**

| Token (MASTER §4) | Value | Usage |
|-------|-------|-------|
| `--space-xs` | 8px | espaçamento inline; label→controle |
| `--space-sm` | 12px | padding compacto de controle |
| `--space-md` | 16px | padding de card, `gap-4` |
| `--space-lg` | 24px | padding de seção (`space-y-6`) |

- **Touch targets:** mínimo **44px** de altura em todo controle interativo.
- Largura: container do resultado (`max-w-2xl`, espelhando `campanhas/[id]/client.tsx`).

---

## Typography

Reuso do MASTER §3. Sem novo tamanho/peso.

| Role | Size | Weight | Line Height | Font |
|------|------|--------|-------------|------|
| Corpo / mensagem | 16px (`text-base`) | 400 | 1.5 | Open Sans |
| Label/Caption | 12px (`text-xs`) | 500, uppercase, `tracking-wider` | 1.2 | Poppins |
| Heading de painel | 20px (`text-xl`) | 600 | 1.2 | Poppins |
| Referência de suporte (ID) | 12px (`text-xs`) | 500 | 1.4 | JetBrains Mono |

> **Pesos herdados do MASTER §3** (corpo 400 / label 500 / heading 600); nenhum peso novo é introduzido.
> `Line Height` reposta para paridade com a UI-SPEC da B2.1 e com o MASTER §3.

---

## Color

60/30/10 (MASTER §2). **Dark OLED apenas; sem `#FFFFFF` de fundo.**

| Role | Value | Usage nesta fatia |
|------|-------|-------------------|
| Dominante (60%) | `#020617` `bg-bg-deep` | fundo da página |
| Secundário (30%) | `#0F172A` `bg-bg-surface` / `#1E293B` `bg-bg-elevated` | card do painel |
| Atenção | `#F59E0B` `accent-amber` | falha confirmada **antes/na ausência** da confirmação do estorno |
| Sucesso/Confirmação | `#22C55E` `accent-green` | estorno **persistido e confirmado** (CTA primária) |
| Destrutivo/erro | `#EF4444` `accent-red` | apenas erro de rede/validação do acionamento |

**Regra semântica:** a **mensagem de estorno** só aparece quando o estorno está **persistido e confirmado**;
**sem** confirmação, o feedback é **honesto** (amber) e **não** anuncia crédito devolvido.

---

## Surface — Falha confirmada com estorno (`refunded`)

**Onde:** `/campanhas/[id]` (`src/app/(app)/campanhas/[id]/client.tsx`), substituindo o atual
`NewFlowFailureView`. **Não** cria rota nova.

**Anatomia:**

```
<RefundedPanel>                                     (card, bg-bg-surface)
  ├─ A. Ícone de atenção + mensagem aprovada         (Open Sans 16px)
  ├─ B. Nota de escopo: imagem pode precisar ser     (Open Sans 14px, text-secondary)
  │     re-adicionada (referências/imagens client-only)
  ├─ C. CTA primária "Voltar aos dados da campanha"
  └─ D. Ajuda de suporte (secundário)                (quando aplicável)
```

**Mensagem exata (aprovada):**

> “Não conseguimos concluir a comunicação desta geração. Seus dados foram preservados e o crédito foi estornado. Você pode gerar novamente.”

**Regras duras:**

- A mensagem **só** é exibida quando a operação está **`refunded`** persistida e confirmada; **nunca** em
  `reserved`/`art_uploaded`/`delivered`/desconhecido.
- **`delivered` nunca é estornado**; a arte entregue permanece **visível e baixável** (inalterada).
- A CTA **não** reabre a operação estornada: navega para `/campanhas/nova` como **geração nova** (cobrança normal).
- **Não** prometer restauração de **imagem**: a nota de escopo é obrigatória quando a campanha tinha imagem do
  produto/referências.

**Restauração do formulário (dados):**

- **Restaurado (server-side):** produto, preço original/desconto, intenção, selo, validade, direção de fundo,
  texto obrigatório, oferta; direção textual de identidade; **seleções** de referência.
- **Reaproveitado do rascunho (client-only), quando existir:** data URL da imagem do produto
  (`sessionStorage`).
- **Não restaurável com garantia:** arquivos de **imagem do produto** e **imagens de referência** que não
  estiverem no rascunho local. A UI **avisa**; **não** finge restaurar.

---

## Interaction & State Contract

| Estado da operação | Comportamento da UI |
|--------------------|---------------------|
| `delivered` | Resultado entregue; **nenhuma** mensagem de estorno; arte baixável |
| `reserved`/`art_uploaded`/desconhecido | Painel de progresso/pendência existente; **nunca** anuncia crédito |
| `refunded` (estorno confirmado) | `<RefundedPanel>` com a **mensagem exata** + CTA de nova geração com dados restaurados |
| Estorno **não** confirmado | Feedback **honesto** (amber), **sem** promessa de crédito; re-verificação segura |
| Clique na CTA | Navega para `/campanhas/nova` com formulário restaurado (nova submissão, cobrança normal) |
| Erro de rede/validação | Inline error (`accent-red`, `role="alert"`), sem alterar o estado persistido |
| Reduced motion | Transições 150–300ms; `motion-safe:`/`motion-reduce:` |

---

## Copywriting Contract

PT-BR, linguagem comercial simples, **sem emojis, sem jargão técnico** (MASTER §1).

| Elemento | Copy |
|----------|------|
| Mensagem de estorno (exata) | `Não conseguimos concluir a comunicação desta geração. Seus dados foram preservados e o crédito foi estornado. Você pode gerar novamente.` |
| Nota de escopo (imagem) | `Seus dados preenchidos foram mantidos. A imagem do produto pode precisar ser adicionada novamente.` |
| CTA primária | `Voltar aos dados da campanha` |
| Aviso de nova geração | `Esta é uma nova geração e será cobrada normalmente.` |
| Ajuda de suporte | `Falar com o suporte` |
| Estorno não confirmado | `Não foi possível confirmar o estorno agora. Tente novamente em instantes.` |
| Erro de rede/validação | `Não foi possível abrir o formulário agora. Tente de novo em instantes.` |

---

## Component Inventory

Reuso de primitivos; criar apenas compostos finos de tela.

| Component | Kind | Source / Notes |
|-----------|------|----------------|
| `Button` | reuse | `src/components/ui/button.tsx` (primária no estorno confirmado; secundária no suporte) |
| `Card` | reuse | `src/components/ui/card.tsx` para o painel |
| `Alert`/banner | reuse | classes de banner MASTER (`rounded-lg border ... p-3 text-sm`) |
| `RefundedPanel` | screen-local | mensagem exata + nota de escopo + CTA de nova geração |
| Restauração de formulário | reuse | `use-campaign-form.ts` + `use-input-preservation.ts` (sem novo mecanismo) |

Ícones (lucide, `aria-hidden` quando decorativos): `AlertTriangle`/`ShieldAlert` (falha confirmada),
`RotateCcw` (voltar aos dados da campanha), `RefreshCw` (Verificar novamente), `LifeBuoy`/`Mail` (suporte). **Sem emoji.**

**Ajuste aprovado durante o UAT (2026-10-15):** no `RefundedPanel`, `Verificar novamente` usa `RefreshCw` antes do texto, `h-4 w-4` e `aria-hidden="true"`, sem animação contínua. Mantém `router.refresh()` (somente consulta, sem geração/cobrança). Padronização gradual nos componentes tocados, sem refatoração global nesta fatia.

---

## Accessibility

- Foco visível: `focus:ring-2 ring-accent-blue` (MASTER §11).
- Estado com **ícone + texto** (não apenas cor).
- `aria-live="polite"` no feedback de estado (transições), nunca a cada segundo.
- Alvos ≥44px; HTML semântico (`<section aria-labelledby>`).
- `prefers-reduced-motion` respeitado.
- Referência de suporte/ID em JetBrains Mono.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none — not initialized | not applicable |
| third-party registries | none declared | not applicable |

Sem `components.json`; o projeto usa o design system custom (`openspec/design-system/MASTER.md`). Reuso dos
primitivos existentes em `src/components/ui/*`. Nenhum registry de terceiros é introduzido.

---

## Traceability (UI ↔ B2.2)

| Elemento de UI | Requisito / Decisão |
|----------------|---------------------|
| Mensagem exata só em `refunded` confirmado | `Estorno idempotente e corrida entrega × estorno` + B2B-D5 |
| CTA `Voltar aos dados da campanha` (nova submissão) | `Resultado atrasado de operação estornada não reabre nem libera` (nova geração) + B2B-D9 |
| Restauração dos campos preenchidos (server-side) | `Recuperação server-side de operação sem delivered` + B2B-D9 |
| Nota de escopo (imagem pode precisar ser re-adicionada) | B2B-D9 (limitação honesta) |
| Sem anúncio de crédito sem confirmação | `Falha de Storage/banco não autoriza estorno nem anúncio de crédito` + B2B-D5 |
| `delivered` nunca estorna / arte inalterada | `Recuperação financeira não toca operação terminal` + B2B-D6 |

---

## Checker / Review Status

- [x] Dimension 1 Copywriting — PASS
- [x] Dimension 2 Visuals — PASS
- [x] Dimension 3 Color — PASS
- [x] Dimension 4 Typography — PASS (FLAG resolvido: coluna `Line Height` reposta; pesos herdados do MASTER §3)
- [x] Dimension 5 Spacing — PASS
- [x] Dimension 6 Registry Safety — PASS

**Checker (`gsd-ui-checker`, 2026-10-15) — resultado ORIGINAL preservado:** 1º passe **APPROVED** (0 BLOCK, **1 FLAG** → Dimension 4 `Line Height` ausente). **O FLAG de tipografia foi CORRIGIDO nesta rodada** (coluna `Line Height` reposta + nota de pesos herdados do MASTER §3). Recomendações aplicadas: aviso de **nova geração/cobrança normal** (Copywriting) e alinhamento do padrão de botão ao primitivo real `src/components/ui/button.tsx`.

**Revisão humana: APROVADA (2026-10-15, `reviewed_at`).** O responsável aprovou este contrato de UI como **CONTRATO pré-implementação**, **exclusivamente no escopo INATIVO**. **Distinção de checkpoints:** esta é a aprovação do **CONTRATO** (pré-implementação); a validação do **resultado implementado** ocorrerá no **UAT** da B2.2 — uma aprovação **posterior e distinta**. Nenhuma implementação foi iniciada a partir deste documento. O parecer do checker **não** substitui a revisão humana.


## Recorte 2 (Plano 09) — ação de recuperação e terminal `refunded`

*Reconciliado 2026-10-16 (pré-implementação).* A superfície de **resultado desconhecido** ganha a ação explícita **`Recuperar imagem salva`** (POST autenticado em `/api/campaign/[id]/image-recovery` → GET; **sem** regenerar/cobrar). O terminal **`refunded` CONFIRMADO** (iniciador e unknown→admin) **encaminha ao DETALHE**, que **reutiliza o `RefundedPanel`** existente — **sem** segunda superfície equivalente. `GET`/`Verificar novamente` permanecem **consulta**. Sem novo requisito/fluxo.
