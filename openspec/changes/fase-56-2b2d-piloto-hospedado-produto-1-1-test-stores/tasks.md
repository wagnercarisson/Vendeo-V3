# Tasks — Piloto hospedado do Produto 1:1 em lojas de teste

> Checklist **reconciliado em 2026-10-19** com a execução da fase. As caixas abertas são **limitações explícitas**, não provas concluídas. **5.3/5.7 foram adiados por decisão do responsável** (não executados; ver `DEFERRED.md`).

## 1. Checkpoints e decisões humanas

- [x] 1.1 Registrar **Checkpoint 0**: aprovação de proposal/design/specs/tasks antes do planejamento GSD
- [x] 1.2 Decidir o timeout interno e a margem (proposta: ≤ 240–270s para teto de 300s)
- [x] 1.3 Decidir modelo/qualidade, pricing (principal **e** fallback) e teto de gasto do piloto
- [x] 1.4 Decidir o tratamento das 2 migrations de laboratório (recomendado: aplicar no lote)
- [x] 1.5 Confirmar o backup atualizado de **banco + Storage** e a restauração comprovada em **destino local separado** (sem sobrescrever a homologação permanente)
- [x] 1.6 Registrar escopo de D13 e do sign-off de segurança para o **hospedado**

## 2. Autorização `test_stores` no ambiente operacional

- [x] 2.1 Migration aditiva: RPC passa a conceder `test_stores`+`test_stores`, mantendo `all_stores` e escopo geral recusados
- [x] 2.2 Testes de contrato da RPC: `granted`/`refused`, idempotência, auditoria, append-only e barreira global
- [x] 2.3 Rota admin aceita o envelope `test_stores`+`test_stores` e mantém 403 para escopo geral
- [x] 2.4 Testes da rota admin (envelope válido, escopo geral recusado, leitura/erro fail-closed)
- [x] 2.5 Gate de gasto resolve `armed` para `test_stores` (loja de teste + flags válidas) e `blocked` para `all_stores`/não-estreito
- [x] 2.6 Testes do gate: armado, inativo, bloqueado e falha de leitura
- [x] 2.7 Preservar e reexecutar os testes de `isolated_pilot` (sem alteração de comportamento)
- [x] 2.8 Negativos: loja não-test, flag off, instância divergente, `all_stores`, combinação incompatível

## 3. Orçamento de tempo e resultado desconhecido

- [x] 3.1 Definir deadline global comprovado e timeout interno estritamente menor que 300s, com margem cooperativa
- [x] 3.2 Comprovar o deadline por teste; **não** prometer escrita após kill abrupto
- [x] 3.3 Teste: geração lenta + kill abrupto → estado durável anterior recuperável, sem inventar `unknown`/ausência
- [x] 3.4 Teste: kill **não** autoriza nenhuma via; via automática exige probe fresco + fence; via administrativa exige autorização/auditoria
- [x] 3.5 Verificar persistência cooperativa e confirmação de publicação dentro do deadline (sem garantia pós-kill)

## 4. Publicação com fluxo OFF

- [x] 4.1 Produzir backup de **banco + objetos de Storage** (plano Free sem backup restaurável gerenciado; não assumir WAL-G) e comprovar restauração em **destino local separado**, sem sobrescrever a homologação permanente
- [x] 4.2 Registrar que PITR está desabilitado e que não há dependência de recuperação point-in-time
- [x] 4.3 Fixar o **conjunto definitivo** de migrations **após a implementação**, incluindo as novas migrations aprovadas (estado inicial: 30), com ordem e SHA-256
- [x] 4.4 Pré-voo: `migration list --linked` confirmando 99 aplicadas / 30 pendentes (estado inicial)
- [x] 4.5 Aplicar o conjunto definitivo via `supabase db push` na ordem de arquivo; confirmar o ledger completo (não presumir 129)
- [x] 4.6 Deploy `main`; confirmar via API commit/branch/plano/Fluid/timeout; **fluxo permanece OFF**
- [x] 4.7 Configurar catálogo, pricing (principal+fallback) e `image_model_pair_config`; preflight `complete`
- [x] 4.8 Verificar não regressão do legado com **novo fluxo OFF**, **autorização desabilitada**, `all_stores=false` e **pausa global preservada** (legado operacional)
- [x] 4.9 Verificar no destino (produção) **schema, RLS/grants e configuração** por leitura server-side, **sem exportar dados**

## 5. Provas de recuperação e segurança (mínimas, Alt C)

> **Destino: Alt C — sem novo ambiente remoto.** P1 = local; P3 = execução Vercel em produção restrita a `test_stores`. P2 (banco remoto não-produção) **não aplicável**.

- [x] 5.1 Reutilizar as provas locais (P1) como evidência de contrato, sem repetir o que já está coberto
- [x] 5.2 Kill **simulado local** (P1) com provider simulado (fixture local, sem rota pública) e verificação de claim residual
- [ ] 5.3 Ausência+PF→`refunded` com probe fresco (kill ≠ ausência) no destino, via leitura/execução controlada
- [x] 5.4 Arte íntegra→`delivered` no destino
- [x] 5.5 `invalid`/`indeterminate` **permanecem inconclusivos**; resolução administrativa só com as precondições existentes, sem ampliar RPC nem fabricar evidência
- [x] 5.6 Fence sob timeout/rede (`begin_publication`/`abort`/`mark_result_unknown`)
- [ ] 5.7 Replay idempotente de `deliver` após redeploy
- [x] 5.8 RLS/grants efetivos no destino (RPC-only, `service_role` só `SELECT`)
- [x] 5.9 Ausência de vazamento de segredos nos logs hospedados — **inspeção delimitada** (período/deployments/fontes/lacunas em `56.2.6-LOGS-VERIFICATION.md`)
- [x] 5.10 Login real com CAPTCHA/Google no hospedado
- [x] 5.11 Garantir que nenhuma rota pública expõe provider simulado e que o cliente não escolhe provider
- [x] 5.12 **P3 — execução Vercel** na rota real, provider real, produção restrita a `test_stores`, sob checkpoint de chamada paga (primeira operação paga do piloto)
- [x] 5.13 Registrar **kill real como limitação** e **não declarar D13 resolvido pelo caminho feliz**

## 6. Piloto manual restrito (lojas de teste)

- [x] 6.0 Concluir as **provas** (P1 local + aceite) — **antes** da primeira chamada paga
- [x] 6.0.1 Registrar **disposição explícita** sobre o kill real e a limitação de D13 hospedado **antes do piloto** (D13 não resolvido pelo caminho feliz)
- [x] 6.1 Conceder autorização `test_stores`, configurar teto e registrar `operation_id`
- [x] 6.2 Ligar `product_1_1_test_stores_enabled` apenas na janela; `all_stores` sempre `false`; **não** alterar a pausa global (o legado segue operando)
- [x] 6.3 Executar piloto manual nas lojas de teste, com inspeção humana do resultado
- [x] 6.4 Monitorar: concorrência, retry/fallback, sucesso/falha/`unknown`, gasto e claims
- [x] 6.5 Aplicar critérios de parada: erro/timeout, limite de chamadas/teto, corrida perdida, estado inesperado, flag off
- [x] 6.6 Desligar normalmente: **flag do novo fluxo OFF + revogação da autorização**; **não** pausar a geração global (pausa só em emergência autorizada); registrar que operações em andamento **não** são canceladas
- [x] 6.7 Confirmar que nenhuma loja não-test foi habilitada

## 7. Separação e encerramento

- [x] 7.1 Registrar que o piloto hospedado é **etapa** da liberação, não a promoção geral
- [x] 7.2 Confirmar `all_stores` bloqueado e abertura geral como mudança futura separada
- [x] 7.3 `openspec validate --strict` e reconciliação documental
- [x] 7.4 Reconciliar tracking sem recalcular contadores encerrados e sem iniciar F56.3

---

## Reconciliação de execução — 2026-10-19

**Legenda:** `[x]` = executado com evidência; `[ ]` = limitação/não comprovado, mantido aberto de propósito.

| Item | Evidência | Disposição |
|---|---|---|
| 1.1–1.6 | OpenSpec + 8 planos GSD; D1/D2; backup/restore; janela N=1 | Concluídos; D13/sign-off **restritos ao N=1** |
| 2.1–2.8 | Plano 01; 51 testes de contrato; migration aplicada no lote | Concluídos; `all_stores` recusado |
| 3.1–3.5 | Plano 02; deadline 240s + reserva 20s; 17/17 + P1 | Concluídos; **kill real INCONCLUSIVE** |
| 4.1–4.9 | Planos 05/06/07; backup 8/8; 31/31 migrations; ledger 130/0; deploy OFF; D2 | Concluídos; legado preservado |
| 5.1–5.2 | Plano 04; P1 local 7/7; provider simulado test-only | Concluídos (escopo local) |
| **5.3** | P1 local cobre ausência+PF→`refunded`; **não executado no hospedado** | **ADIADO POR DECISÃO DO RESPONSÁVEL — NÃO EXECUTADO**; bloqueio da abertura geral (`DEFERRED.md`) |
| 5.4 | N=1: arte íntegra→`delivered` | Concluído |
| 5.5 | P1 local: `invalid`/`indeterminate` inconclusivos; resolução administrativa existente | Concluído em contrato local; não exercitado no hospedado |
| 5.6 | Fence/publicação sob timeout/rede em contratos e P1 | Concluído (local) |
| **5.7** | Replay idempotente coberto por contrato local; **não executado após redeploy no hospedado** | **ADIADO POR DECISÃO DO RESPONSÁVEL — NÃO EXECUTADO**; bloqueio da abertura geral (`DEFERRED.md`) |
| 5.8 | RLS/grants read-only no destino | Concluído |
| **5.9** | Inspeção delimitada: `dpl_4ZH…` + `dpl_E8…`, 53 entradas disponíveis, 0 padrões de segredo; lacuna de retenção registrada | **FECHADO COM ESCOPO DELIMITADO** (não é promessa de ausência absoluta) |
| 5.10–5.13 | Login humano; guarda de provider 7/7; P3 N=1; kill real registrado | Concluídos; D13 não resolvido |
| 6.0–6.7 | Janela N=1; delivered; flag OFF + revogação; pausa global intacta | Concluídos |
| 7.1–7.4 | Separação piloto/abertura geral; `all_stores=false`; validação estrita; tracking | Concluídos |

### Limitações que NÃO são provas concluídas

- **D13:** aceito **exclusivamente** para o piloto N=1 monitorado; **não** resolvido integralmente e **não** autoriza lojas gerais.
- **Kill real:** **INCONCLUSIVE**; deadline cooperativo ≠ kill; kill não autoriza nenhuma via.
- **Lojas gerais:** `all_stores=false`; abertura geral é mudança futura e separada.
- **Janela:** encerrada; `test_stores=false`, autorização `seq=2 revoked/off`.
- **P2:** N/A (Alt C); **P3:** executado no N=1.
- **Itens 5.3 e 5.7:** permanecem abertos e são **bloqueios obrigatórios da abertura geral**; não foram executados nesta rodada. **5.9** foi fechado por inspeção delimitada, sem prometer ausência absoluta/eterna.
- **Sync/archive:** **não executados** nesta rodada.

### Bloqueios explícitos da abertura geral

- **5.3 — estorno hospedado:** comprovar `ausência + PF → refunded` no destino hospedado com probe fresco, sob leitura/execução controlada, **antes de qualquer abertura geral**. **Adiado por decisão do responsável; não executado; não declarado PASS.**
- **5.7 — replay após redeploy:** comprovar replay idempotente de `deliver` após redeploy hospedado, **sem regenerar arte**, antes de qualquer abertura geral. **Adiado por decisão do responsável; não executado; não declarado PASS.**
- **Decisão formal (2026-10-19):** o responsável aprovou o fechamento do N=1 e o adiamento explícito de 5.3/5.7, que permanecem obrigatórios antes da abertura geral. Ponteiro durável: `DEFERRED.md`.
- Esses bloqueios **não** alteram o aceite do N=1; D13 e kill real permanecem no alcance já aceito para o piloto monitorado.
- `all_stores` continua `false`; a abertura geral exige mudança futura e separada.
