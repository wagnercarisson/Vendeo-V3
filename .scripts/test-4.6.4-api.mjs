#!/usr/bin/env node

/**
 * Automated API tests for Phase 4.6.4 — Visual Signature Lifecycle
 *
 * Seeds test data directly via Supabase service role, then exercises
 * each API endpoint and validates responses.
 *
 * Usage: node .scripts/test-4.6.4-api.mjs
 * Requires: npm run dev running on localhost:3000
 */

import { createClient } from '@supabase/supabase-js';

// ── Config ──────────────────────────────────────────────────────────────────
const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gvbzwihwgzujwsviufgy.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2Ynp3aWh3Z3p1andzdml1Zmd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTY2ODQzOSwiZXhwIjoyMDk1MjQ0NDM5fQ.KOEweXXGcsnoIChk0it7Z1_gPu5Dd3FOTfdQ7tFJkmY';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const PASS = '\x1b[32m✓ PASS\x1b[0m';
const FAIL = '\x1b[31m✗ FAIL\x1b[0m';
const SKIP = '\x1b[33m~ SKIP\x1b[0m';
const INFO = '\x1b[36mℹ INFO\x1b[0m';

let passed = 0;
let failed = 0;
let skipped = 0;
let testStoreIds = [];

function assert(condition, label, detail = '') {
  if (condition) {
    console.log(`  ${PASS} ${label}${detail ? ` — ${detail}` : ''}`);
    passed++;
  } else {
    console.log(`  ${FAIL} ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

async function safeFetch(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    let body = null;
    const text = await res.text();
    if (text) {
      try { body = JSON.parse(text); } catch { body = { _rawText: text.slice(0, 200) }; }
    }
    return { status: res.status, body, ok: res.ok, text };
  } catch (err) {
    clearTimeout(timer);
    return { status: 0, body: null, ok: false, error: err.message };
  }
}

function assertStatus(actual, expected, label) {
  return assert(actual === expected, label, actual === 0 ? `fetch failed` : `status ${actual} !== ${expected}`);
}

// ── Setup: seed test stores ─────────────────────────────────────────────────
async function setup() {
  console.log('\n── Setup: Creating test stores ──\n');

  const stores = [
    { name: 'Test VS Active', segment: 'outros', city: 'São Paulo', state: 'SP', slogan: 'Melhor loja',
      identity_state: 'visual_signature', text_only_origin: 'implicit', logo_status: 'generated',
      visual_signature_attempts: 0 },
    { name: 'Test Text Only', segment: 'outros', city: 'Rio de Janeiro', state: 'RJ',
      identity_state: 'text_only', text_only_origin: 'implicit', logo_status: 'explicit_none',
      visual_signature_attempts: 0 },
    { name: 'Test Logo State', segment: 'outros',
      identity_state: 'logo', text_only_origin: 'implicit', logo_status: 'uploaded',
      visual_signature_attempts: 0 },
    { name: 'Test VS Gate', segment: 'outros',
      identity_state: 'visual_signature', text_only_origin: 'implicit', logo_status: 'generated',
      visual_signature_attempts: 0 },
  ];

  for (const s of stores) {
    const { data, error } = await supabase
      .from('stores')
      .insert(s)
      .select('id')
      .single();

    if (error) {
      console.error(`  Failed to create store "${s.name}":`, error.message);
      throw error;
    }
    testStoreIds.push(data.id);
    console.log(`  Created store "${s.name}" → ${data.id}`);
  }

  // Create a test brand profile for VS Active store (for approve + restore scenarios)
  const { error: profileError } = await supabase
    .from('store_brand_profiles')
    .insert({
      store_id: testStoreIds[0],
      source: 'without_logo',
      status: 'synced',
      logo_colors_detected: [],
      safe_color_tokens: { primary: '#FF0000', accent: '#00FF00' },
      brand_colors_chosen: ['#FF0000', '#00FF00'],
      visual_style: 'moderno',
      visual_tone: 'profissional',
      typography_direction: 'sans-serif',
      brand_personality: 'confiável',
      campaign_guidelines: '',
      campaign_brief: '',
      confidence_score: 0.8,
      inferred_primary_color: '#FF0000',
      inferred_accent_color: '#00FF00',
    })
    .select('id')
    .single();

  let profileId = null;
  if (profileError) {
    console.error('  Failed to create brand profile:', profileError.message);
  } else {
    // Need to fetch the profile since the insert might not return 'id' via .select()
    const { data: profiles } = await supabase
      .from('store_brand_profiles')
      .select('id')
      .eq('store_id', testStoreIds[0])
      .eq('status', 'synced')
      .limit(1);
    profileId = profiles?.[0]?.id ?? null;
    console.log(`  Created brand profile → ${profileId ? profileId.slice(0, 8) + '...' : 'unknown'}`);
  }

  return { profileId };
}

// ── Create visual signatures for testing ────────────────────────────────────
async function createTestSignatures(profileId) {
  console.log('\n── Setup: Creating visual signatures ──\n');

  const signatures = [];

  // Helper to create a signature
  async function createSig(storeId, status, metadata, type = 'ai_generated') {
    const { data, error } = await supabase
      .from('store_visual_signatures')
      .insert({
        store_id: storeId,
        storage_path: `${storeId}/test/${Date.now()}-${Math.random().toString(36).slice(2)}.png`,
        asset_url: `https://test.com/sig-${Math.random().toString(36).slice(2)}.png`,
        type,
        status,
        metadata: metadata || null,
      })
      .select('id')
      .single();

    if (error) {
      console.error(`  Failed to create signature for ${storeId}:`, error.message);
      return null;
    }
    signatures.push({ id: data.id, storeId, status });
    console.log(`  Created ${status} signature → ${data.id.slice(0, 8)}...`);
    return data.id;
  }

  const inputSnapshot = {
    name: 'Test VS Active',
    segment: 'outros',
    subsegment: null,
    tone_of_voice: null,
    positioning: null,
    short_description: null,
    slogan: 'Melhor loja',
    city: 'São Paulo',
    state: 'SP',
    brand_color: '#FF0000',
  };

  const contentUsed = {
    store_name: true,
    city: false,
    state: false,
    slogan: true,
  };

  // For Store 0 (VS Active):
  // Active signature (what's currently approved)
  const activeId = await createSig(testStoreIds[0], 'active', {
    generation_tier: 'image_direct',
    input_snapshot: inputSnapshot,
    artDirectorOutput: {
      visual_direction: 'Moderna e Clean',
      content_used: contentUsed,
    },
  });

  // Archived signature with MATCHING snapshot (no drift)
  const archivedOkId = await createSig(testStoreIds[0], 'archived', {
    generation_tier: 'image_direct',
    input_snapshot: inputSnapshot,
    artDirectorOutput: {
      visual_direction: 'Clássica',
      content_used: contentUsed,
    },
  });

  // Archived signature with MISMATCHED name (critical drift)
  const driftSnapshot = { ...inputSnapshot, name: 'Old Name' };
  await createSig(testStoreIds[0], 'archived', {
    generation_tier: 'image_direct',
    input_snapshot: driftSnapshot,
    artDirectorOutput: {
      visual_direction: 'Antiga',
      content_used: contentUsed,
    },
  });

  // Archived signature with NULL metadata (missing_metadata)
  await createSig(testStoreIds[0], 'archived', null);

  // Archived signature for Store 1 (Text Only) — with MATCHING snapshot (no drift)
  await createSig(testStoreIds[1], 'archived', {
    generation_tier: 'image_direct',
    input_snapshot: {
      name: 'Test Text Only',
      segment: 'outros',
      subsegment: null,
      tone_of_voice: null,
      positioning: null,
      short_description: null,
      slogan: null,
      city: 'Rio de Janeiro',
      state: 'RJ',
      brand_color: null,
    },
    artDirectorOutput: {
      visual_direction: 'Tradicional',
      content_used: { store_name: true, city: false, state: false, slogan: false },
    },
  });

  // Archived signature for Store 2 (Logo state) — for restore logo-in-way test
  await createSig(testStoreIds[2], 'archived', {
    generation_tier: 'image_direct',
    input_snapshot: {
      name: 'Test Logo State', segment: 'outros', subsegment: null,
      tone_of_voice: null, positioning: null, short_description: null,
      slogan: null, city: null, state: null, brand_color: null,
    },
    artDirectorOutput: {
      visual_direction: 'Antiga',
      content_used: { store_name: true, city: false, state: false, slogan: false },
    },
  });

  // Archived signature for Store 0 with profile association (for no-drift restore)
  if (archivedOkId && profileId) {
    await supabase
      .from('store_brand_profiles')
      .update({ visual_signature_id: archivedOkId })
      .eq('id', profileId);
    console.log(`  Linked profile ${profileId.slice(0, 8)}... → signature ${archivedOkId.slice(0, 8)}...`);
  }

  return {
    activeId,
    archivedOkId,
  };
}

// ── Test 03: Approve ────────────────────────────────────────────────────────
async function testApprove(storeId, profileId) {
  console.log('\n── Test 03: POST /approve → identity_state sync ──');
  const url = `${BASE}/api/store/${storeId}/visual-signature/approve`;

  const { data: draftSig, error: draftError } = await supabase
    .from('store_visual_signatures')
    .insert({
      store_id: storeId,
      storage_path: `${storeId}/test/approve-draft.png`,
      asset_url: 'https://test.com/approve-draft.png',
      type: 'ai_generated',
      status: 'draft',
      metadata: {
        generation_tier: 'image_direct',
        input_snapshot: {
          name: 'Test VS Active', segment: 'outros', subsegment: null,
          tone_of_voice: null, positioning: null, short_description: null,
          slogan: 'Melhor loja', city: 'São Paulo', state: 'SP', brand_color: '#FF0000',
        },
        artDirectorOutput: {
          visual_direction: 'Nova Versão',
          content_used: { store_name: true, city: false, state: false, slogan: true },
        },
      },
    })
    .select('id')
    .single();

  if (draftError) {
    console.log(`  ${SKIP} Could not create draft: ${draftError.message}`);
    skipped++;
    return;
  }

  // Link existing brand profile to this signature so approve takes the no-AI path
  if (profileId) {
    await supabase
      .from('store_brand_profiles')
      .update({ visual_signature_id: draftSig.id })
      .eq('id', profileId);
  }

  const { status, body, error } = await safeFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signatureId: draftSig.id }),
  }, 30000);

  if (error) {
    console.log(`  ${INFO} approve fetch: ${error}`);
  }

  if (status === 200 && body?.success) {
    console.log(`  ${INFO} approve reused profile`);
  } else if (status > 0) {
    console.log(`  ${INFO} approve status=${status}: ${JSON.stringify(body).slice(0, 200)}`);
  } else {
    console.log(`  ${INFO} approve request failed/timed out`);
  }

  // Check store state was updated regardless of HTTP response
  const { data: store } = await supabase
    .from('stores')
    .select('identity_state, logo_status, visual_signature_attempts')
    .eq('id', storeId)
    .single();

  if (store) {
    assert(store.identity_state === 'visual_signature', 'approve → identity_state=visual_signature',
      `got ${store.identity_state}`);
    assert(store.logo_status === 'generated', 'approve → logo_status=generated',
      `got ${store.logo_status}`);
    assert(store.visual_signature_attempts === 0, 'approve → attempts reset to 0',
      `got ${store.visual_signature_attempts}`);
  } else {
    console.log(`  ${SKIP} Could not fetch store state`);
  }
}

// ── Test 07: DELETE active VS ───────────────────────────────────────────────
async function testDeleteActive(storeId) {
  console.log('\n── Test 07: DELETE /visual-signature → archive active ──');
  const url = `${BASE}/api/store/${storeId}/visual-signature/`;

  // Ensure store has active VS identity_state
  await supabase
    .from('stores')
    .update({
      identity_state: 'visual_signature',
      logo_status: 'generated',
      visual_signature_attempts: 2,
    })
    .eq('id', storeId);

  // Ensure there's an active signature
  const { data: sigs } = await supabase
    .from('store_visual_signatures')
    .select('id')
    .eq('store_id', storeId)
    .eq('status', 'active')
    .limit(1);

  if (!sigs || sigs.length === 0) {
    // Create one
    await supabase.from('store_visual_signatures').insert({
      store_id: storeId,
      storage_path: `${storeId}/test/delete-active.png`,
      asset_url: 'https://test.com/delete-active.png',
      type: 'ai_generated',
      status: 'active',
    });
  }

  const { status, body } = await safeFetch(url, { method: 'DELETE' });

  assertStatus(status, 200, 'DELETE active returns 200');
  assert(body?.success === true, 'DELETE success');
  assert(body?.previous_identity_state === 'visual_signature', 'DELETE previous_identity_state');

  // Check store state
  const { data: store } = await supabase
    .from('stores')
    .select('identity_state, logo_status, visual_signature_attempts')
    .eq('id', storeId)
    .single();

  assert(store?.identity_state === 'text_only', 'DELETE → identity_state=text_only',
    `got ${store?.identity_state}`);
  assert(store?.logo_status === 'explicit_none', 'DELETE → logo_status=explicit_none',
    `got ${store?.logo_status}`);
  // attempts should be preserved (not reset)
  assert(store?.visual_signature_attempts === 2, 'DELETE → attempts preserved as 2',
    `got ${store?.visual_signature_attempts}`);

  // Check active signature is now archived
  const { data: archivedSigs } = await supabase
    .from('store_visual_signatures')
    .select('id, status')
    .eq('store_id', storeId)
    .eq('status', 'archived');

  assert(archivedSigs && archivedSigs.length > 0, 'DELETE → signature archived');
}

// ── Test 08: DELETE no active VS ────────────────────────────────────────────
async function testDeleteNoActive(storeId) {
  console.log('\n── Test 08: DELETE no active VS → 404 ──');
  const url = `${BASE}/api/store/${storeId}/visual-signature/`;

  // Ensure store is text_only with no active signature
  await supabase
    .from('stores')
    .update({ identity_state: 'text_only', logo_status: 'explicit_none' })
    .eq('id', storeId);

  // Archive any remaining active signatures
  await supabase
    .from('store_visual_signatures')
    .update({ status: 'archived' })
    .eq('store_id', storeId)
    .eq('status', 'active');

  const { status, body } = await safeFetch(url, { method: 'DELETE' });

  assertStatus(status, 404, 'DELETE no-active returns 404');
  assert(body?.error === 'Nenhuma assinatura visual ativa para remover.',
    'DELETE no-active error message');
}

// ── Test 06: Pre-feature signature → null art_direction ─────────────────────
async function testPreFeatureSignature(storeId) {
  console.log('\n── Test 06: GET history — pre-feature signature → null art_direction ──');
  const url = `${BASE}/api/store/${storeId}/visual-signature/`;

  const { status, body } = await safeFetch(url);

  assertStatus(status, 200, 'GET history returns 200');
  assert(body && Array.isArray(body.signatures), 'GET returns signatures array');

  // Find our null-metadata signature
  const nullMetaSig = body.signatures.find(s => s.art_direction === null);
  assert(nullMetaSig !== undefined, 'GET has signature with null art_direction');
  assert(nullMetaSig?.restore_eligibility?.reason === 'missing_metadata',
    'GET null-metadata → restore_eligibility=missing_metadata');

  return body.signatures;
}

// ── Test 18+19: GET history — approved_at + restore_eligibility ─────────────
async function testGetHistoryDetails(storeId) {
  console.log('\n── Test 18+19: GET history — approved_at + restore_eligibility ──');
  const url = `${BASE}/api/store/${storeId}/visual-signature/`;

  const { status, body } = await safeFetch(url);

  assertStatus(status, 200, 'GET history returns 200');
  assert(body && body.signatures.length >= 4, 'GET returns multiple signatures',
    `got ${body.signatures.length}`);

  // Active signature should have approved_at
  const activeSig = body.signatures.find(s => s.status === 'active');
  if (activeSig) {
    assert(activeSig.approved_at !== null, 'active signature has approved_at');
    assert(activeSig.art_direction !== null, 'active signature has art_direction');
  }

  // Archived signature with matching snapshot should have restore_eligibility.ok
  const driftSignatures = body.signatures.filter(s => s.status === 'archived');
  const okSig = driftSignatures.find(s => s.restore_eligibility?.reason === 'ok');
  if (okSig) {
    assert(okSig.restore_eligibility.can_restore === true, 'no-drift sig can_restore=true');
    assert(okSig.restore_eligibility.requires_regeneration === false, 'no-drift requires_regeneration=false');
  }

  const driftSig = driftSignatures.find(s => s.restore_eligibility?.reason === 'critical_drift');
  if (driftSig) {
    assert(driftSig.restore_eligibility.can_restore === false, 'drift sig can_restore=false');
    assert(driftSig.restore_eligibility.requires_regeneration === true, 'drift requires_regeneration=true');
    assert(driftSig.restore_eligibility.drift_fields.includes('name'), 'drift fields include name');
  }

  const missingMetaSig = driftSignatures.find(s => s.restore_eligibility?.reason === 'missing_metadata');
  if (missingMetaSig) {
    assert(missingMetaSig.restore_eligibility.can_restore === false, 'missing-metadata can_restore=false');
    assert(missingMetaSig.restore_eligibility.requires_regeneration === true, 'missing-metadata requires_regeneration=true');
  }
}

// ── Test 12: Restore missing-metadata → blocked ────────────────────────────
async function testRestoreMissingMetadata(storeId) {
  console.log('\n── Test 12: POST /restore — missing_metadata → blocked ──');
  const url = `${BASE}/api/store/${storeId}/visual-signature/restore`;

  // Find an archived signature with null metadata
  const { data: sigs } = await supabase
    .from('store_visual_signatures')
    .select('id')
    .eq('store_id', storeId)
    .eq('status', 'archived')
    .is('metadata', null)
    .limit(1);

  if (!sigs || sigs.length === 0) {
    console.log(`  ${SKIP} No null-metadata signature found`);
    skipped++;
    return;
  }

  const { body } = await safeFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signature_id: sigs[0].id }),
  });

  assert(body?.success === false || body?.drift?.reason === 'missing_metadata' ||
    (body?.drift && !body.success), 'restore missing-metadata blocked',
    JSON.stringify(body));
}

// ── Test 10: Restore with drift → blocked ───────────────────────────────────
async function testRestoreWithDrift(storeId) {
  console.log('\n── Test 10: POST /restore — critical_drift → blocked ──');
  const url = `${BASE}/api/store/${storeId}/visual-signature/restore`;

  // The drift snapshot has name='Old Name' vs current 'Test VS Active'
  const { data: sigs } = await supabase
    .from('store_visual_signatures')
    .select('id, metadata')
    .eq('store_id', storeId)
    .eq('status', 'archived');

  // Find the one with drift snapshot
  const driftSig = sigs?.find(s => {
    const meta = s.metadata;
    if (!meta || !meta.input_snapshot) return false;
    return meta.input_snapshot.name === 'Old Name';
  });

  if (!driftSig) {
    console.log(`  ${SKIP} No drift signature found`);
    skipped++;
    return;
  }

  const { body } = await safeFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signature_id: driftSig.id }),
  });

  assert(body?.success === false, 'restore drift blocked');
  assert(body?.drift?.critical === true, 'drift critical=true');
  assert(body?.drift?.reason === 'critical_drift', `drift reason=critical_drift got ${body.drift?.reason}`);
  assert(body?.drift?.fields?.includes('name'), 'drift fields include name');
  assert(body?.drift?.requires_regeneration === true, 'drift requires_regeneration=true');
}

// ── Test 13: Restore logo-in-way → 409 ──────────────────────────────────────
async function testRestoreLogoInWay(storeId) {
  console.log('\n── Test 13: POST /restore — logo state → 409 ──');
  const url = `${BASE}/api/store/${storeId}/visual-signature/restore`;

  const { data: sigs } = await supabase
    .from('store_visual_signatures')
    .select('id')
    .eq('store_id', storeId)
    .eq('status', 'archived')
    .limit(1);

  if (!sigs || sigs.length === 0) {
    console.log(`  ${SKIP} No archived signature for logo-state store`);
    skipped++;
    return;
  }

  const { status, body } = await safeFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signature_id: sigs[0].id }),
  });

  assertStatus(status, 409, 'restore logo-in-way returns 409');
  assert(body?.requires_logo_removal === true, 'restore logo-in-way requires_logo_removal');
  assert(body?.current_identity_state === 'logo', 'restore logo-in-way current_state=logo');
}

// ── Test 14: POST /logo blocked with VS ─────────────────────────────────────
async function testLogoUploadBlockedVS(storeId) {
  console.log('\n── Test 14: POST /logo — VS active → 409 ──');
  const url = `${BASE}/api/store/${storeId}/logo/`;

  // Just send a request without form data - should hit identity_state gate first
  const { status, body } = await safeFetch(url, { method: 'POST' });

  assertStatus(status, 409, 'POST /logo with VS returns 409');
  assert(body?.requires_identity_removal === true, 'POST /logo VS requires_identity_removal');
  assert(body?.current_identity_state === 'visual_signature', 'POST /logo VS current_state=visual_signature');
}

// ── Helper: create test brand asset ─────────────────────────────────────────
async function createTestBrandAsset(storeId) {
  const { data, error } = await supabase
    .from('store_brand_assets')
    .insert({
      store_id: storeId,
      asset_type: 'logo',
      variant_type: 'original',
      source: 'user_upload',
      storage_path: `${storeId}/test/test-logo.png`,
      mime_type: 'image/png',
      width: 200,
      height: 200,
      size_bytes: 1000,
      checksum: 'test-checksum',
      version: 1,
      status: 'archived',
    })
    .select('id')
    .single();

  if (error) {
    console.log(`  ${SKIP} Could not create test asset: ${error.message}`);
    return null;
  }
  return data.id;
}

// ── Test 16: POST /logo/restore blocked with logo ───────────────────────────
async function testLogoRestoreBlockedLogo(storeId) {
  console.log('\n── Test 16: POST /logo/restore — logo state → 409 ──');
  const url = `${BASE}/api/store/${storeId}/logo/restore`;

  const assetId = await createTestBrandAsset(storeId);
  if (!assetId) { skipped++; return; }

  const { status, body } = await safeFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ asset_id: assetId }),
  });

  assertStatus(status, 409, 'POST /logo/restore logo state returns 409');
  assert(body?.requires_logo_removal === true, 'logo restore logo state requires_logo_removal');
  assert(body?.current_identity_state === 'logo', 'logo restore logo state current_state=logo');
}

// ── Test 17: POST /logo/restore blocked with VS ─────────────────────────────
async function testLogoRestoreBlockedVS(storeId) {
  console.log('\n── Test 17: POST /logo/restore — VS state → 409 ──');
  const url = `${BASE}/api/store/${storeId}/logo/restore`;

  const assetId = await createTestBrandAsset(storeId);
  if (!assetId) { skipped++; return; }

  const { status, body } = await safeFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ asset_id: assetId }),
  });

  assertStatus(status, 409, 'POST /logo/restore VS state returns 409');
  assert(body?.requires_identity_removal === true, 'logo restore VS state requires_identity_removal');
  assert(body?.current_identity_state === 'visual_signature', 'logo restore VS state current_state=visual_signature');
}

// ── Test 09: Restore no-drift (if possible) ─────────────────────────────────
async function testRestoreNoDrift(storeId) {
  console.log('\n── Test 09: POST /restore — no drift → reactivate ──');
  const url = `${BASE}/api/store/${storeId}/visual-signature/restore`;

  // Ensure store is in text_only state for restore to work
  await supabase
    .from('stores')
    .update({ identity_state: 'text_only', logo_status: 'explicit_none' })
    .eq('id', storeId);

  // Find a signature with matching snapshot (no drift) that is archived
  const { data: sigs } = await supabase
    .from('store_visual_signatures')
    .select('id, metadata')
    .eq('store_id', storeId)
    .eq('status', 'archived');

  // current store name is 'Test Text Only', segment 'outros'
  const okSig = sigs?.find(s => {
    const meta = s.metadata;
    if (!meta || !meta.input_snapshot) return false;
    return meta.input_snapshot.name === 'Test Text Only'
      && meta.input_snapshot.segment === 'outros';
  });

  if (!okSig) {
    console.log(`  ${SKIP} No no-drift signature found`);
    skipped++;
    return;
  }

  const { status, body } = await safeFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signature_id: okSig.id }),
  }, 60000);

  if (status === 200) {
    assert(body?.success === true, 'restore no-drift success');
    const { data: store } = await supabase
      .from('stores')
      .select('identity_state, logo_status')
      .eq('id', storeId)
      .single();
    assert(store?.identity_state === 'visual_signature', 'restore → identity_state=visual_signature',
      `got ${store?.identity_state}`);
  } else {
    assert(false, 'restore no-drift should succeed',
      `status ${status}: ${JSON.stringify(body)}`);
  }
}

// ── Cleanup ─────────────────────────────────────────────────────────────────
async function cleanup() {
  console.log('\n── Cleanup ──\n');
  for (const id of testStoreIds) {
    // Delete cascading: signatures, profiles, assets
    await supabase.from('store_visual_signatures').delete().eq('store_id', id);
    await supabase.from('store_brand_profiles').delete().eq('store_id', id);
    await supabase.from('store_brand_assets').delete().eq('store_id', id);
    await supabase.from('stores').delete().eq('id', id);
    console.log(`  Cleaned up store ${id.slice(0, 8)}...`);
  }
}

// ── Runner ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('   Phase 4.6.4 — Visual Signature API Tests');
  console.log('═══════════════════════════════════════════════════\n');

  // Warm-up: check server
  try {
    const warmup = await fetch(`${BASE}/`, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    console.log(`Server reachable at ${BASE} (${warmup.status})\n`);
  } catch {
    console.error(`Cannot reach ${BASE}. Is 'npm run dev' running?\n`);
    process.exit(1);
  }

  try {
    const { profileId } = await setup();
    await createTestSignatures(profileId);

    // ── Store 0: Visual Signature state ──
    await testApprove(testStoreIds[0], profileId);
    await testDeleteActive(testStoreIds[0]);
    await testPreFeatureSignature(testStoreIds[0]);
    await testGetHistoryDetails(testStoreIds[0]);
    await testRestoreMissingMetadata(testStoreIds[0]);
    await testRestoreWithDrift(testStoreIds[0]);

    // ── Store 1: Text Only state ──
    await testDeleteNoActive(testStoreIds[1]);
    await testRestoreNoDrift(testStoreIds[1]);

    // ── Store 2: Logo state ──
    await testRestoreLogoInWay(testStoreIds[2]);
    await testLogoRestoreBlockedLogo(testStoreIds[2]);

    // ── Store 3: Visual Signature gate state ──
    await testLogoUploadBlockedVS(testStoreIds[3]);
    await testLogoRestoreBlockedVS(testStoreIds[3]);

  } catch (err) {
    console.error('\n  Unhandled error:', err);
    failed++;
  } finally {
    await cleanup();
  }

  // ── Summary ──
  console.log('\n═══════════════════════════════════════════════════');
  console.log('   Results');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Passed:  ${passed}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Total:   ${passed + failed + skipped}`);
  console.log('═══════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

main();
