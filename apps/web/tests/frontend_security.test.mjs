import test from 'node:test';
import assert from 'node:assert';

// Mock browser environment for Node.js
const mockStorage = {};
globalThis.window = {};
globalThis.localStorage = {
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, val) => { mockStorage[key] = String(val); },
  removeItem: (key) => { delete mockStorage[key]; },
  clear: () => { for (const k in mockStorage) delete mockStorage[k]; }
};

test('Frontend Security: Guest-session creation failure prevents unauthenticated requests', async () => {
  localStorage.clear();

  // Mock global fetch to simulate network failure or 500 on guest-session creation
  globalThis.fetch = async (url) => {
    if (url.includes('/api/v1/account/guest-session')) {
      return {
        ok: false,
        status: 503,
        json: async () => ({ detail: 'Service temporarily unavailable' })
      };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };

  const { getSessionAuthToken, getRequiredAuthHeaders } = await import('../lib/api.ts');

  // Must throw error rather than returning empty string or headers without Authorization
  await assert.rejects(
    async () => {
      await getSessionAuthToken();
    },
    /Service temporarily unavailable|Failed to establish secure guest session|Unable to establish a secure guest session/
  );

  await assert.rejects(
    async () => {
      await getRequiredAuthHeaders();
    },
    /Service temporarily unavailable|Failed to establish secure guest session|Unable to establish a secure guest session/
  );

});

test('Frontend Security: Protected calls attach valid Authorization headers', async () => {
  localStorage.clear();
  localStorage.setItem('palmora_guest_session_token', 'gst.guest_123.1893456000.testsig');

  const { getRequiredAuthHeaders } = await import('../lib/api.ts');
  const headers = await getRequiredAuthHeaders({ 'Custom-Header': 'test-val' });

  assert.strictEqual(headers['Authorization'], 'Bearer gst.guest_123.1893456000.testsig');
  assert.strictEqual(headers['Custom-Header'], 'test-val');
});

test('Frontend Security: clearClientSessionToken purges localStorage credentials', async () => {
  localStorage.setItem('palmora_guest_session_token', 'gst.test');
  localStorage.setItem('palmora_auth_token', 'usr.test');
  localStorage.setItem('palmora_session_id', 'sess.test');

  const { clearClientSessionToken } = await import('../lib/api.ts');
  clearClientSessionToken();

  assert.strictEqual(localStorage.getItem('palmora_guest_session_token'), null);
  assert.strictEqual(localStorage.getItem('palmora_auth_token'), null);
  assert.strictEqual(localStorage.getItem('palmora_session_id'), null);
});
