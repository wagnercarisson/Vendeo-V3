# Quick 261010-rsp — classificar resposta de identidade (recusa/vazio/JSON)

Pedido humano: tornar a próxima tentativa de análise de identidade visual diagnosticável — sem aumentar tokens, trocar modelo ou fazer chamadas pagas.

## Escopo

- Aditivo em `AiInvocationResult` (`finishReason`, `refusal`); adapter chat-completions propaga ambos e preserva `content`.
- `BrandDirectorService` valida antes do `JSON.parse` e classifica por prioridade: recusa → truncamento → conteúdo vazio → JSON inválido → formato inválido (`invalid_json_shape`), sem novo `TypeError`.
- Diagnóstico sanitizado (`errorType`/`finishReason`/presença de recusa/`contentLength`); removido o log de conteúdo bruto (`Full raw`). Falha de transporte mantém `api_error` + `providerKind`.
- Rotas retry/realign devolvem mensagem pública por `errorType`; status HTTP preservados; `logo/route.ts` e o formulário não alterados.
- Testes com fakes/mocks, sem rede/provider. Sem retry/fallback automático.

## Aceite e limites

Fronteira: `src/lib/ai/types.ts`, `src/lib/ai/adapters/chat-completions.ts`, `src/lib/brand-assets/brand-director.ts`, rota `logo/retry-brand-director`, rota `brand-profile/realign` e testes correlatos. Sem prompt/modelo/tokens/telemetria/status HTTP/`.env`/banco/F51/F56. Causa da resposta real permanece dependente de confirmação humana.

Rollback: `git revert` dos commits deste quick; sem migrations nem estado externo.
