# Lab Bench Branding

> Synced from `fase-48-2-2-fundacao-bancada-geracao` (ADDED) and `fase-48-2-3-fidelidade-experimental-bancada` (ADDED).

## Purpose

Define o contrato local completo de branding da loja de teste da bancada, incluindo a direção tipográfica que hoje não chega ao snapshot de campanha, em modo somente leitura e sem alterar o pipeline produtivo.

## Requirements

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

Logo/assinatura e demais assets SHALL ser lidos de buckets locais por URL assinada de curta duração, geradas server-side por um **signer local restrito** (`createBenchBrandingSignedUrl`) que aceita **somente** os buckets `store-logos`, `store-brand-assets` e `visual-signatures`, com **allowlist estrita de bucket e path**, aplicado **somente após** a guarda de ambiente local. O cliente **nunca** informa bucket/path livremente — a API resolve o path do registro persistido da loja selecionada. A bancada SHALL NOT usar assets ou buckets de produção nem reutilizar o signer/bucket de artefatos do laboratório (`lab-artifacts`).

#### Scenario: Asset local é servido por URL assinada

- **WHEN** a bancada exibe o logo ou a assinatura visual
- **THEN** a URL é assinada, de curta duração e gerada server-side

#### Scenario: Bucket de produção não é usado

- **WHEN** um asset de branding é resolvido
- **THEN** nenhum bucket de produção é consultado
- **AND** nenhum path de produção é utilizado

#### Scenario: Bucket produtivo ou path livre é recusado

- **WHEN** um bucket fora da allowlist de branding ou um path informado livremente é usado
- **THEN** a assinatura é recusada
- **AND** nenhum asset de produção é servido

#### Scenario: Path traversal é recusado

- **WHEN** o path do asset contém traversal ou esquema de URL
- **THEN** a assinatura é recusada

#### Scenario: Loja fora do manifesto não tem asset assinado

- **WHEN** a loja não está no manifesto local
- **THEN** nenhum asset de branding é assinado

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

### Requirement: Resolução cromática preservada

O contrato local de branding SHALL expor o `brandColor` resolvido pela **precedência produtiva efetiva** a partir dos campos cromáticos persistidos importados (`stores.brand_color`, `brand_colors_chosen`, `safe_color_tokens`, `inferred_primary_color`, `source`). Para o **único perfil `status='synced'`** (qualquer `source`, incluindo `text_only`): (1) `brand_colors_chosen[0]` válido → (2) `safe_color_tokens.primary` válido → (3) `inferred_primary_color` válido **apenas quando `source === 'text_only'`** → (4) `stores.brand_color` → (5) fallback de segmento. **Ausência de perfil synced SHALL ser tratada como ausência de perfil** (sem fallback `without_logo`). A bancada SHALL NOT introduzir nova precedência nem alterar o contrato produtivo de cores.

#### Scenario: brandColor é exposto

- **WHEN** o branding da loja é carregado
- **THEN** o contrato expõe o `brandColor` resolvido
- **AND** o valor é idêntico ao resolvido pelo fluxo produtivo

#### Scenario: Campos cromáticos persistidos são usados

- **WHEN** o `brandColor` é resolvido
- **THEN** apenas os campos cromáticos persistidos são considerados
- **AND** nenhuma nova precedência é inventada

#### Scenario: Ausência de perfil synced preserva os fallbacks reais

- **WHEN** não existe perfil `status='synced'`
- **THEN** o `brandColor` usa `stores.brand_color` e, na ausência, o fallback de segmento
- **AND** nenhum perfil não sincronizado é usado como baseline

### Requirement: Tipografia no briefing experimental

O contrato local de branding SHALL fornecer `typography_direction` ao briefing experimental da bancada, mantendo o carregamento do branding somente leitura e sem alterar `BrandProfileSnapshot`, `resolveStoreIdentity` ou a montagem de prompt produtiva.

#### Scenario: Tipografia alimenta o briefing

- **WHEN** o briefing experimental é montado
- **THEN** a direção tipográfica do contrato local é incluída
- **AND** o pipeline produtivo permanece intocado

### Requirement: Assets importados disponíveis localmente

O contrato local de branding SHALL ler os assets de identidade dos buckets locais (`store-logos`, `store-brand-assets`, `visual-signatures`) materializados pelo comando de importação, permanecendo o runtime da bancada **somente leitura** nesses buckets.

#### Scenario: Assets importados são exibidos

- **WHEN** a loja importada possui assets locais
- **THEN** a bancada os exibe por URL assinada de curta duração
- **AND** o runtime não grava nos buckets de branding
