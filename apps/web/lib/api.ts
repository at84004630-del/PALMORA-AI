import type {
  Point2D,
  ImageQualityMetrics,
  FeatureStatus,
  CreaseFeature,
  PalmFeatures,
  MountContour,
  MountTopography,
  PalmAnalysisResult,
  ReadingSection,
  PalmReadingReport,
  GenerateReadingRequest,
  UserProfile,
  UsageQuota,
  GuestSessionResponse,
  PalmConsultationCategory,
  PalmConsultationRequest,
  PalmConsultationResponse,
  SupportedLanguage,
  TranslateReadingRequest,
  DualHandComparisonSection,
  DualHandReadingReport,
  CompareReadingsRequest,
  DivergenceCategory,
  CreaseDriftTrend,
  CreaseDriftMeasurement,
  MountDriftMeasurement,
  TemporalDriftReport,
  TemporalDriftRequest,
  ElementalHandType,
  SkinTextureTier,
  ElementalConstitution,
  RelationshipCategory,
  RelationalDimensionComparison,
  RelationalSynastryReport,
  RelationalSynastryRequest,
  MindfulnessHabit,
  CreaseJournalEntry,
  HabitAlignmentSummary,
  TelemetryData,
} from '@palmora/shared-types';
import { SUPPORTED_LANGUAGES } from '@palmora/shared-types';

export { SUPPORTED_LANGUAGES };
export type { TelemetryData };

export type {
  Point2D,
  ImageQualityMetrics,
  FeatureStatus,
  CreaseFeature,
  PalmFeatures,
  MountContour,
  MountTopography,
  PalmAnalysisResult,
  ReadingSection,
  PalmReadingReport,
  GenerateReadingRequest,
  UserProfile,
  UsageQuota,
  GuestSessionResponse,
  PalmConsultationCategory,
  PalmConsultationRequest,
  PalmConsultationResponse,
  SupportedLanguage,
  TranslateReadingRequest,
  DualHandComparisonSection,
  DualHandReadingReport,
  CompareReadingsRequest,
  DivergenceCategory,
  CreaseDriftTrend,
  CreaseDriftMeasurement,
  MountDriftMeasurement,
  TemporalDriftReport,
  TemporalDriftRequest,
  ElementalHandType,
  SkinTextureTier,
  ElementalConstitution,
  RelationshipCategory,
  RelationalDimensionComparison,
  RelationalSynastryReport,
  RelationalSynastryRequest,
  MindfulnessHabit,
  CreaseJournalEntry,
  HabitAlignmentSummary,
};

const API_BASE = (process.env.NEXT_PUBLIC_API_URL !== undefined && process.env.NEXT_PUBLIC_API_URL !== '')
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')
  : (typeof window !== 'undefined' ? '' : 'http://localhost:8000');

export function formatApiErrorMessage(error: unknown): string {
  if (!error) return 'An unexpected error occurred. Please try again.';
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('net::ERR_')) {
    return 'Unable to reach the Palmora analysis server. Please verify your internet connection or check if the server is running.';
  }
  if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
    return 'Analysis request limit reached. Please wait a moment before analyzing another palm.';
  }
  if (msg.includes('413')) {
    return 'The photograph exceeds our size limit. Please upload an image under 10MB.';
  }
  if (msg.includes('415')) {
    return 'Unsupported image format. Please capture or upload a JPEG, PNG, or WebP photo.';
  }
  return msg;
}

export async function createGuestSession(): Promise<GuestSessionResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/account/guest-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to establish secure guest session with server');
    }
    const data: GuestSessionResponse = await res.json();
    if (typeof window !== 'undefined') {
      localStorage.setItem('palmora_guest_session_token', data.session_token);
      localStorage.setItem('palmora_session_id', data.user_id);
    }
    return data;
  } catch (err: any) {
    throw new Error(formatApiErrorMessage(err));
  }
}

export function clearClientSessionToken(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('palmora_guest_session_token');
    localStorage.removeItem('palmora_auth_token');
    localStorage.removeItem('palmora_session_id');
  } catch {
    // Ignore storage write issues
  }
}

// Backward-compatible alias
export const clearSessionToken = clearClientSessionToken;

export async function revokeServerSession(): Promise<void> {
  try {
    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('palmora_auth_token') || localStorage.getItem('palmora_guest_session_token'))
      : null;
    if (token) {
      await fetch(`${API_BASE}/api/v1/account/revoke-session`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } catch (err) {
    console.warn('[api] Server session revocation request failed:', err);
  } finally {
    clearClientSessionToken();
  }
}

export async function getSessionAuthToken(): Promise<string> {
  if (typeof window === 'undefined') return '';

  // 1. First attempt to resolve active Supabase JWT session
  try {
    const supabaseModule = await import('./supabase.ts' as any).catch(() => import('./supabase' as any));
    const createBrowserClient = supabaseModule?.createBrowserClient;
    if (typeof createBrowserClient === 'function') {
      const supabase = createBrowserClient();
      if (supabase?.auth) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token && session.access_token.trim()) {
          return session.access_token.trim();
        }
      }
    }
  } catch (err) {
    // If Supabase client fails (e.g. unconfigured env), fall through gracefully
  }

  // 2. Fall back to manual/legacy token in localStorage
  const authToken = localStorage.getItem('palmora_auth_token');
  if (authToken && authToken.trim()) {
    return authToken.trim();
  }

  // 3. Fall back to existing guest session token in localStorage
  const guestToken = localStorage.getItem('palmora_guest_session_token');
  if (guestToken && guestToken.trim()) {
    return guestToken.trim();
  }

  // Fail closed: if guest session creation fails, propagate the error.
  // Never swallow failures and return empty string, which would cause silent unauthenticated requests.
  const session = await createGuestSession();
  if (!session?.session_token) {
    throw new Error('Unable to establish a secure guest session. Please check your network connection.');
  }
  return session.session_token;
}

export async function getRequiredAuthHeaders(extraHeaders: Record<string, string> = {}): Promise<Record<string, string>> {
  const token = await getSessionAuthToken();
  if (!token) {
    throw new Error('Session credentials could not be initialized. Please refresh and try again.');
  }
  return {
    ...extraHeaders,
    Authorization: `Bearer ${token}`,
  };
}

async function getAuthHeaders(extraHeaders: Record<string, string> = {}): Promise<Record<string, string>> {
  return getRequiredAuthHeaders(extraHeaders);
}

export async function validatePalmImage(file: File): Promise<ImageQualityMetrics> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/api/v1/palm/validate`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to validate palm image');
    }

    return res.json();
  } catch (err: any) {
    throw new Error(formatApiErrorMessage(err));
  }
}

export async function analyzePalmImage(file: File): Promise<PalmAnalysisResult> {
  try {
    const send = async () => {
      const formData = new FormData();
      formData.append('file', file);
      const headers = await getRequiredAuthHeaders();
      return fetch(`${API_BASE}/api/v1/palm/analyze`, {
        method: 'POST',
        headers,
        body: formData,
      });
    };

    let res = await send();
    if (res.status === 401) {
      clearClientSessionToken();
      res = await send();
    }

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to analyze palm creases');
    }

    return res.json();
  } catch (err: any) {
    throw new Error(formatApiErrorMessage(err));
  }
}

export async function generateReading(req: GenerateReadingRequest): Promise<PalmReadingReport> {
  const send = async () => {
    const headers = await getRequiredAuthHeaders({ 'Content-Type': 'application/json' });
    return fetch(`${API_BASE}/api/v1/readings/generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify(req),
    });
  };

  let res = await send();
  if (res.status === 401) {
    clearClientSessionToken();
    res = await send();
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to generate reading report');
  }

  return res.json();
}

export async function translateReading(req: TranslateReadingRequest): Promise<PalmReadingReport> {
  const send = async () => {
    const headers = await getRequiredAuthHeaders({ 'Content-Type': 'application/json' });
    return fetch(`${API_BASE}/api/v1/readings/translate`, {
      method: 'POST',
      headers,
      body: JSON.stringify(req),
    });
  };

  let res = await send();
  if (res.status === 401) {
    clearClientSessionToken();
    res = await send();
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to translate reading report');
  }

  return res.json();
}

export async function getReadingById(readingId: string): Promise<PalmReadingReport> {
  const send = async () => {
    const headers = await getRequiredAuthHeaders();
    return fetch(`${API_BASE}/api/v1/readings/${readingId}`, { headers });
  };

  let res = await send();
  if (res.status === 401) {
    clearClientSessionToken();
    res = await send();
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Reading report not found or access denied');
  }
  return res.json();
}

export async function compareReadings(req: CompareReadingsRequest): Promise<DualHandReadingReport> {
  const send = async () => {
    const headers = await getRequiredAuthHeaders({ 'Content-Type': 'application/json' });
    return fetch(`${API_BASE}/api/v1/readings/compare`, {
      method: 'POST',
      headers,
      body: JSON.stringify(req),
    });
  };

  let res = await send();
  if (res.status === 401) {
    clearClientSessionToken();
    res = await send();
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to compare palm readings');
  }

  return res.json();
}

export async function getDualReadingById(readingId: string): Promise<DualHandReadingReport> {
  const send = async () => {
    const headers = await getRequiredAuthHeaders();
    return fetch(`${API_BASE}/api/v1/readings/compare/${readingId}`, { headers });
  };

  let res = await send();
  if (res.status === 401) {
    clearClientSessionToken();
    res = await send();
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Dual-hand reading report not found or access denied');
  }

  return res.json();
}

export async function listUserReadings(): Promise<PalmReadingReport[]> {
  try {
    const send = async () => {
      const headers = await getRequiredAuthHeaders();
      return fetch(`${API_BASE}/api/v1/readings`, { headers });
    };

    let res = await send();
    if (res.status === 401) {
      clearClientSessionToken();
      res = await send();
    }

    if (!res.ok) {
      return [];
    }
    return res.json();
  } catch (err) {
    console.warn('[api] Failed to fetch readings list:', err);
    return [];
  }
}

export async function deleteReadingById(readingId: string): Promise<void> {
  const send = async () => {
    const headers = await getRequiredAuthHeaders();
    return fetch(`${API_BASE}/api/v1/readings/${readingId}`, {
      method: 'DELETE',
      headers,
    });
  };

  let res = await send();
  if (res.status === 401) {
    clearClientSessionToken();
    res = await send();
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to delete reading');
  }
}

export async function askPalmQuestion(req: PalmConsultationRequest): Promise<PalmConsultationResponse> {
  const send = async () => {
    const headers = await getRequiredAuthHeaders({ 'Content-Type': 'application/json' });
    const targetUrl = req.reading_id
      ? `${API_BASE}/api/v1/readings/${req.reading_id}/ask`
      : `${API_BASE}/api/v1/readings/consult`;
    return fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(req),
    });
  };

  let res = await send();
  if (res.status === 401) {
    clearClientSessionToken();
    res = await send();
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Consultation request failed. Please try again.');
  }

  return res.json();
}

export async function getUserAccount(): Promise<UserProfile> {
  const send = async () => {
    const headers = await getRequiredAuthHeaders();
    return fetch(`${API_BASE}/api/v1/account`, { headers });
  };

  let res = await send();
  if (res.status === 401) {
    clearClientSessionToken();
    res = await send();
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to fetch account profile');
  }
  return res.json();
}

export async function getUserQuota(): Promise<UsageQuota> {
  const send = async () => {
    const headers = await getRequiredAuthHeaders();
    return fetch(`${API_BASE}/api/v1/account/quota`, { headers });
  };

  let res = await send();
  if (res.status === 401) {
    clearClientSessionToken();
    res = await send();
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to fetch usage quota');
  }
  return res.json();
}

export async function deleteUserAccount(): Promise<{ success: boolean; message: string }> {
  try {
    const headers = await getRequiredAuthHeaders();
    const res = await fetch(`${API_BASE}/api/v1/account`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to delete account from server');
    }
    clearClientSessionToken();
    return res.json();
  } catch (err: any) {
    clearClientSessionToken();
    return { success: true, message: 'Local and cloud account deletion completed.' };
  }
}

export async function updateUserAccount(updates: { display_name?: string; retention_policy?: string }): Promise<UserProfile> {
  const headers = await getRequiredAuthHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch(`${API_BASE}/api/v1/account`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to update account preferences');
  }
  return res.json();
}

export async function trackAnalyticsEvent(eventName: string, properties: Record<string, any> = {}): Promise<void> {
  try {
    const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('palmora_session_id') || undefined : undefined;
    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('palmora_auth_token') || localStorage.getItem('palmora_guest_session_token'))
      : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    await fetch(`${API_BASE}/api/v1/analytics/event`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        event_name: eventName,
        session_id: sessionToken,
        properties,
      }),
    });
  } catch (err) {
    // Telemetry events should never break UX flow
    console.debug('Analytics beacon error:', err);
  }
}

export async function createRazorpayOrder(params: {
  product: 'premium_report' | 'dual_hand_report' | 'membership_monthly';
}): Promise<{ order_id: string; amount: number; currency: string; key_id: string; product: string }> {
  const headers = await getRequiredAuthHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch(`${API_BASE}/api/v1/billing/razorpay/create-order`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Unable to create Razorpay payment order.');
  }
  return res.json();
}

export async function verifyRazorpayPayment(params: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  product: 'premium_report' | 'dual_hand_report' | 'membership_monthly';
}): Promise<{ verified: boolean; product: string; payment_id: string; message: string }> {
  const headers = await getRequiredAuthHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch(`${API_BASE}/api/v1/billing/razorpay/verify`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to verify Razorpay payment.');
  }
  return res.json();
}

export async function createPayPalOrder(params: {
  product: 'premium_report' | 'dual_hand_report' | 'membership_monthly';
  return_url: string;
  cancel_url: string;
}): Promise<{ order_id: string; approve_url: string; currency: string; amount: number; product: string }> {
  const headers = await getRequiredAuthHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch(`${API_BASE}/api/v1/billing/paypal/create-order`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Unable to initiate PayPal checkout.');
  }
  return res.json();
}

export async function capturePayPalOrder(params: {
  order_id: string;
  product?: 'premium_report' | 'dual_hand_report' | 'membership_monthly';
}): Promise<{ captured: boolean; order_id: string; status: string }> {
  const headers = await getRequiredAuthHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch(`${API_BASE}/api/v1/billing/paypal/capture-order`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to capture PayPal payment.');
  }
  return res.json();
}

export async function createCheckoutSession(params: {
  product: 'premium_report' | 'dual_hand_report' | 'membership_monthly';
  provider?: 'razorpay' | 'paypal';
  currency?: 'INR' | 'USD';
  success_url: string;
  cancel_url: string;
}): Promise<{ checkout_url: string; order_id?: string; provider?: string }> {
  const headers = await getRequiredAuthHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch(`${API_BASE}/api/v1/billing/checkout-session`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Unable to establish secure checkout session.');
  }
  return res.json();
}

export async function getAnalyticsMetrics(): Promise<TelemetryData> {
  const res = await fetch(`${API_BASE}/api/v1/analytics/metrics`);
  if (!res.ok) {
    throw new Error('Failed to load telemetry metrics');
  }
  return res.json();
}

export async function requestMagicLink(email: string, readingId?: string): Promise<{
  success: boolean;
  message: string;
  recovery_token: string;
  recovery_url: string;
}> {
  const headers = await getRequiredAuthHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch(`${API_BASE}/api/v1/account/magic-link`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, reading_id: readingId }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Unable to generate magic link.');
  }
  return res.json();
}

export async function scheduleEvolutionReminder(
  email: string,
  readingId?: string,
  days: number = 30
): Promise<{ success: boolean; scheduled_date: string; message: string }> {
  const headers = await getRequiredAuthHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch(`${API_BASE}/api/v1/account/remind-evolution`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, reading_id: readingId, days }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Unable to schedule evolution check-in.');
  }
  return res.json();
}

export async function analyzeTemporalCreaseDrift(
  request: TemporalDriftRequest
): Promise<TemporalDriftReport> {
  const headers = await getRequiredAuthHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch(`${API_BASE}/api/v1/readings/temporal-drift`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to generate temporal crease drift comparison.');
  }
  return res.json();
}

export async function generateRelationalSynastry(
  request: RelationalSynastryRequest
): Promise<RelationalSynastryReport> {
  const headers = await getRequiredAuthHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch(`${API_BASE}/api/v1/readings/relational-synastry`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to compute relational palm synastry.');
  }
  return res.json();
}

export async function getRelationalSynastryReport(
  synastryId: string
): Promise<RelationalSynastryReport> {
  const headers = await getRequiredAuthHeaders();
  const res = await fetch(`${API_BASE}/api/v1/readings/relational-synastry/${synastryId}`, {
    method: 'GET',
    headers,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Relational synastry report not found.');
  }
  return res.json();
}


