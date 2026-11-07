# Quick 261105-f59-vertical-prompt — correção controlada do prompt vertical

## Escopo

Somente composição vertical 9:16. Prompt 1:1, Copy Director, modelos, pricing,
crédito, pipeline de imagem, banco, flag e campanhas existentes não foram
alterados.

## Mudanças

- Formato e áreas reservadas consolidados em UMA contribuição no bloco
  `INTENÇÃO E FORMATO`.
- Removidas as instruções equivalentes do bloco de restrições e qualquer menção
  a pixels, canvas intermediário, downscale ou homologação no prompt artístico.
- Anexos identificados pela ordem REAL do adapter:
  - `Imagem 1: produto anunciado`;
  - referências adicionais numeradas;
  - ativo da loja calculado dinamicamente, nunca fixado como imagem 2.
- Quando há ativo anexado, a orientação de aplicação é vinculada à imagem
  correta (v3).
- Quando não há ativo, não há anúncio de anexo nem pedido de reprodução.
- Termos `logo`/`assinatura visual` removidos do caminho vertical genérico;
  usa-se `ativo da loja`.
- Versões:
  - compositor: `f59-vertical-9-16-composer-v3`;
  - formato: `f59-9-16-v2`;
  - safe area técnica permanece `safe-area-9-16-v1`.

## Aplicação do ativo (v3)

A proibição absoluta de recomposição foi substituída por uma orientação única:

> Use o ativo da loja da imagem N como referência de identidade. Preserve o
> nome, o lettering e os elementos gráficos característicos. Adapte escala,
> posição e espaçamento à composição. Quando indispensável para legibilidade e
> contraste, ajuste as cores e a disposição dos componentes, mantendo a
> identidade reconhecível e sem inventar, substituir ou omitir seus elementos
> característicos. Prefira as cores originais; se precisar adaptá-las, use a
> paleta fornecida ou uma aplicação monocromática adequada.

Complementos por direção de fundo (emitidos somente quando há ativo):

- `studio`/`ambient`: “Antes de alterar as cores do ativo, priorize o
  posicionamento e a adequação do fundo para preservar contraste e legibilidade.”
- `original`: “Não altere o produto nem o cenário para resolver o contraste;
  priorize posição, escala e adaptação cromática do ativo.”

Sem paleta fornecida, a cláusula condicional usa apenas “uma aplicação
monocromática adequada”, sem afirmar que a paleta existe.

## Arquivos

- `src/lib/product-1-1/prompt-composition.ts` (seams aditivos; defaults 1:1).
- `src/lib/product-1-1/orchestration/generation-orchestrator.ts` (ordem dos anexos).
- `src/lib/product-vertical-9-16/prompt/composition.ts`.
- `src/lib/product-vertical-9-16/prompt/policy-formato-9-16.ts`.
- `src/lib/product-vertical-9-16/prompt/registry.ts`.
- testes de prompt, composição, adapter e allowlist.
- `src/lib/product-1-1/__tests__/non-activation.contract.test.ts` (par exato).

## Commit

- `1e1e21b8` — `feat(59-10): consolidate vertical prompt and attachment identity`
- `3f1701d2` — `feat(59-10): allow functional asset adaptation in vertical prompt`
- `6fe95a21` — `docs(59-10): record vertical prompt v3 asset guidance`

## Verificação

| Gate | Resultado |
|---|---|
| Verticais | **18 arquivos / 209 testes passando** |
| 1:1 | **49 arquivos / 943 testes passando** |
| IA | **39 arquivos + 1 skipped / 389 testes + 7 skipped** |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0 — 96 páginas |
| OpenSpec `--strict` | valid |
| `git diff --check` | limpo |

## Prompt — caso Bolo Naked Fruit

Gerado com composer v3, anexos `[produto, ativo]` e a mesma evidência congelada
da campanha original.

```text
[IDENTIDADE E DIREÇÃO VISUAL]
Use o ativo da loja da imagem 2 como referência de identidade. Preserve o nome, o lettering e os elementos gráficos característicos. Adapte escala, posição e espaçamento à composição. Quando indispensável para legibilidade e contraste, ajuste as cores e a disposição dos componentes, mantendo a identidade reconhecível e sem inventar, substituir ou omitir seus elementos característicos. Prefira as cores originais; se precisar adaptá-las, use a paleta fornecida ou uma aplicação monocromática adequada.
Antes de alterar as cores do ativo, priorize o posicionamento e a adequação do fundo para preservar contraste e legibilidade.
Paleta da loja "Padaria da Esquina": cor principal #3B2418; cor de apoio #D59D5E.

[PRODUTO E IMAGENS DE REFERÊNCIA]
Nome obrigatório na arte: "Bolo Naked Fruit"
Inclua todas as palavras, números e unidades - nenhuma informação do nome deve ser omitida, as aspas não fazem parte do nome; capitalização, quebras de linha e arranjo livres.
Descrição: Massa de pão de ló
Recheio e cobertura de frutas
Produto como elemento principal da peça. Reproduza com fidelidade o produto da imagem enviada, incluindo aparência e embalagem.
Descrição: opcional; pode ser adaptada, melhorada ou omitida, preservando o significado.
Textos obrigatórios: exiba cada texto integralmente uma única vez.
Anexos enviados ao modelo, nesta ordem:
- Imagem 1: produto anunciado.
- Imagem 2: ativo da loja.

[CONDIÇÕES COMERCIAIS]
Direção de fundo: Use um fundo de estúdio discreto na paleta da loja, em cor sólida ou gradiente suave, sem cenário ou objetos de apoio.
Garanta contraste para destacar o produto e manter legível o ativo da loja.
Preço de venda: R$ 69,90
Selo: Imperdível
Validade: enquanto durarem os estoques
Oferta: destaque o preço por e mantenha o preço de como secundário, quando informado. Não invente informações comerciais.
Respeite a direção de fundo.

[INTENÇÃO E FORMATO]
A arte é vertical, em proporção 9:16. Preencha todo o canvas com fundo ou ambientação, sem bordas ou faixas vazias.
Reserve para possíveis sobreposições da plataforma: os 14% superiores, os 35% inferiores e os 6% de cada lateral. Reserve também o retângulo do canto inferior direito correspondente a 30% da largura e 40% da altura.
Nessas regiões, mantenha apenas fundo ou elementos não essenciais. Posicione o ativo da loja, todos os textos e as partes essenciais do produto fora dessas regiões.
Não desenhe as áreas reservadas, guias ou marcas de corte.
A peça deve ser compreensível sozinha, sem depender de legenda externa.
Estrutura: peça única.

[INSTRUÇÕES DO PROMPT-BASE]
Crie uma peça profissional e visualmente coerente. Evite elementos decorativos que distraiam do conteúdo principal.

[RESTRIÇÕES E TEXTOS OBRIGATÓRIOS]
Informações obrigatórias na arte: Imagem meramente ilustrativa
Use português correto e natural.
Evite caracteres, símbolos ou pontuação duplicados ou anômalos.
Não corrija silenciosamente os textos de entrada.
```

## Diferenças autorizadas vs. prompt v2

Somente o bloco de identidade mudou:

```diff
 [IDENTIDADE E DIREÇÃO VISUAL]
-Ativo da loja anexado na imagem 2.
-Reproduza o ativo da loja fornecido na imagem 2, preservando símbolo, lettering, proporções e organização interna. Não redesenhe, simplifique, substitua nem reorganize seus componentes.
+Use o ativo da loja da imagem 2 como referência de identidade. Preserve o nome, o lettering e os elementos gráficos característicos. Adapte escala, posição e espaçamento à composição. Quando indispensável para legibilidade e contraste, ajuste as cores e a disposição dos componentes, mantendo a identidade reconhecível e sem inventar, substituir ou omitir seus elementos característicos. Prefira as cores originais; se precisar adaptá-las, use a paleta fornecida ou uma aplicação monocromática adequada.
+Antes de alterar as cores do ativo, priorize o posicionamento e a adequação do fundo para preservar contraste e legibilidade.
 Paleta da loja "Padaria da Esquina": cor principal #3B2418; cor de apoio #D59D5E.
```

O segundo complemento varia por fundo: em `original` ele é substituído por
“Não altere o produto nem o cenário para resolver o contraste; priorize posição,
escala e adaptação cromática do ativo.”

Nenhuma outra diferença foi introduzida; produto, comercial, formato, prompt-base
e restrições permanecem idênticos ao v2.

## Limitações

- Não houve geração paga; a fidelidade do modelo ao ativo ainda precisa ser
  validada em uma única geração acompanhada, após aprovação.
- A política técnica de safe area e seus pixels permanecem em `safe-area.ts` para
  validação por sobreposição, fora do prompt artístico.
- O prompt bruto do provider continua não persistido por design; a comparação é
  determinística a partir da evidência congelada.
