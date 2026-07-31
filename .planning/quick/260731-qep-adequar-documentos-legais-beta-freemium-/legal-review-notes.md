# Notas Internas de Revisão Jurídica — Beta Freemium (Legal Docs v1.3/v1.2/v1.1)

> **Uso interno apenas.** Este arquivo NÃO é servido publicamente e não deve ser
> referenciado em código, migrations ou documentos públicos (decisão D1 do plano
> `260731-qep-adequar-documentos-legais-beta-freemium-`). Ele registra os pontos
> pendentes de validação jurídica antes de publicação comercial ampla.

**Data:** 2026-07-31
**Contexto:** Publicação das versões Termos de Uso v1.3, Política de Privacidade v1.2
e Política de Uso Aceitável v1.1 para o período de beta freemium (sem cobrança pública).

**Registro de revisão:** Os documentos passaram por revisão editorial do time do Vendeo
antes desta publicação. Não houve revisão por advogado. Os pontos abaixo permanecem
pendentes de validação jurídica formal.

## Pontos para Revisão Jurídica Interna

| # | Ponto | Nota interna para revisão jurídica |
|---|-------|-------------------------------------|
| R1 | Limitação de responsabilidade §7 no beta | Redação "limitada ao valor pago nos últimos 12 meses" com beta sem cobrança = exposição próxima de zero. Validar coerência (CDC vs B2B) e se convém cláusula específica de beta sem contraprestação financeira |
| R2 | CNPJ e LGPD | CNPJ de PJ nem sempre é dado pessoal; mas pode identificar MEI/empresário individual/sócios/responsáveis/contatos. Confirmar tratamento proporcional e que a redação não cria obrigações além das existentes |
| R3 | "Grupo econômico" → critério técnico | A troca evita definição jurídica de grupo econômico (que tem efeitos trabalhistas/concorrenciais). Confirmar que o critério de raiz de CNPJ não caracteriza discriminação indevida entre lojistas |
| R4 | Transferência internacional (art. 33 LGPD) | Confirmar salvaguardas contratuais com Supabase/OpenAI/Vercel e demais provedores configurados (cláusulas-padrão/adequação) e se a redação genérica é suficiente |
| R5 | Envio de prompts/imagens a provedores de IA | Imagens de produto podem conter pessoas/terceiros. Confirmar base legal (execução de contrato) e se é necessário consentimento adicional para categorias específicas |
| R6 | Crédito "não é moeda / não gera resgate" | Avaliar risco de consumer expectations e classificação como serviço pré-pago (CDC). O modelo de créditos promocionais sem pagamento mitiga, mas a evolução futura para créditos pagos exigirá política comercial própria antes de implementar Stripe (F36) |
| R7 | Consumo de crédito apenas pós-conclusão técnica | Alinhar com implementação real (reserve/refund em `credit_transactions`): recreditamento automático/manual precisa corresponder ao comportamento do sistema; validar com F24/F29.1.1 |
| R8 | AUP "de/por" e promoções sem estoque | Enquadramento CONAR/CDC; enforcement é do Lojista, mas o Vendeo deve ter sanções previstas na AUP para descumprimento (já existem §5) |
| R9 | Categorias sensíveis (saúde, suplementos, bebidas, financeiro, eleitoral) | Setores regulados (ANVISA, CVM/BACEN, TSE). Confirmar se o Vendeo deve bloquear ou apenas sinalizar responsabilidade; política de enforcement |
| R10 | Re-aceite em massa no beta | Todos os beta testers existentes virão `outdated` e serão bloqueados de gerar até re-aceitar. Aceitável no beta, mas comunicar via changelog; validar se deve haver janela de tolerância |
| R11 | Senha/hash (D5) | A redação corrigida evita alegação de acesso indevido a senhas; confirmar com o stack (Supabase Auth armazena hash) |
| R12 | Incidentes de segurança | Nova obrigação de comunicação de incidentes — alinhar com processo operacional real (F28 observabilidade) antes de assumir prazos |
| R13 | Política comercial futura (G) | Redação "funcionalidade futura" não deve criar expectativa contratual; F36 (Stripe) exigirá nova versão dos Termos + política comercial própria |
