---
id: 261018-k9c
title: GPT-6 Luna no seletor admin de brand_profile_text e brand_profile_vision + diagnóstico do realinhamento
status: done
workflow: gsd-quick
scope: admin-model-catalog-luna-brand-profile-text-vision-and-realign-diagnostics
approval:
  by: responsável (usuário)
  date: 2026-10-18
  origin: pedidos encadeados do responsável em 2026-10-18 (Luna em brand_profile_text; ampliação para brand_profile_vision + diagnóstico do realinhamento; aceite manual do realinhamento com logo)
  decision: approved
  evidence:
    final_event_created_at: "2026-10-18T18:46:29Z"
    final_event_model: openai/gpt-6-luna
    final_event_domain_status: success
    final_profile_id: 32c1116a-1bcb-4023-bf74-beb0221fbd9a
gates:
  typecheck: pass
  lint: pass
  build: pass
  tests: pass
  paid_calls: none-by-agent
  manual_validation: approved-by-owner (Luna no realinhamento com logo; sem reenvio do logo)
deferred_out_of_scope:
  - requestId/correlação no envelope compartilhado (adiado; não implementado)
  - caminhos text_only e visual_signature do realinhamento (adiados; não implementados)
  - produção/deploy/push (separados; encerramento local apenas)
related:
  - supabase/migrations/20261018000002_quick_gpt6_luna_brand_profile_text.sql
  - supabase/migrations/20261018000003_quick_gpt6_luna_brand_profile_vision.sql
  - src/lib/brand-assets/brand-director.ts
  - src/lib/brand-assets/brand-director-error-message.ts
  - src/components/flow/use-drift-detection.ts
  - src/components/flow/store-identity-form.tsx
---

# Quick — 261018-k9c — GPT-6 Luna em `brand_profile_text` (seletor admin) — SUMMARY

**Escopo:** tornar `gpt-6-luna` (openai/chat-completions) uma **opção** do seletor admin
para a capacidade `brand_profile_text`, usando o mecanismo existente (catálogo por
capacidade → UI → seleção persistida → resolução). **Não** seleciona Luna, **não** altera
defaults nem a seleção vigente, **não** remove modelos anteriores, **não** declara validação
real. **Entrega de implementação LOCAL; migration APLICADA na `vendeo-homolog` (ledger 127→128); seleção ainda NÃO alterada.**

## Arquivos (novos; nenhum arquivo rastreado modificado)

- `supabase/migrations/20261018000002_quick_gpt6_luna_brand_profile_text.sql` — **autorada**,
  forward-only, **aplicada SÓ na `vendeo-homolog` (ledger 127→128)**.
  **SHA-256:** `CB51D75BC72C8D95E26B3BF9A5EF8C0ED9E521D17E9017EC0E8BB30B14EE4D45`.
  - Insere a tupla `('brand_profile_text','text','openai','gpt-6-luna','chat-completions')`,
    `status='active'`, `validated_at NULL`.
  - Reexecução **confere** o cadastro existente e **falha em divergência** (sem
    `ON CONFLICT DO NOTHING`); `REVERT` manual comentado.
  - Nenhum comando executável toca `campaign_copy` (menções apenas em comentários).
- `src/lib/ai/__tests__/quick-gpt6-luna-brand-profile-text.test.ts` — 4 testes focados
  (sem provider real).
- `.planning/quick/261018-k9c-.../261018-k9c-PLAN.md` — plano curto.

**Nenhum arquivo de produção (`src/lib/ai/model-registry.ts`, adapters, gateway, prompts,
rotas) foi alterado** — o suporte a Luna no adapter `chat-completions` e a allowlist
`openai: gpt-6-luna` já existiam (quick de `campaign_copy`). O único delta é a linha de
catálogo.

## Por que só a migration basta

- **UI:** `ai-model-selection-view.ts` monta as opções com
  `catalog.filter(row => row.capability === item.capability && row.status === "active")`;
  `form.tsx` renderiza no `<select>` "Novo primary". O catálogo é o único gate de opção.
- **Resolução efetiva:** `BrandTextOnlyInferenceService.infer` → `defaultAiGateway` →
  `PersistedModelResolver.buildConfig`, que valida `CAPABILITY_PROTOCOLS['brand_profile_text']
  = ['chat-completions']`, segmento `text` e presença da tupla no catálogo.
- **Pricing:** resolução de custo por `(provider, model)` (`uq_ai_model_pricing_vigente`),
  não por capacidade → o pricing vigente de `openai/gpt-6-luna` (da quick de copy) é
  **reutilizado**; nada de pricing entra na migration.

## Gates (código final)

- **`typecheck` 0** · **`lint` 0** · **`build` 0** (Next dev **parado** para não disputar
  `.next`; BUILD_ID `nmrBVbpbAek-bi9d3nO-W`; dev **religado** ao final).
- Suítes afetadas **verdes**:
  - Novo foco `quick-gpt6-luna-brand-profile-text` **4/4** (migration/tupla; resolução
    `brand_profile_text`→`gpt-6-luna`; `campaign_copy` preservado; contrato JSON simulado
    com resposta de Luna).
  - `persisted-model-resolver` + `ai-model-catalog-parity` + `ai-model-catalog-service` +
    `text-only-inference-service` **25/25**.
  - `model-registry` + `ai-model-selection-view` + `adapters` + `chat-completions` +
    `gateway-prepared` + `f47-contract-guard` + `ai-model-selection.test.tsx` +
    `unified-model-config.test.tsx` + rota `/api/admin/ai-model-selection` **94/94**.
- `git status`: apenas arquivos **novos** (migration, teste, dir da quick) + `.dev.log`
  **pré-existente** (não rastreado; preservado; fora de qualquer commit).

## Aplicação local executada — `vendeo-homolog` (2026-10-18)

**Autorizada pelo responsável; executada SÓ via `supabase migration up --local`.**

- **Destino revalidado:** workdir `G:\Vendeo-Homolog`; `project_id = "vendeo-homolog"`;
  containers `supabase_*_vendeo-homolog` Up/healthy; API loopback:57781, DB loopback:57782;
  `.env.local` → homolog.
- **SHA-256 conferido:** `CB51D75BC72C8D95E26B3BF9A5EF8C0ED9E521D17E9017EC0E8BB30B14EE4D45`.
- **Única pendente:** ledger antes **127** (última `20261018000001`); arquivos do workdir/ledger
  `workdir_pending=0`; `repo_not_in_workdir=1` (apenas a migration autorizada);
  `workdir_not_in_repo=0`; **0 divergências** de conteúdo nos 127 arquivos comuns.
- **Aplicação:** cópia para `G:\Vendeo-Homolog\supabase\migrations` + `migration up --local`
  (exit 0; NOTICE `catalog_inserted: gpt-6-luna (brand_profile_text)`).
- **Depois (verificado):** ledger **128** (última `20261018000002`);
  `brand_profile_text` → `openai/gpt-6-luna/chat-completions` **active** com
  **`validated_at = NULL`** (junto do `gpt-4o` existente);
  `campaign_copy` **preservado** (`gemini-3.1-flash-lite`, `gpt-4o`, `gpt-6-luna`);
  **seleções inalteradas** — só `campaign_copy → openai/gpt-6-luna`; **nenhuma** seleção de
  `brand_profile_text` (segue default);
  flags `product_1_1_test_stores_enabled=false` e `product_1_1_all_stores_enabled=false`
  **inalteradas**; pricing **não tocado** (17 linhas; nenhuma RPC de preço executada).
- **App acessível:** Next dev religado em `.env.local` (homolog) → `http://localhost:3000`.

## Procedimento de aplicação — EXCLUSIVAMENTE na `vendeo-homolog`

> **Aplicação da migration CONCLUÍDA (acima).** Os passos 2 e 3 (pricing/seleção) seguem
> aguardando ação humana e **não** foram executados.

1. **Migration (catálogo)** — aplicar **somente** na instância local `vendeo-homolog`
   (a mesma usada na quick de copy) via `supabase migration up --local` com o
   workdir/ambiente da `vendeo-homolog` apontado por `.env.local`. **Nunca** produção,
   remoto ou `db push`.
   - Conferir SHA-256 `CB51D75BC72C8D95E26B3BF9A5EF8C0ED9E521D17E9017EC0E8BB30B14EE4D45`
     antes de aplicar; ledger deve avançar **127 → 128**. ✅ *(feito)*
2. **Pricing** — **nenhuma alteração prevista**: reutiliza o pricing vigente de
   `openai/gpt-6-luna`. Antes de selecionar, conferir na tela admin que a opção aparece
   sem aviso de pricing incompleto. Se **faltar** pricing na homolog, o cadastro
   (`admin_set_ai_model_price`, input 0.10 / output 0.50 / cached 0.01) é passo separado e
   **exige autorização**.
3. **Seleção** — feita pelo responsável na UI admin (abaixo). Não automatizar.

## Percurso exato da UI (validação manual posterior)

1. Login admin → `/admin/ai-model-selection` ("Modelos de IA").
2. Seção **"Demais capacidades"** → grupo **"Texto"**.
3. Card **`brand_profile_text`**: no select **"Novo primary"**, escolher
   **`gpt-6-luna · openai · chat-completions`**.
4. Preencher **"Motivo da alteração"** (obrigatório) → clicar **"Salvar seleção"**
   (a página recarrega; o card passa a "Seleção persistida" com `current.primary` = Luna).
5. Exercitar `brand_profile_text`: em **`/loja`** (formulário de identidade da loja),
   acionar a **inferência/geração da identidade sem logo** — dispara
   `POST /api/store/[id]/brand-profile/infer` → `BrandTextOnlyInferenceService.infer`
   (`invoke("brand_profile_text")`).
6. **Restaurar padrão** (opcional): botão "Restaurar padrão" no mesmo card, com motivo.

## Como confirmar o modelo efetivamente chamado (telemetria, sem credenciais)

- Consultar os eventos recentes de `generation_events` do tipo `brand_profile_text`
  (colunas `provider`, `model`, `generation_type`, `estimated_cost_usd`, `cost_source`,
  `created_at`). Esperado após a troca: `provider='openai'`, `model='gpt-6-luna'`.
- `campaign_copy` **não** exige repetir geração paga só para validar o catálogo — sua
  configuração/comportamento não foram tocados.

## Fora da autorização atual

`campaign_correction_analysis` (permanece desabilitada/intocada), `campaign_spec`, visão/
assinatura/imagem, prompts, regras comerciais, gateway, retries/fallback, controle
financeiro, defaults, seleção vigente, remoção de modelos anteriores, produção/deploy/push,
flags e chamadas pagas automáticas.

## PARADA

**Interrompido antes de:** aplicar a migration, cadastrar/alterar pricing, selecionar
modelos, commitar e push. Nenhuma validação real de geração foi feita nem alegada;
`validated_at` permanece `NULL`.

---

## Ampliação dirigida (2026-10-18) — Luna em `brand_profile_vision` + diagnóstico do realinhamento

**Escopo:** nova tupla de catálogo para a análise visual (logo) + diagnóstico/apresentação
de falhas do realinhamento. **Sem** alterar prompts, regras de análise, extração de paleta,
guardrails, gateway, retries/fallback ou controle financeiro. **Nada aplicado/commitado.**

### Compatibilidade oficial (developers.openai.com — consulta direta, sem dados privados)

- GPT-6 Luna (`gpt-6-luna`) existe e o catálogo afirma: *"All latest OpenAI models support
  text and image input, text output, multilingual capabilities, and vision"* → **Luna é
  vision-capable**.
- **Chat Completions** é o caminho documentado para *analisar imagens* (adapter já usa).
- Luna suporta `reasoning_effort` `none|low|medium|high|xhigh|max` → `"none"` (adapter) é válido.
- Entrada de imagem: data URL base64 + `detail: low|high|original|auto` → o adapter envia
  `messages[].content[].image_url = { url, detail }`, compatível.
- Pricing oficial Luna: input `$0.1/M`, output `$0.5/M` → **reutilizado**, sem novo preço.

### Arquivos e mudanças

- `supabase/migrations/20261018000003_quick_gpt6_luna_brand_profile_vision.sql` — **autorada**
  (forward-only; confere divergência; `validated_at NULL`; não toca as demais capacidades).
  **SHA-256:** `6B46E47357FC4260BB0F264E48C1F969CE1693756DB1BBF035E381273D70762F`.
- `src/lib/brand-assets/brand-director.ts` — separa **`content_filter`** de `refused`;
  passa a reportar o **modelo efetivo** (`gatewayResult.model`) em metadados/logs
  sanitizados (antes `gpt-4o` fixo). Mantém `errorType`/`finishReason`/refusal/tamanho e
  nunca registra conteúdo/prompt/imagem.
- `src/lib/brand-assets/brand-director-error-message.ts` — **novo** módulo compartilhado
  (`publicBrandDirectorErrorMessage`), agora com caso `content_filter`.
- `src/app/api/store/[id]/logo/retry-brand-director/route.ts` — usa o módulo compartilhado.
- `src/app/api/store/[id]/brand-profile/realign/route.ts` — logo path devolve **mensagem
  específica por `errorType`** (via módulo) + confirmação do perfil anterior mantido;
  perfil anterior continua preservado server-side (não marca `outdated`).
- `src/components/flow/visual-signature-approval-modal.tsx` — `handleRetryBP` deixa de
  **ignorar** a resposta do realinhamento: mostra a mensagem segura/específica e **mantém**
  o modal na falha (só fecha no sucesso).

### Testes mínimos adicionados/ajustados (sem provider real)

- `src/lib/ai/__tests__/quick-gpt6-luna-brand-profile-vision.test.ts` (novo 3): migration
  registra `brand_profile_vision` sem tocar `brand_profile_text`/`campaign_copy`; resolução
  por capacidade → `gpt-6-luna`; defaults preservados.
- `src/lib/brand-assets/__tests__/brand-director.test.ts`: `content_filter` desmembrado +
  `content_filter` ≠ `refused`; metadados com **modelo efetivo**; imagem enviada como data URL.
- `realign-route.test.ts`: mensagem pública específica + perfil anterior preservado.
- `visual-signature-approval-modal.test.tsx`: falha no retry mantém o modal e mostra a
  mensagem segura.

### Gates

- Suítes focadas **66/66** + afetadas **102/102** (brand-director/realign/retry/catálogo/
  registry/selection-view/adapters/gateway/modal) verdes.
- `typecheck` **0** · `lint` **0** · `build` **0** (dev parado p/ não disputar `.next`; dev
  religado ao final).

### Ampliações apresentadas — NÃO implementadas (requerem aprovação)

1. **`requestId`/correlação** exige alteração aditiva do **envelope compartilhado**
   (`AiInvocationResult`/`AiCallEnvelope` + captura no adapter `chat-completions` + eventual
   persistência no sink) — sub-recorte a aprovar antes de implementar.
2. **Anotação de domínio na telemetria** (`withDomainOutcome`) nos eventos de
   `brand_profile_vision` para separar explicitamente "sucesso de transporte" de "falha
   funcional" no evento (mecanismo já existe; é aditivo).
3. **Outros caminhos do realinhamento** (`text_only` → `BrandTextOnlyInferenceService`;
   `visual_signature` → `BrandProfilerWithoutLogoService`) não classificam recusa/vazio hoje —
   fora do recorte logo/`brand_profile_vision`.

### PARADA (ampliação)

**Interrompido antes de:** aplicar a migration `20261018000003`, alterar pricing/seleções,
commitar e push. Migration NÃO aplicada; `validated_at NULL`; nenhuma geração paga.

---

## Complemento do recorte (2026-10-18) — caminho real do realinhamento + `withDomainOutcome`

Conforme revisão do responsável, o tratamento do erro no **percurso realmente usado pelo
botão “realinhar”** foi completado (o modal de assinatura sozinho não cobria o caminho):

1. **Mensagem preservada nos handlers reais** — `store-identity-form.tsx` (3 handlers de
   realinhamento) passa a usar `resolveRealignErrorMessage(e)`: preserva a **mensagem
   pública segura** da API e usa o genérico **só** quando ela não existe. Erros brutos de
   provedor/salvamento/rede **não** vazam. Novo tipo `RealignError` em `use-drift-detection.ts`
   carrega a mensagem pública; `realinhar()` lança `RealignError(data.message || genérico)`.
2. **Regressão no caminho efetivo** — `store-identity-form.drift-tabs.test.ts`: `realinhar()`
   com `success:false` propaga `RealignError` com a mensagem pública **e não zera o drift**
   (perfil anterior mantido); `resolveRealignErrorMessage` preserva a mensagem pública e cai
   no genérico para erros não-`RealignError`.
3. **`withDomainOutcome` em `brand_profile_vision`** — `brand-director.ts` envolve a
   telemetria (mecanismo existente) e anota o **mesmo** envelope com
   `metadata.domainStatus`/`metadata.domainErrorType` (`success` × `failed`). Chamada HTTP
   bem-sucedida com análise recusada/vazia **não** parece sucesso funcional.
4. **Recusa sem exigir troca de imagem** — a mensagem pública de `refused` passou a
   **“O provedor recusou a análise deste logotipo.”** e o realinhamento acrescenta
   **“A direção visual anterior foi mantida.”** (não assume defeito no logo).

**Gates (complemento):** focadas **95/95** + afetadas **106/106**; `typecheck` 0 · `lint` 0 ·
`build` 0 (dev parado p/ `.next`; dev religado). Migration `20261018000003` segue **NÃO
aplicada**; sem pricing/seleção; sem commit/push. **Request ID**, `text_only` e assinatura
visual permanecem adiados por decisão do responsável.

---

## Aplicação local (2026-10-18) — `20261018000003` na `vendeo-homolog` (ledger 128→129)

Autorizada pelo responsável. Revalidado imediatamente antes: workdir
`G:\Vendeo-Homolog`, `project_id=vendeo-homolog`, container `supabase_db_vendeo-homolog`
healthy, `.env.local`→homolog, **SHA-256 confere**
`6B46E47357FC4260BB0F264E48C1F969CE1693756DB1BBF035E381273D70762F`, ledger **128**
(`…0002` já aplicada), **exatamente 1 pendente** (`…0003`; `workdir_pending=0`). Aplicado
**só** via cópia + `supabase --workdir … migration up --local` (exit 0; NOTICE
`catalog_inserted: gpt-6-luna (brand_profile_vision)`).

**Depois (verificado):** ledger **129** (última `20261018000003`); catálogo
`brand_profile_vision` com **`openai/gpt-6-luna/chat-completions` active + `validated_at=NULL`**
(junto do `gpt-4o`); `brand_profile_text` e `campaign_copy` preservados; **seleções
inalteradas** (`brand_profile_text`→Luna, `campaign_copy`→Luna; nenhuma de
`brand_profile_vision`); pricing **17 linhas (não tocado)**; flags `product_1_1_*` `false`.
Next dev servindo o código atualizado em `http://localhost:3000`. Validação manual de
seleção/realinhamento pendente; sem chamada paga automática, sem commit/push.

---

## Execução real do Luna (2026-10-18 18:28 UTC) — registrada

**Telemetria (`generation_events`):** `brand_profile_vision` · `openai` · **`gpt-6-luna`** ·
`status=success` · tokens **2429 in / 453 out (2882)** · `estimated_cost_usd=0.000469` ·
`cost_source=pricing_table` · metadata `{capability:"brand_profile_vision", protocol:"chat-completions", domainStatus:"success"}`.
→ **modelo efetivo = `gpt-6-luna`** e **resultado funcional = sucesso** confirmados.

**Histórico preservado (não alterado):** tentativas `gpt-4o` de 17:49 (2206 in / 10 out) com
`metadata.domainStatus` ausente e perfis `failed` (`errorType=refused`) — mantidos como
histórico; a causa específica **não** é afirmada.

**Perfil gerado (preservado):** `store_brand_profiles.id = 753b7d9c-88cf-4915-9711-5860e65cdfd8`,
loja `48b212f8-2b0f-4679-b553-122a601bacac` ("Padaria da Esquina"), `status=synced`,
`source=logo_analysis`, `safe_color_tokens={primary:#D59D5E, secondary:#5B463A, accent:#E0B786, background:#FDF8EC}`,
`visual_tone="Acolhedor, familiar e convidativo…"`, `confidence_score=0.94`.
Perfis `failed` históricos `06f59186…`/`34187593…` **preservados** (não removidos).

## Ajuste do carregamento (concluído)

`store-identity-form.tsx`: o load do perfil passa a buscar o **vigente** via
`GET /api/store/:id/brand-profile?status=synced`; a tentativa `failed` histórica **não** é
tratada como atual nem sobrepõe cores/direção. Quando **não há** vigente, o form apenas
**diagnostica** o `failed` mais recente (aviso), sem aplicá-lo. Mesma correção no
`handleRetryBrandDirector`. Regressões em `store-identity-form.orientation.test.tsx`
(vigente separado; failed só diagnosticado).

## Deixado para UMA validação manual (sem reenviar o logo)

Alterar o **tom de voz** da loja com logo → acionar **realinhamento** (usa o logo já
armazenado). **Nenhuma geração automática** é disparada por este trabalho; a validação é
manual e única. Gates do ajuste: focadas **60/60** + afetadas verdes; `typecheck` 0 ·
`lint` 0 · `build` 0; Next religado com o código atualizado.

---

## ENCERRAMENTO — aprovação do responsável (2026-10-18) — CONCLUÍDA

**Aprovação registrada:** o responsável declarou **aceite** da validação manual do Luna no
realinhamento com logo. Vínculo com os artefatos finais observados na `vendeo-homolog`:

- **Evento final (telemetria):** `generation_events` 2026-10-18 **18:46:29** —
  `brand_profile_vision` · `openai` · **`gpt-6-luna`** · `success` · **2427 in / 469 out
  (2896)** · `estimated_cost_usd=0.000477` · `metadata.domainStatus="success"`.
- **Perfil final (gerado, preservado):** `store_brand_profiles.id =
  32c1116a-1bcb-4023-bf74-beb0221fbd9a` (loja `48b212f8…` "Padaria da Esquina"),
  `status=synced`, `source=logo_analysis`, `visual_tone` refletindo o novo tom
  ("Acolhedor, tradicional e popular…"), `safe_color_tokens.primary=#D59D5E`.
  O perfil vigente anterior (`753b7d9c…`) virou `outdated` (comportamento correto de
  realinhamento); perfis `failed` históricos (`06f59186…`/`34187593…`) **preservados**.
- **Fluxo validado manualmente:** tom de voz alterado → **realinhamento sem reenviar o
  logo**. Nenhuma geração automática foi disparada pelo executor.

**Fora do recorte — NÃO implementados (registrados como adiados):**
1. **`requestId`/correlação** no envelope compartilhado — **adiado**, não implementado.
2. **Caminhos `text_only` e `visual_signature`** do realinhamento (classificação de
   recusa/vazio) — **adiados**, não implementados.
3. Produção/deploy/push — **separados**; encerramento **local apenas**.

**Tracking:** linha da quick adicionada em `.planning/STATE.md` (Quick Tasks Completed).
**Contadores da B2.3/fases NÃO alterados** (nenhum front-matter incrementado/recalculado).

**Gates (código final — sem reexecução de testes/pagas nesta etapa):** `typecheck` **0** ·
`lint` **0** · `build` **0**; focadas **95/95** + afetadas **106/106** + carregamento
**60/60** (executadas sobre o código atual, sem alterações posteriores de código).
**Commit:** apenas arquivos desta quick (código, migration, testes, PLAN/SUMMARY e a linha
de tracking); `.dev.log`, `.env*` e credenciais **fora**. **Sem push.**
