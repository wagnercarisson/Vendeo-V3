## MODIFIED Requirements

### Requirement: Store identity form — lookup assíncrono de CNPJ onBlur

O sistema SHALL modificar o formulário de criação de loja (`StoreIdentityForm`) para realizar consulta de CNPJ assíncrona no evento onBlur do campo CNPJ (após validação local de dígitos), não no submit do formulário. A consulta é feita via `GET /api/cnpj/lookup?cnpj={cnpj}` (endpoint server-side que orquestra cache → BrasilAPI → CNPJá).

#### Scenario: Lookup dispara ao sair do campo CNPJ

- **WHEN** usuário digita CNPJ válido (14 dígitos, dígitos verificadores OK)
- **AND** sai do campo (onBlur)
- **THEN** dispara consulta à API de CNPJ (via endpoint server-side)
- **AND** exibe loading state "Consultando dados cadastrais..."

#### Scenario: CNPJ inválido não dispara lookup

- **WHEN** usuário digita CNPJ com dígitos inválidos
- **AND** sai do campo (onBlur)
- **THEN** exibe erro de validação local
- **AND** NÃO dispara consulta à API

#### Scenario: Razão social bloqueada após lookup

- **WHEN** lookup retorna dados resolvidos
- **THEN** campo "Razão Social" é pré-preenchido com valor oficial
- **AND** campo "Razão Social" fica bloqueado (read-only, não editável)

#### Scenario: Nome fantasia bloqueado após lookup

- **WHEN** lookup retorna dados resolvidos com nome fantasia
- **THEN** campo "Nome Fantasia" é pré-preenchido com valor oficial
- **AND** campo "Nome Fantasia" fica bloqueado (read-only, não editável)

#### Scenario: Botão "Usar nome fantasia"

- **WHEN** lookup retorna dados resolvidos com nome fantasia
- **THEN** botão "Usar nome fantasia" é exibido
- **AND** ao clicar, copia nome fantasia para o campo "Nome da Loja"

#### Scenario: Botão "Usar razão social"

- **WHEN** lookup retorna dados resolvidos SEM nome fantasia (null)
- **THEN** botão "Usar razão social" é exibido no lugar de "Usar nome fantasia"
- **AND** ao clicar, copia razão social para o campo "Nome da Loja"

#### Scenario: Endereço pré-preenchido

- **WHEN** lookup retorna dados resolvidos com endereço
- **THEN** campos de endereço (CEP, rua, bairro, cidade, UF) são pré-preenchidos
- **AND** campos permanecem editáveis (diferente de razão social/nome fantasia)

#### Scenario: Tooltip no campo CNPJ

- **WHEN** campo CNPJ está em foco ou tem tooltip visível
- **THEN** exibe: "Verificamos os dados do CNPJ para liberar os créditos gratuitos."

#### Scenario: Mensagem de lookup concluído

- **WHEN** lookup retorna dados resolvidos com sucesso
- **THEN** exibe "Dados carregados da Receita Federal." com check verde ao lado do campo

#### Scenario: Mensagem de lookup falhou (DEFER)

- **WHEN** lookup retorna unavailable (ambos provedores indisponíveis)
- **THEN** exibe "Não foi possível consultar os dados deste CNPJ agora. A loja será criada sem créditos iniciais. Você pode tentar novamente em 'Dados da Loja'." com aviso amarelo

#### Scenario: Mensagem de submit APPROVE

- **WHEN** submit retorna `verificationStatus: 'approved'`
- **THEN** exibe toast/mensagem: "Loja criada com sucesso! Seus créditos de boas-vindas foram liberados."

#### Scenario: Mensagem de submit REVIEW

- **WHEN** submit retorna `verificationStatus: 'review'`
- **THEN** exibe toast/mensagem: "Loja criada. Seus créditos de boas-vindas serão liberados após verificação cadastral."

#### Scenario: Mensagem de submit REJECT (CNPJ inexistente)

- **WHEN** submit retorna erro 400 com motivo CNPJ inexistente
- **THEN** exibe toast/mensagem: "Não foi possível criar a loja. O CNPJ informado não foi encontrado na Receita Federal. Verifique o número e tente novamente."

#### Scenario: Mensagem de submit REJECT (CNPJ baixado/inativo)

- **WHEN** submit retorna `verificationStatus: 'rejected'` por situação cadastral
- **THEN** exibe toast/mensagem: "Loja criada. Este CNPJ está com situação cadastral inativa."

#### Scenario: Mensagem de submit REJECT (raiz já usou)

- **WHEN** submit retorna `onboardingGranted: false` por raiz já consumida
- **THEN** exibe toast/mensagem: "Loja criada como filial. Esta empresa já utilizou o benefício de boas-vindas."

#### Scenario: Mensagem de submit DEFER

- **WHEN** submit retorna `verificationStatus: 'defer'`
- **THEN** exibe toast/mensagem: "Loja criada. Não foi possível verificar os dados cadastrais agora. Você pode tentar novamente em 'Dados da Loja'."

### Requirement: Dashboard — banner para lojas em REVIEW

O sistema SHALL exibir um banner amarelo no dashboard para lojas com `verification_status = 'review'`.

#### Scenario: Loja em REVIEW mostra banner

- **WHEN** loja logada tem `verification_status = 'review'`
- **THEN** dashboard exibe banner amarelo: "Seus créditos de boas-vindas estão em verificação cadastral."
- **AND** banner não bloqueia navegação

#### Scenario: Loja recebe admin APPROVE mostra banner verde

- **WHEN** admin aprova verificação da loja
- **THEN** dashboard exibe banner verde one-time: "Seus créditos de boas-vindas foram liberados!"
- **AND** banner é dismissível
