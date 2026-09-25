# Lab Human Evaluation

> Delta da capability `lab-human-evaluation` pela `fase-48-2-2-auditoria-otimizacao-prompt-revisor`. Adiciona a apresentação da avaliação do Revisor sem diagnóstico e o registro da classificação por run, sem alterar a rubrica do Diretor.

## ADDED Requirements

### Requirement: Comparação do Revisor sem diagnóstico

No modo `reviewer`, a tela de comparação SHALL exibir a imagem avaliada e as evidências de revisão (resposta estruturada, `passed`, issues/severidades, erros de parse/schema), mas SHALL NOT exibir o diagnóstico humano esperado nem as categorias esperadas antes de a avaliação cega dos runs aplicáveis ser registrada e confirmada.

#### Scenario: Evidências do Revisor são exibidas

- **WHEN** o admin abre a comparação de um experimento no modo `reviewer`
- **THEN** a imagem avaliada e as duas respostas são exibidas
- **AND** as evidências de revisão são exibidas

#### Scenario: Diagnóstico esperado fica oculto

- **WHEN** a comparação do Revisor é exibida antes da avaliação cega
- **THEN** o diagnóstico esperado e as categorias esperadas **não** são exibidos
- **AND** só aparecem após a revelação protegida

### Requirement: Classificação do Revisor registrada por run

A avaliação humana do Revisor SHALL ser registrada **por run**, de forma append-only, distinguindo a avaliação cega (antes da revelação) da classificação (depois da revelação). O formulário SHALL reiniciar quando o par comparado muda e SHALL NOT exibir nota automática.

#### Scenario: Classificação por run é registrada

- **WHEN** o admin classifica um run do Revisor
- **THEN** a classificação é persistida para aquele run
- **AND** a classificação do outro run permanece independente

#### Scenario: Reavaliação preserva histórico

- **WHEN** o admin reclassifica um run
- **THEN** um novo registro é criado
- **AND** o registro anterior permanece preservado

#### Scenario: Nenhuma nota automática

- **WHEN** a avaliação do Revisor é exibida
- **THEN** não há nota automática de qualidade
- **AND** a decisão permanece humana
