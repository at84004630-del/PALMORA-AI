import type {
  PalmReadingReport,
  PalmAnalysisResult,
  PalmConsultationResponse,
  DualHandReadingReport,
  CreaseJournalEntry,
  HabitAlignmentSummary,
  MindfulnessHabit,
  TemporalDriftReport,
  RelationalSynastryReport,
} from '@palmora/shared-types';

const STORAGE_KEYS = {
  READINGS: 'palmora_readings_history',
  DUAL_READINGS: 'palmora_dual_readings',
  CURRENT_ANALYSIS: 'palmora_current_analysis',
  CURRENT_IMAGE: 'palmora_current_image_preview',
  SESSION_ID: 'palmora_session_id',
  PRIVACY_POLICY_ACCEPTED: 'palmora_privacy_consent',
  CONSULTATIONS: 'palmora_consultations',
  ENTITLEMENTS: 'palmora_user_entitlements',
  CREASE_JOURNAL: 'palmora_crease_journal_entries',
  SYNASTRY_REPORTS: 'palmora_synastry_reports',
};

export function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
  if (!id) {
    id = 'sess_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem(STORAGE_KEYS.SESSION_ID, id);
  }
  return id;
}

export function saveLocalReading(report: PalmReadingReport): void {
  if (typeof window === 'undefined') return;
  const current = getLocalReadings();
  const exists = current.some((r) => r.id === report.id);
  const updated = exists
    ? current.map((r) => (r.id === report.id ? report : r))
    : [report, ...current];
  localStorage.setItem(STORAGE_KEYS.READINGS, JSON.stringify(updated));
}

export function getLocalReadings(): PalmReadingReport[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.READINGS);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to parse local readings history:', err);
    return [];
  }
}

export function getLocalReadingById(id: string): PalmReadingReport | null {
  const all = getLocalReadings();
  return all.find((r) => r.id === id) || null;
}

export function deleteLocalReading(id: string): void {
  if (typeof window === 'undefined') return;
  const current = getLocalReadings();
  const filtered = current.filter((r) => r.id !== id);
  localStorage.setItem(STORAGE_KEYS.READINGS, JSON.stringify(filtered));
}

export function saveLocalDualReading(report: DualHandReadingReport): void {
  if (typeof window === 'undefined') return;
  const current = getLocalDualReadings();
  const exists = current.some((r) => r.id === report.id);
  const updated = exists
    ? current.map((r) => (r.id === report.id ? report : r))
    : [report, ...current];
  localStorage.setItem(STORAGE_KEYS.DUAL_READINGS, JSON.stringify(updated));
}

export function getLocalDualReadings(): DualHandReadingReport[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DUAL_READINGS);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to parse local dual readings history:', err);
    return [];
  }
}

export function getLocalDualReadingById(id: string): DualHandReadingReport | null {
  const all = getLocalDualReadings();
  return all.find((r) => r.id === id) || null;
}

export function deleteLocalDualReading(id: string): void {
  if (typeof window === 'undefined') return;
  const current = getLocalDualReadings();
  const filtered = current.filter((r) => r.id !== id);
  localStorage.setItem(STORAGE_KEYS.DUAL_READINGS, JSON.stringify(filtered));
}

let inMemoryAnalysis: PalmAnalysisResult | null = null;
let inMemoryImagePreview: string | null = null;

export function saveCurrentAnalysis(analysis: PalmAnalysisResult | null): void {
  inMemoryAnalysis = analysis;
  if (typeof window === 'undefined') return;
  try {
    if (!analysis) {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_ANALYSIS);
      sessionStorage.removeItem(STORAGE_KEYS.CURRENT_ANALYSIS);
    } else {
      const serialized = JSON.stringify(analysis);
      localStorage.setItem(STORAGE_KEYS.CURRENT_ANALYSIS, serialized);
      sessionStorage.setItem(STORAGE_KEYS.CURRENT_ANALYSIS, serialized);
    }
  } catch (err) {
    console.warn('[storage] Failed to save analysis to storage:', err);
  }
}

export function getCurrentAnalysis(): PalmAnalysisResult | null {
  if (inMemoryAnalysis) return inMemoryAnalysis;
  if (typeof window === 'undefined') return null;
  try {
    const raw =
      localStorage.getItem(STORAGE_KEYS.CURRENT_ANALYSIS) ||
      sessionStorage.getItem(STORAGE_KEYS.CURRENT_ANALYSIS);
    if (raw) {
      inMemoryAnalysis = JSON.parse(raw);
      return inMemoryAnalysis;
    }
    return null;
  } catch (err) {
    return null;
  }
}

export function revokeCurrentImagePreview(): void {
  inMemoryImagePreview = null;
  if (typeof window === 'undefined') return;
  try {
    const existing = sessionStorage.getItem(STORAGE_KEYS.CURRENT_IMAGE);
    if (existing && existing.startsWith('blob:')) {
      URL.revokeObjectURL(existing);
    }
    sessionStorage.removeItem(STORAGE_KEYS.CURRENT_IMAGE);
  } catch {
    // Ignore storage errors
  }
}

export function saveCurrentImagePreview(input: File | Blob | string | null): void {
  if (!input) {
    revokeCurrentImagePreview();
    return;
  }

  // Handle File or Blob
  if (
    (typeof File !== 'undefined' && input instanceof File) ||
    (typeof Blob !== 'undefined' && input instanceof Blob)
  ) {
    try {
      const blobUrl = URL.createObjectURL(input);
      inMemoryImagePreview = blobUrl;
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(STORAGE_KEYS.CURRENT_IMAGE, blobUrl);

        // Asynchronously compress to lightweight data URL for persistence across hard page reloads
        if (typeof FileReader !== 'undefined') {
          const reader = new FileReader();
          reader.onload = () => {
            const rawDataUrl = reader.result as string;
            const img = new Image();
            img.onload = () => {
              const maxDim = 800;
              let w = img.width;
              let h = img.height;
              if (w > maxDim || h > maxDim) {
                if (w > h) {
                  h = Math.round((h * maxDim) / w);
                  w = maxDim;
                } else {
                  w = Math.round((w * maxDim) / h);
                  h = maxDim;
                }
              }
              const canvas = document.createElement('canvas');
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0, w, h);
                try {
                  const compactDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                  sessionStorage.setItem(STORAGE_KEYS.CURRENT_IMAGE, compactDataUrl);
                } catch {
                  // Storage quota fallback
                }
              }
            };
            img.src = rawDataUrl;
          };
          reader.readAsDataURL(input);
        }
      }
    } catch (e) {
      console.warn('[storage] Failed to create or cache object URL for image preview:', e);
    }
    return;
  }

  // Handle string (e.g. data URL, backward compatibility)
  if (typeof input === 'string') {
    inMemoryImagePreview = input;
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(STORAGE_KEYS.CURRENT_IMAGE, input);
      } catch (e: any) {
        console.warn('[storage] Failed to save image preview string to sessionStorage:', e);
      }
    }
  }
}

export function getCurrentImagePreview(): string | null {
  if (inMemoryImagePreview) return inMemoryImagePreview;
  if (typeof window === 'undefined') return null;
  const stored = sessionStorage.getItem(STORAGE_KEYS.CURRENT_IMAGE);
  if (stored) {
    inMemoryImagePreview = stored;
    return stored;
  }
  return null;
}

export function clearAllLocalUserData(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.READINGS);
  localStorage.removeItem(STORAGE_KEYS.DUAL_READINGS);
  localStorage.removeItem(STORAGE_KEYS.CURRENT_ANALYSIS);
  localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
  localStorage.removeItem('palmora_guest_session_token');
  localStorage.removeItem('palmora_auth_token');
  localStorage.removeItem('palmora_auth_user');
  localStorage.removeItem(STORAGE_KEYS.ENTITLEMENTS);
  
  // Clear any cached consultations
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEYS.CONSULTATIONS)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore storage iteration errors
  }
  
  revokeCurrentImagePreview();
}

export interface UserEntitlements {
  tier: 'free' | 'premium_report' | 'dual_hand' | 'membership';
  purchasedProducts: string[];
  lastUpdated?: string;
}

export function getUserEntitlements(): UserEntitlements {
  if (typeof window === 'undefined') {
    return { tier: 'free', purchasedProducts: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ENTITLEMENTS);
    if (!raw) return { tier: 'free', purchasedProducts: [] };
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse user entitlements:', err);
    return { tier: 'free', purchasedProducts: [] };
  }
}

export function saveUserEntitlement(product: string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getUserEntitlements();
    const updatedProducts = Array.from(new Set([...current.purchasedProducts, product]));
    
    let highestTier: 'free' | 'premium_report' | 'dual_hand' | 'membership' = current.tier;
    if (updatedProducts.includes('membership_monthly') || product === 'membership_monthly') {
      highestTier = 'membership';
    } else if (updatedProducts.includes('dual_hand_report') || product === 'dual_hand_report') {
      if (highestTier !== 'membership') highestTier = 'dual_hand';
    } else if (updatedProducts.includes('premium_report') || product === 'premium_report') {
      if (highestTier !== 'membership' && highestTier !== 'dual_hand') highestTier = 'premium_report';
    }

    const payload: UserEntitlements = {
      tier: highestTier,
      purchasedProducts: updatedProducts,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.ENTITLEMENTS, JSON.stringify(payload));
  } catch (err) {
    console.error('Failed to save user entitlement:', err);
  }
}

export function hasPurchasedProduct(product: string): boolean {
  const entitlements = getUserEntitlements();
  if (entitlements.tier === 'membership') return true;
  return entitlements.purchasedProducts.includes(product);
}

export function isFeatureUnlocked(
  feature: 'deep_dive_metrics' | 'high_res_pdf' | 'dual_hand_synthesis' | 'unlimited_consultations'
): boolean {
  const { tier, purchasedProducts } = getUserEntitlements();
  if (tier === 'membership') return true;
  switch (feature) {
    case 'deep_dive_metrics':
    case 'high_res_pdf':
      return (
        tier === 'premium_report' ||
        tier === 'dual_hand' ||
        purchasedProducts.includes('premium_report') ||
        purchasedProducts.includes('dual_hand_report')
      );
    case 'dual_hand_synthesis':
      return tier === 'dual_hand' || purchasedProducts.includes('dual_hand_report');
    case 'unlimited_consultations':
      return purchasedProducts.includes('membership_monthly');
    default:
      return false;
  }
}

export function getConsultationQuota(readingId?: string): {
  used: number;
  max: number;
  remaining: number;
  isUnlimited: boolean;
  tier: string;
} {
  const { tier, purchasedProducts } = getUserEntitlements();
  if (tier === 'membership') {
    return { used: 0, max: Infinity, remaining: Infinity, isUnlimited: true, tier: 'membership' };
  }
  
  let maxQuestions = 1; // Free tier
  let effectiveTier = 'free';
  if (tier === 'dual_hand' || purchasedProducts.includes('dual_hand_report')) {
    maxQuestions = 10;
    effectiveTier = 'dual_hand';
  } else if (tier === 'premium_report' || purchasedProducts.includes('premium_report')) {
    maxQuestions = 5;
    effectiveTier = 'premium_report';
  }

  const consultations = readingId ? getLocalConsultations(readingId) : [];
  const used = consultations.length;
  const remaining = Math.max(0, maxQuestions - used);

  return {
    used,
    max: maxQuestions,
    remaining,
    isUnlimited: false,
    tier: effectiveTier,
  };
}

export function saveLocalConsultation(readingId: string, consultation: PalmConsultationResponse): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `${STORAGE_KEYS.CONSULTATIONS}_${readingId}`;
    const raw = localStorage.getItem(key);
    const list: PalmConsultationResponse[] = raw ? JSON.parse(raw) : [];
    list.push(consultation);
    localStorage.setItem(key, JSON.stringify(list));
  } catch (err) {
    console.error('Failed to save local consultation:', err);
  }
}

export function getLocalConsultations(readingId: string): PalmConsultationResponse[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = `${STORAGE_KEYS.CONSULTATIONS}_${readingId}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to get local consultations:', err);
    return [];
  }
}

export function clearLocalConsultations(readingId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `${STORAGE_KEYS.CONSULTATIONS}_${readingId}`;
    localStorage.removeItem(key);
  } catch (err) {
    console.error('Failed to clear local consultations:', err);
  }
}

export function saveCreaseJournalEntry(
  entry: Omit<CreaseJournalEntry, 'id'> & { id?: string }
): CreaseJournalEntry {
  if (typeof window === 'undefined') {
    return {
      id: entry.id || 'cj_' + Math.random().toString(36).substring(2, 9),
      ...entry,
    };
  }
  const all = getCreaseJournalEntries();
  const id = entry.id || 'cj_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
  const newEntry: CreaseJournalEntry = { ...entry, id };
  const updated = [newEntry, ...all.filter((e) => e.id !== id)];
  localStorage.setItem(STORAGE_KEYS.CREASE_JOURNAL, JSON.stringify(updated));
  return newEntry;
}

export function getCreaseJournalEntries(): CreaseJournalEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CREASE_JOURNAL);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to parse crease journal entries:', err);
    return [];
  }
}

export function deleteCreaseJournalEntry(id: string): void {
  if (typeof window === 'undefined') return;
  const all = getCreaseJournalEntries();
  const filtered = all.filter((e) => e.id !== id);
  localStorage.setItem(STORAGE_KEYS.CREASE_JOURNAL, JSON.stringify(filtered));
}

export function calculateHabitAlignment(
  entries: CreaseJournalEntry[],
  driftReport?: TemporalDriftReport | null
): HabitAlignmentSummary {
  const totalCheckins = entries.length;
  if (totalCheckins === 0) {
    return {
      total_checkins: 0,
      current_streak_days: 0,
      most_consistent_habit: 'None yet',
      correlated_tension_reduction_pct: 0,
      habit_alignment_score: 50,
      clinical_mindfulness_insight: 'Start logging daily mindfulness habits to observe physical and somatic tension softening on your palm scans.',
    };
  }

  // Calculate streak based on distinct sorted dates
  const sortedDates = Array.from(new Set(entries.map((e) => e.date.split('T')[0]))).sort().reverse();
  let streak = 0;
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (sortedDates[0] === today || sortedDates[0] === yesterday) {
    streak = 1;
    let prev = new Date(sortedDates[0]);
    for (let i = 1; i < sortedDates.length; i++) {
      const curr = new Date(sortedDates[i]);
      const diffDays = Math.round((prev.getTime() - curr.getTime()) / (1000 * 3600 * 24));
      if (diffDays === 1) {
        streak++;
        prev = curr;
      } else {
        break;
      }
    }
  }

  // Most consistent habit
  const habitCounts: Record<string, number> = {};
  entries.forEach((e) => {
    e.habits_completed.forEach((h) => {
      habitCounts[h] = (habitCounts[h] || 0) + 1;
    });
  });
  let mostConsistent = 'meditation';
  let maxCount = 0;
  for (const [h, count] of Object.entries(habitCounts)) {
    if (count > maxCount) {
      maxCount = count;
      mostConsistent = h;
    }
  }

  const habitLabels: Record<string, string> = {
    meditation: 'Daily Meditation & Breathwork',
    circadian_sleep: 'Circadian Sleep Rhythm',
    movement_vitality: 'Physical Movement & Vitality',
    deep_focus: 'Deep Focus & Digital Fasting',
    emotional_boundaries: 'Emotional Boundary Clearing',
  };

  let tensionReduction = 0;
  if (driftReport && driftReport.crease_drifts) {
    const softened = driftReport.softened_lines_count || 0;
    const totalLines = driftReport.crease_drifts.length || 1;
    tensionReduction = Math.round((softened / totalLines) * 100);
  } else {
    const avgStress = entries.reduce((acc, e) => acc + e.stress_rating, 0) / entries.length;
    const stressInversion = Math.max(0, 5 - avgStress);
    tensionReduction = Math.min(85, Math.round(streak * 4 + stressInversion * 10));
  }

  const alignmentScore = Math.min(98, Math.max(45, Math.round(50 + streak * 5 + totalCheckins * 2)));

  const insight = `Your highest consistency habit is ${habitLabels[mostConsistent] || mostConsistent} (${maxCount} sessions). Regular parasympathetic downregulation directly correlates with reduced fine stress criss-crossing across the Thenar and Hypothenar palm mounts.`;

  return {
    total_checkins: totalCheckins,
    current_streak_days: streak,
    most_consistent_habit: habitLabels[mostConsistent] || mostConsistent,
    correlated_tension_reduction_pct: tensionReduction,
    habit_alignment_score: alignmentScore,
    clinical_mindfulness_insight: insight,
  };
}

export function saveLocalSynastryReport(report: RelationalSynastryReport): void {
  if (typeof window === 'undefined') return;
  const current = getLocalSynastryReports();
  const exists = current.some((r) => r.id === report.id);
  const updated = exists
    ? current.map((r) => (r.id === report.id ? report : r))
    : [report, ...current];
  localStorage.setItem(STORAGE_KEYS.SYNASTRY_REPORTS, JSON.stringify(updated));
}

export function getLocalSynastryReports(): RelationalSynastryReport[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SYNASTRY_REPORTS);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to parse synastry reports:', err);
    return [];
  }
}

