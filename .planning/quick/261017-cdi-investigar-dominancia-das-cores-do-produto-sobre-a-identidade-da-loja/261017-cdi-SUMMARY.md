# Quick — 261017-cdi — Investigação: dominância das cores do produto sobre a identidade da loja (Flare × Sunburst)

**Tipo:** investigação **somente leitura**. Nenhum prompt alterado, nenhum provider chamado, nenhuma flag ligada, produção intocada.
**Data:** 2026-10-17
**Escopo:** fluxo Produto 1:1 (novo fluxo), campanhas geradas na instância `vendeo-homolog` com `gpt-image-2.5-flare/medium` e `gpt-image-2.5-sunburst/medium`.

---

## 1. Fontes recuperadas (read-only)

| Item | Origem | Valor |
|------|--------|-------|
| Campanha Sunburst | `campaigns` | `e043e52e-4df0-48b4-bd01-0d1b43b5de01` (Morango & Pêssego), `operation_run_id abd6ed1a…` |
| Campanha Flare | `campaigns` | `6ecef78c-0e7d-444c-871b-b8da722abb2d` (Morango & Pêssego), `operation_run_id 4269472e…` |
| Histórica (comparação) | `campaigns` | `20d54b1d-f603-4dd1-8eac-051da18b5147` (Figo & Maçã, `gpt-image-2/medium`) |
| Loja | `stores` | `48b212f8-2b0f-4679-b553-122a601bacac` — "Adega Mestre das Geladas", segmento `bebidas-adegas-conveniencia`, `brand_color #242422`, `identity_state logo` |
| Evidência congelada | `product_1_1_snapshot_frozen_evidence` | `background_direction = studio`; `composer 48.2.4-prompt-composer-v6`; `base 48.2.6-produto-1-1-v1`; políticas `produto-v4`, `oferta-v2`, `fundo 48.2.6-background-direction-v1` |
| Direção de identidade congelada | `campaigns.input_snapshot.identityDirective` | texto de assinatura/logo (ver §4) |
| Perfil de marca da loja | `store_brand_profiles` (status `synced`) | `safe_color_tokens {primary:#242422, accent:#828280, secondary:#5F5F5D, background:#FFFFFF}`; `brand_colors_chosen []`; `typography_direction`, `visual_style`, `campaign_guidelines` presentes |
| Execução do provider | `generation_events` | Flare e Sunburst `success`; `images.edit`; `medium`; usage `input_tokens 2300` (texto 478 + imagem 1822), `output_tokens 439` |

As duas campanhas novas (Flare e Sunburst) possuem **entradas congeladas idênticas** — `briefing`, `identityDirective`, `backgroundDirection = studio`, `referenceSelections` — diferindo apenas no modelo. Logo, **o prompt enviado é o mesmo** nas duas.

## 2. Prompt efetivamente enviado (reconstruído do congelado + compositor v6)

O texto do prompt **não é persistido** (só o `briefing`/evidência e o usage). Reconstruído deterministicamente executando o compositor puro (`composeProductPrompt`, sem provider) com os valores congelados, e conferido contra o código-fonte:

```
[IDENTIDADE E DIREÇÃO VISUAL]
Assinar a campanha com o logotipo da loja fornecido como imagem de referência. Manter fidelidade ao arquivo fornecido. Considerar a direção visual do perfil de marca como contexto direcional, não obrigatório.

[PRODUTO E IMAGENS DE REFERÊNCIA]
Nome obrigatório na arte: "Red Bull Summer 250ml Morango & Pêssego"
Inclua todas as palavras, números e unidades - nenhuma informação do nome deve ser omitida, as aspas não fazem parte do nome; capitalização, quebras de linha e arranjo livres.
Imagens de referência: 2
A primeira imagem enviada define a variante protagonista: apresente-a maior e em primeiro plano; use as imagens auxiliares como apoio visual secundário.
Reproduza com fidelidade o produto da imagem enviada, incluindo aparência e embalagem.
Descrição: opcional; pode ser adaptada, melhorada ou omitida, preservando o significado.
Textos obrigatórios: exiba cada texto integralmente uma única vez.

[CONDIÇÕES COMERCIAIS]
Direção de fundo: Use um fundo de estúdio discreto, em cor sólida ou gradiente suave, sem cenário ou objetos de apoio.
Preço original: R$ 9,99
Preço de venda: R$ 7,49
Selo: Oferta
Validade: somente hoje
Oferta: destaque o preço por e mantenha o preço de como secundário, quando informado. Não invente informações comerciais.
Respeite a direção de fundo.

[INTENÇÃO E FORMATO]
Formato: quadrado 1:1, com composição quadrada e equilibrada (sem congelar o layout).
Estrutura: peça única.

[INSTRUÇÕES DO PROMPT-BASE]
Crie uma peça profissional e visualmente coerente. Evite elementos decorativos que distraiam do conteúdo principal.

[RESTRIÇÕES E TEXTOS OBRIGATÓRIOS]
Informações obrigatórias na arte: Imagem meramente ilustrativa
Use português correto e natural.
Evite caracteres, símbolos ou pontuação duplicados ou anômalos.
Não corrija silenciosamente os textos de entrada.
```

Bloco `[DIREÇÃO TIPOGRÁFICA]` **ausente** (vazio ⇒ omitido). Versões: `composer 48.2.4-prompt-composer-v6`, `base 48.2.6-produto-1-1-v1`, `intencao 48.2.6-oferta-v2`, `tipoConteudo 48.2.6-produto-v4`, `formato 48.2.4-formato-1-1-v1`, `estrutura 48.2.4-peca-unica-v1`, `tema 48.2.4-tema-nenhum-v1`, `geral 48.2.5-general-integrity-v1`, `fundo 48.2.6-background-direction-v1`.

## 3. Conferência dos quatro eixos pedidos

| Eixo | Situação no prompt efetivo |
|------|-----------------------------|
| **Paleta** | **Ausente.** Nenhuma cor da loja entra no prompt. A loja tem `brand_color #242422` e `safe_color_tokens` com `primary/accent/background`, mas nada disso é transportado. |
| **Referência de identidade** | Apenas o **logotipo** (imagem, última referência) + a diretiva textual de assinatura/fidelidade. Sem nome da loja, sem cor, sem tipografia. |
| **Direção de fundo escolhida** | `studio`: "Use um fundo de estúdio discreto, em cor sólida ou gradiente suave, sem cenário ou objetos de apoio." — sem nenhum vínculo com a identidade da loja. |
| **Instruções de prioridade** | **Não existem** regras de prioridade entre identidade da loja, produto e fundo. O único sinal explícito é que o perfil de marca é "contexto direcional, **não obrigatório**". |

## 4. Diretiva de identidade congelada (igual nas duas campanhas)

> "Assinar a campanha com o logotipo da loja fornecido como imagem de referência. Manter fidelidade ao arquivo fornecido. Considerar a direção visual do perfil de marca como contexto direcional, não obrigatório."

Proveniência: `deriveDirective(identity_state=logo, hasAsset=true)` em `src/lib/store-identity-service.ts`; injetada em `[IDENTIDADE E DIREÇÃO VISUAL]` por `identityContributions()` em `orchestration/generation-orchestrator.ts` (o compositor **só** recebe essa diretiva; o perfil de marca não é enviado).

## 5. Diagnóstico

A causa **não** é apenas "liberdade do modelo". É uma combinação, com peso maior em **composição + dado não transportado**:

1. **Dado existe, mas não é enviado (causa primária de dados).** A loja tem paleta resolvida (`#242422` + `safe_color_tokens` + `campaign_guidelines` "paleta neutra e sofisticada"), mas o fluxo Produto 1:1 **não transporta cor alguma** ao prompt. O bloco de identidade nasce de `deriveDirective`, que só descreve assinatura/fidelidade e rebaixa o perfil de marca a "não obrigatório". A identidade só chega como **imagem** do logo.
2. **Composição sem regra de relação (causa primária de prompt).** Não há instrução de prioridade nem de relação fundo↔identidade↔produto. O `studio` libera o fundo ("cor sólida ou gradiente suave") sem âncora na loja.
3. **Fidelidade de produto forte + vazio de identidade ⇒ deriva cromática.** O bloco de produto manda "reproduza com fidelidade … aparência e embalagem" e o fundo é livre. Sem paleta da loja, o caminho de menor esforço do modelo é **derivar o fundo das cores da embalagem** (azul/prata/vermelho do produto) — exatamente o sintoma relatado.
4. **Liberdade do modelo (fator secundário, não raiz).** O modelo tem liberdade total de fundo/composição por desenho; a liberdade só vira problema porque os itens 1–3 não delimitam identidade nem separação.

**Conclusão:** corrigir apenas com "respeite a paleta" **não basta** — a paleta sequer chega ao modelo neste fluxo, e a única menção à marca é explicitamente "não obrigatória". O ajuste mínimo precisa (a) **transportar** a cor/direção resolvida da loja e (b) **definir prioridade e separação** nos fundos recriados.

### Achado secundário (contribuinte, fora do pedido principal)
`references` enviado ao compositor inclui a imagem de **identidade** junto às de produto. A política `produto` conta `references.length = 2` e dispara a instrução de **múltiplas imagens** ("a primeira imagem define a variante protagonista; use as imagens auxiliares como apoio") mesmo havendo **uma só** imagem de produto. Isso dilui a proeminência do produto e mistura o papel da identidade com o de referência de produto. Registrado para avaliação na proposta.

## 6. Limites desta etapa

- Nenhum arquivo de prompt/código alterado; nenhuma chamada a provider; nenhuma flag/autorização/migração; produção e homolog intocados.
- O prompt enviado foi **reconstruído** (não persistido) a partir da evidência congelada + compositor v6; a reconstrução é determinística e conferida contra o código.
- Consultas ao banco foram apenas `SELECT` na instância local `vendeo-homolog`.

## 7. Proposta e validação

Ver `261017-cdi-PLAN.md` (status **proposed** — aguarda aprovação; **nada executado**).

## 8. Execução (2026-10-17) — orientação do responsável incorporada

Executado **localmente, sem provider** (sem chamadas pagas, flags, migrations, produção ou deploy). Resumo do que foi feito:

- **A. Identidade:** novo `src/lib/product-1-1/identity-context.ts` — paleta canônica resolvida (precedência `brand_colors_chosen[0]` → `safe_color_tokens.primary` → `brand_color`; apoio = `accent`) emitida **uma única vez** no bloco de identidade; presença/ausência **reconciliada** sem “não obrigatório”; **sem paleta** ⇒ orientação neutra explícita (sem inventar cores). Legado (`deriveDirective`) intacto.
- **B. Fundo:** estúdio/ambientado passam a citar **a paleta da loja**; **orientação comum de contraste** emitida **uma única vez** só para esses dois; `original` **intocado** (sem imposição de paleta). Instruções antigas **substituídas** (sem acúmulo); sem proibição genérica de cores da embalagem.
- **C. Referências:** identidade **não** conta como imagem de produto (não dispara múltiplas imagens); referências de produto adicionais continuam contando.
- **D. Congelamento:** `identityDirective` + `identityContext` no `input_snapshot`; `briefing.identity` na evidência; **histórica intocada**.
- **Versões:** composer `v6→v7`; fundo `v1→v2`; nova versão de contexto de identidade.
- **Baseline:** baseline de produção atualizado; `previousBaseline` = `99017f35` (rastreabilidade preservada).

**Gates:** `tsc` 0; focalizados **113/113**; `eslint .` 0; `next build` exit 0; spec `product-1-1-prompt-composition` válida. Falhas de suíte **pré-existentes** (idênticas no tree limpo por `git stash`): `route.test` 26, `legacy-frontier.guard` 3, `submission.contract` 2, `copy-recovery`/`copy-wiring-gaps` 13, integrações Postgres/runner isolado. **0 novas.**

**Antes × depois, diff, versões e gates:** detalhados em `261017-cdi-PLAN.md` §Antes × Depois / §Validação. **A prévia textual comprova a composição, não a melhoria visual** — geração real e inspeção humana ficam para autorização posterior.

## 9. Correções da revisão do responsável (2ª rodada, 2026-10-17)

1. **Acento alinhado à tela** — precedência do acento passa a `brand_colors_chosen[1]` → `safe_color_tokens.accent` (antes só `accent`). Reprodução #AABBCC escolhida → #445566 enviada coberta por teste.
2. **Neutro restrito a fundos recriados** — a orientação neutra (sem paleta) só é emitida em estúdio/ambientado; em `original` não é emitida. Texto: *"Sem paleta da loja definida, use cores neutras e discretas."* Coberto pelo **prompt completo com identidade** (9 combinações) e não apenas pelo compositor sem contribuições.
3. **Versão da identidade registrada** — `PRODUCT_1_1_IDENTITY_CONTEXT_VERSION` agora entra em `policyVersions.identidade` (evidência) + teste de determinismo: mesma identidade ⇒ mesmo fingerprint; cor diferente ⇒ fingerprint diferente.
4. **Proveniência do baseline corrigida** — `sourceCommit: null`, `technicalBaseline: true`, `visualApproval.status: "pending"`; `previousBaseline` = `99017f35`. Expectativa técnica ≠ aprovação visual (pendente).
5. **Guarda de fronteira reconciliada** — rota passou a ser **aditiva** (nenhuma linha removida); manifesto mantém `BASE_SHA`, `LEGACY_FRONTIER_PATHS` e testes negativos e ganhou entradas por caminho+commit+autorização para mudanças já autorizadas de quicks anteriores (gpt6-luna/ms4) e o commit corrigido de `chat-completions.ts`. Guarda **10/10**.

**Gates após as correções:** `tsc` 0; focados **135/135**; `eslint .` 0; `next build` exit 0; spec válida; guarda 10/10. **Sem provider/flags/migrations/produção.** Geração real continua para autorização posterior.

## 10. Causa: campanhas do novo fluxo ausentes na lista + correção (alternativa A)

**Causa demonstrada:** `listCampaigns` filtra `status ∈ ('ready','error')`, mas o novo fluxo **nunca** transicionava `campaigns.status` (ficava `generating`) nem registrava o caminho real da arte. A entrega do novo fluxo (`product_1_1_deliver_campaign_credit_operation`) só atualiza `product_1_1_campaign_credit_operations`. A página de detalhe já usa marcador + operação; só a **lista** ficou presa ao `status` legado.

**Correção (alternativa A) — helper idempotente central `projectDeliveredCampaign`** (`orchestration/project-delivered-campaign.ts`), chamado nos **três** caminhos que confirmam entrega:
1. geração normal (orquestrador, após `credit.deliver` confirmar `delivered`);
2. recuperação de arte (`artifact-recovery`, após `delivered`/terminal `delivered`);
3. resolução de pendência (`resolve-pending-operation`, após `deliver_existing_art`).

Regras atendidas: só age com operação PERSISTIDA `delivered` + vínculo loja/campanha/operação + **arte persistida** no caminho determinístico; **nunca** lança (falha vira resultado tipado `projection_update_failed`) e **não** provoca nova chamada ao provider, estorno ou reclassificação; **não** toca `approval_status`/créditos/auditoria; repetir é seguro. `artifactStoragePath` extraído para módulo puro (`artifact/artifact-path.ts`), reexportado por `artifact-store`.

**Reparo (autorizado, 3 campanhas)** — revalidado `delivered` + arte existentes e aplicado pelo MESMO helper (antes → depois):
- `20d54b1d…`: `generating` → **`ready`**; path `<loja>/20d54b1d….jpg` → `…/product-1-1/355cc9bb…/art-1024.jpg`; `approval_status` inalterado (`pending_approval`).
- `6ecef78c…`: `generating` → **`ready`**; path → `…/product-1-1/d5fe3115…/art-1024.jpg`.
- `e043e52e…`: `generating` → **`ready`**; path → `…/product-1-1/0b8642f4…/art-1024.jpg`.
- **Idempotência confirmada**: 2ª execução → `already_projected` (sem novo update).
- **Verificações:** listagem (`status∈ready/error`, ordem desc) passa a listar as 3 no topo; os 3 objetos de arte existem no bucket; `createSignedUrl` (thumbnail) → **OK**; `input_snapshot` das 3 tem o marcador `frozenContentReferences` (detalhe = novo fluxo). Créditos/operações/auditoria/aprovação preservados.

**Lacuna apresentada (NÃO ampliada):** terminais de **falha/estorno** não têm projeção — uma operação `refunded` deixa `campaigns.status='generating'` e a campanha **some da lista** (o legado usava `error`). Hoje **0 linhas afetadas** (nenhuma operação não-`delivered`). Aguarda autorização para ampliar o recorte.

**Testes (focados 214/214):** nova suíte `project-delivered-campaign.contract` (normal, idempotente, inconclusivo/estorno/upload, loja divergente, arte ausente, falha de update sem lançar) + orquestrador (entrega projeta; falha da projeção não reclassifica/estorna), `artifact-recovery` (delivered/terminal-delivered projetam; refunded não; falha não reclassifica) e `pending-resolution` (deliver projeta; falha não altera o resultado).

**Gates desta correção:** `tsc` 0; focados **214/214**; `eslint .` 0; `next build` exit 0; guarda 10/10. **Sem flags, novas gerações, produção, deploy ou push.** (A janela de validação visual permaneceu habilitada; o Next foi reiniciado para servir o build novo.)

## 11. Defeito comercial — preço ausente virava “R$ 0,00” (corrigido na origem)

**Janela encerrada (preservando registros):** flag `product_1_1_test_stores_enabled=false`, `all_stores=false`, autorização **revogada** (seq 12 `off`), geração **pausada** (`VENDEO_GENERATION_PAUSED=true`). `spent` US$ 0,4242 / `cap` 0,8454 (histórico intacto). As 4 campanhas da janela e os snapshots históricos **não foram reescritos**; as artes **não** foram reparadas.

**Causa demonstrada (cadeia):** formulário envia `originalPriceCents: 0` (default) + `discountedPriceCents` ausente → schema aceita 0 (`nonnegative`/`positive`) → normalização nova da rota `priceText(0)` = “R$ 0,00” → briefing congelado `originalPriceText:"R$ 0,00"` → composer v7 emite “Preço original: R$ 0,00” → a arte de Destaque renderizou **“R$ 0,00”**. A copy já tratava 0 como ausência (`!discounted`), mas recebia `originalPriceCents: 0`.

**Correção (origem apropriada, legado preservado):**
- Novo módulo puro `src/lib/product-1-1/commercial-price.ts`: `positivePriceTextBRL` (só positivo ⇒ texto; 0/ausente ⇒ `null`), `positiveCentsOrUndefined` (só positivo ⇒ centavos), `isOfferMissingDiscountedPrice` (paridade legada).
- Rota (novo fluxo): briefing usa `positivePriceTextBRL` (zero/ausente ⇒ ausência); `copyContext` usa `positiveCentsOrUndefined`.
- Formulário: **somente no novo fluxo (elegível)**, zero/ausente é **omitido** do payload; o legado (inelegível) permanece **byte-compatível**.
- **Oferta:** revalidação server-side adicionada **antes de criar campanha/reservar crédito/gerar** (`isOfferMissingDiscountedPrice`) — **paridade** com a regra legada (`route.ts` pós-parse: `offer && !discountedPriceCents`), erro de campo 400. *Relato de paridade:* a checagem legada existia mas o ramo do novo fluxo a **contornava**; nenhum erro encontrado no caminho de Oferta válida (segue funcionando). Não foram criadas regras novas (relações extras como `original ≥ discounted`/badge continuam apenas no formulário, como no legado).
- **Contrato da API:** negativos, fracionários, tipos inválidos e `null` são **recusados** pelo schema (não convertidos em ausência).
- Testes: `commercial-price.contract` (helpers + schema + copy `buildCommercialFrame`), payload do formulário (novo omite zero; legado preserva), e prompt de imagem (sem/zero preço ⇒ nenhuma linha de preço/“R$”; positivo ⇒ preserva). **Prova por testes de que os prompts de imagem/copy não recebem preço artificial** — não equivale a garantir visualmente toda saída do modelo.

**Registros separados (conforme solicitado):**
- **Cores:** **aprovadas pelo responsável** — validação de identidade/cor tratada à parte deste defeito comercial.
- **Artes de Destaque com “R$ 0,00”:** **REPROVADAS comercialmente** (não reparadas; snapshots preservados).

**Gates:** `tsc` 0; focados **252/252**; `eslint .` 0; `next build` 0; spec `product-1-1-prompt-composition` válida. Sem geração paga, produção, deploy ou push. Janela permanece **desligada**.

## 12. Reabertura da janela (validação manual de Destaque sem preço) + confirmação do teste de rota

**Janela reaberta (autorizado):** destino `vendeo-homolog` (Kong `127.0.0.1:57781`), `spent` **0,4242** / `cap` **0,8454** (histórico preservado; sem novo `set_cap`), autorização estreita **`isolated_pilot`+`test_stores`** concedida (seq **13**), `product_1_1_test_stores_enabled=true`, `all_stores=false`, geração **despausada** (`VENDEO_GENERATION_PAUSED=false`); Next reiniciado. Par vigente `sunburst/medium` + fallback `gpt-image-2/low`; copy `gpt-6-luna`. Encerra-se ao aviso de término (revoga/autorização + flag off + pausa).

**Confirmação do teste de rota (Oferta sem preço promocional ⇒ 400 antes de efeitos):**
- `route.test.ts` — 2 casos novos: **ausente** ⇒ 400 `offer_requires_discounted_price` (fields `["discountedPriceCents"]`); **zero** ⇒ 400 de schema. Ambos provam **`createCampaign` NÃO chamado, `reserveCredit` NÃO chamado, `runProductOneToOneGeneration` (provider) NÃO chamado**.
- **Infra de teste:** adicionado mock de `resolve-pilot-spend-gate` (`{kind:"inactive"}`) — o gate real (dependência de DB) fazia o mock de autorização (sem `stage`) resolver `blocked` ⇒ **503 espúrio**. Com o mock, `route.test.ts` passa **93/93** (corrige também as **26 falhas pré-existentes** da suíte de rota).
- Gates: `tsc` 0; `eslint .` 0.

## 13. Sessão de validação (Destaque sem preço) — resultados, evidência e encerramento

**Autorização/janela:** reaberta com autorização estreita seq **13** (`isolated_pilot`+`test_stores`) e `test_stores=true`; **encerrada** com flag `false` e autorização sequência **14** (`off`). `all_stores=false` durante toda a sessão. Pausa restaurada (`VENDEO_GENERATION_PAUSED=true`).

**Gasto final:** `spent` **0,4242 → 0,5583** (`Δ 0,1341` = 3 × image_primary `0,044` + copy_initial `0,0007`); `cap` **0,8454** (histórico preservado). Todas as chamadas `released`; sem `unknown`/fallback.

**Evidências (duas imagens de Destaque SEM preço) — correção comprovada:**
- `9c2133ce-2fc9-4171-bd76-5d4d4fdd2f98` — **Rocambole de Morango**, `studio`, spotlight, **sem preço**. Briefing congelado `originalPriceText:null`/`discountedPriceText:null`; **arte sem “R$ 0,00”**; copy sem preço.
- `b1f75489-82d7-4420-936f-a7c24ec9b4a1` — **Rocambole de Morango**, `ambient`, spotlight, **sem preço**. Idem (arte sem preço; copy sem preço).
- **Controle positivo:** `22d4c990-91c8-4ea5-a4db-a59c7e559499` — **Pão Caseiro (kg)**, spotlight **com preço `R$ 16,99`**; briefing/copy preservam o preço (contrato de Destaque com preço positivo mantido).
- **Log de payload (fonte):** sem preço ⇒ **sem `originalPriceCents`** e `hasPrice:false`; com preço ⇒ `discountedPriceCents` presente e `hasPrice:true` (zero omitido no novo fluxo).

**Copy sem preço artificial:** confirmado (as duas evidências não têm valor monetário na copy; o controle positivo mantém `R$ 16,99`).

**Histórico/listagem:** as 6 campanhas recentes constam `ready` e aparecem na listagem (inclui as 2 evidências), comprovando a projeção.

**Teste de Oferta inválida:** `route.test.ts` 93/93 — Oferta sem preço promocional ⇒ **400 antes de criar campanha, reservar crédito ou chamar provider** (commit `47a3f1ef`).

**Registro de cores (separado):** cores **aprovadas pelo responsável**; as artes de evidência respeitam a paleta da loja (`#D59D5E`/`#E0B786`). As artes de Destaque **anteriores** com “R$ 0,00” permanecem **reprovadas comercialmente** (não reparadas; snapshots preservados).

## 14. Pendências conhecidas (não ampliadas)

1. **Projeção de terminais de falha/estorno:** campanhas de operações `refunded` permanecem `generating` e ficam fora da listagem (o legado usava `error`). Nenhuma linha afetada hoje; correção não autorizada/ampliada.
2. **Mock de `resolve-pilot-spend-gate` em `route.test.ts`** é **infra de teste** (o gate real tem cobertura própria); motivo: o mock de autorização sem `stage` fazia o gate resolver `blocked` ⇒ 503 espúrio.
3. **Validação visual** é inspeção manual das artes; **não** equivale a garantir toda saída do modelo.
4. **Snapshots históricos** de Destaque com “R$ 0,00” e os payloads antigos **não foram reescritos** (evidência do defeito).
5. **Oferta (paridade):** a revalidação server-side espelha a regra legada; relações extras (`original ≥ discounted`, badge) seguem **apenas no formulário**, como no legado — sem regras novas no servidor.





