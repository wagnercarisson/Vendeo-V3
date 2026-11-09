## ADDED Requirements

### Requirement: Encerramento e pendências reconhecem execuções do fluxo 9:16 em duas etapas

As rotinas de encerramento por falha, resolução administrativa, leitura de operação e listagem de pendências SHALL reconhecer tentativas ativas e desfechos persistidos da operação do fluxo 9:16 em duas etapas, independentemente de o registro estar na tabela legada de claims ou no registro próprio do novo fluxo. O reconhecimento SHALL ocorrer no banco, sob a mesma trava da linha de crédito, e SHALL NOT depender apenas de verificação em TypeScript.

#### Scenario: Etapa ativa do novo fluxo bloqueia encerramento automático

- **WHEN** existe tentativa ativa da operação de duas etapas
- **THEN** `product_1_1_close_failed_operation` SHALL recusar o encerramento
- **AND** SHALL NOT registrar estorno

#### Scenario: Resolução administrativa vê a execução nova

- **WHEN** um administrador resolve uma pendência do novo fluxo
- **THEN** a rotina SHALL reconhecer a tentativa ativa e o desfecho persistido
- **AND** SHALL recusar encerramento indevido enquanto a execução não estiver encerrada
- **AND** SHALL permitir apenas o caminho autorizado e auditado

#### Scenario: Lista de pendências exibe a operação nova

- **WHEN** a listagem administrativa é consultada
- **THEN** operações não terminais do novo fluxo SHALL aparecer com estado e indicador de execução ativa
- **AND** SHALL NOT haver uma segunda fila administrativa paralela

#### Scenario: Origem canônica não duplica a operação

- **WHEN** as rotinas compartilhadas consultam claims e desfechos
- **THEN** a operação do novo fluxo SHALL ser lida somente da fonte nova
- **AND** SHALL NOT produzir desfecho duplicado ou conflitante
- **AND** operações legadas SHALL ser lidas somente da fonte legada

#### Scenario: Histórico e etapa preservados na leitura administrativa

- **WHEN** uma operação do novo fluxo está entre etapas, sem claim ativo e sem desfecho
- **THEN** a listagem SHALL obter origem e etapa do registro canônico
- **AND** SHALL preservar a última tentativa a partir do histórico completo
- **AND** SHALL NOT usar a view de execução ativa como substituta do histórico

### Requirement: Comportamento legado permanece idêntico

O reconhecimento das execuções do novo fluxo SHALL NOT alterar o comportamento observável das operações 1:1 e 9:16 direto. Assinaturas de RPC, estados financeiros, significado de `delivered`, predicado de falha final e resolução administrativa existentes SHALL permanecer válidos para as operações legadas.

#### Scenario: Operação 1:1 preservada

- **WHEN** uma operação 1:1 executa os caminhos de entrega, falha, desconhecido e resolução
- **THEN** o resultado SHALL ser equivalente ao comportamento anterior à mudança
- **AND** SHALL NOT haver nova exigência, novo estado ou novo efeito financeiro

#### Scenario: 9:16 direto preservado

- **WHEN** uma operação 9:16 direta executa os mesmos caminhos
- **THEN** o resultado SHALL ser equivalente ao comportamento anterior à mudança
- **AND** a operação SHALL NOT ser tratada como duas etapas

#### Scenario: Nenhum claim legado é reclassificado

- **WHEN** as rotinas consultam as fontes de claims
- **THEN** claims legados SHALL manter status, identidade e semântica
- **AND** SHALL NOT ser migrados ou reinterpretados silenciosamente
