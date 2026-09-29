# Lab Admin API — delta (F48.2.3)

## ADDED Requirements

### Requirement: Exposição do briefing, do prompt compilado e da aprovação

A API da bancada SHALL expor o briefing estruturado, o **prompt compilado** (com os blocos canônicos) e permitir a **aprovação explícita** antes da confirmação, sem expor secrets, validando o manifesto (`assertBenchTestStore`) antes de qualquer leitura quando houver `storeId`. A API SHALL rejeitar a geração sem preflight aprovado e SHALL garantir que o `prompt_sent` corresponda exatamente ao prompt final aprovado, sem composição oculta.

#### Scenario: Briefing experimental é exposto

- **WHEN** o administrador solicita o briefing experimental de uma loja de teste
- **THEN** a API retorna o briefing com direção visual e tipografia
- **AND** nenhum secret é exposto

#### Scenario: Prompt compilado é exposto para revisão

- **WHEN** o administrador solicita a composição de uma loja de teste
- **THEN** a API retorna o prompt compilado com os blocos canônicos
- **AND** o prompt pode ser editado e aprovado

#### Scenario: Aprovação é exigida antes da geração

- **WHEN** uma geração é solicitada sem prompt aprovado
- **THEN** a API recusa a geração
- **AND** o `prompt_sent` corresponde exatamente ao prompt final aprovado

#### Scenario: Manifesto é validado antes da leitura

- **WHEN** uma rota com `storeId` é chamada
- **THEN** o manifesto é validado antes de qualquer leitura
- **AND** uma loja fora do manifesto é recusada
