# F49 — UAT Humana de Compreensão (Checklist)

> **Fonte da verdade:** `openspec/changes/fase-49-ativacao-orientacao-contextual-campos/tasks.md` (item 9.5) +
> `.planning/phases/49-ativacao-orientacao-contextual-campos/49-UI-SPEC.md` +
> `49-CONTEXT.md` (§risk_summary). Checklist criado pelo plano **49-13** (Task 1) e
> preenchido pelo aprovador humano na Task 2 (re-UAT após o gap closure 49-14).

## Cabeçalho

| Campo | Valor |
|---|---|
| **Fase** | 49 — Ativação e Orientação Contextual de Campos |
| **Plano** | 49-13 |
| **Aprovador** | Wagner |
| **Data da UAT** | 2026-09-18 (re-UAT de compreensão, após o gap closure 49-14) |
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
| 1 | **Dados fiscais × identidade pública.** Abra `/loja` → aba **Dados**. Com suas palavras, qual é a diferença entre **razão social**, **nome fantasia** e **nome da loja**? Onde ficam os dados fiscais e para que servem? | O aprovador diferencia os três conceitos: razão social e nome fantasia são **dados fiscais/oficiais (Receita Federal)** usados para verificação e prontidão do cadastro; **nome da loja** é o **nome público** que identifica e assina as campanhas. Aponta corretamente a subseção "Dados fiscais" e entende que o CNPJ é opcional. | ✅ **PASS** — Diferenciou razão social e nome fantasia (dados fiscais/Receita, subseção "Dados fiscais"; CNPJ opcional) do nome da loja (nome público que assina as campanhas). |
| 2 | **Tom de voz.** Ainda na aba **Posicionamento**, selecione diferentes opções de **Tom de Voz**. Para que serve essa escolha? Ela substitui o segmento/subsegmento da loja? | O aprovador explica que o tom define **como a loja se comunica** e é usado nos títulos, legendas e clima visual das campanhas; reconhece que **complementa** (não substitui) o segmento/subsegmento; vê uma descrição curta e positiva **por opção selecionada** e nenhuma descrição quando nada está selecionado. | ✅ **PASS** — Explicou que o tom define como a loja se comunica (títulos, legendas, clima visual) e complementa o segmento/subsegmento; viu descrição positiva por opção e nenhuma sem seleção. |
| 3 | **Posicionamento.** Preencha o campo de posicionamento com **proposta, público e diferencial** usando o exemplo. O que o Vendeo faz com essa informação? | O aprovador consegue montar uma frase com público + proposta + diferencial; entende que o posicionamento **influencia diretamente a copy** e, de forma **indireta**, o perfil/direção visual — sem esperar uma transformação visual automática. Usa o exemplo da ajuda expansível. | ✅ **PASS** — Montou frase com público + proposta + diferencial e entendeu o efeito na copy e indireto na direção visual, sem esperar transformação automática; usou o exemplo da ajuda expansível. |
| 4 | **Posicionamento × descrição curta × slogan.** Explique a diferença entre **posicionamento**, **descrição curta** e **slogan**. Qual deles é recomendado e qual é opcional? | O aprovador distingue: posicionamento = como a loja quer ser **percebida** (recomendado); descrição curta = o que vende, para quem e diferencial **factual** (recomendada); slogan = frase pública **já adotada**, **opcional** ("se sua loja já utiliza um"), **sem** selo "Recomendado". | ✅ **PASS** — Distinguiu posicionamento (percepção, recomendado), descrição curta (factual, recomendada) e slogan (frase pública já adotada, opcional, sem selo "Recomendado"). |
| 5 | **Descrição do produto.** Abra `/campanhas/nova` → **Produto**. Preencha a descrição com um produto real da sua loja. O que deve ser escrito nesse campo e para onde essa informação vai? | O aprovador escreve características/benefícios/uso do produto (ex.: tênis leve, solado antiderrapante) e entende que isso alimenta **a comunicação/copy da campanha** — e **não** a arte. | ✅ **PASS** — Escreveu características/benefícios/uso reais e entendeu que alimentam a comunicação/copy da campanha — não a arte. |
| 6 | **Preços e intenção.** Na seção **Oferta**, experimente os 4 estados: **dois preços**, **só preço de venda**, **só preço anterior** e **nenhum preço**. Como cada estado muda o que a campanha pode ser? O que a mensagem exibida diz em cada caso? | O aprovador relaciona os estados às intenções: dois preços = **Oferta**; só venda = **Oferta ou Destaque**; nenhum = **Destaque ou Exclusividade**. No estado **só preço anterior**, lê a mensagem **neutra** "Informe o preço de venda para completar a oferta." (não "Sem preço...") e entende que não é bloqueio. | ✅ **PASS** — Relacionou os 4 estados às intenções e leu a mensagem neutra no estado "só preço anterior", entendendo que não é bloqueio. |
| 7 | **Informações obrigatórias na arte.** Na seção **Avisos**, use "Informações obrigatórias na arte" com **vários detalhes ou restrições** (uma linha por item). O que acontece com esse texto? | O aprovador insere múltiplos itens em linhas separadas (ex.: `Intensidade 8`, `Torra clássica`, `Venda proibida para menores`) e entende que são características, detalhes ou **restrições** que **precisam aparecer na imagem** — campo diretamente visível, sem advertência negativa permanente. | ✅ **PASS (re-UAT pós-49-14)** — Inseriu múltiplos itens em linhas separadas, incluindo uma **restrição** real ("Venda proibida para menores"); entendeu que são características/detalhes/restrições que precisam aparecer na imagem. Microcopy cita restrições e "Use preferencialmente uma linha para cada item". Gap original endereçado pelo **49-14** (ver §5.1). |
| 8 | **Validade × aviso ilustrativo.** Localize onde se informa **validade** e onde se marca o **aviso ilustrativo**. Explique a diferença de finalidade entre os dois. | O aprovador identifica corretamente: **validade** trata do **período/data/limitação** da oferta; **aviso ilustrativo** é um **controle próprio** (checkbox) sobre a imagem ser meramente ilustrativa — são coisas distintas e não se misturam. | ✅ **PASS** — Identificou validade (período/data/limitação) e aviso ilustrativo (checkbox de controle da imagem ilustrativa) como coisas distintas. |
| 9 | **Revisão do brief.** Siga para a **revisão do brief** antes de gerar. Identifique as categorias apresentadas: **aviso ilustrativo**, **informações obrigatórias na arte**, **validade** e **preços/oferta**. Elas estão separadas e reconhecíveis? | O aprovador reconhece as **quatro categorias como itens separados e rotulados** (não concatenados num único parágrafo) e confirma que os rótulos de preço ("Preço anterior" / "Preço de venda") estão coerentes. | ✅ **PASS** — Reconheceu as quatro categorias como itens separados e rotulados na revisão, com rótulos de preço coerentes. |

---

## 2. Matriz de dispositivos (desktop · 375px · 320px)

> Repita os passos principais de cada cenário no dispositivo indicado. Critérios obrigatórios:
> **sem scroll horizontal** e **ajuda colapsada por padrão**.

| Dispositivo | Sem scroll horizontal | Ajuda colapsada por padrão | Toques ≥ 44px | Resultado |
|---|---|---|---|---|
| **Desktop** (>1024px) | ✅ PASS | ✅ PASS | ✅ PASS | **PASS** |
| **375px** (mobile) | ✅ PASS | ✅ PASS | ✅ PASS | **PASS** |
| **320px** (mobile estreito) | ✅ PASS | ✅ PASS | ✅ PASS | **PASS** |

**Observações da matriz de dispositivos:**

- Passos principais repetidos em desktop, 375px e 320px: **sem scroll horizontal** em `/loja`, `/campanhas/nova` e na revisão do brief.
- Ajuda expansível ("Como os preços mudam a campanha?" e exemplo do posicionamento) **colapsada por padrão** e acionável por teclado, com `aria-expanded` correto.
- Alvos de toque ≥ 44px confirmados nos controles de ajuda/expansão e nos campos em mobile.

---

## 3. Ausência de poluição visual

> Avalie as telas de `/loja` e `/campanhas/nova` (e a revisão do brief). Marque cada item.
> **Nota:** hints inline **aumentam alguma altura** — isso é **esperado** e **não** é falha.

| Item avaliado | Critério de PASS | Resultado |
|---|---|---|
| **Sem lista permanente longa de regras** | As 3 regras de preço ficam em ajuda **expansível colapsada** por padrão, não como bloco permanente de texto. | ✅ **PASS** — As 3 regras de preço estão na ajuda expansível colapsada; nenhum bloco permanente de regras. |
| **Sem advertência negativa permanente** | Nenhum aviso preventivo/negativo fixo é exibido (ex.: "Sem preço...", "cuidado", "atenção"). A microcopy é positiva e educativa. | ✅ **PASS** — Microcopy positiva e educativa; nenhuma advertência negativa permanente. |
| **Sem tooltip-exclusivo** | Nenhuma informação essencial depende apenas de hover/`title`/tooltip; os hints são visíveis e associados ao campo. | ✅ **PASS** — Nenhuma informação essencial depende apenas de hover/tooltip; hints visíveis e associados ao campo. |
| **Sem crescimento excessivo de altura** | Os hints inline acrescentam apenas alguma altura (esperado); a página não cresce de forma desproporcional nem empurra conteúdo de forma excessiva. | ✅ **PASS** — Hints inline acrescentam apenas alguma altura (esperado); sem crescimento desproporcional. |
| **Sem scroll horizontal** | Em 320px/375px não há scroll horizontal em nenhuma das telas avaliadas. | ✅ **PASS** — Sem scroll horizontal em 320px/375px. |
| **Sem poluição geral** | O conjunto de ajuda (hints + descrições contextuais + ajuda expansível + feedback) permanece enxuto e não compete com os campos. | ✅ **PASS** — Conjunto de ajuda enxuto; não compete com os campos. |

**Observações de poluição visual:**

- **Ausência de poluição visual confirmada** pelo aprovador em desktop, 375px e 320px.
- Nenhuma lista longa permanente, nenhuma advertência negativa permanente e nenhum tooltip-exclusivo foram introduzidos.

---

## 4. Decisões editoriais pendentes (confirmação obrigatória)

> Estas duas decisões são **editoriais** e precisam ser confirmadas explicitamente pelo aprovador.

### 4.1 Label de informações obrigatórias na arte

Manter o label atual ou trocar pela alternativa?

| Opção | Label | Decisão (manter / trocar) |
|---|---|---|
| **A (atual)** | **"Informações obrigatórias na arte"** | ✅ **Manter** |
| **B (alternativa)** | **"Detalhes obrigatórios na arte"** | ❌ Rejeitada |

**Justificativa do aprovador:** O campo abrange **características, detalhes _e_ restrições** — o label "Informações obrigatórias na arte" é mais abrangente e correto que "Detalhes obrigatórios na arte", que sugeriria apenas detalhes.

### 4.2 Redação final das 8 descrições de tom de voz

Confirme ou ajuste a redação final de cada descrição (fonte: `src/lib/store-onboarding/field-guidance.ts`).

| # | Tom de voz | Redação atual | Aprovar? (sim / ajustar) |
|---|---|---|---|
| 1 | `profissional` | "Direta, confiável e sem exageros." | ✅ Aprovar |
| 2 | `moderno` | "Atual, objetiva e com energia contemporânea." | ✅ Aprovar |
| 3 | `elegante` | "Refinada, equilibrada e com atenção aos detalhes." | ✅ Aprovar |
| 4 | `divertido` | "Leve, descontraída e com bom humor." | ✅ Aprovar |
| 5 | `acolhedor` | "Próxima, calorosa e atenciosa com as pessoas." | ✅ Aprovar |
| 6 | `jovem` | "Despojada, dinâmica e conectada com o momento." | ✅ Aprovar |
| 7 | `tradicional` | "Sólida, experiente e fiel às suas origens." | ✅ Aprovar |
| 8 | `luxuoso` | "Sofisticada, exclusiva e com senso de premium." | ✅ Aprovar |

**Ajustes solicitados (se houver):** Nenhum — as **8 descrições são aprovadas exatamente como entregues** em `src/lib/store-onboarding/field-guidance.ts`.

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

### 5.1 Gap registrado — Cenário 7 (Informações obrigatórias na arte)

**Status:** reprovação parcial na UAT humana da F49 (2026-09-18), endereçada pelo plano corretivo **`49-14-PLAN.md`** (gap closure de apresentação/conteúdo apenas). **Resolvido e aprovado na re-UAT** (2026-09-18).

**Comportamento observado:**

- O placeholder multi-linha exibia apenas exemplo de produto (`Intensidade 8` / `Torra clássica` / `Peso líquido 500 g`), sem representar uma **restrição**.
- A microcopy não mencionava "restrições" e não usava "preferencialmente uma linha para cada item".

**Comportamento esperado:**

- O exemplo do placeholder deve incluir uma restrição real (ex.: `Venda proibida para menores`), pois o campo aceita características, detalhes **ou restrições** que precisam aparecer na imagem.
- A microcopy deve citar restrições e orientar "Use preferencialmente uma linha para cada item".

**Decisão editorial (4.1):** manter o label **"Informações obrigatórias na arte"** — a alternativa "Detalhes obrigatórios na arte" foi descartada porque o campo abrange características, detalhes **e** restrições. A nova redação da microcopy/placeholder foi adotada na fonte única `src/lib/campaign/field-guidance.ts`, na base OpenSpec (proposal/design/2 specs) e nos artefatos de planejamento (49-CONTEXT/49-PATTERNS).

**Reexecução obrigatória:** 4 gates (`vitest run`, `typecheck`, `lint`, `build`) + prova de hashes/diff do 49-12 (`git diff --name-only <SHA_INICIAL_F49>..HEAD`) — registrados em `49-GATES.txt` (seção "Reexecução pós-gap-closure (49-14)") — **antes** da re-UAT humana (49-13 Task 2/3).

**Veredito do gap:** **RESOLVIDO** — a re-UAT humana (49-13 Task 2/3, 2026-09-18) reconfirmou o cenário 7 como **PASS** com a microcopy/placeholder corrigidos. Gap closure 49-14 revalidado (4 gates verdes + 59/59 hashes sem divergência).

---

## 6. Veredito final

| Campo | Valor |
|---|---|
| **Todos os 9 cenários de compreensão: PASS?** | ✅ **SIM — 9/9 PASS** |
| **375px e 320px sem scroll horizontal + ajuda colapsada?** | ✅ **SIM** |
| **Ausência de poluição visual confirmada?** | ✅ **SIM** |
| **Decisão editorial 4.1 (label)** | **Manter "Informações obrigatórias na arte"** (alternativa "Detalhes obrigatórios na arte" rejeitada) |
| **Decisão editorial 4.2 (8 descrições de tom de voz)** | ✅ **Aprovadas as 8 descrições, como entregues** |
| **Aprovador** | **Wagner** |
| **Data** | **2026-09-18** |
| **Veredito** | ✅ **PASS** |

**Evidências (screenshots/notas — sem dados reais de clientes, tokens ou variáveis de ambiente):**

- Notas da sessão de re-UAT de compreensão (desktop, 375px e 320px) registradas pelo aprovador; nenhuma informação sensível anexada (T-49-04).
- Gap do cenário 7 endereçado pelo **49-14** e reconfirmado como PASS na re-UAT; 4 gates verdes e 59/59 hashes protegidos sem divergência (`49-GATES.txt`).

---

*Checklist criado pelo plano 49-13 (Task 1). Preenchimento humano na Task 2 (checkpoint:human-verify). Finalizado pelo plano 49-13 (Task 3) com veredito PASS e decisões editoriais confirmadas.*
