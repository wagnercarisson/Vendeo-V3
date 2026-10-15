/**
 * F56.2b2a — Plano 05 (ajuste 1 da prova f562b): PREPARO das fixtures de CAMPANHA.
 *
 * Uma instância NOVA (`vendeo-f562b-isolated`) NÃO tem campanhas. Antes da prova
 * de backfill (`-MigrationProof`) é preciso um `campaign_id` REAL como alvo da FK
 * de `product_1_1_copy_state`/`product_1_1_copy_cancellations`. NUNCA confiar em
 * `SELECT ... LIMIT 1` para encontrar uma linha: ela não existiria.
 *
 * Este helper REUSA os helpers EXISTENTES do harness de integração
 * (`createTestStore`/`createCampaign` — que por sua vez criam o usuário de auth
 * via `createAuthUser`), apontando para a instância de prova via env
 * `F562B_ISOLATED_SUPABASE_URL`/`F562B_ISOLATED_SERVICE_ROLE_KEY`. Imprime UMA
 * linha JSON `{ campaignId, storeId, userId }` em stdout.
 *
 * SEM provider, SEM crédito, SEM deploy: apenas fixtures locais mínimas.
 */

import { createClient } from "@supabase/supabase-js";

import {
  createCampaign,
  createTestStore,
} from "../../src/lib/product-1-1/__tests__/integration-harness";

async function main(): Promise<void> {
  const url = process.env.F562B_ISOLATED_SUPABASE_URL;
  const serviceRoleKey = process.env.F562B_ISOLATED_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error("missing F562B_ISOLATED_SUPABASE_URL/F562B_ISOLATED_SERVICE_ROLE_KEY");
    process.exit(2);
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const store = await createTestStore(supabase);
  const campaignId = await createCampaign(supabase, store.storeId);

  process.stdout.write(
    `${JSON.stringify({ campaignId, storeId: store.storeId, userId: store.userId })}\n`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`campaign_fixture_failed:${message}`);
  process.exit(1);
});
