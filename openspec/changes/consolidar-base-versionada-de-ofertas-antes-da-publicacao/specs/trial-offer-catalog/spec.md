## ADDED Requirements

### Requirement: Instalação consolidada do estado final

O pacote de instalação da base versionada de ofertas SHALL ser uma única migration que instala diretamente o estado final corrigido a partir da base anterior à F63: tabela, constraints, funções, guard corrigido, comentário final, RLS/grants, oferta inicial v1 publicada e vigência `NOT NULL`. A migration SHALL NOT instalar primeiro o guard defeituoso da Migration A para corrigi-lo depois, SHALL NOT depender de A/B/C/D e SHALL NOT incluir limpeza do homolog nem exclusão de ledger.

#### Scenario: Instalação a partir da base anterior à F63

- **WHEN** a migration consolidada é aplicada em uma base que ainda não possui objetos da F63
- **THEN** o resultado contém `trial_offer_versions`, as sete funções, os três triggers, a coluna `current_version_id` `NOT NULL`, a v1 publicada e vigente, RLS e grants restritos a `service_role`

#### Scenario: Guard final e comentário final na mesma instalação

- **WHEN** a instalação termina
- **THEN** `trial_offer_versions_guard()` já aceita `published_by` na primeira publicação e o comentário da função é o texto final, sem necessidade de uma migration corretiva posterior

#### Scenario: Oferta inicial e contratos validados na instalação

- **WHEN** o seed da v1 é executado
- **THEN** o calendário real produz quatro liberações de 5 créditos nos dias 0, 7, 14 e 21, total 20, e as leituras `trial_offer_conditions`, `trial_offer_public_offer` e `trial_offer_release_schedule` respondem conforme os contratos da 2A

#### Scenario: Nenhuma limpeza ou exclusão de ledger no SQL de produção

- **WHEN** o arquivo consolidado é inspecionado
- **THEN** ele não contém `DELETE` em `supabase_migrations`, remoção de objetos da F63, `DROP TABLE`, `DROP COLUMN` ou `TRUNCATE`

### Requirement: Precondições fail-closed e independência do histórico

A migration consolidada SHALL abortar antes de criar qualquer objeto quando detectar instalação prévia ou parcial da F63, incluindo tabela, coluna, constraint, função, trigger ou ausência/multiplicidade da linha singleton de `trial_offer_settings`. A migration SHALL NOT consultar o ledger para decidir a instalação; a ausência de A/B/C/D SHALL ser verificada pelo preflight e pelo aplicador.

#### Scenario: Instalação sobre objeto F63 existente

- **WHEN** a migration é executada em uma base que já possui `trial_offer_versions` ou `current_version_id`
- **THEN** ela falha fechado e nenhum objeto parcial é criado

#### Scenario: Base sem a linha singleton da oferta

- **WHEN** `trial_offer_settings` não contém exatamente uma linha com `offer_key = 'trial_28d_v1'`
- **THEN** a migration aborta antes do seed e da vigência

#### Scenario: Independência de A/B/C/D

- **WHEN** o arquivo consolidado é aplicado em uma base sem A/B/C/D
- **THEN** a instalação conclui sem exigir nenhuma dessas migrations ou seus objetos intermediários

### Requirement: Reconciliação exclusiva do homolog

A retirada dos efeitos da F63 SHALL ocorrer somente no homolog local exclusivo, após confirmação de identidade do container, porta, banco e versão, e SHALL remover estruturalmente apenas os objetos e dados próprios da F63. A reconciliação SHALL excluir exatamente as três entradas de ledger de A/B/C por pares `(version, name)`, SHALL comprovar o retorno ao baseline pré-F63 e SHALL NOT usar reset, banco novo, `CASCADE` amplo, `TRUNCATE` ou alteração de dados anteriores.

#### Scenario: Identidade divergente

- **WHEN** o container, porta, banco ou versão não correspondem ao homolog exclusivo
- **THEN** o procedimento de reconciliação não executa nenhuma escrita

#### Scenario: Ledger ou versões divergentes

- **WHEN** o ledger não contém exatamente A/B/C como últimas entradas, ou existem rascunhos, linhas não pertencentes à v1/fixtures `f63test-%` ou referências externas
- **THEN** o procedimento interrompe sem remover nada

#### Scenario: Retirada estrutural dos objetos próprios

- **WHEN** a remoção é executada
- **THEN** trigger de vigência, FK composta, `NOT NULL`, valor de vigência, triggers da versão, tabela, funções e coluna são removidos na ordem segura, e as três linhas de ledger são excluídas por par exato, sem desativar proteções de forma indiscriminada

#### Scenario: Retorno ao baseline pré-F63

- **WHEN** a remoção é concluída
- **THEN** o ledger tem 158 linhas com o SHA-256 do baseline de 63-01, os objetos da F63 estão ausentes e as quatro tabelas preservadas mantêm contagem e checksum

#### Scenario: Falha durante a remoção

- **WHEN** qualquer verificação ou comando da remoção falha
- **THEN** a transação é revertida integralmente e o estado da F63 permanece intacto

### Requirement: Recuperação e integridade transacional

A remoção e a instalação SHALL ser executadas em transações próprias com `ON_ERROR_STOP`, timeouts explícitos e rollback integral em falha. Uma falha na instalação SHALL deixar a base anterior à F63, sem objetos parciais, e a recuperação SHALL preservar os SQLs e as versões originais de A/B/C, sem fabricar entradas de ledger.

#### Scenario: Falha na instalação consolidada

- **WHEN** a instalação consolidada falha após a remoção ter sido confirmada
- **THEN** a transação de instalação é revertida, a base permanece sem objetos da F63 e o SQL pode ser corrigido e reaplicado

#### Scenario: Abandono da consolidação

- **WHEN** a consolidação é abandonada após a remoção
- **THEN** A/B/C são reaplicadas a partir dos arquivos históricos originais, na ordem e com as versões/hashes preservados, sem edição manual do ledger

### Requirement: Preservação de contratos e dados existentes

A consolidação SHALL preservar integralmente os contratos funcionais da 2A e os dados anteriores: `trial_offer_enrollments` sem `offer_version_id`, RPCs legadas, consumidores, créditos, entitlements, Admin e regras comerciais. A validação SHALL usar o baseline de cada ambiente e SHALL NOT comparar hashes brutos de funções legadas entre ambientes nem usar igualdade de contagem de ledger como prova de paridade.

#### Scenario: Tabelas preservadas

- **WHEN** a instalação termina
- **THEN** `trial_offer_enrollments`, `credit_balances`, `credit_transactions` e `freemium_entitlements` mantêm contagem e checksum iguais ao baseline do mesmo ambiente

#### Scenario: Contratos anteriores inalterados

- **WHEN** os gates de schema são executados
- **THEN** as cinco funções legadas mantêm seus hashes no baseline do ambiente, as colunas de `trial_offer_enrollments` permanecem iguais e `trial_offer_settings` contém apenas os oito campos anteriores mais `current_version_id`

#### Scenario: Suíte existente

- **WHEN** as suítes F63, de contratos SQL↔TypeScript e a suíte global são executadas
- **THEN** elas passam sem troca de baseline, sem desativação de guardas e sem ampliação de exceções

### Requirement: Rastreabilidade histórica das migrations substituídas

Os arquivos A/B/C/D SHALL ser preservados byte a byte fora do diretório de migrations executáveis, com manifesto contendo versão, nome, SHA-256, status de aplicação e vínculo com a migration consolidada. A change arquivada da 2A SHALL NOT ser reescrita, e a substituição controlada de migrations já aplicadas SHALL ser tratada como exceção exclusiva do homolog.

#### Scenario: Arquivos históricos preservados

- **WHEN** o manifesto histórico é verificado
- **THEN** cada SQL arquivado existe e tem o SHA-256 original, e A/B/C permanecem identificados como aplicados no homolog e D como preparada e nunca aplicada

#### Scenario: Diretório executável sem histórico

- **WHEN** `supabase/migrations` é inspecionado após a consolidação
- **THEN** A/B/C/D não estão presentes e existe exatamente uma migration consolidada da F63

#### Scenario: Change arquivada intacta

- **WHEN** os artefatos da change arquivada da 2A são comparados
- **THEN** nenhum arquivo histórico foi reescrito para apagar ou alterar a decisão original

### Requirement: Promoção do mesmo artefato com gates separados

O arquivo consolidado validado no homolog SHALL ser o único candidato à produção, identificado pelo mesmo SHA-256. A promoção SHALL exigir preflight de compatibilidade próprio do ambiente, conferência de ledger, objetos, permissões/RLS, tratamento separado da divergência pré-existente de `f50_legal_publication` e smoke pós-instalação. Produção SHALL permanecer sem autorização nesta change.

#### Scenario: Candidato único

- **WHEN** a promoção é preparada
- **THEN** o SHA-256 do arquivo aprovado no homolog é idêntico ao do candidato de produção

#### Scenario: Divergência de ambiente não mascarada

- **WHEN** produção possui a migration `20261030185658_f50_legal_publication` ausente no homolog
- **THEN** a divergência é registrada como gate separado de compatibilidade e não é corrigida, aplicada ou usada para igualar ledgers

#### Scenario: Produção não autorizada

- **WHEN** esta change é concluída
- **THEN** nenhum DDL/DML, deploy, push, merge ou acesso remoto foi executado em produção
