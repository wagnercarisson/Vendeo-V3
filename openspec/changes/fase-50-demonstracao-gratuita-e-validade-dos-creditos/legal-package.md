# Pacote Jurídico — F50 (para revisão preliminar do advogado)

> Prepara-se **agora**, em paralelo à implementação — não ao final. As minutas de alteração (delta) estão prontas; os **documentos consolidados** são montados nesta preparação (delta + cláusulas inalteradas das versões vigentes), para a revisão jurídica preliminar. **Não substitui revisão de advogado.**

## Conteúdo do pacote

| Item | Fonte | Estado |
|---|---|---|
| Termos de Uso v1.5 — delta | `legal-drafts/terms-of-service-v1-5.md` | pronto |
| Política de Privacidade v1.4 — delta | `legal-drafts/privacy-policy-v1-4.md` | pronto |
| Política de Uso Aceitável v1.2 — delta | `legal-drafts/acceptable-use-v1-2.md` | pronto |
| Termos de Uso v1.5 — consolidado | consolidar `public/docs/legal/terms-of-service-v1-4.md` + delta | montar (task 10.1) |
| Política de Privacidade v1.4 — consolidado | consolidar `public/docs/legal/privacy-policy-v1-3.md` + delta | montar (task 10.1) |
| Política de Uso Aceitável v1.2 — consolidado | consolidar `public/docs/legal/acceptable-use-v1-1.md` + delta | montar (task 10.1) |
| Diferenças (diff) | tabelas de correspondência em cada delta | pronto |

## Placeholders (para consulta ao advogado; nunca para publicação)

- `[DATA DO CORTE]`, `[DATA E HORA DO CORTE]` — preenchidos no corte.
- `[RAZÃO SOCIAL]`, `[CNPJ]`, `[ENDEREÇO FÍSICO]` — **identificação exclusivamente da PJ constituída** (Termos 12.4 e "Controlador e Contato" da Privacidade). Devem ser preenchidos pelo advogado antes do corte; **a publicação com placeholder é proibida** (Decreto nº 7.962/2013). **Nenhum convite ocorre antes da PJ; nenhum placeholder pode chegar à publicação.**

## Inventário real de fornecedores e transferências

| Fornecedor | Uso real | Papel |
|---|---|---|
| Supabase | banco, autenticação, storage | processador (infra) |
| Vercel | hospedagem/edge | processador (infra) |
| OpenAI | inteligência artificial (texto/imagem) | processador (IA) |
| Google/Gemini | inteligência artificial (**restrita ao laboratório**, dados controlados, condicional — fora do processamento produtivo) | processador (IA) — validar faturamento/DPA/retenção/transferência |
| Google OAuth | autenticação | processador |
| Cloudflare | DNS/CDN | processador (infra) |
| Resend | email transacional | processador (email) |

> **Hostinger:** não é texto publicável "conforme o uso real" — confirmar se ainda há uso real; **se não houver, remover** do texto publicado. **Gemini permanece condicional/restrito ao laboratório** enquanto não estiver no processamento produtivo.

## Perguntas ao advogado

1. **Fornecedor responsável (PJ):** identificar exclusivamente a **pessoa jurídica constituída** (razão social, CNPJ e endereço profissional) para os Termos 12.4 e "Controlador e Contato" — remover a questão de operar convites em nome de pessoa física.
2. **Decreto nº 7.962/2013:** aplicabilidade à relação — confirmação imediata da demanda e resposta em até 5 dias. Determina se o auto-ack é obrigatório (cláusula 12.3) ou se a promessa e o auto-ack devem ser removidos em conjunto.
3. **Natureza dos emails:** confirmação de que as mensagens de demonstração e o auto-ack são **comunicações operacionais** (execução do serviço), não de marketing, independentes do consentimento `commercial_communications`.
4. **Base legal LGPD dos eventos de produto** (concessão, primeira geração, esgotamento, expiração, solicitação de suporte): execução contratual / obrigação legal / legítimo interesse, conforme o caso.
5. **Terminologia de privacidade:** uso de "ciência" (em vez de "aceite") para a Política de Privacidade, salvo orientação diferente.
6. **Prazos de retenção/anonimização** de `product_events`, `credit_notifications`, `support_credit_requests` e do WhatsApp; papéis de controlador/operador por finalidade; incidentes e comunicações operacionais.

## Gate

A validação jurídica formal das **três minutas** (delta + consolidado) é **gate de corte**, registrada na verificação (task 14.3). Consolidar os três documentos **cedo** (task 10.1) e manter a revisão jurídica formal como gate de go-live.
