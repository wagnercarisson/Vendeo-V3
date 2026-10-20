# Product 1:1 Gradual Opening

## Purpose

Abertura gradual do Produto 1:1 com Luna: configuração e validação nas três capacidades, provas hospedadas 5.3/5.7, checkpoints, orçamento, monitoramento e consolidação, sem reabrir a fase 56.2.6.

## Requirements

### Requirement: Luna configurado e validado nas três capacidades

A abertura SHALL exigir que `openai/gpt-6-luna` esteja disponível por catálogo, com protocolo `chat-completions`, pricing vigente por provider/modelo e seleção administrativa explícita para `campaign_copy`, `brand_profile_text` e `brand_profile_vision`. A configuração SHALL ser feita pelas superfícies administrativas existentes, sem código novo quando catálogo e protocolo já existirem, e SHALL registrar a seleção anterior para rollback. A validação SHALL ocorrer em loja de teste, com evidência do modelo efetivo e do resultado funcional em cada capacidade.

#### Scenario: Configuração completa
- **WHEN** a janela de validação é autorizada
- **THEN** as três capacidades têm catálogo ativo, protocolo compatível, pricing vigente e seleção Luna
- **AND** a seleção anterior de cada capacidade está registrada para rollback

#### Scenario: Pricing ausente bloqueia a copy do novo fluxo
- **WHEN** `openai/gpt-6-luna` não tem pricing vigente válido
- **THEN** a copy do novo fluxo é bloqueada antes do provider
- **AND** nenhum valor é inventado

#### Scenario: Validação das três capacidades
- **WHEN** a janela é executada em loja de teste
- **THEN** `campaign_copy`, `brand_profile_text` e `brand_profile_vision` executam com modelo efetivo Luna
- **AND** os resultados são inspecionados por humano

#### Scenario: Fallback de brand profile descarta Luna
- **WHEN** uma seleção de `brand_profile_text` ou `brand_profile_vision` contém fallback preenchido
- **THEN** a seleção é considerada inválida pelo resolver
- **AND** a configuração é corrigida antes de declarar Luna validado

### Requirement: Seleções compartilhadas e impacto no legado

A change SHALL declarar que as seleções de `campaign_copy`, `brand_profile_text` e `brand_profile_vision` são globais por capacidade e afetam também o legado. A validação em loja de teste SHALL NOT ser apresentada como isolamento por loja. A seleção anterior SHALL ser registrada como opção de rollback, mas SHALL NOT ser restaurada automaticamente ao fim de uma janela aprovada: se Luna for aprovado, a seleção é mantida e promovida; a restauração ocorre somente em reprovação, problema ou decisão explícita, pela via administrativa e sem deploy.

#### Scenario: Copy compartilhada
- **WHEN** `campaign_copy` é alterado para Luna
- **THEN** campanhas legadas e do novo fluxo passam a usar Luna
- **AND** o aceite registra esse impacto

#### Scenario: Brand profile compartilhado
- **WHEN** `brand_profile_text` ou `brand_profile_vision` é alterado para Luna
- **THEN** qualquer loja que acione a capacidade usa Luna
- **AND** o aceite registra esse impacto

#### Scenario: Janela aprovada mantém Luna
- **WHEN** a janela é encerrada com aprovação de Luna
- **THEN** a seleção de Luna é mantida para a abertura geral
- **AND** nenhuma restauração automática para o modelo anterior é executada

#### Scenario: Restauração somente em reprovação ou problema
- **WHEN** Luna é reprovado, apresenta problema ou há decisão explícita de reverter
- **THEN** a seleção anterior é restaurada pela via administrativa
- **AND** nenhum deploy é necessário para o rollback

### Requirement: Prova hospedada 5.3 — ausência e falha persistida resultam em estorno único

Antes da abertura geral, o sistema SHALL comprovar no destino hospedado, em operação de teste identificada e loja `is_test_store=true`, que ausência fresca de arte + falha persistida (`failed`) resultam em **um único** `refunded`. A prova SHALL usar as vias existentes, SHALL NOT ampliar RPC, SHALL NOT fabricar evidência e SHALL NOT tocar campanhas de clientes.

#### Scenario: Estorno único com evidência fresca
- **WHEN** a operação de teste tem arte `absent`, `failed` persistido e epoch capturado antes da sonda
- **THEN** o encerramento produz `refunded`
- **AND** o ledger apresenta exatamente um estorno

#### Scenario: Replay é idempotente
- **WHEN** o encerramento é repetido
- **THEN** a RPC retorna idempotência
- **AND** nenhum segundo estorno é registrado

#### Scenario: Evidência inconclusiva não estorna
- **WHEN** a arte é `invalid`/`indeterminate` ou a evidência não é fresca
- **THEN** o estado permanece inconclusivo
- **AND** nenhum estorno é autorizado

#### Scenario: Nenhuma campanha de cliente é afetada
- **WHEN** a prova é executada
- **THEN** apenas a loja/operação de teste identificada participa
- **AND** nenhum provider é chamado pela prova

### Requirement: Prova hospedada 5.7 — replay de entrega após redeploy sem regenerar arte

Antes da abertura geral, o sistema SHALL comprovar no destino hospedado que o replay de `deliver` após um redeploy é idempotente e não regenera arte. A prova SHALL usar uma operação de teste identificada que já estava **entregue (`delivered`) antes do redeploy**, o mesmo `publication_token` e comparação antes/depois de caminho, tamanho e hash da arte, contagens de eventos e transações. Uma operação em `art_uploaded` SHALL NOT ser aceita como PASS, pois testaria a primeira entrega, não o replay de uma entrega concluída.

#### Scenario: Replay após redeploy
- **WHEN** `deliver` é chamado novamente após o redeploy, com a mesma identidade e token, sobre uma operação `delivered` antes do redeploy
- **THEN** a operação permanece `delivered` com idempotência
- **AND** nenhuma nova arte é gerada ou enviada

#### Scenario: Nenhum efeito colateral
- **WHEN** o replay é comparado ao estado anterior
- **THEN** não há nova chamada a provider, novo evento de geração ou nova transação de crédito
- **AND** o caminho, tamanho e hash da arte permanecem iguais

#### Scenario: Operação não entregue não substitui a prova
- **WHEN** a única operação de teste disponível está em `art_uploaded`
- **THEN** ela não é usada como PASS da prova 5.7
- **AND** a prova permanece pendente até existir uma operação entregue antes do redeploy

#### Scenario: Operação de cliente não é usada
- **WHEN** a prova é executada
- **THEN** apenas a operação de teste identificada é usada
- **AND** campanhas de clientes não são tocadas

### Requirement: Checkpoints, orçamento e autorização de gasto

A change SHALL possuir exatamente três checkpoints humanos: **publicação**, **janela paga** e **abertura geral**. Nenhuma chamada paga SHALL ocorrer antes do checkpoint da janela. O orçamento/teto da janela e o teto da abertura geral SHALL ser aprovados antes das chamadas correspondentes; o teto SHALL permanecer um controle de gasto estimado, sem promessa de garantia financeira.

#### Scenario: Publicação com fluxo OFF
- **WHEN** o checkpoint de publicação é aprovado
- **THEN** a migration e o deploy ocorrem com as duas chaves OFF
- **AND** o legado é verificado antes de qualquer configuração de Luna

#### Scenario: Janela paga só com orçamento aprovado
- **WHEN** a janela é iniciada
- **THEN** teto, limites de chamadas, lojas, duração e critérios de parada estão aprovados
- **AND** nenhuma chamada paga ocorre antes do aceite

#### Scenario: Abertura operacional da janela
- **WHEN** a janela é aberta após o Checkpoint 2
- **THEN** o gasto acumulado é registrado, o teto aprovado é configurado sem zerar o histórico e `test_stores` é ativado pelo painel
- **AND** a elegibilidade da loja de teste é confirmada e a loja geral permanece negada
- **AND** nenhuma chamada paga ocorre antes dessa confirmação

#### Scenario: Abertura geral só com novos valores aprovados
- **WHEN** `all_stores` é ativado
- **THEN** o teto/orçamento da abertura e o monitoramento estão aprovados
- **AND** a ativação ocorre pelo admin sem novo deploy

#### Scenario: Teto não é garantia financeira
- **WHEN** o gasto estimado atinge o teto
- **THEN** novas chamadas do novo fluxo são bloqueadas
- **AND** nenhuma garantia sobre a cobrança final do provider é declarada

### Requirement: Monitoramento, desligamento e consolidação documental

A abertura SHALL incluir monitoramento inicial de sucesso/falha/`unknown`, retry/fallback, gasto estimado, claims e uso por loja. O desligamento SHALL ser executado pela ação administrativa normal (chaves OFF + revogação), sem pausar o legado e sem cancelar operações em andamento. Ao final, a documentação operacional e os trackings SHALL ser consolidados sem reabrir a fase 56.2.6.

#### Scenario: Monitoramento inicial
- **WHEN** a abertura geral é ativada
- **THEN** os sinais de gasto, falha, `unknown`, retry/fallback e claims são acompanhados
- **AND** critérios de parada são aplicados

#### Scenario: Desligamento simples
- **WHEN** é necessário voltar ao legado
- **THEN** as chaves são desligadas e as autorizações revogadas pela ação normal do admin
- **AND** `VENDEO_GENERATION_PAUSED` não é usado como controle

#### Scenario: Encerramento com fluxo ativo
- **WHEN** a abertura geral é aprovada e não há critério de parada nem decisão explícita de desligar
- **THEN** a fase encerra com `all_stores` ativo e monitorado
- **AND** o desligamento permanece disponível, mas não é executado automaticamente

#### Scenario: Consolidação final
- **WHEN** a change é encerrada
- **THEN** runbook, evidências e trackings refletem o estado real
- **AND** a fase 56.2.6 e seus artefatos permanecem preservados
