## Context

A entrega individual 9:16 usa `product_9_16_two_stage_operations` + `product_1_1_campaign_credit_operations` com a mesma identidade `(campaign_id, operation_id)`: uma reserva de 1 crédito, etapas `base`/`expansion`, artefatos `square_original`, `square_prepared` e `vertical`, entrega confirmada somente no vertical e projeção de `campaigns.storage_path` para o vertical.

O fluxo 1:1 individual usa `product_1_1_campaign_artifacts` e projeta a arte 1024×1024. A seleção de formato é persistida em `campaigns.input_snapshot` (`campaignFormat` + `formatContractVersion`), e a origem do 9:16 em duas etapas é persistida por `generationOrigin` + `generationContractVersion`. A interface atual resolve um único formato por campanha; a listagem assina uma única miniatura derivada de `campaigns.storage_path`.

Restrições reais encontradas no código e schema:

- `product_1_1_campaign_credit_operations.amount` tem `CHECK (amount = 1)` e identidade única `(campaign_id, operation_id)`. Não é possível representar dois créditos em uma linha sem alterar a semântica financeira atual.
- `product_9_16_two_stage_operations` tem identidade `(campaign_id, operation_id)` e os controles de etapa/adquire/finish/resume leem a linha financeira pela MESMA `operation_id`. Reutilizar o controle exige que a operação conjunta continue tendo uma linha financeira com essa identidade.
- `campaign_composition_artifacts` já suporta `square_original` (1024×1024), `square_prepared` (1152×1152) e `vertical` (1080×1920), com imutabilidade e bucket interno. A base 1024 ainda não é entregável ao lojista.
- `campaigns.storage_path` é uma coluna única e `NOT NULL`, e `campaigns.status` só admite `generating | ready | error`. A projeção atual não expressa duas entregas.
- `listCampaigns`/dashboard filtram `status = ready` e assinam miniatura derivada de um único `storage_path`; a rota de download também resolve um único artefato.
- `resolveCampaignFormat` é fechado: ausência = 1:1; `9:16` + `f59-vertical-9-16-v1` = vertical; qualquer outro par = indisponível. `resolveCampaignGenerationOrigin` distingue `two_stage_9_16` de histórico/indeterminado.
- A seleção administrativa da expansão já é congelada por operação (`contract_version = 2`) e `product_9_16_open_operation_v2` já abre a operação e reserva o crédito vertical na mesma transação.
- O painel de pendências deriva evidência por origem. Se a entrega quadrada conjunta não for reconhecida, uma sonda legada poderia considerar a arte ausente e permitir estorno indevido.

A F60.6 foi publicada e o usuário relatou funcionamento em produção. Este design não repete essa verificação; o aceite de produção é registrado como relato do usuário.

## Goals / Non-Goals

**Goals:**

- Solicitar 1:1 + 9:16 em uma única campanha, com um briefing congelado, uma copy compartilhada e uma única geração de base quadrada.
- Entregar a própria base 1024×1024 como 1:1 e o vertical 1080×1920 como 9:16, cada um com identidade financeira própria e 1 crédito.
- Suportar entrega parcial, recuperação apenas do formato faltante e ausência de cobrança/estorno presumidos em indeterminação.
- Preservar byte a byte os fluxos 1:1 individual, 9:16 individual e campanhas históricas.
- Expor uma interface única por campanha, com indicadores e acesso individual por formato.
- Planejar a migration e os contratos de banco sem aplicá-los nesta rodada.

**Non-Goals:**

- Modal de confirmação para gerar formato ausente, custo explícito de conversão e qualquer conversão de campanha existente.
- Adicionar 9:16 a um 1:1 existente ou disponibilizar 1:1 de um 9:16 existente.
- Alterar preço, flags, `campaign_generation`, catálogo de modelos ou configuração administrativa.
- Alterar a semântica das RPCs financeiras, do controle de duas etapas, da preparação, da expansão, da copy ou dos artefatos existentes.
- Aprovação visual, comparação de modelos, chamadas pagas, homolog, produção, merge, push ou deploy.

## Decisions

### D0. Uma OpenSpec, três subfatias revisáveis

O objetivo funcional permanece um só, mas a execução será dividida em três janelas com revisão/aceite entre elas:

- **Subfatia A — Fundação financeira e entregas:** contratos de formato/origem, tabela de vínculo, RPCs de abertura/entrega/estorno/projeção, clientes server-only e contratos de leitura/acesso. Sem orquestração integrada e sem UI.
- **Subfatia B — Orquestração conjunta e proteção administrativa:** base única, entrega quadrada, entrega vertical dedicada, entrega parcial, continuação/recuperação e reconhecimento/bloqueio no caminho administrativo. Testes integrados offline pelos componentes reais, com fakes apenas nas fronteiras externas. Ainda sem disponibilidade ao lojista.
- **Subfatia C — Jornada e apresentação:** seletor, custo de 2 créditos, processamento, indicadores, cards, dashboard, detalhe, preview/download e miniaturas.

A opção conjunta só fica disponível ao lojista após a conclusão e o aceite da Subfatia C. A e B são entregas técnicas intermediárias, não funcionalidades publicáveis. A validação real da migration é um gate separado, posterior à B e anterior à liberação; testes estáticos/offline não substituem transações e concorrência no PostgreSQL.

**Por quê:** o trabalho novo relevante é entrega e cobrança, não a composição/expansão de imagem. Reduzir a janela de execução e revisão diminui o risco de aceitar uma costura financeira complexa sem revisão intermediária.

Criar um módulo dedicado (`src/lib/product-two-format/**`) que compõe os módulos existentes, em vez de ensinar o orquestrador 9:16 individual a produzir dois formatos.

**Por quê:** o fluxo individual tem invariantes de uma reserva, uma entrega e um formato; alterá-lo contaminaria os fluxos já publicados. A costura dedicada permite fail-closed por origem e mantém a possibilidade de evoluir a entrega conjunta sem tocar no histórico.

**Alternativas rejeitadas:** (a) alterar o orquestrador 9:16 para um modo dual — muda a semântica de uma operação existente; (b) criar duas campanhas — duplica card, briefing, copy e histórico; (c) alterar `amount` para 2 — impede estorno por formato e viola o contrato financeiro atual.

### D2. Contrato de formato conjunto explícito e versionado

Persistir em `campaigns.input_snapshot`:

- `campaignFormat: "1:1+9:16"`
- `formatContractVersion: "f60.7-two-format-v1"`
- `generationOrigin: "two_format_two_stage"`
- `generationContractVersion: "f60.7-two-format-v1"`
- `inputFiles`, `resumeContext` e demais chaves já usadas pelo caminho vertical.

O request do fluxo novo passa a aceitar `campaignFormat: "1:1" | "9:16" | "1:1+9:16"`. `1:1` continua sem chaves de formato no snapshot; `9:16` continua com os valores atuais.

**Por quê:** o formato e a origem precisam ser resolvidos por contrato persistido, nunca por `storage_path`, presença de arte ou inferência. Um valor conjunto explícito evita confundir a campanha conjunta com o fluxo vertical individual e permite fail-closed em pares incoerentes.

**Alternativas rejeitadas:** array `campaignFormats` (mais superfície e duas fontes de verdade), reutilizar `campaignFormat: "9:16"` (perderia a distinção da entrega 1:1) e inferir pelos artefatos (proibido pelo contrato atual).

### D3. Uma campanha, um briefing, uma copy e uma base

A operação conjunta usa um único `campaignId`, um único `operationId` de geração e um único estado congelado. A etapa `base` roda uma vez com esse `operationId`; a copy é gerada/reutilizada por operação e exibida uma única vez. A preparação 1152 e a expansão vertical reutilizam a base canônica.

**Por quê:** o produto exige conteúdo e copy compartilhados; gerar duas bases ou duas copies criaria divergência visual/textual e custo desnecessário.

### D4. A entrega 1:1 é o artefato `square_original` 1024×1024

O quadrado entregue é a própria base persistida em `campaign_composition_artifacts` com `role = square_original`, `format = 1:1`, 1024×1024, JPEG e checksum. `square_prepared` 1152×1152 permanece interno e nunca é entregue. Não há nova geração quadrada, nova cópia ou novo caminho de arte para a entrega 1:1.

**Por quê:** é a decisão de produto explícita. Também evita uma segunda chamada paga e mantém uma única arte canônica para as duas entregas.

**Consequência:** o acesso, download e miniatura do 1:1 conjunto precisam reconhecer o caminho de composição (`{storeId}/{campaignId}/{operationId}/square_original.jpg`), que hoje é interno. A elegibilidade de miniatura será estendida apenas para esse papel, sem fallback para o original.

### D5. Duas identidades financeiras por entrega, sem alterar o contrato `amount = 1`

- `operationId` da geração continua sendo a identidade de controle e a identidade financeira do **vertical** (1:1 com o fluxo de duas etapas atual).
- O **quadrado** ganha uma identidade financeira própria (`squareDeliveryId`), criada na abertura e persistida no vínculo de entrega.
- Cada linha em `product_1_1_campaign_credit_operations` continua com `amount = 1`.
- A entrega completa mantém duas reservas de 1 crédito, total 2.

**Por quê:** permite confirmar/estornar por formato, preserva a autoridade financeira existente, mantém o controle de etapas lendo a linha vertical pela `operation_id` atual e não exige relaxar o CHECK `amount = 1`.

**Alternativa rejeitada:** uma linha com `amount = 2` e dois estados internos. Isso alteraria a semântica da tabela, o CHECK, a reconciliação e todos os consumidores, além de impedir o estorno independente.

### D6. Vínculo explícito entrega ↔ formato ↔ operação financeira

Nova tabela forward-only `product_two_format_deliveries` (nome de trabalho), com:

- `campaign_id`, `operation_id` (operação conjunta/controle), `store_id`;
- `format` (`1:1` | `9:16`);
- `delivery_operation_id` (identidade financeira da entrega; única);
- `artifact_role` (`square_original` | `vertical`);
- `created_at`;
- única `(campaign_id, operation_id, format)`;
- FK composta para `product_9_16_two_stage_operations(campaign_id, operation_id)`;
- RLS/grants apenas leitura para `service_role`; escrita exclusiva por RPC.

Relação resultante:

```
campanha 1─N requisição conjunta (operation_id)
requisição conjunta 1─N entrega de formato (2 linhas: 1:1, 9:16)
entrega de formato 1─1 operação financeira (1 crédito)
requisição conjunta 1─N tentativas/etapas (base, expansion)
artefatos quadrado/vertical pertencem à requisição conjunta
```

**Por quê:** a coluna única `campaigns.storage_path` não representa duas entregas; o vínculo explícito permite leitura, projeção, pendências e recuperação sem inferir formato pelo caminho ou pela presença de artefato.

### D7. Abertura atômica com duas reservas e uma única operação de controle

Nova RPC `product_two_format_open_delivery` (nome de trabalho), executada em uma transação:

1. valida vínculo campanha↔loja e contrato conjunto persistido;
2. chama `product_9_16_open_operation_v2` com a seleção congelada — cria a operação de controle, os dois steps e reserva o crédito vertical;
3. insere o vínculo do vertical (`delivery_operation_id = operation_id`);
4. insere o vínculo do quadrado com um novo `delivery_operation_id`;
5. chama `product_1_1_reserve_credit_operation` para o quadrado na mesma transação;
6. devolve os dois IDs, a seleção congelada, o status e os steps.

Reenvios equivalentes reutilizam os vínculos e as duas reservas, comparando a seleção recebida com modelo/qualidade/`configVersionId`/origem CONGELADOS na operação; seleção divergente retorna `operation_config_conflict` sem escrita/reserva e o replay não lê catálogo/configuração vigente. Esta fatia admite **uma única operação conjunta por campanha**: antes de qualquer reserva, uma segunda operação (ou mistura de operações) já vinculada à campanha é recusada com `operation_origin_conflict`. Operação de origem não conjunta retorna conflito de origem. Qualquer falha na segunda reserva aborta também a abertura vertical, sem estado parcial.

**Por quê:** cumpre “2 créditos” sem duas transações independentes e sem cobrança parcial silenciosa. Reutiliza a abertura v2 e a reserva existentes, sem modificar suas semânticas.

**Pré-condições fora do banco:** o orquestrador faz o preflight read-only de configuração/modelo/pricing antes da abertura e o formulário/rota verifica saldo para 2 créditos. A RPC continua sendo a autoridade final; saldo insuficiente aborta tudo.

### D8. Confirmação do quadrado imediatamente após a base

A etapa `base` já persiste a arte canônica `square_original`. Depois que ela termina e a arte é comprovadamente íntegra (bytes, dimensão, MIME, checksum e papel), a sequência é inequívoca:

1. **artefato canônico persistido e verificado** — nenhuma nova geração, cópia ou upload é feita nesta etapa;
2. **aquisição do token de publicação** via `beginPublication` na identidade financeira do quadrado, protegendo a publicação financeira do artefato existente;
3. **RPC de confirmação + projeção** na mesma transação, usando o artefato já persistido; `mark_art_uploaded` é uma transição de estado financeiro, não um novo upload;
4. geração da miniatura quadrada de forma best-effort;
5. somente então executa preparação, expansão e entrega vertical.

**Por quê:** a entrega parcial exige que uma falha posterior na expansão não invalide o quadrado. O token de publicação não deve exigir reenvio da imagem já persistida; ele protege apenas a confirmação financeira/publicação daquele artefato. Reenviar ou duplicar a imagem criaria custo, cópia desnecessária e risco de divergência entre o artefato e a entrega.

**Consequência:** se a confirmação do quadrado ficar indeterminada, o vertical não começa e não há estorno; a recuperação tenta apenas liquidar o quadrado existente, sem nova chamada paga e sem novo upload. O mesmo padrão se aplica ao vertical: arte persistida/verificada → token → RPC de confirmação + projeção.

### D9. Entrega vertical dedicada com confirmação + projeção atômicas

A entrega vertical da operação conjunta **não reutiliza `deliverVertical` como confirmador financeiro**. `deliverVertical` e `confirmOnVerticalDelivery` permanecem intocados para o 9:16 individual. O caminho conjunto cria `deliverTwoFormatVertical`, que reutiliza:

- `control.resume` e as mesmas decisões de etapa/entrega;
- a sonda `CompositionVerticalProbe` para evidência;
- `beginPublication(operationId)` para adquirir o fence/token **depois** de o artefato canônico já estar persistido e verificado, sem novo upload;
- a nova RPC `product_two_format_deliver_format` para `mark_art_uploaded` + `deliver` + projeção na mesma transação, usando o artefato já persistido;
- a miniatura vertical existente.

O quadrado segue o mesmo padrão com sua identidade financeira própria e a sonda `square_original`.

**Por quê:** o fluxo individual confirma e projeta em chamadas separadas. Apenas trocar a dependência de projeção não cria atomicidade. A costura conjunta precisa chamar a RPC que concentra confirmação e projeção, preservando token de publicação, verificação de evidência e idempotência. O comportamento individual continua byte-compatível.

### D10. Projeção da campanha é derivada, idempotente e não é a autoridade

A projeção conjunta adquire primeiro o lock comum da campanha (`campaigns ... FOR UPDATE`), depois exige **dois vínculos coerentes da mesma operação** (1:1 e 9:16) — sem seleção arbitrária por `LIMIT 1` e falhando fechado em mistura/incompletude — e só então lê as linhas financeiras/artefatos e atualiza `campaigns`. Entrega, estorno e reparo direto seguem a mesma ordem: campanha → vínculo/crédito → leitura/projeção. A projeção:

- se o quadrado estiver `delivered` e o artefato `square_original` for compatível ⇒ `status = ready`, `storage_path = square_original.jpg`;
- senão, se o vertical estiver `delivered` e o artefato `vertical` for compatível ⇒ `status = ready`, `storage_path = vertical.jpg`;
- se nenhum formato estiver entregue e todos os formatos estiverem terminais com estorno ⇒ `status = error` com mensagem segura, **somente** se a campanha não estiver `ready`;
- se houver formato reservado/em processamento e nenhum entregue ⇒ mantém `generating`;
- nunca rebaixa uma campanha `ready` por evento tardio de estorno.

A autoridade para a UI é o vínculo + crédito + artefato. `campaigns.storage_path` é apenas a projeção de compatibilidade (preferência quadrada). `render_snapshot`, `generation_metadata` e `publication_copy_snapshot` não são reinterpretados para a campanha conjunta: a copy continua por operação e as dimensões/formato vêm dos artefatos. Nenhum novo formato é gravado nesses campos legados.

**Por quê:** mantém listagem/download legados funcionando, mas permite que a leitura conjunta mostre os dois formatos e sobreviva a uma projeção atrasada.

**Alternativa rejeitada:** guardar dois caminhos em `campaigns` (colunas novas) — ainda seria um único status e não representaria estados parciais nem identidades financeiras.

### D11. Entrega e estorno por formato são atômicos com a projeção

Novas RPCs (nomes de trabalho):

- `product_two_format_deliver_format`: valida o vínculo, o artefato persistido e a identidade; executa `mark_art_uploaded` + `deliver` para o `delivery_operation_id` e re-projeta a campanha na mesma transação;
- `product_two_format_refund_format`: executa o encerramento por falha comprovada do `delivery_operation_id` e re-projeta na mesma transação;
- `product_two_format_project_campaign`: reparo idempotente da projeção, sem efeito financeiro.

**Por quê:** fecha a janela entre confirmação financeira e projeção. Se a projeção falhar, a transação inteira não confirma a entrega; o retry reexecuta sem dupla cobrança. As RPCs existentes continuam intocadas. Entrega/estorno e o reparo direto adquirirem o lock da campanha ANTES dos locks de vínculo/crédito garante que duas projeções concorrentes não calculem estados diferentes nem permitam que uma gravação atrasada substitua a preferência quadrada. O estorno também trava a MESMA linha financeira da operação conjunta que `product_9_16_acquire_step` trava (`product_1_1_campaign_credit_operations` com `operation_id = p_operation_id`) antes de verificar claims/finalidade. A base compartilhada executa sob a identidade da operação, não sob a identidade financeira do quadrado; o crédito do quadrado sozinho não serializa contra aquisição. Para estornar, além da ausência/epoch/finalidade da autoridade financeira do formato, exige-se finalidade durável da operação compartilhada — crédito compartilhado `refunded` ou desfecho `failed` em `product_9_16_two_stage_outcomes` — que impeça nova aquisição após o commit. A disputa aquisição×estorno fica registrada para prova no Gate de banco.

**Regra de chamada:** no caminho conjunto, a ordem é sempre **artefato canônico persistido e verificado → aquisição do token de publicação → RPC de confirmação + projeção**. O app NÃO chama `markArtUploaded`/`deliver` separadamente e NÃO reenvia nem duplica a imagem já persistida. `beginPublication` protege a publicação financeira do artefato existente; `mark_art_uploaded` é transição de estado, não upload. `mark_art_uploaded` + `deliver` + projeção são uma única transação na RPC de entrega por formato. O mesmo vale para o estorno por formato.

**Desfecho durável do quadrado antes do estorno:** a autoridade de fechamento exige um desfecho `failed` para a MESMA identidade financeira. O contrato já prevê que o orquestrador grave esse desfecho pela RPC existente `product_1_1_record_generation_outcome` antes de solicitar o estorno do quadrado; a view de outcomes o encontra porque o `squareDeliveryId` não possui operação de duas etapas. B implementa esse handoff, não cria migration. `unknown` persistido é imutável e bloqueia o estorno. Se o desfecho for gravado e o estorno falhar, o retry é idempotente; se um dos dois estornos da falha de base falhar, o resultado é parcial e retomável. O app não promete detectar antecipadamente toda corrida: a autoridade SQL revalida sob trava e, se uma entrega vencer, `delivered_not_refundable` prevalece sem segundo efeito.

### D12. Semântica de falha e estorno parcial

| Situação | Quadrado | Vertical | Efeito |
|---|---|---|---|
| Base falha definitivamente sem artefato | ausente | não iniciado | estorna quadrado e vertical; campanha `error` |
| Base tem resultado desconhecido | indeterminado | não iniciado | nenhum estorno; operação `unknown`; resolução administrativa |
| Quadrado íntegro, mas confirmação falha | artefato presente | não iniciado | nenhum estorno; recuperação liquida o quadrado existente |
| Preparação falha definitivamente | entregue | ausente | estorna somente vertical; quadrado permanece `ready` |
| Expansão falha definitivamente sem vertical | entregue | ausente | estorna somente vertical; quadrado permanece `ready` |
| Expansão tem resultado desconhecido | entregue | indeterminado | nenhum estorno; quadrado permanece; vertical `unknown` |
| Vertical íntegro, mas confirmação falha | entregue | artefato presente | nenhum estorno; recuperação entrega o vertical existente |
| Ambos entregues | entregue | entregue | replay apenas repara projeção/miniatura |
| Vertical já estornado | entregue | ausente | não reabre; sem nova cobrança; informa crédito devolvido |

**Janelas de falha:** entre o desfecho `failed` e o estorno, e entre os dois estornos da falha de base, o estado permanece seguro e retomável; a ordem da base é vertical→quadrado, e uma falha parcial não projeta `error`. A revalidação SQL decide a corrida com entrega (`delivered_not_refundable`); não há promessa de detecção antecipada.

**Por quê:** “devolver somente o crédito do formato comprovadamente não entregue” e “indeterminado não autoriza estorno presumido”. A prova de ausência/integridade vem de sonda server-side, nunca do cliente.

### D13. Recuperação somente do formato faltante

A leitura de continuação classifica cada formato pelo crédito + artefato:

- **entregue**: não chama provider, não reserva, não confirma de novo; apenas repara projeção/miniatura;
- **reservado**: é continuação da reserva existente; pode executar somente as etapas necessárias ao formato faltante;
- **estornado**: terminal; não é reaberto automaticamente nesta fatia;
- **indeterminado**: não há retry automático nem estorno; resolução administrativa.

Regras específicas:

- quadrado entregue + vertical reservado ⇒ nenhuma etapa de base/copy/quadrado; somente preparação/expansão/entrega vertical;
- quadrado entregue + vertical estornado ⇒ resultado parcial terminal, sem geração;
- quadrado reservado + artefato íntegro ⇒ liquidar apenas o quadrado, sem provider;
- quadrado reservado + artefato ausente + vertical não entregue ⇒ base compartilhada pode ser executada, pois nenhum formato entregue seria regenerado;
- vertical entregue + quadrado reservado/ausente ⇒ liquidar o quadrado a partir da base existente; se a base não existir, falhar fechado (não gerar por presunção).

**Por quê:** cumpre a recuperação por formato e evita “geração silenciosa” após estorno.

### D14. Modelo de leitura por formato

Novo módulo server-only `TwoFormatDeliveryView` (nome de trabalho) resolve, por campanha:

- `origin = two_format` e `operationId`;
- para cada formato: `delivered | processing | absent | unknown | unavailable`;
- caminho do artefato quando entregue, crédito devolvido quando confirmado, referência de suporte quando desconhecido;
- miniatura preferida (quadrado se entregue; senão vertical);
- estados derivados de crédito + vínculo + linha de artefato; a sonda de bytes é usada apenas no detalhe/preview/download, não na listagem.

**Por quê:** a UI não pode inferir estado por `storage_path` nem por presença de imagem, e a listagem não deve fazer sondas pesadas de Storage.

### D15. Interface: um card, indicadores e acesso individual

- **Formulário:** dois checkboxes nativos — **Quadrado 1:1** e **Vertical 9:16** — mapeando 1:1 / 9:16 / 1:1+9:16; pelo menos um formato marcado; flag vertical OFF desabilita o vertical sem conversão silenciosa e oferece a ação explícita “Usar somente Quadrado” para draft pausado. Texto de custo explícito “2 créditos” no conjunto; 1:1 continua default.
- **Processamento:** título **“Geração da campanha”**, sem o subtítulo de preenchimento. Mostra os dois checkboxes como resumo não editável, com os estados escolhidos preservados e sem helpers de áreas seguras/créditos/indisponibilidade de seleção. Usa uma única mensagem principal por situação: **“A geração está em processamento. Aguarde.”** no processamento normal; **“Quase pronto!”** na finalização automática; **“Clique em ‘Continuar geração’ para concluir.”** e botão **“Continuar geração”** somente quando a ação manual for necessária e permitida; **“Não foi possível atualizar o andamento.”** e botão **“Verificar novamente”** (consulta read-only) quando a atualização falhar. Não exibe “Retomar quando autorizado” nem ações redundantes durante o percurso automático. Rótulos de etapa em linguagem de usuário, sem “Projeção” na interface; identificadores/eventos técnicos permanecem inalterados.
- **Revisão:** a linha **“Formato”** apresenta **“Quadrado 1:1 (Feed)”**, **“Vertical 9:16 (Stories/Reels)”** ou **“Quadrado 1:1 (Feed) + Vertical 9:16 (Stories/Reels)”**, sem dimensões em pixels. Dimensões reais, schemas, eventos, artefatos e contratos técnicos permanecem inalterados.
- **Transição para a campanha pronta:** ao concluir, entregar parcialmente ou estornar com navegação ao detalhe, a tela permanece em **“Abrindo sua campanha...”** com título **“Geração da campanha”** e resumo read-only, sem reexibir formulário/revisão. A navegação ocorre uma única vez; `router.push()` não é aguardado como promessa de conclusão. Se a navegação não concluir, oferecer **“Abrir campanha”** para a campanha existente, sem nova geração, continuação, reserva ou cobrança. A classificação delivered/partial/refunded é preservada e não é apresentada como sucesso completo.
- **Listagem/dashboard:** um card por campanha. Campanha conjunta mostra chips 1:1 e 9:16 com estado. Entregue é clicável e abre `/campanhas/[id]?format=...`; processando indica o estado sem ação; ausente informa a ausência sem ação. Rótulo de campanha parcial quando um formato está entregue e o outro não.
- **Detalhe:** seletor/tabs 1:1 e 9:16, pré-selecionado por `?format=`. Formato entregue mostra preview e download próprios; processando mostra estado; ausente mostra aviso e, quando confirmado, “crédito devolvido”. Copy compartilhada aparece uma única vez, fora dos tabs.
- **Miniaturas:** sempre derivadas; quadrado preferido quando entregue; vertical quando for o único entregue; placeholder quando a miniatura não existir. Nunca usar o original como fallback.
- **Download:** `GET /api/campaign/[id]/download?format=1:1|9:16` para campanha conjunta; sem `format`, usa o formato preferido. Fluxos individuais e legados ignoram o parâmetro e mantêm o comportamento atual.
- **Fora desta fatia:** nenhum botão, modal ou link que inicie geração do formato ausente.

### D16. Administração e pendências por formato

O painel de pendências passa a reconhecer o vínculo conjunto:

- entrega quadrada usa sonda de composição `square_original` (1024×1024), nunca a sonda 1:1 legada;
- entrega vertical usa a sonda vertical existente;
- resolução “entregar” exige artefato íntegro do formato e usa a projeção conjunta;
- resolução “estornar” exige ausência comprovada daquele formato e nunca presume estorno pela ausência de confirmação;
- o item exibe o formato e a campanha conjunta de forma explícita;
- operação com etapa ativa continua bloqueada.

**Por quê:** sem essa classificação, uma entrega quadrada íntegra poderia ser tratada como “ausente” pela sonda legada e estornada indevidamente. Por isso, a classificação por formato e o bloqueio de resolução incompatível pertencem à **Subfatia B** e são gate de segurança antes de qualquer operação conjunta real; não são acabamento de painel da Subfatia C.

### D17. Preservação dos fluxos atuais

- Na Subfatia A, o contrato conjunto é exposto por um módulo dedicado que delega aos resolvedores existentes; `resolveCampaignFormat` e `resolveCampaignGenerationOrigin` permanecem intocados nesta subfatia para não forçar alterações em consumidores de B/C. A extensão do resolvedor compartilhado e a auditoria de todos os consumidores pertencem à Subfatia C, quando as superfícies forem tocadas. Até lá, campanha conjunta é `unavailable`/não resolvida para os consumidores existentes — nunca tratada como 1:1.
- A extensão do `NewFlowGenerateImageRequestSchema` e os tipos de restauração/formulário/review também pertencem à Subfatia C; A entrega apenas o contrato estrito em módulo dedicado, não conectado a rota.
- Nenhuma mudança em `product_1_1_campaign_credit_operations`, nas RPCs `product_1_1_*`, em `product_9_16_open_operation_v2`, nos steps/controles, na preparação/expansão/copy ou nas regras de artefato.
- Nenhuma mudança em `campaigns` além da projeção já existente (`status`, `error_message`, `storage_path`).
- Campanhas 1:1, 9:16 individuais e históricas continuam usando seus caminhos atuais. O novo `campaignFormat` é rejeitado fora do fluxo novo.

### D18. Escopo da migration (autorada na implementação, não aplicada agora)

Uma migration forward-only, com timestamp UTC real e checagem de unicidade antes da criação, contendo:

1. tabela `product_two_format_deliveries`, índices, RLS e grants somente leitura para `service_role`;
2. RPC `product_two_format_open_delivery` (abertura conjunta atômica);
3. RPC `product_two_format_deliver_format` (confirmação + projeção por formato);
4. RPC `product_two_format_refund_format` (estorno + projeção por formato);
5. RPC `product_two_format_project_campaign` (reparo idempotente);
6. eventuais views/índices de leitura para a listagem/pendências.

Não alterar: `amount = 1`, CHECKs de auditoria existentes, `product_9_16_two_stage_operations` (além de referenciá-la), tabelas de artefatos, `campaigns` (colunas), flags, pricing ou migrations já aplicadas. Sem backfill e sem conversão de dados.

**Rollback operacional:** desligar a opção conjunta no dispatch/código (sem alterar flags existentes), preservar tabela/vínculos/reservas/artefatos e manter os fluxos individuais. Remoção de schema é decisão destrutiva separada.

### D19. Estratégia de testes offline

Os testes integrados da Subfatia B exercitam os componentes reais de orquestração, entrega, projeção e administração; fakes ficam restritos às fronteiras externas (banco/RPC e provider). Eles não comprovam transações/concorrência no PostgreSQL; isso pertence ao Gate de banco.

- Contrato de formato/origem: dual reconhecido; 1:1 e 9:16 individuais byte-compatíveis; pares malformados falham fechados.
- Abertura: 2 reservas atômicas, idempotência, conflito de seleção, saldo insuficiente sem estado parcial, concorrência.
- Base única: uma chamada de imagem; quadrado entregue antes da expansão; copy gerada uma vez e reutilizada.
- Entrega parcial: falha definitiva da expansão estorna só o vertical; quadrado permanece.
- Indeterminação: nenhum estorno, nenhuma nova tentativa, operação recuperável/administrável.
- Recuperação: quadrado entregue/vertical reservado não chama base nem provider do quadrado; vertical estornado não reabre; projeção atrasada é reparada.
- Replay/concorrência: confirmação/estorno repetidos não duplicam efeito; resposta tardia não regride etapa; projeção concorrente mantém o quadrado preferido.
- Interface/read model: chips, clique no formato entregue, preview/download por formato, cópia compartilhada, miniatura quadrada preferida, ausência sem ação, reload.
- Preservação: suítes de 1:1, 9:16 individual, histórico, copy, artefatos, miniatura, download e pendências.
- Gates: TypeScript, lint, build, `git diff --check`, OpenSpec strict. Nesta etapa offline: sem provider, banco, homolog, migration aplicada ou chamada paga. A validação real de transações/concorrência é o Gate de banco separado.

## Risks / Trade-offs

- **[Duas identidades financeiras em uma campanha]** → O vínculo explícito e as RPCs por formato impedem confundir as entregas; testes de concorrência e replay cobrem a separação.
- **[`campaigns.storage_path` única]** → A projeção prefere o quadrado e a UI lê o modelo conjunto; `storage_path` é compatibilidade, não autoridade. Risco residual: consumidores externos antigos veem apenas o formato preferido.
- **[Campanha parcial pode aparecer como `ready`]** → Rótulo “Parcial” e chips por formato na UI; o banco mantém `ready` porque há entrega utilizável.
- **[Projeção atrasada/lista oculta]** → RPC de projeção idempotente, reparo em continuação/detalhe e testes de falha entre confirmação e projeção. A listagem usa o modelo conjunto para campanhas conjuntas.
- **[Pendência quadrada mal classificada]** → Sonda de composição específica e proibição de resolução pelo caminho legado para entregas conjuntas; testes de evidência presentes/ausentes/indeterminadas.
- **[Miniatura do quadrado interno]** → Estender a elegibilidade apenas para `square_original`; continuar sem fallback para o original.
- **[Saldo de 2 créditos]** → Pré-checagem de UI/rota e abertura atômica; saldo insuficiente não cria operação, reserva ou chamada.
- **[Complexidade de uma fatia grande]** → Divisão obrigatória em três subfatias revisáveis (A fundação, B orquestração + proteção administrativa, C jornada), com gate de banco separado e aceite entre elas. Nenhuma opção conjunta visível antes de C.
- **[Conversão futura]** → O contrato conjunto é separado do individual e não implementa conversão; a evolução futura terá modal/custo explícitos e nova decisão.

## Migration Plan

1. **Subfatia A:** implementar contratos puros e testes de formato/origem; autorar a migration forward-only com timestamp UTC real e checar unicidade do prefixo na worktree, branch de destino e branches paralelas conhecidas; implementar as RPCs/clientes e os contratos de leitura/acesso com testes estáticos/offline. Nenhuma aplicação de migration. **Gate A:** revisão/aceite.
2. **Subfatia B:** implementar orquestração, base única, entrega quadrada, entrega vertical dedicada, entrega parcial, recuperação e proteção administrativa; testes integrados offline pelos componentes reais, com fakes apenas nas fronteiras de banco/provider. Nenhuma disponibilidade ao lojista. **Gate B:** revisão/aceite.
3. **Gate de banco:** mediante autorização separada, aplicar a migration no homolog existente e validar transações, idempotência, concorrência, RLS/grants e rollback operacional. Incluir explicitamente a disputa **aquisição da base × estorno do quadrado** sob a mesma linha financeira da operação: provar que o estorno não prossegue depois de uma aquisição vencedora e que nova aquisição não prossegue após a finalidade `failed`/`refunded` da operação. Testes estáticos não comprovam essas propriedades. Sem geração paga, provider, novo ambiente ou produção.
4. **Subfatia C:** implementar seletor, custo, processamento, indicadores, cards, dashboard, detalhe, preview/download e miniaturas. **Gate C:** revisão/aceite; somente então a opção conjunta fica disponível ao lojista.
5. Rodar os gates finais e a validação OpenSpec strict; aplicação em produção, geração real e ativação continuam gates separados, mediante autorização explícita.

Rollback operacional: manter schema/dados, desabilitar o dispatch da entrega conjunta e preservar os fluxos individuais; nenhuma remoção destrutiva automática.

## Open Questions

Nenhuma decisão de produto bloqueante. Nomes finais de tabela/RPC/módulo e a forma exata do seletor de formato no detalhe podem ser ajustados no `/gsd-plan-phase 60.7` sem alterar os contratos acima.
