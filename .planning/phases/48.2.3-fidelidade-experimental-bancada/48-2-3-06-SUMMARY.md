---
phase: 48.2.3-fidelidade-experimental-bancada
plan: 48-2-3-06
subsystem: lab-bench
tags: [lab, bench, prompt-composer, preflight, deterministic, vitest]

# Dependency graph
requires:
  - phase: 48.2.3 (planos 48-2-3-04 e 48-2-3-05)
    provides: snapshot fiel de produto/campanha e briefing experimental estruturado (entradas do compositor)
provides:
  - prompt-composer.ts puro e sem IA com os 7 blocos canônicos travados (D19)
  - Um dado → um bloco; blocos vazios omitidos; sem deduplicação semântica
  - Prompt-base preservado verbatim em [INSTRUÇÕES DO PROMPT-BASE] (sem filtragem lexical)
  - Ausência de contexto experimental por ORIGEM (blocos gerados), sem bloco dedicado ao objetivo do experimento
  - COMPOSER_VERSION estática exportada como evidência (D20)
  - Suíte de contrato do compositor (12 testes verdes)
affects: [48-2-3-07 API/UI preflight, 48-2-3-08 verificação]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Compositor puro e determinístico: serializa blocos canônicos, omite vazios e preserva o prompt-base verbatim"
    - "Verificação de contexto experimental por ORIGEM (conteúdo gerado), nunca blacklist lexical sobre o prompt completo"

key-files:
  created:
    - src/lib/lab/bench/domain/prompt-composer.ts
    - src/lib/lab/bench/__tests__/prompt-composer.contract.test.ts
  modified: []

key-decisions:
  - "Blocos canônicos travados como constantes (PROMPT_BLOCK_LABELS/PROMPT_BLOCK_ORDER); COMPOSER_VERSION estática como evidência"
  - "composePromptBlocks devolve { text, blocks } (rótulo → conteúdo) para alimentar a evidência mínima do preflight (D20) sem nova tabela"
  - "Prompt-base incluído verbatim (sem trim nem sanitize) — sanitizePromptText só em campos estruturados (oferta do snapshot)"

patterns-established:
  - "Blocos vazios omitidos e um dado → um bloco (tipografia/preserveImageContext/cor sem duplicação)"
  - "Prova de origem: compor com prompt-base vazio isola os blocos gerados para a verificação de ausência de contexto experimental"

requirements-completed:
  - "cap: lab-bench-prompt-preflight"
  - "cap: lab-isolation"
  - "D17"
  - "D19"
  - "D20"
  - "D21"
  - "spec: lab-bench-prompt-preflight"
  - "spec: lab-isolation"
  - "tasks: 6.1, 6.2, 6.3, 6.8, 1.6"

# Metrics
duration: 5 min
completed: 2026-09-29
---

# Phase 48.2.3 Plan 06: Compositor determinístico de prompt e preflight

**Compositor puro e sem IA que serializa briefing experimental + snapshot fiel + prompt-base em 7 blocos canônicos travados, omite vazios, preserva o prompt-base verbatim e não introduz contexto experimental no conteúdo gerado (verificação por origem), com versão estática exportada e 12 testes de contrato verdes.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-09-29T18:56:00Z
- **Completed:** 2026-09-29T19:01:00Z
- **Tasks:** 3
- **Files modified:** 2 (2 criados, 0 alterados)

## Accomplishments
- `prompt-composer.ts` **puro e sem IA** (sem I/O, sem provider, sem variáveis de ambiente, sem client Supabase): `composePrompt`/`composePromptBlocks` recebem `{ briefing, snapshot, promptBase, references? }` e serializam os 7 blocos canônicos na ordem travada — `[IDENTIDADE E DIREÇÃO VISUAL]`, `[DIREÇÃO TIPOGRÁFICA]`, `[PRODUTO E IMAGENS DE REFERÊNCIA]`, `[CONDIÇÕES COMERCIAIS]`, `[INTENÇÃO E FORMATO]`, `[INSTRUÇÕES DO PROMPT-BASE]`, `[RESTRIÇÕES E TEXTOS OBRIGATÓRIOS]`.
- **Um dado → um bloco**: `typography_direction` só em `[DIREÇÃO TIPOGRÁFICA]`; `preserveImageContext` só em `[PRODUTO E IMAGENS DE REFERÊNCIA]`; preços/selo/validade em `[CONDIÇÕES COMERCIAIS]`; cor da marca só em `[IDENTIDADE E DIREÇÃO VISUAL]` — sem repetição deliberada. **Blocos vazios omitidos**; sem deduplicação semântica.
- **Prompt-base preservado integralmente** (verbatim) em `[INSTRUÇÕES DO PROMPT-BASE]`: nenhuma filtragem/reescrita lexical de palavras legítimas ("teste", "comparação", "avaliação").
- **Ausência de contexto experimental por origem**: os rótulos fixos e os templates dos blocos gerados não introduzem laboratório/experimento/baseline/comparação/avaliação, nem um bloco dedicado ao objetivo do experimento; a proibição não é blacklist lexical sobre o prompt completo.
- `COMPOSER_VERSION = "48.2.3-prompt-composer-v1"` exportada como evidência (D20); `composePromptBlocks` devolve `{ text, blocks }` para alimentar a evidência mínima do preflight sem nova tabela.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: compositor determinístico com blocos canônicos e versão estática** — `9b6bc6f0` (feat)
2. **Task 2: documenta garantia de origem e preservação integral do prompt-base** — `e1d8bffa` (docs)
3. **Task 3: testes de contrato do compositor** — `5df5a07d` (fix, auto-fix no escopo da task) → `c2c8cef9` (test)

**Plan metadata:** commit de SUMMARY (docs)

## Files Created/Modified
- `src/lib/lab/bench/domain/prompt-composer.ts` (novo) — compositor puro com os 7 blocos canônicos, `COMPOSER_VERSION` e preservação verbatim do prompt-base.
- `src/lib/lab/bench/__tests__/prompt-composer.contract.test.ts` (novo) — 12 testes: blocos/ordem, vazios omitidos, tipografia, `preserveImageContext`, prompt-base verbatim, ausência de contexto experimental por origem, determinismo, referências e pureza do módulo.

## Decisions Made
- Blocos canônicos modelados como constantes (`PROMPT_BLOCK_LABELS`, `PROMPT_BLOCK_ORDER`) para travar nomes/ordem (D19).
- `composePromptBlocks` retorna `{ text, blocks }` (rótulo → conteúdo, sem vazios) — habilita a evidência mínima do preflight (D20) no Plano 07 sem criar tabela de versões.
- `sanitizePromptText` aplicado **apenas** a campos estruturados (oferta do snapshot), nunca ao prompt-base, para não ferir a preservação integral.
- A entrada é um objeto único `{ briefing, snapshot, promptBase, references? }`, consumindo o briefing do Plano 05 como entrada canônica e o snapshot do Plano 04 para o texto da oferta.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Literal `process.env` no comentário do compositor tripava o teste de pureza**
- **Found during:** Task 3 (testes de contrato do compositor)
- **Issue:** O doc-comentário do módulo mencionava o token `process.env` ao descrever a pureza; a checagem de pureza do teste (fonte) o detectava como uso real.
- **Fix:** Reescrito para "variáveis de ambiente"; nenhuma mudança de comportamento.
- **Files modified:** `src/lib/lab/bench/domain/prompt-composer.ts`
- **Verification:** `npm run typecheck` exit 0; 12 testes verdes.
- **Committed in:** `5df5a07d` (Task 3)

### Observações de conformidade (não são falhas)

- **Task 1 (`tdd="true"`):** o arquivo de teste é entregável da **Task 3** (ownership de arquivos no plano), portanto a Task 1 não pôde ter um commit RED isolado; a implementação entrou como `feat` e a cobertura veio na Task 3 (`test`). O gate MVP+TDD não estava ativo (orquestrador não passou `MVP_MODE`/`TDD_MODE`).
- **Task 2:** a garantia de origem e a preservação do prompt-base já são **estruturalmente** asseguradas pela Task 1 (rótulos fixos + templates neutros + prompt-base verbatim). A Task 2 adicionou a documentação explícita dessa invariante na origem (comentários) e teve sua verificação automatizada aprovada. Sem delta funcional — por isso o commit é `docs`.

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Correção necessária apenas para manter a checagem de pureza verde; sem ampliação de escopo. Nenhuma dependência nova, nenhuma chamada de IA/rede, produção intocada.

## Issues Encountered
- Nenhum. `npm` (shim) neste shell não propagou `$LASTEXITCODE` de forma confiável; as verificações foram executadas com `npm.cmd` (exit code real), conforme orientado.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Compositor pronto para o Plano 07 (API/UI do preflight: compor → exibir → editar → aprovar → estimar/confirmar), com `composePromptBlocks` fornecendo blocos + texto para a evidência mínima (D20).
- `prompt_sent` = prompt aprovado será comprovado via adapter gravador no Plano 07 (aqui garantiu-se texto único estável e determinístico).
- Produção intocada: `git diff 5e75e1d7..HEAD` limitado aos 2 arquivos do plano; `art-director-briefing.ts`, `resolveStoreIdentity` e `BrandProfileSnapshot` sem alterações. `STATE.md`/`ROADMAP.md` não tocados (orquestrador é o dono).

---
*Phase: 48.2.3-fidelidade-experimental-bancada*
*Completed: 2026-09-29*

## Self-Check: PASSED

- Arquivos criados verificados em disco: `prompt-composer.ts`, `prompt-composer.contract.test.ts`, `48-2-3-06-SUMMARY.md`.
- Commits verificados no histórico: `9b6bc6f0`, `e1d8bffa`, `5df5a07d`, `c2c8cef9`.
- `npm run typecheck` exit 0; 12 testes do compositor verdes; `art-director-briefing.ts` não editado.
