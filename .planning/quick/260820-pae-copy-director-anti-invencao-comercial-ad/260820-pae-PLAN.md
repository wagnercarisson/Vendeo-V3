---
phase: quick-pae
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - prompts/campaign-copy-director.md
  - prompts/campaign-copy-director-offer.md
  - prompts/campaign-copy-director-spotlight.md
  - prompts/campaign-copy-director-exclusive.md
  - src/lib/copy/__tests__/copy-director-prompt.test.ts
autonomous: false
requirements: [Q-CDA-01, Q-CDA-02, Q-CDA-03]
must_haves:
  truths:
    - "Os 4 prompts de copy (base, offer, spotlight, exclusive) contêm a seção '### Precisão comercial' curta, em tom criativo, com a frase 'fatos protegidos'"
    - "Os 4 prompts delimitam as condições proibidas por categoria ('entrega, frete, retirada, compra online' e 'parcelamento, garantia, estoque, últimas unidades' e 'tamanhos, cores, gêneros, variações, prazos ou disponibilidade') e contêm 'Não transforme inferências em fatos comerciais'"
    - "Os 4 prompts oferecem CTAs neutros de loja física ('Visite a loja', 'Confira na loja', 'Fale com a equipe', 'Venha conhecer') quando o canal de compra não foi informado"
    - "Os 4 prompts permitem explicitamente criatividade ('Pode criar desejo, urgência emocional e benefício percebido') sem prometer condição operacional ou promocional nova"
    - "O exemplo de CTA 'Clique e compre!' foi removido: offer e base usam 'Garanta já o seu!', 'Aproveite na loja!', 'Fale com a equipe!'; nenhum dos 4 prompts contém 'Clique e compre'"
    - "Novo teste de conteúdo dos prompts usa âncoras conceituais (não lista de tokens longa) e cobre pelo menos offer e spotlight (e exclusive + base), seguindo o padrão de leitura direta de prompt-reframe.test.ts, sem chamar modelo real"
  artifacts:
    - path: "prompts/campaign-copy-director.md"
      provides: "Seção 'Precisão comercial' + CTA neutro no prompt base"
      contains: "### Precisão comercial"
    - path: "prompts/campaign-copy-director-offer.md"
      provides: "Seção 'Precisão comercial' + CTA neutro + exemplos 'Garanta já o seu!', 'Aproveite na loja!', 'Fale com a equipe!'"
      contains: "### Precisão comercial"
    - path: "prompts/campaign-copy-director-spotlight.md"
      provides: "Seção 'Precisão comercial' + CTA neutro (exemplos já neutros mantidos)"
      contains: "### Precisão comercial"
    - path: "prompts/campaign-copy-director-exclusive.md"
      provides: "Seção 'Precisão comercial' + CTA neutro (exemplos já neutros mantidos)"
      contains: "### Precisão comercial"
    - path: "src/lib/copy/__tests__/copy-director-prompt.test.ts"
      provides: "Testes de conteúdo dos 4 prompts por âncoras conceituais (header, fatos protegidos, inferência, categorias proibidas, CTAs neutros, criatividade permitida, ausência de 'Clique e compre')"
      contains: "Precisão comercial"
  key_links:
    - from: "prompts/campaign-copy-director-offer.md"
      to: "src/lib/copy/__tests__/copy-director-prompt.test.ts"
      via: "readPrompt lê o arquivo de prompts e as asserções de âncora validam a seção de precisão comercial"
      pattern: "readPrompt"
    - from: "prompts/campaign-copy-director.md"
      to: "prompts/campaign-copy-director-offer.md"
      via: "mesmo bloco 'Precisão comercial' e mesmos exemplos de CTA neutro"
      pattern: "Precisão comercial"
---

<objective>
**Quick — Copy Director Precisão Comercial:** ajustar o Copy Director para preservar criatividade em tom, desejo e persuasão, mas impedir invenção de condições comerciais, canais de venda e promessas operacionais não informadas. Ajuste pontual de prompt + testes de conteúdo, com bloco curto em tom de direção criativa (não compliance jurídico) e SEM alterar contrato/backend/schema.

**Purpose:** Em uma campanha do produto "Chinelo Sonic Infantil", a copy gerada incluiu "Visite-nos ou aproveite nossa tele-entrega!" — serviço nunca informado pelo lojista. Isso é invenção comercial e gera campanha publicável que promete o que a loja não oferece. O bloco deve resolver o bug sem transformar o copywriter em auditor de compliance.

**Escopo (locked):** NÃO alterar `CopyDirectorInputSchema`/`CopyDirectorResultSchema` nem `mapper.ts`/`copy-director-service.ts`. NÃO alterar backend/rota. NÃO criar campo novo no formulário. NÃO implementar classificador pós-copy agora. NÃO mexer no image reviewer nem no image director. **Validade de data e reviewer multi-imagens ficam FORA deste quick.**
</objective>

<execution_context>
@C:/Users/wagne/.config/opencode/get-shit-done/workflows/quick.md
</execution_context>

<context>
@.planning/STATE.md
@prompts/campaign-copy-director.md
@prompts/campaign-copy-director-offer.md
@prompts/campaign-copy-director-spotlight.md
@prompts/campaign-copy-director-exclusive.md
@src/lib/copy/__tests__/copy-director-service.test.ts
@src/lib/campaign/__tests__/prompt-reframe.test.ts

**Estado atual confirmado por leitura:**
- 4 prompts de copy existem: `campaign-copy-director.md` (base), `-offer`, `-spotlight`, `-exclusive`. O serviço carrega apenas `campaign-copy-director-${campaignIntent}` (`copy-director-service.ts:84`); o prompt base não é carregado em runtime, mas é atualizado por consistência (D1).
- Nenhum prompt contém regra anti-invenção. O exemplo de CTA em `campaign-copy-director.md` e `campaign-copy-director-offer.md` é `Exemplo: "Garanta já a sua!", "Corra e aproveite!", "Clique e compre!"` — induz e-commerce. Spotlight já usa exemplos neutros ("Confira já!", "Venha conhecer!", "Descubra agora!"); exclusive usa "Saiba mais!", "Consulte-nos!", "Garanta o seu!".
- Não existe teste que inspecione o conteúdo dos prompts de copy. O padrão de teste de prompt do repo é `src/lib/campaign/__tests__/prompt-reframe.test.ts`, que lê o arquivo direto via `readFileSync(path.join(process.cwd(), "prompts", name))` — usado como referência (D2).
- Fatos comerciais autorizados vêm apenas dos campos informados acima (productName, description, commercialFrame, campaignGuidelines, dados da loja). O bloco "Precisão comercial" NÃO usa placeholders — não há dependência de variável nova.

<interfaces>
<!-- Contratos que o executor deve usar diretamente — sem exploração adicional. -->

Estrutura dos 4 prompts de copy (idêntica): seção `## Informações do Produto e Loja` (tabela com placeholders), `## Instruções de Geração` → `### Campos obrigatórios:` (title, caption, hashtags, cta_post, toneDescription) → `### Regras de tom de voz:` → `### Posicionamento:` → `### Personalidade da marca:` → `### Diretrizes adicionais:` → `## Formato de Saída (JSON)`.

`PromptLoader` substitui `{{key}}` literalmente (`prompt-loader.ts`). O bloco da regra usa os placeholders já existentes — NÃO adicionar variável nova.
</interfaces>

<decisions_pending>
<!-- Decisões revisadas com o usuário (revisão 1). Aguardam liberação final para execução. -->

| # | Decisão | Recomendação/Definição | Status |
|---|---------|------------------------|--------|
| D1 | Atualizar também o prompt base `campaign-copy-director.md` (não carregado em runtime) | Atualizar junto por consistência — baixo risco | ✅ revisado (revisão 1) |
| D2 | Local dos testes de conteúdo | Novo arquivo `src/lib/copy/__tests__/copy-director-prompt.test.ts` seguindo o padrão de `prompt-reframe.test.ts` | ✅ revisado (revisão 1) |
| D3 | Estilo do bloco | **NÃO usar lista longa/bullets estilo compliance.** Usar bloco curto `### Precisão comercial` em tom de direção criativa (texto fornecido pelo usuário), falando em "fatos protegidos" e categorias ("entrega, frete, retirada, compra online...") em vez de cerca de palavras — evita o modelo ecoar a lista proibida e não o deixa defensivo | ✅ revisado (revisão 1) |
| D4 | Exemplos de CTA no offer e base | Trocar `"Garanta já a sua!", "Corra e aproveite!", "Clique e compre!"` por `"Garanta já o seu!", "Aproveite na loja!", "Fale com a equipe!"` | ✅ revisado (revisão 1) |
| D5 | Exemplos de CTA no spotlight e exclusive | Manter os atuais (já neutros; não induzem e-commerce) | ✅ revisado (revisão 1) |
| D6 | Estratégia dos testes | Âncoras conceituais, não lista longa de tokens: `### Precisão comercial`, `fatos protegidos`, `Não transforme inferências em fatos comerciais`, `entrega, frete, retirada, compra online`, `parcelamento, garantia, estoque, últimas unidades`, `Pode criar desejo, urgência emocional`, e ausência do exemplo `Clique e compre!` | ✅ revisado (revisão 1) |

> **Fora deste quick (confirmado):** validação de data (Quick 260820-siq) e reviewer multi-imagens (pendência F41) NÃO são tocados aqui.
</decisions_pending>

<tasks>

<task type="auto">
  <name>Task 1: Bloco 'Precisão comercial' + CTA neutro nos 4 prompts de copy</name>
  <files>prompts/campaign-copy-director.md, prompts/campaign-copy-director-offer.md, prompts/campaign-copy-director-spotlight.md, prompts/campaign-copy-director-exclusive.md</files>
  <action>
    Em cada um dos 4 prompts (`campaign-copy-director.md`, `campaign-copy-director-offer.md`, `campaign-copy-director-spotlight.md`, `campaign-copy-director-exclusive.md`), inserir — entre o fim de `### Campos obrigatórios:` e o início de `### Regras de tom de voz:` — o bloco EXATO abaixo (texto fornecido pelo usuário, idêntico nos 4 prompts; NÃO adicionar variável nova, NÃO reescrever):

    ```markdown
    ### Precisão comercial

    Use criatividade para tornar a copy desejável, humana e persuasiva, mas trate informações comerciais como fatos protegidos.

    Não afirme condições que não estejam nos dados informados acima, como entrega, frete, retirada, compra online, parcelamento, garantia, estoque, últimas unidades, tamanhos, cores, gêneros, variações, prazos ou disponibilidade.

    Não transforme inferências em fatos comerciais. Se o canal de compra não foi informado, prefira CTAs neutros de loja física, como "Visite a loja", "Confira na loja", "Fale com a equipe" ou "Venha conhecer".

    Pode criar desejo, urgência emocional e benefício percebido, desde que não prometa uma condição operacional ou promocional nova.
    ```

    1. **offer e base:** além do bloco, substituir o exemplo de CTA na seção `cta_post` — `Exemplo: "Garanta já a sua!", "Corra e aproveite!", "Clique e compre!"` → `Exemplo: "Garanta já o seu!", "Aproveite na loja!", "Fale com a equipe!"`. Sem outras alterações na seção de campos.
    2. **spotlight:** inserir apenas o bloco; manter os exemplos de CTA atuais ("Confira já!", "Venha conhecer!", "Descubra agora!").
    3. **exclusive:** inserir apenas o bloco; manter os exemplos de CTA atuais ("Saiba mais!", "Consulte-nos!", "Garanta o seu!") — compatível com o ban de preço/condições já existente nesse prompt.
    4. Não alterar tabela de informações, formato de saída JSON, nem as demais seções.
  </action>
  <verify>
    <automated>npx vitest run src/lib/copy/__tests__/copy-director-prompt.test.ts 2>&1 | Select-String "Test Files|Tests "</automated>
  </verify>
  <done>Os 4 prompts contêm a seção "### Precisão comercial" (bloco curto em tom criativo, com "fatos protegidos", categorias de condições proibidas, inferência, CTAs neutros e criatividade permitida); offer e base sem o exemplo antigo "Clique e compre!" e com os novos exemplos neutros; sem variável nova e sem alterações fora dos prompts.</done>
</task>

<task type="auto">
  <name>Task 2: Testes de conteúdo dos prompts por âncoras conceituais (novo copy-director-prompt.test.ts)</name>
  <files>src/lib/copy/__tests__/copy-director-prompt.test.ts</files>
  <action>
    Criar `src/lib/copy/__tests__/copy-director-prompt.test.ts` seguindo o padrão de `src/lib/campaign/__tests__/prompt-reframe.test.ts` (leitura direta do arquivo, sem modelo real):

    1. Helper `readPrompt(name)` → `readFileSync(path.join(process.cwd(), "prompts", name), "utf-8")`; importar `describe, it, expect` de `vitest` e `readFileSync` de `node:fs`.
    2. Constante `PROMPTS = ["campaign-copy-director.md", "campaign-copy-director-offer.md", "campaign-copy-director-spotlight.md", "campaign-copy-director-exclusive.md"]`.
    3. Constantes de âncora (texto EXATO do bloco da Task 1, conceituais — NÃO lista de tokens):
       - `SECTION_HEADER = "### Precisão comercial"`
       - `PROTECTED_FACTS = "fatos protegidos"`
       - `NO_INFERENCE = "Não transforme inferências em fatos comerciais"`
       - `SALES_CONDITIONS = "entrega, frete, retirada, compra online"`
       - `PAYMENT_STOCK = "parcelamento, garantia, estoque, últimas unidades"`
       - `CREATIVITY_ALLOWED = "Pode criar desejo, urgência emocional"`
       - `NEUTRAL_CTAS = ["Visite a loja", "Confira na loja", "Fale com a equipe", "Venha conhecer"]`
    4. Testes:
       - **1:** os 4 prompts contêm `SECTION_HEADER`.
       - **2:** os 4 prompts contêm `PROTECTED_FACTS` e `NO_INFERENCE`.
       - **3:** os 4 prompts contêm as âncoras de condições proibidas por categoria — `SALES_CONDITIONS` e `PAYMENT_STOCK` (cobre tele-entrega/delivery por "entrega", compra online, parcelamento, garantia, estoque, últimas unidades).
       - **4:** os 4 prompts contêm `CREATIVITY_ALLOWED` (criatividade explicitamente permitida — bloqueio é de fatos comerciais, não linguagem emocional).
       - **5:** os 4 prompts contêm todos os CTAs neutros (`NEUTRAL_CTAS`) — canal de compra não informado → CTA de loja física.
       - **6 (negativo):** nenhum dos 4 prompts contém `"Clique e compre!"` nem a string `"Clique e compre"` (o bloco curto nem menciona o termo — ausência total garantida em offer/base após D4 e nos demais por não constar em lugar nenhum).
    5. Sem chamada a modelo real; apenas assert sobre o conteúdo carregado. Mantém `CampaignIntent`/schema intocados.
  </action>
  <verify>
    <automated>npx vitest run src/lib/copy/__tests__/copy-director-prompt.test.ts 2>&1 | Select-String "Test Files|Tests "</automated>
  </verify>
  <done>Novo teste de conteúdo dos 4 prompts verde, por âncoras conceituais (header, fatos protegidos, inferência, categorias de condições, criatividade permitida, CTAs neutros, ausência total de 'Clique e compre'); sem chamar modelo real; service/schema/mapper intocados.</done>
</task>

</tasks>

<verification>
1. `npx vitest run src/lib/copy/__tests__/copy-director-prompt.test.ts` — novo teste de conteúdo verde (cobre offer + spotlight + exclusive + base)
2. `npx vitest run src/lib/copy/__tests__/copy-director-service.test.ts` — regressão do serviço (schema/parse/onCall/mapper intactos)
3. `npx vitest run src/lib/campaign/__tests__/prompt-reframe.test.ts` — regressão do padrão de teste de prompt (não afetado)
4. `npm run typecheck` — sem erros
5. `npm run lint` — sem erros
6. Grep gate: `Select-String -Pattern 'Clique e compre' -Path prompts/campaign-copy-director.md,prompts/campaign-copy-director-offer.md,prompts/campaign-copy-director-spotlight.md,prompts/campaign-copy-director-exclusive.md` → zero ocorrências; `Select-String -Pattern 'Precisão comercial' -Path prompts/campaign-copy-director.md,prompts/campaign-copy-director-offer.md,prompts/campaign-copy-director-spotlight.md,prompts/campaign-copy-director-exclusive.md` → uma ocorrência por arquivo
</verification>

<success_criteria>
- Os 4 prompts de copy contêm a seção `### Precisão comercial` curta em tom de direção criativa: "fatos protegidos", categorias de condições proibidas ("entrega, frete, retirada, compra online"; "parcelamento, garantia, estoque, últimas unidades"; "tamanhos, cores, gêneros, variações, prazos ou disponibilidade"), "Não transforme inferências em fatos comerciais", CTAs neutros de loja física e criatividade explicitamente permitida ("Pode criar desejo, urgência emocional e benefício percebido").
- O exemplo de CTA "Clique e compre!" foi removido; offer e base usam "Garanta já o seu!", "Aproveite na loja!", "Fale com a equipe!"; nenhum dos 4 prompts contém "Clique e compre".
- Novo teste de conteúdo cobre pelo menos offer e spotlight (e exclusive + base), por âncoras conceituais, sem chamar modelo real, seguindo o padrão `prompt-reframe.test.ts`.
- Criatividade preservada: o bloco é curto e não lista proibições em bullets — bloqueio é de fatos comerciais, não de linguagem emocional; evita o modelo ecoar a lista proibida.
- Zero mudanças em schema (`CopyDirectorInputSchema`/`CopyDirectorResultSchema`), `mapper.ts`, `copy-director-service.ts`, backend/rota e formulário.
- Gates verdes: teste de conteúdo + regressão (copy service, prompt-reframe) + typecheck + lint.
</success_criteria>

<output>
Create `.planning/quick/260820-pae-copy-director-anti-invencao-comercial-ad/260820-pae-SUMMARY.md` when done (após aprovação e execução)
</output>