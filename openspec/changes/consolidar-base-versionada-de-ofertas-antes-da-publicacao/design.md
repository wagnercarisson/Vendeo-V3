## Context

A F63/2A (spec funcional `trial-offer-catalog`) já está aprovada e validada no homolog existente. O estado foi revalidado em **2026-11-27** por leitura somente:

- Homolog: workdir `G:\Vendeo-Homolog`, container `supabase_db_vendeo-homolog`, `127.0.0.1:57782/postgres`, PostgreSQL 17.6, container em execução, publicação `0.0.0.0:57782,[::]:57782`.
- Ledger: **161** linhas; últimas três exatamente A `20261126223854/offer_catalog_versions`, B `20261126230735/offer_catalog_seed_v1` e C `20261126231022/offer_catalog_published_by_fix`. D `20261127004704` **ausente**.
- `trial_offer_versions`: 16 linhas, todas publicadas, **0 rascunhos**, sendo v1 + 15 fixtures `f63test-%`; `current_version_id` aponta para v1 e é `NOT NULL`.
- Nenhuma referência externa: apenas a FK composta de `trial_offer_settings` referencia a tabela; não há views, `trial_offer_enrollments.offer_version_id` nem função legada citando `trial_offer_versions`. As quatro funções que citam a tabela são todas da F63.
- Comentário atual do guard é o texto antigo da Migration A; D (comentário final) nunca foi aplicada.

A implementação funcional está correta, mas o histórico A/B/C/D é impróprio para a primeira instalação em produção: A contém um guard defeituoso, C o corrige depois e D apenas corrige o comentário. Produção não tem nenhum objeto da F63 e precisa receber diretamente o estado final.

Divergência independente e anterior à F63: produção possui `20261030185658_f50_legal_publication`; o homolog não a possui. Ela é somente dados de documentos legais, não toca objetos da oferta, e **não é corrigida nesta change**. Também não se usa igualdade de contagem de ledger como prova de paridade: os hashes brutos de funções legadas diferem entre ambientes, ainda que os corpos coincidam após normalização de espaços. Cada ambiente usa o próprio baseline.

## Goals / Non-Goals

**Goals:**

- Produzir **uma migration de instalação consolidada** que, partindo da base anterior à F63, instala o estado final correto sem passar pelo guard defeituoso: estrutura, constraints, funções, guard corrigido, comentário final, RLS/grants, seed v1 e vigência `NOT NULL`.
- Provar, no homolog existente, que o arquivo consolidado instala corretamente a partir da base real anterior à F63, com preservação de dados e contratos.
- Reconciliar **somente o homolog exclusivo**, removendo exatamente os efeitos da F63 e as três entradas de ledger de A/B/C, com retorno verificável ao baseline pré-F63.
- Preservar SQL, hashes e evidências de A/B/C/D em local não executável, com manifesto de substituição.
- Atualizar harness, stages, testes e referências antigas sem criar camadas de compatibilidade desnecessárias.
- Separar claramente: validação local, preparação de produção e autorização de publicação.
- Preservar o trabalho útil da quick `261126-u83` (guarda estrito e lint TypeScript).

**Non-Goals:**

- Não alterar contratos funcionais da oferta, consumidores, Admin, flags, copy pública, RPCs de elegibilidade/concessão/parcelas, créditos, entitlements ou concessões.
- Não adicionar `offer_version_id`, não fazer backfill e não iniciar a subfatia 2B.
- Não aplicar A/B/C/D em produção, não corrigir a divergência F50 legal e não igualar ledgers.
- Não usar `db reset`, banco novo, `CASCADE` amplo, `TRUNCATE`, restore ou alteração de dados anteriores à F63.
- Não reescrever a change arquivada `2026-11-26-fase-2a-base-versionada-de-ofertas` nem apagar evidências históricas.
- Não commitar, publicar, fazer push/merge/deploy ou acessar produção nesta etapa.

## Decisions

### 1. Uma única migration consolidada instala o estado final

O pacote será um arquivo `supabase/migrations/YYYYMMDDHHmmss_offer_catalog_consolidated_install.sql`, com timestamp UTC real no instante da criação e unicidade conferida no worktree, branch de destino, branches paralelas conhecidas e, no gate de promoção, no ledger de produção.

A ordem interna é a de uma instalação limpa, sem estados intermediários:

1. Precondições fail-closed (nenhum objeto F63 existente; settings singleton presente).
2. Tabela `public.trial_offer_versions`, comentários, checks, unicidades e FKs.
3. Helper `trial_offer_calendar_reaches_total`.
4. Guard final de `trial_offer_versions_guard()` (já com a correção de C) e seu comentário final (texto da D).
5. Guard de exclusão e triggers da versão.
6. `current_version_id` nullable, FK composta e trigger de vigência.
7. As três funções de leitura: `trial_offer_conditions`, `trial_offer_public_offer` e `trial_offer_release_schedule`.
8. Seed da v1 publicada, calendário fail-closed, atribuição da vigência, `SET NOT NULL` e validação dos contratos de leitura.
9. RLS, policy e grants restritos a `service_role`.
10. Bloco `-- REVERT` comentado, sem execução automática.

As três funções de leitura são criadas no passo 7, **antes** de qualquer validação do passo 8 que as invoque. Nenhuma validação pode depender de função ainda não criada.

**Alternativa descartada:** instalar A, depois B, depois C e depois D, mesmo em produção. Propaga um guard defeituoso conhecido, cria quatro entradas de ledger e exige que produção atravesse estados inválidos.

**Alternativa descartada:** editar A in-place e reaplicá-la. Violaria o histórico já aplicado no homolog e não resolveria o pacote de produção.

### 2. A migration consolidada falha fechada e não contém limpeza

Antes de criar qualquer objeto, um bloco `DO` deve abortar com mensagem estável se encontrar qualquer um destes sinais de instalação prévia/parcial:

- `to_regclass('public.trial_offer_versions')` não nulo;
- coluna `trial_offer_settings.current_version_id` existente;
- constraint `fk_trial_offer_settings_current_version` existente;
- qualquer uma das sete funções da F63 já existente;
- qualquer um dos três triggers da F63 já existente;
- ausência ou multiplicidade da linha singleton `trial_offer_settings.offer_key = 'trial_28d_v1'`.

O SQL destinado à produção **não** contém `DELETE` de ledger, remoção de objetos, `DROP TABLE`, `DROP COLUMN`, `TRUNCATE` ou qualquer operação de limpeza do homolog. A linha do ledger é inserida pelo wrapper transacional do aplicador na mesma transação.

A migration não consulta `supabase_migrations` diretamente. A ausência de A/B/C/D no ledger é verificada pelo preflight/aplicador, mantendo o SQL independente da tabela de controle.

### 3. Seed, vigência e validações dentro da instalação

A instalação cria a v1 (`trial_28d_v1`/`v1`, “Teste gratuito de 28 dias”, 28 dias, 20 créditos, semanal, 5 por liberação) publicada com motivo não vazio, define `current_version_id` e só então aplica `NOT NULL`.

A linha de `trial_offer_settings` é travada com `SELECT ... FOR UPDATE` antes do snapshot dos oito campos pré-existentes. Isso evita falso negativo por atualização concorrente de `enabled`/`launch_at` durante a migration e mantém a serialização da vigência. As três funções de leitura já foram criadas no passo 7 da ordem de instalação; somente depois disso as validações embutidas da 2A são executadas:

- calendário real = 4 liberações de 5 nos dias 0/7/14/21, total 20, vencimento em `started_at + 28 dias`;
- `trial_offer_conditions(NULL)` e `(v1)` com 9 campos e valores da v1;
- `trial_offer_public_offer()` com exatamente 6 campos e sem chaves proibidas;
- `current_version_id` aponta para versão publicada do mesmo programa e a coluna terminou `NOT NULL`;
- os oito campos pré-existentes de settings permanecem iguais.

**Decisão:** não embutir checksums das quatro tabelas preservadas no SQL de instalação. Elas não são tocadas, e um checksum dentro da migration poderia falhar por escrita concorrente legítima em créditos ou exigir locks desnecessários em produção. A preservação é provada externamente, contra o baseline de cada ambiente.

### 4. Reconciliação exclusiva do homolog em duas fases

A reconciliação é um procedimento operacional separado do SQL de produção, executável apenas contra o container fixo do homolog, com identidade validada por `assertHomologIdentity()` e sem aceitar URL/banco arbitrário.

**Critérios que impedem a retirada** (revalidados em R0 e imediatamente antes de R1):

- qualquer referência nova à `trial_offer_versions`, inclusive `trial_offer_enrollments.offer_version_id`, FK, view, função ou consumidor fora dos objetos da própria F63;
- qualquer concessão, crédito, entitlement ou registro de negócio referenciando versões;
- qualquer linha que não seja a v1 ou fixture `f63test-%`, qualquer rascunho ou versão referenciada por algo além da vigência;
- ledger diferente de 161 com A/B/C exatas nas últimas posições, D aplicada ou qualquer entrada extra da F63;
- aplicação de A/B/C em ambiente que não seja o homolog exclusivo;
- grants, policies ou consumidores externos usando a tabela;
- baseline das quatro tabelas preservadas divergente do 63-01.

**Fase R0 — preflight somente leitura.** Exige e registra:

- container/porta/banco/versão e container exclusivo;
- ledger 161, últimas três linhas A/B/C exatas, D ausente; fingerprint `all_rows`;
- 16 versões, todas publicadas, 0 rascunhos, sendo v1 + 15 `f63test-%`; `current_version_id` → v1 e `NOT NULL`;
- nenhuma referência externa (FK/view/função fora do conjunto F63, sem `offer_version_id`);
- snapshot das quatro tabelas preservadas, dos oito campos de settings e dos hashes das cinco funções legadas;
- hashes dos arquivos A/B/C e da D preparada.

Qualquer divergência interrompe o procedimento; não se “ajusta” o critério para prosseguir.

**Fase R1 — remoção estrutural em uma transação.** Ordem:

1. `SET LOCAL lock_timeout`/`statement_timeout` e reassert das precondições dentro da transação.
2. `SELECT ... FOR UPDATE` da linha singleton; snapshot dos oito campos.
3. `DROP TRIGGER trg_trial_offer_settings_guard_current_version`.
4. `ALTER TABLE ... DROP CONSTRAINT fk_trial_offer_settings_current_version`.
5. `ALTER TABLE ... ALTER COLUMN current_version_id DROP NOT NULL` e `UPDATE ... SET current_version_id = NULL` somente na linha `trial_28d_v1`.
6. Verificar que os oito campos permanecem idênticos.
7. `DROP TRIGGER` dos dois guards de `trial_offer_versions` (inclusive o de DELETE, para permitir a retirada estrutural).
8. `DROP TABLE public.trial_offer_versions` **sem `CASCADE`**. Isso remove as 16 linhas (v1 + 15 fixtures) como parte da retirada do objeto próprio da F63, não por desativação indiscriminada de proteções.
9. `DROP FUNCTION` das três leituras, do guard de vigência, do guard de delete, do guard de versão e do helper, nessa ordem de dependência.
10. `ALTER TABLE ... DROP COLUMN current_version_id`.
11. `DELETE FROM supabase_migrations.schema_migrations WHERE (version, name) IN (A, B, C)`, exigindo exatamente 3 linhas afetadas.
12. Verificar ausência de todos os objetos/coluna/triggers/policy, colunas originais de `trial_offer_enrollments` e settings, quatro tabelas preservadas iguais ao baseline, ledger **158** e SHA-256 igual ao baseline `5f9a2c6263982cb144af9d933e71a7a8445d5f1466c745d9f02d63fa71b46365` (63-01).
13. `COMMIT` somente se todas as verificações passarem; gravar evidência com as três linhas removidas, o SHA de 158 e o snapshot pós-remoção.

A FK composta é o único dependente da tabela. Se o preflight/reassert encontrar qualquer dependente novo, **não** usar `CASCADE`: interromper e reavaliar o escopo.

**Fase R2 — instalação consolidada em transação própria**, pelo aplicador existente:

1. `--dry-run` com versão ausente do ledger.
2. Aplicação real com `--stage post-install`, wrapper `BEGIN; ... migration ...; INSERT ledger; COMMIT;`.
3. Ledger esperado **158 → 159** (+1) e nova linha exatamente uma vez.
4. Post-checks completos e evidência JSON/MD.

**Recuperação:**

- Falha em R1: rollback integral; a F63 permanece intacta; diagnosticar sem editar o procedimento no calor da execução.
- Falha em R2: rollback; o banco fica na base anterior à F63, que é segura porque nada consome a F63. Corrigir **somente o SQL consolidado**, refazer dry-run e reaplicar.
- Abandono após R1: reaplicar A/B/C originais, na ordem e com as versões/hashes preservados no arquivo histórico; nunca fabricar linha de ledger nem editar o ledger manualmente fora do procedimento documentado.
- R1 e R2 **não** são combinadas na mesma transação por padrão. A combinação é tecnicamente possível (DDL transacional), mas enfraquece a prova de que o arquivo consolidado instala a partir de uma base pré-F63 real e mistura diagnóstico de remoção com diagnóstico de instalação. Fica como contingência apenas se uma janela intermediária for julgada inaceitável e aprovada explicitamente.

### 5. Destino histórico e substituição controlada

Os arquivos substituídos saem de `supabase/migrations` para `supabase/migration-archive/f63-2a/` (diretório não varrido pelo Supabase CLI), com:

- os quatro SQLs byte a byte (A/B/C/D);
- `MANIFEST.md`/`manifest.json` com label, version, name, SHA-256 original, caminho original e arquivado, se foi aplicado no homolog, stage/evidência, e “superseded by” o arquivo consolidado;
- aviso explícito de que os arquivos são históricos e **não** devem ser aplicados em ambiente novo, produção ou reset local;
- D marcada como “preparada, nunca aplicada”. Ela é preservação histórica de uma preparação supersedida, não evidência de execução e não um stage do harness; seu comentário final foi absorvido pelo consolidado.

A substituição de migrations já aplicadas é **exceção controlada e exclusiva do homolog exclusivo**, autorizada por esta change. Não é regra geral: em qualquer ambiente compartilhado/produção, migrations aplicadas não são renomeadas nem removidas do ledger. A change arquivada da 2A não é reescrita; a supersessão é registrada apenas nos novos artefatos/evidências.

### 6. Harness, stages e testes

O harness existente é reaproveitado, sem camada de compatibilidade:

- `scripts/f63/preservation-report.mjs`: hashes de A/B/C passam a apontar para o diretório histórico (mesmos SHA-256); D é verificada pelo manifesto/teste estático, **não** como migration ou stage. Novos stages `pre-install` (delta 0), `post-install` (delta 1) e `post-tests-consolidated` (delta 1) são adicionados. O arquivo consolidado é descoberto por padrão de nome, com versão/hash pinados na evidência.
- `scripts/f63/apply-migration.mjs`: aceita `post-install`; não ganha lógica de remoção.
- Novo `scripts/f63/reconcile-f63-homolog.mjs`: apenas R1, com identidade fixa, SQL de remoção em transação única e evidência; não aceita alvo alternativo.
- `scripts/f63/homolog-identity.mjs`: reutilizado; não duplicar Docker/SQL.
- `scripts/testing/test-status.mjs`: mantém `integration.f63` e o gate fail-closed; a fonte documentada de `F63_EXPECTED_LEDGER_*` passa a ser a evidência `post-install`, nunca valores ecoados.
- Testes `f63-*.postgres.test.ts`: atualizar textos/referências antigas; manter as provas reais de schema, calendário, contratos e concorrência. O ledger esperado vem do ambiente/evidência nova.
- **Stages históricos:** somente `post-a`, `post-b`, `post-c` e `post-tests` tiveram execução real e podem permanecer no relatório para reproduzir as evidências existentes. `post-d` **não** é carregado no harness novo: D nunca foi aplicada, não há evidência de execução e não se mantém código obsoleto só para sustentar uma etapa abandonada. Preservar D significa guardar SQL, hash e preflight como preparação supersedida, não simular um stage.
- Novo teste estático delgado: exatamente um arquivo consolidado; presença do guard final e do comentário final; ordem correta (funções de leitura antes das validações que as invocam); ausência de A/B/C/D em `supabase/migrations`; ausência de limpeza de ledger/`DROP` de objetos existentes no SQL de produção; precondições presentes; manifesto histórico com hashes corretos, inclusive D sem status de execução.
- O trabalho da u83 (guarda de regressão estrito e lint TS delimitado) é preservado; os arquivos modificados pela quick não são sobrescritos pela consolidação.

**Baselines:** cada ambiente usa o próprio baseline. Homolog compara com 63-01; produção terá baseline próprio antes da instalação. Hashes brutos de funções legadas não são comparados entre ambientes; eventual normalização de espaços serve a diagnóstico, não a gate de igualdade. Contagem de ledger isolada não prova paridade.

**F57.2:** continua não executado e fora de escopo. O delta de ledger do homolog muda de +3 para +1 após a consolidação; o fingerprint armazenado do F57.2 não é atualizado silenciosamente.

### 7. Produção: mesmo arquivo, gates separados

O **mesmo arquivo e hash** validados no homolog são o único candidato à produção. A promoção futura exige, em etapa separada e autorizada:

1. Preflight somente leitura do projeto/ref de produção, ledger (ausência de A/B/C/D e da versão consolidada), ausência dos objetos F63, presença e tratamento da divergência `20261030185658_f50_legal_publication`, singleton de settings, contagens/checksums preservados e baseline próprio de funções legadas e ACL/RLS.
2. Revisão do SQL e do plano de aplicação; janela/locks e rollback definidos.
3. Aplicação transacional com a linha de ledger na mesma transação.
4. Smoke pós-instalação (leitura pública, condições, calendário, permissões, preservação) e evidência.
5. Publicação/ativação e deploy permanecem gates distintos, não cobertos por esta change.

Produção **não** é acessada nesta change; nenhuma igualdade de ledger é usada como substituto da conferência de compatibilidade.

### 8. Modelo de autorização

As aprovações são distintas e não se presumem:

1. **Gate 1 — proposta.** Aprova `proposal.md`, `design.md`, delta spec e `tasks.md` e autoriza **somente o próximo planejamento**. Não autoriza implementação, escrita no homolog, `git add`, commit, push nem publicação.
2. **Gate 2 — material executável.** Aprova o SQL consolidado, o script de reconciliação e recuperação, as alterações de harness/testes estáticos, o procedimento R0/R1/R2 e a saída de dry-run. Autoriza **somente a escrita no homolog** descrita no procedimento. Não autoriza commits.
3. **Git local.** `git add` e commits exigem aprovação específica da **lista exata de arquivos**, separada dos Gates 1 e 2 e nunca implícita pela change. A verificação final pós-commit continua obrigatória. Se a aprovação de commit não for concedida, a implementação para e reporta bloqueio explícito; não se declara verificação final concluída sem HEAD commitado.
4. **Gate 3 — evidências finais.** Aprova as evidências antes de qualquer publicação. Produção, deploy, push e ativação permanecem gates separados e não autorizados por esta change.

## Risks / Trade-offs

- **Remover a tabela com versões publicadas** → A tabela é inteiramente própria da F63, sem consumidores nem referências. A remoção é estrutural, em transação, sem `CASCADE`; o preflight prova que só a FK de settings depende dela. Se qualquer dependente novo aparecer, o procedimento para.
- **Excluir três linhas de ledger** → Excepcional e restrito ao homolog. A exclusão é por pares `(version, name)` exatos, exige 3 linhas e o SHA de 158 do baseline; a evidência registra o que foi removido. Nada é fabricado nem escondido.
- **Janela entre R1 e R2** → O ambiente é exclusivo de teste e sem consumidores. Em falha de R2, a base pré-F63 é segura. A opção atômica fica como contingência aprovada, não como padrão.
- **Checksums dentro da migration em produção** → Não são embutidos; a preservação é validada externamente para evitar falso negativo por concorrência e locks desnecessários. As validações de settings usam lock explícito.
- **Hashes divergentes entre ambientes** → Baselines independentes; normalização apenas diagnóstica. Nunca “corrigir” hash de função legada para igualar outro ambiente.
- **Timestamp do consolidado colidir** → Gerar no instante real, conferir worktree/branches e, na promoção, o ledger de produção. Em colisão, gerar novo timestamp e refazer a checagem.
- **Fixtures de teste** → A instalação começa limpa (0 versões). A suíte de concorrência volta a criar fixtures inertes; a evidência `post-tests-consolidated` as lista e não as atribui à migration.
- **Guardas dependentes de git** → A verificação final ocorre no HEAD commitado, com worktree limpo; antes do commit, falhas de fronteira são transitórias e não podem ser maquiadas.
- **Divergência F50 legal** → Registrada como gate separado de compatibilidade. Não é corrigida, aplicada ou usada para igualar ledgers.
- **D/pós-D** → D nunca aplicada; o comentário final entra no consolidado. D é preservada como preparação supersedida (SQL/hash/preflight), não como stage ou evidência de execução; o harness novo não carrega `post-d`.

## Migration Plan

1. **Gate 1 — revisão desta proposta.** Aprova os artefatos e autoriza **somente o próximo planejamento**. Nenhuma implementação, escrita no homolog ou git.
2. Inventário final e congelamento de decisões: arquivos, objetos, dependentes, baseline do homolog, hashes A/B/C/D, destino histórico, timestamp/version do consolidado.
3. **Preparação completa do material executável, sem escrita no banco:** SQL consolidado, script de reconciliação, lógica de recuperação, alterações de harness/stages, testes estáticos e atualização de referências antigas; preservar u83.
4. Verificações não escrituráveis: `node --check`, `--help`, testes estáticos, descoberta do arquivo consolidado, ordem das funções e `--dry-run` do aplicador sem `docker cp`/`psql -f`.
5. **Gate 2 — revisão do material executável completo.** Revisa SQL consolidado, reconciliação/recuperação, harness/testes e procedimento R0/R1/R2. Autoriza **somente a escrita no homolog**; não autoriza commits.
6. Homolog: R0 read-only → R1 remoção transacional → verificação de 158/SHA → R2 instalação consolidada → evidências novas.
7. Validação real: schema, constraints, triggers, RLS/grants, imutabilidade, publisher, calendário/timezone, concorrência, contratos SQL↔TS, preservação, suíte F63.
8. Arquivamento histórico dos quatro SQLs + manifesto; atualização documental sem reescrever a change arquivada. D fica como preparação supersedida, sem stage `post-d`.
9. Gates oficiais no worktree: lint TS delimitado, lint oficial, typecheck, build, scripts, gates, suíte global, `git diff --check`, OpenSpec strict.
10. **Autorização específica de git:** apresentar a lista exata de arquivos e obter aprovação separada para `git add`/commit; depois commitar e executar a verificação final obrigatória no HEAD commitado, com worktree limpo. Sem essa aprovação, parar e reportar bloqueio explícito.
11. **Gate 3 — revisão das evidências finais antes de qualquer publicação.** Produção permanece sem autorização; promoção futura segue o checklist separado.

## Open Questions

Nenhuma pendente que bloqueie o desenho. Permanecem para a execução, por exigirem valores reais: timestamp/version e SHA-256 finais do arquivo consolidado, hashes do manifesto histórico e fingerprint de ledger da evidência `post-install`. A aprovação do material executável completo (SQL, reconciliação/recuperação, harness/testes e procedimento) é o Gate 2; a aprovação de commits locais é separada e exige a lista exata de arquivos.
