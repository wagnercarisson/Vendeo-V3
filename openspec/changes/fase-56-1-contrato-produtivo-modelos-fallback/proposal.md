## Why

A bancada isolada da F48 validou, de forma experimental e restrita, um conjunto de modelos e qualidades de geração de imagem (`gpt-image-2`, `gpt-image-2.5-flare`, `gpt-image-2.5-sunburst`, em `low`/`medium`). Esses resultados **orientam** a incorporação produtiva, mas **não** são garantia universal de qualidade nem autorização automática de promoção. Antes de ativar qualquer novo fluxo de geração Produto 1:1 (F56.2) é preciso preparar a infraestrutura produtiva: escolher, de forma auditável, um par principal e um par fallback de modelo–qualidade, congelar essa escolha por campanha e definir exatamente o que acontece quando a geração falha.

Fazer isso agora, isolado do pipeline legado, permite responder com antecedência a três riscos concretos: (1) uma mudança posterior no admin reescrever silenciosamente correções de campanhas existentes; (2) falhas de provider virarem cobrança ou mensagem técnica ininteligível ao lojista; (3) a qualidade escolhida não chegar de fato ao adapter, tornando a configuração decorativa.

## What Changes

- **Configuração global de par principal e fallback (modelo + qualidade) no admin.** Cada par é composto por modelo e qualidade; o admin escolhe um par principal e um par fallback para o **novo** fluxo de imagem Produto 1:1. A configuração é auditável (motivo obrigatório) e **isolada**: não altera a seleção legada (`ai_model_selection`), não ativa geração e não muda o fluxo produtivo atual.
- **Catálogo elegível explícito.** Somente `gpt-image-2`, `gpt-image-2.5-flare` e `gpt-image-2.5-sunburst`, nas qualidades `low` e `medium` **já testadas**, são elegíveis. Modelos/qualidades fora dessa lista são rejeitados.
- **Escolha inicial registrada como decisão humana expressa do responsável:** principal `gpt-image-2.5-sunburst / medium` e fallback `gpt-image-2 / medium`. É uma configuração **aprovada para a futura implantação**, não uma configuração já ativa em produção.
- **Contrato de snapshot da configuração por geração.** Cada operação de geração do novo fluxo registra de forma imutável qual par principal/fallback, versão da configuração e origem foram usados. Uma alteração posterior no admin **não** muda campanhas/correções existentes.
- **Política de execução com teto de chamadas.** No máximo duas tentativas reais no principal e, se a falha for elegível, uma tentativa no fallback; máximo de **três chamadas por operação**. `rate_limit` é transitório: repete uma vez no principal e, se persistir, usa o fallback. Falha explícita de disponibilidade/capacidade do modelo pode acionar o fallback sem repetição inútil. **Quota esgotada e erro de faturamento do provider não acionam fallback.** Falhas técnicas não são cobradas do lojista.
- **Resposta pública identificável e não reveladora.** Falhas elegíveis e não elegíveis produzem um código público estável e uma **referência de atendimento** correlacionável no admin/suporte com diagnóstico interno seguro e preciso. A mensagem ao lojista não revela saldo, quota, faturamento ou detalhes internos do provider.
- **Instrumentação de execução.** A qualidade é propagada até o adapter de imagem; cada tentativa é observada por modelo–qualidade; o custo é calculado por par modelo–qualidade.
- **Tratamento fail-closed de configuração inválida.** Configuração ausente, incompleta ou divergente do catálogo elegível bloqueia a execução do novo fluxo com erro claro — o sistema **não** substitui silenciosamente o modelo escolhido.
- **Pricing fail-closed no novo fluxo.** Um par cuja cobertura de pricing seja `partial` ou `missing` não é executável pelo novo fluxo e falha de forma identificável, sem inventar custo. A cadeia de `resolveAiCost` do **fluxo legado** (`fallback_static`/`not_available`) permanece separada e intacta.

**Fora de escopo desta fase (fatias posteriores):** formulário do lojista, seletor de intenção (Oferta/Destaque/Exclusivo), direção de fundo, formato 1:1, chaves de ativação por loja, geração produtiva pelo novo fluxo, aprovação/reprovação humana, cobrança por correção. Esta fase **não** reativa a revisão automática nem o mecanismo antigo de regeneração da F37, e **não** altera o pipeline legado.

## Capabilities

### New Capabilities

- `image-generation-model-pair-config`: configuração global administrativa de um par principal e um par fallback (modelo + qualidade) para o novo fluxo de imagem, catálogo elegível fechado, RPC auditada, leitura server-only e validação fail-closed, isolada da seleção legada.
- `image-generation-config-snapshot`: contrato de snapshot imutável da configuração (par principal/fallback, versão e origem) registrado por operação de geração, preservando a reprodutibilidade e protegendo campanhas/correções existentes de mudanças posteriores no admin.
- `image-generation-failure-policy`: taxonomia de falhas elegíveis e não elegíveis e a política de execução (até duas tentativas no principal, uma no fallback, no máximo três chamadas; `rate_limit` transitório; quota/faturamento sem fallback; falha técnica não cobrada).
- `image-generation-support-reference`: resposta pública identificável ao lojista (código público + referência de atendimento) sem revelar motivo interno, com correlação segura entre a referência e o diagnóstico interno no admin/suporte.
- `image-generation-instrumentation`: propagação da qualidade até o adapter de imagem, observabilidade por tentativa (modelo–qualidade) e cálculo de custo por par modelo–qualidade.

### Modified Capabilities

- `ai-model-catalog`: registra os modelos de imagem elegíveis do novo fluxo (`gpt-image-2.5-flare`, `gpt-image-2.5-sunburst` além de `gpt-image-2`) sem alterar a seleção legada nem ativar o novo fluxo.
- `ai-model-pricing`: adiciona a dimensão de qualidade ao pricing/cobertura dos pares elegíveis, de forma aditiva e sem alterar a cadeia de resolução de custo do fluxo legado.
- `ai-invocation-gateway`: o envelope de telemetria por tentativa passa a registrar o par modelo–qualidade efetivamente usado, preservando "um envelope por tentativa real" e a invocação sem retry/fallback automático.

## Critérios de Aceite Verificáveis

1. O admin permite salvar um par principal e um par fallback, cada um `modelo + qualidade`, restrito ao catálogo elegível; qualquer combinação fora da lista é rejeitada com erro claro.
2. A configuração é auditada (motivo obrigatório, autor e timestamp) e pode ser lida server-side; não há mutação direta por query builder.
3. A escolha inicial registrada é `principal = gpt-image-2.5-sunburst/medium`, `fallback = gpt-image-2/medium`, marcada como decisão humana expressa do responsável **não ativa em produção**.
4. Com a nova configuração definida e **sem** ativação, o comportamento do fluxo legado permanece idêntico: seleção legada, `MODEL_REGISTRY`, pipeline de geração, revisão automática e regeneração da F37 inalterados (diferença de fronteiras produtivas vazia nos caminhos legados).
5. Cada operação do novo fluxo persiste um snapshot imutável da configuração usada (par principal/fallback, versão, origem); alterar a configuração no admin depois **não** modifica o snapshot de operações anteriores.
6. Configuração ausente/inválida/divergente do catálogo faz a operação falhar de forma fail-closed com erro identificável, **sem** trocar silenciosamente o modelo.
7. A política de execução respeita: até 2 tentativas no principal, fallback elegível com 1 tentativa, máximo de 3 chamadas; `rate_limit` repete uma vez no principal e depois usa fallback; quota esgotada e erro de faturamento **não** acionam fallback.
8. Falha técnica elegível ou não elegível gera código público e **referência de atendimento**; a mensagem pública não contém saldo, quota, faturamento nem texto cru do provider; admin/suporte correlaciona a referência com diagnóstico interno.
9. A qualidade configurada chega ao adapter e é registrada por tentativa na telemetria; o custo é resolvido por par modelo–qualidade.
10. Nenhuma chamada paga é executada por testes/CI; a fase **não** gera campanha, não ativa geração e não promove o fluxo novo.
11. Um par com pricing incompleto (`partial`/`missing`) não é executável pelo novo fluxo (falha identificável, sem custo inventado), enquanto o fluxo legado mantém a cadeia `fallback_static`/`not_available` inalterada.

**Escopo de verificação na F56.1:** os critérios que descrevem operações reais — snapshot no início de uma campanha (critério 5), não-cobrança de falha técnica (critério 7/8) e aplicação da política de tentativas sobre geração (critério 7) — são entregues e verificados na F56.1 como **contrato/componente testado por simulação** (sem campanha, sem provider, sem crédito real). Sua **integração transacional** é da F56.2. Os demais critérios (configuração, catálogo, fail-closed, pricing, referência, isolamento) são verificáveis integralmente na F56.1.

## Migração e Compatibilidade com o Fluxo Legado

- **Aditivo por padrão.** Novas tabelas/colunas/rotas são aditivas. Colunas legadas permanecem com semântica atual (ex.: `ai_model_pricing` continua a resolver igual quando a qualidade é nula).
- **Isolamento até a ativação.** A configuração e a instrumentação do novo fluxo não são consumidas pelo pipeline produtivo legado; a ativação ocorre apenas nas fatias F56.2/F56.3.
- **Preservação da seleção legada.** `ai_model_selection` e `PersistedModelResolver` permanecem a fonte do fluxo atual; a nova configuração é uma entidade distinta (modelo + qualidade) e não sobrescreve a seleção existente.
- **Separação da regra de pricing.** O novo fluxo exige cobertura de pricing completa do par e falha fechado quando ela falta; o fluxo legado mantém a cadeia `fallback_static`/`not_available` inalterada.
- **Snapshot como barreira temporal.** Introduzir o snapshot por operação é o que garante que a evolução do admin não reescreva o passado; a ausência de snapshot em operações legadas é esperada e tolerada.
- **Ordem de migração.** (1) criar/testar localmente; (2) UAT local sem chamada paga; (3) aplicar migration no remoto; (4) deploy do código; (5) só então F56.2 pode consumir a configuração.
- **Rollback.** Remover/desabilitar a configuração e o consumo novo não afeta o legado; a migration é reversível (`DROP`/feature flag) sem tocar dados de campanhas.

## Riscos

- **Resultados da bancada não são garantia universal.** A escolha de `sunburst/medium` como principal deriva de testes limitados; o modelo pode se comportar de forma diferente no fluxo produtivo. Mitigação: registrar como decisão humana, manter fallback definido e prever reavaliação nas fatias seguintes.
- **Divergência entre configuração e preço/qualidade.** Um par pode não ter pricing de qualidade correspondente. Mitigação: cobertura explícita (`complete`/`partial`/`missing`) e fail-closed na execução.
- **Falha de classificação.** Uma falha de entrada/autorização tratada como falha de modelo geraria fallback e chamadas inúteis. Mitigação: taxonomia explícita das falhas elegíveis e testes dedicados antes da ativação.
- **Vazamento de motivo interno.** Mensagem pública revelar saldo/quota/faturamento. Mitigação: contrato de mensagem pública fechado e correlação apenas interna por referência.
- **Regressão no legado.** Alterar `ai_model_catalog`/pricing podendo afetar o comportamento atual. Mitigação: mudanças aditivas, testes de regressão e fronteira produtiva verificada.
- **Confusão de nomes/tabelas.** Criar um segundo catálogo concorrente ao da F47. Mitigação: reutilizar `ai_model_catalog` e `ai_model_pricing`, sem ledger paralelo.

## Decisões Técnicas Ainda Abertas

Somente detalhes de implementação ainda pendentes. Os itens estruturais já estão fechados em `design.md` (D1, D3, D7, D9, D10, D11) e **não** são rediscutidos aqui.

- Meio de persistência do snapshot (colunas dedicadas versus JSONB), mantendo o congelamento por campanha de D4.
- Formato literal (namespace/tamanho) do código público e do token de referência — a forma já é D6 (token opaco aleatório, conjunto mínimo de categorias).
- Enumeração exata das categorias públicas voltadas ao usuário, respeitando a restrição de D6.
- Identificador/nome da capacidade própria do novo fluxo usada para registrar os modelos elegíveis (D10).
- Granularidade do gate de pricing fail-closed (na gravação, na ativação F56.2 ou na execução), mantendo D9.

## Checkpoint Humano

Esta proposta **para para revisão humana antes de qualquer implementação**. Nenhum código, migration, chamada paga ou ativação deve ocorrer antes da aprovação explícita do responsável, em especial da escolha do par principal/fallback e das decisões técnicas abertas acima.

## Impact

- **Banco (migration [BLOCKING])**: nova configuração de par de imagem do novo fluxo e RPC auditada; snapshot por operação; coluna/dimensão de qualidade no pricing; registro dos modelos elegíveis no `ai_model_catalog`. Sem alterar dados ou comportamento do fluxo legado.
- **Código novo (F56.1, sem ativar geração)**: serviço de leitura/configuração do par, validação fail-closed contra o catálogo elegível, contrato de snapshot, taxonomia de falhas, referência de atendimento, instrumentação de qualidade/telemetria/custo. Entrega **componentes e testes simulados**.
- **Fronteira com F56.2**: a F56.1 NÃO grava snapshot de uma operação real de campanha, NÃO debita crédito e NÃO aplica a política sobre uma geração real. A integração transacional (snapshot no início da campanha, não-débito e execução da política sobre geração real) é da **F56.2**.
- **Código alterado (aditivo)**: `src/lib/ai/*` (catalog/pricing/registry, envelope de qualidade), `src/lib/ai-cost/*` (custo por qualidade), `src/app/api/admin/*` e tela admin, schemas Zod e labels de auditoria.
- **Design**: seguir `openspec/design-system/MASTER.md` (dark OLED `#020617`/`#F8FAFC`/`#22C55E`, Poppins/Open Sans, `lucide-react`, sem emojis, sem light mode).
- **Validação**: typecheck, lint, build, testes locais e `openspec validate --strict`; nenhuma chamada paga e nenhuma alteração de produção.
- **Referências de planejamento**: `docs/alinhamento-roadmap-pos-f48-1.md`, `.planning/ROADMAP.md`, `.planning/STATE.md` e os contratos atuais de seleção de modelos, gateway, geração de imagem, custos e telemetria.
