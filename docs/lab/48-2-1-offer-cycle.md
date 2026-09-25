# F48.2.1 — Ciclo de otimização do Diretor `offer`

> Registro canônico do ciclo controlado do prompt `campaign-image-director-offer`
> (D6/D8). Documenta a hipótese, a candidata, o experimento congelado, a
> avaliação cega e a decisão. **Nenhuma promoção automática**: a promoção é
> diferida para a F48.2.3. O prompt oficial `prompts/campaign-image-director-offer.md`
> permanece **intocado byte a byte**.

## Baseline inspecionado

| Campo | Valor |
|---|---|
| prompt oficial (somente leitura) | `prompts/campaign-image-director-offer.md` |
| `baselineBytes` | `2995` |
| `contentHash` (baseline) | `354ea9139f41c70a27887eb1b6ed83482e844f23bd7544fd3dd9e7180d39667c` (conteúdo oficial atual; nunca alterado) |

## Hipótese (uma classe de falha)

| Campo | Valor |
|---|---|
| classe de falha | `invented_information` |
| origem | diagnóstico `f37-prompt-diagnostics.v3.json` (`diagnosticVersion: 3`, `kind: hypothesis`, `promptTreatable: true`) |
| `failureCode` | `invented_information` |
| `promptName` | `campaign-image-director-offer` |
| evidência | Hipótese derivada da taxonomia de relatos elegíveis da F37 (D37.2-R2 / §4: "Informação inventada"). A IA textual não lê a imagem e o relato é aceito pela declaração; é uma taxonomia com exemplos hipotéticos, não uma ocorrência observada. |
| causa provável | O prompt do Diretor de oferta pode não proibir explicitamente complementar o brief com informação inventada. |
| hipótese mínima | Reforçar a proibição de inventar informação comercial ausente no brief, sem adicionar exemplos. |

## Candidata v1

| Campo | Valor |
|---|---|
| arquivo | `fixtures/lab/prompts/offer/v1-candidate.md` |
| prompt-alvo | `campaign-image-director-offer` |
| `baselineBytes` | `2995` |
| `candidateBytes` | `2976` |
| `sizeDelta` | `-19` (candidata 19 bytes mais curta) |
| `contentHash` | `6507995b5333cebcd12d2ac8ce22a1218405ac5d1c724a63d01c74cd7be4378a` |

### Regras de simplicidade aplicadas

- **Uma classe de falha:** a candidata ataca somente `invented_information`.
- **Reorganizar/esclarecer antes de adicionar:** as proibições dispersas de
  invenção (badge, selo, preços, prazos, garantias, parcelamento, frete) foram
  **consolidadas** em uma única diretriz explícita nos "Instruções Obrigatórias",
  e a duplicação foi removida da diretriz de badge — sem adicionar exemplos.
- **Sem nomes/exemplos das fixtures:** nenhum nome de cenário/produto real.
- **Sem duplicar validações do código:** a candidata não repete validações que o
  renderer/pipeline já garantem.
- **Tamanho e justificativa:** a candidata é **mais curta** que o baseline
  (`sizeDelta = -19`); o ganho vem da consolidação, não de cortes de conteúdo.
- **Sem conteúdo sensível:** nenhuma chave/token/URL/DSN (recusa
  `sensitive_prompt_content`).
- **Prompt oficial intocado:** `git status --porcelain prompts/` vazio.

## Experimento v1

_Preenchido na Task 3 (criação do experimento + estimativa). Nenhuma chamada paga
ocorre antes da decisão do Checkpoint 3._
