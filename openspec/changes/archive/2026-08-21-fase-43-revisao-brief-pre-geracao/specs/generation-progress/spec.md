# Generation Progress

## Purpose

Delta F43 (D5): a fase `input_validation` é exibida como **`skipped`** / "Brief confirmado pelo usuário" no `GenerationProgress` — nunca como "Validação concluída" sem ter chamado IA. Quando o override (`brief_review_confirmed` ou `user_confirmed_continue`) pula a validação vision, o serviço emite a fase com **obrigatoriamente** `status: "skipped"` (detail/mensagem opcional "Brief confirmado pelo usuário" ou "Validação dispensada") e a UI exibe esse estado de forma não-enganosa.

## ADDED Requirements

### Requirement: Fase input_validation exibida como skipped quando pulada (F43 D5)

O `GenerationProgress` SHALL exibir a fase `input_validation` como **`skipped`** quando o evento de fase chega com `status: "skipped"` (override que pulou a IA de visão) — em vez de apresentar uma "Validação concluída" (`complete`) que não houve.

- Quando o evento chega com `status: "skipped"`:
  - O indicador da fase `input_validation` SHALL exibir o estado skipped (não `complete`/check).
  - A mensagem/descrição SHALL refletir que a validação foi **pulada** ("Brief confirmado pelo usuário" / "Validação dispensada") — sem sugerir que uma IA validou.
- Quando o evento chega com `status: "complete"` (validação real rodou), o comportamento atual é preservado.
- A fase `input_validation` nunca SHALL ser exibida como `complete` sem uma chamada de IA real correspondente — o serviço emite **obrigatoriamente** `skipped` quando o override pula (nunca `complete` com detail, o que reintroduziria a fase falsa).

#### Scenario: input_validation skipped é exibida como pulada

- **WHEN** `ImageGenerationService` emite a fase `input_validation` com `status: "skipped"` (override `brief_review_confirmed`)
- **THEN** o `GenerationProgress` exibe o indicador `input_validation` como skipped
- **AND** a mensagem reflete "Brief confirmado pelo usuário" / "Validação dispensada" — nunca "Validação concluída"

#### Scenario: input_validation skipped para user_confirmed_continue

- **WHEN** `ImageGenerationService` emite a fase `input_validation` com `status: "skipped"` (override `user_confirmed_continue`)
- **THEN** o `GenerationProgress` exibe o indicador como skipped (mesmo comportamento)

#### Scenario: input_validation complete preserva o comportamento atual

- **WHEN** a validação IA rodou de verdade (sem override)
- **THEN** a fase `input_validation` é exibida como `complete` (comportamento atual preservado)

### Requirement: GenerationPhaseStatus já suporta skipped (F43 D5)

O tipo `GenerationPhaseStatus` SHALL continuar incluindo `"skipped"` (já definido em `schema.ts:143`) e o `GenerationProgress` SHALL tratar esse estado de forma explícita para a fase `input_validation` — exibindo o rótulo/estado de skip sem marcá-lo como sucesso de validação IA.

#### Scenario: Status skipped é renderizado sem check de validação

- **WHEN** um evento `input_validation` com `status: "skipped"` é recebido pelo `GenerationProgress`
- **THEN** o estado renderizado é o de skip (neutro/pulado), sem o check de "validação concluída"