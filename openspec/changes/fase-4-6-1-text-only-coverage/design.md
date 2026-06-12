## Context

Atualmente o Step 2 (Logo e Cores) possui três caminhos para o usuário: upload de logo (→ `logo_analysis`), geração de assinatura visual por IA com aprovação (→ `without_logo`), e "Continuar sem logo" (→ apenas `logo_status = explicit_none`, sem perfil de marca). O terceiro caminho deixa a loja sem identidade visual — `safe_color_tokens`, `visual_style`, `visual_tone` e demais campos de inteligência ficam vazios, resultando em campanhas genéricas com fallback de segmento.

O banco remoto já possui `identity_state`, `text_only_origin`, `manual_color_override` e `previous_identity_snapshot` em `stores`, bem como `source = 'text_only'` no CHECK de `store_brand_profiles` — mas as migrations versionadas não refletem isso, e o código existente não consome esses campos.

Este design cobre a infraestrutura de inferência, o estado `text_only` na UI e a correção de prioridade de cor, mantendo compatibilidade com `logo_status` e sem tocar nos fluxos `logo` e `visual_signature` existentes.

## Goals / Non-Goals

**Goals:**

- Criar rota `POST /api/store/[id]/brand-profile/infer` que aciona o diretor de marketing para inferir identidade visual completa a partir dos dados cadastrais da loja
- Persistir o perfil inferido em `store_brand_profiles` com `source = 'text_only'`, incluindo `safe_color_tokens`, `inferred_primary_color`, `inferred_accent_color` e campos de inteligência (style, tone, personality, guidelines, brief)
- Popular ambos `identity_state + logo_status = 'explicit_none'` na entrada do estado text_only (dual-population)
- Migrar a lógica de renderização da UI do Step 2 para ler `identity_state` como fonte primária de estado
- Remover o link "Continuar sem logo" quando `identity_state = 'text_only'` e houver profile synced; exibir "Gerar direção visual" quando profile estiver failed ou ausente
- Pré-preencher color pickers com `brand_colors_chosen` (se usuário escolheu) ou com `safe_color_tokens` / `inferred_primary_color` (se IA inferiu) — isso é feedback visual na UI, a paleta efetiva de campanha continua sendo `safe_color_tokens.primary`
- Exibir chips da paleta `safe_color_tokens` abaixo dos color pickers
- Expandir `StorePreview` para exibir `visual_style`, `visual_tone`, `brand_personality` e chip de direção definida
- Corrigir `resolveStoreIdentity` com novo bloco `source = 'text_only'` e prioridade `safe_color_tokens.primary > inferred_primary_color > store.brand_color > segment fallback`
- Criar migration `20260612000001_add_identity_state_fields.sql` para alinhar migrations versionadas com o schema remoto
- Tratar erro da IA de forma não-bloqueante (profile `failed`, fallback de segmento, botão de retry)

**Non-Goals:**

- Corrigir escrita de `brand_colors_chosen` nos fluxos `logo` (4.6.2) e `visual_signature` (4.6.3)
- Implementar transições completas entre estados (text_only ↔ logo ↔ visual_signature)
- Reativação de perfil text_only anterior em retorno de logo/assinatura (subfase futura)

## Decisions

### Decision 1: Nova rota dedicada vs. extensão de rota existente

**Decisão:** Criar `POST /api/store/[id]/brand-profile/infer` como rota independente.

**Alternativa considerada:** Estender o `PATCH /api/store/[id]` para detectar ausência de logo e auto-inferir.

**Rationale:** A inferência é uma operação pesada (chamada OpenAI, 5-15s), com necessidade de feedback síncrono com spinner. Misturá-la no PATCH da store tornaria a resposta lenta e confundiria responsabilidades. Uma rota separada permite:
- Controle de timeout específico (independente do PATCH da store)
- Lock de concorrência (evitar múltiplas inferências simultâneas para a mesma loja)
- Tratamento de erro específico sem impactar o salvamento da store
- Re-trigger independente (usuário pode clicar "Gerar direção visual" novamente sem reenviar dados da loja)

### Decision 2: Dual-population de estado

**Decisão:** Ao entrar em text_only, persistir tanto `identity_state = 'text_only'` quanto `logo_status = 'explicit_none'`. A UI migra para ler `identity_state`, mas `logo_status` permanece populado para compatibilidade com código existente (ex: `StorePreview`, blocos condicionais de assinatura visual).

**Rationale:** O frontend atual é governado por `logoStatus` (lido de `store.logo_status` em `store-identity-form.tsx:82`, `store-preview.tsx`). Remover essa dependência de uma vez quebraria múltiplos componentes. A dual-population permite uma migração gradual:
1. Na 4.6.1, o novo código (inferência, color picker, preview expandido) lê `identity_state`
2. O código existente (exibição de assinatura visual, modal de aprovação) continua lendo `logo_status`
3. Em subfases futuras, a migração para `identity_state` se completa e `logo_status` pode ser deprecado

**Risco:** Duas fontes de estado podem dessincronizar. Mitigação: a escrita de `identity_state` e `logo_status` ocorre no **mesmo handler/operação controlada** (PATCH stores), e `logo_status` só é escrito pelo novo código nos valores que já existiam (`explicit_none`).

### Decision 3: Novo prompt vs. reuso do brand-profiler existente

**Decisão:** Criar novo prompt `store-brand-inference.md` específico para inferência sem imagem.

**Alternativa considerada:** Reutilizar o `store-brand-profiler.md` existente, adaptando-o para aceitar input sem imagem.

**Rationale:** O prompt existente (`store-brand-profiler.md`) é projetado para analisar uma **imagem** de assinatura visual (linha 33: "A entrada PRINCIPAL é a IMAGEM da assinatura visual aprovada"). Ele envia a URL da imagem para o GPT via `image_url`. Reaproveitá-lo sem imagem exigiria condicionais complexas e resultaria em um prompt com dupla personalidade. Um prompt novo e focado em dados cadastrais é mais simples de manter e testar.

### Decision 4: Estrutura do serviço de inferência

**Decisão:** Criar `BrandTextOnlyInferenceService` em `src/lib/brand-assets/`, seguindo o padrão de `BrandDirectorService` e `BrandProfilerWithoutLogoService`.

```typescript
// src/lib/brand-assets/text-only-inference-service.ts
class BrandTextOnlyInferenceService {
  async infer(input: TextOnlyInferenceInput): Promise<TextOnlyInferenceResult>
  // 1. Carrega prompt store-brand-inference.md
  // 2. Preenche template com dados da loja + cores do user
  // 3. Chama OpenAI com response_format: json_object
  // 4. Valida saída (cores hex, campos obrigatórios)
  // 5. Retorna TextOnlyInferenceResult
}
```

**Rationale:** Segue o padrão arquitetural existente dos serviços de marca — cada um gera/valida o resultado e a rota orquestra persistência e estado. O `BrandProfilerWithoutLogoService` continua responsável pelo fluxo `visual_signature`; o novo serviço cobre exclusivamente `text_only`.

### Decision 5: Inclusão de cores do usuário no prompt de inferência

**Decisão:** As `userChosenColors` são passadas no template do prompt como "sinal do lojista" — o prompt instrui o modelo a considerá-las como preferência do usuário, mas com autonomia para ajustar ou descartar se inconsistentes com o perfil da loja.

```markdown
## Preferência de Cores do Lojista

O lojista escolheu manualmente estas cores (considere como sinal de
preferência, não como regra obrigatória):
- Primária: {{userPrimaryColor}}
- Destaque: {{userAccentColor}}
```

**Rationale:** Alinha com a decisão de que `brand_colors_chosen` é insumo da inferência, não fonte final de renderização. A IA pode validar as cores do usuário (incorporando-as em `safe_color_tokens`) ou rejeitá-las (propondo paleta diferente) — em ambos os casos, o campo `safe_color_tokens` reflete a decisão final.

### Decision 6: Prioridade de cor em resolveStoreIdentity

**Decisão:** Novo bloco para `source = 'text_only'` com prioridade:

```
safe_color_tokens.primary > inferred_primary_color > store.brand_color > SEGMENT_COLOR_FALLBACK[segment]
```

Estrutura no código:

```typescript
// src/lib/actions/store.ts
// NOVO BLOCO 4.6.1: source = 'text_only'
if (profile?.source === 'text_only' && profile?.status === 'synced') {
  if (profile.safe_color_tokens?.primary && /^#[0-9A-Fa-f]{6}$/.test(profile.safe_color_tokens.primary)) {
    brandColor = profile.safe_color_tokens.primary;
  } else if (profile.inferred_primary_color && /^#[0-9A-Fa-f]{6}$/.test(profile.inferred_primary_color)) {
    brandColor = profile.inferred_primary_color;
  }
  // brandProfile montado com safe_color_tokens como paleta final
}

// Bloco existente source = 'without_logo' mantido com TODO: 4.6.3
```

**Rationale:** Esta prioridade coloca `safe_color_tokens` como fonte da verdade — é a paleta que o diretor de marketing decidiu como final. `brand_colors_chosen` não entra na hierarquia de renderização porque seu papel é de insumo e UI.

### Decision 7: Tratamento de erro não-bloqueante

**Decisão:** Se a chamada à IA falhar:
1. `store_brand_profiles` recebe um registro com `status = 'failed'`, `source = 'text_only'` e metadados do erro
2. `stores.identity_state` ainda é setado para `'text_only'`
3. `stores.logo_status` ainda é setado para `'explicit_none'`
4. Nenhuma exceção é propagada para o usuário — apenas uma mensagem informativa
5. Campaign generation usa `store.brand_color > SEGMENT_COLOR_FALLBACK[segment]`

**Rationale:** O usuário deliberadamente decidiu não ter logo. Mesmo que a IA falhe, a loja não deve ficar num estado inconsistente. O `identity_state = 'text_only'` reflete a decisão do usuário, não o sucesso da inferência. O profile `failed` permite que o sistema identifique lojas que precisam de retry sem depender de estado indefinido.

### Decision 8: Lock de concorrência na rota de inferência

**Decisão:** Usar o mesmo padrão de `generate-without-logo/route.ts` (Map de locks em memória) para evitar múltiplas inferências simultâneas para a mesma loja.

```typescript
const inferenceLocks = new Map<string, boolean>();

// POST handler
if (inferenceLocks.get(id)) {
  return NextResponse.json(
    { error: 'Inferência já em andamento para esta loja. Aguarde.' },
    { status: 429 }
  );
}
inferenceLocks.set(id, true);
try {
  // ... inferência
} finally {
  inferenceLocks.delete(id);
}
```

**Rationale:** Inferência é uma operação cara (~5-15s de API + escrita). Duas chamadas simultâneas gerariam perfis duplicados e custo desnecessário. O lock em memória é suficiente para o caso de uso (um usuário por vez em um loja).

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| **Dual-population cria divergência**: código futuro atualiza `identity_state` mas esquece `logo_status`, ou vice-versa | A escrita de ambos ocorre no mesmo PATCH dentro do mesmo handler. Documentar como regra: "sempre que `identity_state` mudar, `logo_status` deve ser atualizado se aplicável" |
| **Prompt de inferência sem imagem produz resultados genéricos**: sem uma imagem para analisar, a IA pode alucinar estilos visuais | O prompt inclui segmento, nome, posicionamento e slogan como âncoras concretas. O `confidence_score` permite que o sistema identifique inferências de baixa confiança |
| **Custo de API**: cada inferência custa ~$0.01-0.03 (GPT-4o, ~500 tokens in, ~300 out). Se muitos usuários criarem lojas sem logo, o custo acumula | A inferência só ocorre uma vez por loja em text_only (a menos que o profile falhe e o usuário peça retry). Para alpha, o custo éaceitável |
| **Spinner longo (5-15s)**: a inferência síncrona pode parecer lenta para o usuário | O timeout da rota é configurável via `IMAGE_GENERATION_GLOBAL_TIMEOUT_MS`. O spinner mostra mensagem específica: "Aguarde enquanto o Vendeo gera uma direção visual para sua loja..." |
| **brand_colors_chosen ainda é escrito incorretamente em outros fluxos**: o código de logo (4.6.2) e visual_signature (4.6.3) continua poluindo o campo | Aceito para esta fase. Documentado como fora de escopo |
| **Migration idempotente**: aplicar a migration em ambiente onde os campos já existem não pode causar erro | Todas as operações usam `ADD COLUMN IF NOT EXISTS` e `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT` |

## Migration Plan

### Nova migration: `supabase/migrations/20260612000001_add_identity_state_fields.sql`

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

**Rollback:** Reverter as constraints e remover colunas via `ALTER TABLE ... DROP COLUMN IF EXISTS`.

### Deploy order

1. Aplicar migration no Supabase
2. Deploy do prompt `store-brand-inference.md`
3. Deploy do serviço `BrandTextOnlyInferenceService`
4. Deploy da rota `POST /api/store/[id]/brand-profile/infer`
5. Deploy das mudanças no frontend (`store-identity-form.tsx`, `store-preview.tsx`)
6. Deploy da atualização de `resolveStoreIdentity`

### Decision 9: Timeout da rota de inferência

**Decisão:** 30s — metade do timeout de geração de assinatura visual (que usa 60s via `IMAGE_GENERATION_GLOBAL_TIMEOUT_MS`). A inferência sem imagem é significativamente mais rápida que geração de imagem.

### Decision 10: `previous_identity_snapshot` nesta fase

**Decisão:** Não popular nesta fase. A coluna é criada na migration para existir no schema, mas só será populada quando as transições entre estados forem implementadas (subfase futura).
