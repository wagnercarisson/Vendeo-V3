## Context

A F48 validou experimentalmente, numa bancada isolada, geração de imagem com `gpt-image-2`, `gpt-image-2.5-flare` e `gpt-image-2.5-sunburst` em `low`/`medium`. A F56 propõe a incorporação produtiva em três fatias: F56.1 (contrato, modelos e fallback), F56.2 (novo fluxo Produto 1:1) e F56.3 (aprovação/correção). Esta proposta cobre **apenas a F56.1**.

Estado atual relevante (pós-F47/F48):

- **Gateway único (F46)** `src/lib/ai/gateway.ts` executa **uma tentativa por `invoke`**, sem retry e sem fallback automático; emite **um envelope por tentativa** ao sink; o orquestrador decide o fallback com `hasFallback` + `invoke(..., "fallback")`.
- **Resolução de modelo** por `PersistedModelResolver` (F47) sobre `ai_model_selection` + `ai_model_catalog`, com fallback fail-open ao `MODEL_REGISTRY`; **não há dimensão de qualidade** e o fallback genérico só existe para `campaign_copy`.
- **Geração de imagem produtiva** usa `campaign_image` (`responses`, tool `image_generation`, default `quality="auto"`) e, no retry, um segundo invoke de `campaign_image_edit` (`images`). O fallback atual é **provider-local** (`OpenAIImageProvider`), não o alvo `fallback` do gateway. O `ImagesAdapter` **descarta a qualidade**; só o adapter da bancada (`bench-images.ts`) a propaga.
- **Custo** por `resolveAiCost` sobre `ai_model_pricing`, sem dimensão de qualidade; `generation_events` é a única tabela call-level e guarda `attempt_number`, `provider`, `model`, mas **não** guarda a config/qualidade nem um snapshot da seleção.
- **Falhas** são normalizadas em `AiInvocationError` (`timeout|auth|rate_limit|capability|network|content_filter|provider_error`) e a mensagem ao usuário é um código + texto PT-BR (`ERROR_LABELS`), **sem referência de atendimento** e sem correlação admin.
- **Snapshot** já existe para o econômico (F38.2.1, colunas em `generation_events`) e para o brief de campanha; **não** existe snapshot de configuração de modelo/qualidade por operação.

A fase é **infraestrutura preparatória**: define configuração, snapshot, política de falhas, resposta ao lojista e instrumentação, sem ativar a geração pelo novo fluxo nem tocar o pipeline legado.

## Goals / Non-Goals

**Goals:**

- Configuração global auditável de um par principal e um par fallback (modelo + qualidade) para o novo fluxo, restrita a um catálogo elegível fechado.
- Registrar a escolha inicial do responsável (`sunburst/medium` principal, `gpt-image-2/medium` fallback) como decisão humana, não como ativação.
- Isolar a nova configuração do fluxo legado até a ativação.
- Contrato de snapshot imutável da configuração por operação.
- Política de execução explícita e testável (até 2 principal + 1 fallback, máx. 3; rate limit transitório; quota/faturamento sem fallback; falha técnica não cobrada).
- Resposta pública identificável (código + referência) sem vazar motivo interno, com correlação admin/suporte.
- Instrumentação: qualidade até o adapter, telemetria por tentativa e custo por par modelo–qualidade.
- Fail-closed em configuração ausente/inválida/divergente do catálogo.

**Non-Goals:**

- Formulário do lojista, seletor de intenção, direção de fundo, formato 1:1, chaves de ativação por loja.
- Geração produtiva pelo novo fluxo; aprovação/reprovação humana.
- Reativar a revisão automática ou o mecanismo antigo de regeneração da F37.
- Promover modelos/qualidades fora do catálogo elegível.
- Alterar prompt, regras comerciais, retry/timeout do fluxo legado.

## Decisions

As decisões abaixo são **normativas** para o planejamento/implementação da F56.1, salvo quando explicitamente marcadas como _provisórias_. Não repetir como questão em aberto o que já está decidido aqui.

### D1 — Entidade de configuração separada da seleção legada

A configuração do novo fluxo é uma **linha vigente** com os quatro campos explícitos `primary_model`, `primary_quality`, `fallback_model`, `fallback_quality`, mais autor, motivo e timestamp. (Alternativa de linhas por papel com histórico fica rejeitada nesta fase.)

Criar uma configuração **global** própria do novo fluxo (uma linha "vigente") em vez de reutilizar `ai_model_selection`. Motivo: a dimensão `qualidade` não existe na seleção da F47 e reutilizá-la arriscaria afetar o legado. Alternativa considerada: adicionar `quality` a `ai_model_selection` — rejeitada por ampliar o blast radius do fluxo produtivo.

A configuração terá um par principal e um par fallback, cada um `modelo + qualidade`, com autor, motivo e timestamp. Persistência por RPC auditada (`SECURITY DEFINER`, `operation_id`, motivo obrigatório), seguindo o padrão de `admin_set_ai_model_selection`/`admin_set_ai_model_price`.

### D2 — Catálogo elegível derivado do `ai_model_catalog`, sem segundo catálogo

Os modelos elegíveis entram no `ai_model_catalog` (F47) por migration idempotente. A elegibilidade do par (modelo **e** qualidade) é validada contra uma lista fechada de qualidades (`low`/`medium`) combinada com os modelos ativos do catálogo para o recorte de imagem. Motivo: o alinhamento proíbe um catálogo concorrente. Alternativa considerada: allowlist só em código — rejeitada por dificultar auditoria e visibilidade no admin.

Registrar no catálogo **não** ativa o novo fluxo nem torna os modelos selecionáveis no pipeline legado.

### D3 — Dimensão de qualidade no pricing de forma aditiva

Adicionar coluna `quality` nullable em `ai_model_pricing`, com unicidade vigente por `(provider, model, quality)` quando `quality IS NOT NULL`, preservando a unicidade `(provider, model)` para linhas legadas. O RPC de preço ganha `quality` opcional ao final da assinatura. Motivo: o alinhamento (F48.4) manda evoluir a base econômica da F38.1, não criar ledger paralelo. Alternativa considerada: preço local em código como na bancada — rejeitada por não integrar a contabilidade.

A cadeia de `resolveAiCost` permanece intacta; a qualidade só entra como dimensão adicional de seleção de preço.

### D4 — Snapshot por operação no padrão do snapshot econômico

Persistir o snapshot da configuração no início de uma **campanha**, no mesmo padrão do snapshot econômico da F38.2.1 (valores congelados, imutáveis por trigger). O snapshot contém par principal/fallback, o **identificador da versão da configuração (UUID) e uma cópia dos valores** e a origem. Nova **campanha** usa a versão vigente; nova **geração/correção da mesma campanha** reutiliza o snapshot original — distinção obrigatória. Motivo: é a barreira que impede que uma mudança futura no admin reescreva correções. Alternativa considerada: resolver a config em tempo de correção — rejeitada por quebrar reprodutibilidade.

**Nota de fronteira:** a gravação do snapshot numa operação real de campanha é integração da **F56.2**; a F56.1 entrega o contrato e o componente com testes simulados.

### D5 — Classificação de falhas explícita e distinta de quota/faturamento

Estender a normalização para separar `rate_limit` transitório de **quota esgotada** e **erro de faturamento** (ex.: `insufficient_quota`/`billing`). Falhas elegíveis: `rate_limit`, `timeout`, `network`, `provider_error` 5xx e disponibilidade/capacidade explícita. Não elegíveis: quota, faturamento, autenticação/autorização, conteúdo/segurança e entrada/validação. Motivo: quota/faturamento não se resolvem trocando de modelo e acionariam custo inútil. Alternativa considerada: tratar todo 429 como `rate_limit` — rejeitada por acionar fallback indevido em quota esgotada.

A classificação é feita **antes** da ativação produtiva e coberta por testes com erros simulados.

### D6 — Referência de atendimento opaca + diagnóstico interno correlacionável

Gerar, por ocorrência de falha, um código público e uma **referência opaca aleatória** (token não derivado do código interno). O código público pertence a um conjunto **fechado e mínimo de categorias voltadas ao usuário**, que NÃO se particiona por quota, faturamento, autenticação ou rate limit — essas causas compartilham a mesma categoria pública de falha técnica para não serem inferíveis. O diagnóstico interno verdadeiro (categoria, par modelo–qualidade, tentativa, erro normalizado, run/trace) fica acessível apenas no admin/suporte, correlacionado pela referência. Motivo: atender ao requisito de mensagem não reveladora sem perder operabilidade. Alternativa considerada: expor o código do provider ou uma categoria por causa interna — rejeitada por permitir inferir quota/faturamento.

### D7 — Instrumentação de qualidade no caminho do novo fluxo, não no legado

A propagação de qualidade até o adapter é feita no caminho do **novo fluxo**, sem alterar o `ImagesAdapter` do legado. Motivo: isolar o legado até a ativação. Alternativa considerada: corrigir o `ImagesAdapter` produtivo agora — rejeitada por violar o isolamento. A telemetria registra modelo + qualidade por tentativa, e o custo passa a considerar o par.

### D8 — Fail-closed na resolução da configuração do novo fluxo

Diferente do `PersistedModelResolver` legado (fail-open para o registry), a resolução da configuração do novo fluxo é **fail-closed**: ausência/invalidez/divergência encerram a operação com erro identificável, sem default silencioso. Motivo: evitar gerar com um modelo não aprovado. Alternativa considerada: copiar o fail-open — rejeitada por risco de mudar silenciosamente o modelo.

### D9 — Pricing insuficiente é fail-closed no novo fluxo; legado intacto

Para o **novo fluxo**, um par cuja cobertura de pricing seja `partial` ou `missing` SHALL NOT ser executado e SHALL falhar de forma identificável, sem inventar custo — a mesma regra vale para a ativação em F56.2. Para o **fluxo legado**, a cadeia de `resolveAiCost` (`provider_reported → manual_unknown → pricing_table → fallback_static → not_available`) permanece **inalterada**. Motivo: custo conhecido é pré-requisito da operação nova, sem contaminar o comportamento antigo. Alternativa considerada: herdar o `fallback_static`/`not_available` no novo fluxo — rejeitada por mascarar ausência de preço.

### D10 — Capacidade própria do novo fluxo para os modelos elegíveis

Os modelos elegíveis SHALL ser registrados no `ai_model_catalog` sob uma **capacidade própria do novo fluxo** (distinta de `campaign_image` e `campaign_image_edit`), com o protocolo `images`. Motivo: a tela legada lista modelos `active` **por capacidade**; registrar os modelos elegíveis sob uma capacidade legada os exporia na seleção do pipeline atual. Isso exige declarar a nova capacidade nos mapas de código (`CAPABILITY_SEGMENTS`/`CAPABILITY_PROTOCOLS`/registry) — parte do trabalho da F56.1, sem ativar geração. Alternativa considerada: usar a capacidade legada `campaign_image_edit` — rejeitada por vazar elegibilidade para o legado.

### D11 — Enforcement de "não cobrar falha técnica" é componente na F56.1

Na F56.1, a não cobrança é especificada e testada como **componente/comportamento simulado** (telemetria e regra contábil), sem crédito real. O **enforcement transacional** sobre o ledger de créditos de uma geração real é da **F56.2**. Motivo: manter a F56.1 como infraestrutura, sem tocar cobrança real.

### D12 — A tela admin exibe a cobertura de pricing do par (não bloqueia salvar)

A tela administrativa de configuração SHALL exibir a cobertura de pricing (`complete`/`partial`/`missing`) do par configurado. A exibição é **obrigatória**, mas **não bloqueia** a gravação da configuração — o bloqueio por cobertura incompleta é da **execução** (D9). Motivo: dar visibilidade ao admin sem impedir a preparação da configuração antes da ativação.

## Risks / Trade-offs

- **[Qualidade do sunburst/medium é evidência limitada da bancada]** → Registrar como decisão humana, manter fallback definido e reavaliar em F56.2/F56.3; não anunciar garantia universal de qualidade.
- **[Adicionar qualidade ao pricing pode gerar ambiguidade de vigência]** → Índices parciais distintos (com/sem qualidade) e testes de coexistência; cadeia de custo legada intocada.
- **[Erro de classificação gera fallback indevido ou ausente]** → Taxonomia coberta por testes antes da ativação; quota/faturamento explicitamente não elegíveis.
- **[Snapshot pode ser esquecido em algum caminho]** → Testes de imutabilidade e de correlação run/trace; trigger de imutabilidade.
- **[Regressão no legado por mexer em catalog/pricing/gateway]** → Mudanças aditivas, defaults preservados, testes de regressão e verificação de fronteira produtiva vazia.
- **[Referência vazar informação]** → Referência opaca, sem dados de conta; mensagem pública revisada contra lista de proibições (saldo/quota/faturamento/chave/URL).
- **[Expectativa de ativação]** → A fase documenta explicitamente que nada é ativado; a ativação ocorre em F56.2/F56.3.

## Migration Plan

1. Criar as mudanças de schema localmente (nova configuração + RPC; snapshot; coluna `quality`; modelos elegíveis no catálogo), sem `db push`.
2. Implementar serviços, validação fail-closed, taxonomia, referência e instrumentação; rodar typecheck/lint/build e testes locais (sem chamada paga).
3. UAT local sem provider, validando isolamento (fronteira produtiva vazia nos caminhos legados).
4. Aplicar a migration no remoto após aprovação humana.
5. Deploy do código aditivo; o fluxo legado permanece o default até a ativação em F56.2/F56.3.
6. **Rollback:** desabilitar/remover o consumo novo e reverter a migration (colunas/tabelas aditivas) sem tocar dados de campanhas; o legado não depende das novas estruturas.

## Open Questions — Resolvidas

As questões abertas abaixo foram **fechadas** pelo responsável em 2026-10-05 e estão registradas em `.planning/phases/56.1-contrato-produtivo-modelos-e-fallback/56.1-CONTEXT.md` (decisões `D-01`..`D-26`). Elas **não** reabrem D1–D12 e não autorizam caminhos incompatíveis com as decisões acima. Este bloco existe apenas como referência; a fonte vinculante é o CONTEXT.

- **Identificador/nome da capacidade própria do novo fluxo** (D10) — fechado como **`campaign_product_image`** (protocolo `images`), distinta de `campaign_image`/`campaign_image_edit`. Fonte: CONTEXT **D-11** (`56.1-CONTEXT.md:38`).
- **Formato literal (namespace/tamanho) do código público e do token de referência** — fechado como código público único **`IMG-001`** e referência opaca em **UUID v4**. Fonte: CONTEXT **D-18** (`56.1-CONTEXT.md:51`).
- **Enumeração exata das categorias públicas voltadas ao usuário** — fechada como **uma única categoria pública genérica de falha de geração** nesta fatia, sem particionar por quota/faturamento/auth/rate limit. Fonte: CONTEXT **D-18** (`56.1-CONTEXT.md:51`).
- **Meio de persistência do snapshot** — fechado em **colunas dedicadas e tipadas** (não JSONB), imutáveis por trigger, mantendo D4. Fonte: CONTEXT **D-12** (`56.1-CONTEXT.md:41`).
- **Granularidade do gate de pricing fail-closed** — fechado em: o admin **pode** gravar com pricing incompleto (apenas exibe o aviso); o bloqueio fail-closed é da **execução**, exigindo `complete` para principal **e** fallback antes de reservar crédito/chamar o provider. O preflight real é da **F56.2**; a F56.1 entrega e testa o **componente**. Fonte: CONTEXT **D-23/D-24** (`56.1-CONTEXT.md:61-62`), mantendo D9.
