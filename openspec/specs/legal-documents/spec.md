> **Propósito**: Drafts dos 3 documentos legais (Termos de Uso, Política de Privacidade, Uso Aceitável) + páginas públicas versionadas.

## Requirements

### Requirement: Legal document drafts

The system SHALL maintain three consolidated pending documents, outside `public/` and without catalog entries until authorized post-PJ publication: `legal-consolidated-pending/terms-of-service-v1-5.md`, `privacy-policy-v1-4.md`, and `acceptable-use-v1-2.md`. They SHALL combine deltas with unchanged prior clauses and be diffed against prior versions.

Each document SHALL include the following disclaimer:
> "Este documento é um draft preparado pelo time do Vendeo para revisão jurídica. Não constitui aconselhamento legal. Consulte um advogado antes de publicar."

#### Scenario: Três documentos consolidados pendentes existem

- **WHEN** revisando `legal-consolidated-pending/`
- **THEN** os três documentos v1.5/v1.4/v1.2 consolidados existem fora de `public/` e não estão publicados

#### Scenario: Cada documento pendente contém a ressalva legal

- **WHEN** reading any draft document
- **THEN** the document SHALL contain the ressalva about pending legal review

### Requirement: Public legal pages

The system SHALL render three public-facing legal pages outside the `(app)` auth-gated layout:

| Route | Document | Source |
|-------|----------|--------|
| `/termos` | Termos de Uso | `src/app/(marketing)/termos/page.tsx` |
| `/privacidade` | Política de Privacidade | `src/app/(marketing)/privacidade/page.tsx` |
| `/uso-aceitavel` | Política de Uso Aceitável | `src/app/(marketing)/uso-aceitavel/page.tsx` |

Each page SHALL:
- Be publicly accessible (no auth required)
- Render the full document content formatted for readability
- Display the current version number and effective date
- Include the legal disclaimer notice

### Requirement: Conteúdo legal consolidado pendente

Os Termos v1.5 SHALL remover promessa de bônus mensais e explicar demonstração, validade de 168h, expiração, consumo, suporte, ausência de cobrança automática, saldos antigos e graça de 24h. Privacidade v1.4 SHALL separar comunicações operacionais de marketing, descrever eventos de produto em linguagem natural e usar ciência por usuário. AUP v1.2 SHALL substituir freemium por demonstração e proibir burla e multiplicação de benefícios.

#### Scenario: Termos removem bônus mensal

- **WHEN** revisando Termos v1.5
- **THEN** não há promessa de créditos mensais automáticos

#### Scenario: Termos explicam validade e reaceite

- **WHEN** v1.5 vigora
- **THEN** descreve 168h, expiração, consumo, ausência de cobrança e preserva histórico/downloads enquanto exige reaceite para geração

#### Scenario: Fornecedor sem placeholder

- **WHEN** v1.5 for publicada
- **THEN** identificação do fornecedor está definida sem placeholders

#### Scenario: Privacidade separa comunicação e eventos

- **WHEN** revisando Privacidade v1.4
- **THEN** distingue email operacional de marketing e descreve eventos sem nomes internos, com base legal

#### Scenario: Controlador e contato são consistentes

- **WHEN** revisando a seção de controlador
- **THEN** ela identifica a mesma entidade dos Termos

#### Scenario: AUP alinha terminologia

- **WHEN** revisando AUP v1.2
- **THEN** proibições referem-se à Demonstração Gratuita e multiplicação de benefícios

### Requirement: Cobertura de beta, retenção e conformidade

Os três documentos SHALL cobrir maioridade/representação, WhatsApp opcional, imagens de terceiros/menores, papéis e fornecedores, transferências, retenção, encerramento em 30 dias, direitos via suporte, reconsideração e incidentes. Sem convite antes da PJ e teto de participantes são gates operacionais fora dos documentos.

#### Scenario: Maioridade e representação

- **WHEN** usuário aceita os Termos
- **THEN** declara maioridade e autoridade para representar CNPJ/MEI, sem coleta de data de nascimento

#### Scenario: Imagens e fornecedores

- **WHEN** documentos são revisados
- **THEN** cobrem direitos/consentimentos de imagens, proteção de menores, proibições de conteúdo ilegal e inventário real de fornecedores/transferências

#### Scenario: Gates operacionais fora dos documentos

- **WHEN** Termos v1.5 são revisados
- **THEN** ausência de convite antes da PJ e teto de participantes não aparecem como cláusulas permanentes

#### Scenario: Retenção e direitos

- **WHEN** Termos/Privacidade são revisados
- **THEN** descrevem conta ativa, janela de 30 dias, exclusão/anonimização posterior e pedidos via suporte com protocolo sem autosserviço no beta

### Requirement: Validação jurídica formal

As três minutas SHALL ser submetidas à validação jurídica formal antes do corte, com resultado registrado.

#### Scenario: Validação registrada

- **WHEN** F50 vai ao corte
- **THEN** as três minutas foram validadas e o resultado está registrado

#### Scenario: Public legal pages are accessible

- **WHEN** an unauthenticated user accesses `/termos`, `/privacidade`, or `/uso-aceitavel`
- **THEN** the page SHALL render the full document content

#### Scenario: Legal pages are free from middleware auth

- **WHEN** middleware processes requests to `/termos`, `/privacidade`, `/uso-aceitavel`
- **THEN** these routes SHALL pass without auth requirement
