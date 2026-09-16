---
phase: 48.1-laboratorio-ia-minimo
plan: 48-1-02
subsystem: infra
tags: [lab, f48.1, environment-guard, fail-closed, supabase, limits, architecture-guard, env-vars]

# Dependency graph
requires:
  - phase: 48.1-laboratorio-ia-minimo
    provides: migrations locais do laboratório (48-1-01) e schema local inerte; nenhuma dependência técnica direta deste plano
  - phase: 46-gateway-unico-de-ia-e-registry-de-modelos
    provides: gate global de arquitetura (src/lib/ai/__tests__/architecture-guard.test.ts) e api-keys.ts como ponto único de leitura de chave
provides:
  - src/lib/lab/environment-guard.ts — getLabEnvironment/assertLabEnvironment/LabEnvironmentError/LAB_ENVIRONMENT_REASONS/labEnvironmentDeniedBody (5 motivos, fail-closed)
  - src/lib/lab/limits.ts — 7 constantes de limite como fonte única do domínio (D14)
  - .env.example — NEXT_PUBLIC_SUPABASE_URL, VENDEO_LAB_ENABLED=false e VENDEO_LAB_ALLOWED_SUPABASE_HOSTS documentados sem secrets reais
  - gate de arquitetura estendido para src/lib/lab/** (3 gates + 1 sanidade de varredura)
  - contrato 403 environment_blocked padronizado para as rotas do laboratório
affects: [48-1-03, 48-1-04, 48-1-05, 48-1-06, 48-1-07, 48-1-08, 48-1-09, 48-1-10, 48-1-11, 48-1-12, 48-1-13, 48-1-14]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Guarda de ambiente fail-closed: flag com igualdade estrita a 'true' + URL parseável + host local/allowlist, tudo antes de qualquer acesso a dados ou provider"
    - "Bloqueio incondicional de host de produção avaliado ANTES da allowlist (allowlist nunca habilita produção)"
    - "Erros de configuração expõem apenas o hostname — nunca URL completa, path, query ou chave"
    - "Constantes de limite em módulo puro (sem server-only), importável por UI/serviços/testes"
    - "Gate de arquitetura estendido de forma estritamente aditiva por prefixo de diretório (src/lib/lab/) + gate de sanidade contra varredura vazia"

key-files:
  created:
    - src/lib/lab/environment-guard.ts
    - src/lib/lab/limits.ts
    - src/lib/lab/__tests__/environment-guard.test.ts
    - src/lib/lab/__tests__/limits.test.ts
  modified:
    - src/lib/ai/__tests__/architecture-guard.test.ts
    - .env.example
    - .planning/STATE.md

key-decisions:
  - "Guarda estritamente fail-closed: a flag exige igualdade estrita com a string 'true' e o bloqueio de hosts de produção (*.supabase.co/.in/.com) é avaliado ANTES da allowlist — a allowlist é para hosts de desenvolvimento (ex.: host.docker.internal), nunca para produção (D2/T-48-1-11)."
  - "A guarda expõe apenas o hostname (supabaseHost); LabEnvironmentError carrega o reason + hostname, nunca a URL completa, path, query ou chave (D2/D15/T-48-1-12)."
  - "assertLabEnvironment() devolve LabEnvironmentState (superset de void, conforme o PLAN) e lança em qualquer reason diferente de 'ok'."
  - "Constantes de limite em módulo puro sem server-only, para serem importadas por UI, serviços e testes; o teto 12 é divisível por MAX_REPETITIONS=3 (4 combinações) (D14)."
  - "Gate de arquitetura estritamente aditivo: nenhuma regra existente afrouxada e DELIVERY_MARKER_FILES intacto (5 entradas). O sink do laboratório (src/lib/ai/lab-telemetry-sink.ts, plano 48-1-05) já cai na regra de prefixo src/lib/ai/** para resolveAiCost, sem exceção nova (D6/T-48-1-14)."
  - "Apenas .env.example foi alterado (DV-6); docs/operations/environment-variables.md foi lido como referência de convenção e permanece intacto."

patterns-established:
  - "Guarda consumida como primeiro contrato por páginas/rotas do laboratório (planos 48-1-08/09): nenhum acesso a tabelas lab_*, storage ou provider antes de assertLabEnvironment()"
  - "Recusa padronizada de API: 403 + labEnvironmentDeniedBody(reason) = { error: 'environment_blocked', reason }"
  - "Gate de arquitetura por prefixo de bounded context, com gate de sanidade para impedir aprovação por lista vazia"

requirements-completed: [lab-isolation]

# Metrics
duration: 6min
completed: 2026-09-16
---

# Phase 48.1 Plan 48-1-02: Guarda de ambiente fail-closed + constantes de limite + env vars + gate de arquitetura Summary

**Guarda de ambiente fail-closed local-only com 5 motivos (`ok`/`disabled_flag`/`missing_url`/`non_local_supabase`/`remote_blocked`), bloqueio incondicional de hosts Supabase de produção antes da allowlist, 7 constantes de limite como fonte única, env vars do laboratório documentadas sem secrets e gate de arquitetura cobrindo `src/lib/lab/**`.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-09-16T15:35:58Z
- **Completed:** 2026-09-16T15:41:49Z
- **Tasks:** 3/3
- **Files modified:** 6 (4 criados + 2 modificados) + `.planning/STATE.md`

## Accomplishments

- **`src/lib/lab/environment-guard.ts`**: guarda fail-closed com os 5 `reason` do D2, comparação **estrita** com a string `"true"`, `NEXT_PUBLIC_SUPABASE_URL` obrigatoriamente parseável, hostname normalizado (lowercase + `[::1]` → `::1`) e allowlist CSV (`VENDEO_LAB_ALLOWED_SUPABASE_HOSTS`) com `trim`/lowercase/descarte de vazios. Hosts `supabase.co`/`supabase.in`/`supabase.com` (exatos ou subdomínios) são bloqueados **antes** da allowlist, de modo que a allowlist nunca habilita produção. Nenhuma decisão usa o modo de execução do build.
- **`assertLabEnvironment()`** lança `LabEnvironmentError` (com `.reason` e `.name`) para qualquer `reason !== "ok"` e devolve o estado quando permitido; as mensagens contêm o `reason` e, no máximo, o **hostname** — nunca URL completa, path, query ou chave (teste dedicado com URL contendo `/rest/v1?apikey=…` prova a ausência de vazamento).
- **`labEnvironmentDeniedBody(reason)`** padroniza o corpo `403 { error: "environment_blocked", reason }` que os planos 48-1-08/09 vão reutilizar.
- **`src/lib/lab/limits.ts`**: 7 constantes travadas (`MAX_SCENARIOS_PER_EXPERIMENT=3`, `MAX_REPETITIONS=3`, `MAX_RUNS_PER_EXPERIMENT=12`, `DEFAULT_MAX_RUNS_PER_EXPERIMENT=6`, `MAX_CONCURRENT_LAB_RUNS=1`, `LAB_RUN_STALE_MS=900000`, `LAB_ARTIFACT_RETENTION_DAYS=30`), módulo puro sem dependências e sem `server-only`, com comentário de efeito por constante.
- **`.env.example`**: bloco Supabase (`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, com nota de que em produção aponta para o projeto remoto e ponteiro para `docs/operations/environment-variables.md`), bloco do laboratório (`VENDEO_LAB_ENABLED=false` + allowlist CSV vazia com aviso de que produção é sempre bloqueada) e requisito operacional de usar chave/projeto de **desenvolvimento** na UAT (sem mecanismo novo de chave). Nenhuma linha pré-existente removida e zero padrões de chave real.
- **Gate de arquitetura estendido** com 4 `it(...)` novos (sem `generation_events`/`AiCostTracker.record`, sem provider de imagem de produção/SDK-wire, sem leitura direta de chave de provider, e sanidade de varredura que exige `src/lib/lab/environment-guard.ts`), sem afrouxar nenhuma regra anterior.
- **54 testes** no conjunto do plano (34 da guarda + 11 dos limites + 9 do gate), todos verdes; suíte completa de `src/lib/ai` permanece verde (276 testes / 23 arquivos).

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: environment-guard.ts fail-closed (getLabEnvironment / assertLabEnvironment / LabEnvironmentError)** - `62a4b87f` (feat)
2. **Task 2: Constantes de limite do domínio + env vars do laboratório em .env.example** - `a68930e7` (feat)
3. **Task 3: Estender o gate de arquitetura para cobrir src/lib/lab/** - `3a0e6017` (test)

**Plan metadata:** commit de fechamento `docs(48-1-02): complete …` (este SUMMARY + `.planning/STATE.md` + `.planning/ROADMAP.md`)

## Files Created/Modified

- `src/lib/lab/environment-guard.ts` (criado) — `LAB_ENVIRONMENT_REASONS`, `LabEnvironmentReason`, `LabEnvironmentState`, `LabEnvironmentError`, `getLabEnvironment()`, `assertLabEnvironment()`, `labEnvironmentDeniedBody()`; `import "server-only"`.
- `src/lib/lab/__tests__/environment-guard.test.ts` (criado) — 34 testes: flag (ausente/`false`/`1`/`TRUE`/`true`), URL (ausente/vazia/não parseável), 4 hosts locais, normalização, 5 hosts de produção, allowlist CSV (inclusive não vencendo produção e com espaços/case), `assertLabEnvironment` nos 4 motivos de recusa + `ok`, ausência de vazamento de URL/path/query/chave e corpo 403.
- `src/lib/lab/limits.ts` (criado) — 7 `export const` numéricos (`as const`) com comentário de efeito; sem dependências.
- `src/lib/lab/__tests__/limits.test.ts` (criado) — 11 testes dos valores exatos + invariantes (`DEFAULT ≤ MAX_RUNS`, `12 % 3 === 0` e `12 / 3 === 4`, positividade).
- `src/lib/ai/__tests__/architecture-guard.test.ts` (modificado) — +53 linhas estritamente aditivas: `labFiles`, `LAB_IMAGE_PROVIDER_RE`, `LAB_API_KEY_ENV_RE` e 4 novos `it(...)`; os 5 `it(...)` anteriores e `DELIVERY_MARKER_FILES` intactos.
- `.env.example` (modificado) — 3 variáveis novas documentadas + nota operacional de chave de desenvolvimento; nenhuma linha removida.
- `.planning/STATE.md` (modificado) — posição avançada (`Plan: 3 of 14`), progresso 114/127 (90%), métrica de performance, 5 decisões registradas e linha 48-1-02 marcada ✅.

## Verification Evidence

### Gates (exit codes)

| Comando | Exit | Resultado observado |
|---------|------|---------------------|
| `npx vitest run src/lib/lab/__tests__/environment-guard.test.ts src/lib/lab/__tests__/limits.test.ts src/lib/ai/__tests__/architecture-guard.test.ts` | **0** | 3 arquivos / **54 testes** passando |
| `npx tsc -p tsconfig.typecheck.json --noEmit` | **0** | sem erros (executado 2×: após a Task 2 e após a Task 3) |
| `npm run lint` | **0** | `eslint .` sem achados |
| `npx vitest run src/lib/ai` | **0** | 23 arquivos / **276 testes** (regressão do gate no diretório `src/lib/ai`) |

### Asserções de isolamento (`src/lib/lab/`)

| Comando | Resultado |
|---------|-----------|
| `rg "NODE_ENV\|VERCEL_ENV" src/lib/lab/` | **0** ocorrências (exit 1) |
| `rg "generation_events\|AiCostTracker" src/lib/lab/` | **0** ocorrências (exit 1) |
| `rg "providers/openai\|OpenAIImageProvider" src/lib/lab/` | **0** ocorrências (exit 1) |
| `rg "process\.env\.(OPENAI\|GEMINI)_API_KEY" src/lib/lab/` | **0** ocorrências (exit 1) |

### Critérios de aceite (PASS por task)

**Task 1**
| Critério | Resultado |
|---|---|
| Arquivo existe e exporta `LAB_ENVIRONMENT_REASONS`/`getLabEnvironment`/`assertLabEnvironment`/`LabEnvironmentError`/`labEnvironmentDeniedBody` | **PASS** |
| `rg 'VENDEO_LAB_ENABLED !== "true"'` → 1 ocorrência (linha 117) | **PASS** |
| `rg "NODE_ENV\|VERCEL_ENV"` → 0 linhas | **PASS** |
| `rg "supabase\.co\|supabase\.in\|supabase\.com"` → encontra `PRODUCTION_SUPABASE_DOMAINS` (linha 53) | **PASS** |
| `rg "NEXT_PUBLIC_SUPABASE_URL"` → 1 **leitura** (`process.env.NEXT_PUBLIC_SUPABASE_URL`, linha 122) | **PASS** (a literal aparece também na mensagem obrigatória de `missing_url`, exigida pelo próprio plano) |
| `rg "OPENAI_API_KEY\|GEMINI_API_KEY"` → 0 linhas | **PASS** |
| `npx vitest run …/environment-guard.test.ts` exit 0 cobrindo os 5 `reason` | **PASS** (34 testes) |

**Task 2**
| Critério | Resultado |
|---|---|
| `limits.ts` existe com as 7 constantes | **PASS** |
| `rg -c "^export const"` → **7** | **PASS** |
| `.env.example` contém `NEXT_PUBLIC_SUPABASE_URL`, `VENDEO_LAB_ENABLED=false` e `VENDEO_LAB_ALLOWED_SUPABASE_HOSTS=` | **PASS** (linhas 9, 20, 24) |
| `rg "VENDEO_LAB_ENABLED" .env.example` → exatamente 1 atribuição (`=false`) | **PASS** |
| Variáveis pré-existentes mantidas (`OPENAI_API_KEY`, `GEMINI_API_KEY`, `IMAGE_GENERATION_GLOBAL_TIMEOUT_MS`, `VENDEO_MONTHLY_CREDITS_ENABLED`, `CNPJ_PEPPER`) | **PASS** |
| `rg "sk-[A-Za-z0-9]{8,}\|AIza[A-Za-z0-9]{8,}" .env.example` → 0 linhas | **PASS** |
| `npx vitest run …/limits.test.ts` exit 0 | **PASS** (11 testes) |
| `npx tsc -p tsconfig.typecheck.json --noEmit` verde | **PASS** |

**Task 3**
| Critério | Resultado |
|---|---|
| `npx vitest run …/architecture-guard.test.ts` exit 0 | **PASS** (9 testes) |
| 4 `it(...)` originais inalterados + 4 novos | **PASS** (5 originais preservados: 4 gates + allowlist; total **9**) |
| `rg "src/lib/lab"` → `>= 4` | **PASS** (4) |
| `rg "OpenAIImageProvider\|providers/openai"` encontra a nova asserção | **PASS** (linha 142) |
| `DELIVERY_MARKER_FILES` com exatamente as 5 entradas originais (nenhuma `src/lib/lab/`) | **PASS** |
| `npx vitest run src/lib/ai` verde | **PASS** (276 testes) |

### Human checks colhidos para a UAT de fim de fase (`human_verify_mode: end-of-phase`)

- Task 2 `<human-check>`: “nenhum valor real de secret adicionado e as 3 variáveis novas documentadas em `.env.example`”. Verificado automaticamente (grep de padrões de chave = 0 linhas; 3 variáveis presentes) — confirmação humana consolidada na UAT da fase (48-1-14).

## Decisions Made

- **Bloqueio de produção vence a allowlist:** avaliado antes da allowlist, com teste dedicado (`https://abcd.supabase.co` + allowlist contendo `abcd.supabase.co` → `remote_blocked`). A allowlist existe para hosts de desenvolvimento (ex.: `host.docker.internal`).
- **Erro sem vazamento:** a guarda devolve apenas `supabaseHost` e a mensagem do erro contém `reason` + hostname; teste com URL contendo path/query/`apikey` prova ausência de `/rest`, `v1`, `apikey`, `sk-` e `AIza`.
- **`assertLabEnvironment()` devolve o estado** (o `PLAN` especifica `LabEnvironmentState`; `design.md` D2 dizia `void` — o retorno é superset compatível, e o valor é útil para a página/rota exibir o `reason`).
- **Constantes puras, sem `server-only`**, para permitir importação por UI, serviços e testes (D14).
- **Apenas `.env.example` foi alterado** (DV-6). `docs/operations/environment-variables.md` foi usado como referência de convenção e **não** foi modificado — o plano lista `.env.example` como único arquivo de documentação de env vars a alterar.
- **Nenhuma dependência nova instalada** (T-48-1-SC): a implementação usa apenas APIs nativas (`URL`, `Set`) e o Vitest já existente.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Handlers de tracking com formato divergente (não bloqueante, mesmo comportamento do 48-1-01):** `state.update-progress` retornou `Progress field not found in STATE.md` e `state.record-session` retornou `No session fields found in STATE.md` — este `STATE.md` usa `progress:` no frontmatter e `Last updated`/`Last activity` no corpo, não os campos esperados pelos handlers. Os números de progresso foram ajustados diretamente no frontmatter (`completed_plans: 113 → 114`, `percent: 89 → 90`) e a linha 48-1-02 marcada ✅; `state.advance-plan`, `state.record-metric` (com flags nomeadas) e `state.add-decision` aplicaram normalmente.
- **`requirements.mark-complete` não se aplica:** `.planning/REQUIREMENTS.md` não possui REQ-IDs `LAB-*` (o rastreio da F48.1 é por slug de capability em `.planning/ROADMAP.md`), então o comando foi omitido — mesma situação registrada no 48-1-01.
- **Observação de contagem no critério do grep:** `rg "NEXT_PUBLIC_SUPABASE_URL"` retorna 2 linhas no arquivo — 1 leitura real (`process.env.NEXT_PUBLIC_SUPABASE_URL`) e a mensagem de erro obrigatória de `missing_url` exigida pelo próprio plano. A leitura continua sendo exatamente 1.

## User Setup Required

None - nenhuma configuração de serviço externo necessária. As variáveis documentadas em `.env.example` (`NEXT_PUBLIC_SUPABASE_URL`, `VENDEO_LAB_ENABLED=false`, `VENDEO_LAB_ALLOWED_SUPABASE_HOSTS`) têm default seguro e `VENDEO_LAB_ENABLED=false` mantém o laboratório desabilitado até a UAT local.

## Next Phase Readiness

- **Pronto para 48-1-03** (cenários controlados) e **48-1-04** (domínio de experimentos) — ambos na onda 2; as constantes de limite já são a fonte única a ser consumida pelas validações de domínio.
- **Pronto para 48-1-05** (harness de gateway): o gate de arquitetura já cobre `src/lib/lab/**` e o `LabTelemetrySink` em `src/lib/ai/lab-telemetry-sink.ts` cai na regra de prefixo `src/lib/ai/**` para `resolveAiCost`.
- **Pronto para 48-1-08/09** (API/UI): `assertLabEnvironment()` + `labEnvironmentDeniedBody(reason)` são o contrato de entrada obrigatório de toda página e rota do laboratório.
- **Pendência deliberada e rastreada (herdada do 48-1-01):** as migrations do laboratório permanecem **não aplicadas no remoto**; `VENDEO_LAB_ENABLED` deve permanecer `false` até a UAT local (push remoto deliberado é a última task do 48-1-14).
- **Nota para o gate de contrato do 48-1-13/48-1-14:** a baseline da fase continua sendo `48.1-BASELINE.txt` (`75ab54cf23eee1a6a31b500a5a2646398aada6eb`).

---

## Self-Check: PASSED

- [x] `src/lib/lab/environment-guard.ts` existe
- [x] `src/lib/lab/limits.ts` existe
- [x] `src/lib/lab/__tests__/environment-guard.test.ts` existe
- [x] `src/lib/lab/__tests__/limits.test.ts` existe
- [x] `.env.example` contém as 3 variáveis novas
- [x] Commit `62a4b87f` encontrado (Task 1)
- [x] Commit `a68930e7` encontrado (Task 2)
- [x] Commit `3a0e6017` encontrado (Task 3)
- [x] `npx vitest run` (3 suites) exit 0 — 54 testes
- [x] `npx tsc -p tsconfig.typecheck.json --noEmit` exit 0
- [x] `npm run lint` exit 0
- [x] 4 greps de isolamento em `src/lib/lab/` com 0 ocorrências

---
*Phase: 48.1-laboratorio-ia-minimo*
*Completed: 2026-09-16*
