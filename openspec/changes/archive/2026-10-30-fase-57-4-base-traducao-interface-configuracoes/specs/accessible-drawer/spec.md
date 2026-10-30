## MODIFIED Requirements

### Requirement: Botão X interno fecha o drawer

O drawer SHALL ter um botão "X" (Lucide `X`) visível no canto superior direito do painel, com
`aria-label` localizado a partir do catálogo `shell` no idioma efetivo (em `pt-BR`, "Fechar menu";
em `es-419`, o equivalente aprovado no catálogo).

#### Scenario: Botão X fecha o drawer

- **WHEN** o drawer está aberto
- **AND** o usuário clica no botão X
- **THEN** o drawer SHALL fechar

#### Scenario: Botão X tem aria-label localizado

- **WHEN** o drawer está aberto em `pt-BR`
- **THEN** o botão X SHALL ter `aria-label="Fechar menu"`
- **WHEN** o drawer está aberto em `es-419`
- **THEN** o botão X SHALL ter o `aria-label` do catálogo `es-419`
