# F48.2.6 — CHECKPOINT B: aprovado com limitações

**Decisão formal:** `approved_with_limitations`, registrada após aprovação explícita do usuário. Isso aprova o CHECKPOINT B; o closeout da fase e o lifecycle OpenSpec ainda estão pendentes.

## Fonte da evidência

- Runs e artifacts consultados somente na base Supabase local, em transações PostgreSQL `READ ONLY` com `ROLLBACK`; nenhuma consulta remota ou escrita foi executada.
- O usuário forneceu as avaliações visuais. A consulta ao banco apenas vinculou os runs e seus metadados; não houve OCR, avaliação visual automática ou chamada ao provider.
- Ambos os runs têm `compiled = approved = sent` confirmado na base. O hash indicado abaixo é MD5 do conteúdo armazenado e o tamanho é em caracteres.
- A base não persiste `slot_id` nem um UUID separado de snapshot: os snapshots estão embutidos nas linhas de run. O vínculo a slots planejados fica `pending` se a correspondência não puder ser comprovada sem inferência.

## Run final correto — Oferta / 51 Ice

| Campo | Evidência conferida |
|---|---|
| Run ID / operation ID | `1ca08368-9a81-4671-9ca6-50032feac231` / `70fca476-d50f-4193-8ddd-403410132eac` |
| Estado / horários UTC | `succeeded`; criado `2026-10-04 21:28:12.294398+00`; iniciado `21:31:58.130+00`; concluído `21:32:20.814+00` |
| Snapshot da campanha | Adega Mestre das Geladas; `Bebida 51 Ice 275ml Sabores`; Oferta; original `R$ 8,99`, venda `R$ 7,99`, selo `Promoção`, validade `enquanto durarem os estoques`; textos legais guardados no snapshot |
| Configuração | Produto 1:1; `gpt-image-2.5-sunburst`, `medium`, `images`, `1024x1024`; direção `studio` |
| Imagens do produto, ordem do array `references` | `0`: `inputs/0.webp`, 600×600, artifact `d572dba4-a971-4c30-893f-b2b84e0912a9`; `1`: `inputs/1.webp`, 1000×1000, artifact `57e94eae-d8bf-4089-9edc-0257b1749331`; `2`: `inputs/2.webp`, 1000×1000, artifact `ce39d2a5-3e37-484c-8893-10551640fb0b`. Os artifacts persistidos confirmam a ordem `0 → 1 → 2`. |
| Imagem final | `bench/1ca08368-9a81-4671-9ca6-50032feac231/output.png`; artifact `1d1a36e4-5c4e-45ed-888c-b0762ef6127e`; PNG 1024×1024, 1,575,770 bytes |
| Versões armazenadas no run | Produto `48.2.6-produto-v4`; Oferta `48.2.6-oferta-v1`; compositor `48.2.4-prompt-composer-v5`; prompt-base `48.2.6-produto-1-1-v1`; pricing `2026-10-bench-3` |
| Prompt aprovado/enviado | `prompt_compiled = prompt_approved = prompt_sent` (`true`); 2.217 caracteres; MD5 aprovado e enviado `430d949e7fcc938af6f3530b88959b94`. O prompt guardado contém a serialização de nome Produto v4, `Imagens de referência: 3` e a direção `studio`. |
| Usage / latência | 5.120 tokens totais: 4.681 prompt, 585 texto de entrada, 4.096 imagem de entrada, 439 saída de imagem, 0 saída de texto; latência `22.595 s` |
| Custo por fonte | Cálculo local: `estimated_cost_usd=0.048863`, `bench_local_pricing`, regra `2026-10-bench-3`, coverage `partial`. Valor exibido individualmente na plataforma, conforme confirmação do usuário: **US$ 0,05 arredondado**. `provider_reported_cost_usd=null`; exibição não comprova fatura. |
| Slot | `pending`: o run não persiste slot ID; a correspondência documental OF-B é apenas compatível com Adega/Oferta/três imagens, não uma atribuição persistida. |
| Avaliação manual do usuário | **Arte aprovada para este UAT:** limão protagonista; informações comerciais e obrigatórias legíveis; fidelidade do produto/embalagem aprovada nos testes examinados. |

## Run final correto — Exclusivo / Johnnie Walker 750ml

| Campo | Evidência conferida |
|---|---|
| Run ID / operation ID | `2fb07e0e-37cc-40d0-8a53-fa380f7eef81` / `3df6245a-9d96-4fe1-8f78-f7946108a213` |
| Estado / horários UTC | `succeeded`; criado `2026-10-04 21:34:43.006524+00`; iniciado `21:35:05.948+00`; concluído `21:35:26.802+00` |
| Snapshot da campanha | Adega Mestre das Geladas; `Johnnie Walker 750ml Black Label`; Exclusivo; nenhum preço registrado; selo `Premium`; textos legais guardados no snapshot |
| Configuração | Produto 1:1; `gpt-image-2.5-sunburst`, `medium`, `images`, `1024x1024`; direção `studio` |
| Imagens do produto, ordem do array `references` | Uma referência: `inputs/0.jpg`, 722×1200, artifact `d8daffa4-c7ff-41c1-859c-16d05030c6c5`. |
| Imagem final | `bench/2fb07e0e-37cc-40d0-8a53-fa380f7eef81/output.png`; artifact `da332fe4-9618-4a02-ab8c-0435be32e413`; PNG 1024×1024, 1,370,536 bytes |
| Versões armazenadas no run | Produto `48.2.6-produto-v4`; Exclusivo `48.2.6-exclusivo-v3`; compositor `48.2.4-prompt-composer-v5`; prompt-base `48.2.6-produto-1-1-v1`; pricing `2026-10-bench-3` |
| Prompt aprovado/enviado | `prompt_compiled = prompt_approved = prompt_sent` (`true`); 2.069 caracteres; MD5 aprovado e enviado `937fbf5f2ed851bdb713fd74dcc967cd`. O prompt guardado contém `Johnnie Walker 750ml Black Label`, uma referência e a instrução Exclusivo v3. |
| Usage / latência | 2.861 tokens totais: 2.422 prompt, 524 texto de entrada, 1.898 imagem de entrada, 439 saída de imagem, 0 saída de texto; latência `20.783 s` |
| Custo por fonte | Cálculo local: `estimated_cost_usd=0.030974`, `bench_local_pricing`, regra `2026-10-bench-3`, coverage `partial`. Valor exibido individualmente na plataforma, conforme confirmação do usuário: **US$ 0,03 arredondado**. `provider_reported_cost_usd=null`; exibição não comprova fatura. |
| Slot | `pending`: não há slot planejado comprovadamente correspondente a Adega/Exclusivo/uma imagem, e a base não persiste slot ID. |
| Avaliação manual do usuário | **Arte aprovada para este UAT:** `750ml` aparece, não há preço e a composição é sóbria; fidelidade do produto/embalagem aprovada nos testes examinados. |

## Runs históricos anteriores — associação final corrigida

Os runs abaixo foram associados por engano às avaliações visuais na versão anterior deste relatório. Permanecem registrados como evidência histórica local, sem receber as avaliações finais fornecidas pelo usuário.

| Run ID / operation ID | Snapshot / condições | Inputs em ordem / output | Versões / prompt aprovado=enviado | Usage / latência | Cálculo local / fonte |
|---|---|---|---|---|---|
| `2a01db63-bac6-4c42-852c-46a4f5e854d3` / `fc7a7f05-9117-47ab-a4cc-4e9181ccd8e5` | `succeeded`; Adega Mestre; Oferta 51 Ice; R$8,99→R$7,99, Promoção, validade enquanto durarem os estoques; fundo ambient | `0.webp`→`1.webp`→`2.webp` (artifacts `a5acbe89-0267-41b3-bf1e-633bce9c7708`, `5fef4ef0-67ff-46fa-a97f-98a4d7cb6861`, `6fbb714e-697d-4cf7-9499-ba42decb5117`); output artifact `6e260b59-7624-40ef-84a6-ff84270d7745` | Produto v3 / Oferta v1 / composer v4; compiled=approved=sent; 2.296 chars, MD5 `61ffb9be22211d6c3178cf140c35e601` | 5.135 tokens / 24.356 s | `0.048938`, `bench_local_pricing`; provider cost `null` |
| `da2f2321-c748-4d35-bdc9-0ed6fd070c8c` / `d788a8b1-aaea-4ef0-bb2c-d169fe8ffccf` | `succeeded`; Adega Mestre; Exclusivo Johnnie Walker 750ml Black Label; sem preço; selo Premium; fundo studio | `0.jpg` (artifact `2b0a1827-769c-406f-8985-582a9efadcb5`); output artifact `d3c594e9-e1d6-4be8-a7db-63e5b62555e2` | Produto v3 / Exclusivo v3 / composer v4; compiled=approved=sent; 2.255 chars, MD5 `3d866e9492a9afa45b17dc5a866a149f` | 2.901 tokens / 20.638 s | `0.031174`, `bench_local_pricing`; provider cost `null` |

## Limitações e follow-ups aceitos

- Ambos os runs finais corretos registram Produto v4 e compositor v5.
- O usuário informa que, em um teste examinado, letras muito pequenas demais para reprodução foram deixadas sem texto pelo diretor em vez de inventadas. O run específico dessa observação não foi identificado; associação de run permanece `pending` e o achado não se estende a runs não examinados.
- O usuário relata validação visual anterior da intenção Destaque. Run ID e versões de política/compositor dessa validação ficam `pending` por falta de ligação verificável. A prévia compilada em Produto v4/compositor v5 foi conferida separadamente e não é registrada como geração.
- O usuário confirmou que a plataforma exibiu individualmente US$ 0,05 (Oferta) e US$ 0,03 (Exclusivo), valores arredondados. Cálculos locais precisos: `0.048863` e `0.030974`, source `bench_local_pricing`. `provider_reported_cost_usd=null` nos dois runs; os valores exibidos não foram verificados como fatura.
- As duas avaliações visuais e a fidelidade do produto/embalagem nos testes examinados foram aprovadas pelo usuário para este UAT. A decisão não estende aprovação a runs/critério não examinado.
- Limitações aceitas no CHECKPOINT B: slot ID não persistido para os dois runs; vínculo a slots planejados `pending`; Run ID/versões da validação anterior de Destaque `pending` (a prévia v4/v5 foi verificada separadamente e não é geração); associação do caso de letras muito pequenas `pending`; demais slots/critério sem evidência continuam `pending`.
- Valores de plataforma US$ 0,05 e US$ 0,03 foram confirmados pelo usuário como exibições individuais arredondadas. Cálculos locais permanecem `0.048863`/`0.030974`; provider-reported cost `null`; nenhuma fatura foi conferida.
- OF-A histórico continua `requer ajuste`; a evidência Exclusivo v1 mantém diferenciação inconclusiva e linkage/direção de fundo pendentes; v1×v3 continua antes×depois não controlada para isolar Exclusivo.
- IDs que estavam associados por engano na versão anterior deste documento (`2a01db63-bac6-4c42-852c-46a4f5e854d3` e `da2f2321-c748-4d35-bdc9-0ed6fd070c8c`) permanecem como runs históricos Product v3/compositor v4 e não recebem as avaliações visuais finais aqui registradas. O antigo run Oferta usava fundo `ambient`; o run final correto usa `studio`.
- **Task 1 / CHECKPOINT B: concluída — `approved_with_limitations`.** O usuário autorizou concluir Task 2/closeout, executar GSD verify-work e o fluxo OpenSpec solicitado. Não executar geração, promoção produtiva ou push remoto.
