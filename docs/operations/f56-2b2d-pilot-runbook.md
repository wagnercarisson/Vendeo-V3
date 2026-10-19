# Runbook do Piloto — F56.2b2d (Produto 1:1 Hospedado em Lojas de Teste)

**Escopo:** execução manual, restrita e monitorada do piloto hospedado do Produto 1:1, limitado a
**lojas de teste**. Nenhuma loja não-test é habilitada. `all_stores` permanece sempre recusado.

**Regra de escopo:** este runbook **descreve** o piloto. Nenhum script desta fase abre a janela,
habilita lojas, configura produção ou faz chamada paga.

## Pré-requisitos — antes da primeira chamada paga

> **CHECKPOINT HUMANO — aceite para iniciar (perfil `pilot`).**

- **Provas simuladas** (P1 local) concluídas com sucesso.
- **Aceite para iniciar** registrado **antes** da primeira chamada paga. Sem este aceite, a janela
  não abre.
- Release aprovado (todas as cinco etapas de `f56-2b2d-release-runbook.md` com `APPROVED`).
- Evidência de `pilot` com todos os critérios `PASS` + fonte + timestamp
  (`verify-hosted-release.mjs --check <pilot.json> --profile pilot`).

## Janela de Execução

- `product_1_1_test_stores_enabled=true` **apenas durante a janela**; reverter para `false` ao
  encerrar (desligamento normal abaixo).
- `all_stores=false` durante toda a janela.
- Autorização vigente: estágio `test_stores` + escopo `test_stores`, com `operation_id` registrado.
- Teto de gasto e orçamento definidos; nenhuma chamada paga sem `acquired` no gate de gasto.
- Janela, orçamento e responsáveis registrados antes do início.

## Monitoramento

Acompanhar durante a janela:

- **concorrência** de operações;
- **retry/fallback** de provider;
- desfechos **sucesso / falha / `unknown`**;
- **gasto** acumulado contra o teto;
- **claims** (reservas) e operações em voo.

## Critérios de Parada

Encerrar a janela imediatamente se ocorrer qualquer:

- erro ou timeout acima do limite tolerado;
- limite de chamadas ou teto de gasto atingido;
- corrida perdida (claim `existing_in_flight`/`closed` inesperado);
- estado inesperado (desfecho não previsto, divergência de flags/autorização);
- flag do novo fluxo observada como `false` enquanto deveria estar `true`.

## Desligamento Normal

O desligamento normal do piloto é composto **por dois passos**:

1. Colocar a **flag do novo fluxo em OFF** (`product_1_1_test_stores_enabled=false`), e
2. **Revogar** a autorização `test_stores` (evento `off`).

**PROIBIDO** usar `VENDEO_GENERATION_PAUSED` como controle do piloto. `VENDEO_GENERATION_PAUSED`
é o freio de emergência do **legado** e **não** é o desligamento normal do piloto; usá-lo como
controle do piloto é expressamente proibido.

A pausa global (`VENDEO_GENERATION_PAUSED`) só é acionada em **emergência explicitamente
autorizada**, nunca como desligamento de rotina.

**Operações em andamento NÃO são canceladas** pelo desligamento: elas seguem até o terminal
honesto (inclusive `unknown`/pendência) e não prometem escrita após kill.

## Verificação Final

- Confirmar que a flag do novo fluxo está OFF e a autorização `test_stores` foi **revogada**.
- Confirmar que `all_stores=false`.
- Confirmar que **nenhuma loja não-test foi habilitada**.
- Confirmar que a pausa global permaneceu no estado anterior (não foi usada como controle).
- Registrar a evidência de encerramento fora do Git.
