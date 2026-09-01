---
phase: quick-appshell-viewport-scroll
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/shell/app-shell.tsx
  - src/components/shell/topbar.tsx
  - src/components/flow/store-identity-form.tsx
  - src/app/layout.tsx
  - src/__tests__/components/shell/app-shell.test.tsx
  - src/__tests__/app/layout-viewport.test.ts
autonomous: false
requirements: []
must_haves:
  truths:
    - "A barra de rolagem do navegador cobre a página inteira (documento rola, não um scroll aninhado no <main>)"
    - "No mobile, o app ocupa a viewport dinâmica sem corte inferior nem necessidade de 'tirar o zoom'"
    - "A sidebar desktop permanece fixa na tela (sticky) e rolável de forma independente"
    - "A topbar permanece visível ao rolar a página (sticky top-0 z-30)"
    - "Padding responsivo do main (px-4 py-6 sm:px-6) preservado"
    - "Nenhum scroll horizontal em 320/375px nas rotas /campanhas/nova e /loja"
  artifacts:
    - path: "src/components/shell/app-shell.tsx"
      provides: "Wrapper min-h-dvh + main sem overflow-auto com min-w-0 + sidebar sticky top-0 h-dvh"
      contains: "min-h-dvh"
    - path: "src/components/shell/topbar.tsx"
      provides: "Topbar sticky top-0 z-30 (preserva visibilidade ao rolar)"
      contains: "sticky top-0 z-30"
    - path: "src/app/layout.tsx"
      provides: "Viewport export explícito com width device-width + initialScale 1 (hardening defensivo)"
      contains: "width: \"device-width\""
    - path: "src/__tests__/app/layout-viewport.test.ts"
      provides: "Teste de contrato do export viewport (falha antes, passa depois)"
      exports: ["viewport"]
  key_links:
    - from: "src/components/shell/app-shell.tsx"
      to: "document/body scroll"
      via: "remoção de overflow-auto do main + min-h-dvh no wrapper"
      pattern: "min-h-dvh"
    - from: "src/components/shell/app-shell.tsx (aside)"
      to: "sticky top-0"
      via: "h-dvh + overflow-y-auto mantidos"
      pattern: "sticky top-0 hidden h-dvh"
    - from: "src/components/shell/topbar.tsx (header)"
      to: "viewport top"
      via: "sticky top-0 z-30"
      pattern: "sticky top-0 z-30"
    - from: "src/components/flow/store-identity-form.tsx"
      to: "topbar sticky"
      via: "co-migração lg:top-8 → lg:top-20 (evita painel legal escondido sob a topbar)"
      pattern: "lg:sticky lg:top-20"
---

<objective>
**Quick de PLANEJAMENTO (proposta técnica — NADA foi implementado).** Este documento é um artefato de proposta para revisão/aprovação humana. A seção "Tasks de Execução" está marcada como **AGUARDANDO APROVAÇÃO** e não deve ser executada antes do aval.

Corrigir o layout do AppShell para que o scroll seja do **documento inteiro** (não de um contêiner aninhado) e o app respeite a **viewport dinâmica do mobile**. Hoje o app "parece menor do que é": a barra de rolagem cobre apenas ~80% da tela (o `<main>` rola internamente, não a página) e no mobile o app extrapola as dimensões da tela (100vh vs viewport dinâmica), exigindo "tirar o zoom" e ficando cortado.

Purpose: Escopo pequeno e focado — layout global/app shell apenas. Fluxos de negócio (geração, revisão, copy, validação, preview) NÃO são tocados.
Output: Este plano-proposta revisado pelo usuário + 1 quick de execução subsequente (após aprovação).
</objective>

<execution_context>
@C:/Users/wagne/.config/opencode/get-shit-done/workflows/execute-plan.md
@C:/Users/wagne/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/PROJECT.md

# Arquivos-fonte lidos e confirmados (diagnóstico validado)
@src/components/shell/app-shell.tsx
@src/components/shell/topbar.tsx
@src/components/shell/sidebar.tsx
@src/components/shell/sidebar-drawer.tsx
@src/components/shell/account-menu.tsx
@src/app/layout.tsx
@src/app/globals.css
@src/__tests__/components/shell/app-shell.test.tsx
@src/__tests__/components/shell/sidebar-drawer.test.tsx
@src/components/flow/store-identity-form.tsx
@src/components/flow/legal-acceptance-panel.tsx
</context>

<diagnosis>
## 1. Diagnóstico do layout atual (por que a tela parece menor / extrapola)

### Causa raiz A — scroll aninhado (barra de ~80%)
`src/components/shell/app-shell.tsx` linha 44: `<main className="flex-1 overflow-auto ...">` dentro de um wrapper `h-screen` (linha 26). O **documento nunca rola**: quem rola é o `<main>` internamente. Resultado no desktop: a barra de rolagem visível é a do `<main>` (que ocupa ~80% da altura, depois de sidebar+topbar) → "o app parece menor do que é". Confirmado na leitura: não há outra cadeia de scroll — `html`/`body` não rolam nada.

### Causa raiz B — 100vh vs viewport dinâmica no mobile (corte / "zoom out")
`h-screen` = `height: 100vh`. No mobile, `100vh` é **maior** que a viewport visível quando a barra do navegador está presente (100vh considera a altura total, incluindo a área atrás da UI do browser) → o conteúdo de baixo fica cortado e o usuário precisa "dar zoom out". O `useLayoutEffect` do drawer também trava o `document.body.style.overflow` — mas como o body não rola (quem rola é o main), esse lock era **ineficaz** (bug latente; a mudança o torna efetivo — melhoria, ver §5-R3).

### Correção confirmada sobre o viewport meta (achado do planejamento — importante)
**O `<meta name="viewport">` NÃO está ausente.** Verificado no source do Next.js 15.3.1 instalado (`node_modules/next/dist/lib/metadata/resolve-metadata.js` linha 726 + `default-metadata.js`): `accumulateViewport()` parte de `createDefaultViewport()` = `{ width: "device-width", initialScale: 1, ... }` e faz `mergeViewport` (linha 251) — **defaults são preservados** quando o export do usuário só define `themeColor`. Ou seja: o HTML já emite `width=device-width, initial-scale=1`.

Consequência: adicionar `width`/`initialScale` ao export `viewport` do `layout.tsx` é **hardening defensivo explícito** (decisão locked do usuário — será feita), mas **NÃO é a correção do sintoma mobile**. As causas reais são A e B acima. O plano é honesto quanto a isso: o fix de verdade é `min-h-dvh` + scroll no documento.
</diagnosis>

<decisions>
## 2. Decisões tomadas e justificativas

| # | Decisão | Justificativa |
|---|---------|---------------|
| D-A | Wrapper `h-screen` → **`min-h-dvh`** | `dvh` segue a viewport dinâmica do mobile (sem corte com a barra do browser); `min-` permite que o documento cresça além da viewport (scroll natural). Suportado pelo Tailwind 3.4.19 (projeto usa `^3.4.19`). |
| D-B | Remover `overflow-auto` do `<main>` | O documento passa a rolar; a barra do navegador cobre a página inteira (fim do "app menor"). |
| D-C | `main` ganha **`min-w-0`** e a coluna central mantém **`min-h-0` + adiciona `min-w-0`** | `min-w-0` em flex items impede que conteúdo largo (tabelas, textos longos) force overflow horizontal. `min-h-0` é mantido como defesa flex sem custo — robusto se algum filho crescer (decisão do usuário na revisão). |
| D-D | Sidebar desktop: `sticky top-0 h-dvh overflow-y-auto` | Com o documento rolando, o aside precisa ficar preso à viewport (`sticky`) e rolar o próprio conteúdo (`h-dvh` + `overflow-y-auto`), preservando o comportamento atual (sidebar sempre visível, rolagem interna). |
| D-E | Topbar: **`sticky top-0 z-30`** (RECOMENDADO — ver §4-P1) | Hoje a topbar fica "fixa" por acidente (o main rola internamente, a topbar não). Com o documento rolando, sem sticky ela sai da tela. `z-30` mantém a topbar acima do conteúdo (z-auto) e abaixo do overlay do drawer (`z-40`) e modais (`z-50`). Fundo `bg-bg-surface` já é sólido — sem vazamento de conteúdo por baixo. |
| D-F | layout.tsx: viewport explícito com `width: "device-width"`, `initialScale: 1`, mantendo `themeColor` | Decisão locked do usuário. É hardening defensivo (Next 15.3.1 já mescla defaults, verificado no source) — auto-documenta o contrato e imune a mudanças futuras do Next. **Não usar** `maximumScale`/bloqueio de zoom (acessibilidade — fora de escopo). |
| D-G | globals.css: **NENHUMA mudança** | (a) `html, body { min-height: 100% }` é **desnecessário**: `min-h-dvh` é viewport-relative, não porcentagem — funciona sem ele. (b) `body { overflow-x: hidden }` seria **band-aid**: mascara bug real em vez de corrigir; a decisão é verificar manualmente e, se houver overflow residual, tratar em quick separado (§4-P4). |
| D-H | SidebarDrawer: **nenhuma mudança de código** | O lock de body (`useLayoutEffect`, linhas 76-87) passa a funcionar de verdade (o body agora rola) — comportamento desejado e já coberto pelo teste existente `sidebar-drawer.test.tsx` ("body scroll lock saves and restores overflow"). |
| D-I | Co-migração obrigatória: `store-identity-form.tsx` linha 2443 `lg:sticky lg:top-8` → **`lg:sticky lg:top-20`** | **Regressão evitada.** Hoje o painel legal do onboarding (coluna sticky) cola a 32px do topo do **scrollport do main** (que começa ~56px abaixo da viewport, após a topbar) ≈ 88px da viewport. Com o scroll no documento, `top-8` colaria a 32px da viewport — **escondido sob a topbar sticky**. `top-20` (80px) preserva a posição visual atual (diferença ~8px imperceptível). O `lg:sticky lg:top-6` aninhado em `legal-acceptance-panel.tsx` (linha 93) NÃO muda: por estar dentro da coluna sticky externa, é limitado pela caixa dela — não escapa. |
| D-J | `store-tabs.tsx` linha 324 `sticky bottom-0` ("Continuar") | **Sem mudança.** Sticky bottom-0 cola na borda inferior do scrollport; com o documento rolando cola na borda inferior da viewport — mesmo resultado visual de hoje. |
| D-K | Páginas fora do shell (`src/app/page.tsx`, `src/app/(auth)/layout.tsx` com `min-h-screen`) | **Fora de escopo** deste quick (não usam o AppShell). Registrar como possível próximo quick (mesmo padrão dvh) — não fazer aqui. |
</decisions>

<file_changes>
## 3. Mudanças por arquivo (classes CSS exatas)

### `src/components/shell/app-shell.tsx`
| Linha | De | Para |
|-------|----|------|
| 26 (wrapper) | `flex h-screen bg-bg-deep` | `flex min-h-dvh bg-bg-deep` |
| 27 (aside) | `hidden w-56 flex-shrink-0 overflow-y-auto border-r border-border bg-bg-surface md:block` | `sticky top-0 hidden h-dvh w-56 flex-shrink-0 overflow-y-auto border-r border-border bg-bg-surface md:block` |
| 36 (coluna) | `flex min-h-0 flex-1 flex-col` | `flex min-h-0 min-w-0 flex-1 flex-col` (mantém `min-h-0` — defesa flex sem custo; adiciona `min-w-0`) |
| 44 (main) | `flex-1 overflow-auto px-4 py-6 sm:px-6` | `min-w-0 flex-1 px-4 py-6 sm:px-6` (remove `overflow-auto`; adiciona `min-w-0`; **mantém** `px-4 py-6 sm:px-6`) |

### `src/components/shell/topbar.tsx`
| Linha | De | Para |
|-------|----|------|
| 31 (header) | `flex h-14 items-center justify-between border-b border-border bg-bg-surface px-4` | `sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-bg-surface px-4` |

### `src/components/flow/store-identity-form.tsx` (co-migração obrigatória — D-I)
| Linha | De | Para |
|-------|----|------|
| 2443 | `lg:sticky lg:top-8` | `lg:sticky lg:top-20` |

### `src/app/layout.tsx`
```ts
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0F172A",
};
```

### `src/app/globals.css`
**Sem alterações** (D-G). Manter como está.

### Testes
- **`src/__tests__/components/shell/app-shell.test.tsx`** — manter os 3 testes existentes (render, store null, padding) e adicionar:
  - (a) wrapper usa `min-h-dvh` e NÃO usa `h-screen`: `expect(html).toContain("min-h-dvh")` + `expect(html).not.toContain("h-screen")` (sem falso positivo: `h-dvh` e `min-h-dvh` não contêm "h-screen");
  - (b) `<main>` NÃO usa `overflow-auto` — **teste localizado** (revisão do usuário): extrair do html o trecho do `<main>` que contém `px-4 py-6 sm:px-6` e garantir que esse trecho NÃO contém `overflow-auto` (evita falso positivo se um filho futuro tiver `overflow-auto`); sem conflito com o `overflow-y-auto` do aside — strings distintas;
  - (c) padding preservado: já coberto pelo teste existente (linha 30-37);
  - (d) sidebar desktop rolável + sticky: `expect(html).toContain("sticky top-0")`, `toContain("h-dvh")`, `toContain("overflow-y-auto")`;
  - (e) coluna e main com `min-w-0`: `expect(html).toContain("min-w-0")`;
  - (f) topbar sticky: `expect(html).toContain("sticky top-0 z-30")`.
- **`src/__tests__/app/layout-viewport.test.ts`** (NOVO, `@vitest-environment node` — segue o padrão dos testes de página em `src/__tests__/app/*`; o import de `./globals.css` do layout é stubado pelo vitest default, verificado no `vitest.config.ts` sem `css: true`): importar `{ viewport }` de `@/app/layout` e assertar `viewport.width === "device-width"`, `viewport.initialScale === 1`, `viewport.themeColor === "#0F172A"`. **O teste falha antes da mudança e passa depois** (o export atual só tem `themeColor`) — contrato válido para a decisão locked D-F.
</file_changes>

<pending_decisions>
## 4. Decisões pendentes para o usuário

| # | Pendência | Análise / Recomendação |
|---|-----------|------------------------|
| P1 | **Topbar sticky vs normal** | **RECOMENDADO: sticky top-0 z-30.** Justificativa: hoje a topbar fica visível por acidente (scroll interno do main). Com o documento rolando, sem sticky ela some ao rolar — e a topbar carrega ações críticas sempre acessíveis (menu mobile, "Nova Campanha", AccountMenu/saldo). `z-30` fica abaixo do overlay do drawer (`z-40`) e dos modais (`z-50`) — layering correto. O dropdown do AccountMenu (`z-50` interno, sem portal) passa a ser confinado ao stacking context da topbar (z-30 efetivo) — ainda acima do conteúdo (z-auto) e agora corretamente abaixo de modais. Sem regressão visual do dropdown. |
| P2 | **Lock de scroll do drawer (body) com scroll no documento** | **Nenhuma mudança necessária.** Verificado: o lock (linhas 76-87 do `sidebar-drawer.tsx`) salva/restaura `body.style.overflow` e passa a ser **efetivo** com o scroll no body (antes era inócuo). Teste existente cobre save/restore. Benefício colateral: com o drawer aberto, o fundo realmente congela. |
| P3 | **globals.css precisa de `html, body { min-height: 100% }`?** | **Não.** `min-h-dvh` é viewport-relative (unidade dvh), não depende de cadeia de porcentagem. `body` já tem `background-color: var(--bg-deep)` — o fundo cobre a página inteira em qualquer altura. Nada a adicionar. |
| P4 | **Overflow horizontal no mobile (320px)** | **Não aplicar `overflow-x: hidden` agora (band-aid).** Análise do provável suspeito — topbar: o container esquerdo já tem `min-w-0` + `truncate` (seguro); o container direito (`flex items-center gap-3`) sem `min-w-0` tem piso de ~200px (CTA "Nova Campanha" ~120px + trigger do AccountMenu ~44px) — com hamburger (44px) + gaps, estima-se ~270px < 320px, provavelmente OK. **Ação**: incluir 320px/375px na verificação manual; **se** houver overflow residual após este quick, tratar como quick separado (topbar right cluster — sem band-aid global). |
</pending_decisions>

<risks>
## 5. Riscos e mitigação

| # | Risco | Impacto | Mitigação |
|---|-------|---------|-----------|
| R1 | Regressão visual no onboarding: painel legal sticky (`store-identity-form.tsx`) escondido sob a topbar sticky | Médio (rota /loja) | Co-migração obrigatória D-I (`top-8` → `top-20`) incluída no escopo + verificação manual em /loja. |
| R2 | AccountMenu dropdown confinado ao stacking context da topbar (z-30) | Baixo | Comporta-se corretamente: acima do conteúdo, abaixo de drawer/modais (que devem cobri-lo). Nenhum caso exige dropdown acima de modal. |
| R3 | Lock de scroll do drawer passa a congelar o fundo (comportamento novo) | Baixo | É a intenção original do componente (melhoria). Coberto pelo teste existente de save/restore. Verificar manualmente no mobile. |
| R4 | Elementos sticky de páginas mudam de scrollport (main → documento) | Médio | Auditado: `store-tabs.tsx` `sticky bottom-0` e `legal-acceptance-panel.tsx` `top-6` aninhado não precisam de mudança (D-J); único caso real é R1. |
| R5 | Overflow horizontal residual em 320px (topbar right cluster) | Baixo | Verificação manual 320/375px + quick separado se confirmado (P4). Sem `overflow-x: hidden` global. |
| R6 | Páginas fora do shell (`min-h-screen` em landing/auth) com o mesmo sintoma | Fora de escopo | Documentado (D-K); quick futuro com o mesmo padrão dvh. Sem impacto neste quick (não usam o AppShell). |
</risks>

<success_criteria>
## 6. Critérios de sucesso (testes + verificação manual)

### Automatizados (4 gates — padrão do projeto; build não-bloqueador)
1. `npx vitest run src/__tests__/components/shell/app-shell.test.tsx src/__tests__/app/layout-viewport.test.ts` — testes atualizados + novo teste verdes (falha antes da mudança, passa depois);
2. `npm run typecheck` — limpo;
3. `npm run lint` — limpo;
4. `npm run build` — **não-bloqueador** (decisão do usuário): rodar se o executor tiver tempo; foco nos gates 1-3.

### Manual (checkpoint humano — pós-execução, apósv aprovação)
- Desktop (≥1024px): barra de rolagem do navegador cobre a **página inteira**; sidebar fixa (sticky) com scroll próprio; topbar sempre visível ao rolar.
- Mobile 375px e 320px (devtools e/ou dispositivo): **sem corte inferior** e sem necessidade de "tirar o zoom"; topbar visível; hamburger abre drawer e o **fundo congela** (lock efetivo); fechar drawer restaura o scroll.
- Rotas `/campanhas/nova` e `/loja`: **ausência total de scroll horizontal**; painel legal do onboarding visível (não escondido sob a topbar) ao rolar — **verificação manual OBRIGATÓRIA** para a co-migração `top-20` (decisão do usuário).
- Comparação visual pré/pós nas mesmas rotas (nada além do esperado mudou).
</success_criteria>

<next_steps>
## 7. Próximos passos (após este quick)

- **Se** overflow horizontal residual confirmado em 320px → quick separado: topbar right cluster (`min-w-0`/`shrink` no container direito, tratamento do CTA "Nova Campanha" em larguras estreitas). Sem `overflow-x: hidden` global.
- **Se** o usuário quiser atacar o mesmo sintoma em páginas fora do shell (landing `/`, auth) → quick futuro: `min-h-screen` → `min-h-dvh` no mesmo padrão (D-K).
- Revisar os resultados deste quick no UAT mobile real (Android/iOS) antes de fechar.

</next_steps>

<tasks>
## 8. Tasks de execução — ⚠️ AGUARDANDO APROVAÇÃO (não executar sem aval humano)

<task type="auto" tdd="false">
  <name>Task 1: Aplicar mudanças de layout do AppShell (produção)</name>
  <files>
    src/components/shell/app-shell.tsx,
    src/components/shell/topbar.tsx,
    src/components/flow/store-identity-form.tsx,
    src/app/layout.tsx
  </files>
  <action>
    Aplicar exatamente as 4 mudanças de classe da seção 3 em app-shell.tsx (wrapper min-h-dvh; aside sticky top-0 h-dvh mantendo overflow-y-auto e flex-shrink-0; coluna central min-h-0 min-w-0 flex-1 flex-col — MANTENDO min-h-0 conforme revisão do usuário; main min-w-0 flex-1 px-4 py-6 sm:px-6 removendo overflow-auto). Em topbar.tsx, adicionar "sticky top-0 z-30" ao header (aprovado). Em store-identity-form.tsx, alterar apenas a linha 2443 de "lg:sticky lg:top-8" para "lg:sticky lg:top-20" (co-migração D-I — nenhuma outra alteração neste arquivo; verificação manual OBRIGATÓRIA em /loja na Task 3). Em layout.tsx, expandir o export viewport para incluir width: "device-width" e initialScale: 1, preservando themeColor "#0F172A" (D-F). NÃO tocar globals.css (D-G) nem sidebar-drawer.tsx (D-H). NÃO usar maximumScale nem bloquear zoom. NÃO alterar nenhum outro arquivo.
  </action>
  <verify>
    <automated>npx vitest run src/__tests__/components/shell/app-shell.test.tsx src/__tests__/app/layout-viewport.test.ts</automated>
  </verify>
  <done>
    As 4 mudanças de classe em app-shell.tsx, sticky na topbar, co-migração top-20 e viewport explícito aplicados; NENHUM arquivo fora do escopo tocado.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Atualizar e criar testes do layout + regressão completa</name>
  <files>
    src/__tests__/components/shell/app-shell.test.tsx,
    src/__tests__/app/layout-viewport.test.ts
  </files>
  <behavior>
    - Teste A: renderToString do AppShell contém "min-h-dvh" e não contém "h-screen" (wrapper)
    - Teste B: `<main>` sem scroll interno — **localizado** (revisão do usuário): isolar o trecho do html que contém "px-4 py-6 sm:px-6" e assertar que esse trecho não contém "overflow-auto" (evita falso positivo com overflow-auto de filhos futuros; sem conflito com "overflow-y-auto" do aside)
    - Teste C: renderToString contém "sticky top-0" e "h-dvh" (aside) e "sticky top-0 z-30" (topbar) e "min-w-0" (coluna/main) e "min-h-0 min-w-0" (coluna central — decisão do usuário)
    - Teste D: o export viewport de @/app/layout tem width "device-width", initialScale 1 e themeColor "#0F172A" — DEVE falhar antes da Task 1 (RED) e passar depois (GREEN)
  </behavior>
  <action>
    Em app-shell.test.tsx: manter os 3 testes existentes intactos e adicionar as asserções (a)(b)(c)(d)(e)(f) da seção 3 (env node, renderToString — mesmo padrão atual). Criar src/__tests__/app/layout-viewport.test.ts seguindo o padrão de @vitest-environment node dos testes de página (ex.: src/__tests__/app/landing-page.test.tsx), importando o export viewport de @/app/layout (o import de globals.css é stubado pelo vitest default — sem css:true no vitest.config.ts, verificado). Rodar RED (sem Task 1 aplicada o teste D falha), depois GREEN. Ao final, rodar a regressão: npm run typecheck, npm run lint, npm test (build não-bloqueador — decisão do usuário; rodar se houver tempo).
  </action>
  <verify>
    <automated>npm test; npm run typecheck; npm run lint</automated>
  </verify>
  <done>
    Gates 1-3 verdes (testes focados, typecheck, lint); teste D demonstra RED→GREEN; regressão sem quebras. Build opcional/não-bloqueador.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Verificação manual desktop + mobile (checkpoint humano)</name>
  <what-built>Layout do AppShell com scroll no documento, min-h-dvh, sidebar sticky, topbar sticky e viewport explícito</what-built>
  <how-to-verify>
    1. Desktop (≥1024px): navegar para /dashboard e /campanhas/nova — a barra de rolagem do navegador cobre a página INTEIRA; sidebar fixa com scroll próprio; topbar visível ao rolar.
    2. Mobile 375px e 320px (devtools; idealmente dispositivo): app ocupa a tela sem corte inferior e sem "tirar o zoom"; topbar visível; abrir o drawer (hamburger) e confirmar que o fundo CONGELA; fechar e confirmar que o scroll volta.
    3. Rotas /campanhas/nova e /loja em 320/375px: SEM scroll horizontal; painel legal do onboarding (rota /loja) visível ao rolar, não escondido sob a topbar.
    4. Comparar visual pré/pós: nada além do esperado mudou (sidebar, topbar, padding do conteúdo idênticos).
  </how-to-verify>
  <resume-signal>Type "approved" (ou descreva o que quebrou para correção)</resume-signal>
</task>
</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (nenhuma nova) | Este quick altera apenas CSS/layout client-side (classes Tailwind + export viewport). Nenhum dado atravessa fronteira de confiança nova; nenhuma rota, handler ou store é tocado. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-QPK-01 | Tampering | classes Tailwind / layout | accept | Mudanças puramente apresentacionais; sem estado, sem input, sem persistência. Risco residual: regressão visual (coberto por R1-R6 + verificação manual). |
| T-QPK-SC | Tampering | npm installs | accept | Nenhum pacote novo será instalado (só classes existentes do Tailwind 3.4 e exports do Next 15.3.1 já em uso). |
</threat_model>

<verification>
Checks da fase (após aprovação e execução):
1. `npx vitest run src/__tests__/components/shell/app-shell.test.tsx src/__tests__/app/layout-viewport.test.ts` — verde;
2. `npm run typecheck` — limpo;
3. `npm run lint` — limpo;
4. `npm run build` — não-bloqueador (opcional; decisão do usuário);
5. Verificação manual §6 (checkpoint humano) — aprovada, com verificação OBRIGATÓRIA em /loja para o painel legal (co-migração top-20).
</verification>

<output>
Após aprovação e execução: `.planning/quick/260820-qpk-planeje-o-quick-appshell-viewport-scroll/260820-qpk-SUMMARY.md` (+ registro de UAT manual).
</output>