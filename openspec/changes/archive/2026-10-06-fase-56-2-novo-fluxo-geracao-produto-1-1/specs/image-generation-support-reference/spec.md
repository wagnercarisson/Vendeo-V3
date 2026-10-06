# Image Generation Support Reference

## ADDED Requirements

### Requirement: Falha real produz e persiste referência de atendimento

Toda falha de geração do novo fluxo SHALL produzir, para o lojista, o código público `IMG-001` e uma referência opaca, e SHALL persistir de forma durável o diagnóstico interno correlacionado à referência.

#### Scenario: Falha real persiste diagnóstico

- **WHEN** uma falha real encerra a operação do novo fluxo
- **THEN** um diagnóstico interno é persistido com a referência opaca
- **AND** a mensagem pública permanece sem motivo interno

#### Scenario: Diagnóstico sobrevive à requisição

- **WHEN** o suporte consulta a referência em uma nova requisição
- **THEN** o diagnóstico é recuperado de forma durável
- **AND** não depende de estado em memória

### Requirement: Correlação segura no admin/suporte para o fluxo real

A referência SHALL permitir ao admin/suporte recuperar o diagnóstico interno da operação real (categoria interna, modelo, qualidade, alvo, tentativa, erro normalizado e run/trace), sem expor esses dados ao lojista.

#### Scenario: Suporte obtém o diagnóstico da operação real

- **WHEN** o admin/suporte informa a referência de uma falha real
- **THEN** ele obtém categoria, par modelo–qualidade, alvo, tentativa e run/trace
- **AND** essa informação não é exposta na mensagem pública
