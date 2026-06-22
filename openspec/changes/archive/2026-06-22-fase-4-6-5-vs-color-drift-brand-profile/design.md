## Context

O BrandProfilerWithoutLogoService ignora o `intended_palette` (com papéis semânticos) que a IA já retorna na geração da VS. Em vez disso, usa `extractColorsFromBuffer` — um probe frágil (5 buckets flat, sem classificação, sem média real, sem detecção de fundo) combinado com `pickPrimaryFromPalette` que classifica por "primeiro cromático não neutro no array", produzindo papéis invertidos no `safe_color_tokens`.

O `brand-director.ts` já possui um probe maduro (`probeColors`) com classificação por papel visual, merge por ∆E, detecção de fundo por edgeRatio e filtro de artefatos. A fase extrai este probe para um módulo compartilhado e o aplica ao fluxo de VS, substituindo a heurística por validação de presença física com arbitragem por visão em caso de divergência.

## Goals / Non-Goals

**Goals:**
- Eliminar drift de cor entre `intended_palette` da IA e `safe_color_tokens` persistido
- Extrair `probeColors` do brand-director para módulo compartilhado sem alterar o fluxo de logo
- Substituir `extractColorsFromBuffer` + `pickPrimaryFromPalette` por presença física (∆E) + visão como árbitro
- Criar tipos `IntendedPalette`, `ResolvedPalette`, `ColorValidation` para rastreabilidade de proveniência
- Sincronizar `stores.accent_color` com `safe_color_tokens.accent`
- Preservar `brand_colors_chosen` apenas quando há prova de escolha manual (`manual_color_override.enabled`)
- Garantir que retry e assinaturas antigas (sem `intended_palette`) mantenham fallback heurístico funcional

**Non-Goals:**
- Integração da direção visual ao gerador de campanhas (fase futura)
- Revisão do prompt simplificado de retry ou provider diversity
- Backfill de profiles existentes
- Alteração no fluxo de logo (`curateLogoColors`, `applyGuardrail`)
- Migrações de banco (todas as colunas já existem)

## Decisions

### D1 — ColorProbe como módulo compartilhado

Extrair `probeColors()`, `ColorProbeResult`, `ColorCluster`, utilitários (`deltaE`, `hexToLab`, `rgbToHex`, `isNeutral`) e `findClosestProbeCluster` de `brand-director.ts` para `src/lib/brand-assets/color-probe.ts`.

**Alternativa considerada:** Reescrever `extractColorsFromBuffer` no brand-profiler com a mesma robustez. Rejeitada porque duplicaria lógica e criaria dois pontos de divergência. O probe do brand-director já está validado em produção para logo — compartilhá-lo garante consistência entre os dois fluxos.

**Risco:** Regressão no fluxo de logo. Mitigação: a extração é puramente mecânica (mover funções, não alterar lógica). O brand-director passa a importar de `color-probe.ts` em vez de funções locais. Testes de regressão no logo validam a refatoração.

### D2 — Presença física com 3 zonas de ∆E

| Faixa | Presença | Ação |
|---|---|---|
| ∆E ≤ 18 | `confirmed` | Aceita, mantém intended |
| 18 < ∆E ≤ 25 | `ambiguous` | Visão arbitra |
| ∆E > 25 | `not_confirmed` | Visão arbitra |

**Alternativa considerada:** Threshold único ≤ 25 (comportamento anterior). Rejeitado porque 0-18 é presença inequívoca enquanto 18 < ∆E ≤ 25 pode ser a mesma cor com variação de renderização — a visão tem contexto visual para decidir.

**Calibração:** Thresholds definidos conceitualmente. Devem ser calibrados com ∆E real (CIE76 — implementação atual) usando imagens VS reais antes do ship.

### D3 — Visão arbitra apenas papéis contestados + observed_colors + contrato bruto

Quando a visão é chamada, o prompt é condicional:

- **Happy path** (todas as cores confirmadas): prompt de análise semântica apenas — sem extração/sugestão de cores.
- **Divergência** (alguma cor ambígua/ausente): prompt de arbitragem onde a visão:
  1. Recebe `observed_colors` selecionados por:
     - Cluster mais próximo de cada cor contestada (garante representação mesmo de clusters pequenos)
     - Melhor cluster de cada classificação relevante (dominant, dark_ink, neutral, background, structural)
     - Completar por frequência decrescente até o limite de 12
     - Deduplicar por ∆E ≤ 6 entre si sem remover candidatos obrigatórios
  2. Escolhe para cada papel contestado entre `observed_colors`
  3. Retorna `RawVisionAdjudication` com `corrections` por papel
  4. Papéis confirmados são ignorados pela visão — `resolveRole()` no normalizador mantém `intended` imutável

**Contrato bruto (`RawVisionAdjudication`):**
- Todas as chaves (`primary`, `accent`, `background`, `support`) são **obrigatórias** no JSON
- Papéis não contestados retornam `null` (visão não opinou)
- Papel contestado com `null` → `no_choice` → `vision_failed`
- `support` é `SupportCorrection[]` — cada item tem `{ index, color }`. `[]` = mantém original (apenas se nenhum support contestado)
- HEX livre (fora de `observed_colors`) passa por revalidação contra o probe — aceito se ∆E ≤ 18 com algum cluster; rejeitado se ∆E > 18 com todos → `vision_failed`
- Índices inválidos (< 0 ou >= intended.support.length) são **filtrados** (ignorados) — não causam falha. A falha ocorre apenas se, após o filtro, algum índice contestado ficar sem correção correspondente → `no_choice` → `vision_failed`
- Índices duplicados violam o schema (`RawVisionAdjudicationSchema`) → parse falha → `invalid_json` → `vision_failed`

Normalizador (`normalizeAdjudication`) valida todas as regras acima e transforma `RawVisionAdjudication` → `NormalizedVisionAdjudication` com `palette: IntendedPalette` já composto (support resolvido por índice).

**Alternativa considerada:** Usar visão para re-extrair a paleta completa do zero. Rejeitado porque a visão pode alucinar cores que não existem na imagem. Restringir a `observed_colors` + revalidação contra o probe é a salvaguarda contratual.

### D4 — Suportes corrigidos por índice

`RawVisionCorrections.support` é `SupportCorrection[]` onde cada item tem `{ index, color }`. Índices inválidos (< 0 ou >= intended.support.length) são filtrados (ignorados). A composição aplica correções apenas nos índices contestados e válidos, preservando supports confirmados. Se, após o filtro, algum índice contestado não tiver correção → `no_choice` → `vision_failed`.

**Alternativa considerada:** `support: string[]` que substitui o array inteiro. Rejeitado porque se apenas `support[1]` estiver contestado, a visão precisaria repetir `support[0]` — propenso a erro e perda de dados confirmados.

### D5 — `brand_colors_chosen` preservado com prova de origem

Apenas profiles anteriores com `manual_color_override.enabled === true` têm `brand_colors_chosen` preservado. Perfis legados (onde a cor foi inferida pelo sistema) recebem `[]`.

**Alternativa considerada:** Preservar sempre o `brand_colors_chosen` anterior. Rejeitado porque perfis legados podem conter cores que o sistema classificou erroneamente como "escolha do usuário".

### D6 — ColorValidation: união discriminada por estado

O `ColorValidation` é modelado como união discriminada: estados com paleta resolvida possuem entradas por papel; `vision_failed` possui apenas auditoria da tentativa, sem campos de cor.

```typescript
// Estados com paleta resolvida
interface ColorValidationResolved {
  global_status: 'all_confirmed' | 'vision_adjudicated' | 'probe_unavailable' | 'fallback_heuristic';
  primary: ColorValidationEntry;
  accent: ColorValidationEntry;
  secondary: ColorValidationEntry;
  background: ColorValidationEntry;
  support_colors: string[];
  support_details?: ColorValidationEntry[];
  vision_adjudication?: VisionAdjudicationAudit;  // presente em vision_adjudicated
  // NOTA: safe_color_tokens é coluna separada do profile, não parte de metadata.color_validation.
  // A relação: metadata.color_validation.<role>.resolved == safe_color_tokens.<role>
}

// Estado de falha — sem paleta
interface ColorValidationFailed {
  global_status: 'vision_failed';
  vision_adjudication: VisionAdjudicationAudit;     // obrigatório, sempre status: 'failed'
  // NOTA: sem primary, accent, secondary, background, support_colors
  // safe_color_tokens → default do banco: {}
}
```

Cada `ColorValidationEntry` tem `resolved_from_cluster?` (opcional — presente apenas quando o probe confirmou a presença ou a visão escolheu um cluster) e `note?` (opcional — explicação contextual).

**Auditoria de sucesso da visão:** Quando `global_status === 'vision_adjudicated'`, `vision_adjudication` registra `{ status: 'success', reason, prompt_suffix }` onde `prompt_suffix` é uma `string` que identifica a variante de prompt utilizada (ex: `'analyze_and_correct_primary'`, `'analyze_and_correct_support'`).

**Profile failed:** Quando `global_status === 'vision_failed'`, profile `status: 'failed'`, `vision_adjudication` registra `{ status: 'failed', reason: VisionFailureReason, attemptedAt }`. O `safe_color_tokens` fica `{}` (default do banco) — consumidor ignora quando `status === 'failed'`. A assinatura visual permanece ativa independentemente; o profile anterior permanece `synced` se existir.

**Alternativa considerada:** Bloquear a aprovação da VS quando o profiler falha. Rejeitado porque a assinatura já foi gerada e aprovada — a falha é no profile, não na VS. O retry do profiler é possível sem regenerar a VS.

### D7 — Matriz de fallbacks

O fluxo do profiler tem 3 eixos de decisão que produzem 5 caminhos possíveis:

| intendedPalette | Probe | Caminho | global_status | safe_color_tokens |
|---|---|---|---|---|
| Válido | OK + todas ≤ 18 | Happy path | `all_confirmed` | `intendedToResolved(intended, intended.support)` |
| Válido | OK + alguma > 18 | Divergência → visão | `vision_adjudicated` ou `vision_failed` | Resolvido pela visão ou `{}` |
| Válido | Vazio/exceção | Confia na intenção | `probe_unavailable` | `intendedToResolved(intended, intended.support)` |
| Nulo (retry/legado) | OK | Heurística com probe | `fallback_heuristic` | Probe → primary = primeiro dominante não neutro; accent = segundo dominante não neutro ou primeiro structural; secondary = accent; background = primeiro background_candidate ou cluster de maior edgeRatio |
| Nulo (retry/legado) | Vazio | brandColor ou SEGMENT_FALLBACK | `fallback_heuristic` | `{ primary: brandColor ?? SEGMENT, secondary: brandColor ?? SEGMENT, ... }` |

Retry e assinaturas antigas (intendedPalette nulo) **nunca** chamam visão para arbitragem de cores — seguem heurística pura, com a visão sendo chamada apenas para análise semântica (analyze_only). A visão só arbitra cores em divergência com intendedPalette válido.

### D8 — Fluxo de dados da intenção (end-to-end)

O `intended_palette` percorre 5 estágios:

```
1. GERAÇÃO (identity-art-director.ts)
   Prompt → IA → JSON bruto
   normalizeIntendedPalette(raw) → IntendedPalette normalizado (HEX maiúsculas, validação de formato)
   Persiste em: metadata.artDirectorOutput.intended_palette

2. APROVAÇÃO (approve/route.ts)
   Carrega signature.metadata.artDirectorOutput.intended_palette
   Reaplica normalizeIntendedPalette() (idempotente)
   Carrega previousBrandColors do último profile synced (se manual_color_override.enabled)
   Passa { intendedPalette, previousBrandColors } para profiler.generate()

3. PROFILER (brand-profiler.ts)
   Recebe BrandProfilerInput { intendedPalette, previousBrandColors, ... }
   intendedPalette null? → fallback (D7)
   intendedPalette válido? → ColorProbe + validação de presença

4. RESOLUÇÃO
   Se vision_failed:
     profile = { status: 'failed', metadata: { color_validation: { global_status: 'vision_failed', ... } } }
     return  // ANTES de sincronizar stores ou inferidos
   safe_color_tokens = resolved_palette (tipo ResolvedPalette)
   brand_colors_chosen = previousBrandColors ?? []
   metadata.color_validation = { global_status, primary, accent, secondary, background, ... }

5. SINCRONIZAÇÃO (só executa se NÃO vision_failed)
   stores.brand_color = safe_color_tokens.primary
   stores.accent_color = safe_color_tokens.accent
   inferred_primary_color = safe_color_tokens.primary
   inferred_accent_color = safe_color_tokens.accent
```

### D9 — ResolvedPalette e sincronização de stores

`ResolvedPalette` é o formato final de `safe_color_tokens`, convertido explicitamente de `IntendedPalette`:

```typescript
interface ResolvedPalette {
  primary: string;
  secondary: string;      // supportResolved[0] ?? primary
  accent: string;
  background: string;
}

function intendedToResolved(
  intended: IntendedPalette,
  supportResolved: string[]
): ResolvedPalette {
  return {
    primary: intended.primary,
    secondary: supportResolved[0] ?? intended.primary,
    accent: intended.accent,
    background: intended.background,
  };
}
```

Após resolver a paleta, o profiler sincroniza:
- `stores.brand_color = safe_color_tokens.primary`
- `stores.accent_color = safe_color_tokens.accent`
- `inferred_primary_color = safe_color_tokens.primary`
- `inferred_accent_color = safe_color_tokens.accent`

**Alternativa considerada:** Manter `secondary` como campo calculado na query. Rejeitado porque `safe_color_tokens` é jsonb e precisa ser autocontido — consumidores não devem precisar recompor `secondary` a partir de `support[]`.

## Risks / Trade-offs

| Risco | Impacto | Mitigação |
|---|---|---|
| Extração do probe quebra brand-director.ts | Fluxo de logo afetado | Extração puramente mecânica + testes de regressão no logo. `curateLogoColors` e `applyGuardrail` não são alterados |
| Thresholds ∆E (≤18, 18 < ∆E ≤ 25, >25) não calibrados para imagens VS reais | Falsos positivos/negativos na presença | Calibração obrigatória com imagens reais antes do ship. CIE76 (implementação atual) documentada como baseline |
| Visão alucina cor mesmo restrita a observed_colors | Correção errada | Revalidação contratual: se HEX livre, probe revalida — só aceita se ∆E ≤ 18 com algum cluster |
| Divergência frequente (IA consistentemente declara cores que não existem) | Custo extra de visão em cada aprovação | Investigar qualidade da geração VS: prompt do Art Director pode estar desalinhado da imagem gerada |
| Retry sem intended_palette | Cores imprecisas (heurística) | Aceito — fase futura de melhoria do retry. Fallback conservador existe e funciona |
