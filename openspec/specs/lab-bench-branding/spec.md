# Lab Bench Branding

> Synced from `fase-48-2-2-fundacao-bancada-geracao` (ADDED), `fase-48-2-3-fidelidade-experimental-bancada` (ADDED) and `fase-48-2-4-experimento-deterministico-oferta-1-1` (REMOVED/ADDED).

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

### Requirement: Branding persistido como contrato obrigatório da geração da bancada

A bancada SHALL usar o branding persistido como **contrato obrigatório** e fonte de verdade, sem reinterpretá-lo nem recriá-lo: a direção visual consolidada SHALL integrar o prompt compilado pela **seleção determinística por prioridade** definida nesta capacidade, e a referência canônica de identidade SHALL ser transportada ao modelo conforme `lab-bench-identity-transport`. A bancada SHALL NOT criar nova direção de marca, nova precedência de cores nem inventar identidade ausente.

#### Scenario: Direção visual integra o prompt sem recriar a marca

- **WHEN** o prompt é composto
- **THEN** a direção visual consolidada do branding integra o prompt compilado
- **AND** nenhuma nova direção de marca é criada

#### Scenario: Identidade canônica é transportada ao modelo

- **WHEN** a geração é executada
- **THEN** a referência canônica de identidade é transportada ao modelo conforme `identity_state`
- **AND** nenhuma identidade é inventada ou substituída silenciosamente

#### Scenario: Branding é registrado como evidência

- **WHEN** a geração é persistida
- **THEN** o snapshot do branding é registrado na evidência
- **AND** nenhuma URL assinada é persistida

### Requirement: Mapeamento mínimo do branding para o prompt

O bloco `[IDENTIDADE E DIREÇÃO VISUAL]` SHALL enviar a **menor representação** que preserve a direção visual da loja, por **seleção determinística por prioridade**: (a) **sempre** nome da loja (`storeName`) e cor da marca resolvida (`brandColor`); (b) **um único** campo de direção visual pela cadeia de fallback `campaignBrief` → `campaignGuidelines` → `visualStyle` → `visualTone` → `brandPersonality`, usando o primeiro não vazio e **nunca** enviando simultaneamente os cinco; (c) direção tipográfica (`typographyDirection`) explicitamente no bloco próprio. Os demais campos SHALL permanecer **apenas na evidência**. A seleção SHALL ser determinística e SHALL NOT usar deduplicação semântica/embedding nem IA.

#### Scenario: Nome e cor sempre presentes

- **WHEN** o bloco de identidade é composto
- **THEN** o nome da loja e a cor da marca resolvida são sempre enviados
- **AND** nenhuma nova direção de marca é criada

#### Scenario: Apenas um campo de direção visual é enviado

- **WHEN** a loja possui mais de um campo de direção visual
- **THEN** apenas o primeiro não vazio da cadeia `campaignBrief` → `campaignGuidelines` → `visualStyle` → `visualTone` → `brandPersonality` é enviado
- **AND** os cinco campos nunca são enviados simultaneamente

#### Scenario: Direção tipográfica é explícita

- **WHEN** a loja possui direção tipográfica
- **THEN** ela é enviada explicitamente no bloco `[DIREÇÃO TIPOGRÁFICA]`

#### Scenario: Seleção é determinística e não semântica

- **WHEN** os campos de branding são selecionados
- **THEN** a seleção usa prioridade determinística e não deduplicação semântica/embedding
- **AND** a mesma entrada produz a mesma seleção

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
