# Product 1:1 Prompt Composition

## ADDED Requirements

### Requirement: Incorporação versionada e congelada dos prompts e regras aprovados

O novo fluxo SHALL compor o prompt a partir dos prompts e regras **aprovados na bancada F48.2.6** — Produto v4, compositor v5 e as três intenções — por um runtime de produção próprio, com versões fixadas e registráveis. O novo fluxo SHALL NOT depender de configuração mutável da bancada em tempo de execução.

#### Scenario: Prompt vem de versão fixada

- **WHEN** uma geração do novo fluxo é composta
- **THEN** o prompt usa as versões fixadas de compositor e política aprovadas
- **AND** nenhuma configuração mutável da bancada altera o resultado em tempo de execução

#### Scenario: Versões registradas no snapshot

- **WHEN** a composição é persistida para a campanha
- **THEN** as versões de compositor, base de prompt e políticas são registradas
- **AND** a versão registrada corresponde à usada na geração

### Requirement: Conteúdo obrigatório do prompt

A composição SHALL preservar os contratos aprovados na bancada: nome completo com palavras, números e unidades; fidelidade às referências; primeira imagem/variante protagonista e auxiliares secundárias; identidade fiel; textos obrigatórios uma única vez; matriz comercial por intenção; e a direção de fundo escolhida.

#### Scenario: Nome completo e fidelidade

- **WHEN** o produto possui nome com palavras, números e unidades
- **THEN** o prompt instrui o nome completo exatamente como informado
- **AND** instrui fidelidade às referências de produto

#### Scenario: Hierarquia das referências

- **WHEN** existem múltiplas imagens de produto
- **THEN** o prompt trata a primeira imagem/variante como protagonista
- **AND** trata as demais como auxiliares secundárias

#### Scenario: Textos obrigatórios uma única vez

- **WHEN** há textos obrigatórios informados
- **THEN** cada texto obrigatório aparece uma única vez na composição
- **AND** não é duplicado

#### Scenario: Matriz comercial por intenção

- **WHEN** a intenção é Oferta, Destaque ou Exclusivo
- **THEN** a matriz comercial aplicada corresponde à intenção selecionada
- **AND** preços/original são tratados conforme a intenção

### Requirement: Sem troca silenciosa da intenção

A composição SHALL NOT alterar silenciosamente a intenção escolhida pelo lojista.

#### Scenario: Intenção não é trocada

- **WHEN** o prompt é composto
- **THEN** a intenção usada é exatamente a selecionada
- **AND** nenhum fallback de intenção ocorre sem ação explícita
