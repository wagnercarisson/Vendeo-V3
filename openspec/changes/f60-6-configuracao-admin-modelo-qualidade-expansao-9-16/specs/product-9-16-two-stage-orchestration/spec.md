## MODIFIED Requirements

### Requirement: Preflight de configuração da expansão antes da primeira chamada paga

Antes da primeira chamada paga de uma geração nova, o sistema SHALL resolver a configuração administrativa da expansão em modo estrito e executar um preflight **read-only** do alvo de expansão e da cobertura das tarifas de usage (modelo ativo + qualidade elegível + tarifas aplicáveis), sem chamar provider, sem reservar crédito e sem criar tentativa. A seleção resolvida SHALL ser congelada na abertura da operação, na mesma transação da reserva, e SHALL ser a única usada pela base e pela expansão daquela operação. O preflight SHALL ocorrer antes da reserva quando a operação ainda não existe e antes de uma nova chamada paga da base numa continuação. Numa continuação, a seleção efetiva SHALL vir da operação congelada, não da configuração administrativa vigente; operações `contract_version = 1` SHALL usar explicitamente o comportamento original Sunburst `low` como `legacy_sunburst_low`, e operações `contract_version = 2` sem seleção completa SHALL falhar fechado, sem cair no legado.

O preflight SHALL distinguir configuração **comprovadamente** ausente/incompleta de erro ou indeterminação de leitura: a primeira SHALL impedir o gasto e encerrar conforme o estágio; a segunda SHALL bloquear novas chamadas pagas sem inventar ausência, sem adquirir etapa, sem registrar desfecho `failed` e sem estorno automático, mantendo a operação reservada recuperável para nova leitura. A leitura estrita do preflight SHALL NOT alterar o comportamento fail-open dos leitores compartilhados usados pelo caminho legado. Numa geração nova, configuração ausente/incompleta ou leitura indeterminada SHALL impedir a reserva; numa continuação com base pendente, configuração comprovadamente incompleta SHALL encerrar com estorno único e leitura indeterminada SHALL NOT estornar. Antes de adquirir uma nova tentativa de expansão, o sistema SHALL repetir o preflight read-only da seleção congelada; configuração comprovadamente inválida SHALL falhar sem `acquire`, e leitura indeterminada SHALL permanecer recuperável sem `acquire`, `recordOutcome` ou estorno. A estimativa pré-chamada (`image_unit_usd`) SHALL NOT ser exigida para autorizar a geração; quando ausente, SHALL permanecer indisponível (`null`) e não SHALL virar zero nem custo efetivo. Replay, consulta somente leitura, retomada de etapa já concluída e entrega de vertical já comprovado SHALL NOT depender da configuração administrativa atual nem do pricing atual, e SHALL NOT executar o preflight. A causa segura da falha (configuração ausente/inválida, modelo ou pricing indisponível, falha do provider ou indeterminação de leitura) SHALL permanecer no diagnóstico e na referência de suporte da ocorrência, sem payload sensível nem evento de chamada fictício.

#### Scenario: Seleção é validada e congelada antes da reserva

- **WHEN** uma geração nova 9:16 teria início e a configuração administrativa, o catálogo e o pricing da seleção são válidos
- **THEN** o sistema SHALL congelar modelo, qualidade, versão e origem na abertura da operação
- **AND** a reserva de 1 crédito SHALL ocorrer na mesma transação
- **AND** a base e a expansão SHALL usar a seleção congelada

#### Scenario: Configuração incompleta bloqueia antes da reserva

- **WHEN** uma geração nova 9:16 teria início e a configuração da expansão está ausente/inválida ou o preflight de modelo/pricing falha de forma comprovada
- **THEN** o sistema SHALL NOT reservar crédito, criar tentativa ou chamar provider de base/copy/expansão
- **AND** o terminal SHALL indicar configuração indisponível com motivo seguro

#### Scenario: Continuação usa a seleção congelada, não a configuração atual

- **WHEN** a operação já reservada continua após uma mudança administrativa da expansão
- **THEN** o sistema SHALL usar a seleção congelada na abertura
- **AND** SHALL NOT trocar modelo ou qualidade pela configuração vigente

#### Scenario: Operação legada mantém o comportamento original explícito

- **WHEN** a operação é `contract_version = 1` e não possui seleção congelada
- **THEN** o sistema SHALL usar Sunburst `low` como `legacy_sunburst_low`
- **AND** SHALL NOT gravar seleção retroativa nem tratar a ausência como falha de configuração nova

#### Scenario: Operação nova sem seleção falha fechado

- **WHEN** a operação é `contract_version = 2` e a seleção congelada está ausente, incompleta ou inválida
- **THEN** o sistema SHALL encerrar como configuração indisponível
- **AND** SHALL NOT adquirir etapa, chamar provider ou reutilizar o comportamento legado

#### Scenario: Continuação com base pendente não abandona a reserva

- **WHEN** a operação já reservada ainda precisa executar a base e o preflight da expansão falha de forma comprovada
- **THEN** o sistema SHALL NOT adquirir a etapa nem chamar provider
- **AND** SHALL encerrar com estorno único e projeção de encerramento, sem deixar reserva abandonada

#### Scenario: Leitura indeterminada bloqueia sem terminal failed e sem estorno

- **WHEN** o preflight não consegue confirmar configuração/catálogo/pricing por erro ou indeterminação de leitura numa continuação reservada
- **THEN** o sistema SHALL NOT adquirir etapa nem chamar provider
- **AND** SHALL NOT registrar desfecho terminal `failed` nem estornar a operação por esse motivo
- **AND** a operação reservada SHALL permanecer recuperável para uma leitura seguinte

#### Scenario: Preflight da expansão não consome tentativa

- **WHEN** a etapa de expansão ainda não foi adquirida e o preflight da seleção congelada detecta configuração inválida ou leitura indeterminada
- **THEN** o sistema SHALL NOT criar tentativa, `recordOutcome` ou estorno
- **AND** SHALL reportar a causa segura conforme o estágio

#### Scenario: Leitores legados preservam o comportamento fail-open

- **WHEN** o preflight usa a leitura estrita sem alterar os leitores compartilhados do caminho legado
- **THEN** os consumidores legados SHALL manter o comportamento anterior
- **AND** a distinção de leitura SHALL existir apenas no resultado estrito do preflight

#### Scenario: Replay, consulta e entrega não dependem da configuração atual

- **WHEN** a operação existente é consultada, retomada em etapa concluída ou já possui vertical íntegro para entrega
- **THEN** o sistema SHALL NOT ler a configuração administrativa da expansão nem executar o preflight
- **AND** SHALL preservar consulta, acesso e entrega já comprovada

#### Scenario: Diagnóstico distingue configuração de provider

- **WHEN** a falha impede a chamada por configuração ausente/inválida, modelo/pricing indisponível ou falha no provider
- **THEN** o diagnóstico interno SHALL registrar classificações distintas e fechadas para cada causa
- **AND** SHALL correlacionar a ocorrência à operação e à referência de suporte
- **AND** SHALL NOT registrar segredo, payload bruto ou evento de chamada fictício
