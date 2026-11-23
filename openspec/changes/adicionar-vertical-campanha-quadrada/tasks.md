## 1. Fundação de contratos e apresentação

- [ ] 1.1 Criar o módulo puro `src/lib/campaign/format-addition/` com tipos fechados de estado (`eligible`, `incompatible`, `delivered`, `processing`, `absent`, `unknown`, `unavailable`), motivos de inelegibilidade e resultado de preflight, sem I/O.
- [ ] 1.2 Implementar a derivação pura de elegibilidade a partir de formato persistido, status, metadados/probe do artefato, existência da adição e estado durável, distinguindo incompatibilidade comprovada de leitura indisponível.
- [ ] 1.3 Estender `src/lib/campaign/format-presentation.ts` com a entrada opcional de adição, mantendo `flow = "single_format"`, `partial = false`, `not_requested` apenas quando nunca houve adição e `not_delivered` quando houve tentativa sem entrega.
- [ ] 1.4 Atualizar os testes de pureza e de apresentação para os estados de adição, garantindo que nenhum `input_snapshot`, path, credencial ou URL entre no modelo.
- [ ] 1.5 Definir os textos pt-BR e es-419 de custo, confirmação, processamento, incompatibilidade, resultado incerto, falha definitiva, retomada e seleção de formato, mantendo paridade estrutural entre catálogos.

## 2. Persistência durável e RPCs

- [ ] 2.1 Autorar a migration aditiva `YYYYMMDDHHmmss_campaign_format_addition.sql` com timestamp UTC real e conferir unicidade de prefixo na worktree, branch de integração e branches paralelas conhecidas.
- [ ] 2.2 Modelar `campaign_format_additions` com campanha/loja, operação de controle, `source_origin`, `source_operation_id` nullable, `source_registration_operation_id`, artefato-fonte, checksum, formatos, estado, `request_id`, economia congelada, timestamps, FKs compostas, unicidade de `(campaign_id, request_id)` e índices parciais para operação `open`/`delivered`.
- [ ] 2.3 Habilitar RLS SELECT-only para `service_role`, revogar escrita direta e garantir que apenas as RPCs possam inserir/atualizar o vínculo.
- [ ] 2.4 Implementar a validação e a trava da RPC de abertura: campanha `1:1` pronta, `source_origin` reconhecida, ponte íntegra, seleção/economia congeladas, loja/campanha divergentes e ausência de adição ativa; no fluxo novo, exigir a operação `1:1` primária entregue; no legado, aceitar artefato/checksum sem operação financeira original.
- [ ] 2.5 Implementar a abertura/replay idempotente da RPC por `request_id`, retornando `open`/`delivered`/`refunded` existentes e chamando `product_9_16_open_operation_v2` somente em abertura nova ou nova tentativa com token de confirmação válido; um `idempotent: true` inesperado sem vínculo da adição SHALL ser tratado como conflito, não como adoção.
- [ ] 2.6 Marcar a etapa `base` como `done` com evidência da fonte na mesma transação da abertura, sem chamar geração.
- [ ] 2.7 Implementar a RPC de entrega com validação do `vertical` canônico 1080×1920 JPEG, CAS de crédito, token de publicação, reconciliação idempotente e atualização do vínculo sem projetar a campanha.
- [ ] 2.8 Implementar a RPC de estorno com exigência de arte ausente, outcome `failed`, epoch, ausência de claim ativo, estorno exclusivo da adição e replay idempotente.
- [ ] 2.9 Redefinir `product_1_1_get_campaign_operation_by_campaign` para excluir operações de adição, preservando a operação primária da campanha e a leitura por identidade explícita.
- [ ] 2.10 Ampliar o CHECK de origem de `campaign_composition_artifacts` e a união/allowlist de tipos para `delivered_campaign_reuse`, sem backfill e sem alterar linhas existentes.
- [ ] 2.11 Adicionar testes estáticos de schema, constraints, FKs, RLS, grants, identidade de fonte legada, `SECURITY DEFINER`, `search_path = ''` e ausência de escrita direta; não aplicar a migration nesta etapa.
- [ ] 2.12 Atualizar o inventário de migrations/testes e registrar a migration como **não aplicada**, com gate de banco separado.
- [ ] 2.13 Autorar a chave de feature flag `campaign_format_addition_enabled` com `enabled = false`, leitura fail-closed e registro no serviço/painel existente de feature flags, sem criar novo painel administrativo.

## 3. Ponte de proveniência e cliente financeiro

- [ ] 3.1 Implementar o registro idempotente da fonte entregue como `square_original` interno, usando `resolveReusableSquareSource`, `validateDeliveredCampaignSource` e `persistCompositionArtifact` com origem `delivered_campaign_reuse` e identidade estável por fonte/campanha.
- [ ] 3.2 Implementar o modo opt-in da validação de fonte entregue que aceita 1024×1024 em `legacy_campaign` no path canônico, propagado também para a revalidação interna de `persistCompositionArtifact`, sem alterar o default histórico de 1080 dos demais consumidores.
- [ ] 3.3 Para `legacy_campaign`, derivar a identidade sintética determinística da fonte e registrar `source_origin`, sem criar operação financeira original; para `new_flow_1_1`, usar a operação `1:1` primária entregue que sustenta a fonte.
- [ ] 3.4 Garantir que a ponte use os bytes reais, recalcule tamanho/checksum, valide o readback F60.1 e nunca sobrescreva o artefato original ou a linha existente; concorrência/aberturas recusadas devem convergir para a mesma ponte.
- [ ] 3.5 Implementar a leitura do vínculo da adição por identidade explícita e por campanha, com estados sanitizados, origem da fonte e distinção de leitura indisponível.
- [ ] 3.6 Criar o cliente server-only das RPCs de abertura, entrega e estorno, com envelopes fechados, validação de UUIDs, motivos permitidos e erros tipados.
- [ ] 3.7 Implementar o congelamento da seleção de expansão e dos parâmetros econômicos na abertura, com validação de pricing/catálogo antes da reserva.
- [ ] 3.8 Implementar leitores congelados de catálogo e pricing para retomadas/retries e falhar fechado quando o congelado estiver ausente, malformado ou incompatível.
- [ ] 3.9 Adicionar testes de contrato para fonte legada 1024 sem crédito original, ponte estável, proveniência divergente, concorrência, replay, checksum, origem e economia congelada, incluindo ausência de efeitos financeiros na ponte.

## 4. Orquestração da adição

- [ ] 4.1 Criar o orquestrador de formato único com leitura inicial do vínculo, sanity check de operação/crédito/outcome/artefato e decisão de retomar, confirmar arte existente, preparar, expandir ou encerrar.
- [ ] 4.2 Implementar a abertura idempotente pela RPC dedicada, com revalidação de elegibilidade e checksum da fonte imediatamente antes da reserva, distinguindo fonte nova, legada e ponte divergente.
- [ ] 4.3 Implementar a preparação determinística 1024→1152 usando `prepareSquareForExpansion`/wrapper com `source.operationId = source_registration_operation_id` e `preparedOperationId = operationId` da adição, sem alterar a fonte e com idempotência comprovada.
- [ ] 4.4 Implementar a expansão usando `runExpansionStep`/`expandVerticalToNineSixteen` com seleção/economia congeladas, deadline, recheck, claim, tentativas, timeout e `signal` preservados.
- [ ] 4.5 Implementar a revalidação pré-chamada e a classificação do resultado da expansão (expandido, reutilizado, falha transitória, definitiva, desconhecida), sem duplicar provider.
- [ ] 4.6 Implementar a sequência artefato persistido → token de publicação → RPC de entrega → miniatura vertical best-effort, sem projeção de campanha.
- [ ] 4.7 Implementar a retomada que sonda o vertical e confirma artefato já persistido sem nova chamada paga.
- [ ] 4.8 Implementar a classificação de falha transitória, definitiva e desconhecida, com outcome durável e sem estorno automático em incerteza.
- [ ] 4.9 Implementar a finalização de falha definitiva: confirmar ausência, gravar `failed`, estornar uma única vez e marcar o vínculo `refunded`, preservando o quadrado.
- [ ] 4.10 Implementar o cancelamento/abort local sem cancelar, estornar ou criar nova operação; fechar modal ou perder conexão deve deixar o estado durável retomável.
- [ ] 4.11 Criar a composition root de produção com as portas reais e separar explicitamente adaptadores test-only dos caminhos de produção.
- [ ] 4.12 Adicionar testes de contrato/jornada offline com provider fake declarado, contadores de chamadas, replay, duas abas, reload, artefato existente, unknown e falha definitiva.
- [ ] 4.13 Adicionar cenários específicos de replay antigo após estorno, nova tentativa com novo token/`request_id`, saldo zero após a reserva, flag dedicada desligada durante operação aberta e fonte legada 1024 sem crédito original.
- [ ] 4.14 Integrar o gate de piloto quando `armed` (begin/end/markUnknown com estimativa congelada), bloquear quando `blocked` e não criar gate quando `inactive`, sem ampliar o teto existente.

## 5. Rotas da ação

- [ ] 5.1 Criar `GET /api/campaign/[id]/format-additions` read-only com ownership, UUID, classificação de estado, elegibilidade, custo, origem da fonte, incompatibilidade e token de confirmação opaco, verificável e de curta duração, vinculado a campanha/alvo/checksum/custo, sem reservar, gerar ou exigir saldo.
- [ ] 5.2 Criar `POST /api/campaign/[id]/format-additions` com CSRF, ownership, token de confirmação emitido pelo servidor, gates de `campaign_format_addition_enabled`/motor/autorização/legal/readiness/rate limit/saldo na abertura, sem exigir saldo na retomada de reserva existente.
- [ ] 5.3 Implementar o início/retomada idempotente pela rota por `request_id`, com novo token de confirmação somente após novo custo confirmado, retornando stream/estado no padrão existente.
- [ ] 5.4 Garantir que a rota nunca aceite operação, formato, path, URL, modelo, qualidade, prompt, economia, origem de fonte ou identidade de crédito vindos do cliente; o token só pode ser emitido pelo servidor.
- [ ] 5.5 Adicionar testes de rota para 401/403/404/409/422/429/500/503, duplo clique, duas abas, replay, replay antigo após estorno, flag desligada, saldo insuficiente, saldo zero após reserva, fonte alterada, legado 1024 e leitura indisponível.
- [ ] 5.6 Provar que o rollback da flag dedicada bloqueia apenas novas adições, mantendo consulta, retomada, finalização e download de operações abertas.

## 6. Detalhe, modal e seleção de formato

- [ ] 6.1 Estender as props do detalhe com o estado seguro da adição, elegibilidade, custo, processamento, entrega, erro e seleção de formato, sem expor paths/URLs internas.
- [ ] 6.2 Adicionar ao chip `9:16` do detalhe o comportamento de ação: confirmação para fonte elegível, explicação para incompatível, acompanhamento para operação em andamento e link para vertical entregue.
- [ ] 6.3 Implementar a modal de confirmação com custo de 1 crédito, cancelamento sem efeito, confirmação explícita e obtenção de novo token de confirmação após estorno.
- [ ] 6.4 Implementar a transição da modal para acompanhamento, com polling read-only, estados de processamento/unknown/falha, saída segura e retomada, inclusive com saldo disponível zero após a reserva.
- [ ] 6.5 Ao concluir, atualizar a mesma campanha, selecionar `?format=9:16`, exibir preview/download do vertical e manter `?format=1:1` acessível, sem retornar ao preenchimento.
- [ ] 6.6 Estender o polling existente do detalhe somente enquanto a adição estiver em processamento, sem iniciar geração e sem polling na listagem/dashboard.
- [ ] 6.7 Preservar aprovação pendente, regeneração, copy, recuperação existente, `?format=` inválido, falha fechada em leitura e bloqueio de nova confirmação quando a flag dedicada estiver desligada.
- [ ] 6.8 Adicionar testes de UI para confirmação → acompanhamento → detalhe vertical, incompatibilidade, fechar modal, reload, duas abas, saldo zero, replay antigo após estorno, flag desligada, legado 1024, unknown, falha definitiva e acessibilidade.

## 7. Listagem, dashboard, download e compatibilidade

- [ ] 7.1 Implementar a leitura em lote das adições por página, com vínculo, crédito e artefato, sem consulta por card.
- [ ] 7.2 Integrar a adição à apresentação da listagem mantendo um único card, chips informativos, miniatura quadrada preferida, contagem e ações existentes.
- [ ] 7.3 Integrar a adição ao dashboard mantendo uma única linha, sem modal/navegação por chip e sem consulta por card.
- [ ] 7.4 Estender a rota de download para `?format=` em campanha `1:1` com adição durável, servindo somente o artefato entregue e falhando fechado nos demais casos.
- [ ] 7.5 Excluir operações de adição da listagem/resolução de pendências legada, sem alterar o painel administrativo existente, e documentar como o suporte identifica uma operação presa por campanha/operação/artefato sem conceder crédito em duplicidade.
- [ ] 7.6 Adicionar testes de integração para detalhe/listagem/dashboard/download sem N+1, contagem preservada, miniatura, links, legado 1024 e falha fechada.
- [ ] 7.7 Adicionar regressões explícitas para os fluxos `1:1` individual, `9:16` individual, conjunto e legado, garantindo que a adição não altere a operação primária nem o snapshot original.

## 8. Provas, gates e handoff

- [ ] 8.1 Executar a suíte dirigida offline da adição e as regressões dos fluxos 1:1, 9:16, conjunto, apresentação, lista, dashboard e download.
- [ ] 8.2 Executar `typecheck`, `lint`, `build` e as suítes dirigidas/global sequencialmente, registrando comando, escopo, exit code e limitações preexistentes.
- [ ] 8.3 Preparar (sem executar) o pacote de autorização do gate de PostgreSQL/Storage, com alvo, guards, backup, ledger esperado, fixtures, cenários e critérios de parada.
- [ ] 8.4 Provar em banco real, quando autorizado: abertura atômica, unicidade parcial, concorrência entre duas sessões, reserva/consumo/estorno exatamente uma vez, saldo zero após reserva sem bloquear continuação, replay antigo após estorno sem nova cobrança, operação original intacta, legado sem crédito original, filtro da operação primária, rollback da flag dedicada e preservação de conteúdo.
- [ ] 8.5 Provar a recuperação de artefato já persistido e a confirmação sem nova chamada paga em ambiente real, distinguindo explicitamente fake de efeito financeiro.
- [ ] 8.6 Executar validação visual/funcional humana do detalhe, modal, chips, seleção, preview e download em pt-BR e es-419, incluindo legado 1024, saldo zero, estorno/replay e rollback, com viewports e evidências registradas.
- [ ] 8.7 Separar no relatório final: provas offline, banco real, Storage, provider pago, validação visual e gates de produção; nenhum teste fake SHALL ser apresentado como prova financeira.
- [ ] 8.8 Atualizar a documentação técnica, os códigos internos de erro, o procedimento de suporte e o handoff para o GSD, sem presumir número de fase, sem aplicar migration, sem acessar ambiente e sem publicar; registrar a declaração de produção do responsável separada da conferência técnica de versão/hash/ledger.
