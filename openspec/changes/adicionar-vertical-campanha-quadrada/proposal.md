## Why

Hoje uma campanha entregue em `1:1` não oferece caminho para receber o `9:16` sem criar outra campanha, repetir briefing/copy e pagar uma nova geração completa. O lojista precisa publicar no feed e nos Stories/Reels a partir da mesma campanha; a ausência desse caminho força duplicação de conteúdo e quebra a expectativa de continuidade da peça já aprovada.

Esta change propõe a adição posterior do vertical **na mesma campanha**, com operação própria de 1 crédito, preservando o quadrado, os textos originais, o histórico e a referência principal da campanha.

## What Changes

- Adicionar uma ação **“Adicionar vertical 9:16”** exclusiva do detalhe de uma campanha `1:1` já entregue, com custo de **1 crédito** informado e confirmação explícita antes de iniciar.
- Determinar elegibilidade pela **compatibilidade da fonte entregue**, não pela idade da campanha: fonte quadrada JPEG 1024×1024, com acesso, vínculo campanha/loja, origem canônica e integridade verificados pelo servidor. As origens suportadas são `new_flow_1_1` e `legacy_campaign`; no legado, a validação opt-in aceita 1024×1024 no path histórico canônico e **não exige nem inventa operação financeira original**. Imagens 1080×1080 ou de outras dimensões ficam bloqueadas; não haverá conversão, adaptação nem backfill.
- Registrar uma **operação própria e durável** de formato adicional, com fonte registrada de forma estável (operação `1:1` primária entregue no fluxo novo; identidade sintética sem crédito no legado) e vínculo à campanha e ao artefato-fonte. A operação primária, quando existir, não será reaberta, cobrada novamente, estornada ou alterada.
- Congelar, na abertura da nova operação, a configuração de expansão e os parâmetros econômicos usados por ela. Retomadas usam os valores congelados e não releem a configuração vigente.
- Criar uma **ponte de proveniência** que registra a fonte quadrada entregue como `square_original` interno, uma única vez por fonte/campanha, sem gerar outra imagem e sem alterar o artefato original. A preparação determinística 1024→1152 e o motor de expansão existentes são reutilizados.
- Reutilizar os controles de etapa, tentativa, prazo, concorrência, resultado desconhecido e recuperação do fluxo `9_16_two_stage`, sem chamar o orquestrador conjunto que reserva dois formatos.
- Entregar o vertical sem substituir a referência principal do quadrado: `campaigns.storage_path`, status da campanha e artefato quadrado permanecem intactos; a entrega adicional é lida por vínculo durável.
- Separar **abertura** de **continuação**: saldo ≥ 1 é exigido apenas para nova adição; depois da reserva, a continuação valida a reserva da própria operação, sem exigir outro crédito. Consulta, reconciliação, recuperação e download não dependem de saldo disponível.
- Impedir replay antigo após estorno: repetir o token/`request_id` original retorna o estado terminal, sem nova cobrança; nova tentativa exige novo token de confirmação emitido pelo servidor, novo `request_id` e nova confirmação de custo.
- Adicionar um **kill switch dedicado** (`campaign_format_addition_enabled`, fallback desligado) que bloqueia somente novas adições. Operações abertas continuam consultáveis, retomáveis e finalizáveis; o vertical individual, o conjunto e o `1:1` não são desligados no rollback.
- Atualizar detalhe, seleção `?format=`, preview, download, listagem e dashboard para reconhecer os dois formatos da mesma campanha, preservando miniatura, contagem, abrir/baixar, polling e recuperação existentes. A listagem/dashboard continuam informativos e sem ação de geração; a leitura em lote evita N+1.
- Tratar falhas de forma conservadora: falha definitiva devolve somente o crédito da adição, de forma idempotente; resultado incerto é consultado/reconciliado antes de nova geração ou estorno; artefato já persistido pode ser confirmado sem nova chamada paga.
- **Fora do escopo:** adicionar quadrado a campanha vertical; adaptar 1080×1080; gerar outro quadrado; alterar copy; editar campanha; painel administrativo novo; pricing global; backfill; eventos históricos; refatoração ampla dos fluxos 1:1, 9:16 individual ou conjunto. O procedimento de suporte é documentado, não vira painel.

## Capabilities

### New Capabilities

- `campaign-format-addition`: elegibilidade por compatibilidade da fonte (fluxo novo e legado 1024), operação própria de 1 crédito, vínculo durável, ponte de proveniência estável, configuração/economia congeladas, reutilização do motor de expansão, entrega sem substituir o quadrado, saldo/replay/rollback, falha/indeterminação/recuperação e leitura segura da adição.

### Modified Capabilities

- `campaign-format-presentation`: a campanha individual passa a representar um formato adicional entregue posteriormente, distinguindo `not_requested` de `not_delivered`, sem classificá-la como entrega conjunta ou parcial.
- `campaign-page-ui`: o detalhe individual `1:1` ganha a ação de adicionar vertical, confirmação com custo, acompanhamento em modal, estados de incompatibilidade/processamento/desconhecido e seleção `?format=` para os dois formatos.
- `campaign-list-ui`: o card individual passa a refletir o vertical entregue posteriormente, mantendo os chips informativos, sem modal, geração ou navegação por chip.
- `dashboard-operational-composition`: a campanha com adição posterior continua aparecendo uma única vez e passa a refletir os formatos entregues, com leitura em lote e sem consulta por card.
- `campaign-download-route`: a rota passa a aceitar `?format=` para campanha `1:1` com adição durável, servindo somente o artefato entregue e mantendo o comportamento anterior para campanhas sem adição.
- `campaign-composition-artifacts`: novo registro de fonte entregue (`delivered_campaign_reuse`) para uso como `square_original` interno, byte-idêntico, estável por fonte, sem transformação nem geração; aceita o modo opt-in de legado 1024 sem operação financeira original.
- `product-1-1-campaign-credit-billing`: a operação de formato adicional é uma identidade financeira não primária; a leitura histórica “operação mais recente da campanha” deixa de ser alterada por ela.
- `product-9-16-two-stage-orchestration`: a regra de “um único formato por solicitação” ganha a exceção explícita da adição posterior a uma campanha `1:1` entregue, sem permitir a aquisição de outros formatos fora desse contrato.
- `product-9-16-two-stage-operation-control`: a operação de adição pode marcar a etapa base como reutilizada a partir de uma fonte entregue validada, sem geração de base, preservando os controles de expansão.
- `feature-flag-control`: a chave dedicada `campaign_format_addition_enabled` é registrada na infraestrutura existente, com default desligado, leitura fail-closed, auditoria da alteração e efeito restrito a novas adições.

## Impact

- **Domínio/UI:** novo módulo de adição de formato, extensão do modelo puro de apresentação, ação e modal no detalhe, polling read-only, seleção `?format=`, preview e download por formato.
- **Leitura em lote:** listagem e dashboard passam a combinar a leitura individual existente com uma leitura em lote da adição; nenhuma consulta por card.
- **Banco (planejado, não criado nem aplicado nesta etapa):** tabela de vínculo durável da adição com origem de fonte e identidades separadas, índices de unicidade para operação ativa/entregue e `request_id`, RPCs de abertura/entrega/estorno, redefinição da leitura da operação primária da campanha, ampliação do CHECK de origem de artefatos de composição e chave da flag dedicada. Sem backfill e sem alteração das operações históricas.
- **Financeiro:** uma reserva de 1 crédito por adição, consumo somente na entrega vertical confirmada, estorno somente após falha definitiva comprovada; operação original intocada, quando existir. Saldo é gate apenas da abertura; continuação usa a reserva da própria operação. Replay antigo após estorno não abre nova cobrança.
- **Orquestração:** reutilização de `resolveReusableSquareSource`, `persistCompositionArtifact`, `prepareSquareForExpansion`, `expandVerticalToNineSixteen`, controles `9_16_two_stage`, sondas, fence de publicação, miniatura e resolução de pendências, com um orquestrador dedicado de formato único e registro estável da fonte.
- **Rollback:** flag dedicada `campaign_format_addition_enabled` bloqueia apenas novas adições; operações abertas e os demais fluxos permanecem.
- **Observabilidade/erros:** códigos internos fechados para incompatibilidade, leitura indisponível, operação em andamento, entrega já existente, resultado incerto e falha definitiva; linguagem ao lojista sem termos técnicos.
- **Tracking:** a change não presume número de fase GSD, não implementa, não acessa ambientes, não aplica migrations e não faz merge, push, deploy, sync ou archive. A declaração de produção da F60.7 feita pelo responsável é registrada no design, separada da futura conferência técnica de versão/hash/ledger.
