# Mandatory Artwork Text

> Synced from `fase-25-integracao-transacional-pipeline` (ADDED).
> Modified by `fase-39-brief-estruturado-campanha` (D9): o campo de texto obrigatório migra da string livre `mandatoryArtworkText` para a semântica estruturada `commercial.legalNotice { enabled, text? }`. `enabled=false` → nada entra na arte. O transporte (`GenerateImageRequestSchema`) mantém `mandatoryArtworkText` nesta fase (compat com o form); o mapeamento acontece no mapper flat→brief.
> Modified by `fase-40-campos-comerciais-avisos-brief` (D2/D3/D6): o formulário ganha o checkbox "Exibir 'Imagem meramente ilustrativa'" como controle real (default marcado, constante única `ILLUSTRATIVE_NOTICE_TEXT`); o transporte passa a carregar o texto final **concatenado** (`\n`) quando o checkbox está marcado; o componente usa a constante única (placeholder singular). O backend (mapper F39 `mandatoryArtworkText` → `commercial.legalNotice`, snapshot `campaign_brief_v1`) permanece inalterado — sem mudança de contrato.

## Purpose

Campo `mandatoryArtworkText` no formulário de campanha e no pipeline: opcional no input, propagado ao Image Director (arte) mas não ao Copy Director (copy) nem ao publication_copy_snapshot.

## Requirements

### Requirement: Campo optional no GenerateImageRequestSchema

O sistema SHALL adicionar o campo opcional `mandatoryArtworkText?: string` no schema `GenerateImageRequestSchema` (Zod).

#### Scenario: Campo aceito no schema

- **WHEN** `GenerateImageRequestSchema` valida body com `mandatoryArtworkText: "Imagens meramente ilustrativas"`
- **THEN** a validação passa e o campo é preservado

#### Scenario: Campo ausente não quebra

- **WHEN** `GenerateImageRequestSchema` valida body sem `mandatoryArtworkText`
- **THEN** a validação passa (campo é opcional)

### Requirement: Campo propagado no inputSnapshot

O sistema SHALL guardar o aviso ilustrativo no `inputSnapshot.commercial.legalNotice` (estruturado) para auditoria.

> Modified by `fase-39-brief-estruturado-campanha` (D9): `mandatoryArtworkText` deixa de ser guardado como string solta no snapshot; o aviso ilustrativo passa a viver em `commercial.legalNotice`.
> Modified by `fase-40-campos-comerciais-avisos-brief` (D3/D9): o transporte passa a carregar o texto final **concatenado** (`\n`) quando o checkbox está marcado; o mapper e o snapshot continuam inalterados — o snapshot registra o texto final (concatenação/quando aplicável). A separação checkbox/texto é responsabilidade da UI (form state).

- `mandatoryArtworkText` preenchido no transporte → `legalNotice = { enabled: true, text: <valor final> }`
- campo ausente no transporte → `legalNotice` **ausente** no snapshot (regra canônica: campo não informado → ausente; nunca `{ enabled: false }` fabricado)

#### Scenario: mandatoryArtworkText concatenado vira legalNotice habilitado

- **WHEN** uma geração com `mandatoryArtworkText = "Imagem meramente ilustrativa\nConsulte condições na loja."` é concluída
- **THEN** `inputSnapshot.commercial.legalNotice` contém `{ enabled: true, text: "Imagem meramente ilustrativa\nConsulte condições na loja." }`
- **AND** o campo solto `mandatoryArtworkText` não existe no snapshot (D9)

#### Scenario: mandatoryArtworkText ausente não cria aviso

- **WHEN** uma geração sem `mandatoryArtworkText` (checkbox desmarcado + sem texto livre) é concluída
- **THEN** `inputSnapshot.commercial.legalNotice` está ausente (nada na arte)

### Requirement: Campo propagado no brief do Image Director

O sistema SHALL propagar o aviso legal no `CampaignBrief.commercial.legalNotice` (domínio) para o Image Director, com instrução de renderização **condicional** (F40 D6): o aviso só entra na arte quando houver texto obrigatório/aviso legal informado (compat `mandatoryArtworkText` — fix `260804-s16` mantido).

> Modified by `fase-39-brief-estruturado-campanha` (D9): a propagação ao Image Director passa a ler `commercial.legalNotice` do domínio, com a mesma instrução de renderização obrigatória quando habilitado.
> Modified by `fase-40-campos-comerciais-avisos-brief` (D6): a instrução incondicional "SEMPRE acrescente... Imagem meramente ilustrativa" é **removida dos 4 prompts do diretor** e substituída por **bloco condicional de composição**: "Quando houver texto obrigatório/aviso legal informado, exiba exatamente esse texto na arte. Se o aviso for 'Imagem meramente ilustrativa', posicione-o com tipografia mínima, mas visível e legível, em área lateral horizontal ou vertical, sem competir com oferta, produto e preço." A linha condicional do texto obrigatório ("Se o campo 'Texto obrigatório na arte' estiver preenchido... Não o repita na legenda.") é mantida.

#### Scenario: Image Director recebe legalNotice habilitado

- **WHEN** o pipeline monta o brief para o Image Director com `legalNotice = { enabled: true, text: "Imagem meramente ilustrativa" }`
- **THEN** `brief.commercial.legalNotice.text` contém o valor
- **AND** o prompt visual inclui o bloco condicional de composição (sem a instrução incondicional "SEMPRE acrescente")

#### Scenario: legalNotice desabilitado NÃO entra na arte

- **WHEN** `brief.commercial.legalNotice.enabled === false` (ou ausente)
- **THEN** **nada** de texto obrigatório entra no prompt visual (D9 — opt-out real)

#### Scenario: Prompts sem instrução incondicional

- **WHEN** os 4 prompts do diretor (`campaign-image-director.md`, `-offer.md`, `-spotlight.md`, `-exclusive.md`) são inspecionados
- **THEN** NÃO contêm a instrução incondicional "SEMPRE acrescente a arte o seguinte texto ... 'Imagem meramente ilustrativa'"
- **AND** contêm o bloco condicional de composição (texto obrigatório informado → exibir exatamente; tipografia mínima/visível/legível; posição lateral; sem competir com oferta/produto/preço)

### Requirement: Campo NÃO entra no CopyDirectorInput

O sistema SHALL NÃO incluir `mandatoryArtworkText` no `CopyDirectorInput`, mantendo a fronteira entre copy (texto persuasivo) e texto obrigatório na arte (visual).

#### Scenario: mandatoryArtworkText ausente no Copy Director

- **WHEN** `mapBriefToCopyDirectorInput` é chamado com input contendo `mandatoryArtworkText`
- **THEN** o `CopyDirectorInput` resultante NÃO contém o campo

### Requirement: Campo NÃO entra no publication_copy_snapshot

O sistema SHALL NÃO incluir `mandatoryArtworkText` no `publication_copy_snapshot`, pois é contrato visual, não de copy.

#### Scenario: publication_copy_snapshot sem mandatoryArtworkText

- **WHEN** uma geração com `mandatoryArtworkText` preenchido é concluída
- **THEN** `publication_copy_snapshot` NÃO contém o campo `mandatoryArtworkText`

### Requirement: Componente de campo no formulário

O sistema SHALL prover, na seção "Avisos e texto obrigatório" do formulário de campanha, **dois campos distintos coexistentes**:

1. **Checkbox "Exibir 'Imagem meramente ilustrativa'"** — controle real (default marcado), injeta a constante `ILLUSTRATIVE_NOTICE_TEXT` no texto obrigatório final (ver `illustrative-notice-control`).
2. **Campo "Informações obrigatórias na arte"** (componente `MandatoryArtworkField`) — texto livre opcional, `maxLength 200`, **multi-linha**, com microcopy positiva ("Informe características, detalhes ou restrições que precisam aparecer na imagem. Use preferencialmente uma linha para cada item.") e placeholder com **exemplo real, incluindo uma restrição** (ex.: `Intensidade 8` / `Torra clássica` / `Venda proibida para menores`). A variante "Detalhes obrigatórios na arte" é aceitável se a UAT indicar maior clareza.

Os campos são distintos com intenções distintas (aviso ilustrativo fixo × texto livre obrigatório); **não se fundem na UI**. O campo de informações obrigatórias SHALL permanecer **diretamente visível** (não escondido atrás de checkbox ou fluxo secundário). O transporte normaliza ambos para o campo legado `mandatoryArtworkText` concatenado com `\n` — inalterado.

O sistema SHALL NOT exibir advertências negativas permanentes no campo (ex.: "Não repita preço...", "Não repita validade...", "Não use para aviso ilustrativo...").

> Modified by `fase-39-brief-estruturado-campanha` (D9): a UI **pode** evoluir para toggle `enabled` + texto — **sem mudança nesta fase** (não é escopo). O form continua enviando `mandatoryArtworkText` (string livre) nesta fase.
> Modified by `fase-40-campos-comerciais-avisos-brief` (D2/D3): a UI evolui de "textarea livre apenas" para **checkbox + textarea coexistindo** (controle real). O form state guarda `showIllustrativeNotice`/`mandatoryArtworkTextFree` separados; a concatenação acontece apenas na montagem do body.
> Modified by `fase-49-ativacao-orientacao-contextual-campos` (D10/D11): rótulo/microcopy/placeholder atualizados para "Informações obrigatórias na arte" com exemplo real de produto multi-linha; campo visível; sem advertências negativas. Comportamento de arte e prompts inalterados.

#### Scenario: Checkbox e campo de informações obrigatórias coexistentes

- **WHEN** o formulário de campanha é renderizado
- **THEN** há um checkbox "Exibir 'Imagem meramente ilustrativa'" (default marcado)
- **AND** há o campo opcional "Informações obrigatórias na arte" (maxLength 200, sem validação de required)
- **AND** os dois campos são renderizados simultaneamente (sem substituição)

#### Scenario: Microcopy positiva e placeholder multi-linha

- **WHEN** o campo "Informações obrigatórias na arte" é renderizado
- **THEN** a microcopy orienta a informar características/detalhes que precisam aparecer na imagem, uma linha por item
- **AND** o placeholder exibe um exemplo real de produto com múltiplas linhas de detalhes

#### Scenario: Campo permanece visível

- **WHEN** a seção de avisos é renderizada
- **THEN** o campo de informações obrigatórias está diretamente visível
- **AND** não depende de marcar um checkbox ou abrir um fluxo secundário

#### Scenario: Sem advertências negativas permanentes

- **WHEN** o campo é renderizado
- **THEN** nenhuma advertência negativa permanente (não repetir preço/validade/aviso ilustrativo) é exibida

#### Scenario: Transporte e arte preservados

- **WHEN** o usuário preenche informações obrigatórias com múltiplas linhas
- **THEN** o body continua enviando `mandatoryArtworkText` no mesmo contrato
- **AND** a semântica `commercial.legalNotice` e os prompts do diretor permanecem inalterados
