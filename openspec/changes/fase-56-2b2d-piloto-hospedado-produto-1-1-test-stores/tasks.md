# Tasks — Piloto hospedado do Produto 1:1 em lojas de teste

> Checklist para implementação **futura**. Nenhuma destas tarefas é executada nesta rodada.

## 1. Checkpoints e decisões humanas

- [ ] 1.1 Registrar **Checkpoint 0**: aprovação de proposal/design/specs/tasks antes do planejamento GSD
- [ ] 1.2 Decidir o timeout interno e a margem (proposta: ≤ 240–270s para teto de 300s)
- [ ] 1.3 Decidir modelo/qualidade, pricing (principal **e** fallback) e teto de gasto do piloto
- [ ] 1.4 Decidir o tratamento das 2 migrations de laboratório (recomendado: aplicar no lote)
- [ ] 1.5 Confirmar o backup atualizado de **banco + Storage** e a restauração comprovada em **destino local separado** (sem sobrescrever a homologação permanente)
- [ ] 1.6 Registrar escopo de D13 e do sign-off de segurança para o **hospedado**

## 2. Autorização `test_stores` no ambiente operacional

- [ ] 2.1 Migration aditiva: RPC passa a conceder `test_stores`+`test_stores`, mantendo `all_stores` e escopo geral recusados
- [ ] 2.2 Testes de contrato da RPC: `granted`/`refused`, idempotência, auditoria, append-only e barreira global
- [ ] 2.3 Rota admin aceita o envelope `test_stores`+`test_stores` e mantém 403 para escopo geral
- [ ] 2.4 Testes da rota admin (envelope válido, escopo geral recusado, leitura/erro fail-closed)
- [ ] 2.5 Gate de gasto resolve `armed` para `test_stores` (loja de teste + flags válidas) e `blocked` para `all_stores`/não-estreito
- [ ] 2.6 Testes do gate: armado, inativo, bloqueado e falha de leitura
- [ ] 2.7 Preservar e reexecutar os testes de `isolated_pilot` (sem alteração de comportamento)
- [ ] 2.8 Negativos: loja não-test, flag off, instância divergente, `all_stores`, combinação incompatível

## 3. Orçamento de tempo e resultado desconhecido

- [ ] 3.1 Definir deadline global comprovado e timeout interno estritamente menor que 300s, com margem cooperativa
- [ ] 3.2 Comprovar o deadline por teste; **não** prometer escrita após kill abrupto
- [ ] 3.3 Teste: geração lenta + kill abrupto → estado durável anterior recuperável, sem inventar `unknown`/ausência
- [ ] 3.4 Teste: kill **não** autoriza nenhuma via; via automática exige probe fresco + fence; via administrativa exige autorização/auditoria
- [ ] 3.5 Verificar persistência cooperativa e confirmação de publicação dentro do deadline (sem garantia pós-kill)

## 4. Publicação com fluxo OFF

- [ ] 4.1 Produzir backup de **banco + objetos de Storage** (plano Free sem backup restaurável gerenciado; não assumir WAL-G) e comprovar restauração em **destino local separado**, sem sobrescrever a homologação permanente
- [ ] 4.2 Registrar que PITR está desabilitado e que não há dependência de recuperação point-in-time
- [ ] 4.3 Fixar o **conjunto definitivo** de migrations **após a implementação**, incluindo as novas migrations aprovadas (estado inicial: 30), com ordem e SHA-256
- [ ] 4.4 Pré-voo: `migration list --linked` confirmando 99 aplicadas / 30 pendentes (estado inicial)
- [ ] 4.5 Aplicar o conjunto definitivo via `supabase db push` na ordem de arquivo; confirmar o ledger completo (não presumir 129)
- [ ] 4.6 Deploy `main`; confirmar via API commit/branch/plano/Fluid/timeout; **fluxo permanece OFF**
- [ ] 4.7 Configurar catálogo, pricing (principal+fallback) e `image_model_pair_config`; preflight `complete`
- [ ] 4.8 Verificar não regressão do legado com **novo fluxo OFF**, **autorização desabilitada**, `all_stores=false` e **pausa global preservada** (legado operacional)

## 5. Provas hospedadas de recuperação e segurança (mínimas)

- [ ] 5.1 Reutilizar as provas locais como evidência de contrato (sem repetir o que já está coberto)
- [ ] 5.2 Kill hospedado com **provider simulado interno/Preview** (sem rota pública) e verificação de claim residual
- [ ] 5.3 Ausência+PF→`refunded` com probe fresco (kill ≠ ausência) no banco hospedado
- [ ] 5.4 Arte íntegra→`delivered` no banco hospedado
- [ ] 5.5 Inconclusivo→resolução **administrativa autorizada/auditada** no banco hospedado (precondições próprias, sem exigir frescor universal)
- [ ] 5.6 Fence sob timeout/rede (`begin_publication`/`abort`/`mark_result_unknown`)
- [ ] 5.7 Replay idempotente de `deliver` após redeploy
- [ ] 5.8 RLS/grants efetivos no hospedado (RPC-only, `service_role` só `SELECT`)
- [ ] 5.9 Ausência de vazamento de segredos nos logs hospedados
- [ ] 5.10 Login real com CAPTCHA/Google no hospedado
- [ ] 5.11 Garantir que nenhuma rota pública expõe provider simulado e que o cliente não escolhe provider

## 6. Piloto manual restrito (lojas de teste)

- [ ] 6.0 Concluir as **provas hospedadas simuladas** e obter o **aceite para iniciar** — ambos **antes** da primeira chamada paga
- [ ] 6.1 Conceder autorização `test_stores`, configurar teto e registrar `operation_id`
- [ ] 6.2 Ligar `product_1_1_test_stores_enabled` apenas na janela; `all_stores` sempre `false`; **não** alterar a pausa global (o legado segue operando)
- [ ] 6.3 Executar piloto manual nas lojas de teste, com inspeção humana do resultado
- [ ] 6.4 Monitorar: concorrência, retry/fallback, sucesso/falha/`unknown`, gasto e claims
- [ ] 6.5 Aplicar critérios de parada: erro/timeout, limite de chamadas/teto, corrida perdida, estado inesperado, flag off
- [ ] 6.6 Desligar normalmente: **flag do novo fluxo OFF + revogação da autorização**; **não** pausar a geração global (pausa só em emergência autorizada); registrar que operações em andamento **não** são canceladas
- [ ] 6.7 Confirmar que nenhuma loja não-test foi habilitada

## 7. Separação e encerramento

- [ ] 7.1 Registrar que o piloto hospedado é **etapa** da liberação, não a promoção geral
- [ ] 7.2 Confirmar `all_stores` bloqueado e abertura geral como mudança futura separada
- [ ] 7.3 `openspec validate --strict` e reconciliação documental
- [ ] 7.4 Reconciliar tracking sem recalcular contadores encerrados e sem iniciar F56.3
