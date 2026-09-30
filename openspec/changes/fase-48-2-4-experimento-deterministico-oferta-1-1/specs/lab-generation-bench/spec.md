# Lab Generation Bench — delta (F48.2.4)

## MODIFIED Requirements

### Requirement: Persistência mínima por geração

A bancada SHALL persistir uma unidade de auditoria própria por geração, contendo no mínimo: identificador; status; usuário administrador; timestamps; snapshot da campanha; snapshot do branding exibido (sem URL assinada); configuração efetivamente usada; **versões do compositor, das políticas e do prompt-base padrão**; **prompt-base efetivamente usado**; prompt compilado; prompt final aprovado; prompt efetivamente enviado (`prompt_sent`, byte a byte igual ao aprovado); **referência canônica da identidade** (sem URL assinada); referências locais utilizadas; provider, protocolo e modelo; formato/tamanho; qualidade; intenção; tipo de conteúdo; estrutura; tema; latência; usage retornado quando disponível; custo calculado ou estimado; **custo reportado pelo provider em campo separado**; origem e versão da regra de custo; status e erro sanitizado; validação técnica; e o artefato resultante. A bancada SHALL NOT criar baseline, candidata, cenário, repetição comparativa ou avaliação A/B, nem gravar nas tabelas operacionais de campanhas.

#### Scenario: Geração é persistida com evidência completa

- **WHEN** uma geração termina
- **THEN** o registro contém snapshot de campanha, snapshot de branding (sem URL assinada), configuração, versões do compositor/políticas/prompt-base padrão, prompt-base usado, prompt compilado/aprovado/enviado, referência canônica da identidade, referências, provider/modelo/protocolo, formato/qualidade, dimensões, latência, usage (quando disponível), custo com origem e o artefato resultante

#### Scenario: Custo calculado e reportado são separados

- **WHEN** o custo é persistido
- **THEN** o custo calculado localmente e o custo reportado pelo provider são mantidos em campos separados
- **AND** a estimativa não é apresentada como valor faturado

#### Scenario: Nenhuma estrutura A/B é criada

- **WHEN** a bancada persiste uma geração
- **THEN** nenhuma linha de baseline/candidata/cenário/repetição/avaliação é criada
- **AND** nenhuma tabela operacional de campanhas é alterada

### Requirement: Geração exige preflight aprovado

A bancada SHALL exigir um **preflight aprovado** (`lab-bench-prompt-preflight`) antes de qualquer geração e SHALL enviar exatamente o `prompt_sent` aprovado, registrando na evidência o briefing estruturado, os blocos, o prompt compilado, o prompt final aprovado e as versões, sem criar campanhas produtivas, runs produtivos ou eventos. Antes da chamada paga, o servidor SHALL recompor o prompt e recusar a geração quando a composição divergir da aprovada (`approval_invalidated`).

#### Scenario: Geração usa o prompt aprovado

- **WHEN** uma geração é executada
- **THEN** ela exige o preflight aprovado
- **AND** o `prompt_sent` corresponde byte a byte ao prompt final aprovado pelo operador
- **AND** nenhuma campanha ou run produtivo é criado

#### Scenario: Aprovação obsoleta é recusada

- **WHEN** o servidor recomputa a composição e ela diverge da aprovada
- **THEN** a geração é recusada antes da chamada paga
- **AND** nenhuma chamada paga é iniciada

### Requirement: Identidade experimental sem efeitos produtivos

A geração da bancada SHALL usar a identidade importada materializada localmente e SHALL transportar ao modelo a **referência canônica de identidade** resolvida por `identity_state`, permanecendo com uma única geração ativa, confirmação explícita e ausência de créditos, sem qualquer escrita em tabelas produtivas.

#### Scenario: Identidade importada alimenta a geração

- **WHEN** a geração é executada para uma loja importada
- **THEN** a identidade local é usada e a referência canônica é transportada ao modelo
- **AND** nenhum crédito é consumido e nenhuma tabela produtiva é escrita

#### Scenario: Identidade indisponível falha antes da chamada paga

- **WHEN** a referência canônica esperada não está disponível
- **THEN** a geração falha antes da chamada paga
- **AND** nenhum crédito é consumido
