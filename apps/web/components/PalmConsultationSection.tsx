'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Coins,
  HeartPulse,
  Briefcase,
  Compass,
  Sparkles,
  Send,
  Loader2,
  ShieldAlert,
  ArrowRight,
  MessageSquare,
  Trash2,
  Info,
  CheckCircle2,
  Lightbulb,
  ExternalLink,
  Lock,
} from 'lucide-react';
import type {
  PalmReadingReport,
  DualHandReadingReport,
  PalmConsultationCategory,
  PalmConsultationResponse,
  PalmFeatures,
} from '@palmora/shared-types';
import { askPalmQuestion } from '../lib/api';
import {
  saveLocalConsultation,
  getLocalConsultations,
  clearLocalConsultations,
  getConsultationQuota,
} from '../lib/storage';

interface PalmConsultationSectionProps {
  report: PalmReadingReport;
  dualReport?: DualHandReadingReport | null;
  features?: PalmFeatures | null;
  onHistoryChange?: (consultations: PalmConsultationResponse[]) => void;
}

function getCategorySuggestions(cat: CategoryConfig, langCode: string = 'en'): string[] {
  const code = (langCode || 'en').toLowerCase().split('-')[0];
  if (code === 'hi') {
    if (cat.id === 'money') {
      return [
        'मेरी हस्तरेखा धन संचय और वित्तीय समृद्धि के बारे में क्या दर्शाती है?',
        'क्या मेरी मस्तिष्क रेखा व्यावसायिक उद्यम या निवेश में सफलता का संकेत देती है?',
        'आय के एकाधिक स्रोतों के लिए मेरी हथेली में क्या संकेत हैं?',
        'धन प्रबंधन में मुझे किन सावधानियों का ध्यान रखना चाहिए?',
      ];
    }
    if (cat.id === 'health') {
      return [
        'मेरी जीवन रेखा मेरी शारीरिक ऊर्जा और जीवन शक्ति की गति के बारे में क्या बताती है?',
        'तनाव संतुलन और मानसिक शांति के लिए मुझे क्या मार्गदर्शन मिलता है?',
        'दैनिक जीवन में मुझे अपनी ऊर्जा की रक्षा कैसे करनी चाहिए?',
      ];
    }
    if (cat.id === 'career') {
      return [
        'मेरी मस्तिष्क रेखा के अनुसार कौन से कार्यक्षेत्र मेरे लिए सबसे अनुकूल हैं?',
        'क्या मेरी हथेली स्वतंत्र कार्य या संगठनात्मक नेतृत्व का संकेत देती है?',
        'करियर में बड़े बदलाव या उन्नति का उपयुक्त समय क्या दर्शाता है?',
      ];
    }
    return [
      'मेरी प्रमुख रेखाओं का समग्र जीवन उद्देश्य क्या संकेत करता है?',
      'हृदय और मस्तिष्क रेखा के तालमेल से जीवन के बड़े निर्णय कैसे लें?',
      'मेरे जीवन के वर्तमान चरण में कौन सी आंतरिक ताकत सबसे प्रमुख है?',
    ];
  }
  if (code === 'es') {
    if (cat.id === 'money') {
      return [
        '¿Qué indica mi palma sobre la creación de riqueza y estabilidad financiera?',
        '¿Cómo refleja mi línea de la cabeza mi enfoque hacia inversiones y riesgos?',
        '¿Sugiere mi estructura manual iniciativa emprendedora o estabilidad laboral?',
      ];
    }
    if (cat.id === 'health') {
      return [
        '¿Cómo refleja mi línea de la vida el ritmo de mi energía física?',
        '¿Qué pautas de descanso y equilibrio frente al estrés me sugiere mi mano?',
      ];
    }
    if (cat.id === 'career') {
      return [
        '¿Qué trayectorias profesionales se alinean mejor con mi enfoque intelectual?',
        '¿Indica mi palma un liderazgo independiente o gestión en equipo?',
      ];
    }
    return [
      '¿Cuál es la narrativa general y el propósito vital revelado en mis líneas?',
      '¿Cómo interactúan mi corazón y mi mente ante grandes decisiones?',
    ];
  }
  return cat.promptSuggestions;
}

interface CategoryConfig {
  id: PalmConsultationCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  badgeBg: string;
  borderColor: string;
  description: string;
  promptSuggestions: string[];
}

const CATEGORIES: CategoryConfig[] = [
  {
    id: 'money',
    label: 'Money & Wealth',
    icon: Coins,
    accentColor: '#F59E0B',
    badgeBg: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    borderColor: 'border-amber-500/30',
    description: 'Explore wealth accumulation, financial mindset, resource stability, and prosperity timing.',
    promptSuggestions: [
      'What does my palm indicate about wealth creation and financial timing?',
      'How does my head line reflect my approach to investments, budgeting, and risk?',
      'Does my palm structure suggest enterprise, multiple income streams, or stability?',
      'What financial blind spots or habits should I remain mindful of?',
    ],
  },
  {
    id: 'health',
    label: 'Health & Vitality',
    icon: HeartPulse,
    accentColor: '#10B981',
    badgeBg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    borderColor: 'border-emerald-500/30',
    description: 'Understand physical stamina, nervous system pacing, vitality reserves, and lifestyle balance.',
    promptSuggestions: [
      'How does my life line reflect my physical energy pacing and stamina?',
      'What does my palm indicate about stress balance and recovering from fatigue?',
      'What daily vitality rhythms and self-care boundaries should I honor?',
      'How does my constitution handle sustained high workloads?',
    ],
  },
  {
    id: 'career',
    label: 'Career & Ambition',
    icon: Briefcase,
    accentColor: '#38BDF8',
    badgeBg: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
    borderColor: 'border-sky-500/30',
    description: 'Reflect on vocational alignment, leadership capacity, career transitions, and strategic growth.',
    promptSuggestions: [
      'What career scope and vocational paths best match my head line mental focus?',
      'Does my palm indicate strong leadership, collaborative teamwork, or independent mastery?',
      'What does my palm suggest about the timing for major career transitions or pivots?',
      'How can I leverage my natural communication strengths in my professional life?',
    ],
  },
  {
    id: 'general',
    label: 'Life Scope & Purpose',
    icon: Compass,
    accentColor: '#A855F7',
    badgeBg: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
    borderColor: 'border-purple-500/30',
    description: 'Synthesize overarching life trajectory, major crossroads, emotional wisdom, and destiny themes.',
    promptSuggestions: [
      'What is the overarching narrative and direction shown across my major creases?',
      'How do my heart and head lines interact when making major life choices?',
      'What natural innate strengths are most prominent for long-term personal fulfillment?',
      'What guidance does my palm offer for navigating times of uncertainty?',
    ],
  },
];

const DUAL_EVOLUTION_CATEGORY: CategoryConfig = {
  id: 'dual_evolution',
  label: 'Dual Evolution',
  icon: Sparkles,
  accentColor: '#C8AA6E',
  badgeBg: 'bg-purple-950/60 text-purple-200 border-purple-500/40',
  borderColor: 'border-purple-500/40',
  description: 'Explore how your conscious choices (dominant hand) have adapted and transcended your inborn baseline (non-dominant hand).',
  promptSuggestions: [
    'Why does my conscious career path diverge from my constitutional baseline?',
    'What does my Conscious Growth Index reveal about my personal evolution?',
    'How have my major lines transformed between my non-dominant and dominant hands?',
    'How can I balance my innate emotional sensitivities with my practical ambitions?',
  ],
};

export default function PalmConsultationSection({ report, dualReport, features, onHistoryChange }: PalmConsultationSectionProps) {
  const availableCategories = dualReport
    ? [DUAL_EVOLUTION_CATEGORY, ...CATEGORIES]
    : CATEGORIES;

  const [selectedCategory, setSelectedCategory] = useState<PalmConsultationCategory>(
    dualReport ? 'dual_evolution' : 'money'
  );
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<PalmConsultationResponse[]>([]);
  const answersEndRef = useRef<HTMLDivElement>(null);

  const activeReadingId = dualReport?.id || report?.id;

  // Load existing consultations from localStorage for this reading
  useEffect(() => {
    if (activeReadingId) {
      const stored = getLocalConsultations(activeReadingId);
      setHistory(stored);
      onHistoryChange?.(stored);
    }
  }, [activeReadingId]);

  const activeCategoryConfig = availableCategories.find((c) => c.id === selectedCategory) || availableCategories[0];
  const categorySuggestions = getCategorySuggestions(activeCategoryConfig, report.language || 'en');
  const quota = getConsultationQuota(activeReadingId);

  const handleAskQuestion = async (queryToAsk?: string) => {
    const q = (queryToAsk || question).trim();
    if (!q || loading) return;

    if (quota.remaining <= 0 && !quota.isUnlimited) {
      setError(`You have used your ${quota.max} ${quota.tier === 'free' ? 'complimentary' : 'included'} inquiry for this reading. Please upgrade to Deep-Dive or Seeker Club for additional questions.`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await askPalmQuestion({
        reading_id: activeReadingId,
        category: selectedCategory,
        question: q,
        report_context: (dualReport as any) || report,
        dual_report_context: dualReport ? (dualReport as any) : undefined,
        features: features || undefined,
        language: report.language || 'en',
      });

      // Update in-memory state and persist locally
      setHistory((prev) => {
        const next = [...prev, response];
        onHistoryChange?.(next);
        return next;
      });
      if (activeReadingId) {
        saveLocalConsultation(activeReadingId, response);
      }
      setQuestion('');

      // Smooth scroll to latest response
      setTimeout(() => {
        answersEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    } catch (err: any) {
      console.error('Consultation error:', err);
      setError(err?.message || 'Failed to complete consultation. Please check connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (!report?.id) return;
    if (confirm('Clear all consultation question history for this reading?')) {
      clearLocalConsultations(report.id);
      setHistory([]);
      onHistoryChange?.([]);
    }
  };

  return (
    <section className="w-full flex flex-col gap-6">
      {/* Consultation Header Banner */}
      <div className="glass-card p-6 sm:p-8 rounded-3xl border border-[rgba(200,170,110,0.3)] shadow-xl relative overflow-hidden bg-gradient-to-br from-[#0B0E1B] via-[#070913] to-[#12162A]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#C8AA6E]/15 border border-[#C8AA6E]/30 flex items-center justify-center text-[#C8AA6E] shrink-0 shadow-md">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#C8AA6E] bg-[#C8AA6E]/10 px-2.5 py-0.5 rounded-full border border-[#C8AA6E]/20">
                  Interactive Chiromancy Consult
                </span>
                <span className="text-xs text-gray-400">Grounded in Observed Creases</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
                Ask Questions on Money, Health & Career Scope
              </h2>
              <p className="text-gray-300 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
                Inquire about specific areas of your life. Every answer is directly grounded in your palm’s observed crease
                curvature, depth, and mount structures, synthesized with traditional chiromancy wisdom.
              </p>
            </div>
          </div>

          {history.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="self-start md:self-center text-xs text-gray-400 hover:text-rose-400 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-800 bg-[#070913]/60 hover:border-rose-900/40 transition-colors"
              title="Clear inquiry history"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History ({history.length})</span>
            </button>
          )}
        </div>

        {/* Category Navigation Pills */}
        <div className={`mt-6 grid grid-cols-2 ${dualReport ? 'sm:grid-cols-5' : 'sm:grid-cols-4'} gap-2.5`}>
          {availableCategories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2.5 p-3 rounded-2xl text-left border transition-all ${
                  isSelected
                    ? `bg-[#0B0E1B] ${cat.borderColor} shadow-lg ring-1 ring-[#C8AA6E]/30 text-white`
                    : 'bg-[#070913]/40 border-gray-800/80 text-gray-400 hover:text-gray-200 hover:bg-[#070913]/80'
                }`}
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: isSelected ? `${cat.accentColor}25` : 'rgba(255,255,255,0.05)',
                    color: cat.accentColor,
                  }}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold truncate">{cat.label}</span>
                  <span className="text-[10px] text-gray-400 truncate hidden sm:inline">
                    {cat.id === 'dual_evolution'
                      ? 'Innate vs Lived'
                      : cat.id === 'money'
                      ? 'Wealth & Timing'
                      : cat.id === 'health'
                      ? 'Vitality & Pacing'
                      : cat.id === 'career'
                      ? 'Vocation & Growth'
                      : 'Destiny & Purpose'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Quota Indicator Capsule */}
        <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-2xl bg-[#070913]/90 border border-gray-800 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Consultation Inquiries:</span>
            {quota.isUnlimited ? (
              <span className="font-bold text-[#C8AA6E] bg-[#C8AA6E]/10 border border-[#C8AA6E]/30 px-2.5 py-0.5 rounded-full flex items-center gap-1 text-[11px]">
                <Sparkles className="w-3 h-3" />
                Unlimited (Seeker Club)
              </span>
            ) : (
              <span className={`font-mono font-bold px-2.5 py-0.5 rounded-full border text-[11px] ${
                quota.remaining > 0
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}>
                {quota.used} of {quota.max} used ({quota.remaining} remaining)
              </span>
            )}
          </div>
          {!quota.isUnlimited && (
            <Link href="/pricing" className="text-[#C8AA6E] hover:underline flex items-center gap-1 font-semibold text-[11px]">
              <span>Need more inquiries? Upgrade</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>

        {/* Active Category Description & Quick Suggestions */}
        <div className="mt-4 p-4 rounded-2xl bg-[#070913]/70 border border-gray-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-[#C8AA6E]" />
              <span>Suggested Inquiries for {activeCategoryConfig.label}:</span>
            </span>
            <span className="text-[11px] text-gray-400">Click to ask instantly</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {categorySuggestions.map((prompt, idx) => (
              <button
                key={idx}
                disabled={loading || (quota.remaining <= 0 && !quota.isUnlimited)}
                onClick={() => {
                  setQuestion(prompt);
                  handleAskQuestion(prompt);
                }}
                className="text-left text-xs px-3 py-1.5 rounded-xl bg-[#0B0E1B] hover:bg-[#141A2D] text-gray-300 hover:text-[#C8AA6E] border border-gray-800 hover:border-[#C8AA6E]/40 transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>{prompt}</span>
                <ArrowRight className="w-3 h-3 text-[#C8AA6E] shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Question Input Form or Upgrade Invitation */}
        {quota.remaining <= 0 && !quota.isUnlimited ? (
          <div className="mt-5 p-5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-[#0B0E1B] to-[#070913] border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Inquiry Quota Reached for this Reading</h4>
                <p className="text-[11px] text-gray-300 mt-0.5 leading-relaxed">
                  You've used your {quota.max} {quota.tier === 'free' ? 'complimentary' : 'included'} consultation inquiry. Unlock 5 inquiries with Deep-Dive ($4.99 / ₹399) or unlimited with Seeker Club.
                </p>
              </div>
            </div>
            <Link
              href="/pricing?product=premium_report"
              className="btn-gold py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider shrink-0 flex items-center gap-1.5 shadow-md hover:scale-105 transition-transform"
            >
              <span>Upgrade Inquiries</span>
              <ArrowRight className="w-3.5 h-3.5 text-black" />
            </Link>
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-2">
            <label htmlFor="palm-question-input" className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-[#C8AA6E]" />
              <span>Or ask your own custom question regarding your {activeCategoryConfig.label.toLowerCase()}:</span>
            </label>
            <div className="relative flex items-center">
              <input
                id="palm-question-input"
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAskQuestion();
                  }
                }}
                placeholder={`e.g., How does my palm guide my next ${activeCategoryConfig.id === 'money' ? 'financial milestone' : activeCategoryConfig.id === 'health' ? 'wellness routine' : activeCategoryConfig.id === 'career' ? 'career transition' : 'life chapter'}?`}
                disabled={loading}
                className="w-full px-4 py-3.5 pr-28 rounded-2xl bg-[#070913] border border-gray-700/80 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-[#C8AA6E] focus:ring-1 focus:ring-[#C8AA6E] transition-all disabled:opacity-50"
              />
              <button
                onClick={() => handleAskQuestion()}
                disabled={loading || !question.trim()}
                className="absolute right-2 px-4 py-2 rounded-xl btn-gold text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Thinking...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Inquire</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Consultation Response Thread */}
      {history.length > 0 && (
        <div className="w-full flex flex-col gap-5 mt-2">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#C8AA6E]" />
              <span>Consultation History & Insights ({history.length})</span>
            </h3>
            <span className="text-xs text-gray-400">Chronological Record</span>
          </div>

          {history.map((item, index) => {
            const catConfig = CATEGORIES.find((c) => c.id === item.category) || CATEGORIES[0];
            const Icon = catConfig.icon;

            return (
              <div
                key={index}
                className="glass-card p-6 sm:p-8 rounded-3xl border border-gray-800 hover:border-gray-700 transition-all shadow-xl flex flex-col gap-4 bg-[#0B0E1B]/90 relative overflow-hidden"
              >
                {/* Header: User Question & Category Badge */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-gray-800 pb-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                      style={{
                        backgroundColor: `${catConfig.accentColor}20`,
                        color: catConfig.accentColor,
                        border: `1px solid ${catConfig.accentColor}40`,
                      }}
                    >
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${catConfig.badgeBg}`}>
                        {catConfig.label}
                      </span>
                      <h4 className="text-base sm:text-lg font-bold text-white mt-1.5 leading-snug">
                        &ldquo;{item.question}&rdquo;
                      </h4>
                    </div>
                  </div>

                  <span className="text-[11px] text-gray-400 self-start sm:self-auto shrink-0">
                    {new Date(item.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Observable Palm Features Grounding Pill */}
                {item.palm_features_referenced && item.palm_features_referenced.length > 0 && (
                  <div className="p-3 rounded-xl bg-[#070913] border border-gray-800/80 text-xs text-gray-300 flex items-start gap-2">
                    <Info className="w-4 h-4 text-[#C8AA6E] shrink-0 mt-0.5" />
                    <div>
                      <span className="text-white font-medium">Grounded in Observable Creases:</span>{' '}
                      <span className="text-gray-300">
                        {item.palm_features_referenced.join(' • ')}
                      </span>
                    </div>
                  </div>
                )}

                {/* Primary Answer Synthesis */}
                <div className="text-gray-200 text-sm sm:text-base leading-relaxed space-y-3 whitespace-pre-line">
                  {item.answer}
                </div>

                {/* Key Insights Bullet Cards */}
                {item.key_insights && item.key_insights.length > 0 && (
                  <div className="mt-2 p-4 rounded-2xl bg-[#070913]/60 border border-gray-800/80 flex flex-col gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#C8AA6E] flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Key Chiromancy Insights
                    </span>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-300 mt-1">
                      {item.key_insights.map((insight, idx) => (
                        <li
                          key={idx}
                          className="p-2.5 rounded-xl bg-[#0B0E1B] border border-gray-800 flex items-start gap-2 leading-relaxed"
                        >
                          <span className="text-[#C8AA6E] font-bold">✦</span>
                          <span>{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Mindful Action / Exercise Box */}
                {item.reflective_action && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-[#C8AA6E]/10 via-[#0B0E1B] to-[#070913] border border-[#C8AA6E]/30 flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-[#C8AA6E] uppercase tracking-wider flex items-center gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5" />
                      Suggested Mindful Reflection / Next Step
                    </span>
                    <p className="text-xs sm:text-sm text-gray-200 leading-relaxed">
                      {item.reflective_action}
                    </p>
                  </div>
                )}

                {/* Cautionary Guidance Note if provided */}
                {item.cautionary_guidance && (
                  <div className="text-[11px] text-gray-400 italic px-1">
                    * {item.cautionary_guidance}
                  </div>
                )}

                {/* Follow-up Question Prompts (Click to explore deeper) */}
                {item.suggested_followups && item.suggested_followups.length > 0 && (
                  <div className="border-t border-gray-800/80 pt-3 flex flex-col gap-2">
                    <span className="text-[11px] font-semibold text-gray-400">
                      Explore Further on this Theme:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {item.suggested_followups.map((prompt: string, pIdx: number) => (
                        <button
                          key={pIdx}
                          disabled={loading}
                          onClick={() => {
                            setQuestion(prompt);
                            handleAskQuestion(prompt);
                          }}
                          className="text-left text-xs px-3 py-1.5 rounded-xl bg-[#070913] hover:bg-[#141A2D] text-gray-300 hover:text-[#C8AA6E] border border-gray-800 hover:border-[#C8AA6E]/40 transition-all flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <span>{prompt}</span>
                          <ArrowRight className="w-3 h-3 text-[#C8AA6E] shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={answersEndRef} />
        </div>
      )}

      {/* Ethical and Safety Disclaimer Note */}
      <div className="p-4 rounded-2xl bg-[#070913]/50 border border-gray-800 text-[11px] text-gray-400 flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-[#C8AA6E] shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-gray-300">Cultural Reflection Disclaimer:</strong> Palmora AI provides archetypal,
          philosophical insights based on classical chiromancy, Samudrika Shastra traditions, and visual palm crease
          measurements. Responses are intended for mindfulness, introspection, and personal exploration. They do not constitute
          licensed financial advice, investment strategies, medical diagnosis, or deterministic future predictions.
        </p>
      </div>
    </section>
  );
}
