## Context

A fase 4.4.1 implementou upload de logo, variantes técnicas, análise IA e brand profile para lojas **com logotipo real**. A fase 4.4.2 resolve o caso de lojas **sem logotipo**, criando um fluxo completo de:

- Geração de assinatura visual profissional via IA (diretor de identidade visual da loja)
- Inferência de brand profile a partir dos dados da loja + outputs aprovados do diretor de identidade
- Modal de aprovação com rejeição e re-geração (até 3 tentativas)
- Persistência de status da escolha (uploaded / generated / explicit_none / failed / exhausted / null)
- Métricas de geração para rastreamento de qualidade e custo

**Stack**: Next.js App Router + TypeScript + Supabase (DB + Storage) + Vercel  
**Estado atual**: `store_visual_signatures` table existe com bucket `visual-signatures`; `store_brand_profiles` table existe com CHECK constraint `source IN ('logo_analysis')`; `store_brand_assets` existe para logo; `stores` table tem campos de direção (subsegment, tone_of_voice, positioning, short_description, slogan); visual signature modal implementado com 4 opções (3 variações, automático, logo depois, logo agora).

**Buckets existentes**: `store-brand-assets` (logo + variantes), `visual-signatures` (assinaturas visuais), `store-logos` (legado).

## Goals / Non-Goals

**Goals:**
- Botão "Enviar logotipo" explícito no card de upload (além do card clicável)
- Botão "Não tenho logo" com tooltip explicativo sobre geração de assinatura visual + brand profile
- Opção "Continuar sem logo" discreta (sem destaque visual) — apenas nome da loja em tipografia simples
- Fluxo de geração de assinatura visual via `prompts/store-identity-art-director.md` (diretor de identidade visual, separado do diretor de campanhas)
- Inferência de brand profile via `prompts/store-brand-profiler.md` (executado após aprovação da assinatura, consumindo outputs do diretor de identidade visual)
- Modal de aprovação com "Aprovar" e "Não gostei, gerar outra versão" (até 3 versões, sequencial, sem gerar 3 de uma vez)
- Re-geração com feedback explícito ao diretor de identidade visual: versão anterior rejeitada, buscar nova direção criativa
- Bloqueio do botão de regenerar na 3ª versão
- Após aprovação: retornar para tela Logo e Cores, exibir assinatura aprovada no preview, inferir/preencher cor primária e cor de destaque (lojista pode alterar manualmente)
- Erro controlado em falha de geração, sem fallback tipográfico "bonitinho"
- Campo vazio/null no banco = usar nome da loja em tipografia simples nas campanhas
- Distinção de status entre "escolheu continuar sem logo" (explicit_none), "falha técnica na geração" (failed) e "limite de tentativas esgotado" (exhausted)
- Métricas de geração: generation_type, provider, model, duration, estimated_cost, attempt_number, status, error_type, prompt_version, approved, rejected, asset_generated, presença de logo/assinatura/ausência
- Toda alteração de banco via migration versionada

**Non-Goals:**
- Editor avançado de logo ou SVG
- Cobrança por gerações extras
- Dashboard de métricas
- Manual de marca completo
- Múltiplos kits complexos de logo
- Marketplace de estilos
- Geração de campanhas novas além da integração mínima necessária para consumir assinatura/brand profile aprovados
- Modificação dos prompts de campanha existentes (campaign-image-director.md, store-brand-director-with-logo.md)
- Geração de variações de assinatura visual para lojas que já têm logo real

## Decisions

### D1: AI role separation — três profissionais distintos

O sistema passa a ter três papéis de IA bem separados:

| Papel | Prompt | Responsabilidade | Executa |
|-------|--------|------------------|---------|
| **Diretor de Identidade Visual** | `prompts/store-identity-art-director.md` | Criar assinatura visual profissional para loja sem logo. Recebe dados cadastrais + contexto de rejeição (se houver). Gera PNG da assinatura + cartão de referência visual + metadados criativos (descrição, cores sugeridas, direção visual). | Quando lojista clica "Não tenho logo" |
| **Store Brand Profiler (sem logo)** | `prompts/store-brand-profiler.md` | Inferir brand profile completo a partir de dados cadastrais + outputs aprovados do diretor de identidade visual (assinatura, referência visual, metadados criativos, cores sugeridas/extraídas). | Após aprovação da assinatura visual |
| **Diretor de Campanhas** | `campaign-image-director.md` (inalterado) | Criar campanhas visuais. **Nunca** cria identidade visual do zero. Consome assinatura aprovada + brand profile persistido. | Na geração de campanhas |

O prompt `store-brand-director-with-logo.md` (fluxo com logo real) permanece inalterado e isolado deste fluxo.

### D2: Database — extensão de store_brand_profiles

A tabela `store_brand_profiles` SHALL ser alterada via migration para aceitar o novo source `without_logo`:

```sql
-- Alter CHECK constraint to include new source
ALTER TABLE public.store_brand_profiles
  DROP CONSTRAINT IF EXISTS chk_store_brand_profiles_source;

ALTER TABLE public.store_brand_profiles
  ADD CONSTRAINT chk_store_brand_profiles_source
  CHECK (source IN ('logo_analysis', 'without_logo'));
```

Novos campos opcionais no brand profile específicos para o fluxo sem logo:

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `visual_signature_id` | `uuid` | No | FK → store_visual_signatures(id), assinatura aprovada que originou este profile |
| `inferred_primary_color` | `text` | No | Cor primária inferida pela IA (pode ser diferente de brand_colors_chosen[0]) |
| `inferred_accent_color` | `text` | No | Cor de destaque inferida pela IA |
| `identity_art_director_output` | `jsonb` | No | Metadados criativos retornados pelo diretor de identidade visual (descrição, paleta sugerida, direção visual, etc.) |

**Nota**: `active_logo_asset_id` permanece nullable — no fluxo sem logo, este campo fica null.

### D3: Database — novos campos em stores

Para distinguir "escolheu continuar sem logo" de "falha na geração", a tabela `stores` SHALL receber:

```sql
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS logo_status TEXT,
  ADD COLUMN IF NOT EXISTS visual_signature_attempts INTEGER NOT NULL DEFAULT 0;
```

CHECK constraint opcional (recomendado):
```sql
CONSTRAINT chk_stores_logo_status CHECK (
  logo_status IS NULL OR
  logo_status IN ('uploaded', 'generated', 'explicit_none', 'failed', 'exhausted')
);
```

| logo_status | Significado |
|-------------|-------------|
| `null` | Loja criada, sem interação com logo/assinatura |
| `uploaded` | Lojista fez upload de logo real |
| `generated` | Assinatura visual gerada e aprovada |
| `explicit_none` | Lojista escolheu explicitamente "Continuar sem logo" |
| `failed` | Erro técnico na geração (modelo/conexão/servidor) |
| `exhausted` | Lojista rejeitou as 3 versões geradas — limite de tentativas esgotado |

`visual_signature_attempts` conta versões geradas, não rejeições. A primeira geração já é attempt 1. Reseta quando uma assinatura é aprovada.

### D4: Database — tabela de eventos de geração (métricas)

Nova tabela para rastreamento de eventos de geração, seguindo o padrão de migration versionada:

```sql
CREATE TABLE IF NOT EXISTS public.generation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  generation_type TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  duration_ms INTEGER,
  estimated_cost_usd REAL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL,
  error_type TEXT,
  prompt_version TEXT,
  approved BOOLEAN,
  rejected BOOLEAN,
  asset_generated BOOLEAN,
  asset_id UUID,
  has_logo BOOLEAN,
  has_generated_signature BOOLEAN,
  has_brand_profile BOOLEAN,
  input_data_hash TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON public.generation_events (store_id);
CREATE INDEX ON public.generation_events (generation_type);
CREATE INDEX ON public.generation_events (created_at);
```

| generation_type | Valores |
|----------------|---------|
| `visual_signature` | Geração de assinatura visual |
| `brand_profile_without_logo` | Geração de brand profile sem logo |
| `brand_profile_with_logo` | Geração de brand profile com logo (já existe, agora com métricas) |

**CHECK constraints**:
```sql
CONSTRAINT chk_generation_events_type CHECK (generation_type IN ('visual_signature', 'brand_profile_without_logo', 'brand_profile_with_logo')),
CONSTRAINT chk_generation_events_status CHECK (status IN ('success', 'failed', 'rejected', 'timeout'))
```

### D5: UI — Step 2 "Logo e Cores" modificado

O step 2 da tela `/store` (`store-identity-form.tsx`) SHALL ser modificado para incluir:

**1. Card de upload + botão "Enviar logotipo" explícito**
- Manter o card drag-and-drop clicável existente
- Adicionar abaixo um botão secundário `Enviar logotipo` que aciona o mesmo file input
- Texto: "Enviar logotipo" com ícone Upload

**2. Botão "Não tenho logo"**
- Botão primário (estilo outline, não verde) com texto "Não tenho logo" e ícone Sparkles
- tooltip/alert via popover ou tooltip nativo: "O Vendeo vai criar uma assinatura visual profissional para sua loja e montar uma identidade visual completa alinhada ao perfil da loja."

**3. Opção "Continuar sem logo"**
- Link/button discreto, sem destaque visual (text-text-muted, sem borda, sem fundo)
- Texto: "Continuar sem logo"
- tooltip/alert: "O Vendeo usará apenas o nome da loja com as cores escolhidas, sem assinatura visual personalizada."
- Este caminho não é recomendado para campanhas com efeito "UAU"

**4. Fluxo ao clicar "Não tenho logo"**
- Abre modal/tela de geração de assinatura visual (reutilizando estrutura do `VisualSignatureModal`, mas com fluxo diferenciado)
- Não gera 3 variações — gera 1 por vez, sequencialmente
- Apresenta resultado para aprovação

**5. Modal de aprovação**
- Exibe a assinatura gerada em preview (tamanho razoável, ~400x400px)
- Exibe tentativa atual (1/3, 2/3, 3/3)
- Botão "Aprovar" (primário verde)
- Botão "Não gostei, gerar outra versão" (outline, só ativo se tentativas < 3)
- Na 3ª tentativa, botão de rejeição fica bloqueado/inativo com tooltip "Limite de 3 versões atingido"

**6. Comportamento após aprovação**
- Fecha modal
- Atualiza `logo_status` para `generated`
- Atualiza `store_visual_signatures` com a assinatura aprovada como `active`
- Executa store-brand-profiler (via IA) para inferir brand profile
- Persiste brand profile com source `without_logo`
- Retorna para tela Logo e Cores
- Preview da loja exibe a assinatura aprovada no lugar do círculo de inicial/cor
- Cor primária e cor de destaque são inferidas/preenchidas automaticamente (do brand profile ou dos metadados do diretor de identidade visual)
- Lojista pode alterar as cores manualmente antes de salvar

**7. Estado após "Continuar sem logo"**
- Seta `logo_status` para `explicit_none`
- Nenhuma assinatura gerada
- Preview usa apenas nome da loja com cores escolhidas
- Diretor de campanhas usa nome da loja em tipografia simples
- Não insistir no fluxo de campanha, mas o botão "Criar Assinatura Visual" ainda fica disponível na seção de identidade visual para permitir que o lojista crie depois se mudar de ideia

### D6: API — novos endpoints e modificações

**POST /api/store/[id]/visual-signature/generate-without-logo**
- Gera 1 assinatura visual usando o diretor de identidade visual (sem logo)
- Body: dados da loja + contexto de rejeição (se houver)
- Retorna: asset_url da assinatura gerada + metadados criativos
- Processamento inline (mesmo padrão da fase 4.4.1)

**POST /api/store/[id]/visual-signature/reject**
- Registra rejeição da versão atual
- Marca o asset atual em `store_visual_signatures` como `archived` com metadata: `rejected: true`, motivo de rejeição opcional e `attempt_number`
- **Não** incrementa `visual_signature_attempts` — o incremento ocorre no momento da geração, não da rejeição
- Retorna contexto de rejeição para alimentar a próxima geração
- Se `visual_signature_attempts >= 3`, não permite nova geração; define ou mantém `logo_status = exhausted` e retorna as 3 assinaturas geradas para reavaliação

**POST /api/store/[id]/brand-profile/generate-without-logo**
- Gera brand profile a partir de dados cadastrais + outputs aprovados do diretor de identidade visual
- Body: dados da loja + visual_signature_id + metadados criativos
- Persiste com source `without_logo`
- Inline processing (mesmo padrão)

**PATCH /api/store/[id]/logo-status**
- Atualiza logo_status e visual_signature_attempts
- Body: { logo_status: string, visual_signature_attempts?: number }

### D7: Store Identity Art Director — IA flow (sem logo)

**Prompt**: `prompts/store-identity-art-director.md`

**Input:**
- Dados cadastrais da loja: name, segment, subsegment, tone_of_voice, positioning, short_description, slogan, city, state
- Contexto de rejeição (se houver): "A versão anterior foi rejeitada porque: [motivo]. Busque uma direção criativa completamente diferente — não apenas uma variação pequena da anterior."

**Processamento:**
1. Enviar dados textuais para LLM (modelo com capacidade de geração de imagem, ou texto->imagem via prompt)
2. LLM gera assinatura visual (PNG) + cartão de referência visual em fundo neutro
3. Extrair metadados criativos: descrição da assinatura, cores sugeridas/extraídas, direção visual, elementos usados

**Output (estruturado):**
```json
{
  "asset_url": "url da assinatura PNG",
  "reference_card_url": "url do cartão de referência (se gerado)",
  "creative_description": "Descrição textual da direção criativa adotada",
  "suggested_colors": ["#HEX1", "#HEX2"],
  "visual_direction": "Moderna e minimalista",
  "elements_used": ["ícone de loja", "tipografia bold"]
}
```

**Cascata de falha (reutilizando padrões existentes do projeto):**
1. Tentativa 1: geração completa (assinatura + referência + metadados) com timeout configurável
2. Se falhar (timeout/erro): retentar 1 vez com prompt simplificado — usar mesmo padrão de progresso/timeout/retry já implementado nas gerações de imagem existentes
3. Se retry falhar: erro controlado — sem fallback tipográfico
4. Erro: "Não foi possível criar sua assinatura visual agora. Pode haver instabilidade temporária no serviço de IA, problema de conexão ou servidor. Tente novamente mais tarde."
5. Duração real de geração de imagem pode chegar a 60-70s conforme testes do projeto — validar timeout da infraestrutura (Vercel hobby: 60s) antes de confirmar processamento inline para este endpoint

### D8: Store Brand Profiler (sem logo) — IA flow

**Prompt**: `prompts/store-brand-profiler.md`

**Input:**
- Dados cadastrais da loja (name, segment, subsegment, tone_of_voice, positioning, short_description, slogan, city, state)
- Outputs aprovados do diretor de identidade visual:
  - creative_description
  - suggested_colors
  - visual_direction
  - elements_used
  - asset_url (assinatura)
  - reference_card_url (se existir)

**Processamento:**
- Executado APÓS aprovação da assinatura visual
- Não analisa imagem pesadamente — mas não ignora a assinatura aprovada
- Usa os metadados criativos + dados cadastrais para inferir brand profile completo

**Output** (mesmo formato do brand-director-with-logo):
```json
{
  "logo_colors_detected": ["#HEX1", "#HEX2"],
  "safe_color_tokens": { "primary": "#HEX", "secondary": "#HEX", "accent": "#HEX", "background": "#HEX" },
  "visual_style": "descrição",
  "visual_tone": "descrição",
  "typography_direction": "descrição",
  "brand_personality": "descrição",
  "campaign_guidelines": "diretrizes",
  "campaign_brief": "brief",
  "inferred_primary_color": "#HEX",
  "inferred_accent_color": "#HEX",
  "confidence_score": 0.85
}
```

### D9: Re-geração com feedback

O limite é de 3 assinaturas geradas, não 3 rejeições. O fluxo evita off-by-one:

1. **Geração 1** → attempt_number = 1. Se rejeitar, gera versão 2.
2. **Geração 2** → attempt_number = 2. Se rejeitar, gera versão 3.
3. **Geração 3** → attempt_number = 3. Botão "Não gostei, gerar outra versão" fica inativo.
4. Após 3 tentativas esgotadas → `logo_status` = `exhausted`.
5. Oferecer "Continuar sem logo" como opção após esgotar tentativas.

A contagem de tentativas (attempt_number) é incrementada no momento da geração, não no momento da rejeição. `visual_signature_attempts` reflete quantas versões já foram geradas.

Quando o lojista rejeita uma versão (attempts < 3):

1. Modal pergunta: "O que você não gostou?" (opcional, campo de texto livre)
2. Se lojista não quiser explicar, pode apenas clicar "Gerar outra versão"
3. Contexto de rejeição é estruturado e enviado ao diretor de identidade visual:
   - Se lojista deu feedback: incluir textualmente
   - Se não: "A versão anterior foi rejeitada sem feedback específico. Busque uma direção criativa completamente diferente — não apenas uma variação pequena da anterior."
4. Diretor de identidade visual recebe instrução explícita: "NÃO faça uma variação pequena da versão rejeitada. Busque uma NOVA DIREÇÃO CRIATIVA."
5. A próxima geração terá attempt incrementado.

### D10: Persistência da assinatura aprovada

Após aprovação:

1. Assinatura PNG já está em `visual-signatures/{store_id}/{uuid}.png` (gerada pelo diretor de identidade)
2. Se cartão de referência foi gerado, também está em `visual-signatures/{store_id}/{uuid}_reference.png`
3. Registro em `store_visual_signatures`:
   - type = `ai_generated`
   - status = `active` (diretamente, é escolha do usuário)
   - generation_mode = `user_choice`
   - metadata.generation_tier = `image_direct` ou `image_retry`
4. Registro anterior (se houver) vira `archived`
5. `stores.logo_status` = `generated`
6. `stores.visual_signature_attempts` = 0 (reset)

### D11: Persistência do brand profile (sem logo)

Após aprovação da assinatura + execução do brand profiler:

1. Registro em `store_brand_profiles`:
   - source = `without_logo`
   - active_logo_asset_id = null
   - visual_signature_id = id da assinatura aprovada
   - brand_colors_chosen preenchido com inferred_primary_color + inferred_accent_color
   - Demais campos preenchidos pelo profiler
   - status = `synced` (diretamente, inline)
2. Profile anterior (se houver) vira `outdated`

### D12: Erro controlado — sem fallback tipográfico

Dois cenários distintos de falha:

**Cenário A — Erro técnico (failed):**
A geração falhou por timeout, erro de modelo, conexão ou servidor.
1. `stores.logo_status` = `failed`
2. Nenhuma assinatura visual gerada
3. Mensagem de erro: "Não foi possível criar sua assinatura visual agora. Pode haver instabilidade temporária no serviço de IA, problema de conexão ou servidor. Tente novamente mais tarde."
4. Botão "Tentar novamente" (mantém attempt atual, não incrementa — é um retry técnico)
5. Opção "Continuar sem logo" disponível no erro
6. **Não gerar** fallback tipográfico "bonitinho", monograma, iniciais ou falso logo

**Cenário B — Limite de tentativas esgotado (exhausted):**
Lojista rejeitou as 3 versões geradas.
1. `stores.logo_status` = `exhausted`
2. `stores.visual_signature_attempts` = 3
3. Botão "Não gostei, gerar outra versão" inativo com tooltip "Limite de 3 versões atingido"
4. Exibir as 3 assinaturas geradas para reavaliação, permitindo aprovar uma delas ou continuar sem logo
5. Futuramente (fora do escopo desta fase): permitir gerações pagas extras

**Em ambos os cenários:**
- Campo vazio/null na campanha = usar nome da loja em tipografia simples com as cores salvas
- Nunca gerar fallback tipográfico artificial

### D13: Métricas de geração

Sempre que uma geração ocorrer (assinatura visual ou brand profile), a tabela `generation_events` SHALL receber um registro:

**Na geração de assinatura visual:**
- generation_type = `visual_signature`
- provider/model = do LLM usado
- duration_ms = tempo total
- estimated_cost_usd = custo estimado (quando disponível)
- attempt_number = tentativa atual (1-3)
- status = `success` | `failed` | `timeout`
- error_type = tipo do erro, se houver
- prompt_version = hash/versão do prompt usado
- approved = true se aprovado
- rejected = true se rejeitado
- asset_generated = true se gerou asset
- asset_id = id do store_visual_signatures (se gerado)
- has_logo = false
- has_generated_signature = (preenchido após)
- has_brand_profile = (preenchido após)

**Na geração de brand profile sem logo:**
- generation_type = `brand_profile_without_logo`
- approved = true (é automático após aprovação da assinatura)

### D14: Resolução de identidade da loja (resolveStoreIdentity)

A função `resolveStoreIdentity` SHALL ser atualizada para considerar o novo estado:

```
1. store_brand_assets ativo (logo) → logoUrl, brandProfile (source=logo_analysis)
2. store_visual_signatures ativo (assinatura aprovada) + brandProfile (source=without_logo) → visualSignatureUrl, brandProfile
3. store_brand_profiles ativo (source=without_logo) sem assinatura → nome da loja, brandProfile
4. Nada → nome da loja, fallback por segmento
```

A prioridade do `logo_status` para decisões de UI:

| logo_status | Comportamento |
|-------------|---------------|
| `uploaded` | Mostrar logo no preview |
| `generated` | Mostrar assinatura visual no preview |
| `explicit_none` | Nome da loja + cores no preview. Não insistir no fluxo de campanha, mas ainda permitir que o lojista crie assinatura visual depois na tela de Logo e Cores |
| `failed` | Nome da loja + cores, oferecer tentar novamente |
| `exhausted` | Nome da loja + cores no preview. Mostrar "Limite de 3 versões atingido". Permitir reavaliar as 3 assinaturas já geradas (aprovar uma delas) ou continuar sem logo |
| `null` | Oferecer upload, "Não tenho logo", "Continuar sem logo" |

### D15: Storage — sem novos buckets

Os buckets existentes são suficientes:
- `visual-signatures` bucket → assinatura visual gerada + cartão de referência
- `store-brand-assets` bucket → não usado neste fluxo (sem logo real)

Path para assinatura visual sem logo:
```
visual-signatures/{store_id}/{uuid}.png
visual-signatures/{store_id}/{uuid}_reference.png  # cartão de referência (se gerado)
```

### D16a: Ciclo de vida do asset antes da aprovação

O asset gerado precisa de estado claro mesmo antes da decisão do lojista:

1. **Ao gerar assinatura**: salvar em `store_visual_signatures` com status `draft`, metadata com creative_description, attempt_number, provider, modelo usado
2. **Se aprovar**: status vira `active` (comportamento já documentado em D10)
3. **Se rejeitar**: status vira `archived` (não `draft`), metadata registra rejected=true, motivo de rejeição (se fornecido), attempt_number
4. **Se fechar modal sem decidir**: permanece `draft` — lojista pode retomar depois. Ao reabrir o fluxo, verificar se há draft pendente e oferecer continuar de onde parou

Isso evita assets soltos no storage sem estado claro e permite rastrear todo o histórico de tentativas.

### D16b: Migration versionada — ordem

Migrations para esta fase (ordem obrigatória):

1. `20260603000001_alter_store_brand_profiles_source.sql` — altera CHECK constraint, adiciona colunas (visual_signature_id, inferred_primary_color, inferred_accent_color, identity_art_director_output)
2. `20260603000002_add_store_logo_status.sql` — adiciona logo_status, visual_signature_attempts a stores
3. `20260603000003_create_generation_events.sql` — cria tabela generation_events

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| Lojista não entende diferença entre "Não tenho logo" e "Continuar sem logo" | Tooltip/alert explicativo em cada opção, com linguagem simples e clara |
| Lojista rejeita 3 versões e fica sem assinatura | Oferecer "Continuar sem logo" como fallback após esgotar tentativas |
| IA gera assinatura de baixa qualidade visual | Diretor de identidade visual recebe instruções rigorosas de qualidade; metadados criativos permitem auditoria futura |
| Geração de assinatura visual excede timeout serverless (Vercel 60s hobby, 300s pro) | Em testes reais, geração de imagem via IA pode levar 60-70s, próximo ou acima do limite hobby. A geração de assinatura visual DEVE reutilizar o padrão de progresso/timeout/retry já existente nas gerações de imagem do projeto. Validar explicitamente o limite da infraestrutura atual antes de definir processamento inline. Se necessário, considerar migrar para rotação assíncrona com polling em fase futura. |
| Lojista espera 3 versões para escolher (comportamento anterior) | UX educa que a geração é sequencial com feedback direcional; diferente do fluxo "Gerar 3 opções" para logos |
| Brand profile sem logo tem qualidade inferior ao com logo | confidence_score permite ao sistema decidir se usa ou não; lojista pode ajustar cores manualmente |
| Perda de dados de rejeição entre tentativas | Contexto de rejeição persistido em metadata do store_visual_signatures rejeitado |
| Lojista fecha o modal de aprovação sem decidir | Assinatura permanece em draft; lojista pode retomar depois; próxima visita ao step 2 mostra draft pendente |

## Open Questions

- **Qual modelo de geração de imagem usar para assinatura visual sem logo?** Usar providers de imagem já suportados pelo projeto. Depende de disponibilidade e custo. Resolver no spec.
- **O cartão de referência visual deve ser gerado como imagem separada ou como parte do mesmo prompt?** Provavelmente como imagem separada (mesma chamada, dois outputs), para que o diretor de campanhas tenha uma referência limpa.
- **Como estruturar o contexto de rejeição?** Texto livre do lojista + estrutura automática "versão rejeitada, buscar nova direção criativa". Pode evoluir para checkboxes de motivo no futuro.
- **Prompt version tracking:** usar hash do conteúdo do prompt ou version tag semântica? Sugestão: hash SHA256 do prompt file para rastreamento automático.
- **estimated_cost_usd:** como calcular para diferentes providers? Provider-specific cost calculator module, mesmo padrão das métricas existentes.
- **Re-geração com mesmo prompt simplificado vs prompt enriquecido?** Após rejeição, o prompt deve ser enriquecido com o contexto de rejeição — não simplificado. Prompt simplificado é apenas para retry técnico (timeout/erro).
