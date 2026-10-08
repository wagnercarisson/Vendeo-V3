## Contexto

F56.2b1b depende do fechamento e verificação independentes da F56.2b1a, inclusive do gate de isolamento/schema aprovado e da operação atômica de reserva/estado testada. A b1b não concede autorização; ela conecta o fluxo end-to-end sem habilitar loja.

## Decisões

### B1B-D1 — Elegibilidade controla UI e POST

Servidor decide elegibilidade com leitura válida das duas flags, uma flag aplicável ao escopo ligada e autorização independente vigente. O formulário só monta seletores e só envia campos Produto 1:1 quando elegível. O POST revalida; revogação entre renderização/envio gera erro seguro anterior a crédito, sem fallback que descarte campos.

### B1B-D2 — Reserva temporária versus consumo definitivo

Usar a operação Postgres atômica da b1a. `reserved` reduz saldo disponível temporariamente; não representa consumo definitivo. `delivered` efetiva um crédito e é terminal; `refunded` restaura a reserva uma vez. Geração/provider e reserva ocorrem somente após elegibilidade, snapshot e preflight.

### B1B-D3 — Entrega

Persistir arte real 1024×1024 sob caminho imutável. Download requer fluxo persistido novo, objeto íntegro e operação `delivered`; upload sozinho não libera acesso. Campanhas legadas mantêm regras próprias.

### B1B-D4 — Copy e instrumentação

Falha de copy é persistida e não bloqueia download da arte `delivered`; sem retry nesta fatia. Cada tentativa emite envelope/custo; falhas produzem `IMG-001` e diagnóstico durável sanitizado.

### B1B-D5 — Estado desligado

Implementar e testar o ramo, mas manter as duas flags e autorização em `off`; nenhum comércio é habilitado. Piloto/E2E/retry permanecem na b2.

## Fora de escopo

Fundação de autorização e RPC atômica (b1a), retry/E2E/piloto (b2), aprovação/correção (F56.3), migration remota e deploy.
