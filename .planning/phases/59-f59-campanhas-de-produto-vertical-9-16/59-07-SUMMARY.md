---
phase: 59-f59-campanhas-de-produto-vertical-9-16
plan: "07"
subsystem: creation
tags: [schema, feature-flag, route, ui, vertical, format]

requires:
  - phase: 59-01
    provides: contrato neutro de formato
  - phase: 59-03
    provides: compositor vertical
  - phase: 59-05
    provides: entrypoint vertical
provides:
  - campaignFormat opcional no schema do fluxo novo
  - flag product_9_16_enabled fail-closed
  - snapshot vertical congelado antes do hash
  - 409 apenas com campanha persistida divergente
  - despacho vertical dinâmico e reenvio não bloqueado
  - seletor de formato e pausa na UI
affects: [59-08, 59-09]

tech-stack:
  added: []
  patterns:
    - formato persistido como fonte única
    - import dinâmico único do entrypoint vertical
    - flag server-side sem env override/coorte
    - payload 1:1 byte-compatível
    - pausa vertical sem troca silenciosa para 1:1

key-files:
  created:
    - src/components/flow/campaign-format-selector.tsx
    - src/app/api/campaign/__tests__/generate-image-format.test.ts
    - src/components/flow/__tests__/campaign-format-selector.test.tsx
    - src/components/flow/__tests__/use-campaign-form-format.test.ts
    - src/components/flow/__tests__/campaign-page-client-format.test.tsx
  modified:
    - src/lib/image-generation/schema.ts
    - src/lib/feature-flags/feature-flag-service.ts
    - src/app/(app)/admin/feature-flags/page.tsx
    - src/app/api/campaign/generate-image/route.ts
    - src/app/(app)/campanhas/nova/page.tsx
    - src/components/flow/campaign-input-form.tsx
    - src/components/flow/use-campaign-form.ts
    - src/components/flow/campaign-page-client.tsx

key-decisions:
  - "`campaignFormat` é opcional e exclusivo do schema novo; o legado continua rejeitando a chave."
  - "O snapshot 9:16 recebe as duas chaves antes do hash; o 1:1 não ganha nenhuma."
  - "O 409 de formato só existe quando há campanha persistida divergente."
  - "A flag bloqueia apenas novas gerações; reenvio de operação existente continua e usa o motor do formato."
  - "O seletor só é montado com elegibilidade e (flag ON ou rascunho vertical pausado)."

requirements-completed: [REQ-59-01, REQ-59-11]

duration: 40min
completed: 2026-11-04
---

# Phase 59 Plan 07: Criação, flag e seletor vertical

**O fluxo novo aceita 9:16 de ponta a ponta: schema, snapshot congelado, 409, flag pré-reserva, despacho dinâmico e UI.**

## Accomplishments

- Schema novo aceita `campaignFormat: "1:1" | "9:16"` opcional; o schema legado permanece intacto.
- `product_9_16_enabled` foi adicionada à leitura de flags e ao painel admin, fail-closed.
- A rota de geração congela formato/versão só no vertical, valida divergência após identificar campanha existente e bloqueia novas gerações com flag OFF antes de reserva/provider.
- O reenvio de operação existente não consulta a flag e escolhe o motor vertical/1:1 pelo formato; o caminho 1:1 não carrega o entrypoint vertical.
- UI: seletor com labels exatos do UI-SPEC, helper, `aria-describedby`, 44px e foco visível; pausa com banner exato, radios desabilitados, vertical marcado e submit bloqueado.
- Body/fingerprint: 1:1 sem a chave; 9:16 com a chave; voltar a 1:1 remove a chave.

## Task Commits

1. **Task 1-3: criação/flag/UI vertical** — `b85086f3`

## Validation

| Gate | Resultado |
|---|---|
| Suíte focada Wave 5 | 70 arquivos / 823 testes passando |
| Testes de schema/flag | passando |
| Testes de rota (formato/flag/snapshot/reenvio) | passando |
| Testes de UI (seletor/body/fingerprint/props/pausa) | passando |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `openspec validate ... --strict` | valid |
| `git diff --check` | limpo |

## Deviations from Plan

- O comportamento fim-a-fim da rota foi estendido na suíte existente `generate-image/__tests__/route.test.ts`; o arquivo previsto `src/app/api/campaign/__tests__/generate-image-format.test.ts` contém as guardas estruturais (import neutro, import dinâmico único do vertical e congelamento).
- `/campanhas/nova` resolve `verticalEnabled` server-side, mas a derivação de `campaignFormatPaused` a partir do restore continua no 59-08.
- O banner/labels foram alinhados ao texto literal do UI-SPEC (`Quadrado 1:1 - feed`, `Vertical 9:16 - ...`, título/corpo da pausa).
- Nenhum seed, flag aplicada, chamada paga, migration, push ou deploy.

## Next Phase Readiness

- Wave 6 (restore vertical, detalhe/lista e homologação) segue bloqueada até autorização.
- O seed data-only e a ativação da flag pertencem ao 59-09 (checkpoint humano).
