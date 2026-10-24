## ADDED Requirements

### Requirement: Contrato explícito de ambiente operacional

O sistema SHALL declarar explicitamente o ambiente operacional da Assinatura
Visual como um enum fechado (`local_validation` ou `production`) e SHALL NOT
inferir o ambiente apenas de `NODE_ENV`, `VERCEL` ou de qualquer variável
ausente.

O contrato SHALL exigir, simultaneamente: ambiente declarado, identidade
Supabase canônica esperada, credencial operacional dedicada e habilitação
explícita. A ausência ou divergência de qualquer dimensão SHALL falhar fechado
com erro tipado, sem fallback silencioso.

O ambiente `preview` SHALL ser sempre recusado neste recorte, pois o enum não
possui valor `preview`. Uma execução de preview SHALL NOT consumir configuração,
credencial ou banco de produção por herança, mesmo que as variáveis de produção
existam no projeto e a identidade seja semelhante.

#### Scenario: Ambiente declarado e identidade conferem

- **WHEN** o ambiente declarado é `production`, a identidade Supabase observada é exatamente a esperada e existe credencial operacional dedicada
- **THEN** o contrato é satisfeito e a operação pode prosseguir
- **AND** nenhum valor de credencial é registrado, retornado ou incluído em telemetria

#### Scenario: Ausência de dimensão falha fechado

- **WHEN** o ambiente declarado, a identidade esperada ou a credencial dedicada estiverem ausentes
- **THEN** a operação é recusada com erro tipado
- **AND** nenhuma chamada ao provedor é realizada
- **AND** nenhuma configuração é gravada

#### Scenario: Preview é sempre recusado

- **WHEN** a execução ocorre em preview
- **THEN** a execução é recusada
- **AND** nenhuma variável de produção é utilizada por omissão
- **AND** não existe exceção por identidade enquanto o enum não possuir `preview`
- **AND** a recusa é distinguível de falha de provedor

### Requirement: Publicação e ativação separadas

O sistema SHALL manter estados distintos e verificáveis para código integrado,
código publicado, migrations aplicadas, configuração publicada e configuração
ativada. Publicar código ou aplicar migrations SHALL NOT ativar a configuração.

Os estados `config_published` e `config_activated` SHALL iniciar como `false` e
SHALL ser alterados somente por operação administrativa auditada, com ator,
motivo e `operation_id`. A ativação SHALL NOT ocorrer como efeito colateral de
deploy, de aplicação de migration ou de leitura de configuração.

A ordem única de release SHALL ser: migrations aditivas → publicação de código
compatível com o schema já aplicado → publicação da configuração → piloto →
ativação. As migrations SHALL ser compatíveis com o código atualmente publicado,
e o código novo SHALL ser compatível com o schema já aplicado.

#### Scenario: Deploy não ativa configuração

- **WHEN** o código é publicado sem ponteiros de publicação/ativação
- **THEN** a geração continua usando o caminho legado
- **AND** a configuração dedicada não é consumida
- **AND** os estados permanecem inalterados após o deploy

#### Scenario: Ordem única de release

- **WHEN** o lote é promovido
- **THEN** as migrations aditivas são aplicadas antes do código novo
- **AND** o código atualmente publicado continua funcionando após o lote
- **AND** o código novo só é publicado depois do schema estar disponível
- **AND** a configuração só é publicada depois do código
- **AND** o piloto e a ativação vêm depois da configuração

#### Scenario: Aplicação de migration não ativa configuração

- **WHEN** o lote de migrations é aplicado em produção
- **THEN** a tabela e a RPC existem, mas a configuração permanece desativada
- **AND** nenhuma loja passa a consumir a configuração dedicada
- **AND** `individual_launch_at` da F50.4 permanece inalterado

#### Scenario: Ativação exige operação auditada

- **WHEN** um administrador ativa a configuração
- **THEN** a auditoria registra ator, motivo, `operation_id`, ambiente e identidade
- **AND** a ativação é limitada ao escopo autorizado (piloto ou geral)
- **AND** o estado anterior é recuperável por desativação auditada

### Requirement: Renumeração imutável e manifesto de integração

O conjunto integrado SHALL conter exatamente uma migration F47.1 renumerada com
timestamp real UTC no formato `YYYYMMDDHHmmss`, único entre worktrees, branches
locais, branches paralelas conhecidas e refs remotas. O conjunto SHALL conter
também uma migration corretiva F47.2 separada, com timestamp próprio, para
estados de liberação e allowlist.

A migration da F50.3 SHALL preservar sua versão original. A versão e o SHA-256
originais da migration F47.1 SHALL permanecer registrados como evidência
histórica, junto da aplicação local já realizada.

O sistema SHALL produzir um **manifesto de integração/renumação**, artefato de
repositório e independente do ledger de produção, contendo: versão antiga e nova
da F47.1, SHA-256 original preservado, versão/SHA da F47.2, ordem, commit de
origem, destino local da aplicação antiga, data e prova de compatibilidade do
schema com o código anterior. Esse manifesto SHALL NOT ser apresentado como
manifesto completo de release.

#### Scenario: Prefixo duplicado bloqueia a integração

- **WHEN** o timestamp candidato da F47.1 ou da F47.2 já existir em qualquer ref ou branch conhecida
- **THEN** a integração é interrompida
- **AND** um novo timestamp real é obtido e verificado
- **AND** nenhum arquivo é renomeado com prefixo duplicado

#### Scenario: F50.3 permanece intacta

- **WHEN** a migration F47.1 é renumerada
- **THEN** `20261021000001_f50_3_cnpj_alfanumerico.sql` conserva nome e conteúdo
- **AND** o SHA-256 original da F47.1 é preservado no registro de renomeação
- **AND** apenas o nome do arquivo F47.1 muda

#### Scenario: Manifesto de integração é determinístico

- **WHEN** o manifesto de integração é emitido
- **THEN** ele lista os dois passos com versões e SHAs próprios
- **AND** não depende do ledger de produção
- **AND** comprova que o código atualmente publicado suporta o schema novo

### Requirement: Manifesto completo de release e lote aprovado

O sistema SHALL produzir um **manifesto completo de release** somente após a
consulta read-only do ledger observado. O manifesto SHALL derivar o lote remoto
da interseção entre o lote aprovado e as migrations realmente ausentes,
registrando versão, descrição, SHA-256, dependências, ordem e estado esperado.

Se uma dependência estiver ausente do ledger e não fizer parte do lote aprovado,
o gate SHALL parar e exigir autorização explícita. O sistema SHALL NOT aplicar
migrations fora do lote aprovado, SHALL NOT executar “catch-up” automático e
SHALL NOT usar `db push` genérico, `migration repair` ou edição de ledger.

#### Scenario: Lote remoto deriva do ledger observado

- **WHEN** o ledger é consultado e parte do lote aprovado já está aplicada
- **THEN** o manifesto lista somente as migrations ausentes
- **AND** cada item mantém versão, SHA e ordem do lote aprovado
- **AND** o estado esperado após a aplicação é registrado

#### Scenario: Dependência ausente fora do lote para o gate

- **WHEN** uma migration do lote depende de outra que não está no ledger nem no lote aprovado
- **THEN** nenhuma aplicação é realizada
- **AND** o gate registra a dependência ausente
- **AND** exige autorização explícita para ampliar o lote

#### Scenario: Ledger divergente não é reparado automaticamente

- **WHEN** o ledger contém uma versão do lote com conteúdo divergente
- **THEN** o gate para
- **AND** nenhuma edição de ledger ou `migration repair` é executada
- **AND** a divergência é reportada para decisão humana

### Requirement: Verificação read-only de produção

Antes de qualquer escrita remota, o sistema SHALL permitir conferência
somente leitura de deployment, ledger de migrations, catálogo de modelos,
pricing e presença de credenciais. A conferência SHALL NOT expor valores de
segredos, connection strings ou tokens.

A conferência SHALL registrar a identidade do ambiente e o SHA do deployment
observado, distinguindo o que foi verificado do que permanece desconhecido. Os
valores observados de `individual_launch_at`, flags e coortes SHALL ser
preservados; o sistema SHALL NOT presumir que a política da F50.4 esteja
inativa.

#### Scenario: Conferência identifica deployment e ledger

- **WHEN** a conferência read-only é executada
- **THEN** deployment, SHA, ledger, catálogo e pricing são reportados
- **AND** a presença de credenciais é reportada apenas como booleano
- **AND** nenhum segredo aparece na saída ou em artefato

#### Scenario: Manifesto completo de release contém os dois passos

- **WHEN** o manifesto completo de release é emitido
- **THEN** ele lista a F47.1 renumerada com SHA-256 original preservado
- **AND** lista a migration corretiva F47.2 com versão e SHA próprios
- **AND** limita o lote ao que está ausente no ledger observado
- **AND** comprova que o código anterior continua compatível com o schema

#### Scenario: Divergência impede escrita remota

- **WHEN** a identidade do ambiente ou o ledger observado divergir do esperado
- **THEN** o gate de migrations remotas é bloqueado
- **AND** nenhuma aplicação remota é realizada

#### Scenario: Presença de valores da F50.4 é preservada

- **WHEN** a conferência lê `individual_launch_at`, flags e coortes
- **THEN** os valores observados são registrados sem alteração
- **AND** nenhuma conclusão presume que a F50.4 esteja inativa
- **AND** a conferência permanece somente leitura

### Requirement: Piloto e ativação com critério de parada

O sistema SHALL permitir piloto limitado por allowlist explícita, com custo,
duração e escopo registrados. A ativação geral SHALL ser um gate separado e
posterior à aprovação do piloto.

O piloto SHALL possuir critério de parada verificável, incluindo falha de
geração, custo anômalo, apresentação incorreta de perfil ou qualquer sinal de
interferência na F50.4. Atingido o critério, a configuração SHALL ser desativada
sem apagar histórico.

#### Scenario: Piloto limitado não alcança outras lojas

- **WHEN** o piloto é ativado para uma allowlist
- **THEN** somente as lojas autorizadas consomem a configuração dedicada
- **AND** as demais permanecem no caminho legado
- **AND** o escopo do piloto é auditado

#### Scenario: Critério de parada desativa a configuração

- **WHEN** um critério de parada é atingido durante o piloto
- **THEN** `config_activated` retorna a `false` por operação auditada
- **AND** a geração volta ao caminho legado
- **AND** configuração e histórico permanecem preservados

#### Scenario: Ativação geral exige aprovação do piloto

- **WHEN** a ativação geral é solicitada sem aprovação registrada do piloto
- **THEN** a operação é recusada
- **AND** nenhuma loja fora do piloto é afetada

### Requirement: Recuperação e rollback com banco forward-only

O sistema SHALL oferecer desativação e reset auditados como recuperação
operacional da Assinatura Visual. O rollback de código SHALL ser feito por
redeploy do SHA anterior e SHALL NOT ser tratado como reversão de migrations.

Correções de schema SHALL ser forward-only. O sistema SHALL NOT editar ledger,
apagar migration aplicada ou presumir que rollback de código desfaz o schema.

#### Scenario: Desativação recupera o caminho legado

- **WHEN** a configuração é desativada por operação auditada
- **THEN** novas operações usam o caminho legado
- **AND** o histórico de configuração e auditoria é preservado
- **AND** nenhuma migration é revertida

#### Scenario: Rollback de código não altera schema

- **WHEN** o código é revertido para o SHA anterior
- **THEN** as migrations permanecem aplicadas
- **AND** a compatibilidade com o schema forward-only é verificada
- **AND** a recuperação de dados não depende de rollback de banco
