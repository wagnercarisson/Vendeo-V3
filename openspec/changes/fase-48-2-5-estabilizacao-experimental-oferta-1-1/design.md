# Design — F48.2.5: Estabilização experimental Oferta 1:1

## Context

A F48.2.4 deixou em funcionamento a bancada local de Oferta 1:1 com compositor determinístico versionado, preflight de aprovação, referências ordenadas (principal → adicionais) e identidade visual por último, persistência em `lab_bench_runs`, linhagem imutável, evidência do prompt aprovado/enviado e telemetria financeira. O uploader já exige uma imagem principal e aceita até três adicionais, mas a semântica enviada ao modelo ainda não distingue com precisão a principal obrigatória/protagonista das referências auxiliares opcionais. Também não existe verificação local prévia de possíveis problemas nos textos livres do usuário.

A change limita alterações de código à composição determinística, interface necessária para seus gates e preservação de evidência. Prompt e modelos serão experimentados manualmente na bancada. O resultado é um candidato experimental de Oferta 1:1 e não um pacote produtivo: Destaque e Exclusivo serão validados em fases futuras antes de qualquer promoção conjunta.

Arquivos atuais observados: `src/lib/lab/bench/domain/policies/produto.ts`, `prompt-composer.ts`, `preflight-revalidation.ts`, `schemas.ts`, `bench-workbench.tsx`, `bench-image-upload.tsx`, `bench-prompt-editor.tsx`, APIs sob `/api/admin/laboratorio/bancada/**`, persistência `lab_bench_runs` e `lab_bench_artifacts`. O contrato existente envia prompt aprovado byte a byte e mantém `composerVersion`, `policyVersions`, `promptBaseVersion`, referências e custo no run.

## Goals / Non-Goals

**Goals:**

- Definir para tipo de conteúdo `produto` o papel semântico da imagem principal e das imagens auxiliares, preservando o transporte canônico.
- Bloquear composição até resolver os alertas determinísticos de texto da revisão atual, sem reescrita nem IA.
- Orientar o nome do produto integral/literal; tratar descrição como complementar e semanticamente fiel, sem invenções; reproduzir literalmente textos obrigatórios. Separar essa orientação de linguagem da política comercial Oferta. Avaliar presença e fidelidade na arte por revisão humana, sem garantia técnica.
- Criar uma trilha experimental manual reprodutível e evidências suficientes para formar um candidato documental versionável.
- Manter isolamento local, humano, financeiro explícito e evidências através da infraestrutura existente.

**Non-Goals:**

- Implementar revisor visual, score visual, avaliação automática por modelo, geração de candidatas ou otimização automática de prompts.
- Alterar código a cada rodada manual de edição do prompt.
- Promover prompt/modelo/preset, criar flag/canário produtivo, alterar pipeline/allowlist produtivos ou formar pacote produtivo nesta fase.
- Implementar Destaque, Exclusivo, formatos além de 1:1, múltiplos SKUs/combos ou composição programática de layout.
- Criar nova tabela experimental ou de avaliação; fazer migration remota, `db push`, ler dados remotos ou campanhas reais.
- Executar provider ou geração paga em task autônoma.

## Decisions

### D1 — Papéis de imagem vivem na política do tipo de conteúdo

Atualizar a política `produto`, não a política `oferta`, para instruir que a principal é obrigatória, canônica e protagonista; imagens adicionais são zero a três, opcionais, do mesmo produto e auxiliares. A principal aparecer na composição é instrução ao modelo e critério de avaliação humana, não garantia técnica da bancada. A redação será curta e equivalente ao texto definido na capability `lab-bench-image-roles`. Não se promete que cada referência adicional apareça; não se representam produtos distintos. A UI usa o texto de transparência especificado.

O upload e o contrato de transporte atuais permanecem: principal índice 0; adicionais nos índices seguintes e em ordem fornecida; referência canônica da loja por último. A identidade não faz parte do limite de três imagens adicionais. Não se muda schema/storage se o contrato atual representar corretamente esses papéis. **Alternativa rejeitada:** regra em `oferta`, que acoplaria semântica de produto à intenção e impediria reutilização por outros tipos de campanha com produto. **Alternativa rejeitada:** garantir inserção visual programática de cada adicional, pois o modelo decide a composição final.

### D1a — Contratos textuais do produto

A política `produto`, não a política `oferta`, instrui três contratos textuais: (1) nome completo, literal e aprovado, sem abreviar, omitir, parafrasear ou corrigir silenciosamente; `keep_exactly` conserva inclusive grafia aprovada; (2) descrição complementar que o modelo pode selecionar, resumir ou adaptar sem mudar contexto/significado e sem inventar características, benefícios, condições ou usos; (3) informações explicitamente obrigatórias reproduzidas literalmente. Presença integral do nome e fidelidade semântica da descrição na arte são critérios humanos, não garantias técnicas da bancada. A política `oferta` continua dona exclusiva da integridade comercial específica (preços, datas, selos e condições), sem repetição pela política geral ou de produto.

### D2 — Preflight ortográfico heurístico, puro e conservador

Criar módulo de domínio puro que recebe uma lista estável de pares `{ field, value }` e devolve alertas ordenados `{ field, excerpt, reason, ruleId }`. O módulo cobre campos livres efetivamente usados na campanha (nome, descrição, texto obrigatório e qualquer outro texto livre do snapshot/composição), com exclusão explícita de preço/validade e valores controlados. Conjunto inicial mínimo: pontuação ou caracteres repetidos suspeitos, espaçamento anormal, repetição adjacente de palavras e um conjunto pequeno de anomalias tipográficas determinísticas configurado como regras explícitas. Para possível ortografia, usar lista de alertas de padrões comuns revisável e versionada, não inferência probabilística nem dicionário completo embutido. Marcas, nomes próprios, abreviações e termos técnicos não serão corrigidos nem bloqueados após escolha humana.

Não adicionar dependência de corretor ortográfico, download de dicionário, serviço remoto, consulta de navegador ou modelo. A escolha evita variação por runtime/versão de dicionário, custo e sugestões fora de contexto. A lista de regras/padrões é versionada junto à política de texto; alertas são sinais, não validação lexical definitiva. Evitar uma blacklist extensa e regras linguísticas ambiciosas; aumentar cobertura apenas por decisões testadas e registradas. **Alternativa rejeitada:** dicionário PT-BR completo na aplicação — falso positivo elevado para marcas/nomes técnicos e manutenção/custo desproporcionais; **alternativa rejeitada:** correção automática ou IA — viola literalidade e autonomia do usuário.

### D3 — Contrato de revisão textual entre `/compose` e `/runs`

O detector é executado no servidor pelo `POST /compose`, antes do compositor. A cobertura normativa é exatamente os textos livres editáveis pelo operador: `product.name`, `product.description`, `product.mandatoryArtworkText` e `promptBase`. `promptBase` é texto livre enviado a `/compose` e reutilizado em `/runs`, portanto integra a mesma revisão; `keep_exactly` preserva cada byte de seu valor, sem correção automática ou julgamento semântico. Excluem-se preço, validade, enums/valores controlados e branding importado somente para leitura. A requisição inclui todos esses valores textuais atuais e um `textIntegrityPolicyVersion`; servidor obtém a versão ativa e calcula uma impressão determinística canônica da revisão examinada (hash dos pares campo/valor serializados em ordem estável, sem normalizar valores). A impressão é evidência efêmera, não armazenamento de texto ou assinatura de segurança, e fica na resposta/estado do cliente. Se houver alertas, `/compose` retorna `422 text_integrity_review_required` com alertas tipados (`field`, `excerpt`, `reason`, `ruleId`), `reviewRevision` e a versão; não produz prompt. Se não houver alertas, retorna composição e `textIntegrityEvidence` com versão, revisão e `decision: no_alerts`.

Para alertas, o usuário edita e reenvia a revisão ou escolhe manter exatamente. Nesse segundo caso, o cliente reenvia ao `/compose` o mesmo conjunto integral de valores, incluindo `promptBase`, `reviewRevision` e `decision: keep_exactly`; servidor recalcula alertas e revisão atual. Só aceita se a versão continua ativa e a revisão corresponde exatamente aos textos enviados, byte a byte e sem normalização; então compõe e devolve evidência `decision: keep_exactly`, revisão e versão. Decisão ausente, revisão alterada ou versão obsoleta retorna `409 text_integrity_review_stale` com estado atualizado/alertas para nova decisão. A decisão de manter não é aceita como token bearer e não autoriza texto diferente.

O `/runs` recebe `textIntegrityEvidence` junto com snapshot, `promptBase` e evidência de preflight. Antes de recompor prompt ou invocar provider, servidor refaz o detector sobre os campos livres efetivos, recalcula a revisão incluindo o `promptBase` enviado no preflight, e confirma versão ativa, revisão idêntica e decisão compatível: `no_alerts` só quando não há alertas; `keep_exactly` somente para a revisão/alertas retornados e explicitamente confirmados no `/compose`. Alterar `promptBase` depois da revisão torna a evidência obsoleta mesmo quando produto/oferta permanecem iguais. Ausência, divergência de qualquer campo coberto, mudança de versão ou alertas sem decisão retorna `409 text_integrity_review_stale` (estado revisto e alertas quando cabível), sem persistir run executável e sem provider. Assim a evidência liga decisão, valores enviados e política entre as duas rotas sem tabela nova.

Campos de preço e validade seguem schemas estruturais; intenção, selo, formato e outros valores controlados não passam pelo detector. Não se transforma nem normaliza texto original. **Alternativa rejeitada:** execução do detector só no cliente — não garante contrato server-side. **Alternativa rejeitada:** decisão de manter sem vínculo com os valores — poderia autorizar silenciosamente conteúdo alterado. A impressão determinística detecta associação acidental/obsolescência, não substitui autenticação nem assinatura contra cliente malicioso; as rotas permanecem protegidas pelo guard administrativo local.

### D4 — Propriedade disjunta de integridade textual, produto e comercial

As orientações determinísticas têm propriedade delimitada. A política geral cobre português correto, ausência de caracteres/símbolos/pontuação duplicados/anômalos e não altera silenciosamente entradas. A política `produto` define nome literal integral, descrição semanticamente fiel porém adaptável e informação obrigatória literal, além de não inventar características/benefícios/usos de produto. A política `oferta` cobre exclusivamente preço, data, selo, condição comercial e proibição de invenção/reinterpretação comercial. As responsabilidades não se repetem entre políticas. A política geral não menciona campos comerciais nem substitui o contrato textual específico do produto.

Presença do nome integral e fidelidade da descrição na imagem são critérios humanos, não garantias programáticas. A política dirige o modelo; a revisão humana registra conformidade/desvio. **Alternativa rejeitada:** mover regras comerciais à política geral/produto — duplicaria a intenção Oferta. **Alternativa rejeitada:** regra especial para erro pontual — frágil. **Alternativa rejeitada:** score/validador visual automático — fora do escopo.

### D5 — Evidência experimental em documentos e runs existentes

Usar `lab_bench_runs` como fonte das entradas, prompt aprovado/sent, snapshots, versões já gravadas, configuração, status, linhagem, usage, latência e custo. Cada rodada relevante recebe documento versionável de experimento/UAT contendo hipótese, variável alterada, run ID, entradas mantidas, resultado, avaliação humana, decisão e próximo ajuste. Se os campos existentes não bastarem para relacionar uma decisão humana ou versão determinística, usar manifesto/documento junto à change ou diretório de evidências local; não criar tabela. Impossibilidade comprovada de registrar evidência necessária sem alteração de schema é bloqueio a reportar antes de propor tabela nova.

O manifesto do candidato (JSON ou Markdown estruturado versionável) congela o contrato reutilizável: `candidateId`/version, `composerVersion`, versões das políticas de papéis de imagem e integridade textual, texto exato do prompt-base aprovado/reutilizável, `promptBaseVersion`, demais `policyVersions`, protocolo experimental, versão de pricing, runs de evidência, avaliações humanas, limitações e decisão final. Modelo/preset/qualidade selecionados são associados ao candidato e às evidências segundo a decisão humana. O prompt compilado/aprovado completo, que incorpora loja, produto e oferta e portanto varia por caso, fica exclusivamente associado ao respectivo run (`prompt_compiled`, `prompt_approved`, `prompt_sent`) e referenciado no manifesto por run ID; não é tratado como um único prompt universal do candidato. Cada comparação de modelos para um caso mantém esse prompt por run byte a byte igual. Manifesto é handoff/evidência e nunca mecanismo de configuração/runtime produtivo.

**Alternativa rejeitada:** schema/tabela de experimentos — os runs e documentos atendem o escopo sem duplicar subsistema; requisito só reabre se impossibilidade técnica for demonstrada. **Alternativa rejeitada:** tratar manifesto como arquivo carregado pelo runtime — isso criaria caminho de promoção/ativação inadvertido.

### D6 — Prompt e modelos são variáveis experimentais manuais

O protocolo separa claramente código determinístico (alterações apenas em compositor, políticas, preflight e contratos necessários) de experimentação manual. Rodada de prompt: manter dados/modelo/qualidade, variar um aspecto do prompt, executar manualmente após autorização, avaliar e registrar. Comparação de modelo: congelar entradas, imagens e prompt aprovado byte a byte e variar apenas modelo, em `low`. Matriz inicial: `gpt-image-2`, `gpt-image-2.5-flare`, `gpt-image-2.5-sunburst`. `medium` ou acima somente com hipótese específica escrita antes da geração. Cada run preserva usage/latência/custo e a versão de pricing aplicável.

Não criar executor de matriz, fila, botão de batch, gerador de variantes nem avaliação automatizada. **Alternativa rejeitada:** automatizar comparação — inviabiliza checkpoints humanos e aumenta custo sem decisão explícita por geração.

### D7 — UAT humano e checkpoints são gates externos à execução autônoma

CHECKPOINT A bloqueia qualquer chamada paga até aprovação humana dos contratos determinísticos, regras de texto, matriz e roteiro de avaliação. CHECKPOINT B é UAT pago manual conduzido pelo usuário; inclui duas lojas, dois produtos visualmente distintos, principal isolada e principal+adicionais, comparações com entradas idênticas e avaliação humana da rubrica completa. Fluxo: dados+identidade+prompt aprovado → geração manual → validações técnicas objetivas → revisão visual humana → aprovar/rejeitar/ajustar/nova tentativa. Nenhum agente/task cruza gates ou executa provider. Confirmação financeira existente continua obrigatória por geração.

### D8 — Limites produtivos e fechamento

Todas as mudanças de runtime permanecem sob bounded context da bancada e ambientes locais. Não tocar adapters, prompts, seleção de modelos, allowlist, pipeline, tabelas ou migrations produtivas. Nenhum remoto/provider é acessado na elaboração ou execução autônoma desta change. O manifesto não promove. Após UAT, executor pode registrar evidência e atualizar tracking somente em fase posterior autorizada e não destrutiva; `/opsx-verify`, `/opsx-sync` e `/opsx-archive` são exclusivos do responsável.

## Risks / Trade-offs

- **[Falsos positivos em marcas, nomes próprios ou termos técnicos]** → regras heurísticas pequenas e identificadas; alertas sugestivos; escolha de manter exatamente o texto; nenhuma correção automática.
- **[Falsos negativos de ortografia]** → declarar que o detector não é corretor perfeito; conservar revisão humana de prompt e arte; expandir regras somente com casos testáveis.
- **[Autorização de texto obsoleta]** → atrelar à revisão atual de todos os campos livres e revalidar no servidor antes de compor/gerar.
- **[Modelo omite/altera o nome ou distorce a descrição do produto]** → instrução determinística versionada; nome exato/descrição de referência preservados no run; avaliação humana separada por tipo textual; limitação registrada por run, sem prometer garantia técnica.
- **[Modelo ignora papel relativo das imagens]** → política explícita e versionada; avaliação humana específica para protagonismo/conflito; limitação registrada por run.
- **[Comparação enviesada por entradas diferentes]** → protocolo fixa imagens/dados/prompt para comparação de modelos e muda uma variável por rodada.
- **[Custo ou chamada paga acidental]** → checkpoints A/B, geração exclusivamente manual, estimativa e confirmação por run; tasks autônomas sem provider.
- **[Manifesto confundido com promoção]** → arquivo somente documental, sem loader/runtime/flag; produção permanece intocada.
- **[Evidência insuficiente na persistência atual]** → auditar colunas/linhagem antes de implementar; adicionar documento versionável; qualquer necessidade de tabela é bloqueio explícito e requer decisão do responsável.

## Migration Plan

1. Auditar contratos atuais e criar testes determinísticos sem provider para papel de imagens, detector, autorização por revisão e integridade do prompt.
2. Implementar policy versions e contrato textual em `/compose`/`/runs`; preservar upload, storage, ordem de referências, aprovação byte a byte e revalidação existente.
3. Atualizar UI com explicação curta de imagens adicionais e painel de alertas/decisão, acessível e sem alterar o fluxo financeiro.
4. Preparar templates/documentos locais de experimento, UAT e manifesto; congelar prompt-base reutilizável e associar cada prompt compilado/aprovado ao run correspondente; confirmar que a persistência existente comporta os dados e não criar tabela sem bloqueio comprovado.
5. Rodar typecheck, lint, build, testes de contrato e gates arquiteturais/local-only sem provider; comprovar produção e `supabase/migrations/**` intocados.
6. **CHECKPOINT A:** revisão humana dos contratos e roteiro antes de qualquer operação paga.
7. **CHECKPOINT B:** somente após autorização, usuário conduz UAT manual/pago e registra resultados/decisão do candidato; nenhuma task autônoma executa geração.
8. Encerrar a entrega experimental com manifesto completo e limitações. Sem deploy, sync ou archive nesta execução.

**Rollback:** reverter alterações locais do bounded context/UI e versões locais de documentos. Se houver mudança aditiva em DDL local aprovada durante execução, revertê-la apenas com rotina local explícita; não haverá migration remota ou `db push`.

## Open Questions

Não há dúvidas bloqueantes para a proposta. A cobertura exata de padrões ortográficos simples deverá ser validada contra os campos reais na implementação; o design fixa a estratégia (regras pequenas, puras e versionadas, sem dependência/dicionário completo) e preserva a decisão humana para falsos positivos.
