# Legal Documents

> Delta spec para `fase-50-demonstracao-gratuita-e-validade-dos-creditos` (D13). Conteúdo dos **três** documentos: Termos de Uso v1.5, Política de Privacidade v1.4 e Política de Uso Aceitável v1.2. As minutas de **alteração (delta)** vivem em `legal-drafts/`; os documentos **consolidados** (delta + cláusulas inalteradas) são montados e comparados com as versões anteriores na execução.

## MODIFIED Requirements

### Requirement: Legal document drafts

O sistema SHALL incluir `public/docs/legal/terms-of-service-v1-5.md`, `public/docs/legal/privacy-policy-v1-4.md` e `public/docs/legal/acceptable-use-v1-2.md` (e as entradas correspondentes no catálogo `document-content.ts`), **consolidando** as minutas de alteração com as cláusulas inalteradas da versão anterior e **comparando (diff)** com a versão anterior.

#### Scenario: Três documentos consolidados existem

- **WHEN** revisando `public/docs/legal/`
- **THEN** `terms-of-service-v1-5.md`, `privacy-policy-v1-4.md` e `acceptable-use-v1-2.md` existem como documentos consolidados (não apenas delta)

### Requirement: Termos de Uso v1.5

O texto SHALL **remover** a promessa de bônus mensais e explicar: redefinição de Crédito (sem valor financeiro, intransferível), Crédito de Demonstração/Bônus/Comprado, Saldo Disponível, concessão, elegibilidade, irrepetibilidade por raiz, validade (168h), expiração, ordem de consumo, acesso após a demonstração, suporte, ausência de cobrança automática, preservação dos saldos antigos e a janela de graça de 24h no estorno. O texto SHALL usar **"operações que consomem créditos"** (não "operações tarifadas"), evitando conotação de cobrança.

#### Scenario: v1.5 remove bônus mensal

- **WHEN** revisando `terms-of-service-v1-5.md`
- **THEN** não há promessa de créditos mensais automáticos

#### Scenario: v1.5 explica a demonstração e a validade

- **WHEN** revisando `terms-of-service-v1-5.md`
- **THEN** descreve concessão, validade de 7 dias (168h), expiração, ordem de consumo, ausência de cobrança automática e preservação dos saldos antigos

#### Scenario: v1.5 exige reaceite sem bloquear histórico

- **WHEN** a v1.5 vigora
- **THEN** o texto exige novo aceite antes do próximo acesso às funcionalidades de geração, sem impedir acesso a histórico/campanhas/downloads

#### Scenario: Identificação do fornecedor sem placeholder

- **WHEN** a v1.5 é publicada
- **THEN** a cláusula de identificação do fornecedor (responsável pela oferta, endereço) NÃO contém placeholders (definida com advogado antes do corte)

### Requirement: Política de Privacidade v1.4

O texto SHALL acrescentar cláusulas que esclarecem: (a) o uso do email cadastrado para **comunicações operacionais** (concessão, prazo, esgotamento, expiração, segurança, alterações contratuais, respostas de suporte), distintas do consentimento de marketing; e (b) a **coleta, finalidade e base legal** dos **eventos de produto** (concessão, primeira geração, esgotamento, expiração, solicitação de suporte), **em linguagem natural, sem nomes internos** (`demo_granted` etc.), com base legal documentada (LGPD). A ciência da v1.4 SHALL ser por **usuário** via `privacy_acknowledgements`, usando o termo **"ciência"** (não "aceite"), salvo orientação jurídica diferente. A seção "Controlador e Contato" SHALL identificar (ou referenciar inequivocamente) a mesma identidade do fornecedor da cláusula 12.4 dos Termos.

#### Scenario: v1.4 distingue email operacional de marketing

- **WHEN** revisando `privacy-policy-v1-4.md`
- **THEN** há cláusula que separa comunicações operacionais do consentimento comercial e indica base legal aplicável

#### Scenario: v1.4 descreve os eventos de produto sem nomes internos

- **WHEN** revisando `privacy-policy-v1-4.md`
- **THEN** há cláusula descrevendo coleta, finalidade e base legal dos eventos de produto em linguagem natural (sem `demo_granted`/`first_generation`/etc.)

#### Scenario: Controlador e Contato identifica o fornecedor

- **WHEN** revisando `privacy-policy-v1-4.md`
- **THEN** a seção "Controlador e Contato" identifica (ou referencia) a mesma identidade da cláusula 12.4 dos Termos

### Requirement: Política de Uso Aceitável v1.2

O texto SHALL substituir a terminologia "freemium" por "demonstração" e alinhar as proibições de burla de elegibilidade/validade/expiração e de criação de múltiplas contas/CNPJs para multiplicar benefícios.

#### Scenario: v1.2 alinha terminologia e proibições

- **WHEN** revisando `acceptable-use-v1-2.md`
- **THEN** as cláusulas de burla referem-se à Demonstração Gratuita e à multiplicação de benefícios

## ADDED Requirements

### Requirement: Cobertura de operação e conformidade do beta

Os três documentos SHALL cobrir, em conjunto: **maioridade e representação empresarial** (maiores de 18 anos autorizados a representar CNPJ/MEI, declaração no aceite, sem coleta de data de nascimento); **WhatsApp opcional** (finalidade, não marketing, descarte); **imagens de terceiros e menores** (direitos/consentimentos, melhor interesse do menor, proibição de conteúdo ilegal/abusivo/exploratório e de dados sensíveis desnecessários); **papéis de controlador/operador por finalidade**; **fornecedores e transferências internacionais** (inventário real: Supabase, Vercel, OpenAI, Google OAuth, Cloudflare, Resend; Gemini condicional/restrito ao laboratório); **retenção enquanto a conta está ativa**; **encerramento com janela de 30 dias**; **solicitações de titulares via suporte**; **reconsideração de elegibilidade**; e **incidentes e comunicações operacionais**. **"Sem convite antes da PJ" e o teto de participantes são gates operacionais** — ficam **fora** dos documentos (salvo se o advogado recomendar a divulgação).

#### Scenario: Maioridade e representação no aceite

- **WHEN** revisando os Termos v1.5
- **THEN** há declaração de maioridade/autoridade no aceite, sem exigência de coleta de data de nascimento

#### Scenario: Gates operacionais fora dos documentos

- **WHEN** revisando os Termos v1.5
- **THEN** "sem convite antes da PJ" e o teto de participantes **não** constam como cláusula permanente (apenas no rollout/runbook)

#### Scenario: Imagens de menores e proibições

- **WHEN** revisando os Termos/AUP
- **THEN** a política de imagens de terceiros/menores e as proibições de conteúdo ilegal/abusivo/exploratório estão formalizadas

#### Scenario: Inventário de fornecedores e transferências

- **WHEN** revisando a Privacidade v1.4
- **THEN** há inventário dos fornecedores reais e tratamento das transferências internacionais; Gemini permanece restrita ao laboratório com dados controlados

### Requirement: Retenção, encerramento e direitos

Os documentos SHALL formalizar: conta permanece ativa sem saldo/atividade; encerramento com janela de 30 dias e exclusão/anonimização posterior (com retenção legal mínima segregada); pedidos de titulares via suporte com protocolo; e não-promessa de autosserviço completo durante o beta.

#### Scenario: Encerramento e janela de 30 dias

- **WHEN** revisando os Termos v1.5/Privacidade v1.4
- **THEN** descrevem a janela de 30 dias e a exclusão/anonimização subsequente

#### Scenario: Direitos via suporte

- **WHEN** revisando a Privacidade v1.4
- **THEN** descreve o atendimento de pedidos de titulares via suporte com protocolo, sem autosserviço no beta

### Requirement: Validação jurídica formal

O sistema SHALL submeter as três minutas à validação jurídica formal antes do corte e registrar o resultado.

#### Scenario: Validação registrada

- **WHEN** a F50 vai ao corte
- **THEN** as três minutas foram validadas juridicamente e o resultado está registrado
