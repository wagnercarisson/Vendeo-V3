## Context

### Estado verificado do repositório

- Branch atual: `feat/campaign-add-vertical`, HEAD `241815fa`; worktree sem alterações preexistentes no início desta proposta. Nenhuma change OpenSpec ativa antes desta.
- O fluxo individual `1:1` grava `product_1_1_campaign_artifacts` e o objeto `campaign-images/<store>/<campaign>/product-1-1/<operation>/art-1024.jpg`; a referência principal da campanha é `campaigns.storage_path` (`src/lib/product-1-1/artifact/artifact-store.ts`, `src/lib/product-1-1/artifact/artifact-path.ts`).
- `resolveReusableSquareSource` já valida uma campanha entregue por acesso, vínculo loja/campanha, `status = ready`, formato `1:1`, path canônico, download, JPEG e dimensão exata (1024×1024 no fluxo novo; 1080×1080 no legado) e recalcula tamanho/checksum (`src/lib/campaign/composition-artifacts/resolve-source.ts`, `source-validation.ts`). Ele não tem consumidor de produção hoje. A adição estende esse caminho com um modo opt-in que aceita 1024×1024 também para a origem `legacy_campaign`, sem alterar o default histórico dos demais consumidores.
- `prepareSquareForExpansion` exige `square_original` **interno** em `campaign_composition_artifacts`, com identidade `(storeId, campaignId, operationId, role)` e origem `deterministic_preparation` no artefato preparado (`src/lib/campaign/square-preparation/prepare.ts`, `types.ts`). Ele não aceita diretamente o artefato individual `1:1`.
- `expandVerticalToNineSixteen` exige `square_prepared` interno, seleção de expansão obrigatória e congelada, sonda pré-chamada, pricing/catálogo antes da chamada paga, timeout máximo de 180 s, uma única invocação por tentativa, validação 1152×2048 e exportação 1080×1920 (`src/lib/campaign/vertical-expansion/expand.ts`, `policy.ts`, `output.ts`).
- Os controles `9_16_two_stage` já oferecem operação com duas etapas, claims de uma execução concorrente, limite de tentativas, outcomes `unknown|failed` imutáveis, retomada e CAS (`supabase/migrations/20261109174110_f60_9_16_two_stage_control.sql`, `src/lib/product-9-16-two-stage/**`).
- A fundação conjunta F60.7 exige um snapshot `campaignFormat = "1:1+9:16"`, cria **duas** reservas e **dois** vínculos, e `product_two_format_project_campaign` falha com `delivery_links_inconsistent` se não houver exatamente dois vínculos da mesma operação (`supabase/migrations/20261118002139_f60_7_two_format_foundation.sql`). Ela **não serve** como “append” de um único formato.
- A RPC `product_1_1_get_campaign_operation_by_campaign` escolhe a linha de crédito mais recente por `created_at DESC LIMIT 1` e alimenta detalhe, download, recuperação de imagem/copy, reenvio e consulta (`supabase/migrations/20261109174110_f60_9_16_two_stage_control.sql`; consumidores em `src/app/(app)/campanhas/[id]/page.tsx`, `src/app/api/campaign/[id]/download/route.ts`, `src/app/api/campaign/[id]/image-recovery/route.ts`, `src/app/api/campaign/[id]/copy-recovery/route.ts`). O próprio código conjunto documenta que essa RPC não é autoridade quando há mais de uma reserva (`src/lib/product-two-format/control-reader.ts`).
- A apresentação individual atual trata o outro formato como `absent/not_requested` (`src/lib/campaign/format-presentation.ts`) e a UI de detalhe/lista/dashboard tem requisitos explícitos de “sem modal, custo ou ação de geração” para o formato ausente (`openspec/specs/campaign-page-ui/spec.md`, `campaign-list-ui/spec.md`, `dashboard-operational-composition/spec.md`).
- A listagem/dashboard já leem a campanha conjunta em lote, com 4 consultas por página e assinatura de miniaturas em lote; a miniatura quadrada é preferida (`src/lib/campaign/list.ts`, `src/lib/dashboard/campaigns.ts`, `src/lib/product-two-format/list-summary.ts`).
- O responsável declarou a aplicação da migration F60.7, o deploy e a validação em produção. Esta proposta registra essa **declaração do responsável**, não uma nova verificação técnica: versão/hash/ledger e o escopo exato da evidência de produção deverão ser conferidos no gate de release, sem apagar nem reescrever o histórico anterior.

### Declaração de produção registrada

O responsável declarou que a migration F60.7 foi aplicada, o deploy foi realizado e a validação ocorreu em produção. Esta change registra a declaração para reconciliar o histórico, **sem** tratá-la como verificação técnica desta proposta e **sem** apagar o registro anterior de homolog. Versão/hash/ledger, schema efetivo e escopo exato da validação de produção permanecem como conferência técnica no gate de release. Nenhum ambiente é acessado nesta etapa.

### Objetivo

Permitir que uma campanha `1:1` já entregue receba o `9:16` **na mesma campanha**, como operação paga própria, sem duplicar a campanha, regenerar o quadrado, alterar a copy ou substituir a referência principal.

### Fora do escopo

Adicionar `1:1` a campanha `9:16`; adaptar `1080×1080`; gerar novo quadrado; editar copy/campanha; painel administrativo de suporte; pricing global; backfill; eventos históricos; refatoração ampla dos fluxos consolidados; ativação em produção.

### Contratos reutilizados

| Contrato existente | Uso nesta change | O que não muda |
|---|---|---|
| `resolveReusableSquareSource` / `validateDeliveredCampaignSource` | elegibilidade, acesso, vínculo, path, dimensão, checksum | regras de origem e integridade; nenhuma conversão |
| `persistCompositionArtifact` / evidência F60.1 | ponte `square_original` byte-idêntica, readback e idempotência | imutabilidade e proveniência; nenhuma geração |
| `prepareSquareForExpansion` | 1024→1152 determinístico | geometria, original preservado, idempotência |
| `expandVerticalToNineSixteen` | expansão 9:16, sonda, pricing, uma chamada paga por tentativa | política de provider, timeout, validação 1080×1920 |
| `product_9_16_open_operation_v2` + controles `9_16_two_stage` | operação, steps, claims, tentativas, outcomes, retomada | concorrência, CAS e limites existentes |
| RPCs de crédito `product_1_1_*` | reserva, art_uploaded, entrega e estorno da adição | valor unitário, semântica e operação original |
| Sondas, fence de publicação e miniatura | recuperação de artefato, confirmação sem nova chamada paga, miniatura vertical | políticas existentes de probe/publicação |
| `format-presentation`, chips, list/dashboard e download | estados, nomes, acessibilidade e leitura em lote | vocabulário, miniatura quadrada e ações existentes |

### Lacunas conhecidas

A adição não cria uma projeção de campanha, não altera o snapshot e não reutiliza o orquestrador conjunto. As lacunas conhecidas são: painel administrativo de adições, limpeza automática de cópias órfãs e procedimento documentado de suporte.


## Goals / Non-Goals

### Goals

- Elegibilidade decidida por contratos da fonte, com distinção entre incompatibilidade comprovada e leitura/verificação indisponível.
- Operação durável, idempotente e concorrente-segura, com 1 crédito e sem tocar a operação original.
- Reuso máximo do motor existente, com uma única ponte de proveniência explícita.
- Entrega adicional que preserva o quadrado como principal e mantém a mesma campanha em todas as superfícies.
- UX simples no detalhe, com confirmação de custo, acompanhamento, saída segura e retomada.
- Provas separadas: offline com fakes declarados, banco real/Storage/provider e validação visual.

### Non-Goals

- Não criar um segundo card, uma segunda campanha ou um snapshot conjunto retroativo.
- Não alterar `campaigns.input_snapshot`, `campaigns.storage_path`, `campaigns.status` ou a operação `1:1` original para representar a adição.
- Não usar o orquestrador conjunto (que reserva dois formatos) nem o fluxo vertical individual de nova campanha.
- Não prometer adaptação futura para imagem incompatível.
- Não depender do estado da modal como autoridade.

## Decisions

### D1 — Elegibilidade vem da fonte entregue, não da idade

**Decisão:** a elegibilidade é resolvida pela validação de fonte entregue (`resolveReusableSquareSource` → `validateDeliveredCampaignSource`) com reconhecimento explícito de **duas origens suportadas**: `new_flow_1_1` e `legacy_campaign`. Para `new_flow_1_1`, a fonte é o artefato 1024×1024 do fluxo atual e a operação `1:1` primária que sustenta esse artefato deve estar entregue. Para `legacy_campaign`, a validação usa um modo opt-in que aceita JPEG 1024×1024 no path canônico histórico, sem exigir operação financeira original e sem inventá-la. Em ambas as origens, o sistema exige `status = ready`, formato persistido `1:1`, path canônico compatível com a origem, acesso do lojista, vínculo campanha/loja e checksum recalculado dos bytes. Fonte `1080×1080` ou de outra dimensão é **incompatível comprovada**; não há conversão, adaptação ou backfill.

**Por quê:** o requisito é compatibilidade da imagem e do vínculo, não idade nem existência de uma operação financeira anterior. A validação de fonte já é estrita e recalcula integridade; o modo opt-in de legado permite reconhecer uma campanha histórica compatível sem enfraquecer o default dos demais consumidores e sem criar uma operação fictícia.

**Alternativas rejeitadas:**
- *Aceitar qualquer campanha `1:1` pronta e deixar a expansão falhar depois:* cobraria antes de saber que a fonte é incompatível.
- *Exigir operação financeira original para todas as origens:* excluiria campanhas legadas com imagem 1024 compatível e inventaria uma operação que não existe.
- *Aceitar qualquer path ou conferir somente dimensões:* não provaria vínculo, origem, acesso nem integridade.
- *Converter 1080→1152:* fora do escopo e enfraqueceria a geometria aprovada.
- *Aceitar a arte individual diretamente em `prepareSquareForExpansion`:* exigiria mudar um contrato consolidado e apagar a fronteira de proveniência.

**Distinção de falhas:** `unsupported_dimensions`, `unsupported_mime`, `artifact_invalid`, `path_not_canonical`, `format_not_square` e `campaign_not_ready` são **incompatibilidade/contrato**; `artifact_absent` é **fonte ausente** (não promete adaptação); `artifact_indeterminate` e falha de leitura são **indisponibilidade transitória**. A UI usa textos distintos; nenhum caso transitório é apresentado como incompatível definitivo.

**Nota sobre “legadas”:** não há corte por idade. Uma campanha histórica é elegível quando sua fonte real passa no contrato 1024×1024, no path canônico da origem legada, com acesso, vínculo e integridade. A procedência é registrada como `source_origin = legacy_campaign`; nenhuma operação financeira original é criada, e a operação de adição continua sendo a única operação financeira nova. Fonte histórica 1080×1080 permanece bloqueada.

### D2 — Ponte de proveniência explícita, sem inventar geração

**Decisão:** após validar a fonte entregue, o sistema persiste uma cópia **byte-idêntica** da imagem como `square_original` em `campaign_composition_artifacts`, sob uma **identidade estável de registro da fonte**, com origem nova `delivered_campaign_reuse`, `source.kind = delivered_campaign_source`, `sourceCampaignId = campanha` e proveniência com path/checksum/dimensão da fonte. A identidade é:
- `new_flow_1_1`: a operação `1:1` primária entregue que sustenta o artefato atual;
- `legacy_campaign`: uma identidade sintética determinística derivada de loja/campanha, **sem operação financeira**, usada apenas como identidade do artefato de composição.

O artefato preparado 1152×1152 usa o `operationId` da adição. A operação original, quando existe, e o objeto `art-1024.jpg` não são alterados. O registro é único por fonte/campanha, de modo que aberturas concorrentes ou recusadas reutilizam a mesma ponte em vez de criar cópias ilimitadas. A ponte é imutável: antes de reutilizá-la em uma nova abertura, a fonte entregue é revalidada e seu checksum é comparado ao registrado; divergência é conflito, nunca reuso silencioso.

**Por quê:** `prepareSquareForExpansion` exige `square_original` interno. A ponte preserva a validação existente, deixa a origem explícita e permite preparar com `source.operationId = source_registration_operation_id` e `preparedOperationId = operationId` da adição. O checksum recalculado dos bytes reais fecha a lacuna de a tabela individual não armazenar checksum. Uma ponte por tentativa multiplicaria cópias e não representaria a fonte de forma estável.

**Alternativas rejeitadas:**
- *Usar `deterministic_preparation` para o registro:* falsearia a origem (não houve transformação) e confundiria auditoria.
- *Criar a ponte sob o `operationId` de cada tentativa:* permitiria cópias repetidas por concorrência/aberturas recusadas.
- *Inventar uma operação financeira original para legado:* criaria autoridade falsa; a fonte legada é comprovada pelo artefato/checksum, não por crédito.
- *Alterar `prepareSquareForExpansion` para aceitar descritor de campanha:* ampliaria um contrato consolidado e misturaria responsabilidades.
- *Criar uma linha fictícia de `square_original` a partir do path, sem copiar bytes:* o readback e a evidência F60.1 falhariam ou seriam enfraquecidos.

**Consequência:** o CHECK de `origin` de `campaign_composition_artifacts` e a união `ArtifactOrigin` precisam aceitar `delivered_campaign_reuse`. O modo opt-in de fonte legada 1024 precisa ser propagado também para a revalidação interna de `persistCompositionArtifact`, com default inalterado para os demais consumidores. A preparação recebe a identidade de fonte separada da identidade de destino; o wrapper de preparação pode ganhar um parâmetro opcional default-preserving ou a chamada direta a `prepareSquareForExpansion` é usada. Não há backfill; linhas antigas permanecem válidas.

### D3 — Operação de controle `9_16_two_stage` com base reutilizada

**Decisão:** a nova operação cria uma linha `product_9_16_two_stage_operations` via `product_9_16_open_operation_v2` (seleção congelada + reserva de 1 crédito) e marca a etapa `base` como `done`, com evidência referenciando o `square_original` da ponte. **Nenhuma** chamada de geração de base é feita. A etapa `expansion` segue o fluxo normal (`runExpansionStep`), com preparação determinística e expansão existentes.

**Por quê:** reutiliza claims, limites, retomada, outcomes, fence e semântica financeira já provados, sem o orquestrador conjunto. A etapa base é bookkeeping durável da fonte, não uma nova geração.

**Alternativas rejeitadas:**
- *Invocar `runBaseStep` e gerar outro quadrado:* viola o requisito de não gerar outro quadrado e cobraria/duplicaria arte.
- *Criar um controle próprio só para adição:* duplicaria concorrência, retomada e outcomes.
- *Chamar o orquestrador conjunto com um formato “faltante”:* ele reserva dois formatos e exige snapshot conjunto.

### D4 — Identidade durável própria e 1 crédito

**Decisão:** criar `campaign_format_additions` como vínculo durável da adição, com:
`id`, `store_id`, `campaign_id`, `operation_id` (identidade de controle e financeira do vertical), `source_origin ∈ new_flow_1_1|legacy_campaign`, `source_operation_id` (operação `1:1` primária entregue que sustenta a fonte, **nullable** para legado), `source_registration_operation_id` (identidade estável da ponte; igual à operação primária no fluxo novo e sintética no legado), `source_artifact_id` (ponte `square_original`), `source_checksum_sha256`, `source_format = '1:1'`, `target_format = '9:16'`, `status ∈ open|delivered|refunded`, `request_id`, `frozen_economics` (JSONB validado), timestamps e FK composta para campanha/loja.
Constraints: `(campaign_id, request_id)` único; no máximo uma adição `open` ou `delivered` por campanha/alvo; histórico de tentativas refundadas é permitido. `source_operation_id` é obrigatório somente para `new_flow_1_1`; para `legacy_campaign` é nulo e a fonte é comprovada pelo artefato/checksum, nunca por crédito inventado. O `request_id` SHALL ser emitido pelo servidor no preflight de confirmação e vinculado a campanha/alvo/checksum/custo; o cliente não escolhe a operação nem forja a identidade. O token de confirmação SHALL ser opaco, verificável no servidor, de curta duração e sem segredo/operação financeira embutidos. A operação financeira usa `product_1_1_campaign_credit_operations` com a identidade da adição e `amount = 1`. A leitura corrente prioriza a adição `open`/`delivered`; se só houver `refunded`, usa a mais recente para apresentar o estorno.

**Replay e nova tentativa:** repetir o mesmo `request_id` retorna o estado daquela adição, inclusive `refunded`, e **nunca** abre outra operação. Uma nova tentativa após estorno exige um **novo token de confirmação emitido pelo servidor** (`new_attempt`), com novo `request_id`, precedida de nova confirmação explícita de custo. Um replay atrasado da requisição original, com o token antigo, não cobra nem expande.

**Por quê:** o vínculo é a autoridade durável; a modal é só uma vista. A unicidade parcial resolve duplo clique/duas abas; o par `request_id` + confirmação de nova tentativa impede que um replay antigo reabra cobrança após estorno. A operação separada impede reabrir/estornar a original.

**Alternativas rejeitadas:**
- *Reutilizar `product_two_format_deliveries`:* a tabela exige operação de controle conjunta, FK e exatamente dois vínculos; relaxá-la afetaria F60.7.
- *Usar a mesma operação `1:1` para o vertical:* violaria “não reabrir/cobrar/estornar a operação original”.
- *Confiar apenas em `request_id` sem token de confirmação vinculado:* duas abas teriam ids diferentes e um replay antigo poderia passar por nova tentativa; a unicidade no banco e o token emitido pelo servidor são necessários.
- *Exigir operação financeira original em legado:* criaria uma operação fictícia e excluiria fontes compatíveis.

### D5 — RPCs dedicadas, atômicas e idempotentes

**Decisão:** três RPCs novas, `SECURITY DEFINER`, `search_path = ''`, executáveis só por `service_role`:

1. **Abrir/replay** — valida loja/campanha/status/formato `1:1`, `source_origin`, ponte `square_original` (papel/formato/dimensão/MIME/checksum/`sourceCampaignId`/identidade de registro), seleção e economia congeladas; para `new_flow_1_1`, exige a operação `1:1` primária entregue; para `legacy_campaign`, exige artefato/checksum válidos e **não** exige operação financeira original. Trava a campanha. Se o `request_id` já existe, retorna o estado daquela adição, inclusive `refunded`, sem nova cobrança. Se já existe adição `delivered`, retorna o resultado; se existe `open`, retorna a operação em andamento. Caso contrário, e somente com token de confirmação emitido pelo servidor e válido para nova tentativa quando aplicável, chama `product_9_16_open_operation_v2`, marca base como reutilizada e insere o vínculo `open`.
2. **Entregar** — trava campanha/vínculo/crédito; valida o `vertical` canônico 1080×1920 JPEG da operação; se crédito já `delivered`, apenas reconcilia o vínculo; senão exige token de publicação, executa as RPCs existentes de `art_uploaded`/`deliver` e marca o vínculo `delivered`. **Não** projeta a campanha nem altera `campaigns.storage_path`.
3. **Estornar** — trava campanha/vínculo/crédito; recusa entrega; exige arte ausente comprovada, epoch e outcome `failed`; chama o fechamento/estorno existente somente para a operação da adição e marca o vínculo `refunded`. Replay é idempotente.

**Por quê:** a atomicidade entre reserva, vínculo e etapa base evita estados órfãos; a entrega e o estorno só tocam a identidade da adição.

**Alternativas rejeitadas:**
- *Fazer abertura/entrega no application layer com inserts separados:* não garante atomicidade em concorrência e exigiria escrita direta em tabela protegida.
- *Usar `product_two_format_deliver_format`/`refund_format`:* dependem do vínculo conjunto e do contrato de dois formatos.

### D6 — A adição não é a operação primária da campanha

**Decisão:** redefinir `product_1_1_get_campaign_operation_by_campaign` para excluir operações que são adições, mantendo a busca da “operação mais recente” entre as operações primárias. Os novos caminhos usam **identidade explícita** (`source_operation_id` quando existir, `source_registration_operation_id`, `source_artifact_id` e `operation_id`), nunca “a mais recente”.

**Por quê:** detalhe, download, recuperação de imagem/copy, reenvio e consulta já dependem dessa RPC. Sem o filtro, a adição passaria a ser lida como se fosse o `1:1` original, quebrando a interpretação, a recuperação e o download. Corrigir cada consumidor seria amplo e arriscado; o filtro central preserva o contrato histórico e é testável.

**Alternativas rejeitadas:**
- *Atualizar todos os consumidores individualmente:* maior superfície de regressão e risco de esquecer um.
- *Guardar a adição em outra tabela financeira:* duplicaria a lógica de reserva/estorno e quebraria a reutilização dos controles.
- *Não criar linha em `product_1_1_campaign_credit_operations`:* o motor e os controles existentes não teriam a autoridade financeira esperada.

**Consequência:** a listagem de pendências administrativas legada não deve tratar a adição como `1:1`. Esta fatia exclui operações de adição da lista/painel legado; a recuperação do lojista é a via suportada. O painel administrativo de adições é explicitamente fora do escopo e vira lacuna documentada.

### D7 — Configuração e parâmetros econômicos congelados

**Decisão:** na abertura, o servidor lê **uma vez** a seleção de expansão (`model`, `quality`, `config_version_id`) e o pricing/valores econômicos aplicáveis, e grava tudo no vínculo (`frozen_economics`). Toda retomada/retry usa leitores congelados de catálogo e pricing, além dos valores gravados; nunca relê a configuração, o catálogo ou o pricing vigente para a mesma operação. Se o congelado estiver ausente, malformado ou incompatível com a seleção, a operação bloqueia antes de chamada paga e não inventa valores.

**Por quê:** o requisito é explícito; sem congelamento, uma mudança de catálogo/pricing entre tentativas alteraria o custo e a semântica da operação.

**Alternativas rejeitadas:**
- *Reusar apenas `preflightFrozenExpansion` (modelo/qualidade/versão):* não congela pricing nem valores econômicos.
- *Recalcular pricing a cada tentativa:* permitiria custo diferente no retry e dificultaria a auditoria.

**Limite:** os valores de câmbio/valor do crédito são estimativas de telemetria; quando indisponíveis no momento da abertura, ficam `null` explícitos e **não** são inventados depois. O pricing obrigatório da chamada precisa estar completo; se não estiver, a abertura não reserva crédito.

### D8 — Orquestrador dedicado de formato único, reutilizando o motor

**Decisão:** criar um orquestrador de adição que:
1. lê o vínculo durável; se `delivered`, encerra;
2. se `open`, lê crédito/controle/outcomes e sonda o vertical antes de qualquer chamada paga;
3. se não há operação, valida a fonte, persiste a ponte, congela economia e chama a RPC de abertura;
4. executa `runPreparationStep` (1024→1152) e `runExpansionStep` (com `expandVerticalToNineSixteen`), preservando deadline, recheck, claims, tentativas e `signal`;
5. persiste/verifica o vertical; adquire token de publicação; chama a RPC de entrega; gera miniatura best-effort;
6. em falha definitiva comprovada, registra outcome `failed`, sonda ausência, estorna uma vez e marca `refunded`;
7. em resultado incerto, registra `unknown` e retorna acompanhamento — **nunca** estorna nem inicia nova expansão;
8. em artefato já íntegro com confirmação incompleta, confirma sem nova chamada paga.

**Por quê:** é o menor caminho que reutiliza o motor real sem o contrato conjunto. O estado durável decide; o stream/modal apenas reflete.

**Alternativas rejeitadas:**
- *Chamar o orquestrador conjunto:* reserva dois formatos e exige snapshot conjunto.
- *Criar um segundo motor de expansão:* duplicaria controles e provas.
- *Projetar a campanha para o vertical:* substituiria a referência principal do quadrado.

### D9 — Entrega sem projeção destrutiva

**Decisão:** a entrega da adição atualiza apenas `campaign_format_additions.status`, crédito e miniatura. **Não** chama `projectDeliveredCampaign`/`projectClosedCampaign`, não altera `campaigns.status`, `campaigns.storage_path` ou `error_message`, e não toca o artefato `1:1`. A leitura da campanha combina a entrega primária existente com o vínculo da adição.

**Por quê:** o quadrado é a referência principal; uma falha do vertical não pode esconder/derrubar o quadrado. A projeção de campanha existe para o formato principal e não serve para uma entrega adicional.

**Alternativas rejeitadas:**
- *Reusar `projectDeliveredCampaign` com `source: composition`:* ela repointa `storage_path` para o vertical.
- *Criar uma segunda campanha:* viola “mesma campanha, um card”.

### D10 — Apresentação e leitura em lote

**Decisão:**
- Estender o modelo puro individual com uma entrada opcional de adição; o fluxo continua `single_format`, `partial` continua `false`, e o vertical pode ser `delivered`/`processing`/`absent/not_delivered`/`unknown`. Quando não há adição, permanece `absent/not_requested`.
- Detalhe lê o vínculo por campanha e monta preview/download por formato; `?format=` passa a ser aceito para `1:1` com adição (além do conjunto). Formato inválido/não entregue falha fechado, sem fallback silencioso.
- Listagem/dashboard fazem **uma leitura em lote** da adição (vínculo + crédito + artefato) por página, combinada com a leitura atual; nenhuma consulta por card. Miniatura quadrada continua preferida; a contagem não muda.
- Download aceita `?format=` quando há adição durável; sem parâmetro usa o quadrado; nunca cai no artefato do outro formato.

**Por quê:** preserva as autoridades e evita N+1; a apresentação não reinterpreta estados.

**Alternativas rejeitadas:**
- *Consultar a adição por card:* N+1.
- *Reutilizar o read model conjunto:* ele exige contrato conjunto e falha com um único vínculo.
- *Inferir o formato pelo path/miniatura:* já proibido pela F61.

### D11 — Gates e autorização

**Decisão:** a ação é fail-closed e separa **abertura** de **continuação**:

- **Abertura de nova adição:** exige `campaign_format_addition_enabled` (flag dedicada, fallback `false`), `product_9_16_two_stage_enabled` (gate do motor vertical), `resolveProductFlowAuthorization` aplicável à loja/instância, legal clearance, store readiness, rate limit e saldo ≥ 1. Só depois reserva 1 crédito.
- **Continuação/retomada de operação já aberta:** não exige saldo disponível nem reserva outro crédito; exige que a reserva da própria operação exista e esteja válida (`reserved`/`art_uploaded`), a identidade/expiração corretas, a flag do motor vertical e os gates de autorização/legal/readiness aplicáveis. Consulta, reconciliação, recuperação e download **não** dependem de saldo disponível.
- **Gate de piloto:** quando `resolvePilotSpendGate` retornar `armed`, a chamada paga de expansão é envolvida por `beginPaidCall`/`endPaidCall`/`markUnknown` com a estimativa congelada e o `kind` de imagem adequado à tentativa; `blocked` bloqueia; `inactive` segue sem gate. Nenhum teto existente é ampliado ou contornado.
- **Rollback:** desligar `campaign_format_addition_enabled` bloqueia **somente novas adições**. Operações já abertas continuam consultáveis, retomáveis e finalizáveis; o vertical individual, o conjunto, o `1:1` e o download existente não são desligados. A flag compartilhada `product_9_16_two_stage_enabled` não é usada como kill switch da adição.

**Por quê:** o saldo é um gate de **nova cobrança**, não de continuação de uma reserva já feita; exigir saldo após a reserva impediria concluir uma operação paga com o último crédito. A flag dedicada permite rollback sem derrubar os fluxos publicados. O gate de piloto é aplicado tecnicamente quando armado, sem alterar seu teto.

### D12 — Migração forward-only e ativação separada

**Decisão:** uma migration aditiva deve conter:
- `campaign_format_additions` + `source_origin`/`source_operation_id` nullable/`source_registration_operation_id`/`source_artifact_id`/checksum, constraints/FKs/índices parciais + RLS SELECT-only + grants;
- as três RPCs dedicadas;
- redefinição de `product_1_1_get_campaign_operation_by_campaign` (filtro de adições);
- ampliação do CHECK de `campaign_composition_artifacts.origin` para `delivered_campaign_reuse`;
- a chave de feature flag dedicada `campaign_format_addition_enabled`, com `enabled = false`, registrada no serviço/painel existente de feature flags, sem criar um novo painel administrativo.

Sem backfill, sem renomear migrations existentes, sem tocar dados históricos. A migration **não é criada/aplicada** nesta etapa. A aplicação é gate separado, posterior à implementação offline e anterior à liberação, com verificação de schema/ledger, backup, concorrência real e autorização explícita. O schema-alvo deve ter as estruturas F60/F60.6/F60.7 necessárias. A declaração de produção do responsável é registrada no tracking; a conferência técnica de versão/hash/ledger é gate de release e não reescreve o histórico.

## Risks / Trade-offs

- **[Cópia da fonte duplica bytes no bucket interno]** → É uma única cópia 1024×1024 por fonte/campanha, idempotente e reutilizada por aberturas concorrentes/recusadas; o original não é alterado. A alternativa (usar o original direto) exigiria mudar o contrato F60.1.
- **[Ponte antes da abertura pode deixar cópia órfã se a abertura falhar]** → A identidade estável por fonte evita uma cópia por tentativa; a cópia é idempotente, byte-idêntica e sem efeito financeiro. Limpeza automática fica fora desta fatia e é registrada como limitação operacional.
- **[Nova origem `delivered_campaign_reuse` amplia um CHECK]** → Migration aditiva; linhas antigas continuam válidas. Deploy da migration antes do código que grava a nova origem. Teste de schema e de evidência.
- **[Redefinir a RPC de operação primária pode afetar consumidores legados]** → Testes de contrato para detalhe, download, recuperação de imagem/copy, reenvio e consulta; comparação de comportamento sem adição; filtro só para operações presentes na tabela de adições.
- **[Adição pode aparecer no painel de pendências legado]** → Excluir da listagem/resolução legada nesta fatia; recuperação do lojista é a via suportada; documentar o procedimento de suporte por operação/artefato, sem conceder crédito em duplicidade.
- **[Modal fechado/queda de conexão aborta o stream]** → Nenhum estorno/cancelamento é automático; o vínculo `open` e o controle permanecem; reabrir consulta e retoma. Não se promete execução em background além do request.
- **[Resultado incerto pode deixar crédito reservado]** → Outcome `unknown` é durável; a próxima leitura sonda o artefato e reconcilia antes de nova geração/estorno. Não há liberação por tempo.
- **[Pricing congelado pode ficar obsoleto em relação ao catálogo]** → É intencional para a operação; novas operações leem o vigente. O congelado precisa ser validado antes do gasto.
- **[Saldo zero após a reserva bloquearia a continuação]** → O saldo é exigido apenas na abertura; a continuação valida a reserva da própria operação, e consulta/reconciliação/download não dependem de saldo.
- **[Replay atrasado após estorno poderia abrir nova cobrança]** → `request_id` único + token de confirmação emitido pelo servidor + nova confirmação; replay antigo retorna o estado terminal sem cobrar.
- **[Flag compartilhada derrubaria outros fluxos no rollback]** → Flag dedicada `campaign_format_addition_enabled` bloqueia somente novas adições; operações abertas finalizam e os fluxos individual/conjunto permanecem.
- **[Declaração de produção vs verificação técnica]** → A declaração do responsável é registrada sem apagar o histórico; versão/hash/ledger e schema efetivo continuam como conferência técnica no gate de release.
- **[Testes fake não provam dinheiro real]** → O plano separa offline, PostgreSQL/Storage reais e provider pago; nenhum acesso pago sem autorização.
- **[Gate de piloto]** → Aplicado tecnicamente quando armado, sem ampliar o teto; `blocked` bloqueia a chamada e `inactive` não inventa gate.

## Migration Plan

1. **Pré-condição:** confirmar no ambiente-alvo a presença das estruturas F60/F60.6/F60.7 exigidas (controle `9_16_two_stage` v2, `campaign_composition_artifacts`, RPCs financeiras). A declaração de produção do responsável é registrada, mas versão/hash/ledger e schema efetivo são conferidos tecnicamente neste gate.
2. **Autoria (fase de implementação):** criar migration `YYYYMMDDHHmmss_descricao.sql` com timestamp UTC real, após conferir unicidade de prefixo na worktree, branch de integração e branches paralelas conhecidas.
3. **Objetos:** tabela/vínculo com origem de fonte e identidades separadas, índices, RLS/grants, RPCs, redefinição da RPC primária, CHECK de origem e chave da flag dedicada. Sem backfill.
4. **Gate local/homolog:** aplicar em ambiente explicitamente autorizado, com backup, ledger e suíte de schema/concorrência/financeiro real. Testes estáticos não substituem transações.
5. **Ativação:** só após aceite funcional/visual e autorização separada. Rollback operacional: desligar `campaign_format_addition_enabled` bloqueia novas adições; operações abertas continuam consultáveis/retomáveis/finalizáveis; não apagar vínculos, créditos ou artefatos; correção por RPC auditada. Não desligar a flag compartilhada `product_9_16_two_stage_enabled` como rollback da adição.
6. **Produção:** deploy/flag/migration são gates separados; nenhum é executado nesta etapa.

## Decisões resolvidas e pendências

**Resolvido nesta revisão:** origem `delivered_campaign_reuse`; retenção da cópia enquanto necessária à operação/proveniência, com uma ponte estável por fonte e limpeza automática fora da fatia; 1080×1080 bloqueado; legado 1024 elegível sem operação financeira inventada; gate de piloto aplicado tecnicamente quando armado; flag dedicada de rollback.

**Pendências de documentação/gate, não de arquitetura:**

1. **Procedimento de suporte:** documentar como o suporte identifica uma adição presa por campanha/operação/artefato e como reconcilia/estorna sem conceder crédito em duplicidade. O painel novo continua fora do escopo; a consulta read-only e a RPC auditada existentes são a base.
2. **Conferência técnica de produção:** registrar no gate de release a versão/hash/ledger da F60.7 e o schema efetivo, distinguindo a declaração do responsável da verificação técnica. Não é necessário acessar produção nesta etapa nem reescrever o histórico.
