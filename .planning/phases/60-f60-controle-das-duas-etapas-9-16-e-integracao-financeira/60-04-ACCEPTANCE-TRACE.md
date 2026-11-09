# F60 / 60-04 — Rastreabilidade REQ-60-01..15

**Status:** **TECNICAMENTE ACEITO — encerramento formal pendente de `/gsd-verify-work` e `/opsx-verify`.**
**Método:** evidência documental/testes + prova Postgres **reutilizada** (RUN 2 26/26; 60-02 8/8; 60-01 13/13). Nenhuma conexão nova.

| REQ | Critério resumido | Evidência | Estágio | Veredito |
|---|---|---|---|---|
| REQ-60-01 | Identidade durável `(campaign_id, operation_id)` com `base`/`expansion` | `20261109174110_...sql:23-55`; `two-stage-operation-client.ts:372-425`; RUN 2 `two-stage-control`: “abertura é idempotente e base concluída mantém crédito reservado” e “índice parcial impede segunda tentativa ativa” | local + homolog reutilizado | **COBERTO** |
| REQ-60-02 | Execução única; vencedor `execute`, reenvio `query_only` | `...sql:455-665`, `:101`; RUN 2: “CAS rejeita token divergente e transição após conclusão”, “request_id é idempotente e conflita se o alvo divergir”, “índice parcial impede segunda tentativa ativa” | local + homolog reutilizado | **COBERTO** |
| REQ-60-03 | Base `done` não entrega nem confirma; continuidade sem reexecutar base | `...sql:321-420`; `two-stage-financial-service.ts:192-231`; RUN 2: “abertura é idempotente e base concluída mantém crédito reservado”; financeiro: “base done permanece reserved e não grava arte/entrega” | local + homolog reutilizado | **COBERTO** |
| REQ-60-04 | Limite da expansão (2) e base (2+1); timeout = desconhecido | `...sql:599, 631-646, 918-942`; `two-stage-control.test.ts`: “limita a expansão a inicial + um retry”, “timeout após possível envio é unknown e não repete”, “não autoriza primary depois de fallback”; 60-01 **S07** | local + homolog reutilizado | **COBERTO** |
| REQ-60-05 | `unknown` imutável, sem retry/estorno cego, resolução segura | `...sql:511-524, 815-840, 1039-1142`, `:166-168`; RUN 2: “desfecho é idempotente e divergência é conflito”; financeiro: “unknown não estorna sozinho; resolução administrativa usa cliente/identidade e projeta”; 60-01 **S08/S10** | local + homolog reutilizado | **COBERTO** |
| REQ-60-06 | Resposta tardia após encerramento não produz efeito | `...sql:499, 729, 811, 1007-1017`; RUN 2: “CAS rejeita token divergente e transição após conclusão”; 60-01 **S09** | local + homolog reutilizado | **COBERTO** |
| REQ-60-07 | Idempotência por `request_id`; conflito em divergência | `...sql:78, 527-539, 827-840`; RUN 2: “request_id é idempotente e conflita se o alvo divergir”; 60-01 **S04/S05** | local + homolog reutilizado | **COBERTO** |
| REQ-60-08 | 1 crédito; expansão sem reserva; confirmação só na entrega vertical | `two-stage-financial-service.ts:152-232`; `...sql:321-420`; RUN 2 financeiro: “duas aberturas reservam UM crédito e uma transação”, “expansão iniciada não reserva crédito adicional”, “entrega vertical confirma uma vez e replay não muta” | local + homolog reutilizado | **COBERTO** |
| REQ-60-09 | Estorno único em falha definitiva sem entrega | `two-stage-financial-service.ts:250-280`; `...sql:984-1029`; RUN 2 financeiro: “falha definitiva sem arte estorna uma vez; integral exige entrega”; 60-01 **S02** | local + homolog reutilizado | **COBERTO** |
| REQ-60-10 | Autoridade financeira única; estados derivados; admin prevalece | `two-stage-financial-service.ts:284-315`; `...sql:1209-1256`; RUN 2 financeiro: “operação delivered recusa estorno”, “unknown não estorna sozinho; resolução administrativa…”; 60-01 **S10** | local + homolog reutilizado | **COBERTO** |
| REQ-60-11 | Encerramento/pendências reconhecem a execução nova | `pending-operations-repository.ts:197-333`; `...sql:174-269`; RUN 2 compatibilidade: “entre etapas: base done + expansão pending expõe origin/stage e entra na listagem”, “listagem legada mantém origin='legacy' e sem segunda fila” | local + homolog reutilizado | **COBERTO** |
| REQ-60-12 | Origem canônica sem duplicação/desfechos conflitantes | `...sql:174-269`; `pending-operations-repository.ts:237-278`; RUN 2: “views por origem: ORDER BY source devolve 9_16_two_stage antes de legacy”, “origem nova sem sonda vertical fica inconclusiva na listagem (nunca quadrada)”, “histórico legado mantém ordem por attempt_number DESC” | local + homolog reutilizado | **COBERTO** |
| REQ-60-13 | Sem ledger paralelo; 1:1 e 9:16 direto preservados | `...sql:15, 1310`; nenhuma escrita em `credit_transactions`; RUN 2: “1:1 entregue preserva campo legado a campo legado”, “9:16 direto estornado NÃO é tratado como duas etapas e preserva campos legados” | local + homolog reutilizado | **COBERTO** |
| REQ-60-14 | Prova bloqueante em homolog com 13 cenários e isolamento | `60-01-PROOF-MATRIX.md` (S01–S13 **13/13 PASS**); `60-01-PROOF-DECISION.md` **APPROVED** | homolog (reutilizado) | **COBERTO** |
| REQ-60-15 | Separação local/homolog/produção; prova não é aceitação produtiva | `60-04-STAGE-SEPARATION.md` (este plano) | local + homolog reutilizado | **COBERTO** |

## Regras aplicadas

- Nenhum requisito está sem evidência.
- `PARCIAL`/`NOT_RUN` não foi usado para encerrar requisito obrigatório.
- A evidência Postgres desta fase é **reutilizada**; não houve nova conexão.
- A fase está **tecnicamente aceita**; a suíte global permanece `KNOWN_FAIL` pelas quatro falhas conhecidas em acompanhamento separado. Encerramento formal pendente de `/gsd-verify-work` e `/opsx-verify`.
- Logs dos gates: `evidence/f60-20261109-04/`.
