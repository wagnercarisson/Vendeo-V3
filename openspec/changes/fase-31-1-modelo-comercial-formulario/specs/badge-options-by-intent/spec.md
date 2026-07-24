## ADDED Requirements

### Requirement: BADGE_OPTIONS_BY_INTENT constant

O sistema SHALL prover `BADGE_OPTIONS_BY_INTENT: Record<CampaignIntent, readonly string[]>` em `src/lib/constants.ts` com as seguintes opções:

| Intent | Badges |
|---|---|
| `offer` | Promoção, Oferta, Queima de Estoque, Últimas Unidades, Imperdível |
| `spotlight` | Novidade, Lançamento, Mais Vendido, Top de Linha, Destaque da Semana |
| `exclusive` | Exclusivo, Premium, Sob Encomenda, Edição Limitada |

O sistema SHALL manter a constante `BADGE_OPTIONS` como compatível com `BADGE_OPTIONS_BY_INTENT["offer"]` para não quebrar referências existentes.

#### Scenario: BADGE_OPTIONS_BY_INTENT tem todas as intents

- **WHEN** `BADGE_OPTIONS_BY_INTENT` é importado
- **THEN** contém chaves `"offer"`, `"spotlight"`, e `"exclusive"`
- **AND** cada chave contém um array de strings não vazio

#### Scenario: BADGE_OPTIONS compatível com offer

- **WHEN** `BADGE_OPTIONS` é referenciado
- **THEN** seu valor é idêntico a `BADGE_OPTIONS_BY_INTENT["offer"]`

#### Scenario: Badge de spotlight são específicos para destaque

- **WHEN** `BADGE_OPTIONS_BY_INTENT["spotlight"]` é consultado
- **THEN** contém "Novidade", "Lançamento", "Mais Vendido", "Top de Linha", "Destaque da Semana"
- **AND** NÃO contém "Promoção", "Oferta", "Queima de Estoque", "Últimas Unidades", "Imperdível"

#### Scenario: Badge de exclusive são específicos para exclusividade

- **WHEN** `BADGE_OPTIONS_BY_INTENT["exclusive"]` é consultado
- **THEN** contém "Exclusivo", "Premium", "Sob Encomenda", "Edição Limitada"
