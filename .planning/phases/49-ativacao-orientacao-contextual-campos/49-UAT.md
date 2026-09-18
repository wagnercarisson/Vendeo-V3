# F49 — UAT Humana de Compreensão (Checklist)

> **Fonte da verdade:** `openspec/changes/fase-49-ativacao-orientacao-contextual-campos/tasks.md` (item 9.5) +
> `.planning/phases/49-ativacao-orientacao-contextual-campos/49-UI-SPEC.md` +
> `49-CONTEXT.md` (§risk_summary). Checklist criado pelo plano **49-13** (Task 1) e
> preenchido pelo aprovador humano na Task 2.

## Cabeçalho

| Campo | Valor |
|---|---|
| **Fase** | 49 — Ativação e Orientação Contextual de Campos |
| **Plano** | 49-13 |
| **Aprovador** | _(preencher)_ |
| **Data da UAT** | _(preencher)_ |
| **Ambiente local** | `npm run dev` (aplicação local, sem IA paga) |
| **Telas avaliadas** | `/loja` (abas Dados e Posicionamento) · `/campanhas/nova` (Produto, Oferta, Avisos) · revisão do brief (F43) |
| **Escopo** | Compreensão do lojista + ausência de poluição visual + decisões editoriais. **Nenhuma alteração de produção** neste plano. |

> **Como avaliar:** faça as perguntas abaixo ao aprovador e registre a resposta dele com as
> próprias palavras. O objetivo **não** é confirmar que um texto aparece, e sim que o lojista
> **entende** o que informar e por quê. Marque `PASS`/`FAIL` na coluna de resultado e registre
> observações/evidências (screenshots, notas) ao lado de cada cenário.

---

## 1. Cenários de compreensão (9 canônicos)

| # | Instrução ao aprovador (pergunta aberta) | Critério de PASS observável | Resultado |
|---|---|---|---|
| 1 | **Dados fiscais × identidade pública.** Abra `/loja` → aba **Dados**. Com suas palavras, qual é a diferença entre **razão social**, **nome fantasia** e **nome da loja**? Onde ficam os dados fiscais e para que servem? | O aprovador diferencia os três conceitos: razão social e nome fantasia são **dados fiscais/oficiais (Receita Federal)** usados para verificação e prontidão do cadastro; **nome da loja** é o **nome público** que identifica e assina as campanhas. Aponta corretamente a subseção "Dados fiscais" e entende que o CNPJ é opcional. | |
| 2 | **Tom de voz.** Ainda na aba **Posicionamento**, selecione diferentes opções de **Tom de Voz**. Para que serve essa escolha? Ela substitui o segmento/subsegmento da loja? | O aprovador explica que o tom define **como a loja se comunica** e é usado nos títulos, legendas e clima visual das campanhas; reconhece que **complementa** (não substitui) o segmento/subsegmento; vê uma descrição curta e positiva **por opção selecionada** e nenhuma descrição quando nada está selecionado. | |
| 3 | **Posicionamento.** Preencha o campo de posicionamento com **proposta, público e diferencial** usando o exemplo. O que o Vendeo faz com essa informação? | O aprovador consegue montar uma frase com público + proposta + diferencial; entende que o posicionamento **influencia diretamente a copy** e, de forma **indireta**, o perfil/direção visual — sem esperar uma transformação visual automática. Usa o exemplo da ajuda expansível. | |
| 4 | **Posicionamento × descrição curta × slogan.** Explique a diferença entre **posicionamento**, **descrição curta** e **slogan**. Qual deles é recomendado e qual é opcional? | O aprovador distingue: posicionamento = como a loja quer ser **percebida** (recomendado); descrição curta = o que vende, para quem e diferencial **factual** (recomendada); slogan = frase pública **já adotada**, **opcional** ("se sua loja já utiliza um"), **sem** selo "Recomendado". | |
| 5 | **Descrição do produto.** Abra `/campanhas/nova` → **Produto**. Preencha a descrição com um produto real da sua loja. O que deve ser escrito nesse campo e para onde essa informação vai? | O aprovador escreve características/benefícios/uso do produto (ex.: tênis leve, solado antiderrapante) e entende que isso alimenta **a comunicação/copy da campanha** — e **não** a arte. | |
| 6 | **Preços e intenção.** Na seção **Oferta**, experimente os 4 estados: **dois preços**, **só preço de venda**, **só preço anterior** e **nenhum preço**. Como cada estado muda o que a campanha pode ser? O que a mensagem exibida diz em cada caso? | O aprovador relaciona os estados às intenções: dois preços = **Oferta**; só venda = **Oferta ou Destaque**; nenhum = **Destaque ou Exclusividade**. No estado **só preço anterior**, lê a mensagem **neutra** "Informe o preço de venda para completar a oferta." (não "Sem preço...") e entende que não é bloqueio. | |
| 7 | **Informações obrigatórias na arte.** Na seção **Avisos**, use "Informações obrigatórias na arte" com **vários detalhes** do produto (uma linha por item). O que acontece com esse texto? | O aprovador insere múltiplos itens em linhas separadas (ex.: `Intensidade 8`, `Torra clássica`, `Peso líquido 500 g`) e entende que são detalhes que **precisam aparecer na imagem** — campo diretamente visível, sem advertência negativa permanente. | |
| 8 | **Validade × aviso ilustrativo.** Localize onde se informa **validade** e onde se marca o **aviso ilustrativo**. Explique a diferença de finalidade entre os dois. | O aprovador identifica corretamente: **validade** trata do **período/data/limitação** da oferta; **aviso ilustrativo** é um **controle próprio** (checkbox) sobre a imagem ser meramente ilustrativa — são coisas distintas e não se misturam. | |
| 9 | **Revisão do brief.** Siga para a **revisão do brief** antes de gerar. Identifique as categorias apresentadas: **aviso ilustrativo**, **informações obrigatórias na arte**, **validade** e **preços/oferta**. Elas estão separadas e reconhecíveis? | O aprovador reconhece as **quatro categorias como itens separados e rotulados** (não concatenados num único parágrafo) e confirma que os rótulos de preço ("Preço anterior" / "Preço de venda") estão coerentes. | |

---

## 2. Matriz de dispositivos (desktop · 375px · 320px)

> Repita os passos principais de cada cenário no dispositivo indicado. Critérios obrigatórios:
> **sem scroll horizontal** e **ajuda colapsada por padrão**.

| Dispositivo | Sem scroll horizontal | Ajuda colapsada por padrão | Toques ≥ 44px | Resultado |
|---|---|---|---|---|
| **Desktop** (>1024px) | _(PASS/FAIL + nota)_ | _(PASS/FAIL + nota)_ | _(PASS/FAIL + nota)_ | |
| **375px** (mobile) | _(PASS/FAIL + nota)_ | _(PASS/FAIL + nota)_ | _(PASS/FAIL + nota)_ | |
| **320px** (mobile estreito) | _(PASS/FAIL + nota)_ | _(PASS/FAIL + nota)_ | _(PASS/FAIL + nota)_ | |

**Observações da matriz de dispositivos:**

- _(preencher)_

---

## 3. Ausência de poluição visual

> Avalie as telas de `/loja` e `/campanhas/nova` (e a revisão do brief). Marque cada item.
> **Nota:** hints inline **aumentam alguma altura** — isso é **esperado** e **não** é falha.

| Item avaliado | Critério de PASS | Resultado |
|---|---|---|
| **Sem lista permanente longa de regras** | As 3 regras de preço ficam em ajuda **expansível colapsada** por padrão, não como bloco permanente de texto. | |
| **Sem advertência negativa permanente** | Nenhum aviso preventivo/negativo fixo é exibido (ex.: "Sem preço...", "cuidado", "atenção"). A microcopy é positiva e educativa. | |
| **Sem tooltip-exclusivo** | Nenhuma informação essencial depende apenas de hover/`title`/tooltip; os hints são visíveis e associados ao campo. | |
| **Sem crescimento excessivo de altura** | Os hints inline acrescentam apenas alguma altura (esperado); a página não cresce de forma desproporcional nem empurra conteúdo de forma excessiva. | |
| **Sem scroll horizontal** | Em 320px/375px não há scroll horizontal em nenhuma das telas avaliadas. | |
| **Sem poluição geral** | O conjunto de ajuda (hints + descrições contextuais + ajuda expansível + feedback) permanece enxuto e não compete com os campos. | |

**Observações de poluição visual:**

- _(preencher)_

---

## 4. Decisões editoriais pendentes (confirmação obrigatória)

> Estas duas decisões são **editoriais** e precisam ser confirmadas explicitamente pelo aprovador.

### 4.1 Label de informações obrigatórias na arte

Manter o label atual ou trocar pela alternativa?

| Opção | Label | Decisão (manter / trocar) |
|---|---|---|
| **A (atual)** | **"Informações obrigatórias na arte"** | |
| **B (alternativa)** | **"Detalhes obrigatórios na arte"** | |

**Justificativa do aprovador:** _(preencher)_

### 4.2 Redação final das 8 descrições de tom de voz

Confirme ou ajuste a redação final de cada descrição (fonte: `src/lib/store-onboarding/field-guidance.ts`).

| # | Tom de voz | Redação atual | Aprovar? (sim / ajustar) |
|---|---|---|---|
| 1 | `profissional` | "Direta, confiável e sem exageros." | |
| 2 | `moderno` | "Atual, objetiva e com energia contemporânea." | |
| 3 | `elegante` | "Refinada, equilibrada e com atenção aos detalhes." | |
| 4 | `divertido` | "Leve, descontraída e com bom humor." | |
| 5 | `acolhedor` | "Próxima, calorosa e atenciosa com as pessoas." | |
| 6 | `jovem` | "Despojada, dinâmica e conectada com o momento." | |
| 7 | `tradicional` | "Sólida, experiente e fiel às suas origens." | |
| 8 | `luxuoso` | "Sofisticada, exclusiva e com senso de premium." | |

**Ajustes solicitados (se houver):** _(preencher)_

---

## 5. Procedimento em caso de falha (obrigatório)

Se **qualquer** cenário reprovar (FAIL):

1. **Não** fazer correções produtivas ad hoc neste plano.
2. Registrar o gap em `49-UAT.md` (cenário, evidência, comportamento observado × esperado).
3. Criar um **plano corretivo** de gap closure (`49-XX-PLAN.md`), com escopo restrito à **apresentação**.
4. Reexecutar **os 4 gates** (`vitest run`, `typecheck`, `lint`, `build`), a **prova de hashes/diff do 49-12**
   (`git diff --name-only <SHA_INICIAL_F49>..HEAD`) e **esta UAT** após a correção.
5. Só então registrar o veredito final. Com gap closure, o total da fase passa a ser **N planos** (dinâmico),
   nunca um `13/13` fixo.

---

## 6. Veredito final

| Campo | Valor |
|---|---|
| **Todos os 9 cenários de compreensão: PASS?** | _(preencher)_ |
| **375px e 320px sem scroll horizontal + ajuda colapsada?** | _(preencher)_ |
| **Ausência de poluição visual confirmada?** | _(preencher)_ |
| **Decisão editorial 4.1 (label)** | _(preencher)_ |
| **Decisão editorial 4.2 (8 descrições de tom de voz)** | _(preencher)_ |
| **Aprovador** | _(preencher)_ |
| **Data** | _(preencher)_ |
| **Veredito** | _(PASS / FAIL)_ |

**Evidências (screenshots/notas — sem dados reais de clientes, tokens ou variáveis de ambiente):**

- _(anexar/registrar)_

---

*Checklist criado pelo plano 49-13 (Task 1). Preenchimento humano na Task 2 (checkpoint:human-verify).*
