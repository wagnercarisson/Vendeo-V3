import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase/server";
import { requireUser, requireApiUser, UnauthorizedError } from "@/lib/auth/require-user";
import { getCurrentStore } from "@/lib/auth/store-ownership";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { apiHandler } from "@/lib/auth/api-handler";
import { getLaunchConfig } from "@/lib/launch-config/config";
import { buildStoreResponse } from "@/lib/store-response";
import { STORE_SEGMENTS, STORE_SUBSEGMENTS } from "@/lib/constants";
import { getCurrentVersion } from "@/lib/legal/document-versions";
import { validateCnpj } from "@/lib/cnpj/validate";
import { maskCnpj } from "@/lib/cnpj/mask";
import { hashCnpjRoot } from "@/lib/cnpj/hash";
import { isCnpjDuplicateError, CNPJ_DUPLICATE_RESPONSE } from "@/lib/cnpj/duplicate-error";
import { compareBusinessName } from "@/lib/cnpj/similarity";
import { CnpjVerificationService, createSupabaseLookupCache } from "@/lib/cnpj/verification-service";
import { BrasilApiProvider } from "@/lib/cnpj/lookup-providers/brasil-api";
import { CnpjaProvider } from "@/lib/cnpj/lookup-providers/cnpja";
import type { CnpjLookupData } from "@/lib/cnpj/lookup-providers/types";
import { evaluateFreemiumEligibility } from "@/lib/freemium/freemium-risk-service";
import { maybeCompleteOnboardingAndStartTrial } from "@/lib/credit/trial-offer/completion";

const GENERIC_SUBSEGMENT_VALUES = ["outro", "loja", "comercio", "com\u00e9rcio", "varejo"];

function validateSubsegment(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < 3) return "Digite ao menos 3 caracteres";
  if (trimmed.length > 30) return "M\u00e1ximo de 30 caracteres";
  if (!/^[A-Za-z\u00c0-\u00fc\s]+$/.test(trimmed)) return "Use apenas letras e espa\u00e7os";
  if (GENERIC_SUBSEGMENT_VALUES.includes(trimmed.toLowerCase())) return "Valor gen\u00e9rico n\u00e3o permitido";
  return null;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled CNPJ lookup status: ${JSON.stringify(value)}`);
}

function sanitizeSubsegment(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map(w => w.split("-").map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join("-"))
    .join(" ");
}

type PolicyContextSignals = {
  policyCohort?: "root_legacy" | "per_cnpj_f50_4";
  beneficiaryEligible?: boolean;
  rootEligible: boolean;
};

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/**
 * F50.4 — contexto de política resolvido no banco (RPC service_role-only).
 * O app NÃO replica a regra de coorte. Fallback explícito: sem `policy_cohort`
 * (RPC indisponível/payload inválido) mantém o comportamento legado da F50.2,
 * recalculando `rootEligible` por `freemium_entitlements`/root_hash.
 */
async function resolvePolicyContext(
  userId: string,
  cnpjNormalized: string,
  rootHash: string,
): Promise<PolicyContextSignals> {
  const { data, error } = await supabase.rpc("trial_offer_policy_context", {
    p_user_id: userId,
    p_cnpj_normalized: cnpjNormalized,
    p_root_hash: rootHash,
  });

  const record = toRecord(data);
  const cohort = record.policy_cohort;

  if (!error && (cohort === "root_legacy" || cohort === "per_cnpj_f50_4")) {
    return {
      policyCohort: cohort,
      beneficiaryEligible:
        typeof record.beneficiary_eligible === "boolean"
          ? record.beneficiary_eligible
          : undefined,
      rootEligible: record.root_eligible === true,
    };
  }

  // Log estruturado sem CNPJ/root_hash/payload.
  console.warn("trial_offer_policy_context_unavailable");

  const { data: existingEntitlement } = await supabase
    .from("freemium_entitlements")
    .select("id")
    .eq("root_hash", rootHash)
    .eq("benefit_type", "onboarding")
    .maybeSingle();

  return { rootEligible: !existingEntitlement };
}

export const POST = apiHandler(async (request: NextRequest) => {
  requireSameOrigin(request);
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { name, segment, city, state, brand_color, logo_url, subsegment, tone_of_voice, positioning, short_description, slogan, acceptedTerms, cnpj, razaoSocial, nomeFantasia } = body as Record<string, unknown>;

    if (!acceptedTerms) {
      return NextResponse.json(
        { error: "Voc\u00ea precisa aceitar os Termos de Uso e a Pol\u00edtica de Uso Aceit\u00e1vel." },
        { status: 400 }
      );
    }

    if (!name || typeof name !== "string" || name.trim().length < 2 || name.trim().length > 60) {
      return NextResponse.json(
        { error: "name is required and must be between 2 and 60 characters" },
        { status: 400 }
      );
    }

    const validSegmentValues = STORE_SEGMENTS.map(s => s.value) as string[];
    if (!segment || typeof segment !== "string" || !validSegmentValues.includes(segment)) {
      return NextResponse.json(
        { error: `segment is required and must be one of: ${validSegmentValues.join(", ")}` },
        { status: 400 }
      );
    }

    // F36 DELTA (D15): cnpj agora é opcional — POST /api/store em dois modos
    // (draft × verified/fiscal). Validações compartilhadas (subsegmento, versões
    // legais, IP/UA) rodam antes do branch e são reutilizadas pelo modo draft.
    let effectiveSubsegment: string | null = null;
    if (subsegment !== undefined && subsegment !== null && subsegment !== "") {
      if (typeof subsegment !== "string") {
        return NextResponse.json({ error: "subsegment inv\u00e1lido" }, { status: 400 });
      }

      const segmentKey = segment as keyof typeof STORE_SUBSEGMENTS;
      const segmentSubs = STORE_SUBSEGMENTS[segmentKey] ?? [];
      const trimmed = subsegment.trim();
      const isPredefined = segmentSubs.some(s => s.value === trimmed.toLowerCase());

      if (isPredefined) {
        effectiveSubsegment = trimmed.toLowerCase();
      } else {
        if (trimmed.toLowerCase() === "outro") {
          return NextResponse.json({ error: "Valor inv\u00e1lido para subsegmento" }, { status: 400 });
        }

        const subError = validateSubsegment(subsegment);
        if (subError) {
          return NextResponse.json({ error: subError }, { status: 400 });
        }

        effectiveSubsegment = sanitizeSubsegment(subsegment);
      }
    } else if (segment === "outros") {
      return NextResponse.json({ error: "Subsegmento obrigat\u00f3rio para segmento outros" }, { status: 400 });
    }

    const termsVersion = await getCurrentVersion("terms_of_service");
    const aupVersion = await getCurrentVersion("acceptable_use");

    if (!termsVersion || !aupVersion) {
      return NextResponse.json(
        { error: "Documentos legais n\u00e3o publicados. Tente novamente mais tarde." },
        { status: 500 }
      );
    }

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? request.headers.get("x-real-ip")
      ?? "unknown";

    const userAgent = request.headers.get("user-agent") ?? "unknown";

    const hasCnpj = typeof cnpj === "string" && cnpj.trim() !== "";

    if (hasCnpj) {
      // === MODO VERIFIED/FISCAL (F32/F33 — caminho inalterado) ===
      const cnpjResult = validateCnpj(cnpj);
    if (cnpjResult instanceof Error) {
      return NextResponse.json({ error: "CNPJ inv\u00e1lido" }, { status: 400 });
    }

    const { normalized } = cnpjResult;
    const root = normalized.slice(0, 8);
    const rootHash = hashCnpjRoot(root);

    const { data: existing } = await supabase
      .from("stores")
      .select("id")
      .eq("cnpj_normalized", normalized)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Este CNPJ j\u00e1 est\u00e1 cadastrado em outra conta" },
        { status: 409 }
      );
    }

    let verificationStatus = "unverified";
    let verificationData: Record<string, unknown> | null = null;
    let cnpjOfficialData: CnpjLookupData | null = null;
    let verificationReasons: string[] | null = null;
    let userMessage = "";

    const lookupService = new CnpjVerificationService(
      new BrasilApiProvider(),
      new CnpjaProvider(),
      createSupabaseLookupCache(supabase as never)
    );
    const lookupResult = await lookupService.resolve(normalized);

    // Ramo exaustivo: qualquer status novo quebra a compilação via assertNever.
    switch (lookupResult.status) {
      case "not_found":
        return NextResponse.json(
          { error: "Não foi possível criar a loja. O CNPJ informado não foi encontrado na Receita Federal. Verifique o número e tente novamente." },
          { status: 400 }
        );

      case "unavailable":
        verificationStatus = "defer";
        verificationReasons = ["api_unavailable"];
        userMessage = "Loja criada. Não foi possível verificar os dados cadastrais agora. Você pode tentar novamente em 'Dados da Loja'.";
        break;

      case "unsupported_format":
        // Formato ainda não suportado pelos provedores NÃO é inexistência:
        // loja é criada com defer e sem grant.
        verificationStatus = "defer";
        verificationReasons = ["api_unsupported_format"];
        userMessage = "Loja criada. A consulta cadastral ainda não suporta este formato de CNPJ; você pode tentar novamente em 'Dados da Loja'.";
        break;

      case "resolved": {
      cnpjOfficialData = lookupResult.data;
      verificationData = { signals: {}, score: 0 };

      // Pré-gate D7: cidade/UF ausentes (undefined/empty após trim) → NÃO chamar o motor.
      // A loja permanece NÃO avaliada (unverified): sem review na fila admin, sem concessão.
      // O motor nunca recebe nulos (contrato único create/update — mesmo pré-gate em update-cnpj).
      const storeCity = typeof city === "string" ? city.trim() : "";
      const storeState = typeof state === "string" ? state.trim() : "";

      if (storeCity !== "" && storeState !== "") {
        // F50.4 — coorte/elegibilidade por CNPJ resolvidas pela RPC; fallback legado
        // explícito quando o contexto não está disponível (sem estado novo de coorte).
        const policy = await resolvePolicyContext(user.userId, normalized, rootHash);

        const eligibility = evaluateFreemiumEligibility({
          cnpj: normalized,
          storeName: (name as string).trim(),
          city: storeCity,
          state: storeState,
          segment: segment as string,
          officialData: cnpjOfficialData,
          lookupOutcome: "resolved",
          rootHash,
          rootEligible: policy.rootEligible,
          policyCohort: policy.policyCohort,
          beneficiaryEligible: policy.beneficiaryEligible,
        });

        verificationData = { signals: eligibility.signals, score: eligibility.score };
        verificationStatus = eligibility.decision;
        verificationReasons = eligibility.reasons.length > 0 ? eligibility.reasons : null;

        if (eligibility.decision === "approved") {
          userMessage = "Loja criada com sucesso! Seus créditos de boas-vindas foram liberados.";
        } else if (eligibility.decision === "review") {
          userMessage = "Loja criada. Seus créditos de boas-vindas serão liberados após verificação cadastral.";
        } else if (eligibility.decision === "reject") {
          if (eligibility.reasons.includes("cnpj_baixada") || eligibility.reasons.includes("cnpj_nula")) {
            userMessage = "Loja criada. Este CNPJ está com situação cadastral inativa.";
          } else if (eligibility.reasons.includes("beneficiary_already_used")) {
            userMessage = "Loja criada. O benefício de boas-vindas já foi utilizado para este CNPJ.";
          } else if (eligibility.reasons.includes("root_already_used")) {
            userMessage = "Loja criada como filial. Esta empresa já utilizou o benefício de boas-vindas.";
          }
        }
      } else {
        // D7 — cidade/UF ausentes: loja NÃO avaliada (unverified), sem review na fila
        // admin e sem concessão de crédito (o motor não é chamado).
        verificationStatus = "unverified";
        verificationData = { signals: {}, score: 0 };
        verificationReasons = null;
      }
      break;
      }

      default:
        assertNever(lookupResult);
    }

    let cnpjValidationScore: Record<string, unknown> | null = null;
    if (razaoSocial || nomeFantasia) {
      const score = compareBusinessName(
        name as string,
        (razaoSocial as string) ?? "",
        nomeFantasia as string | undefined
      );
      if (score.bestScore < 0.8) {
        cnpjValidationScore = { name_mismatch: true, score: score.bestScore };
      } else {
        cnpjValidationScore = { name_match: true, score: score.bestScore };
      }
    }

    const { data, error } = await supabase.rpc("create_store_with_cnpj", {
      p_cnpj_normalized: normalized,
      p_cnpj_root_hash: rootHash,
      p_cnpj_validation_score: cnpjValidationScore ?? null,
      p_user_id: user.userId,
      p_name: (name as string).trim(),
      p_segment: segment as string,
      p_city: typeof city === "string" ? city : null,
      p_state: typeof state === "string" ? state : null,
      p_accepted_by_user_id: user.userId,
      p_terms_version: termsVersion.version,
      p_acceptable_use_version: aupVersion.version,
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
      p_brand_color: typeof brand_color === "string" ? brand_color : null,
      p_logo_url: typeof logo_url === "string" ? logo_url : null,
      p_subsegment: effectiveSubsegment,
      p_tone_of_voice: typeof tone_of_voice === "string" ? tone_of_voice : null,
      p_positioning: typeof positioning === "string" ? positioning.trim() || null : null,
      p_short_description: typeof short_description === "string" ? short_description.trim() || null : null,
      p_slogan: typeof slogan === "string" ? slogan.trim() || null : null,
      p_razao_social: typeof razaoSocial === "string" ? razaoSocial : null,
      p_nome_fantasia: typeof nomeFantasia === "string" ? nomeFantasia : null,
      p_demo_grant_enabled: getLaunchConfig().demoCreditsEnabled,
      p_verification_status: verificationStatus,
      p_verification_data: verificationData,
      p_cnpj_official_data: cnpjOfficialData as unknown as Record<string, unknown> | null,
      p_verification_reasons: verificationReasons,
    });

    if (error) {
      if (isCnpjDuplicateError(error)) {
        return CNPJ_DUPLICATE_RESPONSE();
      }
      const errText = `${error.message ?? ""} ${error.details ?? ""}`;
      if (error.code === "23505" || errText.includes("stores_user_id_key")) {
        return NextResponse.json(
          { error: "Usu\u00e1rio j\u00e1 possui uma loja" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const cnpjMasked = maskCnpj(normalized);

    const rpcData = data as Record<string, unknown>;
    const rpcStore = Array.isArray(rpcData.store)
      ? (rpcData.store as Record<string, unknown>[])[0]
      : (rpcData.store as Record<string, unknown> | undefined);

    if (!rpcStore || typeof rpcStore !== "object" || !("id" in rpcStore)) {
      return NextResponse.json(
        { error: "Loja criada, mas resposta não retornou o ID da loja." },
        { status: 500 }
      );
    }

    const trialOffer = await maybeCompleteOnboardingAndStartTrial(String((rpcStore as Record<string, unknown>).id));

    const responseData = {
      ...(rpcStore as Record<string, unknown>),
      cnpjMasked,
      onboardingGranted: rpcData.onboardingGranted ?? false,
      verificationStatus: rpcData.verificationStatus ?? verificationStatus,
      message: userMessage,
      trialOffer,
    };

    return NextResponse.json(responseData, { status: 201 });
    }

    // === MODO DRAFT (F36 D15) — sem CNPJ ===
    // Loja draft não é loja pronta: sem grant freemium; readiness reporta
    // cadastro_fiscal pendente; transição draft → fiscal via POST /api/store/update-cnpj.
    const { data: draftData, error: draftError } = await supabase.rpc("create_store_draft", {
      p_user_id: user.userId,
      p_name: (name as string).trim(),
      p_segment: segment as string,
      p_city: typeof city === "string" ? city : null,
      p_state: typeof state === "string" ? state : null,
      p_accepted_by_user_id: user.userId,
      p_terms_version: termsVersion.version,
      p_acceptable_use_version: aupVersion.version,
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
      p_brand_color: typeof brand_color === "string" ? brand_color : null,
      p_logo_url: typeof logo_url === "string" ? logo_url : null,
      p_subsegment: effectiveSubsegment,
      p_tone_of_voice: typeof tone_of_voice === "string" ? tone_of_voice : null,
      p_positioning: typeof positioning === "string" ? positioning.trim() || null : null,
      p_short_description: typeof short_description === "string" ? short_description.trim() || null : null,
      p_slogan: typeof slogan === "string" ? slogan.trim() || null : null,
    });

    if (draftError) {
      const errText = `${draftError.message ?? ""} ${draftError.details ?? ""}`;
      if (draftError.code === "23505" || errText.includes("stores_user_id_key")) {
        return NextResponse.json(
          { error: "Usu\u00e1rio j\u00e1 possui uma loja" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: draftError.message }, { status: 500 });
    }

    const draftRpcData = draftData as Record<string, unknown>;
    const draftRpcStore = Array.isArray(draftRpcData.store)
      ? (draftRpcData.store as Record<string, unknown>[])[0]
      : (draftRpcData.store as Record<string, unknown> | undefined);

    if (!draftRpcStore || typeof draftRpcStore !== "object" || !("id" in draftRpcStore)) {
      return NextResponse.json(
        { error: "Loja criada, mas resposta não retornou o ID da loja." },
        { status: 500 }
      );
    }

    const trialOffer = await maybeCompleteOnboardingAndStartTrial(String((draftRpcStore as Record<string, unknown>).id));

    return NextResponse.json(
      { ...(draftRpcStore as Record<string, unknown>), onboardingGranted: draftRpcData.onboardingGranted ?? false, trialOffer },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw error;
  }
});

export const GET = apiHandler(async (_request: NextRequest) => {
  try {
    const user = await requireApiUser();
    const store = await getCurrentStore(user.userId);

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const data = await buildStoreResponse(store);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw error;
  }
});
