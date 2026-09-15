# Design — Fase 47: Catálogo e Seleção de Modelos (Admin)

## Context

O Change A (`openspec/changes/archive/2026-09-13-fase-46-gateway-unico-de-ia-e-registry-de-modelos/`) entrega:

- `src/lib/ai/model-registry.ts` — defaults por capacidade (fonte da verdade em código). Cada alvo é um `AiModelTarget = { provider, model, protocol }` no `primary` **e** no `fallback`. A allowlist é `MODEL_ALLOWLIST` (`provider → model → protocolos` aceitos), `CAPABILITY_PROTOCOLS` (`capability → protocolos`) e `CAPABILITY_SEGMENTS` (`capability → segment`). A compatibilidade é validada por **capacidade + provider + modelo + protocolo** (`validateModelConfig`), nunca apenas por segmento.
- `src/lib/ai/gateway.ts` — camada única de execução/telemetria; resolve `capability → AiModelConfig` pelo `AiModelResolver` injetado, **uma tentativa**, adapter pelo `protocol` do alvo, sem fallback automático.
- `src/lib/ai/index.ts` — composição singleton (`defaultAiGateway = new AiGateway(new ModelRegistry(), defaultAdapterRegistry)`).

Para permitir troca de modelo sem deploy, a decisão precisa ser **persistida** e **administrável**. O repositório já tem dois padrões diretamente reaproveitáveis:

- `ai_model_pricing`: tabela versionada (`effective_until`), partial unique index de vigente, RLS service_role, RPC `admin_set_ai_model_price` com motivo obrigatório, API admin `GET/PUT`.
- `feature_flags`: tabela + RPC `admin_update_feature_flag` (idempotente por `operation_id`, motivo obrigatório, estende CHECKs de `admin_audit_log`) + tela "Controles operacionais".

Esta fase aplica esses padrões ao catálogo e à seleção de modelos. **Sem mudança no fluxo de geração**: o gateway apenas passa a ler a seleção (com fallback para o registry).

## Goals / Non-Goals

**Goals:**

- **Catálogo persistido** de combinações efetivamente testadas **por capacidade**, representando a compatibilidade canônica da F46 (`capability + provider + model + protocol`).
- **Seleção persistida por capacidade** com primary completo e fallback configurável somente onde o caller realmente executa fallback (`campaign_copy`). Para imagem, a alternativa de edição é selecionada em `campaign_image_edit`.
- **RPCs auditadas** (`set` e `reset`) com motivo obrigatório, idempotência e auditoria atômica.
- **Tela admin** "Modelos de IA" agrupada por Texto/Visual/Imagem, controlando primary por capacidade e fallback genérico somente em `campaign_copy`.
- **Consistência catálogo × pricing ciente da capacidade** (tokens, tool `image_generation` e custo por unidade de imagem).
- Leitura server-only fail-open com **cache compartilhado de curta duração + invalidação** (sem N+1).
- Migrar os **rótulos diagnósticos estáticos** do registry para o alvo/modelo efetivamente resolvido.

**Non-Goals:**

- Alterar prompts, regras de negócio, contrato HTTP de geração, snapshot, domínio ou UI do lojista.
- Remover o legado `campaign-intelligence` (permanece como `campaign_spec`).
- Introduzir provider novo (a allowlist inicial cobre os modelos já validados).
- Alterar `ai_model_pricing` (apenas consumir para validação).
- Criar gateway/resolver por requisição (refatoração de callers) — ver D5.
- Editar o catálogo pela UI nesta fase (catálogo somente leitura; mutação só por migration).
- Homologar candidatos automaticamente ou promover modelos por workflow de avaliação; isso fica para uma fase posterior de homologação e onboarding de modelos.

## Decisions

### D1 — Duas tabelas: `ai_model_catalog` (allowlist **por capacidade**) e `ai_model_selection` (escolha vigente)

- `ai_model_catalog`: o que **pode** ser escolhido, **uma linha por combinação efetivamente testada** `capability + segment + provider + model + protocol`. Colunas: `id`, `capability`, `segment` (`text|vision|image`), `provider`, `model`, `protocol`, `label`, `status` (`active|deprecated`), `source_note`, `validated_at`, timestamps. Único por **`(capability, provider, model, protocol)`**.
- `ai_model_selection`: o que **está** escolhido por capacidade. Colunas: `id`, `capability` (único), `provider`, `model`, `protocol`, `fallback_provider`, `fallback_model`, `fallback_protocol`, `reason`, `updated_by`, `updated_at`. O alvo **primário** carrega `protocol`; os campos de fallback só são permitidos para `campaign_copy`, que é o único caller atual com fallback genérico executado. `campaign_image_edit` é a seleção primária independente usada pelo fallback de edição de imagem.

- **Por quê (capability-scoped)**: a F46 valida compatibilidade por **capacidade + provider + modelo + protocolo**. Uma mesma família de modelo pode ter combinações validadas diferentes em capacidades distintas, mas cada combinação só entra no catálogo quando houver evidência específica registrada na matriz. Uma chave única por `(provider, model)` com um só `segment` não representa essas combinações. Ancorar a linha na capacidade elimina a ambiguidade e faz da tabela a allowlist efetiva que o RPC valida.
- **`segment` derivado**: `segment` é funcionalmente determinado por `capability` (`CAPABILITY_SEGMENTS`). A coluna é mantida para leitura/agrupamento da UI e **deve** ser igual ao segmento canônico da capacidade — invariante verificada no seed e no teste de paridade (fail-fast), não apenas no banco.
- **Por quê (separar disponível × selecionado)**: descontinuar um modelo sem perder a escolha histórica e manter o catálogo como contrato. Espelha a separação pricing (tabela) × seleção.
- **Alternativa**: uma linha por `(provider, model)` com um único `segment` — **rejeitada** (não representa a compatibilidade da F46; ver acima).

### D2 — Seleção por capacidade com primary e fallback restrito; UI agrupada por segmento

O armazenamento é por **capacidade** (as 11 do registry), mas a tela apresenta 3 grupos (**Texto, Visual, Imagem**). O default exibido vem do registry quando não há seleção. Cada capacidade expõe primary; somente `campaign_copy` expõe fallback genérico. `campaign_image_edit` é o alvo primário independente usado pelo caminho de edição/fallback de imagem.

- **Por quê**: capacidades dentro do mesmo segmento usam modelos diferentes hoje (`gpt-4o` × `gpt-4o-mini`); agrupar só na apresentação resolve a tensão "admin escolhe por segmento" × "granularidade por capacidade".
- **`campaign_image_edit` é capacidade própria**: ela tem sua linha no grupo Imagem e é o alvo primário independente usado pelo fallback de edição de imagem. Não é a representação de um fallback genérico configurável para todas as capacidades.

### D3 — Semântica da seleção persistida (primary × fallback)

Regras explícitas do contrato persistido:

1. **Sem linha persistida** para a capacidade → usa **todo o default do registry** (primary **e** fallback, incluindo a ausência de fallback quando o registry não o define).
2. **Com linha persistida** → a linha contém a configuração efetiva: `primary` sempre preenchido (`provider + model + protocol`).
3. **Fallback genérico** só pode ser persistido para `campaign_copy`, pois é o único caller que consulta `hasFallback` para uma segunda tentativa genérica.
4. **Fallback com os três campos nulos** em `campaign_copy` → **desabilitado**; preenchido exige os três campos completos (CHECK no banco + validação no RPC).
5. **Primary e fallback não podem ser iguais** (mesmo `provider` + `model`) — CHECK no banco + validação no RPC.
6. **Reset** (voltar ao default) → remove a linha; a capacidade volta à regra 1.

- **Por quê**: um estado persistido "parcial" (só primary, sem protocolo) não é representável como `AiModelConfig` e quebraria o gateway. Tornar a linha a configuração efetiva (completa) mantém o contrato da F46 intacto.

### D4 — RPC `admin_set_ai_model_selection` auditada e idempotente

`SECURITY DEFINER`, `search_path=''`, espelhando `admin_update_feature_flag`:

```
admin_set_ai_model_selection(
  p_capability TEXT,
  p_provider TEXT, p_model TEXT, p_protocol TEXT,
  p_fallback_provider TEXT, p_fallback_model TEXT, p_fallback_protocol TEXT,
  p_reason TEXT, p_actor_id UUID, p_operation_id UUID
) RETURNS JSONB
```

- Valida o **primary** `(capability, provider, model, protocol)` contra `ai_model_catalog` (status `active`) — `model_not_in_catalog`.
- Rejeita campos de fallback para qualquer capacidade diferente de `campaign_copy` — `fallback_not_supported`.
- Valida a **completude do fallback** (os três ou nenhum) — `incomplete_fallback`.
- Valida o **fallback** contra o catálogo ativo quando presente — `fallback_model_not_in_catalog`.
- Rejeita **primary = fallback** — `primary_equals_fallback`.
- Motivo obrigatório — `missing_reason`.
- Idempotência por `operation_id` (índice único em `admin_audit_log`).
- UPSERT + INSERT em `admin_audit_log` na **mesma transação** (auditoria atômica).
- Estende CHECKs de `admin_audit_log`: `action='ai_model_selection_update'`, `target_type='ai_model_selection'`.

- **Por quê**: reusa o padrão auditado existente; nenhuma mutação sem trilha.
- **Alternativa**: update direto via `supabaseAdmin` sem RPC — sem auditoria atômica nem idempotência.

### D5 — RPC `admin_reset_ai_model_selection` auditada (reverter ao default)

A tela promete "Restaurar padrão" (remover a seleção persistida). Um `DELETE` direto quebraria auditoria e idempotência. Cria-se uma operação auditada dedicada:

```
admin_reset_ai_model_selection(
  p_capability TEXT, p_reason TEXT, p_actor_id UUID, p_operation_id UUID
) RETURNS JSONB
```

- Valida `capability`/`reason`/`operation_id`.
- Idempotência por `operation_id` (`action='ai_model_selection_reset'`).
- Captura o `id` da linha existente; se **não existe** linha → no-op (`{ success: true, reset: false }`, sem mutação e sem auditoria).
- **DELETE** da linha + INSERT em `admin_audit_log` na **mesma transação**: `action='ai_model_selection_reset'`, `target_type='ai_model_selection'`, `target_id` = `id` capturado (satisfaz `target_id UUID NOT NULL`), `metadata` com a configuração removida.
- Estende CHECKs de `admin_audit_log`: `action='ai_model_selection_reset'`.

- **Por quê**: fecha o contrato de auditoria/idempotência para a ação destrutiva.
- **Alternativa**: modo `reset` na RPC de `set` — funciona, mas mistura dois `action`s e dois contratos numa única assinatura; a RPC separada deixa o `target_id` e a trilha inequívocos.

### D6 — Leitura server-only com fallback fail-open e **cache compartilhado de curta duração**

Um `PersistedModelResolver` implementa a interface `AiModelResolver` (F46, `src/lib/ai/model-resolver.ts`) **decorando** o registry em código. Os serviços de seleção e catálogo fornecem os mapas cacheados:

1. o `AiModelSelectionService` carrega `ai_model_selection` inteiro e o `AiModelCatalogService` carrega o catálogo necessário inteiro em duas consultas bulk por janela de cache;
2. o resolver consulta apenas os mapas em memória; seleção vigente com linha de catálogo `active` **ou `deprecated`** continua executável;
3. seleção ausente, linha de catálogo `missing` ou combinação incompatível → delega ao registry (default do F46, comportamento atual);
4. **nunca lança** — geração não é bloqueada por indisponibilidade de seleção.

**Cache (correção de contrato):** o serviço carrega e mantém em cache (a) o **mapa completo** de seleções e (b) o **mapa completo das combinações do catálogo necessárias à validação**, incluindo linhas `deprecated` referenciadas por seleções vigentes. São no máximo duas consultas bulk por janela; nunca há lookup no banco por capacidade ou por invoke. O resolver é o único responsável por `resolve(capability)`, validação dos mapas e fallback ao registry. O runtime valida o pareamento exato `openai → chat-completions | responses | images` e `gemini → gemini`, além da compatibilidade por capacidade. O cache compartilhado tem TTL de 30s e é invalidado explicitamente após `set`/`reset` quando o mecanismo compartilhado entre instâncias estiver disponível. Se for apenas em memória por instância, outras instâncias podem observar a mudança somente até o TTL.

O gateway **não muda**: continua dependendo apenas de `AiModelResolver`; a F47 injeta o `PersistedModelResolver` no lugar do registry na composição de `src/lib/ai/index.ts`.

- **Por quê**: mesmo contrato fail-open de `getModelPricing`; a ausência de linhas não pode quebrar geração; a leitura repetida por run é evitada.
- **Alternativa (rejeitada)**: cache por request (per-operation resolver) — refatoração ampla e fora do escopo.

### D7 — Autoridade catálogo × código

- **O catálogo** (`ai_model_catalog`) é a autoridade sobre **quais combinações capability + provider + model + protocol estão aprovadas**, validada pelo RPC no `set`.
- **O código** (`CAPABILITY_SEGMENTS`, adapters e registry) é a autoridade sobre capacidades conhecidas, providers/protocolos suportados pelo runtime e defaults da F46. `MODEL_ALLOWLIST` permanece apenas para validar os defaults da F46 e não rejeita modelos adicionais aprovados no catálogo.
- **O resolver** valida a tupla contra o catálogo e valida o pareamento provider/protocolo contra o código suportado. Uma seleção vigente cuja tupla existe no catálogo, mesmo `deprecated`, continua executável; somente linha ausente, parcial ou incompatível faz **fallback para o registry** (fail-open).
- **Paridade**: todo default do registry (primary + fallback) **existe** no catálogo; todo provider/protocolo do catálogo é suportado pelo código; o segmento do catálogo é canônico — testes falham em divergência.

- **Por quê**: evita que a persistência contorne a validação de wire/adapters da F46, mantendo o código como guardião do que é executável.

### D8 — Consistência catálogo × pricing **ciente da capacidade**

Ao listar o catálogo (e/ou ao salvar uma seleção), o sistema verifica o pricing exigido **pela capacidade**, não apenas o modelo:

- **Texto/visão** (`chat-completions`): linha vigente (ou bootstrap) com **preço de tokens** (`input`/`output`) para `(provider, model)`.
- **`campaign_image` e `visual_signature_image`** (`responses` + tool `image_generation`): preço do modelo **e** preço do componente da tool — linha `(provider, 'responses:image_generation')` com `image_unit_usd`.
- **`campaign_image_edit`** (`images`): preço **por unidade de imagem** (`image_unit_usd`) para `(provider, model)`.

A ausência de qualquer componente gera **aviso explícito** na tela/rota (não bloqueia a seleção), com cobertura `complete`, `partial` ou `missing` e a lista dos componentes ausentes. O aviso informa que a estimativa pode permanecer parcial ou seguir a cadeia existente até `fallback_static`/`not_available`; a tela não prediz a fonte final sem usage/env da chamada.

- **Por quê**: verificar só o preço de `gpt-5.5` ignoraria o componente da tool; verificar só tokens ignoraria o custo por imagem de `campaign_image_edit`.

### D9 — Tela "Modelos de IA" (design system)

Página `src/app/(app)/admin/ai-model-selection/page.tsx` + form. Agrupada por **Texto/Visual/Imagem**; o view model separa por capacidade `current` (configuração efetivamente executada pelo `PersistedModelResolver`), `configured` (seleção persistida para diagnóstico, inclusive `deprecated`, `missing` ou inválida) e `default` (registry), além da origem efetiva (`selection` × `default`). Seleção persistida inválida volta ao default em `current` e permanece visível em `configured`; seleção `deprecated` válida continua em `current` sinalizada. Cada alvo recebe `catalogStatus` pela tupla completa. A tela oferece seletor do catálogo ativo para primary e, somente em `campaign_copy`, fallback (com opção "sem fallback"), motivo obrigatório, feedback de auditoria e ação "Restaurar padrão". `campaign_image_edit` aparece como capacidade própria. Segue `openspec/design-system/MASTER.md` (dark OLED `#020617`/`#F8FAFC`/`#22C55E`, Poppins/Open Sans, **lucide-react**, sem emojis, sem light mode). Entra na nav do admin (`layout.tsx`).

- **Alternativa**: editar via API apenas — operacionalmente pior para o admin.

### D10 — Rótulos diagnósticos seguem o alvo efetivo

Após uma escolha no painel, diagnósticos não podem continuar exibindo o default da F46. Migrar as leituras estáticas do registry fora do gateway para o **alvo resolvido** ou para o **modelo efetivamente retornado**:

- `src/lib/image-generation/services/image-generation-service.ts` (`DEFAULT_IMAGE_MODEL` — hoje `MODEL_REGISTRY.campaign_image.primary.model`, usado como rótulo de métricas): usar o modelo efetivo (`result.model`) ou o alvo resolvido.
- `src/lib/visual-signature/server-actions.ts` (`VISUAL_SIGNATURE_IMAGE_MODEL` — rótulo do diagnóstico de cascata): usar o modelo efetivo/resolvido.
- `scripts/benchmark.ts` (`MODEL_REGISTRY.campaign_image.primary`): resolver via `AiModelResolver`/gateway.

### D11 — Sem mudança no fluxo de geração

O gateway resolve a seleção; prompts, retry/timeout, contratos e telemetria permanecem como no Change A. Nenhuma rota de geração muda de comportamento além da origem da config. A semântica de **quando** o fallback é acionado permanece a da F46 (gate do orquestrador via `hasFallback`).

## Data model (sketch)

```sql
CREATE TABLE public.ai_model_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capability TEXT NOT NULL,
  segment TEXT NOT NULL CHECK (segment IN ('text','vision','image')),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  protocol TEXT NOT NULL CHECK (protocol IN ('chat-completions','responses','images','gemini')),
  label TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','deprecated')),
  source_note TEXT,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (capability, provider, model, protocol)
);

CREATE TABLE public.ai_model_selection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capability TEXT UNIQUE NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  protocol TEXT NOT NULL CHECK (protocol IN ('chat-completions','responses','images','gemini')),
  fallback_provider TEXT,
  fallback_model TEXT,
  fallback_protocol TEXT CHECK (fallback_protocol IN ('chat-completions','responses','images','gemini')),
  reason TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
   CONSTRAINT chk_ai_model_selection_fallback_complete CHECK (
     (fallback_provider IS NULL AND fallback_model IS NULL AND fallback_protocol IS NULL)
     OR (fallback_provider IS NOT NULL AND fallback_model IS NOT NULL AND fallback_protocol IS NOT NULL)
   ),
   CONSTRAINT chk_ai_model_selection_fallback_capability CHECK (
     capability = 'campaign_copy'
     OR (fallback_provider IS NULL AND fallback_model IS NULL AND fallback_protocol IS NULL)
   ),
  CONSTRAINT chk_ai_model_selection_primary_distinct CHECK (
    fallback_provider IS NULL
    OR provider <> fallback_provider
    OR model <> fallback_model
  )
);
```

RLS service_role only (como `ai_model_pricing`/`feature_flags`).

### Matriz inicial do catálogo

Regra determinística (migration idempotente): usar a matriz completa abaixo. Não usar produto cartesiano de `MODEL_ALLOWLIST × CAPABILITY_PROTOCOLS`. A matriz inicial contém somente os defaults da F46, pois são as únicas combinações com evidência registrada neste change; alternativas permanecem fora do catálogo até uma tarefa de validação específica.

| capability | provider | model | protocol | papel | source_note |
|---|---|---|---|---|---|
| `campaign_copy` | `openai` | `gpt-4o` | `chat-completions` | primary default | F46 D1 registry; Copy Director text path |
| `campaign_copy` | `gemini` | `gemini-3.1-flash-lite` | `gemini` | fallback default | F46 D1/D3; explicit fallback path |
| `campaign_correction_analysis` | `openai` | `gpt-4o` | `chat-completions` | primary default | F46 D1 registry; correction analysis path |
| `brand_profile_text` | `openai` | `gpt-4o` | `chat-completions` | primary default | F46 D1 registry; brand profile text path |
| `campaign_spec` | `openai` | `gpt-4o-mini` | `chat-completions` | primary default | F46 D1 registry; legacy campaign-intelligence path |
| `campaign_input_validation` | `openai` | `gpt-4o` | `chat-completions` | primary default | F46 D1 registry; campaign input validation path |
| `campaign_image_review` | `openai` | `gpt-4o` | `chat-completions` | primary default | F46 D1 registry; image review path |
| `brand_profile_vision` | `openai` | `gpt-4o` | `chat-completions` | primary default | F46 D1 registry; brand profile vision path |
| `visual_signature_validation` | `openai` | `gpt-4o-mini` | `responses` | primary default | F46 D1 registry; visual signature validation path |
| `campaign_image` | `openai` | `gpt-5.5` | `responses` | primary default; `image_generation` tool | F46 D1/D5; Responses image generation path |
| `campaign_image_edit` | `openai` | `gpt-image-2` | `images` | primary default; image fallback target | F46 D1/D5; `images.edit` fallback path |
| `visual_signature_image` | `openai` | `gpt-5.5` | `responses` | primary default; `image_generation` tool | F46 D1/D5; visual signature image path |

> **Provider do Gemini:** o contrato canônico da F46 usa `provider = "gemini"` (nunca `"google"`). Seeds e exemplos usam `gemini`.

## RPCs (sketch)

- `admin_set_ai_model_selection(p_capability, p_provider, p_model, p_protocol, p_fallback_provider, p_fallback_model, p_fallback_protocol, p_reason, p_actor_id, p_operation_id)` → valida catálogo (primary e fallback), fallback somente em `campaign_copy`, completude/distinção, motivo e novas seleções `active`; UPSERT + auditoria atômica (`ai_model_selection_update`); idempotente por `operation_id`.
- `admin_reset_ai_model_selection(p_capability, p_reason, p_actor_id, p_operation_id)` → captura id, DELETE + auditoria atômica (`ai_model_selection_reset`); idempotente; no-op sem mutação quando não há linha.

Ambas `SECURITY DEFINER`, `search_path=''`, `REVOKE` de PUBLIC/anon/authenticated, `GRANT` a service_role. CHECKs de `admin_audit_log` estendidos por DROP/ADD preservando valores (`ai_model_selection_update`, `ai_model_selection_reset`, `ai_model_selection`).

## Migration Plan (ordem local-first — decisão do usuário)

1. **Criar e testar a migration localmente** (tabelas + seeds + RPCs + CHECKs de auditoria) — ambiente local/Supabase de desenvolvimento.
2. **Implementar e executar o UAT local** (serviços, resolver, API, tela, pricing, rótulos) com a migration local aplicada.
3. **Aplicar a migration no remoto** — **[BLOCKING]** antes de qualquer deploy que leia a seleção.
4. **Deploy do código** (leitura da seleção + gateway consumindo seleção; a tela admin).
5. **Ajustar env-vars remotas somente depois**, caso ainda existam (a F46 removeu as env-vars de modelo/provider; restam chaves e operacionais).

Rollback: a seleção é aditiva; remover a leitura volta ao registry; a migration tem bloco REVERT documentado.

## Risks / Trade-offs

- **[Seleção aponta para modelo sem pricing]** → D8 avisa por componente e cobertura da capacidade; a cadeia existente mantém o fail-open sem o painel afirmar uma fonte final.
- **[Seleção inválida/corrompida/parcial]** → validação contra catálogo no RPC + validação de tupla completa no resolver + fallback do registry (D7).
- **[N+1 na resolução]** → cache compartilhado de curta duração com invalidação (D6).
- **[Cache defasado após mudança no painel]** → `invalidateModelSelectionCache()` chamado no `set`/`reset`; TTL curto limita a janela residual.
- **[Drift registry × catálogo]** → catálogo é a autoridade das combinações aprovadas; registry permanece o default; `MODEL_ALLOWLIST` valida defaults F46. Teste de paridade (defaults ⊆ catálogo; provider/protocolo do catálogo suportado pelo runtime; `segment` = canônico).
- **[Rótulo diagnóstico defasado]** → D10 migra as leituras estáticas.
- **[Migration em produção]** → migration idempotente, RPC com REVOKE/GRANT, CHECKs de auditoria estendidos por DROP/ADD preservando valores; aplicada **localmente → UAT → remoto → deploy**.
- **[Tela quebra dark mode/a11y]** → seguir design system; testes de componente.

## Decisões consolidadas

1. `capability` permanece validada pela lista canônica em TypeScript e pelas RPCs; o banco não duplica a lista fixa em CHECK, permitindo evolução aditiva controlada.
2. Novas seleções para linhas `deprecated` são bloqueadas. Seleções já vigentes continuam funcionando e aparecem sinalizadas no catálogo/API/UI até serem substituídas ou resetadas.
3. O catálogo é somente leitura na UI; inclusão e depreciação ocorrem exclusivamente por migration nesta fase.
4. O cache usa TTL de 30s. Invalidação imediata é garantida apenas pelo mecanismo compartilhado entre instâncias; com cache apenas em memória, outras instâncias podem observar a mudança até o TTL.
5. A F47 não inclui homologação automatizada de candidatos. Novos modelos podem ser homologados manualmente/localmente e adicionados por migration com `source_note` e `validated_at`; o painel nunca cria ou promove modelos.
