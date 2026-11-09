# Product 9:16 Two-Stage Viability Proof

> Synced from `product-9-16-two-stage-operation-control` (ADDED).

## Purpose

Define a prova mínima de viabilidade em homolog, com cenários obrigatórios, isolamento e separação entre local, homolog e produção.

## Requirements

### Requirement: Checkpoint inicial de viabilidade antes do módulo completo

A primeira tarefa da execução SHALL ser uma prova mínima do contrato em banco isolado, sem IA, antes da implementação completa do módulo de controle. A prova SHALL usar etapas simuladas e evidências de artefato controladas, sem criar armazenamento ou expansor completos.

#### Scenario: Prova precede o módulo completo

- **WHEN** a execução da mudança começa
- **THEN** a primeira entrega SHALL ser a prova de banco
- **AND** a implementação completa SHALL NOT começar antes do resultado da prova

#### Scenario: Prova reprovada interrompe a execução

- **WHEN** a prova reprova o desenho
- **THEN** a execução SHALL parar
- **AND** o desenho SHALL voltar para revisão antes de novas tarefas

### Requirement: Cenários obrigatórios da prova

A prova SHALL cobrir, no mínimo:

1. reserva → base simulada concluída → expansão simulada concluída → entrega, com exatamente 1 crédito consumido;
2. falha definitiva da expansão, com exatamente 1 estorno;
3. requisições concorrentes, com somente uma execução autorizada;
4. repetição da mesma requisição, sem nova cobrança ou execução duplicada;
5. duas requisições simultâneas com o mesmo `request_id`, com exatamente uma autorização de execução e a outra apenas de consulta;
6. interrupção após a base, com continuidade sem repetir a geração;
7. limite de expansão preservado entre retomadas;
8. resultado desconhecido, incluindo timeout/abort/perda de comunicação após possível envio, sem repetição ou estorno cego e com caminho seguro de resolução;
9. resposta tardia após encerramento, sem entrega ou cobrança adicional;
10. encerramento financeiro concorrente com etapa ativa, devidamente protegido;
11. encerramento/estorno administrativo seguido de resposta tardia e nova tentativa, ambos recusados pela autoridade financeira;
12. origem canônica, sem desfecho duplicado ou conflitante na leitura compartilhada;
13. fluxos atuais 1:1 e 9:16 direto preservados.

#### Scenario: Todos os cenários são executados

- **WHEN** a prova é reportada
- **THEN** os treze cenários SHALL ter resultado individual registrado
- **AND** qualquer cenário não executado SHALL ser declarado como lacuna

#### Scenario: Contagem de crédito é comprovada

- **WHEN** a prova mede consumo de crédito
- **THEN** o resultado SHALL ser comprovado pelo estado persistido e pelo ledger
- **AND** SHALL NOT ser inferido apenas pela resposta da aplicação

#### Scenario: Aquisição e reenvio são distinguidos

- **WHEN** a prova executa duas requisições simultâneas com o mesmo `request_id`
- **THEN** SHALL registrar exatamente uma autorização de execução
- **AND** SHALL registrar a outra como consulta apenas
- **AND** a execução simulada SHALL ocorrer uma única vez

#### Scenario: Encerramento administrativo bloqueia efeitos posteriores

- **WHEN** a prova simula encerramento/estorno administrativo e, depois, resposta tardia e nova tentativa
- **THEN** ambos SHALL ser recusados
- **AND** SHALL NOT haver entrega, cobrança ou estorno adicional

#### Scenario: Origem canônica não duplica desfechos

- **WHEN** a prova consulta a leitura compartilhada de uma operação do novo fluxo
- **THEN** SHALL haver um único desfecho canônico
- **AND** a operação SHALL NOT ser lida também como legada

### Requirement: Simulação controlada sem IA

A prova SHALL substituir geração base e expansão por trabalhos simulados determinísticos. A prova SHALL NOT chamar provider de IA, SHALL NOT gerar imagem real e SHALL NOT depender de interface.

#### Scenario: Nenhuma chamada paga

- **WHEN** a prova é executada
- **THEN** nenhuma chamada a provider de IA SHALL ocorrer
- **AND** nenhum custo externo SHALL ser gerado

#### Scenario: Evidência de artefato é controlada

- **WHEN** a prova precisa representar arte pronta
- **THEN** SHALL usar evidência de artefato controlada e identificável
- **AND** SHALL NOT criar um pipeline completo de armazenamento

### Requirement: Evidências verificáveis

A prova SHALL produzir evidências verificáveis, incluindo estados persistidos, contagens de ledger, resultados de concorrência, identificadores de operação e resultados por cenário. As evidências SHALL distinguir o que foi observado do que foi inferido.

#### Scenario: Evidência de concorrência

- **WHEN** o cenário de concorrência é executado
- **THEN** SHALL haver registro de quantas execuções foram autorizadas e recusadas
- **AND** o estado final SHALL comprovar uma única execução efetiva

#### Scenario: Evidência de crédito

- **WHEN** o cenário de entrega e o de estorno são executados
- **THEN** SHALL haver evidência de exatamente 1 confirmação ou 1 estorno, conforme o caso

### Requirement: Ambiente isolado e identificado

A prova SHALL ser executada em ambiente com identificação inequívoca de destino, loja, usuário e campanhas exclusivos de teste. O ambiente SHALL possuir isolamento de dados, migrations listadas, limpeza limitada aos dados de teste e autorizações prévias registradas.

Homolog existente SHALL poder ser usado como destino, desde que tratado como não descartável. Uma instância local isolada SHALL poder ser usada como alternativa, mediante autorização própria.

#### Scenario: Destino é identificado antes da escrita

- **WHEN** a prova é autorizada
- **THEN** o destino SHALL ser registrado por host, porta, banco e fingerprint do ledger
- **AND** SHALL haver snapshot somente leitura antes de qualquer escrita

#### Scenario: Dados de teste são exclusivos

- **WHEN** a prova cria dados
- **THEN** loja, usuário e campanhas SHALL ser identificáveis por prefixo e manifesto
- **AND** SHALL NOT reutilizar dados de produção ou de outros testes

#### Scenario: Limpeza limitada

- **WHEN** a prova termina
- **THEN** a limpeza SHALL alcançar somente os IDs de teste criados
- **AND** registros financeiros append-only, desfechos imutáveis e auditoria SHALL NOT ser apagados
- **AND** registros de teste que precisam permanecer SHALL ser documentados como retidos, sem exigir apagamento impossível

#### Scenario: Isolamento de rotinas compartilhadas

- **WHEN** a prova altera rotinas usadas por outros fluxos
- **THEN** SHALL haver janela de exclusividade registrada
- **AND** SHALL ser confirmado que nenhuma outra execução concorrente usa essas rotinas
- **AND** IDs exclusivos de dados SHALL NOT ser tratados como isolamento suficiente

### Requirement: Separação entre validação local, homolog e produção

O resultado da prova SHALL ser classificado por estágio. Validação local SHALL NOT ser apresentada como prova de produção. A prova em homolog SHALL NOT ser apresentada como aceitação produtiva.

#### Scenario: Relatório distingue estágios

- **WHEN** a prova é reportada
- **THEN** o relatório SHALL separar validação local, homolog e produção
- **AND** SHALL declarar explicitamente que o resultado não é aceitação produtiva

#### Scenario: Produção não é acionada

- **WHEN** a prova é concluída
- **THEN** nenhuma etapa de produção SHALL ser executada
- **AND** nenhuma flag ou ativação SHALL ser alterada
