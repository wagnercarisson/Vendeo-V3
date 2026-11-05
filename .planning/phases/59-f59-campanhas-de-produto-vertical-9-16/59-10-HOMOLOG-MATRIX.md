# F59 / 59-10 — Matriz manual proposta (NÃO EXECUTADA)

Data: 2026-11-05. Status: **aguardando aprovação da matriz e do orçamento**.
Nenhuma geração paga foi executada; a flag continua OFF.

## 1. Limite operacional

Saldos atuais das lojas de teste:

- Loja Mega Vale: **1 crédito**;
- Padaria da Esquina: **4 créditos**.

Total disponível sem nova concessão: **5 créditos**. Como cada entrega consome 1
crédito, a proposta máxima é **5 gerações pagas**:

- **4 verticais** na Padaria da Esquina;
- **1 regressão 1:1** na Loja Mega Vale.

Não será necessário conceder crédito para esta matriz. Qualquer expansão exige
autorização separada de crédito.

## 2. Cenários que REUTILIZAM campanhas existentes (sem geração paga)

| ID | Cenário | Campanha/origem | Ação | Evidência esperada |
|---|---|---|---|---|
| R1 | Detalhe 1:1 existente | Padaria `22d4c990-91c8-4ea5-a4db-a59c7e559499` | abrir detalhe | imagem quadrada, path `product-1-1/.../art-1024.jpg` |
| R2 | Listagem + miniatura 1:1 | Padaria (acima) | abrir `/campanhas` | miniatura atual, sem redesenho |
| R3 | Download 1:1 existente | Padaria (acima) | baixar | 200, JPEG, attachment, nome seguro |
| R4 | Detalhe/download 1:1 existente | Mega Vale `c06b16f5-f126-429c-b5b0-9567fe4adb95` | abrir e baixar | mesmo comportamento do baseline |
| R5 | Operação já entregue / reenvio | campanhas R1/R4 | consultar estado e reenviar | query-only, sem novo crédito/provider |
| R6 | Consulta com flag OFF | qualquer campanha existente | abrir detalhe/listagem/download | funcionamento preservado |
| R7 | Restauração 1:1 | campanha R1 | restaurar rascunho | permanece 1:1 |
| R8 | Lista admin de pendências | fila atual | abrir painel | lista vazia/estado atual, sem regeneração |

## 3. Cenários que EXIGEM geração paga

| ID | Intenção | Fundo | Loja | Produto sugerido | Objetivo |
|---|---|---|---|---|---|
| G1 | Oferta | Estúdio | Padaria | Pão Caseiro | validar arte vertical, copy, 1 crédito, path, detalhe, download e miniatura |
| G2 | Destaque | Ambientado | Padaria | produto de vitrine | validar variação de copy/fundo e legibilidade |
| G3 | Exclusivo | Original | Padaria | produto com **1 imagem** | validar regra “Original exige 1 imagem” e composição |
| G4 | Oferta | Ambientado | Padaria | produto com oferta | validar recuperação vertical e restauração com flag OFF |
| G5 | 1:1 | Estúdio | Mega Vale | produto de referência | regressão manual 1:1: 1024×1024, path 1:1, download e miniatura |

Cada geração deve registrar: `campaignId`, `operationId`, dimensão real, path,
crédito consumido, custo observado, status da operação, detalhe, listagem,
miniatura e download.

## 4. Cenários de falha/recuperação

| ID | Cenário | Estratégia | Status proposto |
|---|---|---|---|
| F1 | Resultado desconhecido | não há operação `unknown` nas lojas de teste; não manipular banco | **PENDING** até procedimento autorizado |
| F2 | Falha confirmada + estorno único | não há falha confirmada disponível; não forçar falha | **PENDING** até procedimento autorizado |
| F3 | Recuperação de imagem vertical | usar G4 após entrega | executar sem nova geração |
| F4 | Recuperação de copy vertical | usar G4 após entrega | executar sem nova geração |
| F5 | Operação já entregue | usar R5 | executar sem nova geração |
| F6 | Restauração vertical flag ON | usar G1–G4 | executar |
| F7 | Restauração vertical flag OFF | usar G1–G4 após desligar | executar, sem troca para 1:1 |
| F8 | Nova submissão vertical flag OFF | tentar nova geração após desligar | rejeitar antes de reserva/provider |

## 5. Ciclo de flag

1. Flag OFF no baseline.
2. Aprovar e ativar temporariamente via RPC auditado, com motivo.
3. Executar G1–G5.
4. Iniciar uma geração e desligar a flag durante a execução.
5. Comprovar que a geração em andamento chega ao terminal.
6. Comprovar consulta/download/recuperação/detalhe/listagem preservados.
7. Comprovar nova submissão vertical rejeitada antes de reserva/provider.
8. Desligar a flag ao final e registrar o estado final OFF.

## 6. Orçamento proposto

Referências:

- imagem principal vertical: estimativa conservadora **US$ 0,110** por chamada;
- fallback vertical: **US$ 0,105** por chamada;
- copy: máximo observado em homolog **US$ 0,004072**, arredondado para
  **US$ 0,0041**.

Proposta conservadora para **5 gerações**, assumindo até 3 tentativas de imagem
por geração no pior caso:

```text
5 gerações × (3 × US$ 0,110 + US$ 0,0041)
= 5 × US$ 0,3341
= US$ 1,6705
+ 20% de contingência
= US$ 2,0046
```

**Teto proposto: US$ 2,00.**
Gasto esperado com o comportamento da prova (1 imagem + 1 copy por geração):
**~US$ 0,16**.

O valor real será apurado por `generation_events` e comparado ao teto. Qualquer
necessidade de mais gerações exige nova autorização de crédito e orçamento.

## 7. Ordem sugerida de execução

1. Reutilizar R1–R8 e registrar o baseline visual/funcional.
2. Ativar a flag com autorização e motivo.
3. Executar G1–G5, uma por vez, com inspeção manual imediata.
4. Executar F3–F8 e o ciclo de flag.
5. Desligar a flag.
6. Comparar custos/contagens com o baseline e emitir o relatório.

## 8. Critérios de parada

Parar imediatamente se:

- alguma dimensão diferente de 1080×1920 na entrega vertical;
- path 1:1 em campanha vertical ou path vertical em campanha 1:1;
- crédito diferente de 1 por entrega;
- download liberado sem operação `delivered` + arte íntegra;
- troca silenciosa de 9:16 para 1:1;
- custo observado ultrapassar o teto;
- qualquer operação de produção for necessária.
