# Lab Scenarios

> Synced from `fase-48-1-laboratorio-ia-minimo` (ADDED).

## Purpose

Define os cenários controlados e versionados usados pelas execuções do laboratório.

## Requirements

### Requirement: Cenários controlados e versionados

O sistema SHALL manter cenários de campanha versionados, cada um representando um brief controlado com dados fictícios ou explicitamente autorizados, imagens de produto controladas e identidade de loja fictícia. Cada versão SHALL ter conteúdo imutável e um hash verificável. Cada execução SHALL registrar a versão do cenário utilizada.

#### Scenario: Cenário é versionado e imutável

- **WHEN** uma versão de cenário é criada
- **THEN** seu conteúdo é armazenado com um hash verificável
- **AND** uma alteração posterior cria uma nova versão sem alterar a anterior

#### Scenario: Execução registra a versão do cenário

- **WHEN** um run é executado a partir de um cenário
- **THEN** o snapshot do run registra o identificador e o hash da versão do cenário

#### Scenario: Dados são fictícios ou autorizados

- **WHEN** um cenário é adicionado ao corpus
- **THEN** seus dados de loja, produto e oferta são fictícios ou explicitamente autorizados
- **AND** nenhum brief ou imagem real de lojista é usado por padrão

### Requirement: Corpus inicial representativo e extensível

O sistema SHALL incluir um corpus inicial pequeno e representativo de cenários de produto/oferta, sem tentar cobrir todo o produto. O schema do cenário SHALL prever modalidades futuras (serviços, informativos, 9:16, carrossel e idiomas) mas SHALL aceitar somente `offer`, formato `1:1` e locale `pt-BR` nesta fase, rejeitando os demais com erro explícito.

#### Scenario: Corpus inicial de oferta disponível

- **WHEN** o laboratório lista os cenários
- **THEN** há ao menos três cenários de produto/oferta disponíveis

#### Scenario: Modalidade não suportada é rejeitada

- **WHEN** um cenário declara intent, formato ou locale fora de `offer`/`1:1`/`pt-BR`
- **THEN** a validação rejeita o cenário com `unsupported_scenario_mode`
- **AND** nenhum run é executado com esse cenário

#### Scenario: Valor de modalidade desconhecido é rejeitado

- **WHEN** um cenário declara em intent, formato ou locale uma string fora da união conhecida (ex.: `unknown`, `4:5`, `fr-FR`)
- **THEN** a validação rejeita o cenário com `unsupported_scenario_mode` e o campo culpado
- **AND** campo ausente ou de tipo inválido produz o erro normal de validação do schema (não `unsupported_scenario_mode`)

#### Scenario: Schema extensível preservado

- **WHEN** uma modalidade futura for adicionada
- **THEN** o schema de cenário já possui os campos de intent, formato, locale e tipos de mídia
- **AND** a extensão não exige remodelar as tabelas existentes

### Requirement: Cenários com imagens de produto controladas

O sistema SHALL permitir cenários com imagens de produto controladas, referenciadas por caminho versionado, sem depender de imagens reais de lojistas.

#### Scenario: Cenário usa imagens controladas

- **WHEN** um cenário é executado
- **THEN** as imagens de produto vêm do fixture controlado do cenário
- **AND** nenhuma imagem de lojista real é utilizada

#### Scenario: Imagem ausente impede a execução

- **WHEN** um cenário referencia uma imagem controlada inexistente
- **THEN** a execução é recusada com erro explícito
- **AND** nenhum run é iniciado

#### Scenario: Caminho de imagem que escapa do cenário é recusado

- **WHEN** o caminho de uma imagem escapa do diretório do cenário (path traversal ou symlink apontando para fora)
- **THEN** a leitura é recusada com `invalid_scenario_path`
- **AND** o arquivo fora do cenário não é aberto
