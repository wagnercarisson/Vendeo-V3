---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: â€” LanÃ§amento Externo Controlado â—†
status: planned
last_updated: "2026-09-25T20:43:00.844Z"
progress:
  total_phases: 38
  completed_phases: 33
  total_plans: 301
  completed_plans: 289
  percent: 96
---

# Project State

## Project Reference

- Project: `.planning/PROJECT.md`.
- Core value: transformar uma oferta simples em uma campanha profissional, clara e publicável.
- Foco atual: F48.2.1 planejada (proxima execucao); F50 concluida.
- Proxima iniciativa condicionada: F50.1 aguardando constituicao da PJ.

## Current Position

Phase: 48.2.1 (otimizacao-prompts-diretor) — EXECUTING
Plan: 6 of 9

- F50 concluida; 17/17 planos e 17/17 summaries em 10 waves.
- OpenSpec arquivado; nenhuma execucao ativa; beta fechado preservado.
- Ultima atividade real: compactacao do estado no quick `260924-jv4` em 2026-09-24.
- `155/167` e `93%` sao contadores globais (9 planos planejados em F48.2.1), nao pendencias da F50.

- F48.2.1 (Otimizacao dos Prompts do Diretor) esta **em execucao**: 9 planos `48-2-1-01..09` (waves 1-9) em `.planning/phases/48.2.1-otimizacao-prompts-diretor/`; local-only, sem promocao. Planos `48-2-1-01` (migration aditiva + dominio + orcamento atomico), `48-2-1-02` (diagnostico versionado v1/v2/v3 + matriz de nove cenarios + Checkpoint 1 aprovado), `48-2-1-03` (execucao do Diretor por intent + exatamente uma chamada `campaign_image` + settle/release do orcamento), `48-2-1-04` (avaliacao humana: rubrica de nove criterios obrigatoria, append-only, comparacao cega sem scoring) e `48-2-1-05` (API/UI administrativa, orcamento e isolamento + Checkpoint 2 autorizado em US$ 2.808) concluidos; proximo `48-2-1-06`.

## Recently Completed

- F48.1: `.planning/phases/48.1-laboratorio-ia-minimo/`.
- F49: `.planning/phases/49-ativacao-orientacao-contextual-campos/`.
- F50: `.planning/phases/50-demonstracao-gratuita-validade-creditos/`.

## Performance Metrics

- Total de planos concluidos conhecido: 156/167 global (9 planejados em F48.2.1); F50: 17/17.

| Phase | Plans | Duration | Tests |
|---|---:|---:|---|
| F48.2.1 | 4/9 | 66 min | 797 lab verdes |
| F50 | 17/17 | N/A | N/A |
| F49 | 15/15 | N/A | N/A |
| F48.1 | 14/14 | N/A | N/A |

## Accumulated Context

### Decisions

- F50 concluida em beta fechado.
- Demonstracao, e-mail e signup publico continuam desativados.
- Escopo juridico, publicacao e cutover foi transferido para F50.1 apos a PJ.
- Stripe/monetizacao publica permanece iniciativa diferida.
- F48.2.1: orcamento reservado atomicamente dentro de `lab_reserve_run` (9 args) com lock do programa; settle/release idempotentes por `budget_settled_at`.
- F48.2.1: assinaturas F48.1 antigas (8 args de `lab_reserve_run`, 12 args de `lab_create_experiment`) removidas a frente para impedir overload que contorne programa/intent.
- F48.2.1: Checkpoint 1 aprovado (`matrix-v1` + `diagnosticVersion 3`, hash `1e1c7945...d3bf`). Diagnostico versionado em JSON no repo (v1/v2/v3 imutaveis, hash SHA-256 nao autorreferente, `kind` observed_failure/hypothesis/taxonomy com rastreabilidade por item) e matriz de nove cenarios (3 offer + 3 spotlight + 3 exclusive, 1:1/pt-BR).
- F48.2.1: prompt do Diretor resolvido server-side por `DIRECTOR_PROMPTS[campaign_intent]`; intents mistos/ausentes recusados com `intent_mismatch` (HTTP 400) antes de qualquer chamada paga; variante fora do intent recusada com `unsupported_prompt_under_test`.
- F48.2.1: exatamente uma chamada `campaign_image` por run (sem fallback e sem Revisor); liquidacao do orcamento apos `finalizeLabRun` — settle consome o efetivo/estimado, release libera sem consumir quando a falha precede a chamada paga (idempotente e best-effort).
- Historico completo esta em `STATE-ARCHIVE.md`, roadmaps e artefatos das fases.
- [Phase 48.2.1]: F48.2.1: rubrica humana de nove criterios (estado + observacao) obrigatoria em avaliacoes novas, persistida append-only em lab_human_evaluations.rubric; sem scoring automatico — D7; schema tipado em rubric.ts substitui o rubric generico do plano 01
- [Phase 48.2.1]: F48.2.1: Checkpoint 2 = autorizar-inicial. Teto autorizado em lab_prompt_programs (matrix-v1): budget_usd = US$ 2.808 (36 runs iniciais: 3 prompts x 12 x estimativa 2.340 x margem 1.2). Pior caso (108 runs = US$ 8.424) NAO autorizado; cada ciclo v2/v3 exige autorizacao humana renovada (orcamento incremental).
- [Phase 48.2.1]: F48.2.1: prompt sob teste derivado de DIRECTOR_PROMPTS[campaignIntent] (nunca campo do payload); programId obrigatorio; estimativa cenarios x 2 variantes x repeticoes; saldo = budget_usd - consumed - reserved.
- [Phase 48.2.1]: F48.2.1: valores monetarios exibidos na UI com 2 casas (US$ 2.81 / US$ 8.42) via src/lib/lab/display-format.ts; calculos internos mantem 6 casas (margem/formula inalteradas); separador decimal mantido em ".".

### Pending Todos

- Fonte: `.planning/todos/pending/`; nenhum item ativo confirmado.
- F48.2.1 em execucao: proximo plano `48-2-1-06` (ciclo do Diretor `offer`). Checkpoint 2 resolvido (autorizar-inicial US$ 2.808); o pior caso (US$ 8.424) permanece NAO autorizado — cada ciclo v2/v3 exige nova autorizacao humana antes das chamadas pagas.

### Blockers/Concerns

- Constituicao da PJ e dependencia externa da futura F50.1, nao pendencia da F50.

## Deferred Items

| Initiative | Status |
|---|---|
| F50.1 Formalizacao Legal e Ativacao da Demonstracao | Futura, aguardando PJ |
| Stripe/monetizacao publica | Diferida para v1.7+, fora da numeracao |

## Quick Tasks Completed

| ID | Date | Summary |
|---|---|---|
| 260924-jv4 | 2026-09-24 | Compactacao de STATE e archive integral |
| 260924-jl2 | 2026-09-24 | Compactacao de AGENTS.md |
| 260924-il3 | 2026-09-24 | Alinhamento documental F50/F50.1 |
| 260924-i6l | 2026-09-24 | Reconcilicao documental e operacional F50 |
| 260919-hju | 2026-09-19 | Ajuste acessivel de Tom de Voz |

## Session Continuity

- Ultima sessao: 2026-09-25, execucao do plano 48-2-1-05 (API, UI, orcamento e isolamento + Checkpoint 2).
- Ultimo trabalho concluido: `48-2-1-05` (API/UI administrativa com intent->prompt, programa obrigatorio, estimativa cenarios x 2 variantes x repeticoes com saldo, endpoints de programa, guardas de isolamento, roteiro de UAT local e Checkpoint 2 autorizado em US$ 2.808); 8 commits (`32618ddc`, `6ea934e8`, `c49d9b49`, `de13580f`, `6eb63047`, `fba87ef9`, `490a5e83`, `c599d410`) + persistencia local do orcamento.
- Proximo passo: executar o plano `48-2-1-06` (ciclo do Diretor `offer`); o pior caso de orcamento (US$ 8.424) NAO esta autorizado — nova autorizacao humana e obrigatoria antes de cada ciclo v2/v3. F50.1 permanece futura aguardando a constituicao da PJ.
- Resume file: `None`.
