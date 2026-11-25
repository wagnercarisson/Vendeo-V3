---
quick_id: 261125-eo7
title: Reduzir para dois arquivos o limite de imagens de entrada das campanhas
date: 2026-11-25
status: incomplete
plan: 261125-eo7-PLAN.md
branch: feat/apenas-duas-imagens-de-entrada
base_commit: 47166493
head_commit: b64abd8d
entrypoint: /gsd-quick
scope: campaign-input-media-limit
plan_type: execute
tags: [campaign-input, image-upload, lab-bench, openspec]
metrics:
  duration: aprox. 45 min
  completed: 2026-11-25T13:48:20Z
  tasks: 3/3
  files_changed: 14
  targeted_tests: 9 arquivos / 211 testes PASS
key-decisions:
  - "MAX_CAMPAIGN_IMAGES = 2 (1 principal + 1 auxiliar) como fonte unica do teto; schema/hook/UI derivam sem edicao."
  - "Bancada fixa 4/3 localmente e deixa de importar a config de campanha (excecao explicita de paridade)."
  - "Texto de orientacao do formulario passa a ser estatico, sem interpolar contagem."
  - "O limite conta arquivos enviados, nao produtos retratados (cada arquivo pode mostrar combos/variedades/angulos)."
---

# Quick 261125-eo7 — Limite de 2 arquivos de imagem nas campanhas

**Status: `incomplete`** — implementação local e gates automáticos concluídos; **validação manual PENDENTE** (não executada neste ambiente). Detalhes abaixo.

## Resultado

O teto de imagens de entrada da campanha passou de **4 arquivos (1 + 3)** para **2 arquivos (1 principal + 1 de apoio)** em uma única fonte (`MAX_CAMPAIGN_IMAGES`), refletindo automaticamente no schema da rota, no cap do hook e na UI de upload (mensagem "Máximo de 2 imagens"). A bancada do laboratório foi **desacoplada** e mantém 4 arquivos no total (1 + 3), como exceção explícita e documentada.

O limite é explicitamente de **arquivos de imagem enviados**, não de produtos distintos: cada arquivo pode mostrar combos, variedades, ângulos ou detalhes. Nada no código, nos testes ou nas specs sugere dividir combos em arquivos separados.

## Arquivos alterados

### Código de produção (commit `65d00e75`)

| Arquivo | Mudança |
|---|---|
| `src/lib/image-generation/config.ts` | `MAX_CAMPAIGN_IMAGES = 4` → `2` (comentário: 1 primary + 1 auxiliar, arquivos enviados). Demais limites inalterados. |
| `src/components/flow/campaign-input-form.tsx` | Removido o import órfão `MAX_CAMPAIGN_IMAGES`; `<p>` de orientação substituído pelo texto estático verbatim `Opcional — Uma imagem de apoio (ângulos, variações, combos), como fonte auxiliar para a imagem principal.` |
| `src/lib/lab/bench/domain/form-rules.ts` | Removido import de `MAX_CAMPAIGN_IMAGES`; `MAX_PRODUCT_IMAGES = 4` literal; `MAX_ADDITIONAL_IMAGES = MAX_PRODUCT_IMAGES - 1`; doc-comment registra a exceção explícita de independência. `validateImagesCount` segue com "Máximo de 4 imagens". |

**Não editados (por desenho, já derivam da constante):** `src/components/flow/campaign-image-upload.tsx`, `src/components/flow/use-campaign-form.ts`, `src/lib/image-generation/schema.ts`, e todas as telas/APIs/execução da bancada (incl. `bench-image-upload.tsx`).

### Testes (commit `77f86dd6`)

| Arquivo | Mudança |
|---|---|
| `src/app/api/campaign/generate-image/__tests__/route.test.ts` | Mock de config → 2; `VALID_PRODUCT_IMAGES_REQUEST` com 2 itens (primary camera/jpeg + reference upload/png); 24b com 2 itens `1024*1024+1024` (413 teto agregado); 24c com 3 itens (400 schema); **novos 24d** (1 arquivo → 200, 1 upload) e **24e** (2 arquivos → 200, 2 uploads); teste 25 → `toHaveBeenCalledTimes(2)`. |
| `src/components/flow/__tests__/use-campaign-form-product-images.test.ts` | Teste 9 afirma `MAX_CAMPAIGN_IMAGES === 2`; **novo 9b** prova que 3 arquivos disparados num único `act` resultam em 2 itens (`["primary","reference"]`); teste 14 caso 1 com primary + 1 reference (2 itens no body) e caso 2 legado (`productImageDataUrl`) preservado; teste 15 não alterado. |
| `src/components/flow/__tests__/campaign-image-upload.test.tsx` | Novos casos "no teto" (2 itens → Galeria/Câmera `disabled` + "Máximo de 2 imagens") e "abaixo do teto" (1 item → habilitados, sem mensagem de teto). |
| `src/components/flow/__tests__/campaign-input-form.test.tsx` | Novo caso afirma o texto de orientação estático verbatim e o heading "Imagens adicionais". |
| `src/__tests__/api/campaign-generate.test.ts` | Mock de config → 2. |
| `src/__tests__/regression-master-switch.test.ts` | Mock de config → 2. |
| `src/__tests__/concurrency.test.ts` | Mock de config → 2. |

`src/lib/lab/bench/__tests__/form-parity.contract.test.ts` **não foi alterado** (já prova 4/3 independente) e passou.

### Specs OpenSpec (commit `b64abd8d`)

| Arquivo | Mudança |
|---|---|
| `openspec/specs/campaign-media-upload/spec.md` | Purpose e requirement com teto 2 (1 + 1); limite contado por **arquivo**, não por produto retratado; scenarios ajustados ("até 1", "1 primary + 1 auxiliar"). |
| `openspec/specs/campaign-input-ui/spec.md` | Nota de delta da quick; campos e scenarios com teto 2; `MAX_CAMPAIGN_IMAGES = 2` explícito; bullet + scenario do texto de orientação estático; "Máximo de 2 imagens" no scenario de teto. |
| `openspec/specs/ai-image-generation/spec.md` | Notas de modificação (linhas 10/131) com quick e teto 2; `MAX_CAMPAIGN_IMAGES = 2`; scenario "productImages aceito" com 1 primary + 1 reference; payload legado e `superRefine` exactly-1-primary preservados. |
| `openspec/specs/lab-bench-form-parity/spec.md` | Requirements mantêm "até três adicionais" para a bancada + exceção explícita; novo scenario "Limite da bancada independe do produtivo" (bancada 4/5, campanha 2/3). |

## Commits

| Hash | Tipo | Mensagem |
|---|---|---|
| `65d00e75` | feat | `feat(261125-eo7): limitar campanha a 2 arquivos e desacoplar bancada` |
| `77f86dd6` | test | `test(261125-eo7): cobrir teto de 2 arquivos e remover mocks com valor 4` |
| `b64abd8d` | docs | `docs(261125-eo7): alinhar specs ao teto de 2 arquivos e a excecao 4/3 da bancada` |

`git diff --stat 47166493..HEAD` → **14 arquivos, +187 / −53**.

## Gates automáticos (executados localmente)

| Gate | Comando | Resultado |
|---|---|---|
| Testes dirigidos | `npx vitest run` (9 caminhos da Tarefa 2 + `form-parity` + `original-rule`) | **9 arquivos / 211 testes PASS**, exit 0 |
| Typecheck | `npm run typecheck` | exit **0** (nenhum erro) |
| Lint | `npm run lint` | exit **0** |
| Build | `npm run build` | exit **0** (produção, todas as rotas compiladas) |
| OpenSpec strict | `openspec validate campaign-media-upload --type spec --strict --no-interactive` | **valid**, exit 0 |
| OpenSpec strict | `campaign-input-ui` | **valid**, exit 0 |
| OpenSpec strict | `lab-bench-form-parity` | **valid**, exit 0 |
| OpenSpec strict | `ai-image-generation` | **issues (11 erros preexistentes)** — ver seção abaixo |
| Diff hygiene | `git diff --check` | limpo, exit 0 |
| Greps de coerência | `MAX_CAMPAIGN_IMAGES` fora de testes só em `config.ts`, `schema.ts`, `campaign-image-upload.tsx`, `use-campaign-form.ts`; zero em `src/lib/lab/bench` e `campaign-input-form.tsx`; sem `aux2`/`toHaveBeenCalledTimes(3)` na rota; sem `MAX_CAMPAIGN_IMAGES = 4`/`ou seja, 3 com o teto de 4` em `openspec/specs` | conforme |

### Falha preexistente: `ai-image-generation` strict

`openspec validate ai-image-generation --type spec --strict --no-interactive` retorna **11 erros** `requirements.N.text: Requirement must contain SHALL or MUST keyword` (N = 2, 9, 11, 15–21, 24) + 2 infos de texto longo. **Não é regressão desta quick:** a mesma validação foi reproduzida a partir do conteúdo de `HEAD` (`git show HEAD:openspec/specs/ai-image-generation/spec.md` em diretório temporário) e produziu **exatamente os mesmos 11 erros**. Os 4 arquivos de spec editados aqui estão no diff apenas em trechos de contexto/teto; a estrutura de requirements é anterior. Corrigir as 11 descrições fica fora do escopo desta quick (scope boundary) e foi registrado, não mascarado. `campaign-media-upload`, `campaign-input-ui` e `lab-bench-form-parity` estão válidos em strict.

## Desvios do plano

1. **[Correção do plano — texto verbatim]** A Tarefa 2.4 do plano mencionava asserção `/No total, até 2 imagens/`, redação substituída na correção do plano. O teste usa o texto exato exigido: `Opcional — Uma imagem de apoio (ângulos, variações, combos), como fonte auxiliar para a imagem principal.` Nenhuma contagem é interpolada.
2. **[Rule 2 — coerência de spec]** `campaign-media-upload` trazia "1 primary + 2 auxiliares → 3 itens" no scenario do preview grid e `campaign-input-ui` trazia "rascunho com 3 imagens → 3 imagens". Com o teto 2 esses cenários ficaram inalcançáveis/contraditórios; foram ajustados para 2 itens. Mudança diretamente causada por esta alteração.
3. **[Rule 2 — gate de grep]** O doc-comment da bancada cita a independência sem escrever o identificador `MAX_CAMPAIGN_IMAGES`, para cumprir o gate "sem ocorrências em `src/lib/lab/bench`". O significado (exceção explícita 4/3) foi preservado.
4. **[Rule 1 — import órfão evitado em teste]** O teste da UI usa `queryByText(/Máximo de \d+ imagens/)` no caso "abaixo do teto" para não acoplar a asserção a um número fixo, enquanto o caso "no teto" verifica literalmente "Máximo de 2 imagens".

Sem outros desvios. `.f62-check/` permaneceu intocado; nenhum refactor oportunista.

## Validação manual — **PENDENTE**

Não executável neste ambiente (sem navegador/loja elegível e sem autorização para geração). **Não há alegação de UAT.** Roteiro para o responsável em `/campanhas/nova` (loja elegível ao fluxo novo):

1. Selecionar 1 imagem → preview com badge "Principal"; "Galeria"/"Câmera" habilitados.
2. Adicionar a 2ª imagem → grid com 2 itens; botões desabilitados; mensagem "Máximo de 2 imagens".
3. Selecionar 3 arquivos de uma vez pela galeria → entram apenas 2 (cap por lote; coberto por teste 9b).
4. Remover a principal → a 2ª é promovida a principal; remover todas → erro de obrigatoriedade.
5. Conferir o texto de orientação sob "Imagens adicionais" (texto estático novo).
6. Com 2 imagens e `backgroundDirection = original`, confirmar o erro de "exatamente uma imagem" e que ele desaparece com 1 imagem (regra intocada; `use-campaign-form-original-rule.test.ts` PASS).
7. Não executar geração paga.

## Escopo e distinção local × publicação

- **Entregue localmente:** código, testes e specs acima, com os gates automáticos registrados.
- **Não executado:** push, merge, deploy, ativação de flag, migrations, alterações de banco/Storage, chamadas de IA pagas.
- **Aprovação local não implica publicação.** Integração/publicação, smoke e ativação são gates separados do responsável. Nenhum ambiente de produção foi tocado.

## Pendências / observações

- **`ai-image-generation` strict:** 11 erros preexistentes de redação de requirement (comprovadamente anteriores a esta quick). Não corrigidos aqui.
- **Silêncio do cap por lote:** a galeria aceita `multiple` e o hook descarta o excedente sem mensagem dedicada — comportamento preexistente (antes era 4), agora documentado pelo teste 9b. Nenhum erro novo de UI foi introduzido.
- **Validação manual:** pendente, conforme acima.

## Self-Check: PASSED

Arquivos verificados no worktree: `src/lib/image-generation/config.ts`, `src/components/flow/campaign-input-form.tsx`, `src/lib/lab/bench/domain/form-rules.ts`, os 4 specs editados e os 7 arquivos de teste. Commits `65d00e75`, `77f86dd6`, `b64abd8d` presentes em `git log` no branch `feat/apenas-duas-imagens-de-entrada`.
