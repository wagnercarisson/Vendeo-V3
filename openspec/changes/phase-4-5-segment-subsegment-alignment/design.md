> **Nota sobre specs históricas**: As specs já existentes de fases anteriores não serão editadas retroativamente. Elas permanecem como registro do comportamento implementado e validado naquele momento. Este change possui proposal, design e specs próprias (incluindo delta specs); specs históricas permanecem intactas.

## Context

O sistema atual de segmentos foi definido nas fases iniciais (1.0) com 10 segmentos fixos em `VALID_SEGMENTS` e um input text livre para subsegmento. Esse modelo gera três problemas:

1. **Dados inconsistentes** — lojistas digitam "Roupas Femininas", "roupa feminina", "roupas fem" no subsegmento, impossibilitando agrupamento
2. **Cobertura incompleta** — segmentos como "beleza-estetica" misturam serviços (salão) com produtos (cosméticos) sem distinção
3. **IA imprecisa** — prompts de direção criativa recebem subsegmentos ruidosos, reduzindo qualidade da geração

A reestruturação cobre ~90% do varejo físico brasileiro com 13 segmentos em 3 modos: 6 segmentos com dropdown rico (subsegmentos específicos + "Outro"), 6 segmentos com dropdown travado (auto-preenchimento) e 1 segmento (`outros`) com campo aberto obrigatório.

### Estado atual

```
constants.ts               store-identity-form.tsx
─────────────────           ────────────────────────
VALID_SEGMENTS[10]          <select segment>  ✅
SEGMENT_LABELS              <input subsegment> ❌ texto livre
Segment type                → sem validação, sem guide

store.ts                    Banco
─────────                   ─────
SEGMENT_COLOR_FALLBACK[10]  CHECK (segment IN 10 valores antigos)
```

## Goals / Non-Goals

### Goals

- Substituir `VALID_SEGMENTS`/`SEGMENT_LABELS` por `STORE_SEGMENTS` + `STORE_SUBSEGMENTS` em `constants.ts`
- Subsegmento vira dropdown condicional com 3 modos (dropdown rico, dropdown travado, campo aberto)
- Validação e sanitização do "Outro" preenchível (letras + espaços, 3-30 chars, capitalize)
- Atualizar `SEGMENT_COLOR_FALLBACK`, `SEGMENT_PALETTES`, `SEGMENT_HOOKS`, `SEGMENT_CTAS` com as 13 novas chaves
- Migration SQL para a nova CHECK constraint em `stores.segment`
- Script SQL para zerar base de dados de teste (5 tabelas + 3 buckets)
- Atualizar API routes de validação

### Non-Goals

- **Não** alterar o schema do banco além da CHECK constraint — `stores.subsegment` continua TEXT
- **Não** alterar a lógica de como fallbacks são aplicados — cores/hooks/CTAs/paletas existentes serão substituídos por valores contextualmente alinhados, mas o mecanismo de fallback (usar APENAS quando IA não conseguir inferir) permanece idêntico
- **Não** refatorar o mock provider além da troca de hooks/CTAs
- **Não** introduzir autenticação, multi-tenancy ou isolamento por lojista
- **Não** alterar o fluxo de campanhas (campaign input, preview, render) — eles herdam os novos segmentos
- **Não** introduzir nova lógica de geração ou alterar o fluxo do diretor de marketing — o contrato de dados (`segment`, `subsegment`) permanece inalterado; apenas labels, fallbacks, personas e mappings auxiliares com chaves antigas são atualizados para compatibilidade

## Decisions

### Decision 1: Estrutura unificada `STORE_SEGMENTS` + `STORE_SUBSEGMENTS`

**Opção A** (escolhida): Um array `STORE_SEGMENTS` com `{ value, label }` + um Record `STORE_SUBSEGMENTS` indexado pelo `value` do segmento.

```typescript
export const STORE_SEGMENTS = [
  { value: "moda-calcados-acessorios", label: "Moda, Calçados e Acessórios" },
  // ...13 entries
] as const;

export type StoreSegment = (typeof STORE_SEGMENTS)[number]["value"];

export const STORE_SUBSEGMENTS: Record<StoreSegment, readonly { value: string; label: string }[]> = {
  "moda-calcados-acessorios": [
    { value: "moda-feminina", label: "Moda Feminina" },
    // ...
    { value: "outro", label: "Outro" },
  ],
  // ...
};
```

**Opção B**: Manter `VALID_SEGMENTS` + `SEGMENT_LABELS` separados e adicionar `SEGMENT_SUBSEGMENTS` avulso.

**Rationale**: Opção A é mais coesa — o subsegmento só existe no contexto de um segmento, então faz sentido estar aninhado. Facilita lookup (ex: `STORE_SUBSEGMENTS[segment]`), reduz inconsistência entre listas paralelas, e o tipo `StoreSegment` é derivado automaticamente.

### Decision 2: Três modos de UI para subsegmento

| Modo | Segmentos | Comportamento |
|------|-----------|---------------|
| **Dropdown rico** | `moda-calcados-acessorios`, `bebidas-adegas-conveniencia`, `padaria-confeitaria-doces`, `beleza-estetica`, `petshop`, `variedades-utilidades` | Dropdown com subsegmentos + "Outro" → texto livre |
| **Dropdown travado** | `mercados-mercearias`, `restaurantes-lanchonetes`, `farmacia-saude`, `casa-decoracao`, `eletronicos-tecnologia`, `servicos-locais` | Dropdown desabilitado com única opção, auto-selecionada |
| **Campo aberto** | `outros` | Apenas input de texto (sem dropdown) |

**Rationale**: O modo dropdown travado evita mostrar um dropdown com uma única opção que o usuário não pode mudar — a informação é redundante (o subsegmento repete o segmento). Mas ainda mostramos o campo para transparência. O modo campo aberto para "Outros" cobre nichos não mapeados sem poluir o dropdown com opções genéricas.

### Decision 3: Reset de subsegmento ao trocar de segmento

Quando o usuário muda o segmento, o subsegmento atual deve ser limpo. Isso evita inconsistências (ex: subsegmento "Moda Feminina" com segmento "Pet Shop").

```typescript
const handleSegmentChange = (value: string) => {
  setField("segment", value);
  setField("subsegment", ""); // reset
  setSubsegmentIsOther(false); // fecha campo "Outro"
};
```

### Decision 4: Validação do "Outro" — 2 camadas

O campo livre é obrigatório em dois cenários: (1) segmento rico + subsegmento `outro`, e (2) segmento `outros`. O valor literal `outro` nunca deve ser persistido como subsegmento final. Além da validação de formato, valores genéricos como `outro`, `loja`, `comercio`, `comércio`, `varejo` devem ser rejeitados.

**Client-side** (no blur e no submit):
```typescript
function validateOtherSubsegment(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < 3) return "Digite ao menos 3 caracteres";
  if (trimmed.length > 30) return "Máximo de 30 caracteres";
  if (!/^[A-Za-zÀ-ü\s]+$/.test(trimmed)) return "Use apenas letras e espaços";
  return null;
}
```

**Server-side** (validação e sanitização ao salvar):
```typescript
subsegment = value.trim()
  .replace(/\s+/g, " ")
  .split(" ")
  .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
  .join(" ");
```

**Rationale**: Duas camadas porque o client-side dá feedback imediato, e o server-side garante integridade independente de qual cliente enviou os dados (API routes).

### Decision 5: Migration nomeada como `20260611000001_update_stores_segment_check.sql`

```sql
ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_segment_check;
ALTER TABLE public.stores ADD CONSTRAINT stores_segment_check
  CHECK (segment = ANY(ARRAY[
    'moda-calcados-acessorios',
    'bebidas-adegas-conveniencia',
    'padaria-confeitaria-doces',
    'beleza-estetica',
    'petshop',
    'variedades-utilidades',
    'mercados-mercearias',
    'restaurantes-lanchonetes',
    'farmacia-saude',
    'casa-decoracao',
    'eletronicos-tecnologia',
    'servicos-locais',
    'outros'
  ]));
```

### Decision 6: Placeholder do campo "Outro"

UX guideline (skill ui-ux-pro-max): placeholder NÃO substitui label — sempre usar `<label>` visível. Como já temos `<label>` acima do campo, o placeholder deve ser curto e instrutivo, sem exemplos que o lojista possa copiar como texto literal.

```
"Outro" dropdown (segmentos ricos) → placeholder: "Digite o seu subsegmento"
Segmento "Outros" (campo aberto)   → placeholder: "Digite o seu subsegmento"
```

**Por que NÃO usar exemplos como "Ex: Artigos Esportivos":** Risco de o lojista achar que é um valor pré-preenchido ou copiar literalmente, gerando ruído nos dados.

### Decision 7: Fallback values de marketing por segmento

Todas as cores, hooks, CTAs e paletas abaixo são **fallbacks** — usadas APENAS quando o diretor de marketing IA não conseguir extrair/inferir valores válidos na geração da direção visual da loja (brand profiler, identity art director). São valores contextualmente alinhados ao segmento, mas não substituem a inferência da IA.

**SEGMENT_COLOR_FALLBACK** (src/lib/store.ts) — cor de marca padrão por segmento:

| Segmento | Cor | Contexto |
|----------|-----|----------|
| `moda-calcados-acessorios` | `#EC4899` | Rosa fashion — alinhado ao universo de moda |
| `bebidas-adegas-conveniencia` | `#DC2626` | Vermelho — tradição cervejeira, bebidas |
| `padaria-confeitaria-doces` | `#F59E0B` | Âmbar/dourado — pão, mel, aconchego |
| `beleza-estetica` | `#D946EF` | Rosa/roxo — beleza e estética |
| `petshop` | `#F97316` | Laranja — energia, pet |
| `variedades-utilidades` | `#A855F7` | Roxo — versatilidade |
| `mercados-mercearias` | `#22C55E` | Verde — frescor, hortifrúti |
| `restaurantes-lanchonetes` | `#EF4444` | Vermelho — apetite, comida |
| `farmacia-saude` | `#10B981` | Verde — saúde, bem-estar |
| `casa-decoracao` | `#84CC16` | Verde lima — lar, frescor |
| `eletronicos-tecnologia` | `#3B82F6` | Azul — tecnologia, confiança |
| `servicos-locais` | `#0EA5E9` | Azul claro — confiança, serviço |
| `outros` | `#22C55E` | Verde — neutro, versátil |

**SEGMENT_HOOKS** (src/lib/campaign-intelligence/providers/mock.ts) — hook de campanha por segmento:

| Segmento | Hook |
|----------|------|
| `moda-calcados-acessorios` | "O estilo que você merece!" |
| `bebidas-adegas-conveniencia` | "O sabor que refresca!" |
| `padaria-confeitaria-doces` | "O frescor de cada dia!" |
| `beleza-estetica` | "Realce sua beleza natural!" |
| `petshop` | "Seu pet merece o melhor!" |
| `variedades-utilidades` | "Tudo que você precisa!" |
| `mercados-mercearias` | "O melhor da sua mesa!" |
| `restaurantes-lanchonetes` | "Sabor inesquecível toda hora!" |
| `farmacia-saude` | "Sua saúde em primeiro lugar!" |
| `casa-decoracao` | "Transforme seu lar!" |
| `eletronicos-tecnologia` | "Tecnologia que faz a diferença!" |
| `servicos-locais` | "Soluções que funcionam pra você!" |
| `outros` | "Não perca esta oportunidade!" |

**SEGMENT_CTAS** (src/lib/campaign-intelligence/providers/mock.ts) — call-to-action por segmento:

| Segmento | CTA |
|----------|-----|
| `moda-calcados-acessorios` | "Garanta seu Estilo!" |
| `bebidas-adegas-conveniencia` | "Compre Agora!" |
| `padaria-confeitaria-doces` | "Experimente Já!" |
| `beleza-estetica` | "Agende Seu Horário!" |
| `petshop` | "Mime Seu Pet!" |
| `variedades-utilidades` | "Aproveite Agora!" |
| `mercados-mercearias` | "Faça Suas Compras!" |
| `restaurantes-lanchonetes` | "Peça Já o Seu!" |
| `farmacia-saude` | "Cuide-se Agora!" |
| `casa-decoracao` | "Decore Já!" |
| `eletronicos-tecnologia` | "Compre Agora!" |
| `servicos-locais` | "Solicite Agora!" |
| `outros` | "Garanta o Seu!" |

**SEGMENT_PALETTES** (src/components/campaign/types.ts) — paleta visual de campanha por segmento:

| Segmento | Background | Accent |
|----------|------------|--------|
| `moda-calcados-acessorios` | `#FAFAFA` | `#EC4899` |
| `bebidas-adegas-conveniencia` | `#FFF7ED` | `#EA580C` |
| `padaria-confeitaria-doces` | `#FFFBEB` | `#D97706` |
| `beleza-estetica` | `#FAF5FF` | `#D946EF` |
| `petshop` | `#FFFFFF` | `#F97316` |
| `variedades-utilidades` | `#FFFFFF` | `#A855F7` |
| `mercados-mercearias` | `#F0FDF4` | `#16A34A` |
| `restaurantes-lanchonetes` | `#FFF7ED` | `#EA580C` |
| `farmacia-saude` | `#F0FDF4` | `#16A34A` |
| `casa-decoracao` | `#FFFDF5` | `#D97706` |
| `eletronicos-tecnologia` | `#F8FAFC` | `#2563EB` |
| `servicos-locais` | `#EFF6FF` | `#0EA5E9` |
| `outros` | `#FFFFFF` | `#22C55E` |

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| Lojistas segmento "Outros" podem digitar subsegmentos inconsistentes | Validação (3-30 chars, só letras) + sanitização (capitalize) reduzem ruído |
| Mudança de chaves quebra referências a `SEGMENT_LABELS` e mappings auxiliares baseados nos slugs antigos (categoria, conflito, persona criativa) em `image-generation-service.ts` e prompts de IA | Atualizar referências para `STORE_SEGMENTS`; mapeamento 1:1 de chaves → labels garante que labels continuem legíveis |
| Esquecimento de atualizar `benchmark-scenarios.ts` causa falha nos benchmarks | Listado no Impact e verificado nas tasks |
| Drop da CHECK constraint falha se houver registros com valores antigos na base | DB será zerado antes (TRUNCATE), então não há conflito |
| Store com `segment: "outros"` e subsegmento vazio após migration | Validação no front-end exige preenchimento quando segmento = "outros" |

## Migration Plan

### Passos

1. **Zerar base de dados** — Executar SQL de TRUNCATE nas 5 tabelas + DELETE nos 3 buckets
2. **Aplicar migration** — `20260611000001_update_stores_segment_check.sql`
3. **Atualizar constants.ts** — Substituir `VALID_SEGMENTS` por `STORE_SEGMENTS`, adicionar `STORE_SUBSEGMENTS`
4. **Atualizar store.ts** — `SEGMENT_COLOR_FALLBACK` com novas keys
5. **Atualizar campaign/types.ts** — `SEGMENT_PALETTES` com novas keys
6. **Atualizar mock provider** — `SEGMENT_HOOKS` e `SEGMENT_CTAS`
7. **Atualizar store-identity-form.tsx** — Import + dropdown segmento + dropdown subsegmento 3 modos
8. **Atualizar store-identity-block.tsx** — Import + label resolution
9. **Atualizar store-preview.tsx** — Import + label/fallback resolution
10. **Atualizar API routes** — Validação
11. **Atualizar benchmark-scenarios.ts**
12. **Atualizar image-generation-service.ts** — Substituir referências a `SEGMENT_LABELS` por `STORE_SEGMENTS` para compatibilidade com nova taxonomia (persona criativa, creative context guidance)

### Rollback

- Reverter o migration (DROP nova CHECK, recriar antiga)
- Reverter constants.ts, store.ts, campaign/types.ts, mock.ts
- Reverter store-identity-form.tsx, block.tsx, preview.tsx
- Reverter API routes
- Reverter image-generation-service.ts
- Reverter benchmark-scenarios.ts
- Re-popular DB com dados de teste se necessário

### SQL de limpeza da base

```sql
-- Ordem respeita chaves estrangeiras (dependentes primeiro)
TRUNCATE TABLE public.generation_events CASCADE;
TRUNCATE TABLE public.store_brand_profiles CASCADE;
TRUNCATE TABLE public.store_brand_assets CASCADE;
TRUNCATE TABLE public.store_visual_signatures CASCADE;
TRUNCATE TABLE public.stores CASCADE;

-- Limpar buckets do Storage
DELETE FROM storage.objects WHERE bucket_id IN ('visual-signatures', 'store-logos', 'store-brand-assets');
```

## Open Questions

Nenhuma — todas as decisões foram alinhadas com o usuário durante a fase de exploração.
