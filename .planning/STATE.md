---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: "— Lançamento Externo Controlado ◆"
status: complete
last_updated: "2026-09-27T14:39:26.603Z"
progress:
  total_plans: 300
  completed_plans: 294
  percent: 98
---

# Project State

## Project Reference

- Project: `.planning/PROJECT.md`.
- Core value: transformar uma oferta simples em uma campanha profissional, clara e publicável.
- Foco atual: F48.2.1 — **Bancada Manual de Prompts do Diretor** (CONCLUÍDA).
- Próxima iniciativa condicionada: F50.1 aguardando constituição da PJ.

## Current Position

Phase: 48.2.1 (Bancada Manual de Prompts do Diretor) — **COMPLETE**
Plan: `48-2-1-09` — **concluído** (último plano da fase)
Chain (concluída): `48-2-1-05 → 48-2-1-07 → 48-2-1-08 → 48-2-1-09`

- F48.2.1 realinhada (OpenSpec `017b8799`) e **concluída**: bancada manual dos prompts do Diretor.
- Todos os planos resolvidos; programa local `closed` e experimento `archived`, com recusas fail-closed confirmadas e histórico preservado.
- **Zero runs e zero custo**; `prompts/` intocado; sem promoção/canário/`db push`.
- Próximo passo (pendente de confirmação humana): verificação/arquivamento OpenSpec (`openspec-verify-change` → `openspec-archive-change`).

## F48.2.1 — Inventário da fase (mecânico)

- **Concluídos (8):** `48-2-1-01` .. `48-2-1-05`, `48-2-1-07`, `48-2-1-08`, `48-2-1-09`.
- **Suplantado/resolvido (1):** `48-2-1-06` — interrompido na Task 4 (Checkpoint 3); resolvido via `48-2-1-06-SUMMARY.md` (supersessão); fora da cadeia executável.
- `verify.phase-completeness 48.2.1`: `complete: true`, `plan_count 9`, `summary_count 9`, `incomplete_plans []`.

## Global (mecânico — `gsd-sdk query progress`)

- `total_plans: 300`; `completed_plans (summaries): 294`; `percent: 98`.

## Accumulated Context — Decisions

- F48.2.1 realinhada (OpenSpec `017b8799`): entrega exclusivamente a **bancada manual** dos prompts do Diretor (`offer`/`spotlight`/`exclusive`).
- Diagnóstico versionado v1/v2/v3 preservado como evidência histórica; regra de vitória **consultiva**; rascunho `offer/v1` apenas como exemplo (não aprovado, não vencedor).
- Checkpoint 1 aprovado (`matrix-v1` + `diagnosticVersion 3`); Checkpoint 2 aprovado (`autorizar-inicial`, US$ 2.808).
- Contrato de autorização: `status='closed'` = encerrado com autorização revogada; somente `authorized` reserva; `closed` terminal; nova sessão exige novo programa; histórico preservado.
- Plano `48-2-1-07`: reserva fail-closed por `status='authorized'`; `closed` terminal (serviço + trigger); reautorização recusada; UI de encerramento.
- Plano `48-2-1-08`: orçamento completo visível + `BudgetPanel` integrado + `programRemainingUsd` propagado; arquivamento seguro (domínio + `PATCH` + UI) terminal.
- Plano `48-2-1-09`: validação automática + UAT sem execução paga; **decisão humana `aprovar-encerramento`**; programa `860ca4fe-…` `closed` e experimento `c48e21b5-…` `archived`, com histórico preservado.
- Correção test-only autorizada (fora do escopo F48.2.1) do date-bomb preexistente em `use-campaign-form-validity.test.ts` (freeze de relógio), restaurando a suíte com apenas a exceção F50.

## Pending Todos

- Verificação e arquivamento OpenSpec da change F48.2.1 (pendente de confirmação humana).
- Exceção preexistente F50 (`src/lib/legal/__tests__/legal-document-versions.test.ts`, `ENOENT`) é falha externa à F48.2.1; registrada como follow-up.

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

- Última sessão: 2026-09-27 — encerramento operacional da F48.2.1 (Plano 48-2-1-09).
- Último trabalho: programa `closed` + experimento `archived` (decisão humana `aprovar-encerramento`); `48-2-1-VERIFICATION.md`, `48.2.1-UAT.md` e `48-2-1-09-SUMMARY.md` gerados.
- Próximo passo (após aprovação humana): verificação/arquivamento OpenSpec da change F48.2.1.
- Resume file: `None` (fase concluída; sem trabalho pausado).
