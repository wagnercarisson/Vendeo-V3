# Alinhamento — Roadmap pós-F48.1

**Status:** diretriz de planejamento; a numeração posterior à F48.1 é proposta e deve ser confirmada no planejamento de cada fase.

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
onboarding → serviços → informativas → 9:16 → landing → carrossel
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

## 4. Fases principais de produto — sequência proposta

### F49 — Ativação e onboarding guiado

**Por que primeiro:** melhora a experiência completa com o produto atual e cria medição antes de aumentar aquisição pela landing.

**Escopo:**

- checklist persistente de ativação;
- passos obrigatórios, recomendados e opcionais claramente separados;
- orientação contextual nas telas, sem tour forçado;
- exemplos junto aos campos de campanha;
- explicação clara de logotipo, perfil de marca, direção/assinatura visual e quando cada item é usado;
- retomada do ponto pendente ao voltar ao produto;
- eventos de conclusão, tempo e abandono por etapa.

**Métrica de ativação:** primeira campanha aprovada e pronta para uso/download, não apenas cadastro ou geração iniciada.

**Fora de escopo:** redesenho completo de todas as páginas e assistente conversacional.

### F50 — Campanhas de serviços

**Objetivo:** atender negócios cujo valor vendido não depende de uma foto de produto.

**Escopo mínimo:** brief próprio, exemplos, direção visual, copy, validações e cenários de laboratório para serviços. Reutilizar o pipeline apenas onde a semântica for realmente comum.

**Evitar:** tratar serviço como “produto sem imagem” se isso gerar campos e prompts artificiais.

### F51 — Campanhas informativas

**Objetivo:** avisos, horários, inauguração, eventos e comunicados sem oferta obrigatória.

**Escopo mínimo:** intenção própria, campos adequados, hierarquia de informação, templates/prompts e validações específicas.

**Dependência útil:** aprendizados da F50 sobre briefs não centrados em produto.

### F52 — Formato vertical 9:16

**Objetivo:** gerar uma peça vertical publicável, mantendo legibilidade, identidade e safe areas.

**Escopo:** seleção de formato, contrato de proporção, composição, preview, revisão, persistência, exportação e cenários de regressão.

**Dependência:** tipos de campanha estabilizados; não desenvolver em paralelo com carrossel.

### F53 — Landing orientada à conversão

**Por que nesta posição:** a landing passa a prometer uma experiência interna mais clara e pode usar exemplos reais de serviços, informativas e 9:16. Antes disso, medir o funil atual.

**Escopo:**

- instrumentar visita → CTA → cadastro/solicitação → ativação;
- tratar separadamente o funil de beta fechado e o de signup aberto;
- hero centrado no resultado para o lojista;
- exemplos reais de campanhas e processo simplificado;
- prova de produto, objeções, segurança e clareza de custo;
- CTA principal coerente com o modo de aquisição ativo;
- reduzir o destaque de “Novidades” no caminho principal;
- testes de mensagem e estrutura com métrica de conversão.

**Restrições:** sem depoimentos inventados, números sem base ou redesign avaliado apenas por preferência visual.

### F54 — Carrossel MVP

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

Medir antes de migrar:

- GB armazenados, uploads, downloads e egress;
- crescimento por campanha e por tipo de artefato;
- consumidores atuais e dependências de URL/política;
- custo e ergonomia de Supabase Storage, R2 e alternativas;
- impacto de 9:16 e carrossel.

Criar primeiro uma camada de abstração e um piloto somente quando houver benefício comprovável. Migração total exige gatilho financeiro ou operacional definido, plano de compatibilidade e rollback.

## 6. Plano de encaixe recomendado

| Ordem | Trilha principal | Trilha secundária segura | Resultado esperado |
|---|---|---|---|
| 0 | **F48.1 — laboratório mínimo** | Inventários somente leitura | Bancada utilizável sem tocar produção |
| 1 | **F49 — onboarding e ativação** | **F48.2 — dossiês/guides/prompts** + inventário i18n/storage | Jornada interna clara e conhecimento confiável dos modelos |
| 2 | **F50 — serviços** | Primeiro ciclo de prompt no laboratório / F48.3 somente se necessário | Novo caso de uso e evidência real da bancada |
| 3 | **F51 — informativas** | **F48.4 — pricing** | Segundo caso de uso e custos versionados |
| 4 | **F52 — 9:16** | **F48.5 — descoberta/alertas** | Novo formato e vigilância de providers |
| 5 | **F53 — landing** | Pesquisa de i18n ou storage, sem migração | Aquisição alinhada à experiência já entregue |
| 6 | **F54 — carrossel MVP** | **F48.6 — homologação**, se os pré-requisitos existirem | Formato multipágina controlado e processo seguro de promoção |
| posterior | Fundação i18n ou piloto de storage | Apenas pesquisa leve na outra trilha | Expansão guiada por demanda e dados |

Essa é uma ordem de planejamento, não um compromisso de calendário. A próxima fase deve ser confirmada conforme aprendizado da anterior.

## 7. Paralelismo seguro e conflitos

### Combinações seguras

- onboarding + dossiês/model guides;
- serviços + testes controlados de prompt;
- informativas + medição de storage;
- 9:16 + monitoramento de pricing/modelos;
- landing + inventário de internacionalização;
- carrossel + homologação documental, desde que a homologação não altere o pipeline.

### Combinações a evitar

- laboratório e carrossel alterando simultaneamente o pipeline de geração;
- laboratório e migração de storage;
- internacionalização total e redesign amplo de UI;
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
| Landing | Funil instrumentado e destino pós-CTA coerente |
| Onboarding | Evento de ativação e etapas mensuráveis definidos |
| 9:16 | Contrato de formato e safe areas definidos de ponta a ponta |
| Carrossel | MVP rígido e política de custo/falha/aprovação definidas |
| i18n | Locale-alvo e inventário Brasil-específico concluídos |
| Storage | Threshold financeiro/operacional e inventário de consumidores concluídos |

## 9. Estimativas indicativas preservadas

As faixas abaixo servem apenas para comparar porte; devem ser refeitas no planejamento técnico:

| Escopo | Faixa indicativa |
|---|---:|
| F48.1 mínima | 5–8 dias |
| Programa F48 completo | 20–35 dias |
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
6. Onboarding vem antes do investimento maior em aquisição; a landing deve vender uma experiência que o produto já entrega com clareza.
7. Serviços, informativas e 9:16 ampliam valor antes do carrossel, que tem custo e complexidade maiores.
8. i18n e storage começam por inventário e medição; implementação ampla depende de demanda e gatilhos objetivos.
9. O projeto continua avançando enquanto a F48 amadurece: uma entrega principal e uma frente secundária por vez.
