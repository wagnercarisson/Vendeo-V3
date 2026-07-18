## ADDED Requirements

### Requirement: CreditCta component

O sistema SHALL implementar `CreditCta` em `src/components/credit/credit-cta.tsx` como Client Component (`"use client"`) que exibe o CTA "Solicitar créditos".

Props:
- `variant: "zero" | "low" | "normal"` — estado que determina o texto e comportamento
- `supportEmail?: string` — email de suporte configurável via env `SUPPORT_EMAIL`

#### Scenario: CreditCta renders with zero variant

- **WHEN** `CreditCta` é renderizado com `variant: "zero"`
- **THEN** exibe botão "Solicitar créditos" com destaque visual

#### Scenario: CreditCta renders with low variant

- **WHEN** `CreditCta` é renderizado com `variant: "low"`
- **THEN** exibe CTA "Solicitar créditos" com alerta discreto

#### Scenario: CreditCta renders nothing for normal variant

- **WHEN** `CreditCta` é renderizado com `variant: "normal"`
- **THEN** não exibe nada (retorna null)

### Requirement: CreditCta opens modal with instructions

Quando o usuário clica no CTA, o sistema SHALL abrir um modal com instruções de contato. Se `supportEmail` estiver configurado, o modal SHALL exibir link `mailto:`.

#### Scenario: CreditCta opens modal with mailto when email is configured

- **WHEN** usuário clica em "Solicitar créditos" com `supportEmail: "suporte@vendeo.app"`
- **THEN** abre modal com link `mailto:suporte@vendeo.app`
- **AND** exibe texto "Envie um email para suporte@vendeo.app solicitando mais créditos. O time do Vendeo responderá em até 24h."

#### Scenario: CreditCta opens modal without mailto when email is not configured

- **WHEN** usuário clica em "Solicitar créditos" sem `supportEmail`
- **THEN** abre modal com mensagem explicativa sem link de envio automático

### Requirement: CreditCta closes modal on close action

O modal SHALL ter um botão de fechar e suportar fechamento via clique fora do modal.

#### Scenario: CreditCta modal closes on button click

- **WHEN** usuário clica no botão de fechar do modal
- **THEN** o modal é fechado
