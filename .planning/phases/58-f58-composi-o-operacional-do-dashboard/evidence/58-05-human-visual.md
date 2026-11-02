# F58-05 — Validação visual humana

**Data:** 2026-11-02  
**Ambiente:** produção local (`next build` + `next start`), Supabase homolog local  
**Aceite recebido:** composição visual aprovada em pt-BR e es-419.  
**Escopo do aceite:** composição e hierarquia visual. Não representa aprovação funcional total nem autoriza publicação.

## Checklist

| # | Cenário | Status | Evidência / observação |
|---|---|---|---|
| 1 | pt-BR desktop ≥1024 px | **PASS** | Captura `58-05-visual-desktop.png`; painel único, abertura explícita, créditos, novidades e faixa inferior conferidos. |
| 2 | es-419 desktop | **PASS** | Captura `58-05-visual-desktop-es.png`; textos de interface em espanhol, conteúdo editorial em português preservado, `lang` por bloco conferido. |
| 3 | Mobile <640 px | **PASS** | Capturas 390 px e 320 px; ordem visual créditos → campanhas → novidades → faixa; sem overflow horizontal. |
| 4 | Tablet 640–1023 px | **PENDENTE** | Sem captura/observação humana nesta rodada. Testes de DOM não substituem validação visual. |
| 5 | Slow 4G com preferência resolvida | **PENDENTE** | Não observado no navegador nesta rodada. |
| 6 | Slow 4G com timeout/falha de preferência | **PENDENTE** | Cobertura automatizada existe; comportamento visual/timing real não observado. |
| 6b | Carregamento real com autenticação/preferência lentas | **PENDENTE** | Não observado no navegador; `await DashboardLoading()` não foi usado como prova de timing. |
| 7 | Fuso da loja ≠ servidor | **PENDENTE** | Coberto por testes unitários; saudação real no navegador com fuso distinto não observada. |
| 8 | Falha de leitura de fuso | **PENDENTE** | Coberto por teste unitário; falha simulada no navegador não observada. |
| 9 | Campanhas com erro | **PARCIAL** | Testes garantem exclusão na origem/contagem; o homolog possui campanhas com erro, mas a conferência visual dedicada em `/campanhas` não foi registrada nesta rodada. |
| 10 | Miniaturas presente/nula/falha | **PARCIAL** | Presença real vista nas capturas; fallback nulo e erro de carregamento cobertos por testes de componente, não por inspeção visual dedicada. |
| 11 | Créditos disponível/zero/indisponível | **PARCIAL** | Saldo disponível visto nas capturas; zero e indisponível cobertos por testes, não observados manualmente. |
| 12 | Avisos de verificação/prontidão | **PARCIAL** | Banner de verificação aprovado visto nas capturas; `ReadinessCheckBanner` em estado pendente não observado. |
| 13 | Teclado/foco/contraste/truncamento | **PARCIAL** | Tab real validado em pt-BR e es-419 (créditos → campanhas → novidades, índices 10 → 12 → 16); contraste, zoom e truncamento extremo não revisados manualmente. |
| 14 | Shell/identidade/admin | **PARCIAL** | Shell, sidebar, topbar, logo e assinatura preservados nas capturas; `/admin` não foi aberto manualmente nesta rodada. |

## Conclusão do checkpoint

- **Composição visual:** aprovada pelo responsável em pt-BR e es-419.
- **Itens funcionais/visuais pendentes:** tablet, Slow 4G, carregamento real, fuso distinto/falha, estados de erro/miniatura/crédito e admin.
- **Aceite não inferido além do declarado:** este documento não declara produção aprovada, não substitui os demais itens funcionais do checkpoint e não autoriza merge, push ou deploy.
