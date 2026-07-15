> **Propósito**: Esta spec define as melhorias de acessibilidade do `sidebar-drawer.tsx` para a F22: focus trap manual, semântica de dialog, botão X interno, restauro de foco, body scroll lock com save/restore, e suporte a `prefers-reduced-motion`.
>
> Criado para `fase-22-mobile-hardening` (ADDED).

## ADDED Requirements

### Requirement: Drawer tem role="dialog" e aria-modal="true"

O drawer SHALL ter `role="dialog"` e `aria-modal="true"` no elemento do painel deslizante (não no overlay).

#### Scenario: Drawer possui role dialog e aria-modal

- **WHEN** o drawer está aberto
- **THEN** o elemento do painel do drawer SHALL ter `role="dialog"`
- **AND** SHALL ter `aria-modal="true"`

### Requirement: Focus trap manual dentro do drawer

O drawer SHALL implementar focus trap manual — Tab循环 prende o foco dentro dos elementos focáveis do drawer quando aberto.

#### Scenario: Focus trap prende Tab dentro do drawer

- **WHEN** o drawer está aberto
- **AND** o foco está no último elemento focável do drawer
- **AND** o usuário pressiona Tab
- **THEN** o foco SHALL retornar ao primeiro elemento focável do drawer
- **AND** NÃO SHALL vazar para elementos fora do drawer

#### Scenario: Shift+Tab no primeiro elemento volta ao último

- **WHEN** o drawer está aberto
- **AND** o foco está no primeiro elemento focável do drawer
- **AND** o usuário pressiona Shift+Tab
- **THEN** o foco SHALL mover para o último elemento focável do drawer

### Requirement: Botão X interno fecha o drawer

O drawer SHALL ter um botão "X" (Lucide `X`) visível no canto superior direito do painel, com `aria-label="Fechar menu"`.

#### Scenario: Botão X fecha o drawer

- **WHEN** o drawer está aberto
- **AND** o usuário clica no botão X
- **THEN** o drawer SHALL fechar

#### Scenario: Botão X tem aria-label

- **WHEN** o drawer está aberto
- **THEN** o botão X SHALL ter `aria-label="Fechar menu"`

### Requirement: Escape fecha drawer e restaura foco

O drawer SHALL fechar ao pressionar Escape, e o foco SHALL retornar ao hamburger (toggle) que abriu o drawer.

#### Scenario: Escape fecha drawer

- **WHEN** o drawer está aberto
- **AND** o usuário pressiona Escape
- **THEN** o drawer SHALL fechar
- **AND** o foco SHALL retornar ao hamburger button

### Requirement: Foco move-se ao primeiro elemento ao abrir

Quando o drawer abre, o foco SHALL mover-se para o primeiro elemento focável dentro do painel do drawer.

#### Scenario: Foco no primeiro elemento ao abrir

- **WHEN** o drawer abre
- **THEN** o foco SHALL estar no primeiro elemento focável do drawer

### Requirement: Body scroll lock com save/restore

O drawer SHALL travar o scroll do body quando aberto, salvando o valor original de `overflow` e restaurando-o exatamente ao fechar (não assumindo `""`).

#### Scenario: Body scroll lock salva e restaura overflow original

- **WHEN** o drawer abre
- **THEN** `document.body.style.overflow` SHALL ser salvo antes de setar `"hidden"`
- **WHEN** o drawer fecha
- **THEN** o valor original salvo de `overflow` SHALL ser restaurado

### Requirement: prefers-reduced-motion remove transição

O drawer SHALL respeitar `prefers-reduced-motion`: quando ativo (`matchMedia("(prefers-reduced-motion: reduce)").matches === true`), a transição de abertura/fechamento SHALL usar `duration-0`.

#### Scenario: prefers-reduced-motion remove animação

- **WHEN** `prefers-reduced-motion: reduce` está ativo
- **AND** o drawer abre ou fecha
- **THEN** a transição SHALL ser instantânea (`duration-0`)
