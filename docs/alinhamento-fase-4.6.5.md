# Alinhamento Fase 4.6.5 — VS Color Drift & Brand Profile Alignment

## Nomenclatura das Fases 4.6

```
4.6  — Store Form Adjusts                    (fase mãe)
 ├── 4.6.1 — Text Only Coverage              (concluída)
 ├── 4.6.2 — Visual Direction Drift Detection (concluída)
 ├── 4.6.3 — Logo State Lifecycle            (concluída)
 ├── 4.6.4 — Visual Signature fluxo          (concluída)
 ├── 4.6.5 — VS Color Drift & Profile Fix    ← esta fase
 └── 4.6.x — Transições entre estados        (pendente)
```

Esta fase (4.6.5) trata do desalinhamento entre as cores que a IA retorna ao gerar a assinatura visual e as cores efetivamente persistidas no brand profile.

---

## Propósito

Eliminar o drift de cores no fluxo de aprovação de assinatura visual, conectando o `intended_palette` (com papéis semânticos — primary, accent, support, background) que a IA já retorna na geração da VS ao `BrandProfilerWithoutLogoService`, substituindo a heurística cega do `extractColorsFromBuffer` + `pickPrimaryFromPalette` por:
1. `ColorProbe` reutilizável que verifica **presença física** de cada cor na imagem
2. **Visão como árbitro** apenas quando uma cor declarada não existe ou tem presença ambígua
3. Sharp **nunca reclassifica papéis** — confirma existência, não decide

**O que NÃO é:**
- Integração da direção visual ao gerador de campanhas (fase futura)
- Revisão do retry com prompt simplificado ou provider diversity (fase futura)
- Backfill de profiles existentes (só perfis novos terão o fix)

---

## O Drift (rastreio completo)

```
GERAÇÃO DA VS (identity-art-director.ts)
─────────────────────────────────────────
  Prompt → IA → imagem + JSON metadata:
  ┌──────────────────────────────────────┐
  │ intended_palette {                    │
  │   primary:    "#B96F63",             │ ← IA SABE o papel
  │   accent:     "#F5A623",             │ ← IA SABE o papel
  │   support:    ["#2E6B9E"],           │
  │   background: "#F8F9FA"              │ ← IA SABE o papel
  │ }                                     │
  │ color_usage {                         │
  │   primary:   "cor principal marca",   │
  │   accent:    "destaque elementos",    │
  │   support:   "cores de apoio",        │
  │   background:"fundo assinatura"       │
  │ }                                     │
  └──────────────────────────────────────┘
         │
         ▼
  Parseado → metadataArtDirectorOutput    ✅
         │
         ▼
  UPDATE signature SET metadata = {       ✅
    ..., artDirectorOutput: {
      visual_direction, content_used,
      intended_palette, color_usage
    }
  }


APROVAÇÃO (approve/route.ts)
─────────────────────────────
  Carrega signature.metadata.artDirectorOutput   ✅
  → TEM intended_palette e color_usage
         │
         ▼
  Passa para BrandProfilerInput como             ❌
  artDirectorOutput: VisualSignatureArtDirectorOutput
  → tipo NÃO TEM os campos intended_palette
    nem color_usage → dados existem em runtime
    mas são ignorados


BRAND PROFILER (brand-profiler.ts)
───────────────────────────────────
  1. extractColorsFromBuffer() (linha 128):        ❌ PROBE FRACO
     └── resize 150×150, quantiza 32px buckets
     └── remove neutrais (isNeutral)
     └── só 5 buckets flat, SEM classificação
     └── SEM média real (usa bucket quantizado)
     └── SEM detecção de fundo
     └── SEM clusters estruturais
     └── Perde cores de fundo (creme, branco, cinza)
  
  2. Modelo de IA com visão (linhas 267-287):      ❌ IGNORADO
     └── retorna cores + papéis
     └── código descarta (linhas 292-295):
         "Colors MUST come from deterministic extraction only"
  
  3. pickPrimaryFromPalette(["#F5A623","#B96F63",  ❌ HEURÍSTICA
                             "#F8F9FA"]):
     └── "primeiro cromático não neutro = primary"
     └── Se IA usou #F8F9FA fundo + #B96F63 primary
         → ordem no array define papel → PAPÉIS INVERTIDOS
  
  4. safe_color_tokens = {                         ❌
       primary: palpite cego do sort,
       accent: palpite cego,
       background: "#FFFFFF" hardcoded
     }
```

---

## O Fix — Visão Geral

```
Diretor declara intenção e papéis (intended_palette)
         │
         ▼
   ColorProbe verifica SOMENTE presença física
   (cada cor declarada existe na imagem?)
         │
         ├── Todas confirmadas → confia no Diretor  ✅
          │     safe_color_tokens = intendedToResolved(intendedPalette, intendedPalette.support)
         │
          └── Alguma ambígua ou ausente → Visão arbitra         🔄
               (mesmo modelo já chamado para
                análise semântica, prompt
                condicional: arbitrar papéis
                contestados)
         │
         ▼
   brand_colors_chosen = preservado (se escolhas manuais)
                        ou [] (se nenhuma)
```

---

## Decisões

### Decisão: ColorProbe reutilizável

O `probeColors()` do `brand-director.ts` (linhas 114-256) é significativamente mais robusto que o `extractColorsFromBuffer()` do `brand-profiler.ts`:

| Característica | brand-director probe | VS profiler atual |
|---|---|---|
| Resolução | 150×150 com flatten | 150×150 sem flatten |
| Buckets | 32px com **média real** dentro do bucket | 32px **sem média** (usa valor quantizado) |
| Classificação | dominant, dark_ink, neutral, background, structural, transition | Nenhuma (array flat) |
| Merge ∆E ≤ 12 | ✅ | ❌ |
| Detecção de fundo | edgeRatio + frequência interior | ❌ (remove neutrais) |
| Detecção de artefato | isInterpolation + tamanho | ❌ |
| Cobertura de background | background_candidates preservados | ❌ (isNeutral descarta) |

**Decisão:** Extrair `probeColors()`, `ColorProbeResult`, `ColorCluster` e funções auxiliares (`deltaE`, `hexToLab`, `rgbToHex`, `isNeutral`) para um módulo compartilhado `src/lib/brand-assets/color-probe.ts`. Ambos `brand-director.ts` e `brand-profiler.ts` passam a consumir o mesmo probe.

O `brand-director.ts` mantém sua lógica de `curateLogoColors` e `applyGuardrail` específicas para logo. O `brand-profiler.ts` usa o probe compartilhado apenas para verificar **presença física** das cores declaradas, não para classificar papéis nem aplicar fallback estatístico. O papel é decidido exclusivamente pelo Diretor (ou pela Visão em caso de divergência).

### Decisão: `IntendedPalette` como tipo separado

Criar um tipo `IntendedPalette` compartilhado, sem poluir o tipo legado `VisualSignatureArtDirectorOutput`:

```typescript
// types.ts ou novo arquivo color-types.ts

export interface IntendedPalette {
  primary: string;
  accent: string;
  support: string[];
  background: string;
}

// ResolvedPalette é o formato final de safe_color_tokens.
// Difere de IntendedPalette: não tem support[] (substituído por secondary).
export interface ResolvedPalette {
  primary: string;
  secondary: string;    // support[0] resolvido, ou primary se vazio
  accent: string;
  background: string;
}

export interface ColorUsage {
  primary: string;
  accent: string;
  support: string;
  background: string;
}
```

Conversão explícita de `IntendedPalette` para `ResolvedPalette`:

```typescript
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

`supportResolved` é o resultado da validação de presença sobre cada item de `intended.support[]`. Se vazio, `secondary = primary`.

Função de composição de supports — aplica correções da visão mantendo supports não contestados (contrato `SupportCorrection` definido na seção de arbitragem):

```typescript
function composeSupport(
  original: string[],
  contestedIndices: number[],
  corrections: SupportCorrection[]
): string[] {
  const result = [...original];
  for (const { index, color } of corrections) {
    if (contestedIndices.includes(index)) {
      result[index] = color;
    }
  }
  return result;
}
```

O JSON retornado pela IA na geração da VS é normalizado por um mesmo normalizador idempotente (Zod ou validação manual), usado tanto na persistência quanto no approve route. O normalizador pode ser chamado múltiplas vezes — o resultado é sempre o mesmo para a mesma entrada. O approve route consome o metadado já persistido e, por segurança, aplica o mesmo normalizador novamente (idempotente, sem efeito colateral).

### Decisão: `BrandProfilerInput` recebe `IntendedPalette` separado

```typescript
export interface BrandProfilerInput {
  // campos existentes...
  artDirectorOutput: VisualSignatureArtDirectorOutput; // mantido para compat
  intendedPalette: IntendedPalette | null;              // NOVO
  previousBrandColors?: string[];                       // NOVO: escolhas manuais do user
}
```

`intendedPalette` é extraído do `metadata.artDirectorOutput` no approve route e passado explicitamente. Quando `null` (retry sem metadata, VS archived antiga), o comportamento cai para o fallback.

`previousBrandColors` carrega as cores escolhidas manualmente pelo usuário do profile anterior **somente se houver evidência de escolha explícita**. A evidência é:

```typescript
// Profile anterior tem manual_color_override.enabled === true
const previousProfile = await getPreviousSyncedProfile(storeId);
const hasExplicitChoice = previousProfile?.manual_color_override?.enabled === true;

previousBrandColors = hasExplicitChoice
  ? previousProfile.brand_colors_chosen  // escolha manual genuína
  : [];                                   // sem evidência → trata como novo
```

Isso impede que registros legados (que podem conter cores inferidas indevidamente) sejam preservados como "escolha do usuário". Se não há prova de escolha manual, `previousBrandColors = []`.

O profile consultado é o **profile synced anterior mais recente** (antes da transição para VS). O approve route extrai esse profile antes de chamar o BrandProfiler.

### Decisão: Contrato da resposta de arbitragem (visão)

Quando a visão é chamada para arbitrar divergência, sua resposta segue dois contratos: um **bruto** (retornado pela IA) e um **normalizado** (já com support composto no formato `IntendedPalette`).

```typescript
// ── Contrato bruto (retornado pela visão) ──

export interface RawVisionAdjudication {
  corrections: RawVisionCorrections;
  reason: string;               // obrigatório: por que escolheu essa cor
}

export interface RawVisionCorrections {
  primary: string | null;
  accent: string | null;
  background: string | null;
  support: SupportCorrection[];   // vazio = mantém intended.support;
                                  // preenchido = correções por índice
}

export interface SupportCorrection {
  index: number;
  color: string;
}

// ── Contrato normalizado (pós `normalizeAdjudication`) ──

export interface NormalizedVisionAdjudication {
  palette: IntendedPalette;       // support já totalmente composto
  reason: string;
}
```

Regras:

1. A visão SÓ pode responder com cores presentes em `observed_colors` passado no prompt. Se retornar HEX livre, passa por revalidação contra o probe (`findClosestProbeCluster`). Se o ∆E > 18 com todos os clusters → resposta inválida → `vision_failed`.

2. **Papel não contestado** (presença já confirmada pelo probe) → `null` → mantém `intended` original.

3. **Papel contestado** (presença ambígua ou ausente → visão foi chamada especificamente para arbitrar) → `null` é considerado `no_choice` → `vision_failed`. O normalizador recebe a lista de papéis contestados e valida que cada um tem correção não-nula ANTES de aplicar fallback.

4. `support: []` na resposta bruta significa "mantenha o support[] original" **apenas quando nenhum support estiver contestado**. Se algum support está contestado, `support: []` = recusou arbitrar → `no_choice` → `vision_failed`.

5. Cada `SupportCorrection` referencia o **índice original** em `intended.support[]`. A correção só é aplicada se o índice está na lista de contestados. Isso preserva supports confirmados mesmo quando supports vizinhos são corrigidos.

6. O JSON bruto **deve conter todas as chaves** (`primary`, `accent`, `background`, `support`). Papéis não contestados usam `null`. Isso evita ambiguidade entre "não informado" e "recusou arbitrar".

7. **Cobertura total**: após filtrar índices válidos, o normalizador valida que **todo** support contestado tem uma `SupportCorrection` correspondente. Se algum índice faltar → `no_choice` → `vision_failed`.

8. Normalização runtime (determinística — mesma entrada sempre produz a mesma saída):

```typescript
function normalizeAdjudication(
  raw: unknown,
  fallback: IntendedPalette,
  contestedRoles: Array<'primary' | 'accent' | 'background'>,
  contestedSupportIndices: number[]
): NormalizedVisionAdjudication {
  const parsed = RawVisionAdjudicationSchema.parse(raw);

  // ── Resolve primary, accent, background (mesmo critério antes da ramificação) ──
  // Contestado: exige correção não-nula
  // Não contestado: mantém intended, ignora qualquer correção da visão
  function resolveRole(role: 'primary' | 'accent' | 'background'): string {
    if (contestedRoles.includes(role)) {
      if (!parsed.corrections[role]) {
        throw new VisionAdjudicationError(`no_choice: ${role}`);
      }
      return parsed.corrections[role]!.toUpperCase();
    }
    // Não contestado: ignora correção da visão, mantém intended
    return fallback[role];
  }

  const primary = resolveRole('primary');
  const accent = resolveRole('accent');
  const background = resolveRole('background');

  // ── Valida cobertura total dos supports contestados ──
  if (contestedSupportIndices.length > 0) {
    if (parsed.corrections.support.length === 0) {
      throw new VisionAdjudicationError('no_choice: support');
    }

    // Schema já rejeita índices duplicados → invalid_json
    // Índices inválidos são filtrados abaixo

    const validCorrections = parsed.corrections.support.filter(
      sc => sc.index >= 0 && sc.index < fallback.support.length
    );

    for (const idx of contestedSupportIndices) {
      if (!validCorrections.some(c => c.index === idx)) {
        throw new VisionAdjudicationError(`no_choice: support[${idx}]`);
      }
    }

    const resolvedSupport = composeSupport(
      fallback.support,
      contestedSupportIndices,
      validCorrections.map(sc => ({
        index: sc.index,
        color: sc.color.toUpperCase(),
      }))
    );

    return {
      palette: { primary, accent, background, support: resolvedSupport },
      reason: parsed.reason,
    };
  }

  // ── Nenhum support contestado ──
  return {
    palette: { primary, accent, background, support: fallback.support },
    reason: parsed.reason,
  };
}
```

### Decisão: Presença física + Visão como árbitro

A validação troca "classificação por papel com fallback estatístico" por "confirmação de existência com arbitragem por visão":

```
Happy Path (todas as cores com presença confirmada):
────────────────────────────────────────────────────
  Para cada cor declarada em intended_palette:
    primary, accent, support[], background:
      → findClosestProbeCluster(cor, ALL_NON_ARTIFACT)
      ├── ∆E ≤ 18        → "confirmed"        (presença inequívoca)
      ├── 18 < ∆E ≤ 25   → "ambiguous"         (visão arbitra)
      └── ∆E > 25        → "not_confirmed"     (visão arbitra)

  Se TODAS com ∆E ≤ 18:
    resolved_palette = intendedToResolved(
      intendedPalette, intendedPalette.support)
    // secondary = intended.support[0] ?? intended.primary

  O Sharp NÃO reclassifica nada. Ele apenas confirma:
  "Sim, as cores declaradas existem materialmente na imagem."
  Isso evita que um azul claro de fundo vire primary
  só porque ocupa mais pixels.

  Nota: os thresholds ∆E devem ser calibrados com imagens
  reais já geradas. Os valores acima são o ponto de partida.


Caminho de Divergência (presença ambígua ou ausente):
───────────────────────────────────────────────────────
  Quando há cores com ∆E > 18 (ambiguidade ou ausência),
  a visão arbitra. Para isso, a visão recebe:

  1. Os clusters observados (cores que realmente existem
     na imagem, extraídas pelo probe):
     observed_colors = [
       "#B96F63",    // cluster dominante
       "#F5A623",    // cluster structural
       "#F8F9FA",    // cluster background
       "#E0A080",    // cluster dominante secundário
     ]

  2. O papel contestado (ex: "primary")
     + as cores declaradas e os ∆E de cada uma

  A visão DEVE escolher entre os observed_colors qual
  corresponde ao papel contestado — NÃO pode inventar
  um HEX arbitrário.

  Prompt:
    "A cor #B96F63 foi declarada como primary mas não foi
     encontrada na imagem (ou tem presença ambígua).
     As cores que realmente existem na imagem são:
     ["#B96F63", "#F5A623", "#F8F9FA", "#E0A080"]

     Analise a imagem e responda qual destas cores está
     aplicada ao nome da loja (primary). Escolha
     exclusivamente entre as cores listadas."

  3. Se a visão retornar um HEX livre (não presente em
     observed_colors), esse HEX deve passar novamente
     pelo probe (findClosestProbeCluster):
     ├── ∆E ≤ 18 em observed_colors → aceito
     └── senão → rejeitado, profile 'failed'

  Isso ancora a correção na realidade da imagem e
  impede segunda alucinação.


∆E thresholds para "existência":
──────────────────────────────────
  ∆E ≤ 18        → presença confirmada
  18 < ∆E ≤ 25   → presença ambígua (visão arbitra)
  ∆E > 25        → não confirmada (visão arbitra)

  Clusters considerados artefato (ignorados):
  suspected_transitions, clusters com frequency < 0.005

  Todos os demais clusters são válidos para verificação
  de existência: dominant_pixels, dark_ink_candidates,
  neutral_candidates, background_candidates,
  small_but_structural.

  Limite de observed_colors para divergência:
  ────────────────────────────────────────
  Quando a visão é chamada, observed_colors é derivado
  dos clusters não-artefato com as regras:

  1. Cluster mais próximo de cada cor contestada
     (findClosestProbeCluster) — garante que a visão
     possa escolher a cor fisicamente mais similar
     mesmo que seja um cluster pequeno.
  2. Melhor cluster de cada classificação relevante
     (dominant, dark_ink, neutral, background, structural)
     — garante representação dos diferentes papéis visuais.
  3. Completar por frequência decrescente até o limite
     de 12 clusters.
  4. Deduplicar por ∆E ≤ 6 entre si (clusters muito
     próximos viram um só, mantendo o de maior frequência),
     sem remover candidatos obrigatórios dos passos 1 e 2.
  5. O array final serve como "menu de cores" para a visão
     escolher, evitando prompt longo e candidatos
     quase idênticos.


### Decisão: Probe vazio ou com erro

Quando o `probeColors()` retorna resultado vazio (exceção, imagem inválida, ou todos os pixels descartados):

| Cenário | Comportamento | Status |
|---|---|---|
| `intendedPalette` válido + probe vazio | Mantém `intendedPalette` via `intendedToResolved(intendedPalette, intendedPalette.support)` (sem validação de presença) | `probe_unavailable` |
| `intendedPalette` nulo + probe vazio | Fallback: `store.brandColor` existente → `primary`; `accent` deduzido; `background` = `'#FFFFFF'` | `fallback_heuristic` |

**Nunca degradar para `#666666`.** Aprovar uma intenção válida sem confirmação é melhor que substituir silenciosamente por cinza.

### Decisão: `support[]` — presença + `secondary` + `ResolvedPalette`

Cada item de `support[]` segue o mesmo modelo de presença das demais cores (∆E ≤ 18 confirmado, 18 < ∆E ≤ 25 ambíguo, ∆E > 25 ausente). Itens ambíguos ou ausentes são submetidos à visão junto com os observed_colors.

O resultado da validação de support é um array de cores resolvidas (`supportResolved`). A conversão para `ResolvedPalette` usa:

```
secondary = supportResolved[0] ?? primary
```

A resolução de `secondary` segue:

| Cenário | Resultado |
|---|---|
| `support[0]` com ∆E ≤ 18 | `secondary = support[0]` |
| `support[0]` ambíguo ou ausente, visão escolhe | `secondary = cor escolhida pela visão` |
| `support[]` vazio | `secondary = primary` |
| Visão falha | Profile `failed` |

`safe_color_tokens` é do tipo `ResolvedPalette`, populado no final do fluxo via `intendedToResolved()`.

### Decisão: `brand_colors_chosen` — preservar escolhas explícitas

Conforme `store-brand-profile/spec.md` linha 303, `brand_colors_chosen` é exclusivamente para cores escolhidas manualmente pelo usuário. Para VS gerada, existem dois cenários:

**Cenário A — Sem escolhas anteriores (caso padrão):**
```typescript
brand_colors_chosen = []
safe_color_tokens = paleta validada do intended_palette
```

**Cenário B — Com escolhas explícitas anteriores** (usuário escolheu cores manualmente no form antes de gerar VS):
```typescript
brand_colors_chosen = cores escolhidas anteriormente  // preservado
safe_color_tokens = paleta validada do intended_palette  // independente
```

Aprovar uma VS **não** substitui nem apaga escolhas manuais do usuário. O BrandProfiler precisa receber as cores anteriores (via `BrandProfilerInput` ou buscando do profile anterior) para:
1. Preservar `brand_colors_chosen` no novo profile
2. Informar ao modelo de IA que o usuário tem preferências cromáticas (sinal, não vínculo)

### Decisão: Auditoria de proveniência — `color_validation`

Persistir em `metadata.color_validation` o relatório de validação de cada cor:

**Happy path (todas confirmadas):**

```json
{
  "color_validation": {
    "global_status": "all_confirmed",
    "primary": {
      "intended": "#B96F63",
      "presence": "confirmed",
      "delta_e": 4.2,
      "role_source": "art_director",
      "resolution": "accepted",
      "resolved_from_cluster": {
        "hex": "#B96F63",
        "classification": "dominant",
        "frequency": 0.12,
        "delta_e": 4.2
      }
    },
    "accent": {
      "intended": "#F5A623",
      "presence": "confirmed",
      "delta_e": 6.1,
      "role_source": "art_director",
      "resolution": "accepted"
    },
    "background": {
      "intended": "#F8F9FA",
      "presence": "confirmed",
      "delta_e": 1.8,
      "role_source": "art_director",
      "resolution": "accepted"
    },
    "support_colors": ["#2E6B9E", "#7BC4A8"]
  }
}
```

**Caminho de divergência (visão arbitrou):**

```json
{
  "color_validation": {
    "global_status": "vision_adjudicated",
    "primary": {
      "intended": "#B96F63",
      "presence": "not_confirmed",
      "role_source": "vision_adjudication",
      "resolved": "#C06040",
      "resolution": "corrected_by_vision"
    },
    "accent": {
      "intended": "#F5A623",
      "presence": "confirmed",
      "delta_e": 5.1,
      "role_source": "art_director",
      "resolution": "accepted"
    },
    "background": {
      "intended": "#F8F9FA",
      "presence": "confirmed",
      "delta_e": 1.8,
      "role_source": "art_director",
      "resolution": "accepted"
    },
    "vision_adjudication": {
      "reason": "primary not found in image",
      "prompt_suffix": "analyze_and_correct_primary"
    }
  }
}
```

**Probe indisponível:**

```json
{
  "color_validation": {
    "global_status": "probe_unavailable",
    "primary": {
      "intended": "#B96F63",
      "presence": "unchecked",
      "role_source": "art_director",
      "resolution": "accepted_unverified"
    },
    "accent": { ... },
    "background": { ... }
  }
}
```
```

Isso torna warnings, fallbacks e futuros bugs auditáveis sem depender de console.log.

### Decisão: Sincronização de `stores.brand_color` e `stores.accent_color`

O código atual (brand-profiler.ts linha 325-331) sincroniza apenas `brand_color`:

```typescript
await supabase.from('stores').update({ brand_color: result.inferred_primary_color })
```

**Decisão:** Sincronizar também `accent_color` com o valor resolvido de `safe_color_tokens.accent`. A omissão atual cria divergência entre o profile (que tem a cor correta) e a store (que pode ter um valor stale). O frontend ao ler `store.accent_color` pode mostrar uma cor diferente da que o profile tem.

Além disso, `brand_color` deixa de ser sincronizado com `inferred_primary_color` e passa a ser sincronizado com `safe_color_tokens.primary` (que é o valor final, pós-guardrail).

### Decisão: Falha na arbitragem da visão

Quando a visão é chamada para arbitrar divergências, podem ocorrer falhas:

| Falha | Comportamento |
|---|---|
| API da IA falha (timeout, erro) | Profile persistido como `failed`. Assinatura aprovada permanece ativa. Usuário pode tentar "Reprocessar direção visual" |
| Visão retorna JSON inválido | Profile persistido como `failed` |
| Visão não escolhe uma cor (devolve `null`) | Profile persistido como `failed` |
| Visão retorna HEX fora dos `observed_colors` | HEX rejeitado se ∆E > 18 com todos os clusters. Profile `failed` |
| Visão retorna HEX fora dos `observed_colors` com ∆E ≤ 18 | HEX aceito (ancorado no probe indiretamente) |

Em todos os casos: **não persistir paleta corrigida incerta**. O profile `failed` permite retry sem perder a assinatura aprovada. O BrandProfiler pode ser chamado novamente (re-process) sem consumir cota de geração de VS.

### Decisão: Fallback sem `IntendedPalette` — sem recalculo de perfis antigos

Quando `intendedPalette` é `null` (retry sem metadata, VS archived antiga, ou JSON inválido), o comportamento é:

1. Sharp `probeColors()` (o compartilhado, não o `extractColorsFromBuffer` antigo)
2. Heurística: o primeiro cluster dominante não neutro vira `primary`, o segundo vira `accent`, `background` vem dos `background_candidates`
3. Modelo de IA com visão → SÓ análise semântica (estilo, tom, personalidade, diretrizes)
4. Sincroniza `stores.brand_color` e `stores.accent_color`

**Usar as cores do modelo de IA com visão como fallback é uma melhoria futura, fora de escopo agora.**

**Sem backfill:** perfis já persistidos (`store_brand_profiles` com status synced/outdated) não são recalculados. O profiler reutiliza profiles existentes (brand-profiler.ts linha 167-193) antes de executar qualquer análise nova. A correção só se aplica a:

- Novas VS geradas após o deploy desta fase
- VS existentes que não têm profile (re-profile sob demanda)

---

## Mudanças no Código

### 1. Módulo compartilhado — `src/lib/brand-assets/color-probe.ts`

Extrair do `brand-director.ts` para um módulo independente:

- `probeColors(buffer: Buffer): Promise<ColorProbeResult>`
- `ColorProbeResult` (dominant_pixels, dark_ink_candidates, neutral_candidates, background_candidates, small_but_structural, suspected_transitions)
- `ColorCluster`
- `deltaE(lab1, lab2): number`
- `hexToLab(hex): [number, number, number]`
- `rgbToHex(r, g, b): string`
- `findClosestProbeCluster(hex, clusters): { cluster, deltaE }`
- Constantes: `STRONG_MATCH_DELTA_E = 12`, `ACCEPTABLE_MATCH_DELTA_E = 18`, `LOOSE_MATCH_DELTA_E = 25`

`brand-director.ts` passa a importar o probe do módulo compartilhado. `brand-profiler.ts` também.

### 2. Types — `IntendedPalette` e `ColorUsage`

```typescript
// src/lib/visual-signature/types.ts

export interface IntendedPalette {
  primary: string;
  accent: string;
  support: string[];
  background: string;
}

export interface ColorUsage {
  primary: string;
  accent: string;
  support: string;
  background: string;
}

export interface ColorValidationEntry {
  intended: string | null;          // null quando fallback_heuristic (sem intenção anterior)
  resolved: string;
  presence: 'confirmed' | 'ambiguous' | 'not_confirmed' | 'unchecked';
  delta_e: number | null;           // null quando probe_unavailable ou fallback_heuristic
  role_source: 'art_director' | 'vision_adjudication' | 'heuristic';
  resolution: 'accepted' | 'accepted_unverified' | 'corrected_by_vision' | 'selected_by_heuristic';
  resolved_from_cluster?: {         // cluster que sustentou a presença ou escolha
    hex: string;
    classification: string;
    frequency: number;
    delta_e: number;
  } | null;
  note?: string;                    // explicação contextual (ex: "support vazio → secondary = primary")
}

// ── ColorValidation: união discriminada ──
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
}

// Estado de falha — sem paleta
interface ColorValidationFailed {
  global_status: 'vision_failed';
  vision_adjudication: VisionAdjudicationAudit;     // obrigatório, sempre status: 'failed'
}

type ColorValidation = ColorValidationResolved | ColorValidationFailed;

// Union discriminada: sucesso (adjudicou) vs falha (não conseguiu arbitrar)
export type VisionAdjudicationAudit =
  | {
      status: 'success';
      reason: string;
      prompt_suffix: string;       // identifica variante do prompt (ex: 'analyze_and_correct_primary')
    }
  | {
      status: 'failed';
      reason: VisionFailureReason;
      details?: string;
      attemptedAt: string;        // ISO timestamp
    };

export type VisionFailureReason =
  | 'invalid_json'
  | 'api_error'
  | 'no_choice'
  | 'hex_outside_observed_colors';
```

### 3. Normalização do JSON com validação de runtime

No `identity-art-director.ts` (ou em um normalizador separado), o JSON bruto retornado pela IA é validado uma única vez:

```typescript
function normalizeIntendedPalette(raw: unknown): IntendedPalette | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const primary = typeof p.primary === 'string' && /^#[0-9A-Fa-f]{6}$/.test(p.primary) ? p.primary.toUpperCase() : null;
  const accent = typeof p.accent === 'string' && /^#[0-9A-Fa-f]{6}$/.test(p.accent) ? p.accent.toUpperCase() : null;
  const background = typeof p.background === 'string' && /^#[0-9A-Fa-f]{6}$/.test(p.background) ? p.background.toUpperCase() : null;
  const support = Array.isArray(p.support)
    ? p.support.filter((c): c is string => typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c)).map(c => c.toUpperCase())
    : [];
  if (!primary || !accent || !background) return null;
  return { primary, accent, support, background };
}
```

O resultado normalizado é persistido em `metadata.artDirectorOutput.intended_palette` como dado já validado.

### 4. approve/route.ts — Extrair `IntendedPalette` validado

```typescript
const metadata = signature.metadata ?? {};
const artDirMeta = (metadata as any).artDirectorOutput ?? {};
const intendedPalette: IntendedPalette | null = artDirMeta.intended_palette
  ? normalizeIntendedPalette(artDirMeta.intended_palette)
  : null;

const previousBrandColors = await loadPreviousBrandColors(storeId);

const result = await profiler.generate({
  // ... campos existentes ...
  intendedPalette,
  previousBrandColors,
});
```

### 5. brand-profiler.ts — Fluxo de validação

```
generate(input):
  1. intendedPalette = input.intendedPalette
     previousColors = input.previousBrandColors

  2. Se intendedPalette NÃO é null:
     a. probeColors(imagem) → ColorProbeResult
      b. Se probe vazio:
         // resolved_palette precisa de secondary (IntendedPalette não tem)
         resolved_palette = intendedToResolved(
           intendedPalette, intendedPalette.support)
         divergencias = []
         color_validation = { global_status: "probe_unavailable" }
         pula para passo 4
     c. Verifica PRESENÇA FÍSICA de cada cor:
        Para cada cor em intendedPalette (primary, accent,
        cada support, background):
            match = findClosestProbeCluster(cor, ALL_NON_ARTIFACT)
           ├── match.deltaE ≤ 18    → "confirmed"
           ├── 18 < match.deltaE ≤ 25 → "ambiguous"
           └── match.deltaE > 25    → "not_confirmed"
      d. Se TODAS com deltaE <= 18 (happy path):
         resolved_palette = intendedToResolved(
           intendedPalette, intendedPalette.support)
         color_validation = { global_status: "all_confirmed" }
         prompt_visao = "semantica"
      e. Senão (divergência):
         observed_colors = dedupAndLimit(
           nonArtifactClusters, max = 12, sortBy = frequency,
           mustInclude = [closestClusterPerContestedColor,
                          bestPerClassification])
         cores_contestadas = [cores com deltaE > 18]
         prompt_visao = "divergencia"
         adjudication = visao.adjudicate(
           observed_colors, cores_contestadas, intendedPalette)
         // adjudication.palette é IntendedPalette com support já composto
         se adjudication falha:
           color_validation = {
             global_status: "vision_failed",
             vision_adjudication: {
               status: "failed",
               reason: "no_choice" como VisionFailureReason,
               attemptedAt: timestamp_iso
             }
           }
           profile = { status: "failed" }
           return
         resolved_palette = intendedToResolved(
           adjudication.palette, adjudication.palette.support)
         color_validation = { global_status: "vision_adjudicated" }
      f. Cada entrada registra resolved_from_cluster (se confirmado)

   3. Senão (intendedPalette null) — retry/legado:
      a. probeColors(imagem) → ColorProbeResult
      b. Se probe vazio:
         // ResolvedPalette: secondary explicitamente preenchido
         resolved_palette = {
           primary: store.brandColor ?? SEGMENT_FALLBACK,
           secondary: store.brandColor ?? SEGMENT_FALLBACK,
           accent: deduzido de brandColor,
           background: "#FFFFFF"
         }
         color_validation = { global_status: "fallback_heuristic" }
         pula para passo 4
      c. Heurística com probe (comportamento atual):
         // ResolvedPalette: todos os campos preenchidos
         primary  = primeiro cluster dominante não neutro
         accent   = segundo cluster dominante não neutro
                    ou primeiro structural
         secondary = accent  // heuristic: second most prominent = secondary
         background = primeiro background_candidate
                      ou cluster de maior edgeRatio
     d. color_validation = { global_status: "fallback_heuristic" }
     e. prompt_visao = "semantica"

  4. safe_color_tokens = resolved_palette
  5. brand_colors_chosen = previousColors ?? []
  6. Sincroniza stores.brand_color = safe_color_tokens.primary
     Sincroniza stores.accent_color = safe_color_tokens.accent
```

### Persistência de auditoria em falha de arbitragem

Quando `global_status === 'vision_failed'`, o profile NÃO contém paleta resolvida, mas DEVE preservar a explicação da falha para auditoria e retry.

**Schema real da tabela `store_brand_profiles`** (sem `asset_type`):

```typescript
// Profile persisted when vision fails
{
  store_id: string;                              // FK obrigatório
  source: 'without_logo';                         // constante do profiler atual
  visual_signature_id: string;                    // VS que gerou a tentativa
  status: 'failed';                               // permite retry
  metadata: {
    identity_state: 'visual_signature';            // assinatura mantida ativa
    color_validation: {
      global_status: 'vision_failed';
      vision_adjudication: {
        status: 'failed';
        reason: VisionFailureReason;
        details?: string;                         // mensagem técnica
        attemptedAt: string;                      // ISO timestamp
      };
    };
  };
  // safe_color_tokens → defaults do banco: {}
  // brand_colors_chosen → defaults do banco: []
  // inferred_primary_color → defaults do banco: null
  // inferred_accent_color → defaults do banco: null
}
```

Regras:
- `status: 'failed'` permite que o profiler seja reexecutado (retry) sem conflito
- A assinatura visual (`identity_state`) permanece ativa — o `safe_color_tokens` anterior (se houver) continua em uso; como o banco retorna `{}` para failed, o consumidor deve ignorar `safe_color_tokens` quando `status === 'failed'`
- `brand_colors_chosen` default `[]` — o consumidor deve ignorar quando `status === 'failed'`
- O campo `reason` do `vision_adjudication` é ENUM para facilitar análise de logs e monitoramento
- `attemptedAt` permite rastrear quantas tentativas falharam e qual o intervalo entre elas
```

### 6. Prompt do BrandProfiler (`store-brand-profiler.md`)

O prompt se torna condicional com duas variantes:

**Variante A — Happy path (sem divergência):**
```
Contexto:
- intendedPalette: { primary, accent, support, background }
- As cores acima já foram validadas e estão corretas.

Instrução:
Faça apenas análise semântica da marca com base na imagem:
- Estilo visual
- Tom visual
- Direção tipográfica
- Personalidade da marca
- Diretrizes de campanha
- Briefing de campanha

Não extraia nem sugira cores. A paleta já está definida.
```

**Variante B — Divergência (visão arbitra):**
```
Contexto:
- intendedPalette original: { primary, accent, support, background }
- As seguintes cores têm presença ambígua ou ausente: [lista com ∆E]
- As cores que REALMENTE EXISTEM na imagem (observadas pelo probe):
  observed_colors: ["#B96F63", "#F5A623", "#F8F9FA", "#E0A080"]

Instrução:
1. Analise visualmente a assinatura
2. Para cada papel contestado (ex: primary), ESCOLHA entre
   observed_colors qual cor corresponde:
   - primary: qual cor está no nome da loja?
   - accent: qual está no elemento de destaque?
   - background: qual é o fundo?
   - support: qual cor de apoio está presente?
3. Responda EXCLUSIVAMENTE com cores de observed_colors.
   NÃO invente HEX arbitrário.
4. Retorne a paleta corrigida APENAS para os papéis contestados.
5. Para o restante, faça análise semântica da marca.
```

O output do modelo deixa de exigir campos de cor no happy path (`logo_colors_detected`, `safe_color_tokens`, `inferred_primary_color`, `inferred_accent_color`). Na divergência, o output pode conter correções para cores específicas.

### 7. Sincronização de `stores.accent_color`

No `brand-profiler.ts`, após resolver a paleta:

```typescript
await supabase.from('stores').update({
  brand_color: safe_color_tokens.primary,
  accent_color: safe_color_tokens.accent,
}).eq('id', storeId);
```

---

## Tratamento do Retry (ATTEMPT 2)

O retry com prompt simplificado NÃO retorna `intended_palette`. Neste caso:

```
intendedPalette = null → fluxo do passo 3 (fallback):
  ColorProbe reutilizável → heurística → safe_color_tokens
  Sem modelo de IA com visão para cores
  Modelo de IA com visão → SÓ análise semântica
```

**Fora de escopo desta fase.** Melhorias no retry (incluir metadata no prompt, usar modelo alternativo) serão tratadas em fase futura.

---

## Validação

### Matriz de transições (verifica brand profile, não campanha)

Testes de integração com VS real:

| # | Transição | Ação | O que verificar | Critério |
|---|---|---|---|---|
| 1 | text_only → VS | Gerar VS + aprovar (happy path) | `color_validation.global_status === 'all_confirmed'` | Todas as cores confirmadas |
| 2 | text_only → VS | Gerar VS + aprovar (happy path) | `safe_color_tokens.primary` == `intended_palette.primary` | Match exato (confia no Diretor) |
| 3 | text_only → VS | Gerar VS + aprovar (happy path) | `safe_color_tokens.accent` == `intended_palette.accent` | Match exato |
| 4 | text_only → VS | Gerar VS + aprovar (happy path) | `safe_color_tokens.background` == `intended_palette.background` | Match exato |
| 5 | text_only → VS | Gerar VS + aprovar | `brand_colors_chosen` == `[]` (sem escolhas anteriores) | Array vazio |
| 6 | text_only → VS | Gerar VS + aprovar (com escolhas anteriores) | `brand_colors_chosen` preservado do profile anterior | Não vazio |
| 7 | text_only → VS | Gerar VS + aprovar | `inferred_primary_color` == `safe_color_tokens.primary` | Match exato |
| 8 | text_only → VS | Gerar VS + aprovar | `inferred_accent_color` == `safe_color_tokens.accent` | Match exato |
| 9 | text_only → VS | Gerar VS + aprovar (happy path) | `safe_color_tokens.secondary` == support[0] | Match exato |
| 10 | text_only → VS | Gerar VS + aprovar (happy path) | `color_validation.primary.presence === 'confirmed'` | Presença física |
| 11 | text_only → VS | Gerar VS + aprovar (happy path) | `color_validation.background.presence === 'confirmed'` | Background confirmado |
| 12 | text_only → VS | Gerar VS + aprovar (com divergência) | `safe_color_tokens.primary` == `color_validation.primary.resolved` | Match com resolução da visão |
| 13 | text_only → VS | Gerar VS + aprovar (com divergência) | `safe_color_tokens.secondary` == `color_validation.secondary.resolved` | Match com resolução da visão |
| 14 | VS → text_only | Remover VS | `store.identity_state` == `'text_only'` | ✅ |
| 15 | VS → text_only | Remover VS | Profile preservado, cores intactas | ✅ |
| 16 | text_only → VS² | Gerar NOVA VS + aprovar | `safe_color_tokens` == `color_validation.<role>.resolved` | Match com resolução (happy ou divergência) |
| 17 | VS² → text_only → VS¹ | Restaurar VS anterior | Profile reativado, cores da VS¹ restauradas | Match |
| 18 | text_only → logo | Upload logo | Fluxo logo intacto (não contaminado) | ✅ |
| 19 | logo → text_only | Remover logo | identity_state text_only, direção preservada | ✅ |
| 20 | text_only → VS | Retry sem metadata (simular) | `intendedPalette` null → fallback heurística | `color_validation.global_status === 'fallback_heuristic'` |
| 21 | — | VS archived sem `intended_palette` E sem profile | Fallback roda | `global_status === 'fallback_heuristic'` |
| 22 | — | VS archived sem `intended_palette` com profile | Profile reutilizado, fallback NÃO roda | Profile.status reativado |

### Testes — ColorProbe (função de presença)

Testam exclusivamente `findClosestProbeCluster` com fixture controlada. Sem serviço, sem perfil, sem `global_status`.

| # | Fixture | Cor testada | ∆E esperado | Presença |
|---|---|---|---|---|
| P1 | PNG sólido #B96F63 | `#B96F63` | ≈ 0 | `confirmed` |
| P2 | PNG sólido #B96F63 | `#B96F50` (∆E real ≈ 3-5)* | ≤ 18 | `confirmed` |
| P3 | PNG sólido #B96F63 | `#FF0000` | > 25 | `not_confirmed` |
| P4 | PNG gradiente #B96F63, #F5A623, #2E6B9E | `#2E6B9E` | ≈ 0 | `confirmed` |
| P5 | PNG gradiente #B96F63, #F5A623, #2E6B9E | `#FFFFFF` (não existe) | > 25 | `not_confirmed` |
| P6 | Buffer corrompido | `#B96F63` | N/A | `unchecked` (exceção) |

\* ∆E real depende do algoritmo usado. **A implementação atual usa CIE76** (diferença Euclidiana no espaço LAB). Se a fase migrar para CIEDE2000, os valores de testing devem ser recalculados. O importante é que esteja na faixa ≤ 18.

### Testes — Resolução de paleta (serviço simulado)

Testam o fluxo de `global_status` e resolved_palette com probe mockado. Sem chamada de IA real.

| # | Probe simulado | `intended_palette` | Resultado esperado |
|---|---|---|---|
| R1 | Todas as cores com ∆E ≤ 18 | `{ primary: "#B96F63", accent: "#F5A623", support: [], background: "#F8F9FA" }` | `global_status: 'all_confirmed'`, `primary == "#B96F63"`, `secondary == primary` |
| R2 | primary `18 < ∆E ≤ 25` (ambíguo); demais ≤ 18 | mesma | `global_status: 'vision_adjudicated'`, visão recebe observed_colors |
| R3 | primary ∆E > 25; demais ≤ 18 | mesma | `global_status: 'vision_adjudicated'` |
| R4 | support[0] ∆E ≤ 18 | `{ ..., support: ["#2E6B9E"] }` | `global_status: 'all_confirmed'`, `secondary == "#2E6B9E"` |
| R5 | support[0] `18 < ∆E ≤ 25` | mesma | `global_status: 'vision_adjudicated'`, visão arbitra support |
| R6 | Probe vazio (exceção) | mesma | `global_status: 'probe_unavailable'`, `primary == intended.primary` |
| R7 | primary `18 < ∆E ≤ 25` (ambíguo) + visão simulada falha | mesma | `global_status: 'vision_failed'`, profile `failed` |
| R8 | Probe vazio + intendedPalette null | null | `global_status: 'fallback_heuristic'`, `primary == brandColor` |
| R9 | Probe vazio (exceção) | `{ primary: "#B96F63", accent: "#F5A623", support: [], background: "#F8F9FA" }` | `global_status: 'probe_unavailable'`, `secondary == primary` |
| R10 | Probe vazio + intendedPalette null + brandColor null | null | `global_status: 'fallback_heuristic'`, `primary == SEGMENT_FALLBACK` |
| R11 | PNG sólido #B96F63 + borda #FFFFFF (background confirmado via edgeRatio) | `{ primary: "#B96F63", accent: "#B96F63", support: [], background: "#FFFFFF" }` | `global_status: 'all_confirmed'`, background `confirmed` |
| R12 | PNG sólido #B96F63 sem bordas (background cromático) | `{ primary: "#B96F63", accent: "#B96F63", support: [], background: "#B96F63" }` | `global_status: 'all_confirmed'`, background `confirmed` |
| R13 | Dois supports: `["#B96F63", "#2E6B9E"]`, apenas `support[1]` contestado (`18 < ∆E ≤ 25`) + visão corrige `support[1]` para `"#F5A623"` | `{ primary: "#B96F63", accent: "#F5A623", support: ["#B96F63", "#2E6B9E"], background: "#F8F9FA" }` | `global_status: 'vision_adjudicated'`, `secondary == "#B96F63"` (preservou índice 0 intacto), `support_colors[1] == "#F5A623"` |

### Testes manuais

| # | Procedimento | O que avaliar |
|---|---|---|
| M1 | Gerar VS real → aprovar → inspecionar `color_validation` | Cores fazem sentido visualmente? |
| M2 | Gerar VS → rejeitar → gerar nova → aprovar | Paleta da segunda VS independente da primeira |
| M3 | Remover VS → restaurar VS anterior | Cores originais preservadas |

### Verificação de auditoria

```typescript
const profile = await getBrandProfile(storeId);
const meta = profile.metadata as any;
const cv = meta?.color_validation;

// Happy path: todas as cores confirmadas
if (cv.global_status === 'all_confirmed') {
  assert(cv.primary.presence === 'confirmed');
  assert(cv.primary.role_source === 'art_director');
  assert(cv.primary.resolution === 'accepted');
  assert(cv.primary.resolved === cv.primary.intended);

  // Sharp não reclassificou: safe_color_tokens = intendedToResolved(intendedPalette, intendedPalette.support)
  assert(profile.safe_color_tokens.primary === cv.primary.intended);
  assert(profile.safe_color_tokens.accent === cv.accent.intended);
  assert(profile.safe_color_tokens.background === cv.background.intended);
}

// Divergência: visão arbitrou
if (cv.global_status === 'vision_adjudicated') {
  assert(cv.primary.role_source === 'vision_adjudication');
  assert(cv.vision_adjudication !== undefined);
  assert(cv.vision_adjudication.reason.length > 0);
}

// Probe unavailable: manteve intended sem validação
if (cv.global_status === 'probe_unavailable') {
  assert(cv.primary.presence === 'unchecked');
  assert(cv.primary.resolution === 'accepted_unverified');
  assert(cv.primary.resolved === cv.primary.intended);
}

// brand_colors_chosen: vazio se sem escolhas anteriores
// preservado se havia escolhas — testar cada cenário
if (!previousUserColors) {
  assert(profile.brand_colors_chosen.length === 0);
} else {
  assert(profile.brand_colors_chosen.length > 0);
  assert(profile.brand_colors_chosen[0] === previousUserColors[0]);
}

// Sincronização com stores
assert(store.brand_color === profile.safe_color_tokens.primary);
assert(store.accent_color === profile.safe_color_tokens.accent);

// inferred_* sincronizados com safe_color_tokens
assert(profile.inferred_primary_color === profile.safe_color_tokens.primary);
assert(profile.inferred_accent_color === profile.safe_color_tokens.accent);

// secondary = support[0] (happy path) OU color_validation.secondary.resolved (divergência)
if (cv.global_status === 'all_confirmed' && intendedPalette?.support?.length > 0) {
  assert(profile.safe_color_tokens.secondary === intendedPalette.support[0]);
}
if (cv.global_status === 'vision_adjudicated') {
  assert(profile.safe_color_tokens.secondary === cv.secondary.resolved);
}
```

---

## Riscos e Mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| `intended_palette` com cores que não existem na imagem gerada (IA "mente") | Brand profile com cor que não aparece na VS | Probe detecta ausência → divergência → visão arbitra paleta correta |
| Visão do árbitro também alucina cores | Correção errada, drift persistido | Mitigação por contrato: visão SÓ pode escolher entre observed_colors (clusters reais do probe). Se retornar HEX livre, passa por revalidação contra o probe — ∆E > 18 com todos clusters → resposta rejeitada → vision_failed. Segunda alucinação bloqueada |
| Probe retorna vazio (imagem inválida, exceção Sharp) | Sem referência para validação | `intendedPalette` mantido com status `probe_unavailable`; sem `intendedPalette` usa brandColor |
| Divergência frequente (IA consistentemente declara cores que não existem) | Custo extra de visão em cada aprovação | Investigar qualidade da geração VS: prompt do Art Director pode estar desalinhado da imagem gerada |
| Retry sem `intended_palette` | Cores imprecisas (heurística) | Fase futura de melhoria do retry |
| VS archived sem `intended_palette` e sem profile | Restore sem dados semânticos | Fallback probe + heurística |
| Extração do probe quebra `brand-director.ts` | Fluxo de logo afetado | Testes de regressão no logo |
| `accent_color` sincronizado pode conflitar com escolha manual do usuário | Store.accent_color sobrescrito | Decisão: VS define paleta, brand_colors_chosen preserva escolha manual |

---

## Fora de Escopo

| Item | Motivo |
|---|---|
| Integração da direção visual ao gerador de campanhas | Fase futura após validação do brand profile |
| Retry com modelo alternativo (Gemini etc.) ou prompt enriquecido | Fase separada — investigar taxa real de retry primeiro |
| Revisão do prompt simplificado (retry) | Fase separada — depende da direção do retry |
| Revisão das transições entre estados | Esta fase valida transições como side effect, gaps viram findings |
| Usar visão como fallback quando não há `intendedPalette` (retry/legado) | Visão como árbitro em divergências já está no escopo. O que está fora é usar visão para extrair paleta do zero quando não há metadata — isso continua sendo heurística Sharp |
| Backfill de perfis existentes | Só perfis novos terão o fix |
| `positioning` como campo sensível de drift | Já decidido em 4.6.2 |
| Atualização de specs OpenSpec | Pós-alinhamento |

---

## Histórico de Decisões

| Data | Decisão |
|---|---|
| 2026-06-20 | Fase nomeada como 4.6.5 — VS Color Drift & Brand Profile Alignment |
| 2026-06-20 | Foco exclusivo no brand profile, não na campanha |
| 2026-06-20 | `IntendedPalette` como tipo separado, sem poluir tipo legado |
| 2026-06-20 | JSON de retorno da IA normalizado por normalizador idempotente, usado tanto na persistência quanto no approve |
| 2026-06-20 | `ColorProbe` extraído para módulo reutilizável (`color-probe.ts`), compartilhado entre brand-director e brand-profiler |
| 2026-06-20 | `brand_colors_chosen` não populado para VS — **substituído**: agora preserva escolhas manuais com prova de origem (`manual_color_override.enabled === true`) |
| 2026-06-20 | Validação de cores por papel com políticas de ∆E distintas — **substituída** por presença física + visão como árbitro |
| 2026-06-20 | `support[]` → `safe_color_tokens.secondary` (primeiro validado) + preservado em metadata |
| 2026-06-20 | `color_validation` persistido em metadata para auditoria de proveniência |
| 2026-06-20 | `stores.accent_color` sincronizado com `safe_color_tokens.accent` (novo) |
| 2026-06-20 | `stores.brand_color` sincronizado com `safe_color_tokens.primary` (corrigido: antes usava `inferred_primary_color`) |
| 2026-06-20 | Sem backfill de perfis existentes |
| 2026-06-20 | Fallback sem `intendedPalette` usa probe + heurística (não modelo de IA) — melhoria futura |
| 2026-06-20 | Retry/provider diversity postergado para fase separada |
| 2026-06-20 | `brand_colors_chosen` preserva escolhas explícitas anteriores; só fica vazio se não havia escolhas |
| 2026-06-20 | `ColorValidationEntry.intended` e `.delta_e` nullable para fallback_heuristic e probe_unavailable |
| 2026-06-20 | Probe vazio: intendedPalette válido → mantém (probe_unavailable); sem intendedPalette → brandColor |
| 2026-06-20 | Background cromático: além de background_candidates, considera cluster de maior edgeRatio |
| 2026-06-20 | `support[]` validado item a item; support_details preserva validação individual de cada support |
| 2026-06-20 | `resolved_from_cluster` adicionado ao `ColorValidationEntry` para auditoria de cluster origem |
| 2026-06-20 | Testes de guardrail usam fixture PNG + metadata sintética (não dependem de IA real) |
| 2026-06-20 | Normalizador idempotente usado tanto na persistência quanto no approve route |
| 2026-06-20 | Output do modelo profiler não exige mais campos de cor; valores vêm do guardrail |
| 2026-06-20 | **Refatoração do fluxo:** Diretor declara papéis e intenção → ColorProbe verifica APENAS presença física → Visão arbitra divergências. Sharp nunca reclassifica papéis quando há metadata |
| 2026-06-20 | Happy path: todas as cores existem → `safe_color_tokens = intendedToResolved()` (confia no Diretor, converte de IntendedPalette para ResolvedPalette) |
| 2026-06-20 | Divergência: cor não encontrada → visão arbitra (mesmo modelo já chamado para análise semântica, prompt condicional) |
| 2026-06-20 | ∆E threshold único para existência: ≤ 25 em qualquer cluster não-artefato. Background: + preferência por edgeRatio, sem exclusão de fundo cromático — **substituído** pela faixa tripla sem sobreposição: ≤ 18 confirmado, 18 < ∆E ≤ 25 ambíguo, > 25 ausente |
| 2026-06-20 | `color_validation.global_status`: `all_confirmed` / `vision_adjudicated` / `vision_failed` / `probe_unavailable` / `fallback_heuristic` |
| 2026-06-20 | Prompt do BrandProfiler condicional: happy path → só semântica; divergência → semântica + arbitrar papéis contestados |
| 2026-06-20 | `ResolvedPalette` criado com `primary`, `secondary`, `accent`, `background`. `secondary = supportResolved[0] ?? primary`. Conversão explícita via `intendedToResolved()` |
| 2026-06-20 | Contrato da resposta de arbitragem: `RawVisionAdjudication` (bruta) → `NormalizedVisionAdjudication` (palette com support composto). `null` em papéis contestados → `no_choice` → `vision_failed`. `null` em papéis não contestados → mantém intended. Cobertura total: todo support contestado exige `SupportCorrection` correspondente |
| 2026-06-20 | Profile failed preserva `color_validation.vision_adjudication` com reason ENUM para auditoria |
| 2026-06-20 | observed_colors: máximo 12 clusters, inclui obrigatoriamente cluster mais próximo de cada cor contestada + melhor de cada classificação, completa por frequência, deduplica sem remover obrigatórios |
| 2026-06-20 | Testes separados em ColorProbe unit tests (P1-P6) + palette resolution tests (R1-R13) + integration matrix (cenários 1-22) |
