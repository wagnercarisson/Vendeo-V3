# F56.2.2 — Plano 09: itens adiados (fora de escopo)

Durante uma execução ampla acidental do Vitest (o filtro de arquivo via splatting do
PowerShell não foi aplicado na primeira tentativa), foram observadas falhas **pré-existentes**
e NÃO relacionadas a este plano. Elas estão FORA de escopo (a verificação do Plano 09 roda
apenas as 6 suítes de integração da b1b, que passam 44/44 com 0 skipped).

## Falhas pré-existentes observadas (não corrigidas)

| Arquivo | Sintoma | Observação |
|---|---|---|
| `src/lib/lab/bench/domain/__tests__/intent-schema.contract.test.ts` | 5 falhas | schema da bancada exige `backgroundDirection` |
| `src/lib/lab/bench/__tests__/branding-service.test.ts` | 3 falhas | `missing_campaign_snapshot:bench_background_direction_required` |
| `src/lib/lab/bench/__tests__/prompt-base.contract.test.ts` | 3 falhas | idem (briefing da bancada) |
| `src/lib/lab/bench/__tests__/form-parity.contract.test.ts` | 2 falhas | idem |
| `src/lib/lab/bench/__tests__/run-history.contract.test.ts` | 1 falha | idem |
| `src/lib/legal/__tests__/legal-document-versions.test.ts` | 1 falha | arquivo `openspec/changes/.../terms-of-service-v1-5.md` ausente |
| `src/__tests__/api/campaign-page-server.test.tsx` | 3 falhas | mock de `@/lib/campaign/display` sem `mapNewFlowDisplayState` (arquivo do Plano 06) |
| `src/lib/visual-signature/__tests__/ai-image-generator.test.ts` | timeout | teste aguarda provider; timeout de 5s |
| `src/lib/image-generation/providers/__tests__/openai-provider.test.ts` | timeout | idem |
| `src/lib/image-generation/services/__tests__/image-generation-service.test.ts` | timeout | idem |
| `src/lib/lab/bench/__tests__/candidate-manifest-isolation.test.ts` | timeout | varredura de arquivos |

> Nenhuma dessas falhas é causada pelas mudanças do Plano 09 (novos arquivos de teste de
> integração + runner + evidência). Não foram corrigidas (boundary de escopo). Encaminhar
> ao responsável/verificação da fase se aplicável.
