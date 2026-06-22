/**
 * Testes automatizados para Phase 4.6.5 — VS Color Drift & Brand Profile Alignment
 *
 * Cenários cobertos:
 *   4 - Fallback heurístico (intendedPalette = null, probe disponível)
 *   6 - Probe unavailable (asset_url inválido)
 *   7 - Fallback completo (intendedPalette = null, sem brandColor, probe vazio)
 *
 * USO:
 *   node scripts/test-4.6.5-scenarios.mjs
 *
 * PRÉ-REQUISITOS:
 *   - .env.local com SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 *   - Servidor dev rodando (next dev) na porta 3000
 *   - OPENAI_API_KEY configurada (para cenário 4/7)
 *   - OPENAI_API_KEY desabilitada (para cenário 3/6 — ou usa mock)
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

// --- Helpers ---
async function supabaseQuery(url, key, method, path, body) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Prefer': 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${method} ${path}: ${res.status} ${text}`);
  }
  return res.json();
}

function loadEnv() {
  try {
    const envPath = join(process.cwd(), '.env.local');
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      process.env[key] = value;
    }
  } catch { /* ignore */ }
}

async function createStore(supabaseUrl, supabaseKey, name) {
  const stores = await supabaseQuery(supabaseUrl, supabaseKey, 'POST', 'stores', {
    name,
    segment: 'padaria-confeitaria-doces',
    subsegment: 'padaria',
    city: 'Ibirama',
    state: 'SC',
    tone_of_voice: 'acolhedor',
    identity_state: 'text_only',
    text_only_origin: 'implicit',
  });
  return stores[0];
}

async function createSignature(supabaseUrl, supabaseKey, storeId, assetUrl, metadata) {
  const sigs = await supabaseQuery(supabaseUrl, supabaseKey, 'POST', 'store_visual_signatures', {
    store_id: storeId,
    storage_path: `${storeId}/test.png`,
    asset_url: assetUrl,
    type: 'automatic_generated',
    status: 'draft',
    generation_mode: 'user_choice',
    prompt: 'test prompt',
    metadata: metadata ?? {},
  });
  return sigs[0];
}

async function approveSignature(storeId, signatureId) {
  const res = await fetch(`${BASE_URL}/api/store/${storeId}/visual-signature/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signatureId }),
  });
  const body = await res.json();
  return { status: res.status, body };
}

function pad(s, n) { return s.padEnd(n); }

// --- Tests ---
async function run() {
  loadEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios no .env.local');
    process.exit(1);
  }

  // Usar uma store fixa para todos os cenários
  const STORE_NAME = `Test-4.6.5-${Date.now()}`;
  console.log(`\n${'='.repeat(60)}`);
  console.log(` Criando store: ${STORE_NAME}`);
  console.log(`${'='.repeat(60)}\n`);

  const store = await createStore(supabaseUrl, supabaseKey, STORE_NAME);
  console.log(` Store ID: ${store.id}\n`);

  let passed = 0;
  let failed = 0;
  const results = [];

  // ============================================================
  // CENÁRIO 4: Fallback heurístico — intendedPalette = null
  // ============================================================
  console.log(`${'='.repeat(60)}`);
  console.log(` CENÁRIO 4: Fallback heurístico (intendedPalette = null)`);
  console.log(`${'='.repeat(60)}`);

  try {
    const sig4 = await createSignature(supabaseUrl, supabaseKey, store.id,
      'https://gvbzwihwgzujwsviufgy.supabase.co/storage/v1/object/public/visual-signatures/3b76cba2-8d5c-4868-ade6-23846136f3e6/0f6f89db-1dd3-4ac6-8699-3e9f727e1d6e.png',
      {
        artDirectorOutput: {
          visual_direction: 'teste',
          content_used: { store_name: true, city: false, state: false, slogan: false },
          visual_elements: ['teste'],
          // SEM intended_palette — intencional
        },
      }
    );
    const res4 = await approveSignature(store.id, sig4.id);
    const ok4 = res4.status === 200 && res4.body.brandProfile?.status === 'synced';
    const hasFallback = res4.body.brandProfileData?.safe_color_tokens?.primary != null;
    console.log(`   Status: ${res4.status}, Profile: ${res4.body.brandProfile?.status}, safe_color_tokens: ${hasFallback}`);
    results.push({ scenario: 4, name: 'Fallback heurístico', pass: ok4 && hasFallback, detail: `status=${res4.status}` });
    if (ok4 && hasFallback) passed++; else failed++;
  } catch (err) {
    console.error(`   ERRO: ${err.message}`);
    results.push({ scenario: 4, name: 'Fallback heurístico', pass: false, detail: err.message });
    failed++;
  }

  // ============================================================
  // CENÁRIO 6: Probe unavailable (asset_url inválido)
  // ============================================================
  console.log(`\n${'='.repeat(60)}`);
  console.log(` CENÁRIO 6: Probe unavailable (asset_url inválido)`);
  console.log(`${'='.repeat(60)}`);

  try {
    const sig6 = await createSignature(supabaseUrl, supabaseKey, store.id,
      'https://example.com/nonexistent-image.png',
      {
        artDirectorOutput: {
          visual_direction: 'teste',
          content_used: { store_name: true, city: false, state: false, slogan: false },
          visual_elements: ['teste'],
          intended_palette: { primary: '#FF0000', accent: '#00FF00', support: ['#0000FF'], background: '#FFFFFF' },
        },
      }
    );
    const res6 = await approveSignature(store.id, sig6.id);
    // Probe vazio + intendedPalette válido → probe_unavailable (ou failed se vision tb falhar)
    const ok6 = res6.status === 200;
    const profileStatus6 = res6.body.brandProfile?.status ?? 'unknown';
    const globalStatus6 = res6.body.brandProfileData?.metadata?.color_validation?.global_status ?? 'N/A';
    console.log(`   Status: ${res6.status}, Profile: ${profileStatus6}, global_status: ${globalStatus6}`);
    results.push({ scenario: 6, name: 'Probe unavailable', pass: ok6, detail: `profile=${profileStatus6}` });
    if (ok6) passed++; else failed++;
  } catch (err) {
    console.error(`   ERRO: ${err.message}`);
    results.push({ scenario: 6, name: 'Probe unavailable', pass: false, detail: err.message });
    failed++;
  }

  // ============================================================
  // CENÁRIO 7: Fallback completo (intendedPalette = null + probe vazio)
  // ============================================================
  console.log(`\n${'='.repeat(60)}`);
  console.log(` CENÁRIO 7: Fallback completo (intendedPalette = null + probe vazio)`);
  console.log(`${'='.repeat(60)}`);

  try {
    const sig7 = await createSignature(supabaseUrl, supabaseKey, store.id,
      'https://example.com/nonexistent-image.png',
      {
        artDirectorOutput: {
          visual_direction: 'teste',
          content_used: { store_name: true, city: false, state: false, slogan: false },
          visual_elements: ['teste'],
          // SEM intended_palette
        },
      }
    );
    const res7 = await approveSignature(store.id, sig7.id);
    const ok7 = res7.status === 200;
    const profileStatus7 = res7.body.brandProfile?.status ?? 'unknown';
    console.log(`   Status: ${res7.status}, Profile: ${profileStatus7}`);
    results.push({ scenario: 7, name: 'Fallback completo', pass: ok7, detail: `profile=${profileStatus7}` });
    if (ok7) passed++; else failed++;
  } catch (err) {
    console.error(`   ERRO: ${err.message}`);
    results.push({ scenario: 7, name: 'Fallback completo', pass: false, detail: err.message });
    failed++;
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log(`\n${'='.repeat(60)}`);
  console.log(` RESULTADOS`);
  console.log(`${'='.repeat(60)}`);

  for (const r of results) {
    const icon = r.pass ? '✅' : '❌';
    console.log(` ${icon} [Cenário ${r.scenario}] ${pad(r.name, 35)} ${r.detail}`);
  }

  console.log(`\n ${passed} passed, ${failed} failed, ${results.length} total\n`);

  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
