# Design — Abertura gradual do Produto 1:1 com Luna

## Context

Estado verificado no encerramento 56.2.6 (N=1 arquivado em 2026-10-19):

- **Ativação:** `product_1_1_test_stores_enabled` e `product_1_1_all_stores_enabled` existem em `feature_flags` e são alteráveis pela RPC genérica e auditada `admin_update_feature_flag` (`20260821000001_f43_create_feature_flags.sql`, `src/app/api/admin/feature-flags/route.ts`).
- **Bloqueio de `all_stores`:** a RPC `admin_grant_product_flow_stage_authorization` (`20261019000001_f56_2b2d_operational_test_stores_authorization.sql`) só concede `isolated_pilot` + `test_stores` e `test_stores` + `test_stores`; todo o resto habilitador, inclusive `all_stores`, cai em `refused` (`operational_activation_blocked_in_b1a`). A rota `src/app/api/admin/product-flow-authorizations/route.ts` só aceita os envelopes estreitos e responde 403 para o restante.
- **Decisão pura:** `decideProductFlowAuthorization` já representa `all_stores` + `all_stores` no ambiente operacional. O bloqueio está na escrita (RPC/rota) e no gate de gasto, não na matriz de decisão.
- **Gate de gasto:** `resolvePilotSpendGate` só arma para `isolated_pilot`/`test_stores`; `all_stores` retorna `blocked` (`non_narrow_enabling_stage`). O teto por chamada e a trava de `unknown` são os mesmos do piloto.
- **Escopo da loja:** `resolveEligibilityContext` deriva `requestedScope` de `stores.is_test_store` — loja de teste pergunta `test_stores`; loja geral pergunta `all_stores`. A decisão exige **igualdade exata** entre escopo autorizado e solicitado.
- **Luna:** as três tuplas de catálogo já existem em migrations (`20261018000001/2/3`) com protocolo `chat-completions`. `campaign_copy` aceita fallback; `brand_profile_text` e `brand_profile_vision` **não** aceitam fallback no `PersistedModelResolver` (qualquer fallback preenchido faz a seleção ser descartada e o default `gpt-4o` voltar silenciosamente). Em produção, a leitura do Plano 07 (2026-10-19) mostrou `ai_model_selection` vazia e `ai_model_pricing` com 8 linhas, **sem** `openai/gpt-6-luna`; portanto, habilitar Luna depende de **configuração**, não de código.
- **Seleções compartilhadas:** `campaign_copy` é usada pelo legado e pelo novo fluxo; `brand_profile_text`/`brand_profile_vision` são usadas pelo onboarding/realinhamento de qualquer loja. Não existe seleção por fluxo ou por loja.
- **Provas adiadas:** 5.3 (ausência + PF → estorno hospedado único) e 5.7 (replay de `deliver` após redeploy, sem regenerar arte) permanecem abertas; D13 foi aceito **somente** para o N=1 e o kill real está `INCONCLUSIVE`.

## Goals / Non-Goals

**Goals:**

1. Tornar os três estados (OFF, lojas de teste, todas as lojas) operáveis por uma única ação normal no admin, sem SQL manual e sem deploy.
2. Ampliar `all_stores` apenas o necessário em RPC, rota, gate de gasto e ação administrativa, preservando autenticação, ownership, RLS, auditoria e controle de gasto.
3. Concluir Luna nas três capacidades com configuração auditável e validação humana na janela, explicitando o impacto no legado.
4. Provar 5.3 e 5.7 no destino hospedado com operações de teste identificadas.
5. Deixar a abertura geral condicionada a aceite humano explícito, orçamento aprovado e disposição registrada sobre D13/kill real.
6. Manter o desligamento simples: chaves OFF + revogação, sem pausar o legado e sem cancelar operações em andamento.

**Non-Goals:**

- Assinatura visual, `campaign_spec`, `campaign_correction_analysis`, F56.3 ou mudanças no fluxo legado.
- Nova infraestrutura de ativação, authorization por loja, allowlist por loja ou expiração obrigatória.
- Prometer que o custo do provider é garantido pelo teto; o teto continua sendo controle de gasto **estimado**.
- Declarar D13 resolvido, kill real reproduzido ou 5.3/5.7 aprovados pelo caminho feliz.
- Executar implementação, migration, deploy, configuração, ativação ou chamada paga nesta etapa.

## Decisions

### D1 — Três estados canônicos e precedência

| Estado | `test_stores` | `all_stores` | Autorizações correntes exigidas | Efeito |
|---|---|---|---|---|
| OFF | `false` | `false` | nenhuma habilitadora | legado para novas gerações |
| Lojas de teste | `true` | `false` | `test_stores` + `test_stores` | novo fluxo só em `is_test_store=true` |
| Todas as lojas | `false` | `true` | `all_stores` + `all_stores` **e** `test_stores` + `test_stores` | novo fluxo em todas as lojas |

**Por que duas autorizações em “todas as lojas”:** a loja de teste pergunta `test_stores` (escopo derivado de `is_test_store`), e a decisão exige escopo exato. Sem a autorização `test_stores`, as lojas de teste ficariam de fora da abertura geral. A ação administrativa garante as duas; a decisão pura não é ampliada para aceitar `all_stores` cobrindo `test_stores` implicitamente.

**Precedência:** `all_stores=true` prevalece para lojas gerais; a chave de teste é mantida `false` no estado canônico de abertura geral para evitar ambiguidade. Se ambas estiverem ligadas por operação manual, a decisão já usa a precedência geral para a flag, mas o estado não é considerado canônico pela ação administrativa.

**Transições canônicas (executadas em UMA transação; ver D4):**

| De → Para | Chaves após a transição | Autorizações após a transição | Invariante de verificação |
|---|---|---|---|
| OFF → teste | teste `true`, geral `false` | `test_stores` vigente; `all_stores` revogada | loja de teste permitida; loja geral negada |
| OFF → todas | teste `false`, geral `true` | `test_stores` e `all_stores` vigentes | loja geral e loja de teste permitidas |
| teste → todas | teste `false`, geral `true` | `all_stores` concedida; `test_stores` mantida | loja geral e loja de teste permitidas |
| todas → teste | geral `false` **primeiro**, teste `true` | `test_stores` vigente; `all_stores` revogada | loja geral negada; loja de teste permitida |
| qualquer → OFF | teste `false` e geral `false` | ambas revogadas | decisão nega para os dois escopos |
| mesmo estado | inalteradas | inalteradas | `already_in_mode` somente após releitura |

**Falhas:** não há promessa de que “qualquer estado parcial é inerte”. A garantia passa a ser **atomicidade**: a ação inteira ocorre em uma única transação de banco; se qualquer passo falhar, nada é aplicado. Se a transação não puder ser confirmada, o estado é reportado como **não verificado** e nenhuma mudança é considerada concluída. OFF só é reportado após releitura comprovando as duas chaves `false` e a decisão negando os dois escopos. `all_stores` → `test_stores` **desliga a chave geral**, não apenas “confirma false”.

### D2 — Ampliação mínima de `all_stores` (RPC, rota e decisão)

1. **Migration aditiva** (sucessora de `20261019000001`) recria `admin_grant_product_flow_stage_authorization` com a mesma assinatura de 6 parâmetros e acrescenta uma terceira via estreita: `all_stores` + `all_stores`. Mantém guardas, `SECURITY DEFINER`, `search_path=''`, append-only, `ON CONFLICT (operation_id)`, idempotência/conflito, `expires_at=NULL`, grants `service_role` e bloco `REVERT`. `isolated_pilot` e `test_stores` permanecem inalterados.
2. **Rota admin** passa a aceitar o envelope consistente `all_stores` + `all_stores`; continua 403 para combinações inválidas e 502 para respostas ausentes/contraditórias. `requireAdmin` + `requireSameOrigin` + identidade canônica derivada no servidor permanecem.
3. **Decisão pura** (`authorization-decision.ts`) **não muda**: a matriz já contém `all_stores` × `all_stores` × `operational`/`isolated`.
4. **Alternativa rejeitada:** criar um novo subsistema/allowlist por loja. A via existente é suficiente e mantém a superfície de autorização.

### D3 — Gate de gasto alinhado, sem perder salvaguardas

`resolvePilotSpendGate` deixa de usar uma lista de estágios “estreitos” e passa a armar para **qualquer decisão permitida** (`isolated_pilot`, `test_stores`, `all_stores`), mantendo:

- `blocked` em `read_failure`/`flags_unavailable`/erro de contexto;
- `inactive` somente em decisão determinística que nega;
- o mesmo `ProductOneToOnePilotSpendControl` (teto global, estimativa > 0, por chamada, `unknown` bloqueia novas chamadas até reconciliação explícita);
- limites por operação existentes (imagem ≤3, copy ≤6).

A re-leitura de flags dentro do gate deixa de ser necessária para decidir o estágio, porque `resolveProductFlowAuthorization` já validou a flag aplicável. Isso evita divergência entre decisão e gate e cobre o caso de loja de teste na abertura geral.

### D4 — Ação normal no admin: uma RPC coordenadora, atômica e auditada

**Superfície:** painel “Produto 1:1 — ativação” na página existente `/admin/feature-flags` (Controles operacionais), com os três estados e o estado atual; endpoint `POST /api/admin/product-1-1-activation` protegido por `requireAdmin` + `requireSameOrigin`, corpo estrito `{ mode, reason, operationId, confirm?: "ALL_STORES" }` (campo declarado no `.strict()`, exigido para `all_stores`), que chama **uma única RPC**.

**Mutação:** nova RPC `admin_set_product_1_1_activation(p_actor_id, p_mode, p_instance_identity, p_reason, p_operation_id)`, `SECURITY DEFINER`, `search_path=''`, RPC-only (`service_role`). Ela delega as mutações às RPCs existentes (`admin_update_feature_flag`, `admin_grant_product_flow_stage_authorization`, `admin_revoke_product_flow_stage_authorization`) com `operation_id` de passo gerados no servidor e registrados no resultado. Não há compensação em TypeScript: **tudo acontece na mesma transação**.

**Idempotência e concorrência:** uma tabela pequena `product_1_1_activation_actions` (precedente `product_1_1_pilot_cap_audit`) registra `operation_id` (PK), ator, modo, motivo, instância, resultado e timestamp. A RPC adquire `pg_advisory_xact_lock(hashtext('product_1_1_activation'))` antes de ler/gravar. Replay do **mesmo** `operation_id` com o mesmo conteúdo retorna o resultado gravado (`idempotent:true`); conteúdo divergente retorna `operation_id_conflict`; duas ações concorrentes são serializadas pela trava. A tabela é RLS-on e sem acesso direto; leitura/escrita só pela RPC. **Replay preserva o resultado histórico, mas não é estado atual:** o endpoint, depois da RPC, faz uma leitura fresca das flags/autorizações e devolve `currentMode`; a UI mostra `currentMode`, nunca o `mode` antigo do replay. Se outra ação mudou o modo desde então, o replay não reaplica nada e a UI exibe o estado vigente.

**Transições (na mesma transação):**

- **OFF → teste:** garantir geral `false`, teste `true`; conceder `test_stores`; revogar `all_stores` se houver estágio vigente; verificar loja de teste permitida e loja geral negada.
- **OFF → todas:** garantir geral `true`, teste `false`; conceder `all_stores` e `test_stores`; verificar os dois escopos permitidos.
- **teste → todas:** garantir geral `true`, teste `false`; conceder `all_stores`; manter `test_stores`; verificar os dois escopos.
- **todas → teste:** **desligar a chave geral primeiro**, ligar a chave de teste, revogar `all_stores`, manter `test_stores`; verificar loja geral negada e loja de teste permitida.
- **qualquer → OFF:** desligar as duas chaves, revogar `all_stores` e `test_stores`; verificar as duas chaves `false` e decisão negando os dois escopos. OFF só é retornado como `verified` depois dessas leituras.
- **mesmo estado:** se a verificação já corresponde ao modo pedido, retornar `already_in_mode` sem novas mutações.

**Falha:** qualquer exceção em qualquer passo aborta a transação inteira; não existe estado parcial aplicado. Se a resposta não puder ser confirmada, o endpoint retorna erro sem declarar o modo. A verificação final roda **dentro** da RPC (flags + `derive` do histórico) e uma divergência levanta exceção, revertendo tudo.

**Expiração:** a leitura do estado e a verificação de `already_in_mode` tratam autorização expirada como estágio efetivo `off`. Uma autorização expirada não aparece como modo ativo nem impede a nova concessão; a decisão real já bloqueia a geração.

**Aprovação humana:** a RPC **não** consulta documentos, specs ou evidências. O checkpoint registrado é a autorização operacional; a confirmação administrativa autenticada/auditada é o comando de ativação. Nenhuma spec deve prometer bloqueio técnico por aprovação documental.

**UI:** não expõe toggle direto das duas chaves do Produto 1:1; o toggle genérico permanece para as demais flags. A rota genérica `PUT /api/admin/feature-flags` continua para compatibilidade/emergência, mas não é o caminho normal. A ação normal exige confirmação explícita para `all_stores` e mostra o estado verificado (ou erro) após a RPC.

**Alternativa rejeitada:** orquestrar várias RPCs no backend com compensação. A compensação também pode falhar e não garante atomicidade nem idempotência de ação; a RPC coordenadora é menor e mais segura.

### D5 — Luna: configuração versus código

| Capacidade | Catálogo/protocolo | Pricing | Seleção | Fallback |
|---|---|---|---|---|
| `campaign_copy` | tupla existente (`20261018000001`), `chat-completions` | **configurar** `openai/gpt-6-luna` (input/output/cached) via `admin_set_ai_model_price` | `ai_model_selection` para Luna | Suportado: manter fallback atual (Gemini) **completo** ou desabilitado; validar pricing do fallback |
| `brand_profile_text` | tupla existente (`20261018000002`), `chat-completions` | **configurar** o mesmo pricing por provider/modelo | `ai_model_selection` para Luna | **Não suportado** pelo resolver; fallback deve ficar vazio, senão a seleção é descartada e volta `gpt-4o` |
| `brand_profile_vision` | tupla existente (`20261018000003`), `chat-completions` | **configurar** o mesmo pricing por provider/modelo | `ai_model_selection` para Luna | **Não suportado**; fallback deve ficar vazio |

- **Código necessário:** nenhum para Luna além do eventual ajuste de observabilidade descrito abaixo. Catálogo, protocolo, adapter e seleção administrativa já existem.
- **Pricing é necessário** para o novo fluxo: o runner da copy rejeita pricing ausente/`code_default` (`defaultReadCopyPricing`) e o preflight de imagem exige cobertura `complete`. Para `brand_profile_*`, pricing ausente não bloqueia a chamada, mas prejudica custo/telemetria e deve ser corrigido.
- **Seleções são globais:** durante a janela, `campaign_copy` afeta também campanhas legadas; `brand_profile_*` afeta qualquer loja que acione identidade/realinhamento. O aceite da janela deve declarar esse impacto. Se Luna for **aprovado**, a seleção é **mantida** ao encerrar a janela e promovida para a abertura geral. A seleção anterior é restaurada via admin **somente** em reprovação, problema ou decisão explícita — nunca automaticamente ao fim de uma janela aprovada. Não é necessário deploy para esse rollback.
- **Observabilidade:** `BrandTextOnlyInferenceService` ainda reporta `gpt-4o` fixo em metadados de erro, mesmo quando a seleção efetiva é Luna. A telemetria de sucesso já persiste o modelo real do gateway; o ajuste do metadado de erro é **recomendado e não bloqueante** — se incluído, é uma mudança pequena e testável, sem alterar prompts/fluxo.
- **Fora:** par de imagem, geração de assinatura visual, `campaign_spec`, `campaign_correction_analysis`.

### D6 — Prova 5.3 no hospedado (estorno único)

Criar um **harness de prova hospedado** (`scripts/f56-2e/hosted-proofs.mjs` ou equivalente) com `--check` (dry-run/read-only) e `--execute`, credenciais por ambiente, allowlist explícita de lojas de teste e nenhuma impressão de segredo. A prova usa **RPCs existentes** e uma operação de teste identificada:

1. Registrar `campaign_id`/`operation_id` de prova, loja `is_test_store=true`, epoch e saldo antes.
2. Reservar crédito de teste (RPC existente) e garantir que **não há arte** no caminho (sonda `absent`).
3. Persistir falha final (`failed`) pela via existente e capturar epoch **antes** da sonda (frescor).
4. Chamar `close_failed_operation`/PF → `refunded` **uma única vez**; repetir → `idempotent:true`, sem segundo efeito.
5. Verificar: `absent` fresco; `refunded`; exatamente um estorno no ledger; nenhum `delivered`; nenhuma chamada a provider; nenhuma campanha de cliente tocada.

Critério objetivo: **PASS** somente com todos os itens acima; `invalid`/`indeterminate` permanecem inconclusivos e **não** autorizam estorno. A prova não amplia RPC nem fabrica evidência.

### D7 — Prova 5.7 no hospedado (replay após redeploy)

Usar uma operação de teste **já entregue** e identificada (recomendado: N=1 `22eeed06…` / `6f7a65e4…`) após o deploy desta change:

1. Registrar deployment/SHA e o caminho/hash/tamanho da arte antes.
2. Ler o `publication_token` persistido (somente leitura) e chamar `product_1_1_deliver_campaign_credit_operation` com a mesma identidade.
3. Verificar `idempotent:true`/`delivered`, **mesmo** caminho e hash da arte, nenhum novo upload, nenhuma chamada a provider, nenhum novo evento de geração e nenhuma nova transação de crédito.
4. Repetir a chamada para provar idempotência estável.
5. Registrar contagens antes/depois e deployment IDs.

A operação escolhida SHALL estar **já entregue antes do redeploy**. Uma operação em `art_uploaded` **não** substitui esse critério e **não** serve como PASS: ela testaria a primeira entrega, não o replay de uma entrega já concluída. O critério de PASS é a ausência de regeneração/novo efeito sobre uma operação `delivered`, não apenas o retorno 200.

### D8 — Disposição D13/kill real e checkpoints

- **D13 não é resolvido por 5.3/5.7 nem pelo caminho feliz.** Antes da abertura geral, o responsável deve registrar uma das disposições: (a) **aceitar a limitação residual** com controles compensatórios (deadline cooperativo 240s, fence, `unknown` bloqueia novas chamadas, reconciliação administrativa auditada, monitoramento e desligamento rápido) ou (b) **bloquear** a abertura até resolução. A disposição escolhida é registrada e não pode ser inferida.
- O kill real permanece **INCONCLUSIVE**; nenhuma prova desta change o declara reproduzido.
- **Checkpoint 1 — Publicação:** aprova implementação/revisão, conjunto de migrations e deploy com fluxo OFF.
- **Checkpoint 2 — Janela paga:** aprova orçamento/teto, pricing e seleções de Luna, lojas de teste, duração, critérios de parada e a disposição D13 aplicável à janela. Nenhuma chamada paga antes deste aceite.
- **Checkpoint 3 — Abertura geral:** após 5.3 + 5.7 + validação de Luna + campanha completa + aceite humano, aprova `all_stores`, orçamento/monitoramento e a disposição D13 para a abertura geral.

## Risks / Trade-offs

- **[Seleções globais afetam o legado]** → janela com aceite explícito, telemetria por modelo e restauração da seleção somente em reprovação/problema/decisão explícita; se aprovado, Luna é mantido. Não prometer isolamento por loja.
- **[`all_stores` sem autorização `test_stores` exclui lojas de teste]** → a ação administrativa concede as duas autorizações no modo geral; teste negativo cobre loja de teste.
- **[Estado parcial entre RPCs]** → eliminado por uma única RPC transacional com trava, registro de ação e verificação final; falha reverte tudo e não reporta modo.
- **[Pricing de Luna ausente bloqueia a copy do novo fluxo]** → checklist de configuração antes da janela; falha explícita, sem inventar preço.
- **[Fallback indevido em `brand_profile_*` descarta Luna]** → validar seleção com fallback vazio e teste de resolução.
- **[D13/kill residual]** → disposição humana explícita; sem promessa de resolução; controles compensatórios e desligamento preservados.
- **[Prova 5.3 cria crédito/estorno de teste]** → loja de teste e operação identificadas, harness com allowlist/dry-run, evidência sanitizada; nenhuma campanha de cliente.
- **[Prova 5.7 em operação entregue]** → replay idempotente por token; verificar hash/contagens para provar ausência de regeneração.
- **[Pausa global usada por engano]** → desligamento documentado como chaves OFF + revogação; `VENDEO_GENERATION_PAUSED` proibido como controle do novo fluxo.

## Migration Plan

1. **Implementação e revisão consolidadas** (código + migration + testes + gates). As migrations são aplicadas **somente na instância local isolada existente** (`vendeo-homolog`, sem recriar/resetar) para provas reais de transição, falha, replay e concorrência; produção permanece intocada até o Checkpoint 1.
2. **Checkpoint 1:** aprovar publicação. Aplicar a migration (RPC) no destino, depois publicar o código com as duas chaves OFF. Verificar legado e estado OFF.
3. **Configuração de Luna e orçamento** sob **Checkpoint 2:** pricing, seleções, cap/janela; validar resolução/preflight por leitura, sem geração.
4. **Janela em lojas de teste:** validar Luna nas três capacidades, campanha completa e provas 5.3/5.7; registrar evidências sanitizadas.
5. **Aceite humano** do resultado da janela.
6. **Checkpoint 3:** aprovar abertura geral e disposição D13; ativar `all_stores` pela ação normal do admin, sem novo deploy.
7. **Monitoramento inicial e desligamento** por chaves OFF + revogação; operações em andamento seguem suas vias.
8. **Consolidação documental final** (STATE/ROADMAP/HANDOFF/evidências), sem reabrir a fase 56.2.6.

**Rollback:** desligar o novo fluxo pelas chaves + revogar autorizações (sem pausar o legado). A seleção de Luna é **mantida** se aprovada; a seleção anterior só é restaurada em reprovação, problema ou decisão explícita. Rollback de deploy não reverte banco/ledger/migrations. As migrations são forward-only com `REVERT` manual.

## Open Questions

1. **Orçamento/teto da janela** e **teto da abertura geral** — valores e limites de chamadas a aprovar no Checkpoint 2/3.
2. **Pricing de Luna** — confirmar/registrar os valores vigentes (input/output/cached) e a fonte antes da seleção.
3. **Seleção anterior exata** de cada capacidade para rollback (default `gpt-4o` ou seleção persistida).
4. **Operação/loja de teste** para 5.3 e confirmação de que o N=1 `22eeed06…`/`6f7a65e4…` é a operação de 5.7.
5. **Disposição D13** para a janela e para a abertura geral (aceitar limitação ou bloquear).
6. **Janela** (duração, responsável pelo desligamento) e se o harness 5.3 será script dedicado ou extensão do runner existente.
