## Context

O fluxo novo aprovado hoje executa uma única operação paga: reserva 1 crédito, gera a arte, publica e entrega. A linha financeira canônica é `public.product_1_1_campaign_credit_operations`, com identidade `(campaign_id, operation_id)`, estados `reserved → art_uploaded → delivered | refunded` e RPCs CAS sob `SELECT ... FOR UPDATE` (trava C4). Os RPCs de travamento financeiro (aquisição de tentativa, encerramento por falha e resolução administrativa) serializam **na linha de crédito**, e as rotinas de encerramento/pendência consultam **explicitamente** `public.product_1_1_generation_attempt_claims`:

- `product_1_1_close_failed_operation` — predicado PF: exige **nenhum** claim `in_progress` e um `outcome='failed'` persistido; definição vigente com fence de publicação e frescor de epoch em `supabase/migrations/20261016000001_f56_2b2b_publication_fence.sql:255-289` (claims em `:280-282`, desfecho em `:283-285`).
- `admin_resolve_product_1_1_pending` — deriva `execution_ended` do claim `in_progress` sob a trava e abandona o residual; definição vigente com fechamento autorizado de publicação em `supabase/migrations/20261016000001_f56_2b2b_publication_fence.sql:305-414` (claims em `:358-361`, abandono em `:399-402`).
- `product_1_1_get_campaign_operation_by_campaign` — expõe `unknown`/`outcome`/`support_reference` lidos de `product_1_1_generation_outcomes` (`supabase/migrations/20261015000003_f56_2b2b_pending_read.sql:53-81`).
- `src/lib/product-1-1/pending/pending-operations-repository.ts` `readClaims` (`:157-166`) — a listagem administrativa lê a tabela de claims diretamente.

O formato 9:16 direto (F59) reutiliza integralmente essa linha e essas RPCs; não há tabela própria de operação vertical. O novo fluxo de duas etapas **não pode** repetir esse acoplamento sem controle: a base concluída não é entrega, a expansão não reserva outro crédito e o encerramento não pode ocorrer entre etapas.

Ambiente observado somente em leitura nesta etapa: `vendeo-homolog` em execução (`supabase_db_vendeo-homolog`, `127.0.0.1:57782`, banco `postgres`), ledger com **153** migrations aplicadas e última versão `20261105162052`. As tabelas atuais existem; não existe tabela de operação 9:16. Nenhum ambiente foi criado, reiniciado, limpo ou escrito.

## Goals / Non-Goals

**Goals:**

- Controlar uma operação 9:16 de duas etapas como **um único pedido de 1 crédito**, com identidade durável e limites que sobrevivem a requisições e retomadas.
- Garantir **uma única execução concorrente** por operação e impedir repetição após entrega, estorno ou resultado desconhecido.
- Permitir continuidade após a conclusão da base **sem nova reserva** e sem reexecutar a base.
- Integrar reserva, confirmação, estorno e pendências aos serviços financeiros existentes, sem ledger paralelo.
- Fazer os caminhos administrativos e de recuperação **reconhecerem a nova execução** e impedirem encerramento indevido.
- Provar o contrato em banco isolado, com etapas simuladas, antes de implementar o módulo completo.
- Preservar integralmente `delivered`, a cobrança atual e os fluxos 1:1 e 9:16 direto.

**Non-Goals:**

- Gerar imagem, compor prompt, executar expansão real, armazenar artefatos completos ou exportar.
- Criar UI, seletor de formato, entrega dupla, cron, fila, worker ou limpeza automática.
- Unificar ou refatorar os orquestradores e as rotinas financeiras legadas.
- Ativar o novo fluxo para o lojista, criar flag, rota pública ou deploy.

## Decisions

### D1 — Orquestrador próprio, operação financeira compartilhada

O novo fluxo terá orquestrador e módulo de controle próprios, mas a **operação financeira continua sendo** `product_1_1_campaign_credit_operations`. A reserva reutiliza `product_1_1_reserve_credit_operation` (que chama `reserve_credit` na mesma transação) e a entrega/estorno reutilizam as RPCs CAS existentes.

**Por quê:** a linha de crédito é a trava comum C4 de toda a resolução financeira. Criar outra linha financeira quebraria a serialização com entrega, estorno e encerramento. O nome `product_1_1_*` é histórico; o 9:16 direto já a reutiliza.

**Alternativa rejeitada:** tabela financeira própria para o novo fluxo — criaria um ledger paralelo e dois caminhos de encerramento.

### D2 — Conclusão da base não altera o status de crédito

O status da linha de crédito permanece `reserved` durante **todas** as etapas. `art_uploaded` só é gravado quando a **arte vertical final** estiver publicada (fence) e pronta para entrega; `delivered` continua significando exatamente "campanha entregue". O progresso das etapas vive apenas nas tabelas de controle.

**Por quê:** `art_uploaded` e `delivered` têm semântica financeira e de download já consumida por recuperação, listagem e gate de download. Reutilizar `art_uploaded` para "base pronta" alteraria o significado de `delivered` e permitiria entrega antecipada.

**Alternativa rejeitada:** novo status `base_done` na tabela compartilhada — mudaria o CHECK e todos os leitores legados.

### D3 — Identidade e persistência do controle

Novas tabelas (nomes de trabalho, sujeitos à revisão):

- `product_9_16_two_stage_operations` — identidade `(campaign_id, operation_id)` única, `store_id`, `credit_operation_ref`, `origin = '9_16_two_stage'`, versão de contrato e timestamps. **Não** armazena `delivered`/`refunded` como estado autoritativo.
- `product_9_16_two_stage_steps` — uma linha por etapa (`base`, `expansion`), com `status` (`pending`, `in_progress`, `done`, `failed`, `abandoned`), `attempts_used`, `failure_class` final, `artifact_evidence_ref` (nesta fatia, referência de evidência simulada controlada) e timestamps.
- `product_9_16_two_stage_attempt_claims` — uma linha por tentativa: etapa, número, alvo (`primary`/`fallback`/`initial`/`retry`), `request_id`, status, classe de falha, timestamps.
- `product_9_16_two_stage_outcomes` — marcador imutável por operação (`unknown`/`failed`) e etapa de origem, com `support_reference`. É um desfecho **operacional**; não substitui o estado financeiro.

Todas as escritas passam por RPCs `SECURITY DEFINER` com `search_path=''`; `service_role` recebe apenas `SELECT` nas tabelas. Nenhum efeito financeiro é escrito por query builder.

**Autoridade financeira única:** a linha `product_1_1_campaign_credit_operations` é a **única** autoridade para `reserved`, `art_uploaded`, `delivered` e `refunded`. O novo módulo não mantém uma segunda cópia desses estados. Todo estado exibido ou decidido pelo módulo (inclusive "entregue" e "estornado") é **derivado** da linha financeira lida sob a mesma trava C4. A tabela operacional registra apenas progresso de etapas, tentativas e desfechos operacionais.

**Origem canônica por operação:** cada `(campaign_id, operation_id)` pertence a exatamente uma origem — `legacy` ou `9_16_two_stage`. As views de união aplicam anti-join: se a operação existe na tabela nova, **somente** a fonte nova é considerada; caso contrário, somente a legada. Isso impede desfechos duplicados ou conflitantes na união. A linha da nova operação é criada na **mesma transação** da reserva; nenhuma operação nova pode existir apenas na fonte legada.

**Alternativa rejeitada:** reaproveitar `product_1_1_generation_attempt_claims` para as duas etapas — a tabela tem `target ∈ {primary,fallback}`, `attempt_number` único por operação e RPC de aquisição com política fixa de 3 tentativas; isso distorceria o contrato legado e impediria representar etapa e limite de expansão.

### D4 — Execução única, consulta versus autorização e idempotência

Toda RPC mutável do novo módulo executa, nesta ordem:

1. trava advisory de transação sobre a identidade da requisição (`request_id`) ou da operação, quando aplicável;
2. `SELECT ... FOR UPDATE` na linha de `product_1_1_campaign_credit_operations` (C4);
3. leitura/atualização da linha de controle da operação e revalidação do estado financeiro.

Além disso:

- índice único parcial em `product_9_16_two_stage_attempt_claims (campaign_id, operation_id) WHERE status='in_progress'` — no máximo **um** passo/tentativa em execução por operação;
- índice único em `(campaign_id, operation_id, request_id)` — a mesma requisição é associada ao **mesmo** claim;
- unicidade de `(campaign_id, operation_id, stage, attempt_number)`.

**Consulta não é autorização de execução.** A aquisição devolve sempre `acquired` e `authorization`:

- **vencedor** (transação que inseriu o claim `in_progress`): `acquired=true`, `authorization='execute'` — é o **único** autorizado a chamar o provider;
- **reenvio** (mesma `request_id` ou requisição concorrente que encontrou o claim existente): `acquired=false`, `authorization='query_only'` — recebe o estado/token existente, mas **não** pode executar.

O `attempt_token` identifica a tentativa; **não** é permissão de execução. Receber o mesmo token em duas requisições **não** significa que ambas executam. Duas requisições simultâneas com a mesma `request_id` serializam na trava advisory/única: uma executa e a outra recebe apenas o estado.

**Por quê:** verificação apenas em TypeScript não fecha a corrida entre requisições simultâneas, nem entre uma requisição e o encerramento administrativo. A serialização e a distinção execute/query_only precisam estar no banco.

**Alternativa rejeitada:** checar "existe tentativa em andamento" no serviço antes de inserir — janela de corrida clássica. **Alternativa rejeitada:** devolver o token existente como se fosse autorização — permitiria duas execuções pagas para a mesma tentativa.

### D5 — Máquina de estados

```
(reserva) → operation.active, base.pending
base: pending → in_progress → done | failed | abandoned
      base.done ⇒ operation.active, expansion.pending   (sem entrega, sem confirmação)
expansion: pending → in_progress → done | failed
      expansion.done ⇒ CAS reserved → art_uploaded (futuro: arte vertical publicada)
      art_uploaded → delivered  (única confirmação do crédito)
falha definitiva em qualquer etapa, sem tentativa cabível
      ⇒ outcome failed (persistido) ⇒ PF ⇒ refunded (uma vez)
resultado desconhecido em qualquer etapa
      ⇒ outcome unknown (imutável) ⇒ operação bloqueada, sem repetição e sem estorno
```

A conclusão da base **não** chama `deliver`, **não** chama `confirmCredit` e **não** altera o status de crédito.

### D6 — Política de tentativas (decidida)

**Expansão (decidido):** no máximo **2 tentativas por operação** — uma inicial e uma repetição automática. A repetição só é autorizada quando a tentativa anterior terminou como falha classificada **transitória comprovada** (ex.: `rate_limit`, indisponibilidade/capacidade explícita do provider elegível, ou falha técnica **comprovadamente anterior ao envio**). Falha definitiva, resultado desconhecido, saída inválida do provider ou limite já usado **não** admitem repetição. O contador é lido do banco, não da requisição; portanto o limite vale entre retomadas.

**Timeout, abort ou perda de comunicação após possível envio ao provider são resultado desconhecido**, mesmo que o SDK marque o erro como `retryable`. Não autorizam repetição automática. O mesmo vale para resposta incompleta, conexão encerrada durante a chamada e qualquer situação em que o sistema não possa provar que o provider **não recebeu** a requisição. A lógica: repetir nesse estado pode pagar novamente por uma chamada cujo resultado apenas não chegou ao aplicativo.

**Geração base (decidido, preservando o motor atual):** manter a política hoje aprovada para o motor de imagem 1:1 e documentada em `openspec/specs/image-generation-failure-policy/spec.md` — até **2 tentativas no par principal** e até **1 no fallback**, máximo de **3 chamadas reais** por operação; `rate_limit` repete uma vez no principal; indisponibilidade/capacidade explícita pode ir direto ao fallback; quota/faturamento não. A mesma regra de timeout/abort/perda de comunicação como resultado desconhecido se aplica. Como o novo orquestrador é próprio, a política será implementada no novo módulo e está **aprovada nesta revisão**; nenhuma mudança silenciosa em relação ao motor atual.

**Regra comum:** número de chamadas ao provider **não** é número de créditos. Qualquer combinação permitida consome no máximo **1 crédito** por pedido.

### D7 — Reconhecimento pelas rotinas financeiras existentes

Este é o ponto crítico. Se o novo módulo gravar tentativas e desfechos em tabelas próprias, as rotinas de encerramento e pendência **não** os verão. A proposta é uma **fonte de leitura compartilhada no banco**, não um wrapper TypeScript:

- `product_generation_active_claims_v` — união de claims `in_progress` da tabela legada e da nova tabela, com `(campaign_id, operation_id, source, stage)`.
- `product_generation_claim_history_v` — união de **todas** as tentativas (qualquer status), com a mesma origem canônica, para histórico e `latestAttemptAt`; não substitui a consulta de execução ativa.
- `product_generation_operation_outcomes_v` — união de desfechos persistidos da tabela legada e da nova tabela, com precedência terminal preservada.
- `product_abandon_residual_attempts(campaign_id, operation_id)` — helper **interno**, chamado sob a trava C4 apenas por RPCs `SECURITY DEFINER` autorizadas, que finaliza como `abandoned` o residual `in_progress` nas duas tabelas, uma única vez. Não recebe `GRANT EXECUTE` para `service_role`; revalida operação existente e linha financeira não terminal.

A listagem administrativa SHALL separar três consultas: **execução ativa** (view de ativos), **histórico/progresso** (view de histórico, preservando `latestAttemptAt`) e **origem/etapa** (registro canônico da operação, mesmo entre etapas, sem claim ativo nem desfecho). A view de ativos não substitui o histórico.

Mudanças compartilhadas, **exatamente localizadas**:

| Ponto | Arquivo / objeto atual | Mudança proposta | Motivo |
|---|---|---|---|
| Encerramento por falha | `product_1_1_close_failed_operation` (`20261016000001...:255-289`) | consultar `product_generation_active_claims_v` e `product_generation_operation_outcomes_v`, preservando o fence de publicação e o frescor de epoch | impedir PF com etapa ativa e reconhecer `failed` da nova operação |
| Resolução administrativa | `admin_resolve_product_1_1_pending` (`20261016000001...:305-414`) | consultar as views, chamar `product_abandon_residual_attempts` no caminho autorizado e preservar o fechamento autorizado de publicação | impedir fechamento indevido e abandonar residual das duas fontes |
| Leitura de operação | `product_1_1_get_campaign_operation_by_campaign` (`20261015000003...:53-81`) | ler `outcome`/`support_reference` da view de desfechos | exibir `unknown`/`failed` da nova operação na recuperação/detalhe |
| Listagem de pendências | `src/lib/product-1-1/pending/pending-operations-repository.ts` `readClaims` (`:157-166`) | ler a view de claims (e o estado das etapas) | listar `processing` e última tentativa da nova operação |
| Superfície administrativa | `src/app/api/admin/product-1-1-pending/route.ts` | despachar por formato/controle, sem criar segunda fila | uma única superfície de atendimento |

Cada `CREATE OR REPLACE` preserva a assinatura e o comportamento para operações legadas. No caso de `product_1_1_close_failed_operation`, a assinatura vigente inclui `p_observed_epoch` e o fence de publicação; ambos devem ser preservados e cobertos pela prova. A aceitação exige uma **suíte de compatibilidade** que execute os cenários 1:1 e 9:16 direto contra as mesmas fixtures antes/depois da mudança e prove resultados idênticos.

**Autoridade e origem na leitura compartilhada:** as views são recortadas por origem canônica (D3). A operação nova não pode aparecer simultaneamente como legada e nova, e um desfecho não pode ser lido de duas fontes para a mesma operação. A decisão financeira continua sendo tomada exclusivamente sobre `product_1_1_campaign_credit_operations`; as views apenas informam tentativa ativa e desfecho operacional. A resolução administrativa SHALL revalidar a linha financeira sob a trava e impedir nova execução mesmo que a linha operacional esteja atrasada.

**Isolamento da prova:** IDs exclusivos isolam os **dados**, mas não isolam as **RPCs compartilhadas** alteradas. Durante a prova em homolog, essas rotinas não podem ser usadas por outra execução concorrente sem coordenação. O checkpoint deve registrar a janela de exclusividade e confirmar que nenhuma outra execução do ambiente usa as rotinas afetadas.

**Alternativas rejeitadas:** (a) duplicar as rotinas de encerramento para o novo fluxo — duas fontes de verdade, risco de o administrador usar o caminho errado; (b) validar apenas no serviço TypeScript — não cobre chamadas SQL diretas nem fecha a corrida com a etapa ativa; (c) escrever os claims novos na tabela legada — distorce o contrato e a política de tentativas.

### D8 — Resultado desconhecido e respostas tardias

- O desfecho `unknown` é gravado uma única vez, imutável, com a etapa de origem e `support_reference`; a operação entra em estado que **recusa** novas tentativas e **não** autoriza estorno automático. Timeout, abort e perda de comunicação após possível envio são `unknown` (D6).
- Toda finalização de tentativa é um **CAS por `attempt_token` + status esperado**, mas o CAS SHALL revalidar a **linha financeira** sob a trava C4. Se ela já estiver `delivered` ou `refunded`, ou se existir `unknown` persistido, a finalização tardia é recusada (`operation_terminal`/`operation_unknown`) e **não** produz entrega, upload, confirmação ou estorno — mesmo que a linha operacional ainda diga `in_progress`.
- A resolução de `unknown` é humana/administrativa, com motivo, evidência server-side e auditoria na mesma transação; reexecutar a mesma resolução é idempotente e divergir é conflito. A resolução que encerra ou estorna transita a linha financeira na mesma transação; a partir daí, novas tentativas e respostas tardias são recusadas pela autoridade financeira, e não por um estado copiado no módulo.
- A auditoria reutiliza a ação existente `product_1_1_pending_resolution`, com metadado que identifica explicitamente o novo fluxo e a etapa. Não se cria ação nova nem se amplia o CHECK compartilhado.

### D9 — Retomadas

A retomada lê o estado persistido (operação, etapas, claims e desfechos) e decide:

- base `done` → **não** regenera a base; segue para expansão se ainda pendente;
- base `failed` transitória → pode iniciar a próxima tentativa dentro da política por alvo (`primary` se ainda houver, senão `fallback`), com o mesmo limite de 3; base `failed` definitiva/desconhecida → não reinicia;
- expansão `in_progress` sem desfecho → não inicia outra tentativa; aguarda ou encaminha à resolução;
- expansão `failed` transitória com 1 tentativa usada → pode iniciar a segunda e última;
- qualquer etapa `failed` definitiva ou operação terminal → não reinicia;
- a reserva é idempotente por `(campaign_id, operation_id)`: retomada nunca cobra de novo;
- toda retomada relê a linha financeira sob a trava antes de decidir; se ela estiver terminal, nenhuma etapa inicia, mesmo que o registro operacional esteja desatualizado.

### D10 — Prova inicial de viabilidade (primeira tarefa da futura execução)

A primeira tarefa **não** implementa o módulo completo. Ela cria o mínimo de banco (tabelas, views, funções, travas) e um harness de etapas simuladas, sem IA, e executa os cenários obrigatórios:

1. reserva → base simulada concluída → expansão simulada concluída → entrega; exatamente 1 crédito consumido;
2. falha definitiva da expansão → exatamente 1 estorno;
3. requisições concorrentes distintas → somente uma execução autorizada;
4. repetição da mesma requisição → sem nova cobrança ou execução duplicada;
5. **duas requisições simultâneas com o mesmo `request_id`** → exatamente uma recebe `authorization='execute'`; a outra recebe apenas `query_only` e não executa;
6. interrupção após a base → continuidade sem repetir a geração;
7. limite de expansão preservado entre retomadas;
8. resultado desconhecido (incluindo timeout/abort/perda de comunicação após possível envio) → sem repetição/estorno cego e com caminho seguro de resolução;
9. resposta tardia após encerramento → sem entrega ou cobrança adicional;
10. encerramento financeiro concorrente com etapa ativa → protegido (inclusive pelas rotinas compartilhadas);
11. **administrador encerra/estorna → resposta tardia e nova tentativa são recusadas pela linha financeira**, mesmo com registro operacional atrasado;
12. fluxos atuais 1:1 e 9:16 direto preservados (suíte de compatibilidade);
13. **origem canônica** → a união não produz desfecho duplicado ou conflitante para a mesma operação, e a abertura recusa adotar uma identidade já pertencente ao fluxo antigo (`operation_origin_conflict`), preservando claims antigos visíveis.

Evidência: logs SQL, contagens de `credit_transactions`, estados persistidos, hashes de artefatos simulados e resultados de concorrência. **A prova não é aceitação produtiva.** Se falhar, a execução para e o desenho volta para revisão.

### D11 — Ambiente da prova

Destino proposto: **homolog existente** `vendeo-homolog` (`supabase_db_vendeo-homolog`, `127.0.0.1:57782`, banco `postgres`), porque:
- é o único ambiente com Supabase completo em execução observado nesta investigação;
- permite exercitar transações, travas, RLS e RPCs reais, o que mocks não substituem;
- já é o ambiente usado pelas fases anteriores.

Ele **não é descartável**. Condições obrigatórias antes de qualquer escrita:

- identificação inequívoca do destino: host/porta/banco + fingerprint do ledger capturado antes (esperado: 153 migrations, última `20261105162052`);
- loja, usuário e campanhas **exclusivos de teste**, com prefixo próprio (ex.: `p916test-`) e IDs registrados em manifesto;
- snapshot S0 somente leitura antes e depois, contagens e hashes; nenhuma semeadura ou remoção fora dos IDs criados;
- migrations necessárias listadas e aplicadas uma única vez, com timestamp real e unicidade verificada; `REVERT` manual documentado;
- limpeza limitada **exclusivamente** aos IDs de teste criados, com evidência; `credit_transactions` é append-only e não é apagado;
- autorizações explícitas e separadas para: aplicar migrations, escrever dados de teste, executar a prova e limpar;
- **run id único por execução**, diretório de evidência exclusivo e manifesto validado contra o mesmo run id; manifesto ausente/inválido/de outra execução ⇒ cleanup aborta sem apagar;
- cleanup **conservador**: em homolog não descartável, não apaga origem canônica, operações pendentes, ledger, desfechos ou auditoria; classifica cada item como `deleted`/`retained` com motivo. Nenhum cleanup automático em `finally`; sem autorização D, nada é apagado;
- comparação **esperado × observado** por tabela e validação efetiva do ledger por contagem/SHA excluindo F60; verificação pós-cleanup com novo snapshot;
- **janela de exclusividade das RPCs compartilhadas**: como a prova altera rotinas usadas por outros fluxos, nenhuma outra execução concorrente do ambiente pode usar essas rotinas durante a janela; o responsável registra a janela e confirma a ausência de uso concorrente. IDs de teste não isolam essa dimensão.

Alternativa registrada: uma instância local isolada e descartável para a prova, se o time preferir não escrever em homolog. Requer criação de ambiente e autorização próprias; não foi criada nem iniciada nesta etapa. **Decisão recomendada e adotada:** homolog com autorização específica, sujeito às condições acima.

### D12 — Separação de estágios

- **Local:** migrations autoradas, testes unitários, typecheck/lint/build, OpenSpec strict. Não prova produção.
- **Homolog:** prova transacional real do checkpoint, com dados de teste e evidências. Não é aceitação produtiva.
- **Produção:** fora desta fatia; exigirá gates próprios de migration, deploy, flag, ativação e smoke, além da implementação completa do fluxo.

## Risks / Trade-offs

- **[Regressão nas rotinas compartilhadas de encerramento/pendência]** → `CREATE OR REPLACE` com assinatura preservada, views de união e suíte de compatibilidade 1:1/9:16 direto antes/depois; rollback por reexecução da definição anterior documentada.
- **[Custo/desempenho das views em consultas administrativas]** → volumes pequenos, filtros por `(campaign_id, operation_id)` e índices nas tabelas de origem; medir na prova.
- **[Deadlock entre nova RPC, entrega e resolução administrativa]** → ordem fixa de travas (advisory de identidade → C4 → linha de controle) e teste de concorrência explícito.
- **[A prova passar e ser confundida com prontidão de produção]** → seção D12 e critérios de aceite separados por estágio; o checkpoint é explicitamente não produtivo.
- **[Política da base divergir do motor aprovado]** → decisão D6 registrada e aprovada (2 principal + 1 fallback); nenhuma mudança silenciosa.
- **[Repetir uma chamada cujo resultado apenas não chegou]** → timeout/abort/perda de comunicação após possível envio é `unknown`; nenhuma repetição automática.
- **[Duas requisições com o mesmo token executarem duas vezes]** → `authorization='execute'` só para o vencedor; reenvio é `query_only`; teste concorrente com o mesmo `request_id`.
- **[Estado operacional atrasado permitir execução após encerramento]** → a linha financeira é a autoridade e é revalidada sob a trava em toda transição; teste explícito de encerramento/estorno seguido de resposta tardia e nova tentativa.
- **[União de fontes duplicar desfechos]** → origem canônica por operação e anti-join nas views; teste de não duplicidade.
- **[Uso concorrente das RPCs compartilhadas durante a prova]** → janela de exclusividade registrada e confirmação de ausência de uso concorrente; IDs de teste não cobrem essa dimensão.
- **[Resultado desconhecido sem caminho de resolução]** → desfecho persistido + resolução administrativa auditada; sem estorno por timeout e sem repetição cega.
- **[Uso indevido de homolog]** → escopo por IDs, snapshot S0, limpeza limitada e autorizações separadas; nenhuma operação destrutiva.
- **[Colisão de migration]** → timestamp real UTC e conferência de unicidade na worktree, branch de destino e branches paralelas antes e depois da integração.

## Migration Plan

1. Aprovar esta proposta (incluindo D6 e D11).
2. Na futura execução, criar migrations apenas das tabelas/views/funções de controle e das mudanças compartilhadas localizadas, com timestamp real e bloco `REVERT`.
3. Validar localmente: OpenSpec strict, testes unitários, typecheck, lint e build.
4. Checkpoint de banco: aplicar em homolog **somente** com autorização explícita, registrar fingerprint do ledger e S0 antes/depois.
5. Executar a prova mínima (D10). Reprovou → parar e revisar o desenho.
6. Limpar apenas os dados de teste criados, com evidência.
7. Produção e ativação: **não** fazem parte desta fatia.

Rollback: cada migration terá `REVERT` manual; a reexecução da definição anterior das RPCs compartilhadas restaura o comportamento legado. Nenhuma migration é renomeada ou reparada silenciosamente.

## Resolved in Planning

- **Retenção dos dados de teste:** remoção imediata após a prova, limitada aos IDs `p916test-`; as evidências (JSON/MD) permanecem no diretório da fase. `credit_transactions` não é apagada.
- **Janela de exclusividade das RPCs compartilhadas:** coordenada e registrada antes da prova, com início/fim/responsável e confirmação de ausência de uso concorrente; sem prazo arbitrário fixo. A janela cobre aplicação, prova e limpeza.
- **Precedência do desfecho agregado:** o primeiro desfecho persistido (`failed`/`unknown`) é imutável e governa a operação; a etapa de origem fica registrada. Replay divergente é `operation_identity_conflict`, nunca sobrescrita.
