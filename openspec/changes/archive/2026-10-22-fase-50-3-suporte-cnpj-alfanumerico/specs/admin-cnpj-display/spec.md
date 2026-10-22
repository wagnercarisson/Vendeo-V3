## MODIFIED Requirements

### Requirement: CNPJ mascarado no detalhe da loja

O sistema SHALL exibir CNPJ mascarado (`**.***.***/YYYY-**`) na página de detalhe do usuário/loja em `/admin/users/[id]`. O sufixo `YYYY` corresponde às posições 9–12 e pode conter letras maiúsculas e dígitos. O CNPJ nunca é exibido cru em nenhuma interface. Se o valor armazenado não for canônico, a tela SHALL exibir o placeholder seguro `"CNPJ inválido"`.

#### Scenario: CNPJ numérico exibido mascarado

- **WHEN** admin acessa `/admin/users/[id]`
- **AND** a loja tem CNPJ numérico cadastrado
- **THEN** o CNPJ é exibido no formato `**.***.***/0001-**`

#### Scenario: CNPJ alfanumérico exibido mascarado

- **WHEN** admin acessa `/admin/users/[id]`
- **AND** a loja tem CNPJ `"12ABC34501DE35"`
- **THEN** o CNPJ é exibido como `**.***.***/01DE-**`
- **AND** a raiz `12ABC345` não é exibida

#### Scenario: Valor inesperado não é exibido cru

- **WHEN** admin acessa `/admin/users/[id]`
- **AND** o valor armazenado não casa `^[A-Z0-9]{12}[0-9]{2}$`
- **THEN** a tela exibe `"CNPJ inválido"`
- **AND** o valor integral não é renderizado

## ADDED Requirements

### Requirement: Listagens admin mascaram CNPJ alfanumérico

As listagens e telas administrativas que exibem CNPJ SHALL usar a função central `maskCnpj`, preservando o sufixo de 4 caracteres (numérico ou alfanumérico) e ocultando a raiz e os dígitos verificadores.

#### Scenario: Listagem de usuários exibe CNPJ alfanumérico mascarado

- **WHEN** admin acessa `/admin/users`
- **AND** a loja tem CNPJ `"12ABC34501DE35"`
- **THEN** a linha exibe `**.***.***/01DE-**`

#### Scenario: Fila de revisão exibe CNPJ alfanumérico mascarado

- **WHEN** admin acessa `/admin/reviews`
- **AND** a loja tem CNPJ `"12ABC34501DE35"`
- **THEN** a fila exibe `**.***.***/01DE-**`

#### Scenario: Exceção freemium exibe CNPJ alfanumérico mascarado

- **WHEN** admin acessa a tela de exceção freemium de uma loja com CNPJ alfanumérico
- **THEN** o CNPJ é exibido mascarado com o sufixo alfanumérico preservado
