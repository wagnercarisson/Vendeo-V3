---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: — Lançamento Externo Controlado ◆
status: complete
last_updated: "2026-09-28T19:51:12.916Z"
progress:
  total_phases: 39
  completed_phases: 34
  total_plans: 309
  completed_plans: 295
  percent: 87
---

# Project State

## Project Reference

- Project: `.planning/PROJECT.md`.
- Core value: transformar uma oferta simples em uma campanha profissional, clara e publicável.
- Foco atual: F48.2.2 — **Fundação da bancada de geração no Admin/Laboratório** (**em execução** desde 2026-09-28; 8 planos; `48-2-2-01` concluído com CHECKPOINT 1 aprovado; próxima ação é executar `48-2-2-02`).
- Fase anterior: F48.2.1 — **Bancada Manual de Prompts do Diretor** (CONCLUÍDA, VERIFICADA, SINCRONIZADA e ARQUIVADA).
- Próxima fase: **F48.2.3 — Experimento determinístico Oferta 1:1** (depende da bancada validada na F48.2.2).
- Próxima iniciativa condicionada: F50.1 aguardando constituição da PJ.

## Current Position

Phase: 48.2.2 (Fundação da bancada de geração no Admin/Laboratório) — **IN PROGRESS** (8 planos; 1 executado — `48-2-2-01` concluído com CHECKPOINT 1 aprovado)
Plans: `48-2-2-01` .. `48-2-2-08` — **criados em 2026-09-28**; `48-2-2-01` **executado/summarized** (CHECKPOINT 1 aprovado após correção do spike); `48-2-2-02`..`48-2-2-08` pendentes.
Checkpoints humanos: **CP1 aprovado** (spike de modelos/presets, plano 01; 4 presets propostos, todos desabilitados até o CP2), **CP2** (aprovação dos presets antes de qualquer geração paga, plano 04), **CP3** (UAT local, plano 08). Nenhuma task executa chamada paga autonomamente.
Próxima ação: **executar `48-2-2-02`** (persistência local-first) e, em sequência, `48-2-2-03`..`48-2-2-08`; depois, **F48.2.3 — Experimento determinístico Oferta 1:1**.
Fase anterior: 48.2.1 (Bancada Manual de Prompts do Diretor) — **COMPLETE**; chain `48-2-1-05 → 48-2-1-07 → 48-2-1-08 → 48-2-1-09`.

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

## F48.2.2 — Inventário da fase (mecânico)

- **Planejados (8):** `48-2-2-01` .. `48-2-2-08` (criados em 2026-09-28). **Executado/summarized (1):** `48-2-2-01` (CHECKPOINT 1 aprovado após correção do spike; nenhuma chamada paga; base SHA `50ae6007`).
- **Fonte da verdade:** `openspec/changes/fase-48-2-2-fundacao-bancada-geracao/` (proposal / design D1–D17 / tasks 1–8 / 8 specs), corrigida no commit `388db445` e refletida nos planos.
- **Artefatos de planejamento:** `48.2.2-CONTEXT.md`, `48.2.2-UI-SPEC.md`, `48-2-2-PATTERNS.md` + 8 `PLAN.md`; verificados por `gsd-plan-checker` (**VERIFICATION PASSED**).
- **Checkpoints:** **CP1 aprovado** (spike, plano 01 — `gpt-image-2` e `gpt-image-2.5-flare` confirmados pela documentação oficial; 4 presets propostos, todos desabilitados com `reason: spike_pendente`), CP2 (aprovação dos presets antes de geração paga, plano 04), CP3 (UAT local, plano 08).
- **Ondas:** cadeia sequencial `48-2-2-01 → 02 → 03 → 04 → 05 → 06 → 07 → 08` (o plano 04 depende também do 01).

## Global (mecânico — `gsd-sdk query progress`)

- `total_phases: 39` / `completed_phases: 34`; `total_plans: 309`; `completed_plans (summaries): 295`; `percent: 87` (frontmatter recalculado pelo SDK em 2026-09-28).

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
- **Planejamento F48.2.2 (2026-09-28):** base OpenSpec corrigida (`388db445`) — allowlist própria `BENCH_MODEL_ALLOWLIST` (sem tocar `MODEL_ALLOWLIST`); ciclo `draft → pending` (slot global só na confirmação); signer local restrito de branding (`createBenchBrandingSignedUrl`); custo local por `modelo + qualidade + tamanho`, com pricing **somente em código** (`bench-pricing.ts`, sem tabela); `assertBenchTestStore` em toda entrada. 8 planos criados; spike bloqueante no plano 01; aprovação humana antes de geração paga (CP2). `gsd-plan-checker` = VERIFICATION PASSED.
- **Execução F48.2.2 — plano `48-2-2-01` (2026-09-28):** **CHECKPOINT 1 aprovado** após correção dirigida por humano do spike (commit `d77d40ca`) — `gpt-image-2` e `gpt-image-2.5-flare` **confirmados pela documentação oficial**; **4 presets propostos** (`gpt-image-2-low`/`gpt-image-2-medium`/`gpt-image-2.5-flare-low`/`gpt-image-2.5-flare-medium`), **todos desabilitados** (`spike_pendente`) até o CP2 (plano 04); `account_availability_pending` a comprovar no UAT autorizado (plano 08); **nenhuma chamada paga executada**. Entregues: bounded context `src/lib/lab/bench/**`, registry de dimensões (primeiro recorte), `BENCH_MODEL_ALLOWLIST`, registry de presets e contratos de isolamento read-only (typecheck + 48 testes verdes). F48.2.2 antiga (Revisor) permanece descartada/substituída.

## Pending Todos

- **Executar a F48.2.2 — Fundação da bancada de geração no Admin/Laboratório** (**em execução**; `48-2-2-01` concluído — CHECKPOINT 1 aprovado; próxima ação: `48-2-2-02`).
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

- Última sessão: 2026-09-28 — execução do plano `48-2-2-01` (fundação da bancada) e aprovação do **CHECKPOINT 1** após correção dirigida por humano do spike.
- Último trabalho: plano `48-2-2-01` **concluído** (bounded context + registry de dimensões + `BENCH_MODEL_ALLOWLIST` + presets desabilitados + isolamento read-only; typecheck + 48 testes verdes; CHECKPOINT 1 aprovado; **nenhuma chamada paga**); commits `a0e7832e`, `77ef5330` e `d77d40ca`.
- Próximo trabalho: **executar `48-2-2-02`** (persistência local-first) e a sequência até `48-2-2-08` (CP2 no plano 04; CP3 no plano 08); depois, F48.2.3 — Experimento determinístico Oferta 1:1. Sessões manuais de teste dos prompts do Diretor seguem em paralelo, com novo programa e nova autorização humana antes de qualquer chamada paga.
- Resume file: `None` (plano `48-2-2-01` concluído; próxima ação é executar `48-2-2-02`).
