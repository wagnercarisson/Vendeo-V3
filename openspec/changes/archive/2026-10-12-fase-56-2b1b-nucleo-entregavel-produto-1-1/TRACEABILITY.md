# Matriz de reconciliação — change agregadora b1 → b1a/b1b

| Origem na change agregadora | Destino | Requisitos/tasks preservados |
|---|---|---|
| B1-D9; tasks A.1–A.4 | b1a §1 | Diagnóstico somente leitura, gate de saúde/schema/isolamento, fallback para instância descartável nova |
| B1-D1; activation spec; tasks B.1–B.7 | b1a activation/§2 | Autorização independente, flags aplicáveis, fail-closed, concessão/revogação auditadas, off e fixtures sem ativação |
| Submissão incompatível; tasks C.1–C.3 | b1a activation/§3 | Erro seguro pré-crédito, sem descarte de campos e legado preservado |
| B1-D4; billing spec; tasks D.1–D.7 | b1a billing/§4 | Identidade, transação reserva+estado, CAS, concorrência, reconciliação, interrupções reais e semântica reserva/finalização/estorno |
| B1-D1/D2; tasks E.1–E.6 | b1b flow/intent/§1 | Roteamento integrado, UI elegível, POST revalidado e payload legado |
| B1-D5; tasks F.1–F.5 | b1b orchestration/config/snapshot/§2 | Snapshot/preflight, par, política 2+1, falha/IMG-001, sem revisor, append-only |
| B1-D4/D7; tasks G.1–G.5 | b1b billing/artifact/failure-policy/§3 | RPC de crédito atômica, arte 1024×1024, download só delivered e legado preservado |
| B1-D6; tasks H.1–H.4 | b1b copy/instrumentation/support/§4 | Copy não bloqueante, estado persistido, sem retry, envelope/custo e diagnóstico durável |
| Checkpoints/gates; tasks H.5–H.6 | b1b §7 e gates b1a §5 | Validação estrita, checkpoint humano separado e sem antecipar b2/F56.3 |

## Reconciliação b1b (2026-10-09) — escopo ativo (sem execução durável)

| Requisito | Capability (spec) | Tasks |
|---|---|---|
| Geração **no ciclo da requisição**, com limites e falhas tratados | `product-1-1-generation-orchestration` | §2.4 |
| Campanha concluída persistida e recuperável **ao retornar ao aplicativo** (sem retomada automática) | `product-1-1-flow-activation` | §0, §6.4, §7.4 |
| Briefing, referências/seleções e versões de composição congelados + snapshot de modelo/qualidade | `image-generation-config-snapshot`, `product-1-1-generation-orchestration` | §2.1 |
| Idempotência: reenvio **apenas consulta** (não inicia geração nem cobrança) | `product-1-1-campaign-credit-billing`, `product-1-1-generation-orchestration`, `product-1-1-artifact-delivery` | §3.1, §3.2 |
| **Início de tentativa atômico no banco** (sem fila/cron/worker): duas requisições não chamam o provider duas vezes | `product-1-1-generation-orchestration` | §3.1 |
| Reserva atômica da b1a e **um crédito por entrega** | `product-1-1-campaign-credit-billing` | §3.3 |
| Falha confirmada sem arte utilizável → `refunded` uma vez | `product-1-1-campaign-credit-billing`, `image-generation-failure-policy` | §5.1 |
| Resultado desconhecido: sem repetição cega, sem retomada, sem estorno por timeout; UI com referência de suporte e sem “Gerar novamente” | `product-1-1-generation-orchestration`, `product-1-1-flow-activation`, `image-generation-failure-policy`, `product-1-1-artifact-delivery`, `image-generation-support-reference` | §5.2, §5.3 |
| Resolução por **administrador autorizado**, motivo obrigatório e registro auditável (entregar ou estornar uma vez; lista de pendências sem execução automática; sem re-queue/nova geração/chamada automática) | `product-1-1-generation-orchestration`, `product-1-1-campaign-credit-billing` | §5.4 |
| Storage privado, arte 1024×1024, download só após `delivered` | `product-1-1-artifact-delivery` | §3.3–3.6 |
| Copy não bloqueante, sem retry, estados persistidos | `product-1-1-copy-recovery` | §4.1, §4.2 |
| Modelo/qualidade pelo admin + política 2+1 | `image-generation-model-pair-config`, `image-generation-failure-policy` | §2.3, §2.4 |
| Testes isolados com provider simulado + Postgres/Storage reais, sem bypass de autorização | tasks §6 | §6.1–6.4 |
| UI-SPEC antes do planejamento dos controles conectados | tasks §0.2 | §0.2 |
| Fronteira F56.3 preservada | (fronteiras) | §5.4 |

## Preservações (não regredir)

| Contrato b1a / decisão | Onde é preservado na b1b |
|---|---|
| Flags `false` e autorização `off` | proposal §Checkpoint; design §B1B-D11; tasks §7.2 |
| Identidade canônica server-side (`host`) | design §Contexto; tasks §0.1 |
| Escrita RPC-only e idempotência (`campaignId + operation_id`) | design §Contexto; specs billing/orchestration |
| Principal `sunburst/medium`, fallback `image-2/medium`, política 2+1 | proposal §Dependências; design §B1B-D4; specs failure-policy/orchestration |
| Um crédito por entrega; sem cobrança por tentativa técnica | design §B1B-D4; specs billing/failure-policy |
| Arte real 1024×1024, Storage privado, download só `delivered` | design §B1B-D6; spec artifact-delivery |
| Copy não bloqueante, sem retry | design §B1B-D8; spec copy-recovery |
| Aprovação/reprovação/correção na F56.3 | proposal §Dependências; design §B1B-D11 |
| Piloto pago, autorização habilitadora e E2E completo na b2 | proposal §Dependências; design §Fora de escopo |

## DIFERIDO (referência, não requisito nem pré-condição)

A **execução durável independente da requisição/navegador** — fila/outbox, cron/dispatcher, worker,
claim/lease/heartbeat/fencing, continuidade após fechar a página, retomada automática e a prova executável
da candidata A — **saiu do escopo ativo** por decisão humana (2026-10-09). As capabilities
`product-1-1-durable-execution` e `product-1-1-operation-recovery` **não** fazem parte desta fatia e seus
deltas foram removidos. A investigação read-only permanece preservada como referência **DIFERIDA** em
`D6.1-DURABLE-EXECUTION-INVESTIGATION.md`, a ser retomada **quando houver Vercel Pro**, mediante nova
investigação, **sem presumir solução aprovada**.

Nenhum requisito ativo foi removido sem decisão. As changes b1a (arquivada) e b1b (ativa) substituem a
change agregadora; a **revisão humana da b1b terminou** (checkpoint aprovado em `56.2.2-UAT.md`,
`status: approved`, 9/9, 2026-10-12). A b1b **não** foi sincronizada nem arquivada **por ausência de
autorização específica** para o lifecycle (verify/sync/archive) — **não** por revisão pendente.
