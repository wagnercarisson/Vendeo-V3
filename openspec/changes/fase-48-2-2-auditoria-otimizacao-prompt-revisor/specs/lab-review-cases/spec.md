# Lab Review Cases

> Capability nova (ADDED) pela `fase-48-2-2-auditoria-otimizacao-prompt-revisor`. Define os casos de revisão imutáveis e versionados que ligam a imagem exata avaliada ao diagnóstico humano esperado.

## ADDED Requirements

### Requirement: Caso de revisão imutável ligado à imagem exata

O sistema SHALL manter casos de revisão versionados e imutáveis, cada um ligando a versão do cenário (fatos congelados), a **imagem exata** (ou o seu hash), a origem da imagem, o diagnóstico humano esperado e as categorias de defeito esperadas. O diagnóstico SHALL pertencer ao caso de revisão — não ao cenário.

#### Scenario: Caso de revisão liga imagem, hash e diagnóstico

- **WHEN** um caso de revisão é criado
- **THEN** ele registra a versão do cenário, a imagem exata (ou hash), a origem, o diagnóstico esperado e as categorias esperadas
- **AND** seu conteúdo é imutável e possui hash verificável

#### Scenario: Diagnóstico não pertence ao cenário

- **WHEN** duas imagens do mesmo cenário são avaliadas
- **THEN** cada uma tem o seu próprio diagnóstico no respectivo caso de revisão
- **AND** nenhum diagnóstico fica preso ao cenário

#### Scenario: Alteração cria nova versão

- **WHEN** o conteúdo de um caso de revisão muda
- **THEN** uma nova versão é criada
- **AND** a versão anterior permanece inalterada e auditável

### Requirement: Papéis de corpus (desenvolvimento e holdout)

Cada caso de revisão SHALL pertencer a um papel de corpus: `development` (diagnóstico conhecido, usado para entender falhas e refinar) ou `holdout` (diagnóstico oculto, usado apenas na comparação cega final baseline × candidata). Nenhuma avaliação comparativa "baseline-only" SHALL ser executada, e o mesmo caso SHALL NOT ser usado para refino aberto e para a comparação cega final.

#### Scenario: Caso tem papel de corpus

- **WHEN** um caso de revisão é criado
- **THEN** ele declara o papel `development` ou `holdout`
- **AND** o papel é registrado junto do caso

#### Scenario: Desenvolvimento e holdout são separados

- **WHEN** um caso é usado para refino aberto
- **THEN** ele pertence ao corpus de desenvolvimento
- **AND** nenhum caso de holdout é usado para refino aberto

#### Scenario: Nenhuma avaliação baseline-only

- **WHEN** uma avaliação comparativa é executada
- **THEN** ela sempre compara baseline × candidata
- **AND** nenhuma avaliação comparativa "baseline-only" é executada

### Requirement: Integridade da imagem avaliada

O sistema SHALL verificar o hash da imagem do caso de revisão antes de executar a avaliação. O benchmark SHALL vir de fixture controlada; arte gerada pelo Diretor SHALL só ser usada como amostra exploratória após receber diagnóstico humano próprio.

#### Scenario: Hash da imagem é conferido

- **WHEN** um run do Revisor é executado a partir de um caso de revisão
- **THEN** o hash da imagem no disco é conferido contra o registrado
- **AND** divergência recusa a execução com `review_case_hash_mismatch`

#### Scenario: Benchmark usa fixture de campanha finalizada

- **WHEN** o benchmark do Revisor é montado
- **THEN** as imagens vêm de fixtures de campanhas finalizadas e controladas
- **AND** nenhuma imagem real de lojista é usada

#### Scenario: Arte do Diretor é amostra exploratória

- **WHEN** uma arte gerada pelo Diretor é incluída na auditoria
- **THEN** ela recebe diagnóstico humano próprio antes de virar caso de revisão
- **AND** ela não é tratada como benchmark sem diagnóstico

### Requirement: Caminho de imagem confinado

O sistema SHALL resolver o caminho de cada imagem de fixture por `realpath` e verificar que ele é descendente estrito do diretório do caso antes de qualquer leitura.

#### Scenario: Caminho que escapa é recusado

- **WHEN** o caminho de uma imagem escapa do diretório do caso (path traversal ou symlink para fora)
- **THEN** a leitura é recusada com `invalid_review_case_path`
- **AND** o arquivo fora do caso não é aberto

### Requirement: Corpus de defeitos conhecidos

O sistema SHALL incluir um corpus de casos de revisão com defeitos conhecidos, cobrindo ao menos: campanha adequada; preço incorreto; preço proibido em exclusivo; texto obrigatório ausente; CTA inventado; nome de loja incorreto; produto deformado; baixa legibilidade; e um falso defeito tentador para medir falso positivo. As categorias esperadas SHALL limitar-se ao que o contrato de entrada do Revisor observa — sem exigir fidelidade visual de logo.

#### Scenario: Corpus cobre os defeitos conhecidos

- **WHEN** o corpus é listado
- **THEN** ele cobre campanha adequada, preço incorreto, preço proibido em exclusivo, texto obrigatório ausente, CTA inventado, nome de loja incorreto, produto deformado, baixa legibilidade e falso defeito tentador
- **AND** cada caso registra o diagnóstico esperado

#### Scenario: Falso defeito tentador mede falso positivo

- **WHEN** um caso de falso defeito tentador é avaliado
- **THEN** ele tem diagnóstico esperado `adequate`
- **AND** a reprovação pelo Revisor é classificada como falso positivo

#### Scenario: Fidelidade de logo fica fora do Revisor

- **WHEN** as categorias esperadas são definidas
- **THEN** elas não exigem fidelidade visual de logo
- **AND** fidelidade de logo permanece na rubrica humana do Diretor
