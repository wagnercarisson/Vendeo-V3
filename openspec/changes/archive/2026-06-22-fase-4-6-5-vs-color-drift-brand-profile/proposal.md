## Why

O fluxo de aprovação de assinatura visual ignora o `intended_palette` (com papéis semânticos — primary, accent, support, background) que a IA já retorna na geração da VS. O `BrandProfilerWithoutLogoService` usa uma heurística cega (`extractColorsFromBuffer` + `pickPrimaryFromPalette`) que extrai cores sem classificação semântica, produzindo um brand profile com papéis trocados (ex: azul claro de fundo vira `primary`). Isso gera drift entre as cores que o lojista vê na assinatura e as cores efetivamente usadas nas campanhas.

## What Changes

- **ColorProbe reutilizável**: Extrair `probeColors()` + `ColorProbeResult` + utilitários de cor (`deltaE`, `hexToLab`, etc.) de `brand-director.ts` para módulo compartilhado `src/lib/brand-assets/color-probe.ts`
- **IntendedPalette**: Criar tipo separado (desacoplado de `VisualSignatureArtDirectorOutput`) + normalizador idempotente para o JSON de retorno da IA
- **BrandProfilerInput**: Adicionar `intendedPalette: IntendedPalette | null` e `previousBrandColors?: string[]` para receber a paleta declarada pela IA no approve route
- **Presença física**: Substituir a heurística de classificação por papel no `BrandProfilerWithoutLogoService` por validação de presença via `ColorProbe` com 3 zonas de ∆E (≤18 confirmado, 18 < ∆E ≤ 25 ambíguo, > 25 ausente). Sharp nunca reclassifica papéis semânticos.
- **Visão como árbitro**: Quando uma cor tem presença ambígua ou ausente, a visão arbitra exclusivamente entre `observed_colors` (clusters reais do probe). Se retornar HEX livre, passa por revalidação contra o probe — se encontrar cluster com ∆E ≤ 18, é aceito; somente se ∆E > 18 com todos os clusters → resposta rejeitada → `vision_failed`
- **ResolvedPalette**: Tipo final de `safe_color_tokens` com `secondary` derivado de `support[0] ?? primary`. Conversão explícita via `intendedToResolved()`
- **Profile failed**: Se a visão falhar (JSON inválido, API error, não escolhe, ou HEX revalidado sem cluster com ∆E ≤ 18), profile persistido como `failed` com `color_validation.vision_adjudication` preservando a auditoria. Assinatura mantida ativa, permite retry
- **Contrato de arbitragem**: Visão corrige **somente** papéis contestados; papéis confirmados permanecem imutáveis via `resolveRole()`. `support[]` validado individualmente por índice (`SupportCorrection[]`). Ausência de decisão para qualquer papel contestado → `vision_failed`
- **Fallbacks**: Probe indisponível + `intendedPalette` válido → confia na intenção com `probe_unavailable`. `intendedPalette` nulo (retry/legado) → probe + heurística → `fallback_heuristic`. Probe vazio + sem intenção → `store.brandColor` ou `SEGMENT_FALLBACK`. Retry e assinaturas antigas seguem estes fallbacks — sem visão para arbitragem de cores (apenas análise semântica), sem backfill
- **brand_colors_chosen**: Preservado apenas se `manual_color_override.enabled === true` no profile anterior. Perfis legados sem evidência → `[]`
- **Sincronização**: `stores.brand_color` ← `safe_color_tokens.primary`; `stores.accent_color` ← `safe_color_tokens.accent`
- **Prompt condicional**: BrandProfiler recebe prompt diferente conforme haja divergência (happy path → só análise semântica; divergência → semântica + arbitrar papéis contestados)
- **observed_colors**: Seleção com no máximo 12 clusters, incluindo obrigatoriamente o cluster mais próximo de cada cor contestada + melhor de cada classificação visual
- **Sem backfill**: Apenas perfis novos (gerados após esta fase) recebem o fix

## Capabilities

### New Capabilities
- `color-probe`: Módulo compartilhado de extração de cores via Sharp (`probeColors`, `ColorProbeResult`, `ColorCluster`, `findClosestProbeCluster`, utilitários de cor). Consumido por brand-director (logo) e brand-profiler (VS).

### Modified Capabilities
- `store-brand-profile`: **BREAKING** — BrandProfilerWithoutLogoService deixa de usar `extractColorsFromBuffer` + heurística de classificação. Novo fluxo: `intendedPalette` → ColorProbe para presença física → visão arbitra divergências → `safe_color_tokens` do tipo `ResolvedPalette`. `brand_colors_chosen` preservado apenas com prova de escolha manual. `stores.accent_color` sincronizado. Profile com `status: 'failed'` preserva auditoria em `metadata.color_validation`.
- `store-brand-profiler-without-logo`: Inputs (`intendedPalette`, `previousBrandColors`) e output do profiler alterados. Prompt condicional (happy path vs divergência). Fluxo de validação de presença substitui heurística de classificação.
- `store-identity-art-director`: Normalizador idempotente do JSON de retorno da IA (extrai `IntendedPalette` + `ColorUsage`). `IntendedPalette` como tipo separado no `VisualSignatureMetadata`.
- `visual-signature-approval`: Approve route passa `intendedPalette` + `previousBrandColors` para o BrandProfiler. Semântica condicional do prompt.

## Impact

- **Routes**: `src/app/api/store/[id]/visual-signature/approve/route.ts` — extrair `intendedPalette` do metadata e carregar `previousBrandColors` do último profile synced, passando ambos para `generate()`
- **Services**: `BrandProfilerWithoutLogoService` — substituir `extractColorsFromBuffer` por `ColorProbe` + validação de presença + arbitragem por visão. `StoreIdentityArtDirectorService` / normalizador — extrair `IntendedPalette` do JSON de retorno
- **Shared module**: `src/lib/brand-assets/color-probe.ts` — extraído de `brand-director.ts`, compartilhado entre logo e VS. A extração não altera `curateLogoColors` nem `applyGuardrail` do fluxo de logo — são dependências do módulo compartilhado, não modificadas
- **Types**: `src/lib/visual-signature/types.ts` — `IntendedPalette`, `ResolvedPalette`, `ColorValidationEntry`, `ColorValidation`, `VisionAdjudicationAudit`, `VisionFailureReason`
- **Prompts**: `src/lib/brand-assets/brand-profiler/store-brand-profiler.md` — condicional (happy path vs divergência)
- **No new routes**: DELETE, GET, POST visual-signature não são alterados. Nenhuma migration nova.
