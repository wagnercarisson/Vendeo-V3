## Why

O sistema de segmentos atual (10 segmentos fixos) foi criado no início do projeto e não reflete a realidade do varejo brasileiro. O campo subsegmento é um input de texto livre sem orientação, gerando dados inconsistentes que poluem os prompts de IA e dificultam agrupamentos futuros. Precisamos realinhar os segmentos ao perfil real dos lojistas brasileiros e guiar o preenchimento do subsegmento via dropdown hierárquico, mantendo flexibilidade com a opção "Outro" para texto livre validado.

## What Changes

**BREAKING**: Os segmentos atuais serão substituídos. A base de dados será zerada e uma nova CHECK constraint será aplicada.

> **Impacto na geração/IA**: Esta fase não altera o contrato de dados consumido pelo diretor de marketing — os campos continuam sendo `segment` e `subsegment`. Como os valores de `segment` serão realinhados (10 → 13 slugs diferentes), consumidores passivos dos slugs antigos devem ser atualizados para manter compatibilidade com a nova taxonomia: labels, fallbacks, personas e mappings auxiliares. Não faz parte desta fase introduzir nova lógica de geração ou alterar o fluxo do diretor de marketing.

- `src/lib/constants.ts` — Substituir `VALID_SEGMENTS`, `SEGMENT_LABELS`, `Segment` por `STORE_SEGMENTS` (13 segmentos), `STORE_SUBSEGMENTS` (subsegmentos hierárquicos por segmento), e `StoreSegment`
- `src/lib/store.ts` — Atualizar `SEGMENT_COLOR_FALLBACK` com as 13 novas chaves
- `src/components/campaign/types.ts` — Atualizar `SEGMENT_PALETTES` com as 13 novas chaves
- `src/lib/campaign-intelligence/providers/mock.ts` — Atualizar `SEGMENT_HOOKS` e `SEGMENT_CTAS` com as novas chaves
- `src/components/flow/store-identity-form.tsx` — Substituir imports, adaptar dropdown de segmento (`STORE_SEGMENTS`), substituir input text de subsegmento por dropdown condicional com 3 modos:
  - **Dropdown rico** (6: moda-calcados-acessorios, bebidas-adegas-conveniencia, padaria-confeitaria-doces, beleza-estetica, petshop, variedades-utilidades): dropdown com subsegmentos específicos + opção "Outro" que abre campo de texto
  - **Dropdown travado** (6: mercados-mercearias, restaurantes-lanchonetes, farmacia-saude, casa-decoracao, eletronicos-tecnologia, servicos-locais): dropdown desabilitado com única opção, auto-selecionada
  - **Campo aberto** (1: outros): campo de texto livre obrigatório, sem dropdown
- `src/components/flow/store-identity-block.tsx` — Atualizar resolução de label com `STORE_SEGMENTS`
- `src/components/flow/store-preview.tsx` — Atualizar resolução de label e fallback de cor
- `src/app/api/store/route.ts` — Validação de segmento com `STORE_SEGMENTS`
- `src/app/api/store/[id]/route.ts` — Validação de segmento com `STORE_SEGMENTS`
- `scripts/benchmark-scenarios.ts` — Atualizar segments nos cenários de benchmark
- `supabase/migrations/` — Nova migration para droppar CHECK constraint antiga e criar a nova com os 13 segmentos
- SQL para zerar todas as tabelas e buckets de storage

### Comportamento "Outro" no subsegmento

Regras de salvamento do subsegmento:

- **Segmento rico + subsegmento da lista**: salvar o valor selecionado diretamente em `stores.subsegment`.
- **Segmento rico + subsegmento `outro`**: abrir campo livre obrigatório; salvar o texto validado em `stores.subsegment`.
- **Segmento `outros`**: abrir campo livre obrigatório (sem dropdown); salvar o texto validado em `stores.subsegment`.

O valor literal `outro` nunca deve ser persistido como subsegmento final. O campo livre é obrigatório em ambos os cenários de "Outro".

Validação do campo livre (aplicada a ambos os casos):
- Client-side (no blur e no submit): regex `/^[A-Za-zÀ-ü\s]+$/` (letras acentuadas + espaços), 3 a 30 caracteres
- Rejeitar valores genéricos como `outro`, `loja`, `comercio`, `comércio`, `varejo`
- Placeholder: `"Digite o seu subsegmento"` (sem exemplos para evitar que o lojista copie literalmente)
- Validação e sanitização server-side ao salvar: rejeitar `outro` literal, vazio quando obrigatório, tamanho, regex e genéricos; depois `.trim()` + reduz espaços múltiplos + Capitalize
- O texto validado e sanitizado é armazenado em `stores.subsegment` (TEXT)

### Reset ao trocar de segmento

Ao mudar o segmento selecionado, o subsegmento atual é limpo (`setField("subsegment", "")`) e o campo "Outro" é fechado para evitar inconsistências (ex: subsegmento "Moda Feminina" com segmento "Pet Shop").

### Novos segmentos (13)

| Segmento | Subsegmentos |
|----------|-------------|
| `moda-calcados-acessorios` | 11 subsegmentos + Outro |
| `bebidas-adegas-conveniencia` | 9 subsegmentos + Outro |
| `padaria-confeitaria-doces` | 9 subsegmentos + Outro |
| `beleza-estetica` | 11 subsegmentos + Outro |
| `petshop` | 9 subsegmentos + Outro |
| `variedades-utilidades` | 9 subsegmentos + Outro |
| `mercados-mercearias` | 1 subsegmento (dropdown travado) |
| `restaurantes-lanchonetes` | 1 subsegmento (dropdown travado) |
| `farmacia-saude` | 1 subsegmento (dropdown travado) |
| `casa-decoracao` | 1 subsegmento (dropdown travado) |
| `eletronicos-tecnologia` | 1 subsegmento (dropdown travado) |
| `servicos-locais` | 1 subsegmento (dropdown travado) |
| `outros` | Campo aberto obrigatório |

## Capabilities

> **Nota sobre specs históricas**: As specs já existentes de fases anteriores não serão editadas retroativamente. Elas permanecem como registro do comportamento implementado e validado naquele momento. Este change possui proposal, design e specs próprias (incluindo delta specs); specs históricas permanecem intactas.

### New Capabilities
- `segment-subsegment-hierarchy`: Define a estrutura de dados dos 13 segmentos com seus subsegmentos hierárquicos, incluindo labels human-readable e valores kebab-case
- `subsegment-other-behavior`: Define o comportamento do campo "Outro" no subsegmento — validação (letras + espaços, 3-30 chars), sanitização (capitalize no save), placeholder orientativo, rejeição de valores genéricos

### Modified Capabilities
- `store-identity-ui`: O campo **Segmento** passa a usar `STORE_SEGMENTS` (13 opções em vez de 10); o campo **Subsegmento** deixa de ser input text livre e passa a ser dropdown condicional com 3 modos (dropdown rico, dropdown travado, campo aberto). Validação de segmento atualizada.
- `store-identity-foundation`: O schema de dados do segmento é expandido. A CHECK constraint no banco é atualizada via migration.

## Impact

- `src/lib/constants.ts` — Substituição completa das constantes de segmento
- `src/lib/store.ts` — `SEGMENT_COLOR_FALLBACK` com 13 novas keys
- `src/components/campaign/types.ts` — `SEGMENT_PALETTES` com 13 novas keys
- `src/lib/campaign-intelligence/providers/mock.ts` — `SEGMENT_HOOKS` e `SEGMENT_CTAS` com novas keys
- `src/components/flow/store-identity-form.tsx` — Lógica do subsegmento (3 modos de dropdown)
- `src/components/flow/store-identity-block.tsx` — Import e resolução de label
- `src/components/flow/store-preview.tsx` — Import e resolução de label/fallback
- `src/app/api/store/route.ts` — Validação
- `src/app/api/store/[id]/route.ts` — Validação
- `src/lib/image-generation/services/image-generation-service.ts` — Atualização de compatibilidade: `SEGMENT_LABELS` → `STORE_SEGMENTS` para resolução de persona criativa e creative context guidance
- `scripts/benchmark-scenarios.ts` — Cenários atualizados
- `supabase/migrations/` — Nova migration com CHECK constraint
- Banco: TRUNCATE em 5 tabelas + limpeza de 3 buckets storage
