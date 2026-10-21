import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/auth/require-user";
import { getCurrentStore } from "@/lib/auth/store-ownership";
import { apiHandler } from "@/lib/auth/api-handler";
import { getLaunchConfig } from "@/lib/launch-config/config";
import { hashCnpjRoot } from "@/lib/cnpj/hash";
import { isCnpjDuplicateError, CNPJ_DUPLICATE_RESPONSE } from "@/lib/cnpj/duplicate-error";
import { CnpjVerificationService, createSupabaseLookupCache } from "@/lib/cnpj/verification-service";
import { BrasilApiProvider } from "@/lib/cnpj/lookup-providers/brasil-api";
import { CnpjaProvider } from "@/lib/cnpj/lookup-providers/cnpja";
import { compareBusinessName } from "@/lib/cnpj/similarity";
import type { CnpjLookupData } from "@/lib/cnpj/lookup-providers/types";
import { z } from "zod";
import { validateCnpj } from "@/lib/cnpj/validate";
import { evaluateFreemiumEligibility } from "@/lib/freemium/freemium-risk-service";
import { maybeCompleteOnboardingAndStartTrial } from "@/lib/credit/trial-offer/completion";

const UpdateCnpjSchema = z.object({
  storeId: z.string().uuid(),
  // Aceita a representação de entrada (pontuação/caixa); a autoridade de
  // formato é validateCnpj, que devolve o canônico de 14 caracteres.
  cnpjNormalized: z.string().min(1).max(40),
  razaoSocial: z.string().min(2).max(200),
  nomeFantasia: z.string().max(200).optional(),
});

export const POST = apiHandler(async (request: NextRequest) => {
  try {
    const user = await requireUser();
    const store = await getCurrentStore(user.userId);

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

    const parsed = UpdateCnpjSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors.map(e => e.message).join("; ") },
        { status: 400 }
      );
    }

    const { storeId, cnpjNormalized, razaoSocial, nomeFantasia } = parsed.data;

    if (storeId !== store.id) {
      return NextResponse.json({ error: "Store mismatch" }, { status: 403 });
    }

    const cnpjResult = validateCnpj(cnpjNormalized);
    if (cnpjResult instanceof Error) {
      return NextResponse.json({ error: "CNPJ inválido" }, { status: 400 });
    }

    // Única fonte de verdade para hash, duplicidade, lookup e persistência.
    const canonical = cnpjResult.normalized;

    // Idempotência: se a loja já possui EXATAMENTE este CNPJ, o re-save é um
    // no-op de sucesso — evita o 409 cnpj_already_set quando o cliente
    // re-envia o mesmo CNPJ (desync de hasExistingCnpj no onboarding).
    if (store.cnpj_normalized === canonical) {
      return NextResponse.json({ success: true, store: [store] });
    }

    const cnpjRootHash = hashCnpjRoot(canonical.slice(0, 8));

    // App-level duplicate check (antes do RPC)
    const { data: existingCnpj } = await supabaseAdmin
      .from("stores")
      .select("id")
      .eq("cnpj_normalized", canonical)
      .neq("id", storeId)
      .maybeSingle();

    if (existingCnpj) {
      return CNPJ_DUPLICATE_RESPONSE();
    }

    // Verificação externa do CNPJ (BrasilAPI → CNPJá)
    const lookupService = new CnpjVerificationService(
      new BrasilApiProvider(),
      new CnpjaProvider(),
      createSupabaseLookupCache(supabaseAdmin as never)
    );
    const lookupResult = await lookupService.resolve(canonical);

    if (lookupResult.status === "not_found") {
      return NextResponse.json(
        { error: "O CNPJ informado não foi encontrado na Receita Federal. Verifique o número e tente novamente." },
        { status: 400 }
      );
    }

    if (lookupResult.status === "unsupported_format" || lookupResult.status === "unavailable") {
      // Para loja normal, bloqueia. Exceção: test store (defer, sem grant).
      if (!(store as any).is_test_store) {
        return NextResponse.json(
          { error: "Serviço de consulta CNPJ temporariamente indisponível. Tente novamente mais tarde." },
          { status: 503 }
        );
      }
    }

    // Monta dados para persistir
    let officialRazaoSocial = razaoSocial.trim();
    let officialNomeFantasia = (nomeFantasia && nomeFantasia.trim()) || officialRazaoSocial;
    let cnpjOfficialData: CnpjLookupData | null = null;
    let verificationStatus = "unverified";
    let verificationData: Record<string, unknown> | null = null;
    let verificationReasons: string[] | null = null;
    let cnpjValidationScore: Record<string, unknown> | null = null;

    if (lookupResult.status === "resolved") {
      cnpjOfficialData = lookupResult.data;
      // Dados oficiais são autoritativos — sobrescrevem input do cliente
      officialRazaoSocial = lookupResult.data.razao_social;
      officialNomeFantasia = lookupResult.data.nome_fantasia || officialRazaoSocial;

      // Similaridade de nome é métrica de APOIO (sinal), NÃO a decisão final (F42 D10).
      // A decisão vem do motor de elegibilidade (evaluateFreemiumEligibility).
      const score = compareBusinessName(
        (store as any).name ?? "",
        officialRazaoSocial,
        officialNomeFantasia
      );
      cnpjValidationScore = score.bestScore >= 0.8
        ? { name_match: true, score: score.bestScore }
        : { name_mismatch: true, score: score.bestScore };

      // Pré-gate D7: cidade/UF ausentes (undefined/empty após trim) → NÃO chamar o motor.
      // A loja permanece NÃO avaliada (unverified): sem approved, sem review, sem concessão.
      // O motor nunca recebe nulos (contrato único create/update — mesmo pré-gate em store/route.ts).
      const storeCity = typeof (store as any).city === "string" ? (store as any).city.trim() : "";
      const storeState = typeof (store as any).state === "string" ? (store as any).state.trim() : "";

      if (storeCity !== "" && storeState !== "") {
        // rootEligible: mesma consulta do create (freemium_entitlements por root_hash)
        const { data: existingEntitlement } = await supabaseAdmin
          .from("freemium_entitlements")
          .select("id")
          .eq("root_hash", cnpjRootHash)
          .eq("benefit_type", "onboarding")
          .maybeSingle();

        const rootEligible = !existingEntitlement;

        const eligibility = evaluateFreemiumEligibility({
          cnpj: canonical,
          storeName: (store as any).name ?? "",
          city: storeCity,
          state: storeState,
          segment: (store as any).segment ?? "",
          officialData: cnpjOfficialData,
          lookupOutcome: "resolved",
          rootHash: cnpjRootHash,
          rootEligible,
        });

        verificationData = { signals: eligibility.signals, score: eligibility.score };
        verificationStatus = eligibility.decision;
        verificationReasons = eligibility.reasons.length > 0 ? eligibility.reasons : null;
      } else {
        // D7 — cidade/UF ausentes: loja NÃO avaliada (unverified), sem approved/review/concessão
        verificationStatus = "unverified";
        verificationData = { signals: {}, score: 0 };
        verificationReasons = null;
      }
    } else if (
      (lookupResult.status === "unsupported_format" || lookupResult.status === "unavailable") &&
      (store as any).is_test_store
    ) {
      // Test store com API indisponível/formatos não suportados: continua com
      // defer e sem grant, usando a reason correspondente ao status.
      verificationStatus = "defer";
      verificationReasons = [
        lookupResult.status === "unsupported_format" ? "api_unsupported_format" : "api_unavailable",
      ];
    }

    const nomeFantasiaFinal = officialNomeFantasia;

    const { data, error } = await supabaseAdmin.rpc("update_store_cnpj", {
      p_store_id: storeId,
      p_cnpj_normalized: canonical,
      p_cnpj_root_hash: cnpjRootHash,
      p_razao_social: officialRazaoSocial,
      p_nome_fantasia: nomeFantasiaFinal,
      p_cnpj_official_data: cnpjOfficialData as unknown as Record<string, unknown> | null,
      p_verification_status: verificationStatus,
      p_verification_data: verificationData,
      p_cnpj_validation_score: cnpjValidationScore,
      p_verification_reasons: verificationReasons,
      p_demo_grant_enabled: getLaunchConfig().demoCreditsEnabled,
    });

    if (error) {
      if (error.message?.includes("store_not_found")) {
        return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
      }
      if (error.message?.includes("cnpj_already_set")) {
        return NextResponse.json({ error: "Esta loja já possui CNPJ cadastrado" }, { status: 409 });
      }
      if (isCnpjDuplicateError(error)) {
        return CNPJ_DUPLICATE_RESPONSE();
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const trialOffer = await maybeCompleteOnboardingAndStartTrial(store.id);

    return NextResponse.json({ success: true, store: data, trialOffer });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw error;
  }
});
