# Product 1:1 Flow Activation — Wiring

## MODIFIED Requirements

### Requirement: Roteamento e UI usam decisão server-side

Roteamento e UI SHALL consultar b1a: ambas flags lidas validamente, somente flag aplicável ligada junto à autorização independente vigente. UI SHALL omitir seletores em `off`; POST SHALL revalidar. Nesta change autorização e flags SHALL permanecer `off`.

#### Scenario: Fluxo desligado
- **WHEN** autorização/flag aplicável não permite o estágio
- **THEN** payload legado segue legado; nenhum campo novo é enviado

#### Scenario: Elegibilidade revogada
- **WHEN** decisão muda antes do POST
- **THEN** payload com campos exclusivos recebe erro seguro antes de reservar crédito

#### Scenario: Campanha criada mantém fluxo
- **WHEN** flag ou autorização muda após criação
- **THEN** download continua determinado pelo fluxo persistido da campanha
