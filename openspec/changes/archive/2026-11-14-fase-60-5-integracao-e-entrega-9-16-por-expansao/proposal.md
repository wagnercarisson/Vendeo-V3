## Why

As peças do 9:16 por expansão já existem isoladas — controle e integração financeira (F60), artefatos (F60.1), preparação 1152 (F60.2), expansão por IA (F60.3) e base quadrada + copy (F60.4) —, mas o lojista ainda não consegue percorrer o fluxo completo. Sem um orquestrador próprio, o 9:16 continua preso ao caminho direto antigo, que gera uma única imagem vertical e não usa a base quadrada reutilizável. Isso impede entregar o vertical final com uma única reserva de crédito, continuidade segura entre etapas, um único arquivo vertical acessível e desligamento controlado do caminho antigo.

## What Changes

- **Novo orquestrador 9:16 por expansão**: seleção de formato → base quadrada + copy → preparação 1152 → expansão → entrega do vertical → confirmação de 1 crédito. O orquestrador compõe os módulos existentes; não recria compositor, copy, preparação ou expansor e não chama o fluxo completo 1:1.
- **Uma operação, um formato e uma reserva**: `1:1` continua no caminho atual sem mudança; `9:16` passa a abrir uma operação `9_16_two_stage` com uma única reserva de 1 crédito. Dois formatos e aquisição posterior do outro formato ficam fora.
- **Continuação explícita entre requisições**: a tela de processamento é reutilizada. Quando o orçamento da requisição não cobre a próxima etapa, o servidor encerra a requisição em `processing` **antes** de adquirir a etapa seguinte; um endpoint de continuação autorizado pela F60 retoma a mesma operação a partir das etapas persistidas. Consulta de status continua somente leitura.
- **Entrega única e controlada**: apenas o vertical final 1080×1920 JPEG + copy é entregue. O vertical é acessado pela F60.1, sem cópia em `campaign-images`; base 1024 e preparado 1152 permanecem internos. Detalhe, preview, download e listagem passam a resolver o vertical pela origem persistida, nunca por formato isolado. Os cards preservam a estratégia atual de miniaturas leves, derivadas do vertical; a miniatura é um derivado de exibição, não uma segunda cópia da entrega.
- **Financeiro F60 como autoridade única**: reserva na abertura, confirmação somente após vertical íntegro e entrega autorizada, estorno único em falha definitiva sem entrega, resultado desconhecido sem retry nem estorno presumido. Nenhum ledger paralelo.
- **Desligamento do 9:16 direto antigo**: novas gerações diretas deixam de ser despachadas na ativação do novo caminho, inclusive recuperações que possam gerar outra imagem. O código é preservado; campanhas históricas continuam legíveis e baixáveis; operações antigas pendentes não são convertidas silenciosamente e recebem resolução segura.
- **Gate de ativação separado**: o novo caminho nasce desligado por uma flag fail-closed própria. Suspensão bloqueia novas solicitações 9:16 e não reativa automaticamente o caminho antigo.
- **Custos correlacionados**: copy, base, expansão e tentativas pagas compartilham a operação; modelos, qualidades, usage, pricing e eventos reais são preservados. Desconhecido permanece `null`/`not_available`.

## Capabilities

### New Capabilities

- `product-9-16-two-stage-orchestration`: percurso completo do novo 9:16, abertura única da operação, etapas `base`/preparação/`expansion`, retomada e continuação entre requisições, status somente leitura, distinção entre processamento e resultado desconhecido, integração financeira de 1 crédito, contrato de eventos/UI, gate de ativação e desligamento seguro do 9:16 direto antigo.
- `product-9-16-two-stage-delivery`: entrega do vertical final único 1080×1920 JPEG + copy, projeção da campanha entregue, acesso autorizado de detalhe/listagem/preview/download pela F60.1 sem duplicar o arquivo nem expor base/preparado, miniatura derivada leve para os cards, e recuperação administrativa/de copy reconhecendo a origem canônica e o conteúdo congelado.

### Modified Capabilities

<!-- Nenhuma capability existente tem requisito alterado. As specs da F60, F60.1, F60.2, F60.3 e F60.4 permanecem válidas e são reutilizadas como contrato. -->

## Impact

- **Rotas**: `POST /api/campaign/generate-image` (despacho 9:16 e marcador de origem), nova continuação autenticada, `generation-status`, download, recuperação de imagem, recuperação de copy e pendências administrativas.
- **Persistência de continuidade**: descritores e arquivos originais de entrada para reconstruir a primeira execução antes do congelado F60.4, sem leitura da loja atual ou briefing novo do navegador.
- **UI**: `use-campaign-form`, `GenerationProgress`, `unknown-result-panel`, seletor de formato, detalhe e listagem de campanhas.
- **Serviços compartilhados**: `projectDeliveredCampaign` (fonte de artefato), `TwoStageFinancialService` (sonda vertical real), `ProductTwoStageOperationClient` (leitura de etapas apenas leitura), repositório de pendências e adaptador de formato.
- **Módulos reutilizados sem reescrita**: F60, F60.1, F60.2, F60.3, F60.4, copy/recovery, telemetria e custo existentes.
- **Banco/Storage/providers**: nenhuma chamada paga, migration, escrita em banco/Storage ou alteração de ambiente nesta rodada de proposta. A necessidade de migration é avaliada no design.
- **Documentação/tracking**: proposta OpenSpec apenas; sem planejamento GSD, execução, ativação, merge, push ou deploy.
