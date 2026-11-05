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

## 4. Recuperação: imagem × copy × regeneração

| ID | Cenário | Estratégia | Custo de geração? | Status proposto |
|---|---|---|---|---|
| F1 | Resultado desconhecido | não há operação `unknown`; não manipular banco | não | **PENDING** até procedimento autorizado |
| F2 | Falha confirmada + estorno único | não há falha confirmada disponível; não forçar falha | não | **PENDING** até procedimento autorizado |
| F3 | Recuperação de **imagem** vertical | usar G4 entregue; sonda/download da arte existente | **não** — sem regeneração de imagem | executar |
| F4 | **Consulta de copy** vertical | ler a copy entregue de G4 | **não** | executar |
| F4b | **Eventual regeneração de copy** | somente se a consulta F4 comprovar copy ausente/falha; ação auxiliar de copy | **sim, chamada auxiliar de copy**; não é sexta submissão de campanha | condicional |
| F5 | Operação já entregue / reenvio | usar G4 ou R5; consulta query-only | não | executar |
| F6 | Restauração vertical flag ON | usar G1–G4 | não | executar |
| F7 | Restauração vertical flag OFF | usar G1–G4 após desligar | não | executar, sem troca para 1:1 |
| F8 | Nova submissão vertical flag OFF | tentar nova geração após desligar | não (deve ser rejeitada antes de reserva/provider) | executar |

A recuperação de imagem **não** regenera imagem. A consulta de copy **não**
chama provider. A eventual regeneração de copy é uma chamada auxiliar separada do
orçamento de imagem e **não** conta como sexta submissão de campanha.

## 5. Ciclo de flag durante G4 (sem sexta geração)

1. Flag OFF no baseline.
2. Ativar temporariamente via RPC auditado, com motivo.
3. Executar G1–G3 normalmente.
4. Antes de G4, confirmar flag ON.
5. Submeter G4 (quarta geração).
6. **Durante a execução de G4**, desligar a flag via RPC auditado.
7. Comprovar que G4 em andamento chega ao terminal normalmente.
8. Comprovar consulta, download, recuperação de imagem/copy, detalhe e listagem
   preservados com a flag OFF.
9. Comprovar que nova submissão vertical é rejeitada antes de reserva/provider.
10. Executar a regressão G5 1:1 com a flag OFF, comprovando que o 1:1 não é
    bloqueado.
11. Registrar o estado final da flag como OFF.

**Nenhuma sexta submissão é criada para o ciclo de flag.**

## 6. Orçamento: estimativa operacional × limite garantido

### 6.1 Referências de custo

- imagem principal vertical: estimativa conservadora **US$ 0,110** por chamada;
- fallback vertical: **US$ 0,105** por chamada;
- imagem: custo real observado na prova **US$ 0,029185** por chamada;
- copy: máximo observado em homolog **US$ 0,004072** (arredondado para
  **US$ 0,0041**).

### 6.2 Estimativa operacional (comportamento esperado)

Cenário esperado sem falhas: 1 chamada de imagem + 1 chamada de copy por
geração; eventual regeneração de copy somente se F4 falhar.

```text
5 imagens × US$ 0,029185        = US$ 0,145925
5 copies × US$ 0,0041           = US$ 0,020500
1 eventual regeneração de copy  = até 6 × US$ 0,0041 = US$ 0,024600
------------------------------------------------------------
Total operacional esperado      ≈ US$ 0,191025
```

**Estimativa operacional: ~US$ 0,20.**

### 6.3 Envelope com retries do SDK e política de tentativas

O adapter de produção usa o SDK OpenAI **sem `maxRetries: 0`**. O default do SDK
permite **até 3 tentativas HTTP por invocação** (1 + 2 retries). A política do
orquestrador permite até **3 chamadas lógicas de imagem por geração**
(2 principal + 1 fallback).

Pior caso conservador por geração:

```text
3 chamadas lógicas × 3 tentativas HTTP = 9 chamadas HTTP de imagem
9 × US$ 0,110 = US$ 0,990 por geração
5 gerações = US$ 4,950

copy inicial: 5 × 3 tentativas HTTP × US$ 0,0041 = US$ 0,0615
regeneração de copy: 6 × 3 × US$ 0,0041 = US$ 0,0738
------------------------------------------------------------
Envelope conservador ≈ US$ 5,0853
```

**Envelope de planejamento conservador: ~US$ 5,10.**

### 6.4 Limite efetivamente garantido

**Hoje não existe um hard cap técnico que garanta esse envelope.** O código
limita tentativas lógicas do orquestrador, mas o SDK pode repetir chamadas HTTP
(2 retries por invocação) e a copy não está coberta pelo mesmo teto da imagem.
Também não há orçamento de UAT aplicado no código.

Portanto:

- **estimativa operacional:** ~US$ 0,20;
- **envelope conservador:** ~US$ 5,10;
- **limite garantido:** **nenhum** até haver hardening (por exemplo,
  `maxRetries: 0` no adapter de produção, limite explícito de fallback/copy e
  orçamento de UAT no código);
- **controle operacional proposto:** parar manualmente após cada geração e
  encerrar se o custo acumulado atingir **US$ 2,00**. Esse valor é um **teto
  operacional de aprovação**, não uma garantia técnica.

Qualquer necessidade de mais gerações exige nova autorização de crédito e
orçamento. Nenhuma alteração de código para hardening foi feita nesta etapa.

## 7. Ordem sugerida de execução

1. Reutilizar R1–R8 e registrar o baseline visual/funcional.
2. Ativar a flag com autorização e motivo.
3. Executar G1–G3, uma por vez, com inspeção manual imediata.
4. Submeter G4 com a flag ON e desligá-la durante a execução; confirmar o
   terminal preservado.
5. Com a flag OFF, executar F3 (imagem), F4 (consulta de copy), F4b somente se
   necessário, F5–F8 e a regressão G5 1:1.
6. Manter a flag OFF ao final.
7. Comparar custos/contagens com o baseline e emitir o relatório.

## 8. Critérios de parada

Parar imediatamente se:

- alguma dimensão diferente de 1080×1920 na entrega vertical;
- path 1:1 em campanha vertical ou path vertical em campanha 1:1;
- crédito diferente de 1 por entrega;
- download liberado sem operação `delivered` + arte íntegra;
- troca silenciosa de 9:16 para 1:1;
- custo observado ultrapassar o teto;
- qualquer operação de produção for necessária.
