# useDebounce Hook

> Created for `fase-21-historico-busca`. New hook at `src/hooks/use-debounce.ts`.

## Purpose

Hook reutilizável para debounce de valores. Usado no campo de busca textual de `/campanhas` com delay de 300ms. Sem dependências externas.

## Requirements

### Requirement: useDebounce

O sistema SHALL prover um hook `useDebounce<T>(value: T, delay: number): T` que:

- Retorna o valor atual apenas após `delay` ms sem mudanças
- Usa `useState` + `useEffect` com `setTimeout`
- Cancela o timeout anterior quando `value` muda
- Limpa o timeout no cleanup do `useEffect`

#### Scenario: Retorna valor após delay

- **WHEN** `useDebounce("tenis", 300)` é chamado com valor "tenis" (primeira renderização)
- **THEN** retorna `"tenis"` imediatamente (valor inicial sincronizado)
- **AND** se o valor não mudar, permanece `"tenis"` mesmo após 300ms
- **WHEN** valor muda para "tênis" e depois permanece estável por 300ms
- **THEN** o valor retornado atualiza para "tênis" após o delay

#### Scenario: Múltiplas mudanças dentro do delay

- **WHEN** valor muda de "t" para "te" para "ten" para "teni" para "tenis" em intervalos < 300ms
- **THEN** apenas o último valor "tenis" é retornado após 300ms de inatividade
- **AND** valores intermediários são descartados

#### Scenario: Testável

- **WHEN** o hook é testado com `vi.advanceTimersByTime`
- **THEN** os timers podem ser avançados programaticamente para verificar o comportamento
