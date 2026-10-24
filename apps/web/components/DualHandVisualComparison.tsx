'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Compass,
  Heart,
  Briefcase,
  Activity,
  TrendingUp,
  MoveHorizontal,
  Columns2,
} from 'lucide-react';
import type {
  PalmFeatures,
  DualHandReadingReport,
  DivergenceCategory,
  DualHandComparisonSection,
  CreaseFeature,
} from '@palmora/shared-types';
import PalmOverlayCanvas from './PalmOverlayCanvas';
import DualHandSplitSlider from './DualHandSplitSlider';

interface DualHandVisualComparisonProps {
  dualReport?: DualHandReadingReport;
  nonDominantHand?: 'left' | 'right' | string;
  dominantHand?: 'left' | 'right' | string;
  nonDominantImageUrl?: string | null;
  dominantImageUrl?: string | null;
  nonDominantFeatures?: PalmFeatures | null;
  dominantFeatures?: PalmFeatures | null;
  innateFeatures?: PalmFeatures | null;
  manifestedFeatures?: PalmFeatures | null;
  innateImageUrl?: string | null;
  manifestedImageUrl?: string | null;
  comparativeSections?: DualHandComparisonSection[];
}

const createFallbackCrease = (name: string, status: any = 'detected'): CreaseFeature => ({
  name,
  status: status || 'detected',
  path: [],
  pixel_path: [],
  measurements: {},
  detector_version: 'multiscale_crease_extractor_v1.3',
  quality_score: 0.85,
  confidence: 0.85,
  uncertainty_factors: [],
  failure_reason: null,
  confidence_explanation: 'Synthesized geometric trace',
});

export default function DualHandVisualComparison({
  dualReport,
  nonDominantHand,
  dominantHand,
  nonDominantImageUrl,
  dominantImageUrl,
  nonDominantFeatures,
  dominantFeatures,
  innateFeatures,
  manifestedFeatures,
  innateImageUrl,
  manifestedImageUrl,
  comparativeSections,
}: DualHandVisualComparisonProps) {
  const [focusedLine, setFocusedLine] = useState<'all' | 'heart' | 'head' | 'life' | 'fate'>('all');
  const [viewMode, setViewMode] = useState<'split_slider' | 'side_by_side'>('split_slider');

  const ndHand = nonDominantHand || dualReport?.non_dominant_hand || 'left';
  const domHand = dominantHand || dualReport?.dominant_hand || 'right';
  const ndImage = nonDominantImageUrl || innateImageUrl || null;
  const domImage = dominantImageUrl || manifestedImageUrl || null;
  const sections = comparativeSections || dualReport?.comparative_sections || [];

  const ndFeatures: PalmFeatures =
    nonDominantFeatures ||
    innateFeatures ||
    dualReport?.innate_features || {
      heart_line: createFallbackCrease(
        'Heart Line',
        dualReport?.innate_reading?.love_reading?.feature_status
      ),
      head_line: createFallbackCrease(
        'Head Line',
        dualReport?.innate_reading?.career_reading?.feature_status
      ),
      life_line: createFallbackCrease(
        'Life Line',
        dualReport?.innate_reading?.personality_reading?.feature_status
      ),
      hand_side: ndHand,
    };

  const domFeatures: PalmFeatures =
    dominantFeatures ||
    manifestedFeatures ||
    dualReport?.manifested_features || {
      heart_line: createFallbackCrease(
        'Heart Line',
        dualReport?.manifested_reading?.love_reading?.feature_status
      ),
      head_line: createFallbackCrease(
        'Head Line',
        dualReport?.manifested_reading?.career_reading?.feature_status
      ),
      life_line: createFallbackCrease(
        'Life Line',
        dualReport?.manifested_reading?.personality_reading?.feature_status
      ),
      hand_side: domHand,
    };

  const getDivergenceBadge = (type: DivergenceCategory) => {
    switch (type) {
      case 'aligned':
        return { label: 'Balanced Congruence', classes: 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300' };
      case 'expanded':
        return { label: 'Broadened Expression', classes: 'bg-purple-950/50 border-purple-500/40 text-purple-300' };
      case 'recalibrated':
        return { label: 'Consciously Focused', classes: 'bg-amber-950/50 border-amber-500/40 text-amber-300' };
      case 'self_directed':
        return { label: 'Self-Forged Agency', classes: 'bg-sky-950/50 border-sky-500/40 text-sky-300' };
      case 'emergent':
        return { label: 'Emergent Mastery', classes: 'bg-indigo-950/50 border-indigo-500/40 text-indigo-300' };
      case 'transcended':
        return { label: 'Transformed Potential', classes: 'bg-teal-950/50 border-teal-500/40 text-teal-300' };
      default:
        return { label: 'Adaptive Growth', classes: 'bg-gray-900 border-gray-700 text-gray-300' };
    }
  };

  return (
    <div className="w-full glass-card p-6 sm:p-8 rounded-3xl border border-[rgba(200,170,110,0.3)] shadow-2xl flex flex-col gap-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-800 gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-gold-gradient flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#C8AA6E]" />
            <span>Interactive Visual Comparison</span>
          </span>
          <h3 className="text-xl sm:text-2xl font-extrabold text-white mt-1">
            Palmar Crease Morph & Vector Alignment
          </h3>
          <p className="text-xs text-gray-300 mt-1 max-w-xl">
            Inspect detected crease lines across both palms to visually observe how your manifested hand has adapted from your inborn blueprint.
          </p>
        </div>

        {/* View Mode & Line Filter Tabs */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5">
          {/* Mode Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-black/80 border border-[rgba(200,170,110,0.3)] text-xs">
            <button
              type="button"
              onClick={() => setViewMode('split_slider')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 ${
                viewMode === 'split_slider'
                  ? 'bg-gradient-to-r from-[#C8AA6E] to-[#E6C687] text-black shadow-md font-bold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <MoveHorizontal className="w-3.5 h-3.5" />
              <span>Split Slider</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('side_by_side')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 ${
                viewMode === 'side_by_side'
                  ? 'bg-gradient-to-r from-[#C8AA6E] to-[#E6C687] text-black shadow-md font-bold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span>Side-by-Side</span>
            </button>
          </div>

          {/* Line Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-black/60 border border-gray-800 text-xs">
            <button
              type="button"
              onClick={() => setFocusedLine('all')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
                focusedLine === 'all' ? 'bg-[#C8AA6E] text-black shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              All Lines
            </button>
            <button
              type="button"
              onClick={() => setFocusedLine('heart')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1 ${
                focusedLine === 'heart' ? 'bg-[#F43F5E] text-white shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Heart className="w-3 h-3" />
              <span>Heart</span>
            </button>
            <button
              type="button"
              onClick={() => setFocusedLine('head')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1 ${
                focusedLine === 'head' ? 'bg-[#38BDF8] text-black shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Briefcase className="w-3 h-3" />
              <span>Head</span>
            </button>
            <button
              type="button"
              onClick={() => setFocusedLine('life')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1 ${
                focusedLine === 'life' ? 'bg-[#34D399] text-black shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Activity className="w-3 h-3" />
              <span>Life</span>
            </button>
            <button
              type="button"
              onClick={() => setFocusedLine('fate')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1 ${
                focusedLine === 'fate' ? 'bg-[#F59E0B] text-black shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              <TrendingUp className="w-3 h-3" />
              <span>Fate</span>
            </button>
          </div>
        </div>
      </div>

      {/* Visual Comparator Rendering */}
      {viewMode === 'split_slider' ? (
        <DualHandSplitSlider
          innateFeatures={ndFeatures}
          manifestedFeatures={domFeatures}
          innateImageUrl={ndImage}
          manifestedImageUrl={domImage}
          nonDominantHand={ndHand}
          dominantHand={domHand}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          {/* Hand 1: Innate Baseline */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-indigo-400" />
                <span>Innate Potential ({ndHand} hand)</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 font-mono">
                Baseline Blueprint
              </span>
            </div>

            <div className="rounded-2xl overflow-hidden border border-indigo-500/30 bg-[#070913]/90 shadow-xl">
              <PalmOverlayCanvas
                imageUrl={ndImage}
                features={ndFeatures}
              />
            </div>
          </div>

          {/* Hand 2: Manifested Reality */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-bold text-[#C8AA6E] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#C8AA6E]" />
                <span>Manifested Path ({domHand} hand)</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(200,170,110,0.15)] border border-[rgba(200,170,110,0.3)] text-[#C8AA6E] font-mono">
                Lived Reality
              </span>
            </div>

            <div className="rounded-2xl overflow-hidden border border-[rgba(200,170,110,0.35)] bg-[#070913]/90 shadow-xl">
              <PalmOverlayCanvas
                imageUrl={domImage}
                features={domFeatures}
              />
            </div>
          </div>
        </div>
      )}

      {/* Focused Line Divergence Callout */}
      {focusedLine !== 'all' && (
        <div className="p-4 rounded-2xl bg-[#0B0E1B] border border-gray-800 text-xs flex flex-col gap-2 shadow-lg">
          {sections
            .filter((s) => s.line_name.toLowerCase().includes(focusedLine))
            .map((s, idx) => {
              const badge = getDivergenceBadge(s.divergence_type);
              return (
                <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-white text-sm">{s.line_name}</span>
                    <span className="text-gray-300 text-[11px]">{s.evolution_narrative}</span>
                  </div>
                  <div className={`px-3 py-1.5 rounded-xl border font-semibold shrink-0 text-center ${badge.classes}`}>
                    {badge.label}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
