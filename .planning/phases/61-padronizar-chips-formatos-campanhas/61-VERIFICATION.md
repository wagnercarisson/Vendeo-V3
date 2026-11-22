---
phase: 61-padronizar-chips-formatos-campanhas
verified: 2026-11-22T17:41:23Z
status: passed
verdict: PASS COM RESSALVAS
score: 10/10 must-haves verificados (1 deles por aceite humano declarado, sem capturas)
overrides_applied: 0
head: 77c1b0518f28944b0cfb6051a7e5cbee8225328a
branch: feat/campaign-format-chips
phase_state: aberta; não publicada; não arquivada; sem merge/push/deploy/sync/archive
gaps: []
deferred: []
limitations:
  - "Aceite visual/funcional é declaração do responsável (2026-11-22), sem capturas, medições ou lista de viewports; a verdade de layout não foi reproduzida pelo verificador."
  - "`campaign-page-ui` (spec OpenSpec, requisito individual/legado) diz que o formato entregue SHALL ser `<a>`; a implementação o renderiza como `<button>` quando não há `href`, o que é permitido por `design.md`/`61-05-PLAN` e pelo próprio texto de must-have, mas a redação da spec precisa ser reconciliada antes de `/opsx-verify`."
  - "“Um popover por vez” é garantido por instância do componente; lista/dashboard têm várias instâncias e não há coordenação global entre elas."
  - "O tracking final (ROADMAP, STATE, 3 SUMMARYs, VISUAL-CHECK, tasks.md) está modificado e NÃO commitado no worktree; `tasks.md` 72/72 só existe no working tree."
  - "O corpo do `61-05-SUMMARY.md` e do `61-03-SUMMARY.md` ainda contém afirmações antigas de 'NÃO ACEITO / fase não concluída', contradizendo os cabeçalhos atualizados."
  - "Suíte global e build NÃO foram reexecutados pelo verificador; são evidência anterior do executor (logs preservados). Typecheck, lint, 16 arquivos/204 testes e diff-check foram reexecutados."
---

# Phase 61: Padronização dos chips de formato 1:1 e 9:16 — Verification Report

**Phase Goal:** Padronizar a apresentação dos formatos 1:1 e 9:16 em `/campanhas`, dashboard e `/campanhas/[id]`, com chips compactos, o próprio chip como único controle, ajuda flutuante ancorada e sem deslocamento/overflow, preservando builders, classificação, lifecycle, autoridades, `?format=` estrito, preview/download, gates, polling, recuperação, miniaturas, contagens, i18n e zero consultas adicionais.
**Verified:** 2026-11-22T17:41:23Z
**HEAD:** `77c1b0518f28944b0cfb6051a7e5cbee8225328a` (branch `feat/campaign-format-chips`, sem upstream; 40 commits à frente de `main`)
**Status:** `passed` — **PASS COM RESSALVAS**
**Re-verification:** Não — verificação inicial (não havia `61-VERIFICATION.md`)

---

## 1. Veredito

**PASS COM RESSALVAS.**

O objetivo funcional da fase está implementado e verificável no código: não existe controle “?” separado; o chip é o único controle (link no detalhe para formato entregue com `href`; botão nos demais); o estado completo está no nome/descrição acessível; a ajuda é um popover em portal ancorado no chip; e as superfícies listagem/dashboard/detalhe consomem o mesmo modelo/catálogo. As autoridades e os caminhos sensíveis (`src/lib/product-two-format/**`, `src/lib/campaign/format-resolution.ts`, `supabase/**`, `package*.json`) permanecem intocados no range da fase.

As ressalvas não são falhas de objetivo: são **limites de evidência** (aceite visual declarado sem capturas/medições), **uma ambiguidade de redação na spec OpenSpec** sobre o chip entregue individual ser `<a>` ou `<button>`, **um risco de UX não coberto** (mais de um popover em instâncias diferentes na mesma página) e **inconsistências documentais** nos SUMMARYs/tracking final ainda não commitado.

---

## 2. Fontes e escopo

| Fonte | Uso |
|---|---|
| `openspec/changes/padronizar-chips-formatos-campanhas/` | Fonte técnica canônica; `npx openspec validate padronizar-chips-formatos-campanhas --strict` → **válido**; `tasks.md` **72/72** marcadas (working tree) |
| `61-05-PLAN.md` | Must-haves finais (10 verdades) |
| `61-01`/`61-02`/`61-03`/`61-04`/`61-05` PLAN/SUMMARY | Histórico e escopo por wave |
| Código em `src/` | Verificação primária (não os SUMMARYs) |
| `evidence/*.log` | Evidência anterior do executor |
| `61-BASELINE.md`, `evidence/baseline-calls.json` | Contrato de zero chamadas adicionais |

Fora de escopo confirmado: banco, Storage, provider, homolog, produção, migration, RPC, flag, pricing, financeiro, sync, archive, merge, push, deploy.

---

## 3. Matriz de verdades (must-haves do 61-05) → evidência

| # | Verdade | Status | Evidência |
|---|---|---|---|
| 1 | Não existe botão “?” separado nem espaço, borda, foco ou área acionável independentes | ✓ VERIFIED | `campaign-format-chips.tsx` não contém `HELP_BUTTON_CLASS`, `buttonRefs` nem o `aria-label` antigo; há exatamente 2 controles (`<a>`/`<button>`) por lista; testes “não existe '?' separado” e SSR; `infoAria` só permanece no catálogo (sem consumidor) |
| 2 | Texto visível apenas “Quadrado 1:1”/“Vertical 9:16”; estado completo em `aria-label`/descrição acessível | ✓ VERIFIED | `chipContent` renderiza só `StateIndicator` + nome; `accessibleName` = nome + rótulo + “Selecionado”; `<p hidden id aria-describedby>` com estado + explicação; testes de `toHaveAccessibleName`/`Description` |
| 3 | No detalhe, chip entregue com `href` é `<a>` e um único toque seleciona; entregue sem `href` e não entregue/excepcional é `<button type="button">` e só explica | ✓ VERIFIED (com ressalva documental) | `hasLink = href válido && state === "delivered"` → `<a href>` sem `prefetch` e sem `onClick`; senão `<button type="button">`; `formatHrefs` só é montado no detalhe conjunto e **somente** para `delivered` (`page.tsx:270-292`); testes de link/botão e clique não interceptado. Ressalva: a spec `campaign-page-ui` (requisito individual) diz `<a>` para entregue; ver L2 |
| 4 | Lista/dashboard usam `<button type="button">` que abre/fecha apenas a ajuda local, sem navegar/gerar | ✓ VERIFIED | Lista e dashboard nunca passam `hrefs`; componente cai em `<button>`; nenhum `router.push`, `fetch` ou server action no componente; testes “chip de lista/dashboard não navega nem gera” e “não dispara fetch” |
| 5 | Entregue × ausente não depende só de cor; excepcionais usam indicador pequeno | ✓ VERIFIED | `delivered`: `border-2 border-solid` + `bg-accent-green/10`; `absent`: `border` simples + `bg-bg-elevated`; `unknown/unavailable`: `border-dashed`; `processing/unknown/refunded`: `Loader2`/`CircleHelp`/`Undo2`; teste de classes e ausência de `svg` em entregue/ausente |
| 6 | Desktop: hover/foco no próprio chip revela ajuda flutuante ancorada no chip, sem deslocar layout | ✓ VERIFIED (por declaração para layout) | Hover/foco chamam `openTransient`; portal em `document.body` com `position: fixed`; ancoragem em `chipRefs[activeKey]`. Ausência de deslocamento é estrutural (fora do fluxo) e foi **declarada** pelo responsável em 2026-11-22; **sem capturas/medições** (L1) |
| 7 | Ajuda em portal pós-mount, `lang` do portal, viewport/overflow, SSR seguro, um popover por vez; Escape/fora fecham; foco volta ao chip sem reabrir | ✓ VERIFIED (com ressalva de escopo) | `mounted` via `useEffect` + `createPortal`; `style.position = "fixed"`, `maxWidth/maxHeight` e clamp (`positionPopover`); `lang={helpLang}`; um `activeKey` por instância; `keydown` Escape com `suppressFocusRef`; `pointerdown` fora; testes SSR/portal/Escape/fora. Ressalva: unicidade global entre instâncias não é garantida (L3) |
| 8 | Listeners de scroll/resize/clique externo são removidos ao fechar/desmontar | ✓ VERIFIED | Efeitos condicionados a `mounted && activeKey !== null`, com cleanup de `resize`/`scroll`/`keydown`/`pointerdown`; teste compara `addEventListener`×`removeEventListener` em dois ciclos e confirma ausência de reação após fechar |
| 9 | Builders, classificação, lifecycle, autoridades, `?format=`, preview/download, polling, aprovação, recuperação, miniaturas, contagens e pt-BR/es-419 preservados | ✓ VERIFIED | `git diff c971d631..HEAD` não toca `src/lib/product-two-format/**`, `format-resolution.ts`, `supabase/**`, `package*.json`; parser de `?format=` inalterado (`page.tsx:81-89`); 9 arquivos de superfície + 36 testes de modelo/i18n reexecutados; preview/download/gates/polling preservados nos testes dirigidos |
| 10 | Zero consultas adicionais; baseline original imutável; evidência visual separada | ✓ VERIFIED (com ressalva de evidência visual) | `baseline-calls.json` não modificado; teste de baseline reexecutado PASS; componente sem `fetch`/Supabase/Storage; modelo construído sobre linhas/resumos já carregados; `61-05-VISUAL-CHECK.md` existe em separado, mas registra **apenas aceite declarado**, sem capturas (L1) |

**Score:** 10/10 (1 verdade, a de layout, sustentada por aceite humano declarado e não por medição reproduzida).

---

## 4. Matriz de requisitos (planos) → evidência

Não há IDs `FMT-*` em `.planning/REQUIREMENTS.md`; a rastreabilidade é a base OpenSpec, como o `61-CONTEXT.md` já declarava. Todos os 14 IDs declarados nos planos foram cobertos.

| ID | Onde | Status | Evidência |
|---|---|---|---|
| FMT-PRES-01 | 01/02/03/05 | ✓ SATISFEITO | Mesmo componente e catálogo nas três superfícies; ≤1 conjunto por campanha; testes de componente/lista/dashboard/detalhe |
| FMT-MODEL-02 | 01 | ✓ SATISFEITO | `format-presentation.ts` puro, congelado, sem I/O; builders e lifecycle implementados |
| FMT-VIS-03 | 01/05 | ✓ SATISFEITO | Só nomes visíveis; borda espessa × simples × tracejada; sem `+`, sem “Não gerado”, sem emoji |
| FMT-A11Y-04 | 01/03/05 | ✓ SATISFEITO | `aria-label` completo, `aria-describedby` estável, `aria-current` no link ativo, `aria-expanded/controls` apenas no botão, hit area `min-h-11 min-w-11`, `focus-visible:ring-2`; nunca `disabled` |
| FMT-INFO-05 | 02/05 | ✓ SATISFEITO | Lista/dashboard sem `hrefs` → botões informativos; teste “não navega nem gera” |
| FMT-EFFECT-06 | 01/02/03/05 | ✓ SATISFEITO | Nenhum `fetch`, Supabase, Storage, server action, RPC, reserva ou provider no componente/modelo; teste estático e de `fetch` |
| FMT-DETAIL-07 | 03/05 | ✓ SATISFEITO | Seleção conjunta; ativo só com preview assinado; `?format=` estrito (parser atual); preview/download/gates preservados |
| FMT-AUTH-08 | 02/03 | ✓ SATISFEITO | `classifyTwoFormatCampaign` antes do resolvedor individual; sem inferência por path/miniatura; estados `inconsistent`→`unavailable` |
| FMT-SCOPE-09 | 02/03 | ✓ SATISFEITO | Catálogo não promete geração futura; sem `+`; “não incluído” para o outro formato |
| FMT-PERF-10 | 01/02/03/05 | ✓ SATISFEITO | Baseline comparativo sem drift; nenhuma leitura nova nos builders |
| FMT-I18N-11 | 01/02/03/05 | ✓ SATISFEITO (layout por declaração) | Catálogo único `pt-BR`/`es-419`, identidade nos 3 namespaces, `lang` no portal e na região dos chips; layout sem overflow comprovado estruturalmente e por aceite declarado |
| LIST-UI-12 | 02/05 | ✓ SATISFEITO | Um card por campanha, dois chips, abrir/baixar/miniatura preservados |
| DASH-UI-13 | 02/05 | ✓ SATISFEITO | Uma linha, dois chips, contagem/miniatura/abertura preservadas |
| PAGE-UI-14 | 03/05 | ✓ SATISFEITO COM RESSALVA | Individual/legado, aprovação e regeneração cobertos; **ressalva textual**: entregue individual é `<button>` (sem `href`), enquanto a spec individual diz `<a>` (L2) |

---

## 5. Matriz por superfície

| Superfície | Controle | `href` | Ajuda | Preservação |
|---|---|---|---|---|
| `/campanhas` (lista) | `<button type="button">` para os dois chips | Nenhum | Portal ancorado, `helpLang` repassado | Card único, abrir/baixar, miniatura, contagem |
| Dashboard → campanhas | `<button type="button">` para os dois chips | Nenhum | Portal ancorado, `helpLang` de `lang` | Miniatura preferida, abertura, uma linha |
| `/campanhas/[id]` (conjunta) | `<a>` só para `delivered` com `href`; demais `<button>` | `?format=1:1`/`?format=9:16` apenas entregues | Portal ancorado, `lang` `es-419` | `?format=` estrito, preview/download, polling, gates |
| `/campanhas/[id]` (individual/legado) | `<button>` (entregue sem `href`); `<button>` nos demais | Nenhum | Portal ancorado | Arte/download atuais, aprovação, regeneração |

---

## 6. Artefatos, wiring e data-flow

| Artefato | Existe | Substantivo | Wired | Dados fluem | Status |
|---|---|---|---|---|---|
| `src/lib/campaign/format-presentation.ts` | ✓ 235 linhas | ✓ builders puros | ✓ importado por lista/dashboard/página | ✓ estados vindos das autoridades | ✓ VERIFIED |
| `src/lib/i18n/campaign-formats/**` | ✓ | ✓ catálogos congelados + testes | ✓ `formats` nos 3 namespaces com a mesma referência | ✓ textos usados pelo componente | ✓ VERIFIED |
| `src/components/campaign/campaign-format-chips.tsx` | ✓ 536 linhas | ✓ link/botão, portal, clamp, a11y | ✓ lista, dashboard (card e linha) e detalhe | ✓ `presentation`/`messages`/`hrefs` por props | ✓ VERIFIED |
| `src/components/campaign/__tests__/campaign-format-chips.test.tsx` | ✓ 677 linhas | ✓ 32 testes semânticos | n/a | n/a | ✓ VERIFIED |
| `src/components/campaign/__tests__/campaign-format-chips.ssr.test.tsx` | ✓ 67 linhas | ✓ 2 testes SSR/idioma | n/a | n/a | ✓ VERIFIED |
| `61-05-VISUAL-CHECK.md` | ✓ | ⚠️ critérios, sem capturas | n/a | n/a | ⚠️ ACEITE DECLARADO |

**Key links**

| From | To | Via | Status |
|---|---|---|---|
| `campaign-format-chips.tsx` | `react-dom` | `createPortal` pós-mount para `body`, `position: fixed` | ✓ WIRED |
| `[id]/client.tsx` | componente | `hrefs={props.formatHrefs}` + `helpLang` + `presentation` | ✓ WIRED |
| `dashboard/dashboard-campaigns.tsx` / `available-campaign-card.tsx` | componente | `presentation`/`messages`/`helpLang`, sem `hrefs` | ✓ WIRED |
| lista `campanhas/client.tsx` | componente | `campaign.formatPresentation` + `messages.formats` | ✓ WIRED |
| `list.ts` / `dashboard/campaigns.ts` | autoridades já carregadas | `readTwoFormatListSummaries` + `resolveCampaignFormat` (sem consulta nova) | ✓ WIRED, zero chamadas extras |

**Data-flow (Level 4):** servidor monta `formatPresentation` a partir de `input_snapshot` classificado e do resumo conjunto já lido; nenhum prop chega vazio/hardcoded nas três superfícies. Não há `fetch` no componente. Baseline de chamadas reexecutado: sem drift.

---

## 7. Toque, acessibilidade e interação (evidência de código)

| Critério | Implementação observada |
|---|---|
| Link entregue seleciona no primeiro toque | `<a href>` sem `prefetch`, sem `onClick`; teste confirma clique não cancelado e sem popover |
| Chip não entregue/excepcional e lista/dashboard só explicam | `<button type="button">` com `onClick={() => handleToggle(key)}`; nenhum `router.push`/geração |
| Sem botão aninhado/handlers duplicados/controle invisível | Nenhum `a button`/`button a`; um único handler `onClick` por chip; popover sem focáveis; teste estático e de DOM |
| Nomes/descrições completos | `aria-label` = nome + rótulo + “Selecionado”; `aria-describedby` → `hidden` com estado + explicação |
| `aria-current` | Apenas no `<a>` ativo |
| `aria-expanded`/`aria-controls` | Apenas no `<button>` e apenas quando aberto |
| Foco/Escape/fora | `Escape` fecha, devolve foco com supressão; `pointerdown` fora fecha; clique no chip/popover não fecha |
| Limpeza de listeners | `resize`/`scroll`/`keydown`/`pointerdown` com cleanup por efeito; teste de contagem add/remove |
| SSR/lang/um popover | `createPortal` só após mount; `lang={helpLang}`; um `activeKey` por instância |

---

## 8. Preservação e limites de escopo

Confirmado por `git diff c971d631..HEAD`:

- **Intocados:** `supabase/**`, `src/lib/product-two-format/**`, `src/lib/campaign/format-resolution.ts`, `package.json`, `package-lock.json`.
- **Alterados no detalhe:** `src/app/(app)/campanhas/[id]/page.tsx` (+146/−17) e `src/lib/campaign/display.ts` (+19), ambos no escopo F61 (apresentação/hrefs/ativo).
- **Parser `?format=`:** inalterado (`parseJointFormatRequest` distingue ausente de inválido/vazio/duplicado; só ausência usa o preferido).
- **Nenhum** fetch, RPC, reserva, estorno, provider, migration, flag ou pricing novo.
- **Nenhuma dependência nova** (`package*.json` fora do diff).
- `generating`, `stale`, `error` → `processing`/`unknown`, nunca ausência; estorno só como modificador de `absent`; `approval pending` → `delivered` sem ativo; `regenerating` → `processing` sem ativo.

---

## 9. Testes e gates — reexecutado versus evidência anterior

### Reexecutado pelo verificador (2026-11-22, worktree atual)

| Comando | Resultado |
|---|---|
| `npx vitest run campaign-format-chips.test.tsx campaign-format-chips.ssr.test.tsx evidence/baseline-calls.test.ts` | **3 arquivos / 35 testes PASS** (32 + 2 + 1) |
| `npx vitest run` 9 arquivos de superfície (detalhe, polling, lista, thumbnail, dashboard×4, card) | **9 arquivos / 133 testes PASS** |
| `npx vitest run format-presentation.test.ts + 3 testes de i18n campaign-formats` | **4 arquivos / 36 testes PASS** |
| `npm run typecheck` | **exit 0** |
| `npm run lint` | **exit 0** (limitação preexistente: ESLint oficial sem cobertura TS ampla) |
| `git diff --check c971d631..HEAD` | **exit 0** |
| `npx openspec validate … --strict` | **válido** |

Total reexecutado: **16 arquivos / 204 testes PASS**, incluindo os **12 arquivos/168 testes** (167 dirigidos + baseline) da revisão do responsável — reproduzido integralmente.

### Evidência anterior do executor (não reexecutada)

| Gate | Evidência | Resultado registrado |
|---|---|---|
| Suíte global | `evidence/61-05-global-test.log` | **844 arquivos PASS**, 2 skipped; **10.488 testes PASS**, 10 skipped; gates de banco/homolog “NÃO EXECUTADO” (esperado) |
| Build | `evidence/61-05-build.log` | `check:cnae OK`; `Compiled successfully in 22.3s`; 102 páginas |
| Typecheck/lint | `61-05-typecheck.log` / `61-05-lint.log` | exit 0 (reconfirmados acima) |
| 61-01/02/03 dirigidas | SUMMARYs/STATE | 93 / 324 / 637 testes (evidência histórica, não reexecutada) |
| Baseline antes/depois | `61-05-baseline-read-after.log` | 1 teste PASS; JSON sem drift (reconfirmado) |

**Aceite visual:** declarado pelo responsável em 2026-11-22, registrado em `61-05-VISUAL-CHECK.md` — **sem capturas, medições ou viewports fornecidos**. Não foi inventado nem simulado.

---

## 10. Evidência OpenSpec

- `openspec validate padronizar-chips-formatos-campanhas --strict` → **válido**.
- `tasks.md` → **72 marcadas / 0 desmarcadas** no working tree (não commitado).
- Spec de `campaign-page-ui`, `campaign-list-ui`, `dashboard-operational-composition` e `campaign-format-presentation` foram atualizadas para “chip único, sem `?`”, coerentes com a implementação final.
- **Ressalva OpenSpec (L2):** o requisito “Detalhe de campanha individual e legada” diz “o formato entregue SHALL ser um link `<a>`”; o `design.md` e o PLAN 61-05 dizem “entregue sem `href` ⇒ `<button>`”. A implementação segue o design/plano. A redação precisa ser reconciliada antes de `/opsx-verify` para não gerar falso achado.
- **Ressalva de task (L1):** a task 10.9 (“registrar evidência visual real desktop/mobile”) está marcada com a ressalva explícita de aceite declarado sem capturas; não há artefato visual reproduzível.

---

## 11. Coerência de tracking (SUMMARYs/STATE/ROADMAP)

**Coerente:**

- `ROADMAP.md` (Phase 61): 61-01/02/03/05 aceitos no resultado final; 61-04 superseded; fase aguardando verificações formais; sem publicação.
- `STATE.md` (entrada “ACEITE F61-05”): aceite técnico e visual/funcional declarado; 12 arquivos/168 testes na revisão; global 844/10.488 como evidência do executor; sem banco/migration/merge/push.
- `61-04-SUMMARY.md`: superseded, sem aprovação retroativa.
- `61-05-VISUAL-CHECK.md`: aceite declarado explicitamente sem capturas/medições.

**Inconsistências encontradas (documentais, não bloqueantes):**

1. `61-05-SUMMARY.md` — cabeçalho diz “ACEITO TECNICAMENTE E VISUAL/FUNCIONALMENTE”, mas o corpo mantém “Fase 61 NÃO concluída: 61-03/61-04/61-05 não aceitos” e “UX e fase continuam NÃO aprovadas” (§ Limites; § Resultado). Texto histórico não reconciliado.
2. `61-05-SUMMARY.md` — desvio #6 afirma que o `tasks.md` não foi ticado; no estado atual, 72/72 estão marcadas (working tree). Afirmação desatualizada.
3. `61-03-SUMMARY.md` — cabeçalho “aceito no resultado final”, mas § Riscos/§ Limites ainda dizem “61-03 não aceito / fase não concluída” e que a confirmação visual permanece pendente.
4. `61-05-VISUAL-CHECK.md` — status “aceite declarado”, porém todos os itens do checklist continuam `[ ]`; o próprio documento explica que são critérios, não medições. Coerente em intenção, mas um leitor rápido pode interpretar como não verificado.
5. **Tracking final não commitado:** `git status` mostra `M` em `.planning/ROADMAP.md`, `.planning/STATE.md`, `61-03-SUMMARY.md`, `61-05-SUMMARY.md`, `61-05-VISUAL-CHECK.md` e `openspec/.../tasks.md`. O HEAD `77c1b051` ainda contém os documentos pré-aceite. Nenhum arquivo de código está pendente.

---

## 12. Lacunas e limitações explícitas

**L1 — Evidência visual declarada, não reproduzida.** O aceite de 2026-11-22 é uma declaração do responsável. Não há capturas, medições de overflow, alturas, posições de arte ou lista de viewports. `jsdom` não mede layout. As verdades de “sem deslocamento/overflow”, “dois chips legíveis em 320 px” e “ajuda não cobre o chip” estão sustentadas por estrutura de código (portal `fixed`, clamp, `flex-wrap`, `mb-6`) + declaração humana, não por artefato reproduzível. **Não foi inventada nenhuma medição.**

**L2 — Spec individual: `<a>` versus `<button>`.** `openspec/.../specs/campaign-page-ui/spec.md` (requisito individual/legado, linha 129) e o cenário “Ajuda e seleção usam a semântica correta” dizem que o chip entregue é `<a>`. No detalhe individual/legado não há `href` (não há outro formato a selecionar), então o componente renderiza `<button>`, como o `design.md` (linha 140) e o must-have do 61-05 permitem. Não há perda funcional; há **ambiguidade documental** a resolver antes de `/opsx-verify`.

**L3 — “Um popover por vez” por instância, não por página.** Cada `CampaignFormatChips` tem seu próprio `activeKey`. Na lista (vários cards) e no dashboard (até 3 linhas), fixar a ajuda de um card e depois passar o ponteiro sobre outro chip pode manter dois popovers visíveis simultaneamente (clique em outro chip fecha o primeiro via `pointerdown`; hover não). O teste cobre apenas a unicidade dentro de uma instância. Risco de UX baixo, não coberto por requisito explícito de coordenação global.

**L4 — Tracking final não commitado.** ROADMAP/STATE/SUMMARYs/VISUAL-CHECK/tasks.md modificados no worktree, sem commit. Se o worktree for descartado, o aceite registrado e as 72 tasks se perdem. Não é falha de implementação.

**L5 — Corpo dos SUMMARYs desatualizado.** Ver §11; contradições internas entre cabeçalho e seções finais de 61-05 e 61-03.

**L6 — Gates pesados não reexecutados.** A suíte global (10.488 testes) e o build (102 páginas) são evidência anterior do executor, preservada em log. O verificador reexecutou typecheck, lint, 204 testes dirigidos, baseline e diff-check. Não houve alteração de código após os logs (worktree só tem documentação), então o risco de divergência é baixo — mas não é prova reexecutada.

**L7 — Possível frame inicial do popover em (0,0).** O portal inicia com `left: 0; top: 0` e o posicionamento é aplicado em `useEffect` (não `useLayoutEffect`). Em navegador real, é plausível um frame intermediário no canto superior esquerdo antes do clamp. Não observado em evidência (sem capturas) e não coberto por teste. INFO, não bloqueante.

**L8 — Lint sem cobertura TS ampla.** O lint oficial passa (85 arquivos), mas a configuração do projeto não cobre todo o TypeScript; limitação preexistente, não introduzida por esta fase.

---

## 13. Anti-patterns e stubs

| Arquivo | Padrão | Severidade | Impacto |
|---|---|---|---|
| `src/lib/i18n/campaign-formats/catalogs/*.ts` | `infoAria` sem consumidor | ℹ️ INFO | Chave mantida por compatibilidade; componente não a usa; teste estático garante |
| `61-05-SUMMARY.md` / `61-03-SUMMARY.md` | Afirmações “NÃO ACEITO” no corpo | ⚠️ WARNING | Documentação contraditória; não afeta código |
| `.planning/*` + `tasks.md` | Tracking final não commitado | ⚠️ WARNING | Risco de perda do registro de aceite |
| `campaign-format-chips.tsx` | Posicionamento via `useEffect` | ℹ️ INFO | Possível frame inicial em (0,0); não observado |
| `src/**` (range) | Nenhum `TBD`/`FIXME`/`XXX`/`TODO`/stub | ✓ | Nenhum débito marcado; nenhum placeholder fluindo para UI |

Nenhum artefato é stub: todos os arquivos de produção têm implementação real, estão importados e recebem dados reais das autoridades existentes.

---

## 14. Behavioral spot-checks e probes

| Comportamento | Comando | Resultado | Status |
|---|---|---|---|
| Chip único + semântica link/botão | vitest componente+SSR | 34 PASS | ✓ PASS |
| Zero chamadas adicionais (baseline) | vitest baseline em leitura | 1 PASS, JSON sem drift | ✓ PASS |
| Superfícies (detalhe/lista/dashboard) | vitest 9 arquivos | 133 PASS | ✓ PASS |
| Modelo + i18n | vitest 4 arquivos | 36 PASS | ✓ PASS |
| Tipos | `tsc --noEmit` | exit 0 | ✓ PASS |
| Lint | `eslint .` | exit 0 | ✓ PASS |
| Probes (`scripts/*/tests/probe-*.sh`) | — | Fase sem probes declarados ou convencionais | N/A |

---

## 15. Confirmação de estado da fase

- **Não publicada:** nenhum deploy/merge/push executado; branch `feat/campaign-format-chips` **sem upstream**, 40 commits à frente de `main`, HEAD contido apenas nessa branch.
- **Não sincronizada/arquivada:** a change permanece em `openspec/changes/padronizar-chips-formatos-campanhas/`; não existe diretório correspondente em `openspec/changes/archive/`.
- **Não concluída documentalmente:** `ROADMAP.md` e `STATE.md` dizem “aguardando verificações formais e fechamento documental”; `61-04` segue superseded sem aprovação retroativa.
- **Sem banco/Storage/provider/homolog/produção, migration, RPC, financeiro:** confirmado por escopo de diff e pelos logs (gates de banco “NÃO EXECUTADO”).
- **Nenhuma alteração de código/planos foi feita por este verificador.** Este relatório é o único artefato criado; nada foi commitado.

---

_Verified: 2026-11-22T17:41:23Z_
_Verifier: gsd-verifier (subagente)_
