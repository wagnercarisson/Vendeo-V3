## ADDED Requirements

### Requirement: UAT manual de Produto 1:1 nas três intenções

A validação experimental SHALL cobrir somente Produto 1:1 e Oferta, Destaque e Exclusivo, usando `gpt-image-2.5-sunburst` em `medium`, sem comparação entre modelos. CHECKPOINT A SHALL aprovar contratos, gates e segurança antes de qualquer geração paga. CHECKPOINT B SHALL ser manual pelo usuário; cada geração exige confirmação financeira individual. A rubrica humana cobre fidelidade do produto/embalagem, nome integral, textos obrigatórios, condições comerciais, qualidade comercial, custo e latência. Critérios sem evidência permanecem `pending`; o usuário pode aprovar encerramento com limitações explicitamente enumeradas e aceitas, sem alegação de rubrica completa.

#### Scenario: Checkpoint A precede chamadas pagas
- **WHEN** execução paga é considerada
- **THEN** contratos, matriz, validade exclusiva de Oferta, preservação das permissões de selos e gates têm revisão humana explícita
- **AND** ausência de aprovação bloqueia geração

#### Scenario: UAT avalia as três intenções
- **WHEN** CHECKPOINT B é preenchido
- **THEN** registra avaliação humana separada de Oferta, Destaque e Exclusivo em Produto quadrado 1:1
- **AND** avalia fidelidade do produto/embalagem, nome, textos obrigatórios, condições comerciais, qualidade comercial, custo e latência
- **AND** critérios sem evidência permanecem sem aprovação e limitações são explícitas

#### Scenario: Geração é individual e manual
- **WHEN** um run é executado
- **THEN** é ação manual do usuário com confirmação financeira individual
- **AND** não há batch, autorização global ou execução autônoma

#### Scenario: Sem comparação de modelos
- **WHEN** UAT é conduzido
- **THEN** usa `gpt-image-2.5-sunburst` em `medium` inicialmente
- **AND** não inclui comparação entre modelos

#### Scenario: Comparação manual preserva Exclusivo v1 e varia somente a política
- **WHEN** o usuário prepara a comparação da primeira arte Exclusivo v1 com uma tentativa v2
- **THEN** a evidência/decisão v1 permanece imutável e preservada
- **AND** dados, imagem e `gpt-image-2.5-sunburst` `medium` permanecem iguais
- **AND** somente a versão/texto da política Exclusivo muda
- **AND** nenhuma nova geração é iniciada sem revisão humana e confirmação financeira individual
- **AND** a avaliação visual pode permanecer inconclusiva até a comparação manual efetiva

#### Scenario: Encerramento com limitações é aceito sem alterar pendências
- **WHEN** usuário aprova CHECKPOINT B apesar de critérios `pending`
- **THEN** aceita explicitamente limitações enumeradas e follow-ups
- **AND** critérios permanecem `pending` e resultado não é chamado de rubrica completa

### Requirement: Pacote candidato documental sem promoção

O pacote candidato SHALL ser congelado apenas como documento versionado, ligado por IDs aos runs, snapshots, linhagem, preflight, prompt aprovado/enviado e evidências existentes. Deve registrar políticas/prompt-base versionados, avaliações, limites e decisão humana, distinguindo custo por run e fonte do custo de tarifa por token; tarifas iguais por token SHALL NOT ser tratadas como garantia de custo total igual. Nenhuma tabela nova, loader/runtime produtivo, promoção ou aprovação presumida é permitida. O executor atualiza tracking de forma não destrutiva conforme o resultado. `/opsx-verify`, `/opsx-sync` e `/opsx-archive` são ações exclusivas do responsável do projeto.

#### Scenario: Evidência reutiliza runs e linhagem
- **WHEN** o pacote experimental é registrado
- **THEN** referencia runs e evidências existentes sem duplicar persistência ou criar tabela
- **AND** preserva tentativas anteriores

#### Scenario: Custos e limitações são descritos honestamente
- **WHEN** custos e resultados são documentados
- **THEN** inclui custo observado/disponível, origem, usage e latência por run
- **AND** não deduz custo total igual de tarifas iguais por token
- **AND** não converte pendências em aprovação

#### Scenario: Candidato não promove
- **WHEN** pacote é congelado
- **THEN** permanece documental e não é carregado pelo runtime nem promovido para produção
- **AND** verify/sync/archive aguardam ação manual do responsável do projeto
