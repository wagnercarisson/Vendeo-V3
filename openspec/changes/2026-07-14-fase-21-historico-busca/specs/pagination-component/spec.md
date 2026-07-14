# Pagination Component

> Created for `fase-21-historico-busca`. New shared UI component at `src/components/ui/pagination.tsx`.

## Purpose

Componente de paginação reutilizável, componente puro controlado pelo pai, sem estado interno. Usa `Button` da F18 para consistência visual.

## Requirements

### Requirement: PaginationProps

O sistema SHALL definir `PaginationProps`:

```typescript
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}
```

### Requirement: Layout visual

O componente SHALL renderizar:

```
<< Anterior   1  2  3  ...  30  Próximo >>
```

- "Anterior" desabilitado quando `currentPage === 1`
- "Próximo" desabilitado quando `currentPage === totalPages`
- Botões numéricos: mostra primeira página, última página, página atual, e páginas imediatamente adjacentes (±1 da atual), com elipses preenchendo gaps. Exemplo para `currentPage=1`, `totalPages=30`: `1 2 3 ... 30`. Exemplo para `currentPage=28`, `totalPages=30`: `1 ... 27 28 29 30`
- Quando `totalPages <= 5`, mostra todas as páginas sem elipse
- Página atual visualmente destacada (variante ativa/current)

#### Scenario: 3 páginas

- **WHEN** `currentPage=1`, `totalPages=3`
- **THEN** renderiza: [Anterior (disabled)] [1 (active)] [2] [3] [Próximo]

#### Scenario: 30 páginas, first page

- **WHEN** `currentPage=1`, `totalPages=30`
- **THEN** renderiza: [Anterior (disabled)] [1 (active)] [2] [3] [...] [30] [Próximo]

#### Scenario: 30 páginas, no meio

- **WHEN** `currentPage=15`, `totalPages=30`
- **THEN** renderiza: [Anterior] [1] [...] [14] [15 (active)] [16] [...] [30] [Próximo]

#### Scenario: Última página

- **WHEN** `currentPage=30`, `totalPages=30`
- **THEN** renderiza: [Anterior] [1] [...] [28] [29] [30 (active)] [Próximo (disabled)]

### Requirement: Botões com variantes do Button (F18)

- Botões de navegação ("Anterior", "Próximo"): `variant="secondary"`
- Botões numéricos: `variant="ghost"` (página atual: `variant="secondary"` ou estilo diferenciado)

### Requirement: Controlled component

O componente SHALL ser puramente controlado:

- Sem estado interno (`useState`)
- `onPageChange(newPage)` chamado ao clicar em qualquer botão
- O pai decide se e como navegar (ex.: `router.replace()`)

#### Scenario: Callback ao clicar

- **WHEN** usuário clica no botão "3"
- **THEN** `onPageChange(3)` é chamado

#### Scenario: Callback ao clicar "Próximo"

- **WHEN** usuário clica em "Próximo" na página 2
- **THEN** `onPageChange(3)` é chamado

#### Scenario: Nenhum callback ao clicar em botão desabilitado

- **WHEN** usuário clica em "Anterior" na página 1
- **THEN** `onPageChange` NÃO é chamado
