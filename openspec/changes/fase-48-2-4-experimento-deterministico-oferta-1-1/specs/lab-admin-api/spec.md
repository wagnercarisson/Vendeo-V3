# Lab Admin API — delta (F48.2.4)

## MODIFIED Requirements

### Requirement: Detalhe da geração e artefatos

A API SHALL retornar o detalhe da geração com a configuração, as **versões** (compositor, políticas e prompt-base padrão), o prompt-base usado, o prompt compilado/aprovado/enviado, a **referência canônica da identidade**, as referências, a evidência técnica/financeira (com custo calculado e reportado separados) e URLs assinadas dos artefatos, sem expor secrets.

#### Scenario: Detalhe inclui evidência e artefatos

- **WHEN** o detalhe da geração é solicitado
- **THEN** a resposta inclui configuração, versões, prompt-base usado, prompt compilado/aprovado/enviado, referência canônica da identidade, referências, latência, usage, custo com origem (calculado e reportado separados) e URLs assinadas dos artefatos
- **AND** nenhum secret é exposto

### Requirement: Exposição do briefing, do prompt compilado e da aprovação

A API da bancada SHALL expor o briefing estruturado, o **prompt compilado** (com os blocos canônicos e as versões das políticas e do prompt-base padrão) e permitir a **aprovação explícita** antes da confirmação, sem expor secrets, validando o manifesto (`assertBenchTestStore`) antes de qualquer leitura quando houver `storeId`. A API SHALL rejeitar a geração sem preflight aprovado, SHALL recusar combinações de políticas não suportadas **antes da chamada paga**, SHALL revalidar server-side a composição aprovada **e a evidência textual** (`policyVersions`/`promptBaseVersion`/`composerVersion`/`identityReference`) e SHALL garantir que o `prompt_sent` corresponda **byte a byte** ao prompt final aprovado, sem composição oculta. A **configuração de execução** (`presetId`/`modelo`/`qualidade`) SHALL ser validada e persistida no run, **sem** integrar a evidência textual nem a comparação de aprovação: o mesmo prompt aprovado SHALL poder ser executado com presets/modelos distintos.

#### Scenario: Briefing experimental é exposto

- **WHEN** o administrador solicita o briefing experimental de uma loja de teste
- **THEN** a API retorna o briefing com direção visual e tipografia
- **AND** nenhum secret é exposto

#### Scenario: Prompt compilado é exposto para revisão

- **WHEN** o administrador solicita a composição de uma loja de teste
- **THEN** a API retorna o prompt compilado com os blocos canônicos e as versões
- **AND** o prompt pode ser editado e aprovado

#### Scenario: Aprovação é exigida antes da geração

- **WHEN** uma geração é solicitada sem prompt aprovado
- **THEN** a API recusa a geração antes de qualquer chamada paga
- **AND** nenhum provider é acionado e nenhum `prompt_sent` é gravado

#### Scenario: Mesmo prompt aprovado com presets distintos é aceito

- **WHEN** a geração é solicitada com o mesmo prompt aprovado e um `presetId`/modelo diferente
- **THEN** a revalidação da composição e da evidência textual prossegue
- **AND** a configuração de execução é validada e persistida no run
- **AND** o `prompt_sent` permanece byte a byte igual ao aprovado

#### Scenario: Combinação não suportada é recusada antes da chamada paga

- **WHEN** a composição referencia uma combinação de políticas não habilitada
- **THEN** a API recusa antes de qualquer chamada paga
- **AND** nenhum fallback é produzido

#### Scenario: Manifesto é validado antes da leitura

- **WHEN** uma rota com `storeId` é chamada
- **THEN** o manifesto é validado antes de qualquer leitura
- **AND** uma loja fora do manifesto é recusada

## ADDED Requirements

### Requirement: Exposição de políticas, versões e prompt-base padrão

A API SHALL expor as políticas habilitadas do recorte, com identificador e versão, e o **prompt-base padrão versionado** (conteúdo e versão), sem expor secrets.

#### Scenario: Políticas e versões são expostas

- **WHEN** o administrador consulta as políticas
- **THEN** a API retorna as políticas habilitadas com identificador e versão
- **AND** as combinações desabilitadas são sinalizadas com motivo

#### Scenario: Prompt-base padrão é exposto

- **WHEN** o administrador abre a bancada
- **THEN** a API retorna o prompt-base padrão com a sua versão
- **AND** o conteúdo pode ser editado pelo operador

### Requirement: Nova tentativa via API

A API SHALL permitir iniciar uma **nova tentativa** a partir de uma geração anterior, criando um **novo run** e reaproveitando com segurança os artefatos de entrada, sem sobrescrever as evidências anteriores e sem criar nova tabela. A linhagem SHALL ser registrada na coluna nullable `attempt_of_run_id` da própria `lab_bench_runs`.

#### Scenario: Nova tentativa cria um novo run

- **WHEN** o administrador inicia uma nova tentativa a partir de um run anterior
- **THEN** um novo run é criado
- **AND** o run anterior permanece imutável

#### Scenario: Entradas são reaproveitadas

- **WHEN** a nova tentativa é criada
- **THEN** os artefatos de entrada do run anterior são reaproveitados sob o prefixo do novo run
- **AND** nenhuma nova tabela é criada

#### Scenario: Lista de tentativas usa a linhagem explícita

- **WHEN** as tentativas de uma campanha são solicitadas
- **THEN** a lista é obtida pela linhagem explícita (`attempt_of_run_id`)
- **AND** nenhuma heurística de fingerprint ou subsistema de experimentação é usada
