# Quick — 261017-cdi — Investigação: dominância das cores do produto sobre a identidade da loja (Flare × Sunburst)

**Tipo:** investigação **somente leitura**. Nenhum prompt alterado, nenhum provider chamado, nenhuma flag ligada, produção intocada.
**Data:** 2026-10-17
**Escopo:** fluxo Produto 1:1 (novo fluxo), campanhas geradas na instância `vendeo-homolog` com `gpt-image-2.5-flare/medium` e `gpt-image-2.5-sunburst/medium`.

---

## 1. Fontes recuperadas (read-only)

| Item | Origem | Valor |
|------|--------|-------|
| Campanha Sunburst | `campaigns` | `e043e52e-4df0-48b4-bd01-0d1b43b5de01` (Morango & Pêssego), `operation_run_id abd6ed1a…` |
| Campanha Flare | `campaigns` | `6ecef78c-0e7d-444c-871b-b8da722abb2d` (Morango & Pêssego), `operation_run_id 4269472e…` |
| Histórica (comparação) | `campaigns` | `20d54b1d-f603-4dd1-8eac-051da18b5147` (Figo & Maçã, `gpt-image-2/medium`) |
| Loja | `stores` | `48b212f8-2b0f-4679-b553-122a601bacac` — "Adega Mestre das Geladas", segmento `bebidas-adegas-conveniencia`, `brand_color #242422`, `identity_state logo` |
| Evidência congelada | `product_1_1_snapshot_frozen_evidence` | `background_direction = studio`; `composer 48.2.4-prompt-composer-v6`; `base 48.2.6-produto-1-1-v1`; políticas `produto-v4`, `oferta-v2`, `fundo 48.2.6-background-direction-v1` |
| Direção de identidade congelada | `campaigns.input_snapshot.identityDirective` | texto de assinatura/logo (ver §4) |
| Perfil de marca da loja | `store_brand_profiles` (status `synced`) | `safe_color_tokens {primary:#242422, accent:#828280, secondary:#5F5F5D, background:#FFFFFF}`; `brand_colors_chosen []`; `typography_direction`, `visual_style`, `campaign_guidelines` presentes |
| Execução do provider | `generation_events` | Flare e Sunburst `success`; `images.edit`; `medium`; usage `input_tokens 2300` (texto 478 + imagem 1822), `output_tokens 439` |

As duas campanhas novas (Flare e Sunburst) possuem **entradas congeladas idênticas** — `briefing`, `identityDirective`, `backgroundDirection = studio`, `referenceSelections` — diferindo apenas no modelo. Logo, **o prompt enviado é o mesmo** nas duas.

## 2. Prompt efetivamente enviado (reconstruído do congelado + compositor v6)

O texto do prompt **não é persistido** (só o `briefing`/evidência e o usage). Reconstruído deterministicamente executando o compositor puro (`composeProductPrompt`, sem provider) com os valores congelados, e conferido contra o código-fonte:

```
[IDENTIDADE E DIREÇÃO VISUAL]
Assinar a campanha com o logotipo da loja fornecido como imagem de referência. Manter fidelidade ao arquivo fornecido. Considerar a direção visual do perfil de marca como contexto direcional, não obrigatório.

[PRODUTO E IMAGENS DE REFERÊNCIA]
Nome obrigatório na arte: "Red Bull Summer 250ml Morango & Pêssego"
Inclua todas as palavras, números e unidades - nenhuma informação do nome deve ser omitida, as aspas não fazem parte do nome; capitalização, quebras de linha e arranjo livres.
Imagens de referência: 2
A primeira imagem enviada define a variante protagonista: apresente-a maior e em primeiro plano; use as imagens auxiliares como apoio visual secundário.
Reproduza com fidelidade o produto da imagem enviada, incluindo aparência e embalagem.
Descrição: opcional; pode ser adaptada, melhorada ou omitida, preservando o significado.
Textos obrigatórios: exiba cada texto integralmente uma única vez.

[CONDIÇÕES COMERCIAIS]
Direção de fundo: Use um fundo de estúdio discreto, em cor sólida ou gradiente suave, sem cenário ou objetos de apoio.
Preço original: R$ 9,99
Preço de venda: R$ 7,49
Selo: Oferta
Validade: somente hoje
Oferta: destaque o preço por e mantenha o preço de como secundário, quando informado. Não invente informações comerciais.
Respeite a direção de fundo.

[INTENÇÃO E FORMATO]
Formato: quadrado 1:1, com composição quadrada e equilibrada (sem congelar o layout).
Estrutura: peça única.

[INSTRUÇÕES DO PROMPT-BASE]
Crie uma peça profissional e visualmente coerente. Evite elementos decorativos que distraiam do conteúdo principal.

[RESTRIÇÕES E TEXTOS OBRIGATÓRIOS]
Informações obrigatórias na arte: Imagem meramente ilustrativa
Use português correto e natural.
Evite caracteres, símbolos ou pontuação duplicados ou anômalos.
Não corrija silenciosamente os textos de entrada.
```

Bloco `[DIREÇÃO TIPOGRÁFICA]` **ausente** (vazio ⇒ omitido). Versões: `composer 48.2.4-prompt-composer-v6`, `base 48.2.6-produto-1-1-v1`, `intencao 48.2.6-oferta-v2`, `tipoConteudo 48.2.6-produto-v4`, `formato 48.2.4-formato-1-1-v1`, `estrutura 48.2.4-peca-unica-v1`, `tema 48.2.4-tema-nenhum-v1`, `geral 48.2.5-general-integrity-v1`, `fundo 48.2.6-background-direction-v1`.

## 3. Conferência dos quatro eixos pedidos

| Eixo | Situação no prompt efetivo |
|------|-----------------------------|
| **Paleta** | **Ausente.** Nenhuma cor da loja entra no prompt. A loja tem `brand_color #242422` e `safe_color_tokens` com `primary/accent/background`, mas nada disso é transportado. |
| **Referência de identidade** | Apenas o **logotipo** (imagem, última referência) + a diretiva textual de assinatura/fidelidade. Sem nome da loja, sem cor, sem tipografia. |
| **Direção de fundo escolhida** | `studio`: "Use um fundo de estúdio discreto, em cor sólida ou gradiente suave, sem cenário ou objetos de apoio." — sem nenhum vínculo com a identidade da loja. |
| **Instruções de prioridade** | **Não existem** regras de prioridade entre identidade da loja, produto e fundo. O único sinal explícito é que o perfil de marca é "contexto direcional, **não obrigatório**". |

## 4. Diretiva de identidade congelada (igual nas duas campanhas)

> "Assinar a campanha com o logotipo da loja fornecido como imagem de referência. Manter fidelidade ao arquivo fornecido. Considerar a direção visual do perfil de marca como contexto direcional, não obrigatório."

Proveniência: `deriveDirective(identity_state=logo, hasAsset=true)` em `src/lib/store-identity-service.ts`; injetada em `[IDENTIDADE E DIREÇÃO VISUAL]` por `identityContributions()` em `orchestration/generation-orchestrator.ts` (o compositor **só** recebe essa diretiva; o perfil de marca não é enviado).

## 5. Diagnóstico

A causa **não** é apenas "liberdade do modelo". É uma combinação, com peso maior em **composição + dado não transportado**:

1. **Dado existe, mas não é enviado (causa primária de dados).** A loja tem paleta resolvida (`#242422` + `safe_color_tokens` + `campaign_guidelines` "paleta neutra e sofisticada"), mas o fluxo Produto 1:1 **não transporta cor alguma** ao prompt. O bloco de identidade nasce de `deriveDirective`, que só descreve assinatura/fidelidade e rebaixa o perfil de marca a "não obrigatório". A identidade só chega como **imagem** do logo.
2. **Composição sem regra de relação (causa primária de prompt).** Não há instrução de prioridade nem de relação fundo↔identidade↔produto. O `studio` libera o fundo ("cor sólida ou gradiente suave") sem âncora na loja.
3. **Fidelidade de produto forte + vazio de identidade ⇒ deriva cromática.** O bloco de produto manda "reproduza com fidelidade … aparência e embalagem" e o fundo é livre. Sem paleta da loja, o caminho de menor esforço do modelo é **derivar o fundo das cores da embalagem** (azul/prata/vermelho do produto) — exatamente o sintoma relatado.
4. **Liberdade do modelo (fator secundário, não raiz).** O modelo tem liberdade total de fundo/composição por desenho; a liberdade só vira problema porque os itens 1–3 não delimitam identidade nem separação.

**Conclusão:** corrigir apenas com "respeite a paleta" **não basta** — a paleta sequer chega ao modelo neste fluxo, e a única menção à marca é explicitamente "não obrigatória". O ajuste mínimo precisa (a) **transportar** a cor/direção resolvida da loja e (b) **definir prioridade e separação** nos fundos recriados.

### Achado secundário (contribuinte, fora do pedido principal)
`references` enviado ao compositor inclui a imagem de **identidade** junto às de produto. A política `produto` conta `references.length = 2` e dispara a instrução de **múltiplas imagens** ("a primeira imagem define a variante protagonista; use as imagens auxiliares como apoio") mesmo havendo **uma só** imagem de produto. Isso dilui a proeminência do produto e mistura o papel da identidade com o de referência de produto. Registrado para avaliação na proposta.

## 6. Limites desta etapa

- Nenhum arquivo de prompt/código alterado; nenhuma chamada a provider; nenhuma flag/autorização/migração; produção e homolog intocados.
- O prompt enviado foi **reconstruído** (não persistido) a partir da evidência congelada + compositor v6; a reconstrução é determinística e conferida contra o código.
- Consultas ao banco foram apenas `SELECT` na instância local `vendeo-homolog`.

## 7. Proposta e validação

Ver `261017-cdi-PLAN.md` (status **proposed** — aguarda aprovação; **nada executado**).

## 8. Execução (2026-10-17) — orientação do responsável incorporada

Executado **localmente, sem provider** (sem chamadas pagas, flags, migrations, produção ou deploy). Resumo do que foi feito:

- **A. Identidade:** novo `src/lib/product-1-1/identity-context.ts` — paleta canônica resolvida (precedência `brand_colors_chosen[0]` → `safe_color_tokens.primary` → `brand_color`; apoio = `accent`) emitida **uma única vez** no bloco de identidade; presença/ausência **reconciliada** sem “não obrigatório”; **sem paleta** ⇒ orientação neutra explícita (sem inventar cores). Legado (`deriveDirective`) intacto.
- **B. Fundo:** estúdio/ambientado passam a citar **a paleta da loja**; **orientação comum de contraste** emitida **uma única vez** só para esses dois; `original` **intocado** (sem imposição de paleta). Instruções antigas **substituídas** (sem acúmulo); sem proibição genérica de cores da embalagem.
- **C. Referências:** identidade **não** conta como imagem de produto (não dispara múltiplas imagens); referências de produto adicionais continuam contando.
- **D. Congelamento:** `identityDirective` + `identityContext` no `input_snapshot`; `briefing.identity` na evidência; **histórica intocada**.
- **Versões:** composer `v6→v7`; fundo `v1→v2`; nova versão de contexto de identidade.
- **Baseline:** baseline de produção atualizado; `previousBaseline` = `99017f35` (rastreabilidade preservada).

**Gates:** `tsc` 0; focalizados **113/113**; `eslint .` 0; `next build` exit 0; spec `product-1-1-prompt-composition` válida. Falhas de suíte **pré-existentes** (idênticas no tree limpo por `git stash`): `route.test` 26, `legacy-frontier.guard` 3, `submission.contract` 2, `copy-recovery`/`copy-wiring-gaps` 13, integrações Postgres/runner isolado. **0 novas.**

**Antes × depois, diff, versões e gates:** detalhados em `261017-cdi-PLAN.md` §Antes × Depois / §Validação. **A prévia textual comprova a composição, não a melhoria visual** — geração real e inspeção humana ficam para autorização posterior.

## 9. Correções da revisão do responsável (2ª rodada, 2026-10-17)

1. **Acento alinhado à tela** — precedência do acento passa a `brand_colors_chosen[1]` → `safe_color_tokens.accent` (antes só `accent`). Reprodução #AABBCC escolhida → #445566 enviada coberta por teste.
2. **Neutro restrito a fundos recriados** — a orientação neutra (sem paleta) só é emitida em estúdio/ambientado; em `original` não é emitida. Texto: *"Sem paleta da loja definida, use cores neutras e discretas."* Coberto pelo **prompt completo com identidade** (9 combinações) e não apenas pelo compositor sem contribuições.
3. **Versão da identidade registrada** — `PRODUCT_1_1_IDENTITY_CONTEXT_VERSION` agora entra em `policyVersions.identidade` (evidência) + teste de determinismo: mesma identidade ⇒ mesmo fingerprint; cor diferente ⇒ fingerprint diferente.
4. **Proveniência do baseline corrigida** — `sourceCommit: null`, `technicalBaseline: true`, `visualApproval.status: "pending"`; `previousBaseline` = `99017f35`. Expectativa técnica ≠ aprovação visual (pendente).
5. **Guarda de fronteira reconciliada** — rota passou a ser **aditiva** (nenhuma linha removida); manifesto mantém `BASE_SHA`, `LEGACY_FRONTIER_PATHS` e testes negativos e ganhou entradas por caminho+commit+autorização para mudanças já autorizadas de quicks anteriores (gpt6-luna/ms4) e o commit corrigido de `chat-completions.ts`. Guarda **10/10**.

**Gates após as correções:** `tsc` 0; focados **135/135**; `eslint .` 0; `next build` exit 0; spec válida; guarda 10/10. **Sem provider/flags/migrations/produção.** Geração real continua para autorização posterior.

