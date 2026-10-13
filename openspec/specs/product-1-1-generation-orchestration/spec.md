# Product 1:1 Generation Orchestration

> Synced from `fase-56-2b1b-nucleo-entregavel-produto-1-1` (ADDED).

## Purpose

Orquestração do novo fluxo Produto 1:1 **dentro do ciclo da requisição**: preflight fail-closed, snapshot congelado, política 2+1, início de tentativa atômico no Postgres, tratamento de resultado desconhecido e resolução administrativa auditada — **sem** execução durável (diferida) e mantendo a limitação aceita da b1b como **gate obrigatório da b2**.

## Requirements

### Requirement: Preflight e execução da política

A execução SHALL resolver configuração fail-closed e exigir pricing `complete` para principal e fallback antes de reserva/provider. Política limita principal a duas tentativas e fallback a uma; rate_limit repete uma vez no principal; indisponibilidade explícita pode ir ao fallback; quota/faturamento não. O par principal é `gpt-image-2.5-sunburst / medium` e o fallback é `gpt-image-2 / medium`.

#### Scenario: Pricing incompleto bloqueia

- **WHEN** qualquer par tem pricing parcial/ausente
- **THEN** não reserva crédito nem chama provider

#### Scenario: Limite de tentativas respeitado

- **WHEN** tentativas falham conforme política
- **THEN** principal não excede duas e total não excede três chamadas

### Requirement: Snapshot congelado antes da reserva/provider

A execução SHALL persistir, antes da reserva e de qualquer chamada ao provider, um snapshot imutável que congela o briefing, as referências/seleções (intenção, direção de fundo, imagens) e as **versões de composição** (base, compositor, políticas), além do par principal/fallback modelo+qualidade com versão/origem. Falha ao persistir o snapshot SHALL bloquear a operação. A execução SHALL NOT reler configuração mutável.

#### Scenario: Snapshot persiste antes do crédito/provider

- **WHEN** a campanha elegível inicia
- **THEN** o snapshot congelado é gravado antes de reserva e provider
- **AND** nenhuma configuração mutável é lida depois do congelamento

#### Scenario: Correção reutiliza o snapshot original

- **WHEN** a mesma campanha é corrigida/regerada
- **THEN** o snapshot original congelado é reutilizado
- **AND** a configuração vigente não é adotada

### Requirement: Histórico append-only por tentativa

Cada tentativa SHALL ser registrada append-only, vinculada à campanha e ao snapshot, preservando `run_id`/`trace_id` e sem sobrescrever referências anteriores. O histórico SHALL permitir reconstruir o par modelo–qualidade e o alvo de cada tentativa.

#### Scenario: Tentativas sucessivas preservam histórico

- **WHEN** há múltiplas tentativas (principal e fallback)
- **THEN** cada tentativa é registrada sem sobrescrever as anteriores
- **AND** a sequência de tentativas é reconstruível

### Requirement: Execução no ciclo da requisição com limites

A orquestração SHALL executar **dentro do ciclo da requisição**, respeitando limites explícitos (teto de duração da função/rota, timeout próprio da chamada ao provider e política 2+1). As tentativas SHALL pertencer à mesma operação persistida (`campaignId + operation_id`), sem criar operações paralelas. **Não** SHALL existir fila/outbox, worker, cron/dispatcher, claim/lease/fencing, continuidade após fechar a página ou retomada automática nesta fatia.

#### Scenario: Tentativas pertencem à mesma operação

- **WHEN** a política executa principal e fallback
- **THEN** todas as tentativas atualizam a mesma operação
- **AND** nenhuma operação adicional é criada

#### Scenario: Reenvio apenas consulta a operação

- **WHEN** o lojista reenvia o mesmo pedido para a mesma `campaignId + operation_id`
- **THEN** o sistema **consulta** a operação existente
- **AND** se houver arte salva, recupera essa arte
- **AND** se o resultado continuar desconhecido, **não** chama o modelo novamente
- **AND** nenhuma tentativa nova, geração ou cobrança é iniciada

#### Scenario: Sem continuidade garantida

- **WHEN** a conexão cai durante a execução
- **THEN** não é garantido que o processamento continue
- **AND** também não é afirmado que a chamada já despachada ao provider seja necessariamente cancelada

### Requirement: Início de tentativa atômico no banco

Duas requisições simultâneas SHALL NOT chamar o provider duas vezes para a mesma operação. A reserva financeira idempotente, **isoladamente, não garante isso**. Um **controle atômico de início de tentativa no Postgres** SHALL garantir **um único início de tentativa por vez**, sem fila, cron ou worker. O teto 2+1 SHALL pertencer à **operação inteira** (persistido), não a cada reenvio.

#### Scenario: Duas requisições simultâneas

- **WHEN** duas requisições concorrentes tentam iniciar tentativa para a mesma operação
- **THEN** apenas uma adquire o início de tentativa
- **AND** a outra consulta/aguarda e **não** dispara chamada ao provider

#### Scenario: Teto por operação, não por reenvio

- **WHEN** reenvios ocorrem durante a operação
- **THEN** o teto 2+1 continua contado na operação inteira
- **AND** nenhum reenvio amplia o teto

### Requirement: Resultado desconhecido do provider

Quando o resultado da chamada ao provider é desconhecido (ex.: timeout), a operação SHALL ficar **pendente/limitada**. **Não** SHALL repetir cegamente, **não** SHALL estornar com base apenas em timeout e **não** SHALL retomar — nem automaticamente, **nem por reenvio do lojista** (que é somente consulta). A **UI** SHALL exibir **“Não foi possível confirmar a conclusão desta geração”** com a **referência de suporte**, e **não** SHALL oferecer **“Gerar novamente”** para essa mesma operação. A resolução SHALL ocorrer por **suporte/admin, com evidência** (requisito “Resolução de pendência por suporte/admin”), sem re-queue.

#### Scenario: Timeout não gera nova chamada cega

- **WHEN** a chamada ao provider não retorna resultado definitivo
- **THEN** nenhuma nova chamada automática é feita
- **AND** a operação fica pendente/limitada

#### Scenario: Timeout não estorna

- **WHEN** o único sinal é timeout
- **THEN** nenhum estorno é executado com base apenas no timeout
- **AND** a operação permanece pendente

#### Scenario: Reenvio não retoma

- **WHEN** o lojista reenvia uma operação com resultado desconhecido
- **THEN** o sistema apenas consulta a operação
- **AND** não chama o modelo novamente
- **AND** não oferece ação de “Gerar novamente” para essa operação

### Requirement: Resolução de pendência por suporte/admin

A resolução de uma operação pendente/limitada SHALL ser feita por **administrador autorizado**, com **motivo obrigatório** e **registro auditável das evidências e da transição** (sem exigir dois aprovadores nesta versão): **entregar a arte existente** quando houver arte íntegra, ou **estornar uma vez** após confirmar **ausência de arte** e **encerramento da execução**. A “fila de atendimento” SHALL ser **somente uma lista de pendências, sem execução automática**. Permanecem **proibidos**: re-queue, nova geração administrativa e chamada automática ao provider.

#### Scenario: Evidência de arte entrega

- **WHEN** há arte íntegra persistida para a operação pendente
- **THEN** o administrador autorizado, com motivo, registra a evidência e a transição
- **AND** entrega a arte existente
- **AND** nenhuma nova geração ocorre

#### Scenario: Ausência comprovada estorna uma vez

- **WHEN** o administrador autorizado confirma ausência de arte e encerramento da execução
- **THEN** registra motivo, evidências e transição
- **AND** o estorno ocorre uma única vez
- **AND** nenhum re-queue, nova geração ou chamada automática é executado

#### Scenario: Fila de atendimento é somente lista

- **WHEN** existem operações pendentes
- **THEN** elas aparecem em uma lista de pendências
- **AND** nenhuma execução automática é disparada a partir da lista

### Requirement: Telemetria e falha segura

Cada tentativa SHALL registrar modelo/qualidade/alvo/número/run-trace/resultado/custo por par. Falha operacional retorna `IMG-001` + referência opaca e diagnóstico durável, sem motivo interno. O fluxo não invoca revisor automático.

#### Scenario: Falha correlacionável

- **WHEN** geração falha operacionalmente
- **THEN** diagnóstico recuperável por referência é persistido e mensagem pública sanitizada

### Requirement: Limitação aceita da b1b e gate obrigatório antes da b2

Na entrega **inativa** da b1b, quando **não** existir **fonte operacional comprovada** de que a execução **encerrou**, um claim `in_progress` residual SHALL permanecer **bloqueado** para resolução administrativa — **sem estorno**, **sem nova geração** e **sem retomada/continuidade**. A b1b SHALL NOT declarar **recuperabilidade completa**. Testes com **evidência simulada** (harness/**fake**) SHALL NOT ser considerados prova de uma **fonte operacional** de encerramento. Esta limitação é um **risco explicitamente aceito apenas** para a entrega inativa da b1b. O piloto/habilitação de lojas na **b2** SHALL permanecer **bloqueado** até comprovar uma **estratégia operacional segura de resolução de claims residuais**; a confirmação do **plano e dos limites** da plataforma pode **sustentar** essa estratégia, mas, **isoladamente, SHALL NOT satisfazer o gate**. **Evidência simulada SHALL NOT substituir comprovação operacional.** A **b1b inativa** pode ser concluída mantendo a limitação documentada; o bloqueio recai sobre **piloto/habilitação**, sem impedir a **preparação documental da b2**. Plano contratado informado: **Vercel Hobby / Supabase Free**; os **limites efetivos de execução permanecem não verificados**.

#### Scenario: Claim residual sem evidência permanece bloqueado

- **WHEN** existe claim `in_progress` residual e não há fonte operacional comprovada de encerramento
- **THEN** a resolução administrativa permanece bloqueada
- **AND** não ocorre estorno, nova geração nem retomada

#### Scenario: Evidência simulada não é prova operacional

- **WHEN** a única evidência de encerramento provém de harness/fake
- **THEN** isso não é aceito como fonte operacional de encerramento
- **AND** o claim residual permanece bloqueado

#### Scenario: Gate obrigatório antes da b2

- **WHEN** se pretende pilotar ou habilitar lojas na b2
- **THEN** uma estratégia operacional segura de resolução de claims residuais precisa estar comprovada
- **AND** confirmar plano/limites, isoladamente, não satisfaz o gate
- **AND** evidência simulada não substitui comprovação operacional
- **AND** a b2 não é habilitada sem o gate (a preparação documental da b2 não é impedida)
