# Lab Runs

> Delta da capability `lab-runs` pela `fase-48-2-2-auditoria-otimizacao-prompt-revisor`. Adiciona a execução isolada do Revisor sobre o caso de revisão e a persistência das evidências de revisão, sem expor o diagnóstico.

## ADDED Requirements

### Requirement: Execução isolada do Revisor sobre o caso de revisão

O modo `reviewer` SHALL executar somente `campaign_image_review` sobre a imagem de um caso de revisão, com briefing/fatos congelados, imagens de referência aplicáveis, tipo de campanha e o prompt baseline × candidato. O run SHALL referenciar a versão do caso e conferir o hash da imagem; a execução SHALL NOT gerar, corrigir ou regenerar arte e SHALL NOT disparar o pipeline produtivo.

#### Scenario: Revisor avalia a imagem do caso

- **WHEN** um run do Revisor é executado
- **THEN** ele recebe a imagem do caso de revisão e os fatos congelados
- **AND** ele executa somente `campaign_image_review`

#### Scenario: Hash da imagem é conferido

- **WHEN** um run do Revisor é executado
- **THEN** o hash da imagem é conferido contra o registrado no caso
- **AND** divergência recusa a execução com `review_case_hash_mismatch` sem chamada paga

#### Scenario: Revisor não gera arte

- **WHEN** um run do Revisor é executado
- **THEN** nenhuma chamada de geração de imagem é feita
- **AND** nenhum artefato de arte é produzido ou persistido

#### Scenario: Revisor não dispara o pipeline produtivo

- **WHEN** um run do Revisor é executado
- **THEN** nenhuma revisão, correção ou publicação produtiva é disparada
- **AND** nenhuma tabela ou bucket produtivo é tocado

### Requirement: Evidências da revisão persistidas

Cada run do Revisor SHALL persistir separadamente: a resposta estruturada; `passed`; as issues e severidades; os erros de parse/schema; o modelo efetivamente usado; o custo, a latência e o usage; o prompt e os hashes; e a imagem/caso avaliados. Uma falha de parse/schema SHALL ser registrada explicitamente e SHALL NOT ser tratada como aprovação. O snapshot do run SHALL conter apenas a referência ao caso de revisão e o hash da imagem — nunca o diagnóstico esperado em texto nem em hash.

#### Scenario: Resposta estruturada é persistida

- **WHEN** um run do Revisor conclui
- **THEN** a resposta estruturada, `passed` e as issues/severidades são persistidas
- **AND** o modelo efetivamente usado, custo, latência e usage são registrados

#### Scenario: Erro de parse é registrado

- **WHEN** a resposta do Revisor não é um JSON válido ou não satisfaz o schema
- **THEN** o erro de parse/schema é persistido explicitamente
- **AND** o run não é tratado como aprovação

#### Scenario: Snapshot preserva a cegueira

- **WHEN** um run do Revisor é persistido
- **THEN** o snapshot contém apenas a referência ao caso de revisão e o hash da imagem
- **AND** o diagnóstico esperado não aparece em texto nem em hash no snapshot exposto
