# Mandatory Artwork Text

> Modified by `fase-40-campos-comerciais-avisos-brief` (D2/D3/D6): o formulário ganha o checkbox "Exibir 'Imagem meramente ilustrativa'" como controle real (default marcado, constante única `ILLUSTRATIVE_NOTICE_TEXT`); o transporte passa a carregar o texto final **concatenado** (`\n`) quando o checkbox está marcado; o componente usa a constante única (placeholder singular). O backend (mapper F39 `mandatoryArtworkText` → `commercial.legalNotice`, snapshot `campaign_brief_v1`) permanece inalterado — sem mudança de contrato.

## MODIFIED Requirements

### Requirement: Componente de campo no formulário

O sistema SHALL prover, na seção "Avisos e texto obrigatório" do formulário de campanha, **dois campos distintos coexistentes** (D2):

1. **Checkbox "Exibir 'Imagem meramente ilustrativa'"** — controle real (default marcado), injeta a constante `ILLUSTRATIVE_NOTICE_TEXT` no texto obrigatório final (ver `illustrative-notice-control`).
2. **Textarea "Texto obrigatório na arte"** (componente `MandatoryArtworkField`) — texto livre opcional, `maxLength 200`, placeholder referenciando a constante única (`ILLUSTRATIVE_NOTICE_TEXT`, singular — normaliza a variante plural "Imagens meramente ilustrativas").

Os campos são distintos com intenções distintas (aviso ilustrativo fixo × texto livre obrigatório); **não se fundem na UI**. O transporte normaliza ambos para o campo legado `mandatoryArtworkText` concatenado com `\n` (D3).

> Modified by `fase-40-campos-comerciais-avisos-brief` (D2/D3): a UI evolui de "textarea livre apenas" para **checkbox + textarea coexistindo** (controle real). O form state guarda `showIllustrativeNotice`/`mandatoryArtworkTextFree` separados; a concatenação acontece apenas na montagem do body.

#### Scenario: Checkbox e textarea renderizados e coexistentes

- **WHEN** o formulário de campanha é renderizado
- **THEN** há um checkbox "Exibir 'Imagem meramente ilustrativa'" (default marcado)
- **AND** há um textarea opcional "Texto obrigatório na arte" (maxLength 200, sem validação de required)
- **AND** os dois campos são renderizados simultaneamente (sem substituição)

#### Scenario: Placeholder do textarea usa a constante singular

- **WHEN** o textarea "Texto obrigatório na arte" é renderizado
- **THEN** o placeholder referencia `ILLUSTRATIVE_NOTICE_TEXT` (singular) — sem variante plural divergente

### Requirement: Campo propagado no brief do Image Director

O sistema SHALL propagar o aviso legal no `CampaignBrief.commercial.legalNotice` (domínio) para o Image Director, com instrução de renderização **condicional** (F40 D6): o aviso só entra na arte quando houver texto obrigatório/aviso legal informado (compat `mandatoryArtworkText` — fix `260804-s16` mantido).

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

### Requirement: Campo propagado no inputSnapshot

O sistema SHALL guardar o aviso ilustrativo no `inputSnapshot.commercial.legalNotice` (estruturado) para auditoria.

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
