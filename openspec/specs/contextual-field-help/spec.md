# Contextual Field Help

## Purpose

Padrão reutilizável e mínimo de orientação contextual no próprio campo/seção: hint inline, descrição contextual da opção selecionada, ajuda expansível (progressive disclosure) e feedback dinâmico — com associação acessível campo↔ajuda, diferenciação obrigatório/recomendado/opcional, estados desktop/mobile e as proibições de poluição, tooltip-exclusivo e avisos negativos.

> Added by `fase-49-ativacao-orientacao-contextual-campos` (D2/D3/D13).

## Requirements

### Requirement: Quatro mecanismos de orientação contextual no próprio campo

O sistema SHALL prover orientação contextual **no próprio campo ou seção**, por composição de quatro mecanismos mínimos (D2), sem criar um componente genérico complexo de formulário:

1. **Hint inline curto** — texto auxiliar sempre visível, associado ao campo, para explicações de uma linha.
2. **Descrição contextual da opção selecionada** — para selects cujo valor escolhido merece uma frase própria (ex.: tom de voz), exibida quando há seleção.
3. **Ajuda expansível (progressive disclosure)** — disclosure acionável para exemplos longos ou regras combinatórias, **colapsado por padrão** (não ocupa altura permanente).
4. **Feedback dinâmico** — mensagem derivada dos valores preenchidos, por função pura, refletindo o comportamento real do sistema.

A orientação SHALL explicar **positivamente** o que informar e como a informação é usada. A informação essencial SHALL ser visível e acessível (não exclusivamente em tooltip). A interface SHALL NOT exibir listas permanentes de regras nem explicações de limitações internas do sistema.

#### Scenario: Hint inline visível e associado ao campo

- **WHEN** um campo com orientação é renderizado
- **THEN** o hint inline correspondente está visível sem interação
- **AND** o hint está associado ao campo por `aria-describedby` com id estável gerado por `useId`

#### Scenario: Descrição contextual da opção selecionada

- **WHEN** um select com orientação contextual tem uma opção selecionada
- **THEN** a descrição correspondente à opção selecionada é exibida
- **AND** quando não há seleção, nenhuma descrição de opção é exibida

#### Scenario: Ajuda expansível colapsada por padrão

- **WHEN** um campo possui ajuda expansível (exemplo longo ou regra combinatória)
- **THEN** a ajuda está colapsada por padrão
- **AND** ao ser acionada, revela o conteúdo sem recarregar a página
- **AND** ao ser acionada novamente, volta a colapsar

#### Scenario: Feedback dinâmico derivado dos valores

- **WHEN** os valores de um grupo de campos mudam (ex.: preços)
- **THEN** o feedback dinâmico é recalculado a partir dos valores atuais
- **AND** o feedback reflete o comportamento real do sistema (sem prometer efeito inexistente)

### Requirement: Acessibilidade e associação campo↔ajuda

O sistema SHALL associar cada campo ao seu hint/erro/feedback por `aria-describedby` (ids gerados por `useId`), preservando `aria-invalid` nos erros existentes. A ajuda expansível SHALL ser um controle acionável por teclado com estado exposto (`aria-expanded`), com foco visível. A orientação SHALL NOT depender exclusivamente de `title`/tooltip. Touch targets SHALL ter no mínimo 44px.

#### Scenario: Campo referencia hint e erro por aria-describedby

- **WHEN** um campo tem hint e/ou erro
- **THEN** o atributo `aria-describedby` do campo referencia os ids correspondentes
- **AND** o campo com erro mantém `aria-invalid`

#### Scenario: Disclosure navegável por teclado

- **WHEN** o usuário navega por teclado até o controle de ajuda expansível
- **THEN** o controle é focável e acionável por teclado
- **AND** expõe `aria-expanded` coerente com o estado (colapsado/expandido)
- **AND** o foco visível é preservado

#### Scenario: Informação essencial não é exclusiva de tooltip

- **WHEN** um campo possui informação essencial para o preenchimento
- **THEN** essa informação está disponível de forma visível ou alcançável por toque/teclado
- **AND** não depende exclusivamente de `title`/hover

### Requirement: Diferenciação de obrigatório, recomendado e opcional

O sistema SHALL diferenciar claramente campos **obrigatórios**, **recomendados** e **opcionais** por texto (não apenas cor). Campos obrigatórios SHALL manter o marcador `*` e a **validação controlada atual** (`noValidate` + validação por campo + mensagens existentes). Como melhoria acessível, os campos obrigatórios SHALL receber **`aria-required="true"`** — **sem** adicionar o atributo nativo `required` e **sem** introduzir validação nativa (o atributo nativo `required` não existe no código atual). Campos recomendados SHALL ser sinalizados textualmente como "Recomendado". Campos opcionais SHALL manter o rótulo "(opcional)".

#### Scenario: Obrigatório mantém marcador, validação controlada e erro

- **WHEN** um campo obrigatório é renderizado
- **THEN** o rótulo exibe `*`
- **AND** o campo mantém a validação controlada atual e a mensagem de erro existente
- **AND** o campo **não** recebe o atributo nativo `required`

#### Scenario: Obrigatório expõe aria-required

- **WHEN** um campo obrigatório é renderizado
- **THEN** o campo expõe `aria-required="true"` como melhoria acessível
- **AND** nenhuma validação nativa nova é introduzida

#### Scenario: Recomendado é sinalizado textualmente

- **WHEN** um campo recomendado é renderizado
- **THEN** o campo exibe um indicador textual "Recomendado"
- **AND** o campo **não** é bloqueante (não impede avanço/salvamento)

#### Scenario: Diferenciação não depende apenas de cor

- **WHEN** os estados obrigatório/recomendado/opcional são exibidos
- **THEN** cada estado tem representação textual acessível
- **AND** nenhum estado é comunicado exclusivamente por cor

### Requirement: Proibições de orientação (sem poluição, sem negatividade, sem limite interno)

A orientação contextual SHALL NOT:

- poluir a interface com listas permanentes de regras;
- explicar limitações internas do sistema ao usuário;
- apresentar exemplos negativos ou advertências preventivas sem evidência de erro recorrente;
- criar validadores semânticos rígidos, regex de intenção ou bloqueio por qualidade de texto;
- prometer um efeito que o pipeline atual não produz.

#### Scenario: Nenhuma lista permanente de regras

- **WHEN** um formulário com orientação contextual é renderizado
- **THEN** regras combinatórias longas aparecem em ajuda expansível (colapsada), não como lista permanente
- **AND** nenhuma advertência negativa preventiva é exibida de forma permanente

#### Scenario: Orientação não promete efeito inexistente

- **WHEN** uma microcopy de orientação é exibida
- **THEN** ela descreve apenas efeitos que o sistema realmente produz (copy, identidade, arte ou desbloqueio)
- **AND** nenhuma orientação afirma um efeito não implementado no pipeline

### Requirement: Estados desktop e mobile da ajuda

O sistema SHALL manter a orientação utilizável em desktop e mobile: hint curto visível, ajuda expansível colapsada por padrão, touch targets ≥ 44px, sem scroll horizontal e sem cobrir conteúdo. Em telas estreitas, a orientação SHALL NOT empurrar permanentemente a altura do formulário.

#### Scenario: Mobile sem scroll horizontal

- **WHEN** o formulário com orientação é exibido em tela estreita (320px/375px)
- **THEN** não há scroll horizontal
- **AND** os controles de ajuda têm touch target ≥ 44px
- **AND** a ajuda expansível inicia colapsada
