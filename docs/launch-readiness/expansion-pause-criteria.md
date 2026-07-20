# Critérios de Expansão, Pausa e Go/No-Go

**Verificado em:** 2026-07-20

## Expandir

Critérios para abrir o beta para mais lojistas:

- [ ] UAT externo concluído com **3+ lojistas** e evidências registradas
- [ ] **Zero bugs Blocker** em aberto
- [ ] Bug Fixes classificados como Accept/Monitor ou resolvidos
- [ ] **Saúde do sistema "Saudável"** por 7 dias consecutivos (via /admin/metrics)
- [ ] Canal de feedback definido e operacional
- [ ] Feature flags verificadas e documentadas
- [ ] Decisão explícita registrada em reunião de revisão

## Pausar

Qualquer um dos critérios abaixo dispara uma revisão de emergência:

- [ ] Taxa de erro > 10% nas últimas 24h
- [ ] Custo médio por geração > $0.05 USD
- [ ] Bug Blocker encontrado após UAT
- [ ] Incidente de segurança (qualquer severidade)
- [ ] Vazamento de dados ou falha de isolamento multi-tenant
- [ ] Reclamação de lojista não resolvida em 48h

### Ação ao pausar

1. Setar `VENDEO_GENERATION_PAUSED=true`
2. Comunicar pool beta
3. Iniciar investigação
4. Resolver causa raiz
5. Reavaliar antes de retomar

## Go/No-Go

A decisão final de go/no-go é registrada em reunião de revisão do time, analisando:

1. **Métricas de saúde** — success rate, error rate, avg cost, avg duration
2. **Feedback qualitativo** — lojistas reportaram problemas? Confusão?
3. **Bugs pendentes** — classificação e impacto
4. **Riscos aceitos** — documentados formalmente
5. **Critérios de expansão** — atendidos?

### Decisões possíveis

| Decisão | Significado |
|---------|-------------|
| **Expandir** | Abrir para mais usuários (próximo wave) |
| **Pausar** | Bloqueios impedem expansão |
| **Manter controlado** | Manter beta limitado até nova revisão |
