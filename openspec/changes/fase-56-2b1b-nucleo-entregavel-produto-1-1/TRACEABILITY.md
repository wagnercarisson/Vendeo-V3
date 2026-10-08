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
| Checkpoints/gates; tasks H.5–H.6 | b1b §5 e gates b1a §5 | Validação estrita, checkpoint humano separado e sem antecipar b2/F56.3 |

Nenhum requisito foi removido. A change agregadora fica substituída por estas duas changes ainda não implementadas; não sincronizar nem arquivar como concluída.
