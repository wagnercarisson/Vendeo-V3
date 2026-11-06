# 59-10 — Consolidação final da F59 e lacunas da matriz

## 1. Evidências existentes

### Pão Francês vertical — versão final confirmada

| Campo | Valor |
|---|---|
| Campanha | `3e7562ea-8fca-42ae-8e59-e75ac513db0f` |
| Operação | `c717a472-ad8d-40ee-9f9a-bad34baa364f` |
| Compositor | `f59-vertical-9-16-composer-v14` |
| Formato | `f59-9-16-v12` |
| Safe area | `safe-area-9-16-experimental-v3` |
| Intenção | Destaque |
| Fundo | Original |
| Modelo / qualidade | `gpt-image-2.5-sunburst` / `medium` |
| Custo copy / imagem | US$ 0,000076 / US$ 0,030304 |
| Produto | `9f04b2a7…` |
| Ativo | `21e5e037…` |
| Prompt reconstruído | SHA-256 `0682fd7c…` |

O registro confirma o uso da **versão final v14**. Comparação com a foto
original: cenário reconhecível, com reinterpretação de iluminação e
enquadramento.

**Erro de entrada confirmado:** “Garanti” no aviso obrigatório. Não é falha de
geração. A arte **não deve ser considerada pronta para publicação** com esse erro.
Não regenerar apenas para corrigir a evidência.

### Pão Francês 1:1 — evidência manual positiva

| Campo | Valor |
|---|---|
| Campanha | `14278411-c1fd-4884-9760-ee0dcf98da06` |
| Operação | `31f4a160-34ef-4ecf-bd0e-d0e29fd6cf53` |
| Compositor | `48.2.4-prompt-composer-v7` |
| Formato | `48.2.4-formato-1-1-v1` |
| Intenção | Destaque |
| Modelo / qualidade | `gpt-image-2.5-sunburst` / `medium` |
| Custo copy / imagem | US$ 0,000173 / US$ 0,031704 |
| Arte | `art-1024.jpg` |

Comparação com a foto original: cenário e disposição do produto visualmente bem
preservados. Registro como **evidência manual positiva do fluxo 1:1**.

### Substituição na matriz

A matriz previa Pão Caseiro; o responsável autorizou a substituição por **Pão
Francês “Fresquinho”**. O Pão Francês vertical cobre o cenário **Original** da
matriz.

## 2. Congelamento final

Registro completo em `59-10-FINAL-FREEZE-V14.md`:

- commit do compositor: `69a50617`;
- estado de preparação/docs: `eec0433a`;
- compositor: `f59-vertical-9-16-composer-v14`;
- formato: `f59-9-16-v12`;
- safe area: `safe-area-9-16-experimental-v3`;
- prompt reconstruído: SHA-256 `0682fd7c…`.

O prompt bruto do provider não é persistido; a reconstrução é determinística e
não deve ser tratada como captura literal do envio.

## 3. Cobertura e lacunas

| Cenário desejado | Status |
|---|---|
| Estúdio com preço | **NÃO EXECUTADO na versão final v14** |
| Ambientado com preço original + promocional | **NÃO EXECUTADO na versão final v14** (Pão de Queijo foi v13, antes da regra monetária) |
| Original com Pão Francês | **EXECUTADO** na v14, com ressalva do erro de entrada “Garanti” |

O defeito de vírgula duplicada foi corrigido na v14, mas ainda **não foi
retestado** em uma geração com preço original + promocional.

## 4. Retestes necessários

Máximo: **2 novas submissões**. Sem repetição automática.

### Reteste 1 — Estúdio com preço

- Produto: **Bolo Naked Fruit** (dados existentes).
- Fundo: **Estúdio**.
- Oferta; preço R$ 69,90; selo Imperdível; validade “enquanto durarem os estoques”; aviso “Imagem meramente ilustrativa”.
- Produto `9110f31a…`; ativo `21e5e037…`.
- Objetivo: cobrir Estúdio com preço na v14 e confirmar a regra monetária em um único preço.

### Reteste 2 — Ambientado com preço original + promocional

- Produto: **Pão de Queijo Mineiro 500gr** (dados existentes).
- Fundo: **Ambientado**.
- Oferta; original R$ 18,99 / venda R$ 14,99; selo Oferta; validade “enquanto durarem os estoques”; aviso “Imagem meramente ilustrativa\nPré assado\nRápido e prático”.
- Produto `63965042…`; ativo `21e5e037…`.
- Objetivo: retestar o defeito da vírgula duplicada e confirmar separador decimal único.

## 5. Saldos, limite e custo

- Créditos disponíveis: **2**.
- Teto do piloto: **US$ 2,20**; gasto **US$ 1,8668**; margem **US$ 0,3332**.
- Máximo de novas submissões: **2**.
- Custo observado por geração: ~US$ 0,031; duas: ~US$ 0,062.
- Pior caso interno com fallback por geração: US$ 0,1547; duas: US$ 0,3094.
- A margem de US$ 0,3332 cobre o pior caso das duas, mas fica estreita: qualquer
  retry adicional pode exceder.
- **Nenhuma ampliação de teto ou concessão de crédito.** Aguardar aprovação
  específica do gasto antes das submissões.

## 6. Gates locais

| Gate | Resultado |
|---|---|
| Verticais | 19 arquivos / 238 testes |
| 1:1 | 49 arquivos / 943 testes |
| IA | 39 arquivos + 1 skipped / 389 testes + 7 skipped |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0 — 96 páginas |
| OpenSpec `--strict` | valid |
| `git diff --check` | limpo |

## 7. Parecer consolidado

**PENDENTE.**

- Pão Francês vertical v14: **aprovado com ressalva** — composição/visual
  aprovados, mas o aviso “Garanti” é erro de entrada e a arte não está pronta
  para publicação.
- Pão Francês 1:1: **aprovado** como evidência manual positiva do fluxo quadrado.
- Faltam os retestes de Estúdio com preço e Ambientado com preço original +
  promocional.
- Falha, recuperação e concorrência não foram executadas nesta rodada e **não
  devem ser consideradas aprovadas por consequência**.
- Sem aprovação integral da homologação ou autorização de produção.

Aguardo aprovação específica do gasto e das duas submissões para prosseguir.
