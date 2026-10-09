# F56.2b1b — Núcleo entregável, ainda desligado

Dependência normativa: `fase-56-2b1a-fundacao-inativa-produto-1-1` (arquivada). Integra formulário elegível, geração **no ciclo da requisição**, reserva/entrega usando a operação atômica da b1a e download condicionado a `delivered`. A campanha concluída fica **persistida e recuperável ao retornar ao aplicativo** (persistência do resultado; **sem** retomada automática de processamento). A b1b **não** implementa aprovação humana nem aprovação automática — isso permanece na F56.3. Nenhuma loja é habilitada. Retry de copy, E2E completo, piloto pago e autorização habilitadora pertencem à `fase-56-2b2-copy-recuperavel-e-piloto-produto-1-1`.

## Pontos de atenção

- **Regra de reenvio (fechada):** o reenvio do lojista **apenas consulta** a operação existente (`campaignId + operation_id`): se houver arte salva, recupera essa arte; se o resultado continuar desconhecido, **não** chama o modelo novamente. Não inicia tentativa, geração nem cobrança.
- **Início de tentativa atômico no banco** (sem fila/cron/worker): duas requisições simultâneas **não** chamam o provider duas vezes; a reserva financeira sozinha não garante isso; o teto 2+1 pertence à **operação inteira**.
- **Resultado desconhecido:** UI mostra “Não foi possível confirmar a conclusão desta geração” com referência de suporte; **sem** “Gerar novamente” para essa operação; **administrador autorizado** resolve por evidência, com **motivo obrigatório** e **registro auditável** (sem dois aprovadores): entrega arte existente ou estorna uma vez após confirmar ausência e encerramento. “Fila de atendimento” é **somente lista de pendências, sem execução automática**; **sem re-queue**, nova geração administrativa ou chamada automática ao provider.
- **DIFERIDO (não é requisito nem pré-condição):** a execução durável independente da requisição/navegador (fila/outbox, cron/dispatcher, worker, claim/lease/heartbeat/fencing, continuidade após fechar a página, retomada automática e prova executável) saiu do escopo por decisão humana. Referência preservada em `D6.1-DURABLE-EXECUTION-INVESTIGATION.md` (marcada como histórica/diferida); retomar **quando houver Vercel Pro**, com nova investigação, sem presumir solução aprovada.
- **Comportamento na queda de conexão:** a geração roda no ciclo da requisição; **não** se afirma que a desconexão cancela necessariamente o provider **nem** que o processamento continuará garantidamente.
- **UI-SPEC** é pré-requisito do planejamento dos controles conectados; pode ser preparada separadamente, sem liberar o núcleo.
- **Token GSD:** `56.2.2` (b1b); `56.2.3` permanece para a b2.
- **Preservados:** flags `false`; autorização `off`; idempotência/RPC-only/identidade da b1a; principal `sunburst/medium`, fallback `image-2/medium`, política 2+1; um crédito por entrega; arte 1024×1024 privada com download só após `delivered`; falha confirmada → estorno uma vez; resultado desconhecido sem repetição cega nem estorno por timeout; copy não bloqueante sem retry.

Esta reconciliação é **documental**: não cria change, não inicia GSD, não implementa, não roda migration, não chama provider, não ativa flags, não faz deploy, commit ou push.
