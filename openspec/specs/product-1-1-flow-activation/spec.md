# Product 1:1 Flow Activation

## Purpose

Define the server-side three-state activation controls for the Product 1:1 flow: OFF, test stores and all stores, with coordinated admin action, audit, idempotency and shutdown.

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

O sistema SHALL manter a ativação sob controle administrativo explícito e SHALL NOT habilitar lojas reais por omissão. Componentes do novo fluxo SHALL ser montados somente sob elegibilidade server-side; com decisão negativa, roteamento e UI permanecem no legado. A ativação SHALL depender das chaves aplicáveis e de autorização vigente, e o desligamento SHALL ser possível sem deploy.

#### Scenario: Sem elegibilidade, legado
- **WHEN** a decisão server-side nega o novo fluxo
- **THEN** os componentes do novo fluxo não são montados
- **AND** o lojista permanece no fluxo legado

#### Scenario: Ativação não é efeito colateral
- **WHEN** uma chave é lida ou registrada sem a ação administrativa coordenada
- **THEN** o fluxo não é ativado apenas por isso
- **AND** a autorização continua independente da chave

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

O sistema SHALL permitir a habilitação do estágio `test_stores` no **ambiente operacional**, restrita ao escopo de lojas de teste (`scope="test_stores"`), alinhando a RPC de concessão, a rota admin e o gate de gasto. O sistema SHALL também permitir o estágio `all_stores` com escopo `all_stores` no ambiente operacional, com as duas autorizações necessárias. A aprovação da abertura geral SHALL ser registrada no checkpoint humano e a ativação SHALL exigir o comando administrativo autenticado; a RPC **não** consulta documentos para verificar a aprovação. A via `isolated_pilot` SHALL permanecer **inalterada** (ambiente `isolated`). Combinações incompatíveis de estágio, escopo, instância ou ambiente SHALL permanecer recusadas.

#### Scenario: Estágio test_stores operacional é aceito apenas para lojas de teste
- **WHEN** um admin concede `test_stores` com escopo `test_stores`
- **THEN** a concessão é `granted`, auditada e revalidada server-side
- **AND** apenas lojas de teste (`is_test_store=true`) são elegíveis no ambiente operacional

#### Scenario: Estágio all_stores é aceito na abertura aprovada
- **WHEN** a abertura geral foi aprovada no checkpoint e um admin concede `all_stores` com escopo `all_stores`
- **THEN** a concessão é `granted`, auditada e vinculada à instância canônica
- **AND** lojas gerais são elegíveis somente com a chave geral ligada

#### Scenario: all_stores não habilita sem comando autenticado
- **WHEN** não há comando administrativo autenticado de ativação
- **THEN** nenhuma loja geral é habilitada
- **AND** a autorização e a chave não são alteradas por omissão

#### Scenario: Aprovação não é consultada pelo código
- **WHEN** a RPC de ativação é chamada por um admin autenticado
- **THEN** ela valida modo, instância, autorização e chaves
- **AND** não lê documentos, specs ou arquivos de evidência para decidir

#### Scenario: isolated_pilot permanece inalterado
- **WHEN** a via `isolated_pilot` é usada
- **THEN** ela continua exigindo escopo `test_stores` e ambiente `isolated`
- **AND** nenhuma mudança é feita na sua matriz

#### Scenario: Gate de gasto arma nos dois escopos
- **WHEN** a loja é de teste ou geral, a autorização correspondente está vigente e a flag aplicável está válida
- **THEN** o gate de gasto resolve `armed`
- **AND** incerteza de leitura permanece `blocked`

#### Scenario: Instância canônica obrigatória
- **WHEN** a autorização é concedida no operacional
- **THEN** ela é vinculada à identidade canônica da instância (host server-side)
- **AND** a revalidação exige correspondência exata

### Requirement: Concessão operacional bloqueada nesta change

A API/RPC operacional SHALL recusar combinações inválidas de estágio, escopo, instância ou ambiente, preservando a barreira global. A via para `all_stores` SHALL ser a **autorização `all_stores` + `all_stores`** com instância, escopo, auditoria e revogação, acionada pelo comando administrativo autenticado após o checkpoint. A autorização `test_stores` SHALL permanecer limitada a `test_stores`. A aprovação humana é um registro de processo; o sistema SHALL NOT fingir que a valida documentalmente. Testes de lógica usam dados controlados e não chamam caminhos operacionais não autorizados.

#### Scenario: Combinação inválida continua recusada
- **WHEN** um admin tenta conceder estágio habilitador fora das vias válidas
- **THEN** a API/RPC recusa e registra a recusa
- **AND** a autorização operacional correspondente permanece `off`

#### Scenario: Barreira preservada
- **WHEN** a abertura geral é ativada
- **THEN** combinações inválidas de estágio, escopo, instância ou ambiente continuam recusadas
- **AND** nenhuma loja fora do escopo autorizado é habilitada

#### Scenario: Fixture de estágio não ativa fluxo real
- **WHEN** testes inserem dados sintéticos na instância descartável
- **THEN** somente a função pura/harness é exercitada
- **AND** nenhum usuário, loja, provider ou endpoint produtivo é habilitado

### Requirement: Roteamento e UI usam decisão server-side

Roteamento e UI SHALL consultar a decisão server-side considerando as duas flags lidas validamente, a flag aplicável e a autorização independente vigente. A UI SHALL omitir seletores quando a decisão negar; o POST SHALL revalidar. A ativação e o desligamento SHALL refletir o estado persistido sem depender de deploy.

#### Scenario: Fluxo desligado
- **WHEN** a autorização ou a flag aplicável não permite o estado
- **THEN** payload legado segue legado
- **AND** nenhum campo novo é enviado

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

A habilitação de lojas de teste para uso real SHALL ser avaliada somente **após** a validação do piloto controlado, executado em loja de teste com **autorização humana específica** e **pricing completo**. A abertura geral para `all_stores` SHALL ocorrer somente após: (i) as provas hospedadas 5.3 e 5.7 concluídas; (ii) a validação de Luna nas três capacidades; (iii) uma campanha completa em loja de teste; (iv) o aceite humano do resultado; e (v) a disposição explícita sobre D13/kill real. O piloto **hospedado** restrito a lojas de teste SHALL ocorrer no **ambiente operacional** sob autorização `test_stores`, com o **fluxo mantido OFF** fora da janela.

#### Scenario: Piloto em loja de teste com autorização e pricing completo
- **WHEN** o piloto controlado é executado
- **THEN** ele ocorre em loja de teste (`is_test_store = true`) sob autorização `test_stores` vigente
- **AND** usa pricing completo (principal e fallback) e teto aprovado

#### Scenario: Habilitação só depois da validação
- **WHEN** o piloto ainda não foi validado ou o aceite humano não foi registrado
- **THEN** a habilitação de lojas de teste não é concedida
- **AND** a abertura geral permanece fora de escopo

#### Scenario: Abertura geral só depois das provas
- **WHEN** 5.3, 5.7, a validação de Luna ou o aceite humano estão pendentes
- **THEN** `all_stores` não é ativado
- **AND** nenhuma loja geral é habilitada

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

O novo fluxo SHALL cobrir **testes negativos**: **flag desligada**, **loja não-test**, **instância/ambiente não autorizado**, **escopo geral sem autorização ou chave** e **autorização sem flag**. O **fluxo legado** SHALL permanecer **inalterado** (sem regressão intencional).

#### Scenario: Flag desligada
- **WHEN** a flag aplicável está desligada
- **THEN** o novo fluxo é negado
- **AND** nenhuma geração ocorre

#### Scenario: Loja não-test no estado de teste
- **WHEN** a loja não é de teste e apenas o estado de lojas de teste está ativo
- **THEN** o novo fluxo é negado
- **AND** a loja permanece no legado

#### Scenario: Instância ou combinação não autorizada
- **WHEN** a instância canônica não corresponde **ou** a combinação estágio×ambiente×escopo é incompatível
- **THEN** o novo fluxo é negado
- **AND** nenhuma geração ocorre

#### Scenario: Escopo geral sem autorização ou chave
- **WHEN** se tenta o escopo geral (`all_stores`) sem autorização vigente ou sem a chave geral
- **THEN** a decisão nega o novo fluxo
- **AND** a produção permanece intocada

#### Scenario: Autorização sem flag
- **WHEN** a autorização está vigente mas a chave aplicável está desligada
- **THEN** a decisão nega o novo fluxo
- **AND** a autorização sozinha não habilita geração

#### Scenario: Legado sem regressão
- **WHEN** os estados de teste ou geral são exercidos
- **THEN** o comportamento do fluxo legado permanece inalterado
- **AND** não há regressão intencional do legado

### Requirement: Três estados operacionais do novo fluxo

O sistema SHALL representar o estado operacional do Produto 1:1 por exatamente três estados canônicos, derivados das duas chaves existentes e da autorização vigente: **OFF** (ambas as chaves desligadas e nenhuma autorização habilitadora), **lojas de teste** (`product_1_1_test_stores_enabled=true`, `product_1_1_all_stores_enabled=false`, autorização `test_stores` + `test_stores` vigente) e **todas as lojas** (`product_1_1_all_stores_enabled=true`, `product_1_1_test_stores_enabled=false`, autorizações `all_stores` + `all_stores` e `test_stores` + `test_stores` vigentes). A chave geral SHALL prevalecer quando ambas estiverem ligadas, e nenhum parâmetro do cliente SHALL alterar o estado.

#### Scenario: Ambas OFF mantêm o legado
- **WHEN** as duas chaves estão desligadas e não há autorização habilitadora vigente
- **THEN** novas gerações seguem o fluxo legado
- **AND** nenhuma loja é encaminhada ao novo fluxo

#### Scenario: Somente lojas de teste
- **WHEN** apenas `product_1_1_test_stores_enabled=true` e a autorização `test_stores` está vigente
- **THEN** lojas com `is_test_store=true` são elegíveis ao novo fluxo
- **AND** lojas com `is_test_store=false` permanecem no legado

#### Scenario: Todas as lojas incluem lojas de teste
- **WHEN** `product_1_1_all_stores_enabled=true` e as autorizações `all_stores` e `test_stores` estão vigentes
- **THEN** lojas gerais e lojas de teste são elegíveis ao novo fluxo
- **AND** a loja de teste não é excluída por exigir o escopo `test_stores`

#### Scenario: Chave geral sem autorização não habilita
- **WHEN** `product_1_1_all_stores_enabled=true` e a autorização `all_stores` está ausente, revogada, expirada ou de outra instância
- **THEN** a decisão nega o novo fluxo
- **AND** nenhuma loja é habilitada

### Requirement: Ação administrativa coordenada de ativação e desligamento

A ativação e o desligamento SHALL ocorrer por uma única ação normal no admin, autenticada e auditada, que altere as chaves existentes e conceda/revogue as autorizações necessárias sem SQL manual, executor ou deploy. A ação SHALL executar em **uma única transação de banco**, com trava de serialização, registro durável por `operationId` e validação de `reason`/`operationId`; ator e instância são derivados no servidor. Cada mutação interna SHALL ter auditoria própria, e a ação só SHALL reportar um modo após verificar as chaves e a decisão server-side. O checkpoint humano registra a autorização operacional; a confirmação administrativa autenticada é o comando de ativação — o código SHALL NOT consultar documentos ou evidências para decidir.

#### Scenario: Ativar lojas de teste
- **WHEN** um admin autorizado seleciona o estado de lojas de teste
- **THEN** a chave geral é desligada, a chave de teste é ligada e `test_stores` é concedida
- **AND** `all_stores` é revogada se houver estágio vigente
- **AND** a verificação final permite lojas de teste e nega lojas gerais

#### Scenario: Ativar todas as lojas
- **WHEN** um admin autorizado e confirmado seleciona o estado de todas as lojas
- **THEN** as autorizações `all_stores` e `test_stores` são concedidas, a chave geral é ligada e a chave de teste é desligada
- **AND** a verificação final permite lojas gerais e lojas de teste

#### Scenario: Passar de todas para lojas de teste
- **WHEN** o estado atual é todas as lojas e o admin seleciona lojas de teste
- **THEN** a chave geral é efetivamente desligada
- **AND** a chave de teste é ligada e `all_stores` é revogada
- **AND** a verificação final nega lojas gerais e permite lojas de teste

#### Scenario: Falha em qualquer passo reverte tudo
- **WHEN** qualquer mutação ou verificação da ação falha
- **THEN** a transação inteira é revertida
- **AND** nenhum modo é reportado como aplicado
- **AND** o estado anterior permanece verificável

#### Scenario: Repetição do mesmo operationId
- **WHEN** a mesma ação é repetida com o mesmo `operationId` e o mesmo conteúdo
- **THEN** o resultado gravado é retornado como idempotente
- **AND** nenhuma mutação é reaplicada

#### Scenario: Replay não exibe estado antigo como atual
- **WHEN** o replay retorna um resultado histórico e outra ação já mudou o modo
- **THEN** o endpoint relê as flags e autorizações e devolve o `currentMode` vigente
- **AND** a UI exibe o estado atual relido, não o modo antigo do replay
- **AND** nenhuma mutação é reaplicada

#### Scenario: Autorização expirada não conta como ativa
- **WHEN** a autorização mais recente está expirada e a chave está ligada
- **THEN** a leitura do estado não a apresenta como modo ativo
- **AND** uma nova ativação não é tratada como `already_in_mode`
- **AND** a nova concessão vigente passa a valer

#### Scenario: operationId divergente
- **WHEN** o mesmo `operationId` é reutilizado com conteúdo diferente
- **THEN** a ação retorna conflito
- **AND** nenhuma mutação é aplicada

#### Scenario: Ações concorrentes
- **WHEN** duas ações de ativação concorrem
- **THEN** a trava serializa a execução
- **AND** cada ação verifica o estado resultante antes de reportar sucesso

#### Scenario: Desligar
- **WHEN** um admin autorizado seleciona OFF
- **THEN** as duas chaves são desligadas e as duas autorizações são revogadas na mesma transação
- **AND** OFF só é reportado após releitura das duas chaves `false` e decisão negando os dois escopos
- **AND** nenhuma outra mutação é aplicada se a verificação falhar

### Requirement: Desligamento preserva operações em andamento

O desligamento normal SHALL ser chaves OFF + revogação da autorização. Ele SHALL NOT cancelar campanhas persistidas nem operações em andamento, SHALL NOT apagar ledger, histórico ou configuração, e SHALL NOT usar `VENDEO_GENERATION_PAUSED` como controle do novo fluxo. O download e a recuperação de campanhas já criadas SHALL continuar determinados pelo fluxo persistido da campanha.

#### Scenario: Operação em voo continua
- **WHEN** o fluxo é desligado durante uma operação já iniciada
- **THEN** a operação segue suas vias de recuperação, entrega ou estorno
- **AND** nenhuma campanha é cancelada automaticamente

#### Scenario: Novas gerações voltam ao legado
- **WHEN** o desligamento é concluído
- **THEN** novas submissões usam o fluxo legado
- **AND** campanhas concluídas continuam baixáveis pelo fluxo persistido

#### Scenario: Pausa global não é usada
- **WHEN** o desligamento normal é executado
- **THEN** `VENDEO_GENERATION_PAUSED` permanece inalterado
- **AND** o legado continua operando

## Pilot Scope and Deferred Items

The operational `test_stores` authorization was scoped to the **N=1 hosted pilot** in
56.2.6. Items **5.3** (hosted refund path) and **5.7** (post-redeploy replay) were
**deferred by responsible decision and not executed** at that time; that historical
record and the `DEFERRED.md` pointer are preserved in the archived 56.2.6 change.

In 56.2.7, **5.3 and 5.7 were executed and proven in the hosted environment**:
5.3 passed with a single refund and idempotent replay; 5.7 passed with a `delivered`
operation replayed after redeploy, unchanged artifact hash and no new generation,
upload, provider, event or credit transaction.

The general opening was authorized in 56.2.7. `all_stores` is active under the
**7-day monitoring transferred on 2026-10-19 and still in progress**; the flow is not
automatically shut down. D13 remains accepted only for the monitored opening; the real
platform kill remains **INCONCLUSIVE**. The 56.2.6 evidence and its deferral are not
rewritten.

Durable monitoring pointer: `.planning/phases/56.2.7-abertura-gradual-produto-1-1-luna/56.2.7-MONITORING-TRANSFER.md`.

Durable 56.2.6 deferral pointer: `openspec/changes/archive/2026-10-19-fase-56-2b2d-piloto-hospedado-produto-1-1-test-stores/DEFERRED.md`.
