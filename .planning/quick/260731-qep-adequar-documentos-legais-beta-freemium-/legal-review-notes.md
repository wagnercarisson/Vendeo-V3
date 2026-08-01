# Notas Internas de Revisao Juridica - Beta Freemium (Legal Docs v1.3/v1.2/v1.1)

> Uso interno apenas. Este arquivo NAO e servido publicamente e nao deve ser
> referenciado em codigo, migrations ou documentos publicos. Ele registra pontos
> pendentes de validacao juridica antes de publicacao comercial ampla.

**Data:** 2026-07-31
**Contexto:** Publicacao das versoes Termos de Uso v1.3, Politica de Privacidade v1.2
e Politica de Uso Aceitavel v1.1 para beta fechado freemium, sem cobranca publica.

**Registro de revisao:** Os documentos passaram por revisao editorial do time do Vendeo.
Nao houve revisao por advogado. Os pontos abaixo permanecem pendentes de validacao
juridica formal antes de beta aberto, cobranca ou operacao comercial ampla.

## Risco aceito temporariamente

| # | Ponto | Nota interna |
|---|-------|--------------|
| R0 | Identificacao juridica do operador | Por decisao de produto, os documentos publicos do beta fechado nao exibem dados pessoais do responsavel pelo projeto. O beta permanece por convite, gratuito e sem cobranca. A identificacao completa devera ser atualizada quando houver pessoa juridica constituida, e antes de qualquer cobranca, beta aberto ou operacao comercial ampla. |

## Pontos para Revisao Juridica Interna

| # | Ponto | Nota interna para revisao juridica |
|---|-------|-------------------------------------|
| R1 | Limitacao de responsabilidade no beta | A versao atual removeu o teto baseado em valores pagos e adotou limitacao qualitativa para beta gratuito. Validar coerencia frente a CDC/B2B, responsabilidades nao limitaveis, dolo e culpa grave. |
| R2 | CNPJ e LGPD | CNPJ de PJ nem sempre e dado pessoal, mas pode identificar MEI, empresario individual, socios, responsaveis ou contatos. Confirmar tratamento proporcional e que a redacao nao cria obrigacoes alem das existentes. |
| R3 | Raiz de CNPJ como criterio tecnico | A redacao evita tratar raiz de CNPJ como grupo economico juridico. Confirmar que o criterio tecnico de elegibilidade promocional e antifraude e adequado para o beta. |
| R4 | Transferencia internacional | Confirmar salvaguardas contratuais com Supabase, OpenAI, Vercel e demais provedores configurados, e se a redacao generica e suficiente. |
| R5 | Envio de prompts/imagens a provedores de IA | Imagens de produto podem conter pessoas ou terceiros. Confirmar base legal e se e necessario consentimento adicional para categorias especificas. |
| R6 | Credito promocional | Avaliar risco de expectativa de consumidor e classificacao como servico pre-pago. O modelo gratuito mitiga, mas creditos pagos exigirao politica comercial propria antes de implementar pagamento. |
| R7 | Consumo e recreditamento | Alinhar periodicamente a redacao com a implementacao real de reserve/refund em `credit_transactions`. |
| R8 | AUP: de/por e disponibilidade razoavel | Validar enquadramento frente a CONAR/CDC e politica de enforcement. |
| R9 | Categorias sensiveis | Setores regulados (ANVISA, CVM/BACEN, TSE e outros). Confirmar se o Vendeo deve bloquear, sinalizar ou apenas atribuir responsabilidade ao lojista. |
| R10 | Re-aceite em massa no beta | Todos os beta testers existentes podem ficar `outdated` e precisar re-aceitar antes de gerar. Aceitavel no beta, mas comunicar no changelog ou suporte. |
| R11 | Senha/hash | Confirmar continuamente com o stack de autenticacao que o Vendeo nao acessa senhas em texto claro. |
| R12 | Incidentes de seguranca | Manter procedimento interno simples: identificar, conter, preservar evidencias, avaliar risco, registrar e comunicar quando exigido. |
| R13 | Politica comercial futura | A redacao de funcionalidade futura nao deve criar expectativa contratual. Antes da primeira venda: nova versao de Termos, politica comercial, identificacao da empresa, meio de pagamento e tratamento fiscal. |
| R14 | Promessas de seguranca e retencao | A versao atual evita promessas absolutas como "nunca" e eliminacao universal em 90 dias. Validar tecnicamente os controles descritos antes de ampliar a operacao. |
