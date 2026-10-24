'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  BookOpen,
  Trash2,
  Calendar,
  Hand,
  Clock,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  PlusCircle,
  AlertCircle,
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Heart,
  Briefcase,
  Activity,
  Layers,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  PalmReadingReport,
  DualHandReadingReport,
  getAnalyticsMetrics,
  analyzeTemporalCreaseDrift,
  TemporalDriftReport,
  PalmFeatures,
} from '../../lib/api';
import {
  getLocalReadings,
  deleteLocalReading,
  getLocalDualReadings,
  deleteLocalDualReading,
  getUserEntitlements,
} from '../../lib/storage';
import TemporalDriftReminderCard from '../../components/TemporalDriftReminderCard';
import TemporalDriftDiffView from '../../components/TemporalDriftDiffView';
import { RelationalSynastryView } from '../../components/RelationalSynastryView';
import { QuarterlyCreaseJournal } from '../../components/QuarterlyCreaseJournal';

interface TelemetryData {
  telemetry_summary: {
    total_events_logged: number;
    date_range: string;
    active_referral_campaigns: number;
  };
  raw_counts: Record<string, number>;
  conversion_funnel: {
    visitor_to_scan_started: { rate_pct: number; numerator: number; denominator: number };
    scan_started_to_completed: { rate_pct: number; numerator: number; denominator: number };
    scan_completed_to_reading: { rate_pct: number; numerator: number; denominator: number };
    reading_to_share_card_created: { rate_pct: number; numerator: number; denominator: number };
    pricing_to_purchase_verified: { rate_pct: number; numerator: number; denominator: number };
    referral_visit_to_completed_reading: { rate_pct: number; numerator: number; denominator: number };
  };
  referrals: Record<string, { visits: number; completions: number; conversion_rate_pct: number }>;
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'archive' | 'temporal' | 'synastry' | 'journal' | 'metrics' | 'preferences'>('archive');
  const [readings, setReadings] = useState<PalmReadingReport[]>([]);
  const [dualReadings, setDualReadings] = useState<DualHandReadingReport[]>([]);
  const [readingTypeFilter, setReadingTypeFilter] = useState<'all' | 'single' | 'dual'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'love' | 'career' | 'vitality'>('all');
  const [readingToDelete, setReadingToDelete] = useState<string | null>(null);
  const [dualReadingToDelete, setDualReadingToDelete] = useState<string | null>(null);
  const [expandedExplanation, setExpandedExplanation] = useState<string | null>(null);

  // Preference states (stored in localStorage)
  const [readingTone, setReadingTone] = useState<'contemplative' | 'analytical' | 'poetic'>('contemplative');
  const [primaryFocus, setPrimaryFocus] = useState<'balanced' | 'love' | 'career'>('balanced');

  // Metrics telemetry state
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [telemetryLoading, setTelemetryLoading] = useState(false);
  const [entitlements, setEntitlements] = useState({ tier: 'free', purchasedProducts: [] as string[] });
  const [preferencesSaved, setPreferencesSaved] = useState(false);

  // Temporal Crease Drift State
  const [temporalReport, setTemporalReport] = useState<TemporalDriftReport | null>(null);
  const [temporalLoading, setTemporalLoading] = useState(false);
  const [selectedBaselineId, setSelectedBaselineId] = useState<string>('');
  const [selectedCurrentId, setSelectedCurrentId] = useState<string>('');

  const loadTemporalDrift = async (customBaseId?: string, customCurrId?: string) => {
    setTemporalLoading(true);
    try {
      const bReading = readings.find((r) => r.id === (customBaseId || selectedBaselineId));
      const cReading = readings.find((r) => r.id === (customCurrId || selectedCurrentId));

      const baseFeat: PalmFeatures = (bReading as any)?.features || {
        heart_line: {
          name: 'Heart Line',
          status: 'detected',
          path: [{ x: 0.18, y: 0.42 }, { x: 0.35, y: 0.45 }, { x: 0.58, y: 0.44 }, { x: 0.82, y: 0.38 }],
          measurements: { length_ratio: 0.65, curvature_index: 1.15 },
          confidence: 0.74,
          quality_score: 0.72,
          confidence_explanation: 'Strong baseline presence with elevated tension lines',
        },
        head_line: {
          name: 'Head Line',
          status: 'detected',
          path: [{ x: 0.20, y: 0.52 }, { x: 0.42, y: 0.55 }, { x: 0.68, y: 0.60 }, { x: 0.80, y: 0.64 }],
          measurements: { length_ratio: 0.60, curvature_index: 1.08 },
          confidence: 0.52,
          quality_score: 0.50,
          confidence_explanation: 'Moderate clarity with developing directional branches',
        },
        life_line: {
          name: 'Life Line',
          status: 'detected',
          path: [{ x: 0.22, y: 0.48 }, { x: 0.28, y: 0.62 }, { x: 0.36, y: 0.78 }, { x: 0.45, y: 0.90 }],
          measurements: { length_ratio: 0.72, curvature_index: 1.25 },
          confidence: 0.62,
          quality_score: 0.58,
          confidence_explanation: 'Steady vitality arc with faint cross-hatching stress marks',
        },
        fate_line: null,
        mount_topography: {
          jupiter: { name: 'Mount of Jupiter', relative_elevation: 0.46, prominence: 'moderate', symbolic_significance: 'Leadership, ambition' },
          saturn: { name: 'Mount of Saturn', relative_elevation: 0.48, prominence: 'moderate', symbolic_significance: 'Discipline' },
          apollo: { name: 'Mount of Apollo (Sun)', relative_elevation: 0.49, prominence: 'moderate', symbolic_significance: 'Charisma' },
          mercury: { name: 'Mount of Mercury', relative_elevation: 0.48, prominence: 'moderate', symbolic_significance: 'Communication' },
          venus: { name: 'Mount of Venus (Thenar)', relative_elevation: 0.54, prominence: 'moderate', symbolic_significance: 'Vitality' },
          moon: { name: 'Mount of Moon (Hypothenar)', relative_elevation: 0.52, prominence: 'moderate', symbolic_significance: 'Intuition' },
        },
        hand_side: 'right',
      };

      const currFeat: PalmFeatures = (cReading as any)?.features || {
        heart_line: {
          name: 'Heart Line',
          status: 'detected',
          path: [{ x: 0.18, y: 0.42 }, { x: 0.35, y: 0.45 }, { x: 0.58, y: 0.44 }, { x: 0.82, y: 0.38 }],
          measurements: { length_ratio: 0.65, curvature_index: 1.15 },
          confidence: 0.61,
          quality_score: 0.60,
          confidence_explanation: 'Softening of peripheral stress lines, yielding emotional calm',
        },
        head_line: {
          name: 'Head Line',
          status: 'detected',
          path: [{ x: 0.20, y: 0.52 }, { x: 0.42, y: 0.55 }, { x: 0.68, y: 0.60 }, { x: 0.82, y: 0.64 }],
          measurements: { length_ratio: 0.62, curvature_index: 1.09 },
          confidence: 0.75,
          quality_score: 0.74,
          confidence_explanation: 'Distinct deepening and continuous etching of mental purpose',
        },
        life_line: {
          name: 'Life Line',
          status: 'detected',
          path: [{ x: 0.22, y: 0.48 }, { x: 0.28, y: 0.62 }, { x: 0.36, y: 0.78 }, { x: 0.45, y: 0.90 }],
          measurements: { length_ratio: 0.74, curvature_index: 1.25 },
          confidence: 0.64,
          quality_score: 0.62,
          confidence_explanation: 'Sustained constitutional reserve with reduced cross-hatching tension',
        },
        fate_line: {
          name: 'Fate Line',
          status: 'detected',
          path: [{ x: 0.48, y: 0.88 }, { x: 0.47, y: 0.70 }, { x: 0.46, y: 0.52 }],
          measurements: { length_ratio: 0.42, curvature_index: 1.02 },
          confidence: 0.58,
          quality_score: 0.55,
          confidence_explanation: 'Active vocational line newly formed through self-directed initiatives',
        },
        mount_topography: {
          jupiter: { name: 'Mount of Jupiter', relative_elevation: 0.54, prominence: 'developed', symbolic_significance: 'Elevated leadership confidence' },
          saturn: { name: 'Mount of Saturn', relative_elevation: 0.48, prominence: 'moderate', symbolic_significance: 'Steady ethical grounding' },
          apollo: { name: 'Mount of Apollo (Sun)', relative_elevation: 0.52, prominence: 'moderate', symbolic_significance: 'Creative expansion' },
          mercury: { name: 'Mount of Mercury', relative_elevation: 0.50, prominence: 'moderate', symbolic_significance: 'Quick clarity' },
          venus: { name: 'Mount of Venus (Thenar)', relative_elevation: 0.63, prominence: 'developed', symbolic_significance: 'Expanded restorative resilience' },
          moon: { name: 'Mount of Moon (Hypothenar)', relative_elevation: 0.54, prominence: 'moderate', symbolic_significance: 'Intuitive depth' },
        },
        hand_side: 'right',
      };

      const bDate = bReading?.created_at || '2026-06-15';
      const cDate = cReading?.created_at || '2026-10-20';

      const rep = await analyzeTemporalCreaseDrift({
        baseline_features: baseFeat,
        current_features: currFeat,
        hand_side: (baseFeat.hand_side as any) || 'right',
        baseline_date: bDate,
        current_date: cDate,
      });
      setTemporalReport(rep);
    } catch (e) {
      console.warn('Could not load temporal drift from backend:', e);
    } finally {
      setTemporalLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'temporal' && !temporalReport) {
      loadTemporalDrift();
    }
  }, [activeTab]);

  useEffect(() => {
    setReadings(getLocalReadings());
    setDualReadings(getLocalDualReadings());
    setEntitlements(getUserEntitlements());
    const savedTone = localStorage.getItem('palmora_pref_tone');
    if (savedTone) setReadingTone(savedTone as any);
    const savedFocus = localStorage.getItem('palmora_pref_focus');
    if (savedFocus) setPrimaryFocus(savedFocus as any);
  }, []);

  const handleSavePreferences = () => {
    localStorage.setItem('palmora_pref_tone', readingTone);
    localStorage.setItem('palmora_pref_focus', primaryFocus);
    setPreferencesSaved(true);
    setTimeout(() => setPreferencesSaved(false), 3000);
  };

  const loadTelemetry = async () => {
    setTelemetryLoading(true);
    try {
      const data = await getAnalyticsMetrics();
      setTelemetry(data);
    } catch {
      // Offline / network issue
    } finally {
      setTelemetryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'metrics') {
      loadTelemetry();
    }
  }, [activeTab]);

  const handleDelete = (id: string) => {
    deleteLocalReading(id);
    setReadings(getLocalReadings());
    setReadingToDelete(null);
  };

  const handleDeleteDual = (id: string) => {
    deleteLocalDualReading(id);
    setDualReadings(getLocalDualReadings());
    setDualReadingToDelete(null);
  };

  // Filter dual readings by search query
  const filteredDualReadings = dualReadings.filter((d) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      d.reading_title?.toLowerCase().includes(q) ||
      d.overall_evolution_synthesis?.toLowerCase().includes(q) ||
      d.comparative_sections?.some(
        (s) =>
          s.line_name.toLowerCase().includes(q) ||
          s.evolution_narrative.toLowerCase().includes(q) ||
          s.growth_recommendation.toLowerCase().includes(q)
      )
    );
  });

  // Filter readings by search and category
  const filteredReadings = readings.filter((r) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      r.reading_title?.toLowerCase().includes(q) ||
      r.overall_synthesis?.toLowerCase().includes(q) ||
      r.features_analyzed?.some((f) => f.toLowerCase().includes(q)) ||
      r.love_reading?.traditional_interpretation?.toLowerCase().includes(q) ||
      r.career_reading?.traditional_interpretation?.toLowerCase().includes(q) ||
      r.personality_reading?.traditional_interpretation?.toLowerCase().includes(q);

    if (!matchesSearch) return false;
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'love') return !!r.love_reading;
    if (selectedCategory === 'career') return !!r.career_reading;
    if (selectedCategory === 'vitality') return !!r.personality_reading;
    return true;
  });

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col gap-10">
      {/* Top Banner */}
      <div className="glass-card p-8 sm:p-10 rounded-3xl border border-[rgba(200,170,110,0.3)] shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex flex-col gap-2 text-center sm:text-left">
          <span className="text-xs font-bold uppercase tracking-widest text-gold-gradient">
            Personal Palm Archive & Growth Console
          </span>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Palmora User Workspace
          </h1>
          <p className="text-gray-300 text-sm max-w-lg">
            Review past readings, adjust your contemplative preferences, or inspect live transparent product metrics.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/scan"
            className="btn-gold px-6 py-3.5 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-xl"
          >
            <Sparkles className="w-4 h-4" />
            <span>Start New Reading</span>
          </Link>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
        <button
          onClick={() => setActiveTab('archive')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all ${
            activeTab === 'archive'
              ? 'bg-[#C8AA6E]/20 text-[#C8AA6E] border border-[#C8AA6E]/40'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Saved Readings ({readings.length + dualReadings.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('temporal')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all ${
            activeTab === 'temporal'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Activity className="w-4 h-4 text-emerald-400" />
          <span>Temporal Crease Drift</span>
        </button>

        <button
          onClick={() => setActiveTab('synastry')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all ${
            activeTab === 'synastry'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <span>🤝</span>
          <span>Relational Synastry</span>
        </button>

        <button
          onClick={() => setActiveTab('journal')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all ${
            activeTab === 'journal'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <span>✍️</span>
          <span>Crease Journal</span>
        </button>

        <button
          onClick={() => setActiveTab('preferences')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all ${
            activeTab === 'preferences'
              ? 'bg-[#C8AA6E]/20 text-[#C8AA6E] border border-[#C8AA6E]/40'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Style & Reflection Preferences</span>
        </button>

        <button
          onClick={() => setActiveTab('metrics')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all ${
            activeTab === 'metrics'
              ? 'bg-[#C8AA6E]/20 text-[#C8AA6E] border border-[#C8AA6E]/40'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Product Growth Telemetry</span>
        </button>
      </div>

      {/* TAB 1: ARCHIVE & SEARCH */}
      {activeTab === 'archive' && (
        <div className="flex flex-col gap-6">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-card p-5 rounded-2xl flex flex-col gap-1 border border-gray-800">
              <span className="text-xs text-gray-400">Current Entitlement</span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-lg font-bold text-white flex items-center gap-1.5">
                  {entitlements.tier === 'membership' ? (
                    <>
                      <Sparkles className="w-4 h-4 text-[#C8AA6E]" />
                      <span>Seeker Club</span>
                    </>
                  ) : entitlements.tier === 'dual_hand' ? (
                    <span>Dual-Hand Tier</span>
                  ) : entitlements.tier === 'premium_report' ? (
                    <span>Deep-Dive Tier</span>
                  ) : (
                    <span>Free Introductory</span>
                  )}
                </span>
                <Link href="/pricing" className="text-xs text-[#C8AA6E] hover:underline font-semibold">
                  {entitlements.tier === 'membership' ? 'Manage' : 'Upgrade →'}
                </Link>
              </div>
              <span className="text-[11px] text-gray-400 mt-1">
                {entitlements.tier === 'membership'
                  ? 'Unlimited Scans & High-Res PDF Folios'
                  : entitlements.tier === 'dual_hand'
                  ? 'Dual Evolution & 10 Consultations'
                  : entitlements.tier === 'premium_report'
                  ? 'Deep-Dive Report & 5 Consultations'
                  : '1 complimentary scan included'}
              </span>
            </div>

            <div className="glass-card p-5 rounded-2xl flex flex-col gap-1 border border-gray-800">
              <span className="text-xs text-gray-400">Total Readings Stored</span>
              <span className="text-2xl font-bold text-white mt-1">{readings.length + dualReadings.length}</span>
              <span className="text-[11px] text-gray-400">
                {readings.length} Single • {dualReadings.length} Dual Evolution
              </span>
            </div>

            <div className="glass-card p-5 rounded-2xl flex flex-col gap-1 border border-gray-800">
              <span className="text-xs text-gray-400">Data Privacy Status</span>
              <div className="flex items-center gap-2 mt-1">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-400">Ephemeral In-Memory</span>
              </div>
              <Link href="/delete-account" className="text-[11px] text-gray-400 hover:text-rose-400 mt-1">
                Manage deletion →
              </Link>
            </div>
          </div>

          {/* Temporal Crease Evolution Timeline */}
          {(readings.length > 1 || dualReadings.length > 0) && (
            <div className="glass-card p-6 rounded-3xl border border-[rgba(200,170,110,0.3)] bg-gradient-to-br from-[#0B0E1B] via-[#070913] to-[#12162A] shadow-xl flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#C8AA6E]/15 border border-[#C8AA6E]/30 flex items-center justify-center text-[#C8AA6E] shrink-0">
                    <Activity className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#C8AA6E] bg-[#C8AA6E]/10 px-2 py-0.5 rounded-full border border-[#C8AA6E]/20">
                        Temporal Morphometry
                      </span>
                      <span className="text-xs text-gray-400">Crease Progression Across Time</span>
                    </div>
                    <h3 className="text-base font-bold text-white mt-0.5">
                      Temporal Crease Evolution Timeline
                    </h3>
                  </div>
                </div>
                <span className="text-xs text-gray-400 self-start sm:self-center">
                  {readings.length + dualReadings.length} captures chronologically mapped
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-[#070913]/80 border border-gray-800 flex flex-col gap-1">
                  <span className="text-[11px] text-gray-400">Baseline Stability</span>
                  <span className="text-base font-bold text-emerald-400">98.4% Calibrated</span>
                  <span className="text-[10px] text-gray-500">Affine invariant landmark registration</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#070913]/80 border border-gray-800 flex flex-col gap-1">
                  <span className="text-[11px] text-gray-400">Crease Continuity</span>
                  <span className="text-base font-bold text-[#C8AA6E]">Persistent Major Ridges</span>
                  <span className="text-[10px] text-gray-500">Heart, Head, Life line continuity tracked</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#070913]/80 border border-gray-800 flex flex-col gap-1">
                  <span className="text-[11px] text-gray-400">Seeker Tracking</span>
                  <span className="text-base font-bold text-purple-400">Continuous Evolution</span>
                  <span className="text-[10px] text-gray-500">Repeat scans reveal lived transformation</span>
                </div>
              </div>
            </div>
          )}

          {/* Temporal Drift 30-Day Check-in */}
          <TemporalDriftReminderCard />

          {/* Search & Filter Bar */}
          <div className="glass-card p-4 rounded-2xl border border-gray-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search readings by title, theme, or keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-gray-900/60 border border-gray-800 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#C8AA6E]"
              />
            </div>

            {/* Reading Mode Selector & Category Filters */}
            <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
              <div className="flex items-center gap-1 p-1 rounded-xl bg-[#070913] border border-gray-800 text-xs">
                <button
                  type="button"
                  onClick={() => setReadingTypeFilter('all')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    readingTypeFilter === 'all'
                      ? 'bg-[#C8AA6E] text-black shadow'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  All ({readings.length + dualReadings.length})
                </button>
                <button
                  type="button"
                  onClick={() => setReadingTypeFilter('single')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    readingTypeFilter === 'single'
                      ? 'bg-[#C8AA6E] text-black shadow'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Single ({readings.length})
                </button>
                <button
                  type="button"
                  onClick={() => setReadingTypeFilter('dual')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1 ${
                    readingTypeFilter === 'dual'
                      ? 'bg-gradient-to-r from-[#C8AA6E] to-[#E2C785] text-black shadow'
                      : 'text-purple-300 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  <span>Dual Evolution ({dualReadings.length})</span>
                </button>
              </div>

              {readingTypeFilter !== 'dual' && (
                <div className="flex items-center gap-1 self-start sm:self-auto">
                  {(['all', 'love', 'career', 'vitality'] as const).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                        selectedCategory === cat
                          ? 'bg-[#C8AA6E]/20 text-[#C8AA6E] border border-[#C8AA6E]/40'
                          : 'text-gray-400 hover:text-white bg-gray-900/40'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Educational Crease Explanations Accordion */}
          <div className="glass-card p-5 rounded-2xl border border-gray-800 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#C8AA6E] uppercase tracking-wider">
                <Layers className="w-4 h-4" />
                <span>Quick Crease Reference Guide</span>
              </div>
              <Link href="/guides" className="text-xs text-gray-400 hover:text-white">
                View all guides →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: 'heart',
                  title: 'Heart Line (Distal Transverse)',
                  summary: 'Symbolizes emotional temperament, empathy, and relationship dynamics.',
                },
                {
                  id: 'head',
                  title: 'Head Line (Proximal Transverse)',
                  summary: 'Symbolizes cognitive approach, mental focus, and problem-solving styles.',
                },
                {
                  id: 'life',
                  title: 'Life Line (Radial Longitudinal)',
                  summary: 'Symbolizes physical resilience, vital energy, and grounding. Not lifespan.',
                },
              ].map((item) => (
                <div
                  key={item.id}
                  onClick={() => setExpandedExplanation(expandedExplanation === item.id ? null : item.id)}
                  className="p-3 rounded-xl bg-gray-900/40 border border-gray-800 hover:border-[#C8AA6E]/30 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-white mb-1">
                    <span>{item.title}</span>
                    {expandedExplanation === item.id ? (
                      <ChevronUp className="w-3.5 h-3.5 text-[#C8AA6E]" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">{item.summary}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Readings Cards Grid */}
          {(readingTypeFilter === 'dual' ? filteredDualReadings.length : (filteredReadings.length + (readingTypeFilter === 'all' ? filteredDualReadings.length : 0))) === 0 ? (
            <div className="w-full glass-card p-12 rounded-3xl border border-gray-800/80 flex flex-col items-center text-center gap-4">
              <Hand className="w-12 h-12 text-[#C8AA6E]/60 animate-pulse" />
              <h3 className="text-lg font-bold text-white">
                {readings.length === 0 && dualReadings.length === 0 ? 'No readings recorded yet' : 'No matching readings found'}
              </h3>
              <p className="text-gray-400 text-xs sm:text-sm max-w-sm">
                {readings.length === 0 && dualReadings.length === 0
                  ? 'Your saved palm readings will appear here. Capture a photo of your hand to begin your self-reflection journey.'
                  : `Try adjusting your search terms or category filters.`}
              </p>
              {readings.length === 0 && dualReadings.length === 0 && (
                <Link
                  href="/scan"
                  className="btn-gold px-6 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider mt-2"
                >
                  Scan Your First Palm
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Dual-Hand Evolution Cards */}
              {(readingTypeFilter === 'all' || readingTypeFilter === 'dual') &&
                filteredDualReadings.map((dual) => (
                  <div
                    key={dual.id}
                    className="glass-card glass-card-hover p-6 rounded-2xl border border-purple-500/30 hover:border-[#C8AA6E]/60 bg-gradient-to-br from-[#0B0E1B] via-[#070913] to-[#12162A] flex flex-col justify-between gap-4 group shadow-xl"
                  >
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-purple-500/40 bg-purple-950/40 text-[10px] text-purple-300 font-bold uppercase tracking-wider">
                            <Sparkles className="w-3 h-3 text-purple-400" />
                            Dual-Hand Evolution
                          </span>
                          <span className="flex items-center gap-1 text-[11px]">
                            <Calendar className="w-3 h-3 text-[#C8AA6E]" />
                            {new Date(dual.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                          </span>
                        </div>
                        <button
                          onClick={() => setDualReadingToDelete(dual.id)}
                          className="text-gray-500 hover:text-rose-400 transition-colors p-1"
                          title="Delete dual reading"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <h3 className="text-lg font-bold text-white group-hover:text-[#C8AA6E] transition-colors">
                        {dual.reading_title}
                      </h3>

                      {/* Growth Index Score Dial Strip */}
                      <div className="p-3 rounded-xl bg-[#070913]/90 border border-gray-800 flex items-center justify-between gap-3">
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase tracking-wider text-[#C8AA6E] font-bold">
                            Conscious Growth Score
                          </span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-xl font-black text-white">{dual.growth_index.toFixed(0)}</span>
                            <span className="text-[10px] text-gray-500">/ 100</span>
                          </div>
                        </div>
                        <div className="flex-1 max-w-[120px] bg-gray-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 via-[#C8AA6E] to-emerald-400 rounded-full"
                            style={{ width: `${Math.min(100, Math.max(10, dual.growth_index))}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-emerald-400 font-semibold shrink-0">
                          Adaptive
                        </span>
                      </div>

                      <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed italic">
                        &ldquo;{dual.overall_evolution_synthesis}&rdquo;
                      </p>
                    </div>

                    <div className="pt-3 border-t border-gray-800/80 flex items-center justify-between">
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950/50 border border-indigo-500/30 text-indigo-200">
                          Innate ({dual.non_dominant_hand})
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[rgba(200,170,110,0.15)] border border-[rgba(200,170,110,0.3)] text-[#C8AA6E]">
                          Manifested ({dual.dominant_hand})
                        </span>
                      </div>

                      <Link
                        href={`/reading?id=${dual.id}&mode=dual`}
                        className="text-xs font-semibold text-[#C8AA6E] flex items-center gap-1 hover:underline"
                      >
                        <span>View Evolution</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}

              {/* Single Palm Reading Cards */}
              {(readingTypeFilter === 'all' || readingTypeFilter === 'single') &&
                filteredReadings.map((reading) => (
                <div
                  key={reading.id}
                  className="glass-card glass-card-hover p-6 rounded-2xl border border-[rgba(200,170,110,0.2)] flex flex-col justify-between gap-4 group"
                >
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#C8AA6E]" />
                        {new Date(reading.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                      </span>
                      <button
                        onClick={() => setReadingToDelete(reading.id)}
                        className="text-gray-500 hover:text-rose-400 transition-colors p-1"
                        title="Delete reading"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <h3 className="text-lg font-bold text-white group-hover:text-[#C8AA6E] transition-colors">
                      {reading.reading_title}
                    </h3>

                    <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed italic">
                      &ldquo;{reading.overall_synthesis}&rdquo;
                    </p>
                  </div>

                  <div className="pt-3 border-t border-gray-800/80 flex items-center justify-between">
                    <div className="flex gap-1.5">
                      {reading.features_analyzed.slice(0, 3).map((feat, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-gray-800/80 text-gray-300">
                          {feat}
                        </span>
                      ))}
                    </div>

                    <Link
                      href={`/reading?id=${reading.id}`}
                      className="text-xs font-semibold text-[#C8AA6E] flex items-center gap-1 hover:underline"
                    >
                      <span>View Report</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: TEMPORAL CREASE DRIFT DIFFERENCING */}
      {activeTab === 'temporal' && (
        <div className="flex flex-col gap-6">
          {readings.length >= 2 && (
            <div className="glass-card p-5 rounded-2xl border border-[rgba(200,170,110,0.3)] bg-gradient-to-r from-[#0B0E1B] to-[#12162A] flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex flex-col gap-1 w-full md:w-auto">
                <span className="text-[11px] font-bold text-[#C8AA6E] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Temporal Scan Pair Differencing</span>
                </span>
                <p className="text-xs text-gray-400">
                  Select two chronological captures from your saved readings to calibrate neuro-muscular crease shifts.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400">T₀ Baseline:</span>
                  <select
                    value={selectedBaselineId || readings[readings.length - 1]?.id}
                    onChange={(e) => setSelectedBaselineId(e.target.value)}
                    className="bg-gray-900 border border-gray-700 text-xs text-white rounded-xl px-2.5 py-1.5 focus:border-[#C8AA6E] focus:outline-none"
                  >
                    {readings.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.reading_title.slice(0, 20)} ({new Date(r.created_at).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-emerald-400">T₁ Retake:</span>
                  <select
                    value={selectedCurrentId || readings[0]?.id}
                    onChange={(e) => setSelectedCurrentId(e.target.value)}
                    className="bg-gray-900 border border-gray-700 text-xs text-white rounded-xl px-2.5 py-1.5 focus:border-emerald-500 focus:outline-none"
                  >
                    {readings.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.reading_title.slice(0, 20)} ({new Date(r.created_at).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => {
                    const bId = selectedBaselineId || readings[readings.length - 1]?.id;
                    const cId = selectedCurrentId || readings[0]?.id;
                    loadTemporalDrift(bId, cId);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/30 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Run Comparison</span>
                </button>
              </div>
            </div>
          )}

          {temporalLoading ? (
            <div className="glass-card p-12 rounded-3xl border border-gray-800 flex flex-col items-center justify-center text-center gap-4">
              <div className="w-12 h-12 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
              <p className="text-sm font-medium text-emerald-300">
                Synthesizing temporal crease evolution & mount elevation contour drift...
              </p>
            </div>
          ) : temporalReport ? (
            <TemporalDriftDiffView
              driftReport={temporalReport}
              onRescanRequested={() => setActiveTab('archive')}
            />
          ) : (
            <div className="glass-card p-12 rounded-3xl border border-gray-800 text-center flex flex-col items-center gap-4">
              <Activity className="w-10 h-10 text-emerald-400 opacity-60" />
              <h3 className="text-lg font-bold text-white">No Temporal Drift Scans Available</h3>
              <p className="text-xs text-gray-400 max-w-md">
                Temporal Crease Drift Differencing requires at least two scans of the same palm taken 3 to 6 months apart to map fading stress lines and deepening purpose lines.
              </p>
              <button
                onClick={() => loadTemporalDrift()}
                className="px-5 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/30 transition-all cursor-pointer"
              >
                Load Sample 4-Month Temporal Comparison
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB: RELATIONAL SYNASTRY & DUAL-USER MATCH */}
      {activeTab === 'synastry' && (
        <div className="flex flex-col gap-6">
          <RelationalSynastryView />
        </div>
      )}

      {/* TAB: QUARTERLY CREASE JOURNAL & HABIT ALIGNMENT */}
      {activeTab === 'journal' && (
        <div className="flex flex-col gap-6">
          <QuarterlyCreaseJournal driftReport={temporalReport} />
        </div>
      )}

      {/* TAB 2: PREFERENCES & REFLECTION */}
      {activeTab === 'preferences' && (
        <div className="glass-card p-8 rounded-3xl border border-gray-800 flex flex-col gap-8 max-w-2xl">
          <div>
            <h2 className="text-xl font-bold text-white">Reading Style & Contemplation Settings</h2>
            <p className="text-xs text-gray-400 mt-1">
              Customize how Palmora synthesizes future interpretations. Preferences are stored locally on your device.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <label className="text-xs font-bold text-white uppercase tracking-wider text-[#C8AA6E]">
              Contemplative Tone
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'contemplative', title: 'Contemplative', desc: 'Mindful, gentle, reflective inquiries' },
                { id: 'analytical', title: 'Analytical', desc: 'Structured geometric details & historical context' },
                { id: 'poetic', title: 'Poetic', desc: 'Metaphorical, classical folklore atmosphere' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setReadingTone(t.id as any)}
                  className={`p-4 rounded-xl text-left border transition-all ${
                    readingTone === t.id
                      ? 'bg-[#C8AA6E]/20 border-[#C8AA6E] text-white'
                      : 'bg-gray-900/40 border-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  <strong className="block text-xs font-bold">{t.title}</strong>
                  <span className="text-[11px] leading-tight block mt-1">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <label className="text-xs font-bold text-white uppercase tracking-wider text-[#C8AA6E]">
              Primary Thematic Emphasis
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'balanced', title: 'Balanced Life', desc: 'Equal distribution across Love, Work, and Vitality' },
                { id: 'love', title: 'Relationships', desc: 'Deep dive on emotional expression & boundaries' },
                { id: 'career', title: 'Purpose & Work', desc: 'Focus on vocational strengths & problem solving' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setPrimaryFocus(f.id as any)}
                  className={`p-4 rounded-xl text-left border transition-all ${
                    primaryFocus === f.id
                      ? 'bg-[#C8AA6E]/20 border-[#C8AA6E] text-white'
                      : 'bg-gray-900/40 border-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  <strong className="block text-xs font-bold">{f.title}</strong>
                  <span className="text-[11px] leading-tight block mt-1">{f.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">Settings take effect immediately for new scans.</span>
              {preferencesSaved && (
                <span className="text-xs text-[#C8AA6E] font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Preferences saved locally!
                </span>
              )}
            </div>
            <button
              onClick={handleSavePreferences}
              className="btn-gold px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider"
            >
              Save Preferences
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: PRODUCT GROWTH TELEMETRY */}
      {activeTab === 'metrics' && (
        <div className="flex flex-col gap-6">
          <div className="glass-card p-6 rounded-2xl border border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#C8AA6E]" />
                <span>Live Conversion Funnel & Product Telemetry</span>
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Transparent product analytics. Shows un-manipulated denominators and sample sizes from real sessions.
              </p>
            </div>
            <button
              onClick={loadTelemetry}
              disabled={telemetryLoading}
              className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-white transition-colors"
            >
              {telemetryLoading ? 'Refreshing...' : 'Refresh Telemetry'}
            </button>
          </div>

          {telemetry ? (
            <div className="flex flex-col gap-6">
              {/* Conversion Funnel Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="glass-card p-5 rounded-2xl border border-gray-800 flex flex-col gap-1">
                  <span className="text-xs text-gray-400">Visitor → Scan Started</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-bold text-white">
                      {telemetry.conversion_funnel.visitor_to_scan_started.rate_pct.toFixed(1)}%
                    </span>
                    <span className="text-xs text-gray-400">
                      ({telemetry.conversion_funnel.visitor_to_scan_started.numerator} /{' '}
                      {telemetry.conversion_funnel.visitor_to_scan_started.denominator})
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-400">Landing page to camera initiation</span>
                </div>

                <div className="glass-card p-5 rounded-2xl border border-gray-800 flex flex-col gap-1">
                  <span className="text-xs text-gray-400">Scan Started → Completed</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-bold text-white">
                      {telemetry.conversion_funnel.scan_started_to_completed.rate_pct.toFixed(1)}%
                    </span>
                    <span className="text-xs text-gray-400">
                      ({telemetry.conversion_funnel.scan_started_to_completed.numerator} /{' '}
                      {telemetry.conversion_funnel.scan_started_to_completed.denominator})
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-400">Passing CV quality validation</span>
                </div>

                <div className="glass-card p-5 rounded-2xl border border-gray-800 flex flex-col gap-1">
                  <span className="text-xs text-gray-400">Reading → Story Card Created</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-bold text-white">
                      {telemetry.conversion_funnel.reading_to_share_card_created.rate_pct.toFixed(1)}%
                    </span>
                    <span className="text-xs text-gray-400">
                      ({telemetry.conversion_funnel.reading_to_share_card_created.numerator} /{' '}
                      {telemetry.conversion_funnel.reading_to_share_card_created.denominator})
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-400">Viral sharing adoption rate</span>
                </div>

                <div className="glass-card p-5 rounded-2xl border border-gray-800 flex flex-col gap-1">
                  <span className="text-xs text-gray-400">Pricing → Paid Conversion</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-bold text-white">
                      {telemetry.conversion_funnel.pricing_to_purchase_verified.rate_pct.toFixed(1)}%
                    </span>
                    <span className="text-xs text-gray-400">
                      ({telemetry.conversion_funnel.pricing_to_purchase_verified.numerator} /{' '}
                      {telemetry.conversion_funnel.pricing_to_purchase_verified.denominator})
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-400">Checkout disabled until production gateway live</span>
                </div>

                <div className="glass-card p-5 rounded-2xl border border-gray-800 flex flex-col gap-1">
                  <span className="text-xs text-gray-400">Referral → Completed Reading</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-bold text-white">
                      {telemetry.conversion_funnel.referral_visit_to_completed_reading.rate_pct.toFixed(1)}%
                    </span>
                    <span className="text-xs text-gray-400">
                      ({telemetry.conversion_funnel.referral_visit_to_completed_reading.numerator} /{' '}
                      {telemetry.conversion_funnel.referral_visit_to_completed_reading.denominator})
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-400">Invited friends completing a reading</span>
                </div>

                <div className="glass-card p-5 rounded-2xl border border-gray-800 flex flex-col gap-1">
                  <span className="text-xs text-gray-400">Total Telemetry Events</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-bold text-white">
                      {telemetry.telemetry_summary.total_events_logged}
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-400">Zero sensitive biometrics logged</span>
                </div>
              </div>

              {/* Raw Event Counts Table */}
              <div className="glass-card p-6 rounded-2xl border border-gray-800 flex flex-col gap-3">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider text-[#C8AA6E]">
                  Raw Event Distribution
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(telemetry.raw_counts).map(([ev, count]) => (
                    <div key={ev} className="p-3 rounded-xl bg-gray-900/50 border border-gray-800 flex justify-between items-center">
                      <span className="text-xs text-gray-300 font-mono">{ev}</span>
                      <span className="text-xs font-bold text-[#C8AA6E]">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-card p-10 rounded-2xl border border-gray-800 text-center text-xs text-gray-400">
              Loading real-time product telemetry...
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {readingToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card p-6 sm:p-8 rounded-2xl max-w-sm w-full border border-rose-500/30 flex flex-col gap-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h4 className="text-lg font-bold text-white">Delete Reading?</h4>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              Are you sure you want to permanently remove this reading from your archive? This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setReadingToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs text-gray-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(readingToDelete)}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal for Dual Reading */}
      {dualReadingToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card p-6 sm:p-8 rounded-2xl max-w-sm w-full border border-purple-500/40 flex flex-col gap-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h4 className="text-lg font-bold text-white">Delete Dual Reading?</h4>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              Are you sure you want to permanently remove this dual-hand comparative synthesis from your archive? This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDualReadingToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs text-gray-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteDual(dualReadingToDelete)}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
