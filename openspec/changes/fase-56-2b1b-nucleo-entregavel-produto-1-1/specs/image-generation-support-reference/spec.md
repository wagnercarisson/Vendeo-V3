# Image Generation Support Reference

## MODIFIED Requirements

### Requirement: Diagnóstico durável correlacionado

Falha operacional real SHALL persistir diagnóstico correlacionado a referência opaca `IMG-001`, recuperável em nova requisição e visível somente a suporte/admin autorizado.

#### Scenario: Suporte correlaciona falha
- **WHEN** suporte consulta a referência
- **THEN** recupera categoria, par, target, tentativa, erro normalizado e run/trace sem expor ao lojista
