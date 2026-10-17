// Config-only repair. No provider calls, migrations, active-pair changes or flags.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const SOURCE_URL = "https://developers.openai.com/api/docs/guides/image-generation";
export const CALCULATOR_SOURCE = "https://developers.openai.com/_astro/GptImageTokenCalculator.react.C3_24G3l.js";
// Official calculator: 1024x1024, GPT Image 2.5 (shared Sunburst/Flare), Standard.
// low grid 16, medium grid 24. No downloaded JavaScript is executed.
export function outputTokens(quality) {
  const grid = { low: 16, medium: 24 }[quality];
  if (!grid) throw new Error("unsupported_quality");
  return Math.ceil(grid * grid * (2_000_000 + 1024 * 1024) / 4_000_000);
}

export const MISSING_PRICING = ["gpt-image-2.5-flare", "gpt-image-2.5-sunburst"].flatMap(
  (model) => ["low", "medium"].map((quality) => {
    const tokens = outputTokens(quality);
    const outputUsd = tokens * 30 / 1_000_000;
    // Same USD 0.03 input provision used by the approved pilot; NOT a tariff
    // or a guaranteed upper bound. Round the total upward to a millidollar.
    const estimatedUsd = Math.ceil((outputUsd + 0.03) * 1000) / 1000;
    return { model, quality, tokens, outputUsd, estimatedUsd };
  }),
);

export function assertLocalArtifacts(config, env) {
  if (!/^\s*project_id\s*=\s*"vendeo-homolog"\s*$/m.test(config)) {
    throw new Error("wrong_project");
  }
  const get = (key) => {
    const value = env.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*?)\\s*$`, "m"))?.[1];
    return value?.replace(/^(['"])(.*)\1$/, "$2");
  };
  const url = new URL(get("NEXT_PUBLIC_SUPABASE_URL") ?? get("SUPABASE_URL") ?? "invalid");
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.port !== "57781") {
    throw new Error("wrong_api_destination");
  }
  if (get("VENDEO_GENERATION_PAUSED") !== "true") throw new Error("generation_not_paused");
}

const sqlQuote = (value) => `'${value.replaceAll("'", "''")}'`;

export function buildPricingSql(apply = false) {
  const values = MISSING_PRICING.map((p) =>
    `(${sqlQuote(p.model)},${sqlQuote(p.quality)},${p.estimatedUsd},${p.tokens})`,
  ).join(",\n");
  // Non-pricing state is compared, never restored/overwritten.
  const snapshot = `jsonb_build_object(
    'pair',(SELECT jsonb_agg(to_jsonb(t) ORDER BY scope) FROM public.image_model_pair_config t),
    'spend',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.product_1_1_pilot_spend_state t),
    'flags',(SELECT jsonb_agg(to_jsonb(t) ORDER BY key) FROM public.feature_flags t),
    'legacy_pricing',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.ai_model_pricing t WHERE quality IS NULL),
    'authorizations',(SELECT count(*) FROM public.product_flow_stage_authorizations),
    'calls',(SELECT count(*) FROM public.product_1_1_pilot_paid_calls),
    'campaigns',(SELECT count(*) FROM public.campaigns),
    'migrations',(SELECT count(*) FROM supabase_migrations.schema_migrations))`;
  return `\\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE public.ai_model_pricing IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.feature_flags, public.product_flow_stage_authorizations IN SHARE MODE;
DO $repair$
DECLARE actor uuid; item record; before_state jsonb; changed integer := 0;
BEGIN
  IF (SELECT count(*) FROM supabase_migrations.schema_migrations) <> 126 THEN
    RAISE EXCEPTION 'unexpected_migration_ledger'; END IF;
  IF (SELECT count(*) FROM public.feature_flags WHERE key IN
      ('product_1_1_test_stores_enabled','product_1_1_all_stores_enabled') AND enabled=false) <> 2 THEN
    RAISE EXCEPTION 'flow_not_off'; END IF;
  IF EXISTS (SELECT 1 FROM (
      SELECT DISTINCT ON (scope,instance_identity) * FROM public.product_flow_stage_authorizations
      WHERE event_type IN ('granted','revoked') ORDER BY scope,instance_identity,seq DESC
    ) a WHERE event_type='granted' AND stage<>'off' AND (expires_at IS NULL OR expires_at>now())) THEN
    RAISE EXCEPTION 'enabling_authorization_present'; END IF;
  SELECT user_id INTO actor FROM public.admin_users a
    WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id=a.user_id) ORDER BY user_id LIMIT 1;
  IF actor IS NULL THEN RAISE EXCEPTION 'legitimate_admin_missing'; END IF;
  before_state := ${snapshot};
  FOR item IN SELECT * FROM (VALUES ${values}) v(model,quality,estimated_usd,output_tokens) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.ai_model_catalog WHERE model=item.model AND status='active'
        AND capability='campaign_product_image' AND provider='openai') THEN
      RAISE EXCEPTION 'model_not_active'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.ai_model_pricing WHERE provider='openai'
        AND model=item.model AND quality=item.quality AND effective_until IS NULL) THEN
      PERFORM public.admin_set_ai_model_price(
        p_actor_id=>actor, p_provider=>'openai', p_model=>item.model,
        p_input=>8, p_output=>30, p_cached=>2,
        p_reason=>'quick 261017-ms4: complete missing local model-quality pricing',
        p_image_unit=>item.estimated_usd, p_image_token=>30,
        p_source_url=>${sqlQuote(SOURCE_URL)},
        p_source_note=>'2026-10-17; 1024x1024 Standard; official image rates input 8/output 30/cached 2 USD per 1M; text input 5 USD per 1M. Calculator output tokens='
          ||item.output_tokens||'; image_unit_usd is CONSERVATIVE ESTIMATE: output + USD0.03 input provision, rounded upward to USD0.001; NOT official fixed tariff or guaranteed billing cap. Source calculator: '
          ||${sqlQuote(CALCULATOR_SOURCE)},
        p_quality=>item.quality);
      changed := changed + 1;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM (VALUES ('gpt-image-2'),('gpt-image-2.5-flare'),('gpt-image-2.5-sunburst')) m(model)
      CROSS JOIN (VALUES ('low'),('medium')) q(quality)
      WHERE (SELECT count(*) FROM public.ai_model_pricing p WHERE p.provider='openai'
        AND p.model=m.model AND p.quality=q.quality AND p.effective_until IS NULL
        AND p.image_unit_usd>0) <> 1) THEN RAISE EXCEPTION 'six_pair_coverage_incomplete'; END IF;
  IF before_state IS DISTINCT FROM (${snapshot}) THEN RAISE EXCEPTION 'protected_state_changed'; END IF;
  RAISE NOTICE 'PRICING_READY: six combinations; inserted=%; protected state unchanged',changed;
END $repair$;
SELECT model,quality,image_unit_usd AS estimated_usd FROM public.ai_model_pricing
WHERE provider='openai' AND model IN ('gpt-image-2','gpt-image-2.5-flare','gpt-image-2.5-sunburst')
AND quality IS NOT NULL AND effective_until IS NULL ORDER BY model,quality;
${apply ? "COMMIT" : "ROLLBACK"};
`;
}

export function main(args = process.argv.slice(2)) {
  if (args.some((arg) => arg !== "--apply")) throw new Error("unknown_argument");
  assertLocalArtifacts(
    readFileSync("G:/Vendeo-Homolog/supabase/config.toml", "utf8"),
    readFileSync(".env.local", "utf8"),
  );
  const state = execFileSync("docker", ["inspect", "--format", "{{.State.Status}}", "supabase_db_vendeo-homolog"], { encoding: "utf8" }).trim();
  if (state !== "running") throw new Error("homolog_not_running");
  const apply = args.includes("--apply");
  const result = execFileSync("docker", ["exec", "-i", "supabase_db_vendeo-homolog", "psql", "-U", "postgres", "-d", "postgres", "-X", "-v", "ON_ERROR_STOP=1"], {
    input: buildPricingSql(apply), encoding: "utf8", stdio: ["pipe", "pipe", "pipe"],
  });
  console.log(result);
  console.log(apply ? "LOCAL_PRICING_APPLIED" : "DRY_RUN_ROLLED_BACK");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) {
    console.error(error.stderr?.toString() || error.message);
    process.exitCode = 1;
  }
}
