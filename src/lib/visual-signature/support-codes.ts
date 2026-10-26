/**
 * Códigos públicos de suporte do fluxo de direção visual (quick 261025-v14).
 *
 * Client-safe de propósito: sem `server-only`, sem imports de servidor/banco.
 * Convenção: código público (`^[A-Z0-9]{1,8}$`) separado da referência interna
 * (operation_run_id/UUID) e da classificação técnica (`provider_error`, ...).
 *
 * NUNCA expor UUID/referência interna na mensagem. O código público não
 * identifica uma ocorrência única — a correlação interna continua sendo feita
 * por `brand_profile_failure_reference` + loja + horário.
 */

export const VISUAL_DIRECTION_SUPPORT_CODES = {
  APPROVAL_FAILED: 'DVAP01',
  REALIGN_FAILED: 'DVRE01',
} as const;

export type VisualDirectionSupportCode =
  (typeof VISUAL_DIRECTION_SUPPORT_CODES)[keyof typeof VISUAL_DIRECTION_SUPPORT_CODES];

export type VisualDirectionFailureRoutine = 'approval' | 'realign';

const MESSAGES: Record<VisualDirectionSupportCode, string> = {
  DVAP01:
    'Não foi possível concluir sua direção visual. A geração de campanhas ficará indisponível até a conclusão. Entre em contato com o suporte e informe o código DVAP01. Após a orientação do suporte, clique em Realinhar direção visual.',
  DVRE01:
    'Não foi possível concluir sua direção visual. A geração de campanhas ficará indisponível até a conclusão. Entre em contato com o suporte e informe o código DVRE01. Após a orientação do suporte, clique em Realinhar direção visual.',
};

/** Mensagem pública canônica — contém o código público uma única vez. */
export function visualDirectionSupportMessage(code: VisualDirectionSupportCode): string {
  return MESSAGES[code];
}

/** Código público correspondente à rotina que falhou. */
export function supportCodeForRoutine(routine: VisualDirectionFailureRoutine): VisualDirectionSupportCode {
  return routine === 'realign'
    ? VISUAL_DIRECTION_SUPPORT_CODES.REALIGN_FAILED
    : VISUAL_DIRECTION_SUPPORT_CODES.APPROVAL_FAILED;
}

/**
 * Falha de conexão ao tentar realinhar sem resposta do servidor.
 * Não é uma ocorrência persistida nem uma classificação técnica confirmada.
 */
export const VISUAL_DIRECTION_CONNECTION_ERROR_MESSAGE =
  'Erro de conexão ao realinhar a direção visual. Tente novamente.';

/** Fallback seguro para falha funcional de realinhamento sem mensagem da API. */
export const VISUAL_DIRECTION_REALIGN_FALLBACK_MESSAGE =
  'Não foi possível realinhar a direção visual agora. Tente novamente.';

/**
 * Mensagem de conexão consistente entre modal e formulário.
 * Com código conhecido, usa a mensagem canônica do catálogo (código uma vez).
 * Sem código, usa mensagem segura sem inventar referência/classificação.
 */
export function visualDirectionConnectionMessage(
  code?: VisualDirectionSupportCode | null,
): string {
  return code ? visualDirectionSupportMessage(code) : VISUAL_DIRECTION_CONNECTION_ERROR_MESSAGE;
}

export function isVisualDirectionSupportCode(value: unknown): value is VisualDirectionSupportCode {
  return value === VISUAL_DIRECTION_SUPPORT_CODES.APPROVAL_FAILED
    || value === VISUAL_DIRECTION_SUPPORT_CODES.REALIGN_FAILED;
}

/**
 * Deriva o código de exibição a partir da metadata existente, sem backfill.
 *
 * - `brand_profile_support_code` explícito e conhecido → respeitado.
 * - `brand_profile_failure_routine === 'realign'` → DVRE01.
 * - Caso contrário → DVAP01 (pendência histórica criada após aprovação, antes
 *   da adoção da convenção).
 */
export function deriveVisualDirectionSupportCode(
  metadata: Record<string, unknown> | null | undefined,
): VisualDirectionSupportCode {
  const explicit = metadata?.brand_profile_support_code;
  if (isVisualDirectionSupportCode(explicit)) return explicit;

  const routine = metadata?.brand_profile_failure_routine;
  if (routine === 'realign') return VISUAL_DIRECTION_SUPPORT_CODES.REALIGN_FAILED;

  return VISUAL_DIRECTION_SUPPORT_CODES.APPROVAL_FAILED;
}
