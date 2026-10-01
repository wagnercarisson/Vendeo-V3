---
phase: 48.2.5-estabilizacao-experimental-oferta-1-1
plan: 48-2-5-04
subsystem: lab-bench-api
tags: [text-integrity, compose, runs, preflight]
requires:
  - phase: 48.2.5-estabilizacao-experimental-oferta-1-1
    provides: Versioned detector and canonical free-text fields from Plan 03
provides:
  - Strict temporary text-integrity evidence for no_alerts/keep_exactly
  - Fail-closed /compose and /runs revalidation of current text values/version
  - UI review, keep-exactly action and invalidation for covered field edits
  - Regression proof that promptBase-only changes are stale before run lookup/persistence/provider
affects: [lab-bench-text-integrity, lab-admin-api, lab-bench-prompt-preflight]
tech-stack:
  added: []
  patterns: [ephemeral-text-review-evidence, server-side-pre-execution-validation]
key-files:
  created: []
  modified: [src/lib/lab/bench/domain/schemas.ts, src/lib/lab/bench/domain/preflight-revalidation.ts, src/app/api/admin/laboratorio/bancada/compose/route.ts, src/app/api/admin/laboratorio/bancada/runs/route.ts, src/app/(app)/admin/laboratorio/bancada/_components/bench-workbench.tsx, src/app/(app)/admin/laboratorio/bancada/_components/bench-preflight-panel.tsx, src/lib/lab/bench/__tests__/preflight-revalidation.contract.test.ts, src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts, src/app/(app)/admin/laboratorio/bancada/_components/__tests__/bench-ui.contract.test.tsx]
key-decisions:
  - "Evidência textual é efêmera em requests/UI; não é persistida em coluna, sessão ou tabela."
  - "Runs valida ausência/stale antes de lookup do draft e de qualquer persistência executável ou provider."
requirements-completed: [lab-bench-text-integrity, lab-bench-prompt-preflight, lab-admin-api]
requirements-reviewed: [lab-generation-bench]
duration: 55min
completed: 2026-10-01
---

# F48.2.5 Plan 04 Summary

**Revisão textual efêmera agora liga os quatro campos livres a `/compose` e `/runs`; alterações, inclusive apenas em `promptBase`, bloqueiam a execução como stale.**

## Accomplishments

- Adicionado `BenchTextIntegrityEvidenceSchema` estrito com `policyVersion`, SHA-256 `reviewRevision` e decisão `no_alerts`/`keep_exactly`; a evidência continua opcional no schema geral para que `/runs` possa mapear ausência para o status normativo 409.
- Helper puro `validateBenchTextIntegrityEvidence` recalcula alertas e revisão sobre os pares canônicos do detector. `no_alerts` só passa sem alertas; `keep_exactly` só passa quando há alertas e conteúdo/versão/revisão correspondem. A evidência não pretende comprovar independentemente o clique.
- `/compose` executa o detector antes do compositor e das leituras de branding: alertas sem decisão retornam 422 sem prompt; decisão ausente sem alertas emite `no_alerts`; evidência incompatível/stale retorna 409 com revisão e alertas atuais.
- A UI exibe alertas por campo/trecho/motivo/regra, permite manter exatamente a revisão e preserva a evidência até `POST /runs`. Alterar nome, descrição, texto obrigatório ou prompt-base limpa a decisão/evidência; o prompt-base é enviado sem trim.
- `/runs` exige evidência e valida os quatro valores após parsing, antes de procurar o draft, persistir estado executável, confirmar CAS ou invocar o adapter. A regressão altera somente `promptBase` e prova 409 stale sem lookup/persistência/provider.
- Aprovação do prompt permanece byte a byte e confirmação financeira segue separada. Nenhuma tabela, coluna, sessão ou mecanismo de assinatura foi adicionado.

## Validation

- `npm.cmd test -- --run --testTimeout=60000 src/lib/lab/bench/__tests__/preflight-revalidation.contract.test.ts src/lib/lab/bench/__tests__/bench-execution.contract.test.ts src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts "src/app/(app)/admin/laboratorio/bancada/_components/__tests__/bench-ui.contract.test.tsx"` — **4 arquivos, 216 testes passaram**.
- `npm.cmd run typecheck` — passou.
- `npm.cmd run lint` — passou.
- API/UI/domain contracts cover 422 without prompt, current keep_exactly, stale version/content, missing evidence, promptBase-only stale, no_alerts forwarding, and byte-identical approved/sent prompt using mocks/fakes only.
- Nenhuma chamada de provider, geração paga, migration ou escrita de persistência nova foi executada.

## Task commits

1. **Task 1: Schema/helper de evidência temporária** — `17211b60`.
2. **Tasks 2–4: Compose, UI, runs e testes integrados** — `182418e5`.

## Plan tracking

Tasks OpenSpec 4.1–4.6 marcadas como concluídas. `lab-bench-text-integrity`, `lab-bench-prompt-preflight` e `lab-admin-api` estão concluídas para este recorte; `lab-generation-bench` permanece em andamento nos gates integrados/UAT posteriores. CHECKPOINT A/B seguem pendentes e nenhuma geração paga decorre deste plano.

## Next

Plano 05 — separar as orientações de integridade linguística geral, de produto e comercial. Parar antes de qualquer checkpoint humano futuro; nenhum provider foi chamado.
