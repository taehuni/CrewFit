import assert from 'node:assert/strict';
import test from 'node:test';
import { requiredEnv } from '../env.js';

test('missing and blank required settings fail with the variable name', () => {
  for (const value of [undefined, '', '   ']) {
    assert.throws(() => requiredEnv('SUPABASE_ANON_KEY', { SUPABASE_ANON_KEY: value }), /SUPABASE_ANON_KEY/);
  }
});

test('placeholder settings fail without disclosing their values', () => {
  for (const value of ['placeholder', 'https://YOUR-PROJECT.supabase.co', 'YOUR_ANON_KEY']) {
    assert.throws(() => requiredEnv('TEST_CONFIG', { TEST_CONFIG: value }), error => {
      assert.ok(error.message.includes('TEST_CONFIG'));
      assert.ok(!error.message.includes(value));
      return true;
    });
  }
});

test('configured values are returned trimmed', () => {
  assert.equal(requiredEnv('TEST_CONFIG', { TEST_CONFIG: '  configured-value  ' }), 'configured-value');
});
