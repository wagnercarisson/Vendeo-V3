# Prompt Templates by Intent

> Added by `fase-31-2-diretores-por-intencao`.

## Purpose

Define os 6 templates de prompt (offer/spotlight/exclusive × image-director/copy-director), suas variáveis, regras de seleção por `campaignIntent`, e comportamento em caso de template ausente.

## ADDED Requirements

### Requirement: 6 prompt templates por intent

O sistema SHALL prover 6 arquivos de prompt na raiz `prompts/`:

| Arquivo | Base | Conteúdo |
|---------|------|----------|
| `prompts/campaign-image-director-offer.md` | Cópia do `campaign-image-director.md` atual | Promocional, DE/POR, urgência, badge obrigatório |
| `prompts/campaign-image-director-spotlight.md` | Novo | Vitrine, sem urgência, preço único se houver, badge opcional |
| `prompts/campaign-image-director-exclusive.md` | Novo | Sem preço, valor percebido, premium, badge opcional |
| `prompts/campaign-copy-director-offer.md` | Baseado no atual, trocando `{{offer}}` por `{{commercialFrame}}` | Frame de desconto, urgência, escassez |
| `prompts/campaign-copy-director-spotlight.md` | Novo | Novidade/destaque, benefício, sem urgência |
| `prompts/campaign-copy-director-exclusive.md` | Novo | Exclusividade, valor percebido, sem preço/desconto |

O arquivo `campaign-image-director.md` original permanece como referência, NÃO como fallback no fluxo ativo.

#### Scenario: offer prompt existe e é cópia fiel

- **WHEN** o arquivo `campaign-image-director-offer.md` é carregado
- **THEN** seu conteúdo é idêntico ao `campaign-image-director.md` original (antes da F31.2)

#### Scenario: spotlight prompt é novo

- **WHEN** o arquivo `campaign-image-director-spotlight.md` é inspecionado
- **THEN** contém instruções de vitrine e desejo, sem urgência promocional
- **AND** o preço é tratado como opcional na exibição
- **AND** o badge é tratado como opcional

#### Scenario: exclusive prompt é novo e sem preço

- **WHEN** o arquivo `campaign-image-director-exclusive.md` é inspecionado
- **THEN** NÃO contém referência a preço ou desconto
- **AND** o badge é tratado como opcional
- **AND** o tom é de exclusividade e valor percebido

### Requirement: Prompts de copy usam `{{commercialFrame}}`

Os 3 prompts de copy director SHALL usar `{{commercialFrame}}` no lugar de `{{offer}}`. As demais variáveis permanecem: `{{productName}}`, `{{description}}`, `{{storeName}}`, `{{segment}}`, `{{toneOfVoice}}`, `{{positioning}}`, `{{shortDescription}}`, `{{slogan}}`, `{{brandPersonality}}`, `{{campaignGuidelines}}`.

#### Scenario: offer copy prompt usa commercialFrame

- **WHEN** `campaign-copy-director-offer.md` é carregado
- **THEN** contém `{{commercialFrame}}` no lugar de `{{offer}}`
- **AND** o conteúdo é funcionalmente equivalente ao `campaign-copy-director.md` original

### Requirement: Seleção de prompt por campaignIntent em assemblePrompt

O sistema SHALL selecionar o template de diretor de imagem em `ImageGenerationService.assemblePrompt()` usando `campaign-image-director-${campaignIntent}`.

Se o prompt não existir para uma intent reconhecida (offer, spotlight, exclusive), o sistema SHALL falhar no preflight como `invalid_prompt`. Não há fallback para o prompt antigo.

Se `campaignIntent` estiver ausente (impossível após parse — schema aplica default "offer"), o comportamento é o mesmo da intent "offer".

#### Scenario: offer carrega campaign-image-director-offer

- **WHEN** `assemblePrompt()` é chamado com `campaignIntent === "offer"`
- **THEN** carrega `campaign-image-director-offer.md`

#### Scenario: spotlight carrega campaign-image-director-spotlight

- **WHEN** `assemblePrompt()` é chamado com `campaignIntent === "spotlight"`
- **THEN** carrega `campaign-image-director-spotlight.md`

#### Scenario: exclusive carrega campaign-image-director-exclusive

- **WHEN** `assemblePrompt()` é chamado com `campaignIntent === "exclusive"`
- **THEN** carrega `campaign-image-director-exclusive.md`

#### Scenario: prompt ausente para intent válida falha no preflight

- **WHEN** `assemblePrompt()` tenta carregar um prompt que não existe para uma intent válida
- **THEN** o sistema SHALL emitir erro `invalid_prompt` no preflight
- **AND** a geração NÃO deve prosseguir

### Requirement: Seleção de prompt por campaignIntent no CopyDirectorService

O sistema SHALL selecionar o template de copy director em `CopyDirectorService.generateCopy()` usando `campaign-copy-director-${input.campaignIntent}`. Mesma regra de fallback ausente: intent válida sem prompt → erro.

#### Scenario: CopyDirectorService carrega prompt por intent

- **WHEN** `generateCopy()` é chamado com `campaignIntent === "spotlight"`
- **THEN** carrega `campaign-copy-director-spotlight.md`

### Requirement: validatePrompts valida director por intent

O sistema SHALL validar o prompt correto em `ImageGenerationService.validatePrompts()` usando `campaign-image-director-${brief.campaignInput.campaignIntent}`.

Se o prompt não existir, `validatePrompts` retorna `{ valid: false, errors: [...] }`.

O reviewer permanece único (`campaign-image-reviewer`) — sem validação por intent (F31.3).

#### Scenario: validatePrompts valida prompt correto por intent

- **WHEN** `validatePrompts()` é chamado com brief de intent "exclusive"
- **THEN** valida `campaign-image-director-exclusive.md`
- **AND** valida `campaign-image-reviewer.md` (único)
- **AND** o discountedPrice passado ao reviewer é vazio para exclusive

### Requirement: preserveImageDirective injetada nas variáveis

O sistema SHALL injetar `preserveImageDirective` nas variáveis do prompt de imagem quando:

| Intent | preserveImageContext | preserveImageDirective |
|--------|---------------------|------------------------|
| offer | qualquer valor | Não injetada (normalizado para false) |
| spotlight | true | "NÃO recortar o produto. Preservar o contexto original da imagem. Adaptar a composição ao redor do produto sem isolá-lo. Legibilidade continua obrigatória." |
| spotlight | false/omitido | Não injetada |
| exclusive | true | Mesma directive do spotlight |
| exclusive | false/omitido | Não injetada |

Os prompts de imagem SHALL conter o placeholder `{{preserveImageDirective}}` nas seções relevantes (offer pode omitir).

#### Scenario: preserveImageDirective injetada para spotlight com preserveImageContext

- **WHEN** `buildPromptVariables()` é chamado com `campaignIntent="spotlight"` e `preserveImageContext=true`
- **THEN** as variáveis contêm `preserveImageDirective` com instrução de preservar contexto

#### Scenario: preserveImageDirective vazia para offer

- **WHEN** `buildPromptVariables()` é chamado com `campaignIntent="offer"`
- **THEN** `preserveImageDirective` é string vazia
