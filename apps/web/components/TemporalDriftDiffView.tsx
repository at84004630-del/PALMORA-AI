'use client';

import React, { useRef, useEffect, useState } from 'react';
import {
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Layers,
  Sliders,
  ShieldCheck,
  Activity,
  Mountain,
  Heart,
  Brain,
  Zap,
  Compass,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import type {
  TemporalDriftReport,
  CreaseDriftMeasurement,
  MountDriftMeasurement,
  Point2D,
} from '@palmora/shared-types';

interface TemporalDriftDiffViewProps {
  driftReport: TemporalDriftReport;
  baselineImageUrl?: string | null;
  currentImageUrl?: string | null;
  onRescanRequested?: () => void;
}

export default function TemporalDriftDiffView({
  driftReport,
  baselineImageUrl,
  currentImageUrl,
  onRescanRequested,
}: TemporalDriftDiffViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [viewMode, setViewMode] = useState<'heatmap' | 'slider' | 'side_by_side'>('heatmap');
  const [transitionProgress, setTransitionProgress] = useState(1.0); // 0 = baseline, 1 = current
  const [filterTrend, setFilterTrend] = useState<'all' | 'deepened' | 'faded' | 'stabilized'>('all');
  const [showGlow, setShowGlow] = useState(true);
  const [showMountDrift, setShowMountDrift] = useState(true);

  // Redraw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let active = true;

    const drawDiffCanvas = () => {
      if (!active || !canvas) return;
      const containerWidth = containerRef.current?.clientWidth || 640;
      const displayWidth = Math.min(containerWidth, 680);
      const displayHeight = displayWidth * 1.33;

      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, displayWidth, displayHeight);

      // Deep celestial blueprint background
      const grad = ctx.createLinearGradient(0, 0, displayWidth, displayHeight);
      grad.addColorStop(0, '#0B0F22');
      grad.addColorStop(1, '#050711');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, displayWidth, displayHeight);

      const baseFeatures = driftReport.baseline_features;
      const currFeatures = driftReport.current_features;

      // Side-by-side mode: Dual viewports
      if (viewMode === 'side_by_side') {
        const halfW = displayWidth / 2;
        const panelW = halfW - 12;

        // Central vertical dividing axis
        ctx.save();
        ctx.strokeStyle = 'rgba(200, 170, 110, 0.35)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(halfW, 20);
        ctx.lineTo(halfW, displayHeight - 20);
        ctx.stroke();

        // Central junction badge
        ctx.fillStyle = '#080B18';
        ctx.strokeStyle = 'rgba(200, 170, 110, 0.6)';
        ctx.lineWidth = 1.2;
        ctx.fillRect(halfW - 28, displayHeight / 2 - 12, 56, 24);
        ctx.strokeRect(halfW - 28, displayHeight / 2 - 12, 56, 24);
        ctx.fillStyle = '#C8AA6E';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('T₀ ➔ T₁', halfW, displayHeight / 2);
        ctx.restore();

        const renderPanel = (
          xOffset: number,
          pFeatures: typeof baseFeatures,
          title: string,
          dateLabel: string,
          isCurrent: boolean
        ) => {
          // Silhouette
          ctx.save();
          ctx.strokeStyle = isCurrent ? 'rgba(52, 211, 153, 0.25)' : 'rgba(200, 170, 110, 0.2)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.ellipse(xOffset + panelW / 2, displayHeight * 0.55, panelW * 0.36, displayHeight * 0.38, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();

          // Header tag
          ctx.save();
          ctx.fillStyle = isCurrent ? 'rgba(16, 185, 129, 0.15)' : 'rgba(200, 170, 110, 0.15)';
          ctx.strokeStyle = isCurrent ? 'rgba(16, 185, 129, 0.4)' : 'rgba(200, 170, 110, 0.3)';
          ctx.lineWidth = 1;
          ctx.fillRect(xOffset + 8, 14, panelW - 16, 24);
          ctx.strokeRect(xOffset + 8, 14, panelW - 16, 24);
          ctx.fillStyle = '#F8FAFC';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${title} (${dateLabel})`, xOffset + panelW / 2, 26);
          ctx.restore();

          // Polyline drawer for panel
          const drawPanelPoly = (path: Point2D[], color: string, glow: string, w: number) => {
            if (!path || path.length < 2) return;
            ctx.save();
            if (showGlow) {
              ctx.shadowColor = glow;
              ctx.shadowBlur = 10;
            }
            ctx.strokeStyle = color;
            ctx.lineWidth = w;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(xOffset + path[0].x * panelW, path[0].y * displayHeight);
            for (let i = 1; i < path.length; i++) {
              ctx.lineTo(xOffset + path[i].x * panelW, path[i].y * displayHeight);
            }
            ctx.stroke();
            ctx.restore();
          };

          if (pFeatures?.heart_line?.path) {
            const trend = driftReport.crease_drifts.find(d => d.line_name.includes('Heart'))?.trend;
            const c = isCurrent ? (trend === 'deepened' ? '#10B981' : trend === 'faded' ? '#F59E0B' : '#F43F5E') : '#F43F5E';
            drawPanelPoly(pFeatures.heart_line.path, c, c, isCurrent ? 2.8 : 2.0);
          }
          if (pFeatures?.head_line?.path) {
            const trend = driftReport.crease_drifts.find(d => d.line_name.includes('Head'))?.trend;
            const c = isCurrent ? (trend === 'deepened' ? '#10B981' : trend === 'faded' ? '#F59E0B' : '#38BDF8') : '#38BDF8';
            drawPanelPoly(pFeatures.head_line.path, c, c, isCurrent ? 2.8 : 2.0);
          }
          if (pFeatures?.life_line?.path) {
            const trend = driftReport.crease_drifts.find(d => d.line_name.includes('Life'))?.trend;
            const c = isCurrent ? (trend === 'deepened' ? '#10B981' : trend === 'faded' ? '#F59E0B' : '#34D399') : '#34D399';
            drawPanelPoly(pFeatures.life_line.path, c, c, isCurrent ? 3.0 : 2.2);
          }
          if (pFeatures?.fate_line?.path) {
            const trend = driftReport.crease_drifts.find(d => d.line_name.includes('Fate'))?.trend;
            const c = isCurrent ? (trend === 'deepened' ? '#10B981' : trend === 'faded' ? '#F59E0B' : '#C084FC') : '#C084FC';
            drawPanelPoly(pFeatures.fate_line.path, c, c, isCurrent ? 2.5 : 1.8);
          }
        };

        const bDate = driftReport.baseline_scan_date ? driftReport.baseline_scan_date.slice(0, 10) : 'T₀';
        const cDate = driftReport.current_scan_date ? driftReport.current_scan_date.slice(0, 10) : 'T₁';
        renderPanel(0, baseFeatures, 'Baseline', bDate, false);
        renderPanel(halfW + 6, currFeatures, 'Retake', cDate, true);
        ctx.restore();
        return;
      }

      // Subtle hand contour silhouette guide
      ctx.save();
      ctx.strokeStyle = 'rgba(200, 170, 110, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.ellipse(displayWidth / 2, displayHeight * 0.55, displayWidth * 0.35, displayHeight * 0.38, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Helper to draw a polyline with custom styling
      const drawPolyline = (
        path: Point2D[],
        color: string,
        glowColor: string,
        lineWidth: number,
        dashed: boolean = false,
        alpha: number = 1.0
      ) => {
        if (!path || path.length < 2) return;
        ctx.save();
        ctx.globalAlpha = alpha;
        if (showGlow) {
          ctx.shadowColor = glowColor;
          ctx.shadowBlur = 14;
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (dashed) {
          ctx.setLineDash([4, 4]);
        }

        ctx.beginPath();
        ctx.moveTo(path[0].x * displayWidth, path[0].y * displayHeight);
        for (let i = 1; i < path.length; i++) {
          ctx.lineTo(path[i].x * displayWidth, path[i].y * displayHeight);
        }
        ctx.stroke();
        ctx.restore();
      };

      // 1. Draw Mount Elevation Shifts if enabled
      if (showMountDrift && driftReport.mount_drifts) {
        const isLeft = driftReport.hand_side === 'left';
        const mountPositions: Record<string, { x: number; y: number; radius: number }> = {
          'Mount of Jupiter': { x: isLeft ? 0.71 : 0.29, y: 0.36, radius: 24 },
          'Mount of Saturn': { x: isLeft ? 0.55 : 0.45, y: 0.33, radius: 22 },
          'Mount of Apollo (Sun)': { x: isLeft ? 0.39 : 0.61, y: 0.35, radius: 23 },
          'Mount of Mercury': { x: isLeft ? 0.25 : 0.75, y: 0.39, radius: 22 },
          'Mount of Venus (Thenar)': { x: isLeft ? 0.70 : 0.30, y: 0.63, radius: 42 },
          'Mount of Moon (Hypothenar)': { x: isLeft ? 0.25 : 0.75, y: 0.67, radius: 36 },
        };

        driftReport.mount_drifts.forEach((m) => {
          const pos = mountPositions[m.mount_name];
          if (!pos) return;
          const mx = pos.x * displayWidth;
          const my = pos.y * displayHeight;
          const color =
            m.trend === 'elevated'
              ? 'rgba(52, 211, 153, 0.4)'
              : m.trend === 'softened'
              ? 'rgba(245, 158, 11, 0.35)'
              : 'rgba(200, 170, 110, 0.25)';

          ctx.save();
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.2;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.arc(mx, my, pos.radius * (0.8 + m.current_elevation * 0.4), 0, Math.PI * 2);
          ctx.stroke();

          // Delta tag
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          const sign = m.delta_elevation > 0 ? '+' : '';
          const tag = `${m.mount_name.replace('Mount of ', '').split(' ')[0]} ${sign}${Math.round(m.delta_elevation * 100)}%`;
          ctx.fillText(tag, mx, my - pos.radius * 0.9);
          ctx.restore();
        });
      }

      // 2. Draw Crease Drifts (Deepened in Emerald, Softened in Amber, Stabilized in Cyan, Branching in Violet)
      driftReport.crease_drifts.forEach((cd) => {
        const isHeart = cd.line_name.includes('Heart');
        const isHead = cd.line_name.includes('Head');
        const isLife = cd.line_name.includes('Life');
        const isFate = cd.line_name.includes('Fate');

        const baseFeature = isHeart
          ? baseFeatures?.heart_line
          : isHead
          ? baseFeatures?.head_line
          : isLife
          ? baseFeatures?.life_line
          : baseFeatures?.fate_line;

        const currFeature = isHeart
          ? currFeatures?.heart_line
          : isHead
          ? currFeatures?.head_line
          : isLife
          ? currFeatures?.life_line
          : currFeatures?.fate_line;

        // Determine diff color & prominence
        let diffColor = '#38BDF8';
        let glowColor = 'rgba(56, 189, 248, 0.8)';
        let lineWidth = 3.0;

        if (cd.trend === 'deepened') {
          diffColor = '#10B981'; // Vibrant Emerald
          glowColor = 'rgba(16, 185, 129, 0.9)';
          lineWidth = 4.2;
        } else if (cd.trend === 'faded') {
          diffColor = '#F59E0B'; // Amber Gold
          glowColor = 'rgba(245, 158, 11, 0.75)';
          lineWidth = 2.5;
        } else if (cd.trend === 'branching') {
          diffColor = '#C084FC'; // Amethyst
          glowColor = 'rgba(192, 132, 252, 0.9)';
          lineWidth = 3.6;
        }

        // Draw Baseline ghost line in faint grey/gold
        if (baseFeature?.path && viewMode !== 'slider') {
          drawPolyline(baseFeature.path, 'rgba(156, 163, 175, 0.4)', 'transparent', 2.0, true, 0.6);
        }

        // In slider mode: cross-fade between baseline and current
        if (viewMode === 'slider') {
          if (baseFeature?.path) {
            drawPolyline(baseFeature.path, '#94A3B8', 'transparent', 2.5, false, 1.0 - transitionProgress);
          }
          if (currFeature?.path) {
            drawPolyline(currFeature.path, diffColor, glowColor, lineWidth, false, transitionProgress);
          }
        } else {
          // Heatmap mode: draw active current line in highlighted diff color
          if (currFeature?.path) {
            drawPolyline(currFeature.path, diffColor, glowColor, lineWidth, false, 1.0);
          }
        }
      });

      // Overlay Watermark Legend
      ctx.save();
      ctx.fillStyle = 'rgba(11, 14, 27, 0.85)';
      ctx.strokeStyle = 'rgba(200, 170, 110, 0.3)';
      ctx.lineWidth = 1;
      const legW = 210;
      const legH = 75;
      const legX = displayWidth - legW - 16;
      const legY = 16;
      ctx.fillRect(legX, legY, legW, legH);
      ctx.strokeRect(legX, legY, legW, legH);

      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'left';

      // Emerald: Deepened
      ctx.fillStyle = '#10B981';
      ctx.beginPath();
      ctx.arc(legX + 14, legY + 18, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F8FAFC';
      ctx.fillText('Deepened Purpose Line (+)', legX + 26, legY + 21);

      // Amber: Faded
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(legX + 14, legY + 36, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F8FAFC';
      ctx.fillText('Faded Stress Line (-)', legX + 26, legY + 39);

      // Blue: Stabilized
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(legX + 14, legY + 54, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F8FAFC';
      ctx.fillText('Stabilized Foundation (0)', legX + 26, legY + 57);

      ctx.restore();
      ctx.restore();
    };

    drawDiffCanvas();

    const handleResize = () => {
      drawDiffCanvas();
    };
    window.addEventListener('resize', handleResize);
    return () => {
      active = false;
      window.removeEventListener('resize', handleResize);
    };
  }, [driftReport, viewMode, transitionProgress, showGlow, showMountDrift]);

  const filteredDrifts =
    filterTrend === 'all'
      ? driftReport.crease_drifts
      : driftReport.crease_drifts.filter((d) => d.trend === filterTrend);

  return (
    <div className="w-full flex flex-col gap-6" ref={containerRef}>
      {/* Header Banner */}
      <div className="glass-card p-6 sm:p-8 rounded-3xl border border-[rgba(200,170,110,0.3)] bg-gradient-to-br from-[#0B0E1B] via-[#070913] to-[#12162A] shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#C8AA6E] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#C8AA6E]" />
              Temporal Biometric Diff Analysis
            </span>
            <h3 className="text-lg sm:text-xl font-bold text-white">
              Visual Crease Drift Differencing
            </h3>
            <p className="text-xs text-gray-400">
              Contrasting scans taken ~{driftReport.elapsed_months_estimate.toFixed(1)} months apart on your {driftReport.hand_side} palm
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onRescanRequested && (
            <button
              onClick={onRescanRequested}
              className="px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs text-gray-200 font-medium transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#C8AA6E]" />
              <span>Rescan Retake</span>
            </button>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-[#080B18]/90 border border-[rgba(200,170,110,0.2)] flex flex-col gap-1">
          <span className="text-[11px] text-gray-400">Palmar Stability</span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-[#C8AA6E]">
            {driftReport.stability_score.toFixed(1)}%
          </span>
          <span className="text-[10px] text-gray-400">Constitutional continuity</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#080B18]/90 border border-emerald-500/25 flex flex-col gap-1">
          <span className="text-[11px] text-gray-400">Deepened Lines</span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 flex items-center gap-1">
            <TrendingUp className="w-4 h-4" />
            +{driftReport.deepened_lines_count}
          </span>
          <span className="text-[10px] text-emerald-300/80">Conscious focus deepened</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#080B18]/90 border border-amber-500/25 flex flex-col gap-1">
          <span className="text-[11px] text-gray-400">Softened Lines</span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-amber-400 flex items-center gap-1">
            <TrendingDown className="w-4 h-4" />
            -{driftReport.softened_lines_count}
          </span>
          <span className="text-[10px] text-amber-300/80">Chronic tension released</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#080B18]/90 border border-purple-500/25 flex flex-col gap-1">
          <span className="text-[11px] text-gray-400">Time Interval</span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-purple-400">
            ~{driftReport.elapsed_months_estimate.toFixed(1)}m
          </span>
          <span className="text-[10px] text-purple-300/80">Temporal baseline</span>
        </div>
      </div>

      {/* Interactive Diff Canvas */}
      <div className="relative rounded-2xl overflow-hidden border border-[rgba(200,170,110,0.25)] bg-[#070913] shadow-2xl flex flex-col justify-center items-center">
        <canvas ref={canvasRef} className="max-w-full block rounded-2xl" />

        {/* View Mode & Slider Floating Control Bar */}
        <div className="w-full p-4 bg-[#0B0E1B]/90 backdrop-blur-md border-t border-[rgba(200,170,110,0.2)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('heatmap')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                viewMode === 'heatmap'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-gray-800 text-gray-400'
              }`}
            >
              Diff Heatmap
            </button>
            <button
              onClick={() => setViewMode('slider')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                viewMode === 'slider'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  : 'bg-gray-800 text-gray-400'
              }`}
            >
              Time Transition Slider
            </button>
            <button
              onClick={() => setViewMode('side_by_side')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                viewMode === 'side_by_side'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                  : 'bg-gray-800 text-gray-400'
              }`}
            >
              Side-by-Side View
            </button>
          </div>

          {viewMode === 'slider' && (
            <div className="flex items-center gap-3 w-full sm:w-64">
              <span className="text-[11px] text-gray-400 whitespace-nowrap">Baseline</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={transitionProgress}
                onChange={(e) => setTransitionProgress(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-400"
              />
              <span className="text-[11px] text-emerald-400 whitespace-nowrap">Current</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMountDrift(!showMountDrift)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1 ${
                showMountDrift ? 'bg-[rgba(200,170,110,0.2)] text-[#C8AA6E]' : 'bg-gray-800 text-gray-400'
              }`}
            >
              <Mountain className="w-3 h-3" />
              <span>3D Mounts</span>
            </button>

            <button
              onClick={() => setShowGlow(!showGlow)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                showGlow ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-800 text-gray-400'
              }`}
            >
              {showGlow ? 'Glow On' : 'Glow Off'}
            </button>
          </div>
        </div>
      </div>

      {/* Holistic Temporal Synthesis Card */}
      <div className="glass-card p-6 rounded-2xl border border-[rgba(200,170,110,0.3)] bg-[#0B0F22]/90 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#C8AA6E]" />
          <h4 className="text-sm font-semibold text-white">
            Temporal Evolutionary Synthesis
          </h4>
        </div>
        <p className="text-xs text-gray-300 leading-relaxed">
          {driftReport.temporal_synthesis}
        </p>
        <div className="pt-3 border-t border-gray-800 text-xs">
          <span className="text-emerald-400 font-medium block mb-1">
            Mindful Integration Practice:
          </span>
          <p className="text-gray-400 italic">
            &quot;{driftReport.mindfulness_reflection}&quot;
          </p>
        </div>
      </div>

      {/* Detailed Crease Drift Breakdown */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#C8AA6E]" />
            Line-by-Line Crease Differencing
          </h4>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 text-xs">
            {(['all', 'deepened', 'faded', 'stabilized'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterTrend(t)}
                className={`px-2.5 py-1 rounded-lg font-medium capitalize transition-colors ${
                  filterTrend === t
                    ? 'bg-[#C8AA6E] text-gray-950 font-bold'
                    : 'bg-gray-800/80 text-gray-400 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {filteredDrifts.map((d) => (
            <div
              key={d.line_name}
              className={`p-4 rounded-xl bg-[#070913]/90 border flex flex-col gap-2.5 ${
                d.trend === 'deepened'
                  ? 'border-emerald-500/40 bg-emerald-950/10'
                  : d.trend === 'faded'
                  ? 'border-amber-500/40 bg-amber-950/10'
                  : d.trend === 'branching'
                  ? 'border-purple-500/40 bg-purple-950/10'
                  : 'border-gray-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">{d.line_name}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                    d.trend === 'deepened'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : d.trend === 'faded'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : d.trend === 'branching'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      : 'bg-gray-800 text-gray-300'
                  }`}
                >
                  {d.trend}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 py-1.5 bg-[#03050C]/60 rounded-lg px-2.5 text-center font-mono">
                <div>
                  <span className="text-[10px] text-gray-400 block">Baseline</span>
                  <span className="text-gray-300 font-semibold">{d.previous_prominence.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 block">Current</span>
                  <span className="text-white font-semibold">{d.current_prominence.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 block">Delta</span>
                  <span
                    className={`font-bold ${
                      d.delta_prominence > 0
                        ? 'text-emerald-400'
                        : d.delta_prominence < 0
                        ? 'text-amber-400'
                        : 'text-gray-400'
                    }`}
                  >
                    {d.delta_prominence > 0 ? '+' : ''}
                    {d.delta_prominence.toFixed(2)}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-gray-300 leading-relaxed">
                {d.symbolic_meaning}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Mount Topography Elevation Shift Breakdown */}
      {driftReport.mount_drifts && driftReport.mount_drifts.length > 0 && (
        <div className="glass-card p-5 rounded-2xl border border-[rgba(200,170,110,0.25)] bg-[#0A0D1E]/80 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Mountain className="w-4 h-4 text-[#C8AA6E]" />
            <h4 className="text-sm font-semibold text-white">
              Photometric 3D Mount Elevation Shifts
            </h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {driftReport.mount_drifts.map((m) => (
              <div key={m.mount_name} className="p-3 rounded-xl bg-[#060812] border border-gray-800/80 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white text-[11px]">{m.mount_name}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                      m.trend === 'elevated'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : m.trend === 'softened'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-gray-800 text-gray-400'
                    }`}
                  >
                    {m.delta_elevation > 0 ? '+' : ''}
                    {Math.round(m.delta_elevation * 100)}%
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 leading-snug">{m.symbolic_meaning}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ethical Disclaimer */}
      <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800 text-[11px] text-gray-400 flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 text-[#C8AA6E] shrink-0 mt-0.5" />
        <p className="leading-relaxed">{driftReport.disclaimer}</p>
      </div>
    </div>
  );
}
