# Alinhamento Fase 4.6.1 — text_only coverage

## Propósito

Alinhar a tela de Logo e Cores para o estado `identity_state = 'text_only'`. Quando o usuário opta por não ter logo (explicitamente ou implicitamente), o sistema deve acionar o **diretor de marketing** para inferir a identidade visual completa da loja, persistindo direção visual em `store_brand_profiles`.

---

## Cenários Equivalentes

| # | Ação do usuário | identity_state | text_only_origin | manual_color_override |
|---|----------------|----------------|-------------------|----------------------|
| 1 | Clicou "Continuar sem logo" | `text_only` | `explicit` | `true` se escolheu cores, senão `false` |
| 2 | Escolheu cores + Salvou (sem logo) | `text_only` | `implicit` | `true` |
| 3 | Salvou sem logo nem cores | `text_only` | `implicit` | `false` |

Nos 3 cenários o usuário deliberadamente optou por seguir sem logo. O diretor de marketing deve inferir a direção visual a partir dos dados da loja.

---

## Modelo de Dados

### stores (já existe no Supabase)

| Campo | Tipo | Padrão | CHECK |
|-------|------|--------|-------|
| `identity_state` | `text` | `'text_only'` | `'text_only', 'logo', 'visual_signature'` |
| `text_only_origin` | `text` | `'implicit'` | `'implicit', 'explicit'` |
| `manual_color_override` | `boolean` | `false` | — |
| `previous_identity_snapshot` | `jsonb` | — | — |
| `brand_color` | `text` | — | — (denormalização syncada do profile ativo) |

### store_brand_profiles (já existe no Supabase)

| Campo | Tipo | Semântica |
|-------|------|-----------|
| `source` | `text` — CHECK: `'logo_analysis', 'without_logo', 'text_only'` | Origem do perfil |
| `brand_colors_chosen` | `jsonb[]` | **Cores que o USUÁRIO escolheu** (nova semântica adotada) |
| `safe_color_tokens` | `jsonb` — `{primary, secondary, accent, background}` | Paleta FINAL decidida pelo diretor de marketing |
| `inferred_primary_color` | `text` | Cor primária que a IA respondeu |
| `inferred_accent_color` | `text` | Cor de destaque que a IA respondeu |
| `manual_color_override` | `jsonb` — `{"enabled": true/false}` | Flag no perfil |
| `visual_style, visual_tone, typography_direction, brand_personality, campaign_guidelines, campaign_brief` | `text` | Inteligência de marca |

### Semântica de brand_colors_chosen

**Decisão:** `brand_colors_chosen` armazena **exclusivamente** as cores que o usuário escolheu manualmente. Não deve ser populado com extrações de logo, paletas inferidas ou qualquer outro valor não originado do color picker do usuário.

- Se usuário escolheu cores → `brand_colors_chosen = ["#primaria", "#destaque"]`
- Se usuário não escolheu → `brand_colors_chosen = []`

### Prioridade de Resolução de Cor em text_only

**Decisão (corrigida):** A prioridade para consumo em campanhas é:

```
safe_color_tokens.primary
  > inferred_primary_color
  > store.brand_color
  > SEGMENT_COLOR_FALLBACK[segment]
```

`brand_colors_chosen` é **insumo para a inferência e dado de UI**, não fonte final de renderização. A IA recebe as cores do usuário como sinal, mas a paleta final decidida está em `safe_color_tokens`. Futuramente, se `manual_color_override.enabled = true` ganhar semântica de override real, isso pode mudar.

---

## Fluxo da Tela (Step 2)

### Estado inicial (identity_state = null / não decidiu)

- Drop zone para upload de logo
- Botão "Enviar logotipo"
- Botão "Não tenho logo" (abre modal de geração de assinatura visual)
- Link "Continuar sem logo" (leva para text_only)
- Color pickers vazios
- Preview com fallback de segmento

### Após text_only (identity_state = 'text_only')

- Drop zone para upload de logo **permanece visível**
- Botão "Enviar logotipo" **permanece visível**
- Botão "Não tenho logo" **permanece visível** (com tooltip informando que vai gerar assinatura visual)
- Link "Continuar sem logo" **removido**
- Abaixo dos botões: chip "✓ Direção visual definida pelo Vendeo" (se profile synced)
- Color pickers preenchidos: `brand_colors_chosen` se user escolheu, senão `safe_color_tokens`
- Abaixo dos color pickers: chips com paleta completa de `safe_color_tokens`
- Preview reflete a direção visual inferida

### Se inferência falhou (profile status = 'failed')

- `identity_state` ainda setado como `'text_only'`
- Mensagem: "Não foi possível gerar a direção visual agora. Tente novamente."
- Botão "Gerar direção visual agora"
- Demais botões permanecem (upload logo, não tenho logo)
- Color pickers vazios
- Campanhas usam fallback de segmento

### Na carga da loja com text_only existente

- GET brand-profile → se synced: preenche color pickers, mostra chip de sucesso
- GET brand-profile → se failed: aviso + botão "Gerar direção visual"
- Em ambos os casos: botões de logo/signature visíveis, link "Continuar sem logo" removido

---

## Preview da Loja

Novos elementos a adicionar no `StorePreview` quando `identity_state = 'text_only'`:

- Estilo visual (`visual_style`)
- Tom visual (`visual_tone`)
- Personalidade da marca (`brand_personality`)
- Chips da paleta completa (`safe_color_tokens`)
- Indicador: "✓ Direção visual definida pelo Vendeo"

---

## Artefatos a Construir

### 1. Migration — `supabase/migrations/20260612000001_add_identity_state_fields.sql`

Adicionar ao schema as colunas que existem no Supabase remoto mas não nas migrations versionadas:

```sql
-- stores
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS identity_state TEXT NOT NULL DEFAULT 'text_only';
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS text_only_origin TEXT NOT NULL DEFAULT 'implicit';
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS manual_color_override BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS previous_identity_snapshot JSONB;

ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS chk_stores_identity_state;
ALTER TABLE public.stores ADD CONSTRAINT chk_stores_identity_state
  CHECK (identity_state IN ('text_only', 'logo', 'visual_signature'));

ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS chk_stores_text_only_origin;
ALTER TABLE public.stores ADD CONSTRAINT chk_stores_text_only_origin
  CHECK (text_only_origin IN ('implicit', 'explicit'));

-- store_brand_profiles
ALTER TABLE public.store_brand_profiles ADD COLUMN IF NOT EXISTS manual_color_override JSONB NOT NULL DEFAULT '{"enabled": false}';

ALTER TABLE public.store_brand_profiles DROP CONSTRAINT IF EXISTS chk_store_brand_profiles_source;
ALTER TABLE public.store_brand_profiles ADD CONSTRAINT chk_store_brand_profiles_source
  CHECK (source IN ('logo_analysis', 'without_logo', 'text_only'));
```

### 2. Prompt — `prompts/store-brand-inference.md`

Novo prompt para inferência sem logo e sem assinatura visual.

- Input: `storeName, segment, subsegment, tone_of_voice, positioning, short_description, slogan, city, state, userChosenColors[]` (opcional)
- Output: mesmo formato de `BrandProfilerWithoutLogoResult` (logo_colors_detected, safe_color_tokens, visual_style, visual_tone, typography_direction, brand_personality, campaign_guidelines, campaign_brief, inferred_primary_color, inferred_accent_color, confidence_score)
- `userChosenColors` são **sinal, não vínculo** — o diretor de marketing tem autonomia para aceitar, ajustar ou ignorar

### 3. Novo serviço — `BrandTextOnlyInferenceService`

- Carrega o prompt `store-brand-inference.md`
- Monta input com dados da loja + cores do usuário (se houverem)
- Chama OpenAI (JSON mode)
- Persiste `store_brand_profiles` com `source = 'text_only'`
- Preenche `brand_colors_chosen` **apenas** se usuário escolheu cores
- Se IA falhar: profile `status = 'failed'`, sem bloquear

### 4. Nova rota — `POST /api/store/[id]/brand-profile/infer`

**Request:**
```json
{
  "textOnlyOrigin": "explicit" | "implicit",
  "userChosenColors": ["#FF6600"] | [],
  "manualColorOverride": true | false
}
```

**Processo:**
1. Carrega store do DB
2. Executa inferência (serviço acima)
3. Atualiza `stores`: `identity_state`, `text_only_origin`, `manual_color_override`, `brand_color` (sync do perfil)
4. Cria/atualiza `store_brand_profiles` com dados inferidos

**Response:**
```json
{
  "profile": { /* BrandProfileRecord completo */ },
  "identityState": "text_only",
  "textOnlyOrigin": "explicit",
  "colors": { "primary": "#...", "accent": "#..." }
}
```

### 5. Mudanças no frontend — `store-identity-form.tsx`

**handleContinueWithoutLogo:**
1. PATCH `/api/store/[id]` — `identity_state=text_only`, `text_only_origin=explicit`, `manual_color_override`
2. POST `/api/store/[id]/brand-profile/infer` — síncrono com spinner: "Aguarde enquanto o Vendeo gera uma direção visual para sua loja..."
3. UI atualiza com cores inferidas

**handleStep2Submit:**
Se não há logo ativo e não há assinatura visual ativa:
1. Salva `brand_colors_chosen` via PATCH se user escolheu cores
2. PATCH `/api/store/[id]` — `identity_state=text_only`, `text_only_origin=implicit`, `manual_color_override`
3. POST `/api/store/[id]/brand-profile/infer`

**Na carga da loja:**
- Se `identity_state = 'text_only'` → carregar brand-profile
- Se `status = 'synced'` → preencher color pickers e preview
- Se `status = 'failed'` → aviso + botão "Gerar direção visual"

**Color picker loading:**
- Se `brand_colors_chosen` tem valores → mostrar cores do user
- Se `brand_colors_chosen` vazio → mostrar `safe_color_tokens` / `inferred_primary/accent`
- Abaixo dos pickers: chips da paleta `safe_color_tokens`

**Botões:** "Enviar logotipo" e "Não tenho logo" permanecem visíveis. Link "Continuar sem logo" removido.

### 6. Atualização — `resolveStoreIdentity` (src/lib/actions/store.ts)

Adicionar novo bloco de resolução para `source = 'text_only'`:

```typescript
// source = 'text_only' — identidade inferida sem logo
if (textOnlyProfile?.source === 'text_only' && textOnlyProfile?.status === 'synced') {
  brandProfile = { ...extrair dados... };

  if (textOnlyProfile.safe_color_tokens?.primary) {
    brandColor = textOnlyProfile.safe_color_tokens.primary;
  } else if (textOnlyProfile.inferred_primary_color) {
    brandColor = textOnlyProfile.inferred_primary_color;
  }
}
```

Deixar bloco `source = 'without_logo'` existente com `TODO 4.6.3` para correção futura da prioridade.

### 7. Preview — `store-preview.tsx`

- Exibir `visual_style`, `visual_tone`, `brand_personality`
- Mostrar chips com paleta `safe_color_tokens`
- Chip indicativo: "✓ Direção visual definida pelo Vendeo"

---

## Tratamento de Erro (IA indisponível)

- Profile salvo como `status = 'failed'`
- `identity_state` ainda setado como `'text_only'`
- UI mostra mensagem informativa não-bloqueante
- Botão "Gerar direção visual agora" disponível
- Campanhas usam `SEGMENT_COLOR_FALLBACK[segment]`

## Recuperação de Transição (text_only ← logo/visual_signature)

Se usuário remove logo ou desativa assinatura e volta a `text_only`:
- Buscar profile `text_only` anterior com status `outdated`/`archived`
- Se existir e não for `failed` → reativar como `synced`
- Se não existir ou for `failed` → nova inferência

---

## Fora de Escopo (subfases futuras)

| Subfase | Escopo |
|---------|--------|
| 4.6.2 — logo | Corrigir escrita de `brand_colors_chosen` nos fluxos de logo upload (`/api/store/[id]/logo/route.ts`, `/api/store/[id]/brand-profile/route.ts`) |
| 4.6.3 — visual_signature | Corrigir `brand-profiler.ts` que escreve paleta extraída em `brand_colors_chosen`; corrigir prioridade em `resolveStoreIdentity` bloco `without_logo` |
| 4.6.x — transições | Fluxo completo de transição entre estados (text_only ↔ logo ↔ visual_signature) |

---

## Histórico de Decisões

| Data | Decisão |
|------|---------|
| 2026-06-12 | `brand_colors_chosen` passa a ter semântica exclusiva de "cores escolhidas pelo usuário". Código de escrita em outros fluxos (logo, visual_signature) será corrigido em subfases separadas. |
| 2026-06-12 | Prioridade de resolução de cor em `text_only`: `safe_color_tokens.primary > inferred_primary_color > store.brand_color > segment fallback`. `brand_colors_chosen` é insumo da inferência e dado de UI, não fonte final de renderização. |
| 2026-06-12 | Botões de "Enviar logotipo" e "Não tenho logo" permanecem visíveis em `text_only`. Link "Continuar sem logo" removido. |
| 2026-06-12 | Inferência síncrona com spinner de feedback para o usuário. |
| 2026-06-12 | `resolveStoreIdentity` ganha bloco específico para `source = 'text_only'` com prioridade correta; bloco `without_logo` existente recebe TODO para revisão em 4.6.3. |
