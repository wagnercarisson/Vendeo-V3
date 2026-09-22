# Runbook de Retenção e Direitos de Titular

Este documento orienta a operação do beta fechado. Os prazos de retenção abaixo
não substituem validação jurídica: nenhum prazo regulatório é codificado sem a
aprovação do advogado.

O beta permanece fechado (`publicSignupEnabled=false`). A capacidade operacional
é de no máximo 50 participantes: antes de novos convites, conferir
`COUNT(DISTINCT lower(email))` entre as solicitações `access_requests` com
`status = 'approved'`. Não existe plataforma paralela de convites.

## Princípios

- A conta ativa permanece preservada mesmo sem saldo ou atividade.
- O encerramento abre uma janela operacional de 30 dias para exportação e
  recuperação. A transição `received` para `in_progress` marca o início da
  exclusão; depois disso o cancelamento é rejeitado.
- A retenção legal mínima, quando aplicável, fica segregada e registrada em
  `legal_hold`.

## Dados operacionais

`product_events`, `credit_notifications` e `support_credit_requests` devem ser
minimizados, acessados apenas por sua finalidade e anonimizados ou removidos ao
final da necessidade operacional. A data concreta de descarte deve ser definida
e aprovada juridicamente antes do go-live. `data_subject_requests` preserva o
protocolo, auditoria e evidência mínima necessária para demonstrar atendimento.

O WhatsApp de `access_requests` é opcional, não é marketing e deve ser removido
ou anonimizado quando a solicitação for concluída ou recusada e não houver mais
necessidade operacional.

## Arquivos

Ativos salvos em campanhas, marca e assinaturas visuais são tratados como dados
da conta e só são removidos no fluxo autorizado de encerramento/exclusão.
Uploads temporários de formulários, falhas de processamento e objetos órfãos
devem ser identificados por seu caminho/estado e limpos por rotina técnica
separada, sem atingir ativos salvos. Registrar contagem, período e resultado da
limpeza.

## Pedido de titular

O suporte registra acesso, exportação, correção, exclusão ou encerramento em
`data_subject_requests`, gera protocolo e executa o checklist manual: localizar
conta/loja, inventariar banco e todos os buckets, exportar quando solicitado,
anonimizar ou excluir os dados permitidos, revisar `legal_hold` e registrar
`deletion_inventory` antes de concluir. Não há autosserviço durante o beta;
`support_credit_requests` é exclusivo para pedidos de créditos.

## Evidência e revisão

Cada transição e tentativa de cancelamento deve ser auditada com operação,
protocolo, tipo, titular, contato, detalhes, inventário e retenção legal. O
responsável revisa pedidos pendentes regularmente e confirma com o solicitante
por meio do protocolo, sem prometer prazo jurídico ainda não aprovado.
