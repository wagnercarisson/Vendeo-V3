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
- `src/app/api/campaign/generate-image/__tests__/route.test.ts` — correção
  pontual de typecheck (ver retificação abaixo); nenhuma asserção de produção ou
  contrato alterada.

**Documentação:**

- `openspec/specs/product-1-1-prompt-composition/spec.md`
- `.planning/quick/261125-i09-.../PLAN.md`, `deferred-items.md`, `SUMMARY.md`
- `.planning/STATE.md`

## Cross-check de testes executados

- **7 arquivos / 268 testes PASS** na verificação focada:
  `handle-joint-generate`, `joint-boundaries`, `identity-context`,
  `non-activation`, `base-step`, `prompt` e `route`.
- **`route.test.ts` reexecutado após a correção:** **121 testes PASS**.
- **Lint:** exit 0.
- **Build:** exit 0.
- **OpenSpec strict** (`product-1-1-prompt-composition`): válido.
- **`git diff --check`:** limpo.

## Retificação do typecheck

Os 4 erros `TS18047` (`resume.identityDirective` possivelmente `null`) vinham dos
testes da **quick 261125-i08**, não desta quick. O registro anterior da i08
declarava typecheck aprovado; essa declaração foi **contradita pela verificação
posterior** da i09. O baseline no `HEAD` (`60bfa6b4`, antes das alterações da
i09) reproduziu exatamente os mesmos 4 erros.

Correção autorizada nesta etapa, restrita a
`src/app/api/campaign/generate-image/__tests__/route.test.ts`: narrowing
explícito (`expect(typeof directive).toBe('string')` + guarda `typeof` que
lança erro se ausente) antes das chamadas `split`, preservando a exigência de
diretiva presente e as verificações de conteúdo/ocorrência única. Sem
non-null assertion, coerção de tipo, supressão do TypeScript ou alteração de
produção/contratos/outras asserções.

**`npm run typecheck` reexecutado: exit 0.** Nenhum outro erro surgiu.

## Aceite visual registrado

O usuário aprovou visualmente a geração conjunta:

- **1:1:** `C:/Users/wagne/Downloads/caixa_multiuso_fishbox-2026-11-25 (2).jpg`
- **9:16:** `C:/Users/wagne/Downloads/caixa_multiuso_fishbox-2026-11-25 (1).jpg`

Evidências observadas:

- logotipo institucional “LOJA MEGA VALE” presente e legível em ambos;
- identificação institucional distinta do título promocional “Natal Mega Vale”;
- detalhes textuais preservados e legíveis;
- resultado conjunto aprovado visualmente pelo usuário.

Limites do aceite:

- restrito a essa geração com logotipo;
- não valida manualmente `text_only`, `visual_signature`, outras lojas ou todas
  as gerações;
- fidelidade ao ativo não foi medida independentemente;
- não implica publicação nem aprovação para produção.

## Observação para trabalho futuro

As gerações **ambientadas** apresentaram maior elaboração temática natalina que
os exemplos em **estúdio**. Isso reforça uma hipótese sobre a interação entre
cenário e tema; **não comprova a causa técnica**. Não investigado e não são
alterados prompts de cenário/tema nesta quick.

## Limites e pendências

- 1:1 isolado e 9:16 isolado preservados; contraste, temas, versionamento,
  arquitetura, expansão, persistência, anexos, modelo, qualidade, reservas,
  cobrança, entrega, legado e Laboratório intactos.
- Campanha conjunta persistida com diretiva anterior, reenviada sem operação
  existente, pode retornar `409 operation_identity_conflict`; snapshots não são
  reescritos.
- Demais cenários (`text_only`, `visual_signature`, outras lojas e todas as
  gerações) permanecem **sem validação manual** nesta quick.
- **Implementação local apenas.** Sem push, merge, deploy, migrations,
  banco/Storage ou chamadas pagas de IA. `.f62-check/` preservada.
