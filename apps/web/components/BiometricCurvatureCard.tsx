'use client';

import React from 'react';
import Link from 'next/link';
import {
  Compass,
  Sparkles,
  Lock,
  ArrowRight,
  Activity,
  Layers,
  Flame,
  Droplets,
  Wind,
  Mountain,
  Info,
  CheckCircle2,
} from 'lucide-react';
import type { PalmFeatures, CreaseFeature } from '@palmora/shared-types';

interface BiometricCurvatureCardProps {
  features?: PalmFeatures | null;
  dominantHand?: string;
  isUnlocked?: boolean;
}

interface ElementalProfile {
  element: 'Earth' | 'Air' | 'Fire' | 'Water';
  title: string;
  icon: React.ElementType;
  color: string;
  bgGradient: string;
  description: string;
  temperament: string;
}

export default function BiometricCurvatureCard({
  features,
  dominantHand = 'right',
  isUnlocked = false,
}: BiometricCurvatureCardProps) {
  // Extract real measurements or calibrated defaults from CV features
  const heartMeasurements = features?.heart_line?.measurements || {};
  const headMeasurements = features?.head_line?.measurements || {};
  const lifeMeasurements = features?.life_line?.measurements || {};

  const heartCurvature = Number(heartMeasurements.curvature_index ?? 0.22);
  const headCurvature = Number(headMeasurements.curvature_index ?? 0.16);
  const lifeCurvature = Number(lifeMeasurements.curvature_index ?? 0.38);

  const heartDepth = Number(heartMeasurements.relative_depth ?? 0.78);
  const headDepth = Number(headMeasurements.relative_depth ?? 0.72);
  const lifeDepth = Number(lifeMeasurements.relative_depth ?? 0.84);

  const heartAngle = Math.abs(Number(heartMeasurements.orientation_angle_deg ?? 18));
  const headAngle = Math.abs(Number(headMeasurements.orientation_angle_deg ?? 12));
  const lifeAngle = Math.abs(Number(lifeMeasurements.orientation_angle_deg ?? 64));

  // Determine Elemental Archetype based on curvature and orientation metrics
  const determineElementalArchetype = (): ElementalProfile => {
    const avgCurvature = (heartCurvature + headCurvature + lifeCurvature) / 3;
    if (avgCurvature > 0.28) {
      return {
        element: 'Water',
        title: 'Water Intuitive (Jala)',
        icon: Droplets,
        color: '#60A5FA',
        bgGradient: 'from-blue-950/40 via-[#0B0E1B] to-cyan-950/20',
        description: 'Fluid, deeply empathetic crease contours with pronounced arc curvature indicating rich emotional responsiveness and creative sensitivity.',
        temperament: 'Intuitive, perceptive, adaptable to environmental subtleties.',
      };
    } else if (lifeAngle > 60 && heartCurvature > 0.20) {
      return {
        element: 'Fire',
        title: 'Fire Initiator (Agni)',
        icon: Flame,
        color: '#F87171',
        bgGradient: 'from-rose-950/40 via-[#0B0E1B] to-amber-950/20',
        description: 'Steep energetic orientation angles and dynamic contrast depth reflecting high vitality, passionate action, and visionary drive.',
        temperament: 'Passionate, decisive, self-motivating catalyst.',
      };
    } else if (headCurvature < 0.18 && heartCurvature < 0.22) {
      return {
        element: 'Air',
        title: 'Air Analyst (Vayu)',
        icon: Wind,
        color: '#C084FC',
        bgGradient: 'from-purple-950/40 via-[#0B0E1B] to-indigo-950/20',
        description: 'Linear, well-defined chord trajectories with clear continuity ratios, reflecting structured intellectual synthesis and articulative clarity.',
        temperament: 'Objective, analytical, communicative strategist.',
      };
    } else {
      return {
        element: 'Earth',
        title: 'Earth Builder (Prithvi)',
        icon: Mountain,
        color: '#34D399',
        bgGradient: 'from-emerald-950/40 via-[#0B0E1B] to-teal-950/20',
        description: 'Deep, resilient, grounded crease channels with steadfast depth salience, indicating unwavering perseverance and practical craftsmanship.',
        temperament: 'Reliable, grounded, methodical accumulator of enduring value.',
      };
    }
  };

  const archetype = determineElementalArchetype();
  const ArchetypeIcon = archetype.icon;

  return (
    <div className="glass-card rounded-3xl border border-[rgba(200,170,110,0.3)] shadow-2xl relative overflow-hidden bg-[#0B0E1B] p-6 sm:p-8 flex flex-col gap-6">
      {/* Header Capsule */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-5">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#C8AA6E]/15 border border-[#C8AA6E]/30 flex items-center justify-center text-[#C8AA6E] shrink-0 shadow-md">
            <Compass className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#C8AA6E] bg-[#C8AA6E]/10 px-2.5 py-0.5 rounded-full border border-[#C8AA6E]/20">
                Biometric Depth Metrics
              </span>
              <span className="text-xs text-gray-400">Calibrated Chord-Arc Geometry</span>
            </div>
            <h3 className="text-xl font-bold text-white mt-1">
              Curvature Indices & Elemental Archetype
            </h3>
          </div>
        </div>

        {isUnlocked ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Deep-Dive Unlocked</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#C8AA6E]/10 text-[#C8AA6E] border border-[#C8AA6E]/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Deep-Dive Preview</span>
          </span>
        )}
      </div>

      {/* Main Content Area: Gated vs Unlocked */}
      <div className="relative">
        {/* Unlocked / Background Content */}
        <div className={`flex flex-col gap-6 transition-all duration-300 ${!isUnlocked ? 'filter blur-sm select-none pointer-events-none' : ''}`}>
          {/* Elemental Archetype Card */}
          <div className={`p-5 rounded-2xl bg-gradient-to-br ${archetype.bgGradient} border border-gray-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4`}>
            <div className="flex items-start gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg border"
                style={{ backgroundColor: `${archetype.color}15`, borderColor: `${archetype.color}40`, color: archetype.color }}
              >
                <ArchetypeIcon className="w-7 h-7" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Dominant Palm Configuration
                </span>
                <h4 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>{archetype.title}</span>
                </h4>
                <p className="text-xs text-gray-300 leading-relaxed max-w-xl">
                  {archetype.description}
                </p>
              </div>
            </div>

            <div className="sm:self-stretch flex sm:flex-col justify-center items-end border-t sm:border-t-0 sm:border-l border-gray-800/80 pt-3 sm:pt-0 sm:pl-5 shrink-0">
              <span className="text-[11px] text-gray-400">Core Temperament</span>
              <span className="text-xs font-bold text-white text-right mt-0.5" style={{ color: archetype.color }}>
                {archetype.element} Nature
              </span>
            </div>
          </div>

          {/* 3 Crease Curvature Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Heart Line Curvature Card */}
            <div className="p-4 rounded-2xl bg-[#070913]/90 border border-gray-800/80 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-gray-800/60 pb-2.5">
                <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  Heart Line Arc
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">
                  {heartAngle.toFixed(1)}° Deflection
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-gray-400">Chord-Arc Deviation</span>
                <span className="text-xl font-bold font-mono text-white">{(heartCurvature * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-900 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-rose-500 to-pink-400 h-2 rounded-full"
                  style={{ width: `${Math.min(100, heartCurvature * 250)}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-gray-400">
                <span>Contrast Depth: {(heartDepth * 100).toFixed(0)}%</span>
                <span className="text-gray-300">{heartCurvature > 0.2 ? 'Deep Sweeping Arc' : 'Moderate Arc'}</span>
              </div>
            </div>

            {/* Head Line Curvature Card */}
            <div className="p-4 rounded-2xl bg-[#070913]/90 border border-gray-800/80 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-gray-800/60 pb-2.5">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  Head Line Slope
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                  {headAngle.toFixed(1)}° Angle
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-gray-400">Linearity Score</span>
                <span className="text-xl font-bold font-mono text-white">{(headCurvature * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-900 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-500 to-yellow-400 h-2 rounded-full"
                  style={{ width: `${Math.min(100, headCurvature * 300)}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-gray-400">
                <span>Contrast Depth: {(headDepth * 100).toFixed(0)}%</span>
                <span className="text-gray-300">{headCurvature < 0.15 ? 'Linear Pragmatic' : 'Creative Sloped'}</span>
              </div>
            </div>

            {/* Life Line Curvature Card */}
            <div className="p-4 rounded-2xl bg-[#070913]/90 border border-gray-800/80 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-gray-800/60 pb-2.5">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  Life Line Radius
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  {lifeAngle.toFixed(1)}° Descent
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-gray-400">Circumference Sweep</span>
                <span className="text-xl font-bold font-mono text-white">{(lifeCurvature * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-900 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2 rounded-full"
                  style={{ width: `${Math.min(100, lifeCurvature * 200)}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-gray-400">
                <span>Contrast Depth: {(lifeDepth * 100).toFixed(0)}%</span>
                <span className="text-gray-300">{lifeCurvature > 0.35 ? 'Generous Vitality' : 'Focused Vitality'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Lock Overlay when not unlocked */}
        {!isUnlocked && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-black/40 backdrop-blur-md rounded-2xl border border-[#C8AA6E]/30 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-[#C8AA6E]/15 border border-[#C8AA6E]/40 flex items-center justify-center text-[#C8AA6E] mb-3 shadow-lg">
              <Lock className="w-7 h-7" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-[#C8AA6E] bg-[#C8AA6E]/10 px-3 py-1 rounded-full border border-[#C8AA6E]/20 mb-2">
              Deep-Dive Report Exclusive
            </span>
            <h4 className="text-xl font-bold text-white mb-2">
              Unlock Calibrated Biometric Curvature & Elemental Archetype
            </h4>
            <p className="text-xs sm:text-sm text-gray-300 max-w-md mb-5 leading-relaxed">
              Discover your hand's physical chord-arc deflection indices, contrast depth salience, and your classic Elemental Archetype (Earth, Air, Fire, Water).
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <Link
                href="/pricing?product=premium_report"
                className="btn-gold py-3 px-6 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl hover:scale-105 transition-transform w-full sm:w-auto"
              >
                <span>Unlock Deep-Dive Report ($4.99 / ₹399)</span>
                <ArrowRight className="w-4 h-4 text-black" />
              </Link>
              <Link
                href="/pricing"
                className="py-3 px-5 rounded-2xl text-xs font-semibold text-gray-300 hover:text-white bg-[#070913]/80 border border-gray-800 hover:border-gray-700 transition-colors w-full sm:w-auto text-center"
              >
                Compare All Plans
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
