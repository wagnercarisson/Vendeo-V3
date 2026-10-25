// Offline regression: the correction changes only the four unsafe DELETEs.
// This is a source comparison, not a database execution proof.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const directory = path.join(root, 'supabase/migrations');
const files = readdirSync(directory).filter((name) => name.endsWith('.sql'));
const candidates = files.filter((name) => name.endsWith('_fix_visual_signature_pilot_cleanup_where.sql'));
assert.equal(candidates.length, 1, 'Exactly one correction migration');
assert.equal(new Set(files.map((name) => name.split('_')[0])).size, files.length, 'Unique versions');
const read = (name) => readFileSync(path.join(directory, name), 'utf8').replaceAll('\r', '');
const correction = read(candidates[0]);
const f2 = read('20261024141452_f47_2_visual_signature_release_state.sql');
const f3 = read('20261025171102_f47_3_visual_signature_model_quality_split.sql');
const unsafe = 'DELETE FROM public.visual_signature_model_config_pilot_stores;';
const safe = 'DELETE FROM public.visual_signature_model_config_pilot_stores\n  WHERE store_id IS NOT NULL;';

function definition(source, name) {
  const start = source.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  assert.notEqual(start, -1, `Missing function ${name}`);
  const end = source.indexOf('\n$$;', start);
  assert.notEqual(end, -1, `Missing function end ${name}`);
  return source.slice(start, end + 4);
}

const targets = [
  [f3, 'admin_set_visual_signature_model_config_v3', 1],
  [f2, 'admin_activate_visual_signature_model_config', 2],
  [f2, 'admin_reset_visual_signature_model_config', 1],
];

function verify(source) {
  assert.equal((source.match(/CREATE OR REPLACE FUNCTION /g) ?? []).length, 3);
  assert.equal(source.includes(unsafe), false, 'No unfiltered pilot cleanup');
  assert.equal(source.split(safe).length - 1, 4, 'All four cleanups corrected');
  for (const [original, name, count] of targets) {
    const before = definition(original, name);
    assert.equal(before.split(unsafe).length - 1, count);
    assert.equal(definition(source, name), before.replaceAll(unsafe, safe), `${name}: no unrelated changes`);
  }
  assert.equal(/\b(?:ALTER\s+TABLE|DROP\s+FUNCTION|GRANT|REVOKE|TRUNCATE|SET\s+(?:LOCAL\s+)?safeupdate)\b/i.test(source), false);
}

verify(correction);
// A missing WHERE or an unrelated behavior change must fail verification.
assert.throws(() => verify(correction.replace(safe, unsafe)));
assert.throws(() => verify(correction.replace('RETURN v_result;', 'RETURN NULL;')));
console.log('PASS: three RPCs, four filtered cleanups, exact source preservation and two negative regressions.');
