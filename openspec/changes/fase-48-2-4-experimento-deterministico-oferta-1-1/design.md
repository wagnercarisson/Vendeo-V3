# Design — F48.2.4: Experimento determinístico de campanha Oferta 1:1

## Context

A F48.2.2 entregou a bancada local de geração (`/admin/laboratorio/bancada`) com persistência própria (`lab_bench_runs`/`lab_bench_artifacts`), manifesto de lojas de teste, contrato local de branding, presets/pricing em código, adapter `Images` dedicado e execução single-shot. A F48.2.3 tornou a bancada **fiel**: importação local da identidade real, paridade do formulário produtivo, briefing experimental estruturado, `brandColor` pela precedência produtiva e um **compositor determinístico mínimo** com preflight (compor → editar → aprovar) e evidência do prompt.

O compositor atual (`prompt-composer.ts`, `COMPOSER_VERSION = "48.2.3-prompt-composer-v1"`) é explicitamente uma **primeira versão avaliável**: serializa o briefing em 7 blocos canônicos, omite blocos vazios e preserva o prompt-base. Ele **não** tem políticas por dimensão, **não** transporta a identidade ao modelo e **não** há prompt-base padrão versionado nem tentativas imutáveis.

Fatos relevantes confirmados na investigação do código atual:

1. **Configuração multidimensional já existe** (`config-registry.ts`): dimensões `pipeline`, `formato`, `intencao`, `tipoConteudo`, `estrutura`, `tema` com o primeiro recorte habilitado (`manual-direto`, `1:1`, `oferta`, `produto`, `peca-unica`, `nenhum`) e valores futuros **desabilitados com motivo** (`fora_do_primeiro_recorte`). `resolveBenchConfig` já falha fail-closed (`config_registry_unknown_value` / `config_registry_value_disabled`). `modelo`/`qualidade` vêm do `preset-registry.ts`.
2. **O adapter `Images` da bancada** (`src/lib/ai/adapters/bench-images.ts`) propaga `quality` e **ignora deliberadamente** `request.identityImageUrl`; `buildBenchInvocationRequest` (`gateway/runtime.ts`) **não** inclui `identityImageUrl`. As referências enviadas são apenas as imagens de produto (`productImagesDataUrls`). O contrato do gateway já possui o campo `identityImageUrl` (`src/lib/ai/types.ts:67`).
3. **A identidade canônica já é resolvida** por `resolveBenchIdentity` + `branding-service.ts` a partir de `stores.identity_state` (`text_only` | `logo` | `visual_signature`), com `identityReference = { kind, variantType, storagePath }` (sem URL assinada) e URL assinada **transitória** no contrato de exibição; `toBenchBrandingSnapshot` **não** persiste URLs assinadas.
4. **O preflight atual** persiste `prompt_base`, `prompt_compiled`, `prompt_approved`, `prompt_blocks`, `composer_version` e grava `prompt_sent = prompt_approved`. `POST /runs` exige `preflight.promptApproved` e valida `input.prompt === approvedPrompt`, mas **não** recomputa a composição nem valida versões de políticas.
5. **A persistência da bancada** é local-first (`supabase/lab/bench-schema.sql`, fora de `supabase/migrations/`), com trigger de imutabilidade a partir de `running` (população `draft → pending` permitida), índice único parcial **global** de geração ativa (`pending`/`running`) e `lab_bench_artifacts` sob `bench/{runId}/inputs/{index}.{ext}` e `bench/{runId}/output.{ext}`. `BenchRunInputSchema` restringe `references` ao prefixo `bench/{runId}/inputs/` do **próprio** run.
6. **A estimativa/confirmação financeira** e o custo já são separados (`resolveBenchCost`, `cost_source: "bench_local_pricing"`, usage/custo do provider em campo separado).
7. **A UI** (`bench-workbench.tsx` + componentes) já implementa seleção de loja, branding somente leitura, formulário fiel, upload, preflight (compor/editar/aprovar), estimativa, confirmação e painel de evidências.

A F48.2.4 usa essa base para executar o **primeiro experimento real** do recorte Oferta 1:1, promovendo o compositor mínimo a **compositor determinístico multidimensional com políticas** e transportando a identidade canônica ao modelo.

## Goals / Non-Goals

**Goals:**

- Transformar o compositor em um **núcleo determinístico** que organiza blocos, omite vazios, preserva o prompt-base e produz saída estável, com **políticas independentes e versionadas** por dimensão.
- Implementar e habilitar **somente** as políticas `oferta`, `1:1`, `produto`, `peca-unica` e tema neutro `nenhum`, mantendo as demais dimensões/valores desabilitados e extensíveis sem duplicar o compositor.
- Produzir prompt compilado em **linguagem natural**, sem redundância e sem contexto experimental gerado pelo compositor.
- Disponibilizar um **prompt-base padrão versionado**, editável e preservado integralmente, com versão/conteúdo registrados.
- Transportar ao modelo, na ordem documentada, imagens do produto **e** a identidade canônica resolvida por `identity_state`, falhando **antes da chamada paga** quando a referência esperada não estiver disponível.
- Refinar o mapeamento de branding enviado ao prompt para a **menor representação** sem perda de direção visual.
- Reforçar o preflight: invalidação por qualquer entrada relevante e `prompt_sent` **byte a byte** igual ao prompt final aprovado.
- Permitir **novas tentativas imutáveis** (novo run, run anterior preservado, reuso seguro dos artefatos de entrada) **sem nova tabela**.
- Registrar evidências/versões e custos (calculado vs. reportado pelo provider) de forma completa e sanitizada.
- Manter a bancada **local, desktop-only**, isolada e com **produção intocada**.

**Non-Goals:**

- Destaque, Exclusivo, formatos ≠ 1:1, serviços, informativos, temas, carrossel, mobile.
- Comparação cega/lado a lado, votação, ranking, promoção automática, avaliação automática/revisor de IA.
- Geração ou revisão de prompt por IA.
- Alterar branding produtivo, pipeline produtivo, prompts produtivos, seleção produtiva de modelos, `supabase/migrations/**`.
- Nova tabela de experimentos/candidatas/revisores/avaliações; plataforma de experimentação; deduplicação semântica/embedding.
- Importação de lojas (já resolvida na F48.2.3; não redesenhar).

## Decisions

### D1 — Núcleo do compositor separado das políticas

O compositor é dividido em:

- **Núcleo** (`composePromptBlocks`): recebe o briefing, o prompt-base e a lista de **contribuições de política**; monta os 7 blocos canônicos na ordem travada, omite blocos vazios, preserva o prompt-base verbatim, produz saída estável e registra as versões. O núcleo **não** contém regra alguma específica de oferta, destaque, exclusivo, formato, conteúdo, estrutura ou tema.
- **Políticas** (`src/lib/lab/bench/domain/policies/**`): cada política é um módulo puro e **versionado** (`{ id, dimension, value, version, contributions(context) }`) que declara em quais blocos canônicos contribui e quais linhas produz.

O núcleo apenas coleta, ordena e serializa. Acrescentar Destaque/9:16/serviços/temas/carrossel no futuro significa **adicionar políticas e habilitar valores no registry**, sem alterar o núcleo. **Alternativa rejeitada:** um compositor monolítico por combinação (`Oferta 1:1`) — duplicaria lógica e violaria a extensibilidade exigida.

### D2 — Resolução explícita das políticas e fail-closed antes da chamada paga

`resolveBenchPromptPolicies(config)` percorre as dimensões do recorte (`intencao`, `formato`, `tipoConteudo`, `estrutura`, `tema`) e resolve a política habilitada de cada uma pelo registry de dimensões (`config-registry.ts`), que já recusa valor desconhecido/desabilitado. Se uma dimensão habilitada **não** possuir política implementada, a resolução lança `bench_policy_not_implemented` **antes** de qualquer chamada paga (fail-closed, sem fallback/improvisação). As versões resolvidas integram a evidência. **Alternativa rejeitada:** cair em um "prompt genérico" — improvisaria composição e mascararia combinação não suportada.

### D3 — Política `oferta` (orientação comercial, não layout)

A política `oferta` (versionada) contribui com **orientação comercial**, **sem posições fixas nem coordenadas**:

- no bloco `[CONDIÇÕES COMERCIAIS]`: preço promocional com maior importância comercial; preço original claramente secundário **quando informado**; selo, validade e textos comerciais com hierarquia adequada; leitura imediata; legibilidade; acabamento comercial de alta qualidade; liberdade para o modelo encontrar o melhor arranjo; proibição de inventar **preço, desconto, validade ou textos comerciais**;
- no bloco `[INTENÇÃO E FORMATO]`: a intenção em linguagem natural ("Oferta").

São proibidas regras como "logo à direita", "produto centralizado" ou coordenadas rígidas. **A política `oferta` NÃO declara orientações de produto** (produto como elemento principal, fidelidade de aparência/embalagem, uso das referências, proibição de inventar produto/benefícios) — essas pertencem **exclusivamente** à política `produto` (D5), evitando duplicação semântica. **Alternativa rejeitada:** congelar layout por política — contradiz "composição livre para o modelo".

### D4 — Política de formato `1:1`

A política `1:1` (versionada) contribui no bloco `[INTENÇÃO E FORMATO]` com a orientação de composição **quadrada e equilibrada** ("quadrado 1:1"), sem congelar layout. Formatos futuros entram como novas políticas; nenhuma regra de formato vive no núcleo.

### D5 — Políticas `produto`, `peca-unica` e tema `nenhum`

- `produto` (versionada) contribui **exclusivamente** no bloco `[PRODUTO E IMAGENS DE REFERÊNCIA]` com: produto como elemento principal; fidelidade de aparência, embalagem e características; uso das imagens/referências do produto; e a proibição de inventar produto ou benefícios. **A política `produto` NÃO declara orientações comerciais** (hierarquia de preço, selo, validade, textos comerciais, legibilidade, invenção de preço/desconto/validade) — essas pertencem **exclusivamente** à política `oferta` (D3).
- `peca-unica` contribui no bloco `[INTENÇÃO E FORMATO]` ("peça única").
- tema `nenhum` é **neutro**: não contribui com nenhuma linha e é **omitido** do prompt (dimensão que não acrescenta orientação). Ainda assim é resolvido/versionado e registrado na evidência.

**Propriedade exclusiva (anti-duplicação semântica):** as políticas `oferta` e `produto` têm atribuição **exclusiva e disjunta** — nenhuma orientação é emitida por ambas. A não-duplicação é verificada por um **teste golden do prompt completo** (comparação determinística do texto inteiro do recorte Oferta 1:1) e por uma **verificação de atribuição exclusiva por política**, e **não** apenas por contagem de ocorrências.

### D6 — Prompt-base padrão versionado, resolvido por configuração

Novo módulo puro `src/lib/lab/bench/domain/prompt-base.ts` expõe o prompt-base padrão **resolvido por configuração** (chaveado pelo recorte multidimensional), com identificador e versão por perfil — mesmo havendo apenas o perfil Oferta 1:1 nesta fase. Isso evita uma constante global orientada a Oferta 1:1 e permite que Destaque ou 9:16 futuros tenham seu próprio padrão sem reescrever o módulo. O conteúdo do padrão SHALL conter **somente instruções complementares**, sem repetir a hierarquia de oferta nem a orientação de formato 1:1 já pertencentes às políticas. A UI carrega o padrão inicialmente; o operador pode editá-lo. O compositor **preserva integralmente** o prompt-base (padrão ou editado) e o determinismo se mantém: a entrada inclui o conteúdo editado. As evidências registram **a versão do padrão** e **o conteúdo efetivamente usado**. Nenhuma geração/revisão por IA. **Alternativa rejeitada:** manter o prompt-base apenas no estado da UI — a versão/conteúdo usados não seriam auditáveis; **Alternativa rejeitada:** uma constante global única — não escalaria para outros recortes.

### D7 — Prompt compilado em linguagem natural, sem redundância (escopo definido)

O compositor serializa valores técnicos em linguagem natural: "Oferta" (não `offer`), "quadrado 1:1", "Produto", "Peça única". Dimensões neutras que não orientam (tema `nenhum`) são omitidas. A regra de não-duplicação aplica-se **exclusivamente ao conteúdo gerado pelo compositor** (políticas e blocos): o conteúdo gerado não pode duplicar dados ou orientações entre políticas/blocos, e cada condição comercial e cada texto obrigatório aparecem **uma única vez**. O **prompt-base editado pelo operador é preservado integralmente e fica explicitamente fora dessa deduplicação** (suas repetições são preservadas). O **prompt-base padrão** não repete hierarquia de oferta nem formato 1:1 (já pertencentes às políticas) e contém **somente instruções complementares**. O compositor e os blocos gerados **não** introduzem contexto de laboratório/experimento/baseline/avaliação nem bloco "Objetivo experimental"; a proibição é **por origem** e **não** é blacklist lexical — o prompt-base do operador é preservado sem filtragem.

### D8 — Mapeamento mínimo de branding (seleção determinística por prioridade)

O bloco `[IDENTIDADE E DIREÇÃO VISUAL]` passa a enviar a **menor representação** que preserva a direção visual da loja, por **seleção determinística por prioridade** — e **não** por igualdade textual:

- **Sempre:** nome da loja (`storeName`) e cor da marca resolvida (`brandColor`).
- **Direção visual (cadeia de fallback, um único campo):** usar **somente** `campaignBrief`; se vazio, `campaignGuidelines`; se ainda vazio, `visualStyle`; depois `visualTone`; depois `brandPersonality`. **Nunca** enviar simultaneamente os cinco campos.
- **Direção tipográfica:** `typographyDirection`, no bloco próprio `[DIREÇÃO TIPOGRÁFICA]`.
- **Todos os demais campos** (`segment`, `subsegment`, `toneOfVoice`, `positioning`, `shortDescription`, `slogan`, `safeColorTokens`, `brandColorsChosen`, `inferredPrimaryColor`, `storeBrandColor`, `logoColorsDetected`, `profileSource`, `profileStatus`) permanecem **apenas na evidência**.

A seleção é puramente determinística (mesma entrada ⇒ mesma seleção), **sem** deduplicação semântica/embedding e **sem** IA. **Alternativa rejeitada:** incluir os cinco campos com dedup apenas por igualdade textual — como eles quase sempre usam frases diferentes para ideias semelhantes, todos entrariam no prompt e a redundância observada na F48.2.3 persistiria.

### D9 — Orientação textual de fidelidade da identidade

Quando há referência de identidade, uma **contribuição de identidade dedicada** (`identity-direction.ts`, separada do núcleo e das políticas de recorte) adiciona ao bloco `[IDENTIDADE E DIREÇÃO VISUAL]` uma orientação exigindo **reprodução fiel** da identidade, sem redesenhar, distorcer, completar ou reinterpretar, mantendo-a **secundária** à comunicação comercial e **sem posição fixa**. O núcleo permanece **neutro** (não gera orientação de identidade) e a orientação nunca vem do conteúdo experimental.

### D10 — Transporte canônico da identidade ao modelo

A ordem de referências enviadas ao adapter `Images` da bancada é **documentada e fixa**:

1. imagem principal do produto (`productImagesDataUrls[0]`);
2. imagens adicionais do produto (`productImagesDataUrls[1..]`, na ordem recebida);
3. referência canônica de identidade — **somente** o asset selecionado por `identity_state` (`logo` → logo canônico pela prioridade `normalized → original → on_dark`; `visual_signature` → assinatura ativa; `text_only` → **nenhuma** imagem).

Regras: nunca escolher o primeiro asset disponível; nunca substituir silenciosamente logo por assinatura (ou vice-versa); nunca inventar identidade ausente. Para `logo`/`visual_signature`, se o arquivo esperado ou sua URL assinada não estiver disponível, a execução **falha antes da chamada paga** (`bench_identity_reference_unavailable`). A URL assinada é transitória e **não** é persistida no snapshot; o snapshot guarda apenas `{ kind, variantType, storagePath }`.

Implementação: `buildBenchInvocationRequest` passa a aceitar e incluir `identityImageUrl` (data URL) resolvido em `POST /runs` a partir da referência canônica; o `BenchImagesAdapter` **passa a anexar** essa referência como o **último** arquivo, após as imagens do produto. O adapter `Images` produtivo, o caminho `Responses` produtivo e o registry padrão permanecem **byte a byte** intocados. **Alternativa rejeitada:** referenciar o logo apenas no texto — não cumpriria "enviar a identidade visual canônica ao modelo".

### D11 — Preflight: estados, invalidação e revalidação server-side

Fluxo preservado: **compor → visualizar → editar → aprovar → confirmar custo → gerar**. A UI mantém um **fingerprint das entradas que compõem o texto ou as referências** (loja/branding, produto/campanha, imagens/referências, condições comerciais, intenção/formato/tipo de conteúdo/estrutura/tema, textos obrigatórios e prompt-base). Qualquer alteração dessas entradas **invalida** a composição/aprovação; editar o prompt final após a aprovação também invalida.

**Separação aprovação ↔ configuração de execução (correção de UAT):** `presetId`, `modelo` e `qualidade` **não** participam da composição textual e, portanto, **não** invalidam o prompt compilado/aprovado nem exigem nova composição. Alterá-los invalida **somente** a **estimativa** e a **confirmação financeira**. O servidor valida-os como **configuração de execução** (`resolveBenchPreset`/`resolveBenchConfig`) e os persiste no run (`provider`/`protocol`/`model`/`size`/`quality`); o **mesmo prompt aprovado** é reutilizado **byte a byte** com presets/modelos distintos. A confirmação financeira permanece **separada** da aprovação.

Reforço server-side: `POST /runs` **recompõe** o prompt a partir das entradas atuais (determinístico) e exige que o resultado seja **idêntico** a `preflight.promptCompiled`; divergência ⇒ `409 approval_invalidated` (evidência obsoleta), **antes** de qualquer chamada paga. Em seguida exige `input.prompt === preflight.promptApproved` (byte a byte) e grava `prompt_sent = promptApproved`. Nenhuma transformação ocorre após a aprovação. A **evidência textual** aprovada (`policyVersions`, `promptBaseVersion`, `composerVersion`, `identityReference`) é comparada **campo a campo, sem hash**; `presetId`/`modelo`/`qualidade` **não** integram essa comparação.

### D12 — Nova tentativa cria novo run (histórico imutável)

Uma nova tentativa:

- cria um **novo run** (`reserveBenchRun` em `draft` com **novo** `operationId`);
- mantém o run anterior **imutável** (trigger existente a partir de `running`);
- reaproveita com segurança os dados da campanha (snapshot) e as **imagens locais** já carregadas;
- permite editar/recompor/aprovar um novo prompt;
- não sobrescreve evidências e mantém isolamento por paths da bancada.

Como `BenchRunInputSchema` exige `references` sob `bench/{runId}/inputs/` do **próprio** run, o reuso **copia** os objetos de entrada do run anterior para o prefixo do novo run (`bench/{novoRunId}/inputs/{index}.{ext}`) via um serviço `duplicateBenchRunInputs` (download + `persistBenchArtifact`), preservando MIME/dimensões/checksum. **Alternativa rejeitada:** relaxar o guard de path para aceitar referências de outro run — enfraqueceria o isolamento por paths. **Alternativa rejeitada:** novo upload manual — o objetivo é evitar reupload das mesmas imagens.

### D13 — Linhagem explícita de tentativas (sem novo subsistema)

Como o DDL local já é alterado nesta fase (D14), o relacionamento de tentativas usa uma **coluna nullable `attempt_of_run_id`** (FK para o run de origem) na própria `lab_bench_runs` — **sem** criar tabela, plataforma experimental ou heurística de fingerprint. A primeira geração tem `attempt_of_run_id = NULL`; cada nova tentativa referencia o run de origem, formando uma linhagem explícita. A lista de tentativas é uma consulta direta por linhagem (raiz + descendentes), ordenada por `created_at`. Isso elimina o risco de agrupar campanhas independentes para o mesmo produto e mantém cada run imutável. **Alternativa rejeitada:** derivar tentativas por `created_by` + `store_id` + produto/preços — poderia misturar campanhas distintas para o mesmo produto e divergiria entre design e spec.

### D14 — Evidências e custos

Reusa as colunas existentes (`prompt_base`, `prompt_compiled`, `prompt_approved`, `prompt_blocks`, `composer_version`, `campaign_snapshot`, `branding_snapshot`, `config`, `references`, `cost_detail`) e acrescenta, por DDL **local-first** (mesma tabela `lab_bench_runs`, com REVERT e imutabilidade estendida), colunas nullable: **versões das políticas**, **versão do prompt-base padrão**, **referência canônica da identidade** (`{ kind, variantType, storagePath }`, sem URL assinada) e **`attempt_of_run_id`** (linhagem explícita da tentativa). O `cost_detail` mantém usage, custo calculado localmente (`bench_local_pricing` + `cost_rule_version`) e **custo reportado pelo provider em campo separado**; a estimativa nunca é apresentada como valor faturado. Erros são sanitizados na origem.

### D15 — API administrativa

Sob `/api/admin/laboratorio/bancada` (ordem admin → ambiente → manifesto), estende-se:

- `POST /compose`: resolve as políticas (fail-closed), retorna prompt compilado, blocos, **versões das políticas**, **versão do prompt-base padrão** e o prompt-base padrão;
- `POST /runs`: transporta a identidade canônica, recompõe/revalida o preflight, grava `prompt_sent` byte a byte e as novas evidências;
- `POST /runs/[id]/attempts`: cria um novo run `draft` a partir de um run anterior e copia as entradas, devolvendo `runId` + `references` + dados da campanha para prefill;
- `GET /runs?storeId=...` e `GET /runs/[id]`: detalhe com identidade/versões/evidências e a lista de tentativas por linhagem explícita.

Nenhum secret/URL assinada é exposto além da URL assinada transitória do resultado.

### D16 — UI administrativa enxuta (desktop-only)

A UI passa a exibir o prompt compilado com as versões (compositor/políticas/prompt-base padrão), o prompt-base padrão carregado, a referência canônica de identidade, o resultado/evidências e as **tentativas anteriores**, com botão **"Nova tentativa"**. Sem comparação lado a lado/votação/ranking. Ambiente desabilitado é tratado sem acessar tabelas/storage/providers.

### D17 — Isolamento e produção intocada

A fase permanece **somente local**, dentro do Admin/Laboratório, sem execução em preview/staging/produção, sem acesso remoto no runtime, sem campanhas produtivas, sem créditos do lojista, sem escrita em tabelas produtivas e sem promoção de prompt/modelo/pipeline. **Não** alterar: adapter `Images` produtivo, `Responses` produtivo, `store-identity-service` produtivo, prompts produtivos, seleção produtiva de modelos e `supabase/migrations/**`. Gate por **Base SHA**: `git diff $BASE..HEAD` dos caminhos produtivos deve ser vazio.

### D18 — UAT e consumo de IA

Nenhuma chamada de IA em proposta/planejamento/testes/execução autônoma. Toda geração real é iniciada manualmente, com estimativa e **confirmação financeira** antes da chamada. Há **checkpoint humano bloqueante antes do UAT pago**; o número de gerações reais do UAT é decidido e autorizado pelo usuário no checkpoint. Testes automatizados usam adapters **gravadores/fakes**; nenhuma avaliação automática consome IA.

O UAT técnico cobre determinismo das políticas, combinações não habilitadas (negativos), prova byte a byte de `prompt_sent`, identidade (`logo`/`visual_signature`/`text_only`/referência indisponível), nova tentativa/imutabilidade e produção intocada. O UAT **comercial/visual** registra, por geração, uma avaliação **humana** (sem automação, em documento de UAT): fidelidade do produto; fidelidade do logo/assinatura; aderência às cores e à direção tipográfica; preço "de/por" correto e legível; selo, validade e textos obrigatórios; hierarquia comercial de oferta; ausência de informação inventada; qualidade visual e publicabilidade; modelo, qualidade, latência e custo; decisão humana (**aprovado / rejeitado / requer ajuste**) e observações sobre o prompt para a próxima tentativa. Nada disso cria tabela de avaliação.

### D19 — Seleção explícita de imagem principal e imagens adicionais (correção de UAT)

O uploader da bancada passa a oferecer um **campo explícito e obrigatório** para a **imagem principal** e um **campo separado** para **até três imagens adicionais opcionais**. O operador seleciona a principal e depois acrescenta adicionais **sem substituir silenciosamente** a seleção anterior, e pode **remover ou substituir** qualquer imagem antes do envio. A UI exibe claramente qual é a principal, quais são as adicionais e a **ordem** das adicionais. A lacuna original (um único seletor que substituía a seleção) impedia validar com segurança a ordem obrigatória principal → adicionais → identidade.

No envio, o uploader constrói **um único multipart ordenado** — (1) principal; (2) adicionais na ordem exibida — preservando o contrato atual da rota de inputs (`operationId` + `files`), **sem** endpoint adicional e **sem** append mutável em run já enviado. O servidor persiste a principal no **índice 0** e as adicionais nos índices seguintes; a **identidade** continua sendo anexada pelo runtime como a **última** referência (D10). Alterar a seleção após um upload exige **novo envio do conjunto completo** para um **novo `draft`/operação**, preservando os runs anteriores.

O **fingerprint da operação** representa `storeId + principal + adicionais em ordem` (não uma ordenação alfabética de assinaturas): trocar principal por adicional, remover uma imagem ou mudar a ordem produz fingerprint/operação diferente; reenviar o mesmo conjunto, com os mesmos papéis e ordem, permanece idempotente. Alterações nas imagens continuam invalidando o prompt compilado/aprovado (D11). Limites preservados: uma principal, até três adicionais, apenas MIME já aceitos e o limite de tamanho já definido; nenhum tipo, bucket ou política de storage é ampliado. **Alternativa rejeitada:** um único seletor múltiplo — não distingue papéis nem ordem e substitui a seleção anterior.

### D20 — Pricing local v2 e suporte a gpt-image-2.5-sunburst (correção cirúrgica)

**Pricing v2 (`2026-09-bench-2`).** O catálogo local da bancada é alinhado ao pricing oficial vigente (Standard, por 1M tokens): texto US$5, imagem de entrada US$8 e imagem de saída US$30 para `gpt-image-2`, `gpt-image-2.5-flare` e `gpt-image-2.5-sunburst`. Uma **nova versão** da regra é criada (`2026-09-bench-2`); a `2026-09-bench-1` **não** é reescrita — runs antigos preservam a versão registrada em `cost_rule_version`.

**Estimativas prévias.** As estimativas de saída do `gpt-image-2` (400/3533 tokens) foram derivadas da tarifa antiga de US$15/M e **não** são reaproveitadas sob a nova tarifa (dobrariam o valor). Sem valor comprovado pelo calculador oficial sob a nova regra, o `gpt-image-2` fica `coverage: partial` (tarifas conhecidas; consumo de saída **não comprovado**) — estimativa parcial/indisponível honesta. O `gpt-image-2.5-flare` mantém a estimativa do calculador oficial (`low` = 196 tokens ≈ US$0,00588; a tarifa de US$30/M é inalterada) e `medium` permanece ausente. O `gpt-image-2.5-sunburst` inicia `coverage: partial` sem estimativa de saída comprovada. Nenhum token é inventado.

**Quatro noções separadas** (nunca confundidas): (a) tarifas por token; (b) estimativa prévia por modelo/qualidade/tamanho; (c) custo pós-execução calculado pelo usage real; (d) custo reportado pelo provider (campo separado). O cache de input **não** é simulado no caminho direto `Images` — as tarifas de cache da documentação só valem para a Responses API.

**Sunburst.** `gpt-image-2.5-sunburst` é adicionado **somente** ao caminho isolado da bancada: `BENCH_MODEL_ALLOWLIST`, catálogo/bootstrap local, registry de presets (`gpt-image-2.5-sunburst-low`, `gpt-image-2.5-sunburst-medium`), resolvedor de capability/protocolo e pricing local. Confirmado pela documentação oficial: ID válido; geração/edição com texto e imagens (Images API e Responses); qualidades `low`/`medium`/`high`/`xhigh`/`max`/`auto`; saída token-based; dimensão 1024x1024. O `MODEL_ALLOWLIST` produtivo, o adapter produtivo e `supabase/migrations/**` permanecem intocados; Sunburst **não** é promovido. `responses` permanece desabilitado sem confirmação específica. O mesmo prompt aprovado é reutilizável **byte a byte** com Image 2, Flare ou Sunburst (D11); trocar modelo/qualidade invalida **apenas** estimativa e confirmação financeira.

### D21 — Chave de API exclusiva da bancada (isolamento de credencial)

O runtime da bancada passa a resolver a chave de API por um **resolvedor dedicado** (`src/lib/lab/bench/gateway/bench-api-key.ts`) que lê **somente** `OPENAI_BENCH_API_KEY`. Regras: **nunca** faz fallback para `OPENAI_API_KEY` (nem qualquer outra chave); chave ausente ou vazia ⇒ `BenchApiKeyError` (`bench_api_key_missing`) **antes** de criar o cliente/chamar o provider; o resolvedor produtivo `getApiKey` (`src/lib/ai/api-keys.ts`) permanece **intocado**; a chave **não** é registrada, persistida ou exibida (nem em log, snapshot ou artefato). O `BenchImagesAdapter` passa a usar `getBenchApiKey` em vez de `getApiKey`. O gate arquitetural do laboratório é estendido para provar que a bancada lê apenas `OPENAI_BENCH_API_KEY` (nunca `OPENAI_API_KEY`/`GEMINI_API_KEY`) e que o adapter da bancada não usa o resolvedor produtivo. **Alternativa rejeitada:** reutilizar `getApiKey` com uma env-var configurável — permitiria a bancada consumir a credencial produtiva por engano.

## Risks / Trade-offs

- **[Combinação não suportada gerando chamada paga]** → resolução de políticas fail-closed antes da chamada; teste negativo para cada dimensão desabilitada.
- **[Acoplamento da bancada ao pipeline produtivo]** → adapter `Images` dedicado; gate de produção intocada por Base SHA; reuso apenas de módulos puros.
- **[Vazamento de URL assinada]** → snapshot persiste apenas `{ kind, variantType, storagePath }`; URL assinada transitória; sanitização.
- **[Identidade errada enviada ao modelo]** → seleção exclusiva por `identity_state` via `resolveBenchIdentity`; falha antes da chamada paga quando indisponível; testes para os três estados.
- **[Aprovação obsoleta]** → revalidação server-side da recompilação; `409 approval_invalidated`; `prompt_sent` byte a byte.
- **[Redundância de branding]** → seleção determinística por prioridade (um único campo de direção visual via cadeia de fallback), sem dedup semântica nem IA.
- **[Crescimento de escopo para outras combinações]** → políticas plugáveis e prompt-base padrão resolvido por configuração; nesta fase somente 5 políticas habilitadas; divisão sinalizada se ultrapassar 8–10 planos.
- **[Reuso de imagens corrompendo isolamento por paths]** → cópia para o prefixo do novo run; guard de path inalterado.
- **[Linhagem de tentativas ambígua]** → coluna nullable `attempt_of_run_id` na própria `lab_bench_runs`; linhagem explícita, sem heurística de fingerprint e sem nova tabela.

- **[Pricing desatualizado inflando a estimativa]** → nova versão de regra (`2026-09-bench-2`) alinhada ao oficial; estimativa prévia revisada (sem reaproveitar tokens derivados da tarifa antiga); `coverage: partial` honesto quando o consumo não é comprovado; histórico preservado por `cost_rule_version`.

## Migration Plan

1. Estender o DDL local (`supabase/lab/bench-schema.sql`): colunas nullable em `lab_bench_runs` (versões de políticas, versão do prompt-base padrão, referência canônica da identidade e `attempt_of_run_id`), com bloco REVERT e imutabilidade estendida; aplicar via bootstrap local (sem `db push`).
2. Implementar o núcleo do compositor + registry de políticas + políticas `oferta`/`1:1`/`produto`/`peca-unica`/`nenhum` (versionadas) e `prompt-base.ts` (padrão versionado).
3. Implementar o mapeamento mínimo de branding e a orientação textual de identidade.
4. Estender o transporte de identidade (`gateway/runtime.ts` + `bench-images.ts` da bancada) e a resolução/falha antes da chamada paga em `POST /runs`.
5. Estender a persistência/schemas (evidências/versões) e o serviço de reuso de entradas (`duplicateBenchRunInputs`).
6. Estender API (`/compose`, `/runs`, `/runs/[id]/attempts`, `/runs/[id]`, `/runs`) e UI (versões, prompt-base padrão, identidade, tentativas, nova tentativa).
7. Testes: determinismo e combinações; negativos de combinação; byte a byte de `prompt_sent`; identidade (3 estados + indisponível); nova tentativa/imutabilidade; gate de produção por Base SHA.
8. **Checkpoint humano antes do UAT pago** e UAT manual completo; **sem** chamada real em implementação/testes/verificação.

**Rollback:** reverter as mudanças de código e aplicar o bloco REVERT do DDL local; nenhuma tabela/migration produtiva é tocada.

## Open Questions

- **Nenhuma dúvida bloqueante.** O recorte é exclusivamente Oferta 1:1/produto/peça única/tema nenhum; as demais combinações permanecem desabilitadas e falham antes da chamada paga. A linhagem de tentativas usa coluna nullable `attempt_of_run_id` (adotada nesta fase, não é follow-up).
