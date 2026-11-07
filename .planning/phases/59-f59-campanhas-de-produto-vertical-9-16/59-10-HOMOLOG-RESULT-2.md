# 59-10 — Resultado anterior da geração vertical (registro)

## Escopo

Registro factual das duas gerações verticais do produto **Bolo Naked Fruit**
na loja **Padaria da Esquina** (homolog). Nenhuma campanha foi alterada.
Observações visuais do responsável são registradas como avaliação manual, não
como conclusão causal.

## Campanhas e operações

| Geração | Campanha | Operação | Criada em | Status | Crédito |
|---|---|---|---|---|---|
| 1 | `01a66557-6643-47d1-b284-12a7eb201e41` | `65ba4ecf-466e-4dbf-bead-06cffab7a3a2` | 2026-11-05 17:01 UTC | ready / delivered | 1 |
| 2 | `0166cbb9-ae5d-4fd3-be5e-6ed8e6c04164` | `6d9d3fab-0f65-4095-8285-c51b17298752` | 2026-11-05 21:57 UTC | ready / delivered | 1 |

Artefatos: JPEG 1080 × 1920 em `.../product-9-16/<operação>/art-1080x1920.jpg`.

## Versões efetivamente registradas

| Campo | Geração 1 | Geração 2 |
|---|---|---|
| `composer_version` | `f59-vertical-9-16-composer-v1` | `f59-vertical-9-16-composer-v1` |
| `policy_versions.formato` | `f59-9-16-v1` | `f59-9-16-v1` |
| `policy_versions.safeArea` | `safe-area-9-16-v1` | `safe-area-9-16-v1` |
| `base_version` | `48.2.6-produto-1-1-v1` | `48.2.6-produto-1-1-v1` |
| intenção / fundo | `offer` / `studio` | `offer` / `studio` |
| modelo / qualidade | `gpt-image-2.5-sunburst` / `medium` | `gpt-image-2.5-sunburst` / `medium` |
| fallback do snapshot | `gpt-image-2` / `low` | `gpt-image-2` / `low` |

**As duas gerações usaram o mesmo compositor v1 e o mesmo formato v1.** As
iterações de prompt v2–v5 não foram exercidas por essas campanhas. Portanto,
o resultado observado não é evidência de aceitação ou rejeição dessas versões.

Custos registrados:

- geração 1: imagem US$ 0,031964 + copy US$ 0,000169 = **US$ 0,032133**;
- geração 2: imagem US$ 0,031964 + copy US$ 0,000171 = **US$ 0,032135**.

## Entradas congeladas

| Campo | Geração 1 | Geração 2 |
|---|---|---|
| Produto (referência de conteúdo) | `9110f31a5528ead0…` | `9110f31a5528ead0…` |
| Ativo da loja (referência de conteúdo) | `21e5e037f6605bb9…` | `21e5e037f6605bb9…` |
| Descrição | “Massa de pão de ló\nRecheio e cobertura de frutas” | “Massa de pão de ló” |
| Aviso obrigatório | “Imagem meramente ilustrativa” | “Imagem meramente ilustrativa\nRecheio e cobertura de frutas” |
| Preço / selo / validade | R$ 69,90 / Imperdível / enquanto durarem os estoques | idem |
| Paleta | #3B2418 / #D59D5E | idem |

As referências de conteúdo do produto e do ativo são **as mesmas** nas duas
gerações. A descrição e o aviso obrigatório mudaram entre elas; o id de upload
da imagem primária também difere, mas o hash de conteúdo do produto permanece
`9110f31a…`.

## Ativo vigente da loja

- Assinatura ativa: `48b212f8-…/5ced8af3-bf92-447f-9f7a-5df430347753.png`.
- SHA-256 do arquivo ativo: `21e5e037f6605bb9c6fb3365959b4cc9c162bd9cb9121165f395e8872b7ea759`.
- Esse hash é **idêntico** ao `frozenContentReferences.identity` das duas
  gerações do bolo.
- A campanha antiga de pão `22d4c990-91c8-4ea5-a4db-a59c7e559499` usou outra
  referência de identidade (`fdc14e5a69921f39…`) e outra diretiva/paleta. A
  diferença visual em relação a ela, portanto, não comprova perda do ativo
  vigente nem falha no briefing atual.

## Observações do responsável (avaliação manual)

- A assinatura visual foi ajustada na composição; a aceitabilidade desse ajuste
  permanece em avaliação.
- As áreas seguras não foram respeitadas: identidade próxima ao topo; preço,
  validade e texto obrigatório na região inferior reservada.
- A primeira geração foi considerada visualmente melhor. É avaliação manual,
  não conclusão causal sobre o prompt.
- As alterações simultâneas entre versões/entradas não permitem atribuir o
  resultado a uma única mudança.

## Preservação

Nenhuma campanha, artefato, snapshot ou evidência foi modificado. As imagens
originais permanecem nos paths registrados acima.
