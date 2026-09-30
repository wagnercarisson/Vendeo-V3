---
phase: 48.2.4-experimento-deterministico-oferta-1-1
plan: 48-2-4-10
subsystem: pricing-models-and-credentials
tags: [pricing, gpt-image-2.5-sunburst, preset-registry, allowlist, bench-api-key, isolation]

requires:
  - phase: 48.2.4
    provides: planos 01–08 (fundação, transporte, revalidação/tentativas, API, UI)
provides:
  - Pricing local v2 (`2026-09-bench-2`) com tarifas oficiais 5/8/30 (1M tokens)
  - Estimativa prévia honesta (`coverage: partial`) e cálculo pós-usage pelo usage real
  - `gpt-image-2.5-sunburst` no caminho isolado (allowlist própria, catálogo local, presets low/medium, pricing)
  - Resolvedor de chave exclusivo da bancada (`OPENAI_BENCH_API_KEY`), sem fallback para a chave produtiva
affects: [UAT Flare/Sunburst, isolamento de credencial, sequência F48.2.5]

tech-stack:
  added: []
  patterns:
    - "Pricing local versionado por preset completo (provider+model+protocol+quality+size); histórico por cost_rule_version"
    - "Nunca inventar consumo de tokens; `coverage: partial` honesto quando não comprovado"
    - "Credencial da bancada isolada por env-var dedicada (fail-closed antes do cliente/provider)"

key-files:
  created:
    - src/lib/lab/bench/gateway/bench-api-key.ts
    - src/lib/lab/bench/__tests__/bench-api-key.contract.test.ts
  modified:
    - src/lib/lab/bench/domain/bench-pricing.ts
    - src/lib/lab/bench/domain/bench-model-allowlist.ts
    - src/lib/lab/bench/domain/preset-registry.ts
    - src/lib/ai/adapters/bench-images.ts
    - scripts/lab/48-2-2-bench-bootstrap.mjs
    - docs/lab/48-2-2-spike-models.md
    - src/lib/lab/bench/__tests__/bench-pricing.test.ts
    - src/lib/lab/bench/__tests__/preset-registry.test.ts
    - src/lib/lab/bench/__tests__/bench-execution.contract.test.ts
    - src/lib/lab/bench/__tests__/bench-images-adapter.test.ts
    - src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts
    - src/app/(app)/admin/laboratorio/bancada/_components/__tests__/bench-ui.contract.test.tsx
    - src/lib/ai/__tests__/architecture-guard.test.ts

key-decisions:
  - "Nova versão de regra `2026-09-bench-2`; `2026-09-bench-1` preservada (histórico)"
  - "gpt-image-2 `coverage: partial` sem estimativa derivada da tarifa antiga"
  - "Sunburst apenas no caminho isolado; MODEL_ALLOWLIST produtivo intocado"
  - "Chave da bancada somente `OPENAI_BENCH_API_KEY`; `getApiKey` produtivo intocado"

duration: ~60 min
completed: 2026-09-30
---

# F48.2.4 — Plano 48-2-4-10 (pricing v2 + Sunburst + chave exclusiva)

## Objective

Correção cirúrgica: alinhar o pricing local ao oficial vigente sob nova versão de regra; adicionar
`gpt-image-2.5-sunburst` somente ao caminho isolado da bancada; e isolar a credencial da bancada
(`OPENAI_BENCH_API_KEY`). Sem geração paga.

## Accomplishments

- **Pricing v2 (`2026-09-bench-2`):** tarifas oficiais 5/8/30 (texto/imagem-in/saída por 1M tokens)
  para `gpt-image-2`, `gpt-image-2.5-flare` e `gpt-image-2.5-sunburst`; `2026-09-bench-1` não
  reescrita (histórico por `cost_rule_version`).
- **Estimativa prévia honesta:** os tokens do `gpt-image-2` derivados da tarifa antiga **não** são
  reaproveitados; cobertura `partial` (estimativa parcial/indisponível); `gpt-image-2.5-flare` low
  mantém 196 tokens do calculador oficial; nenhum token inventado.
- **Sunburst no caminho isolado:** `BENCH_MODEL_ALLOWLIST`, catálogo/bootstrap local, presets
  `gpt-image-2.5-sunburst-low`/`-medium`, resolver e pricing; `MODEL_ALLOWLIST` produtivo, adapter
  produtivo e `supabase/migrations/**` intocados.
- **Chave exclusiva da bancada:** `getBenchApiKey` lê somente `OPENAI_BENCH_API_KEY`, nunca faz
  fallback para `OPENAI_API_KEY`, falha antes do cliente/provider se ausente/vazia, não
  registra/persiste/exibe a chave; `BenchImagesAdapter` usa o resolvedor dedicado; `getApiKey`
  produtivo intocado; gate arquitetural estendido.

## Task Commits

1. **Task 1/2/3: pricing v2 + Sunburst + testes** - `3f3d19ae` (feat)
2. **Task 4: chave exclusiva da bancada** - `ff0130e8` (feat)
3. **OpenSpec** - `afa1d55e`; **GSD/planos/UAT** - `7fcad239`; **tasks.md** - `974692b4`; **tracking** - `b5ed8082`

## Files Created/Modified

- `bench-pricing.ts` (regra v2 + tarifas 5/8/30 + estimativa honesta + Sunburst).
- `bench-model-allowlist.ts` / `preset-registry.ts` (Sunburst low/medium).
- `scripts/lab/48-2-2-bench-bootstrap.mjs` (linha de catálogo Sunburst) e `docs/lab/48-2-2-spike-models.md`.
- `src/lib/lab/bench/gateway/bench-api-key.ts` (novo) e `src/lib/ai/adapters/bench-images.ts` (usa `getBenchApiKey`).
- Testes: pricing, presets, execução, adapter, API, UI, `bench-api-key`, architecture-guard.

## Decisions Made

- **Nova versão de regra** (`2026-09-bench-2`) em vez de reescrever a `2026-09-bench-1` — preserva o
  significado histórico dos runs antigos.
- **Não simular cache** no caminho direto `Images` (só vale para a Responses API).
- **Credencial isolada** por env-var dedicada; fallback para a chave produtiva é proibido por design.

## Deviations from Plan

Nenhum desvio de escopo. `Sunburst` confirmado na documentação oficial (ID, Images API, edição com
imagens, qualidades `low`/`medium`/`high`/`xhigh`/`max`/`auto`, saída token-based).

## Issues Encountered

- Um flake isolado de suíte (ambiental) em uma execução; verde nas execuções seguintes
  (`4609 passed | 2 skipped`).

## Next Phase Readiness

- Pricing v2, Sunburst e chave exclusiva prontos; UAT Sunburst validou (aprovado com follow-up).
- Próximo: **F48.2.5 — refinamento experimental Oferta 1:1**.

## Self-Check: PASSED
