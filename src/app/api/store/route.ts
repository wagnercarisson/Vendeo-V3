import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase/server";
import { requireUser, requireApiUser, UnauthorizedError } from "@/lib/auth/require-user";
import { getCurrentStore } from "@/lib/auth/store-ownership";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { apiHandler } from "@/lib/auth/api-handler";
import { buildStoreResponse } from "@/lib/store-response";
import { STORE_SEGMENTS, STORE_SUBSEGMENTS } from "@/lib/constants";
import { getCurrentVersion } from "@/lib/legal/document-versions";
import { validateCnpj } from "@/lib/cnpj/validate";
import { maskCnpj } from "@/lib/cnpj/mask";
import { hashCnpjRoot } from "@/lib/cnpj/hash";
import { compareBusinessName } from "@/lib/cnpj/similarity";

const GENERIC_SUBSEGMENT_VALUES = ["outro", "loja", "comercio", "com\u00e9rcio", "varejo"];

function validateSubsegment(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < 3) return "Digite ao menos 3 caracteres";
  if (trimmed.length > 30) return "M\u00e1ximo de 30 caracteres";
  if (!/^[A-Za-z\u00c0-\u00fc\s]+$/.test(trimmed)) return "Use apenas letras e espa\u00e7os";
  if (GENERIC_SUBSEGMENT_VALUES.includes(trimmed.toLowerCase())) return "Valor gen\u00e9rico n\u00e3o permitido";
  return null;
}

function sanitizeSubsegment(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map(w => w.split("-").map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join("-"))
    .join(" ");
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

    if (!cnpj || typeof cnpj !== "string") {
      return NextResponse.json({ error: "CNPJ \u00e9 obrigat\u00f3rio" }, { status: 400 });
    }

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
    });

    if (error?.message?.includes("stores_user_id_key") || error?.code === "23505") {
      return NextResponse.json(
        { error: "Usu\u00e1rio j\u00e1 possui uma loja" },
        { status: 409 }
      );
    }

    if (error) {
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

    const responseData = {
      ...(rpcStore as Record<string, unknown>),
      cnpjMasked,
      onboardingGranted: rpcData.onboardingGranted ?? false,
    };

    return NextResponse.json(responseData, { status: 201 });
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
