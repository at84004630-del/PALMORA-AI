'use client';

import React from 'react';
import {
  Sparkles,
  Heart,
  Briefcase,
  Compass,
  GitCompare,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  Info,
  ShieldCheck,
} from 'lucide-react';
import type { DualHandReadingReport, DivergenceCategory, PalmFeatures } from '@palmora/shared-types';
import DualHandVisualComparison from './DualHandVisualComparison';

interface DualHandEvolutionSectionProps {
  dualReport: DualHandReadingReport;
  onAskQuestionClick?: () => void;
  innateFeatures?: PalmFeatures | null;
  manifestedFeatures?: PalmFeatures | null;
  nonDominantImageUrl?: string | null;
  dominantImageUrl?: string | null;
}

export default function DualHandEvolutionSection({
  dualReport,
  onAskQuestionClick,
  innateFeatures,
  manifestedFeatures,
  nonDominantImageUrl,
  dominantImageUrl,
}: DualHandEvolutionSectionProps) {
  const getDivergenceBadge = (type: DivergenceCategory) => {
    switch (type) {
      case 'aligned':
        return {
          label: 'Balanced Congruence',
          sub: 'Constitutional Stability',
          classes: 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300',
        };
      case 'expanded':
        return {
          label: 'Broadened Expression',
          sub: 'Expanded Horizon',
          classes: 'bg-purple-950/50 border-purple-500/40 text-purple-300',
        };
      case 'recalibrated':
        return {
          label: 'Consciously Focused',
          sub: 'Deliberate Discipline',
          classes: 'bg-amber-950/50 border-amber-500/40 text-amber-300',
        };
      case 'transcended':
        return {
          label: 'Transformed Potential',
          sub: 'Breakthrough Growth',
          classes: 'bg-sky-950/50 border-sky-500/40 text-sky-300',
        };
      default:
        return {
          label: 'Dynamic Evolution',
          sub: 'Lived Adaptation',
          classes: 'bg-gray-900 border-gray-700 text-gray-300',
        };
    }
  };

  const getLineIcon = (lineName: string) => {
    const lower = lineName.toLowerCase();
    if (lower.includes('heart') || lower.includes('love') || lower.includes('emotion')) {
      return <Heart className="w-5 h-5 text-[#F43F5E]" />;
    }
    if (lower.includes('head') || lower.includes('career') || lower.includes('mind') || lower.includes('intellect')) {
      return <Briefcase className="w-5 h-5 text-[#38BDF8]" />;
    }
    return <Compass className="w-5 h-5 text-[#34D399]" />;
  };

  return (
    <div className="w-full flex flex-col gap-8">
      {/* 1. Growth Index & Overview Meter */}
      <div className="glass-card p-8 sm:p-10 rounded-3xl border border-[rgba(200,170,110,0.35)] shadow-2xl relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-8">
        <div className="flex flex-col gap-3 max-w-xl text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/30 bg-purple-950/30 text-[11px] text-purple-300 font-bold uppercase tracking-wider self-center sm:self-start">
            <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
            <span>Dual-Hand Alignment & Manifestation</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Conscious Growth Index
          </h2>

          <p className="text-gray-300 text-xs sm:text-sm leading-relaxed">
            Measures how your conscious choices, lived experiences, and chosen path (Dominant <strong className="text-white capitalize">{dualReport.dominant_hand} Hand</strong>) have elevated and actualized your inborn constitutional baseline (Non-Dominant <strong className="text-white capitalize">{dualReport.non_dominant_hand} Hand</strong>).
          </p>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-gray-400 pt-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
              Non-Dominant: Subconscious Blueprint
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#C8AA6E]" />
              Dominant: Conscious Path
            </span>
          </div>
        </div>

        {/* Index Score Badge */}
        <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-[#070913]/90 border border-gray-800 shadow-xl shrink-0 w-44">
          <span className="text-xs uppercase tracking-widest text-[#C8AA6E] font-bold">
            Growth Score
          </span>
          <div className="flex items-baseline gap-1 my-1">
            <span className="text-5xl font-black text-white">
              {dualReport.growth_index.toFixed(0)}
            </span>
            <span className="text-xs text-gray-500 font-bold">/ 100</span>
          </div>
          <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-gradient-to-r from-purple-500 via-[#C8AA6E] to-emerald-400 rounded-full transition-all duration-1000"
              style={{ width: `${Math.min(100, Math.max(10, dualReport.growth_index))}%` }}
            />
          </div>
          <span className="text-[10px] text-emerald-400 font-semibold mt-2">
            Dynamic Adaptive Growth
          </span>
        </div>
      </div>

      {/* 2. Interactive Visual Crease Comparison Canvas */}
      <DualHandVisualComparison
        nonDominantHand={dualReport.non_dominant_hand}
        dominantHand={dualReport.dominant_hand}
        nonDominantImageUrl={nonDominantImageUrl}
        dominantImageUrl={dominantImageUrl}
        nonDominantFeatures={innateFeatures || dualReport.innate_features}
        dominantFeatures={manifestedFeatures || dualReport.manifested_features}
        comparativeSections={dualReport.comparative_sections}
      />

      {/* 3. Holistic Comparative Evolution Narrative */}
      <div className="glass-card p-8 rounded-3xl border border-gray-800 flex flex-col gap-4">
        <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider text-[#C8AA6E]">
          <GitCompare className="w-4 h-4" />
          <span>Synthesis of Innate Potential vs. Lived Reality</span>
        </div>
        <p className="text-gray-200 text-sm sm:text-base leading-relaxed italic">
          &ldquo;{dualReport.overall_evolution_synthesis}&rdquo;
        </p>
      </div>

      {/* 3. Detailed Comparative Cards (Heart, Head, Life Line Evolutions) */}
      <div className="flex flex-col gap-6">
        {dualReport.comparative_sections.map((section, idx) => {
          const badge = getDivergenceBadge(section.divergence_type);
          return (
            <div
              key={idx}
              className="glass-card p-6 sm:p-8 rounded-3xl border border-gray-800 hover:border-[rgba(200,170,110,0.4)] transition-all shadow-xl flex flex-col gap-5"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-800 pb-4 gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center">
                    {getLineIcon(section.line_name)}
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-white">
                      {section.line_name}
                    </h3>
                    <span className="text-xs text-gray-400">
                      Classical Chirological Divergence Analysis
                    </span>
                  </div>
                </div>

                <div className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex flex-col sm:items-end ${badge.classes}`}>
                  <span>{badge.label}</span>
                  <span className="text-[10px] opacity-80">{badge.sub}</span>
                </div>
              </div>

              {/* Contrast Grid: Innate Blueprint vs Manifested Trajectory */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-[#070913]/80 border border-gray-800/80 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-400">
                    <Compass className="w-3.5 h-3.5" />
                    <span>Innate Blueprint ({dualReport.non_dominant_hand} hand)</span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                    {section.innate_summary}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#0D1122]/80 border border-[rgba(200,170,110,0.25)] flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#C8AA6E]">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Manifested Reality ({dualReport.dominant_hand} hand)</span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                    {section.manifested_summary}
                  </p>
                </div>
              </div>

              {/* Evolutionary Narrative */}
              <div className="p-4 rounded-2xl bg-[#0B0E1B] border border-gray-800 text-xs sm:text-sm text-gray-200 leading-relaxed flex flex-col gap-2">
                <span className="font-semibold text-white flex items-center gap-1.5 text-xs text-[#C8AA6E]">
                  <Sparkles className="w-3.5 h-3.5" />
                  Evolutionary Journey & Conscious Choice:
                </span>
                <p>{section.evolution_narrative}</p>
              </div>

              {/* Actionable Mindful Recommendation */}
              <div className="p-4 rounded-2xl bg-[#070913]/60 border border-gray-800 text-xs text-gray-300 flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-emerald-400">Mindful Growth Guidance:</strong>{' '}
                  {section.growth_recommendation}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Chirological Philosophy Disclaimer */}
      <div className="p-4.5 rounded-2xl bg-[#0B0E1B] border border-gray-800 text-xs text-gray-400 flex items-start gap-3">
        <Info className="w-4 h-4 text-[#C8AA6E] shrink-0 mt-0.5" />
        <p className="leading-relaxed text-[11px]">
          {dualReport.disclaimer}
        </p>
      </div>

      {/* 5. Inquire Deeper Callout */}
      {onAskQuestionClick && (
        <div className="glass-card p-6 sm:p-8 rounded-3xl border border-[rgba(200,170,110,0.3)] bg-gradient-to-r from-[#0B0E1B] via-[#12162A] to-[#070913] flex flex-col sm:flex-row items-center justify-between gap-5 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#C8AA6E]/20 border border-[#C8AA6E]/40 flex items-center justify-center text-[#C8AA6E] shrink-0">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Have questions about your dual hand evolution?</h3>
              <p className="text-xs text-gray-300 mt-1 max-w-lg leading-relaxed">
                Ask our grounded consultative intelligence about specific line differences, career directions, or relationship dynamics.
              </p>
            </div>
          </div>
          <button
            onClick={onAskQuestionClick}
            className="btn-gold px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shrink-0 shadow-lg"
          >
            <span>Ask Questions</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
