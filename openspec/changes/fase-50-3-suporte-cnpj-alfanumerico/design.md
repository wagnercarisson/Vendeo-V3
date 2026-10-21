## Context

O Vendeo representa o CNPJ como `TEXT` normalizado em `stores.cnpj_normalized` e assume, em várias camadas, que ele contém exatamente 14 dígitos. A normalização atual (`raw.replace(/\D/g, "")`) remove letras silenciosamente; a validação usa `^\d{14}$`; a constraint `chk_stores_cnpj_atomic` usa `^\d{14}$`; máscaras de input removem letras; e o cache usa a string recebida como chave.

A IN RFB nº 2.229/2024 instituiu o CNPJ alfanumérico, atribuído apenas a novas inscrições a partir de julho de 2026. Os CNPJs numéricos existentes permanecem válidos e não são renumerados. O formato canônico tem 14 posições: 12 caracteres `[A-Z0-9]` (raiz de 8 + ordem de 4) e 2 dígitos verificadores `[0-9]`, calculados pelo mesmo módulo 11, convertendo cada caractere para `ASCII − 48` (`A = 17`, ..., `Z = 42`).

Esta mudança é exclusivamente de compatibilidade de formato. Não altera a política comercial, a oferta de 28 dias, o bloqueio por raiz, `freemium_entitlements`, ownership, RLS, créditos ou modelo institucional.

## Goals / Non-Goals

**Goals:**
- Aceitar, normalizar, validar, persistir, consultar, cachear e exibir CNPJs numéricos e alfanuméricos válidos.
- Garantir uma única representação canônica em todas as camadas, inclusive antes de calcular `cnpj_root_hash` e antes de usar a chave do cache.
- Manter compatibilidade total com CNPJs numéricos existentes: mesmo valor armazenado, mesmo hash, mesma máscara e mesma chave de cache.
- Aplicar migration fail-closed, sem reescrever dados e sem criar dependência para a futura F50.4.
- Cobrir o contrato dos provedores externos e definir fallback seguro quando um deles ainda não suportar o formato.

**Non-Goals:**
- Oferta individualizada por CNPJ completo (F50.4).
- Mudar elegibilidade comercial, conceder ou remover créditos, reativar freemium legado.
- Criar organizações, matriz/filiais, memberships, contas institucionais ou multi-loja.
- Alterar `stores.user_id`, RLS de ownership ou migrar ownership.
- Ativar flags, provedores pagos, migrations remotas, deploy ou produção.
- Resolver definitivamente a identificação de matriz por `substring(..., 9, 4) = '0001'`. A limitação será apenas registrada.

## Decisions

### D1 — Representação canônica única

A normalização de domínio/API SHALL ser estrita:

- A entrada bruta SHALL conter apenas `[0-9A-Za-z]`, `.`, `/`, `-` e espaços. Qualquer outro caractere — acento, emoji, símbolo ou letra não ASCII — invalida a entrada.
- `normalizeCnpj(raw)` remove somente a formatação conhecida (`.`, `/`, `-`, espaços) e converte `a-z` para maiúscula.
- Caracteres desconhecidos NÃO são removidos silenciosamente: permanecem no resultado e fazem `validateCnpj` falhar.
- O resultado canônico precisa casar `^[A-Z0-9]{12}[0-9]{2}$`. O comprimento é sempre 14 e a raiz é `normalized.slice(0, 8)`.

O `formatCnpjInput` da UI pode ignorar teclas/colagem fora do conjunto permitido por tolerância de digitação, mas o valor enviado à API é revalidado no servidor. A API e o domínio nunca “corrigem” um CNPJ válido acrescido de lixo.

Consequências:
- `12.abc.345/01de-35` → `12ABC34501DE35`.
- Entradas com letras em posições de DV (`...-A5`, `...-3B`) falham.
- `12.ABC.345/01DE-35😀`, `12.ABC.345/01DE-35!` e `12.ÁBC.345/01DE-35` falham; não são convertidos em `12ABC34501DE35`.
- Espaços internos são tratados como formatação tolerada; o valor canônico não contém espaços.

Alternativa considerada: aceitar apenas entrada já canônica nas APIs. Rejeitada porque o formulário e a colagem enviam pontuação e caixa variada; normalizar formatação conhecida na fronteira reduz divergência sem mascarar caracteres arbitrários.

### D2 — Validação oficial dos DVs sem regressão numérica

O cálculo usa o valor `charCode − 48` de cada caractere canônico e os pesos já existentes:

- 1º DV: `[5,4,3,2,9,8,7,6,5,4,3,2]` sobre os 12 primeiros caracteres.
- 2º DV: `[6,5,4,3,2,9,8,7,6,5,4,3,2]` sobre os 13 primeiros (12 + 1º DV).
- `resto = soma % 11`; `resto < 2 → DV = 0`; caso contrário `DV = 11 − resto`.

Para CNPJs numéricos, `charCode − 48` é exatamente o dígito, então o resultado é idêntico ao algoritmo atual. A lista de sequências numéricas conhecidas (`00000000000000`, `11111111111111`, ...) continua rejeitada. Não será adicionada rejeição semântica nova para letras nesta fase.

Vetores oficiais da Receita/SERPRO:
- Válido: `12.ABC.345/01DE-35` (canônico `12ABC34501DE35`; 1º DV `3`, 2º DV `5`).
- Inválido por DV: `12.ABC.345/01DE-34`.
- Inválido por formato: `12.ABC.345/01DE-3A` (DV não numérico).
- Regressão numérica: `12.345.678/0001-95` e `12345678000195`.

Observação registrada, não implementada: a Nota Técnica Conjunta dos DFe menciona a intenção de excluir letras ambíguas (`I`, `O`, `U`, `Q`, `F`), mas a exclusão depende de confirmação da RFB e o Anexo XV da IN 2.119/2022 não veda letras. Esta fase aceita `A-Z` conforme a regra canônica acordada.

### D3 — Erros e mensagens

- Erro de comprimento após remover formatação: `"CNPJ deve ter 14 caracteres"`.
- Caractere fora de `[0-9A-Za-z./\-\s]`: `"CNPJ inválido"` (sem remover o caractere e sem tentar “corrigir” o valor).
- DV inválido ou sequência conhecida: `"CNPJ inválido"`.
- APIs continuam retornando `400 { error: "CNPJ inválido" }` para validação local, sem detalhar o motivo ao cliente.
- Comentários, tipos e testes que dizem “14 dígitos” são corrigidos apenas onde o contrato passou a ser alfanumérico. Migrations históricas não são editadas.

### D4 — Máscaras e inputs

Separar três responsabilidades em `src/lib/cnpj/`:

| Função | Responsabilidade | Exemplo |
|---|---|---|
| `normalizeCnpj` | canônico, sem pontuação, maiúsculo | `12.abc...` → `12ABC...35` |
| `formatCnpjInput` | máscara progressiva para digitação/colagem | `12ABC` → `12.ABC` |
| `formatCnpj` | exibição completa | `12ABC34501DE35` → `12.ABC.345/01DE-35` |
| `maskCnpj` | privacidade fail-closed | `12ABC34501DE35` → `**.***.***/01DE-**`; inválido → `CNPJ inválido` |

`formatCnpjInput` é a única camada tolerante: ignora caracteres fora de `[0-9A-Za-z./\-\s]` durante digitação/colagem, usa `normalizeCnpj` sobre o subconjunto permitido e aplica a pontuação nos índices 2, 5, 8 e 12, limitando a 14 caracteres canônicos e 18 caracteres formatados. O input permanece `type="text"`, com `autoCapitalize="characters"` e `spellCheck={false}`; não usar `inputMode="numeric"`.

`maskCnpj` é fail-closed: se o valor recebido não casar `^[A-Z0-9]{12}[0-9]{2}$`, retorna o placeholder `"CNPJ inválido"` em vez de devolver o identificador fiscal integral. Nenhuma tela administrativa pode exibir o valor cru em caso de dado inesperado.

Todos os pontos que hoje fazem `replace(/\D/g, "")` para CNPJ passam a usar a função central. Isso elimina as normalizações locais divergentes em `store-identity-form.tsx`, `use-store-form.ts`, `cnpj-update-form.tsx` e na tela admin de loja de teste.

A comparação de “CNPJ já persistido” (`store-identity-form.tsx`) passa a comparar `normalizeCnpj(formData.cnpj)` com `initialStore.cnpj_normalized`, nunca a versão só-dígitos.

### D5 — Persistência e migration

A migration é forward-only, transacional e fail-closed:

1. **Pré-checagem** (aborta se falhar):
   - linhas com `cnpj_normalized IS NOT NULL` que não casam `^[A-Z0-9]{12}[0-9]{2}$`;
   - linhas com `cnpj_normalized IS NOT NULL` e `cnpj_root_hash` vazio;
   - linhas com `razao_social`/`nome_fantasia` sem `cnpj_normalized`;
   - contagem informativa de CNPJs alfanuméricos já existentes (esperado: 0 antes da mudança).
2. `ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS chk_stores_cnpj_atomic`.
3. Recriar `chk_stores_cnpj_atomic` com a mesma estrutura lógica, substituindo `^\d{14}$` por `^[A-Z0-9]{12}[0-9]{2}$`, usando `NOT VALID` + `VALIDATE CONSTRAINT` dentro da transação para separar a checagem das linhas existentes.
4. Atualizar comentários de `stores.cnpj_normalized`, `stores.cnpj_root_hash` e `cnpj_lookup_cache.cnpj_normalized` para “14 caracteres (12 alfanuméricos + 2 dígitos verificadores)” e “8 primeiros caracteres”.
5. **Pós-checagem**: confirmar que a definição da constraint contém o novo padrão e que nenhum valor foi alterado (`count`, checksums de amostra ou comparação de `cnpj_normalized` antes/depois via tabela temporária de auditoria).

Não há `UPDATE` em `stores.cnpj_normalized`, `cnpj_root_hash` ou `cnpj_lookup_cache`. O índice único `idx_stores_cnpj_normalized` é preservado. A constraint nova é superconjunto da antiga: todo CNPJ numérico válido continua aceito.

Não serão adicionadas colunas novas. `stores.user_id`, RLS e `freemium_entitlements` não são tocados.

### D6 — Hash, raiz e cache

- `hashCnpjRoot(root)` continua recebendo a raiz canônica de 8 caracteres e o mesmo `CNPJ_PEPPER`. Para CNPJs numéricos o hash não muda.
- Todos os call sites (`POST /api/store`, `update-cnpj`, `reconsult-cnpj`, `admin/stores/create-test`) calculam `root` a partir do retorno canônico de `validateCnpj`, nunca do input cru.
- O cache usa `cnpj_normalized` canônico como chave. `CnpjVerificationService.resolve` normaliza antes de `cache.get` e `cache.set`.
- Caixa e pontuação não geram chaves diferentes. Nenhuma migração de cache é necessária: as chaves numéricas existentes já são canônicas.
- `not_found` alfanumérico só é cacheado após resposta conclusiva de provedor declarado compatível com alfanumérico. `404` de provedor sem suporte declarado é ambíguo e NÃO é cacheado como inexistência.
- `unsupported_format` não é cacheado, assim como `unavailable`.

### D7 — Contrato dos provedores e fallback seguro

`LookupResult`/`LookupOutcome` ganham o estado `unsupported_format`. Cada provedor declara explicitamente sua capacidade alfanumérica:

```ts
interface CnpjLookupProvider {
  readonly supportsAlphanumeric: boolean;
  lookup(cnpj: string): Promise<LookupResult>;
}
```

`supportsAlphanumeric` é uma declaração de capacidade — não uma feature flag de ativação — e só passa a `true` após teste contratual que comprove que o provedor aceita o formato. Enquanto não houver confirmação, permanece `false`.

Regras de resposta do provedor:
- HTTP `200` → `resolved`.
- HTTP `404`:
  - CNPJ numérico → `not_found` conclusivo.
  - CNPJ alfanumérico com `supportsAlphanumeric = true` → `not_found` conclusivo.
  - CNPJ alfanumérico com `supportsAlphanumeric = false` → resultado ambíguo (`unavailable`), pois o provedor pode estar respondendo 404 por não reconhecer o formato. Não é cacheado como inexistência e aciona fallback.
- HTTP `400`/`422` com CNPJ alfanumérico → `unsupported_format` (rejeição explícita).
- HTTP `400`/`422` com CNPJ numérico → `unavailable`.
- `429`, `5xx`, timeout, erro de rede → `unavailable`.

Orquestração:
1. Cache hit canônico não expirado → retorna.
2. Primário resolve → cacheia `resolved`.
3. Primário retorna `not_found` conclusivo → cacheia `not_found`.
4. Primário retorna `not_found` ambíguo (`supportsAlphanumeric = false`), `unsupported_format` ou `unavailable` → tenta fallback.
5. Fallback resolve → cacheia `resolved`.
6. Fallback retorna `not_found` conclusivo → cacheia `not_found`.
7. Fallback retorna `not_found` ambíguo ou `unavailable` → não há conclusão de inexistência.
8. `unsupported_format` definitivo somente quando TODOS os provedores tentados rejeitaram explicitamente o formato.
9. Se ao menos um provedor retornou `unsupported_format` e outro ficou `unavailable`, o resultado é `unavailable` (não foi possível concluir que todos rejeitam o formato).
10. Sem `resolved`, sem `not_found` conclusivo e sem `unsupported_format` definitivo → `unavailable`.
11. `unavailable`, `unsupported_format` e `not_found` ambíguo NÃO são cacheados.

A BrasilAPI será verificada por teste contratual (mock de 200/404/400/422 e, opcionalmente, smoke live fora do CI). O CNPJá também. Nenhum provedor pago será ativado.

Comportamento dos consumidores, preservando a política atual:
- `POST /api/store`: `unsupported_format` ou `unavailable` seguem o caminho de indisponibilidade — loja criada com `verification_status = 'defer'`, `verification_reasons = ['api_unsupported_format']` ou `['api_unavailable']`, sem grant.
- `POST /api/store/update-cnpj`: segue o caminho de indisponibilidade — `503` com mensagem específica, sem persistir dados fiscais.
- `GET /api/cnpj/lookup`: retorna `200 { status: "unsupported_format", message }` somente quando a rejeição for definitiva; caso contrário retorna `unavailable`.
- `reconsult-cnpj`: retorna erro controlado, sem sobrescrever dados oficiais.

Alternativa considerada: persistir como `defer` também no update para não bloquear o lojista. Rejeitada nesta fase porque alteraria a política de verificação existente; fica registrada como decisão de produto/follow-up.

Alternativa considerada: tratar todo `404` como `not_found` e cachear. Rejeitada porque provedores sem suporte podem responder 404 e criar um falso negativo permanente no cache.

### D8 — Compatibilidade e evolução futura

- CNPJ continua sendo atributo da loja/estabelecimento, não identidade do usuário.
- Nenhuma dependência nova entre CNPJ e `user_id`.
- Normalização, validação, raiz e formatação permanecem centralizadas em `src/lib/cnpj/`.
- Nenhum contrato novo assume que uma loja terá um único usuário para sempre.
- A futura F50.4 poderá usar o CNPJ completo canônico, sem precisar reescrever dados ou normalizações.
- `substring(cnpj_normalized, 9, 4) = '0001'` permanece inalterado em `grant_monthly_credits` e nas RPCs de trial. A limitação será registrada em documentação e em um comentário de follow-up; qualquer mudança é pré-requisito para reativar o freemium legado, não para esta fase.

## Risks / Trade-offs

| Risco | Mitigação |
|---|---|
| Normalização permissiva removendo caracteres arbitrários | Normalização estrita: apenas formatação conhecida é removida; qualquer outro caractere invalida a entrada. Testes com emoji, acento e símbolo garantem que não há conversão silenciosa. |
| Divergência entre validação TypeScript e constraint PostgreSQL | Um único padrão documentado; testes de vetores no TS e script de verificação SQL local comparam a mesma matriz de casos. |
| Hashes diferentes para o mesmo CNPJ por caixa/pontuação | Canonicalização obrigatória antes de `slice(0,8)` e `hashCnpjRoot`; teste de hash para `12ABC...` e `12.abc...`. |
| Cache duplicado por representações diferentes | Chave sempre canônica; testes de cache hit com entrada mascarada/minúscula. |
| Provedor sem suporte responde `404` e gera falso `not_found` | `404` alfanumérico de provedor sem capacidade declarada é ambíguo, aciona fallback e não é cacheado. Só é conclusivo com provedor declarado compatível. |
| Provedor aceita o formato e outro rejeita | Estado `unsupported_format` explícito, fallback e proibição de cachear como `not_found`; mistura de `unsupported_format` + `unavailable` resulta em `unavailable`. |
| Atualização parcial deixando dados fiscais inconsistentes | RPCs e constraint atômica preservadas; nenhuma alteração de atomicidade; teste de rollback em falha de lookup. |
| Regressão em CNPJs numéricos já cadastrados | Constraint nova é superconjunto; nenhum `UPDATE`; suíte de regressão numérica e verificação pré/pós-migration. |
| Rollback da aplicação após o primeiro CNPJ alfanumérico gravado | Não voltar para versão numeric-only depois de existir dado alfanumérico. Ver plano de rollback com correção forward-only ou versão emergencial que leia/preserve o valor. |
| Mascaramento fail-open expondo CNPJ cru | `maskCnpj` retorna placeholder `"CNPJ inválido"` para valor fora do padrão; nenhuma tela admin devolve o valor integral em caso inesperado. |
| Migration falhar por dado legado malformado | Pré-checagem aborta antes de alterar; `NOT VALID` + `VALIDATE` dentro de transação. |
| Uso histórico de `substring(...,9,4)='0001'` | Não alterar nesta fase; documentar limitação e dependência para revisão antes de reativar freemium legado. |
| Migrations concorrentes com a futura F50.4 | Migration desta fase não cria tabelas/colunas de oferta; apenas relaxa constraint e comentários. F50.4 deve ser aditiva. |
| Letras ambíguas (`I`, `O`, `U`, `Q`, `F`) virem a ser vedadas | Aceitar `A-Z` conforme IN atual e registrar monitoramento; não antecipar restrição não confirmada. |

## Migration Plan

**Ordem de deploy (quando aprovado):**
1. Aplicar migration localmente e rodar verificação pré/pós. Não aplicar remoto nesta fase.
2. Deploy do código com normalização/validação/máscara, mantendo a constraint nova já aplicada.
3. Smoke local: criação com CNPJ numérico, criação com CNPJ alfanumérico (`12.ABC.345/01DE-35` e o primeiro emitido `00.000.000/E08G-12`), atualização, reconsulta, cache hit/miss, erro de DV e tentativa com caractere inválido.

**Rollback:**
- **Antes de existir qualquer CNPJ alfanumérico gravado:** o rollback da aplicação é possível. A constraint nova aceita todos os CNPJs numéricos e o código anterior continua funcionando com o banco já migrado.
- **Depois do primeiro CNPJ alfanumérico gravado:** NÃO voltar para uma versão numeric-only. O código antigo remove letras na normalização, rejeita o formato e pode exibir/comparar o CNPJ incorretamente. O caminho correto é correção forward-only ou uma versão de emergência que saiba ao menos ler, mascarar e preservar os valores alfanuméricos.
- Se houver necessidade de contenção emergencial, bloquear apenas novas gravações de CNPJ (write freeze) sem corromper leitura, exibição ou reconsulta dos valores existentes.
- Não recriar a constraint numérica se existirem linhas alfanuméricas (`SELECT count(*) ... WHERE cnpj_normalized ~ '[A-Z]'` > 0). Nesse caso, manter a constraint relaxada e reverter apenas a app.
- Se for indispensável reverter o banco, exigir contagem zero de CNPJs alfanuméricos e restaurar a definição anterior da constraint. Nenhum dado é apagado.

**Validação pré-migration (falha fechada):** as consultas da D5 devem retornar zero para formato inválido e atomicidade quebrada; qualquer resultado positivo aborta a migration.

**Validação pós-migration:** a constraint deve aceitar `12ABC34501DE35` e `12345678000195`, rejeitar `12abc34501de35`, `12ABC34501DE3A`, `12ABC34501DE3` e `12ABC34501DE355`, e `pg_get_constraintdef` deve conter `[A-Z0-9]{12}[0-9]{2}`.

## Matriz de arquivos e camadas impactadas

| Camada | Arquivo / artefato | Mudança |
|---|---|---|
| Núcleo CNPJ | `src/lib/cnpj/normalize.ts` | normalização estrita: remove só formatação conhecida, uppercase, rejeita o resto |
| Núcleo CNPJ | `src/lib/cnpj/validate.ts` | regex canônica + DV ASCII−48 + rejeição de caracteres desconhecidos |
| Núcleo CNPJ | `src/lib/cnpj/mask.ts` | sufixo alfanumérico e placeholder fail-closed |
| Núcleo CNPJ | `src/lib/cnpj/types.ts` | tipos canônicos e outcome |
| Núcleo CNPJ | `src/lib/cnpj/hash.ts` (sem mudança de algoritmo) | documentar raiz canônica |
| Núcleo CNPJ | `src/lib/cnpj/input-mask.ts` (novo) | `formatCnpjInput` tolerante / `formatCnpj` centralizados |
| Núcleo CNPJ | `src/lib/cnpj/__tests__/*` | vetores oficiais + regressão numérica + entradas hostis |
| Providers | `src/lib/cnpj/lookup-providers/types.ts` | `unsupported_format` + `supportsAlphanumeric` |
| Providers | `src/lib/cnpj/lookup-providers/brasil-api.ts` | 404 ambíguo, 400/422 alfanumérico e capacidade declarada |
| Providers | `src/lib/cnpj/lookup-providers/cnpja.ts` | 404 ambíguo, 400/422 alfanumérico e capacidade declarada |
| Providers | `src/lib/cnpj/lookup-providers/__tests__/*` | contrato de formato |
| Orquestração | `src/lib/cnpj/verification-service.ts` | cache canônico + propagação |
| API | `src/app/api/cnpj/lookup/route.ts` | aceitar alfanumérico e `unsupported_format` |
| API | `src/app/api/store/route.ts` | validar/canonicalizar e defer seguro |
| API | `src/app/api/store/update-cnpj/route.ts` | schema 14 canônico, hash canônico, erro de formato |
| API | `src/app/api/store/[id]/reconsult-cnpj/route.ts` | tratar `unsupported_format` |
| API | `src/app/api/admin/stores/create-test/route.ts` | hash a partir do canônico |
| API | `src/lib/admin/schemas.ts` (se necessário) | schema compartilhado de CNPJ |
| UI onboarding | `src/components/flow/store-identity-form.tsx` | input/colagem/máscara/comparação |
| UI onboarding | `src/components/flow/use-store-form.ts` | normalização antes de POST/PATCH |
| UI legado | `src/app/(app)/cadastro/cnpj/cnpj-update-form.tsx` | input e erro |
| UI admin | `src/app/(app)/admin/users/[id]/create-test-store/page.tsx` | input e erro |
| Admin display | `src/app/(app)/admin/reviews/page.tsx`, `src/app/(app)/admin/users/page.tsx`, `src/app/(app)/admin/users/[id]/page.tsx` | máscara alfanumérica via `maskCnpj` |
| Banco | `supabase/migrations/<nova>_f50_3_cnpj_alfanumerico.sql` | constraint + comentários + pré/pós-checagem |
| Banco | `scripts/verify/50-3-cnpj-alfanumerico-verification.mjs` (novo) | verificação local pré/pós |
| Testes | `src/__tests__/integration/f33-verification-flows.test.ts` e afins | cenários alfanuméricos |
| Docs | `docs/alinhamento-fase-50-3-...md` ou comentário de follow-up | limitação `0001` e dependência F50.4 |

## Open Questions

1. A BrasilAPI e o CNPJá já aceitam CNPJ alfanumérico em produção? A resposta será obtida por teste contratual e smoke manual; o design não depende de suporte imediato dos dois.
2. A RFB confirmará a exclusão de letras ambíguas (`I`, `O`, `U`, `Q`, `F`)? Até confirmação, aceitar `A-Z`.
3. Persistir CNPJ alfanumérico com verificação `defer` no fluxo de atualização de loja legada é uma decisão de produto futura; nesta fase mantém-se a política atual de bloquear quando a consulta está indisponível.
4. A F50.4 precisará de uma estratégia para identificar matriz sem depender de `substring(...,9,4)='0001'`; registrar como dependência, não implementar aqui.
