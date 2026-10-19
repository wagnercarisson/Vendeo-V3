## MODIFIED Requirements

### Requirement: D13 hospedado e kill real

O **kill real** da plataforma SHALL permanecer **limitação** não deterministicamente reproduzível. **D13 hospedado SHALL NOT ser declarado resolvido pelo caminho feliz**, por 5.3, por 5.7 ou pelo sucesso do N=1. Antes do piloto pago SHALL haver **disposição explícita** sobre a limitação; antes da abertura geral SHALL haver **nova disposição explícita**, aceitando a limitação residual com controles compensatórios ou bloqueando a abertura.

#### Scenario: D13 não resolvido pelo caminho feliz
- **WHEN** o piloto ou a janela conclui com sucesso
- **THEN** D13 hospedado não é declarado resolvido apenas por isso
- **AND** a limitação do kill real permanece registrada

#### Scenario: Disposição explícita antes do piloto
- **WHEN** o piloto pago é autorizado
- **THEN** existe disposição explícita sobre a limitação do kill real
- **AND** a decisão é registrada antes da primeira chamada paga

#### Scenario: Disposição explícita antes da abertura geral
- **WHEN** a abertura para todas as lojas é avaliada
- **THEN** existe disposição registrada aceitando a limitação residual com controles compensatórios ou bloqueando a abertura
- **AND** nenhuma disposição é inferida do caminho feliz

### Requirement: Separação entre piloto hospedado e abertura a lojas gerais

O piloto hospedado SHALL ser tratado como **etapa** da liberação e SHALL NOT ser considerado conclusão da promoção. A abertura a **lojas gerais** (`all_stores`) SHALL ocorrer somente por mudança separada e aprovada, após as provas 5.3 e 5.7, a validação de Luna nas três capacidades, uma campanha completa em loja de teste e o aceite humano. Esta change é essa mudança separada; ela SHALL NOT reabrir nem reescrever as evidências da fase 56.2.6.

#### Scenario: all_stores permanece bloqueado durante o piloto
- **WHEN** o piloto hospedado está vigente
- **THEN** o escopo geral (`all_stores`) não é ativado
- **AND** nenhuma loja geral é habilitada

#### Scenario: Abertura geral exige a mudança separada
- **WHEN** se avalia habilitar lojas gerais
- **THEN** isso exige as provas, a validação e o aceite desta mudança
- **AND** não é autorizado pelo piloto N=1 nem pelo caminho feliz

#### Scenario: Evidências do N=1 preservadas
- **WHEN** a abertura geral é preparada ou executada
- **THEN** os artefatos e evidências da fase 56.2.6 permanecem inalterados
- **AND** o adiamento original de 5.3/5.7 não é convertido em PASS
