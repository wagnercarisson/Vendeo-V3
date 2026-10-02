## ADDED Requirements

### Requirement: Documentos experimentais vinculados à linhagem de runs

O registro manual de experimentos SHALL referenciar `lab_bench_runs` e sua linhagem existente, armazenando por tentativa relevante hipótese, variável alterada, run ID, entradas mantidas, resultado, avaliação humana, decisão e próximo ajuste. SHALL registrar modelo, qualidade, protocolo, versão de pricing, usage, latência e custo disponíveis. Avaliações e limitações podem residir em documentos versionáveis ligados aos runs; SHALL NOT criar tabelas de experimento/avaliação, score, ranking, avaliação por IA ou promoção automática.

#### Scenario: Tentativa relevante tem trilha documental
- **WHEN** uma rodada experimental é avaliada
- **THEN** seu documento identifica run e registra hipótese, variável, entradas, resultado, avaliação, decisão e próximo ajuste
- **AND** inclui métricas técnicas/financeiras disponíveis

#### Scenario: Histórico anterior permanece imutável
- **WHEN** uma rodada posterior é adicionada
- **THEN** documentos e runs anteriores permanecem preservados
- **AND** a nova evidência é adicionada sem sobrescrever a anterior

#### Scenario: Sem nova tabela de experimento
- **WHEN** os registros de experimentação são implementados
- **THEN** reutilizam runs, linhagem, snapshots e documentos versionáveis
- **AND** não criam tabela de experimentos ou avaliações automatizadas
