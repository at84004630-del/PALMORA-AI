'use client';

import React, { useState, useEffect } from 'react';
import type {
  PalmReadingReport,
  RelationalSynastryReport,
  RelationshipCategory,
  RelationalDimensionComparison,
} from '@palmora/shared-types';
import { generateRelationalSynastry } from '../lib/api';
import { getLocalReadings, saveLocalSynastryReport, getLocalSynastryReports } from '../lib/storage';

export function RelationalSynastryView() {
  const [readings, setReadings] = useState<PalmReadingReport[]>([]);
  const [personAName, setPersonAName] = useState<string>('Partner A');
  const [personBName, setPersonBName] = useState<string>('Partner B');
  const [selectedScanAId, setSelectedScanAId] = useState<string>('');
  const [selectedScanBId, setSelectedScanBId] = useState<string>('');
  const [relCategory, setRelCategory] = useState<RelationshipCategory>('romantic');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [synastryReport, setSynastryReport] = useState<RelationalSynastryReport | null>(null);

  useEffect(() => {
    const list = getLocalReadings();
    setReadings(list);
    if (list.length >= 2) {
      setSelectedScanAId(list[0].id);
      setSelectedScanBId(list[1].id);
    } else if (list.length === 1) {
      setSelectedScanAId(list[0].id);
      setSelectedScanBId(list[0].id);
    }

    const pastReports = getLocalSynastryReports();
    if (pastReports.length > 0) {
      setSynastryReport(pastReports[0]);
    }
  }, []);

  const handleComputeSynastry = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const scanA = readings.find((r) => r.id === selectedScanAId);
      const scanB = readings.find((r) => r.id === selectedScanBId);

      // Default synthetic features if no reading selected or scan has no features
      const defaultFeat = (name: string) => ({
        heart_line: {
          name: 'Heart Line',
          status: 'detected' as const,
          path: [],
          measurements: { length_ratio: 0.52, curvature_index: 1.14 },
          confidence: 0.8,
          confidence_explanation: 'Valid sample',
        },
        head_line: {
          name: 'Head Line',
          status: 'detected' as const,
          path: [],
          measurements: { length_ratio: 0.55, curvature_index: 1.06 },
          confidence: 0.8,
          confidence_explanation: 'Valid sample',
        },
        life_line: {
          name: 'Life Line',
          status: 'detected' as const,
          path: [],
          measurements: { length_ratio: 0.60, curvature_index: 1.16 },
          confidence: 0.85,
          confidence_explanation: 'Valid sample',
        },
      });

      const featA = scanA?.features || defaultFeat(personAName);
      const featB = scanB?.features || defaultFeat(personBName);

      const report = await generateRelationalSynastry({
        person_a_features: featA,
        person_b_features: featB,
        person_a_name: personAName || 'Person A',
        person_b_name: personBName || 'Person B',
        relationship_type: relCategory,
      });

      setSynastryReport(report);
      saveLocalSynastryReport(report);
    } catch (err: any) {
      setError(err?.message || 'Failed to compute relational synastry.');
    } finally {
      setIsLoading(false);
    }
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'harmonious':
        return (
          <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            Harmonious Flow
          </span>
        );
      case 'complementary':
        return (
          <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
            Complementary Balance
          </span>
        );
      default:
        return (
          <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
            Dynamic Growth
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Control Configuration Panel */}
      <div className="rounded-2xl border border-white/10 bg-stone-900/60 p-6 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">🤝</span>
              <span className="text-[10px] uppercase tracking-widest text-gold-400 font-semibold">
                Dual-User Compatibility Engine
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif text-white">
              Synastry & Relational Palm Match
            </h2>
            <p className="text-xs text-stone-400 mt-1">
              Compare communication temperaments, emotional expression, and lifestyle pacing across two palms.
            </p>
          </div>

          {/* Relationship Category Switcher */}
          <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-xl p-1 text-xs">
            {[
              { id: 'romantic', label: '💑 Romantic' },
              { id: 'business_partners', label: '💼 Co-Founders' },
              { id: 'friendship', label: '🌱 Friendship' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setRelCategory(cat.id as RelationshipCategory)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  relCategory === cat.id
                    ? 'bg-gold-500/20 text-gold-300 border border-gold-500/40 shadow-[0_0_12px_rgba(217,119,6,0.2)]'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dual Input Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
          {/* Person A */}
          <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gold-400">
                Person A
              </span>
              <span className="text-[10px] text-stone-400">First Palm Scan</span>
            </div>
            <input
              type="text"
              value={personAName}
              onChange={(e) => setPersonAName(e.target.value)}
              placeholder="Name or Alias"
              className="w-full bg-stone-900/80 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-stone-400 focus:outline-none focus:border-gold-500/50"
            />
            {readings.length > 0 ? (
              <select
                value={selectedScanAId}
                onChange={(e) => setSelectedScanAId(e.target.value)}
                className="w-full bg-stone-900/80 border border-white/10 rounded-lg px-3 py-2 text-xs text-stone-300 focus:outline-none focus:border-gold-500/50"
              >
                {readings.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.reading_title} ({new Date(r.created_at).toLocaleDateString()})
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-[11px] text-stone-400 italic">
                Using baseline archetype features (Scan hand to link real biometric creases).
              </p>
            )}
          </div>

          {/* Person B */}
          <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                Person B
              </span>
              <span className="text-[10px] text-stone-400">Second Palm Scan</span>
            </div>
            <input
              type="text"
              value={personBName}
              onChange={(e) => setPersonBName(e.target.value)}
              placeholder="Partner / Co-Founder Name"
              className="w-full bg-stone-900/80 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-stone-400 focus:outline-none focus:border-cyan-500/50"
            />
            {readings.length > 0 ? (
              <select
                value={selectedScanBId}
                onChange={(e) => setSelectedScanBId(e.target.value)}
                className="w-full bg-stone-900/80 border border-white/10 rounded-lg px-3 py-2 text-xs text-stone-300 focus:outline-none focus:border-cyan-500/50"
              >
                {readings.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.reading_title} ({new Date(r.created_at).toLocaleDateString()})
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-[11px] text-stone-400 italic">
                Using baseline archetype features (Scan hand to link real biometric creases).
              </p>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleComputeSynastry}
            disabled={isLoading}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-black font-semibold text-sm shadow-[0_0_20px_rgba(217,119,6,0.3)] transition-all disabled:opacity-50"
          >
            {isLoading ? 'Synthesizing Dynamics Matrix...' : 'Compute Relational Synastry'}
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
            {error}
          </div>
        )}
      </div>

      {/* Synastry Report Presentation */}
      {synastryReport && (
        <div className="space-y-6">
          {/* Hero Banner: Synergy Score & Archetypal Dynamic */}
          <div className="rounded-2xl border border-gold-500/30 bg-gradient-to-br from-stone-900/90 via-stone-950 to-black p-6 sm:p-8 backdrop-blur-md shadow-[0_0_40px_rgba(217,119,6,0.12)]">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-center md:text-left">
                <span className="text-xs uppercase tracking-widest text-gold-400 font-semibold">
                  Relational Dynamic Archetype
                </span>
                <h3 className="text-xl sm:text-2xl font-serif text-white font-medium mt-1 mb-2">
                  {synastryReport.archetypal_dynamic}
                </h3>
                <p className="text-xs text-stone-300 max-w-xl leading-relaxed">
                  Comparing the foundational life currents of {synastryReport.person_a_name} and{' '}
                  {synastryReport.person_b_name} across cognitive pacing, emotional vulnerability, and stamina.
                </p>
              </div>

              {/* Circular Gauge */}
              <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-black/50 border border-gold-500/20 min-w-[150px]">
                <div className="text-4xl font-serif font-bold text-gold-400">
                  {Math.round(synastryReport.composite_synergy_score)}%
                </div>
                <div className="text-[10px] uppercase tracking-wider text-stone-400 mt-1">
                  Synergy Index
                </div>
              </div>
            </div>
          </div>

          {/* Three Key Dimensions Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              synastryReport.head_communication,
              synastryReport.heart_emotional,
              synastryReport.life_pacing,
            ].map((dim: RelationalDimensionComparison, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-white/10 bg-stone-900/60 p-5 flex flex-col justify-between backdrop-blur-sm"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-white tracking-wide">
                      {dim.dimension_name.split('&')[0]}
                    </span>
                    {getTierBadge(dim.compatibility_tier)}
                  </div>

                  <div className="space-y-2 mb-4 p-3 rounded-lg bg-black/40 border border-white/5 text-[11px]">
                    <div>
                      <span className="text-gold-400 font-medium">{synastryReport.person_a_name}:</span>{' '}
                      <span className="text-stone-300">{dim.person_a_style}</span>
                    </div>
                    <div>
                      <span className="text-cyan-400 font-medium">{synastryReport.person_b_name}:</span>{' '}
                      <span className="text-stone-300">{dim.person_b_style}</span>
                    </div>
                  </div>

                  <p className="text-xs text-stone-300 leading-relaxed mb-4">
                    {dim.dynamics_narrative}
                  </p>
                </div>

                <div className="pt-3 border-t border-white/10">
                  <p className="text-[10px] uppercase tracking-wider text-gold-400 font-semibold mb-1">
                    Growth Recommendation
                  </p>
                  <p className="text-[11px] text-stone-400 italic leading-normal">
                    {dim.growth_recommendation}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Shared Strengths & Growth Edges */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-6 backdrop-blur-sm">
              <h4 className="text-sm font-semibold text-emerald-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                <span>✦</span> Shared Strengths & Natural Bridges
              </h4>
              <ul className="space-y-2.5">
                {synastryReport.shared_strengths.map((str, i) => (
                  <li key={i} className="text-xs text-stone-300 flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">•</span>
                    <span>{str}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-6 backdrop-blur-sm">
              <h4 className="text-sm font-semibold text-amber-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                <span>✦</span> Collaborative Growth Edges
              </h4>
              <ul className="space-y-2.5">
                {synastryReport.growth_edges.map((edge, i) => (
                  <li key={i} className="text-xs text-stone-300 flex items-start gap-2">
                    <span className="text-amber-400 mt-0.5">•</span>
                    <span>{edge}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Mindfulness Prompts for the Pair */}
          <div className="rounded-2xl border border-gold-500/20 bg-stone-900/40 p-6">
            <h4 className="text-sm font-semibold text-gold-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span>💬</span> Collaborative Mindfulness Inquiries
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {synastryReport.collaborative_prompts.map((prompt, i) => (
                <div key={i} className="p-4 rounded-xl bg-black/40 border border-white/5 text-xs text-stone-300 leading-relaxed italic">
                  "{prompt}"
                </div>
              ))}
            </div>
          </div>

          {/* Ethical Disclaimer */}
          <p className="text-[11px] text-stone-400 italic text-center max-w-2xl mx-auto">
            {synastryReport.disclaimer}
          </p>
        </div>
      )}
    </div>
  );
}
