# Phase 47 — Validation Architecture

Este arquivo é o mapa de validação da F47. Ele define evidências e comandos; não registra resultados de execução. Um resultado só pode ser marcado em `47-VERIFICATION.md`/`47-UAT.md` após execução real.

## Dimensões Nyquist

| Dimensão | Evidência exigida | Planos responsáveis |
|---|---|---|
| Migration e dados | lint estático; com Docker, reset, reaplicação e script de verificação; exatamente 12 seeds; RLS/CHECKs/RPCs/auditoria/idempotência | 47-01 |
| Serviços bulk/cache | testes com fakes Supabase para uma leitura bulk, TTL 30s, invalidação local, deprecated e falha fail-open | 47-02 |
| Resolver/composição | testes de precedência, default, missing/parcial/incompatível, deprecated, fallback nulo e ausência de edição em `gateway.ts` | 47-03 |
| API e contratos | testes 403/400, GET active/deprecated/missing, PUT/DELETE RPC-only, JSON DELETE exato e UUID obrigatório/reutilizado | 47-04 |
| UI administrativa | testes de agrupamento, fallback exclusivo `campaign_copy`, `campaign_image_edit` independente, motivo, reset e navegação/acessibilidade | 47-05 |
| Pricing capacity-aware | testes de tokens, `responses:image_generation`, `image_unit_usd`, warning não bloqueante e não-mudança de `resolveAiCost`/`ai-model-pricing.ts` | 47-06 |
| Não-mudança e diagnósticos | testes de labels efetivos, fail-open e guard de paths proibidos; quatro gates completos | 47-07 |
| UAT e release | UAT local com schema aplicado; migration remota [BLOCKING] antes de deploy; verification goal-backward e tracking | 47-08 |

## Ordem e bloqueios

1. `47-01` pode gerar migration, script e lint estático sem Docker.
2. Lint/reset/testes SQL e UAT SQL só executam depois do checkpoint Docker/Supabase de `47-01`.
3. `47-02` usa mocks para permanecer em Wave 1; a migration local é validada por `47-01` antes do UAT integrado de `47-08`.
4. `47-08` não aplica migration remota sem UAT local aprovado e não faz deploy antes da confirmação remota.

## Comandos de amostragem

```text
node --check scripts/verify/47-01-f47-migration-verification.mjs
npx supabase db lint --local
npx supabase db reset
node scripts/verify/47-01-f47-migration-verification.mjs
npx vitest run <suite-focal>
npm run typecheck
npm run lint
npm run build
```

`npx supabase db lint --local`, `db reset` e o verificador SQL requerem Docker/Supabase local. Se indisponível, registrar bloqueio; não converter ausência de execução em PASS.

## Gates de fase

- [ ] Suites focais e regressão Vitest executadas.
- [ ] `npm run typecheck`, `npm run lint` e `npm run build` executados.
- [ ] Migration local e UAT SQL executados, ou bloqueio explicitamente registrado.
- [ ] Migration remota confirmada antes do deploy.
- [ ] `47-VERIFICATION.md` goal-backward e `47-UAT.md` contêm evidências reais.
