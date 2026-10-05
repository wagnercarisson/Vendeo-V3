# AI Model Pricing

## ADDED Requirements

### Requirement: Dimensão de qualidade no pricing de imagem (aditiva)

A tabela `ai_model_pricing` SHALL ganhar uma dimensão de **qualidade** de forma **aditiva**: uma coluna `quality` nullable (`low`/`medium` entre os valores elegíveis) e uma unicidade de vigência que preserve o comportamento atual. Linhas com `quality IS NULL` SHALL continuar regidas pela unicidade vigente `(provider, model) WHERE effective_until IS NULL`; linhas com `quality` preenchida SHALL ter unicidade vigente por `(provider, model, quality) WHERE effective_until IS NULL`.

O RPC `admin_set_ai_model_price` SHALL aceitar a qualidade como parâmetro **opcional** ao final da assinatura, mantendo válidas as chamadas existentes sem qualidade. A resolução de custo do fluxo legado SHALL permanecer inalterada quando a qualidade for nula.

#### Scenario: Linhas legadas permanecem válidas

- **WHEN** a coluna `quality` é adicionada
- **THEN** as linhas existentes ficam com `quality = NULL`
- **AND** a unicidade vigente anterior continua valendo para essas linhas

#### Scenario: Pricing por qualidade coexiste com o legado

- **WHEN** existem uma linha vigente sem qualidade e uma linha vigente com qualidade para o mesmo `(provider, model)`
- **THEN** ambas coexistem sem violar unicidade
- **AND** a resolução de custo escolhe a dimensão apropriada conforme o contexto

#### Scenario: RPC aceita qualidade opcional

- **WHEN** `admin_set_ai_model_price` é chamado com qualidade
- **THEN** a nova vigência é versionada para `(provider, model, quality)`
- **AND** chamadas sem qualidade continuam funcionando como antes

### Requirement: Cobertura de pricing ciente de qualidade para os pares elegíveis

Para os pares elegíveis do novo fluxo, o sistema SHALL verificar a cobertura de pricing considerando `modelo + qualidade` e SHALL expor cobertura `complete`, `partial` ou `missing` com os componentes ausentes. A ausência de pricing SHALL NOT ser mascarada por um valor inventado e SHALL NOT ser tratada como cobertura completa.

A cobertura incompleta (`partial`/`missing`) SHALL ser **fail-closed para o novo fluxo**: o par não é executável e a operação falha de forma identificável, sem inventar custo. O **fluxo legado** permanece com a cadeia de `resolveAiCost` inalterada até `fallback_static`/`not_available`.

#### Scenario: Par elegível com pricing é completo

- **WHEN** existe pricing vigente para o modelo na qualidade configurada
- **THEN** a cobertura do par é reportada como `complete`
- **AND** o par é executável pelo novo fluxo

#### Scenario: Par elegível sem pricing é fail-closed no novo fluxo

- **WHEN** existe o modelo, mas não existe pricing para a qualidade configurada
- **THEN** a cobertura é reportada como `partial` ou `missing`
- **AND** os componentes ausentes são explicitados
- **AND** o novo fluxo não executa o par e falha de forma identificável

#### Scenario: Legado preserva a cadeia de fallback de custo

- **WHEN** uma chamada do fluxo legado não tem pricing tabelado
- **THEN** a resolução segue a cadeia existente até `fallback_static`/`not_available`
- **AND** a regra fail-closed do novo fluxo não altera esse comportamento
