## MODIFIED Requirements

### Requirement: Geração exige preflight aprovado

A bancada SHALL exigir evidência textual emitida por `/compose` e preflight de prompt aprovado antes de qualquer geração. `/runs` SHALL reexecutar detector sobre o snapshot efetivo e conferir conteúdo, versão, revisão e decisão da evidência; rejeitar ausência/obsolescência/divergência como `409 text_integrity_review_stale` antes de persistir execução ou invocar provider. O texto enviado permanece byte a byte igual ao prompt aprovado; antes da chamada, o servidor recompõe e recusa evidência divergente. O preflight textual é vinculado aos valores atuais e à versão ativa das regras, e qualquer alteração exige nova revisão e composição. A UI registra a escolha explícita do usuário; evidência efêmera permite ao servidor verificar consistência, mas não é prova independente de que houve clique.

#### Scenario: Geração exige decisão textual e aprovação do prompt
- **WHEN** uma geração é solicitada
- **THEN** exige validação textual da revisão atual, decisão explícita se houve alerta e aprovação explícita do prompt
- **AND** `prompt_sent` é idêntico byte a byte ao texto aprovado

#### Scenario: Execução revalida a revisão textual no servidor
- **WHEN** `/runs` recebe evidência de integridade textual
- **THEN** recalcula alertas/revisão sobre o snapshot e verifica versão e decisão
- **AND** recusa evidência ausente ou divergente com `409 text_integrity_review_stale` antes do provider

#### Scenario: Entrada alterada invalida decisão de integridade
- **WHEN** um campo textual abrangido muda após a decisão de manter
- **THEN** a aprovação textual anterior não é aceita
- **AND** nenhuma chamada paga inicia antes da nova validação

### Requirement: Protocolo de UAT experimental manual Oferta 1:1

A bancada SHALL suportar protocolo experimental documental para Oferta 1:1, com duas lojas de teste e dois produtos visualmente diferentes; ao menos um caso com imagem principal isolada e um com principal e adicionais; comparação de modelos com entradas idênticas; avaliação humana; e registro de hipótese, variável, run ID, resultado, decisão e próximo ajuste por tentativa relevante. A matriz inicial SHALL conter `gpt-image-2`, `gpt-image-2.5-flare` e `gpt-image-2.5-sunburst` em `low`; qualidade `medium` ou superior normalmente exige hipótese concreta registrada antes da geração. Uma execução `medium+` exploratória sem hipótese prévia MAY ser registrada como exceção se conduzida manualmente pelo usuário e aceita explicitamente no UAT, sem hipótese retrospectiva nem generalização. O sistema SHALL preservar custo, latência, usage e versão do pricing, e SHALL NOT executar gerações automaticamente.

#### Scenario: UAT registra amostra mínima e critérios
- **WHEN** o documento de UAT é preenchido
- **THEN** registra duas lojas, dois produtos distintos e os dois arranjos de imagens obrigatórios
- **AND** usa entradas idênticas entre modelos comparados
- **AND** registra por run os critérios de produto, imagens, identidade, dados/textos, hierarquia, acabamento, invenções e evidências financeiras/técnicas
- **AND** critérios sem avaliação permanecem `pending`; o usuário MAY aceitar CHECKPOINT B com limitações se aprovar explicitamente as lacunas/follow-ups, sem alegação de rubrica completa

#### Scenario: Variação de qualidade exige hipótese
- **WHEN** qualidade medium ou superior é proposta
- **THEN** normalmente uma hipótese concreta de melhoria é registrada antes da rodada
- **AND** a rodada permanece manual

#### Scenario: Sunburst medium exploratório sem hipótese prévia
- **WHEN** o usuário conduz manualmente uma rodada exploratória `medium+` sem hipótese prévia
- **THEN** o UAT registra explicitamente que a hipótese estava ausente e não a inventa retrospectivamente
- **AND** a rodada precisa ser aceita pelo usuário como exceção no CHECKPOINT B e não é generalizada para outros produtos

#### Scenario: Nenhum revisor visual automático
- **WHEN** validações técnicas objetivas terminam
- **THEN** a saída aguarda avaliação humana
- **AND** o sistema não cria score ou decisão visual automatizada
