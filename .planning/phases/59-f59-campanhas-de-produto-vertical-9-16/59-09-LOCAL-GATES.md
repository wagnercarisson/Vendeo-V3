# F59 / 59-09 — Gates locais

Data: 2026-11-05. Escopo: parte local autorizada da Wave 7 (telemetria, runbook,
gates locais e build). Seed/flag, homologação, chamadas pagas, push e deploy NÃO
foram executados.

## Gates executados e verdes

| # | Gate | Comando | Resultado |
|---|---|---|---|
| 1 | Suítes verticais | `npm test -- "src/lib/product-vertical-9-16/__tests__" --reporter=dot` | **17 arquivos / 199 testes passando; exit 0** |
| 2 | Suítes tocadas | `npm test -- "src/app/api/campaign/__tests__" "src/components/flow/__tests__" "src/lib/campaign/__tests__" "src/__tests__/api/campaign-download.test.ts" "src/__tests__/app/campaign-detail-format.test.tsx" "src/__tests__/lib/campaign-display-format.test.ts" --reporter=dot` | **59 arquivos / 550 testes passando; exit 0** |
| 3 | Regressão 1:1 | `npm test -- "src/lib/product-1-1/__tests__" --reporter=dot` | **49 arquivos / 943 testes passando; exit 0 — expectativas preservadas** |
| 4 | TypeScript | `npm run typecheck` | **exit 0** |
| 5 | Lint | `npm run lint` | **exit 0** — limitação conhecida: ESLint não cobre todos os arquivos TS |
| 6 | Build | `npm run build` | **exit 0** — `check:cnae OK`; 96 páginas geradas |
| 7 | OpenSpec | `openspec validate fase-59-campanhas-produto-vertical-9-16 --strict` | **valid; exit 0** |
| 8 | Diff check | `git diff --check` | **limpo; exit 0** |
| 9 | Isolamento | busca por `product-vertical-9-16` em `src/lib/product-1-1/**` | **0 ocorrências** |
| 10 | IA | `npm test -- "src/lib/ai/__tests__" --reporter=dot` | **39 arquivos + 1 skipped / 389 testes + 7 skipped; exit 0** |

## Correções de reconciliação aplicadas

1. **Fixtures de download** — campanhas simuladas passaram a carregar
   `input_snapshot: {}` (contrato histórico 1:1, coluna `NOT NULL DEFAULT '{}'`),
   preservando as expectativas `403`/`200`. Foi adicionado um caso separado
   provando `503 format_unavailable` para formato persistido malformado.
2. **`non-activation`** — somente pares exatos importador/módulo introduzidos pela
   F59 foram autorizados:
   - rota admin de pendências → `pending/pending-operations-repository`;
   - rota de recuperação de imagem → `artifact/artifact-store` e
     `orchestration/project-delivered-campaign`;
   - oito arquivos verticais com seus imports exatos de engine/políticas 1:1.
   Nenhum diretório inteiro foi liberado.
3. **`legacy-frontier`** — `BASE_SHA` e comparações de conteúdo preservados.
   Entradas fixas adicionadas/atualizadas para `ai/types.ts`, `ai/gateway.ts`,
   `image-model-pair-config-row.ts`, `image-model-pair-config-service.ts` e
   `ai/adapters/proof-openai-loader.ts`, cada uma com commit fixo e autorização.
4. **Guarda de arquitetura** — `proof-openai-loader.ts` foi movido para
   `src/lib/ai/adapters/`, fronteira permitida para SDK. O loader padrão 1:1 não
   foi alterado.

## Bloqueios e limites

- Seed data-only da flag `product_9_16_enabled` criado em `20261105162052_f59_product_9_16_flag.sql`, mas **não aplicado**.
- Flag não ativada.
- Nenhuma chamada paga nova.
- Push/deploy não executados.

## O que NÃO foi validado aqui

- Homologação funcional e UAT.
- Geração real com provider, inspeção visual de arte/copy/margens/download.
- Comportamento em banco real, concorrência financeira e Storage real.
- Matriz de sobreposições de Stories/Reels.
- Produção, ativação da flag, smoke e rollback de deploy.

## Decisão

Os gates locais da Wave 7 estão verdes e a regressão 1:1 foi reconciliada sem
alterar expectativas. A próxima etapa continua sendo revisão humana; seed,
homologação e produção permanecem gates separados.
