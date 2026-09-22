# Demo Status UI

> Capability nova (ADDED) pela `fase-50-demonstracao-gratuita-e-validade-dos-creditos`. Define os estados da demonstração na UI, a exibição de prazo (data/hora local + texto relativo) e o CTA de suporte honesto (sem SLA, sem linguagem de compra).

## ADDED Requirements

### Requirement: Estados da demonstração

O sistema SHALL derivar o status da demonstração por `origin_demo_grant_tx_id` e `demo_expires_at`/`demo_balance`, com estados **mutuamente exclusivos**:

- `none` — `origin_demo_grant_tx_id IS NULL` (nunca houve demonstração);
- `expired` — `origin_demo_grant_tx_id IS NOT NULL` e (`demo_expires_at <= now()` **ou** `demo_expires_at IS NULL` após materialização);
- `exhausted` — `demo_expires_at > now()` e `demo_balance = 0`;
- `expiring_soon` — `0 < demo_expires_at - now() <= 24h` e `demo_balance > 0`;
- `active` — `demo_expires_at - now() > 24h` e `demo_balance > 0`.

O sistema SHALL distinguir ainda **saldo total insuficiente** (disponível < custo) de **existência de bônus/comprado após o encerramento da demo**.

#### Scenario: Status active (mais de 24h restantes)

- **WHEN** `demo_expires_at - now() > 24h` e `demo_balance > 0`
- **THEN** o status é `active`

#### Scenario: Status expiring_soon (até 24h restantes)

- **WHEN** `0 < demo_expires_at - now() <= 24h` e `demo_balance > 0`
- **THEN** o status é `expiring_soon`

#### Scenario: Status exhausted

- **WHEN** `demo_expires_at > now()` e `demo_balance = 0`
- **THEN** o status é `exhausted`

#### Scenario: Status expired

- **WHEN** `demo_expires_at <= now()`
- **THEN** o status é `expired`

#### Scenario: Status expired após materialização

- **WHEN** a expiração foi materializada (`demo_expires_at IS NULL`, mas `origin_demo_grant_tx_id IS NOT NULL`)
- **THEN** o status é `expired` (não `none`)

#### Scenario: Status none

- **WHEN** `origin_demo_grant_tx_id IS NULL`
- **THEN** o status é `none`

#### Scenario: Bônus/comprado após encerramento é distinguível

- **WHEN** a demo expirou mas `bonus_balance + purchased_balance > 0`
- **THEN** a UI indica que há saldo utilizável além da demonstração

### Requirement: Exibição de prazo local e relativa

O sistema SHALL exibir a expiração em **data/hora local do usuário** (`Intl.DateTimeFormat` com timezone do client) e um **texto relativo** ("expira em X dias/horas"). O cálculo SHALL usar `demo_expires_at` (TIMESTAMPTZ absoluto) como fonte.

#### Scenario: Data/hora local

- **WHEN** a demo está ativa
- **THEN** a UI exibe a data/hora de expiração no fuso local do usuário

#### Scenario: Texto relativo

- **WHEN** faltam menos de 24h
- **THEN** a UI exibe "expira em X horas" (ou "expira em X dias" quando aplicável)

### Requirement: Sem linguagem de compra e sem SLA de 24h

O sistema SHALL NOT exibir "Comprar créditos"/"Adquirir créditos" nem prometer resposta em "24 horas". O CTA sem saldo SHALL orientar a "solicitar créditos" ao suporte existente (`mailto:SUPPORT_EMAIL`).

#### Scenario: Nenhuma promessa de compra

- **WHEN** qualquer superfície de crédito é renderizada
- **THEN** nenhuma linguagem de compra/aquisição de créditos é exibida

#### Scenario: Sem SLA de 24h

- **WHEN** o CTA de solicitação de créditos é renderizado
- **THEN** o texto NÃO promete resposta em 24 horas
- **AND** orienta o contato com o suporte sem prazo prometido
