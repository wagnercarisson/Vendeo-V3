# Image Generation Support Reference — Delivery Integration

## MODIFIED Requirements

### Requirement: Correlação segura no admin/suporte

A referência de atendimento SHALL permitir que o admin/suporte recupere o **diagnóstico interno** correspondente (categoria interna, provider/modelo/qualidade, tentativa, erro normalizado e run/trace), de forma segura e precisa, sem exigir que o lojista informe qualquer detalhe técnico. Na b1b, o diagnóstico SHALL também cobrir operações pendentes/limitadas e tentativas com resultado desconhecido, distinguindo-as de falhas confirmadas.

#### Scenario: Suporte correlaciona a referência

- **WHEN** o admin/suporte recebe a referência de atendimento
- **THEN** ele obtém o diagnóstico interno associado àquela ocorrência
- **AND** o diagnóstico identifica a categoria interna, o par modelo–qualidade e a tentativa

#### Scenario: Referência de falha elegível e não elegível

- **WHEN** a referência pertence a uma falha elegível ou não elegível
- **THEN** o admin/suporte consegue distinguir o tipo de falha internamente
- **AND** essa distinção não é exposta na mensagem pública

#### Scenario: Resultado desconhecido é correlacionável

- **WHEN** a operação está pendente por resultado desconhecido
- **THEN** o suporte recupera o diagnóstico da tentativa afetada
- **AND** distingue resultado desconhecido de falha confirmada

## ADDED Requirements

### Requirement: Diagnóstico durável correlacionado a IMG-001

Falha operacional real SHALL persistir diagnóstico correlacionado à referência opaca `IMG-001`, recuperável em nova requisição e visível somente a suporte/admin autorizado, sem expor o motivo interno ao lojista.

#### Scenario: Diagnóstico recuperável

- **WHEN** o suporte consulta a referência
- **THEN** recupera categoria, par, alvo, tentativa, erro normalizado e run/trace
- **AND** o lojista não recebe o motivo interno
