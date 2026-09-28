---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: "— Lançamento Externo Controlado ◆"
status: complete
last_updated: "2026-09-28T00:00:00.000Z"
progress:
  total_plans: 300
  completed_plans: 294
  percent: 98
---

# Project State

## Project Reference

- Project: `.planning/PROJECT.md`.
- Core value: transformar uma oferta simples em uma campanha profissional, clara e publicável.
- Foco atual: F48.2.1 — **Bancada Manual de Prompts do Diretor** (CONCLUÍDA, VERIFICADA, SINCRONIZADA e ARQUIVADA).
- Próxima fase: **F48.2.2 — Fundação da bancada de geração no Admin/Laboratório** (não iniciada; próxima ação é **planejar**).
- Próxima iniciativa condicionada: F50.1 aguardando constituição da PJ.

## Current Position

Phase: 48.2.1 (Bancada Manual de Prompts do Diretor) — **COMPLETE**
Plan: `48-2-1-09` — **concluído** (último plano da fase)
Chain (concluída): `48-2-1-05 → 48-2-1-07 → 48-2-1-08 → 48-2-1-09`
Próxima fase: **48.2.2 (nova) — Fundação da bancada de geração no Admin/Laboratório** — **não iniciada**; próxima ação registrada é **planejar a F48.2.2**. Depois: **48.2.3 — Experimento determinístico Oferta 1:1**.

- F48.2.1 realinhada (OpenSpec `017b8799`) e **concluída**: bancada manual dos prompts do Diretor.
- Todos os planos resolvidos; programa local `closed` e experimento `archived`, com recusas fail-closed confirmadas e histórico preservado.
- **Zero runs e zero custo**; `prompts/` intocado; sem promoção/canário/`db push`.
- OpenSpec **verificado, sincronizado e arquivado** em `openspec/changes/archive/2026-09-27-fase-48-2-1-otimizacao-prompts-diretor/` (commit `f55bed45`).
- **Realinhamento de tracking (2026-09-28):** a F48.2.2 antiga (**Auditoria e Otimização do Prompt do Revisor**) foi **descartada/substituída** pela nova direção, **sem artefatos mantidos** (implementação não iniciada; recuperável pelo histórico do Git). A change antiga **saiu** da lista de changes ativas do OpenSpec.
- **Nova sequência:** **F48.2.2 — Fundação da bancada de geração no Admin/Laboratório** → **F48.2.3 — Experimento determinístico Oferta 1:1**. A F48.2.2 é a próxima fase a planejar; a F48.2.3 depende da bancada validada na F48.2.2.
- Próximo trabalho: **planejar a F48.2.2 (nova)**; as sessões manuais de teste dos prompts do Diretor (`offer`/`spotlight`/`exclusive`) seguem como trabalho conduzido pelo usuário e pelo assistente, e qualquer operação real paga exige **novo programa** e **nova autorização humana explícita**.

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
- **Realinhamento F48.2.2 (2026-09-28):** a direção da F48.2.2 mudou de "Auditoria e Otimização do Prompt do Revisor" para "**Fundação da bancada de geração no Admin/Laboratório**" (gerações reais e mensuráveis, isoladas da produção, acesso restrito, loja real, branding persistido como fonte de verdade, prompt manual, seleção de modelo/qualidade, registro de evidência técnica e financeira). A F48.2.2 antiga foi **descartada/substituída**, sem artefatos mantidos (implementação não iniciada; recuperável pelo histórico do Git); a F48.2.3 passa a ser "**Experimento determinístico Oferta 1:1**". Backlog posterior (fora das duas fases): Destaque, Exclusivo, outros formatos, temas recorrentes, carrossel, comparação cega/lado a lado, avaliação automática, mobile e promoção de modelos/pipelines para produção. Regra: a identidade persistida da loja é a **fonte de verdade**; a criatividade do modelo fica restrita à composição específica da campanha (sem novo "diretor criativo" redefinindo tipografia/cores/posicionamento).

## Pending Todos

- **Planejar a F48.2.2 (nova) — Fundação da bancada de geração no Admin/Laboratório** (próxima ação registrada).
- F48.2.3 — Experimento determinístico Oferta 1:1 — não iniciada; depende da bancada validada na F48.2.2.
- Sessões manuais de teste dos prompts do Diretor (`offer`/`spotlight`/`exclusive`), conduzidas pelo usuário e pelo assistente; qualquer operação real paga exige novo programa e nova autorização humana explícita.
- F48.2.2 antiga (Auditoria e Otimização do Prompt do Revisor) — **descartada/substituída**; implementação não iniciada; sem artefatos mantidos (recuperável pelo histórico do Git).
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

- Última sessão: 2026-09-28 — realinhamento de tracking da F48.2.2 (mudança de direção; suspensão da change antiga do Revisor).
- Último trabalho: F48.2.2 antiga (Auditoria e Otimização do Prompt do Revisor) descartada/substituída (sem artefatos mantidos; implementação não iniciada; recuperável pelo histórico do Git); tracking (STATE/ROADMAP/HANDOFF/alinhamento) realinhado para a nova sequência **F48.2.2 → F48.2.3**; `openspec list` sem changes ativas.
- Próximo trabalho: **planejar a F48.2.2 (nova) — Fundação da bancada de geração no Admin/Laboratório**; depois, F48.2.3 — Experimento determinístico Oferta 1:1. Sessões manuais de teste dos prompts do Diretor seguem em paralelo, com novo programa e nova autorização humana antes de qualquer chamada paga.
- Resume file: `None` (sem trabalho pausado; próxima ação é planejamento).
