# SUMMARY — quick 261125-i09

## Resultado

A montagem inicial do fluxo conjunto 1:1+9:16 passou a fornecer ao compositor da
base quadrada as mesmas instruções institucionais já aprovadas do 1:1 isolado e
do 9:16 isolado. Todo o processamento posterior permanece inalterado.

## Alteração funcional

Ponto único em
`src/lib/product-two-format/orchestration/joint-initial-snapshot.ts`: a chamada
existente de `buildNewFlowIdentityBlock` recebeu:

- `identityState: effectiveIdentitySnapshot.identityState`;
- `hasIdentityAsset: identityImage !== null` (validação + conversão efetiva para
  `data URL`);
- `typographyDirection` do perfil já resolvido;
- `textOnlyInstitutionalIdentity: true`;
- `logoInstitutionalIdentity: true`.

Nenhum helper, redação, versão (`48.2.6-identity-context-v4`), import ou campo de
snapshot foi criado/alterado. O mecanismo de transporte e congelamento de
`identityDirective` permaneceu o mesmo; seu conteúdo passa a incluir as redações
aprovadas, como pretendido.

Fallbacks preservados: `logo`/`visual_signature` sem arquivo continuam com o
texto reconciliado anterior e não viram `text_only`. A direção tipográfica entra
somente no `text_only` quando disponível.

## Arquivos

**Produção:**

- `src/lib/product-two-format/orchestration/joint-initial-snapshot.ts`
- `src/lib/product-1-1/identity-context.ts` (somente comentários)
- `src/app/api/campaign/generate-image/route.ts` (somente comentários)

**Testes:**

- `src/lib/product-two-format/orchestration/__tests__/handle-joint-generate.contract.test.ts`
  — teste de `logo` com arquivo atualizado; casos novos de `text_only` com/sem
  tipografia, `logo` sem arquivo, `visual_signature` com/sem arquivo;
  congelamento e referência de identidade.
- `src/lib/product-1-1/__tests__/identity-context.contract.test.ts` — somente
  rótulos “fronteira joint” → “chamador sem opt-in”.

**Documentação:**

- `openspec/specs/product-1-1-prompt-composition/spec.md`
- `.planning/quick/261125-i09-.../PLAN.md`, `deferred-items.md`, `SUMMARY.md`
- `.planning/STATE.md`

## Gates

- **Testes focados:** 7 arquivos / **268 testes PASS**
  (`handle-joint-generate`, `joint-boundaries`, `identity-context`,
  `non-activation`, `base-step`, `prompt`, `route`).
- **Lint:** exit 0.
- **Build:** exit 0.
- **OpenSpec strict** (`product-1-1-prompt-composition`): válido.
- **`git diff --check`:** limpo.
- **Typecheck:** **falha preexistente** — 4 erros `TS18047` em
  `src/app/api/campaign/generate-image/__tests__/route.test.ts` (linhas
  3082/3084/3142/3239, testes da quick 261125-i08). Baseline no `HEAD`
  (`60bfa6b4`) reproduz exatamente os mesmos 4 erros; **0 erros novos**. Não
  corrigidos por estarem fora do escopo desta quick.

## Limites e pendências

- 1:1 isolado e 9:16 isolado preservados; contraste, temas, versionamento,
  arquitetura, expansão, persistência, anexos, modelo, qualidade, reservas,
  cobrança, entrega, legado e Laboratório intactos.
- Campanha conjunta persistida com diretiva anterior, reenviada sem operação
  existente, pode retornar `409 operation_identity_conflict`; snapshots não são
  reescritos.
- **Aceite visual pendente:** o usuário fará uma geração conjunta e avaliará a
  identificação institucional nos resultados 1:1 e 9:16. Testes de montagem e
  transporte não comprovam aderência visual da IA.
- Sem push, merge, deploy, migrations, banco/Storage ou chamadas pagas de IA.
  `.f62-check/` preservada.
