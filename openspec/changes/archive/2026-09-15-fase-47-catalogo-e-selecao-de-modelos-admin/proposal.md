## Why

O Change A (`openspec/changes/archive/2026-09-13-fase-46-gateway-unico-de-ia-e-registry-de-modelos/`) concentra as chamadas de IA num gateway único e move a decisão de modelo para um registry em código. Ainda assim, trocar de modelo continua exigindo alteração de código e deploy. Para permitir **controle operacional real** — atualizar modelos e ajustar custo sem deploy — é preciso persistir a decisão e expor uma tela administrativa.

O repositório já tem os padrões necessários: `ai_model_pricing` (catálogo versionado com RPC auditada `admin_set_ai_model_price` e API admin), `feature_flags` (flag persistida com auditoria, idempotência por `operation_id` e tela "Controles operacionais"). Esta fase aplica o mesmo padrão ao **catálogo e à seleção de modelos de IA**.

## What Changes

- **Catálogo de combinações efetivamente testadas por capacidade** persistido (`ai_model_catalog`): uma linha por combinação `capability + segment + provider + model + protocol`, única por `(capability, provider, model, protocol)`. A matriz inicial completa contém os 11 defaults primários da F46 e o fallback default de `campaign_copy`; não é produto cartesiano de allowlists. Alternativas só entram com validação específica da capacidade.
- **Seleção vigente por capacidade** persistida (`ai_model_selection`): primary com `provider + model + protocol`; fallback genérico somente para `campaign_copy`, que é o único caller que executa fallback genérico. `campaign_image_edit` permanece capacidade própria e é selecionada como primary no caminho de edição de imagem.
- **Leitura server-only com fallback fail-open** para os defaults do registry em código — seleção ausente/erro nunca bloqueia geração — com dois mapas bulk cacheados (seleções e catálogo, incluindo deprecated vigentes), no máximo duas consultas por janela e **invalidação explícita** após `set`/`reset`.
- **RPCs auditadas**: `admin_set_ai_model_selection` (valida catálogo, motivo obrigatório, auditoria atômica, idempotência) e `admin_reset_ai_model_selection` (reverter ao default, com a mesma garantia de auditoria/idempotência).
- **Serviço de leitura** `AiModelSelectionService` (carrega/cacheia o mapa completo) + `PersistedModelResolver` (único dono de `resolve`, validação e fallback ao registry), injetado no gateway sem alterar o gateway.
- **Tela administrativa "Modelos de IA"** agrupada por **Texto, Visual e Imagem**, com seletor de primary por capacidade e fallback genérico apenas para `campaign_copy`, exibição do default vigente, `catalogStatus` (`active|deprecated|missing`), motivo obrigatório, feedback de auditoria e ação "Restaurar padrão". Segue `openspec/design-system/MASTER.md`.
- **API admin** `GET/PUT/DELETE /api/admin/ai-model-selection` (padrão `apiHandler` + `requireAdmin` + schema Zod), onde `DELETE` aciona a RPC de reset auditada.
- **Consistência catálogo × pricing ciente da capacidade**: verifica o pricing exigido pela capacidade (tokens; componente da tool `responses:image_generation` em `campaign_image`/`visual_signature_image`; unidade de imagem em `campaign_image_edit`) e sinaliza explicitamente o que falta, sem bloquear.
- **Rótulos diagnósticos** fora do gateway (`image-generation-service`, `visual-signature/server-actions`, `benchmark`) passam a refletir o alvo/modelo efetivamente resolvido.
- **Sem mudança de fluxo de geração**: a seleção apenas muda a origem da config consumida pelo gateway; prompts, regras, retry/timeout, telemetria e contratos externos permanecem intactos.

## Capabilities

### New Capabilities

- `ai-model-catalog`: catálogo persistido de combinações efetivamente testadas **por capacidade**, com segmento, rótulo, status e origem; somente leitura nesta fase.
- `ai-model-selection`: seleção persistida por capacidade, com fallback genérico somente para `campaign_copy`, RPCs auditadas (`set` e `reset`), motivo obrigatório, idempotência e leitura server-only com fallback para os defaults do registry.
- `admin-ai-model-selection`: tela administrativa agrupada por Texto/Visual/Imagem para escolher primary por capacidade e fallback apenas onde há caller real, com auditoria, visibilidade do default e restauração do padrão.

### Modified Capabilities

- `ai-model-registry`: o registry em código passa a ser o **default/fallback**; a resolução aceita override persistido vindo da seleção, valida a tupla completa e mantém seleção `deprecated` ainda existente executável, caindo ao default apenas quando a linha está ausente ou incompatível.
- `ai-model-pricing`: o catálogo de modelos selecionáveis passa a ser validado **por capacidade** contra as linhas de preço vigentes (tokens, componente da tool de imagem e unidade de imagem), garantindo contabilidade clara ao trocar de modelo.

## Impact

- **Banco (migration [BLOCKING])**: novas tabelas `ai_model_catalog` (combinações testadas por capacidade) e `ai_model_selection` (primary + fallback restrito a `campaign_copy`), RPCs `admin_set_ai_model_selection` e `admin_reset_ai_model_selection` (SECURITY DEFINER, auditoria + motivo + idempotência) e extensão dos CHECKs de `admin_audit_log`. Seeds pela matriz inicial completa das 11 capacidades e fallback default de `campaign_copy`.
- **Ordem de migration (decisão do usuário)**: (1) criar/testar localmente; (2) implementar e rodar UAT local; (3) aplicar no remoto; (4) deploy do código; (5) ajustar env-vars remotas só se ainda existirem.
- **Código novo**: `src/lib/ai/ai-model-catalog-service.ts` (ou equivalente), `src/lib/ai/ai-model-selection-service.ts`, `src/lib/ai/persisted-model-resolver.ts`, `src/app/api/admin/ai-model-selection/route.ts`, `src/app/(app)/admin/ai-model-selection/{page.tsx,form.tsx}`.
- **Código alterado**: `src/lib/ai/index.ts` (compõe o `PersistedModelResolver` no gateway padrão), `src/lib/admin/schemas.ts` (schemas de update/reset), `src/lib/admin/labels.ts` (labels de auditoria), `src/app/(app)/admin/layout.tsx` (nav), `src/lib/ai-cost/ai-model-pricing.ts`/`cost-estimator.ts` (validação catálogo × preço, se necessário), `src/lib/image-generation/services/image-generation-service.ts`, `src/lib/visual-signature/server-actions.ts`, `scripts/benchmark.ts` (rótulos diagnósticos).
- **Testes**: serviço de leitura com dois mapas bulk e cache/invalidação; paridade registry × catálogo (matriz completa, defaults, pareamento provider/protocolo, segmento); validação de tupla no resolver; RPCs/rota admin (set/reset, motivo, idempotência, fallback restrito, deprecated vigente, `catalogStatus`, 403/400); tela (agrupamento, primary, fallback apenas em `campaign_copy`, restaurar padrão); pricing por capacidade; regressão de que o gateway cai no default quando não há seleção.
- **Deploy**: migration aplicada no remoto após UAT local e antes do deploy que lê a seleção; fallback para o registry garante que a ausência de linhas não quebra nada.
- **Homologação fora do escopo**: a F47 não executa checagem automatizada de candidatos nem chamadas pagas para avaliar qualidade, structured output, visão, tools, custo, latência ou segurança. Um modelo novo pode ser homologado manualmente/localmente e incluído por migration com `source_note` e `validated_at`; a UI permanece somente leitura para o catálogo.
- **Referência de design**: `openspec/design-system/MASTER.md` (dark OLED `#020617`/`#F8FAFC`/`#22C55E`, Poppins/Open Sans, lucide-react, sem emojis, sem light mode).
