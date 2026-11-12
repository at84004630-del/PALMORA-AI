'use client';

import React from 'react';
import {
  Sparkles,
  Hand,
  Maximize2,
  ZoomIn,
  Sun,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export type AlignmentStatus =
  | 'no_hand'
  | 'too_far'
  | 'too_close'
  | 'shift_left'
  | 'shift_right'
  | 'too_dark'
  | 'too_bright'
  | 'backlight_glare'
  | 'background_interference'
  | 'optimal';

export type GuideScale = 'compact' | 'normal' | 'closeup';

interface PalmFramingReticleProps {
  handSide: 'left' | 'right';
  targetLabel?: string;
  status: AlignmentStatus;
  statusMessage?: string;
  guideScale: GuideScale;
  autoSnapCountdown: number | null;
  fillPercentage?: number;
  onScaleChange: (scale: GuideScale) => void;
  onCancelCountdown?: () => void;
}

export function PalmFramingReticle({
  handSide,
  targetLabel,
  status,
  statusMessage,
  guideScale,
  autoSnapCountdown,
  fillPercentage,
  onScaleChange,
  onCancelCountdown,
}: PalmFramingReticleProps) {
  const isOptimal = status === 'optimal';
  const isWarning =
    status === 'too_dark' ||
    status === 'too_bright' ||
    status === 'backlight_glare' ||
    status === 'background_interference';

  // Scale multipliers for comfort fit
  const scaleClass =
    guideScale === 'closeup'
      ? 'scale-[1.14]'
      : guideScale === 'compact'
      ? 'scale-[0.88]'
      : 'scale-[1.0]';

  // Colors based on alignment status
  const primaryColor = isOptimal
    ? '#10B981' // Emerald
    : isWarning
    ? '#F59E0B' // Amber
    : '#C8AA6E'; // Celestial Gold

  const fillColor = isOptimal
    ? 'rgba(16, 185, 129, 0.08)'
    : isWarning
    ? 'rgba(245, 158, 11, 0.05)'
    : 'rgba(200, 170, 110, 0.05)';

  const glowClass = isOptimal
    ? 'drop-shadow-[0_0_16px_rgba(16,185,129,0.5)]'
    : isWarning
    ? 'drop-shadow-[0_0_12px_rgba(245,158,11,0.4)]'
    : 'drop-shadow-[0_0_12px_rgba(200,170,110,0.3)]';

  // Status message icon & styles
  const getStatusIcon = () => {
    switch (status) {
      case 'optimal':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 animate-pulse" />;
      case 'too_far':
        return <ZoomIn className="w-4 h-4 text-amber-400" />;
      case 'too_close':
        return <Maximize2 className="w-4 h-4 text-amber-400" />;
      case 'shift_left':
        return <ArrowLeft className="w-4 h-4 text-amber-400 animate-bounce" />;
      case 'shift_right':
        return <ArrowRight className="w-4 h-4 text-amber-400 animate-bounce" />;
      case 'too_dark':
      case 'too_bright':
        return <Sun className="w-4 h-4 text-amber-400" />;
      case 'backlight_glare':
        return <Sun className="w-4 h-4 text-amber-400 animate-pulse" />;
      case 'background_interference':
        return <AlertCircle className="w-4 h-4 text-amber-400" />;
      default:
        return <Hand className="w-4 h-4 text-[#C8AA6E]" />;
    }
  };

  const getStatusText = () => {
    if (statusMessage) return statusMessage;
    switch (status) {
      case 'optimal':
        return '✨ Perfect position! Hold steady...';
      case 'too_far':
        return 'Bring palm closer to camera';
      case 'too_close':
        return 'Move hand back slightly';
      case 'shift_left':
        return 'Shift hand slightly left 👈';
      case 'shift_right':
        return 'Shift hand slightly right 👉';
      case 'too_dark':
        return 'Low light: Face towards a light source';
      case 'too_bright':
        return 'Too much glare: Shield direct light';
      case 'backlight_glare':
        return 'Harsh backlight: Point camera away from lights';
      case 'background_interference':
        return 'Room background detected: Place hand inside guide';
      default:
        return 'Align open palm inside outline';
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3.5 sm:p-5 select-none">
      {/* Top HUD: Scale Presets & Hand Mode */}
      <div className="w-full flex items-center justify-between pointer-events-auto">
        {/* Hand Target Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/75 border border-white/10 backdrop-blur-md text-[11px] font-semibold text-white shadow-lg">
          <Hand className="w-3.5 h-3.5 text-[#C8AA6E]" />
          <span>{targetLabel || (handSide === 'right' ? 'Right Palm' : 'Left Palm')}</span>
        </div>

        {/* Fit / Scale Controls */}
        <div className="inline-flex items-center p-0.5 rounded-xl bg-black/75 border border-white/10 backdrop-blur-md text-[10px] font-medium shadow-lg">
          <button
            type="button"
            onClick={() => onScaleChange('compact')}
            className={`px-2 py-0.5 rounded-lg transition-colors ${
              guideScale === 'compact'
                ? 'bg-[#C8AA6E] text-black font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Compact guide for wide-angle camera or far distance"
          >
            Wide
          </button>
          <button
            type="button"
            onClick={() => onScaleChange('normal')}
            className={`px-2 py-0.5 rounded-lg transition-colors ${
              guideScale === 'normal'
                ? 'bg-[#C8AA6E] text-black font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Standard natural arm's length guide"
          >
            Normal
          </button>
          <button
            type="button"
            onClick={() => onScaleChange('closeup')}
            className={`px-2 py-0.5 rounded-lg transition-colors ${
              guideScale === 'closeup'
                ? 'bg-[#C8AA6E] text-black font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Close-up guide for macro crease detail"
          >
            Close-Up
          </button>
        </div>
      </div>

      {/* Center Biometric Reticle */}
      <div className="relative flex-1 w-full flex items-center justify-center overflow-hidden">
        {/* Biometric Corner HUD Brackets */}
        <div className="absolute inset-2 sm:inset-4 pointer-events-none transition-colors duration-300">
          {/* Top-Left */}
          <div
            className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 rounded-tl-lg transition-colors duration-300"
            style={{ borderColor: isOptimal ? '#10B981' : 'rgba(200, 170, 110, 0.4)' }}
          />
          {/* Top-Right */}
          <div
            className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 rounded-tr-lg transition-colors duration-300"
            style={{ borderColor: isOptimal ? '#10B981' : 'rgba(200, 170, 110, 0.4)' }}
          />
          {/* Bottom-Left */}
          <div
            className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 rounded-bl-lg transition-colors duration-300"
            style={{ borderColor: isOptimal ? '#10B981' : 'rgba(200, 170, 110, 0.4)' }}
          />
          {/* Bottom-Right */}
          <div
            className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 rounded-br-lg transition-colors duration-300"
            style={{ borderColor: isOptimal ? '#10B981' : 'rgba(200, 170, 110, 0.4)' }}
          />
        </div>

        {/* Anatomical Open-Hand Silhouette (Proportional Adult Dimensions) */}
        <svg
          viewBox="0 0 320 440"
          className={`w-full h-full max-h-[82%] max-w-[340px] pointer-events-none transition-all duration-300 ${scaleClass} ${glowClass} ${
            handSide === 'left' ? '' : 'scale-x-[-1]'
          }`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Outer Anatomical Open Hand Contour */}
          <path
            d="M 110 405 C 90 365, 55 315, 38 270 C 22 235, 16 200, 32 185 C 44 172, 62 180, 84 195 L 90 180 C 88 135, 90 95, 96 68 C 100 52, 116 52, 120 68 C 124 95, 122 135, 126 165 C 130 125, 134 75, 140 42 C 144 28, 160 28, 164 42 C 168 75, 168 125, 172 165 C 176 130, 180 85, 186 55 C 190 42, 204 42, 208 55 C 212 85, 210 130, 214 170 C 218 140, 222 115, 228 100 C 232 90, 244 90, 248 100 C 252 120, 246 155, 248 185 C 258 235, 256 300, 220 365 C 205 390, 180 405, 110 405 Z"
            stroke={primaryColor}
            strokeWidth="2.4"
            strokeDasharray={isOptimal ? 'none' : '7 4'}
            fill={fillColor}
            className="transition-colors duration-300"
          />

          {/* Knuckle Arch Reference (Soft Guide) */}
          <path
            d="M 88 185 Q 155 172, 245 188"
            stroke={primaryColor}
            strokeWidth="1.5"
            strokeOpacity="0.35"
            strokeDasharray="3 3"
          />

          {/* Fingertips Peak Arch (Visual Frame Reference) */}
          <path
            d="M 96 68 Q 150 25, 248 100"
            stroke={primaryColor}
            strokeWidth="1.2"
            strokeOpacity="0.25"
            strokeDasharray="4 4"
          />

          {/* Central Palm Crease Focus Reticle */}
          <g transform="translate(155, 275)">
            <circle
              r="38"
              stroke={primaryColor}
              strokeWidth="1.8"
              strokeDasharray="5 3"
              strokeOpacity={isOptimal ? '0.85' : '0.45'}
              fill={isOptimal ? 'rgba(16,185,129,0.08)' : 'none'}
              className="transition-all duration-300"
            />
            {/* Center crosshair tick marks */}
            <line x1="-12" y1="0" x2="12" y2="0" stroke={primaryColor} strokeWidth="1.5" strokeOpacity="0.6" />
            <line x1="0" y1="-12" x2="0" y2="12" stroke={primaryColor} strokeWidth="1.5" strokeOpacity="0.6" />
          </g>

          {/* Wrist Anchor Baseline */}
          <line
            x1="95"
            y1="405"
            x2="225"
            y2="405"
            stroke={primaryColor}
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeOpacity="0.9"
          />
        </svg>

        {/* Thumb Positioning Anchor Label */}
        <div
          className={`absolute bottom-[28%] pointer-events-none transition-all duration-300 ${
            handSide === 'right' ? 'left-3 sm:left-6' : 'right-3 sm:right-6'
          }`}
        >
          <span className="px-2.5 py-1 rounded-full bg-black/80 border border-white/10 text-[10px] font-bold text-[#C8AA6E] shadow-md flex items-center gap-1 backdrop-blur-md">
            {handSide === 'right' ? '👈 Thumb Here' : 'Thumb Here 👉'}
          </span>
        </div>

        {/* Hands-Free Auto-Snap Countdown Overlay */}
        {autoSnapCountdown !== null && autoSnapCountdown > 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[3px] animate-in zoom-in-95 duration-200 pointer-events-auto z-20">
            <div className="relative flex items-center justify-center w-28 h-28 rounded-full border-4 border-emerald-400 bg-black/85 shadow-[0_0_40px_rgba(16,185,129,0.8)] animate-pulse">
              <span className="text-5xl font-black font-serif text-emerald-400">
                {autoSnapCountdown}
              </span>
            </div>
            <span className="mt-3 px-3 py-1 rounded-full bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 text-xs font-bold tracking-wider uppercase shadow-lg">
              Hold Still • Snapping...
            </span>
            {onCancelCountdown && (
              <button
                type="button"
                onClick={onCancelCountdown}
                className="mt-3.5 px-3.5 py-1.5 rounded-xl bg-gray-900/90 hover:bg-gray-800 border border-gray-700 text-gray-300 hover:text-white text-xs font-semibold transition-colors shadow-lg"
              >
                Cancel Auto-Snap
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bottom Live Guidance Badge */}
      <div className="w-full flex flex-col items-center gap-1 pointer-events-auto">
        <div
          className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full backdrop-blur-md text-xs font-semibold shadow-xl border transition-all duration-300 ${
            isOptimal
              ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-300 ring-2 ring-emerald-500/30'
              : isWarning
              ? 'bg-amber-950/90 border-amber-500/60 text-amber-300 ring-2 ring-amber-500/20'
              : 'bg-black/85 border-[rgba(200,170,110,0.5)] text-[#C8AA6E]'
          }`}
        >
          {getStatusIcon()}
          <span>{getStatusText()}</span>
        </div>

        {/* On-Device ONNX WebAssembly 60 FPS Indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-[10px] text-emerald-300 font-mono shadow-md backdrop-blur-md">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>ONNX WebAssembly 60 FPS Engine Active</span>
        </div>

        {/* Real-time 75% Frame Fill Progress Meter */}
        {fillPercentage !== undefined && fillPercentage > 5 && (
          <div className="w-full max-w-[240px] flex flex-col gap-1 items-center bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-xl border border-gray-800 shadow-lg animate-in fade-in duration-200">
            <div className="w-full flex items-center justify-between text-[10px] font-mono">
              <span className="text-gray-400">Target Fill: 75%</span>
              <span className={fillPercentage >= 65 && fillPercentage <= 85 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                {fillPercentage}% {fillPercentage >= 65 && fillPercentage <= 85 ? '✓ Optimal' : fillPercentage < 65 ? '↑ Closer' : '↓ Back'}
              </span>
            </div>
            <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden relative">
              <div className="absolute top-0 bottom-0 left-[75%] w-0.5 bg-white/60 z-10" title="75% Target Fill" />
              <div
                className={`h-full transition-all duration-150 rounded-full ${
                  fillPercentage >= 65 && fillPercentage <= 85
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                    : 'bg-amber-400'
                }`}
                style={{ width: `${Math.min(100, fillPercentage)}%` }}
              />
            </div>
          </div>
        )}

        {/* Wrist positioning prompt */}
        <span className="text-[10px] text-gray-400 tracking-wide">
          Wrist at bottom • Fingers open towards top
        </span>
      </div>
    </div>
  );
}
