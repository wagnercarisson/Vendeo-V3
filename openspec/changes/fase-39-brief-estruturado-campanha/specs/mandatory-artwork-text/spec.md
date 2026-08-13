# Mandatory Artwork Text

> Modified by `fase-39-brief-estruturado-campanha` (D9): o campo de texto obrigatório migra da string livre `mandatoryArtworkText` para a semântica estruturada `commercial.legalNotice { enabled, text? }`. `enabled=false` → nada entra na arte. O transporte (`GenerateImageRequestSchema`) mantém `mandatoryArtworkText` nesta fase (compat com o form); o mapeamento acontece no mapper flat→brief.

## MODIFIED Requirements

### Requirement: Campo propagado no inputSnapshot

O sistema SHALL guardar o aviso ilustrativo no `inputSnapshot.commercial.legalNotice` (estruturado) para auditoria:

> Modified by `fase-39-brief-estruturado-campanha` (D9): `mandatoryArtworkText` deixa de ser guardado como string solta no snapshot; o aviso ilustrativo passa a viver em `commercial.legalNotice`.

- `mandatoryArtworkText` preenchido no transporte → `legalNotice = { enabled: true, text: <valor> }`
- campo ausente no transporte → `legalNotice` **ausente** no snapshot (regra canônica: campo não informado → ausente; nunca `{ enabled: false }` fabricado)

#### Scenario: mandatoryArtworkText presente vira legalNotice habilitado

- **WHEN** uma geração com `mandatoryArtworkText` preenchido é concluída
- **THEN** `inputSnapshot.commercial.legalNotice` contém `{ enabled: true, text: <valor> }`
- **AND** o campo solto `mandatoryArtworkText` não existe no snapshot (D9)

#### Scenario: mandatoryArtworkText ausente não cria aviso

- **WHEN** uma geração sem `mandatoryArtworkText` é concluída
- **THEN** `inputSnapshot.commercial.legalNotice` está ausente (nada na arte)

### Requirement: Campo propagado no brief do Image Director

O sistema SHALL propagar o aviso legal no `CampaignBrief.commercial.legalNotice` (domínio) para o Image Director, com instrução: "Incluir obrigatoriamente na arte, em tipografia mínima legível: [texto]" **apenas quando** `legalNotice.enabled === true`.

> Modified by `fase-39-brief-estruturado-campanha` (D9): a propagação ao Image Director passa a ler `commercial.legalNotice` do domínio, com a mesma instrução de renderização obrigatória quando habilitado.

#### Scenario: Image Director recebe legalNotice habilitado

- **WHEN** o pipeline monta o brief para o Image Director com `legalNotice = { enabled: true, text: "Imagens meramente ilustrativas" }`
- **THEN** `brief.commercial.legalNotice.text` contém o valor
- **AND** o prompt visual inclui instrução de renderização obrigatória (compat `mandatoryArtworkText` — fix `260804-s16` mantido)

#### Scenario: legalNotice desabilitado NÃO entra na arte

- **WHEN** `brief.commercial.legalNotice.enabled === false` (ou ausente)
- **THEN** **nada** de texto obrigatório entra no prompt visual (D9)

### Requirement: Campo NÃO entra no CopyDirectorInput

O sistema SHALL NÃO incluir o aviso legal (`legalNotice`/`mandatoryArtworkText`) no `CopyDirectorInput`, mantendo a fronteira entre copy (texto persuasivo) e texto obrigatório na arte (visual). (Sem mudança de comportamento — mantém-se da fase anterior.)

#### Scenario: legalNotice ausente no Copy Director

- **WHEN** `mapBriefToCopyDirectorInput` é chamado com brief contendo `commercial.legalNotice`
- **THEN** o `CopyDirectorInput` resultante NÃO contém o campo (fronteira copy × arte mantida)

### Requirement: Campo NÃO entra no publication_copy_snapshot

O sistema SHALL NÃO incluir o aviso legal no `publication_copy_snapshot`, pois é contrato visual, não de copy. (Sem mudança de comportamento.)

#### Scenario: publication_copy_snapshot sem aviso legal

- **WHEN** uma geração com `legalNotice` habilitado é concluída
- **THEN** `publication_copy_snapshot` NÃO contém o aviso legal (D9)

### Requirement: Componente de campo no formulário

O sistema SHALL prover um componente `MandatoryArtworkField` opcional no formulário de campanha, posicionado abaixo do campo CTA. Nesta fase o componente continua enviando o texto livre `mandatoryArtworkText` (sem toggle de `enabled` — a semântica `enabled` entra no domínio, não na UI).

> Modified by `fase-39-brief-estruturado-campanha` (D9): a UI **pode** evoluir para toggle `enabled` + texto — **sem mudança nesta fase** (não é escopo). O form continua enviando `mandatoryArtworkText` (string livre) nesta fase.

#### Scenario: Campo renderizado no formulário

- **WHEN** o formulário de campanha é renderizado
- **THEN** há um campo opcional "Texto obrigatório na arte" (ou similar) abaixo do CTA
- **AND** o campo é um textarea ou input de texto livre
- **AND** o campo é opcional (sem validação de required)
