# Lab Bench Branding

## ADDED Requirements

### Requirement: Contrato local completo do branding da loja

A bancada SHALL carregar e exibir o branding persistido da loja de teste a partir de dados materializados localmente, cobrindo: nome, segmento, posicionamento, tom de voz, slogan, logo ou assinatura visual, paleta, safe color tokens, **direção tipográfica**, estilo visual, tom visual, personalidade, diretrizes e briefing de marca. A direção tipográfica SHALL estar presente no contrato da bancada mesmo que não chegue ao snapshot atual de campanha.

#### Scenario: Branding completo é exibido

- **WHEN** o administrador seleciona uma loja de teste com branding sincronizado
- **THEN** a bancada exibe todos os campos do branding disponível
- **AND** a direção tipográfica está presente no contrato exibido

#### Scenario: Tipografia é exposta a partir da fonte persistida

- **WHEN** a loja possui `store_brand_profiles.typography_direction`
- **THEN** o contrato da bancada expõe esse valor
- **AND** o valor é lido diretamente da fonte persistida, não do snapshot de campanha

### Requirement: Leitura somente leitura sem alterar o pipeline produtivo

O carregamento do branding SHALL ser **somente leitura** e SHALL NOT alterar `BrandProfileSnapshot`, `resolveStoreIdentity`, a montagem do prompt do diretor nem qualquer comportamento do pipeline produtivo de campanha.

#### Scenario: Nenhuma escrita no branding

- **WHEN** o branding é carregado para a bancada
- **THEN** nenhuma linha de `stores`, `store_brand_profiles`, `store_brand_assets` ou `store_visual_signatures` é criada ou alterada

#### Scenario: Pipeline produtivo permanece intocado

- **WHEN** o contrato de branding da bancada é adicionado
- **THEN** os testes do pipeline de campanha permanecem verdes
- **AND** o snapshot de campanha e a montagem de prompt de produção não mudam

### Requirement: Assets locais por URL assinada

Logo/assinatura e demais assets SHALL ser lidos de buckets locais por URL assinada de curta duração, geradas server-side. A bancada SHALL NOT usar assets ou buckets de produção.

#### Scenario: Asset local é servido por URL assinada

- **WHEN** a bancada exibe o logo ou a assinatura visual
- **THEN** a URL é assinada, de curta duração e gerada server-side

#### Scenario: Bucket de produção não é usado

- **WHEN** um asset de branding é resolvido
- **THEN** nenhum bucket de produção é consultado
- **AND** nenhum path de produção é utilizado

### Requirement: Branding apenas exibido e registrado, sem uso automático na geração

Nesta fase a bancada SHALL carregar, **exibir e registrar** o branding, mas SHALL NOT usá-lo automaticamente na geração: SHALL NOT injetar o branding no texto do prompt e SHALL NOT enviar automaticamente logo/assinatura ao modelo. Somente as imagens de produto enviadas por upload são enviadas ao modelo. O uso automático do branding na geração pertence à F48.2.3.

#### Scenario: Prompt é manual

- **WHEN** uma geração é executada
- **THEN** o texto enviado é o prompt manual informado pelo administrador
- **AND** o branding não é concatenado automaticamente ao prompt

#### Scenario: Logo/assinatura não é enviado ao modelo

- **WHEN** uma geração é executada
- **THEN** o logo/assinatura do branding não é enviado automaticamente como referência ao modelo
- **AND** apenas as imagens de produto enviadas por upload são enviadas

#### Scenario: Branding é registrado como evidência

- **WHEN** a geração é persistida
- **THEN** o snapshot do branding exibido é registrado na evidência
