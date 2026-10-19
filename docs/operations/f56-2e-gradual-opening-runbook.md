# F56.2e - Runbook de abertura gradual do Produto 1:1 com Luna

**Escopo:** 56.2.7. Nao reabre a fase 56.2.6. Nao usa `VENDEO_GENERATION_PAUSED` como controle do novo fluxo.

## 1. Estados e acao normal

| Estado | `product_1_1_test_stores_enabled` | `product_1_1_all_stores_enabled` | Autorizacoes exigidas |
|---|---|---|---|
| OFF | false | false | nenhuma |
| Lojas de teste | true | false | `test_stores` + `test_stores` |
| Todas as lojas | false | true | `all_stores` + `all_stores` e `test_stores` + `test_stores` |

A ativacao/desligamento normal ocorre no painel **Controles operacionais > Produto 1:1 - ativacao** (`POST /api/admin/product-1-1-activation`). A RPC `admin_set_product_1_1_activation` executa flags + autorizacoes em uma unica transacao, com trava, ledger de acao e verificacao final. Falha reverte tudo.

- `todas -> teste` desliga a chave geral e revoga `all_stores` na mesma transacao.
- `OFF` so e exibido como verificado depois de as duas chaves estarem `false` e a decisao negar os dois escopos.
- Replay do mesmo `operationId` e idempotente. A UI sempre exibe o `currentMode` relido; o modo historico do replay nunca e mostrado como atual.
- A aprovacao humana e registrada nos checkpoints. A RPC nao le documentos.

## 2. Checkpoint 1 - publicacao

1. Aprovar implementacao, migrations e deploy com as duas chaves OFF.
2. Aplicar as migrations no destino (somente o conjunto aprovado), depois publicar o codigo.
3. Verificar por leitura: chaves `false`, nenhuma autorizacao habilitadora, nenhuma loja geral, legado operante.
4. Nao configurar Luna, nao conceder autorizacao, nao ligar flag.

## 3. Checkpoint 2 - janela paga

1. Aprovar orcamento/teto, limites, pricing/selecoes de Luna, lojas de teste, duracao, criterios de parada e disposicao D13 da janela.
2. Abrir a janela **antes de gerar**:
   - registrar `spent_usd`, `cap_usd` e `blocked_reason`;
   - configurar o teto aprovado via `product_1_1_pilot_set_cap` **sem zerar** `spent_usd`/historico;
   - ativar `test_stores` pelo painel;
   - confirmar elegibilidade da loja de teste e negacao da loja geral.
3. Configurar `openai/gpt-6-luna`: pricing vigente, selecoes de `campaign_copy`, `brand_profile_text` e `brand_profile_vision`; fallback vazio em brand profiles. Registrar selecao anterior.
4. Validar por leitura catalogo/protocolo/pricing/preflight e executar uma campanha completa em loja de teste.
5. Provas:
   - **5.3:** `node scripts/f56-2e/hosted-proofs.mjs --check --kind=5.3 ...` e depois `--execute --confirm=EXECUTE`. Deve resultar `refunded` uma vez; replay idempotente; sem provider/campanha de cliente.
   - **5.7:** usar operacao **ja `delivered` antes do redeploy** (N=1 `22eeed06...`/`6f7a65e4...`). `--check` e depois `--execute`. Deve retornar idempotente, mesmo caminho/hash, sem nova geracao/upload/provider/transacao. `art_uploaded` NAO e PASS.
6. Encerrar a janela com chaves OFF + revogacao, sem pausar o legado e sem cancelar operacoes em andamento. Se Luna foi aprovado, **manter** as selecoes; se reprovado/problema/decisao explicita, restaurar as anteriores.

## 4. Checkpoint 3 - abertura geral

1. Registrar aceite humano da janela e disposicao D13/kill real (aceitar limitacao com controles ou bloquear).
2. Aprovar orcamento/teto, monitoramento e ativacao `all_stores`.
3. Ativar pelo painel, sem deploy. Confirmar as duas autorizacoes, `all_stores=true`, `test_stores=false`, loja geral e loja de teste elegiveis.
4. Monitorar gasto/teto, sucesso/falha/`unknown`, retry/fallback, claims e uso por loja.
5. **Nao desligar automaticamente para encerrar a fase.** Sem criterio de parada ou decisao explicita, encerrar com `all_stores` ativo e monitorado. O desligamento permanece disponivel pelo painel (chaves OFF + revogacao).

## 5. Proibicoes

- `VENDEO_GENERATION_PAUSED` como desligamento normal.
- SQL manual para ativar/desativar.
- `all_stores` sem as duas autorizacoes.
- Replay de 5.7 com operacao `art_uploaded`.
- Restaurar GPT-4o automaticamente ao fim de uma janela aprovada.
- Tocar producao/homologacao permanente durante as provas locais.
