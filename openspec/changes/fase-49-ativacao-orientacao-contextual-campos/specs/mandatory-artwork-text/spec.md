# Mandatory Artwork Text

> Delta spec for `fase-49-ativacao-orientacao-contextual-campos` (D10/D11). O componente do campo de texto obrigatório atualiza rótulo, microcopy e placeholder (exemplo real de produto, multi-linha), permanecendo diretamente visível e sem advertências negativas. Transporte (`mandatoryArtworkText`), constante `ILLUSTRATIVE_NOTICE_TEXT`, semântica de `commercial.legalNotice` e prompts permanecem inalterados.

## MODIFIED Requirements

### Requirement: Componente de campo no formulário

O sistema SHALL prover, na seção "Avisos e texto obrigatório" do formulário de campanha, **dois campos distintos coexistentes**:

1. **Checkbox "Exibir 'Imagem meramente ilustrativa'"** — controle real (default marcado), injeta a constante `ILLUSTRATIVE_NOTICE_TEXT` no texto obrigatório final (ver `illustrative-notice-control`).
2. **Campo "Informações obrigatórias na arte"** (componente `MandatoryArtworkField`) — texto livre opcional, `maxLength 200`, **multi-linha**, com microcopy positiva ("Informe características, detalhes ou restrições que precisam aparecer na imagem. Use preferencialmente uma linha para cada item.") e placeholder com **exemplo real, incluindo uma restrição** (ex.: `Intensidade 8` / `Torra clássica` / `Venda proibida para menores`). A variante "Detalhes obrigatórios na arte" é aceitável se a UAT indicar maior clareza.

Os campos são distintos com intenções distintas (aviso ilustrativo fixo × texto livre obrigatório); **não se fundem na UI**. O campo de informações obrigatórias SHALL permanecer **diretamente visível** (não escondido atrás de checkbox ou fluxo secundário). O transporte normaliza ambos para o campo legado `mandatoryArtworkText` concatenado com `\n` — inalterado.

O sistema SHALL NOT exibir advertências negativas permanentes no campo (ex.: "Não repita preço...", "Não repita validade...", "Não use para aviso ilustrativo...").

> Modified by `fase-39-brief-estruturado-campanha` (D9): a UI **pode** evoluir para toggle `enabled` + texto — **sem mudança nesta fase**.
> Modified by `fase-40-campos-comerciais-avisos-brief` (D2/D3): a UI evolui de "textarea livre apenas" para **checkbox + textarea coexistindo**.
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
