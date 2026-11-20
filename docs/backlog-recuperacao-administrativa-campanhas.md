# Backlog de recuperação administrativa de campanhas

**Data:** 2026-11-20.
**Status:** backlog adiado, sem implementação autorizada e sem prazo definido.

## Decisão e prioridade

A recuperação administrativa completa será uma capacidade interna de suporte, sem expor poderes administrativos ao lojista. O objetivo é resolver campanhas que ficaram pendentes, preservando os formatos já entregues e evitando cobrança ou processamento duplicados.

O responsável concordou com o fluxo de inspeção, conclusão de entrega existente, tentativa de regeneração do formato faltante e, como última alternativa, estorno. A entrega completa desse suporte tem escopo amplo e foi adiada porque há questões de maior prioridade. Este backlog não reabre a F60.7 nem condiciona sua entrega funcional a um novo painel.

Enquanto o suporte administrativo completo não estiver preparado, o contorno escolhido é analisar o caso, conceder crédito compensatório quando cabível e permitir uma nova geração pelo fluxo normal.

## O que já existe e o que falta

A F60.7 possui serviço e rota administrativa dedicada para resolver uma entrega conjunta por formato. O mecanismo pode confirmar a entrega de um artefato válido já existente ou efetuar estorno com ausência e finalidade comprovadas. Reconhece repetições e registra auditoria, sem presumir que uma resposta perdida exige um segundo efeito financeiro.

Referências de implementação:

- `src/lib/product-two-format/orchestration/pending-recognition.ts`: reconhecimento das pendências conjuntas.
- `src/lib/product-two-format/orchestration/resolve-joint-pending.ts`: resolução e auditoria por formato.
- `src/lib/product-two-format/admin/joint-admin-deps.ts`: composição administrativa.
- `src/app/api/admin/product-two-format-pending/route.ts`: rota dedicada de resolução.

Faltam uma listagem/GET e uma interface administrativa conectadas para descobrir, inspecionar e tratar essas pendências. A regeneração administrativa do formato faltante também não existe nesse mecanismo. Os fluxos administrativos individuais têm contratos próprios; a futura cobertura de 1:1, 9:16 e conjunto deverá respeitar essas diferenças.

## Fluxo futuro de atendimento

1. **Localizar e inspecionar a campanha.** Mostrar loja, operação, formatos, arquivos reconhecidos, créditos, tentativas em andamento, falhas e ações administrativas anteriores.
2. **Concluir o que já está pronto.** Se houver artefato íntegro e entrega permitida, confirmar somente o formato pendente, sem nova chamada de IA ou cobrança adicional.
3. **Regenerar somente o formato que falhou.** Após confirmar a falha e a elegibilidade, permitir uma tentativa administrativa, preservando o formato entregue e reutilizando a base congelada quando válida. Exemplo principal: quadrado entregue e vertical com falha.
4. **Oferecer estorno se a recuperação também falhar.** Não estornar apenas por timeout ou mensagem de erro. Confirmar que não existe entrega válida, processamento ativo ou resultado indeterminado que impeça a ação, respeitando as autoridades financeiras de cada operação.

Essa ordem privilegia entregar a campanha ao lojista antes de recorrer ao estorno. Uma falha não significa automaticamente autorização para regenerar ou devolver créditos.

## Regras para o futuro planejamento

- A tentativa administrativa de recuperação não deve gerar novo débito para o lojista; o custo adicional do provider fica com o Vendeo e precisa ser contabilizado.
- A direção inicial discutida é limitar a uma tentativa administrativa por formato. A política definitiva e suas exceções deverão ser especificadas antes da implementação.
- A tentativa precisa de identidade própria, vinculada à operação original. Não reabrir à força uma operação terminal nem reutilizar identificadores para contornar recusas da autoridade.
- Impedir execução paralela, cliques duplicados, regeneração de formato já entregue e repetição de entrega, concessão ou estorno.
- Preservar os formatos entregues e suas evidências. Se a base congelada estiver ausente ou inválida, bloquear o reaproveitamento; não iniciar outra base paga silenciosamente.
- Registrar operador, motivo, campanha, formato, operação original, tentativa de recuperação, resultado, efeitos financeiros e custo de IA. Reconciliação de efeito anterior não deve atribuir autoria indevida ao operador atual.
- Crédito já estornado não pode ser debitado novamente de forma automática. Casos previamente compensados exigem reconciliação para evitar benefício ou cobrança duplicados.
- Restringir acesso e proteger as ações administrativas; o lojista não fornece tokens de publicação, evidências ou identidades financeiras arbitrárias.

## Contorno temporário por concessão de crédito

O suporte poderá usar o mecanismo existente de concessão administrativa, conforme o [runbook de suporte](operations/support-runbook.md), para compensar um caso analisado e orientar uma nova geração normal.

Antes da concessão, conferir o formato efetivamente entregue, o extrato, estornos automáticos e compensações anteriores. Registrar motivo, campanha/operação de origem e quantidade concedida. A quantidade deve corresponder ao atendimento decidido e ao custo da nova geração selecionada, não a um valor fixo presumido para todo incidente.

**Concessão compensatória não é estorno técnico da operação original.** Ela não resolve automaticamente uma reserva pendente, não altera o desfecho da campanha anterior e não pode ocultar uma inconsistência financeira. Resultado desconhecido ou execução ainda ativa exige investigação antes de orientar processamento duplicado.

A nova geração pelo fluxo normal cria uma nova solicitação e segue a cobrança normal, usando o saldo disponível. Esse contorno não promete recuperar somente o vertical nem reutilizar a base da campanha anterior; essas capacidades pertencem ao escopo futuro. O formato anteriormente entregue continua disponível.

Este registro não executa nem autoriza concessões em casos concretos, alterações diretas no banco ou chamadas pagas. Cada atendimento permanece sob decisão administrativa.

## Como retomar o backlog

Quando houver prioridade, elaborar especificação e plano próprios, definindo listagem, diagnóstico, permissões, regeneração por formato, custos, compensações e estornos. Não tratar a regeneração como simples botão sobre a rota de resolução existente: ela acrescenta execução paga e uma nova relação entre tentativas e créditos.

Antes da entrega, provar ao menos: recuperação sem provider quando o artefato já existe; regeneração somente do formato elegível; preservação do irmão entregue; ausência de débito adicional ao lojista; controle de concorrência e repetição; falha da recuperação seguida de estorno seguro; auditoria e reconciliação de casos já compensados. As falhas conhecidas dos testes da rota administrativa individual também devem ser triadas, sem apenas ajustar expectativas para obter testes verdes.

As ressalvas originais de descoberta administrativa estão em [60.7-OPSX-VERIFY.md](../.planning/phases/60.7-entrega-conjunta-formatos-1-1-9-16/60.7-OPSX-VERIFY.md). Este artefato registra a decisão posterior de adiar a solução completa e manter um contorno operacional controlado.
