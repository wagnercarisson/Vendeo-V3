# CNAE Segment Mapping

> Synced from `fase-42-signup-controlado-elegibilidade-freemium` (ADDED).

## Purpose

Mapeamento determinístico segmento × CNAE (`cnae-mapping.ts`): normalização de subclasse (7 dígitos), derivação de classe (4+DV), quatro conjuntos por segmento (classes/subclasses positivas e negativas), `cnaeCompatibilityFor` com precedência de subclasse exata, validação de não-contradição em build/CI e CNAE nunca como motivo de rejeição (D9/D10).

## Requirements

### Requirement: Normalização da subclasse (7 dígitos + DV) e derivação da classe (4 + DV)

O sistema SHALL normalizar o CNAE principal para a **subclasse com 7 dígitos** (removendo pontuação) e derivar a **classe com 4 dígitos + DV** (5 caracteres) — D9.

- `normalizeCnaeSubclasse(raw)`: remove pontuação (`"4781-4/00"` → `"4781400"`); se não resultar em **exatamente 7 dígitos** → retorna `null` (inválido).
- `deriveCnaeClasse(subclasse)`: os 5 primeiros caracteres da subclasse (`"4781400"` → `"47814"`).
- Granularidade explícita CNAE 2.0/IBGE: divisão (2), grupo (3), classe (4+DV), subclasse (7).
- **Os códigos ilustrativos não devem ser copiados para implementação antes de validação na CONCLA/IBGE.**

#### Scenario: Subclasse normalizada de CNAE com pontuação

- **WHEN** `normalizeCnaeSubclasse("4781-4/00")` é chamado
- **THEN** retorna `"4781400"` (7 dígitos)

#### Scenario: Subclasse sem 7 dígitos é inválida

- **WHEN** `normalizeCnaeSubclasse` recebe um valor que não resulta em 7 dígitos (ex.: `"47814"`)
- **THEN** retorna `null`

#### Scenario: Classe derivada da subclasse

- **WHEN** `deriveCnaeClasse("4781400")` é chamado
- **THEN** retorna `"47814"` (4 dígitos + DV)

### Requirement: Quatro conjuntos por segmento — classe × subclasse separadas

O mapeamento SHALL guardar, **por segmento**, quatro conjuntos: `compatible.classes`, `compatible.subclasses`, `incompatible.classes`, `incompatible.subclasses` — D9.

- Uma **classe** (4+DV, ex.: `47814`) listada cobre **todas** as subclasses dela.
- Uma **subclasse** (7, ex.: `4781400`) listada cobre **apenas ela** — não a classe inteira.
- Segmentos vêm do enum de `stores.segment` (F40); `outros` mantém conjuntos vazios.

#### Scenario: Módulo expõe os quatro conjuntos por segmento

- **WHEN** o módulo `cnae-mapping.ts` é inspecionado
- **THEN** existe um registro por segmento com `compatible.classes`, `compatible.subclasses`, `incompatible.classes`, `incompatible.subclasses`

#### Scenario: Segmento outros tem conjuntos vazios

- **WHEN** o segmento `outros` é consultado
- **THEN** os quatro conjuntos estão vazios
- **AND** `cnaeCompatibilityFor("outros", ...)` retorna `unknown` (neutro)

### Requirement: cnaeCompatibilityFor — avaliação determinística com precedência de subclasse exata

O sistema SHALL prover `cnaeCompatibilityFor(segment: string, cnaePrincipal: string | null): CnaeCompatibility` (`"compatible" | "incompatible" | "unknown"`) avaliando na ordem explícita — D9:

1. `negative.subclasses` (subclasse exata NEGATIVA) → `incompatible`
2. `positive.subclasses` (subclasse exata POSITIVA) → `compatible`
3. `negative.classes` (classe NEGATIVA cobre as subclasses dela) → `incompatible`
4. `positive.classes` (classe POSITIVA cobre as subclasses dela) → `compatible`
5. senão → `unknown`

- CNAE ausente, inválido (sem 7 dígitos) ou fora de ambas as listas → **`unknown`** (não penaliza).
- A precedência de subclasse exata permite **exceções finas**: classe `47814` positiva + subclasse `4781400` negativa → `4781400` é `incompatible`, as demais subclasses seguem a classe.

#### Scenario: CNAE na lista positiva de subclasses

- **WHEN** `cnaeCompatibilityFor("moda-vestuario", "1412601")` é chamado
- **AND** `1412601` consta em `compatible.subclasses` do segmento
- **THEN** retorna `compatible`

#### Scenario: CNAE na lista negativa de classes

- **WHEN** `cnaeCompatibilityFor("moda-vestuario", "0111300")` é chamado
- **AND** `01113` consta em `incompatible.classes` do segmento
- **THEN** retorna `incompatible`

#### Scenario: Precedência de subclasse exata sobre classe

- **WHEN** `cnaeCompatibilityFor("moda-vestuario", "4781400")` é chamado
- **AND** `47814` consta em `compatible.classes`
- **AND** `4781400` consta em `incompatible.subclasses`
- **THEN** retorna `incompatible` (subclasse exata NEGATIVA prevalece)
- **AND** as demais subclasses de `47814` continuam `compatible`

#### Scenario: CNAE fora de ambas as listas é unknown

- **WHEN** `cnaeCompatibilityFor` recebe um CNAE válido que não consta em nenhuma lista do segmento
- **THEN** retorna `unknown`

#### Scenario: CNAE nulo ou inválido é unknown

- **WHEN** `cnaeCompatibilityFor` recebe `null` ou um valor que não normaliza para 7 dígitos
- **THEN** retorna `unknown`

### Requirement: Validação de não-contradição em build/CI

O sistema SHALL validar em **build/CI** que o **mesmo código** (string idêntica) não aparece nas listas positiva e negativa do mesmo segmento (em classe OU subclasse) — contradição é **erro de build, não runtime** — D9.

- Overlap **pai-filho** (classe numa lista + subclasse dela em outra) é **permitido** e resolvido pela precedência de subclasse exata.
- A validação roda no CI (mesma suíte/build que os testes do módulo).

#### Scenario: Contradição na mesma granularidade falha o build

- **WHEN** o mesmo código (ex.: `47814` em `compatible.classes` E em `incompatible.classes` do mesmo segmento) existe no mapeamento
- **THEN** o build/CI falha com erro de contradição

#### Scenario: Overlap pai-filho é permitido

- **WHEN** `47814` consta em `compatible.classes` E `4781400` consta em `incompatible.subclasses` do mesmo segmento
- **THEN** o build/CI passa (não é contradição — resolvido pela precedência)

### Requirement: CNAE nunca é motivo de rejeição

O sinal CNAE SHALL **nunca** ser motivo de `reject` — `incompatible` é apenas mais um sinal que, somado à avaliação, encaminha para **revisão** (`segmento_cnae_divergente`); `unknown` segue neutro — D9/D10.

#### Scenario: Incompatible alimenta review, nunca reject

- **WHEN** o motor de elegibilidade avalia uma loja com `cnaeCompatible = "incompatible"`
- **THEN** o resultado é `review` com motivo `segmento_cnae_divergente`
- **AND** nunca é `reject` apenas por CNAE

#### Scenario: Unknown não penaliza

- **WHEN** o motor avalia uma loja com `cnaeCompatible = "unknown"`
- **THEN** o sinal CNAE não influencia a decisão (segue a avaliação dos demais sinais)