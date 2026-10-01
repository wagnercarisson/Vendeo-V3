---
phase: 48.2.5-estabilizacao-experimental-oferta-1-1
plan: 48-2-5-02
subsystem: lab-bench
tags: [image-roles, prompt-policy, upload, adapter]
requires:
  - phase: 48.2.5-estabilizacao-experimental-oferta-1-1
    provides: Base SHA, boundary evidence, field map and persistence audit from Plan 01
provides:
  - Versioned product policy for primary and auxiliary product-image roles
  - Exact optional-reference copy in the bench uploader
  - Contract coverage for zero/one/three additional images and canonical order
affects: [lab-bench-image-roles, lab-bench-prompt-policy, bench-upload]
tech-stack:
  added: []
  patterns: [versioned-policy-contribution, primary-additional-identity-order]
key-files:
  created: [.planning/phases/48.2.5-estabilizacao-experimental-oferta-1-1/48-2-5-02-SUMMARY.md]
  modified: [src/lib/lab/bench/domain/policies/produto.ts, src/app/(app)/admin/laboratorio/bancada/_components/bench-image-upload.tsx, src/lib/lab/bench/__tests__/prompt-policy.contract.test.ts, src/lib/lab/bench/__tests__/bench-images-adapter.test.ts, src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts]
key-decisions:
  - "A semântica dos papéis de imagem pertence à política produto e foi versionada como 48.2.5-produto-v2."
  - "Multipart e adapter preservam principal → adicionais ordenadas → identidade; nenhuma mudança de storage, limites ou runtime foi necessária."
requirements-completed: [lab-bench-image-roles]
requirements-reviewed: [lab-bench-prompt-policy]
duration: 20min
completed: 2026-09-30
---

# F48.2.5 Plan 02 Summary

**Política de produto versionada com principal protagonista e adicionais auxiliares opcionais; copy e ordem canônica cobertos sem alterar o runtime de transporte.**

## Accomplishments

- `produtoPolicy` agora declara que a imagem principal é a representação obrigatória/protagonista e que adicionais são referências auxiliares do mesmo produto, sem duplicação ou competição. A versão passou a `48.2.5-produto-v2`.
- A UI exibe literalmente: “Imagens adicionais de referência — opcionais. Podem ajudar a preservar detalhes e orientar a composição, mas nem todas necessariamente aparecerão na arte final.”
- Testes do adapter verificam 0, 1 e 3 imagens adicionais com identidade por último. Teste multipart da API confirma principal + três adicionais persistidos nos índices `0..3`; o contrato existente também cobre principal e duas adicionais.
- O adapter e o runtime não precisaram de alteração: inspeção e testes confirmam a ordem já implementada principal → adicionais → identidade.
- Nenhuma alteração em limits, storage, fingerprint, preset, provider ou caminhos produtivos. Nenhum provider foi chamado.

## Validation

- `npm.cmd test -- --run src/lib/lab/bench/__tests__/prompt-policy.contract.test.ts src/lib/lab/bench/__tests__/bench-images-adapter.test.ts src/lib/lab/bench/__tests__/bench-execution.contract.test.ts src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts` — **4 arquivos, 171 testes passaram**.
- `npm.cmd run typecheck` — passou.
- `npm.cmd run lint` — passou.
- `openspec validate fase-48-2-5-estabilizacao-experimental-oferta-1-1 --strict` — change válida.
- `supabase/migrations/**` permaneceu limpo; comparação desde a Base SHA do Plano 01 nas fronteiras protegidas (incluindo `src/lib/ai/adapters/responses.ts`) vazia.

## Task commits

1. **Task 1: Política de imagem versionada** — `f9823808`.
2. **Task 2: Copy e contratos de ordem/upload** — `47dd3fab`.

## Plan tracking

Tasks OpenSpec 2.1–2.4 marcadas como concluídas em `openspec/changes/fase-48-2-5-estabilizacao-experimental-oferta-1-1/tasks.md`. A capability `lab-bench-image-roles` está concluída neste plano; `lab-bench-prompt-policy` permanece em andamento nos planos futuros, que tratam integridade textual geral/produto/comercial.

## Deviations

- O plano lista os testes da pasta de API no comando de verificação, mas omite esse arquivo de `files_modified`. Foi acrescentado um cenário ao contrato multipart existente para comprovar a ordem/persistência da principal com três adicionais, conforme o próprio critério de aceitação; nenhuma lógica da rota foi alterada.

## Next

Plano 03 — detector determinístico e versionado de integridade textual. CHECKPOINT A e B permanecem pendentes; este plano não autoriza geração paga.
