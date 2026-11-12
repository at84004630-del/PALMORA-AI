'use client';

import React from 'react';
import { Eye, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';

export interface LineMetricsCardProps {
  name: string;
  status: 'detected' | 'uncertain' | 'not_detected' | string;
  measurements?: {
    length_ratio?: number | string | null;
    curvature_index?: number | string | null;
    curvature?: number | string | null;
    continuity_score?: number | string | null;
    start_zone?: string | null;
    termination_zone?: string | null;
    [key: string]: any;
  } | null;
  confidence?: number | null;
  confidenceExplanation?: string | null;
  className?: string;
}

/**
 * LineMetricsCard displays physical ridge biometric metrics.
 * 
 * Epistemic clarity guardrail:
 * Metric headers explicitly state "Line Trace Clarity Index" / "Visual Distinctness"
 * rather than "Accuracy %" to ensure users understand that confidence reflects
 * computer vision ridge contrast and polyline continuity rather than predictive assertions.
 */
export default function LineMetricsCard({
  name,
  status,
  measurements,
  confidence,
  confidenceExplanation,
  className = '',
}: LineMetricsCardProps) {
  const isDetected = status === 'detected' || status === 'uncertain';

  return (
    <div
      className={`glass-card p-5 rounded-2xl flex flex-col gap-4 border border-[rgba(200,170,110,0.2)] bg-[#0A0E1F]/80 ${className}`}
    >
      <div className="flex items-center justify-between border-b border-gray-800 pb-3">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-[#C8AA6E]" />
          <h4 className="text-sm font-semibold text-white">{name} Biometric Trace</h4>
        </div>
        <span
          className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
            status === 'detected'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : status === 'uncertain'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
          }`}
        >
          {status === 'detected' ? 'Detected' : status === 'uncertain' ? 'Partial / Faint' : 'Undetected'}
        </span>
      </div>

      {isDetected && measurements ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-[#070913]/60 p-3 rounded-xl border border-gray-800/80">
            <span className="text-gray-400 block mb-1">Normalized Length</span>
            <span className="text-white font-mono font-medium text-sm">
              {measurements.length_ratio ?? 'N/A'}
            </span>
            <span className="text-[10px] text-gray-400 block mt-0.5">Ratio relative to palm width</span>
          </div>

          <div className="bg-[#070913]/60 p-3 rounded-xl border border-gray-800/80">
            <span className="text-gray-400 block mb-1">Curvature Index</span>
            <span className="text-white font-mono font-medium text-sm">
              {measurements.curvature_index ?? measurements.curvature ?? 'N/A'}
            </span>
            <span className="text-[10px] text-gray-400 block mt-0.5">1.0 = Linear, &gt;1.2 = Curved</span>
          </div>

          <div className="bg-[#070913]/60 p-3 rounded-xl border border-gray-800/80">
            <span className="text-gray-400 block mb-1">Line Trace Clarity Index</span>
            <span className="text-[#C8AA6E] font-mono font-medium text-sm">
              {confidence !== null && confidence !== undefined ? `${Math.round(confidence * 100)}%` : 'Not Calibrated'}
            </span>
            <span className="text-[10px] text-gray-400 block mt-0.5">
              Visual distinctness &amp; ridge sharpness — not predictive accuracy
            </span>
          </div>

          {measurements.valley_depth_px !== undefined && (
            <div className="sm:col-span-3 bg-[#070913]/40 p-3 rounded-xl border border-gray-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 text-gray-300">
                <Sparkles className="w-3.5 h-3.5 text-[#C8AA6E]" />
                <span>Physical Valley Depth: <strong className="text-white font-mono">{measurements.valley_depth_px}px</strong> luminance dip</span>
              </div>
              <div className="flex items-center gap-3 text-gray-400">
                <span>Continuity: <strong className="text-emerald-400 font-mono">{Math.round((measurements.continuity_ratio ?? 1) * 100)}%</strong></span>
                <span>Forks: <strong className="text-sky-400 font-mono">{measurements.detected_forks ?? 0}</strong></span>
                <span>Breaks: <strong className="text-amber-400 font-mono">{measurements.detected_breaks ?? 0}</strong></span>
                <span>Tortuosity: <strong className="text-purple-300 font-mono">{measurements.tortuosity ?? 1.0}</strong></span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-amber-300/90 bg-amber-950/20 p-3 rounded-xl border border-amber-800/40">
          <p className="leading-relaxed">
            Unable to identify this feature reliably from the uploaded image. In accordance with Palmora AI integrity principles, we never fabricate lines or measurements that are not distinctly present.
          </p>
        </div>
      )}

      {confidenceExplanation && (
        <p className="text-[11px] text-gray-400 italic">
          {confidenceExplanation}
        </p>
      )}
    </div>
  );
}
