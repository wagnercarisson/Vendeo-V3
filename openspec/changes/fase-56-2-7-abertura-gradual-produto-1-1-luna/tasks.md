# Tasks — Abertura gradual do Produto 1:1 com Luna

> **Estado desta change:** implementação publicada e checkpoints 1–3 executados. As migrations `20261019000002..04` foram aplicadas, Luna foi validado nas três capacidades, 5.3/5.7 foram comprovados e `all_stores` está ativo. A entrega está concluída; o **monitoramento de 7 dias (5.5) foi transferido e permanece aberto**, e a consolidação documental foi executada. Sync/archive são os próximos passos do lifecycle (6.3–6.4), não defeitos da implementação.

## 1. Implementação mínima

- [x] 1.1 Criar migration aditiva sucessora de `20261019000001_f56_2b2d_operational_test_stores_authorization.sql` recriando `admin_grant_product_flow_stage_authorization` com a mesma assinatura de 6 parâmetros e uma terceira via `all_stores` + `all_stores`; preservar guardas, `SECURITY DEFINER`, `search_path=''`, append-only, `ON CONFLICT`, idempotência/conflito, `expires_at=NULL`, grants `service_role` e bloco `REVERT`.
- [x] 1.2 Atualizar `src/app/api/admin/product-flow-authorizations/route.ts` para aceitar o envelope consistente `all_stores` + `all_stores` (200), manter 403 para combinações inválidas, 502 para respostas ausentes/contraditórias e nunca ecoar mensagem bruta do banco.
- [x] 1.3 Atualizar `src/lib/product-1-1/pilot/resolve-pilot-spend-gate.ts` para armar o gate em qualquer decisão permitida (`isolated_pilot`, `test_stores`, `all_stores`), mantendo `blocked` em incerteza e usando o mesmo `ProductOneToOnePilotSpendControl` (teto, estimativa > 0, `unknown` bloqueia novas chamadas).
- [x] 1.4 Criar a migration da ação coordenadora: tabela `product_1_1_activation_actions` (RPC-only, RLS-on, `operation_id` PK, ator, modo, motivo, instância, resultado, timestamp) e RPC `admin_set_product_1_1_activation` com trava `pg_advisory_xact_lock`, transação única, idempotência por `operationId`, conflito para conteúdo divergente e verificação final de chaves + decisão antes de reportar o modo.
- [x] 1.5 Criar a rota `POST /api/admin/product-1-1-activation` com corpo estrito `{ mode: "off" | "test_stores" | "all_stores", reason, operationId, confirm?: "ALL_STORES" }` (campo declarado no `.strict()`, exigido para `all_stores`), `requireAdmin` + `requireSameOrigin`, chamando **somente** a RPC coordenadora, relendo o estado atual após a RPC (inclusive em replay) e mapeando erros sem ecoar mensagem bruta do banco.
- [x] 1.6 Adicionar o painel “Produto 1:1 — ativação” à página existente `src/app/(app)/admin/feature-flags/page.tsx`: estado atual, três ações, confirmação para `all_stores`, motivo obrigatório e feedback de erro/estado verificado; remover o toggle direto das duas chaves do Produto 1:1 da UI genérica.
- [x] 1.7 Ajustar `src/lib/brand-assets/text-only-inference-service.ts` para reportar o modelo efetivo do envelope nos metadados de erro (hoje fixo em `gpt-4o`), sem alterar prompt, fluxo ou fallback.
- [x] 1.8 Atualizar o runbook operacional (publicação, janela, ativação, desligamento, rollback condicional de seleção) e a documentação de ativação, incluindo a proibição de `VENDEO_GENERATION_PAUSED` como controle do novo fluxo e a distinção entre checkpoint humano e comando administrativo.

## 2. Testes e gates

- [x] 2.1 Estender os testes de contrato da autorização (`src/lib/product-1-1/__tests__/narrow-authorization.contract.test.ts` e `tests/database/product-flow-stage-authorizations.contract.test.ts`) para `all_stores` pela via válida, recusa de combinações inválidas, idempotência, conflito, revogação e preservação de `isolated_pilot`/`test_stores`; não testar bloqueio por aprovação documental.
- [x] 2.2 Adicionar casos de rota para `all_stores` (200, 403, 409, 502) e garantir que a rota não aceita estágio/escopo divergentes.
- [x] 2.3 Atualizar `src/lib/product-1-1/__tests__/resolve-pilot-spend-gate.test.ts` e `operational-pilot-spend-gate.contract.test.ts` para `all_stores` armado, loja de teste na abertura geral, incerteza bloqueada e teto/`unknown` preservados.
- [x] 2.4 Criar testes comportamentais da RPC/rota de ativação cobrindo: OFF → teste, OFF → todas, teste → todas, todas → teste (chave geral realmente desligada), qualquer → OFF com verificação, mesmo estado (`already_in_mode`), replay do mesmo `operationId`, conflito de `operationId` divergente, ações concorrentes serializadas, falha em qualquer passo revertendo tudo e ausência de mutação quando a verificação final falha.
- [x] 2.5 Adicionar testes do painel admin para as três ações, `confirm: "ALL_STORES"`, motivo obrigatório, replay idempotente após outra ação exibindo o `currentMode` atual (não o modo antigo) e exibição de erro/estado verificado sem prometer compensação.
- [x] 2.6 Adicionar testes de resolução de Luna para as três capacidades: catálogo/protocolo, pricing, seleção; `campaign_copy` com fallback completo; `brand_profile_text`/`vision` com fallback vazio; fallback preenchido descarta a seleção e não deve ser aceito como validação.
- [x] 2.7 Executar `npm run typecheck`, `npm run lint`, `npm run build`, as suítes afetadas e `openspec validate fase-56-2-7-abertura-gradual-produto-1-1-luna --strict`; registrar saídas e `git diff --check`.
- [x] 2.8 Executar revisão consolidada de código e segurança; nenhum achado high/critical aberto antes do Checkpoint 1.
- [x] 2.9 Aplicar as quatro migrations da 56.2.7 **somente na instância local isolada existente** (`vendeo-f562a-isolated`, API 56321/DB 56322; sem reset/recriação/remoto) e executar provas reais em Postgres de transição, falha intermediária com rollback total, replay, conflito, concorrência e expiração; restaurar OFF ao final.

## 3. Checkpoint 1 — Publicação

- [x] 3.1 Registrar o aceite humano do Checkpoint 1: implementação revisada, conjunto de migrations, ordem migration → código e publicação com as duas chaves OFF.
- [x] 3.2 Após o aceite, aplicar a migration no destino e publicar o código com `product_1_1_test_stores_enabled=false` e `product_1_1_all_stores_enabled=false`; registrar deployment/SHA e hashes das migrations.
- [x] 3.3 Verificar por leitura o estado OFF, a ausência de autorização habilitadora, a ausência de lojas gerais e a operação do legado; registrar evidência sanitizada.

## 4. Checkpoint 2 — Configuração de Luna e janela paga

- [x] 4.1 Registrar o aceite humano do Checkpoint 2: orçamento/teto, limites de chamadas, pricing e seleções de Luna, lojas de teste, duração, critérios de parada e disposição sobre D13/kill real aplicável à janela. Nenhuma chamada paga antes deste aceite.
- [x] 4.2 Abrir a janela antes de qualquer chamada paga: registrar `spent_usd`/`cap_usd`/`blocked_reason`, configurar o teto aprovado via `product_1_1_pilot_set_cap` sem zerar histórico, ativar `test_stores` pelo painel e confirmar elegibilidade da loja de teste/negação da loja geral.
- [x] 4.3 Configurar `openai/gpt-6-luna` no pricing vigente e nas seleções de `campaign_copy`, `brand_profile_text` e `brand_profile_vision` pelas superfícies administrativas; registrar valores, fontes, seleção anterior e confirmar fallback vazio em `brand_profile_text`/`vision`.
- [x] 4.4 Validar por leitura, sem geração: catálogo ativo, protocolo, pricing completo, seleção resolvida e preflight de imagem `complete`; confirmar que o par de imagem permanece o já configurado.
- [x] 4.5 Executar a janela controlada em loja de teste: uma campanha completa do Produto 1:1 com imagem e copy, e validação de `campaign_copy`, `brand_profile_text` e `brand_profile_vision` com modelo efetivo Luna; registrar telemetria, custo estimado, `unknown`/retry/fallback e inspeção humana.
- [x] 4.6 Executar a prova 5.3 em operação de teste identificada: `absent` fresca + `failed` persistido + PF → `refunded` uma única vez; repetir e comprovar `idempotent` sem segundo estorno, sem provider e sem campanha de cliente.
- [x] 4.7 Executar a prova 5.7 após o redeploy usando uma operação de teste **já `delivered` antes do redeploy** (recomendado: N=1 `22eeed06…` / `6f7a65e4…`): replay de `deliver` com o mesmo `publication_token`; comprovar `delivered`/idempotente, mesmo caminho/tamanho/hash de arte e zero nova geração, upload, provider ou transação. Uma operação em `art_uploaded` NÃO serve como PASS.
- [x] 4.8 Encerrar a janela no estado OFF (chaves OFF + revogação), sem pausar o legado e sem cancelar operações em andamento; registrar evidências sanitizadas em arquivo de fase e confirmar que 5.3/5.7 foram comprovados, não apenas cobertos por contrato. Se Luna foi aprovado, **manter** as seleções; se reprovado/problema/decisão explícita, restaurar as seleções anteriores.

## 5. Aceite humano e Checkpoint 3 — Abertura geral

- [x] 5.1 Registrar o aceite humano do resultado da janela: Luna nas três capacidades, campanha completa, provas 5.3/5.7 e limitações observadas.
- [x] 5.2 Registrar a disposição explícita sobre D13/kill real para a abertura geral: aceitar a limitação residual com controles compensatórios ou bloquear. Não declarar D13 resolvido.
- [x] 5.3 Registrar o aceite humano do Checkpoint 3: abertura geral aprovada, orçamento/teto e monitoramento definidos, lojas gerais autorizadas e rollback condicional de seleção definido. O registro é a autorização operacional; a RPC não valida documentos.
- [x] 5.4 Ativar `all_stores` pela ação normal do admin (sem deploy): a RPC transacional deve confirmar as duas autorizações, `all_stores=true`, `test_stores=false`, decisão permitida para loja geral e loja de teste, e verificação final consistente; testar também que uma falha reverte tudo.
- [ ] 5.5 Monitorar o período inicial: gasto estimado versus teto, sucesso/falha/`unknown`, retry/fallback, claims, distribuição por loja e erros; aplicar critérios de parada. **Transferido em 2026-10-19; em andamento até 2026-10-26 23:59 BRT; não executado e não dispensado.** Evidência: `56.2.7-MONITORING-TRANSFER.md`.
- [x] 5.6 Validar o desligamento normal (chaves OFF + revogação) nos testes e na janela, sem pausar o legado nem cancelar operações em andamento. Após a abertura geral, **não desligar automaticamente para encerrar a fase**: só desligar por critério de parada ou decisão explícita; caso contrário, encerrar com `all_stores` ativo e monitorado.

## 6. Consolidação documental final

- [x] 6.1 Consolidar runbook, evidências de configuração, janela, 5.3/5.7, ativação e monitoramento; sanitizar segredos e dados de clientes. Evidência: `56.2.7-OPENSPEC-VERIFICATION.md`, `56.2.7-MONITORING-TRANSFER.md`.
- [x] 6.2 Atualizar os trackings do projeto (`STATE.md`, `ROADMAP.md`, `HANDOFF.json`) sem reabrir nem reescrever as evidências da fase 56.2.6. Valores operacionais registrados como **snapshot datado**, não estado permanentemente atual.
- [ ] 6.3 Reconciliar a nota “Pilot Scope and Deferred Items” das specs principais com o novo estado, sem converter o adiamento original de 5.3/5.7 em PASS e sem apagar o ponteiro `DEFERRED.md`. **Preparado em `56.2.7-SYNC-PREPARATION.md`; aplicar no sync.**
- [ ] 6.4 Executar `openspec verify`, `openspec sync` e `openspec archive` na ordem do workflow, após a revisão final e com todas as evidências disponíveis. **Próximos passos do lifecycle; não são defeitos da implementação. O archive pode ocorrer com 5.5 transferida e aberta; o monitoramento continua após o archive.**
