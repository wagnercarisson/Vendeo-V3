# 62-08 — POST manual da Jarra: 403 `confirmation_expired`

**Status:** **POST MANUAL CAPTURADO; 403 `confirmation_expired`; SEM OPERAÇÃO/RESERVA/COBRANÇA; MENSAGEM ESPECÍFICA MAPEADA; `62-08` NÃO CONCLUÍDO.**
**Data:** 2026-11-23.
**Aba/sessão:** Microsoft Edge, aba ativa
`http://localhost:3000/campanhas/c06b16f5-f126-429c-b5b0-9567fe4adb95`.
**Network:** aberto na mesma aba, **“Manter log” ligado**, log limpo antes da
confirmação manual. Nenhum cookie foi removido e nenhum POST foi repetido pelo
executor.
**Nenhum token, cookie ou segredo foi registrado.**

## Captura do POST manual

O responsável fez **uma única confirmação manual** no botão “Confirmar adição”.
O Network preservou a requisição:

| Campo | Valor |
|---|---|
| Método | **POST** |
| URL | `http://localhost:3000/api/campaign/c06b16f5…/format-additions` |
| Status | **403 Forbidden** |
| `Content-Type` | `application/json` |
| `Content-Length` | 460 |
| Origem | `http://localhost:3000` (same-origin) |
| Código seguro preservado na modal | **`confirmation_expired`** |
| `data-state` da modal | `unavailable` |
| Mensagem exibida antes do mapeamento | “Não foi possível confirmar a adição agora. Tente novamente.” |

O corpo do 403 é `{ error: { code: "confirmation_expired", … } }`; a mensagem
crua não é registrada. O código técnico foi preservado em `data-reason`.

## Condição exata no servidor

- O token de confirmação do GET tem TTL de **10 minutos**
  (`FORMAT_ADDITION_CONFIRMATION_TTL_MS = 10 * 60 * 1000`).
- O POST manual ocorreu às **23:32:31 UTC**. O token emitido no GET anterior já
  havia expirado (o último `expiresAt` observado era 23:27:26 UTC).
- A rota de POST valida o token e, para `expired`, responde
  **403 `confirmation_expired`** antes de qualquer criação de operação,
  reserva ou cobrança.

## Operação/reserva antes de nova tentativa

Comparação antes × depois do POST, sem qualquer retry:

| Métrica | Antes | Depois |
|---|---|---|
| `campaign_format_additions` da campanha | 0 | **0** |
| Operações de crédito | 1 (`delivered`) | **1 (`delivered`)** |
| Saldo da loja | 8 | **8** |
| `credit_transactions` | 29 / soma 8 | **29 / soma 8** |
| Piloto — paid calls da campanha | 2 | **2** |
| Piloto — `spent_usd` | 2.1989 | **2.1989** |
| Artefatos 1:1 | 1 | **1** |

**Não houve operação, reserva, débito, estorno ou nova geração.** O 403 ocorreu
na validação do token, antes de qualquer efeito financeiro.

## Correção aplicada

- `confirmation_expired` e `invalid_confirmation` passaram a ter mensagens
  específicas em pt-BR e es-419:
  - “A confirmação expirou. Feche e abra a modal novamente para gerar uma nova
    confirmação.”
  - “A confirmação não é mais válida. Feche e abra a modal novamente.”
- O código seguro continua em `data-reason`; nenhum retry automático foi
  adicionado. A modal não oferece “Confirmar” após o 403.
- Reabrir a modal emite um novo GET/token de 10 minutos.

## Validação

- Teste unitário: 403 `confirmation_expired` → mensagem específica,
  `data-state="unavailable"`, `data-reason="confirmation_expired"` e ausência do
  botão de confirmação.
- Mesma aba/sessão recarregada: GET **200 `eligible`**, novo token de 10
  minutos, modal “Custo: 1 crédito” + “Confirmar adição” habilitado; o chunk
  novo contém `confirmation_expired` e não contém o retry de 401.
- O POST expirado **não foi repetido**; a correção de mensagem foi validada por
  teste unitário e pelo código preservado na própria aba.

## Garantias

| Verificação | Resultado |
|---|---|
| POST repetido pelo executor | **não** |
| Cookies removidos | **não** |
| 401 simulado | **não** |
| IA / geração / cobrança | **não executados** |
| Operação/reserva criada | **nenhuma** |
| Flags/configurações | **não alteradas** |

App em `http://localhost:3000`. `62-08` permanece **não concluído**.
