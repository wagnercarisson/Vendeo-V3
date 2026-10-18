# Product 1:1 Hosted Pilot

## ADDED Requirements

### Requirement: Publicação com fluxo OFF e backup verificável

A publicação do fluxo Produto 1:1 SHALL ocorrer com o **fluxo desligado** e SHALL exigir, **antes** das migrations remotas, um **backup verificável de banco e Storage**. O **plano Free informado não oferece backup restaurável gerenciado**; a existência de WAL-G (`walg_enabled=true`) e uma lista vazia de backups SHALL NOT ser tratadas como prova de restaurabilidade. Com PITR desabilitado, o sistema SHALL NOT contar com recuperação point-in-time.

#### Scenario: Backup de banco e Storage verificado antes das migrations
- **WHEN** a publicação do fluxo é preparada
- **THEN** existe backup atualizado do banco com os componentes necessários à recuperação e cópia dos objetos de Storage
- **AND** a restauração é comprovada em destino local separado, com contagens/checksums
- **AND** as migrations remotas só ocorrem após essa verificação

#### Scenario: Restauração não sobrescreve a homologação
- **WHEN** a restauração é comprovada
- **THEN** o destino é local e separado
- **AND** a homologação permanente não é sobrescrita

#### Scenario: WAL-G não é aceito como backup restaurável
- **WHEN** apenas `walg_enabled=true` está disponível
- **THEN** a verificação de backup permanece não satisfeita
- **AND** a publicação não prossegue para migrations

#### Scenario: Sem PITR
- **WHEN** `pitr_enabled=false`
- **THEN** nenhum procedimento presume recuperação point-in-time
- **AND** a recuperação depende de backup restaurável verificado

### Requirement: Conjunto exato de migrations e tratamento das migrations de laboratório

A publicação SHALL aplicar o **conjunto definitivo** de migrations pendentes em produção, na **ordem de arquivo**, pelo caminho CLI sancionado (`supabase db push`), mantendo o ledger fiel. O conjunto inicial tem 30 pendentes, mas esta mudança **adiciona novas migrations**; o **conjunto definitivo e seus SHA-256** SHALL ser fixados **após a implementação**, e o ledger final **não** é presumido como 129. As **migrations de laboratório** local-first já presentes em `main` SHALL ter tratamento explícito e **não** SHALL ser "puladas" por `migration repair` (que gravaria ledger falso).

#### Scenario: Conjunto definitivo e ordenado
- **WHEN** as migrations são aplicadas
- **THEN** o conjunto definitivo inclui as novas migrations aprovadas desta mudança
- **AND** todas são aplicadas na ordem de arquivo
- **AND** o ledger reflete o conjunto completo, sem contagem presumida

#### Scenario: Migrations de laboratório tratadas explicitamente
- **WHEN** as migrations de laboratório local-first são consideradas
- **THEN** há decisão registrada entre **aplicar no lote** (recomendado) ou **remover do diretório de migrations**
- **AND** `migration repair --status applied` **não** é usado para simular aplicação

#### Scenario: Rollback não reverte banco
- **WHEN** um deploy é revertido
- **THEN** o estado de banco, as migrations aplicadas e o ledger permanecem
- **AND** nenhuma reversão automática é executada

### Requirement: Orçamento de tempo compatível com o teto da plataforma

O timeout interno de geração SHALL ser **estritamente menor** que o teto da função da plataforma (**300s**) e SHALL compor um **deadline global comprovado**, com **margem para persistência cooperativa**. O sistema SHALL NOT prometer que a última escrita ocorre após um kill: um encerramento abrupto **pode** impedir a última escrita. Nesse caso, o **estado durável anterior** SHALL permanecer recuperável, sem inventar `unknown` persistido nem ausência de arte.

#### Scenario: Deadline comprovado com margem
- **WHEN** a geração se aproxima do teto da plataforma
- **THEN** o deadline global foi provado por teste e o timeout interno é menor que 300s
- **AND** há margem para persistência cooperativa

#### Scenario: Kill pode impedir a última escrita
- **WHEN** a plataforma encerra a função de forma abrupta
- **THEN** a última escrita pode não ocorrer
- **AND** o estado durável anterior permanece recuperável
- **AND** nenhum `unknown` ou ausência é inventado

#### Scenario: Resultado desconhecido é honesto
- **WHEN** a execução é interrompida sem confirmação
- **THEN** o estado é tratado como **desconhecido**, sem retomada automática
- **AND** nenhuma conclusão de sucesso ou de ausência é presumida

### Requirement: Kill da plataforma não prova ausência de upload

O encerramento da execução pela plataforma SHALL NOT ser interpretado como prova de que não houve upload e **não autoriza, por si só, nenhuma via de encerramento**. O sistema SHALL preservar **duas vias distintas**: (a) **automática**, que exige **probe de arte** (`integral`/`absent`/`invalid`/`indeterminate`) **fresco sob epoch** e as provas de fence; (b) **administrativa**, explicitamente **autorizada/auditada**, que mantém as **precondições próprias** já aprovadas. O frescor do epoch SHALL NOT ser universalizado para a via administrativa.

#### Scenario: Kill não implica ausência nem autoriza via
- **WHEN** a plataforma encerra a função no meio da execução
- **THEN** a ausência de arte **não** é presumida
- **AND** nenhuma via de encerramento é autorizada apenas pelo kill

#### Scenario: Via automática exige probe fresco
- **WHEN** se pretende encerrar automaticamente como ausência
- **THEN** existe probe de arte confirmando ausência fresca sob epoch
- **AND** o fence de publicação permite o encerramento

#### Scenario: Via administrativa mantém precondições próprias
- **WHEN** se pretende encerrar pela via administrativa
- **THEN** há autorização e auditoria explícitas
- **AND** as precondições próprias da via são atendidas, sem exigir frescor universal

### Requirement: Provas hospedadas mínimas, sem simulação pública

As provas hospedadas SHALL ser o **menor conjunto** necessário, **reutilizando** as provas locais existentes, com **provider simulado** onde possível. O sistema SHALL NOT expor **rota pública de simulação** nem permitir que **clientes escolham provider simulado**.

#### Scenario: Reuso das provas locais
- **WHEN** uma comprovação já existe no escopo local
- **THEN** ela é reutilizada como evidência de contrato
- **AND** não é repetida sem necessidade no hospedado

#### Scenario: Sem rota pública de simulação
- **WHEN** as provas com provider simulado são executadas
- **THEN** elas ocorrem em harness/Preview interno
- **AND** nenhuma rota pública expõe simulação de provider

#### Scenario: Cliente não escolhe provider
- **WHEN** um cliente usa o fluxo
- **THEN** o cliente **não** seleciona provider simulado
- **AND** a escolha de provider permanece server-side

### Requirement: Piloto manual restrito a lojas de teste

O piloto SHALL ser **manual**, **restrito a lojas de teste** (`is_test_store=true`), sob autorização vigente e flag ligada apenas na janela, com **orçamento**, **monitoramento**, **critérios de parada** e **desligamento**. O piloto SHALL NOT habilitar lojas não-test.

#### Scenario: Piloto restrito a lojas de teste
- **WHEN** o piloto é executado
- **THEN** apenas lojas de teste participam
- **AND** lojas não-test permanecem no legado

#### Scenario: Orçamento e parada
- **WHEN** o limite de chamadas/estimativas conservadoras é atingido, ou ocorre erro/timeout/estado inesperado
- **THEN** novas chamadas não ocorrem
- **AND** o estado é encerrado honestamente

#### Scenario: Desligamento
- **WHEN** o piloto é encerrado normalmente
- **THEN** a flag do novo fluxo é desligada e a autorização é revogada
- **AND** a geração global do legado **não** é pausada
- **AND** operações em andamento não são canceladas automaticamente (recuperação/estorno seguem)

#### Scenario: Pausa global apenas em emergência autorizada
- **WHEN** se avalia usar `VENDEO_GENERATION_PAUSED`
- **THEN** isso só ocorre como procedimento emergencial explicitamente autorizado
- **AND** não é usado como desligamento normal do piloto

### Requirement: Sequência de autorização do primeiro piloto

As **provas hospedadas simuladas** e o **aceite para iniciar** SHALL preceder a **primeira chamada paga**. O início do piloto SHALL NOT exigir que o piloto hospedado já esteja aprovado.

#### Scenario: Provas e aceite antes da primeira chamada paga
- **WHEN** o piloto hospedado é iniciado
- **THEN** as provas simuladas já foram executadas e aceitas
- **AND** a primeira chamada paga ocorre somente depois do aceite

#### Scenario: Piloto não precisa estar aprovado para começar
- **WHEN** o aceite para iniciar é concedido
- **THEN** o piloto pode começar sem aprovação prévia do próprio resultado
- **AND** a aprovação final é posterior ao piloto

### Requirement: Separação entre piloto hospedado e abertura a lojas gerais

O piloto hospedado SHALL ser tratado como **etapa** da liberação e SHALL NOT ser considerado conclusão da promoção. A abertura a **lojas gerais** (`all_stores`) SHALL permanecer **fora de escopo** desta mudança e SHALL exigir mudança futura e separada.

#### Scenario: all_stores permanece bloqueado
- **WHEN** o piloto hospedado está vigente
- **THEN** o escopo geral (`all_stores`) permanece recusado
- **AND** nenhuma loja geral é habilitada

#### Scenario: Abertura geral é mudança separada
- **WHEN** se avalia habilitar lojas gerais
- **THEN** isso exige uma mudança futura e separada
- **AND** não é autorizado por esta mudança
