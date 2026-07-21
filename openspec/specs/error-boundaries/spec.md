# Error Boundaries

> Synced from `fase-29-refinamento-visual-uat-launch-readiness` (ADDED).

## Purpose

Error boundaries via `error.tsx` para o grupo autenticado e área admin, com mensagens claras em PT-BR e recuperação via `reset()`, sem vazar detalhes internos.

## Requirements

### Requirement: error.tsx no grupo (app) com fallback genérico

O sistema SHALL criar `src/app/(app)/error.tsx` como Client Component com fallback genérico para erros não tratados em qualquer rota filha do grupo autenticado.

#### Scenario: Erro não tratado exibe mensagem clara em PT-BR

- **WHEN** um erro não tratado ocorre em qualquer rota dentro de `(app)`
- **THEN** o error.tsx exibe título "Algo deu errado" e descrição "Não foi possível carregar esta página. Tente novamente ou entre em contato com o suporte se o problema persistir."

#### Scenario: Botão "Tentar novamente" executa reset()

- **WHEN** o usuário clica em "Tentar novamente"
- **THEN** o sistema chama `reset()` para recuperar a rota

### Requirement: error.tsx no admin sem vazar detalhes internos

O sistema SHALL criar `src/app/(app)/admin/error.tsx` como Client Component com mensagem segura para admin, sem exibir stack trace, connection string ou outros detalhes internos.

#### Scenario: Erro admin exibe mensagem segura

- **WHEN** um erro não tratado ocorre em `/admin/*`
- **THEN** o error.tsx admin exibe mensagem sem stack trace, dados de conexão ou detalhes de implementação

#### Scenario: Admin também vê botão "Tentar novamente"

- **WHEN** o usuário admin clica em "Tentar novamente"
- **THEN** o sistema chama `reset()` para recuperar a rota admin

### Requirement: Mensagens de erro sem jargão técnico

Ambos os error.tsx SHALL usar mensagens em PT-BR, tom comercial, sem jargão técnico.

#### Scenario: Mensagem não contém termos técnicos

- **WHEN** o error.tsx é renderizado
- **THEN** a mensagem não contém "Internal Server Error", "stack trace", "undefined", "null", "exception" ou outros jargões de desenvolvimento

### Requirement: Estados de erro com role="alert" e aria-live

Mensagens de erro SHALL ter `role="alert"` ou `aria-live="polite"` para notificar leitores de tela, sem quebrar o layout visual.

#### Scenario: role="alert" presente em error boundaries e error states

- **WHEN** um erro é exibido (error.tsx, error-state.tsx ou error state específico em página)
- **THEN** o container da mensagem de erro tem `role="alert"` ou `aria-live="polite"`

#### Scenario: Botões com foco visível

- **WHEN** um botão ou link de ação é renderizado em error.tsx, error-state.tsx ou error state específico
- **THEN** o elemento tem outline visível no foco (focus-visible:ring-2 ou equivalente do design system)
