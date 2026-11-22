# Phase 61 Plan 05: remoção do “?” e chip como único controle

**Status:** ⛔ **NÃO ACEITO / AGUARDANDO REVISÃO TÉCNICA E VISUAL** — executado localmente/offline em 2026-11-22. A fase 61 **NÃO** está concluída; a UX **NÃO** está aprovada. A validação visual de lista/dashboard/detalhe (desktop, celular e 320 px) é humana e posterior. O `61-04` continua **NÃO ACEITO**; este plano não o aceita retroativamente.

**Executado em:** 2026-11-22
**Branch:** `feat/campaign-format-chips`
**Base da wave:** `0f001a56` (tracking do `61-04`)
**Commits da implementação:** `987159d9`, `04ccba09`
**Plano:** `61-05-PLAN.md` (`wave: 5`, `depends_on: [61-04]`, `autonomous: false`)
**Plan check:** `61-05-PLAN-CHECK.md` (B-01 e W-01…W-11 endereçados)
**Baseline autorizada:** `c971d631a190d426be21341f4616f6e4c7cb5135`

> Nenhum merge, push, deploy, sync ou archive. Nenhum acesso a banco, Storage,
> homolog, produção, provider ou chamada paga. Nenhuma migration/RPC/flag/pricing/
> copy/miniatura/aprovação/recuperação criada ou alterada. Nenhum builder,
> classificação, lifecycle, autoridade de estado ou contrato financeiro alterado.
> Nenhuma dependência adicionada. `src/lib/product-two-format/**` e
> `src/lib/campaign/format-resolution.ts` intocados.

---

## Objetivo executado

Remover completamente o controle “?” separado e usar o próprio chip como **único**
controle de apresentação e de ajuda:

1. Detalhe, formato `delivered` com `href`: `<a href>` sem prefetch — o primeiro
   toque/click seleciona e **não** abre ajuda.
2. Detalhe, `delivered` sem `href` (individual/legado) e estados
   ausente/processando/indeterminado: `<button type="button">` que abre/fecha
   apenas a explicação.
3. Lista/dashboard: `<button type="button">` que abre/fecha apenas a ajuda local,
   sem navegar/gerar.
4. Texto visível apenas “Quadrado 1:1”/“Vertical 9:16”; estado completo em
   `aria-label` + descrição `hidden`/`aria-describedby`; `aria-current` só no link
   ativo; `aria-expanded`/`aria-controls` só no chip-botão.
5. Entregue x ausente distinguível sem cor (borda espessa/preenchimento x borda
   simples), ativo com anel/fundo, excepcionais com indicador pequeno.
6. Ajuda flutuante reutilizando portal pós-mount, `position: fixed`,
   `lang={helpLang}`, ancorada no chip, clamp de viewport/overflow, um popover por
   vez, clique dentro não fecha, fora/Escape fecham, ponteiro chip→popover mantém
   aberto.
7. `Escape` devolve foco ao chip de origem com guarda de supressão; listeners
   removidos ao fechar/desmontar.

---

## O que foi implementado

### `src/components/campaign/campaign-format-chips.tsx`

- **“?” removido por completo:** não existe botão auxiliar, espaço reservado,
  borda, foco nem área acionável independente. `HELP_BUTTON_CLASS`, `buttonRefs`
  e o `aria-label` “Ver explicação do formato” deixaram de existir no componente.
- **Semântica do próprio chip:** `delivered` com `href` ⇒ `<a href>` (sem
  `prefetch`, sem handler de click que abra ajuda); `delivered` sem `href` e
  qualquer estado não entregue/excepcional ⇒ `<button type="button">`; lista e
  dashboard (sem `hrefs`) ⇒ sempre botão.
- **Wrapper sem nome duplicado:** removido o `div role="group"` com
  `aria-label`/`aria-describedby`. Restam `<ul aria-label={groupLabel}>`,
  `<li class="min-w-0">`, o chip e a descrição `hidden` irmã.
- **Acessibilidade:** `aria-label` (nome + estado + “Selecionado”) e
  `aria-describedby` no próprio link/botão; `aria-current="true"` apenas no link
  ativo; `aria-expanded`/`aria-controls` apenas no chip-botão e apenas quando a
  ajuda está aberta. Hit area `min-h-11 min-w-11` (≥44×44) e
  `focus-visible:ring-2`.
- **Não depender só de cor (B-01):** `delivered` usa `border-2 border-solid`
  (borda mais espessa) + preenchimento `bg-accent-green/10`; `absent` usa borda
  simples `border` + `bg-bg-elevated`; `unknown`/`unavailable` usam
  `border-dashed`; ativo usa `bg-accent-green/15` + `ring-1`; `processing`,
  `unknown`/`unavailable` e `refunded` mantêm apenas indicador pequeno
  (`Loader2`, `CircleHelp`, `Undo2`).
- **Ajuda:** portal pós-mount (`mounted` via `useEffect`), `position: fixed`,
  `lang={helpLang}`, ancorada em `chipRefs[activeKey]` (link ou botão), com
  `maxWidth`/`maxHeight` e clamp de viewport; um único popover; `onPointerDown`
  dentro não propaga; `pointerdown` externo/`resize`/`scroll`/`keydown` são
  adicionados só enquanto aberto e removidos no cleanup.
- **Interações:** hover/foco abrem ajuda transitória; primeiro clique no
  chip-botão após hover/foco **fixa**, segundo fecha; toque abre/fecha; ponteiro
  chip→popover cancela o fechamento; `Escape` fecha, devolve foco ao chip e usa
  supressão para não reabrir.
- **Sem efeitos novos:** nenhum fetch, Supabase, Storage, server action, geração,
  reserva ou provider. A única interação é estado local de exibição.

### Superfícies (verificadas, sem necessidade de alteração de código)

`helpLang` e o espaçamento `mb-6` entre chips e arte já haviam sido propagados no
`61-04`; por isso `src/app/(app)/campanhas/client.tsx`,
`src/app/(app)/campanhas/[id]/client.tsx`,
`src/components/dashboard/available-campaign-card.tsx`,
`src/components/dashboard/dashboard-campaigns.tsx` e
`src/app/(app)/dashboard/page.tsx` permaneceram **intocados** nesta execução. A
mudança do componente é suficiente: sem `hrefs`, lista/dashboard renderizam
botões explicativos; no detalhe, apenas formatos `delivered` com `href` viram
link.

### Testes

- `campaign-format-chips.test.tsx` reescrito (32 testes): ausência de “?”,
  semântica `<a>`/`<button>`, sem `role="group"`, sem foco órfão, borda
  espessa/simples (não-cor), `aria-current`/`aria-expanded`/`aria-controls`,
  hover/foco/clique/toque, link não interceptado, `Escape` (botão e link),
  fora/dentro, ponteiro chip→popover, um popover, cleanup de listeners, hit area,
  `lang` es-419, isolamento estático (sem `infoAria`, sem `HELP_BUTTON_CLASS`,
  sem `next/link`, sem `prefetch=`, sem HTML cru).
- `campaign-format-chips.ssr.test.tsx` atualizado: `renderToString` não acessa
  `document`, não cria portal/`z-50`, não contém o rótulo antigo do “?” nem
  `role="group"`.
- Suítes de superfície adequadas de `role="group"`/“?” para o papel real do chip
  (botão em lista/dashboard; botão no detalhe sem `href`).

---

## Arquivos

### Criados

- `.planning/phases/61-padronizar-chips-formatos-campanhas/61-05-VISUAL-CHECK.md` — checklist **PENDENTE** de inspeção humana (1440×900, 390×844, 320 px).
- `.planning/phases/61-padronizar-chips-formatos-campanhas/evidence/61-05-baseline-read-after.log`
- `.planning/phases/61-padronizar-chips-formatos-campanhas/evidence/61-05-directed.log`
- `.planning/phases/61-padronizar-chips-formatos-campanhas/evidence/61-05-typecheck.log`
- `.planning/phases/61-padronizar-chips-formatos-campanhas/evidence/61-05-lint.log`
- `.planning/phases/61-padronizar-chips-formatos-campanhas/evidence/61-05-build.log`
- `.planning/phases/61-padronizar-chips-formatos-campanhas/evidence/61-05-global-test.log`

### Alterados

- `src/components/campaign/campaign-format-chips.tsx`
- `src/components/campaign/__tests__/campaign-format-chips.test.tsx`
- `src/components/campaign/__tests__/campaign-format-chips.ssr.test.tsx`
- `src/__tests__/app/campaign-detail-format.test.tsx`
- `src/__tests__/app/campanha/[id]/client-joint-polling.test.tsx`
- `src/__tests__/app/minhas-campanhas-client.test.tsx`
- `src/app/(app)/campanhas/__tests__/campaign-card-thumbnail.test.tsx`
- `src/components/dashboard/__tests__/available-campaign-card.test.tsx`

### Verificados e intocados

- `src/app/(app)/campanhas/client.tsx`
- `src/app/(app)/campanhas/[id]/client.tsx`
- `src/components/dashboard/available-campaign-card.tsx`
- `src/components/dashboard/dashboard-campaigns.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `src/__tests__/app/dashboard/dashboard-page.test.tsx` (asserções SSR seguem válidas)
- `src/__tests__/app/dashboard/dashboard-localization.test.tsx` (idem)
- `src/components/dashboard/__tests__/dashboard-campaigns.test.tsx` (idem)
- `src/lib/campaign/format-presentation.ts`, i18n de formatos, `src/lib/product-two-format/**`, `src/lib/campaign/format-resolution.ts`, `supabase/**`, `package.json`/`package-lock.json`.

> Discrepância de caminho no plano: `campaign-card-thumbnail.test.tsx` está em
> `src/app/(app)/campanhas/__tests__/`, não em `src/__tests__/app/campanhas/`.
> O arquivo real foi alterado e testado.

---

## Commits locais

| Commit | Tipo | Conteúdo |
|---|---|---|
| `987159d9` | feat | Chip único (link/botão), remoção total do “?”, ajuda ancorada no chip, estado acessível e diferenciação não-cromática; componente + testes de componente/SSR |
| `04ccba09` | test | Adequação das suítes de detalhe/lista/dashboard ao chip único + `61-05-VISUAL-CHECK.md` pendente |
| `6478cabb` | docs | Registro da execução **NÃO ACEITA**, plano/plan-check e logs de gate |
| `97dfe067` | docs | Normalização de whitespace do plano (fecha `git diff --check`) |

---

## Gates — resultados reais

| Gate | Comando | Exit | Resultado |
|---|---|---|---|
| Baseline em leitura (antes de editar) | `npx vitest run .planning/.../evidence/baseline-calls.test.ts` | **0** | 1 arquivo / 1 teste PASS; JSON **não recapturado** |
| Suítes afetadas | 11 arquivos (componente, SSR, detalhe, lista, dashboard) | **0** | **167 testes PASS** |
| Baseline em leitura (depois) | idem, log `61-05-baseline-read-after.log` | **0** | 1 arquivo / 1 teste PASS; `toEqual`; JSON inalterado |
| Typecheck | `npm.cmd run typecheck` | **0** | Sem erros |
| Lint | `npm.cmd run lint` | **0** | Sem erros/avisos |
| Build | `npm.cmd run build` | **0** | `check:cnae OK`; `Compiled successfully in 22.3s`; 102 rotas/páginas |
| Suíte global | `npm.cmd run test` (após commits) | **0** | **844 arquivos PASS**, 2 skipped (846); **10488 testes PASS**, 10 skipped (10498) |
| `git diff --check c971d631..HEAD` | — | **0** | Limpo |
| `git status --porcelain` | — | — | Apenas documentação de planejamento pré-existente modificada, planos/logs `61-05-*` untracked; nenhum código pendente |

Logs: `61-05-baseline-read-after.log`, `61-05-directed.log`, `61-05-typecheck.log`, `61-05-lint.log`, `61-05-build.log`, `61-05-global-test.log`.

### Contagem por arquivo dirigido

| Arquivo | Testes |
|---|---:|
| `campaign-format-chips.test.tsx` | 32 |
| `campaign-format-chips.ssr.test.tsx` | 2 |
| `campanhas/[id]/__tests__/format-presentation.test.tsx` | 36 |
| `campanha/[id]/client-joint-polling.test.tsx` | 8 |
| `campaign-detail-format.test.tsx` | 10 |
| `minhas-campanhas-client.test.tsx` | 30 |
| `campaign-card-thumbnail.test.tsx` | 5 |
| `dashboard-page.test.tsx` | 12 |
| `dashboard-localization.test.tsx` | 6 |
| `available-campaign-card.test.tsx` | 16 |
| `dashboard-campaigns.test.tsx` | 10 |
| **Total** | **167** |

### Baseline de chamadas

Passou em leitura **antes** e **depois**, sem recaptura (`BASELINE_CAPTURE` não
usado). Nenhum I/O real. As contagens de lista/dashboard/detalhe não mudaram
(mesmos fixtures/mocks); o componente não faz fetch nem acessa Supabase/Storage.

---

## Desvios do plano

### 1. [Processo] Tasks 1 e 2 no mesmo commit

- **Motivo:** ambas editam o mesmo componente e a mesma suíte; o `61-05-PLAN-CHECK`
  (W-03) recomendou fundir para não produzir estado intermediário vermelho.
- **Impacto:** `987159d9` concentra a remoção do “?” + ajuda ancorada + suíte
  reescrita. Nenhum comportamento fora do plano.

### 2. [Processo] Arquivos de superfície sem alteração de código

- **Motivo:** `helpLang` e `mb-6` já estavam propagados desde o `61-04`.
- **Impacto:** apenas os testes de superfície foram ajustados. O plano listava os
  arquivos de superfície em `files_modified`, mas nenhuma mudança foi necessária
  neles.

### 3. [Processo] Caminho real do teste de miniatura

- `61-05-PLAN.md` lista `src/__tests__/app/campanhas/campaign-card-thumbnail.test.tsx`;
  o arquivo real é `src/app/(app)/campanhas/__tests__/campaign-card-thumbnail.test.tsx`.
  Alterado e executado no caminho correto.

### 4. [Rule 3 — infraestrutura de teste jsdom] Clique no link

- jsdom tenta navegar ao clicar em `<a href>` e emite “Not implemented: navigation
  to another Document”. No teste de “link não intercepta”, o `href` é trocado
  temporariamente por `#noop` apenas durante o clique (o elemento/handler é o
  mesmo) e o `href` real é conferido em seguida. A navegação real continua sendo
  responsabilidade do navegador; nenhum `preventDefault` é executado pelo
  componente.

### 5. [Info] `messages.infoAria` fica sem consumidor

- A chave “Ver explicação do formato” permanece nos catálogos por compatibilidade,
  mas não é mais usada pelo componente. Não foi removida nesta fatia para não
  reabrir i18n/testes de catálogo. Registrado conforme I-01 do plan check.

### 6. [Processo] `tasks.md` não ticado

- O `61-05` não inclui `openspec/.../tasks.md` em `files_modified`; os checkboxes
  10.x permanecem desmarcados. Nenhuma alegação de change concluída/sincronizada.

### 7. [Rule 3 — gate de formatação] Whitespace do próprio plano

- O `61-05-PLAN.md` (untracked) tinha 5 linhas em branco com espaços; ao ser
  versionado, `git diff --check c971d631..HEAD` passou a falhar. Normalizado em
  commit exclusivo de documentação (`97dfe067`), sem alterar conteúdo/tarefas.

Nenhuma decisão arquitetural nova. Nenhuma alteração de contrato de dados ou
financeiro.

---

## Threat surface / stubs

- **Threat flags:** nenhum. Não há endpoint, rota, auth, schema, consulta ou acesso
  a dado novo; o portal é local e apresenta apenas texto já carregado.
- **Known stubs:** nenhum. Não há placeholder, TODO ou dado vazio fluindo para a UI
  introduzido por este plano.

---

## Limites e pendências

- Execução **local/offline** apenas; nenhum banco, Storage, homolog, produção,
  provider ou chamada paga.
- Gates de integração (Postgres/homolog/local/app-env/Product 1:1/F60/F60.1)
  **NÃO EXECUTADOS** por ausência de ambiente (a saída da suíte global registra
  “GATE NÃO EXECUTADO — NÃO APROVADO”).
- **Validação visual HUMANA PENDENTE:** `61-05-VISUAL-CHECK.md` está marcado como
  **PENDENTE**; nenhuma captura foi gerada e nenhuma aprovação foi simulada.
  `jsdom` não comprova layout.
- **Fase 61 NÃO concluída:** `61-03`/`61-04`/`61-05` não aceitos; sem
  sync/archive/merge/push/deploy. `.planning/STATE.md` e `.planning/ROADMAP.md`
  **não** foram alterados para “fase concluída”.
- Próximo passo: revisão técnica e visual humana no `## Review Stop`.

---

## Self-Check

- [x] Arquivos criados/alterados conferidos no disco.
- [x] Commits `987159d9` e `04ccba09` verificáveis em `git log`.
- [x] `git diff --check c971d631..HEAD` exit 0.
- [x] Nenhum caminho de `supabase/`, `src/lib/product-two-format/`,
      `format-resolution.ts`, migrations ou `package*.json` nos commits.
- [x] Baseline em leitura antes/depois com `toEqual` (JSON inalterado).
- [x] Suíte global: 844 arquivos / 10488 testes PASS, 10 skipped; build exit 0;
      typecheck/lint exit 0.

**Resultado:** ✅ PASSED (verificações mecânicas) — **UX e fase continuam NÃO
aprovadas**.
