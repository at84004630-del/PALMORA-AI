'use client';

import React from 'react';
import type { ElementalConstitution } from '@palmora/shared-types';

interface ElementalHandTypeCardProps {
  constitution: ElementalConstitution;
  className?: string;
}

export function ElementalHandTypeCard({ constitution, className = '' }: ElementalHandTypeCardProps) {
  const {
    hand_type,
    element_name,
    element_symbol,
    palm_aspect_ratio,
    digit_to_palm_ratio,
    skin_texture,
    elemental_description,
    archetypal_traits,
    balancing_lifestyle_practices,
  } = constitution;

  const elementTheme = {
    earth: {
      border: 'border-emerald-500/30',
      bgGradient: 'from-emerald-950/25 via-stone-900/60 to-black/80',
      badgeBg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
      accentText: 'text-emerald-400',
      glow: 'shadow-[0_0_30px_rgba(16,185,129,0.12)]',
    },
    air: {
      border: 'border-cyan-500/30',
      bgGradient: 'from-cyan-950/25 via-stone-900/60 to-black/80',
      badgeBg: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
      accentText: 'text-cyan-400',
      glow: 'shadow-[0_0_30px_rgba(6,182,212,0.12)]',
    },
    fire: {
      border: 'border-amber-500/30',
      bgGradient: 'from-amber-950/25 via-stone-900/60 to-black/80',
      badgeBg: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
      accentText: 'text-amber-400',
      glow: 'shadow-[0_0_30px_rgba(245,158,11,0.12)]',
    },
    water: {
      border: 'border-blue-500/30',
      bgGradient: 'from-blue-950/25 via-stone-900/60 to-black/80',
      badgeBg: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
      accentText: 'text-blue-400',
      glow: 'shadow-[0_0_30px_rgba(59,130,246,0.12)]',
    },
  }[hand_type] || {
    border: 'border-gold-500/30',
    bgGradient: 'from-gold-950/25 via-stone-900/60 to-black/80',
    badgeBg: 'bg-gold-500/10 text-gold-300 border-gold-500/30',
    accentText: 'text-gold-400',
    glow: 'shadow-[0_0_30px_rgba(217,119,6,0.12)]',
  };

  const textureDescriptions: Record<string, string> = {
    fine: 'Fine Micro-Relief (Highly sensitive nervous attunement and nuanced sensory reception)',
    medium: 'Balanced Palmar Grain (Adaptive somatic resilience and steady constitutional vigor)',
    coarse: 'Sturdy Ridge Topography (Exceptional physical endurance, stamina, and grounded constitution)',
  };

  return (
    <div
      className={`rounded-2xl border ${elementTheme.border} bg-gradient-to-br ${elementTheme.bgGradient} p-6 sm:p-7 backdrop-blur-md ${elementTheme.glow} ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-2xl" role="img" aria-label={element_name}>
              {element_symbol}
            </span>
            <span
              className={`text-xs uppercase tracking-widest font-semibold px-2.5 py-1 rounded-full border ${elementTheme.badgeBg}`}
            >
              Classical Palmar Constitution
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-serif text-white tracking-wide">
            {element_name}
          </h3>
        </div>

        {/* Morphometric Biometric Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-center">
            <p className="text-[10px] uppercase tracking-wider text-stone-400">Palm Aspect</p>
            <p className="text-sm font-mono font-medium text-white">{palm_aspect_ratio.toFixed(2)}</p>
          </div>
          <div className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-center">
            <p className="text-[10px] uppercase tracking-wider text-stone-400">Digit Ratio</p>
            <p className="text-sm font-mono font-medium text-white">{digit_to_palm_ratio.toFixed(2)}</p>
          </div>
          <div className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-center">
            <p className="text-[10px] uppercase tracking-wider text-stone-400">Skin Texture</p>
            <p className="text-sm font-mono font-medium capitalize text-white">{skin_texture}</p>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="py-5 text-sm text-stone-300 leading-relaxed border-b border-white/10">
        {elemental_description}
      </div>

      {/* Dermatoglyphic Note */}
      <div className="py-4 text-xs text-stone-400 border-b border-white/10 flex items-start gap-2.5">
        <span className="text-base text-gold-400">◎</span>
        <div>
          <span className="font-semibold text-stone-200">Dermatoglyphic Texture:</span>{' '}
          {textureDescriptions[skin_texture] || skin_texture}
        </div>
      </div>

      {/* Traits and Practices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-5">
        {/* Archetypal Traits */}
        <div>
          <h4 className="text-xs uppercase tracking-wider text-stone-400 font-semibold mb-3 flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${elementTheme.accentText} bg-current`} />
            Constitutional Strengths
          </h4>
          <ul className="space-y-2">
            {archetypal_traits.map((trait, idx) => (
              <li key={idx} className="text-xs text-stone-300 flex items-start gap-2">
                <span className={`${elementTheme.accentText} mt-0.5`}>•</span>
                <span>{trait}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Balancing Practices */}
        <div>
          <h4 className="text-xs uppercase tracking-wider text-stone-400 font-semibold mb-3 flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${elementTheme.accentText} bg-current`} />
            Lifestyle Balancing Practices
          </h4>
          <ul className="space-y-2">
            {balancing_lifestyle_practices.map((practice, idx) => (
              <li key={idx} className="text-xs text-stone-300 flex items-start gap-2">
                <span className={`${elementTheme.accentText} mt-0.5`}>✦</span>
                <span>{practice}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
