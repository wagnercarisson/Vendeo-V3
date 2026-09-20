# Alinhamento — Roadmap pós-F48.1

**Status:** diretriz de planejamento atualizada em 2026-09-19; a numeração F50–F55 foi reordenada após a conclusão da F49 e deve ser confirmada no planejamento de cada fase.

**Fonte ativa da F48.1:** `openspec/changes/fase-48-1-laboratorio-ia-minimo/` — não alterada por este documento.

## 1. Decisão central

A F48 completa não deve ser construída como uma única fase. Ela passa a ser um **programa incremental de experimentação e governança de IA**, dividido em fatias F48.x e intercalado com fases que entregam valor direto ao usuário.

O limite operacional recomendado é de duas trilhas simultâneas:

1. **Trilha principal:** uma entrega de produto ou experiência do usuário.
2. **Trilha secundária:** pesquisa, medição, documentação ou uma fatia pequena da bancada de IA.

Não manter duas fases simultâneas quando ambas alterarem o pipeline de geração, o mesmo schema crítico ou migrations extensas.

## 2. Ordem dos fundamentos

```text
F46/F47 concluídas
        │
        ▼
F48.1 — bancada mínima e isolada
        │
        ├── F48.2 — conhecimento de modelos e prompts
        │       └── primeiro ciclo controlado de otimização de prompts
        ├── F48.3 — avaliação humana mais madura
        ├── F48.4 — preços versionados e monitoramento
        ├── F48.5 — descoberta e alertas de modelos
        └── F48.6 — homologação e promoção controlada

Em paralelo, uma fase principal de produto por vez:
F49 concluída → demonstração gratuita → landing + SEO → serviços → informativas → 9:16 → carrossel
```

A F48.1 vem antes da otimização ampla de prompts porque fornece repetibilidade, comparação lado a lado e registro. Isso não significa construir todo o laboratório antes de testar prompts: **a bancada mínima vem primeiro; o primeiro caso real dela deve ser justamente comparar um prompt atual com uma variante pesquisada**. A avaliação avançada só amadurece depois que surgirem experimentos reais.

## 3. Programa F48 — IA em fatias

### F48.1 — Laboratório mínimo de IA

**Situação:** em planejamento/execução em outra frente.

**Papel:** bancada local, isolada e pequena para comparar baseline × candidato com prompt, modelo e cenário congelados.

**Inclui:** execução explícita, artefatos persistidos, custo, latência, status técnico, comparação visual e decisão humana.

**Não inclui:** descoberta automática, scraping de preços, dossiês completos, matriz arbitrária de parâmetros, juiz textual de qualidade, promoção automática ou alteração do fluxo produtivo.

**Regra:** nenhuma ampliação da bancada entra apenas para “completá-la”. Cada nova fatia deve destravar uma decisão concreta.

### F48.2 — Dossiês de modelos e conhecimento de prompting

**Prioridade:** alta; pode acompanhar uma fase principal sem alterar produção.

Cada modelo já cadastrado ou candidato deve ter um dossiê com:

- provider, model ID, snapshot/versão, aliases e status;
- capacidades, modalidades, endpoint/protocolo, parâmetros e limites;
- rate limits, disponibilidade regional, lifecycle e depreciação;
- guia oficial de prompting, práticas recomendadas e restrições;
- preços conhecidos e dimensões de cobrança;
- riscos, adequação ao Vendeo e capacidades candidatas;
- URLs oficiais, data de consulta e fingerprint/hash da fonte;
- evidências de testes internos e decisão humana.

O dossiê deve se relacionar ao catálogo existente da F47 (`ai_model_catalog`), sem criar um segundo catálogo concorrente. A modelagem detalhada — novas colunas ou entidade histórica relacionada — fica para o planejamento da fatia.

Datas distintas devem preservar a semântica real: `discovered_at`, `researched_at`, `pricing_checked_at`, `tested_at` e `approved_at`. O `validated_at` técnico do catálogo não deve significar homologação empírica.

**Primeira aplicação:** revisar os prompts de Diretor e Revisor com base nos guides oficiais dos modelos atualmente usados, criar baseline e testar mudanças isoladas no laboratório.

**Saída:** recomendações aprovadas ou rejeitadas com evidência; não uma reescrita geral baseada apenas em opinião.

### F48.3 — Avaliação humana e comparação madura

Evoluir somente quando os primeiros experimentos mostrarem necessidade de mais rigor.

**Pode incluir:** comparação cega ou semicega, randomização de posição, rubrica humana por critério, múltiplos avaliadores, concordância, amostra mínima e regressão por cenário.

**Autoridade automática permitida:** somente validações técnicas básicas:

- chamada concluída/falhou;
- arquivo decodificável, MIME, dimensões, proporção e tamanho;
- latência, custo, usage, retries e erros;
- detecção evidente de arquivo vazio, corrompido ou uniforme;
- OCR apenas como alerta auxiliar, sem veredito de qualidade.

**Autoridade final:** avaliação humana. O sistema não terá um revisor textual julgando estética, persuasão ou qualidade geral da geração.

Um assistente pode organizar evidências e apontar inconsistências para a pessoa avaliadora, mas não aprovar, reprovar ou promover o candidato.

**Escopo separado:** o atual `campaign_image_review` de produção deve ser auditado em mudança própria caso se decida restringi-lo a verificações factuais/técnicas. Alterá-lo afeta retries, custo e comportamento produtivo; não deve ser embutido silenciosamente no laboratório.

### F48.4 — Pricing versionado e monitoramento

**Objetivo:** manter custo estimado confiável sem permitir que uma automação externa altere produção.

**Modelo recomendado:** registros históricos por provider/modelo/snapshot, dimensão de cobrança, moeda, unidade, tier e vigência (`effective_from`/`effective_until`). Separar preço estimado do catálogo de custo realizado/reconciliado.

A implementação deve evoluir a base econômica já entregue pela F38.1 (`ai_model_pricing` e telemetria de custo), não criar um ledger paralelo.

**Rotina:**

- varredura diária pode apenas detectar mudança de fingerprint em fonte oficial;
- mudança gera alerta/proposta pendente;
- uma pessoa verifica antes de criar nova versão de preço;
- revisão obrigatória antes de homologar ou selecionar modelo em produção;
- auditoria manual periódica, inicialmente mensal.

Não fazer scraping diário com atualização automática de valores ativos.

### F48.5 — Descoberta e alertas de modelos

Combinar fontes oficiais, quando disponíveis:

- API/lista de modelos do provider;
- catálogo oficial de modelos;
- release notes/changelog;
- páginas de depreciação e shutdown;
- guides de prompting;
- páginas/APIs de pricing.

Gerar alertas para novo modelo/snapshot, mudança de alias, preço, parâmetros, endpoint, prompt guide, depreciação ou remoção de API.

Documentação externa é entrada não confiável: extrair metadados, registrar fonte e solicitar revisão. Nunca cadastrar, configurar ou ativar automaticamente.

Lifecycle sugerido:

```text
discovered → research_pending → candidate → tested → approved/rejected
                                               └── approved → eligible → active
```

### F48.6 — Homologação e promoção controlada

**Pré-requisitos:** dossiê completo, preço verificado, cenários relevantes executados, comparação humana concluída e riscos conhecidos.

**Inclui:** checklist de homologação, elegibilidade por capability, decisão auditada, promoção explícita e plano de rollback.

A promoção deve consumir o catálogo e a seleção administrativa da F47, preservando o gateway da F46 como ponto único de execução.

**Não inclui:** promoção ou rollback decididos autonomamente por IA.

## 4. Fases principais de produto — sequência atualizada

### F49 — Ativação e orientação contextual de campos — concluída

**Resultado entregue:** orientação no ponto de decisão nos formulários de identidade da loja e do brief de campanha: labels, hints, exemplos, ajuda expansível, feedback contextual, fronteiras entre campos e revisão do brief mais compreensível.

**Fronteira real da fase:** não foram implementados checklist global persistente, retomada global do ponto pendente nem eventos de conclusão, tempo e abandono por etapa. Isso não torna a F49 incompleta em relação ao escopo aprovado; significa que a fase foi refinada para orientação contextual.

**Encaminhamento:** a instrumentação de aquisição → ativação passa para a F51, junto da landing. Checklist global ou redesenho adicional do onboarding só deve voltar ao roadmap se os dados mostrarem abandono interno que justifique essa solução.

**Métrica de ativação preservada:** primeira campanha aprovada e pronta para uso/download, não apenas cadastro ou geração iniciada.

### F50 — Demonstração gratuita e validade dos créditos

**Objetivo:** substituir o eixo de freemium contínuo por uma demonstração gratuita, limitada e transparente antes de ampliar aquisição pela landing.

**Oferta decidida:**

- 10 créditos de demonstração por loja elegível, controlados por raiz de CNPJ;
- validade de 7 dias corridos (`168 horas`) a partir da concessão efetiva após aprovação de elegibilidade;
- sem cartão, cobrança ou renovação automática;
- os créditos de demonstração não utilizados expiram ao final do prazo;
- a conta, a loja, o histórico e as campanhas existentes permanecem acessíveis após o término;
- novas operações que consomem créditos dependem de saldo disponível;
- enquanto a venda não estiver disponível, o usuário sem saldo é orientado a solicitar créditos ao suporte, sem promessa comercial voluntária de resposta em 24 horas; a operação deve observar os prazos legais aplicáveis ao atendimento eletrônico.

**Duas formas de concessão:**

1. **Crédito de demonstração:** concedido automaticamente no onboarding elegível, expira em 7 dias e é irrepetível para a mesma raiz de CNPJ.
2. **Crédito bônus:** concedido manualmente pelo suporte/admin, não expira e não representa saldo financeiro.

Crédito comprado não é uma terceira forma de **concessão**: é uma aquisição futura e permanece em bucket próprio. A interface não deve usar “Comprar” ou “Adquirir créditos” enquanto a comercialização não existir.

**Ordem de consumo:** demonstração primeiro → bônus não expirável → comprado. Débito, estorno e extrato devem preservar a origem de cada parcela. A expiração alcança somente o saldo de demonstração.

**Transição:**

- usuários com créditos anteriores preservam integralmente os saldos existentes, sem expiração retroativa;
- nenhuma nova concessão mensal ocorre após a mudança;
- entitlements e transações antigos permanecem como histórico;
- conta antiga sem benefício anterior pode receber a demonstração se a concessão ocorrer após a vigência;
- conta/raiz que já consumiu o benefício de onboarding não recebe uma segunda demonstração;
- créditos administrativos posteriores entram como bônus não expirável.

**Experiência:** mostrar data/hora local e tempo restante; avisar na concessão, 24 horas antes e no encerramento/esgotamento; manter campanhas e downloads após o prazo; diferenciar claramente demonstração encerrada de saldo total insuficiente.

**Falha técnica na borda do prazo:** reserva válida antes do vencimento pode concluir; estorno de crédito de demonstração ocorrido depois do vencimento recebe uma janela adicional de 24 horas para uso.

**Cobertura:** os créditos podem pagar qualquer operação normalmente tarifada, inclusive assinatura visual e campanhas; não criar crédito exclusivo por tipo de operação.

**Legal:** publicar Termos de Uso v1.5 antes de ativar os novos grants e exigir reaceite no próximo acesso às capacidades de geração, sem bloquear histórico. A nova versão deve remover a promessa de bônus mensais, explicar concessão, prazo, expiração, acesso pós-demo, suporte, ausência de cobrança automática e transição dos saldos antigos. A redação final exige revisão jurídica.

**Atendimento:** retirar da UI o SLA atual de 24 horas se ele não puder ser sustentado. Isso não elimina obrigações legais: o Decreto nº 7.962/2013 prevê atendimento eletrônico adequado e eficaz e, quando aplicável à relação, resposta às demandas do consumidor em até cinco dias. O fluxo de suporte e os Termos devem ser validados juridicamente antes do go-live.

**Telemetria própria:** registrar concessão, primeira geração, esgotamento, expiração, solicitação de créditos e futura conversão para saldo comprado. A F51 consome esses eventos no funil; não é responsável por inventá-los.

#### Operação, conformidade e segurança do beta

As decisões abaixo orientam a F50 e o início da operação, mas não transformam a fase em uma plataforma completa de compliance:

- a landing pode ficar pública com **solicitação de acesso**, porém o beta permanece fechado, restrito ao Brasil e limitado inicialmente a até 50 participantes;
- nenhum convite deve ser liberado antes da constituição da pessoa jurídica, ainda que isso ocorra antes ou depois da estimativa inicial;
- o serviço é destinado a representantes de CNPJ/MEI, maiores de 18 anos e autorizados a agir em nome da empresa; exigir declaração de idade e autoridade, sem coletar data de nascimento apenas para essa finalidade;
- email de suporte e formulário in-app de solicitação de créditos são canais oficiais; WhatsApp pode ser informado opcionalmente na solicitação de acesso, com finalidade clara e sem consentimento implícito para marketing;
- recusas de elegibilidade podem ser reavaliadas manualmente pelo suporte, sem criar um sistema formal de recursos nem revelar mecanismos antifraude;
- imagens de pessoas, inclusive crianças e bebês, são permitidas quando o usuário possuir direitos, consentimentos e autorizações aplicáveis e respeitar o melhor interesse do menor; devem ser proibidos conteúdo ilegal, abusivo ou exploratório e o envio desnecessário de documentos, listas de clientes ou dados sensíveis;
- imagens de entrada, campanhas e demais ativos do lojista devem permanecer privados no Vendeo e ser acessados por autorização ou URL assinada; antes de afirmar essa garantia ao usuário, auditar e corrigir os buckets legados de identidade visual que ainda possam conservar configuração pública. O usuário responde pelo conteúdo enviado e pela publicação externa, sem excluir as responsabilidades legais próprias do Vendeo como fornecedor e agente de tratamento;
- o aceite contratual e um aviso curto próximo ao upload formalizam essa responsabilidade, sem exigir checkbox repetido para cada imagem nem upload de autorizações;
- conta sem saldo, sem compra, sem assinatura ou inativa permanece ativa e conserva produtos, imagens, campanhas, histórico e downloads; cancelamento comercial não equivale a encerramento da conta;
- encerramento solicitado pelo titular terá janela de 30 dias para recuperação/exportação e, depois, exclusão ou anonimização dos dados operacionais, ressalvada a conservação mínima legal devidamente segregada;
- durante o beta, pedidos de acesso, exportação, correção e exclusão podem ser atendidos pelo suporte com protocolo; autosserviço completo fica para etapa posterior, antes de abertura pública ou escala paga;
- não haverá exclusão automática por inatividade durante o beta; uploads temporários ou órfãos podem ter limpeza técnica própria, documentada e distinta da retenção de ativos salvos pelo usuário;
- o uso de fornecedores, inclusive IA, exige inventário, definição dos papéis de tratamento, avaliação de transferências internacionais e registro de contratos/DPA; Gemini permanece restrita ao laboratório com dados controlados até validação contratual, operacional e de faturamento;
- MFA por TOTP e recuperação foram ativados e testados em 19/09/2026 para Google/email, Hostinger, Cloudflare, GitHub, Supabase, Vercel, OpenAI, Google Cloud e Resend; códigos de recuperação, credenciais e tokens devem permanecer fora do repositório e em meio independente do autenticador.

**Pendências de go-live do beta:** receber do contador razão social, CNPJ e endereço profissional; substituir todos os placeholders antes da publicação; consolidar e submeter Termos, Política de Privacidade e Política de Uso Aceitável à revisão jurídica; implementar inventário/registro das operações de tratamento e retenção; formalizar procedimento de incidentes; revisar DPAs e transferências dos fornecedores; revisar sessões, chaves e acessos administrativos; e comprovar backup externo restaurável.

**Continuidade temporária:** a F50 e o beta fechado permanecem no Supabase atual. Como o plano gratuito não oferece o nível de backup gerenciado necessário, deve existir antes do primeiro convite uma rotina externa temporária, privada e criptografada, cobrindo banco e arquivos, com retenção rotativa de 30 dias, verificação de integridade e teste de restauração. O destino pode ser Cloudflare R2 ou serviço compatível, mas não deve ser o mesmo domínio de falha caso esse provedor venha a se tornar o storage primário.

**Fora de escopo:** checkout, pagamento, preço público, assinatura, cobrança automática, emissão fiscal e monetização pública.

### F51 — Landing orientada à conversão e fundação SEO

**Por que nesta posição:** a landing passa a comunicar uma oferta de demonstração já verdadeira, uma experiência interna mais clara e resultados que o produto atual efetivamente entrega. Não depende de serviços, informativas ou 9:16 para demonstrar bem o caso Produto + Oferta.

#### Conversão e prova de produto

- instrumentar visita → CTA → cadastro/solicitação → loja elegível → primeira campanha pronta → aprovação/download;
- tratar separadamente beta fechado, signup aberto e demonstração gratuita;
- estabelecer uma linha de base da landing atual antes da mudança visual;
- hero centrado no resultado para o lojista, com campanha real como protagonista;
- demonstração visual “informações simples → campanha pronta”;
- galeria de campanhas reais ou exemplos fictícios claramente identificados, apenas dentro das capacidades já entregues;
- processo simplificado em três passos: informar → revisar → aprovar/publicar;
- explicar identidade da loja, revisão, controle de créditos e limites da automação;
- apresentar “10 créditos por 7 dias, sem cartão e sem cobrança automática” com elegibilidade e expiração claras;
- CTA principal coerente com o modo de aquisição ativo;
- reduzir “Novidades” ao footer ou posição secundária;
- FAQ orientado a objeções reais;
- nenhum uso de “comprar/adquirir créditos” enquanto existir somente solicitação ao suporte.

#### Fundação SEO técnica e operacional

- definir domínio e URL canônicos, `metadataBase` e redirects permanentes entre variações de host/protocolo;
- criar `sitemap.xml` gerado pela aplicação com URLs absolutas, públicas, canônicas e realmente indexáveis;
- criar `robots.txt` referenciando o sitemap e orientando crawling, sem tratá-lo como mecanismo de remoção do índice;
- aplicar `index,follow` somente às páginas públicas relevantes;
- aplicar `noindex` às superfícies de autenticação, conta, app, admin, callbacks, estados transitórios e outras páginas sem valor para busca;
- excluir do sitemap `/api/**`, `/auth/**`, rotas autenticadas, admin, URLs com parâmetros e páginas duplicadas;
- auditar os documentos Markdown públicos em `/docs/legal/**` para impedir que concorram com as páginas canônicas `/termos`, `/privacidade` e `/uso-aceitavel`;
- fornecer title, description, canonical, Open Graph e Twitter metadata coerentes por página;
- corrigir a divergência atual em que a metadata da home pode mencionar beta fechado mesmo com signup público ativo;
- manter um único `h1`, hierarquia semântica, links internos rastreáveis, conteúdo server-rendered e `alt` útil nas provas visuais;
- otimizar Core Web Vitals, especialmente LCP da imagem principal, CLS e peso das campanhas exibidas;
- usar dados estruturados somente quando houver tipo elegível e dados reais visíveis; nunca inventar organização, preço, avaliação, depoimento ou nota;
- validar HTML, metadata, canonical, robots, sitemap e dados estruturados em produção;
- configurar Google Search Console, verificar propriedade, enviar o sitemap e acompanhar cobertura/indexação;
- medir impressões, cliques, consultas, CTR e conversão orgânica até a primeira campanha aprovada.

**Matriz inicial de indexação:**

| Superfície | Diretriz |
|---|---|
| `/` | indexável; principal página comercial e canônica |
| `/termos`, `/privacidade`, `/uso-aceitavel` | indexáveis se públicas e canônicas; conteúdo bruto duplicado não indexável |
| `/login`, `/signup`, recuperação/confirmação | `noindex`; fora do sitemap |
| `/dashboard`, `/loja`, `/campanhas/**`, `/conta`, `/admin/**` | protegidas e `noindex`; fora do sitemap |
| `/api/**`, `/auth/**` e callbacks | fora do sitemap e sem indexação |

**Conteúdo e intenção de busca:** pesquisar consultas reais do lojista e escrever para pessoas, não criar páginas automáticas ou genéricas apenas para capturar palavras-chave. Uma frente editorial posterior só deve nascer com temas úteis, autoria, manutenção e métrica no Search Console.

**Limite de expectativa:** sitemap e SEO técnico facilitam descoberta, crawling e compreensão, mas não garantem indexação nem posição. Autoridade, relevância, qualidade do conteúdo e referências externas amadurecem ao longo do tempo.

**Restrições:** sem depoimentos inventados, números sem base, páginas doorway, conteúdo em massa sem valor ou redesign avaliado apenas por preferência visual.

**Referências oficiais para o planejamento:** [SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide), [criação e envio de sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [robots.txt](https://developers.google.com/search/docs/crawling-indexing/robots/intro), [canonicalização](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) e [Metadata API do Next.js](https://nextjs.org/docs/app/api-reference/functions/generate-metadata).

### F52 — Campanhas de serviços

**Objetivo:** atender negócios cujo valor vendido não depende de uma foto de produto.

**Escopo mínimo:** brief próprio, exemplos, direção visual, copy, validações e cenários de laboratório para serviços. Reutilizar o pipeline apenas onde a semântica for realmente comum.

**Evitar:** tratar serviço como “produto sem imagem” se isso gerar campos e prompts artificiais.

### F53 — Campanhas informativas

**Objetivo:** avisos, horários, inauguração, eventos e comunicados sem oferta obrigatória.

**Escopo mínimo:** intenção própria, campos adequados, hierarquia de informação, templates/prompts e validações específicas.

**Dependência útil:** aprendizados da F52 sobre briefs não centrados em produto.

### F54 — Formato vertical 9:16

**Objetivo:** gerar uma peça vertical publicável, mantendo legibilidade, identidade e safe areas.

**Escopo:** seleção de formato, contrato de proporção, composição, preview, revisão, persistência, exportação e cenários de regressão.

**Dependência:** tipos de campanha estabilizados; não desenvolver em paralelo com carrossel.

### F55 — Carrossel MVP

**Objetivo:** validar carrossel sem assumir toda a complexidade definitiva.

**Primeira fatia:** estrutura rígida de três slides, por exemplo: gancho → produto/benefício → oferta/CTA; consistência visual do conjunto; preview, aprovação e exportação do conjunto.

**Adiar:** quantidade livre de slides, narrativa totalmente aberta, edição por slide, regeneração parcial sofisticada e recuperação distribuída de falhas.

**Dependência:** 9:16 e persistência de múltiplos artefatos já compreendidas.

## 5. Frentes preparatórias sem fase grande imediata

### Internacionalização

Começar com inventário e decisões, não com tradução total.

1. Inventariar strings de UI, prompts, emails, documentos, datas, moedas e regras Brasil-específicas.
2. Definir arquitetura de locale e fronteira entre tradução, localização comercial e regras legais/fiscais.
3. Implementar a fundação técnica de i18n.
4. Validar PT-BR + um segundo idioma/locale.
5. Expandir por país apenas após requisitos comerciais, legais, fiscais e operacionais.

Não prometer operação “em qualquer país” com apenas tradução de interface.

### Storage

**Decisão para o beta:** manter Supabase Storage durante a F50 e o beta fechado, sem acoplar uma migração de storage à mudança de créditos, legal e elegibilidade. Isso não elimina o backup externo temporário definido no gate da F50.

**Prioridade posterior:** assim que a constituição da PJ e as pendências imediatas de conformidade/lançamento forem resolvidas, priorizar o estudo e a migração para Cloudflare R2 ou outro storage compatível. A escolha final continua dependente de medição e prova técnica.

Medir e inventariar antes de migrar:

- GB armazenados, uploads, downloads e egress;
- crescimento por campanha e por tipo de artefato;
- consumidores atuais e dependências de URL/política;
- custo e ergonomia de Supabase Storage, R2 e alternativas;
- impacto de 9:16 e carrossel.

Criar primeiro uma camada de abstração e um piloto. Migração total exige gatilho financeiro ou operacional definido, buckets privados, URLs assinadas, isolamento por tenant, política de exclusão/retenção, verificação por checksum, migração sem órfãos, compatibilidade temporária e rollback. Se R2 for adotado como storage primário, manter o backup em provedor ou domínio de falha independente.

### SEO contínuo após a F51

A F51 entrega a fundação técnica e a otimização das páginas públicas existentes. Depois dela, SEO passa a ser disciplina contínua, não uma sequência de páginas criadas sem evidência:

- acompanhar consultas, impressões, CTR, posição e cobertura no Search Console;
- identificar dúvidas reais de lojistas que mereçam conteúdo público útil;
- revisar títulos, snippets, links internos e conteúdo conforme dados;
- atualizar sitemap e metadata quando novas superfícies públicas forem criadas;
- monitorar Core Web Vitals e regressões de indexabilidade em releases;
- só criar hub editorial/blog quando houver capacidade de autoria, revisão, manutenção e diferenciação.

## 6. Plano de encaixe recomendado

| Ordem | Trilha principal | Trilha secundária segura | Resultado esperado |
|---|---|---|---|
| 0 | **F48.1 — laboratório mínimo** | Inventários somente leitura | Bancada utilizável sem tocar produção |
| 1 | **F49 — orientação contextual** — concluída | **F48.2 — dossiês/guides/prompts** + inventário i18n/storage | Campos e revisão mais compreensíveis |
| 2 | **F50 — demonstração gratuita** | Pesquisa documental F48.2, sem alteração concorrente do ledger | Oferta limitada, mensurável e juridicamente comunicável |
| 3 | **F51 — landing + fundação SEO** | Pesquisa de i18n ou storage, sem migração | Aquisição, ativação e descoberta orgânica alinhadas ao produto real |
| 4 | **F52 — serviços** | Primeiro ciclo de prompt no laboratório / F48.3 somente se necessário | Novo caso de uso e evidência real da bancada |
| 5 | **F53 — informativas** | **F48.4 — pricing** | Segundo caso de uso e custos versionados |
| 6 | **F54 — 9:16** | **F48.5 — descoberta/alertas** | Novo formato e vigilância de providers |
| 7 | **F55 — carrossel MVP** | **F48.6 — homologação**, se os pré-requisitos existirem | Formato multipágina controlado e processo seguro de promoção |
| posterior prioritário | **Abstração + piloto de storage externo** | Apenas pesquisa leve na outra trilha | Redução de custo/risco após medir e estabilizar o beta |
| posterior | Fundação i18n ou migração total de storage | Apenas pesquisa leve na outra trilha | Expansão guiada por demanda, dados e resultado do piloto |

Essa é uma ordem de planejamento, não um compromisso de calendário. A próxima fase deve ser confirmada conforme aprendizado da anterior.

## 7. Paralelismo seguro e conflitos

### Combinações seguras

- demonstração gratuita + pesquisa documental de modelos, sem segunda migration extensa;
- landing/SEO + inventário de internacionalização ou storage;
- serviços + testes controlados de prompt;
- informativas + medição de storage;
- 9:16 + monitoramento de pricing/modelos;
- carrossel + homologação documental, desde que a homologação não altere o pipeline.

### Combinações a evitar

- laboratório e carrossel alterando simultaneamente o pipeline de geração;
- laboratório e migração de storage;
- internacionalização total e redesign amplo de UI;
- demonstração gratuita junto de outra mudança no ledger, elegibilidade ou documentos legais;
- landing/SEO junto de troca de domínio sem plano de redirects/canonical/Search Console;
- serviços/informativas junto de reestruturação global de todos os prompts;
- 9:16 e carrossel na mesma fase;
- duas migrations extensas/deploys de alto risco em paralelo.

## 8. Gates de decisão

Uma fase/fatia só deve começar quando responder “sim” ao gate correspondente:

| Escopo | Gate mínimo |
|---|---|
| Novo modelo | Dossiê, preço verificado, guide lido e capability definida |
| Mudança de prompt | Baseline congelado, hipótese única e cenários representativos |
| Homologação | Evidência técnica + avaliação humana + rollback |
| Demonstração gratuita | Contrato de concessão/expiração fechado, transição legada definida, PJ constituída e identificada, documentos consolidados e revisados juridicamente, canais de suporte operantes, MFA confirmada, backup externo restaurável e nenhuma cobrança implícita |
| Landing + SEO | Demonstração operante, funil instrumentado, URLs indexáveis definidas, destino pós-CTA coerente e propriedade do Search Console disponível |
| Conteúdo SEO novo | Intenção de busca real, conteúdo útil e responsável por autoria/manutenção definidos |
| Serviços | Brief e semântica próprios definidos; não modelar como produto sem imagem por conveniência |
| Informativas | Intenção e hierarquia de informação próprias definidas |
| 9:16 | Contrato de formato e safe areas definidos de ponta a ponta |
| Carrossel | MVP rígido e política de custo/falha/aprovação definidas |
| i18n | Locale-alvo e inventário Brasil-específico concluídos |
| Piloto de storage | Métricas e inventário de consumidores concluídos, abstração definida, segurança/privacidade avaliadas e rollback testável |
| Migração total de storage | Piloto aprovado, threshold financeiro/operacional confirmado, backup em domínio independente e plano de migração/rollback validado |

## 9. Estimativas indicativas preservadas

As faixas abaixo servem apenas para comparar porte; devem ser refeitas no planejamento técnico:

| Escopo | Faixa indicativa |
|---|---:|
| F48.1 mínima | 5–8 dias |
| Programa F48 completo | 20–35 dias |
| Demonstração gratuita + legal/transição | 7–12 dias |
| Landing + fundação SEO | 8–14 dias |
| Serviços | 4–7 dias útil / 7–10 maduro |
| Informativas | 4–7 dias útil / 7–10 maduro |
| 9:16 | 5–8 dias útil / 8–12 maduro |
| Carrossel | 8–14 dias MVP / 15–25 maduro |
| Fundação i18n | 7–12 dias |
| PT-BR + primeiro segundo locale | 15–25 dias |
| Internacionalização ampla | 35–60 dias |
| Estudo de storage | 2–4 dias |
| Abstração + piloto de storage | 6–10 dias |
| Migração total de storage | 12–25 dias |

## 10. Conclusões registradas

1. O laboratório é válido para testar modelos **e** prompts, desde que cenário, prompt e modelo sejam versionados e comparáveis.
2. O laboratório mínimo precede a otimização ampla; a avaliação avançada não precisa preceder o laboratório mínimo.
3. Qualidade visual e comercial é decisão humana. Automação fica restrita a sanidade técnica e evidências.
4. Todo modelo, inclusive os já cadastrados, precisa de pesquisa baseada em fontes oficiais antes de homologação.
5. Preços e descoberta usam monitoramento + alerta + revisão humana, nunca atualização/ativação automática.
6. A F49 concluiu orientação contextual; checklist global e telemetria de etapas não foram necessários para fechar a fase e só retornam se os dados justificarem.
7. A F50 substitui freemium contínuo por demonstração gratuita: 10 créditos por 7 dias, sem cartão/cobrança, com legado preservado e sem novos bônus mensais.
8. Há duas formas de concessão: crédito de demonstração expirável e crédito bônus manual não expirável; crédito comprado é aquisição futura, não concessão.
9. A F51 reúne landing, instrumentação do funil e fundação SEO porque mensagem, indexabilidade, performance, metadata e conteúdo precisam ser coerentes desde a publicação.
10. Sitemap e configuração técnica ajudam descoberta e crawling, mas não garantem indexação ou ranking; SEO contínuo depende de conteúdo útil, autoridade e medição no Search Console.
11. Serviços, informativas e 9:16 ampliam valor antes do carrossel, que tem custo e complexidade maiores.
12. i18n e storage começam por inventário e medição; implementação ampla depende de demanda e gatilhos objetivos.
13. O projeto continua avançando enquanto a F48 amadurece: uma entrega principal e uma frente secundária por vez.
14. A F50 e o beta fechado permanecem no Supabase; backup externo restaurável é gate de convite, não sinônimo de migração imediata do storage.
15. Após estabilização do beta e resolução das pendências de constituição/conformidade, abstração e piloto de storage externo passam a ser prioridade, com Cloudflare R2 como candidato e não como decisão irreversível.
16. Conta ativa não expira por inatividade ou ausência de saldo; encerramento voluntário é fluxo distinto, com janela de 30 dias e retenção legal mínima segregada.
17. O produto admite imagens de pessoas e menores quando houver direitos e autorizações aplicáveis, com responsabilidade contratual do usuário, proteção do melhor interesse do menor e mecanismos de bloqueio/remoção para abuso.
