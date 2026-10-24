## Context

A F47.1 foi encerrada em 2026-10-23 com cobertura parcial aceita, restrita ao
laboratório. O código, a migration e as evidências estão na branch
`feature/ajuste-modelo-assinatura-visual`, commit `a6c746d0`, também presente em
`origin/feature/ajuste-modelo-assinatura-visual`. A `main` local está em
`a9681bf6` (um commit documental à frente de `origin/main` em `6a061c82`), com a
F50.3 e a F50.4 já integradas e a F50.4 arquivada com limitações explícitas
(`gate_status=not_green`; suíte completa com 22 falhas diagnosticadas).

Diagnóstico revalidado nesta etapa (não herdado do relato):

| Item | Estado verificado |
|---|---|
| `main` local | `a9681bf6` — 1 commit à frente de `origin/main` |
| `origin/main` | `6a061c82` |
| F47.1 | `a6c746d0`, publicada no remoto |
| Merge-base | `74e8c335` |
| Simulação `git merge-tree` | conflito textual **apenas** em `.planning/STATE.md` |
| `REQUIREMENTS.md` / `ROADMAP.md` | auto-merge; exigem revisão de conteúdo |
| Migration F47.1 | `20261021000001_f47_1_visual_signature_model_config.sql` |
| Migration F50.3 | `20261021000001_f50_3_cnpj_alfanumerico.sql` — **colisão confirmada** |
| Worktrees | principal (`main`), `Assinatura Visual` (F47.1), `Landing` |
| Worktree principal | limpo; nenhum stash relacionado à F47.2 |
| Numeração 47.2 | livre em todas as refs locais e remotas conhecidas |
| Deployment/ledger de produção | **não conferidos** nesta etapa; exigem consulta read-only autorizada |

A F47.1 está validada apenas localmente, com GPT-5.5 + Sunburst Medium e
GPT-6-Luna + Sunburst Medium; as outras seis combinações e o `rejectionContext`
não foram executados. O guard atual aceita **somente** laboratório loopback
(`NODE_ENV !== production`, `VERCEL` ausente, endpoint loopback, identidade
canônica e credencial dedicada). O `environment_scope` da tabela tem CHECK
restrito a `local_validation`. A pendência do perfil antigo permanece ativa em
`brand-profiler.ts` (Ramo A: falha de update deixa o perfil anterior `synced` e
apresentável como vigente).

## Goals / Non-Goals

**Goals:**

1. Integrar a branch completa da F47.1 na `main` atual por branch de integração,
   preservando histórico e sem sobrescrever F50.3/F50.4.
2. Resolver a colisão de migration preservando a F50.3, renumerando
   imutavelmente a F47.1 e criando uma migration corretiva F47.2 separada.
3. Substituir o acoplamento exclusivo ao laboratório por contrato explícito de
   ambiente, mantendo as proteções locais e impedindo herança acidental em
   preview/produção.
4. Separar, com gates e autoridades distintas: integração técnica → validação →
   migrations remotas → publicação de código → piloto → ativação.
5. Corrigir a apresentação de perfil atual/anterior/falha sem apagar histórico.
6. Provar que a F47.2 não interfere na F50.4 nem a ativa incidentalmente.
7. Definir validação, evidência, custos parciais, recuperação e rollback.

**Non-Goals:**

- Executar merge, renumeração, implementação, migration, push ou deploy nesta
  etapa.
- Reabrir, reescrever ou “corrigir” o arquivo histórico da F47.1 encerrada.
- Alterar o modelo validador `4o-mini`, preços ou o caminho legado de campanha.
- Ativar a política individualizada da F50.4, `all_stores` ou qualquer flag de
  produção.
- Declarar a suíte completa verde ou transformar falhas diagnosticadas em
  sucesso.
- Prometer custo total, economia ou faturamento a partir de estimativas.

## Decisions

### D1 — Integração por branch dedicada, com merge preservando histórico

Criar `integracao/f47-1-assinatura-visual` a partir de `main` (`a9681bf6`) e
integrar **a branch completa** `feature/ajuste-modelo-assinatura-visual`
(`a6c746d0`) com `git merge --no-ff`. Não usar squash, rebase ou cherry-pick
seletivo: os commits, summaries, UAT, verificação e archive da F47.1 são
evidência e devem permanecer no histórico. A branch de integração é o único
local de resolução de conflitos.

**Alternativas descartadas:** cherry-pick apenas de código (perderia
rastreabilidade e quebraria referências do archive); rebase da branch da F47.1
sobre a `main` (reescreveria commits já publicados no remoto).

**Ordem obrigatória:** (1) branch de integração; (2) merge; (3) resolução de
tracking; (4) renumeração imutável da F47.1 + criação da migration corretiva
F47.2; (5) atualização de referências; (6) validação. Publicação e ativação
nunca fazem parte do mesmo gate.

### D2 — Tracking reconciliado por conteúdo, não por “sem conflito”

`.planning/STATE.md` é o único conflito textual. Resolver manualmente mantendo:

- todos os registros da F50.3/F50.4 e quick tasks posteriores;
- os registros da F47.1 (histórico) e um novo registro F47.2;
- `last_updated` com timestamp real da integração;
- nenhuma restauração de `next_scope`/datas antigas.

`REQUIREMENTS.md` e `ROADMAP.md` fazem auto-merge, mas devem ser revisados
linha a linha para impedir que a versão da F47.1 remova a seção F50.4/F50.3 ou
reintroduza estados já substituídos. Critério: nenhuma linha da `main` posterior
ao merge-base pode desaparecer sem justificativa registrada.

### D3 — Renumeração imutável da F47.1 + nova migration corretiva F47.2

Dois passos distintos, com hashes e versões próprios:

**(a) Renumeração imutável da F47.1.** Preservar
`20261021000001_f50_3_cnpj_alfanumerico.sql` exatamente como está. Renomear
`20261021000001_f47_1_visual_signature_model_config.sql` para
`<YYYYMMDDHHmmss>_f47_1_visual_signature_model_config.sql`, com data/hora real
UTC, sem alterar **nenhum byte** do conteúdo. O SHA-256 original
(`B352F93E…26AA90`) é a prova de imutabilidade.

**(b) Nova migration corretiva F47.2.** Criar
`<outro YYYYMMDDHHmmss>_f47_2_visual_signature_release_state.sql`, com timestamp
próprio e posterior, contendo apenas mudanças aditivas: colunas de estado de
liberação na tabela existente, allowlist de piloto e RPCs de liberação. A
migration corretiva SHALL NOT editar a migration renumerada.

Procedimento obrigatório:

1. Obter os dois timestamps e conferir unicidade em: worktree principal, branch
   de integração, branch da F47.1, `main`/`origin/main`, branches paralelas
   conhecidas e refs remotas.
2. Se qualquer prefixo existir, obter novo timestamp e repetir.
3. Renomear apenas o arquivo F47.1; o conteúdo SQL não muda.
4. Criar a migration F47.2 separada, aditiva e tolerante ao código atualmente
   publicado (colunas com default, RPCs novas, CHECK compatível com o valor
   `local_validation` existente).
5. Registrar o **manifesto de integração/renumação** com os dois passos: versão/SHA
   antigos e novos da F47.1, versão/SHA da F47.2, ordem, commit de origem, destino
   local da aplicação antiga e a data da operação. Esse manifesto é um artefato
   de repositório e **não** substitui o manifesto completo de release.
6. Atualizar referências em runbook, scripts `f47-1`, preflight, contratos,
   testes e READMEs **da F47.2**, sem editar o archive da F47.1. Se um caminho
   citar a versão antiga dentro do archive, tratar como registro histórico e não
   reescrever.
7. Não executar `migration repair`, não editar
   `supabase_migrations.schema_migrations` e não renomear migrations já aplicadas
   em ambiente compartilhado.

**Compatibilidade provada:** o código atualmente publicado (sem F47.1/F47.2)
SHALL continuar funcionando após o lote, pois não consulta as tabelas/colunas
novas. O código novo SHALL funcionar somente após o lote, pois a migration vem
primeiro. O ensaio em banco descartável prova as duas direções: schema novo com
código antigo e código novo com schema novo.

**Consequência aceita:** o banco local onde a versão antiga foi aplicada
(`G:\Vendeo-Homolog`, ledger 133→134) permanece com a versão antiga. Ele não é
fonte para o lote remoto. O ensaio integrado usa banco descartável limpo.

### D4 — Contrato explícito de ambiente no lugar do guard exclusivamente local

Substituir a decisão binária “local vs. bloqueado” por um contrato com quatro
dimensões explícitas:

1. **Tipo de ambiente:** `local_validation` ou `production` (enum fechado).
2. **Identidade Supabase:** project ref canônico + URL/endpoint canônico
   esperado, ambos comparados exatamente; nunca inferidos de `NODE_ENV`.
3. **Credencial operacional:** chave de provider dedicada por ambiente, sem
   fallback para `OPENAI_API_KEY` no caminho da Assinatura Visual.
4. **Habilitação:** estados de publicação e ativação vinculados à versão da
   configuração (`published_config_version_id`/`activated_config_version_id`),
   nulos por padrão; os booleanos são derivados.

Regras:

- Em `local_validation`, todas as proteções atuais permanecem: loopback,
  `NODE_ENV !== production`, `VERCEL` ausente, identidade canônica e credencial
  dedicada. Nada é simplesmente removido.
- Em `production`, o guard exige configuração explícita de ambiente, identidade
  e credencial; ausência de qualquer item falha fechado.
- **Preview nunca herda produção:** neste recorte, `VERCEL_ENV=preview` é
  **sempre recusado**, mesmo com identidade semelhante, porque o enum não possui
  valor `preview`. Não existe exceção nem fallback “produção por omissão”. Um
  suporte futuro a preview exigiria um novo valor de enum em mudança própria.
- A tabela de configuração passa a aceitar `environment_scope` compatível com o
  ambiente declarado e grava a identidade exata; linha de outro ambiente é
  recusada como divergente.
- Diagnóstico administrativo continua read-only e passa a informar ambiente
  declarado, identidade esperada/observada e motivo do bloqueio, sem expor
  segredos.

**Alternativas descartadas:** manter apenas o guard local e “abrir” em produção
por flag (não distingue preview de produção nem identidade); confiar em
`VERCEL_ENV` isoladamente (não prova qual Supabase/provedor será consumido).

### D5 — Publicação ≠ ativação, com estados vinculados à versão

Cinco estados separados, cada um com autoridade e evidência:

| Estado | Significado | Efeito |
|---|---|---|
| `code_merged` | código na branch de integração | nenhum runtime |
| `migrations_applied` | lote remoto aprovado e verificado | schema disponível; config ainda desligada |
| `code_published` | deploy de código com flags off | UI/diagnóstico podem existir; geração usa legado |
| `config_published` | versão de configuração publicada | configuração pode ser lida; ativação ainda off |
| `config_activated` | versão publicada e ativada no escopo | geração consome a configuração no escopo autorizado |

**Armazenamento (F47.2):**

- `visual_signature_model_config` continua sendo a tabela **singleton da
  configuração vigente** (F47.1). A migration corretiva F47.2 não adiciona
  booleanos de liberação nela.
- Nova tabela singleton
  `visual_signature_model_config_release(scope PRIMARY KEY DEFAULT 'visual_signature',
  published_config_version_id uuid NULL, activated_config_version_id uuid NULL,
  activation_mode text NOT NULL DEFAULT 'none' CHECK IN ('none','pilot','general'),
  environment_scope text NOT NULL, instance_identity text NOT NULL,
  updated_by uuid, updated_at timestamptz, reason text, last_operation_id uuid UNIQUE)`.
- Allowlist em
  `visual_signature_model_config_pilot_stores(store_id uuid PRIMARY KEY REFERENCES stores(id), added_at, added_by, last_operation_id)`.
- **Aprovação vinculada à versão:** `config_published` é derivado de
  `published_config_version_id = visual_signature_model_config.config_version_id`;
  `config_activated` é derivado de
  `activated_config_version_id = config_version_id AND activation_mode <> 'none'`.
  Ponteiro para versão antiga não ativa nada. Isso impede aprovar uma versão e
  servir outra.
- O snapshot congela `config_version_id`, ponteiros de liberação, estados
  derivados, ambiente, identidade, `activation_mode` e `pilot_eligible`, além
  dos parâmetros de modelo/preset.

**RPCs e invariantes:**

- `admin_set_visual_signature_model_config` salva uma **nova versão**
  (`config_version_id` novo). Se havia ponteiros de publicação/ativação, eles são
  anulados na mesma transação, `activation_mode` vira `none`, a allowlist é
  limpa e a auditoria registra `configuration_replaced_requires_reapproval`.
  A versão anterior permanece no histórico de auditoria; não há ativação
  automática da nova versão.
- `admin_publish_visual_signature_model_config(p_expected_config_version_id, ...)`
  exige que `p_expected_config_version_id` seja a versão vigente; grava
  `published_config_version_id`. Despublicar anula o ponteiro somente se a versão
  não estiver ativa; com ativação vigente, retorna `deactivate_required`.
- `admin_activate_visual_signature_model_config(p_expected_config_version_id,
  p_mode, p_pilot_store_ids[], ...)` exige versão vigente **e** publicada; grava
  `activated_config_version_id` e a allowlist na mesma transação. Ativar uma
  versão diferente da publicada retorna `config_version_mismatch`.
- Desativar (`p_mode='none'`) anula `activated_config_version_id` e mantém a
  publicação; a allowlist é preservada **inativa** para que o reset possa
  auditar sua composição anterior. Retorna `deactivated`.
- `admin_reset_visual_signature_model_config` exige a versão vigente esperada
  (`p_expected_config_version_id`) e que a configuração **não esteja ativada**
  (`deactivate_required`); na mesma transação, remove a configuração, anula os
  ponteiros de liberação e limpa a allowlist. A auditoria preserva a versão
  removida, os estados anteriores, a composição anterior da allowlist e o
  motivo. Resetar nunca apaga histórico de auditoria.
- Salvar, publicar, ativar, desativar e resetar são serializados por
  `pg_advisory_xact_lock` por escopo **e** `SELECT ... FOR UPDATE` na linha de
  liberação/configuração. `operation_id` é único: replay equivalente é
  idempotente; conteúdo divergente retorna `operation_id_conflict`.
- Publicar e ativar exigem `p_expected_config_version_id`; uma corrida
  salvar × ativar é resolvida pela versão esperada, nunca por “última escrita”.
  O resultado SHALL ser **serializável e consistente**, não um único sucesso
  artificial: se a ativação vencer primeiro, o salvamento posterior cria uma
  nova versão e invalida a ativação anterior (ambos podem concluir, com o estado
  final consistente); se o salvamento vencer primeiro, a ativação com a versão
  antiga recebe `config_version_mismatch`. Nunca há estado parcial.
- Toda RPC exige ator, motivo, `operation_id`, identidade exata e envelope
  tipado; nenhuma escrita direta nas tabelas.

**Matriz de decisão (antes de débito/provider):**

| Estado derivado | Loja | Config/identidade/credencial | Resultado |
|---|---|---|---|
| desativado (`config_activated=false`, derivado) | qualquer | irrelevante | **caminho herdado**, sem erro |
| ativado | fora da allowlist de piloto | irrelevante | **caminho herdado**, sem erro |
| ativado | elegível | inválida/divergente | **bloqueio tipado antes de débito/provider** |
| ativado | elegível | válida | **configuração dedicada congelada** |

`config_published=true` com `config_activated=false` serve apenas para
diagnóstico e mantém o caminho herdado. Publicação inicial deixa os ponteiros
nulos. Nenhum deploy altera os estados por si só.

### D6 — Presets não avaliados: bloqueados por padrão

Apenas as combinações com avaliação humana registrada ficam elegíveis:
`gpt-5.5 + Sunburst Medium` e `gpt-6-luna + Sunburst Medium`. As seis demais
permanecem **bloqueadas por padrão** e só podem ser habilitadas por decisão
explícita, auditada e reversível, com registro de que a avaliação visual não
foi executada. O preset bloqueado não é oferecido na UI nem aceito pela RPC.

O modelo validador `4o-mini` não é alterado neste recorte. Nenhum preset
bloqueado é ativado por publicação de código.

**Alternativa considerada:** deixar os seis presets “disponíveis sob
autorização” sem bloqueio técnico. Rejeitada porque uma autorização textual não
impede consumo acidental; o bloqueio deve ser verificável em runtime e teste.

### D7 — Atualidade do perfil por origem, ativo e contexto

O defeito é o Ramo A de `brand-profiler.ts`: em falha de update, o perfil
anterior continua `synced` e a UI o apresenta como vigente. Além disso, a
atualidade não pode depender apenas de “assinatura ativa”: lojas com logo
próprio (`logo_analysis`) ou identidade textual (`text_only`) também têm perfil
válido, e uma mudança de tom ou de ativo pode falhar deixando um `synced` antigo.

Regra derivada, por loja:

1. **Contexto atual** = origem da identidade + **identidade do ativo** +
   `input_snapshot` corrente (`buildStoreProfileInputSnapshot(store)`).
2. **Identidade do ativo por origem:**
   - `without_logo`: `visual_signature_id` da assinatura ativa;
   - `logo_analysis`: `active_logo_asset_id` do asset que originou o perfil;
   - `text_only`: ausente (`null`).
3. **`context_hash`** = hash determinístico de origem + identidade do ativo + os
   7 campos do snapshot. Texto idêntico com ativo diferente produz hash
   diferente e **não** preserva atualidade.
4. **`current`:** último perfil `synced` cuja origem e identidade do ativo
   correspondem à identidade ativa, cujo `context_hash` coincide com o contexto
   atual e que não tenha tentativa de falha mais recente para o mesmo contexto.
5. **`previous`:** perfil `synced`/`outdated` preservado de outra origem, outro
   ativo ou contexto anterior; nunca apagado.
6. **`failed`:** tentativa mais recente, com contexto igual ou posterior ao
   último sucesso, que não produziu `synced` correspondente; carrega origem,
   identidade do ativo e `context_hash`.

**Fallback após remoção do logo (preservado):** ao remover o logo, o perfil
`logo_analysis` permanece `synced`, mantém `active_logo_asset_id` como
proveniência e continua sendo a direção válida da loja, mesmo que
`identity_state` passe a `text_only`. Ele SHALL ser tratado como
**fallback atual** até que um novo perfil `text_only` `synced` o substitua; nesse
momento passa a `previous`. A mudança de `identity_state` sozinha não o invalida.

**Persistência da tentativa:** usar a própria tabela `store_brand_profiles`,
criando/atualizando uma linha `status='failed'` append-only com
`metadata.attempt_snapshot` (7 campos), `metadata.failure` (código seguro,
timestamp, origem e `identity_asset_id`) e `metadata.context_hash`. Não criar
tabela nova neste recorte. O perfil anterior não é reescrito nem reclassificado.

**Efeitos na API/UI:**

- `GET /api/store/[id]/brand-profile` mantém o contrato atual quando não há
  ambiguidade e passa a expor `state` (`current|previous|failed`),
  `currentProfileId`, `previousProfileIds` e `lastFailure` de forma explícita.
- `?status=synced` continua retornando o perfil ativo, mas a UI deixa de rotulá-lo
  como vigente quando houver falha mais recente no mesmo contexto ou ativo
  diferente.
- A UI mostra “Direção atual”, “Direção anterior” e “Falha na atualização” de
  forma distinta, acessível e sem depender apenas de cor.
- Nenhum `DELETE`/`UPDATE` destrutivo de perfis históricos.

Cobrir API, persistência e interface em testes, incluindo: falha de update em
cada uma das três origens; **troca de assinatura ou de logo com dados textuais
idênticos**; **falha de análise após a troca de ativo**; remoção do logo com
fallback preservado; troca de assinatura; mudança de tom; loja sem perfil.

### D8 — Compatibilidade F50.4: preservar o comportamento legítimo, impedir duplicação

O código da F47.2 **não remove** comportamentos existentes:

- a geração continua reservando crédito e estornando em falha técnica;
- o caminho existente continua chamando `maybeCompleteOnboardingAndStartTrial`
  após a geração, permitindo a **primeira conclusão elegível do onboarding**;
- aprovação, realinhamento e troca de assinatura continuam podendo concluir o
  onboarding pelo helper já existente, uma única vez.

As provas devem demonstrar, em banco descartável, que operações da F47.2:

- **não reiniciam** a oferta nem alteram `started_at`/`expires_at` após o
  enrollment existente;
- **não estendem** a janela nem recriam parcelas vencidas;
- **não concedem duplicata** de benefício, parcela ou entitlement;
- preservam coortes, `beneficiary_cnpj_normalized`, `granted_total`,
  `last_granted_seq`, autorização e configurações existentes;
- mantêm os débitos/estornos **previstos pela geração** e a primeira conclusão
  legítima do onboarding, distinguindo-os de reinício/duplicação;
- não gravam `individual_launch_at` nem ativam a coorte `per_cnpj_f50_4` por
  deploy ou ativação da Assinatura Visual.

A verificação compara o estado observado antes/depois e **preserva os valores
reais** encontrados para `individual_launch_at`, flags e coortes; não presume que
a F50.4 esteja inativa. Qualquer divergência não explicada por débito/estorno
legítimo ou pela primeira conclusão elegível bloqueia o gate.

### D9 — Validação em camadas, com baseline explícito

- Typecheck, lint e build: exit 0.
- Suítes afetadas: assinatura visual, perfil de marca, admin, custos, F50.4 e
  contratos de migration.
- Suíte completa: comparar falhas com o baseline atual (F50.4 registra 22 falhas
  diagnosticadas). Falha preexistente permanece falha; nenhuma é mascarada,
  “quarentenada” ou declarada verde.
- Postgres: banco descartável limpo, checkpoint antes de qualquer escrita,
  aplicação do conjunto integrado via CLI real, provas transacionais e
  destruição do ambiente ao final. Nenhuma credencial de produção.
- Produção: conferência **read-only** de deployment, ledger,
  catálogo/pricing, presença de credenciais (booleano, sem valores), flags e
  `individual_launch_at`. Nenhuma escrita, nenhum `db push` neste gate. O lote
  remoto é derivado do ledger observado e limitado ao que foi aprovado;
  dependência ausente fora do lote para o gate.
- Custos: manter explícito o que é estimativa parcial, custo desconhecido e
  custo reportado; não somar campos sobrepostos.

### D10 — Recuperação e rollback

- Desativação: anular `activated_config_version_id` e `activation_mode='none'` por operação auditada, com motivo, ator e `operation_id`; manter a allowlist inativa (sem apagar), para que o reset audite a composição anterior, e retornar ao caminho legado sem apagar configuração.
- Reset: exigir configuração não ativada; remover configuração, anular ponteiros
  e limpar allowlist, preservando o histórico de auditoria.
- Rollback de código: redeploy do SHA anterior; **não** reverte migrations.
- Banco: forward-only. Falha de migration é tratada por forward-fix; nunca por
  edição de ledger ou `migration repair` automático.
- Piloto: critério de parada explícito (erro de geração, custo anômalo, quebra
  de perfil ou qualquer sinal de interferência na F50.4) desativa a configuração
  e mantém a allowlist inativa até o reset auditado.

### D11 — Gates, autoridade e critério de parada

| Gate | Conteúdo | Autoridade | Para se |
|---|---|---|---|
| G0 | Aprovação técnica desta base OpenSpec | Codex/usuário | houver divergência de escopo |
| G1 | Planos GSD | Codex/usuário | houver blocker de plano |
| G2 | Implementação e integração Git local | usuário | conflito não previsto ou migration não única |
| G3 | Validação local (gates + Postgres descartável) | usuário | falha nova não diagnosticada |
| G4 | Migrations remotas (aditivas) | autorização explícita separada | ledger/identidade divergirem |
| G5 | Publicação de código (flags off) | autorização explícita separada | flags não estiverem off |
| G6 | Piloto | autorização explícita separada | critério de parada atingido |
| G7 | Ativação | autorização explícita separada | piloto não aprovado |

Cada gate registra SHA, identidade do ambiente, evidência, custo incorrido e
o que **não** foi autorizado.

### D12 — Dois manifestos distintos: integração/renumação e release

**Manifesto de integração/renumação** (`F47.2-INTEGRATION-MANIFEST.md`):

- gerado no repositório, antes de qualquer consulta de produção;
- lista a F47.1 renumerada (versão antiga/nova, SHA-256 original preservado) e a
  migration corretiva F47.2 (versão/SHA próprios), na ordem;
- registra commit de origem, destino local da aplicação antiga, data e a prova
  de compatibilidade “schema novo + código antigo”;
- é determinístico e não depende do ledger de produção.

**Manifesto completo de release** (`F47.2-RELEASE-MANIFEST.md`):

- gerado **depois** da consulta read-only do ledger observado;
- parte do lote aprovado (F47.1 renumerada + F47.2 corretiva) e lista apenas as
  migrations **ausentes** no ledger observado, na ordem, com versão, descrição,
  SHA-256, dependências e estado esperado;
- registra deployment/SHA observado, catálogo, pricing, flags, presença de
  credenciais e valores observados da F50.4;
- identifica dependências ausentes. Se uma dependência não fizer parte do lote
  aprovado, o gate **para** e exige autorização explícita; nenhuma migration fora
  do lote é aplicada automaticamente;
- se o ledger já contiver uma versão do lote com conteúdo divergente, o gate para
  sem reparo automático.

O lote remoto é sempre a interseção entre o lote aprovado e o que o ledger
observado realmente precisa. Não existe `db push` genérico, aplicação de
diretório inteiro nem “catch-up” automático de migrations alheias.

### D13 — Recorte enxuto e reutilização da F47.1

Reutilizar implementação, provas e UAT da F47.1. Não reabrir o archive nem
reescrever summaries. Expansões exigem justificativa no plano e não podem
incluir produto 1:1, campanha legada, pricing novo, prompts ou validador.

## Risks / Trade-offs

| Risco | Mitigação |
|---|---|
| Merge sobrescrever F50.4/STATE | Resolução manual + diff de conteúdo contra `main`; teste de presença de registros F50.3/F50.4 |
| Renumerar a migration errada | F50.3 intocável por regra; manifesto com SHA e conferência de que só um arquivo mudou de nome; F47.2 em arquivo separado |
| Migration corretiva quebrar o deploy atual | Mudanças aditivas, defaults e CHECK compatível; prova schema novo + código antigo em descartável |
| Prefixo duplicado no conjunto integrado | Varredura de todas as refs + branches paralelas + worktrees antes do commit de integração |
| Ledger local antigo divergir | Não reescrever ledger; ensaio em banco descartável limpo; manifesto do lote remoto |
| Preview consumir produção | Identidade explícita + recusa de `VERCEL_ENV=preview` + teste de herança acidental |
| Credencial de teste vazar para produção | Chave dedicada por ambiente; presença booleana na conferência; nenhum valor em log/artefato |
| Preset não avaliado ser ativado | Bloqueio técnico por allowlist + teste negativo |
| Perfil antigo continuar como vigente | Leitura derivada `current/previous/failed` + testes de falha e troca de assinatura |
| F50.4 ser ativada por deploy | Flags separadas, `individual_launch_at` intocado, provas de não-interferência |
| Suíte completa não verde ser declarada verde | Baseline explícito por teste/falha; relatório diferencia preexistente de regressão |
| Custo total não comprovado | Manter `partial`/`unknown` explícitos; smoke mínimo humano e autorizado |

## Migration Plan

1. **Preparação:** confirmar SHAs, worktrees, refs remotas e trabalho limpo;
   criar branch de integração a partir da `main`.
2. **Integração:** merge `--no-ff` da branch completa da F47.1; resolver
   `.planning/STATE.md` manualmente; revisar `REQUIREMENTS.md`/`ROADMAP.md`.
3. **Renumeração e corretiva:** obter dois timestamps UTC reais, validar
   unicidade, renomear somente a migration F47.1 (conteúdo imutável), criar a
   migration corretiva F47.2, registrar manifesto e atualizar referências.
4. **Validação local:** typecheck/lint/build, suítes afetadas, baseline da
   suíte completa.
5. **Ensaio Postgres:** banco descartável limpo, checkpoint, aplicação do lote
   integrado via CLI real, provas de schema/constraints/auditoria, destruição do
   ambiente.
6. **Preparação remota:** consulta read-only de deployment/ledger/catálogo/
   pricing/credenciais; emitir o **manifesto completo de release** a partir do
   ledger observado, limitado ao lote aprovado. Dependência ausente fora do lote
   ou divergência de conteúdo **para** o gate. **Parar** para autorização.
7. **Migrations remotas:** aplicar somente o subconjunto aprovado e ausente
   (F47.1 renumerada + F47.2 corretiva, nessa ordem), verificando schema/ledger.
   **Parar** para autorização.
8. **Publicação de código:** deploy com flags off, comprovadamente compatível
   com o schema já aplicado. **Parar** para autorização.
9. **Piloto:** publicar a versão e ativar seus ponteiros apenas para a allowlist
   de piloto. **Parar** para autorização.
10. **Ativação:** ampliar conforme decisão explícita, com monitoramento e
    critério de parada.

**Rollback:** desativar flags e reset auditado; redeploy do SHA anterior para
código. Banco permanece forward-only; qualquer correção de schema é forward-fix.

## Open Questions

1. **Presets não avaliados:** confirmar bloqueio técnico por padrão (recomendado)
   em vez de disponibilidade apenas sob autorização textual.
2. **Identidade de produção:** confirmar o uso de project ref canônico +
   URL esperada (sem expor segredo) como identidade comparável.
3. **Piloto:** definir lojas/allowlist, duração e autoridade de aprovação.
4. **Publicação da `main` local:** decidir se o commit documental `a9681bf6`
   entra no mesmo push da integração ou em publicação separada.
5. **Aceite do banco forward-only:** confirmar que rollback de código não
   reverte migrations e que o plano de recuperação é desativação/reset.

Itens resolvidos nesta revisão: preview é sempre recusado (sem exceção no enum);
a atualidade do perfil é derivada por origem de identidade e contexto analisado;
a sequência única é migrations aditivas → código → configuração → piloto →
ativação.
