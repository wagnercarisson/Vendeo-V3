## MODIFIED Requirements

### Requirement: Publication copy snapshot shape v1

O sistema SHALL definir o shape de `publication_copy_snapshot` com campos: `title? (string, opcional)`, `caption (string)`, `hashtags (string[])`, `cta_post (string)`.

O campo `title` é ADICIONADO como opcional. Campanhas existentes (v1.3/v1.4) têm snapshot sem `title` e continuam funcionando sem quebras. A UI trata `title` como opcional.

Isso NÃO requer migração de banco. `publication_copy_snapshot` é JSONB — adicionar `title` no JSON é compatível retroativo.

> Updated by `fase-14-integracao-fluxo-geracao` — shape realinhado para o kit de publicação da milestone v1.3.

#### Scenario: Publication copy snapshot accepts title

- **WHEN** `publication_copy_snapshot` é populado após a F23
- **THEN** contém `caption`, `hashtags` (array de strings), `cta_post`, e opcionalmente `title`
- **AND** snapshots sem `title` (v1.3/v1.4) continuam válidos

#### Scenario: Publication copy snapshot without title is valid

- **WHEN** um snapshot existente (pré-F23) é lido
- **THEN** `title` é `undefined` e não causa erro de tipo
