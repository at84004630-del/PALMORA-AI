'use client';

import React, { useState } from 'react';
import {
  Hand,
  CheckCircle2,
  AlertTriangle,
  Sun,
  Maximize2,
  Sparkles,
  X,
  ArrowRight,
  ShieldCheck,
  Camera,
  Upload,
} from 'lucide-react';

interface PalmFramingGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  dominantHand?: 'left' | 'right';
  targetHandLabel?: string;
}

export function PalmFramingGuideModal({
  isOpen,
  onClose,
  dominantHand = 'right',
  targetHandLabel = 'Palm',
}: PalmFramingGuideModalProps) {
  const [activeTab, setActiveTab] = useState<'framing' | 'lighting' | 'hands'>('framing');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#0B0E1B] border border-[rgba(200,170,110,0.3)] shadow-[0_0_50px_rgba(0,0,0,0.8)] text-white p-6 sm:p-8 flex flex-col gap-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          aria-label="Close guide"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex flex-col gap-1.5 pr-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[rgba(200,170,110,0.12)] border border-[rgba(200,170,110,0.3)] text-[#C8AA6E] text-xs font-semibold w-fit">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Optimal Biometric Scanning Guide</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold font-serif text-white tracking-wide">
            How to Frame Your {targetHandLabel} for Maximum Precision
          </h2>
          <p className="text-xs sm:text-sm text-gray-300">
            Our computer-vision engine extracts sub-millimeter crease trajectories. Following these simple steps guarantees accurate line detection and deep readings.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-gray-800 pb-2">
          <button
            onClick={() => setActiveTab('framing')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'framing'
                ? 'bg-[rgba(200,170,110,0.2)] text-[#C8AA6E] border border-[rgba(200,170,110,0.4)]'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            1. Distance & Framing
          </button>
          <button
            onClick={() => setActiveTab('lighting')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'lighting'
                ? 'bg-[rgba(200,170,110,0.2)] text-[#C8AA6E] border border-[rgba(200,170,110,0.4)]'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            2. Lighting & Clarity
          </button>
          <button
            onClick={() => setActiveTab('hands')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'hands'
                ? 'bg-[rgba(200,170,110,0.2)] text-[#C8AA6E] border border-[rgba(200,170,110,0.4)]'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            3. Left vs Right Palm
          </button>
        </div>

        {/* Tab 1: Distance & Framing */}
        {activeTab === 'framing' && (
          <div className="flex flex-col gap-5">
            {/* Visual Contrast Cards: Good vs Bad */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* The Ideal Frame */}
              <div className="p-4 rounded-2xl bg-emerald-950/25 border border-emerald-500/30 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Ideal Framing (65-75% Fill)
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold">
                    Optimal
                  </span>
                </div>
                {/* SVG Visual Representation */}
                <div className="relative aspect-[4/3] rounded-xl bg-black/60 border border-emerald-500/20 flex items-center justify-center overflow-hidden">
                  <svg viewBox="0 0 200 150" className="w-4/5 h-4/5 text-emerald-400">
                    {/* Bounding reticle */}
                    <rect x="25" y="15" width="150" height="120" rx="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.4" />
                    {/* Palm shape filling 70% */}
                    <path
                      d="M 75 135 C 70 120, 50 100, 40 85 C 32 75, 40 68, 52 75 L 65 80 L 68 40 C 70 32, 82 32, 85 40 L 88 78 L 96 30 C 98 22, 110 22, 112 30 L 115 78 L 124 38 C 126 30, 138 30, 140 38 L 142 82 L 148 55 C 150 48, 160 50, 160 60 C 160 85, 145 110, 125 135 Z"
                      fill="rgba(16, 185, 129, 0.15)"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    {/* Wrist line indicator */}
                    <line x1="70" y1="135" x2="130" y2="135" stroke="#34D399" strokeWidth="2.5" />
                    <text x="100" y="146" textAnchor="middle" fill="#34D399" fontSize="9" fontWeight="bold">Wrist Baseline</text>
                  </svg>
                </div>
                <ul className="text-xs text-gray-300 space-y-1">
                  <li className="flex items-start gap-1.5">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span><strong>Wrist at the bottom:</strong> Keep your wrist near the lower edge of the frame.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span><strong>65% to 75% frame fill:</strong> Palm should feel large and prominent, not tiny.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span><strong>Flat, open fingers:</strong> Keep fingers spread naturally so palm mounts stay flat.</span>
                  </li>
                </ul>
              </div>

              {/* Common Framing Mistakes */}
              <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400" /> Common Mistakes
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold">
                    To Avoid
                  </span>
                </div>
                {/* SVG Visual Representation of Bad Framing */}
                <div className="relative aspect-[4/3] rounded-xl bg-black/60 border border-amber-500/20 flex items-center justify-center overflow-hidden">
                  <svg viewBox="0 0 200 150" className="w-4/5 h-4/5 text-amber-400">
                    {/* Tiny hand in the distance */}
                    <g transform="translate(60, 45) scale(0.38)">
                      <path
                        d="M 75 135 C 70 120, 50 100, 40 85 C 32 75, 40 68, 52 75 L 65 80 L 68 40 C 70 32, 82 32, 85 40 L 88 78 L 96 30 C 98 22, 110 22, 112 30 L 115 78 L 124 38 C 126 30, 138 30, 140 38 L 142 82 L 148 55 C 150 48, 160 50, 160 60 C 160 85, 145 110, 125 135 Z"
                        fill="rgba(245, 158, 11, 0.15)"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      />
                    </g>
                    {/* Warning overlay badge */}
                    <rect x="35" y="110" width="130" height="24" rx="6" fill="rgba(15, 23, 42, 0.85)" stroke="#F59E0B" strokeWidth="1" />
                    <text x="100" y="126" textAnchor="middle" fill="#F59E0B" fontSize="9" fontWeight="bold">Too Far: Creases Blur Out</text>
                  </svg>
                </div>
                <ul className="text-xs text-gray-300 space-y-1">
                  <li className="flex items-start gap-1.5">
                    <span className="text-amber-400 font-bold">✕</span>
                    <span><strong>Hand held too far away:</strong> When hand is tiny, camera resolution cannot distinguish minor lines.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-amber-400 font-bold">✕</span>
                    <span><strong>Cupped or curled hand:</strong> Bending your hand creates artificial crease shadows.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-amber-400 font-bold">✕</span>
                    <span><strong>Tilted at an angle:</strong> Hold palm parallel to the screen so perspective is true.</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Quick 3-Step Action Guide */}
            <div className="p-4 rounded-2xl bg-[#070913] border border-gray-800 text-xs text-gray-300 flex flex-col gap-2.5">
              <span className="font-semibold text-[#C8AA6E] flex items-center gap-1.5 text-sm">
                <Sparkles className="w-4 h-4" /> 3 Golden Rules for Instant Alignment
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-white font-bold text-[11px]">1. Arm&apos;s Length</span>
                  <span className="text-[11px] text-gray-400">Hold your hand 35–45 cm from your camera until your palm comfortably fills the guide reticle.</span>
                </div>
                <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-white font-bold text-[11px]">2. Watch the Reticle</span>
                  <span className="text-[11px] text-gray-400">The guide turns luminous green with a checkmark the moment your hand is in the optimal focal zone.</span>
                </div>
                <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-white font-bold text-[11px]">3. Hands-Free Auto-Snap</span>
                  <span className="text-[11px] text-gray-400">Hold steady for 1 second! The 3-second countdown triggers automatically without camera wobble.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Lighting & Clarity */}
        {activeTab === 'lighting' && (
          <div className="flex flex-col gap-5 text-xs text-gray-300">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-[#0D1122] border border-gray-800 flex flex-col gap-2.5">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <Sun className="w-5 h-5" />
                  <span>Diffuse, Ambient Light</span>
                </div>
                <p className="text-[11px] text-gray-400">
                  Natural daylight from a window or balanced ceiling lighting is best. It reveals the natural depth of your Heart, Head, and Life lines without creating blinding hot spots.
                </p>
                <div className="mt-2 p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/20 text-emerald-300 text-[11px]">
                  💡 <strong>Tip:</strong> If using a laptop at night, face your desk lamp or increase screen brightness to gently illuminate your palm.
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#0D1122] border border-gray-800 flex flex-col gap-2.5">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                  <AlertTriangle className="w-5 h-5" />
                  <span>Avoid Harsh Flash & Deep Shadows</span>
                </div>
                <p className="text-[11px] text-gray-400">
                  Direct phone camera flashes bounce off the skin, causing white specular glare that washes out the delicate secondary creases and Apollo line.
                </p>
                <div className="mt-2 p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/20 text-amber-300 text-[11px]">
                  ⚠️ <strong>Avoid:</strong> Direct backlight (e.g. sitting with a bright sunny window directly behind you, casting your hand in shadow).
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#070913] border border-gray-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[rgba(200,170,110,0.15)] flex items-center justify-center text-[#C8AA6E] shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-white font-bold text-xs">Automated Real-Time Quality Check</span>
                  <span className="text-[11px] text-gray-400">
                    Our live scanner tests exposure, sharpness, and hand presence 4 times every second and lets you know instantly if more light is needed.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Left vs Right Palm */}
        {activeTab === 'hands' && (
          <div className="flex flex-col gap-5 text-xs text-gray-300">
            <div className="p-4.5 rounded-2xl bg-[rgba(200,170,110,0.08)] border border-[rgba(200,170,110,0.25)] flex flex-col gap-2">
              <span className="font-bold text-white text-sm flex items-center gap-2">
                <Hand className="w-4 h-4 text-[#C8AA6E]" />
                Which Palm Should You Scan?
              </span>
              <p className="text-xs text-gray-300 leading-relaxed">
                In classical chiromancy and our algorithmic comparative analysis, your two hands represent two distinct dimensions of your life:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-[#0D1122] border border-gray-800 flex flex-col gap-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  Non-Dominant Palm (Innate Blueprint)
                </span>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Reflects your innate potential, inherited archetypes, subconscious inclinations, and constitutional baseline given at birth.
                </p>
                <span className="text-[10px] text-purple-300 mt-auto font-medium">
                  {dominantHand === 'right' ? 'Left Hand (for right-handed persons)' : 'Right Hand (for left-handed persons)'}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-[#0D1122] border border-gray-800 flex flex-col gap-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#C8AA6E]" />
                  Dominant Palm (Manifested Reality)
                </span>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Reflects the conscious choices, active habits, lived trajectory, and reality you are actively co-creating in the world today.
                </p>
                <span className="text-[10px] text-[#C8AA6E] mt-auto font-medium">
                  {dominantHand === 'right' ? 'Right Hand (Active hand)' : 'Left Hand (Active hand)'}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#070913] border border-gray-800 text-[11px] text-gray-400 flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-[#C8AA6E] shrink-0" />
              <span>
                <strong>Dual-Hand Synthesis:</strong> In Dual Scan mode, scanning both hands unlocks your <strong>Growth & Free-Will Index</strong>, mapping where your choices have evolved beyond your baseline.
              </span>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-800">
          <span className="text-[11px] text-gray-400">
            Tip: You can re-open this guide anytime from the scanner.
          </span>
          <button
            onClick={onClose}
            className="btn-gold px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg"
          >
            <span>Got it, Let&apos;s Scan</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
