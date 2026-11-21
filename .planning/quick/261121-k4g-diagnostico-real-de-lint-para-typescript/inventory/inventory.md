# Inventário do lint diagnóstico

Gerado por `scripts/lint/build-inventory.mjs` (API do ESLint,
`allowInlineConfig: false`). Nenhum módulo da aplicação é carregado;
nenhum banco, Storage ou rede é acessado. Caminhos relativos ao repositório.

## Versões

| Ferramenta | Versão |
| --- | --- |
| Node | `v24.13.1` |
| ESLint | `10.4.0` |
| typescript-eslint | `8.73.0` |
| eslint-plugin-react-hooks | `7.1.1` |

## Totais

- Arquivos analisados: **1964**
- Erros: **0** | Warnings: **373**
- Mensagens fatais (parse/arquivo): **0**
- Avisos de configuração (`ruleId: null`): **0**
- Erros de configuração ("Definition for rule"): **0**
- Exit code de execução estrita (`--max-warnings 0`): **1**

Achados de regra são dados do diagnóstico; não são falha deste gerador.

## Por regra

| Regra | Severidade | Ocorrências | Arquivos |
| --- | --- | --- | --- |
| `@typescript-eslint/no-unused-vars` | warn | 350 | 198 |
| `react-hooks/exhaustive-deps` | warn | 23 | 7 |

## Por área

| Área | Arquivos | Erros | Warnings |
| --- | --- | --- | --- |
| src-tests | 880 | 0 | 220 |
| components | 147 | 0 | 68 |
| lib | 560 | 0 | 52 |
| app | 256 | 0 | 27 |
| hooks | 5 | 0 | 3 |
| tools | 97 | 0 | 3 |
| src-other | 1 | 0 | 0 |
| tests | 6 | 0 | 0 |
| tracking-evidence | 10 | 0 | 0 |
| types | 2 | 0 | 0 |

## Arquivos com mais ocorrências

| Arquivo | Erros | Warnings |
| --- | --- | --- |
| `src/app/api/campaign/generate-image/__tests__/route.test.ts` | 0 | 13 |
| `src/components/flow/use-campaign-form.ts` | 0 | 13 |
| `src/components/flow/visual-signature-approval-modal.tsx` | 0 | 13 |
| `src/components/flow/store-identity-form.tsx` | 0 | 12 |
| `src/lib/product-two-format/orchestration/__tests__/support/joint-offline-world.ts` | 0 | 8 |
| `src/lib/lab/api/__tests__/fake-supabase-client.ts` | 0 | 7 |
| `src/lib/campaign/vertical-expansion/__tests__/model.contract.test.ts` | 0 | 6 |
| `src/lib/product-two-format/__tests__/square-probe.contract.test.ts` | 0 | 6 |
| `src/lib/ai/__tests__/product-1-1-image-usage-integration.test.ts` | 0 | 5 |
| `src/lib/metrics/pipeline-metrics.ts` | 0 | 5 |
| `src/app/api/store/[id]/brand-profile/infer/__tests__/route.test.ts` | 0 | 4 |
| `src/app/api/store/[id]/logo/retry-brand-director/__tests__/retry-route.test.ts` | 0 | 4 |
| `src/components/flow/__tests__/use-drift-detection.test.ts` | 0 | 4 |
| `src/lib/image-generation/services/image-generation-service.ts` | 0 | 4 |
| `src/lib/product-9-16-two-stage/__tests__/resolve-unknown-source.contract.test.ts` | 0 | 4 |
| `src/__tests__/lib/campaign/list.test.ts` | 0 | 3 |
| `src/app/api/campaign/generate-image/__tests__/route.integration.test.ts` | 0 | 3 |
| `src/app/api/store/[id]/brand-profile/generate-without-logo/__tests__/generate-route.test.ts` | 0 | 3 |
| `src/app/api/store/[id]/brand-profile/realign/__tests__/realign-route.test.ts` | 0 | 3 |
| `src/app/api/store/[id]/visual-signature/approve/__tests__/approve-route.test.ts` | 0 | 3 |
| `src/components/flow/__tests__/visual-signature-history-modal.test.tsx` | 0 | 3 |
| `src/components/flow/drift-critical-modal.tsx` | 0 | 3 |
| `src/components/flow/use-store-form.ts` | 0 | 3 |
| `src/components/flow/visual-signature-modal.tsx` | 0 | 3 |
| `src/hooks/use-onboarding-tabs.ts` | 0 | 3 |

## Cobertura

- Baseline: **80** arquivos (.mjs: 79; .js: 1).
- Diagnóstico: **1964** arquivos (.ts: 1442; .tsx: 442; .mjs: 76; .d.ts: 2; .d.mts: 1; .js: 1).
- Arquivos removidos: **8**.
  - `supabase/.temp/landing-lab/import-approved-stores.mjs` — diretório gerado/ignorado (runtime, gitignored)
  - `supabase/.temp/landing-lab/lab-connection.mjs` — diretório gerado/ignorado (runtime, gitignored)
  - `supabase/.temp/landing-lab/quick-evidence/check-approved.mjs` — diretório gerado/ignorado (runtime, gitignored)
  - `supabase/.temp/landing-lab/quick-evidence/list-stores.mjs` — diretório gerado/ignorado (runtime, gitignored)
  - `supabase/.temp/landing-lab/quick-evidence/uat-logo.mjs` — diretório gerado/ignorado (runtime, gitignored)
  - `supabase/.temp/landing-lab/setup-admin.mjs` — diretório gerado/ignorado (runtime, gitignored)
  - `supabase/.temp/landing-lab/start-web.mjs` — diretório gerado/ignorado (runtime, gitignored)
  - `supabase/.temp/landing-lab/verify-web.mjs` — diretório gerado/ignorado (runtime, gitignored)
- Arquivos adicionados: **1892**.
- Extensões recém-cobertas: .ts: 1442; .tsx: 442; .d.ts: 2; .d.mts: 1.

## Mensagens fatais

Nenhuma.

## Avisos de configuração (`ruleId: null`)

Nenhum.

## Erros de configuração

Nenhum.

## Diretivas de supressão encontradas

As diretivas NÃO são aplicadas no diagnóstico (inline config desligada) e
NÃO foram removidas. Ocorrências antes suprimidas por elas aparecem nas contagens.

| Diretiva | Regra | Ocorrências |
| --- | --- | --- |
| `eslint-disable-next-line` | `@next/next/no-img-element` | 16 |
| `eslint-disable-next-line` | `react-hooks/exhaustive-deps` | 4 |
| `eslint-disable-next-line` | `@typescript-eslint/no-explicit-any` | 3 |
| `eslint-disable-line` | `react-hooks/exhaustive-deps` | 1 |
| `eslint-disable-next-line` | `no-control-regex` | 1 |

Arquivos e linhas:
- `src/app/(app)/admin/campaign-reports/[reportId]/page.tsx:159` — `@next/next/no-img-element` (eslint-disable-next-line)
- `src/components/flow/store-identity-form.tsx:416` — `react-hooks/exhaustive-deps` (eslint-disable-next-line)
- `src/components/flow/use-campaign-form.ts:1397` — `react-hooks/exhaustive-deps` (eslint-disable-line)
- `src/components/flow/use-drift-detection.ts:173` — `react-hooks/exhaustive-deps` (eslint-disable-next-line)
- `src/components/landing/campanhas/campanhas-header.tsx:13` — `@next/next/no-img-element` (eslint-disable-next-line)
- `src/components/landing/campanhas/demonstration-case.tsx:76` — `@next/next/no-img-element` (eslint-disable-next-line)
- `src/components/landing/campanhas/demonstration-case.tsx:131` — `@next/next/no-img-element` (eslint-disable-next-line)
- `src/components/landing/floriculturas/demonstration-pair.tsx:42` — `@next/next/no-img-element` (eslint-disable-next-line)
- `src/components/landing/floriculturas/floriculturas-header.tsx:14` — `@next/next/no-img-element` (eslint-disable-next-line)
- `src/components/landing/floriculturas/offer-example.tsx:31` — `@next/next/no-img-element` (eslint-disable-next-line)
- `src/components/landing/mercados/coffee-example.tsx:30` — `@next/next/no-img-element` (eslint-disable-next-line)
- `src/components/landing/mercados/demonstration-pair.tsx:55` — `@next/next/no-img-element` (eslint-disable-next-line)
- `src/components/landing/mercados/demonstration-pair.tsx:104` — `@next/next/no-img-element` (eslint-disable-next-line)
- `src/components/landing/mercados/mercados-header.tsx:13` — `@next/next/no-img-element` (eslint-disable-next-line)
- `src/components/landing/padarias/bread-example.tsx:28` — `@next/next/no-img-element` (eslint-disable-next-line)
- `src/components/landing/padarias/demonstration-pair.tsx:38` — `@next/next/no-img-element` (eslint-disable-next-line)
- `src/components/landing/padarias/demonstration-pair.tsx:87` — `@next/next/no-img-element` (eslint-disable-next-line)
- `src/components/landing/padarias/padarias-header.tsx:13` — `@next/next/no-img-element` (eslint-disable-next-line)
- `src/components/landing/public-footer.tsx:51` — `@next/next/no-img-element` (eslint-disable-next-line)
- `src/hooks/use-onboarding-tabs.ts:437` — `react-hooks/exhaustive-deps` (eslint-disable-next-line)
- `src/hooks/use-onboarding-tabs.ts:575` — `react-hooks/exhaustive-deps` (eslint-disable-next-line)
- `src/lib/brand-assets/__tests__/brand-director.test.ts:246` — `@typescript-eslint/no-explicit-any` (eslint-disable-next-line)
- `src/lib/brand-assets/__tests__/brand-director.test.ts:248` — `@typescript-eslint/no-explicit-any` (eslint-disable-next-line)
- `src/lib/brand-assets/__tests__/brand-director.test.ts:251` — `@typescript-eslint/no-explicit-any` (eslint-disable-next-line)
- `src/lib/product-1-1/testing/suite-skip-guard.ts:61` — `no-control-regex` (eslint-disable-next-line)

## Limitações

- Sem regras type-aware (nenhum `parserOptions.project`): o diagnóstico não
  usa inferência de tipos; regras que exigem tipo não estão habilitadas.
- Sem presets (`typescript-eslint`/`next`/`@eslint/js`): apenas as regras
  declaradas no config, portanto o número de achados é menor que um preset estrito.
- `next-env.d.ts` é gerado e ignorado; `.d.ts` de `src/` são analisados.
- Diretivas inline estão desligadas: este diagnóstico não mede "o que o lint
  oficial reportaria com supressões", e sim o código sem supressões.
- Este diagnóstico NÃO é gate de release: não está em `lint`, `build`,
  `vercel.json` ou CI.
