# Demo Status UI

## Purpose

Exibir de forma clara o estado e a validade da demonstração e orientar suporte sem linguagem de compra ou SLA indevido.

## Requirements

### Requirement: Estados da demonstração

O sistema SHALL derivar estados mutuamente exclusivos: `none` quando origem é NULL; `expired` quando houve origem e prazo é vencido ou NULL após materialização; `exhausted` quando prazo futuro e demo zero; `expiring_soon` quando restam até 24h e há saldo; `active` quando restam mais de 24h e há saldo. Também SHALL distinguir saldo total insuficiente de bônus/comprado pós-demo.

#### Scenario: Estados ativos e encerrados

- **WHEN** há mais de 24h e saldo demo positivo
- **THEN** status é `active`
- **WHEN** há até 24h e saldo positivo
- **THEN** status é `expiring_soon`
- **WHEN** prazo venceu ou foi materializado
- **THEN** status é `expired`

#### Scenario: Expirado após materialização não vira none

- **WHEN** `demo_expires_at IS NULL` após materialização e há origem
- **THEN** status é `expired`

#### Scenario: Sem demonstração

- **WHEN** `origin_demo_grant_tx_id IS NULL`
- **THEN** status é `none`

#### Scenario: Bônus pós-demo é distinguível

- **WHEN** demo expirou mas bônus ou comprado é positivo
- **THEN** UI indica saldo utilizável além da demonstração

#### Scenario: Demo esgotada

- **WHEN** prazo ainda é futuro e `demo_balance=0`
- **THEN** status é `exhausted`

### Requirement: Exibição local e relativa

O sistema SHALL exibir `demo_expires_at` em data/hora local do usuário e texto relativo usando `Intl.DateTimeFormat` e timezone do client.

#### Scenario: Data/hora local

- **WHEN** demo está ativa
- **THEN** a expiração é exibida no fuso local

#### Scenario: Texto relativo

- **WHEN** faltam menos de 24h
- **THEN** exibe texto como "expira em X horas"

### Requirement: Sem compra e sem SLA

Nenhuma superfície SHALL exibir comprar/adquirir créditos ou prometer resposta em 24 horas; CTA sem saldo orienta solicitar créditos ao suporte.

#### Scenario: Nenhuma promessa de compra

- **WHEN** qualquer superfície de crédito é renderizada
- **THEN** não exibe linguagem de compra

#### Scenario: Sem SLA

- **WHEN** CTA é renderizado
- **THEN** não promete resposta em 24 horas e orienta contato sem prazo
