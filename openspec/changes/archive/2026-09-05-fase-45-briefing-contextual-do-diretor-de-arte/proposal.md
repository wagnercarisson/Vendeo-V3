## Why

Os 4 prompts do diretor de imagem (`prompts/campaign-image-director*.md` — base, offer, spotlight e exclusive) evoluíram como um único template literal por intent, misturando naturezas semânticas diferentes: fatos da campanha, textos obrigatórios do lojista, aviso ilustrativo fixo, identidade visual da loja, contexto comercial, orientação criativa e regras de fidelidade. Como a montagem (`buildPromptVariables` → `assemblePrompt`) sempre resolve **todas** as variáveis — muitas com valor vazio quando o lojista não preencheu o campo — o prompt final enviado ao modelo carrega linhas de tabela em branco, seções com corpo vazio (ex.: `## Perfil de Marca` sem `brandProfileSection`, `### Repertório Comercial` sem repertório) e informações duplicadas em pontos diferentes (validade, `campaignDetails`/`additionalDetails` e o aviso ilustrativo aparecem em mais de um lugar, com tratamentos semânticos conflitantes). Esse ruído aumenta a chance de o diretor misturar campos de naturezas distintas — por exemplo, tratar o aviso ilustrativo como parte do texto comercial/legal do produto.

O objetivo **não** é reduzir tokens. O objetivo é melhorar clareza, legibilidade humana, organização semântica e a qualidade da orientação: manter os `.md` como documentos de direção criativa claros e revisáveis, mas enviar ao modelo **somente os blocos relevantes ao caso real**, com cada natureza de informação em seção própria — e nada vazio, duplicado ou ambíguo. O prompt atual gera bons resultados; portanto, esta fase preserva a riqueza útil da orientação e reorganiza, não amputa. (A economia de tokens, quando ocorrer, é consequência — nunca o critério.)

## What Changes

- **Reestruturação dos 4 `.md` do diretor em duas camadas**: camada **editorial** (papel, diretrizes de composição, instruções obrigatórias anti-invenção, regras de fidelidade e autorização de criatividade — texto humano, claro, revisável, mantido no arquivo) e pontos de injeção de **blocos contextuais** nomeados por propósito (fatos da campanha, texto obrigatório, aviso ilustrativo, identidade, produto/referências, detalhes comerciais, restrições, direção criativa). Os `.md` continuam legíveis e não viram templates secos de `{{campo}}`: cada bloco injetado tem função e intenção compreensíveis dentro do texto.
- **Nova camada de montagem "briefing contextual"** em helper puro dedicado (fora do `ImageGenerationService`, hoje com 1269 linhas): a partir de `CampaignBrief` + `ResolvedCampaignContext`, monta por **presença real de dados** os blocos contextuais do diretor. Bloco sem dados → bloco não enviado (nada de seção vazia, nada de linha de tabela em branco, nada de placeholder não resolvido no prompt final).
- **Separação semântica explícita no prompt final**:
  - Texto obrigatório do lojista → **seção própria** quando existir, com instrução de respeitá-lo visível e legível; ausente → nenhuma seção vazia enviada, mantida a regra geral de não inventar informação não recebida.
  - Aviso ilustrativo → **seção própria** quando existir, com instrução simples e única: mínimo, legível, discreto, separado dos demais textos e nas laterais da arte; ausente → nenhum placeholder vazio enviado.
  - Identidade da loja (logo/assinatura visual, quando houver referência) → orientação de **preservação**: não editar, alterar, redesenhar, distorcer ou inventar marca/logotipo/assinatura.
  - Imagens do produto → a primary é **referência factual forte**; auxiliares são referências adicionais **sem competir** com a primary (hierarquia preservada).
- **Eliminação de duplicações e misturas** no prompt do diretor (ex.: validade hoje aparece em tabela + `Notas Adicionais` + `buildCommercialRepertoire`; `campaignDetails`/`additionalDetails` aparecem em tabela + `Notas Adicionais` + repertório; aviso ilustrativo aparece em tabela + cauda). O `buildCommercialRepertoire` é **repartido/refeito**: validity e detalhes saem do repertório e cada natureza opcional/sensível (validade, texto obrigatório, aviso ilustrativo, detalhes comerciais, disponibilidade, restrições) passa a ter **um único bloco canônico**. Produto e loja podem aparecer legitimamente em múltiplos contextos (fatos, fidelidade, identidade/assinatura).
- **Regras preservadas**: anti-alucinação comercial/legal (não inventar preço, benefício, validade, selo, texto legal, característica do produto) e autorização explícita de criatividade do diretor dentro dos limites factuais continuam presentes.
- **Sem mudança de superfície externa**: nenhuma alteração de UI/formulário, contrato HTTP público, schema público, snapshot/domínio, revisor (`campaign-image-reviewer`), Copy Director, fallback de imagem OpenAI (tratado na quick 260902-mqj) ou comportamento percebido pelo lojista. A mudança é interna à montagem do prompt de imagem.
- **Testes**: cobertura da montagem contextual dos blocos principais (presente/ausente), ausência de placeholders não resolvidos e ausência de seções vazias; co-migração dos golden tests (`EXPECTED_KEYS`) e do `prompt-reframe.test.ts`, que passam a validar a nova estrutura.

> **BREAKING**: nenhum para o cliente/lojista. Internamente, o texto final do prompt do diretor e o conjunto de chaves de montagem mudam intencionalmente — os testes que ancoram esse contrato interno (golden 39 keys, `prompt-reframe`, `validatePrompts`) são co-migrados.

## Capabilities

### New Capabilities

- `art-director-contextual-briefing`: montagem do "briefing contextual" do diretor de arte por blocos condicionais de seção (fatos, texto obrigatório, aviso ilustrativo, identidade, produto/referências, detalhes comerciais, restrições, direção criativa), com regras de presença/ausência (sem seções vazias, sem placeholders não resolvidos), separação semântica entre textos do lojista × aviso ilustrativo, preservação de identidade visual e fidelidade visual das referências — mantendo os 4 `.md` por intent como documentos humanos legíveis.

### Modified Capabilities

- `ai-image-generation`: contrato de montagem do prompt do diretor (`buildPromptVariables`/`assemblePrompt`/`validatePrompts`) passa a produzir um prompt **contextual** (blocos condicionais; seções vazias removidas; campos ausentes não geram texto) e a validar a ausência de seções vazias/placeholders residuais. A regra de "paridade comportamental" (mesmo conjunto de variáveis/keys para o mesmo input) é substituída por: **superfície externa inalterada** (contrato HTTP/schema/snapshot/revisor; comportamento percebido pelo lojista) + **montagem determinística** (mesmo input → mesmo prompt) + **intenção/qualidade visual preservada por regras e UAT humano comparativo**, permitindo mudança intencional do texto interno de montagem do diretor dentro dos limites desta fase.

## Impact

- **Prompts**: `prompts/campaign-image-director.md`, `prompts/campaign-image-director-offer.md`, `prompts/campaign-image-director-spotlight.md`, `prompts/campaign-image-director-exclusive.md` (os 4 do diretor). Revisor (`campaign-image-reviewer.md`) e copy director **fora do escopo**.
- **Código**:
  - `src/lib/image-generation/services/image-generation-service.ts` — `buildPromptVariables` (L896-1003), `assemblePrompt` (L1005-1023), `validatePrompts` (L637-708), `splitDirectorLegalText` (L80-91), `buildCommercialRepertoire` (L761-814), `buildBrandProfileSection` (L1209-1246) e demais builders de bloco (L816-894).
  - Novo helper puro de briefing contextual (a definir em `design.md`; candidato: `src/lib/image-generation/services/art-director-briefing.ts` ou módulo equivalente), agrupando/refatorando os builders atuais sem perder regra existente.
  - `src/lib/image-generation/prompt-loader.ts` (interpolação — provavelmente inalterado).
  - `src/lib/image-generation/services/prompt-validator.ts` (`validatePrompt` — placeholder não resolvido continua critério de erro; pode ganhar checagem de seção vazia).
  - `src/components/flow/use-campaign-form.ts` helpers (`buildMandatoryArtworkText`, `buildValidityDisplayText`) **não mudam** (fronteira do body HTTP preservada).
- **Testes afetados (co-migração)**:
  - `src/lib/image-generation/services/__tests__/image-generation-service.test.ts` — golden tests por intent (39 keys, L556-708), `validatePrompts` (L65-298), repertório (L710+).
  - `src/lib/campaign/__tests__/prompt-reframe.test.ts` — âncoras de bloco atuais (aviso/texto obrigatório/1+N).
  - `src/lib/image-generation/services/__tests__/image-review-service.test.ts` — só se necessário (revisor fora do escopo; esperado sem mudança).
  - Testes de rota/fixtures (`route.test.ts` e afins) só se `validatePrompts` expuser o novo contrato (co-migração pontual).
- **Specs**: `openspec/specs/ai-image-generation/spec.md` (requisitos de montagem/paridade) e nova capability `openspec/specs/art-director-contextual-briefing/spec.md` após sync.
- **Sem** migrations SQL, sem novas dependências, sem mudança de configuração de deploy.
