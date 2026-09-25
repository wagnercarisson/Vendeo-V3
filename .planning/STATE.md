---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: â€” LanÃ§amento Externo Controlado â—†
status: planned
last_updated: "2026-09-25T20:25:42.399Z"
progress:
  total_phases: 38
  completed_phases: 33
  total_plans: 301
  completed_plans: 288
  percent: 87
---

# Project State

## Project Reference

- Project: `.planning/PROJECT.md`.
- Core value: transformar uma oferta simples em uma campanha profissional, clara e publicável.
- Foco atual: F48.2.1 planejada (proxima execucao); F50 concluida.
- Proxima iniciativa condicionada: F50.1 aguardando constituicao da PJ.

## Current Position

Phase: 48.2.1 (otimizacao-prompts-diretor) — EXECUTING
Plan: 4 of 9

- F50 concluida; 17/17 planos e 17/17 summaries em 10 waves.
- OpenSpec arquivado; nenhuma execucao ativa; beta fechado preservado.
- Ultima atividade real: compactacao do estado no quick `260924-jv4` em 2026-09-24.
- `155/167` e `93%` sao contadores globais (9 planos planejados em F48.2.1), nao pendencias da F50.

- F48.2.1 (Otimizacao dos Prompts do Diretor) esta **em execucao**: 9 planos `48-2-1-01..09` (waves 1-9) em `.planning/phases/48.2.1-otimizacao-prompts-diretor/`; local-only, sem promocao. Planos `48-2-1-01` (migration aditiva + dominio + orcamento atomico), `48-2-1-02` (diagnostico versionado v1/v2/v3 + matriz de nove cenarios + Checkpoint 1 aprovado) e `48-2-1-03` (execucao do Diretor por intent + exatamente uma chamada `campaign_image` + settle/release do orcamento) concluidos; proximo `48-2-1-04`.

## Recently Completed

- F48.1: `.planning/phases/48.1-laboratorio-ia-minimo/`.
- F49: `.planning/phases/49-ativacao-orientacao-contextual-campos/`.
- F50: `.planning/phases/50-demonstracao-gratuita-validade-creditos/`.

## Performance Metrics

- Total de planos concluidos conhecido: 156/167 global (9 planejados em F48.2.1); F50: 17/17.

| Phase | Plans | Duration | Tests |
|---|---:|---:|---|
| F48.2.1 | 3/9 | 52 min | 660 lab verdes |
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

### Pending Todos

- Fonte: `.planning/todos/pending/`; nenhum item ativo confirmado.
- F48.2.1 em execucao: proximo plano `48-2-1-04`; Checkpoint 2 (autorizacao de orcamento) permanece pendente antes de qualquer chamada paga.

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

- Ultima sessao: 2026-09-25, execucao do plano 48-2-1-03.
- Ultimo trabalho concluido: `48-2-1-03` (execucao do Diretor por intent + exatamente uma chamada `campaign_image` + settle/release do orcamento); 4 commits atomicos (`c00be91d`, `5d1992c2`, `60aeb738`, `23f6f8b0`).
- Proximo passo: executar o plano `48-2-1-04` da F48.2.1 (avaliacao humana, rubrica e cega); F50.1 permanece futura aguardando a constituicao da PJ.
- Resume file: `None`.
