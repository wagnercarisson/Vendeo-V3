---
phase: 63-base-versionada-de-ofertas-2a
plan: 04
subsystem: credit / trial-offer
tags: [typescript, supabase, rpc, fail-closed, contract, vitest]

# Dependency graph
requires:
  - phase: 63-base-versionada-de-ofertas-2a
    plan: 03
    provides: "Funções SQL trial_offer_conditions, trial_offer_public_offer e trial_offer_release_schedule com seed v1 (28/20/weekly/5) aplicado no homolog"
provides:
  - "Contrato puro compartilhável (tipos, frequências, nomes de RPC, listas de campos esperados/proibidos)"
  - "Leitura server-only e fail-closed de projeção pública, condições e calendário derivado"
  - "Provas locais de mapeamento defensivo, projeção sem campos proibidos, total cruzado e reutilização de cliente"
affects: [63-05, fase 4 (consumidores), Admin de publicação]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Contrato puro separado do módulo server-only (sem Supabase/Next em offer-contract.ts)"
    - "Resolvedor lazy de cliente com cache de módulo e import dinâmico de @/lib/supabase/server"
    - "Projeção pública por whitelist de seis campos + rejeição explícita de chaves proibidas"
    - "Erro tipado TrialOfferReadError com code/field/cause e mensagens sem payload bruto"

key-files:
  created:
    - src/lib/credit/trial-offer/offer-contract.ts
    - src/lib/credit/trial-offer/offer.ts
    - src/lib/credit/__tests__/trial-offer-offer.test.ts
  modified: []

key-decisions:
  - "version_id é proibido na projeção pública; a checagem de versão solicitada é redundante por desenho (fail-closed mais forte que mismatch)"
  - "readTrialOfferSchedule resolve o cliente UMA vez e repassa o cliente resolvido a readTrialOfferConditions, reutilizando-o na RPC de calendário (inclui caminho lazy)"
  - "Validação de timestamp exige ISO-8601 com offset/Z e fração de até 6 dígitos, cobrindo a serialização jsonb de timestamptz do Postgres"
  - "Calendário cruza soma = total = max_total_credits, seq contíguo, primeira liberação em started_at e última estritamente antes de expires_at"
  - "Nenhum commit/push/deploy e nenhuma atualização de STATE/ROADMAP: limites explícitos da autorização do usuário"

patterns-established:
  - "Teste com cliente RPC fake que registra nome/args/owner e não expõe from/insert/update/delete/upsert"
  - "Prova de resolução única via getter contador em vi.mock('@/lib/supabase/server')"

requirements-completed: [REQ-63-04, REQ-63-07]

# Metrics
duration: 6min
completed: 2026-11-26
---

# Phase 63 Plan 04: Módulo de leitura versionada de ofertas Summary

**Contrato puro + leitura server-only fail-closed das condições, projeção pública de seis campos e calendário cruzado com max_total_credits, com cliente RPC resolvido uma única vez**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-11-26T23:18:45Z
- **Completed:** 2026-11-26T23:25:07Z
- **Tasks:** 2/2
- **Files created:** 3 (+ este SUMMARY)
- **Files modified:** 0 existentes

## Accomplishments

- `offer-contract.ts` puro: tipos camelCase, `TRIAL_OFFER_RPC`, `PUBLIC_OFFER_FIELDS`, `CONDITIONS_FIELDS`, `FORBIDDEN_PUBLIC_FIELDS` e lista fechada de frequências, sem Supabase/Next/`server-only`/I/O.
- `offer.ts` com `import "server-only"`, sem `supabaseAdmin` no topo, import dinâmico apenas no caminho lazy e cache de módulo.
- Três leituras públicas: `readCurrentTrialOffer`, `readTrialOfferConditions`, `readTrialOfferSchedule`; mapeamento defensivo de jsonb e `TrialOfferReadError` (`rpc_error`, `invalid_payload`, `missing_field`, `invalid_field`, `total_mismatch`, `schedule_empty`, `non_contiguous_seq`).
- Projeção pública limitada a seis campos; qualquer chave proibida (inclusive `release_count` e `version_id`, mesmo com valor nulo) é rejeitada com `invalid_payload`.
- Calendário validado contra as condições da mesma versão: soma = `total` = `max_total_credits`, seq 0..n-1, primeira liberação no instante de `started_at`, última estritamente antes de `expires_at`, amounts inteiros positivos.
- **Reutilização de cliente comprovada:** `readTrialOfferSchedule` resolve `rpcClient` uma vez (linha 412) e usa exatamente esse objeto em `readTrialOfferConditions(versionId, rpcClient)` (linha 415) e em `rpcClient.rpc(schedule, …)` (linha 417). Testes 18 (injetado) e 19 (lazy) verificam `owner` idêntico nas duas RPCs e `resolutions === 1` (mesmo após segunda chamada, graças ao cache).
- Nenhuma chamada de escrita/`from(`; nenhum consumidor importa `offer.ts`.

## Task Commits

Nenhum commit foi criado — a autorização do usuário proíbe commit/push/deploy nesta execução.

1. **Task 1: contrato puro e módulo server-only** — arquivos criados, sem commit (proibido)
2. **Task 2: provas locais e ausência de religação** — arquivo de teste criado, sem commit (proibido)

**Plan metadata:** não commitado (proibido); SUMMARY gravado apenas no working tree.

_Nota: o plano tem `tdd="true"`, mas o usuário proibiu commits; não há gates RED/GREEN em git log. O ciclo foi executado em código único (contrato + módulo + testes) e validado pela suíte focada._

## Files Created/Modified

- `src/lib/credit/trial-offer/offer-contract.ts` (100 linhas) — contrato puro: tipos, RPCs, campos esperados/proibidos, frequências.
- `src/lib/credit/trial-offer/offer.ts` (428 linhas) — leitura server-only, resolvedor lazy, validadores internos, mapeadores e erro tipado.
- `src/lib/credit/__tests__/trial-offer-offer.test.ts` (572 linhas) — 30 testes locais, fake RPC sem banco/rede, prova de reutilização de cliente e de ausência de escrita.

## Verification Results

| Gate | Comando | Resultado |
|---|---|---|
| Suíte focada | `npx vitest run src/lib/credit/__tests__/trial-offer-offer.test.ts` | **1 arquivo / 30 testes PASS** |
| Typecheck | `npm run typecheck` | **exit 0** |
| ESLint (3 arquivos) | `npx eslint ...` | **exit 0** (0 erros; 3 warnings “File ignored because no matching configuration” — limitação pré-existente de ESLint sem parser TS) |
| Sem import de consumidor | script `node -e ...` do plano | **`no consumer imports`, exit 0** |
| Diff guard | `git diff --name-only` + `git status --short` | Apenas os 3 arquivos novos em `src/`; `constants.ts`, `status.ts`, `completion.ts`, `messages.ts`, `public-offer-copy.ts`, Admin, páginas e flags intocados |
| Escrita no módulo | teste + varredura | Nenhum `.insert(`, `.update(`, `.delete(`, `.upsert(`, `.from(` em `offer.ts` |
| Suíte global | `npm test` | **873 arquivos PASS + 2 skipped; 10.944 testes PASS + 10 skipped; 3 falhas pré-existentes** (ver abaixo) |

### Suíte global — falhas pré-existentes, não atribuídas a este plano

`GLOBAL_EXIT=1` com exatamente 3 testes falhando, todos guardas F60.4/F60.7 sobre migrations não rastreadas:

1. `src/lib/campaign/square-base/__tests__/boundaries.contract.test.ts:463` — lista `git status` de `supabase/migrations` e encontra as três migrations F63 (`20261126223854`, `20261126230735`, `20261126231022`), já presentes/untracked no baseline desta execução.
2. `src/lib/product-two-format/orchestration/__tests__/joint-boundaries.contract.test.ts:212` — mesma causa (migrations F63 untracked em `supabase/migrations`).
3. `src/lib/campaign/square-base/__tests__/regression.contract.test.ts:234` — `git diff --quiet <base>..HEAD` sobre caminhos protegidos F60.4; depende apenas de HEAD (inalterado em `3f2daa50`) e ignora arquivos untracked, portanto independe deste plano.

Nenhuma falha envolve `src/lib/credit/**`. Nenhum perfil Postgres/homolog foi executado (`test:integration:*` não rodou).

## Client-reuse proof (requisito especial do usuário)

- `readTrialOfferSchedule` chama `await resolveRpcClient(client)` **uma única vez** e nunca volta a usar o parâmetro `client`.
- `readTrialOfferConditions` recebe o cliente já resolvido; como `client !== undefined`, `resolveRpcClient` retorna imediatamente sem novo import.
- Teste 18 (injetado): duas chamadas registradas no mesmo objeto (`owner` idêntico).
- Teste 19 (lazy): `vi.mock("server-only")` + `vi.mock("@/lib/supabase/server")` com getter contador; chamada sem cliente resulta em `resolutions === 1`, duas RPCs no mesmo `owner`, e uma segunda chamada mantém `resolutions === 1` (cache).
- Não existe caminho em que `readTrialOfferConditions(versionId, client)` receba o parâmetro opcional e depois `client.rpc` seja usado; o código passa sempre `rpcClient`.

## Decisions Made

- `version_id` é rejeitado na projeção pública independentemente do valor: a whitelist de seis campos é a garantia primária e a checagem de versão solicitada é defensiva/redundante.
- Regex ISO aceita `Z` e offsets `±HH:MM` com até 6 casas decimais, formato real do `jsonb` de `timestamptz` no Postgres.
- Códigos de erro mantidos na lista mínima do plano; detalhes de liberação usam `invalid_field` com `field` preciso (`releases[0].due_at`, `expires_at`).
- Cache de cliente em variável de módulo evita import/resolução repetidos; testes locais não exercitam o caminho default antes do caso 19.

## Deviations from Plan

Nenhum desvio automático (Rules 1–4). Ajustes de implementação dentro do desenho aprovado:

- O plano sugere 19 casos mínimos; a suíte entrega 30 (inclui `it.each` para créditos recorrentes inválidos e para chaves proibidas), sem enfraquecer nenhum caso exigido.
- Não houve commit por task, atualização de `STATE.md`/`ROADMAP.md` nem `requirements mark-complete`, em obediência aos limites explícitos do usuário (apenas 3 arquivos + SUMMARY).

## Issues Encountered

- ESLint não cobre arquivos `.ts` nesta configuração (warnings “File ignored”), limitação pré-existente registrada em STATE.md; exit 0 e zero erros.
- `npm` no PowerShell falhou em pipeline (`npm` resolvido para documento em `System32`); typecheck e suíte global foram executados via `C:\Program Files\nodejs\npm.cmd`, sem alterar ambiente.

## Known Stubs

Nenhum. O módulo é aditivo e não é consumido por nenhuma página/rota; não há dados mockados fluindo para UI.

## Threat Flags

Nenhuma superfície nova além do modelo de ameaças do plano. O módulo não cria rotas, não lê tabelas diretamente e não escreve.

## Self-Check: PASSED

- `src/lib/credit/trial-offer/offer-contract.ts` — existe
- `src/lib/credit/trial-offer/offer.ts` — existe
- `src/lib/credit/__tests__/trial-offer-offer.test.ts` — existe
- Commits — **N/A por design** (commit proibido pela autorização); HEAD permanece `3f2daa50`
- `git diff --name-only` sem consumidores; nenhum arquivo rastreado alterado por este plano

## Review Stop

**PARADO NO REVIEW STOP DO 63-04.** Execução autorizada por `approved: 63-04`; o plano exige revisão dos tipos e da semântica de falha antes de qualquer consumo.

Checklist do revisor:

- [ ] `offer-contract.ts` é puro e serve ao runtime e aos testes de banco.
- [ ] `offer.ts` é server-only, não importa `supabaseAdmin` no topo e não expõe escrita.
- [ ] Falhas fechadas cobrem payload inválido, total divergente, seq irregular e projeção com campos proibidos.
- [ ] Calendário é cruzado com `max_total_credits` da mesma versão.
- [ ] Nenhum consumidor, constante, copy, Admin, página ou flag foi alterado.

**63-05 NÃO iniciado.** Nenhuma migration, comando de banco, `db reset`/`db push`, escrita em homolog, teste Postgres, commit, push ou deploy foi executado.

---
*Phase: 63-base-versionada-de-ofertas-2a*
*Completed: 2026-11-26*
