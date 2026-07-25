# Campaign Input UI

> Modified by `fase-31-2-diretores-por-intencao`.

## MODIFIED Requirements

### Requirement: IntentSelector sem badge "Em breve"

O sistema SHALL remover o badge "Em breve" (`<span>Em breve</span>`) das opções spotlight e exclusive no `IntentSelector`. As opções continuam renderizadas sem indicador de restrição.

#### Scenario: IntentSelector mostra spotlight sem badge

- **WHEN** o `IntentSelector` renderiza a opção spotlight
- **THEN** NÃO exibe badge "Em breve"
- **AND** a opção é clicável normalmente

#### Scenario: IntentSelector mostra exclusive sem badge

- **WHEN** o `IntentSelector` renderiza a opção exclusive
- **THEN** NÃO exibe badge "Em breve"
- **AND** a opção é clicável normalmente

### Requirement: Botão "Criar Campanha" habilitado para todas as intents

O sistema SHALL remover a condição `campaignIntent !== "offer"` do `disabled` do botão submit e da exibição do tooltip. O botão SHALL mostrar "Criar Campanha" para todas as intents.

A desabilitação do botão continua para: saldo zero, saldo em erro, submetendo.

#### Scenario: Botão habilitado para spotlight

- **WHEN** intent == "spotlight" e demais condições válidas
- **THEN** botão "Criar Campanha" está habilitado
- **AND** tooltip não menciona "Disponível em breve"

#### Scenario: Botão habilitado para exclusive

- **WHEN** intent == "exclusive" e demais condições válidas
- **THEN** botão "Criar Campanha" está habilitado

### Requirement: Validação de submit sem bloqueio de intent

O sistema SHALL remover a validação que bloqueava submit para intents não-offer. As validações de preço e badge continuam condicionais por intent.

#### Scenario: Submit de spotlight não bloqueado

- **WHEN** intent selecionada é "spotlight" e o usuário clica "Criar Campanha"
- **THEN** o submit é executado (não bloqueado)
