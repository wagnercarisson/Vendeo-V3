# 59-10 — Relatório de aceite (consolidação)

Data: 2026-11-06. Ambiente: homolog local `vendeo-homolog`
(`127.0.0.1:57782`, app `127.0.0.1:3000`), loja de teste
`48b212f8-2b0f-4679-b553-122a601bacac` (`is_test_store = t`). Produção não foi
acessada.

## 1. Status

**Homolog-ready apenas no recorte comprovado. NÃO é produção-aprovado.** Os gates
técnicos principais foram executados no homolog em 2026-11-06 (ver
`59-10-REMAINING-GATES-RESULT.md`). Permanecem: Reels não aprovado, resíduo do caso D
e gate de produção separado (não executado).

## 2. Escopo comprovado

| Item | Evidência |
|---|---|
| Geração vertical real | Bolo `b367b5c0…`, Pão de Queijo `72ab9ddb…`, Pão Francês `3e7562ea…` |
| Arte | JPEG sRGB **1080×1920**, path `product-9-16/.../art-1080x1920.jpg` |
| Provider | `gpt-image-2.5-sunburst` / `medium`; `1152×2048` solicitado e devolvido |
| Copy | `gpt-6-luna`; custos registrados por campanha |
| Crédito | 1 por entrega; quatro operações `delivered` |
| Miniatura | WebP **162×288**; validação manual do responsável |
| Download | 9:16 e 1:1: 200, `image/jpeg`, `attachment`, bytes JPEG válidos |
| Detalhe/listagem | 200; campanhas verticais e 1:1 visíveis |
| Restauração vertical | 200; formato 9:16 preservado; aviso de pausa com flag OFF |
| Regressão 1:1 | 958 testes locais; entrega real 1024×1024, `art-1024.jpg`, miniatura 288×288 |
| Telemetria | `generation_events` com `format=9:16`, `requested/returned=1152x2048` |
| Ciclo de flag OFF | 503 `format_unavailable`, zero efeitos; OFF/ON auditados |
| Recuperação vertical real | A1 `delivered`, `ready`, path vertical, detalhe/lista |
| Resolução administrativa | A2 `deliver_existing_art` → `delivered`; A3 `refund_once` → `refunded`; rechecagem 409 |
| Concorrência de rota | 2 submissões simultâneas → 1 campanha, 1 dedução, 1 imagem + 1 copy |
| Geração em andamento + flag OFF | flag OFF durante `image_primary`; geração concluiu; flag ON restaurada |
| Reenvio | terminal `result`, sem provider/crédito, contagens inalteradas |
| Concorrência SQL | reserva e tentativa com 1 vencedor; estorno da reserva |

## 3. Aceites manuais

| Item | Resultado |
|---|---|
| Bolo Naked Fruit v14 | composição, preço e aviso aprovados; validade na faixa inferior como **exceção aceita** |
| Pão de Queijo v14 | composição, cenário, separador decimal único e legibilidade |
| Pão Francês v14 | composição aprovada; “garanti” = erro de entrada |
| Pão Francês 1:1 | fluxo quadrado aprovado |
| Saldo insuficiente | retorno à tela de dados com campos e formato preservados |
| Revisão → edição durante mudança de flag | campos, imagens e 9:16 preservados; banner não atualiza em página já aberta (esperado); sem consumo |
| Miniaturas | validação manual do responsável |

Aceite manual não substitui teste simulado nem integração real.

## 4. Ciclo de flag OFF — evidência

- Pré-condições: flag ON, saldo 0, zero claims `in_progress`, zero créditos em aberto,
  zero campanhas não terminais.
- OFF auditado: `26a5eb1b-4f00-49ae-9228-81287cdc8f40`.
- Tentativa única com IDs `51c5679c…`/`90822cf8…`: **503 `format_unavailable`**.
- Efeitos: 0 campanha, 0 reserva, 0 claim, 0 outcome, 0 evento, 0 paid call, 0 rate
  event; sem provider.
- ON auditado: `cf53e7e9-1a3d-408d-8b64-56e73bfe9357`.
- Antes/depois: `86/27/27/2/366/52/27`, saldo 0, teto 2,20, gasto 2,0882.

## 5. Limitações e ressalvas

- O aceite visual é específico das artes apresentadas; **não** representa cumprimento
  integral das margens.
- Bolo: validade na faixa inferior; exceção pontual, proteção mantida no prompt.
- Pão Francês: “garanti” é erro de entrada; arte não publicável com o erro.
- Faixa superior efetiva de 5%; a região entre 5% e 15% não é protegida.
- Reels: **aceito pelo responsável com a ressalva observada no Facebook**. A máscara
  conservadora antiga indicou interseções de risco; não é aprovação irrestrita.
  Stories FB/IG permanece aprovado separadamente.
- Custo **calculado por usage e pricing**: copy 0,000172 + imagem 0,030269 =
  **0,030441**. `provider_reported_cost_usd` nulo; **não é valor confirmado em
  fatura**. O piloto registrou 0,1107; desvio 0,080259, sem ajuste. O contador
  conservador do piloto não precisa ser alterado para fechar a fase.
- Os cenários concorrentes executados passaram; isso **não** equivale a executar todas
  as suítes antigas.
- O prompt bruto do provider não é persistido; hashes são reconstruções
  determinísticas.

## 6. Pendências que impedem o aceite integral

1. **Defeito confirmado no reload do rascunho local 9:16:** o draft novo usa chaves
   globais, que `CampaignPageClient` remove no mount antes da restauração; além
   disso, com flag OFF a pausa não é derivada para draft local. Correção mínima
   proposta, **não editada** (ver `59-10-REMAINING-GATES-RESULT.md`, seção 12).
2. Caso D: campanha encerrada em `error`; **auditoria da resolução idempotente não
   registrada**. Recomendação: aceitar a lacuna nesta fase como exceção de
   rastreabilidade e corrigir em trabalho separado; **aceite formal pendente**.
3. Reconciliação de custo concluída com dados existentes; sem fatura do provider.
4. Gate de produção separado — não executado por desenho.

## 7. Declaração

Este relatório **não** autoriza conclusão da F59, arquivamento, ativação em produção,
push, deploy ou publicação. Nenhuma chamada paga, crédito, migration ou alteração de
produção foi realizada para produzi-lo.
