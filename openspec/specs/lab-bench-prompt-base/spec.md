# Lab Bench Prompt Base

> Synced from `fase-48-2-4-experimento-deterministico-oferta-1-1` (ADDED).

## Purpose

Define o prompt-base padrão versionado, resolvido por configuração e editável, com conteúdo apenas complementar, preservado integralmente e com versão/conteúdo usados registrados nas evidências.

## Requirements

### Requirement: Prompt-base padrão versionado e resolvido por configuração

A bancada SHALL disponibilizar um **prompt-base padrão**, **versionado** e **resolvido por configuração** (chaveado pelo recorte multidimensional), mesmo havendo apenas o perfil Oferta 1:1 nesta fase. O conteúdo do padrão SHALL conter **somente instruções complementares**, sem repetir a hierarquia de oferta nem a orientação de formato 1:1 já pertencentes às políticas. O prompt-base padrão SHALL ser carregado inicialmente pela bancada, SHALL permanecer **editável** pelo operador e SHALL ter sua **versão** e seu **conteúdo efetivamente utilizado** registrados nas evidências da geração.

#### Scenario: Prompt-base padrão é carregado

- **WHEN** o operador abre a bancada
- **THEN** o prompt-base padrão versionado do recorte é carregado inicialmente
- **AND** ele pode ser editado

#### Scenario: Padrão contém apenas instruções complementares

- **WHEN** o prompt-base padrão é inspecionado
- **THEN** ele não repete a hierarquia de oferta nem a orientação de formato 1:1 das políticas
- **AND** contém somente instruções complementares

#### Scenario: Padrão é resolvido por configuração

- **WHEN** o recorte multidimensional é resolvido
- **THEN** o prompt-base padrão correspondente ao recorte é selecionado por configuração
- **AND** outros recortes futuros podem ter seu próprio padrão sem reescrever o módulo

#### Scenario: Versão e conteúdo usados são registrados

- **WHEN** uma geração é persistida
- **THEN** a versão do prompt-base padrão e o conteúdo efetivamente utilizado são registrados na evidência

### Requirement: Preservação integral e determinismo do prompt-base

O compositor SHALL preservar **integralmente** o prompt-base (padrão ou editado), sem reescrita, resumo ou filtragem lexical, e SHALL manter o determinismo quando o operador edita o prompt-base: a entrada inclui o conteúdo editado e a mesma entrada produz a mesma saída.

#### Scenario: Prompt-base editado é preservado

- **WHEN** o operador edita o prompt-base e recompõe
- **THEN** o conteúdo editado é incluído integralmente no prompt compilado
- **AND** nenhuma reescrita ou filtragem é aplicada

#### Scenario: Uso do prompt-base editado é determinístico

- **WHEN** o prompt-base editado é reutilizado como entrada
- **THEN** a composição é determinística
- **AND** a mesma entrada produz exatamente a mesma saída

### Requirement: Sem geração ou revisão de prompt por IA

A bancada SHALL NOT gerar nem revisar o prompt-base (ou o prompt compilado) por IA nesta fase. O prompt-base padrão é conteúdo estático versionado e as alterações são feitas manualmente pelo operador.

#### Scenario: Nenhuma IA gera ou revisa o prompt

- **WHEN** o prompt-base é carregado, editado ou composto
- **THEN** nenhuma chamada de IA gera ou revisa o prompt
- **AND** o conteúdo padrão é estático e versionado
