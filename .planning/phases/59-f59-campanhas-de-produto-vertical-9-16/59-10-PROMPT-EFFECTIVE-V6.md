# 59-10 — Prompt efetivamente composto na execução v6

## Execução

| Campo | Valor |
|---|---|
| Campanha | `bc10ce42-d330-4332-a7e9-9045bd80b72b` |
| Operação | `1b31c766-a1f6-4e2b-9fdf-ebdb33b8f15e` |
| Status | `ready` / delivered |
| Criada / entregue | 2026-11-05 22:46:36 / 22:46:56 UTC |
| Arte | `.../product-9-16/1b31c766-a1f6-4e2b-9fdf-ebdb33b8f15e/art-1080x1920.jpg` |
| Dimensões | 1080 × 1920 JPEG |
| Modelo / qualidade | `gpt-image-2.5-sunburst` / `medium` |
| Custo imagem / copy | US$ 0,029719 / US$ 0,000176 |

## Versões congeladas

| Campo | Valor |
|---|---|
| `composer_version` | `f59-vertical-9-16-composer-v6` |
| `base_version` | `48.2.6-produto-1-1-v1` |
| `policy_versions.formato` | `f59-9-16-v4` |
| `policy_versions.safeArea` | `safe-area-9-16-v1` |
| intenção / fundo | `offer` / `studio` |

## Entradas congeladas

Briefing exato de `product_1_1_snapshot_frozen_evidence`:

```json
{"backgroundDirection":"studio","product":{"name":"Bolo Naked Fruit","description":"Massa de pão de ló"},"commercial":{"intent":"offer","originalPriceText":null,"discountedPriceText":"R$ 69,90","badge":"Imperdível","validity":"enquanto durarem os estoques"},"constraints":{"mandatoryArtworkText":"Imagem meramente ilustrativa\nRecheio e cobertura de frutas"},"identity":{"storeName":"Padaria da Esquina","palettePrimary":"#3B2418","paletteAccent":"#D59D5E"}}
```

Referências na ordem real:

- produto: `9110f31a5528ead0201e1ef35e6f1431e6a4a7437f5067ff2253df62eec7a304`;
- ativo da loja: `21e5e037f6605bb9c6fb3365959b4cc9c162bd9cb9121165f395e8872b7ea759`.

Diretiva de identidade congelada:

```text
Assinar a campanha com a assinatura visual da loja fornecida como imagem de referência. Manter fidelidade ao arquivo fornecido. Não adicionar logotipo.
Paleta da loja "Padaria da Esquina": cor principal #3B2418; cor de apoio #D59D5E.
```

## Prompt reconstruído deterministicamente

O prompt bruto do provider não é persistido. A reconstrução abaixo usa o
compositor v6 e exatamente o briefing, as referências e a diretiva congelados
acima. O resultado é determinístico.

```text
Crie uma campanha de oferta, em peça única.

[REFERÊNCIAS]
Imagem 1: produto anunciado. Preserve sua aparência e use-o como protagonista.
Imagem 2: ativo da loja. Preserve sua identidade, adaptando sua aplicação à composição e ao contraste, sem descaracterizá-lo.

[DADOS DA CAMPANHA]
Loja: "Padaria da Esquina"
Produto: "Bolo Naked Fruit"
Descrição: "Massa de pão de ló"
Preço: "R$ 69,90"
Selo: "Imperdível"
Validade: "enquanto durarem os estoques"
Aviso obrigatório: "Imagem meramente ilustrativa\nRecheio e cobertura de frutas"
Paleta: principal #3B2418; apoio #D59D5E.

[COMPOSIÇÃO]
Crie uma peça profissional e visualmente coerente. Evite elementos decorativos que distraiam do conteúdo principal.
Destaque o preço de venda.
Não invente informações comerciais.
Use fundo de estúdio liso ou gradiente suave na paleta da loja, com bom contraste e sem objetos de apoio.
Antes de alterar as cores do ativo, ajuste posicionamento e fundo para obter contraste.
A descrição é opcional e pode ser adaptada ou omitida, preservando seu significado.
Preserve o nome do produto, os textos comerciais e os textos obrigatórios, exibindo cada um uma única vez.
Use português correto e natural, sem caracteres ou pontuação duplicados, e não corrija silenciosamente os textos de entrada.

[ÁREAS RESERVADAS]
Saída: arte estática para Instagram, vertical 9:16, com fundo preenchendo todo o quadro.

Área protegida: mantenha textos, preço, ativo da loja e partes essenciais do produto entre 6% e 94% da largura e entre 14% e 65% da altura. Dentro dessa região, preserve também o canto inferior direito reservado — últimos 30% da largura e 40% da altura. Fora da área protegida, use apenas fundo e elementos não essenciais. Não desenhe guias ou faixas.
```

## Conferência

- 1.737 caracteres; 30 linhas.
- SHA-256: `181703e8d6474811e2785c99b93b780a3727c86250f2a494f33af401709ff34a`.
- Esse hash é **idêntico** ao prompt preparado antes do teste em
  `quick/261105-f59-safe-area-wording/SUMMARY.md`.
- A execução usou o compositor v6; não é reconstrução das versões v1–v5.
- Nenhuma campanha, artefato ou evidência foi alterado.

## Limitação

O prompt efetivamente enviado ao provider não é armazenado bruto por design.
A confirmação é a reconstrução determinística a partir da evidência congelada e
do código versionado. A correspondência de hash com o prompt preparado antes da
submissão reforça a fidelidade da reconstrução.
