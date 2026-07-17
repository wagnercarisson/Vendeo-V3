export class MalformedResponseError extends Error {
  constructor(message?: string) {
    super(message ?? "Resposta malformada do provider de IA");
    this.name = "MalformedResponseError";
  }
}

export class ProviderRateLimitError extends Error {
  constructor(message?: string) {
    super(message ?? "Rate limit do provider de IA excedido");
    this.name = "ProviderRateLimitError";
  }
}

export class Provider5xxError extends Error {
  constructor(message?: string) {
    super(message ?? "Erro 5xx do provider de IA");
    this.name = "Provider5xxError";
  }
}

export class NetworkError extends Error {
  constructor(message?: string) {
    super(message ?? "Falha de rede ao contactar provider de IA");
    this.name = "NetworkError";
  }
}

export class SafetyBlockError extends Error {
  constructor(message?: string) {
    super(message ?? "Conteúdo bloqueado pela política de segurança do provider");
    this.name = "SafetyBlockError";
  }
}

export class AuthConfigError extends Error {
  constructor(message?: string) {
    super(message ?? "Erro de autenticação ou configuração do provider");
    this.name = "AuthConfigError";
  }
}

export class PayloadTooLargeError extends Error {
  constructor(message?: string) {
    super(message ?? "Payload excede limite do provider");
    this.name = "PayloadTooLargeError";
  }
}

export class InputConflictError extends Error {
  constructor(message?: string) {
    super(message ?? "Conflito de input validation");
    this.name = "InputConflictError";
  }
}

export function isRetryableError(err: unknown): boolean {
  if (err instanceof MalformedResponseError) return true;
  if (err instanceof ProviderRateLimitError) return true;
  if (err instanceof Provider5xxError) return true;
  if (err instanceof NetworkError) return true;
  if (err instanceof DOMException && err.name === "AbortError") return true;

  return false;
}
