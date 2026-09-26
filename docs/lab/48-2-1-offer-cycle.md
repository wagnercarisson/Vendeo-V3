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

| Campo | Valor |
|---|---|
| `experimentId` | `c48e21b5-c7a8-4456-a0d6-a2b4040fc1e3` |
| `campaignIntent` | `offer` |
| `programId` | `860ca4fe-dc8b-4354-b94e-02f9e7b202c6` (`matrix-v1`, `status='authorized'`) |
| prompt sob teste | `campaign-image-director-offer` (derivado do intent) |
| modelo fixo | `openai / gpt-5.5 / responses` |
| status | `ready` |

### Configuração congelada

**3 cenários × 2 variantes × 2 repetições = 12 runs.**

| Cenário (`slug`) | `scenario_version_id` | versão |
|---|---|---|
| `produto-oferta-preco` | `c1154292-bf50-46e8-a8a1-7d032337788d` | 1 |
| `produto-oferta-texto-obrigatorio` | `52228f1c-c1ab-4f3d-b256-d274eaab445d` | 1 |
| `produto-oferta-logo` | `2233bf8a-1589-4f0b-8ce3-d01055b4afe9` | 1 |

| Variante | origem | `contentHash` |
|---|---|---|
| `baseline` | `official` | `354ea9139f41c70a27887eb1b6ed83482e844f23bd7544fd3dd9e7180d39667c` |
| `candidate` | `override` (`v1-candidate.md`) | `6507995b5333cebcd12d2ac8ce22a1218405ac5d1c724a63d01c74cd7be4378a` |

### Estimativa e saldo (sem chamada paga)

| Campo | Valor |
|---|---|
| `totalEstimatedUsd` | `0.78` (12 runs × `0.065`/run) |
| `perRun.estimatedCostUsd` | `0.065` (cobertura `partial`) |
| `coverage` | `partial` (pricing parcial — a UI sinaliza faixa/aviso) |
| `programRemainingUsd` | `2.808` (`budget_usd 2.808 − consumed 0 − reserved 0`) |

**Nenhuma chamada paga nesta task:** `lab_runs` do experimento = `0`. A execução
dos 12 runs depende da autorização do **Checkpoint 3** (Task 4).

## Interrupção do ciclo (Checkpoint 3)

| Campo | Valor |
|---|---|
| decisão | `interromper` — decisão humana explícita de parada controlada |
| registrado em | `2026-09-26T22:57:30.735Z` |
| momento | Task 4/22 (Checkpoint humano 3), **antes de qualquer run pago** |
| runs existentes | `0` (`lab_runs` do experimento = `0`; `lab_runs` totais = `0`) |
| orçamento reservado | `0.000000` USD |
| orçamento consumido | `0.000000` USD |
| candidata aprovada | nenhuma |
| variante vencedora | nenhuma |
| estado do experimento | `ready` (não executado) |
| próximo passo | realinhamento da fase F48.2.1 antes de retomar; nenhum plano seguinte iniciado |

A execução dos 12 runs **não foi autorizada**. O ciclo do `offer` permanece
suspenso; nenhuma promoção, recomendação ou aprovação foi registrada. O prompt
oficial permanece intocado (`git status --porcelain prompts/` vazio).
