# Quick 261010-rsp — resposta de identidade diagnosticável

Data: 2026-10-10. Somente implementação local; sem reinício, sem provider, sem chamada paga.

## Diagnóstico

`JSON.parse("")` reproduz `Unexpected end of JSON input`: o adapter coagia conteúdo ausente para `""` e o `BrandDirector` usava `content ?? '{}'` (o `??` não cobre string vazia); o `catch` reembrulhava o `SyntaxError` como `api_error`, homogeneizando falha de interpretação e falha de provider. **A causa da resposta real (vazia, truncada ou recusa) ainda depende de confirmação humana** (tentativa paga manual futura), pois `finish_reason`/`refusal` não eram preservados e não houve reprodução com provider.

## Implementado

- Campos aditivos `finishReason?`/`refusal?` em `AiInvocationResult`; adapter chat-completions propaga ambos e mantém `content` (comportamento legado).
- `BrandDirectorService.parseVisionResponse()` com prioridade recusa → truncamento → vazio → JSON inválido → `invalid_json_shape` (sem `TypeError`); log de conteúdo bruto (`Full raw`, `rawKeys`) removido e substituído por diagnóstico sanitizado; falha de transporte preserva `api_error` com `providerKind`.
- Rotas `logo/retry-brand-director` e `brand-profile/realign` (caminho logo) devolvem mensagem pública por `errorType`; status HTTP inalterados. `logo/route.ts` e `store-identity-form.tsx` intocados (contrato único já satisfeito).

## Gates efetivos (typecheck com cache `.tsbuildinfo` removido)

- typecheck: **0 erros** (baseline limpo também 0) — sem regressão.
- lint: **exit 0** — sem regressão.
- testes focalizados: **5 arquivos / 56 testes verdes**.
- suíte completa: **19 arquivos / 20 testes falhando** — **idêntico ao baseline** (pré-existentes: integração DB, `legal-document-versions`, `lab/bench`, `image-generation`); 0 regressões; +2 arquivos / +28 testes.

Revisão humana anterior encontrou **2 erros reais de typecheck** nas fixtures de erro (metadata incompleto, mascarado por cache incremental); corrigidos com `provider`/`model`/`elapsedMs` completos, sem enfraquecer o tipo de produção. Acrescentadas assertivas explícitas de **exatamente uma invocação ao invoker/sem fallback** e de **logs sem conteúdo bruto/recusa textual**.

## Pendências

- Causa real da resposta depende de tentativa paga humana (fora do quick).
- Distinção fina de recusa depende dos campos `refusal`/`finish_reason` do provider.
- F51/F56 intocados; sem provider, restart, migrations ou deploy.
