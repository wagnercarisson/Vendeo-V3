/**
 * Fonte única dos textos públicos da oferta e do acesso.
 *
 * Consumida pela home, por `/floriculturas` e por futuras páginas públicas.
 * Não lê env, flag, rede, data ou banco: alterar a comunicação exige mudança de
 * código e deploy, como aprovado. Nenhuma regra de crédito, onboarding ou
 * elegibilidade vive aqui — apenas apresentação.
 */

export const PUBLIC_OFFER_COPY = {
  heading: "Teste gratuitamente.",
  summary: "28 dias gratuitos e até 20 créditos.",
  complement: "Sem cartão de crédito. Oferta para novas contas elegíveis.",
  detailsLabel: "Como funciona o teste gratuito?",
  conditions: {
    start:
      "O período de 28 dias começa após concluir o cadastro e a configuração inicial da sua loja.",
    installments:
      "Você recebe 5 créditos iniciais. Mais 5 são liberados a partir dos dias 7, 14 e 21, no processamento diário, até o máximo de 20 créditos no período.",
    accumulation:
      "Os créditos acumulam, inclusive as parcelas liberadas durante sua ausência, e os créditos gratuitos restantes vencem ao final do período.",
  },
  closedDetailsNote: "Solicitar acesso não inicia o período do teste.",
} as const;

export const PUBLIC_ACCESS_COPY = {
  google: "Continuar com Google",
  email: "Continuar com email",
  closedCta: "Solicitar acesso gratuito",
  closedSupport: "Solicite seu convite para experimentar o Vendeo.",
  institutional: "Conheça o Vendeo",
} as const;
