import test from 'node:test';
import assert from 'node:assert';

// Setup mock browser environment for Node.js
const mockSessionStorage = {};
const mockLocalStorage = {};
const revokedUrls = [];
let createObjectURLCallCount = 0;

globalThis.window = {};
globalThis.sessionStorage = {
  getItem: (key) => mockSessionStorage[key] || null,
  setItem: (key, val) => {
    if (typeof val === 'string' && val.startsWith('data:image/huge')) {
      const err = new Error('Quota exceeded');
      err.name = 'QuotaExceededError';
      err.code = 22;
      throw err;
    }
    mockSessionStorage[key] = String(val);
  },
  removeItem: (key) => { delete mockSessionStorage[key]; },
  clear: () => { for (const k in mockSessionStorage) delete mockSessionStorage[k]; }
};

globalThis.localStorage = {
  getItem: (key) => mockLocalStorage[key] || null,
  setItem: (key, val) => { mockLocalStorage[key] = String(val); },
  removeItem: (key) => { delete mockLocalStorage[key]; },
  clear: () => { for (const k in mockLocalStorage) delete mockLocalStorage[k]; }
};

globalThis.URL.createObjectURL = (blob) => {
  createObjectURLCallCount++;
  return `blob:http://localhost:3000/mock-uuid-${createObjectURLCallCount}`;
};

globalThis.URL.revokeObjectURL = (url) => {
  revokedUrls.push(url);
};

// Polyfill minimal File / Blob if not already defined in Node environment
if (typeof globalThis.Blob === 'undefined') {
  globalThis.Blob = class Blob {};
}
if (typeof globalThis.File === 'undefined') {
  globalThis.File = class File extends globalThis.Blob {
    constructor(chunks, filename, opts) {
      super(chunks, opts);
      this.name = filename;
    }
  };
}

test('Storage: saveCurrentImagePreview creates object URL for File/Blob and keeps storage < 200 chars', async () => {
  sessionStorage.clear();
  revokedUrls.length = 0;

  const { saveCurrentImagePreview, getCurrentImagePreview } = await import('../lib/storage.ts');

  const file = new File(['mock content'], 'test_palm.jpg', { type: 'image/jpeg' });
  saveCurrentImagePreview(file);

  const savedUrl = getCurrentImagePreview();
  assert.ok(savedUrl, 'Expected preview URL to be saved');
  assert.ok(savedUrl.startsWith('blob:'), 'Expected blob URL');
  assert.ok(savedUrl.length < 200, 'Blob URL string must be compact (< 200 chars)');
});

test('Storage: revokeCurrentImagePreview revokes blob URL and cleans up sessionStorage', async () => {
  sessionStorage.clear();
  revokedUrls.length = 0;

  const { saveCurrentImagePreview, revokeCurrentImagePreview, getCurrentImagePreview } = await import('../lib/storage.ts');

  const file = new File(['mock content'], 'test_palm.jpg', { type: 'image/jpeg' });
  saveCurrentImagePreview(file);
  const activeUrl = getCurrentImagePreview();

  revokeCurrentImagePreview();

  assert.strictEqual(getCurrentImagePreview(), null);
  assert.ok(revokedUrls.includes(activeUrl), 'Active URL must have been passed to URL.revokeObjectURL');
});

test('Storage: saveCurrentImagePreview(null) revokes previous blob URL and cleans up', async () => {
  sessionStorage.clear();
  revokedUrls.length = 0;

  const { saveCurrentImagePreview, getCurrentImagePreview } = await import('../lib/storage.ts');

  const file = new File(['mock content'], 'test_palm.jpg', { type: 'image/jpeg' });
  saveCurrentImagePreview(file);
  const activeUrl = getCurrentImagePreview();

  saveCurrentImagePreview(null);

  assert.strictEqual(getCurrentImagePreview(), null);
  assert.ok(revokedUrls.includes(activeUrl), 'Previous blob URL must be revoked when null is passed');
});

test('Storage: saveCurrentImagePreview with string handles QuotaExceededError gracefully without throwing', async () => {
  sessionStorage.clear();

  const { saveCurrentImagePreview } = await import('../lib/storage.ts');

  let warned = false;
  const originalWarn = console.warn;
  console.warn = (...args) => {
    warned = true;
  };

  try {
    // Attempt to store huge data URL that triggers QuotaExceededError in mock
    saveCurrentImagePreview('data:image/huge_base64_data_that_exceeds_session_storage_quota');
    assert.strictEqual(warned, true, 'Expected warning to be logged when QuotaExceededError occurs');
  } finally {
    console.warn = originalWarn;
  }
});

test('Storage: Dual-hand reading storage CRUD operates correctly', async () => {
  localStorage.clear();

  const {
    saveLocalDualReading,
    getLocalDualReadings,
    getLocalDualReadingById,
    deleteLocalDualReading,
  } = await import('../lib/storage.ts');

  const mockDualReport = {
    id: 'dual_test_123',
    reading_title: 'Sovereign Path vs Inborn Blueprint',
    created_at: new Date().toISOString(),
    dominant_hand: 'right',
    non_dominant_hand: 'left',
    growth_index: 87.5,
    overall_evolution_synthesis: 'High manifestation alignment',
    comparative_sections: [
      {
        line_name: 'Heart Line Evolution',
        innate_summary: 'Receptive and empathetic',
        manifested_summary: 'Emotionally resilient and deliberate',
        divergence_type: 'aligned',
        evolution_narrative: 'A maturation into steady commitment.',
        growth_recommendation: 'Practice vulnerable authenticity.',
      },
    ],
    disclaimer: 'For contemplative self-reflection only.',
  };

  saveLocalDualReading(mockDualReport);

  const all = getLocalDualReadings();
  assert.strictEqual(all.length, 1);
  assert.strictEqual(all[0].id, 'dual_test_123');

  const fetched = getLocalDualReadingById('dual_test_123');
  assert.ok(fetched);
  assert.strictEqual(fetched.reading_title, 'Sovereign Path vs Inborn Blueprint');

  deleteLocalDualReading('dual_test_123');
  assert.strictEqual(getLocalDualReadings().length, 0);
  assert.strictEqual(getLocalDualReadingById('dual_test_123'), null);
});

test('Storage: UserEntitlements and feature gating work accurately across free, deep dive, dual-hand, and membership', async () => {
  localStorage.clear();

  const {
    getUserEntitlements,
    saveUserEntitlement,
    hasPurchasedProduct,
    isFeatureUnlocked,
    getConsultationQuota,
    clearAllLocalUserData,
  } = await import('../lib/storage.ts');

  // 1. Initial State: Free
  const initial = getUserEntitlements();
  assert.strictEqual(initial.tier, 'free');
  assert.strictEqual(initial.purchasedProducts.length, 0);
  assert.strictEqual(isFeatureUnlocked('deep_dive_metrics'), false);
  assert.strictEqual(isFeatureUnlocked('high_res_pdf'), false);
  assert.strictEqual(isFeatureUnlocked('dual_hand_synthesis'), false);
  assert.strictEqual(isFeatureUnlocked('unlimited_consultations'), false);
  assert.strictEqual(getConsultationQuota().max, 1);
  assert.strictEqual(getConsultationQuota().isUnlimited, false);

  // 2. Purchase Deep-Dive (premium_report)
  saveUserEntitlement('premium_report');
  const afterDeepDive = getUserEntitlements();
  assert.strictEqual(afterDeepDive.tier, 'premium_report');
  assert.strictEqual(hasPurchasedProduct('premium_report'), true);
  assert.strictEqual(isFeatureUnlocked('deep_dive_metrics'), true);
  assert.strictEqual(isFeatureUnlocked('high_res_pdf'), true);
  assert.strictEqual(isFeatureUnlocked('dual_hand_synthesis'), false);
  assert.strictEqual(getConsultationQuota().max, 5);

  // 3. Purchase Dual-Hand Report
  saveUserEntitlement('dual_hand_report');
  const afterDual = getUserEntitlements();
  assert.strictEqual(afterDual.tier, 'dual_hand');
  assert.strictEqual(isFeatureUnlocked('dual_hand_synthesis'), true);
  assert.strictEqual(isFeatureUnlocked('deep_dive_metrics'), true);
  assert.strictEqual(getConsultationQuota().max, 10);

  // 4. Purchase Membership (Seeker Club)
  saveUserEntitlement('membership_monthly');
  const afterMembership = getUserEntitlements();
  assert.strictEqual(afterMembership.tier, 'membership');
  assert.strictEqual(isFeatureUnlocked('deep_dive_metrics'), true);
  assert.strictEqual(isFeatureUnlocked('high_res_pdf'), true);
  assert.strictEqual(isFeatureUnlocked('dual_hand_synthesis'), true);
  assert.strictEqual(isFeatureUnlocked('unlimited_consultations'), true);
  assert.strictEqual(getConsultationQuota().isUnlimited, true);
  assert.strictEqual(getConsultationQuota().remaining, Infinity);

  // 5. Purge via clearAllLocalUserData
  clearAllLocalUserData();
  const afterPurge = getUserEntitlements();
  assert.strictEqual(afterPurge.tier, 'free');
  assert.strictEqual(afterPurge.purchasedProducts.length, 0);
});

test('Storage: Crease journaling CRUD and habit alignment calculation operate accurately', async () => {
  localStorage.clear();
  const {
    saveCreaseJournalEntry,
    getCreaseJournalEntries,
    deleteCreaseJournalEntry,
    calculateHabitAlignment,
    saveLocalSynastryReport,
    getLocalSynastryReports,
  } = await import('../lib/storage.ts');

  // 1. Initial empty journal
  assert.strictEqual(getCreaseJournalEntries().length, 0);
  const emptySummary = calculateHabitAlignment([]);
  assert.strictEqual(emptySummary.total_checkins, 0);
  assert.strictEqual(emptySummary.current_streak_days, 0);

  // 2. Add entries
  const entry1 = saveCreaseJournalEntry({
    date: new Date().toISOString(),
    habits_completed: ['meditation', 'circadian_sleep'],
    stress_rating: 2,
    mindfulness_minutes: 25,
    reflection_text: 'Deep restorative breathwork session.',
  });

  assert.ok(entry1.id.startsWith('cj_'));
  assert.strictEqual(getCreaseJournalEntries().length, 1);

  // 3. Add second entry for yesterday (streak = 2)
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  saveCreaseJournalEntry({
    date: yesterday,
    habits_completed: ['meditation', 'deep_focus'],
    stress_rating: 1,
    mindfulness_minutes: 30,
    reflection_text: 'Morning mindfulness walk.',
  });

  const list = getCreaseJournalEntries();
  assert.strictEqual(list.length, 2);

  const summary = calculateHabitAlignment(list, {
    id: 'drift_test',
    created_at: new Date().toISOString(),
    hand_side: 'right',
    elapsed_months_estimate: 4.0,
    stability_score: 88,
    deepened_lines_count: 2,
    softened_lines_count: 1,
    crease_drifts: [
      { line_name: 'Heart Line', previous_prominence: 0.7, current_prominence: 0.5, delta_prominence: -0.2, trend: 'faded', symbolic_meaning: 'Softened stress' },
      { line_name: 'Head Line', previous_prominence: 0.5, current_prominence: 0.7, delta_prominence: 0.2, trend: 'deepened', symbolic_meaning: 'Deepened focus' },
    ],
    temporal_synthesis: 'Steady expansion',
    mindfulness_reflection: 'Observe your growth',
    disclaimer: 'For reflection only',
  });

  assert.strictEqual(summary.total_checkins, 2);
  assert.strictEqual(summary.current_streak_days, 2);
  assert.strictEqual(summary.most_consistent_habit, 'Daily Meditation & Breathwork');
  assert.strictEqual(summary.correlated_tension_reduction_pct, 50); // 1 softened of 2 lines = 50%
  assert.ok(summary.habit_alignment_score >= 60);

  // 4. Delete entry
  deleteCreaseJournalEntry(entry1.id);
  assert.strictEqual(getCreaseJournalEntries().length, 1);

  // 5. Synastry Report caching
  assert.strictEqual(getLocalSynastryReports().length, 0);
  saveLocalSynastryReport({
    id: 'syn_test_1',
    created_at: new Date().toISOString(),
    person_a_name: 'Elena',
    person_b_name: 'Marcus',
    relationship_type: 'romantic',
    composite_synergy_score: 87.5,
    archetypal_dynamic: 'The Harmonious Flame',
    head_communication: {
      dimension_name: 'Head Line',
      person_a_style: 'Linear',
      person_b_style: 'Curved',
      synergy_score: 85,
      compatibility_tier: 'complementary',
      dynamics_narrative: 'Balance',
      growth_recommendation: 'Listen',
    },
    heart_emotional: {
      dimension_name: 'Heart Line',
      person_a_style: 'Warm',
      person_b_style: 'Steady',
      synergy_score: 90,
      compatibility_tier: 'harmonious',
      dynamics_narrative: 'Warmth',
      growth_recommendation: 'Share',
    },
    life_pacing: {
      dimension_name: 'Life Line',
      person_a_style: 'Expansive',
      person_b_style: 'Grounded',
      synergy_score: 87,
      compatibility_tier: 'complementary',
      dynamics_narrative: 'Pacing',
      growth_recommendation: 'Rest',
    },
    shared_strengths: ['Trust'],
    growth_edges: ['Pacing'],
    collaborative_prompts: ['Check in'],
    disclaimer: 'Reflection only',
  });

  const synList = getLocalSynastryReports();
  assert.strictEqual(synList.length, 1);
  assert.strictEqual(synList[0].id, 'syn_test_1');
});

