# Phase 61 Plan 03: detalhe `/campanhas/[id]` com chips compartilhados

**Status:** ⛔ **NÃO ACEITO / AGUARDANDO REVISÃO** — executado localmente/offline em 2026-11-21; parada obrigatória no `## Review Stop`. A fase 61 **NÃO** está concluída nem aceita como um todo.

**Executado em:** 2026-11-21
**Branch:** `feat/campaign-format-chips`
**Base da wave:** `c2886376` (aceite local do `61-02`)
**HEAD da implementação:** `0dfd2f65`
**Duração:** ~17 min (20:41Z → 20:58Z)

> Nenhum merge, push, deploy, sync ou archive. Nenhum acesso a banco, Storage,
> homolog, produção, provider ou chamada paga. Nenhuma migration/RPC/flag/pricing/
> copy/miniatura/aprovação/recuperação criada ou alterada. `src/lib/product-two-format/**`
> e `src/lib/campaign/format-resolution.ts` intocados. A validação visual das
> superfícies continua **HUMANA e pendente**.

---

## Objetivo executado

Migrar o detalhe `/campanhas/[id]` para os chips compartilhados **no nível da página**,
preservando seleção conjunta, `?format=` estrito, gates, preview/download, polling e
recuperação:

1. `CampaignPageProps.formatPresentation` (obrigatório, DTO seguro) + `formatHrefs?`;
   default FAIL-CLOSED `buildUnknownFormatPresentation()` em `mapCampaignToProps`.
2. Montagem server-side da apresentação em TODOS os ramos da página (indeterminado,
   inconsistente, controle ausente, leitura conjunta falhou, conjunto, novo fluxo,
   legado, aprovação/regeneração).
3. Chips abaixo do `PageHeader` nos dois caminhos, uma única vez, em todos os estados;
   remoção dos blocos duplicados de `ReadyView`/`NewFlowDeliveredView`.
4. Nota conjunta única e localizada (`messages.jointNotes`), com `invalidRequest`
   tendo precedência.
5. Matriz de detalhe + prova de zero chamadas adicionais.

---

## Commits locais

| Commit | Tipo | Conteúdo |
|---|---|---|
| `aed5db7e` | feat | DTO + mapeamento server-side + chips no nível da página + nota única + matriz de testes/fixtures |
| `0dfd2f65` | fix | Estado conjunto `unknown` não exibe nota de processamento; teste dedicado |
| `90a5fee3` | chore | Normalização de whitespace das evidências de build/baseline |

> **Desvio de processo:** as Tasks 1 e 2 foram commitadas juntas. O campo
> `formatPresentation` é OBRIGATÓRIO, então os fixtures da Task 2 são necessários
> para o typecheck que valida a Task 1; separar produziria commit intermediário
> com `typecheck` vermelho. Nenhuma alteração de comportamento ficou fora do
> escopo do plano.

---

## Arquivos

### Criados

- `src/app/(app)/campanhas/[id]/__tests__/format-presentation.test.tsx` (**36 testes**)
- `.planning/phases/61-padronizar-chips-formatos-campanhas/evidence/61-03-*.log`

### Alterados (escopo do plano)

- `src/lib/campaign/display.ts` — `readonly formatPresentation`/`formatHrefs?` no DTO;
  default fail-closed em `mapCampaignToProps`.
- `src/app/(app)/campanhas/[id]/page.tsx` — builders por ramo; ativo somente com
  preview/arte; hrefs somente `delivered`; nenhum parser/leitura/gate alterado.
- `src/app/(app)/campanhas/[id]/client.tsx` — `PageFormatChips` abaixo do
  `PageHeader` nos dois caminhos; `jointNoteFor`; remoção dos dois blocos
  duplicados; `lang="es-419"` restrito à região dos chips.
- `src/__tests__/app/campanhas/campaign-detail-joint.test.tsx` — fixtures/asserções
  de `formatPresentation`/`formatHrefs`.
- `src/__tests__/app/campaign-detail-format.test.tsx` — `formatPresentation` +
  4 testes novos de chips/estados/aprovação/regeneração.
- `src/__tests__/api/campaign-page.test.tsx` — `formatPresentation` + asserções de
  localização escopada dos chips.
- `src/__tests__/api/campaign-approval-view-problem.test.tsx` — `formatPresentation`.
- `src/__tests__/app/campanha/[id]/client.test.tsx` — `formatPresentation`.
- `src/__tests__/app/campanha/[id]/client-joint-polling.test.tsx` —
  `formatPresentation` + 2 testes (links só entregues, nota única/precedência).
- `src/app/(app)/campanhas/[id]/__tests__/persisted-state.test.tsx` — `formatPresentation`.
- `src/app/(app)/campanhas/[id]/__tests__/copy-recovery-driving.test.tsx` —
  `formatPresentation`.
- `src/__tests__/app/campanhas/campanhas-page.test.tsx` — fixture de lista (desvio
  Rule 3; ver abaixo).

### Alterado por desvio (Rule 3)

- `src/__tests__/app/campanhas/campanhas-page.test.tsx` — não está em
  `files_modified`, mas está no glob dirigido do plano; o fixture montava
  `CampaignListItem` sem `formatPresentation` e quebrava o render com
  `Cannot read properties of undefined (reading 'formats')`. Apenas a fixture
  ganhou o campo (builder puro), sem relaxar asserções.

### Intocados (confirmado por `git show --name-only` + grep)

- `supabase/**`
- `src/lib/product-two-format/**`
- `src/lib/campaign/format-resolution.ts`
- `package.json` / `package-lock.json`
- `src/components/flow/__tests__/campaign-page-client-format.test.tsx` (fluxo de
  criação; não pertence ao detalhe)

---

## Gates — resultados reais

| Gate | Comando | Exit | Resultado |
|---|---|---|---|
| Baseline em leitura (antes de editar) | `npx vitest run .planning/.../evidence/baseline-calls.test.ts` | **0** | `toEqual` contra o JSON imutável |
| Typecheck | `npm.cmd run typecheck` | **0** | Sem erros |
| Lint | `npm.cmd run lint` | **0** | Sem erros/avisos |
| Task 1 | `npx vitest run .../format-presentation.test.tsx campaign-detail-joint.test.tsx` | **0** | 2 arquivos / **43 testes** |
| Task 2 | `npx vitest run <9 arquivos dirigidos>` | **0** | 9 arquivos / **142 testes** |
| Suítes dirigidas do plano | `npx vitest run <modelo, i18n, componente, lista, dashboard, detalhe, baseline>` | **0** | **63 arquivos / 637 testes PASS** |
| Baseline em leitura (depois) | `npx vitest run .../evidence/baseline-calls.test.ts` | **0** | `toEqual`; JSON inalterado |
| Suíte global | `npm.cmd run test` | **0** | **843 arquivos PASS**, 2 skipped (845); **10467 testes PASS**, 10 skipped (10477) — log `61-03-global-test-post-unknown-fix.log` |
| Build | `npm.cmd run build` | **0** | `check:cnae OK`; 102 páginas estáticas |
| `git diff --check` | `git diff --check` | **0** | Limpo |
| `git status --porcelain` | — | — | Apenas logs `61-03-*.log` untracked antes do commit documental |

Logs brutos em `.planning/phases/61-padronizar-chips-formatos-campanhas/evidence/`:
`61-03-typecheck.log`, `61-03-lint.log`, `61-03-directed.log`,
`61-03-global-test.log` (10.466, antes do teste de `unknown`),
`61-03-global-test-post-unknown-fix.log` (10.467, execução posterior),
`61-03-build.log`, `61-03-baseline-read.log`.

### Reconciliação da suíte global

- `61-03-global-test.log` registra **10.466 PASS / 10 skipped** — execução
  pós-commit, antes do teste dedicado ao estado `unknown`.
- `61-03-global-test-post-unknown-fix.log` registra **10.467 PASS / 10 skipped**
  — **nova execução global** após acrescentar 1 teste em
  `client-joint-polling.test.tsx`.
- O delta de **+1** é o teste novo; não é uma soma de resultados de execuções
  diferentes. Os totais de 10.466 e 10.467 pertencem a duas execuções distintas
  e ambas ficaram preservadas.

### Observação sobre a suíte global (não mascarada)

Na primeira execução global **antes** do commit, o contrato F60.4
(`src/lib/campaign/square-base/__tests__/boundaries.contract.test.ts`) falhou
listando 3 arquivos de teste do detalhe no working tree. É um **guard de árvore
limpa** (não regressão de comportamento). Reexecutado após o commit: **7/7 PASS**;
a suíte global pós-commit passou integralmente (exit 0).

**Falhas preexistentes:** nenhuma (baseline do 61-01 tinha todos os gates verdes).
**Falhas introduzidas:** nenhuma no estado final.

---

## Contagens de testes (antes × depois)

| Arquivo | Antes (`c2886376`) | Depois (`aed5db7e`) |
|---|---:|---:|
| `src/app/(app)/campanhas/[id]/__tests__/format-presentation.test.tsx` | 0 | **36** |
| `src/__tests__/app/campanhas/campaign-detail-joint.test.tsx` | 7 | 7 |
| `src/__tests__/app/campaign-detail-format.test.tsx` | 5 | 9 |
| `src/__tests__/app/campanha/[id]/client-joint-polling.test.tsx` | 5 | 7 |
| `src/__tests__/api/campaign-page.test.tsx` | 11 | 11 |
| `src/__tests__/api/campaign-approval-view-problem.test.tsx` | 17 | 17 |
| `src/__tests__/app/campanha/[id]/client.test.tsx` | 13 | 13 |
| `src/app/(app)/campanhas/[id]/__tests__/persisted-state.test.tsx` | 59 | 59 |
| `src/app/(app)/campanhas/[id]/__tests__/copy-recovery-driving.test.tsx` | 8 | 8 |
| `src/__tests__/app/campanhas/campanhas-page.test.tsx` | 14 | 14 |
| **Total dos arquivos tocados** | **139** | **181** (+42) |

Suíte global: 61-01 registrou **10375 PASS / 10 skipped**; estado final **10467 PASS / 10 skipped** (+92). Nenhum teste removido.

---

## Prova de ZERO chamadas adicionais

`format-presentation.test.tsx` reexecuta a página real com fixtures fixas e afirma
contagens idênticas ao baseline do 61-01:

| Fixture | control | delivery | durable | attemptStart | signedPreview | copyDelivery | copyCancel | copyRecovery | probes | createSignedUrl |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `detail.joint` | 1 | 1 | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 1 |
| `detail.new_flow` | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 1 | 1 | 0 |
| `detail.legacy` | 0 | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 1 |

`baseline-calls.test.ts` (lista/dashboard/detalhe) continuou passando em leitura
antes e depois (**zero drift**). Polling, `router.refresh`, RPC/recuperação
existentes e assinatura de miniaturas permanecem intactos.

---

## Matriz de comportamento entregue (detalhe)

| Caso | Resultado |
|---|---|
| Conjunta completa | dois `delivered`; ativo pelo `?format=` e **somente** com `previewUrl`; hrefs só entregues |
| Conjunta sem `?format=` | preferido entregue ativo |
| `previewFormat` sem `previewUrl` | `delivered` sem ativo (sem “Selecionado”) |
| Conjunta parcial estornada | `absent` + `Crédito devolvido`, `partial=true`, sem href |
| `?format=` inválido/vazio/duplicado | falha fechado: sem ativo, sem preview/download |
| `?format=` de formato não entregue | não cai no irmão; sem link no não entregue |
| Controle ausente | ambos `unavailable` |
| Leitura conjunta falha | ambos `unknown` |
| Snapshot conjunto inconsistente | ambos `unavailable` |
| Novo fluxo delivered + arte | entregue e ativo; outro `Não incluído` |
| Novo fluxo delivered sem arte | entregue **sem** ativo |
| `running` | `processing` |
| `refunded` | `absent` + crédito devolvido |
| `unknown` | ambos `unknown` |
| Vertical por expansão | `9:16` conforme ciclo; `1:1` `not_requested` |
| Legado ready + arte | `1:1` entregue e ativo |
| Legado ready sem arte | entregue sem ativo |
| Legado `generating` | `processing` |
| Legado `stale` / `error` | `unknown` (nunca ausência / “Não gerado”) |
| Aprovação `pending` com candidata | `delivered` sem ativo; gate preservado |
| `regenerating` | `processing` sem ativo |
| Resolução `unavailable` | ambos `unavailable`; **vence** aprovação/regeneração |
| Snapshot nulo | `malformed_format` ⇒ ambos `unavailable` |
| Snapshot não-objeto/array | fluxo indeterminado ⇒ ambos `unknown` |
| Snapshot objeto malformado/incoerente | ambos `unavailable`; sem fallback `1:1` |

---

## Desvios do plano

### 1. [Rule 3 — conflito de contrato] Campo `readonly` + atribuição na página

- **Encontrado durante:** Task 1 (typecheck).
- **Problema:** o plano pede `readonly formatPresentation` **e** `props.formatPresentation = ...`
  antes de cada `return`; TS rejeita atribuição em propriedade `readonly`.
- **Correção:** mantidos os campos `readonly` no DTO e a página passou a atribuir por
  spread funcional (`props = { ...props, formatPresentation, ... }`). Sem mudança de
  comportamento/ordem; nenhum campo existente alterado.

### 2. [Rule 3 — fixture obrigatória] `campanhas-page.test.tsx`

- **Encontrado durante:** suítes dirigidas do plano (63 arquivos).
- **Problema:** fixture de `CampaignListItem` sem `formatPresentation` quebrava o
  render da listagem (`presentation.formats` undefined).
- **Correção:** campo adicionado ao fixture com builder puro; asserções preservadas.

### 3. [Adequação à spec] Localização escopada dos chips

- Dois testes existentes de `campaign-page.test.tsx` afirmavam ausência de
  `lang="es-419"` em aprovação/`generating`. A spec `campaign-page-ui` exige os chips
  localizados nesses estados (e somente eles). As asserções foram atualizadas para
  provar: (a) restante do estado em português; (b) exatamente uma região `es-419`
  (a dos chips); (c) nenhum wrapper novo no restante da página.

### 4. [Processo] Tasks 1 e 2 no mesmo commit

- Justificado no topo (campo obrigatório → typecheck). Documentado como desvio
  consciente, sem perda de rastreabilidade.

### 5. [Correção de coerência] Estado conjunto `unknown` sem nota de processamento

- **Encontrado na revisão final:** a nota padrão do bloco conjunto exibia
  “Processando formatos...” também para `joint.state === "unknown"`, contradizendo
  os chips (`unknown`) e o `UnknownResultPanel`.
- **Correção:** `jointNoteFor` agora mapeia `processing → processing` e
  `unknown → null`; o painel de indeterminação comunica o estado. Teste dedicado
  em `client-joint-polling.test.tsx` garante a ausência da nota de processamento.

Nenhum desvio de escopo. Nenhuma decisão arquitetural nova.

---

## Acessibilidade / localização / responsividade cobertas por teste

- `<ul aria-label>` único por página (nos dois caminhos).
- Botão de informação: `aria-expanded`, `aria-controls`, `aria-label` concatenado,
  alvo `min-h-11 min-w-11` (44 px) e `focus-visible:ring-2`; nunca `disabled`.
- Estado por texto + ícone (`Check`, `Loader2`, `CircleSlash`, `Undo2`, `CircleHelp`),
  nunca só cor; sem `+`, sem “Não gerado”, sem emoji.
- Hover/foco abrem; clique alterna (1º fixa, 2º fecha); explicação `role="note"`
  reconciliada com `hidden`.
- `flex min-w-0 flex-wrap` (sem overflow estrutural).
- `pt-BR`/`es-419` pelo catálogo compartilhado; região dos chips recebe
  `lang="es-419"` mesmo com o restante em português; conteúdo persistido `lang=""`.

**Confirmação visual final permanece humana e pendente.**

---

## Riscos / pontos para revisão

1. **Duplicação residual mínima:** `PageFormatChips` é renderizado em dois `return`s
   (novo fluxo e legado). A estrutura é única; não há dois `<ul>` na mesma página.
2. **Hrefs conjuntos:** entregues recebem link mesmo quando `?format=` é inválido —
   é a via de recuperação prevista (“Escolha um dos formatos entregues”). Nenhum
   link para não entregue.
3. **Fallback fail-closed:** o default de `mapCampaignToProps` é `unknown`; todo ramo
   real sobrescreve explicitamente. Testes cobrem cada ramo.
4. **Build/lint/typecheck** verdes neste ambiente Windows/local. Gates de integração
   (Postgres/homolog/local/app-env/Product 1:1/F60/F60.1) **NÃO EXECUTADOS** por
   ausência de ambiente.
5. **Fase 61 NÃO concluída:** `61-03` não aceito; sem sync/archive/merge/push/deploy.

---

## Limites de execução

- Local/offline apenas; nenhum banco, Storage, homolog, produção, provider ou chamada paga.
- Nenhuma migration, RPC, flag, pricing, copy, miniatura, aprovação ou recuperação alterada.
- `src/lib/product-two-format/**` e `src/lib/campaign/format-resolution.ts` intocados.
- Nenhum merge, push, deploy, sync ou archive.
- `STATE.md`/`ROADMAP.md` **não** foram atualizados para “fase concluída”.

---

## Self-Check: PASSED

- Arquivos criados/alterados conferidos no disco (todos presentes).
- Commit `aed5db7e` verificável em `git log`.
- `git diff --check` exit 0; `git status --porcelain` limpo exceto logs documentais.
- Nenhum caminho de `supabase/`, `src/lib/product-two-format/` ou
  `src/lib/campaign/format-resolution.ts` no commit.
- Baseline em leitura antes/depois com `toEqual` (JSON inalterado).
- Suíte global pós-commit: 843 arquivos / 10467 testes PASS, 10 skipped, 0 falhas.
