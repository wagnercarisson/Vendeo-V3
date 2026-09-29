# Lab Bench Form Parity

## ADDED Requirements

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

### Requirement: Preservação da imagem original (preserveImageContext)

A bancada SHALL reproduzir o campo "Preservar imagem original" do produtivo: exibido apenas quando a intenção não é oferta (Destaque/Exclusivo), enviado como `preserveImageContext` no payload de geração, refletido no bloco `[PRODUTO E IMAGENS DE REFERÊNCIA]` do prompt compilado (sem duplicação) e **limpo automaticamente** (resetado para falso) quando a intenção muda para Oferta, reproduzindo o comportamento produtivo.

#### Scenario: Campo disponível apenas fora da oferta

- **WHEN** a intenção é Destaque ou Exclusivo
- **THEN** a bancada oferece "Preservar imagem original"
- **AND** quando a intenção é Oferta o campo não é oferecido

#### Scenario: preserveImageContext é enviado e limpo

- **WHEN** o operador marca "Preservar imagem original"
- **THEN** `preserveImageContext` é enviado no payload de geração
- **AND** ao mudar a intenção para Oferta o campo é limpo (falso)

#### Scenario: preserveImageContext reflete no bloco canônico

- **WHEN** `preserveImageContext` é aplicável
- **THEN** ele é refletido no bloco `[PRODUTO E IMAGENS DE REFERÊNCIA]`
- **AND** não é duplicado em outro bloco

### Requirement: Selo promocional por intenção

A bancada SHALL oferecer o selo promocional com as mesmas opções por intenção do produtivo e SHALL exigir o selo quando a intenção for oferta, limpando um selo inválido ao mudar de intenção.

#### Scenario: Selo obrigatório na oferta

- **WHEN** a intenção é oferta e o selo está vazio
- **THEN** a bancada recusa a submissão como no produtivo

#### Scenario: Selo inválido é limpo

- **WHEN** a intenção muda e o selo atual não pertence à nova intenção
- **THEN** o selo é limpo

### Requirement: Validade da oferta fiel

A bancada SHALL reproduzir os modos de validade da oferta do produtivo (data final, intervalo, "somente hoje", "enquanto durarem os estoques" e texto livre), com as mesmas validações de data e a mesma geração de texto de exibição.

#### Scenario: Modos de validade disponíveis

- **WHEN** a intenção é oferta
- **THEN** os modos de validade do produtivo estão disponíveis
- **AND** as validações de data são aplicadas

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
