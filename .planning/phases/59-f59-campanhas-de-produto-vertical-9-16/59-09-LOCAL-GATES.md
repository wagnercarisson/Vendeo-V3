# F59 / 59-09 — Gates locais

Data: 2026-11-05. Escopo: parte local autorizada da Wave 7 (telemetria, runbook,
gates locais e build). Seed/flag, homologação, chamadas pagas, push e deploy NÃO
foram executados.

## Gates executados e verdes

| # | Gate | Comando | Resultado |
|---|---|---|---|
| 1 | Suítes verticais | `npm test -- "src/lib/product-vertical-9-16/__tests__" --reporter=dot` | **17 arquivos / 199 testes passando; exit 0** |
| 2 | Suítes tocadas | `npm test -- "src/app/api/campaign/__tests__" "src/components/flow/__tests__" "src/lib/campaign/__tests__" "src/__tests__/api/campaign-download.test.ts" "src/__tests__/app/campaign-detail-format.test.tsx" "src/__tests__/lib/campaign-display-format.test.ts" --reporter=dot` | **59 arquivos / 550 testes passando; exit 0** |
| 4 | TypeScript | `npm run typecheck` | **exit 0** |
| 5 | Lint | `npm run lint` | **exit 0** — limitação conhecida: ESLint não cobre todos os arquivos TS |
| 6 | Build | `npm run build` | **exit 0** — `check:cnae OK`; 96 páginas geradas |
| 7 | OpenSpec | `openspec validate fase-59-campanhas-produto-vertical-9-16 --strict` | **valid; exit 0** |
| 8 | Diff check | `git diff --check` | **limpo; exit 0** |
| 9 | Isolamento | busca por `product-vertical-9-16` em `src/lib/product-1-1/**` | **0 ocorrências** |

## Gate bloqueante: regressão 1:1

Comando: `npm test -- "src/lib/product-1-1/__tests__" --reporter=dot`

Resultado: **exit 1 — 46 arquivos passaram, 3 falharam; 929 passed, 13 failed,
942 total.** **Expectativas inalteradas**: nenhum teste 1:1 foi modificado.

Falhas registradas:

1. `legacy-frontier.guard.test.ts` — a guarda exige reconciliação autorizada.
   - `src/lib/ai/types.ts` e `src/lib/ai/gateway.ts` foram alterados pela
     telemetria aditiva do 59-09.
   - Já havia caminhos não autorizados na fronteira:
     `src/lib/ai/image-model-pair-config-row.ts` e
     `src/lib/ai/image-model-pair-config-service.ts`.
   - O import de flags em `generate-image/route.ts` foi alterado em wave
     anterior.
2. `non-activation.contract.test.ts` — allowlist de importadores não reconhece:
   - rotas de admin/recuperação da Wave 5 importando módulos 1:1;
   - módulos verticais importando estruturas 1:1.
3. `result-states.contract.test.ts` — o download agora falha fechado (`503`) quando
   a operação do novo fluxo existe, mas `campaigns.input_snapshot` está ausente.
   O comportamento novo veio do dispatch por formato (59-08); os fixtures
   históricos esperam `403`/`200`.

**Bloqueio:** a Wave 7 não pode ser declarada concluída enquanto esta regressão
1:1 não for reconciliada com autorização explícita (guards/expectativas) ou com
uma decisão de compatibilidade para o fixture sem snapshot. Não alterei os testes
1:1 nem as guardas para forçar verde.

## Gate adicional observado

`npm test -- "src/lib/ai/__tests__"` → **38 passaram, 1 falhou, 1 skipped**.
Falha pré-existente em `architecture-guard`:
`src/lib/product-vertical-9-16/cost/proof-openai-loader.ts → new OpenAI(`.
Não é causada pela telemetria desta rodada, mas permanece como limitação.

## Bloqueios

- Regressão 1:1 acima.
- Seed data-only da flag não criado/aplicado.
- Flag `product_9_16_enabled` não ativada.
- Nenhuma chamada paga nova.
- Push/deploy não executados.

## O que NÃO foi validado aqui

- Homologação funcional e UAT.
- Geração real com provider, inspeção visual de arte/copy/margens/download.
- Comportamento em banco real, concorrência financeira e Storage real.
- Matriz de sobreposições de Stories/Reels.
- Produção, ativação da flag, smoke e rollback de deploy.

## Decisão

A parte local de telemetria, runbook e build está implementada e evidênciada.
A aprovação da Wave 7 permanece **bloqueada** pela regressão 1:1.
