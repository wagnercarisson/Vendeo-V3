# 62-08 — Provas reais de Storage, leitura e download da F62

**Status:** **RODADA STORAGE/DOWNLOAD EXECUTADA; PROVAS DE PERSISTÊNCIA, INTEGRIDADE, PROBE, DOWNLOAD E SELEÇÃO PASS; `62-08` NÃO CONCLUÍDO; REVIEW STOP.**
**Data:** 2026-11-23 (UTC).
**Produção, provider pago, geração por IA, flags, migrations, RPCs/guards, dependências, merge, push, deploy, sync e archive:** não acionados.
**Validação visual da qualidade da geração:** não executada.

> Esta rodada é separada dos gates offline (`62-OFFLINE-GATES.md`) e das provas
> PostgreSQL (`62-08-DB-PROOFS.md`). Os arquivos são **fixtures locais**: não
> representam uma expansão feita por IA e não comprovam qualidade visual.

## Alvo e identidade

| Item | Valor |
|---|---|
| Container DB | `supabase_db_vendeo-homolog` |
| DB | `127.0.0.1:57782/postgres` |
| API/Storage local | `http://127.0.0.1:57781` (Kong) |
| App HTTP local | `http://127.0.0.1:3000` (Next.js dev, `.env.local` inalterado) |
| Branch / HEAD de partida | `feat/campaign-add-vertical` / `11e17eb8` |
| Migration | `20261123130252`, 1×, SHA-256 `61c727198f8ad7519e6cb3b9c79dba6fd1d9bbb9f948b9600d37bc43c7f5b878` |
| Flag | `campaign_format_addition_enabled=false`, intocada |

Preflight do ambiente: `SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_URL` iguais a
`http://127.0.0.1:57781`; GoTrue respondeu `v2.189.0`; buckets
`campaign-images` e `campaign-internal-artifacts` existem e são **privados**.
Nenhum `.env.local` foi alterado.

## Método

- JPEGs reais gerados localmente com `sharp` (SVG determinístico → JPEG):
  - quadrado 1024×1024;
  - preparado 1152×1152;
  - vertical 1080×1920;
  - vertical inválido 1024×1024 (fixture de probe).
- O quadrado foi semeado **byte-a-byte** em `campaign-images` no path canônico
  `{store}/{campaign}/product-1-1/{primary}/art-1024.jpg`, com metadados em
  `product_1_1_campaign_artifacts`.
- A ponte `square_original` foi criada pelo contrato real
  `ensureFormatAdditionSourceBridge`; o preparado 1152×1152 pelo contrato real
  `prepareSquareForExpansion`; o vertical foi persistido pelo mesmo
  `persistCompositionArtifact` usado pela expansão, mas com bytes locais
  (sem chamada de provider).
- A operação primária 1:1 percorreu reserva/publicação/entrega reais. A adição
  vertical percorreu `campaign_format_add_open` →
  `product_1_1_begin_publication` → `campaign_format_add_deliver`. O estorno da
  adição aberta usou `product_9_16_record_outcome` → `campaign_format_add_refund`.
- A rota HTTP real `GET /api/campaign/[id]/download` foi exercitada com sessão
  real do dono, sessão de não-dono e sem sessão. A sessão foi obtida por magic
  link server-side da Admin API, porque o login por senha local exige captcha
  (configuração não alterada).
- Leitores reais exercitados: `CompositionVerticalProbe`,
  `readFormatAdditionByCampaign`, `retrieveCompositionArtifact` e a página de
  detalhe (`/campanhas/[id]?format=...`).

### Artefatos de execução (fora do Git)

| Arquivo | SHA-256 |
|---|---|
| `f62-storage-fixtures.ts` | `0e4d65518247b1dff18ef18ff5db755a29217527890709b555106868e2a3800b` |
| `f62-storage-verify-existing.ts` | `8725e162235be55053e24ee65325950142df9b5a27107e9f4b383f008cc17335` |
| `f62-storage-evidence-verified.json` | `d7d2a76caeda81c57ecd42c62d228649212eec44df675ddd762fc903f3968982` |
| `preflight.mjs` | `059042c07380bc39fd0b107974c89efdf3fd707f5d820d5eeb353ac030c15762` |
| `delete-outsiders.ts` | `74b9f7a2143bf3d210a0963eb719ac66de289dedc6dadf7bf31da32482e719df` |

Comandos principais:

```text
node .f62-tmp/preflight.mjs                     # exit 0
npm run dev                                      # Next local em 127.0.0.1:3000
npx tsx --tsconfig .f62-tmp/tsconfig.json .f62-tmp/f62-storage-verify-existing.ts  # exit 0
```

## Fixture principal (entregue)

| Campo | Valor |
|---|---|
| Store | `ba5e9860-462a-457a-98a0-e0d03b0a5775` |
| Campaign | `e6e26446-5cc6-4e7f-8dfb-6963cfc5b41a` |
| Primary 1:1 operation | `a58527f7-220e-48f4-bd0e-5b64480d9f54` |
| Adição entregue | `ab1924cb-2666-43ad-b069-32304fa4c621` |
| Adição aberta estornada | `fd022512-6f46-4182-ae47-d034cca77228` |
| Vertical inválido sintético | `b12cbb57-6799-4c88-934b-37718794e160` |
| Owner auth | `22789f5e-f688-4911-bfba-eae7ede92af4` |
| Produto | `F62 Storage Fixture / "Vertical" 1795463658811` |
| `campaigns.storage_path` | `ba5e9860-…/e6e26446-…/product-1-1/a58527f7-…/art-1024.jpg` |

### Bytes reais e metadados

| Papel | Dimensões | Bytes | SHA-256 |
|---|---|---|---|
| Quadrado (`campaign-images`) | 1024×1024 | 43.187 | `285df2b833d62466e2b603aef6aa1cb206914ae96efde0ee1c7b181b52eee823` |
| Ponte `square_original` (`campaign-internal-artifacts`) | 1024×1024 | 43.187 | `285df2b833d62466e2b603aef6aa1cb206914ae96efde0ee1c7b181b52eee823` |
| Preparado `square_prepared` | 1152×1152 | 105.058 | `711a943738e73bf8724081746c1a6869f5683b26c92c24c23e6ca7f29c70b756` |
| Vertical (`ai_expansion` fixture) | 1080×1920 | 62.657 | `26396f71fac17dbd63a240797c6ac0f3e11780cc33970d2fd259ec881f1a9215` |

`retrieveCompositionArtifact` devolveu `integral` para ponte, preparado e
vertical, com os mesmos bytes/SHA-256 e dimensões. O vertical persistido é
**idêntico** ao JPEG local; o preparado canônico é o resultado real da
transformação determinística 1024→1152.

## Resultados de leitura, probe e download

| Prova | Esperado | Obtido |
|---|---|---|
| Sonda vertical íntegra | `integral`, 1080×1920, JPEG, path canônico | **PASS** (`evidenceRef=69b7dc8d-…`) |
| Sonda vertical inválido | `invalid` | **PASS** |
| Sonda operação ausente | não `integral` | **PASS** (`absent`) |
| Leitor da adição | `delivered`, operação da adição | **PASS** (`ab1924cb-…`) |
| `?format=9:16` | 200, somente vertical | **PASS** — 1080×1920, `26396f…`, `image/jpeg` |
| `?format=1:1` | 200, quadrado | **PASS** — 1024×1024, `285df2…` |
| Sem `format` | 200, quadrado | **PASS** — 1024×1024, `285df2…` |
| `?format=foo` | 400 | **PASS** — `unsupported_format` |
| `?format=` vazio | 400 | **PASS** — `unsupported_format` |
| `?format=1:1&format=9:16` duplicado | 400 | **PASS** — `unsupported_format` |
| Adição `open` com `?format=9:16` | 409, sem cair no quadrado | **PASS** — `not_delivered` |
| Campanha sem adição com `?format=9:16` | 409, sem cair no quadrado | **PASS** — `not_delivered` |
| Usuário sem ownership | 404 | **PASS** — `Store not found or access denied` |
| Sem sessão | 401 | **PASS** — `Unauthorized` |

Nome seguro do arquivo (ambos os formatos):

```text
f62_storage_fixture____vertical__1795463658811-2026-11-23.jpg
```

Sem `/`, `\`, `"`, espaços ou quebra de linha; minúsculo; extensão `.jpg`.
`Content-Type: image/jpeg`; `Content-Disposition: attachment; filename="…"`.

### Detalhe `?format=`

| Página | Status | `?format=9:16` | `?format=1:1` | Path vertical no HTML |
|---|---|---|---|---|
| `?format=9:16` | 200 | presente | presente | **presente** |
| `?format=1:1` | 200 | presente | presente | ausente |

Isso comprova que a seleção do vertical no detalhe usa o artefato vertical da
adição entregue, sem substituir o quadrado.

## Preservação

- A execução que criou a fixture fez a comparação **antes/depois** em memória:
  campanha, operação primária, artefato primário e bytes do quadrado
  permaneceram iguais (asserções PASS).
- A verificação posterior confirmou:
  - `campaigns.updated_at == campaigns.created_at` (campanha não foi atualizada);
  - `primary.updated_at <= bridge.created_at` (operação primária não foi tocada
    após a ponte);
  - `input_snapshot.product = f62-storage-fixture`, `offer = storage-round`;
  - `publication_copy_current.headline = copy original storage fixture`;
  - `campaigns.storage_path` e `product_1_1_campaign_artifacts.storage_path`
    canônicos e iguais;
  - operação primária `delivered`, `amount=1`;
  - artefato primário 1024×1024, JPEG;
  - SHA-256 do quadrado HTTP = SHA-256 do objeto original.

### Fingerprints de conteúdo (sem contar as fixtures F62 Storage)

As fixtures desta rodada (inclusive as tentativas parciais) foram excluídas por
store/campanha. O restante — que já inclui o resíduo da rodada de concorrência
`6208…003` — voltou exatamente ao baseline:

| Conjunto | Baseline | Após excluir fixtures | Igual |
|---|---|---|---|
| `campaigns` | `0b14c1a495b09c3bbf5e4a966de62d94` | `0b14c1a495b09c3bbf5e4a966de62d94` | sim |
| `credit_operations` | `b6ea36f7b018a4c80928e2e0ee6e2524` | `b6ea36f7b018a4c80928e2e0ee6e2524` | sim |
| `campaign_composition_artifacts` | `2bdbc3329b920f84e0ee82fcf50766bc` | `2bdbc3329b920f84e0ee82fcf50766bc` | sim |
| `stores` | `b6e09308fda0175728d65bbb6943f7d3` | `b6e09308fda0175728d65bbb6943f7d3` | sim |
| `credit_balances` | `f77b579a210e5e1b129725bd14572721` | `f77b579a210e5e1b129725bd14572721` | sim |
| `credit_transactions` (por store) | `59279dd118e0dc80261066bbc892e15b` | `59279dd118e0dc80261066bbc892e15b` | sim |
| `product_1_1_campaign_artifacts` | `5349f6648810e6f426eac15e3c8180c5` | `5349f6648810e6f426eac15e3c8180c5` | sim |
| `storage.objects` (2 buckets) | `131b8a99741676ad1909da82106f2728` | `131b8a99741676ad1909da82106f2728` | sim |

Contagens de `two_stage`: baseline **43 ops / 82 steps**; após excluir as fixtures,
**43 / 82** (as fixtures adicionaram 3 ops / 6 steps). `auth.users`: baseline 40;
48 após as fixtures (8 novos), 44 após remover os 4 outsiders; os 4 owners
permanecem porque as lojas-fixture os referenciam.

## Provider e custos

- Nenhuma chamada de provider foi feita.
- `admin_ai_cost_by_store` para a store-fixture: ausente/0 chamadas.
- `product_events` para a store-fixture: **0**.
- O crédito movimentado pertence somente à loja-fixture; a operação primária e
  as adições usaram o saldo de teste.

## Resíduo e fixtures remanescentes

A rodada teve **quatro** conjuntos de fixture (três tentativas parciais antes da
execução final). Todos estão identificados por `F62 Storage Fixture <timestamp>`
e permanecem no banco/Storage:

| Store | Campanha | Adições | Estado |
|---|---|---|---|
| `49ee8556-b4a0-482d-97ca-811ff81acea2` | `00103138-e7c4-4bb6-8afc-4377ddd06894` | nenhuma | usado no teste “ausente”; primary entregue + ponte |
| `b35939ba-f5e6-4b36-8e2f-4ebd51fb68ac` | `91c69085-d1d6-4d48-8a83-77ad199917b0` | nenhuma | tentativa interrompida no login; primary entregue + ponte |
| `4a51c34e-b408-45c1-b3d9-dc4c0e01997e` | `d265c7ba-69e4-4ed1-88f9-f2ff1b018fb9` | `645d42f6…` **open** | usado no teste “não entregue”; crédito reservado |
| `ba5e9860-462a-457a-98a0-e0d03b0a5775` | `e6e26446-5cc6-4e7f-8dfb-6963cfc5b41a` | `fd022512…` **refunded** + `ab1924cb…` **delivered** | fixture principal; prepared/vertical/inválido |

Resumo: 4 stores, 4 campanhas, 3 adições (1 open, 1 refunded, 1 delivered),
7 artefatos de composição, 7 operações de crédito, 8 transações de crédito,
3 two-stage ops / 6 steps e 11 objetos de Storage. 4 owners permanecem;
4 outsiders foram removidos (sem loja) após as provas.

**Não foi tentado cleanup destrutivo.** `campaign_composition_artifacts` é
imutável, `credit_transactions` é append-only e os bytes entregues não podem ser
apagados/sobrescritos. As fixtures ficam identificadas como dados de teste,
conforme a autorização.

### Achado de execução

A primeira tentativa usou `ProductOneToOneArtifactStore.storeArtifact`, que
reencoda o JPEG de entrada (1024×1024 → JPEG quality 90). Por isso o hash do
objeto não era igual ao hash do arquivo local. A fixture final passou a semear o
quadrado **byte-a-byte** no path canônico, e o preparado canônico passou a ser o
resultado real da transformação determinística, não o JPEG local de referência.

## Limitações

1. **Provider pago:** nenhuma chamada; o vertical é fixture local persistida
   pelo contrato real de composição. Não é prova de qualidade/expansão por IA.
2. **Ramo HTTP “vertical inválido”:** foi exercitado pelo
   `CompositionVerticalProbe` real (`invalid`). Não foi criada uma adição
   entregue com bytes corrompidos porque isso exigiria apagar/sobrescrever bytes
   de artefato entregue, proibido nesta rodada. O caminho HTTP de não entregue
   (`409`) e ausente (`409`) foi provado.
3. **Validação visual/preview:** a página de detalhe foi verificada por HTTP
   (status/hrefs/path), não por inspeção visual humana.
4. **Resíduo:** as fixtures permanecem; não houve desativação de guards,
   `TRUNCATE`, restore ou alteração de objeto compartilhado.

## Review Stop

**Parar aqui.** Persistência, leitura, integridade, probe, download real e
seleção do detalhe passaram com bytes reais. O `62-08` **não está concluído**;
não há autorização para provider pago, validação visual, release, merge, push ou
deploy. Aguardar decisão sobre o resíduo e a próxima matriz.
