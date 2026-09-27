---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: — Lançamento Externo Controlado ◆
status: paused
last_updated: "2026-09-27T00:09:47.137Z"
progress:
  total_plans: 300
  completed_plans: 292
  percent: 97
---

# Project State

## Project Reference

- Project: `.planning/PROJECT.md`.
- Core value: transformar uma oferta simples em uma campanha profissional, clara e publicável.
- Foco atual: F48.2.1 — **Bancada Manual de Prompts do Diretor** (pausada após realinhamento).
- Próxima iniciativa condicionada: F50.1 aguardando constituição da PJ.

## Current Position

Phase: 48.2.1 (Bancada Manual de Prompts do Diretor) — **PAUSED** (pós-realinhamento)
Plan: `48-2-1-08` — próximo (não iniciado)
Chain: `48-2-1-05 → 48-2-1-07 → 48-2-1-08 → 48-2-1-09`

- F48.2.1 pausada e replanejada (OpenSpec `017b8799`).
- Plano `48-2-1-07` **concluído** (commits `66011f89`, `5a55882f`, `2949b8d1`); migration aplicada via `npx supabase migration up` (registros locais preservados).
- Próximo comando (somente após aprovação humana): `/gsd-execute-phase 48-2-1-08`.
- **NÃO** usar `/gsd-resume-work` apontando ao Plano 06 (interrompido/suplantado).

## F48.2.1 — Inventário da fase (mecânico)

- **Concluídos (6):** `48-2-1-01` .. `48-2-1-05`, `48-2-1-07`.
- **Suplantado/resolvido (1):** `48-2-1-06` — interrompido na Task 4 (Checkpoint humano 3) após as Tasks 1–3; resolvido via `48-2-1-06-SUMMARY.md` (supersessão); **não concluído funcionalmente**; fora da cadeia executável.
- **Pendentes (2):** `48-2-1-08` (orçamento visível/arquivamento seguro), `48-2-1-09` (verificação/UAT/encerramento operacional).
- `verify.phase-completeness 48.2.1`: `plan_count 9`, `summary_count 7`, `incomplete_plans [48-2-1-08, 48-2-1-09]`.

## Global (mecânico — `gsd-sdk query progress`)

- `total_plans: 300`; `completed_plans (summaries): 292`; `percent: 97`.

## Accumulated Context — Decisions

- F48.2.1 realinhada (OpenSpec `017b8799`): entrega exclusivamente a **bancada manual** dos prompts do Diretor (`offer`/`spotlight`/`exclusive`).
- Diagnóstico versionado v1/v2/v3 preservado como evidência histórica; regra de vitória **consultiva**; rascunho `offer/v1` apenas como exemplo (não aprovado, não vencedor).
- Checkpoint 1 aprovado (`matrix-v1` + `diagnosticVersion 3`, hash `1e1c7945…d3bf`).
- Checkpoint 2 aprovado (`autorizar-inicial`): `budget_usd` = US$ 2.808; pior caso NÃO autorizado.
- Contrato de autorização: `status='closed'` = encerrado com autorização revogada; somente `authorized` reserva; `closed` é terminal; nova sessão exige novo programa; histórico preservado.
- **Zero runs e zero custo**; programa `860ca4fe-…` ainda `authorized` e experimento `c48e21b5-…` ainda `ready` até as ações controladas do Plano 09.
- Primeira operação real paga será **posterior**, com novo programa e nova autorização humana.
- Plano `48-2-1-07` concluído: reserva fail-closed por `status='authorized'`; `closed` terminal em serviço + trigger no banco; histórico financeiro preservado; UI de encerramento ("Encerrar programa / revogar autorização") com confirmação humana. Migration local via `npx supabase migration up` (sem `db reset`/`db push`).

## Pending Todos

- Executar o Plano `48-2-1-08` **somente após aprovação humana**.
- Teste legal F50 (`src/lib/legal/__tests__/legal-document-versions.test.ts`, `ENOENT`) é falha **preexistente externa** à F48.2.1; o gate fail-closed do Plano 09 aceita somente essa exceção exata.

## Blockers/Concerns

- Constituição da PJ é dependência externa da futura F50.1 (não é pendência da F48.2.1).

## Deferred Items

| Initiative | Status |
|---|---|
| F50.1 Formalização Legal e Ativação da Demonstração | Futura, aguardando PJ |
| Stripe/monetização pública | Diferida para v1.7+, fora da numeração |

## Quick Tasks Completed

| ID | Date | Summary |
|---|---|---|
| 260924-jv4 | 2026-09-24 | Compactação de STATE e archive integral |
| 260924-jl2 | 2026-09-24 | Compactação de AGENTS.md |
| 260924-il3 | 2026-09-24 | Alinhamento documental F50/F50.1 |
| 260924-i6l | 2026-09-24 | Reconciliação documental e operacional F50 |
| 260919-hju | 2026-09-19 | Ajuste acessível de Tom de Voz |

## Session Continuity

- Última sessão: 2026-09-26 — execução do Plano `48-2-1-07` (segurança financeira/revogação fail-closed).
- Último trabalho: Plano `48-2-1-07` concluído (commits `66011f89`, `5a55882f`, `2949b8d1`); migration `20260926000001` aplicada localmente preservando os registros.
- Próximo passo (após aprovação humana): `/gsd-execute-phase 48-2-1-08`.
- Resume file: `.planning/phases/48.2.1-otimizacao-prompts-diretor/.continue-here.md`.
