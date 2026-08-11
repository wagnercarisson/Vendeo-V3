---
phase: 38.2-admin-custos-operacionais
plan: 15
subsystem: tracking
tags: [state, encoding, utf-8, mojibake, cp1252, progress-block, gap-closure]

# Dependency graph
requires:
  - phase: 38-2-admin-custos-operacionais
    provides: "STATE.md com mojibake CP1252 (dupla codificacao) + progress block de escopo de fase (1/0/15/12/0) — divergencias a corrigir"
  - phase: pre-fase (blob 275863c)
    provides: "STATE.md pre-fase UTF-8 limpo: total_phases 22 / completed_phases 19 / total_plans 99 / completed_plans 93 / percent 91 — referencia da convencao do progress"
provides:
  - ".planning/STATE.md 100% UTF-8 limpo (sem mojibake, sem BOM) preservando TODO o conteudo da F38.2 (725 linhas, secoes intactas)"
  - "Progress block consistente com o fechamento da fase: total_phases 22 / completed_phases 20 / total_plans 110 / completed_plans 104 / percent 91"
  - "Gligo de status F38.2 (Next Phases) reconstruido como circulo branco 'o' (era U+FFFD corrompido)"
affects: [38.2-admin-custos-operacionais 38-2-13, 38-2-14 (feature gap closure pendentes), fechamento/verificacao subsequente da fase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Recuperacao de mojibake CP1252 via walker char-a-char: grupos mojibake reconhecidos por byte de continuacao CP1252 (0x80-0xBF) apos leads C2/C3/E2/F0; chars limpos preservados como UTF-8 direto"
    - "Escrita final UTF-8 sem BOM (UTF8Encoding($false)); validacao byte-level (assinaturas C3 83/C3 A2/E2 82/C5 B8/C5 93) em vez de Select-String (console PS 5.1 manglia nao-ASCII)"
    - "Preservacao de conteudo provada por diff pre-edit vs pos-edit (apenas progress + last_updated mudaram) e contagem de linhas 725 == 725"

key-files:
  created: []
  modified:
    - ".planning/STATE.md"

key-decisions:
  - "Codepage real do mojibake e Windows-1252 (CP1252), nao ISO-8859-1 estrito: chars U+2014/U+20AC/U+0153/U+2020 etc. em M provam CP1252; GetEncoding(28591) lancaria excecao — walker usa CP1252 com fallback replacement e regra de continuacao 0x80-0xBF"
  - "Corrupcao unica do arquivo (U+FFFD no status F38.2) reconstruida como 'o' (U+25CB) por evidencia de bytes: mojibake 'a-<' (E2 97 8B) e o blob pre-fase tinham 'o Pending' — o executor manteve o glifo ao trocar Pending->Complete"
  - "Artefato U+FEFF (ZWNBSP) no inicio da decisao 38-2-12 removido (lixo de editor invisivel, nao conteudo)"
  - "Fallback do plano (restaurar blob 275863c + reaplicar manualmente) NAO usado: round-trip cirurgico preservou 100% do conteudo da fase (o fallback perderia o corpo da F38.2)"
  - "Handlers de estado do SDK (advance-plan/record-metric/add-decision/record-session/update-progress) NAO executados: readModifyWriteStateMd refaz o frontmatter a partir do disco (buildStateFrontmatter) e sobrescreveria os valores explicitos 22/20/110/104/91 — exatamente a divergencia que este plano corrige"
  - "ROADMAP/REQUIREMENTS nao tocados (must_have #3: nenhum outro arquivo de tracking alterado; ficam para o fechamento/verificacao subsequente)"

patterns-established:
  - "Pattern 1: progress do milestone nunca e derivado do escopo de fase — convencao: blob pre-fase + fechamento da fase (22/20/110/104/91); handlers SDK com resync de frontmatter sao contraindicados para STATE.md com progress block semantico"

requirements-completed: []

# Metrics
duration: 8min
completed: 2026-08-11
---

# Phase 38.2 Plan 15: STATE.md Tracking Fix (UTF-8 + Progress Block) Summary

**STATE.md re-encodado para UTF-8 limpo via round-trip CP1252 lossless preservando 100% do conteudo da F38.2 (725 linhas, secoes e decisoes intactas) + progress block recalculado para 22/20/110/104/91% — fase 38.2 fechada 11/11 no milestone v1.5**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-11T20:55:00Z (aprox.)
- **Completed:** 2026-08-11T21:03:56Z
- **Tasks:** 1
- **Files modified:** 1 (.planning/STATE.md)

## Accomplishments

- Re-encode lossless de `.planning/STATE.md` (63059 bytes -> 59648 bytes UTF-8 limpo): 1001 grupos mojibake CP1252 decodificados, 56979 chars limpos preservados, 0 U+FFFD remanescentes, sem BOM
- Progress block corrigido para a convencao das fases anteriores: total_phases 22 / completed_phases 20 / total_plans 110 / completed_plans 104 / percent 91 (round(20/22 x 100)); status mantido `executing` (milestone v1.5 em andamento)
- Corrupcao unica do arquivo reparada: glifo de status F38.2 (era `U+FFFD` irreversivel) reconstruido como circulo branco `o` por evidencia de bytes; artefato U+FEFF (ZWNBSP) removido
- Conteudo verificado: amostras (Configuracoes Economicas, CONCLUIDA, Lancamento Externo Controlado, em-dash, diamante, check, circulo, emoji) presentes; diff pre-edit vs pos-edit mostra APENAS last_updated + progress; 725 linhas antes/depois

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Re-encode UTF-8 limpo + progress block recalculado** - `33a269f` (fix)

**Plan metadata:** pendente (docs, este resumo)

## Files Created/Modified

- `.planning/STATE.md` - Re-encodado de mojibake CP1252 (dupla codificacao) para UTF-8 limpo sem BOM; frontmatter progress atualizado de `1/0/15/12/0` (escopo de fase) para `22/20/110/104/91` (convencao do milestone)

## Decisions Made

- **Codepage real do mojibake:** o plano especificava ISO-8859-1 (28591), mas a analise de bytes provou Windows-1252 (CP1252) — chars U+2014 (em-dash), U+20AC (euro), U+0153 (oe), U+2020 (dagger) presentes no mojibake so existem na tabela CP1252; `GetEncoding(28591)` lancaria excecao (ArgumentOutOfRange) nesses chars. Usado walker com CP1252 + fallback replacement e regra de continuacao 0x80-0xBF, preservando chars limpos genuinos (setas U+2192/U+2212 do executor 38-2-12, "Pagina" com acento limpo).
- **Conteudo misto:** o arquivo continha ilhas de texto limpo (adicoes do executor 38-2-12) entre o mojibake — o walker distingue grupos mojibake por assinatura de continuacao e deixa chars limpos intocados; provado por diff pre/post-edicao.
- **Glifo F38.2:** U+FFFD corrompido reconstruido como `o` (U+25CB) — mojibake correto `a-<` = bytes E2 97 8B; o blob pre-fase (275863c) mostrava `o Pending` para F38.2, e as linhas F37/F39 usam `o`.
- **Sem handlers SDK de estado:** `state.advance-plan` / `record-metric` / `add-decision` / `record-session` / `update-progress` refazem o frontmatter via `buildStateFrontmatter` (escaneia o disco — 15 plans/13 summaries da fase -> valores ~114/112/98) e sobrescreveriam o progress block explicito do plano. Executa-los reintroduziria a divergencia que o plano corrige. Estado do phase position ("Plan: 13 of 15") preservado — plans 13/14 pendentes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Codepage correta do mojibake: CP1252 em vez de ISO-8859-1**
- **Found during:** Task 1 (re-encode)
- **Issue:** O plano mandava decodificar com `GetEncoding(28591)` (Latin-1 estrito), mas o mojibake do arquivo e baseado em Windows-1252 — chars como U+2014/U+20AC em M nao sao encodeaveis em Latin-1 (excecao), e o round-trip Latin-1 perderia conteudo (emojis, em-dashes, setas)
- **Fix:** Walker char-a-char com CP1252: grupos mojibake (leads C2/C3/E2/F0 + continuacoes cujo byte CP1252 cai em 0x80-0xBF) decodificados para os bytes UTF-8 originais; chars limpos genuinos emitidos como UTF-8 direto
- **Files modified:** .planning/STATE.md (procedimento de escrita)
- **Verification:** 0 assinaturas mojibake combinadas; amostras limpas via Grep; diff pre/post-edicao = apenas progress+last_updated
- **Committed in:** 33a269f (Task 1)

**2. [Rule 1 - Bug] Glifo de status F38.2 irreversivelmente corrompido (U+FFFD)**
- **Found during:** Task 1 (re-encode)
- **Issue:** A linha `| **F38.2** | **a-� Complete** |` continha um U+FFFD literal (bytes EF BF BD) — o glifo original se perdeu na dupla codificacao; o round-trip puro nao o recuperaria
- **Fix:** Substituido U+FFFD por U+2039 (`<`) no mojibake, completando o grupo `a-<` = E2 97 8B = `o` (U+25CB, circulo branco) — consistente com F37/F39 e com o blob pre-fase (`o Pending`); U+FEFF artefato de editor removido na decisao 38-2-12
- **Files modified:** .planning/STATE.md
- **Verification:** Grep linha 647 mostra `| **F38.2** | **o Complete** |`; 0 U+FFFD no arquivo final
- **Committed in:** 33a269f (Task 1)

**3. [Rule 3 - Blocking] Handlers de estado do SDK pulados no close-out**
- **Found during:** Task 1 (apos o fix, no close-out)
- **Issue:** O close-out padrao (state.advance-plan, update-progress, record-metric, add-decision, record-session) passa por `readModifyWriteStateMd` que REFAZ o frontmatter a partir do disco (buildStateFrontmatter) — sobrescreveria os valores explicitos 22/20/110/104/91 (must_have #2) e normalizaria o corpo (normalizeMd), violando must_have #1 (preservar todo o conteudo)
- **Fix:** Nenhum handler SDK executado sobre STATE.md; valores do plano gravados manualmente; `roadmap update-plan-progress` NAO executado (must_have #3: nenhum outro arquivo de tracking alterado)
- **Files modified:** nenhum (decisao de nao-alterar)
- **Verification:** progress block final = 22/20/110/104/91 conforme o verify do plano
- **Committed in:** 33a269f (Task 1)

---

**Total deviations:** 3 auto-fixadas (1 bug, 2 blocking)
**Impact on plan:** Todas necessarias para fidelidade ao objetivo (UTF-8 limpo + progress correto). O fallback do plano (restaurar blob 275863c + reaplicar manualmente) foi avaliado e descartado por perder o corpo da F38.2 — o round-trip cirurgico preservou 100% do conteudo.

## Issues Encountered

- Console PowerShell 5.1 manglia nao-ASCII em comandos inline (parser error em literais acentuados) — validacoes feitas byte-level (assinaturas hex) e via Grep tool, que lida com UTF-8 corretamente
- O arquivo nao era mojibake puro: conteudo misto com ilhas limpas do executor 38-2-12 (setas U+2192/U+2212, "Pagina" com acento, artefato U+FEFF) — exigiu walker com discriminacao por continuacao CP1252 em vez de round-trip unico
- Todas as versoes de STATE.md no git da F38.2 estao corrompidas (fd71371 ja tem mojibake) — nao havia base limpa recente para restaurar; round-trip era o unico caminho para preservar o conteudo

## User Setup Required

None - nenhuma configuracao externa requerida (arquivo de tracking apenas).

## Next Phase Readiness

- STATE.md volta a ser a fonte de posicao legivel (UTF-8 limpo) para as proximas fases — milestone v1.5 refletido corretamente (20/22 fases, 104/110 plans, 91%)
- Plans 38-2-13 (service deriveBrl com creditosLiquidos) e 38-2-14 (UI KpisGrid) da gap closure da F38.2 ainda pendentes — posicao "Plan: 13 of 15" preservada
- Fechamento/verificacao subsequente da fase pode tocar ROADMAP/PROJECT/REQUIREMENTS (fora do escopo deste plano, por must_have #3)

---
*Phase: 38.2-admin-custos-operacionais*
*Completed: 2026-08-11*
