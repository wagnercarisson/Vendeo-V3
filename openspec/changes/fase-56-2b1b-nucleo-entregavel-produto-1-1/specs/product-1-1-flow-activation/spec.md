# Product 1:1 Flow Activation — Wiring

## MODIFIED Requirements

### Requirement: Barreira de não-ativação nesta fatia

A b1b SHALL conectar rota, formulário e geração, mas SHALL manter as duas flags e a autorização em `off`; nenhuma loja real SHALL ser encaminhada ao novo fluxo nesta fatia. Os componentes do novo fluxo SHALL ser montados somente sob elegibilidade server-side; com decisão negativa, o roteamento e a UI permanecem no fluxo legado. Nenhuma chamada paga, `db push` ou deploy SHALL ocorrer nesta fatia.

#### Scenario: Chave não encaminha campanhas reais

- **WHEN** as chaves e a autorização permanecem `off`
- **THEN** nenhuma campanha real é encaminhada ao novo fluxo
- **AND** o fluxo produtivo permanece o legado

#### Scenario: Componentes só sob elegibilidade

- **WHEN** o fluxo produtivo do lojista é renderizado sem elegibilidade server-side
- **THEN** os componentes do novo fluxo não são montados
- **AND** o lojista não acessa um caminho incompleto

## ADDED Requirements

### Requirement: Roteamento e UI usam decisão server-side

Roteamento e UI SHALL consultar a decisão da b1a: ambas as flags lidas validamente, somente a flag aplicável ligada junto à autorização independente vigente. A UI SHALL omitir seletores em `off`; o POST SHALL revalidar. Nesta change, autorização e flags SHALL permanecer `off`.

#### Scenario: Fluxo desligado

- **WHEN** autorização/flag aplicável não permite o estágio
- **THEN** payload legado segue legado; nenhum campo novo é enviado

#### Scenario: Elegibilidade revogada

- **WHEN** a decisão muda antes do POST
- **THEN** payload com campos exclusivos recebe erro seguro antes de reservar crédito

#### Scenario: Campanha criada mantém fluxo

- **WHEN** flag ou autorização muda após a criação
- **THEN** o download continua determinado pelo fluxo persistido da campanha

### Requirement: Estado persistido e feedback seguro

A UI SHALL refletir o **estado persistido** da campanha/lançamento com **feedback seguro**, sem expor motivo interno. A campanha concluída SHALL ser recuperável **ao retornar ao aplicativo** (persistência do resultado). A UI SHALL NOT controlar a execução nem prometer retomada automática de processamento interrompido. O **reenvio SHALL ser somente consulta**; a UI SHALL NOT oferecer **“Gerar novamente”** para a mesma operação.

#### Scenario: Estado exibido ao retornar

- **WHEN** o lojista retorna ao aplicativo após uma campanha concluída
- **THEN** a UI exibe o estado persistido real
- **AND** o resultado persistido é recuperado

#### Scenario: Resultado desconhecido sem “Gerar novamente”

- **WHEN** o resultado da geração é desconhecido
- **THEN** a UI exibe **“Não foi possível confirmar a conclusão desta geração”** com a referência de suporte
- **AND** a UI **não** oferece “Gerar novamente” para essa mesma operação
- **AND** o reenvio apenas consulta a operação

#### Scenario: Sem retomada automática

- **WHEN** a execução não concluiu (ex.: conexão caiu)
- **THEN** a UI não promete continuidade nem retomada automática

#### Scenario: Mensagem pública sanitizada

- **WHEN** a operação falha
- **THEN** a UI mostra `IMG-001` e a referência opaca
- **AND** não revela causa interna
