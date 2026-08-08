## ADDED Requirements

### Requirement: Tabela ai_model_pricing versionada

O sistema SHALL criar a tabela `public.ai_model_pricing` via migration versionada (D8) com preços por dimensão **nullable** e CHECK de ao menos uma dimensão:

```sql
CREATE TABLE IF NOT EXISTS public.ai_model_pricing (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider              TEXT NOT NULL,
  model                 TEXT NOT NULL,
  input_token_usd_per_1m        NUMERIC,
  output_token_usd_per_1m       NUMERIC,
  cached_input_token_usd_per_1m NUMERIC,
  image_unit_usd                NUMERIC,          -- custo por imagem (dall-e-3, gpt-image-2)
  image_token_usd_per_1m        NUMERIC,          -- image tokens (Responses API)
  effective_from         TIMESTAMPTZ NOT NULL,
  effective_until        TIMESTAMPTZ,             -- NULL = vigente
  source_url             TEXT,
  source_note            TEXT,
  updated_by             UUID REFERENCES auth.users(id),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_ai_model_pricing_at_least_one_price CHECK (
    input_token_usd_per_1m IS NOT NULL
    OR output_token_usd_per_1m IS NOT NULL
    OR cached_input_token_usd_per_1m IS NOT NULL
    OR image_unit_usd IS NOT NULL
    OR image_token_usd_per_1m IS NOT NULL
  )
);
```

- **Versionamento por `effective_from`/`effective_until`**: atualizar preço = fechar a linha vigente (`effective_until = now()`) e abrir nova (`effective_from = now()`), na mesma transação
- **Modelos só de imagem** (`gpt-image-2`, `dall-e-3`) NÃO definem token texto — o CHECK garante que a linha só é persistida com ao menos uma dimensão válida (não força `0` artificial)
- **RLS habilitado; acesso somente service_role** (padrão repositório) — `authenticated` não lê preços internos
- **`provider`/`model` são `TEXT`, sem CHECK fechado** (D12) — o resolvedor trabalha com qualquer string

#### Scenario: Migration cria a tabela com schema correto

- **WHEN** as migrations são listadas
- **THEN** existe `supabase/migrations/*_f38_1_create_ai_cost_accounting.sql`
- **AND** o arquivo contém `CREATE TABLE IF NOT EXISTS public.ai_model_pricing (...)` com todas as colunas e o CHECK `chk_ai_model_pricing_at_least_one_price`

#### Scenario: CHECK aceita modelo só de imagem

- **WHEN** uma linha `gpt-image-2` é inserida com apenas `image_unit_usd` preenchido (token texto NULL)
- **THEN** o CHECK `chk_ai_model_pricing_at_least_one_price` passa

#### Scenario: CHECK rejeita linha sem nenhuma dimensão de preço

- **WHEN** uma linha é inserida com todas as dimensões de preço NULL
- **THEN** o INSERT falha com violação de CHECK

#### Scenario: authenticated não lê ai_model_pricing

- **WHEN** um usuário `authenticated` tenta `SELECT` em `ai_model_pricing`
- **THEN** não retorna linhas (RLS service_role — preços internos não são dado público)

### Requirement: Seeds verificáveis de ai_model_pricing (bootstrap)

O sistema SHALL incluir seeds iniciais de `ai_model_pricing` na migration (D8) para os modelos em produção hoje — **bootstrap verificável, não valores canonizados**:

```
openai   gpt-4o                input 2.50  output 10.00
openai   gpt-4o-mini           input 0.15  output 0.60
openai   gpt-5.5               input 5.00  output 30.00  cached 0.50
openai   gpt-image-2           image_unit 0.040
openai   dall-e-3              image_unit 0.040
gemini   gemini-2.0-flash      input 0.10  output 0.40
gemini   gemini-3.1-flash-lite input 0.10  output 0.40  (NOVO — furo 3)
```

- Cada seed SHALL levar `source_url`, `source_note` e `effective_from` apontando para a fonte pública consultada no momento do seed, e `effective_until` NULL (vigente)
- `updated_by` NULL nas seeds (criadas por sistema)
- O teste (44) valida **estrutura**: ao menos uma dimensão de preço presente, `source_url`/`effective_from` preenchidos, `effective_until` NULL — **não** canoniza o valor do preço para sempre
- Preços podem variar por família/modalidade — os valores devem ser conferidos contra a fonte antes de fixar o seed (revisão do alinhamento D8)

#### Scenario: seeds presentes e vigentes

- **WHEN** as seeds são consultadas em `ai_model_pricing`
- **THEN** existe linha para `gpt-4o`, `gpt-4o-mini`, `gpt-5.5`, `gpt-image-2`, `dall-e-3`, `gemini-2.0-flash` e `gemini-3.1-flash-lite`
- **AND** cada linha tem `source_url`/`effective_from` preenchidos e `effective_until` NULL

#### Scenario: gemini-3.1-flash-lite presente nas seeds

- **WHEN** as seeds são consultadas
- **THEN** existe linha para `gemini-3.1-flash-lite` com input/output token preço (furo 3 sanado)

#### Scenario: gpt-image-2 presente nas seeds sem token texto

- **WHEN** as seeds são consultadas
- **THEN** existe linha para `gpt-image-2` com `image_unit_usd` preenchido
- **AND** `input_token_usd_per_1m`/`output_token_usd_per_1m` são NULL (CHECK passa sem forçar 0)

### Requirement: RPC admin_set_ai_model_price (transacional, versiona vigência)

O sistema SHALL criar o RPC `admin_set_ai_model_price` (SECURITY DEFINER, `SET search_path=''`, padrão admin do repositório — D8) com assinatura:

```
admin_set_ai_model_price(
  p_actor_id UUID, p_provider TEXT, p_model TEXT,
  p_input NUMERIC, p_output NUMERIC, p_reason TEXT,
  p_cached NUMERIC DEFAULT NULL, p_image_unit NUMERIC DEFAULT NULL,
  p_image_token NUMERIC DEFAULT NULL, p_source_url TEXT DEFAULT NULL,
  p_source_note TEXT DEFAULT NULL
) RETURNS JSONB { id, provider, model, effective_from, previous_id }
```

- **`p_reason` vem antes dos parâmetros com `DEFAULT`** (regra de assinatura do Postgres: parâmetro sem default não pode suceder parâmetro com default)
- `p_input`/`p_output` aceitam `NULL` (modelo só de imagem); o CHECK da tabela garante ao menos uma dimensão
- **Transacional:** fecha a linha vigente (`effective_until = now()`) + abre nova (`effective_from = now()`) na mesma transação; retorna `previous_id`
- **`p_reason` obrigatório** (rastreabilidade, padrão financeiro do repositório)
- Nenhuma mutação direta via query builder — sempre RPC (padrão financeiro)

#### Scenario: RPC atualiza fechando vigente e abrindo nova

- **WHEN** `admin_set_ai_model_price` é chamado para `gpt-4o` com novo preço e reason
- **THEN** a linha anterior vigente recebe `effective_until` preenchido
- **AND** uma nova linha é criada com `effective_from` preenchido e `effective_until` NULL
- **AND** o retorno contém `{ id, provider, model, effective_from, previous_id }`

#### Scenario: RPC versiona múltiplas atualizações

- **WHEN** `admin_set_ai_model_price` é chamado duas vezes para o mesmo modelo
- **THEN** a segunda chamada cria uma linha nova com `effective_from` novo
- **AND** apenas uma linha permanece vigente (`effective_until` NULL)

#### Scenario: RPC aceita modelo só de imagem (p_input/p_output NULL)

- **WHEN** `admin_set_ai_model_price` é chamado para `gpt-image-2` com `p_input: NULL, p_output: NULL, p_image_unit: 0.04`
- **THEN** a linha é criada com sucesso (CHECK passa)

#### Scenario: RPC rejeita chamada sem reason

- **WHEN** `admin_set_ai_model_price` é chamado com `p_reason` vazio/NULL
- **THEN** o RPC falha (reason obrigatório)

### Requirement: GET /api/admin/ai-model-pricing

O sistema SHALL expor `GET /api/admin/ai-model-pricing` (requireAdmin — D8) retornando:

```
200 { prices: [ { id, provider, model, input..., effective_from, effective_until, source_note } ] }
```

- Lista **vigentes + histórico** (todas as versões)
- Acesso apenas admin (403 para não-admin); **sem página** nesta fase

#### Scenario: GET lista preços para admin

- **WHEN** um admin chama `GET /api/admin/ai-model-pricing`
- **THEN** retorna 200 com `prices` contendo as linhas (vigentes + histórico)

#### Scenario: GET sem admin retorna 403

- **WHEN** um usuário não-admin chama `GET /api/admin/ai-model-pricing`
- **THEN** retorna 403 Forbidden

### Requirement: PUT /api/admin/ai-model-pricing

O sistema SHALL expor `PUT /api/admin/ai-model-pricing` (requireAdmin + zod + RPC — D8):

```
body: { provider, model, input, output, cached?, imageUnit?, imageToken?, sourceUrl?, sourceNote?, reason }
→ 200 { id, provider, model, effective_from, previous_id }
→ 400 (zod: provider/model/reason ausentes; nenhuma dimensão de preço)
→ 403 (não-admin)
→ 500 (erro do RPC)
```

- O schema zod SHALL exigir `provider`, `model`, `reason` e **ao menos uma** dimensão de preço (input/output/cached/imageUnit/imageToken) — espelha o CHECK do banco

#### Scenario: PUT atualiza via RPC

- **WHEN** um admin chama `PUT /api/admin/ai-model-pricing` com body válido
- **THEN** o RPC `admin_set_ai_model_price` é chamado
- **AND** retorna 200 com `{ id, provider, model, effective_from, previous_id }`

#### Scenario: PUT sem reason retorna 400

- **WHEN** `PUT` é chamado com body sem `reason`
- **THEN** retorna 400 (zod)

#### Scenario: PUT sem nenhuma dimensão de preço retorna 400

- **WHEN** `PUT` é chamado com body sem input/output/cached/imageUnit/imageToken
- **THEN** retorna 400 (zod)

#### Scenario: PUT sem admin retorna 403

- **WHEN** um usuário não-admin chama `PUT`
- **THEN** retorna 403 Forbidden
