# Product 1:1 Prompt Composition

## Purpose

Specify deterministic, versioned production prompt composition for the Product 1:1 campaign flow.

## Requirements

### Requirement: Incorporação versionada e congelada dos prompts e regras aprovados

O novo fluxo SHALL compor o prompt por um **módulo produtivo próprio** que incorpora os prompts/regras aprovados na bancada F48.2.6 na forma do **baseline aprovado do laboratório** (quick 261009-u3h, aprovado pelo responsável em 2026-10-11) — Produto v4, compositor v6, Oferta v2, Destaque v2, Exclusivo v4 e direção de fundo versionada (`policyVersions.fundo`) — com versões fixadas e registráveis. O módulo SHALL NOT ler configuração mutável da bancada em tempo de execução.

#### Scenario: Prompt vem de versão fixada

- **WHEN** uma composição é produzida
- **THEN** ela usa as versões fixadas de compositor, base de prompt e políticas
- **AND** nenhuma configuração mutável da bancada altera o resultado em runtime

#### Scenario: Versões registráveis no snapshot

- **WHEN** a composição é associada a uma campanha
- **THEN** as versões de compositor, base de prompt e políticas ficam disponíveis para registro
- **AND** a versão registrada corresponde à usada

### Requirement: Conteúdo obrigatório do prompt

A composição SHALL preservar os contratos aprovados: nome completo com palavras, números e unidades; fidelidade às referências; primeira imagem/variante protagonista e auxiliares secundárias; identidade fiel; textos obrigatórios uma única vez; matriz comercial por intenção; e a direção de fundo escolhida.

#### Scenario: Nome completo e fidelidade

- **WHEN** o produto possui nome com palavras, números e unidades
- **THEN** a composição instrui o nome completo como informado
- **AND** instrui fidelidade às referências de produto

#### Scenario: Hierarquia das referências

- **WHEN** existem múltiplas imagens de produto
- **THEN** a composição trata a primeira como protagonista
- **AND** trata as demais como auxiliares secundárias

#### Scenario: Textos obrigatórios uma única vez

- **WHEN** há textos obrigatórios informados
- **THEN** cada texto obrigatório aparece uma única vez
- **AND** não é duplicado

#### Scenario: Matriz comercial por intenção

- **WHEN** a intenção é Oferta, Destaque ou Exclusivo
- **THEN** a matriz comercial aplicada corresponde à intenção selecionada
- **AND** preços/original são tratados conforme a intenção

### Requirement: Sem troca silenciosa da intenção

A composição SHALL NOT alterar silenciosamente a intenção escolhida.

#### Scenario: Intenção não é trocada

- **WHEN** a composição é produzida
- **THEN** a intenção usada é exatamente a selecionada
- **AND** nenhum fallback de intenção ocorre sem ação explícita

### Requirement: Equivalência com o baseline aprovado da bancada

O módulo produtivo SHALL ser validado por **testes de equivalência** contra um **baseline aprovado congelado** da bancada F48.2.6 (fixture imutável das nove combinações: 3 intenções × 3 direções de fundo), sem depender da bancada mutável em tempo de execução. A atualização do baseline SHALL ser um ato explícito e rastreável — preservando o baseline anterior e sua origem — e SHALL NOT copiar mudanças experimentais não aprovadas da bancada.

#### Scenario: Equivalência nos casos representativos

- **WHEN** a composição produtiva é comparada com o baseline aprovado congelado nos casos representativos (as nove combinações)
- **THEN** os resultados são equivalentes em texto, blocos e versões
- **AND** o baseline preserva o registro do baseline anterior e sua origem
- **AND** as políticas da bancada não são dependência de runtime do fluxo produtivo

### Requirement: Bancada não é dependência de runtime

A bancada F48.2.6 SHALL NOT ser dependência de execução do novo fluxo; o módulo produtivo SHALL ser autônomo em runtime.

#### Scenario: Runtime sem dependência da bancada

- **WHEN** o novo fluxo compõe um prompt em runtime
- **THEN** ele não consulta artefatos mutáveis da bancada
- **AND** a composição é determinística a partir das versões fixadas
