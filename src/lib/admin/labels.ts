export const AUDIT_ACTION_LABELS: Record<string, string> = {
  credit_grant: "Concessão de Créditos",
  credit_adjustment: "Ajuste de Créditos",
  store_create_invite: "Criação de Loja",
  manual_refund: "Estorno Manual",
  approve_verification: "Aprovar Verificação",
  reject_verification: "Rejeitar Verificação",
  create_test_store: "Criação de Store Teste",
  admin_exception: "Exceção Administrativa",
  reveal_cnpj: "Revelar CNPJ",
  access_request_approve: "Aprovar Solicitação de Acesso",
  access_request_reject: "Recusar Solicitação de Acesso",
  feature_flag_update: "Atualização de controle operacional",
  operation_cost_update: "Atualização de custo operacional",
};

export const TARGET_TYPE_LABELS: Record<string, string> = {
  store: "Loja",
  user: "Usuário",
  campaign: "Campanha",
  access_request: "Solicitação de Acesso",
  feature_flag: "Controle operacional",
  operation_cost: "Custo operacional",
};

export const BENEFIT_TYPE_LABELS: Record<string, string> = {
  onboarding: "Onboarding",
  monthly: "Mensal",
  admin_exception: "Exceção Admin",
};

export const VERIFICATION_REASON_LABELS: Record<string, string> = {
  nome_divergente: "Nome divergente",
  cidade_divergente: "Cidade divergente",
  uf_divergente: "UF divergente",
  situacao_suspensa: "Situação suspensa",
  api_unavailable: "API indisponível",
  cnpj_baixada: "CNPJ baixado",
  cnpj_nula: "CNPJ nulo",
  root_already_used: "Raiz já usada",
  situacao_nao_ativa: "Situação cadastral não ativa",
  localizacao_oficial_indisponivel: "Localização oficial indisponível",
  segmento_cnae_divergente: "Segmento incompatível com CNAE",
  dados_oficiais_incompletos: "Dados oficiais incompletos",
};

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  terms_of_service: "Termos de Serviço",
  acceptable_use: "Uso Aceitável",
  privacy_policy: "Política de Privacidade",
};

export const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  generating: "Gerando",
  ready: "Pronto",
  error: "Erro",
};
