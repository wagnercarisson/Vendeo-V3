---
quick_id: 261029-tf1
slug: atualizacao-pacote-juridico-oferta-vigente
status: complete
created: 2026-10-29
mode: documentacao
commit: none
---

# Quick 261029-tf1 — SUMMARY

## Revisão 8 — corte imediato autorizado (2026-10-30)

O responsável autorizou a publicação agora, em **30/10/2026 às 16:10:52 America/Sao_Paulo (19:10:52 UTC)**. Este horário é de autorização, não de deploy ou ativação já realizados.

O placeholder de vigência foi retirado da fonte e da cópia pública dos Termos: a vigência começa na ativação real, após disponibilização pública, em 30/10/2026. A migration continua com `effective_at = now()`, sem retroatividade à autorização. O campo de vigência está resolvido e o pacote está liberado para versionamento e deploy após as validações desta rodada.

Esta revisão supera as pendências de hora/placeholder das revisões anteriores; as demais cláusulas permanecem intactas. Merge e push são do usuário. Nenhum deploy, banco ou aplicação foi executado aqui.

Validação do corte: `npx.cmd vitest run src/lib/legal` — **8 arquivos, 39 testes aprovados**; quatro cópias públicas com hashes idênticos às fontes e sem placeholders de data; `git diff --check` aprovado. Acrescentada proteção de teste contra placeholders de data nos documentos contratuais. Typecheck/lint/build da preparação anterior não foram repetidos nesta rodada de preenchimento documental.

## Revisão 7 — preparação técnica da publicação (2026-10-30)

Os quatro consolidados aprovados foram copiados byte a byte para `public/docs/legal/`; o catálogo passou a reconhecer Termos v1.5, Privacidade v1.4 e AUP v1.2; a página `/privacidade/transferencias` exibe o anexo; a migration `20261030185658_f50_legal_publication.sql` foi preparada e **não aplicada**. Não houve deploy, ativação, reaceite/ciência real, `git add`, commit, merge, push ou aplicação de migration.

A orientação jurídica e a decisão do responsável encerraram as referências anteriores a “anexo incompleto”, “países não confirmados” e “decisão pendente OAuth/Fonts/Turnstile”. Esses registros permanecem nas revisões 4–6 como cronologia superada. Naquela revisão, a única pendência documental era a vigência; ela foi resolvida na revisão 8.

## Escopo documental original

Atualização das minutas pendentes do pacote jurídico da F50:

- Termos de Uso v1.5 (consolidado e delta);
- Política de Privacidade v1.4 (consolidado e delta);
- Política de Uso Aceitável v1.2 (consolidado e delta);
- Anexo de Transferências Internacionais;
- pacote jurídico;
- template de publicação.

A rodada documental original foi concluída sem publicação, ativação, código, banco, migrations efetivas, `public/`, catálogo, F57.4, `git add`, commit, merge, push ou deploy. A revisão 7 executou a preparação técnica autorizada, ainda sem publicar ou ativar.

## Arquivos alterados

| Arquivo | Versão |
|---|---|
| `legal-consolidated-pending/terms-of-service-v1-5.md` | v1.5 |
| `legal-drafts/terms-of-service-v1-5.md` | v1.5 |
| `legal-consolidated-pending/privacy-policy-v1-4.md` | v1.4 |
| `legal-drafts/privacy-policy-v1-4.md` | v1.4 |
| `legal-consolidated-pending/acceptable-use-v1-2.md` | v1.2 |
| `legal-drafts/acceptable-use-v1-2.md` | v1.2 |
| `legal-consolidated-pending/international-transfers-annex.md` | anexo público v1.4 |
| `legal-drafts/international-transfers-investigation-notes.md` | notas internas |
| `legal-drafts/legal-counsel-brief.md` | orientação ao advogado |
| `legal-package.md` | — |
| `legal-publication-template/20260920000003_f50_legal_publication.sql` | — |

## Oferta vigente

- Teste de **28 dias** iniciado na conclusão do onboarding.
- **Quatro parcelas de 5 créditos** nos dias **0, 7, 14 e 21**.
- **Máximo de 20 créditos**.
- **Vencimento comum** ao final dos 28 dias.
- As parcelas **podem acumular dentro do ciclo vigente**, mas não são transferidas para um novo ciclo.
- **Elegibilidade individual por CNPJ completo**, com salvaguarda de filiais legítimas.
- **Sem renovação automática e sem cobrança automática**.
- Expiração não encerra a conta nem bloqueia, por si só, o app e o conteúdo gerado.
- Janela mínima de **24 horas** e janela compartilhada entre estornos do mesmo ciclo preservadas (consolidado 6.6; delta 5.8).

## Política de ofertas (cláusula 6.1)

Adotada a redação-base aprovada:

- alterações prospectivas para períodos futuros;
- respeito aos créditos já concedidos e às condições dos ciclos promocionais já iniciados;
- concessões periódicas anteriores não geram direito a manutenção ou renovação futura;
- comunicação prévia aos participantes afetados, com antecedência razoável e data de aplicação;
- medidas imediatas por fraude, abuso, erro material comprovado, obrigação legal, risco à segurança ou **impossibilidade técnica ou operacional relevante, devidamente justificada, que impeça a continuidade da prestação**, na extensão necessária e proporcional, com comunicação tão logo possível e direitos legalmente assegurados;
- mera conveniência comercial não caracteriza impossibilidade técnica ou operacional.

A transição (6.14) preserva os 28 dias e as quatro parcelas de quem já iniciou o ciclo, sem promessa de renovação. O encerramento do beta (9.3/9.4) observa a 6.1 e preserva os ciclos iniciados. Não há prazo fixo de 30 dias para alterações de ofertas.

## Transferências internacionais

O [Anexo de Transferências Internacionais](<C:/Projetos/Vendeo V3/openspec/changes/archive/2026-09-23-fase-50-demonstracao-gratuita-e-validade-dos-creditos/legal-consolidated-pending/international-transfers-annex.md>) foi finalizado, aprovado e copiado para `public/docs/legal/international-transfers-annex.md`. Lista Brasil, Estados Unidos e localidades de IA, sem notas internas. As notas internas permanecem em `legal-drafts/international-transfers-investigation-notes.md`. A exibição de países não confirmados e a decisão sobre OAuth/Fonts/Turnstile foram encerradas pela orientação jurídica e pela decisão do responsável; **não são pendências atuais**. A data de publicação aprovada é 30/10/2026; a hora de vigência depende do corte/ativação.

**Brasil:** banco de dados, autenticação e armazenamento principal em São Paulo (`sa-east-1`); a região do projeto **não prova** que todo o tratamento permaneça no Brasil.

**Fluxos internacionais com evidência parcial:**

| Fluxo | Países/evidência | Situação |
|---|---|---|
| Vercel | Backend em execução; região `iad1` (Washington, D.C., EUA); plano gratuito; DPA Pro/Enterprise não aplicável; sem Drain | **Documentado** |
| OpenAI API | Lista oficial prevê EUA, Brasil, Canadá, Finlândia, Japão, Malásia, Países Baixos, Noruega, Singapura, Reino Unido, Alemanha, Austrália, Bélgica, Dinamarca, Espanha, França, Índia, Indonésia, Irlanda, Itália, México, Nova Zelândia, Polônia, Coreia do Sul, Suécia, Suíça, Emirados Árabes Unidos e África do Sul; suporte/moderação: Filipinas, EUA e Canadá | **Documentado** |
| Resend | Estados Unidos (processamento primário); Brasil infraestrutura de envio; plano gratuito; sem rastreamento; chave restrita; SMTP do Supabase | **Documentado** |
| Google OAuth | Escopos `openid`/`email`/`profile`; coleta direta separada da relação de exportações atribuídas ao Vendeo, conforme orientação | **Documentado** |
| Google Fonts | Fluxo externo distinto do OAuth; coleta direta; self-host pertence ao SEO | **Documentado** |
| Cloudflare | Somente Turnstile; coleta do widget separada da validação de token pelo Supabase; sem proxy/CDN/DNS | **Documentado** |

**Conclusão interna:** a matriz dos cinco fornecedores foi preenchida com finalidade, dados, papel, base legal, mecanismo do art. 33, países/localidades oficialmente informados, evidência documental e status. Todos os fluxos estão **Documentados**. A orientação jurídica e a decisão do responsável encerraram a antiga pendência sobre OAuth/Fonts/Turnstile. **Preparação técnica concluída; publicação prevista/aprovada para 30/10/2026, não realizada; hora de vigência pendente do corte/ativação.**

## Evidências operacionais desta rodada

- **Código/configuração pública:** Google OAuth com `openid`/`email`/`profile`; Google Fonts externo no layout; Vercel executa backend; Supabase Auth com SMTP Resend, OTP 3600 s.
- **Captura de painel:** Cloudflare somente Turnstile; Resend gratuito e sem rastreamento; Vercel sem Drain; chave Resend restrita a `vendeo.tech`.
- **Declaração do responsável:** Cloudflare somente Turnstile; chave Resend também usada pelo SMTP do Supabase; acesso administrativo exclusivo e 2FA em todos os serviços.
- **Não comprovado:** região Supabase não prova todo o tratamento no Brasil; plano/DPA Vercel; ativação OpenAI por fluxo; instrumento LGPD/ANPD Resend; localização Google OAuth, Google Fonts e Cloudflare Turnstile; retenção interna de logs Vercel.

**Itens operacionais esclarecidos retirados dos bloqueios:** uso de proxy/CDN/DNS Cloudflare, rastreamento Resend, escopo da chave Resend, configuração SMTP do Supabase, Drain Vercel e 2FA administrativo.

## Correções desta revisão

- **Google OAuth e Cloudflare:** a orientação jurídica os separou da relação de exportações atribuídas ao Vendeo; OAuth e Fonts são coleta direta e Turnstile distingue coleta do widget e validação pelo Supabase. Status final: **Documentado**.
- **Reaceite explícito:** Termos 13.2 e AUP 7.2 passaram a declarar que a publicação destas versões **exigirá** reaceite de todos os usuários abrangidos, inclusive beta testers. A obrigação permanece; o gate técnico de aceite antes da oferta é tratado separadamente e **não é bloqueio documental automático** desta quick.
- **Delta dos Termos:** alinhado ao consolidado; removida a cláusula 8.11 inexistente no integral e substituída a afirmação genérica de que “as demais cláusulas permanecem inalteradas” pela prevalência do consolidado e pela ressalva de reorganização/renumeração.
- **Frases editoriais:** removidas das versões públicas “esta Política não fixa prazo de 30 dias” e a coluna técnica de evidências; essas explicações permanecem no pacote de revisão.
- **Impossibilidade técnica/operacional:** incluída nas exceções da cláusula 6.1, com necessidade, proporcionalidade, comunicação e direitos assegurados; mera conveniência comercial não a caracteriza.
- **Anexo de transferências:** finalizado em `legal-consolidated-pending/international-transfers-annex.md`, copiado para `public/docs/legal/` e publicado na página `/privacidade/transferencias`; a remissão na Privacidade foi mantida.
- **DPA Vercel:** pacote registra que o instrumento cobre Pro/Enterprise e que o plano atual/cobertura precisa ser confirmado; não se presume cobertura do plano Hobby.
- **Matriz de transferências:** separa operação, base legal, mecanismo e status (comprovado/parcial/não comprovado/em avaliação jurídica); “transferência internacional” não é tratada como mecanismo.
- **Anexo:** o texto público ficou separado fisicamente das notas internas e cobre Brasil, Estados Unidos e localidades de IA. A exibição de países não confirmados e a decisão sobre OAuth/Fonts/Turnstile foram encerradas; não há decisão jurídica pendente. A data de publicação está preenchida (30/10/2026); a hora de vigência depende do corte/ativação.
- **Mecanismo vs. operação:** a matriz não usa “transferência internacional” como mecanismo; distingue operação, base legal em avaliação, mecanismo comprovado/não comprovado e instrumento.
- **Créditos:** 6.7 esclarece que as parcelas podem acumular no ciclo vigente, sem transferência para novo ciclo.

## Parecer favorável e ajustes de precisão

- Parecer favorável encaminhado pelo responsável, com publicação aprovada para **30/10/2026**.
- Ajuste de precisão aplicado na **Privacidade 9.7**: informação adicional sobre países, duração, responsabilidades, salvaguardas e mecanismo; acesso à íntegra das cláusulas contratuais quando sujeitas à disponibilização ao titular, observados segredos e regulamentação da ANPD.
- Ajuste de precisão aplicado na **seção 4 do anexo**: fundamento em art. 7º, V e art. 33, IX quando atendidos os requisitos, com outras hipóteses/mecanismos para operações distintas.
- OAuth e Google Fonts seguem a orientação recebida; Turnstile é fluxo distinto; fontes locais permanecem na fase SEO, sem implementação nesta quick.

## Direitos do titular

A Privacidade 12.1 passou a incluir:

- petição contra o controlador perante a ANPD;
- reclamação aos órgãos de defesa do consumidor, quando aplicável;
- canais oficiais: `https://www.gov.br/anpd` e `https://www.consumidor.gov.br`, sem prejuízo de `suporte@vendeo.tech`.

## Identidade aplicada

- Razão social: **Sara Schmoelz Wagner**.
- CNPJ: **15.696.769/0001-63**.
- Endereço: **Rua José Wagner, 45, Ibirama - SC, CEP 89140-000**.
- Sem bairro ou complemento inventados.
- Data de publicação preenchida (30/10/2026); permanece apenas `[DATA E HORA DE VIGÊNCIA]` nos Termos, aguardando o corte autorizado.

## Validações executadas

- Versões v1.5/v1.4/v1.2 preservadas.
- Ausência de 10 créditos/7 dias/168h/raiz como regra vigente.
- Ausência de cláusula 6.15 e de preservação genérica/indefinida.
- Presença de “ciclos promocionais já iniciados” nos Termos e na AUP.
- Presença de Brasil, Anexo de Transferências Internacionais, ANPD e consumidor na Privacidade.
- Anexo registra Brasil, Estados Unidos e localidades de IA; está finalizado e disponível em `/privacidade/transferencias`.
- Pacote registra Cloudflare somente Turnstile; Resend gratuito/sem rastreamento/chave restrita/SMTP; Vercel backend sem Drain; OAuth com escopos; Google Fonts distinto; região Supabase sem conclusão integral.
- Reaceite de Termos/AUP também para beta testers e nova ciência da Privacidade registrados no pacote.
- Ausência de “EEE”, “rede global” e “outras localidades”.
- Ausência de “aviso prévio mínimo de 30 dias” no bloco de ofertas.
- Identidade idêntica nos três documentos, sem bairro/complemento.
- Data 30/10/2026 preenchida nos três consolidados; revisão 8 preencheu a vigência dos Termos com referência à ativação real.
- UTF-8 sem BOM; `git diff --check` sem erros (apenas avisos de normalização LF/CRLF).
- `git status` restrito aos arquivos documentais, cópias públicas, catálogo, página do anexo, middleware, testes e migration preparada.
- `npx vitest run src/lib/legal`: **8 arquivos, 39 testes aprovados**.
- `npm run typecheck`: **exit 0**.
- `npm run lint`: **exit 0**.
- `npm run build`: **exit 0**; `/privacidade/transferencias` gerada como página estática.
- Timestamp `20261030185658` verificado sem colisão na worktree e nas branches `main`, `docs/atualizacao-pacote-juridico`, `feature/fase57-4-base-traducao-interface-configuracoes`, `feature/fase-44-temas-de-campanha-v2`, backup F47 e `origin/main`.
- Cópias públicas conferidas byte a byte; hashes idênticos aos quatro consolidados.
- Nenhuma nota interna nas cópias públicas; o placeholder de vigência existente na revisão 7 foi eliminado na revisão 8.

## Preparação técnica da revisão 7

### Arquivos públicos e código

| Item | Caminho | Estado |
|---|---|---|
| Termos v1.5 | `public/docs/legal/terms-of-service-v1-5.md` | Copiado byte a byte |
| Privacidade v1.4 | `public/docs/legal/privacy-policy-v1-4.md` | Copiado byte a byte |
| AUP v1.2 | `public/docs/legal/acceptable-use-v1-2.md` | Copiado byte a byte |
| Anexo | `public/docs/legal/international-transfers-annex.md` | Copiado byte a byte |
| Catálogo | `src/lib/legal/document-content.ts` | v1.5/v1.4/v1.2 reconhecidas |
| Página do anexo | `src/app/(marketing)/privacidade/transferencias/page.tsx` | Criada |
| Link na Privacidade | `src/app/(marketing)/privacidade/page.tsx` | Adicionado |
| Rota pública | `src/middleware.ts` | `/privacidade/transferencias` liberada |
| Migration | `supabase/migrations/20261030185658_f50_legal_publication.sql` | Preparada, não aplicada |

### Hashes das cópias públicas

| Texto | SHA-256 |
|---|---|
| Termos v1.5 | `0b57d2329abb9c2adc227211ecc71a6db0c9f00c6a70b6639c55120feb4357e0` |
| Privacidade v1.4 | `9427b83344211c129bc86140a1141ee60b5bde9b61b6470e25cf3dbf16332469` |
| AUP v1.2 | `2968f426e180dce9178615ef277e19f3ac852c650c6dd0f549b6a3ff8e60bc92` |
| Anexo | `cbecf6246e781a83d1d66e655c28b15ba97f4ae2d1c476d55d50ca455f03d620` |

### Seleção de versões

`getCurrentVersion` consulta `legal_document_versions` por `document_type`, filtra `effective_at <= now()` e ordena por `effective_at` decrescente. A migration preparada insere v1.5/v1.4/v1.2 com `effective_at = now()`; depois da ativação, essas versões passam a ser as vigentes e o catálogo resolve os arquivos públicos correspondentes. As versões históricas permanecem no catálogo e em `public/docs/legal/`.

### Ordem segura de publicação

1. Deploy com arquivos, catálogo e página disponíveis.
2. Conferir `/termos`, `/privacidade`, `/uso-aceitavel` e `/privacidade/transferencias`.
3. Confirmar que o deploy contém os quatro textos finais sem placeholders e os arquivos correspondem aos hashes registrados.
4. Aplicar somente a migration de publicação no projeto correto; `effective_at = now()` registra a ativação real, após disponibilização pública. Não reaplicar para deslocar a vigência.
5. Conferir as versões exibidas e o mecanismo existente de reaceite/ciência.

**Revisão 8:** Termos sem placeholder e cópia pública idêntica; pendência documental de vigência encerrada. Não registrar publicação realizada antes de conferir deploy e ativação.

## O que não foi feito

Publicação, deploy, ativação, aplicação de migration, reaceite real, ciência real, banco, F57.4, `git add`, commit, merge ou push. O STATE foi atualizado apenas com a linha desta quick.

## Pendências para revisão

1. Revisão do responsável sobre a preparação técnica.
2. **Vigência resolvida:** ativação real após disponibilização pública em 30/10/2026, com `now()` na migration; se ultrapassar a data em Brasília, atualizar datas e fazer novo deploy antes da ativação.
3. Deploy e conferência das URLs públicas.
4. Ativação das versões no banco, mediante autorização, seguida da conferência de reaceite/ciência.
5. Obrigação de reaceite permanece; o gate técnico de aceite antes da oferta será tratado separadamente e **não é bloqueio documental automático**.
6. Versionamento (commit/merge/push) somente após solicitação; não realizado.
7. Documentação periódica e melhorias futuras: subprocessadores, DPA Vercel, migração de hospedagem, fontes locais (SEO), Referrer-Policy e revisão de logs.
