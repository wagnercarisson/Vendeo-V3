# Store Identity UI

> Delta spec for `fase-49-ativacao-orientacao-contextual-campos` (D3/D4/D5/D6/D7). O painel `/loja` ganha orientação contextual nos campos de identidade: dados fiscais separados do nome público, `Nome da Loja` com microcopy de identidade, `Tom de Voz` crítico com descrição contextual por opção, `Posicionamento` com label/hint/exemplo expansível e distinção entre posicionamento, descrição curta e slogan. Validação, auto-save, draft e drift permanecem inalterados.

## MODIFIED Requirements

### Requirement: Form fields

The system SHALL render the following form fields in the store identity form:

> **Delta F49 (D3/D4/D5/D6/D7):** os campos ganham rótulos, hints, descrições contextuais e ajuda expansível; os **dados fiscais** (CNPJ/Razão Social/Nome Fantasia) passam a ser apresentados como subseção de dados cadastrais/oficiais, separada do `Nome da Loja` (identidade pública). O `Tom de Voz` é explicitado como campo crítico para a Direção Visual (regra real `needs_tone_of_voice` preservada) e ganha descrição contextual por opção. `Posicionamento` e `Descrição Curta` são marcados como **recomendados**; `Slogan` permanece **opcional** ("se sua loja já utiliza um"), sem "Recomendado". Nenhum comportamento de validação, auto-save, draft ou drift muda. **Obrigatório aqui significa o marcador `*` + a validação controlada atual + `aria-required` — sem atributo nativo `required`.**

- **Nome da Loja**: required text input, 2–60 characters, com microcopy informando que é o **nome público** usado no Vendeo para identificar e assinar as campanhas
- **Dados fiscais** (subseção de dados cadastrais/oficiais — Receita Federal):
  - **CNPJ**: **optional** text input com máscara `XX.XXX.XXX/YYYY-ZZ` (visible ONLY in create mode; vazio = loja draft). Dispara consulta assíncrona via `GET /api/cnpj/lookup?cnpj={cnpj}` no evento onBlur (após validação local de dígitos). Exibe loading "Consultando dados cadastrais..." durante lookup.
  - **Razão Social**: optional text input (visible ONLY in create mode). Bloqueada e pré-preenchida com valor oficial após lookup bem-sucedido.
  - **Nome Fantasia**: optional text input (visible ONLY in create mode). Bloqueado e pré-preenchido com valor oficial após lookup bem-sucedido.
  - Atalhos preservados: "Usar nome fantasia como nome da loja" / "Usar razão social como nome da loja"
- **Segmento**: required dropdown select using the `STORE_SEGMENTS` constant from `src/lib/constants.ts` (13 options)
- **Logo da Loja**: optional upload area with drag-and-drop or click-to-upload. Preview circular after upload. Shows simple processing status ("Enviando...", "Processando...", "Pronto"). Technical variants are NOT exposed.
- **Cor da Marca**: optional color picker (`<input type="color">`) with companion hex text input. When a brand profile exists with detected colors, show suggested swatches below the picker. No conflict modal if chosen color differs from detected color.
- **Cidade**: optional text input
- **Estado**: optional dropdown select using `BRAZILIAN_STATES` from `src/lib/constants.ts`
- → **Subsegmento**: conditional dropdown with 3 modes (dropdown rico, dropdown travado, campo aberto)
- → **Tom de Voz**: dropdown/select (8 opções) — **crítico** para liberar a Direção Visual (`needs_tone_of_voice`), com hint explicando o que orienta e descrição contextual da opção selecionada
- → **Posicionamento**: campo recomendado, com label "Como você quer que sua loja seja percebida?" (termo secundário "Posicionamento da marca"), hint de público/proposta/diferencial e exemplo em ajuda expansível
- → **Descrição Curta**: textarea recomendada, com microcopy do que a loja vende/para quem/diferencial factual
- → **Slogan**: campo **opcional**, com microcopy de frase pública já adotada pela loja ("se sua loja já utiliza um"); **não** é marcado como recomendado

Additionally, the Logo area SHALL include:
- An explicit **Enviar logotipo** button below the drag-and-drop area (same functionality, just an explicit call to action)
- A **Não tenho logo** button (outline style, with Sparkles icon) that opens the visual signature generation and approval flow
- A **Continuar sem logo** discrete link (text-text-muted, no border, no background) below the buttons, with tooltip explaining the Vendeo will use only the store name with chosen colors

The segment dropdown options SHALL display human-readable labels (not kebab-case), but SHALL submit the kebab-case value.

#### Scenario: New fields rendered

- **WHEN** the form is displayed
- **THEN** Subsegmento, Tom de Voz, Posicionamento, Descrição Curta, and Slogan fields SHALL be present
- **AND** Tom de Voz, Posicionamento, Descrição Curta e Slogan carregam seus hints/microcopy de orientação (F49)
- **AND** Posicionamento e Descrição Curta são sinalizados como recomendados (não bloqueantes)
- **AND** Slogan aparece como opcional ("se sua loja já utiliza um"), **sem** o indicador "Recomendado"

#### Scenario: Required fields are rendered

- **WHEN** the form is displayed
- **THEN** the Nome da Loja input SHALL be present
- **AND** o Nome da Loja exibe microcopy de nome público
- **AND** the Segmento dropdown SHALL be present with all 13 segment options from `STORE_SEGMENTS`

#### Scenario: Dados fiscais separados da identidade pública

- **WHEN** o formulário está em modo criação
- **THEN** CNPJ, Razão Social e Nome Fantasia aparecem agrupados como dados fiscais/cadastrais
- **AND** o campo `Nome da Loja` aparece separado, com microcopy de identidade pública
- **AND** os atalhos "Usar nome fantasia/razão social como nome da loja" continuam disponíveis após lookup resolvido

#### Scenario: Tom de Voz orienta e reflete a regra real

- **WHEN** o campo Tom de Voz é renderizado
- **THEN** exibe hint sobre o que a escolha orienta (títulos, legendas, clima visual) sem substituir segmento/subsegmento
- **AND** ao selecionar uma das 8 opções, exibe a descrição contextual correspondente

#### Scenario: Posicionamento com label compreensível e exemplo expansível

- **WHEN** o campo de posicionamento é renderizado
- **THEN** o label principal é "Como você quer que sua loja seja percebida?" com "Posicionamento da marca" como termo secundário
- **AND** a ajuda expansível (colapsada por padrão) contém o exemplo `Somos uma loja de [categoria] para [público], reconhecida por [diferencial].`

## ADDED Requirements

### Requirement: Store field orientation (F49)

O sistema SHALL prover orientação contextual dos campos de loja conforme a capability `store-field-orientation`, usando o padrão de ajuda de campo de `contextual-field-help` (hint inline, descrição contextual de opção, ajuda expansível, associação `aria-describedby`). A orientação SHALL descrever apenas efeitos reais (identidade, direção visual, copy) e SHALL NOT alterar validação, auto-save, draft, drift ou o contrato de `POST/PATCH /api/store`.

#### Scenario: Orientação associada por aria-describedby

- **WHEN** os campos com orientação (Nome da Loja, Tom de Voz, Posicionamento, Descrição Curta, Slogan) são renderizados
- **THEN** cada hint/descrição está associado ao respectivo campo por `aria-describedby`
- **AND** nenhuma informação essencial depende apenas de tooltip

#### Scenario: Comportamento de onboarding preservado

- **WHEN** o usuário edita campos com orientação
- **THEN** auto-save, restauração de draft, detecção de drift e desbloqueio de abas permanecem com o comportamento atual
- **AND** nenhum campo novo de formulário ou validação nova é introduzido
