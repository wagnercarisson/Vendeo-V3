# Phase 61 — Plan Check do plano complementar `61-04` (revisão final)

**Fase:** `61-padronizar-chips-formatos-campanhas`
**Plano verificado:** `61-04-PLAN.md` (wave 4, `depends_on: [61-03]`, `autonomous: false`)
**Change OpenSpec:** `padronizar-chips-formatos-campanhas`
**Método:** goal-backward + confronto com código/testes reais, `design.md`, specs, `tasks.md` e `61-CONTEXT.md` atualizados. Revisão somente leitura: nenhum código, banco, Storage, provider, migration, ambiente, merge/push/sync/archive foi tocado. Nenhum plano foi editado.
**Data:** 2026-11-21

---

## Veredito

# ✅ PASS

**0 BLOCKERS · 0 HIGH · 0 MEDIUM · 6 LOW/INFO**

O plano está executável e cobre o objetivo da revisão visual: chips compactos, estado acessível completo, ajuda flutuante sem deslocamento, SSR seguro, locale preservado e preservação das três superfícies. Os blockers e HIGH das revisões anteriores foram **verificados como resolvidos**, sem regressão de escopo.

---

## Gates executados nesta revisão

| Gate | Resultado |
|---|---|
| `openspec validate padronizar-chips-formatos-campanhas --strict` | ✅ `Change ... is valid` |
| `gsd-sdk query verify.plan-structure 61-04-PLAN.md` | ✅ `valid: true`, 3 tasks com `files/action/verify/done` |
| `git diff --check c971d631a190d426be21341f4616f6e4c7cb5135..HEAD` | ✅ exit 0 |
| `files_modified` × `<files>` das 3 tasks | ✅ 18 arquivos em `files_modified`; 18 únicos nas tasks; **0 órfãos** e **0 arquivos de task fora de `files_modified`** |
| `sr-only` no plano / `design.md` / `61-CONTEXT` / OpenSpec | ✅ removido; contrato agora usa nó `hidden` + `aria-describedby` |
| `campaign-format-chips.ssr.test.tsx` | ⏳ ainda não existe no worktree; é criado pela Task 2 (coerente com plano pré-execução) |
| `61-04-VISUAL-CHECK.md` | ⏳ planejado, pendente de inspeção humana |

---

## Correções verificadas

### H-01 anterior — descrição acessível × `not.toBeVisible` → RESOLVIDO

- `61-04-PLAN.md:105` fixa descrição em **nó `hidden` referenciado por `aria-describedby`**, proíbe `sr-only` e exige `toHaveAccessibleDescription` + `not.toBeVisible`.
- `61-CONTEXT.md:239,241` e `design.md:140,145` também migraram para `hidden`; não há mais `sr-only` no plano, contexto, design ou OpenSpec.
- `aria-controls` agora é condicional (“somente quando montado/aberto”), eliminando referência pendente (`plan:123`; `context:239`; `design:145`).
- `hidden` referenciado por `aria-describedby` continua produzindo descrição acessível e faz `not.toBeVisible` passar.

### H-02 anterior — `<files>` das tasks × `files_modified` → RESOLVIDO

- Task 3 agora lista `campanhas/client.tsx`, `campanhas/[id]/client.tsx`, `available-campaign-card.tsx`, `dashboard-campaigns.tsx`, `dashboard/page.tsx` e todos os testes de superfície (`plan:135`).
- Verificação automatizada: os 18 caminhos de `files_modified` estão cobertos pelas Tasks 1/2/3; nenhum arquivo de task está fora do plano.
- A passagem de `helpLang` das três superfícies está no `<files>` e na ação (`plan:133,137`), assim como o espaçamento do detalhe e a evidência visual.

### Demais correções solicitadas — CONFIRMADAS

| Item | Evidência |
|---|---|
| Baseline antes na Task 1 | `plan:103` (“ANTES de editar … registrar que o JSON não foi recapturado”) |
| Clique dentro do popover não fecha | `plan:123,125` |
| Reabertura por hover após sair/voltar | `plan:125` |
| Hit area ≥44×44 do “?” **e do link** | `plan:123,125` |
| Viewports 1440×900 / 390×844 / 320 | `plan:141` |
| Artefato SSR em `must_haves.artifacts` | `plan:48-49` |
| IDs FMT-PRES-01 / FMT-INFO-05 / FMT-EFFECT-06 | `plan:27` |
| `61-CONTEXT` atualizado (`role=group`, `hidden`, `aria-controls` condicional, `helpLang`) | `context:225,239,241` |
| Objetivo registra 61-03 **NÃO ACEITO** | `plan:66` |
| CSS/HTML preservado: sem portal no servidor | `plan:121`; truth `plan:35` |
| Locale do portal `es-419` | `plan:121,133`; truth `plan:36` |
| Task 3 com baseline/typecheck/lint/build/global/diff-check | `plan:144-147` |
| Lista/dashboard sem link por formato / `?format=` estrito | `plan:139` |

---

## Cobertura final do contrato

| Área | Situação |
|---|---|
| 1. Nomes visíveis apenas; sem rótulos/badge; sem ícones normais; delivered discreto; absent cinza; active sem badge; excepcionais pequenos; estado acessível; distinguir absent/refunded/unknown | ✅ Coberto |
| 2. Hover/foco; “?” toque; sem círculo; 44 px “?” e link; portal/fixed; fora do fluxo; viewport/overflow; 2º/fora/Escape; 1º não fecha; clique dentro; sem nested; sem foco perdido | ✅ Coberto |
| 3. Lista/dashboard informativos; detalhe link; “?” independente; sem prefetch; `?format=` estrito; preview/download/polling/aprovação/recuperação; espaçamento | ✅ Coberto |
| 4. Limites (sem builders/lifecycle/financeiro/copy/miniatura/dados; zero consultas; sem dependência/ambiente) | ✅ Declarado e compatível com o escopo |
| 5. 3 tasks; comandos; arquivos; baseline antes/depois; typecheck/lint/build/global; diff-check; evidência visual; Review Stop | ✅ Coberto (com observação L-01) |
| 6. OpenSpec `--strict`; requisitos/scenarios; tasks 10.x; aceites históricos | ✅ Válido e coerente |

---

## LOW / INFO (não bloqueantes)

### L-01 — Baseline “antes” está na ação da Task 1, mas não no `<verify>` da Task 1

- `plan:103` manda rodar; `plan:112` verifica apenas as suítes de componente/lista/dashboard. O baseline “depois” está no `<verify>` da Task 3 (`plan:145`).
- **Sugestão:** adicionar o caminho completo do `baseline-calls.test.ts` como `<automated>` da Task 1 (ou uma linha explícita no done), para auditabilidade sem depender de leitura da prosa. Não impede a execução: a ação é explícita e o JSON é imutável.

### L-02 — `must_haves.key_links` não modela a passagem de `helpLang`

- Os `key_links` cobrem `createPortal` e `CampaignFormatPresentation`, mas não “três superfícies → `helpLang` → portal”. A truth cobre o comportamento (`plan:36`) e os arquivos estão no escopo.
- **Sugestão:** adicionar um `key_link` das superfícies para o componente/portal, se quiser rastreabilidade explícita.

### L-03 — `src/app/(app)/dashboard/page.tsx` está em `files_modified`/Task 3, mas não no `<context>`

- `plan:15,135`; o `<context>` lista `available-campaign-card.tsx` e `dashboard-campaigns.tsx`, não o page.
- **Sugestão:** incluir `@src/app/(app)/dashboard/page.tsx` no contexto para leitura prévia do ponto de passagem de `helpLang`.

### L-04 — `tasks.md` 10.9/10.7 não refletem os detalhes finais do plano

- `tasks.md:10.9` fala “desktop/mobile”; o plano fixa 1440×900/390×844/320 (`plan:141`). `tasks.md:10.7` não cita SSR/`hidden`; o plano cobre (`plan:125`).
- **Sugestão:** alinhar os dois checkboxes ao plano, mantendo `tasks.md` como checklist fiel.

### L-05 — Estado completo está no `role="group"`/descrição; o link focável em si carrega apenas o nome (+ `aria-current`)

- O grupo tem `aria-label` completo + `aria-describedby` para o nó `hidden`; o “?” tem nome + estado. Um leitor de tela que tabula direto no link pode ouvir o nome do grupo ao entrar, mas a garantia mais forte seria associar a descrição também ao link.
- **Sugestão:** aplicar `aria-describedby` no link/`span` interativo, além do grupo. Não é blocker: o estado permanece acessível no grupo e no “?”.

### L-06 — Indicadores pequenos e ausência de frase longa não estão nomeados na lista de testes

- `plan:107` define `Loader2`/`CircleHelp`/`Undo2` pequenos; `plan:125` lista “classes de posicionamento/portal”, “? compacto” e “alvo 44×44”, mas não repete a asserção de cada indicador/ausência de frase longa.
- **Sugestão:** incluir explicitamente um caso por estado excepcional no teste de componente. A ação já cobre a implementação; é reforço de verificação.

---

## Conclusão

O plano `61-04` pode seguir para execução. Não há blocker/high/médio. As observações acima são de rastreabilidade/auditabilidade e podem ser incorporadas sem nova rodada de revisão.

**Status:** `61-03` continua **NÃO ACEITO**; a UX continua **não aprovada**; a fase 61 **não está concluída**. Nenhuma implementação, migration, RPC, consulta, dependência, ambiente, merge, push, deploy, sync ou archive foi executado nesta verificação.
