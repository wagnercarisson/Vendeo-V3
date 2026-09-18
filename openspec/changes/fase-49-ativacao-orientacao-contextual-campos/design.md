## Context

A F49 é uma fase de **orientação contextual de campos** — não um tour guiado, não um checklist global de ativação e não uma mudança de pipeline. Ela melhora o que o lojista lê e entende **no próprio campo ou seção** dos dois formulários que alimentam a geração: a identidade da loja (`/loja`) e o brief da campanha (`/campanhas/nova`), incluindo a tela de revisão do brief (F43).

**Estado real em código (explorado nesta fase):**

- **Formulário da loja** (`src/components/flow/store-identity-form.tsx`, ~2735 linhas; painel de 3 abas da F36):
  - **Dados**: CNPJ (opcional; draft mode), `Razão Social (Receita Federal)` e `Nome Fantasia (Receita Federal)` (opcionais, read-only após lookup) e atalhos "Usar nome fantasia/razão social como nome da loja" (linhas ~1607-1622); `Nome da Loja *` (linha 1629) **sem microcopy** de que é o nome público; `Segmento *`; `Subsegmento`; cidade/UF; billing colapsado.
  - **Posicionamento**: card informativo (`Essas informações ajudam o Vendeo...`, linha 1951); `Tom de Voz` (select, 8 opções em `TONE_OF_VOICE_OPTIONS`, linhas 37-46) **sem explicação nem descrição da opção**; `Posicionamento` (input, placeholder `Ex: A melhor loja de...`, linha 1968); `Descrição Curta` (textarea, placeholder genérico, linha 1972); `Slogan` (input, linha 1976) — os três **sem distinção de propósito**.
  - **Direção Visual**: logo/assinatura visual, cores, preview, drift. Fora do escopo desta fase (só o desbloqueio por tom de voz importa, D5).
- **Formulário da campanha** (`src/components/flow/campaign-input-form.tsx`):
  - Seção **Produto**: `Nome do Produto *`; `Descrição (opcional)` com placeholder **promocional** `Ex: 20% OFF em todo o estoque` (linha 386) — na verdade o campo é `product.description` (descrição do produto); `CampaignImageUpload` + "Imagens adicionais".
  - Seção **Oferta**: bloco permanente de 3 regras de preço (`Preço original + preço final = Oferta`, etc., linhas 427-432); `Preço Original (opcional)` e `Preço Final` sem explicação de significado; `Selo promocional`; `IntentSelector` (Oferta/Destaque/Exclusivo); `Preservar imagem original`; `ValidityField` (6 modos, offer-only).
  - Seção **Avisos e texto obrigatório**: `IllustrativeNoticeField` (checkbox) e `MandatoryArtworkField` (textarea `Texto obrigatório na arte`, placeholder de regra/restrição, hint "Use para regras, restrições ou informações...").
- **Consumidores reais dos campos** (fonte da verdade dos efeitos):

| Campo | Consumidor real | Efeito |
|---|---|---|
| `Nome da Loja` (`stores.name`) | brief (`store.name`), copy mapper (`storeName`), identidade/assinatura visual, card de revisão | **direto** |
| `Razão Social` / `Nome Fantasia` | cadastro fiscal/readiness; **não** alimentam brief/arte diretamente (podem ser copiados para o nome) | **indireto** (atalho) |
| `Tom de Voz` | `computeTabUnlock` (desbloqueia Direção Visual); brief (`store.toneOfVoice`); copy mapper (`toneOfVoice`); `art-director-briefing` (`storeTone`, default `"profissional"`); inferência text-only | **direto** |
| `Posicionamento` | brief (`store.positioning`); copy mapper (`positioning`); **perfil de marca/direção visual** (`brand-director.ts`, `brand-profiler.ts`, `identity-art-director.ts`, `text-only-inference-service.ts`); drift (sensitive) | **direto (copy)** + **indireto (perfil/direção visual)** |
| `Descrição Curta` | brief (`store.shortDescription`); copy mapper (`shortDescription`); **perfil de marca/direção visual** (`brand-director.ts`, `brand-profiler.ts`, `text-only-inference-service.ts`); drift | **direto (copy)** + **indireto (perfil/direção visual)** |
| `Slogan` | brief (`store.slogan`); copy mapper (`slogan`); assinatura visual (quando `contentUsed.slogan`); drift | **direto** |
| `Descrição do produto` (`product.description`) | brief (`product.description`); copy mapper (`CopyDirectorInput.description`) | **direto (copy/publicação)** |
| `Descrição do produto` → Diretor de Arte | `art-director-briefing.ts` **não consome** `description` (verificado) | **inexistente (por decisão)** |
| `Preço Original` / `Preço Final` | `inferIntent`; brief (`commercial.originalPriceCents/discountedPriceCents`); copy (`buildCommercialFrame`); arte (diretor) | **direto** |
| `Validade` | brief (`commercial.validity`); prompt do diretor (oferta); revisão | **direto (arte)** |
| `Informações obrigatórias na arte` (`mandatoryArtworkText` → `commercial.legalNotice`) | prompt do diretor (bloco condicional); snapshot | **direto (arte)** |
| `Aviso ilustrativo` (`ILLUSTRATIVE_NOTICE_TEXT`) | concatenação em `mandatoryArtworkText`; snapshot | **direto (arte)** |
| `Selo promocional` | brief (`commercial.badgeText`); copy (`buildCommercialFrame`); arte | **direto** |

- **Regra de desbloqueio (real):** `computeTabUnlock("direcao-visual", ctx)` (`src/lib/store-onboarding/tabs.ts`) exige `storeId` + `toneOfVoice.trim()` — motivo `needs_tone_of_voice`; o texto do bloqueio vive em `src/lib/store-onboarding/reason-text.ts`.
- **Precedente de ajuda de campo acessível:** `src/app/(app)/admin/laboratorio/_components/lab-textarea.tsx` / `lab-select.tsx` usam `useId` + `aria-describedby` (erro + hint) com `min-h` de toque — padrão local, sem tocar `src/components/ui/`.
- **Revisão do brief (F43):** `campaign-brief-review.tsx` já separa seções Produto/Oferta/Imagens/Avisos/Custo; a seção **Avisos** hoje renderiza `mandatoryArtworkText ?? "Sem avisos adicionais."` como **um único parágrafo** (checkbox ilustrativo + texto livre concatenado) — ambíguo para categorias que a F49 quer manter reconhecíveis.
- **Não há `<details>`/disclosure no código atual** (grep sem resultados) — a ajuda expansível é padrão novo, mínimo e acessível.
- **Fences:** nenhuma migration, nenhum prompt, nenhum schema, nenhum contrato HTTP, nenhuma chamada de IA.

## Goals / Non-Goals

**Goals:**
- Padrão reutilizável e **mínimo** de ajuda de campo (hint inline, descrição contextual de opção, ajuda expansível, feedback dinâmico) com associação acessível campo↔ajuda (D2)
- Diferenciação clara obrigatório/recomendado/opcional (D3)
- Dados fiscais separados do nome público, com microcopy de "Nome da Loja" (D4)
- Tom de voz explicado como campo crítico + descrição contextual das 8 opções (D5)
- Posicionamento com label compreensível, hint (público/proposta/diferencial) e exemplo positivo expansível (D6)
- Distinção explícita posicionamento × descrição curta × slogan (D7)
- Descrição do produto renomeada conceitualmente, com microcopy/placeholder reais e **fence** de que só alimenta copy/publicação (D8)
- Preços com labels de significado, ajuda expansível e feedback dinâmico preservando as 3 regras atuais (D9)
- Informações obrigatórias na arte visíveis, com microcopy positiva e exemplo multi-linha (D10)
- Fronteiras canônicas entre áreas, sem avisos negativos permanentes (D11)
- Revisão do brief com categorias separáveis (D12)
- A11y/mobile/desktop preservados (D13)
- Microcopy em fonte única + testes que provam correspondência com o comportamento real e não-mudança do pipeline (D14)
- Co-migração de testes existentes sem alterar contratos produtivos (D15)

**Non-Goals:**
- Tour guiado pelo shell/dashboard; coach marks; checklist global persistente de ativação; assistente conversacional; help center
- Redesenho geral do onboarding ou da página de campanha
- Alteração de prompts, gateway, modelos, pipeline de IA ou novas chamadas de IA
- Envio da descrição do produto ao Diretor de Arte (fica para fase futura, após otimização/refinamento de prompts com laboratório, baseline e UAT visual)
- Validação semântica rígida, regex de intenção ou bloqueio por qualidade de texto
- Mudanças em schemas públicos, snapshot, domínio ou contrato HTTP
- Implementação de Temas (F44)
- Comportamento baseado em exemplos negativos / advertências preventivas
- Atualização de trackings/roadmap durante a elaboração/execução deste change; a **atualização normal no fechamento autorizado** da fase segue o workflow do projeto (não é proibida pela fase)

## Decisions

### D1 — Escopo: orientação no próprio campo, sem tour e sem checklist

`DECIDIDO` (o alinhamento pós-F48.1 descreve uma F49 de "onboarding e ativação" mais ampla; **este change delimita a fatia aprovada**: orientação contextual dos campos de loja e campanha)

- A F49 deste change entrega **orientação contextual** nos campos que alimentam direção visual, identidade, brief e informações obrigatórias da arte. Fica fora: checklist persistente de ativação, tour/coach marks, eventos de conclusão/tempo/abandono por etapa e redesenho do onboarding. Esses itens, se retomados, entram em change próprio.
- **Trackings/roadmap não são atualizados na elaboração dos artefatos** (restrição desta solicitação). A **atualização normal de trackings no fechamento autorizado** da fase é permitida e segue o workflow do projeto — a fase não proíbe o encerramento padrão.

### D2 — Padrão reutilizável de ajuda de campo (mínimo, sem overengineering)

`DECIDIDO` (composição de primitivos locais; **não** um componente genérico complexo)

Quatro mecanismos, cada um com um caso de uso claro:

| Mecanismo | Quando usar | Exemplo |
|---|---|---|
| **Hint inline curto** | Explicação de 1 linha que **sempre** deve estar visível | "Este é o nome público da sua loja..." |
| **Descrição contextual da opção** | Select cujo valor escolhido merece uma frase própria | Tom de voz: descrição da opção selecionada |
| **Ajuda expansível** | Exemplo longo / regra combinatória que não deve ocupar altura permanente | "Como os preços mudam a campanha?" |
| **Feedback dinâmico** | Mensagem derivada dos valores preenchidos | "A campanha será apresentada como oferta: de R$ X por R$ Y." |

- **Implementação:** primitivos locais pequenos e declarativos (ex.: `FieldHint` para texto associado; `ExpandableHelp` para disclosure; descrição contextual renderizada pelo próprio componente do select; feedback dinâmico como texto derivado de função pura). Sem API genérica de formulário, sem context, sem registry de campos.
- **Acessibilidade:** todo texto de ajuda associado ao campo por `aria-describedby` com ids gerados por `useId` (padrão `lab-textarea.tsx`); o disclosure é um `<button aria-expanded>` + região revelada (ou `<details>/<summary>` nativo) navegável por teclado; foco visível.
- **Proibido:** depender exclusivamente de `title`/tooltip; listas permanentes de regras; avisos negativos preventivos.

### D3 — Obrigatório, recomendado e opcional

`DECIDIDO` (rótulo textual + semântica, nunca só cor)

- **Obrigatório:** mantém `*` no rótulo e a **validação controlada atual** (`noValidate` + validação por campo + mensagens). Como melhoria acessível, o campo SHALL receber **`aria-required="true"`** — **sem** adicionar o atributo nativo `required` e **sem** introduzir validação nativa (preserva o fence comportamental da fase). O atributo nativo `required` hoje **não existe** no código.
- **Recomendado:** novo estado textual (ex.: badge/label "Recomendado") para campos que melhoram o resultado sem bloquear — **Posicionamento** e **Descrição Curta** na aba Posicionamento. **Slogan NÃO é recomendado**: é **opcional**, com microcopy "se sua loja já utiliza um", para não induzir o lojista a inventar um slogan só para completar o formulário. "Imagens adicionais" na campanha permanece como hoje (opcional explícito).
- **Opcional:** rótulo `(opcional)` atual preservado.
- **Crítico para avançar:** **Tom de Voz** é o único campo que bloqueia a Direção Visual (D5) — a orientação deve dizer isso de forma positiva, sem inventar novos bloqueios.
- Nunca introduzir cor como único diferenciador; o texto do estado é acessível (visível e/ou `aria-label`).

### D4 — Dados fiscais × identidade pública (loja)

`DECIDIDO` (separação conceitual e visual; atalhos preservados)

- **Subseção "Dados fiscais"** (dentro da aba Dados) agrupando `CNPJ`, `Razão Social` e `Nome Fantasia`, com rótulo/helper deixando claro que são **dados cadastrais/oficiais** (Receita Federal) usados para verificação/readiness.
- **Campo "Nome da Loja"** permanece no fluxo principal com microcopy de identidade pública (texto sujeito a refinamento editorial): *"Este é o nome público da sua loja. Ele aparece no Vendeo e é usado para identificar e assinar suas campanhas."*
- **Atalhos preservados:** "Usar nome fantasia como nome da loja" / "Usar razão social como nome da loja" continuam exatamente como hoje (não são removidos nem renomeados).
- **Sem mudança de comportamento:** CNPJ continua opcional (draft mode), lookup/read-only/fallback preservados; apenas a **organização e a microcopy** mudam.

### D5 — Tom de voz: campo crítico com descrição contextual por opção

`DECIDIDO` (a regra real de desbloqueio é refletida, não alterada)

- **Hint inline:** *"Define como sua loja se comunica. O Vendeo usa essa escolha nos títulos, legendas e no clima visual das campanhas."*
- **Descrição contextual:** ao selecionar uma das 8 opções, exibir uma frase curta e positiva explicando a personalidade/energia daquela escolha (conteúdo em módulo puro, D14). Exemplos ilustrativos: `profissional` → "Direta, confiável e sem exageros."; `moderno` → "Atual, objetiva e com energia contemporânea."; `luxuoso` → "Sofisticada, exclusiva e com senso de premium." (redação final na execução).
- **Base da identidade:** microcopy deve deixar claro que o tom **complementa** (não substitui) segmento/subsegmento como base da identidade — alinhado ao `art-director-briefing` (tone entra como `storeTone`, default `"profissional"`).
- **Sem mudança de regra:** `computeTabUnlock` continua exigindo apenas `storeId` + tom de voz; `reason-text.ts` permanece a fonte do motivo de bloqueio.

### D6 — Posicionamento: label compreensível, hint e exemplo expansível

`DECIDIDO` (sem validador semântico)

- **Label principal:** *"Como você quer que sua loja seja percebida?"* — com **"Posicionamento da marca"** como termo secundário (ex.: texto auxiliar/label menor), mantendo a chave `positioning`/`store.positioning`.
- **Hint inline:** informar que o campo deve trazer **público, proposta e diferencial**.
- **Uso reconhecido (não subestimar):** a microcopy deve reconhecer que posicionamento e descrição curta ajudam o Vendeo a **compreender a identidade da loja** — com efeito **direto na copy** e **indireto no perfil/direção visual** (o texto alimenta `brand-director`/`brand-profiler`/inferência text-only). **Sem** prometer uma transformação visual específica (ex.: "vai mudar suas cores").
- **Ajuda expansível:** exemplo positivo com a estrutura *"Somos uma loja de [categoria] para [público], reconhecida por [diferencial]."* — fora da altura permanente do formulário.
- **Placeholder** atual (`Ex: A melhor loja de...`) é substituído por um começo de frase útil (ex.: `Ex: Somos uma loja de...`) — não por um exemplo completo no placeholder.
- **Sem validador:** não bloquear adjetivo único, não usar regex de intenção; a orientação é educativa.

### D7 — Descrição curta × slogan × posicionamento

`DECIDIDO` (distinção por microcopy)

- **Posicionamento:** como a loja **deseja ser percebida** (recomendado; ajuda a copy e a compreensão da identidade).
- **Descrição curta:** **o que a loja vende, para quem** e algum **diferencial factual** (recomendada; ajuda a copy e a compreensão da identidade).
- **Slogan:** **frase pública já adotada** pela loja — **opcional**, com microcopy "se sua loja já utiliza um"; **não** é recomendado, para não induzir a criação de um slogan artificial.
- Hints curtos por campo tornam a diferença visível no ponto de decisão; nenhum campo novo, nenhuma validação nova.

### D8 — Descrição do produto (campanha) + fence explícito do Diretor de Arte

`DECIDIDO` (contrato interno preservado; **sem** aviso negativo na UI)

- **Label:** "Descrição do produto" (o campo permanece `fields.description` → body `description` → `brief.product.description` → `CopyDirectorInput.description`).
- **Microcopy:** *"Descreva características, benefícios ou formas de uso que ajudam a apresentar o produto na comunicação da campanha."*
- **Placeholder real de produto:** `Ex.: Tênis leve para corrida e uso diário, com solado antiderrapante.` (substitui o placeholder promocional atual).
- **Fence (obrigatório):** nesta fase a descrição **continua alimentando apenas o comportamento produtivo atual** (copy/publicação). É **proibido**:
  - enviar `product.description` ao Diretor de Arte;
  - alterar prompts, briefing do Diretor, pipeline ou comportamento visual;
  - exibir o aviso negativo *"Este campo não define, neste momento, a composição visual da arte"*.
- **Futuro:** influência da descrição na composição visual fica para outra fase, após otimização/refinamento dos prompts, com laboratório operacional, baseline e UAT visual.
- **Teste de não-mudança:** provar que `product.description` chega ao copy mapper e **não** ao `art-director-briefing`, e que os prompts/pipeline não mudaram.

### D9 — Preços e intenção: labels, ajuda expansível e feedback dinâmico

`DECIDIDO` (as 3 regras atuais preservadas; inferência intacta)

- **Labels de significado:** `Preço de venda (final)` e `Preço anterior (original)` — mantendo os campos `discountedPriceCents`/`originalPriceCents` e o body.
- **Hint curto por campo** (ex.: preço de venda é o valor que o cliente paga; preço anterior é o valor "de" riscado).
- **Ajuda expansível "Como os preços mudam a campanha?"** substitui o bloco permanente de 3 regras, preservando o conteúdo:
  - preço anterior + preço de venda → **Oferta**;
  - somente preço de venda → **Oferta ou Destaque**;
  - sem preço → **Destaque ou Exclusividade**.
- **Feedback dinâmico** derivado de função pura (mesma lógica de `inferIntent`/opções disponíveis):
  - com os dois preços: *"A campanha será apresentada como oferta: de R$ X por R$ Y."*
  - só preço de venda: *"Com apenas o preço de venda, você poderá escolher entre Oferta e Destaque."*
  - **só preço anterior** (estado intermediário real: preço anterior preenchido e preço de venda ainda vazio): mensagem **neutra**, ex.: *"Informe o preço de venda para completar a oferta."* — **não** exibir "Sem preço..." (evita feedback enganoso).
  - sem nenhum preço: *"Sem preço, a campanha será de Destaque ou Exclusividade."*
- **Estado intermediário sem nova validação:** "somente preço anterior" **não** é bloqueante e **não** cria validação nova; `inferIntent` continua caindo no caminho sem preço (comportamento atual preservado) e o feedback apenas orienta. Ajuda expansível segue listando as 3 regras reais de intenção.
- **Fence:** `inferIntent`, `IntentSelector`, `availableOptions`, schemas e contratos **não mudam**; o feedback apenas **espelha** o que o sistema já faz.

### D10 — Informações obrigatórias na arte: visível, positiva e multi-linha

`DECIDIDO` (não esconder atrás de checkbox; sem mudança de prompts)

- **Label:** "Informações obrigatórias na arte" (alternativa **"Detalhes obrigatórios na arte"** decidida na UAT humana, se indicar maior clareza). A chave/form state (`mandatoryArtworkTextFree`) e o transporte (`mandatoryArtworkText`) permanecem.
- **Microcopy positiva:** *"Informe características ou detalhes que precisam aparecer na imagem. Use uma linha para cada item."*
- **Placeholder multi-linha com exemplo de produto:**
  ```
  Intensidade 8
  Torra clássica
  Peso líquido 500 g
  ```
- **Visibilidade:** o campo continua diretamente visível na seção "Avisos e texto obrigatório" — **não** é movido para fluxo secundário nem escondido atrás de checkbox.
- **Sem advertências negativas permanentes** ("Não repita preço...", "Não repita validade...", "Não use para aviso ilustrativo...") — descartadas por risco de poluição e carga cognitiva.
- **Comportamento preservado:** inclusão obrigatória e legível na arte (bloco condicional do diretor) e bom tratamento visual de múltiplos itens; **nenhuma alteração de prompt**.

### D11 — Fronteiras canônicas entre informações

`DECIDIDO` (prevenção por organização, não por aviso negativo)

| Área | Responsabilidade canônica |
|---|---|
| Descrição do produto | Contexto para **comunicação/copy** (características, benefícios, uso) |
| Informações obrigatórias na arte | Características/detalhes que **precisam aparecer na imagem** |
| Preços | **Valores comerciais** (venda/anterior) |
| Validade | **Período, data ou limitação** ("enquanto durarem os estoques") |
| Aviso ilustrativo | **Controle próprio** (checkbox + constante única) |
| Selo promocional | **Campo próprio** |

- A prevenção de duplicação vem da **organização das seções + labels + microcopy positiva + revisão estruturada do brief** — nunca de avisos negativos permanentes ou validadores semânticos frágeis (aprendizado F44/F45).

### D12 — Revisão do brief com categorias separáveis

`DECIDIDO` (apresentação apenas; body/snapshot/contrato intactos)

- A tela de revisão (`campaign-brief-review.tsx`) deve manter **separáveis e reconhecíveis**: **aviso ilustrativo**, **informações obrigatórias na arte**, **validade** e **preços/oferta** — hoje o checkbox ilustrativo + texto livre aparecem concatenados em um único parágrafo na seção "Avisos".
- **Sem alteração de contrato:** `fields`, `buildMandatoryArtworkText`, body, snapshot e contrato HTTP permanecem idênticos; a mudança é de **apresentação** (ex.: separar a linha do aviso ilustrativo do bloco de informações obrigatórias, com rótulos alinhados à orientação).
- Rótulos da revisão alinhados aos novos labels (ex.: "Informações obrigatórias na arte", "Preço de venda", "Preço anterior").

### D13 — A11y, mobile e desktop

`DECIDIDO` (padrões atuais preservados e estendidos à ajuda)

- **Associação:** `aria-describedby` (ids via `useId`) ligando cada campo ao hint/erro/feedback; `aria-invalid` nos erros existentes.
- **Disclosure:** `aria-expanded` + região revelada (ou `<details>/<summary>` nativo), acionável por teclado, com foco visível.
- **Mobile:** touch targets ≥ 44px (F22); ajuda expansível em vez de texto permanente; sem scroll horizontal; hints curtos.
- **Desktop:** mesmos conteúdos, com largura confortável; ajuda expansível colapsada por padrão.
- **Não depender de hover:** informação essencial é visível ou alcançável por toque/teclado.
- **Estados:** os hints/feedbacks **não** interferem na validação, no auto-save, no draft nem no drift.

### D14 — Fonte única da microcopy e prova de não-divergência

`DECIDIDO` (conteúdo puro + testes de correspondência)

- **Conteúdo de orientação em módulos puros** (sem JSX, sem side-effects), consumidos por componentes e testes. Candidatos:
  - `src/lib/store-onboarding/field-guidance.ts` — labels/hints/exemplos/descrições de tom de voz e as fronteiras posicionamento/descrição/slogan;
  - `src/lib/campaign/field-guidance.ts` — labels/hints/exemplos e as mensagens de feedback dinâmico de preço.
- **Testes de correspondência microcopy ↔ comportamento real** (impedem divergência):
  - feedback de preço derivado da **mesma** lógica de `inferIntent`/`availableOptions` (4 estados: dois preços, só venda, **só anterior → neutro**, sem preço);
  - tom de voz ↔ `computeTabUnlock` (o hint de campo crítico corresponde ao bloqueio real);
  - descrição do produto ↔ copy mapper **e** ausência no `art-director-briefing`.
- **Sem duplicação:** as strings usadas em componentes e testes vêm do mesmo módulo (nenhuma cópia divergente).

### D15 — Fences de não-mudança e co-migração de testes

`DECIDIDO` (apresentação apenas)

- **Não muda:** prompts (`prompts/**`), gateway/modelos (`src/lib/ai/**`), `src/lib/campaign/brief*.ts`, snapshot `campaign_brief_v1`, `GenerateImageRequestSchema`, `use-campaign-form.ts` (helpers e body), `use-store-form`/`draft-store` (auto-save/draft), `use-drift-detection`/`lib/drift.ts`, rotas HTTP, banco/storage.
- **Testes de não-mudança:** prova de que prompts/pipeline/body/snapshot não foram alterados (goldens existentes + diff de prompts).
- **Co-migração:** atualizar apenas asserções que consultam labels/placeholders/microcopy alterados (`campaign-input-form.test.tsx`, `campaign-brief-review.test.tsx`, `store-identity-form.*`, `use-campaign-form-*.test.ts`, `validity-field.test.tsx`) — sem alterar o comportamento testado.
- **Proibido:** validadores semânticos rígidos, regex de intenção, novas chamadas de IA.

## Risks / Trade-offs

| Risco | Mitigação |
|---|---|
| **Microcopy prometer efeito que o pipeline não produz** | D8/D9/D14 — fences explícitos + conteúdo em fonte única + testes de correspondência; a orientação descreve apenas efeitos reais (tabela de consumidores no Context) |
| **Descrição do produto passar a influenciar a arte por engano** | D8/D15 — `art-director-briefing` não consome `description`; teste de não-mudança prova a ausência; prompts intocados |
| **Poluição visual por excesso de ajuda** | D2/D13 — hint curto + progressive disclosure (expansível colapsado por padrão); UAT avalia **ausência de poluição**, não só presença de texto |
| **Tooltip-only / informação essencial escondida** | D2/D13 — hint visível sempre presente; tooltip nunca é o único veículo |
| **Ajuda divergir do comportamento (ex.: feedback de preço ≠ opções reais)** | D14 — feedback derivado da mesma lógica de `inferIntent`/`availableOptions`; testes dos 4 estados de preço |
| **Acentuar dependência do tom de voz sem explicar o porquê** | D5 — microcopy explica que o tom orienta títulos/legendas/clima visual; regra real de desbloqueio permanece |
| **Revisão do brief quebrar contrato ao separar categorias** | D12/D15 — mudança só de apresentação; body/snapshot/HTTP cobertos por testes de não-mudança |
| **Regressão em auto-save/draft/drift ao tocar os formulários** | D15 — helpers/hooks intocados; co-migração restrita a asserções de label/microcopy; regressão obrigatória da suíte |
| **Mobile: ajuda empurrando conteúdo/scroll horizontal** | D13 — expansível colapsado, touch ≥ 44px, sem scroll horizontal; UAT mobile 320px/375px |
| **Escopo escorregar para tour/checklist/ativação** | D1 — fronteira explícita; itens fora desta fatia registrados como non-goals |
| **Trackings atualizados indevidamente durante a elaboração/execução** | D1 — trackings/roadmap não são atualizados na elaboração dos artefatos; a atualização normal no fechamento autorizado é permitida |
| **UAT avaliar presença de textos em vez de compreensão** | Tasks de UAT de **compreensão** (desktop + mobile) exigidas na verificação |

## Migration Plan

- **Sem migrations SQL.** Sem alteração de banco, storage, RLS ou configuração de deploy.
- **Sem mudança de variáveis de ambiente** e sem `supabase/config.toml`.
- **Deploy:** deploy normal de frontend (Vercel); nenhuma ordem especial além do fluxo padrão. Rollback = reverter o commit (mudança puramente de apresentação).
- **Trackings/roadmap:** **não atualizados na elaboração dos artefatos** (D1); a atualização normal no **fechamento autorizado** da fase segue o workflow do projeto.
- **Ordem de execução sugerida:** (1) conteúdo de orientação em módulos puros + primitivos de ajuda (com testes unitários); (2) aplicação nos campos da loja; (3) aplicação nos campos da campanha + revisão do brief; (4) co-migração das asserções de teste existentes; (5) 4 gates (`vitest`, `typecheck`, `lint`, `build`); (6) UAT humana desktop/mobile com tarefas de compreensão.

## Open Questions

- **Nenhuma bloqueante.**
- **Decisões de execução (não bloqueantes):** redação final das descrições de tom de voz (D5); escolha entre "Informações obrigatórias na arte" × "Detalhes obrigatórios na arte" conforme UAT (D10); localização final dos primitivos de ajuda (`src/components/ui/` × `src/components/campaign/`) e dos módulos de conteúdo (D14); rótulo do termo secundário de Posicionamento (D6).
