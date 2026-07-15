> **Propósito**: Esta spec define as melhorias de acessibilidade do `account-menu.tsx` para a F22: `aria-haspopup`, `aria-expanded` dinâmico, fechamento ao Escape, e suporte a `prefers-reduced-motion`.
>
> Criado para `fase-22-mobile-hardening` (ADDED).

## ADDED Requirements

### Requirement: Trigger tem aria-haspopup

O trigger do account menu SHALL ter `aria-haspopup="true"`.

#### Scenario: Trigger possui aria-haspopup

- **WHEN** o account menu trigger é renderizado
- **THEN** ele SHALL ter `aria-haspopup="true"`

### Requirement: aria-expanded dinâmico

O trigger do account menu SHALL ter `aria-expanded` que alterna entre `"true"` e `"false"` conforme o menu abre/fecha.

#### Scenario: aria-expanded alterna ao abrir

- **WHEN** o account menu está fechado
- **THEN** `aria-expanded` SHALL ser `"false"`
- **WHEN** o usuário clica no trigger para abrir
- **THEN** `aria-expanded` SHALL ser `"true"`

### Requirement: Escape fecha o menu

O account menu SHALL fechar ao pressionar Escape.

#### Scenario: Escape fecha account menu

- **WHEN** o account menu está aberto
- **AND** o usuário pressiona Escape
- **THEN** o menu SHALL fechar

### Requirement: prefers-reduced-motion no account menu

O account menu SHALL respeitar `prefers-reduced-motion`: quando ativo, transições existentes (rotação do chevron, fade do dropdown, se houver) SHALL usar `duration-0` ou equivalent. Não criar transição artificial onde não existe.

#### Scenario: prefers-reduced-motion remove animações existentes

- **WHEN** `prefers-reduced-motion: reduce` está ativo
- **AND** o account menu abre ou fecha
- **THEN** quaisquer transições existentes (chevron, dropdown) SHALL ser instantâneas (`duration-0`)
