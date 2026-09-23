# F50 UAT Técnica Controlada

Status: **HUMAN-APPROVED**

- Aprovador: Wagner
- Data: 23/09/2026
- Escopo: task F50 14.4, seis estados em desktop e mobile
- Ambiente: exclusivamente isolado `f50_restore_20260923`
- App UAT: `http://[::1]:55450`
- Supabase isolado: API `55431`, PostgreSQL `55432`, Studio `55433`
- Produção, Vercel, banco remoto, banco local principal e flags de produção não foram alterados.
- Não houve geração de campanha nem chamada paga de IA.

## Correção do Bloqueio

A flag restaurada `public.feature_flags.key = 'captcha_enabled'` estava `true` e tinha prioridade sobre a variável de ambiente da aplicação. Ela foi alterada para `false` **somente no PostgreSQL isolado `127.0.0.1:55432`**. O Auth Supabase isolado não possuía configuração `GOTRUE_CAPTCHA_*` ativa. O login da conta de prova foi então validado antes da execução da matriz.

## Matriz de Cenários

| Cenário | Fixture | Saldo disponível | Estado exibido | Expiração / texto relativo | CTA |
|---|---|---:|---|---|---|
| Demonstração ativa | demo 8; expira em 72h; bônus 0 | 8 | Demonstração ativa | data/hora local; `expira em 3 dias` | sem CTA de solicitação |
| Expiração próxima | demo 6; expira em 6h; bônus 0 | 6 | Expira em breve | data/hora local; `expira em 6 horas` | sem CTA de solicitação |
| Exaurida antes do vencimento | demo 0; expiração futura; bônus 0 | 0 | Demonstração esgotada | sem texto de expiração | Solicitar créditos |
| Expirada/materializada | demo 0; expiração nula; grant de origem | 0 | Demonstração encerrada | sem texto de expiração | Solicitar créditos |
| Saldo insuficiente | demo 0; expiração nula; bônus 0 | 0 | Demonstração não iniciada | sem texto de expiração | Solicitar créditos |
| Bônus pós-demo | demo 0; expiração nula; bônus 5 | 5 | Demonstração encerrada | `Há saldo utilizável além da demonstração.` | sem CTA de solicitação |

## Validações Visuais

Todas as validações abaixo foram aprovadas em desktop e mobile:

1. PASS — Demonstração ativa, desktop
2. PASS — Demonstração ativa, mobile
3. PASS — Expiração próxima, desktop
4. PASS — Expiração próxima, mobile
5. PASS — Demonstração exaurida, desktop
6. PASS — Demonstração exaurida, mobile
7. PASS — Demonstração expirada/materializada, desktop
8. PASS — Demonstração expirada/materializada, mobile
9. PASS — Saldo insuficiente, desktop
10. PASS — Saldo insuficiente, mobile
11. PASS — Crédito bônus pós-demo, desktop
12. PASS — Crédito bônus pós-demo, mobile

Critérios transversais aprovados: estados, saldos e textos coerentes; demo vencida ausente do saldo disponível; bônus pós-demo utilizável; nenhuma cobrança ou ativação pública; sem cortes, sobreposições ou problemas de legibilidade; sem linguagem de compra, pagamento ou SLA.

## Evidências

As evidências foram mantidas fora do repositório, sem credenciais ou segredos:

- `01-ativa-desktop.png` / `01-ativa-mobile.png`
- `02-expira-proximo-desktop.png` / `02-expira-proximo-mobile.png`
- `03-exaurida-desktop.png` / `03-exaurida-mobile.png`
- `04-expirada-desktop.png` / `04-expirada-mobile.png`
- `05-insuficiente-desktop.png` / `05-insuficiente-mobile.png`
- `06-bonus-desktop.png` / `06-bonus-mobile.png`
- `01-ativa.txt` até `06-bonus.txt`

Diretório local de evidências: `C:\Users\wagne\AppData\Local\Temp\opencode\f50-uat-20260923\`.

## Aprovação Humana

**APROVADO — Wagner — 23/09/2026.** Os seis cenários foram revisados em desktop e mobile e atendem aos critérios visuais e funcionais da task 14.4.
