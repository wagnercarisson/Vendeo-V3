# F58-05 — Validação visual humana

**Data:** 2026-11-02
**Ambiente:** produção local (`next build` + `next start`), Supabase homolog local, proxy local para injeção de timeout
**Aceite recebido:** composição visual aprovada em pt-BR e es-419.
**Escopo do aceite:** composição e hierarquia visual; não representa aprovação funcional total nem autoriza publicação.

## Checklist

| # | Cenário | Status | Evidência / observação |
|---|---|---|---|
| 1 | pt-BR desktop ≥1024 px | **PASS** | Captura `58-05-visual-desktop.png`; painel único, abertura explícita, créditos, novidades e faixa inferior conferidos. |
| 2 | es-419 desktop | **PASS** | Captura `58-05-visual-desktop-es.png`; textos de interface em espanhol, conteúdo editorial em português preservado, `lang` por bloco conferido. |
| 3 | Mobile <640 px | **PASS** | Capturas 390 px e 320 px; ordem visual créditos → campanhas → novidades → faixa; sem overflow horizontal. |
| 4 | Tablet 640–1023 px | **PASS** | Captura a 768 px: painel único com linhas verticais, ações legíveis, nomes longos em duas linhas e sem sobreposição. Critério corrigido: não se exige mais “duas colunas”. |
| 5 | Slow 4G com preferência resolvida | **PASS com ressalva** | pt-BR e es-419: navegação sob throttling exibiu o esqueleto localizado; conteúdo final no idioma resolvido. Não foi feita medição fina de performance. |
| 6 | Slow 4G com timeout/falha de preferência | **PASS** | Proxy local atrasou somente `user_preferences` em 1500 ms; dashboard caiu em pt-BR com log `[i18n] preferences_read_timeout`, consistente com o shell. Nenhum dado foi alterado. |
| 6b | Carregamento real com autenticação/preferência lentas | **PASS com ressalva** | Esqueleto real observado em pt-BR e es-419 com rede throttled; `lang`/`aria-label` localizados. Atraso específico de autenticação não foi injetado. |
| 7 | Fuso da loja ≠ servidor | **PASS** | Servidor iniciado com `TZ=Asia/Tokyo` (03:27) contra loja em `America/Sao_Paulo`; dashboard permaneceu “Boa tarde”, coerente com o fuso da loja. |
| 8 | Falha de leitura de fuso | **PASS** | Harness local de componentes renderizou `DashboardHeader` com saudação neutra em pt-BR e es-419, sem assumir Brasília. |
| 9 | Campanhas com erro | **PASS** | Dashboard exibiu 59 campanhas disponíveis; `/campanhas?status=error` exibiu as 3 campanhas com erro do homolog, confirmando exclusão no dashboard e acesso na listagem. |
| 10 | Miniaturas presente/nula/falha | **PASS** | Presença real nas capturas. Falha de carregamento simulada por abort de imagens de campanha: 3 fallbacks `ImageOff` e ações “Abrir campanha” preservadas. O UAT revelou e motivou a correção do fallback pré-hidratação. |
| 11 | Créditos disponível/zero/indisponível | **PASS** | Disponível nas capturas; zero real com a loja Lar & Amor (`0 créditos`, sem “indisponível”); indisponível observado em harness local de componentes, com ícone âmbar e sem zero. |
| 12 | Avisos de verificação/prontidão | **PASS** | Banner de verificação aprovado visto no dashboard; `ReadinessBanner` pendente observado em harness local pt-BR/es-419, com CTA e rótulos localizados. |
| 13 | Teclado/foco/contraste/truncamento | **PASS com ressalva** | Tab real pt-BR/es-419: créditos → campanhas → novidades. Zoom aproximado de 200% sem overflow; texto longo quebrou sem sobreposição. Contraste medido: heading 19,28:1; secundário 7,87:1; link verde 8,85:1. Leitor de tela real não executado. |
| 14 | Shell/identidade/admin | **PASS** | Shell, sidebar, topbar, logo e assinatura preservados. `/admin` aberto manualmente com preferência es-419: permaneceu em português, sem o namespace do dashboard. |

## Conclusão do checkpoint

- **Composição visual:** aprovada pelo responsável em pt-BR e es-419.
- **UAT funcional:** 14/14 itens observados como PASS, com ressalvas instrumentais: sem leitor de tela real e sem medição fina de performance.
- **Defeito encontrado e corrigido:** fallback de miniatura que não aparecia quando a imagem falhava antes da hidratação.
- **Dados:** nenhuma alteração persistente; a preferência de idioma foi restaurada para `pt-BR`/`explicit`, e o proxy de timeout foi apenas local.
- **Aceite não inferido além do declarado:** este documento não declara produção aprovada nem autoriza merge, push ou deploy.
