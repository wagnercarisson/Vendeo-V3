## MODIFIED Requirements

### Requirement: Protocolo de UAT experimental manual Oferta 1:1

A bancada SHALL suportar protocolo documental restrito a Produto + quadrado 1:1 e às intenções Oferta, Destaque e Exclusivo. UAT SHALL usar `gpt-image-2.5-sunburst` em `medium`, sem comparação entre modelos. CHECKPOINT A SHALL aprovar contratos, segurança e gates antes de qualquer geração paga. CHECKPOINT B SHALL ser manual pelo usuário; cada geração exige confirmação financeira individual. O registro por tentativa inclui hipótese/variável quando aplicável, run ID, entradas, resultado, avaliação, decisão, próximo ajuste, modelo, qualidade, protocolo, pricing, usage, latência e custo disponível. A amostra mantém duas lojas de teste, dois produtos distintos e casos de imagem principal isolada e principal com auxiliares. Avaliação humana cobre fidelidade de produto/embalagem, nome, textos obrigatórios, condições comerciais, qualidade comercial, custo e latência. Evidência ausente permanece `pending`; o usuário pode aprovar encerramento com limitações se aceitar explicitamente e registrar lacunas/follow-ups, sem afirmar rubrica completa. Gerações nunca são automáticas.

#### Scenario: UAT registra critérios por intenção e amostra existente
- **WHEN** documento UAT é preenchido
- **THEN** registra Oferta, Destaque e Exclusivo separadamente para Produto 1:1
- **AND** inclui duas lojas, dois produtos distintos, caso de principal isolada e caso de principal com auxiliares
- **AND** avalia produto/embalagem, nome, textos obrigatórios, condições comerciais, qualidade comercial, custo e latência
- **AND** registra por tentativa run ID, entradas, resultado, avaliação, decisão e próximo ajuste
- **AND** critério sem evidência permanece `pending`

#### Scenario: Sunburst medium sem comparação entre modelos
- **WHEN** protocolo de UAT é executado
- **THEN** utiliza `gpt-image-2.5-sunburst` em `medium`
- **AND** não compara modelos

#### Scenario: CHECKPOINT A antecede geração paga
- **WHEN** geração paga está sendo considerada
- **THEN** revisão humana de contratos, gates e segurança ocorre primeiro
- **AND** sem aprovação explícita nenhuma geração paga é autorizada

#### Scenario: Cada geração exige confirmação financeira individual
- **WHEN** usuário inicia manualmente um run
- **THEN** confirmação financeira explícita é exigida para aquele run
- **AND** não há autorização global, batch ou geração autônoma

#### Scenario: Encerramento com limitações é explícito
- **WHEN** existem critérios `pending` no CHECKPOINT B
- **THEN** permanecem `pending` e não são convertidos em avaliação
- **AND** usuário pode aprovar encerramento com limitações enumeradas e follow-ups aceitos
- **AND** resultado não é descrito como rubrica completa

#### Scenario: Sem revisor visual automático
- **WHEN** validações técnicas terminam
- **THEN** avaliação aguarda pessoa
- **AND** testes automatizados verificam contratos e side effects, não prometem fidelidade da arte pelo modelo
