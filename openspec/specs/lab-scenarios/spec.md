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

O sistema SHALL incluir um corpus representativo de cenários dos três tipos de campanha atuais (`offer`, `spotlight`, `exclusive`), sem tentar cobrir todo o produto. O schema do cenário SHALL prever modalidades futuras (serviços, informativos, 9:16, carrossel e idiomas) mas SHALL aceitar somente as intenções `offer`/`spotlight`/`exclusive`, formato `1:1` e locale `pt-BR` nesta fase, rejeitando os demais com erro explícito. O formato visual dos três tipos SHALL permanecer `1:1` — os tipos de campanha não são novos formatos de imagem.

#### Scenario: Corpus cobre os três tipos de campanha

- **WHEN** o laboratório lista os cenários
- **THEN** há cenários de `offer`, `spotlight` e `exclusive` disponíveis
- **AND** todos no formato `1:1`

#### Scenario: Modalidade não suportada é rejeitada

- **WHEN** um cenário declara intent, formato ou locale fora de `offer`/`spotlight`/`exclusive`, `1:1` e `pt-BR`
- **THEN** a validação rejeita o cenário com `unsupported_scenario_mode`
- **AND** nenhum run é executado com esse cenário

#### Scenario: Valor de modalidade desconhecido é rejeitado

- **WHEN** um cenário declara em intent, formato ou locale uma string fora da união conhecida (ex.: `unknown`, `9:16`, `fr-FR`)
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

### Requirement: Matriz representativa de nove cenários

O sistema SHALL manter uma matriz de nove cenários controlados — três por tipo de campanha — versionada e imutável por versão, distribuindo os atributos representativos definidos pela capability `lab-prompt-optimization`. Cada cenário SHALL permanecer fictício (ou explicitamente autorizado) e SHALL registrar a versão utilizada em cada execução.

#### Scenario: Matriz é composta por nove cenários

- **WHEN** a matriz é materializada pelo bootstrap
- **THEN** existem nove cenários versionados, três por tipo de campanha
- **AND** cada versão tem conteúdo imutável e hash verificável

#### Scenario: Atributos representativos são distribuídos

- **WHEN** a matriz é revisada
- **THEN** os atributos obrigatórios estão cobertos
- **AND** a distribuição está registrada na descrição da versão

#### Scenario: Alteração cria nova versão

- **WHEN** o conteúdo de um cenário da matriz muda
- **THEN** uma nova versão é criada
- **AND** a versão anterior permanece inalterada e auditável

### Requirement: Cenário não carrega diagnóstico

O cenário SHALL descrever apenas os fatos da campanha (briefing, loja, identidade, imagens de produto) e SHALL NOT carregar diagnóstico humano nem categorias de defeito.

#### Scenario: Cenário não define diagnóstico

- **WHEN** um cenário é criado
- **THEN** ele não registra diagnóstico nem categorias de defeito
- **AND** permanece apenas a descrição factual da campanha
