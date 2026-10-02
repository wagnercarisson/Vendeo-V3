## ADDED Requirements

### Requirement: POST /compose valida integridade textual e vincula decisão à revisão

O endpoint `POST /compose` SHALL executar o detector de integridade textual no servidor sobre os textos livres editáveis pelo operador: `product.name`, `product.description`, `product.mandatoryArtworkText` e `promptBase`. `promptBase` SHALL ser incluído porque é enviado à composição e reutilizado em `/runs`; preço, validade, enums/valores controlados e branding somente-leitura ficam excluídos. Quando houver alertas e nenhuma decisão explícita declarada de `keep_exactly`, SHALL responder `422 text_integrity_review_required` contendo alertas (`field`, `excerpt`, `reason`, `ruleId`) e a revisão determinística atual, sem retornar prompt compilado. Quando receber `keep_exactly`, SHALL recalcular detector, conteúdo e versão atuais e só compor se a revisão corresponde byte a byte aos valores enviados e à versão ativa; SHALL preservar `promptBase` sem correção automática ou julgamento semântico. Evidência alterada/obsoleta SHALL responder `409 text_integrity_review_stale` com estado/alertas atuais. Sem alertas, SHALL compor e devolver evidência `decision: no_alerts` vinculada a conteúdo, revisão e versão. Essa evidência é efêmera; a UI é responsável pelo ato explícito e o servidor verifica consistência dos valores e decisão declarada, sem alegar comprovar independentemente um clique do usuário.

#### Scenario: Alertas sem decisão não retornam prompt
- **WHEN** `POST /compose` detecta alertas sem decisão válida
- **THEN** retorna `422 text_integrity_review_required` com alertas e revisão atual
- **AND** não retorna prompt compilado

#### Scenario: keep_exactly valida conteúdo e versão
- **WHEN** `POST /compose` recebe `keep_exactly` para a revisão examinada
- **THEN** recalcula valores e detector usando a versão ativa
- **AND** só retorna composição/evidência quando conteúdo, revisão e versão correspondem

#### Scenario: Evidência obsoleta no compose é recusada
- **WHEN** revisão, conteúdo ou versão de `keep_exactly` diverge dos valores/política atuais
- **THEN** retorna `409 text_integrity_review_stale` com estado/alertas atuais
- **AND** não compõe prompt

#### Scenario: Compose sem alertas emite decisão no_alerts
- **WHEN** detector não encontra alertas para os valores atuais
- **THEN** retorna composição e evidência `decision: no_alerts` com revisão e versão ativas

### Requirement: POST /runs revalida evidência antes da execução

O endpoint `POST /runs` SHALL receber a evidência de integridade textual de `/compose` junto às entradas efetivas do run, incluindo o `promptBase` do preflight. Antes de persistir execução ou invocar provider, SHALL recalcular detector/revisão sobre snapshot efetivo e `promptBase`, e conferir conteúdo byte a byte, revisão, versão ativa e decisão declarada. Evidência ausente, divergente, obsoleta ou incompatível com os alertas SHALL retornar `409 text_integrity_review_stale` antes de persistência executável/provider. Para `no_alerts`, o recálculo SHALL continuar sem alertas; para `keep_exactly`, a revisão SHALL corresponder aos mesmos valores do contrato de composição. Alterar apenas `promptBase` após `/compose` SHALL tornar a evidência obsoleta. O servidor verifica consistência da evidência recebida; a UI é responsável pelo ato explícito de manter, sem prova independente do clique.

#### Scenario: Runs recusa evidência ausente
- **WHEN** `POST /runs` não recebe evidência textual
- **THEN** retorna `409 text_integrity_review_stale`
- **AND** não persiste execução nem chama provider

#### Scenario: Runs recusa valores, revisão ou versão divergentes
- **WHEN** detector sobre o snapshot efetivo diverge da evidência em conteúdo, revisão, versão ou decisão
- **THEN** retorna `409 text_integrity_review_stale` antes de persistir execução ou chamar provider
- **AND** inclui estado/alertas atualizados quando aplicável

#### Scenario: Runs recusa prompt-base alterado
- **WHEN** `promptBase` recebido difere byte a byte daquele incluído na evidência de `/compose`
- **THEN** retorna `409 text_integrity_review_stale` antes de persistir execução ou chamar provider
- **AND** mantém o texto original sem correção ou normalização

#### Scenario: Runs aceita evidência no_alerts consistente
- **WHEN** a evidência `no_alerts` corresponde à versão e revisão atuais e detector retorna zero alertas
- **THEN** a validação textual passa para as demais validações de execução
- **AND** a aprovação do prompt e confirmação financeira continuam obrigatórias

#### Scenario: Runs aceita keep_exactly consistente
- **WHEN** `keep_exactly` corresponde à revisão e versão atuais e o detector retorna os alertas já apresentados
- **THEN** a validação textual passa sem transformar os valores
- **AND** nenhuma prova independente de clique é alegada

### Requirement: Rotas de integridade textual têm cobertura de contrato

Os testes de contrato SHALL cobrir estados de `POST /compose` (alertas sem decisão/422, `keep_exactly` atual aceito, conteúdo ou versão obsoleta/409, entrada sem alertas/evidência `no_alerts`) e `POST /runs` (evidência ausente/divergente/obsoleta/409, evidências consistentes para ambas decisões), comprovando que recusas ocorrem antes da persistência de execução e da invocação do provider. Os testes SHALL usar detector puro e provider fake/gravador, sem chamada real.

#### Scenario: Testes validam estados e respostas das rotas
- **WHEN** a suíte de contrato executa casos de integridade textual
- **THEN** verifica status, código, alertas/revisão/evidência e caminhos de aceitação/recusa
- **AND** prova ausência de persistência executável/provider nas recusas
- **AND** não chama provider real
