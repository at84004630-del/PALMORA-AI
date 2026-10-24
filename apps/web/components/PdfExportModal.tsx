'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Download,
  Printer,
  Sparkles,
  X,
  Check,
  FileText,
  Layers,
  Palette,
  ExternalLink,
  MessageSquare,
  Globe,
  Loader2,
  Lock,
  ArrowRight,
} from 'lucide-react';
import type {
  PalmReadingReport,
  DualHandReadingReport,
  PalmConsultationResponse,
  SupportedLanguage,
  PalmFeatures,
} from '@palmora/shared-types';
import { generatePalmReadingPdf, generateDualHandReadingPdf, downloadPdfBlob } from '../lib/pdfGenerator';
import { trackAnalyticsEvent } from '../lib/api';
import { isFeatureUnlocked } from '../lib/storage';

interface PdfExportModalProps {
  report: PalmReadingReport;
  dualReport?: DualHandReadingReport | null;
  features?: PalmFeatures | null;
  isOpen: boolean;
  onClose: () => void;
  consultations?: PalmConsultationResponse[];
  activeLanguage?: SupportedLanguage;
}

export default function PdfExportModal({
  report,
  dualReport,
  features,
  isOpen,
  onClose,
  consultations = [],
  activeLanguage,
}: PdfExportModalProps) {
  const [theme, setTheme] = useState<'midnight' | 'parchment'>('midnight');
  const [includeConsultations, setIncludeConsultations] = useState<boolean>(consultations.length > 0);
  const [generating, setGenerating] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const isUnlocked = typeof isFeatureUnlocked === 'function' ? isFeatureUnlocked('high_res_pdf') : false;

  const handleDownload = async () => {
    setGenerating(true);
    setSuccess(false);
    try {
      const { blob, filename } = dualReport
        ? await generateDualHandReadingPdf(dualReport, {
            theme,
            includeConsultations,
            consultations,
            activeLanguage,
            features,
          })
        : await generatePalmReadingPdf(report, {
            theme,
            includeConsultations,
            consultations,
            activeLanguage,
            features,
          });

      downloadPdfBlob(blob, filename);
      setSuccess(true);
      trackAnalyticsEvent('pdf_generated', {
        reading_id: dualReport?.id || report.id,
        theme,
        is_dual: !!dualReport,
        language: (dualReport ? dualReport.language : report.language) || 'en',
        included_consultations: includeConsultations,
      });
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      alert('Unable to generate PDF document. Please try system print instead.');
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenInNewTab = async () => {
    setGenerating(true);
    try {
      const { url } = dualReport
        ? await generateDualHandReadingPdf(dualReport, {
            theme,
            includeConsultations,
            consultations,
            activeLanguage,
            features,
          })
        : await generatePalmReadingPdf(report, {
            theme,
            includeConsultations,
            consultations,
            activeLanguage,
            features,
          });
      window.open(url, '_blank');
      trackAnalyticsEvent('pdf_preview_opened', { reading_id: dualReport?.id || report.id });
    } catch (err) {
      console.error('Failed to open PDF:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleSystemPrint = () => {
    trackAnalyticsEvent('system_print_invoked', { reading_id: dualReport?.id || report.id });
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="glass-card max-w-xl w-full p-6 sm:p-8 rounded-3xl border border-[rgba(200,170,110,0.3)] shadow-2xl relative flex flex-col gap-6 bg-[#0B0E1B] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#C8AA6E]/20 border border-[#C8AA6E]/30 flex items-center justify-center text-[#C8AA6E] shrink-0">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#C8AA6E] bg-[#C8AA6E]/10 px-2.5 py-0.5 rounded-full border border-[#C8AA6E]/20">
                  {dualReport ? 'Dual Evolution Folio' : 'Export Document'}
                </span>
                {activeLanguage && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Globe className="w-3 h-3 text-[#C8AA6E]" />
                    {activeLanguage.name} ({activeLanguage.native_name})
                  </span>
                )}
              </div>
              <h3 className="text-xl font-bold text-white mt-1">
                {dualReport ? 'Generate Dual-Hand Evolution Folio' : 'Generate PDF Reading Report'}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-gray-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Report Overview Capsule */}
        <div className="p-4 rounded-2xl bg-[#070913]/90 border border-gray-800/80 flex flex-col gap-2">
          <span className="text-xs text-[#C8AA6E] font-semibold flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            <span>Document Title</span>
          </span>
          <p className="text-sm font-bold text-white line-clamp-1">
            {dualReport ? dualReport.reading_title : report.reading_title}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 pt-1">
            {dualReport ? (
              <>
                <span className="text-purple-300 font-semibold">• Growth Score: {dualReport.growth_index.toFixed(0)}/100</span>
                <span>• 4 Major Creases Synthesized</span>
                <span>• Innate vs. Manifested Contrast</span>
              </>
            ) : (
              <>
                <span>• 3 Verified Creases</span>
                <span>• Comprehensive Reflections</span>
                <span>• {consultations.length} Q&A Inquiries Available</span>
              </>
            )}
          </div>
        </div>

        {/* PDF Styling & Content Options */}
        <div className="flex flex-col gap-4">
          <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
            <Palette className="w-4 h-4 text-[#C8AA6E]" />
            <span>Visual Theme:</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setTheme('midnight')}
              className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                theme === 'midnight'
                  ? 'bg-[#12162A] border-[#C8AA6E] shadow-lg ring-1 ring-[#C8AA6E]/40'
                  : 'bg-[#070913]/60 border-gray-800 text-gray-400 hover:text-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Mystic Midnight</span>
                {theme === 'midnight' && <Check className="w-4 h-4 text-[#C8AA6E]" />}
              </div>
              <span className="text-[11px] text-gray-400">Deep obsidian background with gold filigree</span>
            </button>

            <button
              onClick={() => setTheme('parchment')}
              className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                theme === 'parchment'
                  ? 'bg-amber-50/10 border-[#C8AA6E] shadow-lg ring-1 ring-[#C8AA6E]/40'
                  : 'bg-[#070913]/60 border-gray-800 text-gray-400 hover:text-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Luxe Parchment</span>
                {theme === 'parchment' && <Check className="w-4 h-4 text-[#C8AA6E]" />}
              </div>
              <span className="text-[11px] text-gray-400">Clean light aesthetic for home & office printing</span>
            </button>
          </div>

          {/* Include Consultation Q&A Toggle */}
          {consultations.length > 0 && (
            <label className="mt-2 flex items-center gap-3 p-3.5 rounded-2xl bg-[#070913]/60 border border-gray-800 cursor-pointer hover:border-gray-700 transition-colors">
              <input
                type="checkbox"
                checked={includeConsultations}
                onChange={(e) => setIncludeConsultations(e.target.checked)}
                className="w-4 h-4 accent-[#C8AA6E] rounded"
              />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-[#C8AA6E]" />
                  Include Q&A Consultations ({consultations.length} inquiries)
                </span>
                <span className="text-[11px] text-gray-400">
                  Appends your custom questions on Money, Health & Career to Page 3
                </span>
              </div>
            </label>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 pt-2 border-t border-gray-800">
          {!isUnlocked ? (
            <div className="p-3.5 rounded-2xl bg-[#C8AA6E]/10 border border-[#C8AA6E]/30 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#C8AA6E]">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Deep-Dive 4K Vector Folio Available</span>
                </div>
                <Link
                  href="/pricing?product=premium_report"
                  className="text-[11px] font-bold text-[#C8AA6E] hover:underline flex items-center gap-1"
                >
                  <span>Unlock ($4.99 / ₹399)</span>
                  <ArrowRight className="w-3 h-3 text-[#C8AA6E]" />
                </Link>
              </div>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                Exporting your Standard Palmora Reading Report. Upgrade to include calibrated 4K vector crease overlays, mount contours, and consultation reflections.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Deep-Dive Folio Unlocked • High-Resolution Vector Overlays & Reflections Included</span>
            </div>
          )}

          {/* Primary Download Button - ALWAYS generates a real, viewable PDF */}
          <button
            type="button"
            onClick={handleDownload}
            disabled={generating}
            className="btn-gold w-full py-3.5 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl disabled:opacity-50"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-black" />
                <span>Generating High-Resolution PDF...</span>
              </>
            ) : success ? (
              <>
                <Check className="w-4 h-4 text-black" />
                <span>PDF Downloaded Successfully!</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-black" />
                <span>{isUnlocked ? 'Download Deep-Dive PDF Folio (.pdf)' : 'Download Reading Report (.pdf)'}</span>
              </>
            )}
          </button>

          {/* Secondary Actions: Instant Browser Tab Preview & System Print */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleOpenInNewTab}
              disabled={generating}
              className="py-2.5 px-3 rounded-xl border border-gray-800 bg-[#070913]/80 hover:bg-[#070913] text-xs font-medium text-gray-300 hover:text-white flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              title="Open generated PDF document in a new browser tab"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#C8AA6E]" />
              <span>Preview in Browser</span>
            </button>
            <button
              type="button"
              onClick={handleSystemPrint}
              className="py-2.5 px-3 rounded-xl border border-gray-800 bg-[#070913]/80 hover:bg-[#070913] text-xs font-medium text-gray-300 hover:text-white flex items-center justify-center gap-1.5 transition-colors"
              title="Print reading document using system printer"
            >
              <Printer className="w-3.5 h-3.5 text-[#C8AA6E]" />
              <span>Print via System</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
