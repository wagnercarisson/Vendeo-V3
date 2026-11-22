# Phase 61 Plan 04: refinamento visual compacto + ajuda flutuante

**Status:** ⛔ **NÃO ACEITO / AGUARDANDO REVISÃO TÉCNICA E VISUAL** — executado localmente/offline em 2026-11-21. **SUPERSEDED pelo `61-05`** (remoção do controle “?” e chip como único controle), mantido como histórico. A fase 61 **NÃO** está concluída; a UX **NÃO** está aprovada. A aprovação visual de lista/dashboard/detalhe (desktop e celular) é humana e posterior.

**Executado em:** 2026-11-21
**Branch:** `feat/campaign-format-chips`
**Base da wave:** `47224042` (documentação do plano `61-04`)
**Commits da implementação:** `927f3689`, `e5a1be10`, `04eac3c8`
**Plano:** `61-04-PLAN.md` (`wave: 4`, `depends_on: [61-03]`, `autonomous: false`)
**Dependência:** `61-03` continua **NÃO ACEITO**; este plano é a correção de revisão visual e não o aceita retroativamente.

> Nenhum merge, push, deploy, sync ou archive. Nenhum acesso a banco, Storage,
> homolog, produção, provider ou chamada paga. Nenhuma migration/RPC/flag/pricing/
> copy/miniatura/aprovação/recuperação criada ou alterada. Nenhum builder,
> classificação, lifecycle, autoridade de estado ou contrato financeiro alterado.
> Nenhuma dependência adicionada. `src/lib/product-two-format/**` e
> `src/lib/campaign/format-resolution.ts` intocados.

---

## Objetivo executado

Refinar a apresentação dos chips nas três superfícies:

1. Texto visível apenas “Quadrado 1:1”/“Vertical 9:16”; rótulos de estado e badge “Selecionado” saem do texto visível e permanecem no nome/descrição acessível.
2. Estado completo no modelo e acessível (`role="group"` + descrição `hidden`/`aria-describedby`; link de seleção também descrito).
3. Ajuda flutuante em `createPortal` pós-mount, `position: fixed`, `lang={helpLang}`, clampada na viewport, sem deslocamento/overflow.
4. Interações consistentes de hover/foco/toque/`Escape`/fora, com foco previsível e sem listeners residuais.

---

## O que foi implementado

### Componente `src/components/campaign/campaign-format-chips.tsx`

- **Chips compactos:** texto visível apenas o nome do formato; `delivered` com destaque discreto; `absent` em cinza legível (`text-text-secondary`/`bg-bg-elevated`); `active` com `ring-1 ring-accent-green/40 bg-accent-green/15` e sem badge; `processing`/`unknown`/`unavailable`/`refunded` apenas com indicador pequeno (`Loader2`/`CircleHelp`/`Undo2`). Sem ícones em entregue/ausente normais; sem “Não gerado”, `+`, emojis ou frase longa no chip.
- **Acessibilidade:** cada chip tem wrapper `role="group"` com `aria-label` completo (nome + estado + “Selecionado” quando ativo) e `<p hidden aria-describedby>` com estado + explicação. O link `<a>` (somente `delivered` com `href`) e o `span` informativo também recebem `aria-describedby`.
- **Ajuda flutuante:** `createPortal` para `document.body` apenas após `mounted` (`useEffect`); `position: fixed`; `max-width: min(20rem, calc(100vw - 1rem))`; `max-height` com scroll interno; posição recalculada em `resize`/`scroll` e clampada com margem de 8 px; `lang={helpLang}` no portal.
- **Interações:** hover/foco abrem transitoriamente; primeiro clique após hover/foco **fixa**; segundo clique fecha; toque abre/fecha; clique/toque fora fecha; clique dentro do popover não fecha; mover ponteiro chip→popover mantém aberto; `Escape` fecha, devolve foco ao “?” e usa guarda de supressão para não reabrir; um único popover por vez.
- **Listeners:** `pointerdown`/`keydown` no `document` e `resize`/`scroll` no `window` são adicionados apenas enquanto aberto e removidos no fechamento/desmontagem.
- **Sem efeitos novos:** nenhum fetch, Supabase, Storage, server action, geração, reserva ou provider. `?` é `button type="button"` irmão do link/span, nunca aninhado, com hit area ≥44×44 e sem círculo/borda grande; “?” não navega nem alterna formato.

### Superfícies

- **Lista `/campanhas`:** `helpLang` derivado de `locale` e passado ao componente; chips continuam informativos (sem `href`).
- **Dashboard:** `DashboardCampaigns`/`AvailableCampaignCard` recebem `helpLang` e o repassam; `dashboard/page.tsx` passa `lang` (`es-419`/`undefined`).
- **Detalhe `/campanhas/[id]`:** `PageFormatChips` passa `helpLang` e ganhou `mb-6` para espaçamento consistente entre chips e arte. Seleção, `hrefs` apenas `delivered`, `?format=` estrito, preview/download, polling, aprovação e recuperação preservados.

---

## Os quatro cuidados obrigatórios

| Cuidado | Implementação | Prova automatizada |
|---|---|---|
| 1. Descrição acessível também no link de seleção | `aria-describedby` no `<a>` e no `span`, além do `role="group"` | `toHaveAccessibleDescription` no link ativo e não ativo; descrição `hidden`/`not.toBeVisible` |
| 2. Ponteiro chip → ajuda não fecha | `popoverHoveredRef` + fechamento com atraso de 120 ms cancelado ao entrar no popover | teste “mover o ponteiro do chip para o popover mantém a ajuda aberta” |
| 3. `Escape` fecha sem reabrir pelo foco devolvido | `suppressFocusRef` consumido no primeiro `focus` após `Escape`; `button.focus()` | teste “Escape fecha, devolve o foco ao '?' e não reabre imediatamente” |
| 4. Listeners removidos ao fechar/desmontar | efeitos com cleanup por `activeKey`; guardas de estado nos callbacks | teste compara `addEventListener`/`removeEventListener` por tipo em dois ciclos e confirma ausência de reação após fechado |

---

## Arquivos

### Criados

- `src/components/campaign/__tests__/campaign-format-chips.ssr.test.tsx` — `renderToString` em ambiente node, sem `document`/portal.
- `.planning/phases/61-padronizar-chips-formatos-campanhas/61-04-VISUAL-CHECK.md` — checklist **PENDENTE** de inspeção humana.
- `.planning/phases/61-padronizar-chips-formatos-campanhas/evidence/61-04-*.log` — logs de build/suíte global.

### Alterados (escopo)

- `src/components/campaign/campaign-format-chips.tsx`
- `src/components/campaign/__tests__/campaign-format-chips.test.tsx`
- `src/app/(app)/campanhas/client.tsx`
- `src/app/(app)/campanhas/[id]/client.tsx`
- `src/components/dashboard/available-campaign-card.tsx`
- `src/components/dashboard/dashboard-campaigns.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `src/__tests__/app/campaign-detail-format.test.tsx`
- `src/__tests__/app/campanha/[id]/client-joint-polling.test.tsx`
- `src/__tests__/app/minhas-campanhas-client.test.tsx`
- `src/__tests__/app/campanhas/campaign-card-thumbnail.test.tsx`
- `src/__tests__/app/dashboard/dashboard-page.test.tsx`
- `src/__tests__/app/dashboard/dashboard-localization.test.tsx`
- `src/components/dashboard/__tests__/available-campaign-card.test.tsx`
- `src/components/dashboard/__tests__/dashboard-campaigns.test.tsx`

### Intocados (confirmado por escopo/`git status`)

- `supabase/**`, `src/lib/product-two-format/**`, `src/lib/campaign/format-resolution.ts`, `src/lib/campaign/format-presentation.ts`, i18n de formatos, RPCs, flags, pricing, provider, copy, miniatura, aprovação, recuperação.
- `package.json`/`package-lock.json` (nenhuma dependência nova).

---

## Commits locais

| Commit | Tipo | Conteúdo |
|---|---|---|
| `927f3689` | feat | Componente compacto + `role="group"`/descrição + ajuda flutuante/portal + testes de componente e SSR |
| `e5a1be10` | feat | Integração nas três superfícies (`helpLang`), espaçamento do detalhe, testes de superfície e `61-04-VISUAL-CHECK.md` |
| `04eac3c8` | test | Teste de remoção de listeners e ausência de reação após fechamento |

---

## Gates — resultados reais

| Gate | Comando | Exit | Resultado |
|---|---|---|---|
| Baseline em leitura (antes de editar) | `npx vitest run .../evidence/baseline-calls.test.ts` | **0** | 1 arquivo / 1 teste; `toEqual`; JSON **não recapturado** |
| Typecheck | `npm.cmd run typecheck` | **0** | Sem erros |
| Lint | `npm.cmd run lint` | **0** | Sem erros/avisos |
| Suítes dirigidas | 11 arquivos (componente, SSR, detalhe, lista, dashboard) | **0** | **164 testes PASS** (detalhe por arquivo abaixo) |
| Baseline em leitura (depois) | `npx vitest run .../evidence/baseline-calls.test.ts` | **0** | 1 arquivo / 1 teste; `toEqual`; JSON inalterado |
| Build | `npm.cmd run build` | **0** | `check:cnae OK`; `Compiled successfully in 9.9s`; 102 rotas/páginas |
| Suíte global (primeira) | `npm.cmd run test` | **1** | 2 falhas de *clean-tree guard* (`boundaries.contract`, `joint-boundaries.contract`) por arquivos não commitados; reexecutado após commit |
| Guardas de fronteira pós-commit | `npx vitest run …/boundaries.contract.test.ts …/joint-boundaries.contract.test.ts` | **0** | 2 arquivos / 13 testes PASS |
| Suíte global (final) | `npm.cmd run test` | **0** | **844 arquivos PASS**, 2 skipped (846); **10485 testes PASS**, 10 skipped (10495) |
| `git diff --check c971d631..HEAD` | — | **0** | Limpo |
| `git status --porcelain` | — | — | Apenas logs `61-04-*.log` untracked antes do commit documental |

Logs: `61-04-build.log`, `61-04-global-test.log`, `61-04-global-test-postcommit.log`, `61-04-global-test-final.log`.

### Contagem por arquivo dirigido

| Arquivo | Testes |
|---|---:|
| `campaign-format-chips.test.tsx` | 29 |
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
| **Total** | **164** |

### Baseline de chamadas

Passou em leitura **antes** e **depois**, sem recaptura do JSON (`toEqual`). Nenhuma chamada adicional causada pelos chips foi introduzida. As contagens de lista/dashboard/detalhe não mudaram (mesmos fixtures/mocks). Nenhum I/O real.

---

## Desvios do plano

### 1. [Processo] Tasks 1 e 2 no mesmo commit

- **Motivo:** o componente é um único arquivo que implementa simultaneamente chips compactos (Task 1) e ajuda flutuante (Task 2). Separá-los exigiria um estado intermediário artificial no mesmo arquivo, sem valor de revisão.
- **Impacto:** o commit `927f3689` concentra Task 1 + Task 2. Documentado para rastreabilidade; nenhum comportamento fora do escopo.

### 2. [Processo] Testes de lista/dashboard atualizados no commit da Task 3

- **Motivo:** a mudança do componente altera o texto visível e os nomes acessíveis usados por testes de lista/dashboard. A atualização desses testes foi feita junto com a integração das superfícies (Task 3), no commit `e5a1be10`.
- **Impacto:** no commit intermediário `927f3689`, os testes de superfície antigos ainda esperavam rótulos visíveis e não passariam. O estado **final** (`04eac3c8`) está verde em typecheck/lint/build/global. Registrado para transparência; não há regressão final.

### 3. [Rule 3 — infraestrutura de teste] Guardas de árvore limpa

- A primeira execução global (antes do commit) falhou em `boundaries.contract.test.ts` e `joint-boundaries.contract.test.ts` porque o working tree continha `src/app/(app)/dashboard/page.tsx` e um teste alterados. É guard de árvore limpa, não regressão de comportamento. Reexecutado após os commits: 13/13 PASS; suíte global final exit 0.

Nenhum desvio de escopo. Nenhuma decisão arquitetural nova. Nenhuma alteração de contrato de dados/financeiro.

---

## Threat surface / stubs

- **Threat flags:** nenhum. Não há endpoint, rota, auth, schema ou acesso a dado novo; o portal é local e só apresenta texto já carregado.
- **Known stubs:** nenhum. Não há placeholder, TODO ou dado vazio fluindo para a UI introduzido por este plano.

---

## Limites e pendências

- Execução **local/offline** apenas; nenhum banco, Storage, homolog, produção, provider ou chamada paga.
- Gates de integração (Postgres/homolog/local/app-env/Product 1:1/F60/F60.1) **NÃO EXECUTADOS** por ausência de ambiente.
- **Validação visual HUMANA PENDENTE:** `61-04-VISUAL-CHECK.md` está marcado como **PENDENTE**; nenhuma captura foi gerada e nenhuma aprovação visual foi simulada. `jsdom` não comprova layout.
- **Fase 61 NÃO concluída:** `61-03` e `61-04` não aceitos; sem sync/archive/merge/push/deploy. `STATE.md`/`ROADMAP.md` **não** foram alterados para “fase concluída”.
- Próximo passo: revisão técnica e visual humana no `## Review Stop`; incorporar ajustes visuais se houver.

---

## Self-Check: PASSED

- Arquivos criados/alterados conferidos no disco.
- Commits `927f3689`, `e5a1be10`, `04eac3c8` verificáveis em `git log`.
- `git diff --check c971d631..HEAD` exit 0; `git status --porcelain` apenas logs documentais untracked.
- Nenhum caminho de `supabase/`, `src/lib/product-two-format/` ou `src/lib/campaign/format-resolution.ts` nos commits.
- Baseline em leitura antes/depois com `toEqual` (JSON inalterado).
- Suíte global final: 844 arquivos / 10485 testes PASS, 10 skipped, 0 falhas; build exit 0.
