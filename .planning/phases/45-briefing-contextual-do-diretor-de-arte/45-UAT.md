# Phase 45: Briefing Contextual do Diretor de Arte — UAT Comparativo (antes × depois)

**Status:** ✅ APROVADO — avaliação humana concluída em 2026-09-05 (PASS em (a)–(f) + PASS na leitura dos 4 `.md`); observação residual não-bloqueante registrada (briefings longos, aceitos deliberadamente); nenhuma paridade visual pixel a pixel é requerida
**Preparado em:** 2026-09-04 (plano 45-07) — registro de aprovação finalizado em 2026-09-05 (fluxo pós-aprovação)
**Fonte da verdade:** `openspec/changes/fase-45-briefing-contextual-do-diretor-de-arte/`
**Material de referência:** `.planning/phases/45-briefing-contextual-do-diretor-de-arte/45-VERIFICATION.md` (goal-backward, passed), `45-06-SUMMARY.md` (revisão humana dos 4 `.md` HUMAN-APPROVED + textos finais montados), `45-08-SUMMARY.md`/`45-08-ENTREGA.md` (alinhamento Diretor × Revisor HUMAN-APPROVED) e `resultado.md` (artes reais de UAT aprovadas)

---

## Registro de aprovação humana (decisão final — 2026-09-05)

O avaliador **APROVOU** o roteiro comparativo da F45 (45-07 Task 2, `gate="blocking"`). Decisões registradas como autoritativas:

1. **PASS nos 6 cenários (a)–(f)** do comparativo antes × depois — fundamentado nas comparações documentadas abaixo (pares montados via caminho real) e na evidência real de campanhas **publicáveis aprovadas** registrada em `resultado.md` (`image.png`/`image-1.png` — offer **Cerveja Heineken 600ml** e spotlight **Coca Cola 2l Original**, loja Mercearia da Quinze), já na **base corrigida do 45-08** (alinhamento Diretor × Revisor + concordância de gênero da identidade aprovada em `1b4a5e3c`/`5c8da304`).
2. **PASS na leitura humana dos 4 `.md`** do diretor — continuam documentos de direção criativa legíveis (camada editorial + slots com intenção clara); ver também 45-06 (HUMAN-APPROVED) e 45-08 (identidade canônica/área segura aprovada).
3. **Observação residual NÃO-BLOQUEANTE:** os briefings finais são **longos** — aceitos **deliberadamente** porque as artes resultantes são **boas e publicáveis**. Nenhuma nova rodada de otimização/simplificação/ajuste editorial é autorizada.
4. **Nenhuma paridade visual/pixel a pixel** com resultados anteriores é requerida — a F45 não promete paridade de resultado visual (design D5); o que se preserva é riqueza/orientação + regras + contrato externo, confirmado.
5. Os prompts atuais (Diretor + Revisor) estão **aprovados como estão**; nenhuma geração de imagem nova é necessária.

---

## Contexto e metodologia do comparativo

A F45 reorganizou a montagem do prompt do diretor de arte em **briefing contextual por blocos** (design D1–D7). Como a mudança é qualitativa (interna à montagem do prompt; nenhuma superfície externa muda), a validação exige comparação humana **antes × depois** de campanhas reais: o texto final não pode ter perdido riqueza/orientação — reorganizar, não amputar.

**Como os pares foram montados (caminho real, sem simulação):**

| Lado | Estado | Como foi gerado |
|------|--------|-----------------|
| **ANTES** | Pré-F45 (merge-base `de0cbc78` — quick 260902-kqo/mqj aplicados, montagem antiga de 39 chaves + templates antigos) | Worktree temporário em `de0cbc78`; `ImageGenerationService.buildPromptVariables` real (39 chaves) + `PromptLoader` real interpolando os `.md` antigos do disco |
| **DEPOIS** | F45 concluída (HEAD `99796b0a` — mapa FINAL de 12 chaves + 4 `.md` reescritos com ajustes humanos F45-06a/F45-06b) | `ImageGenerationService.buildPromptVariables` real (12 chaves) + `PromptLoader` real interpolando os `.md` novos do disco |

Para cada cenário, a **mesma entrada** (brief flat → `buildCampaignBriefFromFlat` + contexto `ResolvedCampaignContext`) foi montada nos dois lados. Invariantes verificadas em ambas as montagens: zero `{{placeholder}}` residual; nome do produto presente. O que muda entre os lados é **apenas** o template `.md` + a lógica de montagem — exatamente o escopo da F45.

> **Base corrigida (pós-45-08):** os blocos ANTES/DEPOIS abaixo refletem a montagem do 45-07 (estado pós-45-06b). Na sequência, o 45-08 (alinhamento Diretor × Revisor, HUMAN-APPROVED) consolidou o bloco canônico de identidade (`identityReferenceSection` — área segura, margem nas 4 bordas, posição secundária, fidelidade/anti-invenção) e corrigiu a **concordância de gênero** ("a assinatura visual ... fornecida ... secundária"). Essas correções **não regridem** nenhuma das naturezas comparadas aqui (estrutura por blocos, deduplicação, seções próprias, preservação de identidade, hierarquia 1+N e tom por intent permanecem); o estado final aprovado é a base 45-08, confirmada pelas artes reais publicáveis de `resultado.md`.

**Resposta do avaliador (registrada em 2026-09-05):**

1. Em cada cenário, o prompt **DEPOIS** preservou a **riqueza/orientação** do **ANTES**? → **SIM** (PASS a–f; nada de relevante foi amputado — ver resultados por cenário).
2. As naturezas estão em **seções próprias e sem duplicação** no DEPOIS? → **SIM** (cada natureza opcional/sensível em 1× no bloco canônico — ver análise estrutural).
3. Os 4 `.md` continuam documentos de direção criativa **legíveis**? → **SIM** (PASS na leitura dos 4 `.md`).
4. Resposta final: **"approved"** — com a observação residual não-bloqueante (briefings longos, aceitos deliberadamente) e a dispensa de paridade pixel a pixel.

---

## Análise estrutural automática (apoio à leitura — executor)

Contagem de ocorrências de cada natureza **somente no corpo do prompt final montado** (excluída a entrada/sumário):

| Cenário | Natureza | ANTES | DEPOIS |
|---------|----------|:-----:|:------:|
| **A** Identidade (logo) | `NÃO editar/alterar/redesenhar/distorcer` (preservação explícita) | 0 | **1** |
| **B** Aviso ilustrativo | `Imagem meramente ilustrativa` | 2 (tabela + cauda) | **1** (seção própria) |
| **C** Texto obrigatório livre | frase do lojista | 2 (tabela + cauda) | **1** (seção própria) |
| **D** Validade (offer) | `de 25/09/2026 até 30/09/2026` | 4 (tabela + Notas + Repertório + regra dd/mm/aaaa) | **2** (fatos — ocorrência única + regra dd/mm/aaaa) |
| **E** Multi-imagem (spotlight) | hierarquia 1+N (`mantendo a primeira como produto principal`) | 1 | 1 |
| **E** Multi-imagem (spotlight) | `NÃO editar/alterar/redesenhar...` (identidade VS) | 0 | **1** |
| **F** Oferta completa | validade / aviso / texto obrig. / details / disponibilidade / restrições / preservação identidade | 4 / 2 / 2 / 3 / 3 / 2 / 0 | **2 / 1 / 1 / 1 / 1 / 1 / 1** |

> Leitura dos números: no ANTES a validade, os detalhes, a disponibilidade e as restrições aparecem **2–3×** (tabela + `Notas Adicionais` + `Repertório Comercial`); no DEPOIS cada natureza aparece **1×** no bloco canônico (a 2ª ocorrência de "validade" no DEPOIS-D/F é a linha da regra editorial dd/mm/aaaa, presente também no ANTES). A **preservação explícita da identidade** (`NÃO editar, alterar, redesenhar, distorcer nem inventar...`) **não existia no ANTES** — foi adicionada pela F45 (requisito da capability nova).

---

## Cenário (a) — Loja com identidade logo/VS (preservação explícita)

**Entrada (idêntica nos dois lados):** Loja Bella Moda (`moda-calcados-acessorios`, `#E11D48`, tom profissional), produto **Tênis Runner Pro**, oferta R$ 199,90 (original R$ 299,90), badge "Oferta Imperdível", identidade **logo com ativo** (`identityReferenceSection` deve preservar), 1 imagem primary, sem validade/texto obrigatório/aviso/detalhes.

**O que observar:**
- [ ] A orientação de assinatura com o **logotipo** e a **preservação explícita** (não editar/alterar/redesenhar/distorcer/inventar) estão presentes no DEPOIS?
- [ ] A assinatura de marca e a hierarquia (produto > preço > loja > CTA) continuam orientando no DEPOIS?
- [ ] O DEPOIS não perdeu fatos (loja, segmento, tom, produto, preços, badge, canal/formato) nem instruções obrigatórias (anti-invenção, publicável)?

**ANTES (pré-F45 — montagem real):**

```text
# Diretrizes Criativas — Diretor de Marketing → Diretor de Arte

## Briefing: Campanha Visual para Instagram

Você é o Diretor de Marketing da Loja Bella Moda. Sua função é briefar o Diretor de Arte para criar uma campanha visual profissional para Instagram. A peça deve ser publicável, comercial e transmitir confiança ao lojista.

---

## Informações da Campanha

| Campo | Valor |
|-------|-------|
| **Loja** | Loja Bella Moda |
| **Segmento** | moda-calcados-acessorios |
| **Tom de voz** | profissional |
| **Produto** | Tênis Runner Pro |
| **Preço original** | R$ 299,90 |
| **Preço com desconto** | R$ 199,90 |
| **Texto do badge** | Oferta Imperdível |
| **Hook** |  |
| **CTA** |  |
| **Objetivo** |  |
| **Detalhes da campanha** |  |
| **Detalhes adicionais** |  |
| **Canal alvo** | Instagram |
| **Formato** | quadrado 1:1 |
| **Validade** |  |
| **Disponibilidade** |  |
| **Restrições sensíveis** |  |
| **Texto obrigatório na arte** |  |
| **Aviso ilustrativo** |  |

---

## Especificações Técnicas

- **Formato:** Quadrado 1:1 (Instagram feed)
- **Estilo:** Plano, limpo, profissional — agência de publicidade
- **Idioma:** Português brasileiro (PT-BR)
- **Paleta de cores da marca:** #E11D48

## Diretrizes de Composição

1. **Herói visual:** O produto Tênis Runner Pro deve ser o elemento central e mais proeminente da composição
2. **Identidade da loja:** O nome Loja Bella Moda deve aparecer como assinatura de marca — consistente com a identidade visual da loja
3. **Produto em destaque:** O nome Tênis Runner Pro deve ser exibido com destaque e legibilidade
4. **Precificação:** Exibir R$ 199,90 como preço principal. Se R$ 299,90 estiver disponível, exibir como preço riscado (indicação de desconto)
5. **Badge promocional:** Oferta Imperdível deve ser integrado de forma visualmente coerente
6. **Hook e CTA:** Incorporar  e  na peça de forma orgânica e persuasiva
- **Imagens de referência do produto:** Quando houver mais de uma imagem de produto, a arte deve incorporar visualmente mais de uma das imagens enviadas, mantendo a primeira como produto principal. As imagens adicionais devem aparecer como apoio comercial real da composição, especialmente em combos, variações ou linhas de produto. Não reduza as imagens adicionais a cores, ícones, etiquetas ou texto.
8. **Identidade da loja:** Assinar a campanha com o logotipo da loja fornecida como imagem de referência. Manter fidelidade ao arquivo fornecido. Considerar a direção visual do perfil de marca como contexto direcional, não obrigatório.



## Instruções Obrigatórias

- NÃO inventar preços, descontos, condições de pagamento, prazos de entrega, garantias ou informações de disponibilidade que não estejam explícitas no briefing
- NÃO utilizar informações de parcelamento, frete grátis ou condições comerciais não fornecidas
- Todo texto deve estar em português brasileiro
- A cor predominante deve seguir a paleta #E11D48
- Manter hierarquia visual clara: produto > preço > loja > call to action
- A peça deve ser plana (flat design), sem efeitos 3D, sombras complexas ou gradientes agressivos
- A imagem gerada deve ser publicável como arte final de campanha — sem rascunhos, sem placeholders, sem elementos de interface

---

## Perfil de Marca (Store Brand Director)



## Observações sobre o Segmento

Considerar o segmento moda-calcados-acessorios ao definir o estilo visual. A peça deve dialogar com o público-alvo natural do segmento, mantendo o tom profissional.

## Notas Adicionais




> **Sobre o campo "detalhes adicionais:** O conteúdo deste campo é repertório comercial para inspiração, não instrução obrigatória. Nem toda informação precisa aparecer na arte — algumas são mais adequadas para legenda ou texto complementar. Use seu julgamento para selecionar o que fortalece a peça visual.

**Restrições:** 
**Validade da oferta:** 
**Disponibilidade:** 
**Canal:** Instagram — formato quadrado 1:1

> **Validade com data:** se a validade informada contiver data, a arte DEVE exibir dia, mês e ano completos no formato dd/mm/aaaa conforme informado (ex.: "até 30/09/2026", "de 25/09/2026 até 30/09/2026"). NÃO trunque para dd/mm nem omita o ano. Não invente nem altere a data informada.

## Direção Criativa Contextual

Você é um diretor de marketing especializado em Moda, Calçados e Acessórios.

### Categoria do Produto

O produto anunciado é da categoria: **moda-calcados-acessorios**



### Orientação de Contexto Criativo

Valorize estilo e performance. Preço é oportunidade.

### Repertório Comercial

Considere os seguintes detalhes como argumentos visuais opcionais — use apenas se fizerem sentido para a composição:


### Instruções de Validação



### REGRAS CRÍTICAS DE FIDELIDADE

A imagem do produto é uma referência factual protegida.

Não redesenhe, reescreva, complete ou invente:
- textos da embalagem;
- selos;
- certificações;
- benefícios;
- volume;
- quantidade;
- variante;
- preço;
- logotipo.

Caso algum texto pequeno da embalagem não possa ser reproduzido com
fidelidade, preserve visualmente o produto sem tentar completar esse texto.

Você possui liberdade total para criar fundo, composição, iluminação,
hierarquia, formas, elementos decorativos e direção visual.

Quando houver aviso ilustrativo, exiba "" em texto mínimo, legível e discreto, separado dos demais textos, preferencialmente nas laterais da arte.

Se o campo "Texto obrigatório na arte" estiver preenchido (), inclua esse texto na arte de forma visível e legível, em tipografia mínima adequada para leitura em dispositivo móvel. Não o repita na legenda.
```

**DEPOIS (F45 pós-45-06b — montagem real):**

```text
# Diretrizes Criativas — Diretor de Marketing → Diretor de Arte

## Briefing: Campanha Visual para Instagram

Você é o Diretor de Marketing da Loja Bella Moda. Sua função é briefar o Diretor de Arte para criar uma campanha visual profissional para Instagram. A peça deve ser publicável, comercial e transmitir confiança ao lojista.

---

## Fatos da Campanha

- **Loja:** Loja Bella Moda
- **Segmento:** moda-calcados-acessorios
- **Tom de voz:** profissional
- **Produto:** Tênis Runner Pro
- **Preço com desconto:** R$ 199,90
- **Preço original:** R$ 299,90
- **Badge:** Oferta Imperdível
- **Canal alvo:** Instagram — **Formato:** quadrado 1:1

## Especificações Técnicas

- **Formato:** Quadrado 1:1 (Instagram feed)
- **Estilo:** Plano, limpo, profissional — agência de publicidade
- **Idioma:** Português brasileiro (PT-BR)
- **Paleta de cores da marca:** #E11D48

## Diretrizes de Composição

1. **Herói visual:** O produto Tênis Runner Pro deve ser o elemento central e mais proeminente da composição
2. **Identidade da loja:** A campanha deve ser assinada pela loja — ver a seção "Identidade da Loja"
3. **Produto em destaque:** O nome Tênis Runner Pro deve ser exibido com destaque e legibilidade
4. **Precificação:** Exibir o preço com desconto informado nos fatos como preço principal. Quando houver preço original informado, exibi-lo como preço riscado (indicação de desconto)
5. **Badge promocional:** Quando houver badge promocional informado nos fatos, incorporá-lo à arte. Sem badge informado, não inventar selo, benefício ou promessa promocional
6. **Hook e CTA:** Quando houver hook e CTA informados nos fatos, incorporá-los na peça de forma orgânica e persuasiva. O CTA não deve repetir literalmente o texto do badge — com badge informado, o CTA complementa a chamada para ação sem redundância

## Instruções Obrigatórias

- NÃO inventar preços, descontos, condições de pagamento, prazos de entrega, garantias ou informações de disponibilidade que não estejam explícitas no briefing
- NÃO utilizar informações de parcelamento, frete grátis ou condições comerciais não fornecidas
- Todo texto deve estar em português brasileiro
- A cor predominante deve seguir a paleta #E11D48
- Manter hierarquia visual clara: produto > preço > loja > call to action
- Composição limpa e profissional, sem efeitos gráficos artificiais ou gradientes agressivos — luz natural, profundidade e sombras do produto são permitidas
- A imagem gerada deve ser publicável como arte final de campanha — sem rascunhos, sem placeholders, sem elementos de interface



---

## Produto e Imagens de Referência

A imagem do produto é uma referência factual protegida.

Não redesenhe, reescreva, complete ou invente:
- textos da embalagem;
- selos;
- certificações;
- benefícios;
- volume;
- quantidade;
- variante;
- preço;
- logotipo.

Caso algum texto pequeno da embalagem não possa ser reproduzido com fidelidade, preserve visualmente o produto sem tentar completar esse texto.

Você possui liberdade total para criar fundo, composição, iluminação, hierarquia, formas, elementos decorativos e direção visual.

## Identidade da Loja

O nome Loja Bella Moda deve aparecer como assinatura de marca — consistente com a identidade visual da loja.
Assinar a campanha com o logotipo da loja fornecida como imagem de referência. Manter fidelidade ao arquivo fornecido. Considerar a direção visual do perfil de marca como contexto direcional, não obrigatório.
NÃO editar, alterar, redesenhar, distorcer nem inventar o logotipo fornecido — reproduzir o ativo enviado com fidelidade.
Posicionar o logotipo com liberdade na composição, mantendo respiro adequado e sem cortes nas bordas da arte.



## Direção Criativa Contextual

Você é um diretor de marketing especializado em Moda, Calçados e Acessórios.

### Categoria do Produto

O produto anunciado é da categoria: **moda-calcados-acessorios**

### Orientação de Contexto Criativo

Valorize estilo e performance. Preço é oportunidade.
```

**Resultado do avaliador (a):** ✅ **PASS** — preservação explícita confirmada no DEPOIS ("NÃO editar, alterar, redesenhar, distorcer nem inventar..."), que **não existia no ANTES**; assinatura de marca e hierarquia preservadas. Na base corrigida (45-08), o bloco de identidade consolida área segura/margem nas 4 bordas/posição secundária com concordância de gênero (logotipo masculino × assinatura visual feminino); artes reais aprovadas em `resultado.md` (assinatura visual da Mercearia da Quinze reproduzida com fidelidade e sem cortes). Riqueza/orientação preservada — nada amputado.

---

## Cenário (b) — Aviso ilustrativo habilitado (seção própria, lateral, discreto)

**Entrada (idêntica nos dois lados):** Loja Bella Moda, produto **Perfume Bella**, oferta R$ 249,90 (original R$ 349,90), **apenas aviso ilustrativo** marcado (texto canônico "Imagem meramente ilustrativa", sem texto livre — split kqo), 1 imagem primary, sem badge/hook/validade/detalhes.

**O que observar:**
- [ ] O aviso ilustrativo está em **seção própria** no DEPOIS, com a instrução única (mínimo, legível, discreto, separado dos demais textos, nas laterais)?
- [ ] Sem texto livre, o DEPOIS **não** monta seção de texto obrigatório (nem linha vazia)?
- [ ] A frase canônica aparece **1×** no DEPOIS (vs 2× no ANTES: tabela + cauda)?

**ANTES (pré-F45 — montagem real):**

```text
# Diretrizes Criativas — Diretor de Marketing → Diretor de Arte

## Briefing: Campanha Visual para Instagram

Você é o Diretor de Marketing da Loja Bella Moda. Sua função é briefar o Diretor de Arte para criar uma campanha visual profissional para Instagram. A peça deve ser publicável, comercial e transmitir confiança ao lojista.

---

## Informações da Campanha

| Campo | Valor |
|-------|-------|
| **Loja** | Loja Bella Moda |
| **Segmento** | moda-calcados-acessorios |
| **Tom de voz** | profissional |
| **Produto** | Perfume Bella |
| **Preço original** | R$ 349,90 |
| **Preço com desconto** | R$ 249,90 |
| **Texto do badge** |  |
| **Hook** |  |
| **CTA** |  |
| **Objetivo** |  |
| **Detalhes da campanha** |  |
| **Detalhes adicionais** |  |
| **Canal alvo** | Instagram |
| **Formato** | quadrado 1:1 |
| **Validade** |  |
| **Disponibilidade** |  |
| **Restrições sensíveis** |  |
| **Texto obrigatório na arte** |  |
| **Aviso ilustrativo** | Imagem meramente ilustrativa |

---

## Especificações Técnicas

- **Formato:** Quadrado 1:1 (Instagram feed)
- **Estilo:** Plano, limpo, profissional — agência de publicidade
- **Idioma:** Português brasileiro (PT-BR)
- **Paleta de cores da marca:** #E11D48

## Diretrizes de Composição

1. **Herói visual:** O produto Perfume Bella deve ser o elemento central e mais proeminente da composição
2. **Identidade da loja:** O nome Loja Bella Moda deve aparecer como assinatura de marca — consistente com a identidade visual da loja
3. **Produto em destaque:** O nome Perfume Bella deve ser exibido com destaque e legibilidade
4. **Precificação:** Exibir R$ 249,90 como preço principal. Se R$ 349,90 estiver disponível, exibir como preço riscado (indicação de desconto)
5. **Badge promocional:**  deve ser integrado de forma visualmente coerente
6. **Hook e CTA:** Incorporar  e  na peça de forma orgânica e persuasiva
- **Imagens de referência do produto:** Quando houver mais de uma imagem de produto, a arte deve incorporar visualmente mais de uma das imagens enviadas, mantendo a primeira como produto principal. As imagens adicionais devem aparecer como apoio comercial real da composição, especialmente em combos, variações ou linhas de produto. Não reduza as imagens adicionais a cores, ícones, etiquetas ou texto.
8. **Identidade da loja:** Não colocar logotipo. Não gerar assinatura visual. Considerar a direção visual do perfil de marca como contexto direcional, não obrigatório.



## Instruções Obrigatórias

- NÃO inventar preços, descontos, condições de pagamento, prazos de entrega, garantias ou informações de disponibilidade que não estejam explícitas no briefing
- NÃO utilizar informações de parcelamento, frete grátis ou condições comerciais não fornecidas
- Todo texto deve estar em português brasileiro
- A cor predominante deve seguir a paleta #E11D48
- Manter hierarquia visual clara: produto > preço > loja > call to action
- A peça deve ser plana (flat design), sem efeitos 3D, sombras complexas ou gradientes agressivos
- A imagem gerada deve ser publicável como arte final de campanha — sem rascunhos, sem placeholders, sem elementos de interface

---

## Perfil de Marca (Store Brand Director)



## Observações sobre o Segmento

Considerar o segmento moda-calcados-acessorios ao definir o estilo visual. A peça deve dialogar com o público-alvo natural do segmento, mantendo o tom profissional.

## Notas Adicionais




> **Sobre o campo "detalhes adicionais:** O conteúdo deste campo é repertório comercial para inspiração, não instrução obrigatória. Nem toda informação precisa aparecer na arte — algumas são mais adequadas para legenda ou texto complementar. Use seu julgamento para selecionar o que fortalece a peça visual.

**Restrições:** 
**Validade da oferta:** 
**Disponibilidade:** 
**Canal:** Instagram — formato quadrado 1:1

> **Validade com data:** se a validade informada contiver data, a arte DEVE exibir dia, mês e ano completos no formato dd/mm/aaaa conforme informado (ex.: "até 30/09/2026", "de 25/09/2026 até 30/09/2026"). NÃO trunque para dd/mm nem omita o ano. Não invente nem altere a data informada.

## Direção Criativa Contextual

Você é um diretor de marketing especializado em Moda, Calçados e Acessórios.

### Categoria do Produto

O produto anunciado é da categoria: **moda-calcados-acessorios**



### Orientação de Contexto Criativo

Valorize estilo e performance. Preço é oportunidade.

### Repertório Comercial

Considere os seguintes detalhes como argumentos visuais opcionais — use apenas se fizerem sentido para a composição:


### Instruções de Validação



### REGRAS CRÍTICAS DE FIDELIDADE

A imagem do produto é uma referência factual protegida.

Não redesenhe, reescreva, complete ou invente:
- textos da embalagem;
- selos;
- certificações;
- benefícios;
- volume;
- quantidade;
- variante;
- preço;
- logotipo.

Caso algum texto pequeno da embalagem não possa ser reproduzido com
fidelidade, preserve visualmente o produto sem tentar completar esse texto.

Você possui liberdade total para criar fundo, composição, iluminação,
hierarquia, formas, elementos decorativos e direção visual.

Quando houver aviso ilustrativo, exiba "Imagem meramente ilustrativa" em texto mínimo, legível e discreto, separado dos demais textos, preferencialmente nas laterais da arte.

Se o campo "Texto obrigatório na arte" estiver preenchido (), inclua esse texto na arte de forma visível e legível, em tipografia mínima adequada para leitura em dispositivo móvel. Não o repita na legenda.
```

**DEPOIS (F45 pós-45-06b — montagem real):**

```text
# Diretrizes Criativas — Diretor de Marketing → Diretor de Arte

## Briefing: Campanha Visual para Instagram

Você é o Diretor de Marketing da Loja Bella Moda. Sua função é briefar o Diretor de Arte para criar uma campanha visual profissional para Instagram. A peça deve ser publicável, comercial e transmitir confiança ao lojista.

---

## Fatos da Campanha

- **Loja:** Loja Bella Moda
- **Segmento:** moda-calcados-acessorios
- **Tom de voz:** profissional
- **Produto:** Perfume Bella
- **Preço com desconto:** R$ 249,90
- **Preço original:** R$ 349,90
- **Canal alvo:** Instagram — **Formato:** quadrado 1:1

## Especificações Técnicas

- **Formato:** Quadrado 1:1 (Instagram feed)
- **Estilo:** Plano, limpo, profissional — agência de publicidade
- **Idioma:** Português brasileiro (PT-BR)
- **Paleta de cores da marca:** #E11D48

## Diretrizes de Composição

1. **Herói visual:** O produto Perfume Bella deve ser o elemento central e mais proeminente da composição
2. **Identidade da loja:** A campanha deve ser assinada pela loja — ver a seção "Identidade da Loja"
3. **Produto em destaque:** O nome Perfume Bella deve ser exibido com destaque e legibilidade
4. **Precificação:** Exibir o preço com desconto informado nos fatos como preço principal. Quando houver preço original informado, exibi-lo como preço riscado (indicação de desconto)
5. **Badge promocional:** Quando houver badge promocional informado nos fatos, incorporá-lo à arte. Sem badge informado, não inventar selo, benefício ou promessa promocional
6. **Hook e CTA:** Quando houver hook e CTA informados nos fatos, incorporá-los na peça de forma orgânica e persuasiva. O CTA não deve repetir literalmente o texto do badge — com badge informado, o CTA complementa a chamada para ação sem redundância

## Instruções Obrigatórias

- NÃO inventar preços, descontos, condições de pagamento, prazos de entrega, garantias ou informações de disponibilidade que não estejam explícitas no briefing
- NÃO utilizar informações de parcelamento, frete grátis ou condições comerciais não fornecidas
- Todo texto deve estar em português brasileiro
- A cor predominante deve seguir a paleta #E11D48
- Manter hierarquia visual clara: produto > preço > loja > call to action
- Composição limpa e profissional, sem efeitos gráficos artificiais ou gradientes agressivos — luz natural, profundidade e sombras do produto são permitidas
- A imagem gerada deve ser publicável como arte final de campanha — sem rascunhos, sem placeholders, sem elementos de interface



---

## Produto e Imagens de Referência

A imagem do produto é uma referência factual protegida.

Não redesenhe, reescreva, complete ou invente:
- textos da embalagem;
- selos;
- certificações;
- benefícios;
- volume;
- quantidade;
- variante;
- preço;
- logotipo.

Caso algum texto pequeno da embalagem não possa ser reproduzido com fidelidade, preserve visualmente o produto sem tentar completar esse texto.

Você possui liberdade total para criar fundo, composição, iluminação, hierarquia, formas, elementos decorativos e direção visual.

## Identidade da Loja

O nome Loja Bella Moda deve aparecer como assinatura de marca — consistente com a identidade visual da loja.
Não colocar logotipo. Não gerar assinatura visual. Considerar a direção visual do perfil de marca como contexto direcional, não obrigatório.
Posicionar o nome da loja com liberdade na composição, mantendo respiro adequado e sem cortes nas bordas da arte.



## Direção Criativa Contextual

Você é um diretor de marketing especializado em Moda, Calçados e Acessórios.

### Categoria do Produto

O produto anunciado é da categoria: **moda-calcados-acessorios**

### Orientação de Contexto Criativo

Valorize estilo e performance. Preço é oportunidade.



## Aviso Ilustrativo

Quando houver aviso ilustrativo, exiba-o em texto mínimo, legível e discreto, separado dos demais textos, preferencialmente nas laterais da arte.

Texto do aviso: "Imagem meramente ilustrativa"
```

**Resultado do avaliador (b):** ✅ **PASS** — no DEPOIS o aviso ilustrativo aparece **1×** em **seção própria** (`## Aviso Ilustrativo`) com a instrução única (mínimo, legível, discreto, separado dos demais textos, laterais), vs 2× no ANTES (tabela + cauda); sem texto livre, **nenhuma** seção de texto obrigatório é montada. Evidência real: arte de offer aprovada em `resultado.md` exibe "Imagem meramente ilustrativa" discreta e separada; 45-08 manteve o split canônico no Revisor (aviso ≠ parte de outro texto legal). Riqueza/orientação preservada.

---

## Cenário (c) — Texto obrigatório livre do lojista (seção própria, legível, sem legenda)

**Entrada (idêntica nos dois lados):** Loja Bella Moda, produto **Kit 2 Camisetas Dry Fit**, oferta R$ 99,90 (original R$ 159,90), **texto obrigatório livre** do lojista ("Promoção válida enquanto durarem os estoques. Não acumulativo com outras ofertas." — sem aviso), 1 imagem primary.

**O que observar:**
- [ ] O texto livre está em **seção própria** no DEPOIS com a instrução de respeitá-lo visível/legível e **sem repeti-lo em legenda**?
- [ ] O DEPOIS trata o texto como conteúdo obrigatório (não como "repertório opcional")?
- [ ] Sem aviso, o DEPOIS **não** monta seção de aviso vazia?

**ANTES (pré-F45 — montagem real):**

```text
# Diretrizes Criativas — Diretor de Marketing → Diretor de Arte

## Briefing: Campanha Visual para Instagram

Você é o Diretor de Marketing da Loja Bella Moda. Sua função é briefar o Diretor de Arte para criar uma campanha visual profissional para Instagram. A peça deve ser publicável, comercial e transmitir confiança ao lojista.

---

## Informações da Campanha

| Campo | Valor |
|-------|-------|
| **Loja** | Loja Bella Moda |
| **Segmento** | moda-calcados-acessorios |
| **Tom de voz** | profissional |
| **Produto** | Kit 2 Camisetas Dry Fit |
| **Preço original** | R$ 159,90 |
| **Preço com desconto** | R$ 99,90 |
| **Texto do badge** |  |
| **Hook** |  |
| **CTA** |  |
| **Objetivo** |  |
| **Detalhes da campanha** |  |
| **Detalhes adicionais** |  |
| **Canal alvo** | Instagram |
| **Formato** | quadrado 1:1 |
| **Validade** |  |
| **Disponibilidade** |  |
| **Restrições sensíveis** |  |
| **Texto obrigatório na arte** | Promoção válida enquanto durarem os estoques. Não acumulativo com outras ofertas. |
| **Aviso ilustrativo** |  |

---

## Especificações Técnicas

- **Formato:** Quadrado 1:1 (Instagram feed)
- **Estilo:** Plano, limpo, profissional — agência de publicidade
- **Idioma:** Português brasileiro (PT-BR)
- **Paleta de cores da marca:** #E11D48

## Diretrizes de Composição

1. **Herói visual:** O produto Kit 2 Camisetas Dry Fit deve ser o elemento central e mais proeminente da composição
2. **Identidade da loja:** O nome Loja Bella Moda deve aparecer como assinatura de marca — consistente com a identidade visual da loja
3. **Produto em destaque:** O nome Kit 2 Camisetas Dry Fit deve ser exibido com destaque e legibilidade
4. **Precificação:** Exibir R$ 99,90 como preço principal. Se R$ 159,90 estiver disponível, exibir como preço riscado (indicação de desconto)
5. **Badge promocional:**  deve ser integrado de forma visualmente coerente
6. **Hook e CTA:** Incorporar  e  na peça de forma orgânica e persuasiva
- **Imagens de referência do produto:** Quando houver mais de uma imagem de produto, a arte deve incorporar visualmente mais de uma das imagens enviadas, mantendo a primeira como produto principal. As imagens adicionais devem aparecer como apoio comercial real da composição, especialmente em combos, variações ou linhas de produto. Não reduza as imagens adicionais a cores, ícones, etiquetas ou texto.
8. **Identidade da loja:** Não colocar logotipo. Não gerar assinatura visual. Considerar a direção visual do perfil de marca como contexto direcional, não obrigatório.



## Instruções Obrigatórias

- NÃO inventar preços, descontos, condições de pagamento, prazos de entrega, garantias ou informações de disponibilidade que não estejam explícitas no briefing
- NÃO utilizar informações de parcelamento, frete grátis ou condições comerciais não fornecidas
- Todo texto deve estar em português brasileiro
- A cor predominante deve seguir a paleta #E11D48
- Manter hierarquia visual clara: produto > preço > loja > call to action
- A peça deve ser plana (flat design), sem efeitos 3D, sombras complexas ou gradientes agressivos
- A imagem gerada deve ser publicável como arte final de campanha — sem rascunhos, sem placeholders, sem elementos de interface

---

## Perfil de Marca (Store Brand Director)



## Observações sobre o Segmento

Considerar o segmento moda-calcados-acessorios ao definir o estilo visual. A peça deve dialogar com o público-alvo natural do segmento, mantendo o tom profissional.

## Notas Adicionais




> **Sobre o campo "detalhes adicionais:** O conteúdo deste campo é repertório comercial para inspiração, não instrução obrigatória. Nem toda informação precisa aparecer na arte — algumas são mais adequadas para legenda ou texto complementar. Use seu julgamento para selecionar o que fortalece a peça visual.

**Restrições:** 
**Validade da oferta:** 
**Disponibilidade:** 
**Canal:** Instagram — formato quadrado 1:1

> **Validade com data:** se a validade informada contiver data, a arte DEVE exibir dia, mês e ano completos no formato dd/mm/aaaa conforme informado (ex.: "até 30/09/2026", "de 25/09/2026 até 30/09/2026"). NÃO trunque para dd/mm nem omita o ano. Não invente nem altere a data informada.

## Direção Criativa Contextual

Você é um diretor de marketing especializado em Moda, Calçados e Acessórios.

### Categoria do Produto

O produto anunciado é da categoria: **moda-calcados-acessorios**



### Orientação de Contexto Criativo

Valorize estilo e performance. Preço é oportunidade.

### Repertório Comercial

Considere os seguintes detalhes como argumentos visuais opcionais — use apenas se fizerem sentido para a composição:


### Instruções de Validação



### REGRAS CRÍTICAS DE FIDELIDADE

A imagem do produto é uma referência factual protegida.

Não redesenhe, reescreva, complete ou invente:
- textos da embalagem;
- selos;
- certificações;
- benefícios;
- volume;
- quantidade;
- variante;
- preço;
- logotipo.

Caso algum texto pequeno da embalagem não possa ser reproduzido com
fidelidade, preserve visualmente o produto sem tentar completar esse texto.

Você possui liberdade total para criar fundo, composição, iluminação,
hierarquia, formas, elementos decorativos e direção visual.

Quando houver aviso ilustrativo, exiba "" em texto mínimo, legível e discreto, separado dos demais textos, preferencialmente nas laterais da arte.

Se o campo "Texto obrigatório na arte" estiver preenchido (Promoção válida enquanto durarem os estoques. Não acumulativo com outras ofertas.), inclua esse texto na arte de forma visível e legível, em tipografia mínima adequada para leitura em dispositivo móvel. Não o repita na legenda.
```

**DEPOIS (F45 pós-45-06b — montagem real):**

```text
# Diretrizes Criativas — Diretor de Marketing → Diretor de Arte

## Briefing: Campanha Visual para Instagram

Você é o Diretor de Marketing da Loja Bella Moda. Sua função é briefar o Diretor de Arte para criar uma campanha visual profissional para Instagram. A peça deve ser publicável, comercial e transmitir confiança ao lojista.

---

## Fatos da Campanha

- **Loja:** Loja Bella Moda
- **Segmento:** moda-calcados-acessorios
- **Tom de voz:** profissional
- **Produto:** Kit 2 Camisetas Dry Fit
- **Preço com desconto:** R$ 99,90
- **Preço original:** R$ 159,90
- **Canal alvo:** Instagram — **Formato:** quadrado 1:1

## Especificações Técnicas

- **Formato:** Quadrado 1:1 (Instagram feed)
- **Estilo:** Plano, limpo, profissional — agência de publicidade
- **Idioma:** Português brasileiro (PT-BR)
- **Paleta de cores da marca:** #E11D48

## Diretrizes de Composição

1. **Herói visual:** O produto Kit 2 Camisetas Dry Fit deve ser o elemento central e mais proeminente da composição
2. **Identidade da loja:** A campanha deve ser assinada pela loja — ver a seção "Identidade da Loja"
3. **Produto em destaque:** O nome Kit 2 Camisetas Dry Fit deve ser exibido com destaque e legibilidade
4. **Precificação:** Exibir o preço com desconto informado nos fatos como preço principal. Quando houver preço original informado, exibi-lo como preço riscado (indicação de desconto)
5. **Badge promocional:** Quando houver badge promocional informado nos fatos, incorporá-lo à arte. Sem badge informado, não inventar selo, benefício ou promessa promocional
6. **Hook e CTA:** Quando houver hook e CTA informados nos fatos, incorporá-los na peça de forma orgânica e persuasiva. O CTA não deve repetir literalmente o texto do badge — com badge informado, o CTA complementa a chamada para ação sem redundância

## Instruções Obrigatórias

- NÃO inventar preços, descontos, condições de pagamento, prazos de entrega, garantias ou informações de disponibilidade que não estejam explícitas no briefing
- NÃO utilizar informações de parcelamento, frete grátis ou condições comerciais não fornecidas
- Todo texto deve estar em português brasileiro
- A cor predominante deve seguir a paleta #E11D48
- Manter hierarquia visual clara: produto > preço > loja > call to action
- Composição limpa e profissional, sem efeitos gráficos artificiais ou gradientes agressivos — luz natural, profundidade e sombras do produto são permitidas
- A imagem gerada deve ser publicável como arte final de campanha — sem rascunhos, sem placeholders, sem elementos de interface



---

## Produto e Imagens de Referência

A imagem do produto é uma referência factual protegida.

Não redesenhe, reescreva, complete ou invente:
- textos da embalagem;
- selos;
- certificações;
- benefícios;
- volume;
- quantidade;
- variante;
- preço;
- logotipo.

Caso algum texto pequeno da embalagem não possa ser reproduzido com fidelidade, preserve visualmente o produto sem tentar completar esse texto.

Você possui liberdade total para criar fundo, composição, iluminação, hierarquia, formas, elementos decorativos e direção visual.

## Identidade da Loja

O nome Loja Bella Moda deve aparecer como assinatura de marca — consistente com a identidade visual da loja.
Não colocar logotipo. Não gerar assinatura visual. Considerar a direção visual do perfil de marca como contexto direcional, não obrigatório.
Posicionar o nome da loja com liberdade na composição, mantendo respiro adequado e sem cortes nas bordas da arte.



## Direção Criativa Contextual

Você é um diretor de marketing especializado em Moda, Calçados e Acessórios.

### Categoria do Produto

O produto anunciado é da categoria: **moda-calcados-acessorios**

### Orientação de Contexto Criativo

Valorize estilo e performance. Preço é oportunidade.

## Texto Obrigatório na Arte

O texto abaixo foi informado pelo lojista para ser incluído na arte. Inclua esse texto na arte de forma visível e legível, em tipografia mínima adequada para leitura em dispositivo móvel. Não o repita na legenda.

"Promoção válida enquanto durarem os estoques. Não acumulativo com outras ofertas."
```

**Resultado do avaliador (c):** ✅ **PASS** — no DEPOIS o texto livre do lojista está em **seção própria** (`## Texto Obrigatório na Arte`) com instrução de respeitá-lo visível/legível e **sem repeti-lo em legenda**; 1× (vs 2× no ANTES: tabela + cauda); sem aviso, nenhuma seção de aviso vazia é montada. Evidência real: arte de offer aprovada em `resultado.md` inclui "Venda proibida para menores de 18 anos" visível e legível (tipografia mínima), sem legenda. Texto tratado como conteúdo obrigatório (não "repertório opcional"). Riqueza/orientação preservada.

---

## Cenário (d) — Oferta com validade (ocorrência única nos fatos)

**Entrada (idêntica nos dois lados):** Loja Bella Moda, produto **Vestido Floral Verão**, oferta R$ 159,90 (original R$ 219,90), badge "Oferta por tempo limitado", **validade** "de 25/09/2026 até 30/09/2026", 1 imagem primary, sem texto obrigatório/aviso.

**O que observar:**
- [ ] A validade aparece em **ocorrência única** (fatos) no DEPOIS — e não mais em tabela + `Notas Adicionais` + `Repertório Comercial`?
- [ ] A regra editorial dd/mm/aaaa (data completa, não truncar) continua presente no DEPOIS?
- [ ] O DEPOIS não perdeu o tom/urgência da oferta (badge "por tempo limitado", preço com desconto + original riscado)?

**ANTES (pré-F45 — montagem real):**

```text
# Diretrizes Criativas — Diretor de Marketing → Diretor de Arte

## Briefing: Campanha Visual para Instagram

Você é o Diretor de Marketing da Loja Bella Moda. Sua função é briefar o Diretor de Arte para criar uma campanha visual profissional para Instagram. A peça deve ser publicável, comercial e transmitir confiança ao lojista.

---

## Informações da Campanha

| Campo | Valor |
|-------|-------|
| **Loja** | Loja Bella Moda |
| **Segmento** | moda-calcados-acessorios |
| **Tom de voz** | profissional |
| **Produto** | Vestido Floral Verão |
| **Preço original** | R$ 219,90 |
| **Preço com desconto** | R$ 159,90 |
| **Texto do badge** | Oferta por tempo limitado |
| **Hook** |  |
| **CTA** |  |
| **Objetivo** |  |
| **Detalhes da campanha** |  |
| **Detalhes adicionais** |  |
| **Canal alvo** | Instagram |
| **Formato** | quadrado 1:1 |
| **Validade** | de 25/09/2026 até 30/09/2026 |
| **Disponibilidade** |  |
| **Restrições sensíveis** |  |
| **Texto obrigatório na arte** |  |
| **Aviso ilustrativo** |  |

---

## Especificações Técnicas

- **Formato:** Quadrado 1:1 (Instagram feed)
- **Estilo:** Plano, limpo, profissional — agência de publicidade
- **Idioma:** Português brasileiro (PT-BR)
- **Paleta de cores da marca:** #E11D48

## Diretrizes de Composição

1. **Herói visual:** O produto Vestido Floral Verão deve ser o elemento central e mais proeminente da composição
2. **Identidade da loja:** O nome Loja Bella Moda deve aparecer como assinatura de marca — consistente com a identidade visual da loja
3. **Produto em destaque:** O nome Vestido Floral Verão deve ser exibido com destaque e legibilidade
4. **Precificação:** Exibir R$ 159,90 como preço principal. Se R$ 219,90 estiver disponível, exibir como preço riscado (indicação de desconto)
5. **Badge promocional:** Oferta por tempo limitado deve ser integrado de forma visualmente coerente
6. **Hook e CTA:** Incorporar  e  na peça de forma orgânica e persuasiva
- **Imagens de referência do produto:** Quando houver mais de uma imagem de produto, a arte deve incorporar visualmente mais de uma das imagens enviadas, mantendo a primeira como produto principal. As imagens adicionais devem aparecer como apoio comercial real da composição, especialmente em combos, variações ou linhas de produto. Não reduza as imagens adicionais a cores, ícones, etiquetas ou texto.
8. **Identidade da loja:** Não colocar logotipo. Não gerar assinatura visual. Considerar a direção visual do perfil de marca como contexto direcional, não obrigatório.



## Instruções Obrigatórias

- NÃO inventar preços, descontos, condições de pagamento, prazos de entrega, garantias ou informações de disponibilidade que não estejam explícitas no briefing
- NÃO utilizar informações de parcelamento, frete grátis ou condições comerciais não fornecidas
- Todo texto deve estar em português brasileiro
- A cor predominante deve seguir a paleta #E11D48
- Manter hierarquia visual clara: produto > preço > loja > call to action
- A peça deve ser plana (flat design), sem efeitos 3D, sombras complexas ou gradientes agressivos
- A imagem gerada deve ser publicável como arte final de campanha — sem rascunhos, sem placeholders, sem elementos de interface

---

## Perfil de Marca (Store Brand Director)



## Observações sobre o Segmento

Considerar o segmento moda-calcados-acessorios ao definir o estilo visual. A peça deve dialogar com o público-alvo natural do segmento, mantendo o tom profissional.

## Notas Adicionais




> **Sobre o campo "detalhes adicionais:** O conteúdo deste campo é repertório comercial para inspiração, não instrução obrigatória. Nem toda informação precisa aparecer na arte — algumas são mais adequadas para legenda ou texto complementar. Use seu julgamento para selecionar o que fortalece a peça visual.

**Restrições:** 
**Validade da oferta:** de 25/09/2026 até 30/09/2026
**Disponibilidade:** 
**Canal:** Instagram — formato quadrado 1:1

> **Validade com data:** se a validade informada contiver data, a arte DEVE exibir dia, mês e ano completos no formato dd/mm/aaaa conforme informado (ex.: "até 30/09/2026", "de 25/09/2026 até 30/09/2026"). NÃO trunque para dd/mm nem omita o ano. Não invente nem altere a data informada.

## Direção Criativa Contextual

Você é um diretor de marketing especializado em Moda, Calçados e Acessórios.

### Categoria do Produto

O produto anunciado é da categoria: **moda-calcados-acessorios**



### Orientação de Contexto Criativo

Valorize estilo e performance. Preço é oportunidade.

### Repertório Comercial

Considere os seguintes detalhes como argumentos visuais opcionais — use apenas se fizerem sentido para a composição:
- Oferta válida: de 25/09/2026 até 30/09/2026

### Instruções de Validação



### REGRAS CRÍTICAS DE FIDELIDADE

A imagem do produto é uma referência factual protegida.

Não redesenhe, reescreva, complete ou invente:
- textos da embalagem;
- selos;
- certificações;
- benefícios;
- volume;
- quantidade;
- variante;
- preço;
- logotipo.

Caso algum texto pequeno da embalagem não possa ser reproduzido com
fidelidade, preserve visualmente o produto sem tentar completar esse texto.

Você possui liberdade total para criar fundo, composição, iluminação,
hierarquia, formas, elementos decorativos e direção visual.

Quando houver aviso ilustrativo, exiba "" em texto mínimo, legível e discreto, separado dos demais textos, preferencialmente nas laterais da arte.

Se o campo "Texto obrigatório na arte" estiver preenchido (), inclua esse texto na arte de forma visível e legível, em tipografia mínima adequada para leitura em dispositivo móvel. Não o repita na legenda.
```

**DEPOIS (F45 pós-45-06b — montagem real):**

```text
# Diretrizes Criativas — Diretor de Marketing → Diretor de Arte

## Briefing: Campanha Visual para Instagram

Você é o Diretor de Marketing da Loja Bella Moda. Sua função é briefar o Diretor de Arte para criar uma campanha visual profissional para Instagram. A peça deve ser publicável, comercial e transmitir confiança ao lojista.

---

## Fatos da Campanha

- **Loja:** Loja Bella Moda
- **Segmento:** moda-calcados-acessorios
- **Tom de voz:** profissional
- **Produto:** Vestido Floral Verão
- **Preço com desconto:** R$ 159,90
- **Preço original:** R$ 219,90
- **Badge:** Oferta por tempo limitado
- **Canal alvo:** Instagram — **Formato:** quadrado 1:1
- **Validade da oferta:** de 25/09/2026 até 30/09/2026

> **Validade com data:** se a validade informada contiver data, a arte DEVE exibir dia, mês e ano completos no formato dd/mm/aaaa conforme informado (ex.: "até 30/09/2026", "de 25/09/2026 até 30/09/2026"). NÃO trunque para dd/mm nem omita o ano. Não invente nem altere a data informada.

## Especificações Técnicas

- **Formato:** Quadrado 1:1 (Instagram feed)
- **Estilo:** Plano, limpo, profissional — agência de publicidade
- **Idioma:** Português brasileiro (PT-BR)
- **Paleta de cores da marca:** #E11D48

## Diretrizes de Composição

1. **Herói visual:** O produto Vestido Floral Verão deve ser o elemento central e mais proeminente da composição
2. **Identidade da loja:** A campanha deve ser assinada pela loja — ver a seção "Identidade da Loja"
3. **Produto em destaque:** O nome Vestido Floral Verão deve ser exibido com destaque e legibilidade
4. **Precificação:** Exibir o preço com desconto informado nos fatos como preço principal. Quando houver preço original informado, exibi-lo como preço riscado (indicação de desconto)
5. **Badge promocional:** Quando houver badge promocional informado nos fatos, incorporá-lo à arte. Sem badge informado, não inventar selo, benefício ou promessa promocional
6. **Hook e CTA:** Quando houver hook e CTA informados nos fatos, incorporá-los na peça de forma orgânica e persuasiva. O CTA não deve repetir literalmente o texto do badge — com badge informado, o CTA complementa a chamada para ação sem redundância

## Instruções Obrigatórias

- NÃO inventar preços, descontos, condições de pagamento, prazos de entrega, garantias ou informações de disponibilidade que não estejam explícitas no briefing
- NÃO utilizar informações de parcelamento, frete grátis ou condições comerciais não fornecidas
- Todo texto deve estar em português brasileiro
- A cor predominante deve seguir a paleta #E11D48
- Manter hierarquia visual clara: produto > preço > loja > call to action
- Composição limpa e profissional, sem efeitos gráficos artificiais ou gradientes agressivos — luz natural, profundidade e sombras do produto são permitidas
- A imagem gerada deve ser publicável como arte final de campanha — sem rascunhos, sem placeholders, sem elementos de interface



---

## Produto e Imagens de Referência

A imagem do produto é uma referência factual protegida.

Não redesenhe, reescreva, complete ou invente:
- textos da embalagem;
- selos;
- certificações;
- benefícios;
- volume;
- quantidade;
- variante;
- preço;
- logotipo.

Caso algum texto pequeno da embalagem não possa ser reproduzido com fidelidade, preserve visualmente o produto sem tentar completar esse texto.

Você possui liberdade total para criar fundo, composição, iluminação, hierarquia, formas, elementos decorativos e direção visual.

## Identidade da Loja

O nome Loja Bella Moda deve aparecer como assinatura de marca — consistente com a identidade visual da loja.
Não colocar logotipo. Não gerar assinatura visual. Considerar a direção visual do perfil de marca como contexto direcional, não obrigatório.
Posicionar o nome da loja com liberdade na composição, mantendo respiro adequado e sem cortes nas bordas da arte.



## Direção Criativa Contextual

Você é um diretor de marketing especializado em Moda, Calçados e Acessórios.

### Categoria do Produto

O produto anunciado é da categoria: **moda-calcados-acessorios**

### Orientação de Contexto Criativo

Valorize estilo e performance. Preço é oportunidade.
```

**Resultado do avaliador (d):** ✅ **PASS** — no DEPOIS a validade aparece em **ocorrência única** no bloco de fatos (com a regra editorial dd/mm/aaaa preservada ao lado); no ANTES ela aparecia 4× (tabela + `Notas Adicionais` + `Repertório Comercial` + regra). Evidência real: arte de offer aprovada em `resultado.md` (validade "de 05/09/2026 até 14/09/2026" exibida com data completa). Tom/urgência da oferta (badge, preço com desconto + original riscado) preservado. Riqueza/orientação preservada.

---

## Cenário (e) — Multi-imagem primary × auxiliares (hierarquia; spotlight com preserveImageContext)

**Entrada (idêntica nos dois lados):** Loja Bella Moda, produto **Vestido Floral Verão**, spotlight com preço único R$ 159,90 (sem DE/POR), `preserveImageContext: true`, **1 primary + 2 auxiliares**, identidade **assinatura visual com ativo**, sem validade/texto obrigatório/aviso.

**O que observar:**
- [ ] A hierarquia **primary = referência factual forte; auxiliares = apoio sem competir** (e "não reduzir a cores/ícones/etiquetas/texto") está no DEPOIS?
- [ ] Com `preserveImageContext`, a instrução **não recortar/isolamento proibido** está presente no DEPOIS (bloco de produto)?
- [ ] A identidade (assinatura visual) tem **preservação explícita** no DEPOIS?
- [ ] O tom spotlight (destaque **sem urgência**, sem DE/POR, sem validade) foi preservado?

**ANTES (pré-F45 — montagem real):**

```text
# Diretrizes Criativas — Diretor de Marketing → Diretor de Arte

## Briefing: Campanha Visual para Instagram — Destaque

Você é o Diretor de Marketing da Loja Bella Moda. Sua função é briefar o Diretor de Arte para criar uma campanha visual profissional para Instagram. O produto deve ser apresentado como destaque ou novidade, sem urgência promocional.

---

## Informações da Campanha

| Campo | Valor |
|-------|-------|
| **Loja** | Loja Bella Moda |
| **Segmento** | moda-calcados-acessorios |
| **Tom de voz** | profissional |
| **Produto** | Vestido Floral Verão |
| **Preço** | R$ 159,90 |
| **Texto do badge** |  |
| **Hook** |  |
| **CTA** |  |
| **Objetivo** |  |
| **Detalhes da campanha** |  |
| **Detalhes adicionais** |  |
| **Canal alvo** | Instagram |
| **Formato** | quadrado 1:1 |
| **Disponibilidade** |  |
| **Restrições sensíveis** |  |
| **Texto obrigatório na arte** |  |
| **Aviso ilustrativo** |  |

---

## Especificações Técnicas

- **Formato:** Quadrado 1:1 (Instagram feed)
- **Estilo:** Plano, limpo, profissional — agência de publicidade
- **Idioma:** Português brasileiro (PT-BR)
- **Paleta de cores da marca:** #E11D48

## Diretrizes de Composição

1. **Herói visual:** O produto Vestido Floral Verão deve ser o elemento central e mais proeminente da composição
2. **Identidade da loja:** O nome Loja Bella Moda deve aparecer como assinatura de marca — consistente com a identidade visual da loja
3. **Produto em destaque:** O nome Vestido Floral Verão deve ser exibido com destaque e legibilidade
4. **Precificação:** Exibir R$ 159,90 como preço principal. Se disponível, exibir como valor de destaque. NÃO usar formato DE/POR ou indicar desconto.
5. **Badge promocional:**  pode ser integrado se presente. É opcional.
6. **Hook e CTA:** Incorporar  e  na peça de forma orgânica e persuasiva
- **Imagens de referência do produto:** Quando houver mais de uma imagem de produto, a arte deve incorporar visualmente mais de uma das imagens enviadas, mantendo a primeira como produto principal. As imagens adicionais devem aparecer como apoio comercial real da composição, especialmente em combos, variações ou linhas de produto. Não reduza as imagens adicionais a cores, ícones, etiquetas ou texto.
8. **Identidade da loja:** Assinar a campanha com a assinatura visual da loja fornecida como imagem de referência. Manter fidelidade ao arquivo fornecido. Não adicionar logotipo. Considerar a direção visual do perfil de marca como contexto direcional, não obrigatório.
9. **Tom de descoberta e destaque:** O produto é apresentado como novidade ou vitrine — sem urgência

NÃO recortar o produto. Preservar o contexto original da imagem. Adaptar a composição ao redor do produto sem isolá-lo. Legibilidade continua obrigatória.

## Instruções Obrigatórias

- NÃO inventar preços, descontos, condições de pagamento, prazos de entrega, garantias ou informações de disponibilidade que não estejam explícitas no briefing
- NÃO criar senso de urgência ou escassez (sem "corra", "últimas unidades", "aproveite")
- Todo texto deve estar em português brasileiro
- A cor predominante deve seguir a paleta #E11D48
- Manter hierarquia visual clara: produto > preço > loja > call to action
- A peça deve ser plana (flat design), sem efeitos 3D, sombras complexas ou gradientes agressivos
- A imagem gerada deve ser publicável como arte final de campanha — sem rascunhos, sem placeholders, sem elementos de interface

---

## Perfil de Marca (Store Brand Director)



## Observações sobre o Segmento

Considerar o segmento moda-calcados-acessorios ao definir o estilo visual. A peça deve dialogar com o público-alvo natural do segmento, mantendo o tom profissional.

## Notas Adicionais




> **Sobre o campo "detalhes adicionais:** O conteúdo deste campo é repertório comercial para inspiração, não instrução obrigatória. Nem toda informação precisa aparecer na arte — algumas são mais adequadas para legenda ou texto complementar. Use seu julgamento para selecionar o que fortalece a peça visual.

**Restrições:** 
**Disponibilidade:** 
**Canal:** Instagram — formato quadrado 1:1

## Direção Criativa Contextual

Você é um diretor de marketing especializado em Moda, Calçados e Acessórios.

### Categoria do Produto

O produto anunciado é da categoria: **moda-calcados-acessorios**



### Orientação de Contexto Criativo

Valorize estilo e performance. Apresentar como destaque ou novidade, sem urgência. Benefício e diferencial são o foco.

### Repertório Comercial

Considere os seguintes detalhes como argumentos visuais opcionais — use apenas se fizerem sentido para a composição:


### Instruções de Validação



### REGRAS CRÍTICAS DE FIDELIDADE

A imagem do produto é uma referência factual protegida.

Não redesenhe, reescreva, complete ou invente:
- textos da embalagem;
- selos;
- certificações;
- benefícios;
- volume;
- quantidade;
- variante;
- preço;
- logotipo.

Caso algum texto pequeno da embalagem não possa ser reproduzido com
fidelidade, preserve visualmente o produto sem tentar completar esse texto.

Você possui liberdade total para criar fundo, composição, iluminação,
hierarquia, formas, elementos decorativos e direção visual.

Quando houver aviso ilustrativo, exiba "" em texto mínimo, legível e discreto, separado dos demais textos, preferencialmente nas laterais da arte.

Se o campo "Texto obrigatório na arte" estiver preenchido (), inclua esse texto na arte de forma visível e legível, em tipografia mínima adequada para leitura em dispositivo móvel. Não o repita na legenda.
```

**DEPOIS (F45 pós-45-06b — montagem real):**

```text
# Diretrizes Criativas — Diretor de Marketing → Diretor de Arte

## Briefing: Campanha Visual para Instagram — Destaque

Você é o Diretor de Marketing da Loja Bella Moda. Sua função é briefar o Diretor de Arte para criar uma campanha visual profissional para Instagram. O produto deve ser apresentado como destaque ou novidade, sem urgência promocional.

---

## Fatos da Campanha

- **Loja:** Loja Bella Moda
- **Segmento:** moda-calcados-acessorios
- **Tom de voz:** profissional
- **Produto:** Vestido Floral Verão
- **Preço:** R$ 159,90
- **Canal alvo:** Instagram — **Formato:** quadrado 1:1

## Especificações Técnicas

- **Formato:** Quadrado 1:1 (Instagram feed)
- **Estilo:** Plano, limpo, profissional — agência de publicidade
- **Idioma:** Português brasileiro (PT-BR)
- **Paleta de cores da marca:** #E11D48

## Diretrizes de Composição

1. **Herói visual:** O produto Vestido Floral Verão deve ser o elemento central e mais proeminente da composição
2. **Identidade da loja:** A campanha deve ser assinada pela loja — ver a seção "Identidade da Loja"
3. **Produto em destaque:** O nome Vestido Floral Verão deve ser exibido com destaque e legibilidade
4. **Precificação:** Exibir o preço informado nos fatos como preço principal. Se disponível, exibir como valor de destaque. NÃO usar formato DE/POR ou indicar desconto
5. **Badge:** Quando houver badge informado nos fatos, incorporá-lo à arte. Sem badge informado, um apoio visual discreto é opcional — apenas se trouxer clareza visual, sem inventar promessa comercial
6. **Hook e CTA:** Quando houver hook e CTA informados nos fatos, incorporá-los na peça de forma orgânica e persuasiva. O CTA não deve repetir literalmente o texto do badge — com badge informado, o CTA complementa a chamada para ação sem redundância
7. **Tom de descoberta e destaque:** O produto é apresentado como novidade ou vitrine — sem urgência

## Instruções Obrigatórias

- NÃO inventar preços, descontos, condições de pagamento, prazos de entrega, garantias ou informações de disponibilidade que não estejam explícitas no briefing
- NÃO criar senso de urgência ou escassez (sem "corra", "últimas unidades", "aproveite")
- Todo texto deve estar em português brasileiro
- A cor predominante deve seguir a paleta #E11D48
- Manter hierarquia visual clara: produto > preço > loja > call to action
- A peça deve ser plana (flat design), sem efeitos 3D, sombras complexas ou gradientes agressivos
- A imagem gerada deve ser publicável como arte final de campanha — sem rascunhos, sem placeholders, sem elementos de interface



---

## Produto e Imagens de Referência

A imagem do produto é uma referência factual protegida.

Não redesenhe, reescreva, complete ou invente:
- textos da embalagem;
- selos;
- certificações;
- benefícios;
- volume;
- quantidade;
- variante;
- preço;
- logotipo.

Caso algum texto pequeno da embalagem não possa ser reproduzido com fidelidade, preserve visualmente o produto sem tentar completar esse texto.

Você possui liberdade total para criar fundo, composição, iluminação, hierarquia, formas, elementos decorativos e direção visual.

Quando houver mais de uma imagem de produto, a arte deve incorporar visualmente mais de uma das imagens enviadas, mantendo a primeira como produto principal. As imagens adicionais devem aparecer como apoio comercial real da composição, especialmente em combos, variações ou linhas de produto. Não reduza as imagens adicionais a cores, ícones, etiquetas ou texto.

NÃO recortar o produto. Preservar o contexto original da imagem. Adaptar a composição ao redor do produto sem isolá-lo. Legibilidade continua obrigatória.

## Identidade da Loja

O nome Loja Bella Moda deve aparecer como assinatura de marca — consistente com a identidade visual da loja.
Assinar a campanha com a assinatura visual da loja fornecida como imagem de referência. Manter fidelidade ao arquivo fornecido. Não adicionar logotipo. Considerar a direção visual do perfil de marca como contexto direcional, não obrigatório.
NÃO editar, alterar, redesenhar, distorcer nem inventar a assinatura visual fornecida — reproduzir o ativo enviado com fidelidade. Não adicionar logotipo.
Posicionar a assinatura visual com liberdade na composição, mantendo respiro adequado e sem cortes nas bordas da arte.



## Direção Criativa Contextual

Você é um diretor de marketing especializado em Moda, Calçados e Acessórios.

### Categoria do Produto

O produto anunciado é da categoria: **moda-calcados-acessorios**

### Orientação de Contexto Criativo

Valorize estilo e performance. Apresentar como destaque ou novidade, sem urgência. Benefício e diferencial são o foco.
```

**Resultado do avaliador (e):** ✅ **PASS** — hierarquia **primary = referência factual forte; auxiliares = apoio sem competir** (sem reduzir a cores/ícones/etiquetas/texto) presente no DEPOIS via `productReferenceSection`; `NÃO recortar/isolamento proibido` presente nos não-offer com `preserveImageContext`; identidade (assinatura visual) com **preservação explícita** no DEPOIS (0→1). Tom spotlight (destaque sem urgência, sem DE/POR, sem validade) preservado. Evidência: par montado (E) + artes reais aprovadas de spotlight em `resultado.md` (Coca Cola 2l Original, preço único sem DE/POR, badge "Mais Vendido"). Riqueza/orientação preservada.

---

## Cenário (f) — Oferta completa (tom promocional/urgência preservado)

**Entrada (idêntica nos dois lados):** Loja Bella Moda, produto **Tênis Runner Pro**, oferta R$ 199,90 (original R$ 299,90), badge "Oferta Imperdível", hook, CTA, objetivo, **validade** "de 25/09/2026 até 30/09/2026", **aviso ilustrativo + texto livre** ("Promoção válida enquanto durarem os estoques."), details ("Frete grátis acima de R$ 199"), additional ("Aceitamos Pix e cartão em até 3x"), disponibilidade ("Restam poucas unidades por loja"), **restrição sensível** ("Não usar modelo humano na arte"), **1 primary + 1 auxiliar**, identidade **logo com ativo**, **perfil de marca completo**.

**O que observar:**
- [ ] O tom promocional/urgência do offer foi preservado (preço + original riscado, badge, CTA, objetivo, validade)?
- [ ] Cada natureza (validade, aviso, texto obrigatório, details, disponibilidade, restrições) aparece **1×** em bloco canônico no DEPOIS?
- [ ] O texto obrigatório e o aviso estão em **seções próprias separadas** (sem mistura)?
- [ ] A **preservação do logotipo** e a hierarquia **primary × auxiliar** estão explícitas no DEPOIS?
- [ ] O perfil de marca (direção criativa) foi preservado como contexto direcional?

**ANTES (pré-F45 — montagem real):**

```text
# Diretrizes Criativas — Diretor de Marketing → Diretor de Arte

## Briefing: Campanha Visual para Instagram

Você é o Diretor de Marketing da Loja Bella Moda. Sua função é briefar o Diretor de Arte para criar uma campanha visual profissional para Instagram. A peça deve ser publicável, comercial e transmitir confiança ao lojista.

---

## Informações da Campanha

| Campo | Valor |
|-------|-------|
| **Loja** | Loja Bella Moda |
| **Segmento** | moda-calcados-acessorios |
| **Tom de voz** | profissional |
| **Produto** | Tênis Runner Pro |
| **Preço original** | R$ 299,90 |
| **Preço com desconto** | R$ 199,90 |
| **Texto do badge** | Oferta Imperdível |
| **Hook** | Leveza e estilo para o seu dia |
| **CTA** | Aproveite em nossa loja |
| **Objetivo** | Vender o tênis em destaque |
| **Detalhes da campanha** | Frete grátis acima de R$ 199 |
| **Detalhes adicionais** | Aceitamos Pix e cartão em até 3x |
| **Canal alvo** | Instagram |
| **Formato** | quadrado 1:1 |
| **Validade** | de 25/09/2026 até 30/09/2026 |
| **Disponibilidade** | Restam poucas unidades por loja |
| **Restrições sensíveis** | Não usar modelo humano na arte |
| **Texto obrigatório na arte** | Promoção válida enquanto durarem os estoques. |
| **Aviso ilustrativo** | Imagem meramente ilustrativa |

---

## Especificações Técnicas

- **Formato:** Quadrado 1:1 (Instagram feed)
- **Estilo:** Plano, limpo, profissional — agência de publicidade
- **Idioma:** Português brasileiro (PT-BR)
- **Paleta de cores da marca:** #E11D48

## Diretrizes de Composição

1. **Herói visual:** O produto Tênis Runner Pro deve ser o elemento central e mais proeminente da composição
2. **Identidade da loja:** O nome Loja Bella Moda deve aparecer como assinatura de marca — consistente com a identidade visual da loja
3. **Produto em destaque:** O nome Tênis Runner Pro deve ser exibido com destaque e legibilidade
4. **Precificação:** Exibir R$ 199,90 como preço principal. Se R$ 299,90 estiver disponível, exibir como preço riscado (indicação de desconto)
5. **Badge promocional:** Oferta Imperdível deve ser integrado de forma visualmente coerente
6. **Hook e CTA:** Incorporar Leveza e estilo para o seu dia e Aproveite em nossa loja na peça de forma orgânica e persuasiva
- **Imagens de referência do produto:** Quando houver mais de uma imagem de produto, a arte deve incorporar visualmente mais de uma das imagens enviadas, mantendo a primeira como produto principal. As imagens adicionais devem aparecer como apoio comercial real da composição, especialmente em combos, variações ou linhas de produto. Não reduza as imagens adicionais a cores, ícones, etiquetas ou texto.
8. **Identidade da loja:** Assinar a campanha com o logotipo da loja fornecida como imagem de referência. Manter fidelidade ao arquivo fornecido. Considerar a direção visual do perfil de marca como contexto direcional, não obrigatório.



## Instruções Obrigatórias

- NÃO inventar preços, descontos, condições de pagamento, prazos de entrega, garantias ou informações de disponibilidade que não estejam explícitas no briefing
- NÃO utilizar informações de parcelamento, frete grátis ou condições comerciais não fornecidas
- Todo texto deve estar em português brasileiro
- A cor predominante deve seguir a paleta #E11D48
- Manter hierarquia visual clara: produto > preço > loja > call to action
- A peça deve ser plana (flat design), sem efeitos 3D, sombras complexas ou gradientes agressivos
- A imagem gerada deve ser publicável como arte final de campanha — sem rascunhos, sem placeholders, sem elementos de interface

---

## Perfil de Marca (Store Brand Director)

> **Nota:** Este perfil de marca é contexto criativo direcional para repertório da campanha, não regra obrigatória. Use como referência visual e comercial, preservando seu julgamento criativo na composição.
| Campo | Valor |
|-------|-------|
| **Diretrizes de campanha** | Priorizar a cor da marca como fundo ou destaque; evitar poluição visual |
| **Brief do Diretor de Marca** | Campanha de lançamento de coleção com foco em estilo e custo-benefício |
| **Personalidade da marca** | Próxima, estilosa e acessível |
| **Estilo visual** | Moderno e clean, com tipografia forte |
| **Tom visual** | Acolhedor e confiante |
| **Cores da marca** | #E11D48, #FFFFFF |

## Observações sobre o Segmento

Considerar o segmento moda-calcados-acessorios ao definir o estilo visual. A peça deve dialogar com o público-alvo natural do segmento, mantendo o tom profissional.

## Notas Adicionais

Frete grátis acima de R$ 199

Aceitamos Pix e cartão em até 3x

> **Sobre o campo "detalhes adicionais:** O conteúdo deste campo é repertório comercial para inspiração, não instrução obrigatória. Nem toda informação precisa aparecer na arte — algumas são mais adequadas para legenda ou texto complementar. Use seu julgamento para selecionar o que fortalece a peça visual.

**Restrições:** Não usar modelo humano na arte
**Validade da oferta:** de 25/09/2026 até 30/09/2026
**Disponibilidade:** Restam poucas unidades por loja
**Canal:** Instagram — formato quadrado 1:1

> **Validade com data:** se a validade informada contiver data, a arte DEVE exibir dia, mês e ano completos no formato dd/mm/aaaa conforme informado (ex.: "até 30/09/2026", "de 25/09/2026 até 30/09/2026"). NÃO trunque para dd/mm nem omita o ano. Não invente nem altere a data informada.

## Direção Criativa Contextual

Você é um diretor de marketing especializado em Moda, Calçados e Acessórios.

### Categoria do Produto

O produto anunciado é da categoria: **moda-calcados-acessorios**



### Orientação de Contexto Criativo

Valorize estilo e performance. Preço é oportunidade.

### Repertório Comercial

Considere os seguintes detalhes como argumentos visuais opcionais — use apenas se fizerem sentido para a composição:
- Disponível: Restam poucas unidades por loja
- Oferta válida: de 25/09/2026 até 30/09/2026
- Frete grátis acima de R$ 199
- Aceitamos Pix e cartão em até 3x

### Instruções de Validação



### REGRAS CRÍTICAS DE FIDELIDADE

A imagem do produto é uma referência factual protegida.

Não redesenhe, reescreva, complete ou invente:
- textos da embalagem;
- selos;
- certificações;
- benefícios;
- volume;
- quantidade;
- variante;
- preço;
- logotipo.

Caso algum texto pequeno da embalagem não possa ser reproduzido com
fidelidade, preserve visualmente o produto sem tentar completar esse texto.

Você possui liberdade total para criar fundo, composição, iluminação,
hierarquia, formas, elementos decorativos e direção visual.

Quando houver aviso ilustrativo, exiba "Imagem meramente ilustrativa" em texto mínimo, legível e discreto, separado dos demais textos, preferencialmente nas laterais da arte.

Se o campo "Texto obrigatório na arte" estiver preenchido (Promoção válida enquanto durarem os estoques.), inclua esse texto na arte de forma visível e legível, em tipografia mínima adequada para leitura em dispositivo móvel. Não o repita na legenda.
```

**DEPOIS (F45 pós-45-06b — montagem real):**

```text
# Diretrizes Criativas — Diretor de Marketing → Diretor de Arte

## Briefing: Campanha Visual para Instagram

Você é o Diretor de Marketing da Loja Bella Moda. Sua função é briefar o Diretor de Arte para criar uma campanha visual profissional para Instagram. A peça deve ser publicável, comercial e transmitir confiança ao lojista.

---

## Fatos da Campanha

- **Loja:** Loja Bella Moda
- **Segmento:** moda-calcados-acessorios
- **Tom de voz:** profissional
- **Produto:** Tênis Runner Pro
- **Preço com desconto:** R$ 199,90
- **Preço original:** R$ 299,90
- **Badge:** Oferta Imperdível
- **Hook:** Leveza e estilo para o seu dia
- **CTA:** Aproveite em nossa loja
- **Objetivo:** Vender o tênis em destaque
- **Canal alvo:** Instagram — **Formato:** quadrado 1:1
- **Validade da oferta:** de 25/09/2026 até 30/09/2026

> **Validade com data:** se a validade informada contiver data, a arte DEVE exibir dia, mês e ano completos no formato dd/mm/aaaa conforme informado (ex.: "até 30/09/2026", "de 25/09/2026 até 30/09/2026"). NÃO trunque para dd/mm nem omita o ano. Não invente nem altere a data informada.

## Especificações Técnicas

- **Formato:** Quadrado 1:1 (Instagram feed)
- **Estilo:** Plano, limpo, profissional — agência de publicidade
- **Idioma:** Português brasileiro (PT-BR)
- **Paleta de cores da marca:** #E11D48

## Diretrizes de Composição

1. **Herói visual:** O produto Tênis Runner Pro deve ser o elemento central e mais proeminente da composição
2. **Identidade da loja:** A campanha deve ser assinada pela loja — ver a seção "Identidade da Loja"
3. **Produto em destaque:** O nome Tênis Runner Pro deve ser exibido com destaque e legibilidade
4. **Precificação:** Exibir o preço com desconto informado nos fatos como preço principal. Quando houver preço original informado, exibi-lo como preço riscado (indicação de desconto)
5. **Badge promocional:** Quando houver badge promocional informado nos fatos, incorporá-lo à arte. Sem badge informado, não inventar selo, benefício ou promessa promocional
6. **Hook e CTA:** Quando houver hook e CTA informados nos fatos, incorporá-los na peça de forma orgânica e persuasiva. O CTA não deve repetir literalmente o texto do badge — com badge informado, o CTA complementa a chamada para ação sem redundância

## Instruções Obrigatórias

- NÃO inventar preços, descontos, condições de pagamento, prazos de entrega, garantias ou informações de disponibilidade que não estejam explícitas no briefing
- NÃO utilizar informações de parcelamento, frete grátis ou condições comerciais não fornecidas
- Todo texto deve estar em português brasileiro
- A cor predominante deve seguir a paleta #E11D48
- Manter hierarquia visual clara: produto > preço > loja > call to action
- Composição limpa e profissional, sem efeitos gráficos artificiais ou gradientes agressivos — luz natural, profundidade e sombras do produto são permitidas
- A imagem gerada deve ser publicável como arte final de campanha — sem rascunhos, sem placeholders, sem elementos de interface

## Restrições Sensíveis

Restrições sensíveis informadas pelo lojista:

- Não usar modelo humano na arte

---

## Produto e Imagens de Referência

A imagem do produto é uma referência factual protegida.

Não redesenhe, reescreva, complete ou invente:
- textos da embalagem;
- selos;
- certificações;
- benefícios;
- volume;
- quantidade;
- variante;
- preço;
- logotipo.

Caso algum texto pequeno da embalagem não possa ser reproduzido com fidelidade, preserve visualmente o produto sem tentar completar esse texto.

Você possui liberdade total para criar fundo, composição, iluminação, hierarquia, formas, elementos decorativos e direção visual.

Quando houver mais de uma imagem de produto, a arte deve incorporar visualmente mais de uma das imagens enviadas, mantendo a primeira como produto principal. As imagens adicionais devem aparecer como apoio comercial real da composição, especialmente em combos, variações ou linhas de produto. Não reduza as imagens adicionais a cores, ícones, etiquetas ou texto.

## Identidade da Loja

O nome Loja Bella Moda deve aparecer como assinatura de marca — consistente com a identidade visual da loja.
Assinar a campanha com o logotipo da loja fornecida como imagem de referência. Manter fidelidade ao arquivo fornecido. Considerar a direção visual do perfil de marca como contexto direcional, não obrigatório.
NÃO editar, alterar, redesenhar, distorcer nem inventar o logotipo fornecido — reproduzir o ativo enviado com fidelidade.
Posicionar o logotipo com liberdade na composição, mantendo respiro adequado e sem cortes nas bordas da arte.

## Detalhes Comerciais (repertório para inspiração)

> **Nota:** O conteúdo abaixo é repertório comercial para inspiração, não instrução obrigatória. Nem toda informação precisa aparecer na arte — algumas são mais adequadas para legenda ou texto complementar. Use seu julgamento para selecionar o que fortalece a peça visual.

- **Detalhes da campanha:** Frete grátis acima de R$ 199
- **Detalhes adicionais:** Aceitamos Pix e cartão em até 3x
- Disponível: Restam poucas unidades por loja

## Direção Criativa Contextual

Você é um diretor de marketing especializado em Moda, Calçados e Acessórios.

### Categoria do Produto

O produto anunciado é da categoria: **moda-calcados-acessorios**

### Orientação de Contexto Criativo

Valorize estilo e performance. Preço é oportunidade.

### Perfil de Marca (Store Brand Director)

> **Nota:** Este perfil de marca é contexto criativo direcional para repertório da campanha, não regra obrigatória. Use como referência visual e comercial, preservando seu julgamento criativo na composição.
| Campo | Valor |
|-------|-------|
| **Diretrizes de campanha** | Priorizar a cor da marca como fundo ou destaque; evitar poluição visual |
| **Brief do Diretor de Marca** | Campanha de lançamento de coleção com foco em estilo e custo-benefício |
| **Personalidade da marca** | Próxima, estilosa e acessível |
| **Estilo visual** | Moderno e clean, com tipografia forte |
| **Tom visual** | Acolhedor e confiante |
| **Cores da marca** | #E11D48, #FFFFFF |

## Texto Obrigatório na Arte

O texto abaixo foi informado pelo lojista para ser incluído na arte. Inclua esse texto na arte de forma visível e legível, em tipografia mínima adequada para leitura em dispositivo móvel. Não o repita na legenda.

"Promoção válida enquanto durarem os estoques."

## Aviso Ilustrativo

Quando houver aviso ilustrativo, exiba-o em texto mínimo, legível e discreto, separado dos demais textos, preferencialmente nas laterais da arte.

Texto do aviso: "Imagem meramente ilustrativa"
```

**Resultado do avaliador (f):** ✅ **PASS** — oferta completa com tom promocional preservado (preço + original riscado, badge, hook, CTA, objetivo, validade); cada natureza em **1×** no bloco canônico no DEPOIS (validade 4→2, aviso 2→1, texto obrigatório 2→1, details 3→1, disponibilidade 3→1, restrições 2→1, preservação de identidade 0→1); texto obrigatório × aviso em **seções próprias separadas**; perfil de marca mantido como contexto direcional. Evidência real: arte de offer completa aprovada em `resultado.md` (Heineken 600ml — todos os elementos presentes, publicável). Observação residual não-bloqueante: o briefing é longo, mas a arte resultante é boa e publicável — aceito deliberadamente. Riqueza/orientação preservada.

---

## Leitura humana dos 4 `.md` (legibilidade editorial)

Os 4 arquivos reescritos foram **aprovados pelo humano no 45-06** (Task 3, HUMAN-APPROVED após os adendos F45-06a — spotlight — e F45-06b — exclusive/offer/base). Para este UAT, re-leia os arquivos e confirme a legibilidade da **camada editorial + slots**:

- [x] `prompts/campaign-image-director.md` (base/referência offer) — persona, composição numerada, instruções obrigatórias, `{{slots}}` com intenção clara.
- [x] `prompts/campaign-image-director-offer.md` — espelho do base (offer runtime).
- [x] `prompts/campaign-image-director-spotlight.md` — destaque sem urgência, sem DE/POR.
- [x] `prompts/campaign-image-director-exclusive.md` — premium **sem preço**, sem badge promocional, sem flag técnico fixo.
- [x] Nenhum dos 4 virou "template seco" de `{{campo}}` — os slots restantes têm função compreensível no texto.

> Anatomia comum dos 4 arquivos (referência rápida de leitura): persona editorial → `## Fatos da Campanha` + `{{campaignFactsSection}}` → `## Especificações Técnicas` → `## Diretrizes de Composição` → `## Instruções Obrigatórias` + `{{constraintsSection}}` → `## Produto e Imagens de Referência` + `{{productReferenceSection}}` → `## Identidade da Loja` + `{{identityReferenceSection}}` → `{{commercialDetailsSection}}` → `## Direção Criativa Contextual` + `{{creativeDirectionSection}}` → `{{requiredArtworkTextSection}}` → `{{illustrativeNoticeSection}}`. Slots de natureza condicional aparecem como linha inteira (o heading vive no valor do bloco).

**Resultado do avaliador (leitura dos 4 `.md`):** ✅ **PASS** — os 4 arquivos continuam documentos de direção criativa legíveis (persona, composição numerada, instruções obrigatórias e slots nomeados com intenção clara); nenhum virou "template seco". Leitura final confirmada em 2026-09-05 sobre o estado atual (4 `.md` do Diretor pós-45-06b/45-08 + `campaign-image-reviewer.md` reescrito no 45-08) — **aprovados como estão, sem nova rodada de ajuste**.

---

## Execução do roteiro (registro do avaliador — 2026-09-05)

Roteiro executado e preenchido pelo avaliador. Respostas consolidadas:

1. Pares ANTES × DEPOIS lidos nos 6 cenários → **PASS (a)–(f)** (ver "Resultado do avaliador" em cada cenário).
2. Itens de "O que observar" → **confirmados** (as naturezas comparadas estão presentes nas seções próprias, sem duplicação, e nada de relevante foi amputado).
3. Leitura dos 4 `.md` → **PASS**.
4. Veredito final: **"approved"** — com observação residual NÃO-BLOQUEANTE (briefings longos, aceitos deliberadamente porque as artes são boas e publicáveis) e registro de que **nenhuma paridade pixel a pixel** com resultados anteriores é requerida.

## Summary (registro final do avaliador)

| Cenário | Status | Observação |
|---------|--------|------------|
| (a) Identidade logo/VS | ✅ PASS | Preservação explícita (nova na F45) + área segura/margens/posição secundária (45-08) + concordância de gênero; arte real de `resultado.md` com assinatura fiel |
| (b) Aviso ilustrativo | ✅ PASS | Seção própria, 1×, instrução lateral/mínimo/discreto; sem seção de texto obrigatório quando só há aviso |
| (c) Texto obrigatório livre | ✅ PASS | Seção própria, 1×, visível/legível/sem legenda; arte real com "Venda proibida para menores de 18 anos" |
| (d) Validade (oferta) | ✅ PASS | Ocorrência única nos fatos + regra dd/mm/aaaa; arte real com validade em data completa |
| (e) Multi-imagem primary × auxiliares | ✅ PASS | Hierarquia 1+N + não-recorte (preserveImageContext) + preservação da assinatura; arte real de spotlight sem DE/POR |
| (f) Oferta completa | ✅ PASS | Tom promocional preservado; cada natureza 1× em bloco canônico; seções próprias separadas; arte real publicável |
| Leitura dos 4 `.md` | ✅ PASS | Documentos legíveis; aprovados como estão (sem nova rodada) |

- total: 7
- passed: **7**
- issues: **0** (observação residual não-bloqueante: briefings longos, aceitos deliberadamente — artes boas e publicáveis)
- pending: 0
- skipped: 0
- blocked: 0

---

*Fase 45 — UAT comparativo antes × depois **APROVADO** pelo avaliador em 2026-09-05 (PASS 7/7: cenários (a)–(f) + leitura dos 4 `.md`). Fechamento da F45 autorizado (registros + arquivamento do change).*
