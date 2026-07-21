# Error States Específicos

> Synced from `fase-29-refinamento-visual-uat-launch-readiness` (ADDED).

## Purpose

Tratamento visual e textual específico para 4 tipos de erro no fluxo de geração: falha de geração, saldo insuficiente, rate limit e geração pausada — com mensagens orientadas a ação e caminhos de recuperação claros.

## Requirements

### Requirement: Falha de geração com explicação e recuperação

O sistema SHALL exibir mensagem específica quando uma geração falha, explicando a causa e oferecendo recuperação (incluindo estorno automático de crédito).

#### Scenario: Falha de geração exibe causa e orientação

- **WHEN** a geração de campanha falha
- **THEN** o sistema exibe mensagem explicando a causa (ex: "Não foi possível gerar a imagem da campanha. Seus créditos foram estornados automaticamente.")
- **AND** exibe botão "Tentar novamente" ou "Criar nova campanha"

#### Scenario: Estorno automático é transparente para o usuário

- **WHEN** o estorno automático de crédito ocorre após falha
- **THEN** o sistema informa o usuário que o crédito foi devolvido, sem jargão técnico

### Requirement: Saldo insuficiente como erro de negócio, não de sistema

O sistema SHALL tratar saldo insuficiente como estado de negócio, não como erro de sistema, com CTA para solicitar créditos.

#### Scenario: Geração sem saldo exibe "Créditos insuficientes"

- **WHEN** um usuário tenta gerar campanha sem créditos suficientes
- **THEN** o sistema exibe "Créditos insuficientes" com CTA "Solicitar créditos"
- **AND** não exibe mensagem de erro técnico ou código HTTP

### Requirement: Rate limit com informação de quando volta

O sistema SHALL exibir mensagem de rate limit informando quando o limite será restaurado, em linguagem comercial.

#### Scenario: Rate limit exibe "Você atingiu o limite" + horário

- **WHEN** um usuário excede o rate limit de gerações
- **THEN** o sistema exibe "Você atingiu o limite de gerações. Tente novamente às [horário]." (horário de restauração em formato legível)

### Requirement: Geração pausada com banner informativo

O sistema SHALL exibir banner informativo quando a geração está pausada globalmente (VENDEO_GENERATION_PAUSED), com CTA de contato e `role="alert"`.

#### Scenario: Geração pausada exibe banner com CTA

- **WHEN** a geração está pausada via feature flag
- **THEN** o sistema exibe banner "Geração temporariamente indisponível" com CTA "Entre em contato"
- **AND** não exibe stack trace ou detalhes internos de configuração
- **AND** o banner tem `role="alert"`

### Requirement: Modal de créditos acessível

O modal de créditos/confirmação SHALL seguir boas práticas de acessibilidade: `role="dialog"`, `aria-modal`, `aria-labelledby`, foco inicial gerenciado, fechamento via Escape, e retorno de foco ao elemento que o abriu.

#### Scenario: Modal tem atributos de acessibilidade

- **WHEN** o modal de créditos é aberto
- **THEN** o container tem `role="dialog"`, `aria-modal="true"` e `aria-labelledby` apontando para o título do modal

#### Scenario: Foco inicial gerenciado no modal

- **WHEN** o modal de créditos é aberto
- **THEN** o foco é movido para o primeiro elemento interativo ou título do modal

#### Scenario: Escape fecha o modal

- **WHEN** o modal de créditos está aberto e o usuário pressiona Escape
- **THEN** o modal fecha

#### Scenario: Retorno de foco após fechamento

- **WHEN** o modal de créditos é fechado
- **THEN** o foco retorna ao elemento que disparou a abertura do modal

### Requirement: Botões e CTAs com foco visível e touch target mínimo

Todo botão, link de ação e CTA interativo SHALL ter foco visível (`focus-visible:ring-2` ou equivalente) e touch target mínimo de 44px.

#### Scenario: Botões têm outline visível no foco

- **WHEN** um botão ou CTA recebe foco via teclado
- **THEN** o elemento exibe outline visível (focus-visible:ring-2 ou equivalente do design system)

#### Scenario: Touch target >= 44px

- **WHEN** um botão, link ou CTA é renderizado em viewport mobile
- **THEN** a área tocável (incluindo padding) é de no mínimo 44px em ambas as dimensões
