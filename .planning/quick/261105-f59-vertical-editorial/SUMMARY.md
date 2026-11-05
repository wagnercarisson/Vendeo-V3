# Quick 261105-f59-vertical-editorial — prompt vertical curto e sem redundâncias

## Escopo

Somente a composição vertical 9:16. Prompt 1:1, políticas compartilhadas, Copy
Director, modelos, pricing, crédito, anexos enviados, pipeline de imagem, ativos,
banco, flag e campanhas anteriores não foram alterados. Nenhuma geração paga.

## Mudanças

- Novo serializador vertical ISOLADO, sem reutilizar o layout de blocos do 1:1.
- Estrutura de saída:
  1. objetivo da campanha e formato (linha única);
  2. `[REFERÊNCIAS]` na ordem REAL dos anexos;
  3. `[DADOS DA CAMPANHA]` com valores delimitados por JSON string;
  4. `[COMPOSIÇÃO]` com regras curtas e condicionais;
  5. `[ÁREAS RESERVADAS]` com uma única orientação percentual.
- Dados e instruções separados; nenhuma regra sobre elemento ausente.
- Referências numeradas a partir de `attachments` (produto → referências →
  ativo), com fallback determinístico para `references` quando não há metadados.
- Ativo da loja identificado pela posição real e orientado uma única vez:
  “Preserve sua identidade, adaptando sua aplicação à composição e ao contraste,
  sem descaracterizá-lo.”
- Sem ativo: nenhum anexo anunciado e “Não invente identidade visual.”
- Paleta e loja extraídas deterministicamente da linha canônica já existente;
  sem paleta, nenhuma menção a paleta ou loja é emitida.
- Descrição opcional: o dado aparece em `DADOS`; a regra de uso aparece em
  `COMPOSIÇÃO` somente quando a descrição existe.
- Textos de entrada delimitados com `JSON.stringify` (aspas e quebras de linha
  escapadas de forma inequívoca).
- Intenções cobertas: Oferta, Destaque e Exclusivo. Fundos cobertos: Estúdio,
  Ambientado e Original. Preço original só aparece quando informado; Exclusivo
  não exibe preço.
- Áreas reservadas usam `SAFE_AREA_PERCENT` (política técnica intacta), sem
  pixels, downscale, versões ou notas internas no prompt artístico.

## Versões

- compositor: `f59-vertical-9-16-composer-v5` (v4 + correções P1–P3 da revisão);
- formato editorial: `f59-9-16-v3`;
- safe area técnica: `safe-area-9-16-v1` (inalterada);
- versões semânticas de intenção/produto/estrutura/tema/integridade/fundo/
  identidade permanecem as do 1:1, apenas registradas na evidência.

## Correções pós-revisão (v5)

1. **Loja/paleta com aspas:** o compositor prefere `briefing.identity`
   estruturado; no fallback textual, ancora a leitura nos tokens de cor em vez
   do nome, preservando paleta e loja mesmo com aspas no nome.
2. **Descrição opcional:** a regra de preservação passa a citar apenas nome do
   produto, textos comerciais e textos obrigatórios. A descrição mantém regra
   própria; loja e paleta são contexto, não textos para imprimir.
3. **Hierarquia de preço:** com dois preços, a regra é “Destaque o preço de
   venda; apresente o preço original como secundário.” Com apenas um preço, a
   orientação se ajusta ao valor existente; sem preço, não há regra de preço.

## Arquivos

- `src/lib/product-vertical-9-16/prompt/composition.ts` — serializador editorial.
- `src/lib/product-vertical-9-16/prompt/registry.ts` — versões do vertical.
- `src/lib/product-vertical-9-16/prompt/policy-formato-9-16.ts` — versão editorial.
- `src/lib/product-vertical-9-16/__tests__/prompt.contract.test.ts`.
- `src/lib/product-vertical-9-16/__tests__/composition-difference.contract.test.ts`.
- `src/lib/product-1-1/__tests__/non-activation.contract.test.ts` (par exato).
- `openspec/changes/fase-59-campanhas-produto-vertical-9-16/specs/product-vertical-safe-area-composition/spec.md`.

## Prompt — caso Bolo Naked Fruit

Anexos `[produto, ativo]`, paleta presente, Oferta/Estúdio.

```text
Crie uma campanha de oferta em imagem estática vertical 9:16, em peça única.

[REFERÊNCIAS]
Imagem 1: produto anunciado. Preserve sua aparência e use-o como protagonista.
Imagem 2: ativo da loja. Preserve sua identidade, adaptando sua aplicação à composição e ao contraste, sem descaracterizá-lo.

[DADOS DA CAMPANHA]
Loja: "Padaria da Esquina"
Produto: "Bolo Naked Fruit"
Descrição: "Massa de pão de ló\nRecheio e cobertura de frutas"
Preço: "R$ 69,90"
Selo: "Imperdível"
Validade: "enquanto durarem os estoques"
Aviso obrigatório: "Imagem meramente ilustrativa"
Paleta: principal #3B2418; apoio #D59D5E.

[COMPOSIÇÃO]
Crie uma peça profissional e visualmente coerente. Evite elementos decorativos que distraiam do conteúdo principal.
Destaque o produto e o preço de venda.
Não invente informações comerciais.
Use fundo de estúdio liso ou gradiente suave na paleta da loja, com bom contraste e sem objetos de apoio.
Antes de alterar as cores do ativo, ajuste posicionamento e fundo para obter contraste.
A descrição é opcional e pode ser adaptada ou omitida, preservando seu significado.
Preserve o nome do produto, os textos comerciais e os textos obrigatórios, exibindo cada um uma única vez.
Use português correto e natural, sem caracteres ou pontuação duplicados, e não corrija silenciosamente os textos de entrada.

[ÁREAS RESERVADAS]
Deixe sem textos, ativo da loja ou partes essenciais do produto: 14% do topo, 35% da base, 6% de cada lateral e o retângulo inferior direito de 30% da largura por 40% da altura.
O fundo deve preencher também essas regiões. Não desenhe guias, demarcações ou faixas vazias.
```

## Redução editorial

| Métrica | v3 anterior | Editorial v5 |
|---|---|---|
| Caracteres | 2.972 | **1.600** (−46%) |
| Linhas | 42 | **29** |
| Blocos | 6 | **5** (4 com cabeçalho + objetivo) |

O prompt 1:1 equivalente tem 1.894 caracteres e 35 linhas; permanece
byte-idêntico ao baseline congelado.

## Variantes representativas

- **Exclusivo/Ambientado com paleta:** sem preço; cenário incorpora a paleta;
  sem selo/validade não há regra sobre eles.
- **Destaque/Original com paleta:** preço secundário; cenário original
  preservado; ativo ajustado por posição/escala/aplicação, nunca por alteração
  do produto ou cenário.
- **Oferta/Estúdio sem ativo e sem paleta:** somente imagem do produto; fundo
  neutro; “Não invente identidade visual.”; áreas reservadas sem menção a ativo.

## Verificação

| Gate | Resultado |
|---|---|
| Verticais | **18 arquivos / 218 testes passando** |
| 1:1 | **49 arquivos / 943 testes passando** |
| IA | **39 arquivos + 1 skipped / 389 testes + 7 skipped** |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0 — 96 páginas |
| OpenSpec `--strict` | valid |
| `git diff --check` | limpo |

Cobertura adicionada:

- três intenções e três direções de fundo;
- ativo presente/ausente e múltiplas referências;
- paleta presente/ausente (sem afirmar paleta inexistente);
- nome de loja com aspas, com identidade estruturada e no fallback textual;
- hierarquia de preço com dois preços, um preço e nenhum preço;
- campos opcionais, descrição multilinha e aspas;
- ausência de duplicação das regras essenciais;
- 1:1 byte-idêntico ao baseline congelado;
- numeração coerente com o adapter real (SDK falso).

## Limitações

- Nenhuma geração paga; a resposta visual do modelo ao prompt editorial ainda
  precisa ser validada em uma única geração acompanhada, após autorização.
- O prompt bruto do provider continua não persistido; a comparação é
  determinística a partir da evidência congelada.
- A loja só aparece em `DADOS` quando a linha canônica de paleta já traz o nome;
  sem paleta, não há fonte determinística de nome da loja neste contrato.
- Flag permanece **OFF**; banco, migrations e campanhas existentes intactos.
