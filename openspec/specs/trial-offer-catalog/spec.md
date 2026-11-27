# Trial Offer Catalog

## Purpose

Definir o catalogo versionado de ofertas: identidade estavel pelo offer_key, versoes publicadas e imutaveis com frequencia e creditos por liberacao, referencia vigente, calendario derivado, contratos de leitura fail-closed e garantias de publicacao, vigencia, autoria e concorrencia.

## Requirements

### Requirement: Identidade estável da oferta

O sistema SHALL identificar o programa promocional pelo `offer_key` de `public.trial_offer_settings`, sem criar uma tabela separada apenas para a identidade da oferta. Toda versão SHALL referenciar um `offer_key` existente.

#### Scenario: Versão vinculada ao programa existente

- **WHEN** uma versão é inserida com `offer_key = 'trial_28d_v1'`
- **THEN** a versão é aceita e fica vinculada ao programa já existente em `trial_offer_settings`

#### Scenario: Versão com programa inexistente

- **WHEN** uma versão é inserida com um `offer_key` que não existe em `trial_offer_settings`
- **THEN** o banco rejeita a inserção por violação de chave estrangeira

#### Scenario: Múltiplas versões do mesmo programa

- **WHEN** duas versões são publicadas com o mesmo `offer_key` e `version_label` distintos
- **THEN** ambas coexistem, e cada uma mantém suas próprias condições imutáveis

### Requirement: Condições versionadas com frequência e créditos por liberação

O sistema SHALL armazenar em `public.trial_offer_versions` as condições publicadas: `public_name`, `duration_days`, `max_total_credits`, `release_frequency` (`once`, `daily`, `weekly` ou `monthly`) e `credits_per_release`. O sistema SHALL NOT criar tabela filha nem JSON de parcelas nesta entrega.

#### Scenario: Oferta recorrente válida

- **WHEN** uma versão é cadastrada com `release_frequency = 'weekly'`, `credits_per_release = 5`, `max_total_credits = 20` e `duration_days = 28`
- **THEN** a versão é aceita e representa quatro liberações de 5 créditos

#### Scenario: Oferta única

- **WHEN** uma versão é cadastrada com `release_frequency = 'once'` e `credits_per_release` vazio
- **THEN** a versão é aceita e a única liberação usa `max_total_credits`

#### Scenario: Oferta única com créditos por liberação

- **WHEN** uma versão é cadastrada com `release_frequency = 'once'` e `credits_per_release` preenchido
- **THEN** o banco rejeita a versão por inconsistência entre frequência e créditos por liberação

#### Scenario: Oferta recorrente sem créditos por liberação

- **WHEN** uma versão é cadastrada com frequência recorrente e `credits_per_release` nulo, zero ou negativo
- **THEN** o banco rejeita a versão

#### Scenario: Créditos por liberação acima do teto

- **WHEN** uma versão recorrente é cadastrada com `credits_per_release` maior que `max_total_credits`
- **THEN** o banco rejeita a versão

### Requirement: Imutabilidade das condições publicadas

Uma versão com `published_at` preenchido SHALL ter suas condições congeladas. O sistema SHALL rejeitar qualquer atualização de `id`, `public_name`, `duration_days`, `max_total_credits`, `release_frequency`, `credits_per_release`, `published_at`, `publication_reason`, `created_at`, `offer_key` ou `version_label`, e SHALL rejeitar sua exclusão. `published_by` SHALL ser definido apenas na primeira publicação (NULL→UUID ou NULL) e, depois de publicado, SHALL apenas transicionar UUID→NULL por ação referencial. `created_by` SHALL apenas transicionar para NULL.

#### Scenario: Tentativa de alterar condição publicada

- **WHEN** uma atualização tenta alterar `credits_per_release` de uma versão já publicada
- **THEN** o banco rejeita a atualização e a versão permanece com os valores anteriores

#### Scenario: Tentativa de alterar identificador publicado

- **WHEN** uma atualização tenta alterar `id` de uma versão já publicada
- **THEN** o banco rejeita a atualização

#### Scenario: Tentativa de excluir versão publicada

- **WHEN** uma exclusão é executada sobre uma versão já publicada
- **THEN** o banco rejeita a exclusão

#### Scenario: Rascunho editável

- **WHEN** uma versão ainda não publicada tem suas condições atualizadas ou é excluída
- **THEN** a operação é permitida, desde que a versão não esteja referenciada como vigente

#### Scenario: Mudança da versão vigente não reescreve a anterior

- **WHEN** `current_version_id` passa a apontar para uma versão nova
- **THEN** a versão anterior mantém integralmente suas condições e seu estado publicado

### Requirement: Metadados de autoria compatíveis com a imutabilidade

O sistema SHALL registrar `created_by`, `published_by`, `published_at` e `publication_reason`. Em rascunho, `published_by` SHALL ser NULL. Na primeira publicação, `published_by` SHALL poder ser NULL ou um UUID. Após a publicação, `published_by` SHALL apenas transicionar UUID→NULL por ação referencial; UUID→outro UUID SHALL ser rejeitado. `created_by` SHALL apenas transicionar para NULL em qualquer estágio. A exclusão de um usuário autenticado SHALL poder definir `created_by`/`published_by` como `NULL` sem alterar nenhuma condição da versão.

#### Scenario: Rascunho com published_by preenchido

- **WHEN** um INSERT de rascunho (`published_at IS NULL`) traz `published_by` não nulo
- **THEN** o banco rejeita com `trial_offer_publisher_requires_publication`

#### Scenario: Primeira publicação com published_by

- **WHEN** um rascunho recebe `published_at`, motivo, calendário válido e `published_by` NULL→UUID
- **THEN** a publicação é aceita e `published_by` fica registrado

#### Scenario: Rascunho editado com published_by

- **WHEN** um UPDATE rascunho→rascunho tenta definir ou alterar `published_by`
- **THEN** o banco rejeita com `trial_offer_publisher_requires_publication`

#### Scenario: Exclusão de usuário que publicou a versão

- **WHEN** um usuário referenciado em `published_by` é excluído de `auth.users`
- **THEN** `published_by` passa a `NULL`, e todas as condições e o estado de publicação permanecem inalterados

#### Scenario: Tentativa de trocar autoria por outro usuário

- **WHEN** uma atualização tenta substituir `published_by` de uma versão publicada por outro UUID
- **THEN** o banco rejeita a atualização

#### Scenario: Tentativa de alterar condição junto com a autoria

- **WHEN** uma atualização tenta definir `published_by = NULL` e, na mesma instrução, alterar uma condição
- **THEN** o banco rejeita a atualização inteira

### Requirement: Publicação validada e unilateral

A publicação SHALL ser validada tanto na transição de rascunho para publicada quanto na inserção direta de versão já publicada. A transição SHALL ocorrer no máximo uma vez por versão, SHALL exigir `publication_reason` não vazio, SHALL validar a consistência das condições e SHALL rejeitar configurações cujo calendário não alcance `max_total_credits` dentro de `duration_days` para qualquer data de início. Na primeira publicação, `published_by` SHALL poder ser definido de NULL para UUID (ou permanecer NULL). Após a publicação, o sistema SHALL NOT permitir despublicar nem publicar novamente a mesma versão.

#### Scenario: Publicação válida

- **WHEN** uma versão em rascunho com condições consistentes recebe `published_at` e um motivo não vazio
- **THEN** a versão é publicada e passa a ser imutável

#### Scenario: Inserção direta de versão publicada válida

- **WHEN** uma versão é inserida já com `published_at`, motivo não vazio e calendário que alcança o total
- **THEN** a inserção é aceita e a versão nasce imutável

#### Scenario: Inserção direta de versão publicada sem motivo

- **WHEN** uma versão é inserida já com `published_at` e sem `publication_reason`
- **THEN** o banco rejeita a inserção

#### Scenario: Inserção direta com calendário insuficiente

- **WHEN** uma versão é inserida já publicada com calendário que não alcança `max_total_credits` dentro da duração
- **THEN** o banco rejeita a inserção

#### Scenario: Publicação cujo calendário não alcança o total

- **WHEN** uma versão mensal com total 20, 5 créditos por liberação e duração de 28 dias tenta ser publicada
- **THEN** o banco rejeita a publicação, porque nenhuma data de início permitiria alcançar o total dentro da janela

#### Scenario: Publicação sem motivo

- **WHEN** uma versão em rascunho tenta ser publicada sem `publication_reason`
- **THEN** o banco rejeita a publicação

#### Scenario: Publicação com condições inválidas

- **WHEN** uma versão em rascunho tenta ser publicada com frequência e créditos por liberação inconsistentes
- **THEN** o banco rejeita a publicação

#### Scenario: Segunda publicação da mesma versão

- **WHEN** uma versão já publicada recebe uma nova tentativa de publicação
- **THEN** o banco rejeita a operação e a versão permanece como estava

#### Scenario: Tentativa de despublicação

- **WHEN** uma atualização tenta definir `published_at = NULL` em uma versão publicada
- **THEN** o banco rejeita a atualização

### Requirement: Publicação concorrente consistente

O sistema SHALL serializar publicação e edição concorrentes da mesma versão. O sistema SHALL garantir que, no máximo, uma publicação seja efetivada e que nenhuma condição seja alterada depois do congelamento.

#### Scenario: Edição concorrente com publicação

- **WHEN** duas transações tentam, simultaneamente, editar condições e publicar a mesma versão em rascunho
- **THEN** a primeira concluída define o estado; se a publicação vencer, a edição é rejeitada; se a edição vencer, a publicação valida e congela o estado editado

#### Scenario: Duas publicações simultâneas

- **WHEN** duas transações tentam publicar a mesma versão em rascunho ao mesmo tempo
- **THEN** apenas uma publicação é efetivada e a outra é rejeitada

### Requirement: Referência vigente apenas para versão publicada do mesmo programa

O sistema SHALL manter `public.trial_offer_settings.current_version_id` apontando para uma versão publicada do mesmo `offer_key`. Após o preenchimento inicial, a coluna SHALL ser `NOT NULL`. A chave `enabled` SHALL permanecer independente da referência vigente.

#### Scenario: Vigência apontando para rascunho

- **WHEN** uma atualização tenta definir `current_version_id` para uma versão com `published_at` nulo
- **THEN** o banco rejeita a atualização

#### Scenario: Vigência apontando para outro programa

- **WHEN** uma atualização tenta definir `current_version_id` para uma versão de `offer_key` diferente
- **THEN** o banco rejeita a atualização por violação da chave estrangeira composta

#### Scenario: Desligar novas adesões não limpa a vigência

- **WHEN** `enabled` é definido como `false`
- **THEN** `current_version_id` permanece inalterado, as concessões existentes não são canceladas e as versões não são modificadas

#### Scenario: Vigência nula após o preenchimento inicial

- **WHEN** uma atualização tenta definir `current_version_id = NULL` depois do seed
- **THEN** o banco rejeita a atualização

#### Scenario: Divulgação independente de `enabled`

- **WHEN** a leitura pública da oferta é solicitada com `enabled = false` e uma versão vigente publicada
- **THEN** a leitura retorna os dados públicos da versão vigente, sem tratar `enabled` como condição de divulgação

### Requirement: Oferta inicial versionada

O sistema SHALL publicar a versão inicial `v1` do programa `trial_28d_v1` com `public_name = 'Teste gratuito de 28 dias'`, `duration_days = 28`, `max_total_credits = 20`, `release_frequency = 'weekly'` e `credits_per_release = 5`, e SHALL defini-la como vigente.

#### Scenario: Leitura da oferta inicial

- **WHEN** a versão vigente é lida
- **THEN** os campos retornados correspondem a 28 dias, 20 créditos, frequência semanal e 5 créditos por liberação

#### Scenario: Calendário da oferta inicial

- **WHEN** o calendário da versão inicial é derivado a partir de um início
- **THEN** são produzidas quatro liberações de 5 créditos nos dias 0, 7, 14 e 21, totalizando 20, igual a `max_total_credits`

#### Scenario: Seed não altera concessões

- **WHEN** a versão inicial é semeada
- **THEN** nenhuma linha de `trial_offer_enrollments`, `credit_balances`, `credit_transactions` ou `freemium_entitlements` é alterada

### Requirement: Calendário derivado dos parâmetros e do início da concessão

O sistema SHALL derivar o calendário de liberações a partir de `release_frequency`, `credits_per_release`, `max_total_credits`, `duration_days` e do início da concessão. A primeira liberação SHALL ser imediata. As seguintes SHALL seguir a frequência, usando mês de calendário quando mensal. A última liberação SHALL ser limitada ao crédito restante. O total derivado SHALL ser sempre igual a `max_total_credits`, e o calendário SHALL NOT ser truncado pela duração. Nenhuma liberação SHALL ocorrer a partir do instante de vencimento. A função de calendário SHALL fixar `TimeZone = 'UTC'` na própria definição, para que `make_interval(months => n)`, a aritmética de dias e a serialização de `timestamptz` sejam independentes do TimeZone da sessão.

#### Scenario: Oferta semanal

- **WHEN** uma versão semanal de 5 créditos por liberação, teto 20 e duração 28 dias é derivada a partir de `started_at`
- **THEN** as liberações ocorrem em `started_at`, `started_at + 7 dias`, `started_at + 14 dias` e `started_at + 21 dias`, com 5 créditos cada

#### Scenario: Oferta mensal com meses de durações diferentes

- **WHEN** uma versão mensal é derivada a partir de um início
- **THEN** cada liberação seguinte usa o mesmo dia do mês de calendário, com ajuste para o último dia do mês quando o dia não existir, respeitando a variação real entre meses e não um intervalo fixo de 30 dias

#### Scenario: Última liberação limitada ao restante

- **WHEN** uma versão recorrente tem teto 20 e 7 créditos por liberação
- **THEN** as liberações são 7, 7 e 6, sem ultrapassar o teto e alcançando o total

#### Scenario: Total sempre alcançado

- **WHEN** o calendário de uma versão publicada é derivado para qualquer data de início
- **THEN** a soma das liberações é igual a `max_total_credits`

#### Scenario: Oferta única

- **WHEN** uma versão com `release_frequency = 'once'` é derivada
- **THEN** existe uma única liberação em `started_at`, com o valor de `max_total_credits`

#### Scenario: Liberação no instante de vencimento

- **WHEN** uma liberação cairia exatamente em `started_at + duration_days`
- **THEN** ela não é incluída no calendário

#### Scenario: Calendário independente do timezone da sessão

- **WHEN** o mesmo `started_at` (incluindo um valor de borda de mês, como `2026-01-31T23:30:00Z`) é derivado sob `TimeZone` de sessão `UTC`, `America/Sao_Paulo` e `Asia/Tokyo`
- **THEN** `expires_at`, cada `due_at`, a lista de liberações e o total são idênticos nos três casos, porque a função fixa `TimeZone = 'UTC'`

### Requirement: Contratos de leitura centralizados

O sistema SHALL oferecer leitura centralizada das condições vigentes, das condições de uma versão específica e do calendário derivado. As funções SHALL ser executáveis apenas por `service_role`, SHALL falhar fechado quando não houver versão publicada e SHALL NOT expor dados pessoais, identificadores internos ou dados de concessão na projeção pública. O helper interno `trial_offer_calendar_reaches_total` SHALL ser `LANGUAGE sql IMMUTABLE SECURITY INVOKER` com `search_path = ''`; as três funções de leitura SHALL ser `STABLE SECURITY DEFINER` com `search_path = ''`; `trial_offer_release_schedule` SHALL acrescentar `TimeZone = 'UTC'`; todas SHALL ter EXECUTE restrito a `service_role`.

#### Scenario: Leitura das condições vigentes

- **WHEN** `trial_offer_conditions` é chamada sem identificador de versão
- **THEN** retorna as condições da versão apontada por `current_version_id`

#### Scenario: Leitura de uma versão específica

- **WHEN** `trial_offer_conditions` é chamada com o identificador de uma versão publicada
- **THEN** retorna as condições daquela versão, permitindo leitura futura das condições adquiridas por uma concessão

#### Scenario: Leitura de versão não publicada

- **WHEN** a leitura solicita uma versão com `published_at` nulo
- **THEN** a função falha fechada, sem retornar condições parciais

#### Scenario: Projeção pública

- **WHEN** `trial_offer_public_offer` é chamada
- **THEN** retorna nome público, duração, total, frequência e créditos por liberação, sem contagem de liberações, UUIDs, auditoria, `offer_key` interno ou dados de concessão

#### Scenario: Projeção pública sem contagem dependente da data

- **WHEN** a projeção pública é lida para uma oferta mensal
- **THEN** nenhuma contagem efetiva de liberações é retornada, porque ela depende de `started_at` e pertence apenas à leitura de calendário

#### Scenario: Calendário retorna o total da versão

- **WHEN** `trial_offer_release_schedule` é chamada para uma versão publicada e um início
- **THEN** o total retornado é igual a `max_total_credits` da versão

#### Scenario: Acesso indevido às funções

- **WHEN** um chamador `anon` ou `authenticated` tenta executar as funções de leitura
- **THEN** o banco nega a execução

#### Scenario: Contratos de volatilidade e segurança das funções

- **WHEN** o catálogo do banco é inspecionado
- **THEN** `trial_offer_calendar_reaches_total` tem `provolatile = 'i'` e `prosecdef = false`; `trial_offer_conditions`, `trial_offer_public_offer` e `trial_offer_release_schedule` têm `provolatile = 's'` e `prosecdef = true`; todas têm `search_path` vazio e EXECUTE apenas para `service_role`

### Requirement: Sem backfill e sem alteração de concessões nesta subfatia

A subfatia 2A SHALL NOT alterar `public.trial_offer_enrollments`, SHALL NOT adicionar `offer_version_id` a concessões existentes e SHALL NOT executar backfill. O caminho atual de concessão SHALL continuar funcionando sem a referência de versão.

#### Scenario: Esquema de concessões inalterado

- **WHEN** a 2A é concluída
- **THEN** `trial_offer_enrollments` mantém exatamente as colunas e restrições anteriores, sem `offer_version_id`

#### Scenario: Concessões existentes preservadas

- **WHEN** os dados são comparados antes e depois da 2A
- **THEN** contagens e valores de `trial_offer_enrollments` permanecem iguais

#### Scenario: Caminho atual de concessão

- **WHEN** `start_trial_offer_enrollment` é executada após a 2A
- **THEN** a inscrição é criada como antes, sem referência de versão e sem erro

### Requirement: Consumidores e créditos preservados

A subfatia 2A SHALL NOT alterar constantes, status, conclusão de onboarding, copy pública, painel administrativo ou RPCs de elegibilidade/concessão/parcelas. A leitura do calendário SHALL NOT reservar créditos nem criar transações.

#### Scenario: Constantes e consumidores inalterados

- **WHEN** a 2A é concluída
- **THEN** `constants.ts`, `status.ts`, `completion.ts`, `public-offer-copy.ts`, painel Admin e RPCs de oferta permanecem com o comportamento anterior

#### Scenario: Leitura sem reserva

- **WHEN** o calendário de uma versão é derivado
- **THEN** nenhuma linha é criada em `credit_balances`, `credit_transactions` ou estruturas de reserva

#### Scenario: Suítes existentes continuam verdes

- **WHEN** os testes de comportamento da oferta atual são executados após a 2A
- **THEN** eles passam sem alteração de expectativa
