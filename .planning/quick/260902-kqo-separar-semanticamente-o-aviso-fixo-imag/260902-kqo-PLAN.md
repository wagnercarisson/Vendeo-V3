---
phase: 260902-kqo-separar-aviso-ilustrativo-diretor
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/image-generation/services/image-generation-service.ts
  - src/lib/image-generation/services/__tests__/image-generation-service.test.ts
  - prompts/campaign-image-director.md
  - prompts/campaign-image-director-offer.md
  - prompts/campaign-image-director-spotlight.md
  - prompts/campaign-image-director-exclusive.md
  - src/lib/campaign/__tests__/prompt-reframe.test.ts
autonomous: true
requirements:
  - KQO-DIRECTOR-SPLIT
  - KQO-PROMPT-SEMANTIC
  - KQO-NO-UI-REGRESSION
must_haves:
  truths:
    - "Quando o lojista marca o aviso ilustrativo E digita texto livre, o diretor de imagem recebe DOIS campos semanticamente distintos: 'Texto obrigatório na arte' ({{mandatoryArtworkText}}) com APENAS o texto livre do lojista, e 'Aviso ilustrativo' ({{illustrativeNotice}}) com a constante canônica 'Imagem meramente ilustrativa'"
    - "Quando o lojista marca o aviso sem texto livre, {{mandatoryArtworkText}} fica vazio e {{illustrativeNotice}} = constante canônica (o aviso continua sendo exibido na arte, mínimo/lateral)"
    - "Quando o lojista NÃO marca o aviso (texto livre apenas), {{mandatoryArtworkText}} carrega o texto integral e {{illustrativeNotice}} fica vazio — comportamento de legado/free-only preservado"
    - "A instrução do diretor (nos 4 prompts) manda renderizar o aviso ilustrativo com texto mínimo, legível e discreto, separado dos demais textos e posicionado nas laterais (horizontal/vertical) da arte, sem competir com oferta, produto e preço"
    - "UI, contrato HTTP (body.mandatoryArtworkText), schema público, snapshot/domínio (commercial.legalNotice.text) e o revisor de imagem continuam consumindo o texto integral concatenado exatamente como hoje — zero mudança fora da montagem/instrução do diretor"
  artifacts:
    - path: "src/lib/image-generation/services/image-generation-service.ts"
      provides: "buildPromptVariables passa a expor mandatoryArtworkText (texto livre apenas) + illustrativeNotice (constante canônica ou vazio), via split determinístico do legalNotice.text"
      exports: ["mandatoryArtworkText", "illustrativeNotice"]
      contains: "ILLUSTRATIVE_NOTICE_TEXT"
    - path: "prompts/campaign-image-director.md"
      provides: "Linha de tabela 'Aviso ilustrativo' + instrução separada aviso × texto obrigatório (oferta/geral)"
      contains: "{{illustrativeNotice}}"
    - path: "prompts/campaign-image-director-offer.md"
      provides: "Mesma separação semântica no diretor runtime de intent offer"
      contains: "{{illustrativeNotice}}"
    - path: "prompts/campaign-image-director-spotlight.md"
      provides: "Mesma separação semântica no diretor runtime de intent spotlight"
      contains: "{{illustrativeNotice}}"
    - path: "prompts/campaign-image-director-exclusive.md"
      provides: "Mesma separação semântica no diretor runtime de intent exclusive"
      contains: "{{illustrativeNotice}}"
  key_links:
    - from: "src/lib/image-generation/services/image-generation-service.ts (buildPromptVariables ~L943-945)"
      to: "prompts/campaign-image-director-{offer|spotlight|exclusive}.md"
      via: "interpolação de {{mandatoryArtworkText}} e {{illustrativeNotice}} pelo PromptLoader em assemblePrompt/validatePrompts"
      pattern: "illustrativeNotice"
    - from: "src/lib/image-generation/services/image-generation-service.ts"
      to: "src/lib/campaign/constants.ts"
      via: "import de ILLUSTRATIVE_NOTICE_TEXT (fonte única — remove literal hardcoded dos prompts)"
      pattern: "ILLUSTRATIVE_NOTICE_TEXT"
    - from: "src/lib/campaign/__tests__/prompt-reframe.test.ts"
      to: "prompts/campaign-image-director*.md"
      via: "readPrompt com asserts de presença/ausência (grep-consistência dos 4 prompts)"
      pattern: "illustrativeNotice"
---

<objective>
Separar semanticamente, APENAS na montagem/instrução do diretor de imagem, o aviso fixo
"Imagem meramente ilustrativa" (constante `ILLUSTRATIVE_NOTICE_TEXT`) do texto obrigatório
livre do lojista. Hoje o `legalNotice.text` chega ao diretor como UM campo único
concatenado (`Imagem meramente ilustrativa\n<texto livre>`); a partir desta mudança o
diretor recebe duas variáveis distintas — `mandatoryArtworkText` (texto livre do lojista,
sem o aviso) e `illustrativeNotice` (constante canônica quando o checkbox está marcado) —
e uma instrução simples: aviso com texto mínimo, legível, discreto, separado dos demais
textos e posicionado nas laterais da arte.

Purpose: dar ao diretor informação determinística sobre QUAL parte do texto é o aviso
ilustrativo fixo (legal, mínimo, lateral) e QUAL é o texto comercial do lojista (obrigatório,
com peso visual normal), eliminando a necessidade de o modelo inferir isso dentro de uma
string concatenada. Sem inchaço nos prompts e sem complexidade nova: o split é uma função
pura de prefixo determinístico no único ponto de montagem das variáveis do diretor.

Limites (NÃO alterar — KQO-NO-UI-REGRESSION): UI/form (`use-campaign-form.ts` +
`buildMandatoryArtworkText`), contrato HTTP (`body.mandatoryArtworkText`), schema público
(`image-generation/schema.ts`), domínio/snapshot (`brief.ts:166-168` mapper →
`commercial.legalNotice.text` integral, com nova linha preservada — teste 8.8
`brief.test.ts:299` continua verde) e o revisor de imagem (`image-review-service.ts` +
`prompts/campaign-image-reviewer.md`, que segue recebendo o texto integral via
`legalNoticeText`). Fora do escopo também: copy director (não consome o campo) e demais
prompts/geradores.

Output: `image-generation-service.ts` com split + chave nova `illustrativeNotice`; 4 prompts
do diretor com linha de tabela e instrução separadas; golden tests 38→39 keys co-migrados;
`prompt-reframe.test.ts` co-migrado.
</objective>

<execution_context>
@C:/Users/wagne/.config/opencode/get-shit-done/workflows/execute-plan.md
@C:/Users/wagne/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@src/lib/campaign/constants.ts
@prompts/campaign-image-director.md
@prompts/campaign-image-director-offer.md
@prompts/campaign-image-director-spotlight.md
@prompts/campaign-image-director-exclusive.md
@src/lib/image-generation/services/image-generation-service.ts
@src/lib/image-generation/services/__tests__/image-generation-service.test.ts
@src/lib/campaign/__tests__/prompt-reframe.test.ts

# Investigação (pontos exatos de alteração)
- `src/lib/campaign/constants.ts:1` — `export const ILLUSTRATIVE_NOTICE_TEXT = "Imagem meramente ilustrativa";` (fonte única canônica).
- `src/lib/image-generation/services/image-generation-service.ts:943-945` — ÚNICO ponto onde o texto chega ao diretor:
  `mandatoryArtworkText: brief.commercial.legalNotice?.enabled ? (brief.commercial.legalNotice.text ?? "") : ""` dentro de `buildPromptVariables` (retorna `Record<string,string>`; consumido em assemblePrompt L974-992 e validatePrompts L618). É AQUI que o split acontece. Import de `@/lib/campaign/constants` será adicionado (arquivo já importa `@/lib/...`, sem ciclo).
- Prompts runtime do diretor (assemblePrompt usa `campaign-image-director-${intent}`): `-offer.md` (L30 tabela + L133-135 cauda), `-spotlight.md` (L28 + L129-131), `-exclusive.md` (L28 + L138-140). O arquivo base `campaign-image-director.md` (L30 + L132-134) cobre offer/geral e é guardado por teste — as 4 caudas têm as MESMAS duas frases. Todos têm a linha `| **Texto obrigatório na arte** | {{mandatoryArtworkText}} |` como ÚLTIMA linha da tabela (antes do `---`).
- Cadeia imutável do texto concatenado (confirma que UI/contrato/snapshot NÃO mudam): `use-campaign-form.ts` `buildMandatoryArtworkText` (L405+, formato `${ILLUSTRATIVE_NOTICE_TEXT}\n${free}` — testes `use-campaign-form-notice.test.ts:146-150`) → `body.mandatoryArtworkText` → `brief.ts:166-168` mapper → `legalNotice = { enabled: true, text: input.mandatoryArtworkText }` (integral, nova linha preservada — `brief.test.ts:299-310`) → diretor (L943-945) e revisor (`image-review-service.ts:48` `buildMandatoryArtworkTextSection(input.legalNoticeText)` — NÃO MEXER).
- O formato concatenado é determinístico: quando o checkbox está marcado, a constante é SEMPRE o prefixo seguido de `\n` (ou é o texto inteiro quando sem texto livre). Texto legado/free-only (checkbox desmarcado) não casa com o prefixo canônico e cai integralmente em `mandatoryArtworkText` (comportamento preservado).

<interfaces>
<!-- Contratos existentes que o executor NÃO deve renegociar -->

From src/lib/campaign/constants.ts:
export const ILLUSTRATIVE_NOTICE_TEXT = "Imagem meramente ilustrativa";

From src/lib/image-generation/services/image-generation-service.ts (contexto da mudança):
private buildPromptVariables(brief: CampaignBrief, context: ResolvedCampaignContext, effectiveProductName: string, inferredCategory?: string): Record<string, string>
// hoje, ~L943-945 (dentro do objeto retornado):
mandatoryArtworkText: brief.commercial.legalNotice?.enabled ? (brief.commercial.legalNotice.text ?? "") : "",
// retorno atual do golden test: 38 keys EXATAS (EXPECTED_KEYS, test 8.16/8.18/9.5/20)
// validatePrompts (L613-684) roda antes de qualquer chamada de IA e falha rápido se sobrar {{var}} não resolvida.

From src/lib/image-generation/services/image-review-service.ts (NÃO alterar):
// Revisor recebe o texto INTEGRAL concatenado via ImageReviewInput.legalNoticeText
// (service L419-421 / validatePrompts L645-647) → buildMandatoryArtworkTextSection → var mandatoryArtworkTextSection.
// Os testes image-review-service.test.ts:188-270 garantem que o revisor continua vendo o texto inteiro.

Convenção dos testes-golden: image-generation-service.test.ts L556-567 lista EXPECTED_KEYS (38)
e os testes 8.16/8.16-spotlight/8.16-exclusive/9.5/20 (L579-667) validam conjunto EXATO + tamanho 38 +
valores; createMinimalBrief({ mandatoryArtworkText: "..." }) monta o flat input → mapper → legalNotice.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Split semântico na montagem das variáveis do diretor + co-migração dos golden tests (KQO-DIRECTOR-SPLIT)</name>
  <files>
    src/lib/image-generation/services/image-generation-service.ts
    src/lib/image-generation/services/__tests__/image-generation-service.test.ts
  </files>
  <action>
    **Import (image-generation-service.ts):** adicionar `import { ILLUSTRATIVE_NOTICE_TEXT } from "@/lib/campaign/constants";` junto aos demais imports de `@/lib/...` (constants.ts não importa nada — sem risco de ciclo; arquivo é client-safe).

    **Split determinístico — função pura module-scope (NÃO exportada), definida perto de `buildPromptVariables`:**
    `splitDirectorLegalText(combined: string): { merchantText: string; illustrativeNotice: string }`, com a seguinte lógica exata sobre o parâmetro `combined` (que já vem resolvido: `brief.commercial.legalNotice?.enabled ? (brief.commercial.legalNotice.text ?? "") : ""`):
    1. `combined === ILLUSTRATIVE_NOTICE_TEXT` → `{ merchantText: "", illustrativeNotice: ILLUSTRATIVE_NOTICE_TEXT }`;
    2. senão, se `combined.startsWith(ILLUSTRATIVE_NOTICE_TEXT + "\n")` → `{ merchantText: combined.slice(ILLUSTRATIVE_NOTICE_TEXT.length + 1), illustrativeNotice: ILLUSTRATIVE_NOTICE_TEXT }`;
    3. senão → `{ merchantText: combined, illustrativeNotice: "" }` (texto livre/legado integral — comportamento atual preservado byte a byte).
    Comentário de bloco explicando o porquê (quick KQO): o formato concatenado é sempre produzido pelo helper do form `${ILLUSTRATIVE_NOTICE_TEXT}\n${free}` (use-campaign-form.ts buildMandatoryArtworkText); o split acontece SOMENTE na montagem das variáveis do diretor — UI, contrato HTTP, snapshot/domínio (`legalNotice.text` integral) e o revisor de imagem continuam consumindo o texto completo como hoje.

    **No objeto retornado por `buildPromptVariables`:** substituir o campo `mandatoryArtworkText:` das linhas ~943-945 por desestruturação do split: `const { merchantText, illustrativeNotice } = splitDirectorLegalText(<expressão atual do legalNotice>);` e, no retorno, trocar `mandatoryArtworkText:` pela chave `mandatoryArtworkText: merchantText` e ADICIONAR a chave `illustrativeNotice,`. A chave nova DEVE estar sempre presente no mapa (valor vazio quando não há aviso) para o `PromptLoader` resolver os placeholders dos prompts da Task 2 e o `validatePrompts` (L613-684) continuar fail-fast válido. O restante do retorno não muda.

    **Co-migração dos golden tests (image-generation-service.test.ts, describe "golden tests por intent" L555-667):**
    - `EXPECTED_KEYS` (L556-567): adicionar `'illustrativeNotice'` (após `'mandatoryArtworkText'`; a lista é comparada ordenada — posição irrelevante para os asserts, mantém organização alfabética).
    - Atualizar `toHaveLength(38)` → `toHaveLength(39)` nas linhas 589, 606, 617, 642 e 665; ajustar os nomes dos testes 8.16/8.16-spotlight/8.16-exclusive/9.5/20 que citam "38 keys" para "39 keys" (L579/598/612/634/648) e o `describe` central se citar o número.
    - Teste 8.16 (L583-594): o brief usa `mandatoryArtworkText: 'Imagem meramente ilustrativa'` (aviso SEM texto livre) → caso (1) do split: trocar o assert de `vars.mandatoryArtworkText` para `''` e ADICIONAR `expect(vars.illustrativeNotice).toBe('Imagem meramente ilustrativa')`.
    - Teste 9.5 (L634-646): idem (mesmo fixture aviso-only).
    - Teste 9.3 (L622-632): manter os asserts de `mandatoryArtworkText` vazio e ADICIONAR `expect(...illustrativeNotice).toBe('')` para spotlight e exclusive (legalNotice ausente → ambas vazias).
    - ADICIONAR casos novos no mesmo describe (importar `ILLUSTRATIVE_NOTICE_TEXT` de `@/lib/campaign/constants` no topo do arquivo e montar fixtures via `createMinimalBrief({ mandatoryArtworkText })`):
      (a) aviso + texto livre: fixture `\`${ILLUSTRATIVE_NOTICE_TEXT}\nTexto promocional\`` → `vars.mandatoryArtworkText === 'Texto promocional'` e `vars.illustrativeNotice === ILLUSTRATIVE_NOTICE_TEXT`;
      (b) texto livre apenas (checkbox desmarcado): fixture `'Texto promocional'` → `vars.mandatoryArtworkText === 'Texto promocional'` e `vars.illustrativeNotice === ''`;
      (c) texto legado que começa com a constante mas SEM `\n` (ex.: `'Imagem meramente ilustrativa de produtos'`): cai em free-only → `vars.mandatoryArtworkText` = string integral e `vars.illustrativeNotice === ''` (comportamento atual preservado).
    - NÃO tocar nos testes de validatePrompts (L230-282) nem nos testes que usam loader mockado: o revisor segue recebendo o texto integral via `legalNoticeText` e `vars.mandatoryArtworkTextSection` continua contendo a string completa (KQO-NO-UI-REGRESSION).
  </action>
  <verify>
    <automated>npx vitest run src/lib/image-generation/services/__tests__/image-generation-service.test.ts --reporter=verbose</automated>
  </verify>
  <done>
    - `splitDirectorLegalText` implementada com os 3 casos determinísticos; `buildPromptVariables` retorna `mandatoryArtworkText` (só texto livre) + `illustrativeNotice` (constante ou vazio), sempre presentes no mapa
    - Golden tests: conjunto EXATO de 39 keys em offer/spotlight/exclusive/multi-imagem; 8.16/9.5 ajustados para aviso-only (mandatoryArtworkText vazio + illustrativeNotice canônico); novos casos (a)(b)(c) verdes
    - `image-generation-service.test.ts` inteiro verde (validatePrompts/reviewer intocados); teste 9.3 cobre ambas as chaves vazias
  </done>
</task>

<task type="auto">
  <name>Task 2: Instrução semanticamente separada nos 4 prompts do diretor + co-migração do prompt-reframe.test.ts (KQO-PROMPT-SEMANTIC)</name>
  <files>
    prompts/campaign-image-director.md
    prompts/campaign-image-director-offer.md
    prompts/campaign-image-director-spotlight.md
    prompts/campaign-image-director-exclusive.md
    src/lib/campaign/__tests__/prompt-reframe.test.ts
  </files>
  <action>
    **Nos 4 prompts (`campaign-image-director.md`, `-offer.md`, `-spotlight.md`, `-exclusive.md`) — duas edições idênticas por arquivo:**

    Edit 1 — linha de tabela: imediatamente após a linha `| **Texto obrigatório na arte** | {{mandatoryArtworkText}} |` (última linha da tabela "Informações da Campanha"), adicionar a linha exata:
    `| **Aviso ilustrativo** | {{illustrativeNotice}} |`

    Edit 2 — cauda (substituir as DUAS frases existentes, que hoje são idênticas nos 4 arquivos, pelas duas abaixo — os rótulos entre aspas e os placeholders devem permanecer literais):
    - REMOVER a frase: `Quando houver texto obrigatório/aviso legal informado, exiba exatamente esse texto na arte. Se o aviso for "Imagem meramente ilustrativa", posicione-o com tipografia mínima, mas visível e legível, em área lateral horizontal ou vertical, sem competir com oferta, produto e preço.`
    - SUBSTITUIR pela frase A (aviso ilustrativo, um parágrafo, mesma posição):
      `Se o campo "Aviso ilustrativo" estiver preenchido ({{illustrativeNotice}}), exiba exatamente esse texto na arte com tipografia mínima, discreta e legível, separado dos demais textos e posicionado em área lateral (horizontal ou vertical) da peça, sem competir com oferta, produto e preço.`
    - SUBSTITUIR a frase mantida (texto obrigatório) pela frase B (inserir "exatamente" — preserva a regra de fidelidade que a frase removida carregava):
      `Se o campo "Texto obrigatório na arte" estiver preenchido ({{mandatoryArtworkText}}), inclua exatamente esse texto na arte de forma visível e legível, em tipografia mínima adequada para leitura em dispositivo móvel. Não o repita na legenda.`
    Resultado: o literal canônico "Imagem meramente ilustrativa" NÃO deve mais existir hardcoded nos 4 prompts (fonte única = constante injetada via `{{illustrativeNotice}}` na Task 1). Manter o parágrafo "Validade com data" e toda a demais estrutura intactos.

    **Co-migração de `src/lib/campaign/__tests__/prompt-reframe.test.ts`:**
    - Constantes: substituir `BLOCO_CONDICIONAL` (L17-18) pela constante `LINHA_AVISO_SEPARADO` com o texto EXATO da frase A acima; atualizar `LINHA_MANTIDA` (L19-20) para o texto EXATO da frase B; adicionar `LINHA_TABELA_AVISO = "| **Aviso ilustrativo** | {{illustrativeNotice}} |"`. `LINHA_VALIDADE` e `PROMPTS` ficam como estão.
    - Teste 17 (L34-40): passar a exigir que os 4 prompts contenham `LINHA_AVISO_SEPARADO`, a `LINHA_MANTIDA` atualizada e `LINHA_TABELA_AVISO`.
    - Check B (L49-56): reescrever a semântica — em vez de exigir o literal canônico nos prompts, exigir o oposto (fonte única via variável): para cada um dos 4 prompts, `not.toContain("Imagem meramente ilustrativa")` (zero literal hardcoded), `toContain("{{illustrativeNotice}}")` e `not.toContain("Imagens meramente ilustrativas")` (plural nunca); manter o assert de que `ILLUSTRATIVE_NOTICE_TEXT` é o literal canônico singular.
    - Testes 16, check A e 21 (F41) permanecem inalterados (validam que NÃO voltou a imposição fixa, linha de validade e bloco 1+N).

    **Regressão de superfícies intocadas (KQO-NO-UI-REGRESSION):** NÃO editar `image-review-service.ts`/`campaign-image-reviewer.md`, `image-generation/schema.ts`, `brief.ts`/snapshot, `use-campaign-form.ts`, rotas ou fixtures de rota. Rodar os arquivos de teste dessas superfícies para provar que continuam verdes com o texto integral concatenado.
  </action>
  <verify>
    <automated>npx vitest run src/lib/campaign/__tests__/prompt-reframe.test.ts src/lib/image-generation/services/__tests__/image-review-service.test.ts src/components/flow/__tests__/use-campaign-form-notice.test.ts src/lib/campaign/__tests__/brief.test.ts --reporter=verbose; npx vitest run src/lib/image-generation/services/__tests__/image-generation-service.test.ts --reporter=verbose</automated>
  </verify>
  <done>
    - 4 prompts com a linha `| **Aviso ilustrativo** | {{illustrativeNotice}} |` e as frases A/B; zero ocorrências do literal "Imagem meramente ilustrativa" nos 4 prompts (grep em `prompts/campaign-image-director*.md` → 0)
    - `prompt-reframe.test.ts` co-migrado e verde (17 + check B novos); testes 16/check A/21 verdes
    - Suites de revisor (`image-review-service.test.ts`), UI (`use-campaign-form-notice.test.ts`) e domínio (`brief.test.ts` — texto integral preservado) verdes SEM edição dessas superfícies
    - `image-generation-service.test.ts` verde; nenhum `{{` não resolvido possível: mapa sempre expõe `mandatoryArtworkText` e `illustrativeNotice`
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| domínio do brief (server) → variáveis do prompt do diretor | Texto do lojista (livre) e constante canônica cruzam a montagem do prompt; o split é server-side puro, sem nova superfície de input externo |
| variáveis → PromptLoader → template do diretor | Interpolação de placeholders; qualquer `{{var}}` sem valor quebra a geração (validatePrompts fail-fast) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-KQO-01 | Spoofing | splitDirectorLegalText (buildPromptVariables) | mitigate | Prefixo determinístico com a constante canônica importada de `src/lib/campaign/constants.ts` (fonte única): texto livre do lojista não consegue "vestir" a constante nem alterá-la — quando o prefixo canônico+`\n` existe, a constante exibida na arte é SEMPRE a do código, re-injetada server-side |
| T-KQO-02 | Tampering | prompts do diretor × mapa de variáveis | mitigate | Chaves `mandatoryArtworkText` e `illustrativeNotice` sempre presentes no mapa (valor vazio quando ausente); `validatePrompt` roda antes da chamada de IA e falha com `invalid_prompt`/erro de validação se sobrar placeholder; golden tests de conjunto EXATO (39 keys) + prompt-reframe (placeholders presentes) travam o contrato |
| T-KQO-03 | Tampering | literal canônico duplicado em prompts | mitigate | Remoção do literal hardcoded dos 4 prompts + teste check B (prompt-reframe) exigindo `not.toContain("Imagem meramente ilustrativa")` nos prompts — deriva de constante duplicada vira falha de teste |
| T-KQO-04 | Information disclosure | texto livre do lojista em prompt | accept | Exposição pré-existente (texto do lojista já chegava ao prompt concatenado); o split não aumenta a superfície e não altera o revisor nem o snapshot |
| T-KQO-05 | Tampering | npm/pip/cargo installs | accept | Nenhuma instalação de pacote neste plano (sem package-legacy gate aplicável) |
</threat_model>

<verification>
- Split: `grep -c "illustrativeNotice" src/lib/image-generation/services/image-generation-service.ts` ≥ 2 (chave no retorno + uso na desestruturação); `splitDirectorLegalText` presente
- 4 prompts co-migrados: `Select-String -Path "prompts/campaign-image-director*.md" -Pattern "illustrativeNotice"` → 4 arquivos, cada um ≥ 2 ocorrências (linha de tabela + frase A); `Select-String -Path "prompts/campaign-image-director*.md" -Pattern "Imagem meramente ilustrativa"` → 0 (literal removido)
- Goldens: conjunto EXATO de 39 keys (offer/spotlight/exclusive + multi-imagem F41); `use-campaign-form-notice.test.ts` (UI) e `image-review-service.test.ts` (revisor) verdes SEM edição
- Suites verdes: `prompt-reframe.test.ts`, `image-generation-service.test.ts`, `image-review-service.test.ts`, `use-campaign-form-notice.test.ts`, `brief.test.ts` (texto integral em `legalNotice.text` preservado — KQO-NO-UI-REGRESSION)
- `npm run typecheck` limpo (novo import de `@/lib/campaign/constants` resolvido)
</verification>

<success_criteria>
- O diretor de imagem recebe o aviso ilustrativo fixo como campo separado (`illustrativeNotice`) do texto obrigatório livre (`mandatoryArtworkText`) — 39 keys no mapa de variáveis, chave nova sempre presente
- A instrução dos 4 prompts é simples e sem inchaço: aviso com texto mínimo, legível e discreto, separado dos demais textos, posicionado nas laterais da arte; texto obrigatório do lojista renderizado com tipografia mínima legível e fidelidade exata
- Casos determinísticos cobertos por teste: aviso-only, aviso+texto livre, texto livre-only, legado sem `\n` (integral preservado)
- Literal canônico tem fonte única (`ILLUSTRATIVE_NOTICE_TEXT` em constants.ts) — zero hardcode residual nos 4 prompts
- Nenhuma alteração em UI, contrato HTTP, schema público, snapshot/domínio ou revisor de imagem; suítes dessas superfícies verdes sem edição
- Suites de teste e typecheck verdes; regressão opcional (manual, não bloqueante): gerar campanha com aviso marcado + texto livre para confirmar a separação visual na arte
</success_criteria>

<output>
Create `.planning/quick/260902-kqo-separar-semanticamente-o-aviso-fixo-imag/260902-kqo-SUMMARY.md` when done
</output>
