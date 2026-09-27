# Lab Runs

> Delta da capability `lab-runs` pela `fase-48-2-1-otimizacao-prompts-diretor`. Registra o vínculo ao programa no snapshot e exige a autorização de orçamento do programa antes de qualquer chamada paga, mantendo exatamente uma chamada `campaign_image` por run.

## MODIFIED Requirements

### Requirement: Snapshot imutável por execução

Cada execução SHALL congelar e registrar: versão do cenário, conteúdo ou hash verificável do prompt, identificação do prompt, capability, provider, model ID, protocolo, parâmetros suportados utilizados, configuração baseline ou candidata, **o programa ao qual o experimento pertence**, versão relevante do código/build quando disponível, início e término, status, erro sanitizado, latência, usage, custo estimado, retries/tentativas e caminhos dos artefatos. Uma alteração posterior no prompt, modelo, cenário, programa ou pricing SHALL NOT mudar o significado histórico da execução.

#### Scenario: Snapshot registra a configuração congelada

- **WHEN** um run é criado
- **THEN** o snapshot contém cenário, prompt (conteúdo/hash), capability, provider, modelo, protocolo, parâmetros, a variante e o programa
- **AND** o snapshot é gravado na transação da reserva, nunca vazio
- **AND** a versão de código/build é registrada quando disponível

#### Scenario: Alteração posterior não reescreve o histórico

- **WHEN** o prompt oficial, o modelo, o cenário, o programa ou o pricing mudam após o run
- **THEN** o snapshot do run permanece idêntico
- **AND** o resultado histórico continua interpretável

#### Scenario: Campos de snapshot não são atualizáveis

- **WHEN** se tenta atualizar o snapshot de um run existente
- **THEN** a alteração é rejeitada
- **AND** apenas campos de resultado do próprio run podem ser preenchidos

#### Scenario: Origem do custo é congelada

- **WHEN** um run conclui
- **THEN** o custo é registrado com fonte, versão de pricing, versão da fórmula e componentes da fórmula
- **AND** uma sinalização de parcialidade indica quando a estimativa é parcial ou indisponível

### Requirement: Execução real e focada reutilizando o gateway

A execução SHALL produzir uma campanha comparável reutilizando o gateway, os adapters e a telemetria existentes, sem criar um segundo cliente direto de provider, sem duplicar adapters e sem alterar a seleção produtiva. O alvo de modelo SHALL ser o alvo fixo do experimento, e o laboratório SHALL executar **exatamente uma chamada `campaign_image` por run**, com **fallback automático desabilitado** (não usa o provider de imagem).

#### Scenario: Run usa o gateway existente

- **WHEN** um run é executado
- **THEN** a chamada de imagem passa pelo gateway e pelos adapters existentes
- **AND** nenhum cliente de provider é instanciado fora dos adapters

#### Scenario: Seleção produtiva não é alterada

- **WHEN** o laboratório executa o alvo fixo do experimento
- **THEN** `ai_model_selection` não é consultada nem alterada para esse alvo
- **AND** a seleção produtiva permanece inalterada

#### Scenario: Fallback automático desabilitado

- **WHEN** a chamada `campaign_image` falha por capability
- **THEN** nenhuma segunda chamada paga é feita no mesmo run
- **AND** o run registra a falha do alvo único

#### Scenario: Estado por variante é persistido separadamente

- **WHEN** baseline e candidata são executadas
- **THEN** cada run é persistido separadamente com a sua variante
- **AND** um run não sobrescreve o resultado do outro

## ADDED Requirements

### Requirement: Autorização de orçamento do programa antes da chamada paga

A execução SHALL validar, antes de qualquer chamada paga, que o experimento pertence a um programa com orçamento autorizado e SHALL debitar o orçamento de forma atômica. A reserva SHALL ocorrer somente quando o programa estiver explicitamente com `status='authorized'`; um programa `closed`, cuja autorização está revogada, SHALL recusar a reserva antes de qualquer chamada paga. `closed` é terminal; uma nova sessão operacional exige um novo programa. Sem autorização ou com teto atingido, nenhuma chamada paga SHALL ocorrer.

#### Scenario: Run sem programa autorizado é recusado

- **WHEN** o experimento não está vinculado a um programa ou o programa não tem orçamento autorizado
- **THEN** a execução é recusada com `program_not_authorized`
- **AND** nenhuma chamada paga é iniciada

#### Scenario: Programa `closed` recusa a reserva

- **WHEN** o programa vinculado está `closed` (autorização revogada)
- **THEN** a reserva é recusada antes de qualquer chamada paga
- **AND** nenhuma chamada paga é iniciada

#### Scenario: Orçamento é debitado antes da chamada

- **WHEN** um run é reservado com orçamento disponível
- **THEN** o orçamento é debitado de forma atômica antes da chamada paga
- **AND** execuções concorrentes não estouram o teto

#### Scenario: Teto atingido recusa a execução

- **WHEN** o orçamento autorizado do programa foi consumido
- **THEN** a execução é recusada com `budget_exceeded`
- **AND** nenhuma chamada paga é iniciada
