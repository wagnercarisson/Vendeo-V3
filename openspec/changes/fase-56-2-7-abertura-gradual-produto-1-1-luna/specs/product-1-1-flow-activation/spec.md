## ADDED Requirements

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

## MODIFIED Requirements

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
