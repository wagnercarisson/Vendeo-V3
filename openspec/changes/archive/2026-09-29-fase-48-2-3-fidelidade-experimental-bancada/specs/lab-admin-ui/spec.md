# Lab Admin UI — delta (F48.2.3)

## ADDED Requirements

### Requirement: Formulário fiel na bancada

A tela da bancada SHALL oferecer os campos fiéis do formulário produtivo (nome, descrição, imagem principal e até três adicionais, preços de/por, selo promocional, intenção, preservação da imagem original, validade, aviso ilustrativo e informações obrigatórias na arte), mantendo-se desktop-only e sem comparação lado a lado ou votação.

#### Scenario: Campos fiéis são oferecidos

- **WHEN** o administrador preenche a bancada
- **THEN** os campos fiéis do formulário produtivo são oferecidos
- **AND** a tela permanece desktop-only

### Requirement: Preflight visível: compor, editar e aprovar

A tela da bancada SHALL oferecer a etapa de preflight — "Compor prompt", exibição do prompt compilado (com os blocos canônicos, incluindo a direção tipográfica), edição manual e **aprovação explícita** — antes de habilitar a estimativa/confirmação da geração. Qualquer mudança nas entradas ou no prompt após a aprovação SHALL invalidar a aprovação na UI. A confirmação financeira SHALL permanecer separada da aprovação do prompt.

#### Scenario: Prompt compilado é exibido e editável

- **WHEN** o administrador aciona "Compor prompt"
- **THEN** o prompt compilado é exibido com os blocos canônicos
- **AND** pode ser editado manualmente

#### Scenario: Aprovação habilita a geração

- **WHEN** o administrador aprova o prompt
- **THEN** o caminho de estimativa/confirmação é habilitado
- **AND** a confirmação financeira permanece um passo separado

#### Scenario: Mudança invalida a aprovação

- **WHEN** um dado de entrada ou o prompt muda após a aprovação
- **THEN** a aprovação é invalidada
- **AND** uma nova composição e aprovação é exigida

### Requirement: Resolução cromática visível e idêntica à produtiva

A tela da bancada SHALL exibir o `brandColor` resolvido, idêntico ao produtivo, sem oferecer nova precedência de cores nem expansão automática de paleta.

#### Scenario: brandColor resolvido é exibido

- **WHEN** o branding da loja é carregado
- **THEN** o `brandColor` resolvido é exibido
- **AND** corresponde ao valor produtivo
