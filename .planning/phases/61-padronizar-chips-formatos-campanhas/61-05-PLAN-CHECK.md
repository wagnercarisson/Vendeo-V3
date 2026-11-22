# Phase 61 — Plan Check do plano `61-05` (remoção do “?” e chip como único controle)

**Fase:** `61-padronizar-chips-formatos-campanhas`
**Plano verificado:** `61-05-PLAN.md` (`wave: 5`, `depends_on: [61-04]`, `autonomous: false`)
**Change OpenSpec:** `padronizar-chips-formatos-campanhas`
**Método:** goal-backward + confronto com o código real, testes atuais, `design.md`, delta specs, `tasks.md`, `61-CONTEXT.md` e `61-BASELINE.md`. Revisão **somente leitura**: nenhum código, teste, plano, banco, Storage, provider, migration, ambiente, merge/push/sync/archive foi tocado.
**Data:** 2026-11-22

---

## Veredito

# ❌ ISSUES FOUND

**1 BLOCKER · 11 WARNING · 5 INFO**

O plano é bem direcionado e resolve o defeito central do `61-04` (separar o “?” do chip). A remoção do controle independente, a semântica `<a>`/`<button>`, o portal ancorado no chip, o SSR, o `lang`, o foco e o cleanup estão cobertos. Porém, **a remoção dos rótulos visíveis deixa `delivered` × `absent` distinguíveis apenas por matiz**, e nenhuma truth/task/teste do `61-05` cobre o requisito **FMT-VIS-03 / design §9 “não depender exclusivamente de cor”**. Isso é bloqueante porque o próprio plano remove o último rótulo visível e declara FMT-VIS-03 no frontmatter.

Além disso, há inconsistências de contrato (truth do detalhe e dois trechos do `design.md` ainda citam o “?”), acoplamento entre Task 1 e Task 2, e lacunas de prova (zero consultas, um popover, posicionamento) que podem gerar falso verde/retrabalho.

---

## Gates executados nesta revisão

| Gate | Resultado |
|---|---|
| `gsd-sdk query verify.plan-structure 61-05-PLAN.md` | ✅ `valid: true`, 3 tasks com `files/action/verify/done` |
| `npx --no-install openspec validate padronizar-chips-formatos-campanhas --strict` | ✅ `Change ... is valid` |
| `files_modified` × `<files>` das tasks | ✅ 18 únicos em `files_modified`; 18 cobertos pelas Tasks 1/2/3; 0 órfãos, 0 arquivo de task fora do plano |
| Grafo de dependências | ✅ `61-05 → 61-04 → 61-03`; `wave 5 = wave 4 + 1`; sem ciclo/forward reference |
| Baseline físico | ✅ `.planning/phases/61-.../evidence/baseline-calls.test.ts` + `baseline-calls.json` existem; teste em modo leitura é idempotente (`61-PLAN-CHECK.md:17`) |
| `workflow.nyquist_validation` | `false` em `.planning/config.json` → Dimensão 8 **SKIPPED** |
| `RESEARCH.md` / Responsibility Map | inexistente → Dimensões 7c, 8 e 11 **SKIPPED** |
| `PATTERNS.md` | existe; plano não cria arquivo novo de código (só o visual check), então não há analog obrigatório para arquivo novo → **PASS** com nota |
| `git status --porcelain` | apenas documentação (`61-CONTEXT`, `design.md`, `proposal.md`, 4 specs, `tasks.md`) modificada e `61-05-PLAN.md` untracked; **nenhum código alterado nesta revisão** |

---

## 1. Cobertura requisito → tarefa

Os IDs de 61 vêm de `61-CONTEXT.md:36-51` (o `ROADMAP.md` não tem entrada operacional da fase 61). Este é um plano **complementar**: FMT-MODEL-02, FMT-AUTH-08 e FMT-SCOPE-09 não são reabertos aqui e permanecem cobertos por 61-01/02/03.

| ID | Tarefa(s) | Evidência no plano | Status |
|---|---|---|---|
| **FMT-PRES-01** — dois chips, mesma linguagem nas 3 superfícies | T1, T3 | Componente único + testes de superfície | ✅ Coberto |
| **FMT-VIS-03** — texto+forma, ativo distinto, nunca “Não gerado”, **sem cor exclusiva** | T1 | `PLAN:94` preserva semântica visual, mas **não nomeia** o diferenciador não-cromático | ❌ **B-01** |
| **FMT-A11Y-04** — hover/foco/toque, foco visível, 44×44, sem disabled | T1, T2 | `PLAN:94,106,108,110` | ✅ Coberto |
| **FMT-INFO-05** — lista/dashboard informativos, sem navegar/gerar | T3 | `PLAN:123-127` | ✅ Coberto |
| **FMT-EFFECT-06** — nenhum efeito novo | T2, T3 | Nenhum fetch/RPC; prova por baseline | ⚠️ **W-06** (prova estática não nomeada) |
| **FMT-DETAIL-07** — seleção conjunta, `?format=` estrito, gates | T3 | `PLAN:124-127` | ✅ Coberto |
| **FMT-I18N-11** — catálogo pt-BR/es-419, responsivo | T2, T3 | `PLAN:110,126` (`es-419`, dashboard-localization) | ✅ Coberto |
| **FMT-PERF-10** — zero chamadas adicionais, lote | T1, T3 | `PLAN:87,133` (baseline em leitura antes/depois) | ⚠️ **W-06** |
| **LIST-UI-12** — card único, dois chips, ações preservadas | T3 | `PLAN:120,123-127` | ✅ Coberto |
| **DASH-UI-13** — linha única, contagem/miniatura/abertura | T3 | `PLAN:120,127` | ✅ Coberto |
| **PAGE-UI-14** — individual/legado, aprovação, regeneração | T1, T3 | `PLAN:91,124-127` | ✅ Coberto, com **W-01** |

Nenhum requisito do `61-CONTEXT` aplicável a esta fatia ficou sem tarefa. O problema de FMT-VIS-03 é **cobertura parcial**, não ausência.

---

## 2. Checklist do pedido

| Item pedido | Situação | Observação |
|---|---|---|
| 1. Sem “?” separado; chip é `<a>` ou `<button type="button">`; sem nested/handlers duplicados | ✅ | `PLAN:32,89-94`; componente atual centraliza tudo em `campaign-format-chips.tsx` — não há “?” em outras superfícies (grep: só o componente) |
| 2. Detalhe entregue seleciona no primeiro toque; não entregue/excepcional abre só ajuda; lista/dashboard explica sem navegar/gerar | ✅ com ressalva | `PLAN:34,90-92`; ressalva em **W-01** para entregue **sem `href`** |
| 3. Desktop hover/foco; ajuda ancorada; sem layout shift/overflow; portal/SSR/lang/Escape/fora/um popover; foco devolvido; listeners | ✅ | `PLAN:36-38,106-110,113` |
| 4. Estado completo acessível, compacto, sem rótulos/badge, **sem cor exclusiva** | ❌ | **B-01** |
| 5. Preservação de builders/classificação/lifecycle/autoridades/`?format=`/preview/download/polling/aprovação/recuperação/miniaturas/contagens/i18n; zero consultas | ⚠️ | Escopo de arquivos preserva; prova de zero consultas em **W-06** |
| 6. Executabilidade: 3 tasks, files/verify, baseline sem recaptura, typecheck/lint/build/global, diff-check, visual pendente, Review Stop | ⚠️ | **W-03/W-04/W-05/W-10**; tudo o mais presente (`PLAN:131-136,157-162`) |

---

## 3. BLOCKER

### B-01 — `delivered` × `absent` passam a depender exclusivamente de cor (FMT-VIS-03)

- **Dimensão:** requirement coverage / verification derivation.
- **Onde:** `61-05-PLAN.md:32-40` (truths), `61-05-PLAN.md:94` (ação da Task 1); `61-05-PLAN.md:27` declara **FMT-VIS-03**.
- **Contrato violado:** `openspec/.../specs/campaign-format-presentation/spec.md:63` — “A distinção NÃO SHALL depender exclusivamente de cor.”; `design.md:206` — “Não depender só de cor: forma (borda/fundo/indicador) + estado acessível completo.”
- **Estado atual que o plano manda preservar:** `src/components/campaign/campaign-format-chips.tsx:71-78` — `delivered` = `text-text-primary bg-accent-green/10 border-accent-green/30`; `absent` = `text-text-secondary bg-bg-elevated border-border`. Mesma largura/estilo de borda, ambos preenchidos, sem indicador; **toda a diferença é matiz**. O teste atual só afere tokens de cor (`campaign-format-chips.test.tsx:201-216`).
- **Por que o 61-05 agrava:** a Task 1 remove os rótulos visíveis (“Disponível”/“Não incluído”), que eram o último canal não-cromático. Sem um diferenciador de forma/preenchimento, um usuário com baixa discriminação de cor não distingue os dois estados.
- **Por que a descrição acessível não resolve:** o `aria-label`/`aria-describedby` atende leitores de tela, mas o SHALL é sobre **distinção visual**; são frases separadas na spec.
- **Fix hint:** na Task 1, definir um diferenciador não-cromático compatível com “sem ícones nos estados normais” (ex.: `delivered` com `border-2`/borda sólida mais espessa e `absent` com `border`; ou `absent` sem preenchimento `bg-transparent` contra `delivered` preenchido) e adicionar asserção no teste de componente de que a diferença **não** é apenas troca de token de cor. Ajustar a truth correspondente.

---

## 4. WARNINGS

### W-01 — Truth do detalhe contradiz a própria ação para entregue **sem `href`** (individual/legado)

- `PLAN:34`: “No detalhe, chip entregue é `<a>` e um único toque seleciona…”; `PLAN:91`: “detalhe entregue **sem `href`** … `<button type="button">`”.
- Em individual/legado, `formatHrefs` é `undefined` (`src/app/(app)/campanhas/[id]/__tests__/format-presentation.test.tsx:531,542,622,717`), logo o chip entregue será `<button>` — a truth é falsa nesse caminho.
- A spec também exagera: `specs/campaign-page-ui/spec.md:63,129` dizem que **todo** entregue é link; `design.md:141` admite “sem `href` → button”. Um verifier que leia a truth/spec reprova o caso legado.
- **Fix:** qualificar truth e spec (“entregue **com href** no detalhe é `<a>`; entregue sem href é `<button>`”) ou declarar explicitamente que individual/legado não tem seleção e o chip só explica.

### W-02 — Ajuste OpenSpec incompleto: `design.md` ainda prescreve o “?”

- `design.md:210`: “área acionável ≥44×44 px **no “?” e no link** de seleção” — contradiz `design.md:145` (“Sem controle “?” separado…”).
- `design.md:224`: mitigação “popover flutuante em portal, **“?” ≥44 px**…” — texto residual.
- `tasks.md:102-107` está atualizado (10.4/10.5/10.7), mas o plano **não inclui `tasks.md` em `files_modified`**; os checkboxes 10.1-10.10 ficam desmarcados e a execução não tem autorização explícita para atualizá-los (ou para declarar a atualização como etapa de revisão).
- **Fix:** corrigir as duas linhas do design e incluir `openspec/.../tasks.md` no escopo (ou declarar que o tick fica para o Review Stop, sem alegar change concluída).

### W-03 — Task 1 não pode ficar verde antes da Task 2 (mesmo arquivo + mesma suíte)

- Task 1 e Task 2 editam `campaign-format-chips.tsx` **e** o mesmo `campaign-format-chips.test.tsx`; o `<verify>` da Task 1 executa a suíte inteira (`PLAN:96-98`), que contém os testes de hover/Escape/ponteiro/listeners da Task 2 (`campaign-format-chips.test.tsx:285-498`).
- Ao remover o “?”, os 29 testes atuais quebram (ex.: `:183,361,512,535`); atualizá-los sem implementar as interações da Task 2 deixa a Task 1 vermelha. O `61-04` já viveu esse acoplamento e registrou desvio (`61-04-SUMMARY.md:148-156`).
- **Fix:** fundir Tasks 1+2 em uma task/commit (“chip único + ajuda ancorada + suíte reescrita”) **ou** dividir o teste em `semantics` e `interactions`, com `<verify>` por subconjunto e o gate completo só ao final.

### W-04 — Comando de baseline da Task 1 usa caminho com reticências

- `PLAN:87`: `npx vitest run .planning/.../evidence/baseline-calls.test.ts` — não é copiável; o caminho real é `.planning/phases/61-padronizar-chips-formatos-campanhas/evidence/baseline-calls.test.ts` (usado corretamente em `PLAN:133`).
- **Fix:** usar o caminho completo também na Task 1 e registrar exit/JSON inalterado no SUMMARY.

### W-05 — Ordem `global test`/`diff-check` × árvore limpa repete a falha do 61-04

- `61-04-SUMMARY.md:115-116` registra `npm.cmd run test` exit 1 por **clean-tree guard** (`boundaries.contract`, `joint-boundaries.contract`) quando há arquivos rastreados modificados; a reexecução só passou **após commit**.
- O `PLAN:134-135` coloca `npm.cmd run test` e `git diff --check ...HEAD` no `<verify>` da Task 3, que altera 15 arquivos rastreados — a execução antes do commit tende a falhar por guarda, não por regressão.
- **Fix:** instruir explicitamente “commitar a Task 3 e então rodar suíte global + `git diff --check`”, ou separar um passo final pós-commit (como o 61-04 fez).

### W-06 — Prova de zero consultas e de “um popover/posicionamento” não está nomeada na suíte reescrita

- A única prova estática de que o componente não faz I/O é `campaign-format-chips.test.tsx:609-624` (não importa Supabase/storage/`server-only`/`fetch`/`next/link`, sem `dangerouslySetInnerHTML`), e a prova comportamental é `:556` (“não dispara fetch ao renderizar ou abrir a ajuda”).
- O `baseline-calls.test.ts` mede chamadas **server-side** (read models/assinaturas), não o componente; se o chip introduzir `fetch`, o baseline continua verde.
- `PLAN:110` lista testes de interação, mas **não nomeia** a retenção do teste estático, do “não dispara fetch”, nem “um popover por vez” / classes `position: fixed` / `max-width` / portal (existentes em `:285,427,594`).
- **Fix:** incluir explicitamente na Task 2: preservar/atualizar o teste de isolamento estático, o teste de ausência de fetch ao abrir a ajuda, “somente um popover” e as asserções de `position: fixed`/portal/clamp.

### W-07 — “quando aplicável” abre escape para não implementar a ponte chip → popover

- `PLAN:106`: “Mover o ponteiro chip→popover mantém aberto (**quando aplicável**)”. Para o chip-link (hover/foco transitório), a ponte é **necessária** para ler a ajuda; sem ela o popover fecha em 120 ms. “Quando aplicável” permite interpretações divergentes (ex.: “não se aplica ao link”).
- **Fix:** remover o escape e definir: a ponte se aplica a toda ajuda aberta por hover/foco (link ou botão) enquanto não fixada; para popover fixado, o ponteiro não fecha. Testar os dois casos.

### W-08 — `must_haves` sem `key_links` e sem os artefatos das superfícies

- `PLAN:30-49` tem 9 truths e 4 artifacts, **sem `key_links`**. O `61-04` tinha links explícitos (`componente → react-dom/createPortal`, `componente → CampaignFormatPresentation`; `61-04-PLAN.md:54-62`).
- Este plano muda exatamente a ligação “superfícies → `helpLang` → portal” e “chip → popover âncora”; sem `key_links`, a rastreabilidade da fiação fica só na prosa.
- **Fix:** adicionar `key_links` (superfícies → `helpLang`; chip → elemento âncora; componente → `createPortal`; detalhe → `formatHrefs` só `delivered`) e incluir no `artifacts` pelo menos `campanhas/client.tsx`, `campanhas/[id]/client.tsx` e o card/linha do dashboard.

### W-09 — `role="group"` com `aria-label`/`aria-describedby` duplica o nome acessível do chip

- O componente atual envolve cada chip em `div role="group" aria-label={...} aria-describedby={...}` (`campaign-format-chips.tsx:445-456`), e os testes dependem disso (`campaign-format-chips.test.tsx:131-138`).
- A Task 1 manda colocar `aria-label`/`aria-describedby` **no próprio link/botão** (`PLAN:94`), mas **não diz** o que fazer com o grupo. Mantido, o leitor de tela anuncia o estado duas vezes (grupo + chip); removido, os testes mudam.
- **Fix:** decidir explicitamente: remover `role="group"`/`aria-label`/`aria-describedby` do wrapper (mantendo só a `<ul aria-label>` e o `<li>`), ou manter o grupo como container sem nome acessível. Refletir no teste.

### W-10 — Escopo de 18 arquivos, com 15 só na Task 3

- `files_modified` tem 18 entradas (`PLAN:7-25`); a Task 3 sozinha toca 15 (`PLAN:120`). O alvo do método é 5–8 por plano; 15+ é zona de degradação de contexto. A maioria são testes mecânicos, por isso não trato como blocker, mas o executor precisa ler o componente (529 linhas) + 3 superfícies + 10 suítes + rodar a suíte global.
- **Fix:** dividir a Task 3 em 3a (integração das 3 superfícies + `61-05-VISUAL-CHECK.md`) e 3b (varredura de regressão + typecheck/lint/build/global/diff-check), ou autorizar explicitamente o orçamento de 18 arquivos com commits atômicos por grupo.

### W-11 — `AGENTS.md` exige leitura de `docs/fluxo-de-desenvolvimento.md` antes de executar; o plano não a inclui

- `AGENTS.md:78`: “Before starting, resuming, planning, executing, or verifying a phase, read `docs/fluxo-de-desenvolvimento.md`.”
- O `<context>` (`PLAN:61-79`) lista PROJECT/ROADMAP/STATE/CONTEXT/BASELINE/SUMMARIES/OpenSpec/código, **sem** esse documento.
- **Fix:** adicionar `@docs/fluxo-de-desenvolvimento.md` ao `<context>` (ou registrar no SUMMARY que a leitura foi feita no Review Stop).

---

## 5. INFO

- **I-01 — `infoAria` fica órfão.** `messages.infoAria` (“Ver explicação do formato”) era o nome do “?”; após a remoção não é usado pelo componente. Manter o campo nos catálogos é correto para não reabrir i18n nesta fatia, mas o SUMMARY deve registrar que a chave ficou sem consumidor.
- **I-02 — `61-CONTEXT.md` está defasado no topo.** `:3` e `:7` ainda dizem que o plano complementar é somente o `61-04`; o corpo (§4.3) já reflete a remoção do “?”. Atualizar o status ao registrar o `61-05`.
- **I-03 — `61-04` não aceito não está no `<objective>`.** O `61-05-PLAN.md:68` inclui o SUMMARY do 61-04 (que diz “NÃO ACEITO”), mas o objetivo não afirma que este plano **não** aceita o 61-04. O `61-04-PLAN.md:66` fazia essa declaração para o 61-03; repetir aqui evita leitura de aceite implícito.
- **I-04 — “click em link navega” em jsdom.** `PLAN:110` pede testar navegação; jsdom não implementa navegação (pode lançar “Not implemented”). O teste deve afirmar `href`, ausência de `preventDefault` e ausência de abertura de ajuda no primeiro clique — não simular navegação real.
- **I-05 — Quatro `<automated>` no `<verify>` da Task 3.** O `verify.plan-structure` aceita, mas um runner que leia apenas o primeiro `<automated>` perderia baseline/typecheck/lint/build/global/diff-check. Encadear em um comando único (`... && ...`) ou enumerar sub-checks no `done` reduz o risco.

---

## 6. O que está correto (para não retrabalhar)

- **“?” centralizado e removível sem resíduos:** o controle existe apenas em `src/components/campaign/campaign-format-chips.tsx:473-485`; não há “?” em lista, dashboard ou detalhe. A remoção no componente cobre as três superfícies.
- **Sem nesting nas superfícies:** os chips não estão dentro de `Link` em `/campanhas` (`client.tsx:296-351`), `AvailableCampaignCard` (`:70-115`) nem `DashboardCampaigns`; trocar `span` por `button` não cria botão dentro de link.
- **`hrefs` só para `delivered`:** `page.tsx:269-276`; individual/legado fica sem `hrefs`, o que a Task 1 trata como botão.
- **Ajuda flutuante, portal, SSR, `lang`, clamp, foco e cleanup** já existem e as truths da Task 2 os preservam; o `helpLang` já é propagado nas três superfícies (`campanhas/client.tsx:326`, `available-campaign-card.tsx:102`, `dashboard-campaigns.tsx:110`, `[id]/client.tsx:117`).
- **Baseline idempotente:** o teste em leitura não recaptura o JSON (`61-PLAN-CHECK.md:17`; `61-BASELINE.md:93-94`).
- **Escopo de dados preservado:** `supabase/**`, `src/lib/product-two-format/**`, `format-resolution.ts`, `format-presentation.ts`, i18n e pricing não estão em `files_modified`.
- **Review Stop e SUMMARY “NÃO ACEITO”** estão presentes (`PLAN:157-162`); a UX não é declarada aprovada e o visual check nasce pendente.

---

## 7. Structured issues

```yaml
issues:
  - plan: "61-05"
    dimension: "requirement_coverage"
    severity: "blocker"
    description: "FMT-VIS-03 / 'não depender exclusivamente de cor' não é coberto; ao remover os rótulos visíveis, delivered x absent ficam distintos apenas por matiz"
    task: 1
    evidence: "PLAN:27,32-40,94; spec campaign-format-presentation:63; design:206; campaign-format-chips.tsx:71-78; test:201-216"
    fix_hint: "Adicionar diferenciador não-cromático (largura/estilo de borda ou presença de preenchimento) e asserção no teste; atualizar a truth."

  - plan: "61-05"
    dimension: "verification_derivation"
    severity: "warning"
    description: "Truth do detalhe diz que todo entregue é <a>, mas a própria Task 1 trata entregue sem href como <button> (individual/legado); a spec também generaliza"
    task: 1
    evidence: "PLAN:34,91; spec campaign-page-ui:63,129; design:141; format-presentation.test.tsx:531,542,622,717"
    fix_hint: "Qualificar 'entregue com href' na truth/spec e documentar o caminho sem seleção."

  - plan: "61-05"
    dimension: "context_compliance"
    severity: "warning"
    description: "Ajuste OpenSpec incompleto: design.md ainda prescreve alvo de 44px no '?' (linhas 210 e 224); tasks.md 10.x não está no escopo do plano"
    evidence: "design:145 vs 210,224; tasks.md:102-107; PLAN:7-25"
    fix_hint: "Corrigir as duas linhas do design e incluir tasks.md no escopo ou declarar o tick no Review Stop."

  - plan: "61-05"
    dimension: "task_completeness"
    severity: "warning"
    description: "Task 1 e Task 2 editam o mesmo componente e a mesma suíte; o verify da Task 1 roda testes de interação da Task 2 e não pode ficar verde isoladamente"
    evidence: "PLAN:85,96-98,104,112-114; test:285-498; 61-04-SUMMARY:148-156"
    fix_hint: "Fundir Tasks 1+2 ou dividir a suíte em semântica/interações com verify por subconjunto."

  - plan: "61-05"
    dimension: "task_completeness"
    severity: "warning"
    description: "Comando de baseline da Task 1 usa caminho com reticências e não é executável por cópia"
    task: 1
    evidence: "PLAN:87 vs PLAN:133; 61-BASELINE:144"
    fix_hint: "Usar o caminho completo e registrar exit/JSON inalterado."

  - plan: "61-05"
    dimension: "dependency_correctness"
    severity: "warning"
    description: "Ordem do verify (suíte global/diff-check antes do commit) repete a falha de clean-tree guard documentada no 61-04"
    task: 3
    evidence: "PLAN:134-135; 61-04-SUMMARY:115-116,158-161"
    fix_hint: "Commitar a Task 3 antes de rodar global/diff-check, ou separar passo pós-commit."

  - plan: "61-05"
    dimension: "verification_derivation"
    severity: "warning"
    description: "Prova de zero consultas e de 'um popover/posição fixed/portal' não é nomeada na reescrita da suíte; o baseline mede leituras server-side, não o componente"
    task: 2
    evidence: "test:609-624,556,285,427,594; PLAN:110,133"
    fix_hint: "Exigir a retenção do teste estático/no-fetch e dos testes de um popover/posicionamento."

  - plan: "61-05"
    dimension: "task_completeness"
    severity: "warning"
    description: "'quando aplicável' na ponte chip->popover permite omitir a ponte necessária para ler a ajuda aberta por hover"
    task: 2
    evidence: "PLAN:106"
    fix_hint: "Definir aplicabilidade (toda ajuda transitória) e testar link e botão."

  - plan: "61-05"
    dimension: "key_links_planned"
    severity: "warning"
    description: "must_haves sem key_links e sem artefatos das três superfícies, apesar de a mudança ser de fiação chip->ajuda e superfícies->helpLang"
    evidence: "PLAN:30-49; 61-04-PLAN:54-62"
    fix_hint: "Adicionar key_links e artefatos de lista/detalhe/dashboard."

  - plan: "61-05"
    dimension: "task_completeness"
    severity: "warning"
    description: "Plano não define o destino do wrapper role=group com aria-label/aria-describedby; mantido, duplica o nome acessível do chip"
    task: 1
    evidence: "campaign-format-chips.tsx:445-456; test:131-138; PLAN:94"
    fix_hint: "Remover o papel/nome do wrapper ou mantê-lo sem aria-label/descrito; atualizar testes."

  - plan: "61-05"
    dimension: "scope_sanity"
    severity: "warning"
    description: "18 arquivos no plano e 15 na Task 3; acima do alvo de 5-8, com risco de contexto"
    task: 3
    evidence: "PLAN:7-25,120"
    fix_hint: "Dividir Task 3 em integração e varredura de regressão, ou declarar orçamento/commits atômicos."

  - plan: "61-05"
    dimension: "claude_md_compliance"
    severity: "warning"
    description: "AGENTS.md exige ler docs/fluxo-de-desenvolvimento.md antes de executar; o contexto do plano não o inclui"
    evidence: "AGENTS.md:78; PLAN:61-79"
    fix_hint: "Adicionar @docs/fluxo-de-desenvolvimento.md ao contexto."

  - plan: "61-05"
    dimension: "requirement_coverage"
    severity: "info"
    description: "infoAria fica sem consumidor após remover o '?'; manter o campo é aceitável, mas deve ser registrado"
    evidence: "messages.ts:43; pt-BR.ts:14; PLAN:93-94"
    fix_hint: "Registrar no SUMMARY como chave preservada sem uso nesta fatia."

  - plan: "61-05"
    dimension: "context_compliance"
    severity: "info"
    description: "61-CONTEXT.md ainda aponta o 61-04 como único plano complementar"
    evidence: "61-CONTEXT:3,7"
    fix_hint: "Atualizar status ao registrar o 61-05."

  - plan: "61-05"
    dimension: "context_compliance"
    severity: "info"
    description: "Objetivo não declara explicitamente que o 61-04 permanece NÃO ACEITO"
    evidence: "PLAN:52-54,68; 61-04-SUMMARY:3"
    fix_hint: "Adicionar a declaração no objetivo/Review Stop."

  - plan: "61-05"
    dimension: "verification_derivation"
    severity: "info"
    description: "Teste de 'click navega' não é viável em jsdom; deve afirmar href/defaultPrevented/ausência de ajuda"
    task: 2
    evidence: "PLAN:110"
    fix_hint: "Especificar a asserção viável."

  - plan: "61-05"
    dimension: "task_completeness"
    severity: "info"
    description: "Quatro <automated> no verify da Task 3; um runner que leia só o primeiro perderia gates"
    task: 3
    evidence: "PLAN:132-135"
    fix_hint: "Encadear em um comando único ou enumerar sub-checks no done."
```

---

## 8. Conclusão

O `61-05` está **quase executável**, mas não pode seguir como está: **B-01** deixa um requisito declarado (FMT-VIS-03) sem entrega verificável, justamente no ponto em que o plano remove os rótulos visíveis. **W-01** e **W-02** precisam ser corrigidos junto porque afetam o contrato que o executor e o verifier lerão (truth, spec, design). **W-03/W-04/W-05/W-10** devem ser ajustados para a execução não gastar um ciclo em falso vermelho; **W-06/W-07/W-08/W-09** são de prova/acessibilidade e cabem no mesmo commit de revisão.

**Recomendação:** revisar o plano (B-01 + W-01/W-02/W-03/W-05) e reenviar. Não executar o `61-05` antes disso.

**Status da fase:** `61-04` continua **NÃO ACEITO**; a UX continua **não aprovada**; a fase 61 **não está concluída**. Nenhum código, migration, RPC, consulta, dependência, ambiente, merge, push, deploy, sync ou archive foi executado nesta verificação.
