# Lab Bench Experimental Briefing

> Synced from `fase-48-2-3-fidelidade-experimental-bancada` (ADDED).

## Purpose

Define o contrato estruturado do briefing experimental fiel da bancada — direção visual consolidada, `typography_direction` e `brandColor` resolvido pela precedência produtiva exata — como entrada do compositor determinístico, sem alterar o contrato produtivo.

## Requirements

### Requirement: Briefing experimental fiel com direção visual consolidada

A bancada SHALL montar um briefing experimental que preserve a direção visual consolidada já usada pelo Vendeo — briefing de campanha, diretrizes, estilo, tom e personalidade relevantes — e SHALL incluir `typography_direction` importado do perfil atual da loja. A bancada SHALL NOT enviar indiscriminadamente todos os dados brutos da loja ao modelo.

#### Scenario: Briefing inclui direção visual e tipografia

- **WHEN** o briefing experimental é montado para uma loja com perfil de branding
- **THEN** ele inclui briefing, diretrizes, estilo, tom e personalidade relevantes
- **AND** inclui a direção tipográfica

#### Scenario: Briefing alimenta o prompt compilado

- **WHEN** o prompt compilado é montado pelo compositor
- **THEN** o briefing experimental (incluindo a direção tipográfica) é incorporado ao prompt compilado
- **AND** a tipografia efetivamente influencia a geração

#### Scenario: Dados brutos não são enviados indiscriminadamente

- **WHEN** o briefing experimental é montado
- **THEN** apenas os campos de direção visual relevantes são usados
- **AND** todos os dados brutos da loja não são enviados ao modelo

### Requirement: Resolução cromática idêntica à produtiva

A bancada SHALL resolver `brandColor` **exatamente** pela precedência produtiva atual, importando os campos cromáticos persistidos necessários. A bancada SHALL NOT inventar nova precedência de cores, SHALL NOT expandir automaticamente uma cor principal para uma nova paleta e SHALL NOT alterar o contrato produtivo de cores.

#### Scenario: Cores resolvidas como no produtivo

- **WHEN** a loja possui campos cromáticos persistidos
- **THEN** o `brandColor` do briefing experimental é idêntico ao resolvido pelo fluxo produtivo

#### Scenario: Nenhuma nova precedência ou paleta

- **WHEN** a resolução cromática da bancada é aplicada
- **THEN** nenhuma precedência nova é introduzida
- **AND** nenhuma paleta nova é derivada automaticamente

### Requirement: Briefing como entrada estruturada do compositor

O briefing experimental SHALL ser a **entrada estruturada** do compositor determinístico (`lab-bench-prompt-preflight`), e SHALL NOT ser, por si só, o texto enviado ao modelo. A direção tipográfica SHALL integrar o bloco `[DIREÇÃO TIPOGRÁFICA]` do prompt compilado. A composição, a edição e a aprovação do texto final são definidas em `lab-bench-prompt-preflight`.

#### Scenario: Briefing é entrada, não o texto final

- **WHEN** o briefing experimental é montado
- **THEN** ele é usado como entrada estruturada do compositor
- **AND** o texto enviado ao modelo é o prompt compilado/aprovado, não o briefing isolado

#### Scenario: Tipografia compõe o bloco próprio

- **WHEN** a direção tipográfica está no briefing
- **THEN** ela integra o bloco `[DIREÇÃO TIPOGRÁFICA]` do prompt compilado

### Requirement: Briefing registrado como evidência

A bancada SHALL registrar o briefing experimental exibido como evidência da geração, sem criar campanhas produtivas, runs produtivos ou eventos.

#### Scenario: Briefing é persistido como evidência

- **WHEN** a geração é persistida
- **THEN** o briefing experimental exibido é registrado na evidência
- **AND** nenhuma campanha ou run produtivo é criado

### Requirement: Sem correção promovida ao produtivo

Nenhuma correção do contrato de cores ou de tipografia SHALL ser promovida ao contrato produtivo nesta fase. A persistência visual determinística para lojas `text_only` (fonte exata, padrão do nome, wordmark ou renderização programática) fica expressamente fora desta fase. A bancada SHALL NOT prometer repetição tipográfica exata apenas com prompting.

#### Scenario: Contrato produtivo permanece intocado

- **WHEN** a bancada inclui tipografia no briefing experimental
- **THEN** o contrato produtivo de cores e tipografia permanece inalterado
- **AND** nenhuma promessa de repetição tipográfica exata é feita

#### Scenario: Persistência determinística de `text_only` fica fora de escopo

- **WHEN** a loja é `text_only`
- **THEN** a persistência visual determinística não é implementada nesta fase
- **AND** o tema é tratado separadamente
