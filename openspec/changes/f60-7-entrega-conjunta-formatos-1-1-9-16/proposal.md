## Why

Hoje cada campanha entrega um único formato e cada reserva financeira está acoplada a uma única operação de geração. O lojista que precisa publicar no feed e nos Stories/Reels precisa repetir briefing, copy e geração, pagando duas campanhas independentes. A F60.6 foi publicada e o funcionamento em produção foi confirmado pelo usuário; a próxima entrega deve permitir solicitar 1:1 e 9:16 na mesma campanha, compartilhando briefing e copy e gerando a base quadrada uma única vez.

## What Changes

- Adicionar uma opção explícita de **entrega conjunta 1:1 + 9:16** no fluxo novo, somente quando a geração vertical estiver habilitada. Campanhas 1:1, 9:16 individuais e históricos permanecem inalterados.
- Persistir um contrato de formato conjunto (`campaignFormat: "1:1+9:16"` + versão própria + origem de geração própria), sem reutilizar o contrato vertical individual e sem conversão de campanhas existentes.
- Gerar a base quadrada uma única vez. Essa mesma base (`square_original` 1024×1024) passa a ser a entrega 1:1 e a fonte canônica da preparação/expansão vertical; nenhuma segunda arte quadrada é gerada para entrega.
- Criar uma **costura/orquestrador dedicado** para a entrega conjunta, reutilizando `runSquareBase`, preparação, expansão, copy por operação, controles de etapa e artefatos existentes sem alterar a semântica dos fluxos individuais.
- Separar a identidade financeira por entrega: duas reservas de 1 crédito, uma para 1:1 e outra para 9:16, com confirmação e estorno independentes. Não alterar o valor unitário nem a semântica das RPCs financeiras atuais.
- Confirmar o 1:1 imediatamente após a base quadrada ficar íntegra, antes de preparação/expansão, usando o artefato canônico já persistido. A ordem é artefato persistido/verificado → token de publicação → confirmação + projeção; o token não exige novo upload nem duplicação da imagem. Assim, uma falha posterior na expansão não oculta nem invalida o quadrado já entregue.
- Permitir entrega parcial: campanha pode ficar disponível com um formato entregue e o outro em processamento, ausente ou com crédito devolvido. Estorno somente do formato comprovadamente não entregue; resultado indeterminado não autoriza estorno presumido.
- Recuperação/continuação atua somente sobre o formato faltante e nunca regenera nem cobra novamente o formato já entregue. Reserva existente é continuação; formato já estornado não é reaberto automaticamente nesta fatia.
- Reutilizar a seleção administrativa de modelo/qualidade da expansão e seu congelamento por operação.
- Organizar a interface: um card por campanha, indicadores 1:1 e 9:16, formato entregue clicável, processamento indicado sem iniciar geração, ausência informada sem ação, preview/download individuais no detalhe, copy compartilhada, miniatura quadrada preferida quando entregue e miniaturas sempre derivadas.
- **Fora desta fatia:** modal de confirmação para gerar formato ausente, conversão de campanha existente, adicionar 9:16 a um 1:1 existente e disponibilizar 1:1 de um 9:16 existente.

## Sequenciamento de execução

Uma única OpenSpec, com execução em três subfatias revisáveis:

- **A — Fundação financeira e entregas:** vínculos por formato, abertura atômica, confirmação/estorno, projeção, clientes e contratos de leitura/acesso. Sem UI e sem disponibilidade.
- **B — Orquestração conjunta e proteção administrativa:** base única, entrega quadrada, expansão, entrega parcial, continuação e classificação/bloqueio administrativo seguro. Testes integrados offline pelos componentes reais; ainda sem disponibilidade.
- **C — Jornada e apresentação:** extensão do schema de produção, tipos de restauração/formulário/review, seletor, custo de 2 créditos, processamento, indicadores, preview/download, cards e dashboard. A opção conjunta só fica disponível após C e seu aceite.

A validação real da migration é um gate separado, posterior à B e anterior à liberação, no homolog existente e mediante autorização; testes estáticos/offline não substituem transações e concorrência no PostgreSQL. A e B são entregas técnicas intermediárias, não funcionalidades publicáveis.

## Capabilities

### New Capabilities

- `product-two-format-campaign-orchestration`: solicitação conjunta explícita, um briefing/copy, uma base quadrada reutilizada, orquestração recuperável e relação entre campanha, operação conjunta, etapas e entregas.
- `product-two-format-credit-billing`: duas identidades financeiras por entrega, abertura com duas reservas de 1 crédito, confirmação por formato, estorno parcial comprovado, concorrência, replay e indeterminação.
- `product-two-format-delivery`: entrega do quadrado e do vertical, estados parciais, projeção da campanha, acesso individual, miniaturas derivadas, recuperação apenas do formato faltante e resolução administrativa por formato.

### Modified Capabilities

- `product-vertical-format-selection`: a seleção passa a admitir a opção conjunta explícita, com contrato persistido próprio; 1:1/9:16 individuais continuam com o contrato atual e não há conversão.
- `product-9-16-two-stage-orchestration`: a regra de “um único formato por solicitação” passa a excluir a entrega conjunta, que usa caminho dedicado; o fluxo 9:16 individual permanece com uma reserva e uma entrega.
- `campaign-list-ui`: cards de campanha conjunta com um único card, indicadores por formato, miniatura quadrada preferida e download individual.
- `campaign-page-ui`: detalhe com preview/download por formato, estados de processamento/ausência, copy compartilhada e entrega parcial explícita.
- `campaign-download-route`: download do formato selecionado na campanha conjunta, com autorização e artefato corretos por formato.
- `dashboard-operational-composition`: campanha conjunta elegível aparece uma vez, com indicação dos formatos e miniatura derivada preferida.

## Impact

- **Formulário/rota:** novo valor de formato conjunto no schema do fluxo novo, fingerprint congelado, dispatch para orquestrador dedicado e pré-checagem explícita de 2 créditos.
- **Runtime:** novo módulo de orquestração/entrega conjunta compondo módulos existentes de base quadrada, preparação, expansão, copy, crédito, artefatos e miniatura; nenhuma alteração na semântica dos fluxos 1:1 e 9:16 individuais.
- **Banco (planejado, não aplicado nesta rodada):** tabela de vínculo entrega↔formato↔operação financeira; RPC de abertura conjunta idempotente que reutiliza a abertura v2 e reserva o segundo crédito na mesma transação; RPC de projeção/entrega/estorno por formato. Sem backfill, sem alteração do CHECK `amount = 1`, sem renomear migrations aplicadas.
- **Interface:** `/campanhas`, `/campanhas/[id]`, dashboard, download e painel de pendências administrativas para reconhecer a entrega conjunta por formato.
- **Tracking:** aceite de produção da F60.6 registrado como relato do usuário, sem novas verificações; F60.7 registrada como proposta aguardando revisão.
- **Fora de escopo:** aprovação visual, comparação de modelos, chamadas pagas, homolog, migrations aplicadas, flags/pricing, merge, push, deploy e ativação.
