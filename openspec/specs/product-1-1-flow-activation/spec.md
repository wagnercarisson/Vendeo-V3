# Product 1:1 Flow Activation

## Purpose

Define the server-side activation controls and inactive preparation boundary for the Product 1:1 generation flow.

## Requirements

### Requirement: Estrutura das duas chaves de ativação, desligadas por padrão

O sistema SHALL registrar em `feature_flags` **duas** chaves de ativação do novo fluxo Produto 1:1: uma para lojas com `stores.is_test_store = true` e outra para todas as lojas. Ambas SHALL começar **desligadas** e SHALL ser alteráveis pela RPC administrativa auditada existente.

#### Scenario: Chaves desligadas mantêm o fluxo legado

- **WHEN** as duas chaves estão desligadas
- **THEN** a decisão de fluxo resulta no fluxo legado
- **AND** o novo fluxo não é selecionado

#### Scenario: Chave de lojas de teste é representável

- **WHEN** a chave de lojas de teste está ligada e a chave geral está desligada
- **THEN** a decisão identifica lojas com `is_test_store = true` como elegíveis ao novo fluxo
- **AND** lojas com `is_test_store = false` permanecem no legado

#### Scenario: Chave geral é representável

- **WHEN** a chave geral está ligada
- **THEN** a decisão identifica todas as lojas elegíveis como elegíveis ao novo fluxo
- **AND** a loja de teste também é elegível

### Requirement: Decisão server-side pura e fail-closed

A função de decisão SHALL ser server-side e testável isoladamente. Chave ausente, desligada ou com falha de leitura SHALL resultar no fluxo legado; nenhum parâmetro do cliente SHALL forçar o novo fluxo.

#### Scenario: Falha de leitura mantém o legado

- **WHEN** a leitura das chaves falha
- **THEN** a decisão resulta no fluxo legado
- **AND** o novo fluxo não é ativado por omissão

#### Scenario: Chave geral true com falha na chave de lojas de teste

- **WHEN** a leitura de `product_1_1_test_stores_enabled` falha ou a chave está ausente/tem valor inválido
- **AND** `product_1_1_all_stores_enabled` está `true`
- **THEN** a decisão resulta no fluxo legado
- **AND** nenhuma chave parcialmente lida ativa o novo fluxo

#### Scenario: Chave de lojas de teste true com falha na chave geral

- **WHEN** a leitura de `product_1_1_all_stores_enabled` falha ou a chave está ausente/tem valor inválido
- **AND** `product_1_1_test_stores_enabled` está `true`
- **THEN** a decisão resulta no fluxo legado
- **AND** nenhuma chave parcialmente lida ativa o novo fluxo

#### Scenario: Cliente não decide o fluxo

- **WHEN** a decisão é calculada
- **THEN** ela deriva exclusivamente de estado server-side
- **AND** nenhum dado do cliente altera o resultado

### Requirement: Precedência determinística entre as chaves

Quando ambas as chaves estiverem ligadas, a chave **geral** SHALL prevalecer (superconjunto), de forma determinística e documentada.

#### Scenario: Chave geral prevalece

- **WHEN** a chave geral e a chave de lojas de teste estão ligadas
- **THEN** a decisão segue a chave geral
- **AND** o resultado é o mesmo em todas as avaliações

### Requirement: Barreira de não-ativação nesta fatia

A b1b SHALL conectar rota, formulário e geração, mas SHALL manter as duas flags e a autorização em `off`; nenhuma loja real SHALL ser encaminhada ao novo fluxo nesta fatia. Os componentes do novo fluxo SHALL ser montados somente sob elegibilidade server-side; com decisão negativa, o roteamento e a UI permanecem no fluxo legado. Nenhuma chamada paga, `db push` ou deploy SHALL ocorrer nesta fatia.

#### Scenario: Chave não encaminha campanhas reais

- **WHEN** uma chave estiver ligada nesta fatia
- **THEN** nenhuma campanha real é encaminhada ao novo fluxo
- **AND** o fluxo produtivo permanece o legado

#### Scenario: Componentes só sob elegibilidade

- **WHEN** o fluxo produtivo do lojista é renderizado sem elegibilidade server-side
- **THEN** os componentes do novo fluxo não são montados
- **AND** o lojista não acessa um caminho incompleto

### Requirement: Autorização independente e flags aplicáveis

O sistema SHALL ler validamente ambas as flags server-side, mas a ativação exige apenas a flag aplicável ao escopo da loja e autorização independente vigente. A autorização reside em armazenamento dedicado durável, contém estágio/escopo/instância/concessor/validade/revogação/motivo/operation_id, e só pode ser concedida ou revogada por admin autenticado via API/RPC auditada. Em b1a o estado operacional SHALL permanecer `off`.

#### Scenario: Uma flag aplicável mais autorização válida
- **WHEN** ambas as flags foram lidas com sucesso, a flag aplicável está ligada e a autorização controlada corresponde ao estágio/escopo
- **THEN** a função pura de decisão permite o estágio no harness isolado
- **AND** o teste não concede autorização operacional nem habilita loja

#### Scenario: Flag não aplicável não precisa estar ligada
- **WHEN** loja de teste tem flag test-stores ligada e flag geral desligada, com autorização correspondente
- **THEN** a flag aplicável permite o cenário controlado
- **AND** a ativação geral continua desligada

#### Scenario: Falha em qualquer leitura é fail-closed
- **WHEN** a leitura de qualquer flag ou autorização falha
- **THEN** a função de decisão não permite o fluxo novo

### Requirement: Ativação operacional restrita a lojas de teste

O sistema SHALL permitir a habilitação do estágio `test_stores` no **ambiente operacional**, restrita ao escopo de lojas de teste (`scope="test_stores"`), alinhando a RPC de concessão, a rota admin e o gate de gasto. A via `isolated_pilot` SHALL permanecer **inalterada** (ambiente `isolated`). O escopo geral (`all_stores`) SHALL permanecer **sempre recusado**.

#### Scenario: Estágio test_stores operacional é aceito apenas para lojas de teste
- **WHEN** um admin concede `test_stores` com escopo `test_stores`
- **THEN** a concessão é `granted`, auditada e revalidada server-side
- **AND** apenas lojas de teste (`is_test_store=true`) são elegíveis no ambiente operacional

#### Scenario: isolated_pilot permanece inalterado
- **WHEN** a via `isolated_pilot` é usada
- **THEN** ela continua exigindo escopo `test_stores` e ambiente `isolated`
- **AND** nenhuma mudança é feita na sua matriz

#### Scenario: all_stores permanece recusado
- **WHEN** se tenta conceder `all_stores` ou qualquer escopo `all_stores`
- **THEN** a RPC recusa e registra a recusa
- **AND** o escopo geral permanece bloqueado

#### Scenario: Gate de gasto arma para test_stores
- **WHEN** a loja é de teste, o estágio `test_stores` está vigente e as flags são válidas
- **THEN** o gate de gasto resolve `armed`
- **AND** estágios/escopos não-estreitos permanecem `blocked`

#### Scenario: Instância canônica obrigatória
- **WHEN** a autorização é concedida no operacional
- **THEN** ela é vinculada à identidade canônica da instância (host server-side)
- **AND** a revalidação exige correspondência exata

### Requirement: Concessão operacional bloqueada nesta change

A API/RPC operacional SHALL **recusar** estágios habilitadores no **escopo geral** antes do gate da F56.2b2. A **barreira global NÃO é removida**. A **única** via para habilitar o **teste real isolado** SHALL ser a **autorização temporária ESTREITA** (capability `product-1-1-controlled-real-test-authorization`), com **instância** e **escopo de lojas de teste**, **auditoria** e **revogação** (a **expiração existente** é respeitada quando informada). Testes de lógica usam dados controlados e não chamam esse caminho operacional.

#### Scenario: Fixture de estágio não ativa fluxo real
- **WHEN** testes inserem dados sintéticos de estágios na instância descartável
- **THEN** somente a função pura/harness é exercitada
- **AND** nenhum usuário, loja, provider ou endpoint produtivo é habilitado

#### Scenario: Concessão operacional precoce recusada
- **WHEN** um admin tenta conceder estágio habilitador de escopo geral antes do gate autorizado
- **THEN** API/RPC recusa e registra a recusa
- **AND** a autorização operacional de escopo geral permanece `off`

#### Scenario: Barreira global preservada
- **WHEN** o teste real isolado é autorizado por recorte estreito
- **THEN** a recusa de estágios habilitadores de escopo geral permanece
- **AND** nenhuma loja fora do recorte autorizado é habilitada

### Requirement: Roteamento e UI usam decisão server-side

Roteamento e UI SHALL consultar a decisão da b1a: ambas as flags lidas validamente, somente a flag aplicável ligada junto à autorização independente vigente. A UI SHALL omitir seletores em `off`; o POST SHALL revalidar. Nesta change, autorização e flags SHALL permanecer `off`.

#### Scenario: Fluxo desligado
- **WHEN** autorização/flag aplicável não permite o estágio
- **THEN** payload legado segue legado; nenhum campo novo é enviado

#### Scenario: Elegibilidade revogada
- **WHEN** a decisão muda antes do POST
- **THEN** payload com campos exclusivos recebe erro seguro antes de reservar crédito

#### Scenario: Campanha criada mantém fluxo
- **WHEN** flag ou autorização muda após a criação
- **THEN** o download continua determinado pelo fluxo persistido da campanha

### Requirement: Estado persistido e feedback seguro

A UI SHALL refletir o **estado persistido** da campanha/lançamento com **feedback seguro**, sem expor motivo interno. A campanha concluída SHALL ser recuperável **ao retornar ao aplicativo** (persistência do resultado). A UI SHALL NOT controlar a execução nem prometer retomada automática de processamento interrompido. O **reenvio SHALL ser somente consulta**; a UI SHALL NOT oferecer **“Gerar novamente”** para a mesma operação.

#### Scenario: Estado exibido ao retornar
- **WHEN** o lojista retorna ao aplicativo após uma campanha concluída
- **THEN** a UI exibe o estado persistido real
- **AND** o resultado persistido é recuperado

#### Scenario: Resultado desconhecido sem “Gerar novamente”
- **WHEN** o resultado da geração é desconhecido
- **THEN** a UI exibe **“Não foi possível confirmar a conclusão desta geração”** com a referência de suporte
- **AND** a UI **não** oferece “Gerar novamente” para essa mesma operação
- **AND** o reenvio apenas consulta a operação

#### Scenario: Sem retomada automática
- **WHEN** a execução não concluiu (ex.: conexão caiu)
- **THEN** a UI não promete continuidade nem retomada automática

#### Scenario: Mensagem pública sanitizada
- **WHEN** a operação falha
- **THEN** a UI mostra `IMG-001` e a referência opaca
- **AND** não revela causa interna

### Requirement: Validação local-primeiro

A validação SHALL ocorrer **primeiro localmente**, no **ambiente Docker/Supabase isolado**, com **lojas de teste** e **provider simulado**, cobrindo formulário, geração, estados, persistência, copy, recuperação, créditos e download. **Nenhuma chamada paga** SHALL ocorrer em CI. Somente **depois** SHALL ocorrer o **teste real controlado local**, sob **autorização humana específica** e **teto de gasto**.

#### Scenario: Testes locais com provider simulado
- **WHEN** a validação local roda no ambiente isolado
- **THEN** o provider é simulado e nenhuma chamada paga ocorre
- **AND** formulário, geração, estados, persistência, copy, recuperação, créditos e download são cobertos

#### Scenario: Teste real só depois e sob autorização
- **WHEN** se pretende executar o teste real controlado
- **THEN** a validação local-primeiro já foi concluída
- **AND** há autorização humana específica e teto de gasto
- **AND** a execução ocorre no recorte autorizado

#### Scenario: Preview restrito é posterior e isolado
- **WHEN** se avalia o preview restrito
- **THEN** ele exige configuração isolada de dados/credenciais
- **AND** não basta restringir a URL
- **AND** produção/main, migration remota e habilitação de lojas permanecem decisões posteriores e separadas

### Requirement: Habilitação de lojas de teste condicionada à validação do piloto

A habilitação de lojas de teste para uso real SHALL ser avaliada somente **após** a validação do piloto controlado, executado em loja de teste com **autorização humana específica** e **pricing completo**, e **após** a comprovação da estratégia substituta de D13. O piloto **hospedado** restrito a lojas de teste SHALL ocorrer no **ambiente operacional** sob autorização `test_stores`, com o **fluxo mantido OFF** fora da janela.

#### Scenario: Piloto em loja de teste com autorização e pricing completo
- **WHEN** o piloto controlado é executado
- **THEN** ele ocorre em loja de teste (`is_test_store = true`) sob autorização `test_stores` vigente
- **AND** usa pricing completo (principal e fallback)

#### Scenario: Habilitação só depois da validação
- **WHEN** o piloto ainda não foi validado ou a estratégia de D13 não foi comprovada
- **THEN** a habilitação de lojas de teste não é concedida
- **AND** a abertura geral permanece fora de escopo

### Requirement: Rollback de deploy não reverte banco/ledger

A separação entre deploy e dados SHALL ser explícita: **rollback de deploy não desfaz automaticamente** estado de banco, migrations aplicadas ou ledger de crédito. Migrations remotas e habilitação de lojas permanecem **decisões separadas e autorizadas**.

#### Scenario: Rollback não reverte ledger
- **WHEN** um deploy é revertido
- **THEN** o estado de banco e o ledger permanecem como estavam
- **AND** nenhuma reversão automática de migration/cobrança é executada

### Requirement: Pricing completo e controle de gasto mínimo (alcance real)

O teste real SHALL exigir **pricing `complete` para principal E fallback**, por **modelo+qualidade**, na configuração **própria do fluxo novo** (`image_model_pair_config`) — **não** em `ai_model_selection` (legado). O **controle de gasto mínimo** SHALL **limitar chamadas** (imagem ≤3; copy ≤6), usar **estimativas conservadoras** para **parar** e **prevenir execuções simultâneas**. **Não** existe cap monetário cumulativo hoje e o mecanismo SHALL NOT prometer **garantia financeira** da cobrança final do provider.

#### Scenario: Pricing incompleto bloqueia
- **WHEN** o principal ou o fallback não tem pricing `complete` por modelo+qualidade
- **THEN** a execução é bloqueada antes de reserva/provider
- **AND** nenhum valor é inventado

#### Scenario: Controle mínimo limita chamadas e para
- **WHEN** o limite de chamadas/tentativas ou o limite conservador é atingido
- **THEN** novas chamadas não ocorrem e o estado é encerrado honestamente
- **AND** nenhuma garantia financeira da cobrança final é prometida

#### Scenario: Execuções simultâneas prevenidas
- **WHEN** duas execuções concorrem pela mesma operação
- **THEN** apenas uma vence a aquisição atômica
- **AND** a perdedora não chama o provider

### Requirement: Inspeção humana do resultado do teste real

O **resultado do teste real** SHALL ser submetido a **inspeção humana**. Falhas **raras** do provider SHALL permanecer cobertas por **testes simulados**, sem exigir provocá-las no provider pago.

#### Scenario: Inspeção humana obrigatória
- **WHEN** o teste real produz um resultado
- **THEN** o resultado é inspecionado por humano
- **AND** nenhuma aprovação automática substitui a inspeção

#### Scenario: Falhas raras por simulação
- **WHEN** uma falha rara do provider precisa ser coberta
- **THEN** ela é exercitada por simulação
- **AND** não é exigida no provider pago

### Requirement: Testes negativos de habilitação e não regressão do legado

O novo fluxo SHALL cobrir **testes negativos**: **flag desligada**, **loja não-test**, **instância/ambiente não autorizado** e **escopo geral** (`all_stores`). O **fluxo legado** SHALL permanecer **inalterado** (sem regressão intencional).

#### Scenario: Flag desligada
- **WHEN** o flag de lojas de teste está desligado
- **THEN** o novo fluxo é negado
- **AND** nenhuma geração ocorre

#### Scenario: Loja não-test
- **WHEN** a loja não é de teste
- **THEN** o novo fluxo é negado

#### Scenario: Instância ou combinação não autorizada
- **WHEN** a instância canônica não corresponde **ou** a combinação estágio×ambiente×escopo é incompatível (ex.: `test_stores` em loja não-test, `isolated_pilot` em ambiente operacional)
- **THEN** o novo fluxo é negado
- **AND** nenhuma geração ocorre

#### Scenario: Escopo geral
- **WHEN** se tenta o escopo geral (`all_stores`)
- **THEN** a recusa permanece
- **AND** a produção permanece intocada

#### Scenario: Legado sem regressão
- **WHEN** o recorte de lojas de teste é exercido
- **THEN** o comportamento do fluxo legado permanece inalterado
- **AND** não há regressão intencional do legado

## Pilot Scope and Deferred Items

The operational `test_stores` activation is scoped to the **N=1 hosted pilot**; it does not authorize general stores. Items **5.3** (hosted refund path) and **5.7** (post-redeploy replay) are **deferred by responsible decision, not executed**, and remain required before any general opening. D13 is accepted **only** for the N=1 monitored pilot; the real platform kill remains **INCONCLUSIVE**; `all_stores` remains refused. Durable pointer: `openspec/changes/fase-56-2b2d-piloto-hospedado-produto-1-1-test-stores/DEFERRED.md` (or the corresponding archived path after archive).
