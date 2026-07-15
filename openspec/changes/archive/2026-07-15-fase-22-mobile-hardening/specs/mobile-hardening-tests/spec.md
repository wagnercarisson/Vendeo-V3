> **Propósito**: Esta spec define a suíte de 15+ testes para a F22, organizada por grupo: drawer acessibilidade, touch targets, responsividade, reduced motion, account menu e regressão.
>
> Criado para `fase-22-mobile-hardening` (ADDED).

## ADDED Requirements

### Requirement: Testes de drawer acessibilidade (4+)

O sistema SHALL ter 4+ testes validando a acessibilidade do drawer.

#### Scenario: Drawer role dialog test

- **WHEN** o drawer está aberto
- **THEN** o teste verifica `role="dialog"` e `aria-modal="true"`

#### Scenario: Drawer focus trap test

- **WHEN** o drawer está aberto
- **AND** Tab é pressionado no último elemento
- **THEN** o teste verifica que o foco retorna ao primeiro elemento

#### Scenario: Drawer Escape fecha e restaura foco

- **WHEN** o drawer está aberto
- **AND** Escape é pressionado
- **THEN** o teste verifica que o drawer fechou e o foco retornou ao toggle

#### Scenario: Drawer prefers-reduced-motion test

- **WHEN** `prefers-reduced-motion: reduce` está ativo
- **AND** o drawer abre
- **THEN** o teste verifica que a transição é `duration-0`

### Requirement: Testes de touch targets (5+)

O sistema SHALL ter 5+ testes validando touch targets mínimos de 44px.

#### Scenario: Hamburger 44px test

- **WHEN** a topbar é renderizada
- **THEN** o teste verifica que o hamburger tem `min-h-[44px]` e `min-w-[44px]`

#### Scenario: CTA Nova Campanha 44px test

- **WHEN** a topbar é renderizada
- **THEN** o teste verifica que o CTA "Nova Campanha" tem `min-h-[44px]`

#### Scenario: Abrir button em campanhas 44px test

- **WHEN** um card de campanha é renderizado
- **THEN** o teste verifica que o botão "Abrir" tem `min-h-[44px]`

#### Scenario: Input min-height 44px test

- **WHEN** o componente Input é renderizado
- **THEN** o teste verifica que ele tem `min-h-[44px]`

#### Scenario: Status chips 44px test

- **WHEN** os chips de status são renderizados
- **THEN** o teste verifica que cada chip tem `min-h-[44px]`

### Requirement: Testes de responsividade (3+)

O sistema SHALL ter 3+ testes validando comportamento responsivo.

#### Scenario: Main padding responsivo test

- **WHEN** o app shell é renderizado
- **THEN** o teste verifica que o main tem `px-4 py-6` e `sm:px-6`

#### Scenario: Pagination flex-wrap test

- **WHEN** o componente Pagination é renderizado em viewport estreita
- **THEN** o teste verifica que tem `flex-wrap`

### Requirement: Testes de reduced motion (2+)

O sistema SHALL ter 2+ testes validando `prefers-reduced-motion`.

#### Scenario: Account menu reduced motion test

- **WHEN** `prefers-reduced-motion: reduce` está ativo
- **AND** o account menu abre
- **THEN** o teste verifica que a transição é `duration-0`

#### Scenario: Drawer reduced motion test

- **WHEN** `prefers-reduced-motion: reduce` está ativo
- **AND** o drawer abre
- **THEN** o teste verifica que a transição é `duration-0`

### Requirement: Testes de account menu (2+)

O sistema SHALL ter 2+ testes validando acessibilidade do account menu.

#### Scenario: Account menu aria-haspopup test

- **WHEN** o account menu trigger é renderizado
- **THEN** o teste verifica que tem `aria-haspopup="true"`

#### Scenario: Account menu Escape fecha test

- **WHEN** o account menu está aberto
- **AND** Escape é pressionado
- **THEN** o teste verifica que o menu fechou

### Requirement: Testes de regressão (2+)

O sistema SHALL ter 2+ testes validando que fases anteriores não foram quebradas.

#### Scenario: Dashboard metrics grid intacto test

- **WHEN** o dashboard é renderizado
- **THEN** o teste verifica que o grid de métricas ainda tem `grid-cols-1 md:grid-cols-3`

#### Scenario: F19 empty states intactos test

- **WHEN** um usuário sem loja acessa o app
- **THEN** o teste verifica que o empty state "Configure sua loja" (F19) ainda é renderizado
