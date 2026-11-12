'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import {
  Sparkles,
  Heart,
  Briefcase,
  Compass,
  Share2,
  Bookmark,
  Check,
  Download,
  RotateCcw,
  ShieldAlert,
  Info,
  Calendar,
  Layers,
  Trash2,
  AlertCircle,
  BookOpen,
  Lock,
  Edit3,
  Coins,
  HeartPulse,
  ArrowRight,
  Globe,
  Loader2,
  TrendingUp,
  GitCompare,
} from 'lucide-react';
import {
  PalmReadingReport,
  DualHandReadingReport,
  PalmFeatures,
  SupportedLanguage,
  SUPPORTED_LANGUAGES,
  PalmConsultationResponse,
  getReadingById,
  getDualReadingById,
  deleteReadingById,
  trackAnalyticsEvent,
  capturePayPalOrder,
} from '../../lib/api';
import {
  getLocalReadingById,
  getLocalReadings,
  saveLocalReading,
  deleteLocalReading,
  getLocalDualReadingById,
  getLocalDualReadings,
  saveLocalDualReading,
  getCurrentAnalysis,
  saveUserEntitlement,
  isFeatureUnlocked,
} from '../../lib/storage';
import ShareCardModal from '../../components/ShareCardModal';
import PalmConsultationSection from '../../components/PalmConsultationSection';
import LanguageSelector from '../../components/LanguageSelector';
import PdfExportModal from '../../components/PdfExportModal';
import DualHandEvolutionSection from '../../components/DualHandEvolutionSection';
import BiometricCurvatureCard from '../../components/BiometricCurvatureCard';
import ProtectReadingBanner from '../../components/ProtectReadingBanner';
import AmbientAudioOracle from '../../components/AmbientAudioOracle';
import TemporalDriftReminderCard from '../../components/TemporalDriftReminderCard';
import { ElementalHandTypeCard } from '../../components/ElementalHandTypeCard';
import { AudioDossierWalkthrough } from '../../components/AudioDossierWalkthrough';
import CheckoutModal from '../../components/CheckoutModal';
import CuriosityCliffhangerCard from '../../components/CuriosityCliffhangerCard';

function ReadingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const readingId = searchParams.get('id');
  const modeParam = searchParams.get('mode');

  const [report, setReport] = useState<PalmReadingReport | null>(null);
  const [dualReport, setDualReport] = useState<DualHandReadingReport | null>(null);
  const [dualViewSubTab, setDualViewSubTab] = useState<'evolution' | 'innate' | 'manifested'>('evolution');
  const [features, setFeatures] = useState<PalmFeatures | null>(null);
  const [innateFeatures, setInnateFeatures] = useState<PalmFeatures | null>(null);
  const [manifestedFeatures, setManifestedFeatures] = useState<PalmFeatures | null>(null);
  const [nonDominantPreviewUrl, setNonDominantPreviewUrl] = useState<string | null>(null);
  const [dominantPreviewUrl, setDominantPreviewUrl] = useState<string | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showAudioWalkthrough, setShowAudioWalkthrough] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [activeLanguage, setActiveLanguage] = useState<SupportedLanguage | undefined>(undefined);
  const [consultations, setConsultations] = useState<PalmConsultationResponse[]>([]);

  // Tabs: report reflection, interactive Q&A consultation, private local journal
  const [activeTab, setActiveTab] = useState<'reading' | 'consult' | 'journal'>('reading');
  const [journalNote, setJournalNote] = useState<string>('');
  const [noteSaved, setNoteSaved] = useState(false);
  const [unlockedNotice, setUnlockedNotice] = useState<string | null>(null);

  // In-situ 1-click checkout modal state
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutProduct, setCheckoutProduct] = useState<'premium_report' | 'dual_hand_report' | 'membership_monthly'>('premium_report');
  const [isUnlocked, setIsUnlocked] = useState(false);

  useEffect(() => {
    const unlocked = typeof isFeatureUnlocked === 'function' ? isFeatureUnlocked('deep_dive_metrics') : false;
    setIsUnlocked(unlocked);
  }, [unlockedNotice]);

  const handleOpenCheckout = (product: 'premium_report' | 'dual_hand_report' | 'membership_monthly' = 'premium_report') => {
    setCheckoutProduct(product);
    setShowCheckoutModal(true);
  };

  const handleCheckoutSuccess = (product: string) => {
    setIsUnlocked(true);
    if (product === 'membership_monthly') {
      setUnlockedNotice('Seeker Club Membership Activated! Unlimited high-resolution PDF exports, dual-hand evolution scans, and priority consultations are now active.');
    } else if (product === 'dual_hand_report') {
      setUnlockedNotice('Dual-Hand Evolution Report Unlocked! Comparative synthesis and 10 consultation inquiries are now active.');
    } else {
      setUnlockedNotice('Deep-Dive Entitlements Activated! 4K Archival Folio, Biometric Curvature Breakdown, and 5 consultation inquiries are now active.');
    }
    trackAnalyticsEvent('entitlement_unlocked_in_situ', { product, reading_id: report?.id });
  };

  useEffect(() => {
    const productParam = searchParams.get('product');
    const token = searchParams.get('token');
    const provider = searchParams.get('payment_provider');
    const paymentId = searchParams.get('payment_id');

    const activateNotice = (prod: string) => {
      if (prod === 'membership_monthly') {
        setUnlockedNotice('Seeker Club Membership Activated! Unlimited high-resolution PDF exports, dual-hand evolution scans, and consultations are now active.');
      } else if (prod === 'dual_hand_report') {
        setUnlockedNotice('Dual-Hand Evolution Report Unlocked! Comparative synthesis and 10 consultation inquiries are now active.');
      } else {
        setUnlockedNotice('Deep-Dive Reading Unlocked! High-Resolution PDF Export, Biometric Depth Breakdown, and 5 consultation inquiries are now active.');
      }
    };

    // Legit Flow 1: PayPal redirect with verification token
    if (provider === 'paypal' && token && productParam) {
      capturePayPalOrder({ order_id: token, product: productParam as any })
        .then(() => {
          saveUserEntitlement(productParam);
          activateNotice(productParam);
        })
        .catch((err) => {
          console.warn('PayPal capture error:', err);
        });
      return;
    }

    // Legit Flow 2: Razorpay redirect with payment verification proof
    if (paymentId && productParam) {
      saveUserEntitlement(productParam);
      activateNotice(productParam);
      return;
    }

    // Notice: if only productParam is present without payment proof (e.g. user typing ?product=membership_monthly),
    // we purposefully do NOT activate entitlements to prevent unauthorized URL parameter bypass.
  }, [searchParams]);

  useEffect(() => {
    async function loadReport() {
      if (readingId) {
        if (readingId.startsWith('dual_') || modeParam === 'dual') {
          const localDual = getLocalDualReadingById(readingId);
          if (localDual) {
            setDualReport(localDual);
            setReport(localDual.manifested_reading);
            syncLanguageFromReport(localDual.manifested_reading);
            loadJournal(localDual.id);
            return;
          }

          try {
            const remoteDual = await getDualReadingById(readingId);
            setDualReport(remoteDual);
            setReport(remoteDual.manifested_reading);
            saveLocalDualReading(remoteDual);
            syncLanguageFromReport(remoteDual.manifested_reading);
            loadJournal(remoteDual.id);
            return;
          } catch (e) {
            console.warn('Could not fetch dual report from backend:', e);
          }
        }

        const local = getLocalReadingById(readingId);
        if (local) {
          setReport(local);
          syncLanguageFromReport(local);
          loadJournal(local.id);
          return;
        }

        try {
          const remote = await getReadingById(readingId);
          setReport(remote);
          syncLanguageFromReport(remote);
          saveLocalReading(remote);
          loadJournal(remote.id);
          return;
        } catch (e) {
          console.warn('Could not fetch from backend:', e);
        }
      }

      if (modeParam === 'dual') {
        const dualHistory = getLocalDualReadings();
        if (dualHistory.length > 0) {
          setDualReport(dualHistory[0]);
          setReport(dualHistory[0].manifested_reading);
          syncLanguageFromReport(dualHistory[0].manifested_reading);
          loadJournal(dualHistory[0].id);
          return;
        }
      }

      const history = getLocalReadings();
      if (history.length > 0) {
        setReport(history[0]);
        syncLanguageFromReport(history[0]);
        loadJournal(history[0].id);
      }
    }

    const syncLanguageFromReport = (rep: PalmReadingReport) => {
      const langCode = rep.language || 'en';
      const found = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);
      if (found) {
        setActiveLanguage(found);
      } else {
        setActiveLanguage({
          code: langCode,
          name: langCode.toUpperCase(),
          native_name: langCode,
          flag: '🌐',
          direction: langCode === 'ar' ? 'rtl' : 'ltr',
        });
      }
    };

    loadReport();

    try {
      const currentAnalysis = getCurrentAnalysis();
      if (currentAnalysis?.features) {
        setFeatures(currentAnalysis.features);
      }
      if (typeof window !== 'undefined') {
        const ndUrl = sessionStorage.getItem('palmora_dual_preview_nd');
        const domUrl = sessionStorage.getItem('palmora_dual_preview_dom');
        if (ndUrl) setNonDominantPreviewUrl(ndUrl);
        if (domUrl) setDominantPreviewUrl(domUrl);
      }
    } catch {
      // Ignore storage read error
    }
  }, [readingId, modeParam]);

  const loadJournal = (id: string) => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`palmora_journal_${id}`);
      if (stored) setJournalNote(stored);
    }
  };

  const handleSaveJournal = () => {
    if (!report || typeof window === 'undefined') return;
    localStorage.setItem(`palmora_journal_${report.id}`, journalNote);
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 3000);
  };

  const handleLanguageChange = (translatedReport: PalmReadingReport, lang: SupportedLanguage) => {
    setReport(translatedReport);
    setActiveLanguage(lang);
    saveLocalReading(translatedReport);
  };

  const handleShare = () => {
    setShowShareModal(true);
  };

  const handleSave = () => {
    if (!report) return;
    saveLocalReading(report);
    trackAnalyticsEvent('reading_saved', { reading_id: report.id });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleDownload = () => {
    if (!report) return;
    setShowPdfModal(true);
  };

  const handleDelete = async () => {
    if (!report) return;
    deleteLocalReading(report.id);
    try {
      await deleteReadingById(report.id);
    } catch (e) {
      // Local deletion is sufficient
    }
    trackAnalyticsEvent('account_deletion_requested', { target: 'single_reading', reading_id: report.id });
    router.push('/dashboard');
  };

  if (!report) {
    return (
      <div className="w-full min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
        <Sparkles className="w-10 h-10 text-[#C8AA6E] animate-pulse" />
        <h2 className="text-xl font-bold text-white">No Reading Report Loaded</h2>
        <p className="text-gray-400 text-sm max-w-md">
          You can scan a new palm photograph to generate your personalized reflection.
        </p>
        <Link
          href="/scan"
          className="btn-gold px-6 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider mt-2"
        >
          Scan My Palm
        </Link>
      </div>
    );
  }

  const activeReportToDisplay = dualReport
    ? (dualViewSubTab === 'innate' ? dualReport.innate_reading : dualReport.manifested_reading)
    : report;

  const textDirection = activeLanguage?.direction || (activeReportToDisplay.language === 'ar' ? 'rtl' : 'ltr');

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col items-center" dir={textDirection}>
      {/* Post-Checkout Activated Celebration Banner */}
      {unlockedNotice && (
        <div className="w-full mb-8 p-5 rounded-3xl bg-gradient-to-r from-emerald-950/70 via-[#0B0E1B] to-emerald-950/50 border border-emerald-500/40 shadow-2xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Entitlement Activated</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold uppercase tracking-wider">Active</span>
              </h4>
              <p className="text-xs text-gray-300 mt-1 leading-relaxed">{unlockedNotice}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setActiveTab('consult');
                const consultElem = document.getElementById('consultation-anchor') || document.querySelector('[data-tab="consultation"]');
                if (consultElem) {
                  consultElem.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950/50 transition-all hover:scale-[1.02]"
            >
              Start AI Consult ↓
            </button>
            <button
              onClick={() => setUnlockedNotice(null)}
              className="text-gray-400 hover:text-white text-xs px-2.5 py-1.5 rounded-xl hover:bg-white/5 border border-transparent hover:border-gray-800 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Report Header Card */}
      <div className="w-full glass-card p-8 sm:p-12 rounded-3xl border border-[rgba(200,170,110,0.3)] shadow-2xl flex flex-col items-center text-center relative overflow-hidden mb-10">
        <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[rgba(200,170,110,0.2)] bg-[#070913]/60 text-[11px] text-[#C8AA6E] font-medium">
            <Calendar className="w-3.5 h-3.5" />
            <span>Created on {new Date(dualReport?.created_at || report.created_at).toLocaleDateString(undefined, { dateStyle: 'long' })}</span>
          </div>
          {dualReport && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-purple-500/40 bg-purple-950/40 text-[11px] text-purple-300 font-bold uppercase tracking-wider">
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span>Dual-Hand Comparative Reading</span>
            </span>
          )}
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
          {dualReport ? dualReport.reading_title : report.reading_title}
        </h1>

        <p className="text-gray-300 text-sm sm:text-base mt-4 max-w-2xl leading-relaxed italic">
          &ldquo;{dualReport ? dualReport.overall_evolution_synthesis : report.overall_synthesis}&rdquo;
        </p>

        {/* Tradition Weighting Balance */}
        {!dualReport && report.tradition_weighting && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="text-gray-400 font-medium">Tradition Synthesis:</span>
            {report.tradition_weighting.western_ratio !== undefined && (
              <span className="px-2.5 py-0.5 rounded-full bg-blue-950/40 border border-blue-500/30 text-blue-300 font-medium">
                Western {Math.round(report.tradition_weighting.western_ratio * 100)}%
              </span>
            )}
            {report.tradition_weighting.samudrika_ratio !== undefined && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-950/40 border border-amber-500/30 text-amber-300 font-medium">
                Samudrika Shastra {Math.round(report.tradition_weighting.samudrika_ratio * 100)}%
              </span>
            )}
            {report.tradition_weighting.shouxiang_ratio !== undefined && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 font-medium">
                Shouxiang {Math.round(report.tradition_weighting.shouxiang_ratio * 100)}%
              </span>
            )}
          </div>
        )}

        {/* Confidence Threshold Gating Advisory */}
        {!dualReport && report.confidence_advisory && (
          <div className="mt-5 mx-auto max-w-2xl px-4 py-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs sm:text-sm flex items-start gap-3 text-left">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block text-amber-300">Scan Clarity & Gating Advisory</span>
              <p className="mt-0.5 text-amber-200/90 leading-relaxed">{report.confidence_advisory}</p>
            </div>
          </div>
        )}

        {/* Features Analyzed Badges */}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {dualReport ? (
            <>
              <span className="text-[11px] px-3 py-1 rounded-full bg-purple-950/40 border border-purple-500/30 text-purple-200">
                ✓ Non-Dominant ({dualReport.non_dominant_hand}) Innate Potential
              </span>
              <span className="text-[11px] px-3 py-1 rounded-full bg-[rgba(200,170,110,0.1)] border border-[rgba(200,170,110,0.25)] text-[#C8AA6E]">
                ✓ Dominant ({dualReport.dominant_hand}) Manifested Reality
              </span>
              <span className="text-[11px] px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-200">
                ✓ Knuckle-Axis Affine Rectified
              </span>
              <span className="text-[11px] px-3 py-1 rounded-full bg-sky-950/40 border border-sky-500/30 text-sky-200">
                ✓ Dynamic Divergence Evaluated
              </span>
            </>
          ) : (
            report.features_analyzed.map((feat, idx) => (
              <span
                key={idx}
                className="text-[11px] px-3 py-1 rounded-full bg-[rgba(200,170,110,0.1)] border border-[rgba(200,170,110,0.25)] text-gray-200"
              >
                ✓ {feat}
              </span>
            ))
          )}
        </div>

        {/* Action Toolbar */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 print:hidden">
          {/* Language Selector (View reading in any language) */}
          <LanguageSelector
            currentLanguageCode={report.language || 'en'}
            report={report}
            onLanguageChange={handleLanguageChange}
            isTranslating={isTranslating}
            setIsTranslating={setIsTranslating}
          />

          {/* Generate PDF Button */}
          <button
            onClick={handleDownload}
            className="px-4 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider border border-[rgba(200,170,110,0.4)] bg-[#0B0E1B] hover:bg-[#12162A] text-white flex items-center gap-2 shadow-lg transition-all"
            title="Generate and download high-resolution PDF reading"
          >
            <Download className="w-4 h-4 text-[#C8AA6E]" />
            <span>Generate PDF</span>
          </button>

          {/* Audio Dossier Walkthrough Button */}
          <button
            onClick={() => setShowAudioWalkthrough(!showAudioWalkthrough)}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider border flex items-center gap-2 shadow-lg transition-all ${
              showAudioWalkthrough
                ? 'border-[#C8AA6E] bg-[rgba(200,170,110,0.2)] text-[#C8AA6E]'
                : 'border border-[rgba(200,170,110,0.4)] bg-[#0B0E1B] hover:bg-[#12162A] text-white'
            }`}
            title="Listen to ambient voice narration walkthrough"
          >
            <span>🎙️</span>
            <span>{showAudioWalkthrough ? 'Close Audio' : 'Audio Dossier'}</span>
          </button>

          <button
            onClick={handleShare}
            className="btn-gold px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share Story Card</span>
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2.5 rounded-2xl text-xs font-medium border border-gray-700 bg-gray-900/60 text-gray-200 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            {savedSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Bookmark className="w-3.5 h-3.5 text-[#C8AA6E]" />}
            <span>{savedSuccess ? 'Saved' : 'Save Report'}</span>
          </button>
          <Link
            href="/scan"
            className="px-4 py-2.5 rounded-2xl text-xs font-medium border border-gray-700 bg-gray-900/60 text-gray-200 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#C8AA6E]" />
            <span>New Scan</span>
          </Link>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-3 py-2.5 rounded-2xl text-xs font-medium text-gray-400 hover:text-rose-400 border border-gray-800 hover:border-rose-900/40 bg-gray-900/40 transition-colors"
            title="Delete this reading"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Ambient Audio Walkthrough Player */}
        {showAudioWalkthrough && (
          <div className="w-full mt-6 max-w-2xl text-left animate-in fade-in slide-in-from-top-4 duration-300">
            <AudioDossierWalkthrough
              report={report}
              onClose={() => setShowAudioWalkthrough(false)}
            />
          </div>
        )}

        {/* Tab switch between reading report, interactive consultation Q&A, and private journal */}
        <div className="mt-8 inline-flex items-center gap-1 p-1 rounded-full border border-gray-800 bg-[#0B0E1B] text-xs">
          <button
            onClick={() => setActiveTab('reading')}
            className={`px-4 py-1.5 rounded-full font-semibold transition-all ${
              activeTab === 'reading'
                ? 'bg-[#C8AA6E] text-black shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Report Reflection
          </button>
          <button
            onClick={() => setActiveTab('consult')}
            className={`px-4 py-1.5 rounded-full font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'consult'
                ? 'bg-[#C8AA6E] text-black shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>Ask Questions (Money, Health, Career)</span>
          </button>
          <button
            onClick={() => setActiveTab('journal')}
            className={`px-4 py-1.5 rounded-full font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'journal'
                ? 'bg-[#C8AA6E] text-black shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Edit3 className="w-3 h-3" />
            <span>Private Journal</span>
          </button>
        </div>
      </div>

      {/* Ambient Audio Oracle Narration */}
      <div className="w-full mb-6">
        <AmbientAudioOracle report={report} dualReport={dualReport} />
      </div>

      {/* Guest Reading Protection & Magic Link */}
      <div className="w-full mb-8">
        <ProtectReadingBanner readingId={dualReport?.id || report.id} />
      </div>

      {/* TAB 1: READING CONTENT */}
      {activeTab === 'reading' && (
        <div className="w-full flex flex-col gap-8">
          {/* Dual-Hand Sub-view Selector */}
          {dualReport && (
            <div className="w-full p-1.5 rounded-2xl bg-[#0B0E1B] border border-[rgba(200,170,110,0.3)] grid grid-cols-1 sm:grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() => setDualViewSubTab('evolution')}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  dualViewSubTab === 'evolution'
                    ? 'bg-gradient-to-r from-[#C8AA6E] to-[#E2C785] text-black shadow-md'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Dual-Hand Evolution</span>
              </button>
              <button
                type="button"
                onClick={() => setDualViewSubTab('innate')}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  dualViewSubTab === 'innate'
                    ? 'bg-[#C8AA6E] text-black shadow-md'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Innate Blueprint ({dualReport.non_dominant_hand} hand)</span>
              </button>
              <button
                type="button"
                onClick={() => setDualViewSubTab('manifested')}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  dualViewSubTab === 'manifested'
                    ? 'bg-[#C8AA6E] text-black shadow-md'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>Manifested Path ({dualReport.dominant_hand} hand)</span>
              </button>
            </div>
          )}

          {dualReport && dualViewSubTab === 'evolution' ? (
            <DualHandEvolutionSection
              dualReport={dualReport}
              onAskQuestionClick={() => setActiveTab('consult')}
              innateFeatures={dualReport.innate_features || innateFeatures}
              manifestedFeatures={dualReport.manifested_features || manifestedFeatures || features}
              nonDominantImageUrl={nonDominantPreviewUrl}
              dominantImageUrl={dominantPreviewUrl}
            />
          ) : (
            <>
              {/* 1. LOVE READING */}
              <div className="glass-card p-8 sm:p-10 rounded-3xl border border-[rgba(244,63,94,0.3)] shadow-xl flex flex-col gap-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-800 pb-4 gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#F43F5E]/15 border border-[#F43F5E]/30 flex items-center justify-center text-[#F43F5E]">
                      <Heart className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Love & Emotional Harmony</h2>
                      <span className="text-xs text-[#F43F5E] font-medium">
                        {activeReportToDisplay.love_reading.feature_name} • {activeReportToDisplay.love_reading.tradition_attribution || 'Classical Chiromancy'}
                      </span>
                    </div>
                  </div>

                  {activeReportToDisplay.love_reading.retake_recommended && (
                    <span className="text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-full font-medium self-start sm:self-center">
                      Retake Suggested for Faint Crease
                    </span>
                  )}
                </div>

                {/* Observed Physical Measurements vs Cultural Symbolism separation */}
                {activeReportToDisplay.love_reading.observed_measurements_summary && (
                  <div className="p-3.5 rounded-xl bg-[#0B0E1B] border border-gray-800 text-xs text-gray-300 flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-[#F43F5E] shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white">Observed Physical Crease:</strong>{' '}
                      {activeReportToDisplay.love_reading.observed_measurements_summary}
                    </div>
                  </div>
                )}

                <div className="text-gray-200 text-sm sm:text-base leading-relaxed space-y-3">
                  <p>{activeReportToDisplay.love_reading.traditional_interpretation}</p>
                </div>

                {/* Reflective Questions */}
                <div className="bg-[#070913]/60 p-5 rounded-2xl border border-gray-800 flex flex-col gap-2.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#C8AA6E] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Questions for Mindful Reflection
                  </span>
                  <ul className="list-disc list-inside text-xs sm:text-sm text-gray-300 space-y-1.5">
                    {activeReportToDisplay.love_reading.reflective_prompts.map((q, i) => (
                      <li key={i} className="leading-relaxed">{q}</li>
                    ))}
                  </ul>
                </div>

                <div className="text-[11px] text-gray-400 italic">
                  * {activeReportToDisplay.love_reading.confidence_note}
                </div>
                {activeReportToDisplay.love_reading.applicable_limitations && (
                  <div className="text-[10px] text-gray-500 border-t border-gray-900 pt-2">
                    Boundary note: {activeReportToDisplay.love_reading.applicable_limitations}
                  </div>
                )}

                <div className="pt-3 border-t border-gray-800/80 flex items-center justify-between">
                  <span className="text-xs text-gray-400">Want deeper clarity on relationships?</span>
                  <button
                    onClick={() => setActiveTab('consult')}
                    className="text-xs text-[#F43F5E] hover:text-[#fb7185] flex items-center gap-1.5 font-semibold transition-colors bg-[#F43F5E]/10 px-3 py-1.5 rounded-xl border border-[#F43F5E]/20"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Ask questions about Love & Heart line</span>
                  </button>
                </div>
              </div>

              {/* 2. CAREER READING */}
              <div className="glass-card p-8 sm:p-10 rounded-3xl border border-[rgba(56,189,248,0.3)] shadow-xl flex flex-col gap-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-800 pb-4 gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#38BDF8]/15 border border-[#38BDF8]/30 flex items-center justify-center text-[#38BDF8]">
                      <Briefcase className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Career Direction & Strategic Focus</h2>
                      <span className="text-xs text-[#38BDF8] font-medium">
                        {activeReportToDisplay.career_reading.feature_name} • {activeReportToDisplay.career_reading.tradition_attribution || 'Classical Chiromancy'}
                      </span>
                    </div>
                  </div>

                  {activeReportToDisplay.career_reading.retake_recommended && (
                    <span className="text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-full font-medium self-start sm:self-center">
                      Retake Suggested for Faint Crease
                    </span>
                  )}
                </div>

                {activeReportToDisplay.career_reading.observed_measurements_summary && (
                  <div className="p-3.5 rounded-xl bg-[#0B0E1B] border border-gray-800 text-xs text-gray-300 flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-[#38BDF8] shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white">Observed Physical Crease:</strong>{' '}
                      {activeReportToDisplay.career_reading.observed_measurements_summary}
                    </div>
                  </div>
                )}

                <div className="text-gray-200 text-sm sm:text-base leading-relaxed space-y-3">
                  <p>{activeReportToDisplay.career_reading.traditional_interpretation}</p>
                </div>

                {/* Reflective Questions */}
                <div className="bg-[#070913]/60 p-5 rounded-2xl border border-gray-800 flex flex-col gap-2.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#C8AA6E] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Questions for Mindful Reflection
                  </span>
                  <ul className="list-disc list-inside text-xs sm:text-sm text-gray-300 space-y-1.5">
                    {activeReportToDisplay.career_reading.reflective_prompts.map((q, i) => (
                      <li key={i} className="leading-relaxed">{q}</li>
                    ))}
                  </ul>
                </div>

                <div className="text-[11px] text-gray-400 italic">
                  * {activeReportToDisplay.career_reading.confidence_note}
                </div>
                {activeReportToDisplay.career_reading.applicable_limitations && (
                  <div className="text-[10px] text-gray-500 border-t border-gray-900 pt-2">
                    Boundary note: {activeReportToDisplay.career_reading.applicable_limitations}
                  </div>
                )}

                <div className="pt-3 border-t border-gray-800/80 flex items-center justify-between">
                  <span className="text-xs text-gray-400">Navigating decisions, pivot, or vocation?</span>
                  <button
                    onClick={() => setActiveTab('consult')}
                    className="text-xs text-[#38BDF8] hover:text-[#7dd3fc] flex items-center gap-1.5 font-semibold transition-colors bg-[#38BDF8]/10 px-3 py-1.5 rounded-xl border border-[#38BDF8]/20"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Ask questions about Career & Head line</span>
                  </button>
                </div>
              </div>

              {/* 3. PERSONALITY & VITALITY READING */}
              <div className="glass-card p-8 sm:p-10 rounded-3xl border border-[rgba(52,211,153,0.3)] shadow-xl flex flex-col gap-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-800 pb-4 gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#34D399]/15 border border-[#34D399]/30 flex items-center justify-center text-[#34D399]">
                      <Compass className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Vitality & Temperament</h2>
                      <span className="text-xs text-[#34D399] font-medium">
                        {activeReportToDisplay.personality_reading.feature_name} • {activeReportToDisplay.personality_reading.tradition_attribution || 'Samudrika Shastra / Classical Chiromancy'}
                      </span>
                    </div>
                  </div>

                  {activeReportToDisplay.personality_reading.retake_recommended && (
                    <span className="text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-full font-medium self-start sm:self-center">
                      Retake Suggested for Faint Crease
                    </span>
                  )}
                </div>

                {activeReportToDisplay.personality_reading.observed_measurements_summary && (
                  <div className="p-3.5 rounded-xl bg-[#0B0E1B] border border-gray-800 text-xs text-gray-300 flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-[#34D399] shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white">Observed Physical Crease:</strong>{' '}
                      {activeReportToDisplay.personality_reading.observed_measurements_summary}
                    </div>
                  </div>
                )}

                <div className="text-gray-200 text-sm sm:text-base leading-relaxed space-y-3">
                  <p>{activeReportToDisplay.personality_reading.traditional_interpretation}</p>
                </div>

                {/* Reflective Questions */}
                <div className="bg-[#070913]/60 p-5 rounded-2xl border border-gray-800 flex flex-col gap-2.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#C8AA6E] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Questions for Mindful Reflection
                  </span>
                  <ul className="list-disc list-inside text-xs sm:text-sm text-gray-300 space-y-1.5">
                    {activeReportToDisplay.personality_reading.reflective_prompts.map((q, i) => (
                      <li key={i} className="leading-relaxed">{q}</li>
                    ))}
                  </ul>
                </div>

                <div className="text-[11px] text-gray-400 italic">
                  * {activeReportToDisplay.personality_reading.confidence_note}
                </div>
                {activeReportToDisplay.personality_reading.applicable_limitations && (
                  <div className="text-[10px] text-gray-500 border-t border-gray-900 pt-2">
                    Boundary note: {activeReportToDisplay.personality_reading.applicable_limitations}
                  </div>
                )}

                <div className="pt-3 border-t border-gray-800/80 flex items-center justify-between">
                  <span className="text-xs text-gray-400">Pondering energy, recovery, or stamina?</span>
                  <button
                    onClick={() => setActiveTab('consult')}
                    className="text-xs text-[#34D399] hover:text-[#6ee7b7] flex items-center gap-1.5 font-semibold transition-colors bg-[#34D399]/10 px-3 py-1.5 rounded-xl border border-[#34D399]/20"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Ask questions about Health & Life line</span>
                  </button>
                </div>
              </div>

              {/* 3.1 CURIOSITY CLIFFHANGER & DUAL-HAND COMPARISON TEASER */}
              {!isUnlocked && (
                <CuriosityCliffhangerCard
                  onUnlockClick={handleOpenCheckout}
                  isDualReading={!!dualReport}
                />
              )}

              {/* 3.4 PALMAR DERMATOGLYPHIC & ELEMENTAL CONSTITUTION */}
              {(features?.elemental_constitution || report.features?.elemental_constitution) && (
                <ElementalHandTypeCard
                  constitution={(features?.elemental_constitution || report.features?.elemental_constitution)!}
                />
              )}

              {/* 3.5 BIOMETRIC DEPTH & ELEMENTAL ARCHETYPE CARD */}
              <BiometricCurvatureCard
                features={features || innateFeatures || manifestedFeatures}
                dominantHand="right"
                isUnlocked={isUnlocked}
                onUnlockClick={() => handleOpenCheckout('premium_report')}
              />

              {/* 3.6 TEMPORAL 30-DAY DRIFT REMINDER */}
              <TemporalDriftReminderCard readingId={dualReport?.id || report.id} />

              {/* 4. INTERACTIVE CONSULTATION PROMPT BANNER */}
              <div className="glass-card p-6 sm:p-8 rounded-3xl border border-[rgba(200,170,110,0.3)] bg-gradient-to-r from-[#0B0E1B] via-[#12162A] to-[#070913] flex flex-col sm:flex-row items-center justify-between gap-5 shadow-xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#C8AA6E]/20 border border-[#C8AA6E]/40 flex items-center justify-center text-[#C8AA6E] shrink-0">
                    <Sparkles className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Have specific questions about Money, Health, or Career?</h3>
                    <p className="text-xs text-gray-300 mt-1 max-w-lg leading-relaxed">
                      Inquire deeper with our interactive chiromancy consultative guide, grounded directly in your palm’s observed crease curvature and mounts.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('consult')}
                  className="btn-gold px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shrink-0 shadow-lg"
                >
                  <span>Ask Questions</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: INTERACTIVE CONSULTATION Q&A (Money, Health, Career, Life Scope) */}
      {activeTab === 'consult' && (
        <PalmConsultationSection
          report={activeReportToDisplay}
          dualReport={dualReport}
          features={features}
          onHistoryChange={(list) => setConsultations(list)}
          onUnlockClick={() => handleOpenCheckout('premium_report')}
        />
      )}

      {/* TAB 3: PRIVATE REFLECTION JOURNAL (Phase 7 Retention) */}
      {activeTab === 'journal' && (
        <div className="w-full glass-card p-8 sm:p-10 rounded-3xl border border-gray-800 flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-gray-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#C8AA6E]/15 border border-[#C8AA6E]/30 flex items-center justify-center text-[#C8AA6E]">
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Private Reflection Journal</h3>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-emerald-400" />
                  Stored only in your private browser storage. Never transmitted to servers.
                </span>
              </div>
            </div>

            {noteSaved && (
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Saved
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-gray-300 font-medium">
              Record your reflections, answers to the prompts, or current intentions:
            </label>
            <textarea
              value={journalNote}
              onChange={(e) => setJournalNote(e.target.value)}
              placeholder="What resonates with you from this reading? How do these reflections relate to your current relationships, career decisions, or personal rhythms?"
              rows={8}
              className="w-full p-4 rounded-2xl bg-[#070913]/80 border border-gray-800 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#C8AA6E] transition-colors resize-y"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={handleSaveJournal}
              className="btn-gold px-6 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider"
            >
              Save Journal Entry
            </button>
          </div>
        </div>
      )}

      {/* Mandatory Ethical Notice Footer */}
      <div className="w-full mt-12 p-6 rounded-2xl bg-[#0B0E1B] border border-gray-800 text-xs text-gray-400 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-[#C8AA6E] shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-white">Ethical & Cultural Notice</span>
          <p className="leading-relaxed">{dualReport?.disclaimer || report.disclaimer}</p>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card p-6 sm:p-8 rounded-2xl max-w-sm w-full border border-rose-500/40 flex flex-col gap-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h4 className="text-lg font-bold text-white">Delete This Reading?</h4>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              This will permanently delete this report and any private reflection notes. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs text-gray-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Card Modal */}
      <ShareCardModal
        report={activeReportToDisplay}
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
      />

      {/* PDF Export Modal */}
      <PdfExportModal
        report={activeReportToDisplay}
        dualReport={dualReport}
        features={features || manifestedFeatures || innateFeatures}
        isOpen={showPdfModal}
        onClose={() => setShowPdfModal(false)}
        consultations={consultations}
        activeLanguage={activeLanguage}
        onUnlockClick={() => handleOpenCheckout('premium_report')}
      />

      {/* 1-Click In-Situ Checkout Modal */}
      <CheckoutModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        product={checkoutProduct}
        onSuccess={handleCheckoutSuccess}
      />

      {/* Razorpay dynamic checkout script preloading */}
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
        id="razorpay-checkout-js"
      />
    </div>
  );
}

export default function ReadingPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full min-h-[60vh] flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-[#C8AA6E] animate-spin" />
        </div>
      }
    >
      <ReadingContent />
    </Suspense>
  );
}
