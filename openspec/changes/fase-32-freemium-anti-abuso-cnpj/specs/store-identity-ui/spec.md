## MODIFIED Requirements

### Requirement: Form fields — CNPJ, razão social e nome fantasia

O sistema SHALL renderizar os seguintes campos NOVOS no formulário de identidade da loja:

- **CNPJ**: required text input com máscara `XX.XXX.XXX/YYYY-ZZ`. Aceita apenas dígitos ou formato completo com pontuação. Feedback imediato de formato inválido no frontend.
- **Razão Social**: optional text input
- **Nome Fantasia**: optional text input

Os campos CNPJ, razão social e nome fantasia são visíveis APENAS em modo criação (store é null / `isCreating` é true). Em modo edição, os campos NÃO são exibidos.

#### Scenario: CNPJ field visible in create mode

- **WHEN** o formulário está em modo criação
- **THEN** o campo CNPJ é exibido com máscara `XX.XXX.XXX/YYYY-ZZ`
- **AND** o campo é required
- **AND** razão social e nome fantasia são exibidos como optional

#### Scenario: CNPJ field hidden in edit mode

- **WHEN** o formulário está em modo edição
- **THEN** os campos CNPJ, razão social e nome fantasia NÃO são exibidos