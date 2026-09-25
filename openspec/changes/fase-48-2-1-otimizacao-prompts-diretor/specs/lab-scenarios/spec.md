# Lab Scenarios

> Delta da capability `lab-scenarios` pela `fase-48-2-1-otimizacao-prompts-diretor`. Amplia as intenções suportadas de `offer` para `offer`/`spotlight`/`exclusive` e introduz a matriz de nove cenários.

## MODIFIED Requirements

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

## ADDED Requirements

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
