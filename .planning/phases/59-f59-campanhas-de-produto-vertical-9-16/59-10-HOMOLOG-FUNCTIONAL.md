# F59 / 59-10 — Execução funcional em homolog

Data: 2026-11-05. Status: **PARADO NA SUBMISSÃO 1 — defeito visual**.
Limite: **5 submissões**, uma por vez. Orçamento operacional: **US$ 2,00**
(não é hard cap técnico). Flag devolvida para **OFF** após o defeito.

## Estado inicial

- Ambiente: homolog local `127.0.0.1:57781` / DB `127.0.0.1:57782`.
- Aplicação: `http://127.0.0.1:3000`.
- Flag `product_9_16_enabled`: **ON** temporariamente, ativada via RPC auditado.
- Lojas de teste:
  - Loja Mega Vale — `3dc7d274-0b57-45ba-883a-7b235056feda` — 1 crédito;
  - Padaria da Esquina — `48b212f8-2b0f-4679-b553-122a601bacac` — 4 créditos.
- Campanhas nas lojas de teste: **70**.
- Eventos em `generation_events`: **336**.
- Campanhas verticais: **0**.

## Registro de submissões

| # | Data/hora | Loja | Intenção/fundo | Produto | campaignId | operationId | Dimensão | Path | Crédito | Custo observado | Resultado | Evidência |
|---:|---|---|---|---|---|---|---|---|---:|---:|---|---|
| 1 | 2026-11-05 17:01 UTC | Padaria da Esquina | Oferta / Estúdio | Bolo Naked Fruit | `01a66557-6643-47d1-b284-12a7eb201e41` | `65ba4ecf-466e-4dbf-bead-06cffab7a3a2` | 1080×1920 JPEG sRGB | `.../product-9-16/65ba4ecf-466e-4dbf-bead-06cffab7a3a2/art-1080x1920.jpg` | 1 | US$ 0,032133 (imagem 0,031964 + copy 0,000169) | **FAIL** — assinatura visual não preservada e área segura violada | `generation_events` 5b66203a + c1a77ae8 |
| 2 |  |  |  |  |  |  |  |  |  |  |  |  |
| 3 |  |  |  |  |  |  |  |  |  |  |  |  |
| 4 |  |  |  |  |  |  |  |  |  |  |  |  |
| 5 |  |  |  |  |  |  |  |  |  |  |  |  |

## Achados da submissão 1

### A. Assinatura visual não preservada

**Resultado: FAIL.**

Evidências da cadeia de identidade:

- `identity_snapshot.signature.url` aponta para a assinatura ativa
  `86d8f81a-2b62-446a-aabe-3e254044a1db`, path
  `48b212f8-2b0f-4679-b553-122a601bacac/5ced8af3-bf92-447f-9f7a-5df430347753.png`.
- `frozenContentReferences` contém a referência de identidade
  `21e5e037f6605bb9c6fb3365959b4cc9c162bd9cb9121165f395e8872b7ea759`.
- O SHA-256 do arquivo ativo baixado do Storage é exatamente
  `21e5e037f6605bb9c6fb3365959b4cc9c162bd9cb9121165f395e8872b7ea759`.
- O briefing/diretiva contém “Assinar a campanha com a assinatura visual da
  loja fornecida como imagem de referência. Manter fidelidade ao arquivo
  fornecido. Não adicionar logotipo.” e a paleta canônica.

Conclusão da investigação:

- a assinatura **não foi perdida na leitura da loja**;
- **não foi perdida na entrega do ativo**: a URL assinada apontava para a
  assinatura ativa e os bytes conferem pelo hash;
- **não foi perdida na preparação/envio**: a referência congelada prova que a
  imagem foi convertida e anexada ao input do compositor;
- a arte final, porém, mostra um **lockup recriado** (ícone + tipografia
  diferentes do arquivo registrado). O defeito está na fidelidade do
  compositor/modelo: ele recebeu a assinatura correta, mas não a reproduziu
  literalmente.

O prompt também usa a frase “Não adicionar logotipo” ao mesmo tempo em que pede
para assinar com a assinatura visual. Isso pode ter contribuído para a
reinterpretação. A correção recomendada é tornar explícito qual imagem anexada é
a assinatura e avaliar composição programática do ativo, em vez de depender da
fidelidade do modelo.

### B. Área segura / respiro

**Resultado: FAIL.**

Sobreposição aplicada com `safe-area-9-16-v1` na entrega 1080×1920:

- topo protegido: `y < 269`;
- base protegida: `y > 1248` (672 px);
- laterais: `x < 65` e `x > 1015`;
- canto inferior direito: `x > 756` e `y > 1152` (324×768).

Observações na arte:

- a assinatura/logo no topo está acima da linha de 269 px;
- o selo “Imperdível”, o preço, a validade e o aviso ilustrativo estão dentro da
  faixa inferior protegida (abaixo de 1248 px);
- o preço invade o retângulo protegido inferior direito;
- o selo encosta na faixa lateral esquerda.

Os elementos essenciais não estão contidos no retângulo protegido
`{xMin:65, xMax:1015, yMin:269, yMax:1248}`.

### C. Demais verificações da submissão 1

- arte JPEG 1080×1920, sRGB: **PASS**;
- path vertical correto: **PASS**;
- miniatura/registro de artefato 1080×1920: **PASS**;
- crédito consumido: **1** — **PASS**;
- telemetria `format=9:16`, `requestedSize=1152x2048`,
  `returnedSize=1152x2048`, `outcome=success`: **PASS**;
- copy entregue e legível: **PASS**;
- download/detalhe/listagem: **não executados** nesta submissão;
- publicação: **bloqueada** pelo defeito visual.

## Pontos a verificar em cada submissão

- arte JPEG 1080×1920;
- path `.../product-9-16/{operationId}/art-1080x1920.jpg`;
- 1 crédito por entrega;
- miniatura WebP 162×288;
- detalhe vertical com `object-contain`;
- listagem com miniatura;
- download JPEG com attachment;
- copy entregue e legível;
- custo em `generation_events` (`format`, `requestedSize`, `returnedSize`, `outcome`);
- nenhuma troca silenciosa para 1:1.

## Observações

- Nenhuma geração foi executada pelo executor; a submissão 1 foi feita
  manualmente pelo responsável.
- Defeito encontrado na submissão 1; novas chamadas foram paradas.
- Flag desligada via RPC auditado após o defeito
  (`operationId abe4ee17-b68c-4a13-8cc3-7bf262c5d562`).
- Estado final: `product_9_16_enabled=false`.
- Créditos após a submissão: Padaria da Esquina **3**; Mega Vale **1**.
- Campanhas de teste: **71**; verticais: **1**; eventos: **338**.
- Custo observado: **US$ 0,032133**.
- Submissões 2–5 não executadas.
