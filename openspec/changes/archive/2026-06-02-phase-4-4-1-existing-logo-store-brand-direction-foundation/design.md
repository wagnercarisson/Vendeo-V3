## Context

O Vendeo atualmente persiste identidade da loja na tabela `stores` com campos básicos (name, segment, city, state, brand_color, logo_url). Não há suporte a upload de logo, versionamento de assets, análise de identidade visual ou perfil de marca estruturado. A geração de campanhas usa fallback de cor por segmento quando brand_color é null.

Esta fase adiciona a fundação de identidade visual para lojas COM logotipo existente: upload com validação, versionamento de assets, geração de versões técnicas seguras, análise por IA (Store Brand Director) e persistência de brand profile para consumo na geração de campanhas.

**Stack**: Next.js App Router + TypeScript + Supabase (DB + Storage) + Vercel
**Estado atual**: `stores` table with logo_url as text field (sem upload, sem versionamento)
**Bucket atual**: Nenhum bucket específico para logos. `visual-signatures` bucket existe para assinaturas visuais.

## Goals / Non-Goals

**Goals:**
- Upload de logo (PNG/JPG/WEBP) com validação de formato, MIME real, tamanho (5MB) e dimensões mínimas
- Versionamento de assets: cada upload gera novo registro, assets antigos são archived (nunca sobrescritos)
- Geração de versões técnicas do logo: original, normalized, on_light, on_dark, square_safe, horizontal_safe como registros independentes em store_brand_assets com parent_asset_id
- Análise do logo via IA para inferir cores, estilo visual, tom e personalidade da marca
- Persistência de brand profile em tabela própria (store_brand_profiles) com cores detectadas, cores escolhidas, guidelines e brief
- Expansão da tabela stores com campos de direção de marketing: subsegment, tone_of_voice, positioning, short_description, slogan
- Endpoints controlados para brand profile: gerar (via IA), ler ativo, arquivar/marcar outdated
- Integração mínima do brand profile na geração de campanhas (contexto prioritário, fallback por segmento)
- Prompt Store Brand Director em `prompts/store-brand-director-with-logo.md`

**Non-Goals:**
- Upload de SVG (bloqueado na V3 v1)
- Upload de ícone (fora da V3 v1)
- Geração/recriação/redesign/coloração criativa do logo — o logo é preservado como enviado
- Exposição de variantes técnicas ou análise técnica ao lojista na UI
- Tela de restauração de logo antigo (base permite, UI fica para futuro)
- Modal de conflito entre cor detectada e cor escolhida
- Geração de assinatura visual (store-visual-signature) — esta fase apenas resolve prioridade
- Loja sem logo (fase futura 4.4.2)

## Decisions

### D1: Storage architecture — bucket `store-brand-assets`

**Path structure:**
```
store-brand-assets/
  {store_id}/
    original/
      {uuid}.{ext}        # uploaded file as-is
    normalized/
      {uuid}.png          # normalized to safe canvas
    on_light/
      {uuid}.png          # logo on light background variant
    on_dark/
      {uuid}.png          # logo on dark background variant
    square_safe/
      {uuid}.png          # safe square crop variant
    horizontal_safe/
      {uuid}.png          # safe horizontal variant
```

**Rationale**: Separar variantes em subdiretórios por tipo mantém organização previsível. UUID no filename garante unicidade sem colisão. Bucket dedicado evita misturar com visual-signatures e outros assets.

### D2: Database — store_brand_assets

Cada asset (original + cada variante técnica) é um registro independente. Variantes apontam para o original via `parent_asset_id`.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, gen_random_uuid() |
| store_id | uuid | FK → stores(id) |
| asset_type | text | `logo` (único na V3 v1) |
| variant_type | text | `original`, `normalized`, `on_light`, `on_dark`, `square_safe`, `horizontal_safe` |
| source | text | `user_upload`, `system_generated` |
| parent_asset_id | uuid | nullable — variantes apontam para o original |
| storage_path | text | bucket path relativo |
| mime_type | text | e.g. image/png |
| width | int | px |
| height | int | px |
| size_bytes | int | |
| checksum | text | SHA-256 do arquivo |
| version | int | incrementa por ciclo de upload |
| status | text | `active`, `archived`, `failed` |
| metadata | jsonb | geração params, erros, etc |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Constraints:**
- Partial unique index: `(store_id, asset_type, variant_type)` WHERE status = 'active' — garante no máximo um active por variante por loja
- CHECK: status IN ('active', 'archived', 'failed')
- CHECK: variant_type IN ('original', 'normalized', 'on_light', 'on_dark', 'square_safe', 'horizontal_safe')

**Versionamento**: Cada upload de novo logo incrementa `version`. O asset anterior (original + todas as variantes daquele ciclo) vai para `archived`. Assets archived nunca são apagados.

### D3: Database — store_brand_profiles

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| store_id | uuid | FK → stores(id) |
| source | text | `logo_analysis` (futuramente: `manual`, `without_logo`) |
| active_logo_asset_id | uuid | FK → store_brand_assets(id), asset original ativo |
| logo_colors_detected | jsonb | array de hex colors detectados do logo |
| brand_colors_chosen | jsonb | array de hex colors escolhidos pelo lojista |
| safe_color_tokens | jsonb | { primary, secondary, accent, ... } |
| visual_style | text | descrição do estilo visual inferido |
| visual_tone | text | tom visual (e.g. "moderno e clean") |
| typography_direction | text | direção tipográfica inferida |
| brand_personality | text | personalidade da marca |
| campaign_guidelines | text | diretrizes para campanha |
| campaign_brief | text | brief para o diretor de campanha |
| confidence_score | float | 0-1, confiança da análise |
| metadata | jsonb | modelo, provider, elapsedMs, etc |
| version | int | |
| status | text | `processing`, `synced`, `outdated`, `failed`, `archived` |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Constraints:**
- Partial unique index: `(store_id)` WHERE status = 'synced' — no máximo um perfil ativo por loja
- CHECK: status IN ('processing', 'synced', 'outdated', 'failed', 'archived')

**Ciclo de vida (V1):**
1. Upload logo → análise IA → profile criado com status `synced` ou `failed` (diretamente)
2. `processing` reservado para versão futura com fila/job durável
3. Novo upload → profile anterior vai para `outdated`
4. Lojista altera cores → profile atualizado in-place (mesmo active)
5. Soft delete do logo → profile vai para `archived`

### D4: Validation chain para upload

1. **Extensão**: .png, .jpg, .jpeg, .webp (rejeitar .svg)
2. **MIME real**: validar `file.type` no client + `fileType` do buffer no server (usar `file-type` ou `sharp`)
3. **Tamanho**: max 5MB
4. **Dimensões mínimas**: 200x200px (via sharp no server)
5. **Integridade**: Verificar se o arquivo não está corrompido (sharp consegue identificar)
6. **Erro unificado**: "Formatos aceitos: PNG, JPG ou WEBP." + mensagem específica se ultrapassou 5MB ou dimensões

### D5: Técnica para geração de variantes

Usar `sharp` (server-side) para gerar variantes a partir do original:

| Variante | Técnica |
|----------|---------|
| original | Cópia exata (sem alteração) |
| normalized | Redimensionar para canvas 500x500 com fundo transparente, preservando aspect ratio |
| on_light | Normalized + overlay de fundo branco #FFFFFF atrás do logo |
| on_dark | Normalized + overlay de fundo escuro #1A1A2E atrás do logo |
| square_safe | Normalized centralizado em canvas quadrado 500x500 |
| horizontal_safe | Normalized em canvas horizontal 800x300 |

Se alguma variante falhar, registrar status `failed` no registro com metadata do erro. Não bloquear as demais.

### D6: Store Brand Director — IA analysis flow

**Processamento inline (V1):** Em Vercel/serverless sem fila/job durável, não usar fire-and-forget nem polling sem worker. Para V1, todo o processamento ocorre inline dentro da mesma requisição HTTP.

1. Upload completo → dentro da mesma API route: validar, persistir original, gerar variantes técnicas (sharp), enviar logo para LLM com prompt `store-brand-director-with-logo.md`
2. LLM retorna JSON estruturado com: cores detectadas, estilo visual, tom, personalidade, typography_direction, campaign_guidelines, campaign_brief, confidence_score
3. Persistir brand profile com status `synced` (ou `failed` se a análise falhar)
4. Responder com o brand profile resultante
5. Se a análise IA falhar, registrar metadata do erro — lojista pode tentar novamente via novo upload ou botão de regenerar

**Nota:** O status `processing` está reservado no modelo para uso futuro com fila/job durável. Na V1 o profile é criado diretamente como `synced` ou `failed` — sem transição por `processing`.

**Prompt**: Criar `prompts/store-brand-director-with-logo.md` com instruções para:
- Analisar o logo visualmente
- Extrair paleta de cores dominantes (max 5)
- Inferir estilo visual, tom, personalidade da marca
- Cruzar com dados da loja (segment, subsegment, city, state, tone_of_voice, positioning, short_description, slogan)
- Gerar guidelines de campanha e brief estruturado
- Preservar o logo como está — não sugerir alterações criativas

### D7: API endpoints

**Logo:**
- `POST /api/store/[id]/logo` — upload de logo (multipart/form-data). Processamento inline: valida, persiste original, gera variantes técnicas (sharp), executa análise IA do Store Brand Director. Responde apenas após conclusão de todas as etapas. Sem fire-and-forget, sem polling.
- `GET /api/store/[id]/logo` — retorna dados do logo ativo (original + variantes)
- `GET /api/store/[id]/logo/versions` — histórico de versões
- `DELETE /api/store/[id]/logo` — soft delete do logo ativo

**Brand Profile:**
- `GET /api/store/[id]/brand-profile` — ler brand profile ativo (status synced)
- `POST /api/store/[id]/brand-profile/generate` — gerar/regenerar profile via IA
- `PATCH /api/store/[id]/brand-profile/colors` — atualizar cores escolhidas (sem recriar profile)
- `POST /api/store/[id]/brand-profile/archive` — arquivar profile atual

**Store (extensão):**
- `PATCH /api/store/[id]` — estendido para aceitar subsegment, tone_of_voice, positioning, short_description, slogan

### D8: Campaign integration

No pipeline de geração de campanha, ao resolver `StoreIdentitySnapshot`:
1. Buscar brand profile ativo (status = synced) para a store
2. Se existir: usar brand_colors_chosen como cores da loja, campaign_brief como contexto para diretor de campanha, campaign_guidelines como restrições, active_logo_asset_id para resolver URL do logo
3. Se não existir: manter comportamento atual (fallback brand_color → segment color)
4. O campaign_brief é injetado como contexto no prompt do Campaign Director — não como regra rígida

### D9: UI — store-identity page

- Adicionar seção de upload com drag-and-drop ou clique
- Preview circular do logo após upload
- Status simples: "Enviando...", "Processando...", "Pronto"
- Seletor de cores com paleta sugerida das cores detectadas (logo_colors_detected)
- Lojista pode alterar cores livremente — sem alerta de divergência
- Variantes técnicas NÃO são exibidas na UI
- Store fields expandidos: subsegment (text, opcional), tone_of_voice (select/dropdown, opcional), positioning (text, opcional), short_description (textarea, opcional), slogan (text, opcional)
- **subsegment**: campo opcional simples nesta fase. Sem matriz complexa por segmento. O lojista digita livremente ou seleciona de uma lista plana se definida no spec.

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| Upload de logo corrompido ou MIME enganoso | Validar no client (type) + no server (sharp/file-type), rejeitar com mensagem clara |
| Geração de variantes falha parcialmente | Cada variante tem status independente; campanha usa melhor versão disponível |
| Análise IA do logo falha ou retorna dados de baixa qualidade | confidence_score permite ao sistema decidir se usa ou não; lojista pode tentar novamente ou pular |
| Perda de assets por nome duplicado | UUID no filename + version tracking — colisão impossível |
| Performance: upload + variantes + análise IA pode exceder limite de execução serverless (Vercel 60s hobby, 300s pro) | Para V1 aceita-se o risco — sharp é rápido (<2s) e chamada LLM com imagem costuma responder em 10-30s. Se exceder, o upload falha e o lojista pode tentar novamente. |
| Lojista espera redesenho do logo | Reforçar no produto que o logo é preservado; variantes são apenas adaptações técnicas de canvas |
| Brand profile desatualizado após mudança de dados da loja | Novo upload de logo ou alteração de campos → marca profile como outdated → opção de regenerar |

## Open Questions

- **Qual provedor/modelo de visão usar para análise do logo?** OpenAI GPT-4o ou Anthropic Claude 3.5 Sonnet (precisa suportar análise de imagem). Depende de disponibilidade e custo. Resolver no spec de provider-model-switch.
- **on_dark background**: usar `#1A1A2E` como constante default. Pode ser parametrizado no futuro.
- **Subsegment**: campo opcional simples nesta fase (texto livre). Pode evoluir para lista estruturada por segmento em fase futura.
- **Qual biblioteca de processamento de imagem?** `sharp` é a escolha natural para server-side Node.js. Verificar se está disponível no runtime Vercel (suportado em Node.js runtime, não edge).
- **Decisão (análise logo síncrona vs assíncrona):** Para V1 sem fila/job durável, tudo é inline. Profile criado diretamente como `synced` ou `failed`. `processing` reservado para versão futura com job queue. UI mostra spinner e responde com resultado final.
