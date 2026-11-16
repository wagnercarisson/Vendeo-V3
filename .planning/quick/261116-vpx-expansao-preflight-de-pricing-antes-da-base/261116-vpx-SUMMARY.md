# Quick 261116-vpx — SUMMARY

**Data:** 2026-11-16
**Base:** `main` @ `ae5d0e79b176d6d8716d74fca2315ee27bbb67b2`
**Estado:** implementação e validação local concluídas; **aguardando revisão**.
Push, deploy, ativação e validação produtiva **não autorizados/não executados**.

## Causa

A expansão 9:16 exigia `image_unit_usd` como parte da cobertura pré-chamada,
mesmo quando o cálculo aplicável é por tokens. A linha de pricing do alvo
(`gpt-image-2.5-sunburst` / `low`) tinha as tarifas de usage aplicáveis, mas
`image_unit_usd = NULL`. Resultado: `pricing_unavailable` /
`incomplete_coverage` / `missing: ["image_unit_usd"]` **depois** de a base e a
copy já terem sido pagas; a operação foi estornada.

## Decisão aplicada

### 1. Cobertura de usage separada da estimativa

- `evaluatePricingCoverage` cobre apenas as tarifas aplicáveis ao cálculo por
  usage. `image_unit_usd` não é exigido e não comprova cobertura.
- Nova `evaluatePreCallEstimate`: `image_unit_usd` ausente/zero/negativo/NaN ⇒
  `{ available: false, imageUnitUsd: null }`. Nunca zero, nunca valor copiado,
  nunca custo efetivo.
- `resolveExpansionPricing` devolve `imageUnitUsd: number | null` e
  `estimateAvailable`; a telemetria recebe `imageUnitUsd: number | null` e o
  sink usa o custo por usage (`settlement: "usage_tokens"`), sem ler a
  estimativa como custo. Usage/tarifa insuficiente continua
  `null`/`not_available`.
- **Controles de orçamento preservados:** no fluxo 9:16 ativo o gasto é
  autorizado pela reserva de 1 crédito, não pela estimativa por unidade. O
  harness da prova F60.3 continua sem estimativa pré-calculada quando
  `image_unit_usd` está ausente (`estimatedPreCallUsd: null`). Nenhum gate de
  gasto foi removido silenciosamente.
- Nenhuma linha de `ai_model_pricing` foi lida em escrita, alterada ou
  copiada; nenhum valor de homolog foi reutilizado.

### 2. Preflight antes da primeira chamada paga

- Novo `preflightExpansionToNineSixteen` (server-only, read-only): resolve o
  alvo ativo do catálogo e a cobertura de tarifas de usage; nunca chama
  provider.
- O orquestrador executa o preflight:
  - numa **geração nova**, antes de `reserveOperationOnce` — falha ⇒ nenhuma
    reserva, nenhuma tentativa, nenhuma chamada de base/copy/expansão;
  - numa **continuação que ainda executaria a base**, antes de adquirir a
    etapa — falha ⇒ estorno único + encerramento da projeção, sem reserva
    abandonada.
- Replay/consulta somente leitura, retomada de etapa já concluída e entrega de
  vertical já comprovado **não** executam o preflight.
- A dependência `preflightExpansion` é obrigatória em `RunNineSixteenDeps`;
  ausência de dependência não desliga o gate em silêncio.

### 3. Diagnóstico seguro

- Classificações fechadas e distintas: `model_unavailable`,
  `pricing_unavailable`, `configuration_read_failed` **versus** desfechos de
  provider (`provider_failure`/`transient`).
- Log de pipeline (`expansion_preflight_failed` / `generation_failed`) com
  `errorCode`, etapa, `missing` (nomes de campos) e `supportReference`.
- O desfecho persistido passa a receber a referência de suporte também em falha
  definitiva; replay não estorna duas vezes.
- Terminal NDJSON ganhou `reason` aditivo (classificação técnica, não código
  público). Nenhum segredo/payload/prompt/URL; nenhum evento de chamada é
  criado em falha pré-chamada.
- Nenhum código público de suporte foi criado ou alterado. A convenção
  `docs/convencoes/codigos-de-erro-suporte.md` foi lida antes da decisão.

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/lib/campaign/vertical-expansion/model.ts` | cobertura de usage separada da estimativa; `evaluatePreCallEstimate`; `preflightExpansionToNineSixteen`; `imageUnitUsd` anulável |
| `src/lib/campaign/vertical-expansion/telemetry.ts` | estimativa pré-chamada anulável |
| `src/lib/product-9-16-two-stage/orchestration/types.ts` | `ExpansionConfigurationPreflight` obrigatório + `reason` aditivo no terminal |
| `src/lib/product-9-16-two-stage/orchestration/delivery-deps.ts` | preflight real read-only |
| `src/lib/product-9-16-two-stage/orchestration/run-nine-sixteen.ts` | gate antes da reserva/base; diagnóstico seguro; referência de suporte |
| `scripts/f60.3/vertical-expansion-proof.ts` | estimativa anulável no preflight da prova |
| `openspec/specs/campaign-vertical-ai-expansion/spec.md` | cobertura usage × estimativa; cenários de `image_unit_usd` nulo |
| `openspec/specs/product-9-16-two-stage-orchestration/spec.md` | requisito de preflight, replay/entrega e diagnóstico |

## Provas offline

Comandos executados localmente (sem rede/produção/banco/Storage/provider):

| Gate | Resultado |
|---|---|
| `npx vitest run src/lib/campaign/vertical-expansion src/lib/product-9-16-two-stage` | **51 arquivos / 447 testes PASS** |
| `npx vitest run src/lib/campaign src/lib/product-vertical-9-16` | **88 arquivos / 1163 testes PASS** |
| `npx vitest run src/app/api/campaign/generate-image src/app/api/campaign/generation-status src/app/api/campaign/[id]/continue` | **5 arquivos / 140 testes PASS** |
| `npx vitest run` (1:1: orquestração, crédito, estados, failure-closure layer1) | **4 arquivos / 104 testes PASS** |
| `npm run test:scripts` | **102 / 102 PASS** |
| `npm run typecheck` | **exit 0** |
| `npm run lint` | **exit 0** (limitação preexistente: ESLint sem cobertura TS) |
| `npm run build` | **exit 0** |
| `git diff --check` | **limpo** |
| `openspec validate campaign-vertical-ai-expansion --strict` | **válido** |
| `openspec validate product-9-16-two-stage-orchestration --strict` | **válido** |

Cobertura específica adicionada:

- pricing por tokens completo + `image_unit_usd` NULL ⇒ cobertura completa,
  estimativa indisponível, chamada autorizada;
- tarifa de usage aplicável ausente ⇒ continua bloqueando;
- estimativa ausente não vira zero nem custo efetivo (custo vem de usage);
- preflight de pricing/modelo falho ⇒ zero reservas, zero base/copy/expansão;
- continuação que ainda executaria a base ⇒ zero chamadas + estorno único;
- replay/entrega comprovada não consultam pricing;
- diagnóstico distingue `pricing_unavailable:incomplete_coverage` /
  `model_unavailable:catalog_row_missing` de `transient`/`provider_failure`.

**Falhas preexistentes confirmadas na base** (reproduzidas com a worktree
limpa/stash): `src/lib/ai/__tests__/telemetry-coverage.test.ts` (1) e
`src/lib/product-1-1/__tests__/legacy-frontier.guard.test.ts` (4). Não foram
introduzidas por esta quick e não foram “consertadas” fora do escopo.

## Limites

- Nenhum acesso/escrita em homolog ou produção; nenhuma leitura real de
  pricing/campanha; nenhuma chamada paga ou nova geração.
- A flag produtiva permanece **desligada**; não foi tocada.
- A campanha estornada `c1c0448d-…` não foi reparada nem reexecutada.
- Sem migration, sem alteração de pricing/catálogo, sem push/deploy.
- A validação produtiva (`pricing` real + geração 9:16) continua sendo um gate
  separado, após revisão e autorização.

## Instrução de publicação (após aprovação)

1. Revisar este SUMMARY, o diff e os gates.
2. `git push origin main` pelo responsável.
3. Deploy normal da Vercel (sem migration; nenhuma variável/flag nova).
4. Só então, em rodada separadamente autorizada: religar a flag e validar a
   geração 9:16 com a linha de pricing real.
