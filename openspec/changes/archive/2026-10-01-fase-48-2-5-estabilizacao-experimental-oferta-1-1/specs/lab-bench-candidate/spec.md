## ADDED Requirements

### Requirement: Experimentação manual e controlada de prompts e modelos

A estabilização SHALL conduzir experimentos manualmente na bancada: executar, avaliar, alterar uma variável, executar novamente e registrar a decisão. SHALL NOT gerar candidatas, otimizar prompts ou avaliar por IA automaticamente, nem alterar código por cada edição experimental do prompt. A matriz inicial de modelos SHALL conter `gpt-image-2`, `gpt-image-2.5-flare` e `gpt-image-2.5-sunburst`, todos em qualidade `low`. Comparações entre modelos SHALL usar as mesmas entradas, imagens e prompt aprovado; qualidade `medium` ou superior normalmente exige hipótese concreta registrada antes da geração. Se o usuário realizar manualmente uma execução exploratória sem hipótese prévia, ela SHALL ser registrada como desvio exploratório e requer aceitação humana explícita no UAT/decision record; não se cria hipótese retrospectiva, não é tratada como evidência confirmatória nem generalizada para outros casos. Toda geração real SHALL ser manual, precedida de autorização humana explícita e não executável por task autônoma. O registro SHALL incluir custo, latência, usage e versão de pricing. A estimativa local de saída SHALL ser rotulada como parcial e somente de saída, manter `coverage: partial`, e declarar que custos de texto/imagem de entrada são adicionais; não SHALL ser apresentada como custo total, fatura ou teto. A rubrica humana SHALL ser registrada por critério e run; critérios sem avaliação permanecem `pending`. O usuário MAY aprovar explicitamente um candidato com limitações no CHECKPOINT B apesar de critérios `pending`, se tais lacunas e follow-ups forem declarados, sem alegar avaliação integral ou promoção.

#### Scenario: Rodada de prompt muda uma variável
- **WHEN** uma rodada manual de refinamento é iniciada
- **THEN** o documento registra hipótese, variável alterada, entradas mantidas, run ID, resultado, avaliação, decisão e próximo ajuste
- **AND** nenhuma otimização automática é executada

#### Scenario: Comparação manual de modelos controla entradas
- **WHEN** dois ou mais modelos são comparados
- **THEN** prompt aprovado e entradas/imagens permanecem idênticos
- **AND** apenas o modelo varia naquela comparação

#### Scenario: Matriz inicial fica em low
- **WHEN** o protocolo de UAT é iniciado
- **THEN** inclui os três modelos definidos com qualidade `low`
- **AND** qualidade superior só é usada com hipótese concreta registrada

#### Scenario: Exceção exploratória de qualidade superior
- **WHEN** o usuário realiza manualmente uma execução `medium` ou superior sem hipótese prévia
- **THEN** o UAT/decision record declara a ausência de hipótese e registra a aceitação humana da exceção
- **AND** a execução não é descrita como experimento confirmatório nem generalizada para outros casos

#### Scenario: CHECKPOINT B aceita rubrica parcial com limitações
- **WHEN** há critérios da rubrica sem evidência humana para um ou mais runs
- **THEN** cada critério permanece `pending` e as lacunas/limitações são listadas
- **AND** o usuário pode aprovar explicitamente o candidato com limitações no CHECKPOINT B, sem alegar cobertura integral ou promover a produção

#### Scenario: Execução real depende de autorização humana
- **WHEN** uma task autônoma chega ao ponto de geração real
- **THEN** ela para no checkpoint e não invoca provider
- **AND** cada chamada paga só ocorre manualmente após autorização humana explícita

#### Scenario: Estimativa parcial exige confirmação financeira por geração
- **WHEN** a estimativa local de saída é exibida antes de uma geração
- **THEN** ela é identificada como estimativa parcial somente de saída, com custos de entrada adicionais e `coverage: partial`
- **AND** o usuário revisa a estimativa e confirma financeiramente cada geração manual separadamente
- **AND** não existe autorização financeira global, batch ou chamada automática ao provider

### Requirement: Amostra mínima e revisão humana visual

O UAT SHALL cobrir duas lojas de teste e dois produtos visualmente diferentes, incluindo ao menos um caso apenas com imagem principal e um caso com principal e adicionais. Cada comparação de modelos SHALL usar entradas idênticas e avaliações humanas registradas. A rubrica SHALL registrar separadamente: (a) nome do produto presente por inteiro e exatamente como aprovado; (b) descrição complementar com contexto/significado preservados, ainda que selecionada, resumida ou adaptada; (c) informações obrigatórias reproduzidas literalmente; (d) protagonismo visual da principal; (e) contribuição/conflito das adicionais; (f) fidelidade de identidade; (g) integridade de preços/datas/selos e demais condições comerciais; (h) ortografia/pontuação; (i) hierarquia; (j) acabamento/publicabilidade; (k) ausência de conteúdo inventado; e (l) modelo, qualidade, latência, usage e custo. O fluxo SHALL ser dados + identidade + prompt aprovado → geração → validações técnicas objetivas → revisão humana → aprovar, rejeitar, ajustar ou nova tentativa. SHALL NOT existir garantia técnica de aparição/fidelidade visual do nome, descrição ou principal, revisor visual ou score automático.

Cada campo da rubrica SHALL ser informado por run; ausência de evidência/avaliação SHALL permanecer `pending`. O CHECKPOINT B MAY resultar em `approved_with_limitations` com rubrica parcial somente mediante aceitação explícita do usuário e registro claro das lacunas, sem atribuir avaliações não fornecidas.

#### Scenario: Amostra mínima é satisfeita
- **WHEN** UAT manual é registrado como completo
- **THEN** inclui duas lojas e dois produtos visualmente diferentes
- **AND** cobre os casos com principal isolada e principal com adicionais

#### Scenario: Avaliação registra rubrica completa
- **WHEN** uma saída é revisada
- **THEN** cada critério humano e as métricas técnicas/financeiras aplicáveis são registrados
- **AND** nome, descrição e informações obrigatórias são avaliados separadamente
- **AND** integridade comercial é registrada como critério distinto
- **AND** a decisão humana e limitações são explícitas

#### Scenario: Revisão permanece humana
- **WHEN** a geração passa pelas validações técnicas objetivas
- **THEN** a saída aguarda revisão humana
- **AND** nenhum modelo produz score, aprovação ou rejeição visual automática

### Requirement: Manifesto versionável do candidato experimental

A fase SHALL entregar manifesto documental ou JSON versionável do candidato Oferta 1:1, contendo `candidateId`/versão; `composerVersion`; versões de política de papéis de imagem e integridade textual; texto exato do prompt-base aprovado/reutilizável e `promptBaseVersion`; demais `policyVersions`; modelo/qualidade/preset selecionados; protocolo; versão de pricing; runs usados como evidência; avaliações; limitações conhecidas; e decisão humana final. O prompt compilado/aprovado completo SHALL permanecer associado a cada run, pois incorpora loja, produto e oferta e varia entre casos; o manifesto SHALL referenciar esses prompts por run ID e SHALL NOT apresentar um prompt compilado de uma loja/produto como prompt universal do candidato. Comparações de modelos para um mesmo caso SHALL preservar byte a byte o prompt e as entradas desse caso. O manifesto SHALL ser evidência e contrato de handoff, não ativar nem alterar produção. A persistência de evidências SHALL preferir `lab_bench_runs`, linhagem, snapshots e campos existentes, sem novas tabelas, salvo impossibilidade técnica demonstrada e apresentada como decisão bloqueante.

#### Scenario: Candidato aprovado tem manifesto completo
- **WHEN** a decisão humana final aprova o candidato
- **THEN** o manifesto inclui todos os campos obrigatórios e referências aos runs/avaliações
- **AND** o prompt-base aprovado é congelado como artefato reutilizável
- **AND** cada prompt compilado/aprovado exato é referenciado no run correspondente
- **AND** nenhum prompt específico de loja/produto é tratado como prompt universal

#### Scenario: Mesmo caso mantém prompt ao comparar modelos
- **WHEN** modelos são comparados para o mesmo caso experimental
- **THEN** prompt compilado/aprovado e entradas desse caso são idênticos byte a byte
- **AND** somente a variável planejada da rodada é alterada

#### Scenario: Manifesto não promove produção
- **WHEN** o manifesto é criado ou atualizado
- **THEN** nenhuma configuração, prompt, allowlist ou pipeline produtivo é alterado
- **AND** não há flag ou canário produtivo

#### Scenario: Evidências reutilizam infraestrutura existente
- **WHEN** experimentos e avaliações são registrados
- **THEN** usam runs, snapshots, linhagem e documentos versionáveis existentes
- **AND** nenhuma tabela nova é criada sem impossibilidade técnica comprovada e bloqueio apresentado

### Requirement: Checkpoints humanos e fronteira de fechamento

O plano SHALL definir CHECKPOINT A para aprovação humana dos contratos determinísticos e do roteiro experimental antes de qualquer geração paga e CHECKPOINT B para UAT manual pago, comparações e decisão sobre o candidato, conduzido pelo usuário. Nenhuma task autônoma SHALL ultrapassar qualquer checkpoint nem executar provider. Executor pode implementar, testar, conduzir verificações sem provider e registrar evidências; `/opsx-verify`, `/opsx-sync` e `/opsx-archive` permanecem ações exclusivas do responsável do projeto.

#### Scenario: Checkpoint A bloqueia UAT pago
- **WHEN** contratos ou protocolo ainda não foram aprovados pelo responsável
- **THEN** nenhuma geração paga é iniciada

#### Scenario: Checkpoint B é conduzido manualmente
- **WHEN** o UAT pago está autorizado
- **THEN** o usuário conduz as gerações e registra comparações/decisão
- **AND** nenhuma task autônoma executa provider

#### Scenario: Fechamento respeita ações reservadas
- **WHEN** tarefas de implementação e evidência são concluídas
- **THEN** a change aguarda revisão do responsável para verify, sync e archive
