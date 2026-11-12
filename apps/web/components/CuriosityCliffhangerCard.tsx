'use client';

import React from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Lock,
  ArrowRight,
  TrendingUp,
  Clock,
  Compass,
  FileText,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface CuriosityCliffhangerCardProps {
  onUnlockClick: (product?: 'premium_report' | 'dual_hand_report') => void;
  isDualReading?: boolean;
}

export default function CuriosityCliffhangerCard({
  onUnlockClick,
  isDualReading = false,
}: CuriosityCliffhangerCardProps) {
  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* 1. Life-Phase Age Transition Windows Teaser */}
      <div className="glass-card p-6 sm:p-8 rounded-3xl border border-[rgba(200,170,110,0.35)] shadow-2xl relative overflow-hidden bg-gradient-to-br from-[#0B0E1B] via-[#070913] to-[#12162A]">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-[#C8AA6E]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-gray-800/80 pb-5">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#C8AA6E]/20 border border-[#C8AA6E]/40 flex items-center justify-center text-[#C8AA6E] shrink-0 shadow-lg">
              <Clock className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#C8AA6E] bg-[#C8AA6E]/10 px-2.5 py-0.5 rounded-full border border-[#C8AA6E]/20">
                  Calculated Crease Chronometry
                </span>
                <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Observable Bifurcations
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white mt-1">
                Life-Phase Transition Windows Detected
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onUnlockClick('premium_report')}
            className="btn-gold px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-xl shrink-0 hover:scale-105 transition-transform"
          >
            <span>Unlock Full Roadmap</span>
            <ArrowRight className="w-3.5 h-3.5 text-black" />
          </button>
        </div>

        {/* Locked Frosted Age Milestones Preview */}
        <div className="relative mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 filter blur-[3.5px] select-none opacity-60 pointer-events-none">
            {/* Age Window 1 */}
            <div className="p-4 rounded-2xl bg-[#070913]/90 border border-gray-800 flex flex-col gap-2">
              <span className="text-xs font-bold text-[#C8AA6E] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Ages 27 – 32 (First Bifurcation)
              </span>
              <p className="text-xs text-gray-300">
                Noticeable deflection in Head Line trajectory toward the Mount of Mercury indicates a decisive vocational realignment.
              </p>
              <span className="text-[10px] text-gray-400 font-mono">Radial Coord: x=0.48, arc=1.12</span>
            </div>

            {/* Age Window 2 */}
            <div className="p-4 rounded-2xl bg-[#070913]/90 border border-gray-800 flex flex-col gap-2">
              <span className="text-xs font-bold text-rose-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Ages 38 – 44 (Integration Phase)
              </span>
              <p className="text-xs text-gray-300">
                Deepening intersection between Fate column and Heart line signals emotional stability anchoring long-term creative projects.
              </p>
              <span className="text-[10px] text-gray-400 font-mono">Chord Alignment: 0.64 ratio</span>
            </div>

            {/* Age Window 3 */}
            <div className="p-4 rounded-2xl bg-[#070913]/90 border border-gray-800 flex flex-col gap-2">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Ages 50+ (Legacy & Vitality)
              </span>
              <p className="text-xs text-gray-300">
                Widening sweep around Thenar eminence reflects sustained physical stamina and mentor-oriented wisdom dissemination.
              </p>
              <span className="text-[10px] text-gray-400 font-mono">Radial Sweep: 0.40 circumference</span>
            </div>
          </div>

          {/* Floating Callout Overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center z-10">
            <div className="w-11 h-11 rounded-2xl bg-[#C8AA6E]/20 border border-[#C8AA6E]/40 flex items-center justify-center text-[#C8AA6E] mb-2 shadow-lg">
              <Lock className="w-5 h-5" />
            </div>
            <h4 className="text-sm sm:text-base font-bold text-white mb-1">
              Timing Windows & Milestone Roadmaps are Reserved for Deep-Dive Readers
            </h4>
            <p className="text-xs text-gray-300 max-w-md mb-3 leading-relaxed">
              Unlock your hand’s calibrated chronological arc deflection points, Mount Topography elevations, and 5 interactive consultation inquiries.
            </p>
            <button
              type="button"
              onClick={() => onUnlockClick('premium_report')}
              className="btn-gold py-2.5 px-6 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-xl hover:scale-105 transition-all"
            >
              <Zap className="w-3.5 h-3.5 text-black" />
              <span>Unlock Deep-Dive ($4.99 / ₹399)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Dual-Hand Comparative Evolution Hook (Only shown if single hand was analyzed) */}
      {!isDualReading && (
        <div className="glass-card p-6 sm:p-8 rounded-3xl border border-purple-500/30 shadow-2xl relative overflow-hidden bg-gradient-to-r from-purple-950/40 via-[#0B0E1B] to-[#070913]">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0 shadow-lg">
                <Compass className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 bg-purple-950/60 px-2.5 py-0.5 rounded-full border border-purple-500/30">
                    Traditional Chirology Rule
                  </span>
                  <span className="text-xs text-gray-400">Left vs. Right Hand Synergy</span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white mt-1">
                  Innate Potential vs. Manifested Lived Reality
                </h3>
                <p className="text-xs text-gray-300 mt-1 max-w-xl leading-relaxed">
                  Your current reading reflects your active conscious choices. But your non-dominant palm holds your innate subconscious baseline. Compare both hands side-by-side to calculate your personal <strong>Growth & Alignment Score</strong>.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onUnlockClick('dual_hand_report')}
              className="py-3 px-6 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-xl shrink-0 transition-transform hover:scale-105"
            >
              <Sparkles className="w-4 h-4 text-purple-200" />
              <span>Unlock Dual Evolution ($6.99 / ₹549)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
