# Lab Bench Form Parity

> Synced from `fase-48-2-3-fidelidade-experimental-bancada` (ADDED) and `fase-48-2-6-validacao-experimental-produto-intencoes-1-1` (MODIFIED).

## Purpose

Define a paridade programática do formulário produtivo de campanha na bancada — campos, limites, normalizações, comportamento de preço de/por, intenção, direção de fundo, selo, validade e avisos — com testes explícitos de paridade e sem efeitos produtivos.

## Requirements

### Requirement: Paridade dos campos do formulário produtivo

A bancada SHALL oferecer os mesmos campos relevantes do formulário produtivo de campanha: nome do produto, descrição opcional, imagem principal obrigatória, até três imagens adicionais, preço anterior/original, preço de venda/final, selo promocional, intenção da campanha, preservação da imagem original (Destaque/Exclusivo), validade da oferta, aviso de "Imagem meramente ilustrativa" e informações obrigatórias na arte. A interface visual pode permanecer específica da bancada e desktop-only.

#### Scenario: Campos relevantes estão disponíveis

- **WHEN** o administrador preenche a bancada
- **THEN** os campos relevantes do formulário produtivo estão disponíveis
- **AND** a interface permanece específica da bancada e desktop-only

### Requirement: Limites e normalizações fiéis

A bancada SHALL aplicar os mesmos limites e normalizações do formulário produtivo: nome do produto e descrição com os mesmos limites de caracteres; normalização monetária idêntica (entrada por dígitos convertida em centavos); imagem principal obrigatória e até três imagens adicionais com os mesmos tipos e tamanho; e informações obrigatórias na arte com o mesmo limite.

#### Scenario: Normalização monetária é idêntica

- **WHEN** o operador digita um preço
- **THEN** a normalização para centavos é idêntica à do formulário produtivo

#### Scenario: Limites de texto são respeitados

- **WHEN** o operador informa nome ou descrição
- **THEN** os limites de caracteres são os mesmos do formulário produtivo

#### Scenario: Imagens respeitam contagem e formato

- **WHEN** o operador envia imagens
- **THEN** uma imagem principal é obrigatória e até três adicionais são aceitas
- **AND** tipos e tamanho seguem as mesmas regras do produtivo

### Requirement: Comportamento de preço "de/por"

A bancada SHALL reproduzir o comportamento de preço "de/por" do produtivo, incluindo a regra de que o preço de venda deve ser menor que o preço original quando ambos estão presentes, e os estados condicionais de exibição e validação associados.

#### Scenario: Preço de venda deve ser menor

- **WHEN** o preço original e o preço de venda são informados e o de venda não é menor
- **THEN** a bancada sinaliza a inconsistência como no produtivo

### Requirement: Intenção e derivação fiéis

A bancada SHALL reproduzir a intenção da campanha (`offer`/`spotlight`/`exclusive`), as regras de derivação a partir dos preços, as opções disponíveis por estado e a seleção manual, de forma idêntica ao formulário produtivo.

#### Scenario: Intenção é derivada dos preços

- **WHEN** os preços são informados
- **THEN** a intenção derivada corresponde à regra produtiva (ambos os preços → oferta; apenas venda → destaque; nenhum → exclusivo)

#### Scenario: Opções disponíveis seguem o estado

- **WHEN** a intenção é derivada
- **THEN** as opções selecionáveis correspondem às do produtivo

### Requirement: Direção de fundo explícita nas três intenções

A bancada SHALL oferecer, em Oferta, Destaque e Exclusivo, uma seleção única e obrigatória de direção de fundo — `Fundo de estúdio` (`studio`), `Cenário ambientado` (`ambient`) ou `Manter cenário original` (`original`) — sem opção aplicada por padrão. A seleção SHALL integrar o briefing/snapshot, o prompt e a evidência revalidada. O checkbox legado `preserveImageContext` SHALL NOT permanecer como escolha independente; eventual flag booleana interna SHALL derivar exclusivamente de `backgroundDirection === original`, sem gerar segunda instrução no prompt. `Manter cenário original` SHALL ser oferecida somente quando houver exatamente uma referência de imagem de produto; a imagem de identidade da loja SHALL NOT entrar nessa contagem. Ao mudar a quantidade de imagens de produto de modo a invalidar `original`, a UI SHALL limpar a seleção e exigir nova escolha explícita; a API SHALL rejeitar a seleção inválida antes de persistência/CAS/provider.

#### Scenario: Seleção única disponível nas três intenções

- **WHEN** a intenção é Oferta, Destaque ou Exclusivo
- **THEN** a bancada oferece seleção única entre `Fundo de estúdio`, `Cenário ambientado` e `Manter cenário original`
- **AND** nenhuma opção é aplicada por padrão
- **AND** a escolha integra o snapshot e o prompt

#### Scenario: Original exige exatamente uma imagem de produto

- **WHEN** `Manter cenário original` é selecionado
- **THEN** existe exatamente uma referência de imagem de produto
- **AND** a imagem de identidade da loja não entra na contagem
- **AND** a opção não é oferecida para 0 ou 2+ referências

#### Scenario: Seleção invalidada exige nova escolha

- **WHEN** a quantidade de imagens de produto deixa de ser exatamente uma e `original` estava selecionado
- **THEN** a UI limpa a seleção e exige nova escolha explícita
- **AND** a API rejeita a seleção inválida antes de persistência/CAS/provider

### Requirement: Selo promocional por intenção

A bancada SHALL oferecer o selo promocional com as mesmas opções por intenção do produtivo e SHALL exigir o selo quando a intenção for oferta, limpando um selo inválido ao mudar de intenção.

#### Scenario: Selo obrigatório na oferta

- **WHEN** a intenção é oferta e o selo está vazio
- **THEN** a bancada recusa a submissão como no produtivo

#### Scenario: Selo inválido é limpo

- **WHEN** a intenção muda e o selo atual não pertence à nova intenção
- **THEN** o selo é limpo

### Requirement: Validade da oferta fiel

A bancada SHALL reproduzir os modos de validade e validações de data existentes, permitindo validade exclusivamente na intenção Oferta. Destaque e Exclusivo SHALL rejeitar validade no formulário e backend. Se houver validade informada ao trocar para intenção incompatível, SHALL bloquear composição e execução até remoção/regularização explícita; SHALL NOT descartar o valor silenciosamente. Formatos e validações existentes de validade permanecem inalterados. Produção permanece intocada.

#### Scenario: Modos de validade disponíveis em Oferta

- **WHEN** intenção é Oferta
- **THEN** modos atuais do produtivo estão disponíveis
- **AND** validações de data atuais são aplicadas

#### Scenario: Validade não é aceita em Destaque ou Exclusivo

- **WHEN** intenção é Destaque ou Exclusivo e payload contém validade
- **THEN** UI/backend recusam composição e execução
- **AND** backend recusa antes de persistir execução ou chamar provider

#### Scenario: Troca de intenção preserva validade até regularização

- **WHEN** existe validade e usuário escolhe Destaque ou Exclusivo
- **THEN** composição e execução ficam bloqueadas
- **AND** valor não é descartado silenciosamente
- **AND** usuário deve remover/regularizar explicitamente a validade

### Requirement: Avisos e informações obrigatórias

A bancada SHALL reproduzir o aviso de "Imagem meramente ilustrativa" e o campo de informações obrigatórias na arte, com a mesma concatenação e semântica do produtivo.

#### Scenario: Aviso ilustrativo e texto obrigatório

- **WHEN** o operador configura os avisos
- **THEN** o aviso ilustrativo e as informações obrigatórias são refletidos no snapshot como no produtivo

### Requirement: Sem efeitos produtivos

A bancada SHALL NOT consumir créditos, criar campanhas produtivas, registrar eventos produtivos, aplicar regras de cobrança do SaaS ou escrever em tabelas produtivas ao reproduzir o formulário.

#### Scenario: Nenhum efeito produtivo

- **WHEN** o formulário da bancada é usado
- **THEN** nenhum crédito é consumido e nenhuma campanha produtiva é criada
- **AND** nenhuma tabela produtiva é escrita

### Requirement: Reuso e testes de paridade

A bancada SHALL reutilizar funções puras e contratos compartilhados quando isso não introduzir risco de regressão ou acoplamento; quando a separação for preservada, o sistema SHALL incluir **testes explícitos de paridade** que comprovem equivalência de comportamento com o produtivo. O formulário produtivo e o pipeline de campanha SHALL permanecer intocados.

#### Scenario: Paridade é verificada

- **WHEN** a suíte de testes é executada
- **THEN** testes de paridade comprovam o comportamento equivalente ao produtivo
- **AND** o formulário produtivo e o pipeline permanecem inalterados
