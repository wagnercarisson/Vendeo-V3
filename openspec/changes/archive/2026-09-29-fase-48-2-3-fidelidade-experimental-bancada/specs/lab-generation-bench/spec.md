# Lab Generation Bench — delta (F48.2.3)

## MODIFIED Requirements

### Requirement: Seleção somente de lojas de teste, via allowlist/manifesto local

A bancada SHALL permitir selecionar **somente lojas de teste** identificadas por uma **allowlist/manifesto local** da bancada. Uma loja SHALL ser elegível somente se estiver no manifesto **e** existir no Supabase local; a leitura é somente leitura, sem sincronizar, importar ou ler lojas de produção durante o runtime, e sem depender de um campo produtivo novo. A materialização local da identidade SHALL ocorrer exclusivamente pelo comando explícito de importação (`lab-bench-store-import`), nunca durante o runtime da bancada.

#### Scenario: Apenas lojas do manifesto são listadas

- **WHEN** o administrador abre a seleção de loja
- **THEN** apenas as lojas presentes no manifesto local e materializadas no Supabase local são listadas
- **AND** lojas fora do manifesto não são listadas

#### Scenario: Loja fora do manifesto é recusada

- **WHEN** a seleção aponta para uma loja ausente do manifesto local
- **THEN** a operação é recusada
- **AND** nenhuma geração é iniciada

#### Scenario: Nenhuma loja remota é lida no runtime

- **WHEN** a seleção de loja é usada
- **THEN** nenhuma consulta a banco, storage ou API remota é executada
- **AND** nenhum asset aponta para bucket de produção

#### Scenario: Loja fora do manifesto é recusada em qualquer entrada

- **WHEN** um `storeId` fora do manifesto local é enviado a qualquer ponto de entrada (leitura de branding, estimativa ou execução)
- **THEN** a operação é recusada antes de qualquer leitura de branding, tabela de loja ou storage
- **AND** nenhuma geração é iniciada

#### Scenario: Identidade importada é usada no runtime

- **WHEN** uma loja de teste foi importada pelo comando explícito
- **THEN** a bancada usa a identidade materializada localmente
- **AND** nenhuma conexão à origem remota é aberta durante o runtime

### Requirement: Snapshot de campanha compatível com os contratos reais

A bancada SHALL montar um snapshot de campanha compatível com os contratos reais de produto/oferta, reutilizando schemas, tipos e mappers de produção quando isso não introduzir efeitos laterais, e SHALL registrar explicitamente a **intenção resolvida** (inclusive quando inferida a partir dos preços). O snapshot SHALL refletir os campos e comportamentos do formulário produtivo (preços de/por, selo, validade, aviso ilustrativo e informações obrigatórias na arte) por meio da paridade definida em `lab-bench-form-parity`. A bancada SHALL NOT chamar serviços de crédito, entrega, correção ou publicação.

#### Scenario: Snapshot de produto/oferta é montado

- **WHEN** o administrador preenche o formulário mínimo de produto/oferta
- **THEN** um snapshot de campanha compatível é produzido
- **AND** a intenção resolvida é registrada explicitamente

#### Scenario: Snapshot reflete a paridade do formulário

- **WHEN** os campos do formulário produtivo são preenchidos na bancada
- **THEN** o snapshot reflete preços, selo, validade, aviso e informações obrigatórias
- **AND** os mesmos contratos e mappers são usados quando não houver efeito lateral

#### Scenario: Nenhum serviço produtivo é chamado

- **WHEN** o snapshot é montado
- **THEN** nenhum serviço de crédito, entrega, correção ou publicação é invocado

## ADDED Requirements

### Requirement: Geração exige preflight aprovado

A bancada SHALL exigir um **preflight aprovado** (`lab-bench-prompt-preflight`) antes de qualquer geração e SHALL enviar exatamente o `prompt_sent` aprovado, registrando na evidência o briefing estruturado, os blocos, o prompt compilado e o prompt final aprovado, sem criar campanhas produtivas, runs produtivos ou eventos.

#### Scenario: Geração usa o prompt aprovado

- **WHEN** uma geração é executada
- **THEN** ela exige o preflight aprovado
- **AND** o `prompt_sent` corresponde exatamente ao prompt final aprovado pelo operador
- **AND** nenhuma campanha ou run produtivo é criado

### Requirement: Identidade experimental sem efeitos produtivos

A geração da bancada SHALL usar a identidade importada materializada localmente e SHALL permanecer com uma única geração ativa, confirmação explícita e ausência de créditos, sem qualquer escrita em tabelas produtivas.

#### Scenario: Identidade importada alimenta a geração

- **WHEN** a geração é executada para uma loja importada
- **THEN** a identidade local é usada
- **AND** nenhum crédito é consumido e nenhuma tabela produtiva é escrita
