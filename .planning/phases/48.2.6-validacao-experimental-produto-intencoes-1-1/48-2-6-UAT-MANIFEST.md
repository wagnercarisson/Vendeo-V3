---
phase: 48.2.6-validacao-experimental-produto-intencoes-1-1
status: complete
decision: approved_with_limitations
updated: 2026-10-05
---

# F48.2.6 — Manifesto documental do candidato

## Estado

- **Task 0 — reexecução final 2026-10-04:** testes focados de política/composer/snapshot/preflight, architecture guard e contratos UI/API = 7 arquivos, 329 testes PASS (inclui os testes adicionais de visibilidade de validade); typecheck/lint/build/OpenSpec strict/diff-check PASS. As contagens anteriores de 327 e 328 correspondem a execuções antes dos testes adicionais de validade. Produto é `48.2.6-produto-v4`; compositor vigente `48.2.4-prompt-composer-v5`. Nome único testado com e sem ponto final; instruções de imagem variam por contagem e foram testadas nas três intenções. Isso não altera slots/candidatos nem atribui versão a relatos manuais.
- **CHECKPOINT B:** `approved_with_limitations` por decisão explícita do usuário. As avaliações dos dois runs finais são aprovadas para este UAT; limitações e pendências permanecem listadas abaixo. Nenhum teste técnico da Task 0 permanece pendente.

- **Natureza:** documental; sem loader, runtime ou integração produtiva.
- **Candidato:** nenhum pacote/candidato global foi aprovado ou promovido. OF-A histórico mantém `requer ajuste`; os dois runs finais têm avaliações visuais aprovadas somente para este UAT.
- **Promoção:** não; pacote não é carregado por runtime.
- **CHECKPOINT A:** aprovado somente para readiness local/documentos do Plano 09.
- **CHECKPOINT B:** `approved_with_limitations`; esta decisão não equivale ao fechamento da fase, promoção ou lifecycle OpenSpec.
- **UAT:** OF-A histórico mantém `requer ajuste`. Os dois runs finais corrigidos foram vinculados por Run ID e aprovados visualmente pelo usuário para este UAT, incluindo fidelidade de produto/embalagem nos testes examinados. O usuário confirmou que a plataforma exibiu US$0,05/US$0,03 arredondados; isso não comprova fatura. Cálculos locais precisos e provider-reported null permanecem separados. Atribuições a slots planejados não comprovadas ficam `pending`.
- **Exclusivo v1:** o usuário relata que a primeira arte foi considerada publicável, mas a diferenciação visual da intenção ficou inconclusiva; preservada como evidência histórica `48.2.6-exclusivo-v1`. Nenhum dos dois runs finais abaixo foi vinculado a essa arte histórica; Run ID/slot/background v1 permanecem pendentes.
- **Johnnie Walker:** o relato manual `750ml` está ligado ao run final Exclusivo `2fb07e0e-37cc-40d0-8a53-fa380f7eef81` por intenção/produto/snapshot local. Não há slot planejado comprovadamente correspondente; o slot permanece `pending`. Run armazenou Produto v4/compositor v5.
- **Destaque — validação visual anterior:** o usuário informa que já validou visualmente esta intenção em testes anteriores. Run ID e versões da geração avaliada permanecem `pending`; a prévia compilada em Produto v4/compositor v5 foi conferida separadamente e não conta como geração.
- **Fidelidade visual:** o usuário aprovou produto/embalagem somente nos dois runs finais examinados. Em um teste examinado, letras muito pequenas foram omitidas em vez de inventadas; o run específico dessa observação permanece `pending`. Não estender a outros runs.
- **Limitações aceitas no B:** slot IDs dos dois runs; Run ID/versões da validação anterior de Destaque; run específico da observação sobre letras pequenas; demais slots e critérios sem evidência. A prévia Destaque v4/v5 foi conferida à parte e não é uma geração. Essas lacunas permanecem `pending`, sem conversão em resultados.
- **Histórico:** a comparação Exclusivo v1 × v2 foi apenas planejada; v2 não teve tentativa visual.
- **Comparação atual preparada:** Exclusivo v1 × v3 é antes × depois, não controlada para isolar Exclusivo: Produto, compositor e instrução de fundo também mudaram. Usar dados/imagem e Sunburst medium somente se confirmados; a direção de fundo v1 fica `pending` sem evidência. Não atribuir diferenças somente à política Exclusivo. Sem slot, Run ID ou linkage inventado; não executada.
- **Modelo/protocolo inicial previsto:** `gpt-image-2.5-sunburst` / `medium` / `images`; sem comparação de modelos.

## Versões de referência previstas

| Dimensão | Versão |
|---|---|
| Política Oferta | `48.2.6-oferta-v1` |
| Política Destaque | `48.2.6-destaque-v1` |
| Política Exclusivo vigente | `48.2.6-exclusivo-v3` |
| Política Produto | `48.2.6-produto-v4` |
| Prompt-base neutro | `48.2.6-produto-1-1-v1` |
| Compositor | `48.2.4-prompt-composer-v5` |
| Pricing local | `2026-10-bench-3` |

## Runs finais verificados localmente (read-only)

| Run ID | Intent / produto / loja | Inputs na ordem do array persistido | Versões do run | Prompt aprovado/enviado | Usage / latência | Cálculo local / exibição plataforma / provider | Resultado visual (usuário) |
|---|---|---|---|---|---|---|---|
| `1ca08368-9a81-4671-9ca6-50032feac231` | Oferta / Bebida 51 Ice 275ml Sabores / Adega Mestre das Geladas | 3 (`0.webp`, `1.webp`, `2.webp`), artifacts conferidos | Produto v4, Oferta v1, compositor v5 | `compiled=approved=sent`; 2.217 caracteres | 5.120 tokens / 22.595 s | Local `US$ 0.048863` (`bench_local_pricing`/`2026-10-bench-3`); plataforma exibiu US$0,05 arredondado, confirmado pelo usuário; provider-reported `null` | Aprovada para este UAT: limão protagonista; informações comerciais/obrigatórias legíveis; fidelidade produto/embalagem aprovada |
| `2fb07e0e-37cc-40d0-8a53-fa380f7eef81` | Exclusivo / Johnnie Walker 750ml Black Label / Adega Mestre das Geladas | 1 (`0.jpg`), artifact conferido | Produto v4, Exclusivo v3, compositor v5 | `compiled=approved=sent`; 2.069 caracteres | 2.861 tokens / 20.783 s | Local `US$ 0.030974` (`bench_local_pricing`/`2026-10-bench-3`); plataforma exibiu US$0,03 arredondado, confirmado pelo usuário; provider-reported `null` | Aprovada para este UAT: `750ml` visível, sem preço, composição sóbria; fidelidade produto/embalagem aprovada |

Ver hashes dos prompts, operation IDs, snapshots embutidos, artifact IDs/checksums, dimensões dos inputs e mais campos em `48-2-6-B-CHECKPOINT.md`. A base não persiste slot ID; as atribuições formais dos dois runs corretos ficam `pending`. Os valores exibidos na plataforma foram confirmados pelo usuário como arredondados; não constituem verificação de fatura. Runs corretos registram Produto v4/compositor v5.

### Runs históricos que estavam associados por engano

| Run ID | Snapshot | Inputs / fundo | Versões | Custo local | Tratamento |
|---|---|---|---|---|---|
| `2a01db63-bac6-4c42-852c-46a4f5e854d3` | Oferta / 51 Ice | 3 refs / ambientado | Produto v3 / compositor v4 | `0.048938`, `bench_local_pricing` | Histórico; não é a arte final avaliada |
| `da2f2321-c748-4d35-bdc9-0ed6fd070c8c` | Exclusivo / Johnnie Walker 750ml | 1 ref / estúdio | Produto v3 / compositor v4 | `0.031174`, `bench_local_pricing` | Histórico; não é a arte final avaliada |

Versões de formato, estrutura, tema e integridade geral serão copiadas para cada ficha somente quando constarem de evidência real do respectivo run.

## Rastreamento de slots planejados (sem atribuição não comprovada)

| Slot | Run ID | Snapshot/lineage | Preflight/prompt evidence | Pricing/usage/latency | Avaliação/decisão | Estado |
|---|---|---|---|---|---|---|
| OF-A | `[pending]` | `[pending]` | `[pending]` | Relato do usuário: Sunburst medium, 1 imagem, 24.6 s, usage informado sem valores numéricos; custo local calculado USD 0.03 (não é custo reportado/confirmado/faturado pela plataforma) | Usuário: omitiu “Mouse sem fio”; imagem fiel, frases criativas genéricas aceitas, preço/selo/validade/textos obrigatórios presentes | `requer ajuste` |
| OF-B | `[pending]` | `[pending]` | `[pending]` | `[pending]` | `[pending]` | `pending` |
| DE-A | `[pending]` | `[pending]` | `[pending]` | `[pending]` | `[pending]` | `pending` |
| DE-B | `[pending]` | `[pending]` | `[pending]` | `[pending]` | `[pending]` | `pending` |
| EX-A | `[pending]` | `[pending]` | `[pending]` | `[pending]` | `[pending]` | `pending` |
| EX-B | `[pending]` | `[pending]` | `[pending]` | `[pending]` | `[pending]` | `pending` |

Relato do usuário para NovaTek/Oferta: modelo/qualidade `gpt-image-2.5-sunburst` / `medium`, uma imagem de referência, duração de 24.6 segundos, usage informado sem detalhamento numérico e custo local calculado USD 0.03. USD 0.03 é somente cálculo local — não é custo reportado pela plataforma, confirmado pela plataforma ou faturado. O resultado omitiu “Mouse sem fio”, requer ajuste; imagem fiel, frases criativas genéricas aceitas, preço/selo/validade/textos obrigatórios presentes. Nenhuma consulta local foi feita para recuperar metadados desse OF-A; a consulta posterior foi restrita aos dois Run IDs finais desta seção. Run ID, snapshot/linhagem, evidência de política/prompt e custo de plataforma de OF-A permanecem pendentes; detalhamento numérico exato de usage não foi fornecido. A comparação proposta para esse relato não foi executada; qualquer follow-up requer autorização humana específica.

Relato do usuário para Exclusivo v1: primeira arte considerada publicável; diferenciação visual para a intenção permanece inconclusiva. Versão informada para a evidência anterior: `48.2.6-exclusivo-v1`, preservada sem sobrescrita. Nenhum slot, Run ID, dado/imagem vinculado ou outro metadado foi fornecido nesta atualização; o linkage permanece `pending`. A comparação v1 × v3 está classificada como antes × depois, não controlada para isolar Exclusivo, pois Produto, compositor e instrução de fundo também mudaram; dados, imagem e fundo v1 permanecem `pending` quando não comprovados.

Sem inventar IDs, snapshots, prompts, resultados ou custos; campos ficam `pending` até o responsável fornecer evidência. Custo observado/estimado por run e respectiva fonte serão registrados separadamente de tarifa e usage. `partial` é somente estimativa de saída, não total ou teto.

## Restrições de candidato

- Nenhuma nova tabela/schema/persistência duplicada.
- Nenhum loader ou runtime de candidato.
- Nenhuma promoção produtiva.
- CHECKPOINT B está aprovado explicitamente como `approved_with_limitations`; critérios sem evidência continuam `pending` e não há promoção.
- Ações de lifecycle OpenSpec permanecem sob responsabilidade do responsável do projeto.
- Este manifesto e o UAT registram somente evidência/decisões fornecidas; não autorizam nem executam provider, run, gasto ou geração adicional. O closeout técnico/OpenSpec lifecycle permanecem em andamento.
