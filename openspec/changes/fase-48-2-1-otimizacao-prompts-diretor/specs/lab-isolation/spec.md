# Lab Isolation

> Delta da capability `lab-isolation` pela `fase-48-2-1-otimizacao-prompts-diretor`. Exige programa com orçamento autorizado antes da chamada paga, controle atômico do orçamento em USD e fronteira local (migration não aplicada no remoto).

## MODIFIED Requirements

### Requirement: Segurança financeira

Toda chamada paga SHALL exigir ação humana explícita, um programa com orçamento autorizado e SHALL ter estimativa ou aviso de custo exibido antes da execução quando possível. O sistema SHALL controlar o orçamento em USD do programa de forma **atômica**, limitar cenários, repetições e concorrência, impedir loops automáticos ilimitados e SHALL NOT realizar chamadas reais em testes automatizados ou CI. A reserva SHALL ocorrer somente quando o programa estiver explicitamente com `status='authorized'`; um programa `closed`, cuja autorização está revogada, SHALL recusar qualquer nova reserva antes de qualquer chamada paga. `closed` é terminal e não retorna a `authorized`; uma nova sessão operacional exige um novo programa. O encerramento preserva os valores financeiros como histórico auditável e a efetividade vem do bloqueio server-side/RPC.

#### Scenario: Execução sem confirmação é recusada

- **WHEN** uma requisição de run não inclui confirmação explícita
- **THEN** a execução é recusada antes de qualquer chamada paga

#### Scenario: Execução sem programa autorizado é recusada

- **WHEN** o experimento não está vinculado a um programa com orçamento autorizado
- **THEN** a execução é recusada com `program_not_authorized`
- **AND** nenhuma chamada paga é iniciada

#### Scenario: Programa `closed` recusa a reserva

- **WHEN** o programa vinculado está `closed` (autorização revogada)
- **THEN** qualquer nova reserva é recusada antes de qualquer chamada paga
- **AND** nenhuma chamada paga é iniciada

#### Scenario: Encerramento é terminal e efetivo

- **WHEN** o programa é encerrado (`status='closed'`)
- **THEN** novas reservas são impedidas de forma imediata e efetiva
- **AND** o programa não retorna a `authorized`

#### Scenario: Reautorização de programa `closed` é recusada

- **WHEN** se tenta reautorizar um programa `closed`
- **THEN** a operação é recusada
- **AND** uma nova sessão exige criar e autorizar um novo programa

#### Scenario: Dados financeiros históricos permanecem consultáveis

- **WHEN** um programa é encerrado
- **THEN** `budget_usd`, `budget_reserved_usd`, `budget_consumed_usd`, autor e timestamp permanecem consultáveis
- **AND** nenhum valor histórico é apagado ou zerado

#### Scenario: Orçamento é debitado atomicamente

- **WHEN** um run é reservado com orçamento disponível
- **THEN** o consumo é debitado de forma atômica contra o orçamento autorizado
- **AND** execuções concorrentes não estouram o teto

#### Scenario: Reserva atômica precede a chamada paga

- **WHEN** duas requisições de execução chegam simultaneamente para o mesmo experimento
- **THEN** exatamente uma reserva o run de forma transacional
- **AND** a outra é recusada sem nenhuma chamada paga

#### Scenario: Teto de execuções é respeitado

- **WHEN** o número de runs atinge o teto do experimento
- **THEN** novas execuções são recusadas com `budget_exceeded`
- **AND** nenhuma chamada paga é iniciada

#### Scenario: Concorrência limitada

- **WHEN** já existe um run em andamento em qualquer experimento do laboratório
- **THEN** uma nova execução concorrente é recusada (limite global de um run ativo)

#### Scenario: Testes não fazem chamadas pagas

- **WHEN** a suíte de testes é executada
- **THEN** os testes usam fakes de invocação e de telemetria
- **AND** nenhuma requisição de rede a providers é realizada

## ADDED Requirements

### Requirement: Fronteira local e migration não remota

A F48.2.1 SHALL permanecer integralmente local/desenvolvimento. A migration SHALL ser criada e testada localmente e SHALL NOT ser aplicada no remoto nesta fase; o `db push` remoto e a promoção SHALL ser transferidos para a mudança posterior **F48.2.3 — Promoção, Canário e Prontidão da Aprovação**.

#### Scenario: Migration não é aplicada no remoto

- **WHEN** a F48.2.1 é executada
- **THEN** a migration é aplicada apenas no ambiente local
- **AND** nenhum `db push` remoto é executado

#### Scenario: Promoção é diferida

- **WHEN** a F48.2.1 é encerrada
- **THEN** a promoção e o `db push` remoto ficam para a F48.2.3
- **AND** nenhum prompt produtivo é alterado nesta fase

### Requirement: Ausência de estruturas do Revisor

A F48.2.1 SHALL NOT introduzir estruturas nem execução do Revisor (modo `reviewer`, casos de revisão, `campaign_image_review`). Tudo isso pertence à F48.2.2.

#### Scenario: Nenhuma estrutura do Revisor é criada

- **WHEN** a F48.2.1 é implementada
- **THEN** nenhuma tabela, endpoint ou UI específica do Revisor é criada
- **AND** o escopo permanece restrito ao Diretor
