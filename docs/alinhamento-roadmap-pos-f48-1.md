# Alinhamento — Roadmap pós-F48.1

**Status:** diretriz de planejamento reconciliada em 2026-10-05. F48.1 e F48.2.1–F48.2.6 foram concluídas; F48.2.7 fica reservada, não iniciada, para novos testes com escopo próprio. F56.x é a proposta de incorporação produtiva, ainda sem fase ativa ou promoção.

**Fonte operacional do estado concluído:** `.planning/ROADMAP.md` e os artefatos OpenSpec/GSD arquivados de cada fatia. Este documento registra direção futura; não substitui a especificação nem inicia fases.

## 1. Decisão central

A F48 não deve ser construída como uma única fase. É um **programa incremental de experimentação e governança de IA**, dividido em fatias F48.x e intercalado com fases que entregam valor direto ao usuário. A bancada permanece disponível para adaptações, testes e validações de novos escopos; cada nova fatia exige decisão e escopo próprios.

O limite operacional recomendado é de duas trilhas simultâneas:

1. **Trilha principal:** uma entrega de produto ou experiência do usuário.
2. **Trilha secundária:** pesquisa, medição, documentação ou uma fatia pequena da bancada de IA.

Não manter duas fases simultâneas quando ambas alterarem o pipeline de geração, o mesmo schema crítico ou migrations extensas.

## 2. Ordem dos fundamentos

```text
F46/F47 concluídas
        │
        ▼
F48.1 — laboratório mínimo (concluída)
        │
        ▼
F48.2.1 — bancada manual de prompts do Diretor (concluída)
        ▼
F48.2.2 — fundação da bancada de geração (concluída)
        ▼
F48.2.3 — fidelidade experimental da bancada (concluída)
        ▼
F48.2.4 — experimento determinístico Oferta 1:1 (concluída)
        ▼
F48.2.5 — estabilização experimental Oferta 1:1 (concluída)
        ▼
F48.2.6 — validação experimental Produto/intenções 1:1 (concluída)
        ├── F48.2.7 — reserva para novos testes, se houver escopo aprovado
        └── F56.1 → F56.2 → F56.3 — incorporação produtiva proposta

F48.3–F48.6: frentes futuras de governança, não executadas nesta cadeia.
F49–F55 e demais entregas de produto: sequenciamento próprio, sem execução concorrente sobre o mesmo pipeline.
```

A F48.1 forneceu a base isolada. As fatias F48.2.1–F48.2.6 ampliaram e validaram a bancada sem modificar o fluxo produtivo. Seus resultados orientam a F56, mas não equivalem à promoção de prompts, modelos ou políticas. Novos experimentos permanecem possíveis na F48.2.7 reservada, sem reabrir retroativamente as fatias concluídas.

## 3. Programa F48 — IA em fatias

### F48.1 — Laboratório mínimo de IA

**Situação:** concluída.

**Papel:** bancada local, isolada e pequena para comparar baseline × candidato com prompt, modelo e cenário congelados.

**Inclui:** execução explícita, artefatos persistidos, custo, latência, status técnico, comparação visual e decisão humana.

**Não inclui:** descoberta automática, scraping de preços, dossiês completos, matriz arbitrária de parâmetros, juiz textual de qualidade, promoção automática ou alteração do fluxo produtivo.

**Regra:** nenhuma ampliação da bancada entra apenas para “completá-la”. Cada nova fatia deve destravar uma decisão concreta.

### F48.2 — Qualidade e otimização dos prompts (guarda-chuva)

**Situação:** F48.2.1–F48.2.6 concluídas; F48.2.7 reservada e não iniciada. A bancada permanece isolada da produção.

A F48.2 é um **guarda-chuva** dividido em fatias sequenciais:

- **F48.2.1 — Bancada manual de prompts do Diretor:** ambiente manual, isolado e sujeito à decisão humana, sem escolha automática de vencedores ou promoção.
- **F48.2.2 — Fundação da bancada de geração no Admin/Laboratório:** gerações reais e mensuráveis com loja, branding, imagens e modelo/qualidade, sem créditos do lojista nem impacto produtivo.
- **F48.2.3 — Fidelidade experimental da bancada:** importação e resolução confiáveis de identidade/branding, paridade do formulário e preflight do briefing, ainda sem promoção.
- **F48.2.4 — Experimento determinístico Oferta 1:1:** composição versionada do prompt, execução manual e avaliação humana de campanhas Oferta no formato quadrado.
- **F48.2.5 — Estabilização experimental Oferta 1:1:** refinamentos e validação controlada, com limitações UAT mantidas como pendentes e sem promoção.
- **F48.2.6 — Validação experimental Produto — intenções 1:1:** Oferta, Destaque e Exclusivo; direção de fundo Estúdio/Ambientado/Original; políticas e compositor versionados; UAT aprovado com limitações, sem alterar produção.
- **F48.2.7 — Ponte experimental reservada, não iniciada:** poderá adaptar a bancada e validar novos produtos, formatos, modelos ou outros escopos concretos antes de incorporação produtiva. Não é fase ativa nem autorização antecipada para geração paga; escopo, custo, critérios e checkpoints dependerão de aprovação própria.
- **Histórico:** a numeração **F48.2.2** antes designava a *Auditoria e Otimização do Prompt do Revisor*, descartada/substituída em 2026-09-28 sem implementação. A **F48.2.3** foi descrita, em momentos anteriores, como *Promoção, Canário e Prontidão da Aprovação* e depois como *Experimento Oferta 1:1*. A execução efetiva da F48.2.3 foi **Fidelidade experimental da bancada**; o experimento Oferta ocorreu na **F48.2.4**. As descrições antigas não são planos ativos.

**Fronteira com F56 e F48.6:** a incorporação produtiva específica do fluxo Produto 1:1 testado na bancada, com ativação controlada e rollback, é proposta para a **F56**. A F48.2.7 pode produzir novas evidências, mas não promove resultados. A homologação geral e governança de modelos, providers e capabilities continuam como frente futura da **F48.6**, cujo escopo deve ser reconciliado quando planejado.

O **conhecimento de modelos** (dossiê por modelo) permanece nas fatias já numeradas: preços em F48.4; descoberta, lifecycle e dossiê documental em F48.5. Cada modelo já cadastrado ou candidato deve ter um dossiê com:

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

**Aplicações futuras:** novas hipóteses de prompt, modelo ou produto podem ser avaliadas na bancada, inclusive pela F48.2.7 reservada, quando houver caso e autorização específicos. A antiga auditoria do prompt do Revisor não foi executada como F48.2.2.

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

**Escopo separado:** o novo fluxo produtivo proposto na F56 não terá revisão automática de qualidade. O atual `campaign_image_review` de produção deve ser tratado explicitamente na integração, pois afeta retries, custo e comportamento; não se presume desligamento retroativo do fluxo legado.

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

**Fronteira com F56:** a F48.6 permanece uma proposta de homologação e promoção **geral** de modelos, providers e capabilities. A incorporação específica do fluxo Produto 1:1, suas configurações, seu canário e seu rollback são propostos para a F56; isso não equivale a concluir antecipadamente a F48.6.

**Não inclui:** promoção ou rollback decididos autonomamente por IA.

## 4. Fases principais de produto — sequência atualizada

### F49 — Ativação e orientação contextual de campos — concluída

**Resultado entregue:** orientação no ponto de decisão nos formulários de identidade da loja e do brief de campanha: labels, hints, exemplos, ajuda expansível, feedback contextual, fronteiras entre campos e revisão do brief mais compreensível.

**Fronteira real da fase:** não foram implementados checklist global persistente, retomada global do ponto pendente nem eventos de conclusão, tempo e abandono por etapa. Isso não torna a F49 incompleta em relação ao escopo aprovado; significa que a fase foi refinada para orientação contextual.

**Encaminhamento:** a instrumentação de aquisição → ativação passa para a F51.1, junto da landing. Checklist global ou redesenho adicional do onboarding só deve voltar ao roadmap se os dados mostrarem abandono interno que justifique essa solução.

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

**Telemetria própria:** registrar concessão, primeira geração, esgotamento, expiração, solicitação de créditos e futura conversão para saldo comprado. A F51.1 consome esses eventos no funil; não é responsável por inventá-los.

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

### F51.1 — Landing orientada à conversão e instrumentação do funil

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

**Critério de conclusão:** a fase não termina apenas com a nova landing publicada. O funil deve ser validado de ponta a ponta no ambiente local com Supabase/Docker nos dois modos suportados: (a) beta fechado, com visita → CTA → solicitação de acesso; e (b) signup público, com visita → CTA → cadastro confirmado → loja elegível → primeira campanha. A validação local do modo aberto não autoriza o cutover de produção, que continua condicionado à F50.1.

### F51.2 — Fundação SEO técnica e operacional

**Por que é uma fase separada:** SEO envolve indexabilidade, canonicalização, metadata, performance, Search Console e medição orgânica. Separá-lo evita ampliar a F51.1 sem deixar essa primeira fase incompleta. A F51.2 sucede a F51.1 e reutiliza sua mensagem, hierarquia de conteúdo e provas visuais já validadas.

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

### F56 — Incorporação produtiva dos aprendizados da F48 (proposta, não iniciada)

**Objetivo:** levar ao fluxo produtivo Produto 1:1 os contratos validados na bancada, em fatias pequenas e verificáveis. Os resultados experimentais da F48.2.6 são insumo, não autorização automática de promoção. A F48.2.7 permanece disponível para novos testes quando surgir uma hipótese concreta; não é pré-requisito obrigatório de toda fatia F56.

**F56.1 — Contrato produtivo, modelos e fallback.** Preparar seleção administrativa dos pares modelo–qualidade testados (`gpt-image-2`, `gpt-image-2.5-flare` e `gpt-image-2.5-sunburst`, em `low`/`medium`), com um par principal global para o novo fluxo e um par de fallback configurável, sem escolha por intenção. Adaptar a execução produtiva para respeitar a qualidade escolhida, registrar versões, telemetria e custos, e congelar o fluxo/modelo/qualidade aplicáveis à campanha para que mudanças posteriores do admin não alterem suas correções. Duas falhas técnicas elegíveis consecutivas no principal, ou falha explícita de capacidade/indisponibilidade do modelo, podem acionar o fallback; falhas de entrada, autorização, segurança ou conta não se tornam automaticamente falhas de modelo. Definir e testar essa classificação antes da ativação.

**F56.2 — Novo fluxo de geração Produto 1:1.** Incorporar seleção explícita de Oferta/Destaque/Exclusivo e Estúdio/Ambientado/Manter cenário original; a opção Original só aparece com exatamente uma imagem de produto. Preservar nome completo, referências, briefing, identidade, textos obrigatórios e contratos comerciais validados na bancada. Usar duas chaves de ativação controlada — lojas de teste e todas as lojas — com rollback, sem mudar campanhas legadas. O novo fluxo não terá revisor automático. **Primeira entrega:** gerar, disponibilizar e permitir baixar/utilizar a arte diretamente, sem aprovar/reprovar; cobrança e falhas seguem o contrato da geração inicial, sem antecipar correções gratuitas.

**F56.3 — Aprovação, reprovação e nova composição.** Apenas campanhas criadas já sob esta fatia entram no gate de aprovação; nenhuma campanha anterior perde retroativamente o download. A pessoa aprova a arte e encerra definitivamente o ciclo, ou a reprova informando o motivo. A reprovação retorna ao formulário com briefing, dados comerciais, referências, intenção, fundo e configuração da geração preservados; uma instrução de correção orienta a nova composição, sem trocar silenciosamente a intenção original. Defeitos visuais e texto incorreto são motivos normais de reprovação, avaliados pelo usuário, não por revisor automático. Uma campanha paga inclui a arte original e até **quatro** novas artes entregues após reprovação; o limite interno deve ser configurável no admin, começando em quatro correções, e **não aparece como contador na interface**. Abrir o formulário, enviar instrução ou sofrer falha técnica sem nova arte utilizável não consome correção nem gera cobrança adicional ao lojista. Esgotadas as correções, oferecer aprovação da arte atual, contato com suporte ou início de nova campanha paga. Artes pendentes/reprovadas não têm download autorizado: a proteção deve ser aplicada no servidor; bloquear o botão direito é apenas dissuasão visual, não garantia contra cópias ou capturas de tela.

**Fronteiras:** F56.1–F56.3 exigem propostas, specs, planos e validações próprios antes de execução. Não reativar automaticamente a regeneração da F37, não aplicar revisão automática ao novo fluxo e não promover todos os modelos ou formatos apenas porque participaram da bancada. Cada correção usa o contrato e a configuração registrados na campanha original; o fallback técnico ocorre dentro da tentativa de geração e não consome a cota de correções do lojista.

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

### SEO contínuo após a F51.2

A F51.2 entrega a fundação técnica e a otimização das páginas públicas existentes. Depois dela, SEO passa a ser disciplina contínua, não uma sequência de páginas criadas sem evidência:

- acompanhar consultas, impressões, CTR, posição e cobertura no Search Console;
- identificar dúvidas reais de lojistas que mereçam conteúdo público útil;
- revisar títulos, snippets, links internos e conteúdo conforme dados;
- atualizar sitemap e metadata quando novas superfícies públicas forem criadas;
- monitorar Core Web Vitals e regressões de indexabilidade em releases;
- só criar hub editorial/blog quando houver capacidade de autoria, revisão, manutenção e diferenciação.

## 6. Plano de encaixe recomendado

| Situação / precedência | Trilha principal | Trilha secundária segura | Resultado esperado |
|---|---|---|---|
| Concluída | **F48.1 → F48.2.1 → F48.2.2 → F48.2.3 → F48.2.4 → F48.2.5 → F48.2.6** | Outras entregas já realizadas, conforme roadmap operacional | Evidência experimental isolada, sem promoção produtiva |
| Próxima trilha proposta | **F56.1 — contrato produtivo/modelos/fallback** | Pesquisa ou documentação sem alteração do pipeline | Configuração e execução preparadas, ainda sem virada geral |
| Após validar F56.1 | **F56.2 — geração Produto 1:1** | Pesquisa leve; sem segunda mudança produtiva de geração | Piloto controlado e entrega direta sem aprovação |
| Após validar F56.2 | **F56.3 — aprovação e correção** | Pesquisa leve; sem mudança concorrente de crédito/artefatos | Gate humano e novas composições com limite interno |
| Sob demanda | **F48.2.7 — ponte experimental reservada** | Não executar em paralelo com F56 se ambas alterarem o mesmo contrato/pipeline | Evidência para hipótese nova, com escopo e autorização próprios |
| Outras frentes | **F50.1, F51.1–F55, F48.3–F48.6, i18n e storage** | Conforme dependências, risco e capacidade reais | Sequência específica definida no planejamento de cada frente |

Essa é uma ordem de dependência da proposta F56, não um calendário nem a ativação de uma fase. A numeração F56 não obriga executar F50.1–F55 antes dela; essas frentes têm gates próprios no roadmap operacional. A próxima fase concreta deve ser confirmada antes de sua proposta OpenSpec.

## 7. Paralelismo seguro e conflitos

### Combinações seguras

- F56.x + pesquisa documental da F48.2.7 ou de modelos, sem segunda alteração produtiva do pipeline;
- demonstração gratuita + pesquisa documental de modelos, sem segunda migration extensa;
- landing/funil ou SEO + inventário de internacionalização ou storage;
- serviços + testes controlados de prompt;
- informativas + medição de storage;
- 9:16 + monitoramento de pricing/modelos;
- carrossel + homologação documental, desde que a homologação não altere o pipeline.

### Combinações a evitar

- F56.1, F56.2 e F56.3 executadas como uma fase única ou simultaneamente sobre o pipeline;
- F48.2.7 e F56.x mudando em paralelo os mesmos prompts, modelos, schemas ou contratos de geração;
- aprovação/correção F56.3 em paralelo com mudança no ledger de créditos ou no armazenamento de artes;
- laboratório e carrossel alterando simultaneamente o pipeline de geração;
- laboratório e migração de storage;
- internacionalização total e redesign amplo de UI;
- demonstração gratuita junto de outra mudança no ledger, elegibilidade ou documentos legais;
- F51.2/SEO junto de troca de domínio sem plano de redirects/canonical/Search Console;
- serviços/informativas junto de reestruturação global de todos os prompts;
- 9:16 e carrossel na mesma fase;
- duas migrations extensas/deploys de alto risco em paralelo.

## 8. Gates de decisão

Uma fase/fatia só deve começar quando responder “sim” ao gate correspondente:

| Escopo | Gate mínimo |
|---|---|
| F48.2.7, se necessária | Hipótese e escopo novos, orçamento/autorizações, critérios e fronteira com produção definidos; não reabrir fatias concluídas |
| F56.1 | Contrato de seleção principal/fallback, qualidade, classificação de falhas elegíveis, telemetria/custo e configuração por campanha definidos |
| F56.2 | F56.1 validada; intenções/fundos/1:1 e preservação de referências especificados; chaves de teste/geral, rollback e entrega direta sem revisão automática testáveis |
| F56.3 | F56.2 validada; estados de aprovação, briefing preservado, limite interno configurável, cobrança, falhas sem consumo e bloqueio server-side de download especificados |
| Novo modelo | Dossiê, preço verificado, guide lido e capability definida |
| Mudança de prompt | Baseline congelado, hipótese única e cenários representativos |
| Homologação | Evidência técnica + avaliação humana + rollback |
| Demonstração gratuita | Contrato de concessão/expiração fechado, transição legada definida, PJ constituída e identificada, documentos consolidados e revisados juridicamente, canais de suporte operantes, MFA confirmada, backup externo restaurável e nenhuma cobrança implícita |
| Landing + funil (F51.1) | Destinos pós-CTA definidos para beta fechado e signup aberto; ambiente local capaz de validar ambos; conceito de ativação e correlação do funil fechados |
| SEO (F51.2) | Landing F51.1 validada, URLs indexáveis definidas, domínio canônico decidido e propriedade do Search Console disponível |
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
| Demonstração gratuita + legal/transição | 7–12 dias |
| F51.1 — landing + instrumentação do funil | 6–10 dias |
| F51.2 — fundação SEO | 3–6 dias |
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
9. A F51 foi dividida: a F51.1 conclui landing e instrumentação do funil, com validação local dos modos beta fechado e signup aberto; a F51.2 sucede essa base e entrega SEO técnico e operacional sem ampliar a primeira fase.
10. Sitemap e configuração técnica ajudam descoberta e crawling, mas não garantem indexação ou ranking; SEO contínuo depende de conteúdo útil, autoridade e medição no Search Console.
11. Serviços, informativas e 9:16 ampliam valor antes do carrossel, que tem custo e complexidade maiores.
12. i18n e storage começam por inventário e medição; implementação ampla depende de demanda e gatilhos objetivos.
13. O projeto continua avançando enquanto a F48 amadurece: uma entrega principal e uma frente secundária por vez.
14. A F50 e o beta fechado permanecem no Supabase; backup externo restaurável é gate de convite, não sinônimo de migração imediata do storage.
15. Após estabilização do beta e resolução das pendências de constituição/conformidade, abstração e piloto de storage externo passam a ser prioridade, com Cloudflare R2 como candidato e não como decisão irreversível.
16. Conta ativa não expira por inatividade ou ausência de saldo; encerramento voluntário é fluxo distinto, com janela de 30 dias e retenção legal mínima segregada.
17. F48.1–F48.2.6 estão concluídas e não promoveram o fluxo à produção. F48.2.7 fica reservada, não iniciada, para novos testes delimitados; F48.3–F48.6 continuam frentes futuras independentes.
18. A incorporação produtiva proposta será fatiada em F56.1 (modelos/contrato), F56.2 (geração e entrega direta) e F56.3 (aprovação/correção), sem revisor automático no novo fluxo e sem alterar retroativamente campanhas legadas.
19. Uma campanha aprovada encerra seu ciclo. Na futura F56.3, a campanha paga poderá entregar a arte original e até quatro correções concluídas, sem contador visível; falhas técnicas não consomem correções nem criam nova cobrança ao lojista. A proteção de download é server-side, não depende de bloquear o botão direito.
17. O produto admite imagens de pessoas e menores quando houver direitos e autorizações aplicáveis, com responsabilidade contratual do usuário, proteção do melhor interesse do menor e mecanismos de bloqueio/remoção para abuso.
