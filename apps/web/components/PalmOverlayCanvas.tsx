'use client';

import React, { useRef, useEffect, useState } from 'react';
import { PalmFeatures, Point2D, ImageQualityMetrics } from '../lib/api';
import {
  Eye,
  EyeOff,
  Layers,
  Info,
  Clock,
  Mountain,
  Sparkles,
  Sliders,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

interface PalmOverlayCanvasProps {
  imageUrl?: string | null;
  features: PalmFeatures;
  roiBox?: number[] | null; // [ymin, xmin, ymax, xmax]
  quality?: ImageQualityMetrics;
}

export interface DevelopmentalMilestone {
  age: number;
  label: string;
  shortName: string;
  eraName: string;
  theme: string;
  archetype: string;
  reflectiveQuery: string;
  color: string;
}

export const DEVELOPMENTAL_MILESTONES: DevelopmentalMilestone[] = [
  {
    age: 18,
    label: '18',
    shortName: 'Emergence',
    eraName: 'Emergence & Self-Definition',
    theme: 'Emerging personal boundary formation and departure from primary conditioning.',
    archetype: 'The Explorer: Venturing beyond inherited assumptions to test inner convictions.',
    reflectiveQuery: 'What principles or desires did you discover were authentically your own?',
    color: '#38BDF8',
  },
  {
    age: 25,
    label: '25',
    shortName: 'Foundations',
    eraName: 'Foundational Trajectory & Exploration',
    theme: 'Establishing initial vocational direction, relational devotion, and creative testing.',
    archetype: 'The Builder: Channelling fresh stamina into tangible crafts and chosen disciplines.',
    reflectiveQuery: 'Where are you directing your primary focus and devotion right now?',
    color: '#34D399',
  },
  {
    age: 35,
    label: '35',
    shortName: 'Meridian',
    eraName: 'The Meridian Transition — Consolidation',
    theme: 'Pivotal life juncture where youthful idealism integrates with mature discernment and authority.',
    archetype: 'The Sovereign: Bearing responsibility with grace and anchoring personal community.',
    reflectiveQuery: 'What responsibilities are you now prepared to steward with steady maturity?',
    color: '#C8AA6E',
  },
  {
    age: 48,
    label: '48',
    shortName: 'Harvest',
    eraName: 'Harvest & Generative Stewardship',
    theme: 'Harvest of life experience, mentoring rising talents, and recalibrating long-term values.',
    archetype: 'The Mentor: Transforming personal trials into distilled, generous wisdom for others.',
    reflectiveQuery: 'What hard-won insight can you now generously share with those coming after you?',
    color: '#C084FC',
  },
  {
    age: 62,
    label: '62+',
    shortName: 'Elderhood',
    eraName: 'Philosophical Elderhood & Freedom',
    theme: 'Freedom from social performance, inner peace, and harmonious integration of life chapters.',
    archetype: 'The Sage: Observing the unfolding stream of life with serene detached compassion.',
    reflectiveQuery: 'What historical worries or outdated self-images can you now peacefully release?',
    color: '#F59E0B',
  },
];

interface MountDefinition {
  key: 'jupiter' | 'saturn' | 'apollo' | 'mercury' | 'venus' | 'moon';
  name: string;
  defaultX: number;
  leftX: number;
  y: number;
  radius: number;
  defaultElev: number;
  symbolic: string;
}

const PALM_MOUNTS: MountDefinition[] = [
  { key: 'jupiter', name: 'Mount of Jupiter', defaultX: 0.29, leftX: 0.71, y: 0.36, radius: 26, defaultElev: 0.52, symbolic: 'Leadership, ambition, and social expansion' },
  { key: 'saturn', name: 'Mount of Saturn', defaultX: 0.45, leftX: 0.55, y: 0.33, radius: 24, defaultElev: 0.48, symbolic: 'Discipline, contemplative depth, and ethical grounding' },
  { key: 'apollo', name: 'Mount of Apollo (Sun)', defaultX: 0.61, leftX: 0.39, y: 0.35, radius: 25, defaultElev: 0.50, symbolic: 'Creativity, aesthetic appreciation, and charismatic warmth' },
  { key: 'mercury', name: 'Mount of Mercury', defaultX: 0.75, leftX: 0.25, y: 0.39, radius: 24, defaultElev: 0.49, symbolic: 'Commercial discernment, quick intellect, and clear speech' },
  { key: 'venus', name: 'Mount of Venus (Thenar)', defaultX: 0.30, leftX: 0.70, y: 0.63, radius: 46, defaultElev: 0.62, symbolic: 'Constitutional vitality, warmth, empathy, and sensory zest' },
  { key: 'moon', name: 'Mount of Moon (Hypothenar)', defaultX: 0.75, leftX: 0.25, y: 0.67, radius: 38, defaultElev: 0.54, symbolic: 'Intuition, imagination, receptive contemplation, and travel' },
];

function interpolatePolylineAtFraction(path: Point2D[], fraction: number): Point2D | null {
  if (!path || path.length < 2) return null;
  const clamped = Math.max(0, Math.min(1, fraction));
  let totalLength = 0;
  const segLengths: number[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const dx = path[i + 1].x - path[i].x;
    const dy = path[i + 1].y - path[i].y;
    const seg = Math.hypot(dx, dy);
    segLengths.push(seg);
    totalLength += seg;
  }
  if (totalLength === 0) return path[0];

  const targetDist = clamped * totalLength;
  let accumulated = 0;
  for (let i = 0; i < segLengths.length; i++) {
    const seg = segLengths[i];
    if (accumulated + seg >= targetDist || i === segLengths.length - 1) {
      const segT = seg > 0 ? (targetDist - accumulated) / seg : 0;
      return {
        x: path[i].x + segT * (path[i + 1].x - path[i].x),
        y: path[i].y + segT * (path[i + 1].y - path[i].y),
      };
    }
    accumulated += seg;
  }
  return path[path.length - 1];
}

function ageToLifeFraction(age: number): number {
  if (age <= 18) return Math.max(0.04, 0.15 * (age / 18));
  if (age <= 25) return 0.15 + ((age - 18) / (25 - 18)) * (0.28 - 0.15);
  if (age <= 35) return 0.28 + ((age - 25) / (35 - 25)) * (0.50 - 0.28);
  if (age <= 48) return 0.50 + ((age - 35) / (48 - 35)) * (0.72 - 0.50);
  if (age <= 62) return 0.72 + ((age - 48) / (62 - 48)) * (0.90 - 0.72);
  return Math.min(0.98, 0.90 + ((age - 62) / (78 - 62)) * 0.08);
}

function ageToFateFraction(age: number): number {
  if (age <= 25) return Math.max(0.05, 0.22 * (age / 25));
  if (age <= 35) return 0.22 + ((age - 25) / (35 - 25)) * (0.48 - 0.22);
  if (age <= 48) return 0.48 + ((age - 35) / (48 - 35)) * (0.70 - 0.48);
  return Math.min(0.95, 0.70 + ((age - 48) / (75 - 48)) * 0.25);
}

export default function PalmOverlayCanvas({
  imageUrl,
  features,
  roiBox,
  quality,
}: PalmOverlayCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Toggles
  const [showHeart, setShowHeart] = useState(true);
  const [showHead, setShowHead] = useState(true);
  const [showLife, setShowLife] = useState(true);
  const [showFate, setShowFate] = useState(true);
  const [showRoi, setShowRoi] = useState(true);
  const [showGlow, setShowGlow] = useState(true);
  const [showMounts, setShowMounts] = useState(true);
  const [timelineActive, setTimelineActive] = useState(false);
  const [timelineAge, setTimelineAge] = useState(28);

  const [selectedFeature, setSelectedFeature] = useState<'heart' | 'head' | 'life' | 'fate' | 'mounts' | null>('heart');

  // Redraw canvas whenever image, toggles, or container size changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let active = true;
    let loadedImage: HTMLImageElement | null = null;

    const drawScene = (imgToDraw: HTMLImageElement | null) => {
      if (!active || !canvas) return;
      // Set canvas dimensions matching natural aspect ratio
      const containerWidth = containerRef.current?.clientWidth || 600;
      const aspectRatio = imgToDraw ? imgToDraw.height / imgToDraw.width : 1.33;
      const displayWidth = Math.min(containerWidth, 680);
      const displayHeight = displayWidth * aspectRatio;

      // Handle High-DPI screens
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, displayWidth, displayHeight);

      // Draw original palm photograph if available, or dark blueprint silhouette
      if (imgToDraw) {
        ctx.drawImage(imgToDraw, 0, 0, displayWidth, displayHeight);
      } else {
        const grad = ctx.createLinearGradient(0, 0, displayWidth, displayHeight);
        grad.addColorStop(0, '#0F1322');
        grad.addColorStop(1, '#070913');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, displayWidth, displayHeight);

        // Elegant palm contour silhouette guide
        ctx.save();
        ctx.strokeStyle = 'rgba(200, 170, 110, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.ellipse(displayWidth / 2, displayHeight * 0.55, displayWidth * 0.35, displayHeight * 0.38, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Helper function to draw normalized polyline
      const drawCrease = (
        path: Point2D[],
        color: string,
        glowColor: string,
        lineWidth: number = 3.5,
        isDashed: boolean = false
      ) => {
        if (!path || path.length < 2) return;

        ctx.save();
        if (showGlow) {
          ctx.shadowColor = glowColor;
          ctx.shadowBlur = isDashed ? 8 : 12;
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (isDashed) {
          ctx.setLineDash([6, 5]);
        } else {
          ctx.setLineDash([]);
        }

        ctx.beginPath();
        const startX = path[0].x * displayWidth;
        const startY = path[0].y * displayHeight;
        ctx.moveTo(startX, startY);

        for (let i = 1; i < path.length; i++) {
          const px = path[i].x * displayWidth;
          const py = path[i].y * displayHeight;
          ctx.lineTo(px, py);
        }
        ctx.stroke();

        // Draw endpoint dots
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(startX, startY, isDashed ? 3 : 4, 0, Math.PI * 2);
        const endX = path[path.length - 1].x * displayWidth;
        const endY = path[path.length - 1].y * displayHeight;
        ctx.arc(endX, endY, isDashed ? 3 : 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      };

      // 1. Draw ROI box
      if (showRoi && roiBox && roiBox.length === 4) {
        ctx.save();
        const [ymin, xmin, ymax, xmax] = roiBox;
        const rx = xmin * displayWidth;
        const ry = ymin * displayHeight;
        const rw = (xmax - xmin) * displayWidth;
        const rh = (ymax - ymin) * displayHeight;

        ctx.strokeStyle = 'rgba(200, 170, 110, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(rx, ry, rw, rh);

        // Label
        ctx.fillStyle = 'rgba(200, 170, 110, 0.9)';
        ctx.font = '10px sans-serif';
        ctx.fillText('Segmented Palm ROI', rx + 6, ry + 14);
        ctx.restore();
      }

      // 2. Draw Topographic Mount Contouring (3D Elevation)
      if (showMounts) {
        const isLeft = features.hand_side === 'left';
        const hasRoi = roiBox && roiBox.length === 4;
        const [rYmin, rXmin, rYmax, rXmax] = hasRoi ? roiBox : [0, 0, 1, 1];
        const rW = rXmax - rXmin;
        const rH = rYmax - rYmin;

        PALM_MOUNTS.forEach((m) => {
          const rawX = isLeft ? m.leftX : m.defaultX;
          const normX = (hasRoi && rW > 0.25) ? (rXmin + rawX * rW) : rawX;
          const normY = (hasRoi && rH > 0.25) ? (rYmin + m.y * rH) : m.y;
          const mx = normX * displayWidth;
          const my = normY * displayHeight;
          const mountData = (features.mount_topography as any)?.[m.key];
          const elevation: number = mountData?.relative_elevation ?? m.defaultElev;
          const prominence: string = mountData?.prominence ?? (elevation >= 0.6 ? 'developed' : 'moderate');

          ctx.save();
          // Concentric contour halo
          const outerR = m.radius * (0.8 + elevation * 0.45);
          const midR = m.radius * (0.55 + elevation * 0.3);
          const innerR = m.radius * (0.28 + elevation * 0.15);

          // Radial elevation gradient
          const radGrad = ctx.createRadialGradient(mx, my, 2, mx, my, outerR);
          radGrad.addColorStop(0, `rgba(200, 170, 110, ${0.18 + elevation * 0.22})`);
          radGrad.addColorStop(0.6, `rgba(200, 170, 110, ${0.08 + elevation * 0.1})`);
          radGrad.addColorStop(1, 'rgba(200, 170, 110, 0)');
          ctx.fillStyle = radGrad;
          ctx.beginPath();
          ctx.arc(mx, my, outerR, 0, Math.PI * 2);
          ctx.fill();

          // Topographic contour rings
          ctx.strokeStyle = `rgba(200, 170, 110, ${0.25 + elevation * 0.35})`;
          ctx.lineWidth = 1.2;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.arc(mx, my, outerR, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = `rgba(200, 170, 110, ${0.35 + elevation * 0.4})`;
          ctx.beginPath();
          ctx.arc(mx, my, midR, 0, Math.PI * 2);
          ctx.stroke();

          // Core peak dot
          ctx.setLineDash([]);
          ctx.fillStyle = elevation >= 0.6 ? '#34D399' : '#C8AA6E';
          ctx.beginPath();
          ctx.arc(mx, my, innerR * 0.4, 0, Math.PI * 2);
          ctx.fill();

          // Mount name & elevation percentage badge with sleek dark pill & vertical anti-collision staggering
          const shortNames: Record<string, string> = {
            jupiter: 'Jupiter',
            saturn: 'Saturn',
            apollo: 'Sun',
            mercury: 'Mercury',
            venus: 'Venus',
            moon: 'Moon',
          };
          const labelName = shortNames[m.key] || m.name.replace('Mount of ', '');
          const badgeText = `${labelName} ${Math.round(elevation * 100)}%`;

          ctx.font = 'bold 8.5px sans-serif';
          const textMetric = ctx.measureText(badgeText);
          const badgeW = textMetric.width + 10;
          const badgeH = 15;

          // Stagger Y position to prevent horizontal text collision among adjacent finger mounts
          let badgeY = my - outerR - 4;
          if (m.key === 'saturn' || m.key === 'mercury') {
            badgeY = my - outerR - 18;
          }

          // Dark frosted pill background
          ctx.fillStyle = 'rgba(11, 14, 27, 0.88)';
          ctx.strokeStyle = elevation >= 0.6 ? 'rgba(52, 211, 153, 0.6)' : 'rgba(200, 170, 110, 0.45)';
          ctx.lineWidth = 1;
          const badgeX = mx - badgeW / 2;
          ctx.fillRect(badgeX, badgeY - badgeH + 3, badgeW, badgeH);
          ctx.strokeRect(badgeX, badgeY - badgeH + 3, badgeW, badgeH);

          // Clear high-contrast text
          ctx.fillStyle = '#FFFFFF';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.fillText(badgeText, mx, badgeY - badgeH / 2 + 3.5);

          ctx.restore();
        });
      }

      // 3. Draw Heart Line (Rose Red)
      if (showHeart && features.heart_line?.path && features.heart_line.path.length >= 2 && features.heart_line.status !== 'not_detected') {
        const isUncertain = features.heart_line.status === 'uncertain';
        drawCrease(
          features.heart_line.path,
          isUncertain ? 'rgba(244, 63, 94, 0.75)' : '#F43F5E',
          'rgba(244, 63, 94, 0.8)',
          isUncertain ? 2.5 : 3.5,
          isUncertain
        );
      }

      // 4. Draw Head Line (Sky Cyan)
      if (showHead && features.head_line?.path && features.head_line.path.length >= 2 && features.head_line.status !== 'not_detected') {
        const isUncertain = features.head_line.status === 'uncertain';
        drawCrease(
          features.head_line.path,
          isUncertain ? 'rgba(56, 189, 248, 0.75)' : '#38BDF8',
          'rgba(56, 189, 248, 0.8)',
          isUncertain ? 2.5 : 3.5,
          isUncertain
        );
      }

      // 5. Draw Life Line (Emerald Green)
      if (showLife && features.life_line?.path && features.life_line.path.length >= 2 && features.life_line.status !== 'not_detected') {
        const isUncertain = features.life_line.status === 'uncertain';
        drawCrease(
          features.life_line.path,
          isUncertain ? 'rgba(52, 211, 153, 0.75)' : '#34D399',
          'rgba(52, 211, 153, 0.8)',
          isUncertain ? 2.5 : 3.5,
          isUncertain
        );
      }

      // 6. Draw Fate Line (Amethyst Violet)
      if (showFate && features.fate_line?.path && features.fate_line.path.length >= 2 && features.fate_line.status !== 'not_detected') {
        const isUncertain = features.fate_line.status === 'uncertain';
        drawCrease(
          features.fate_line.path,
          isUncertain ? 'rgba(192, 132, 252, 0.75)' : '#C084FC',
          'rgba(192, 132, 252, 0.8)',
          isUncertain ? 2.5 : 3.5,
          isUncertain
        );
      }

      // 7. Draw Interactive Visual Timeline Calibration Markers
      if (timelineActive && features.life_line?.path && features.life_line.path.length >= 2) {
        // Draw milestone anchor nodes along Life line
        DEVELOPMENTAL_MILESTONES.forEach((ms) => {
          const frac = ageToLifeFraction(ms.age);
          const pt = interpolatePolylineAtFraction(features.life_line.path, frac);
          if (!pt) return;

          const px = pt.x * displayWidth;
          const py = pt.y * displayHeight;

          ctx.save();
          ctx.fillStyle = ms.color;
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(px, py, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Milestone age label tag
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.strokeStyle = ms.color;
          ctx.lineWidth = 1;
          const tagW = 22;
          const tagH = 14;
          const tagX = px + 8;
          const tagY = py - 7;
          ctx.fillRect(tagX, tagY, tagW, tagH);
          ctx.strokeRect(tagX, tagY, tagW, tagH);

          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(ms.label, tagX + tagW / 2, tagY + tagH / 2);
          ctx.restore();
        });

        // Draw Active Scrubber Bead along Life line
        const activeFrac = ageToLifeFraction(timelineAge);
        const activePt = interpolatePolylineAtFraction(features.life_line.path, activeFrac);
        if (activePt) {
          const ax = activePt.x * displayWidth;
          const ay = activePt.y * displayHeight;

          ctx.save();
          // Pulsing halo
          ctx.shadowColor = '#C8AA6E';
          ctx.shadowBlur = 18;
          ctx.strokeStyle = 'rgba(200, 170, 110, 0.6)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(ax, ay, 12, 0, Math.PI * 2);
          ctx.stroke();

          // Solid golden bead
          ctx.fillStyle = '#C8AA6E';
          ctx.beginPath();
          ctx.arc(ax, ay, 6, 0, Math.PI * 2);
          ctx.fill();

          // Age tooltip callout flag
          ctx.fillStyle = '#0F172A';
          ctx.strokeStyle = '#C8AA6E';
          ctx.lineWidth = 1.5;
          const calloutText = `Age ${timelineAge}`;
          ctx.font = 'bold 11px sans-serif';
          const textW = ctx.measureText(calloutText).width + 14;
          const boxX = ax - textW / 2;
          const boxY = ay - 28;

          ctx.fillRect(boxX, boxY, textW, 20);
          ctx.strokeRect(boxX, boxY, textW, 20);

          ctx.fillStyle = '#F8FAFC';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(calloutText, ax, boxY + 10);
          ctx.restore();
        }

        // Also draw corresponding Fate line active marker if detected
        if (features.fate_line?.path && features.fate_line.path.length >= 2) {
          const fateFrac = ageToFateFraction(timelineAge);
          const fatePt = interpolatePolylineAtFraction(features.fate_line.path, fateFrac);
          if (fatePt) {
            const fx = fatePt.x * displayWidth;
            const fy = fatePt.y * displayHeight;

            ctx.save();
            ctx.shadowColor = '#C084FC';
            ctx.shadowBlur = 14;
            ctx.fillStyle = '#C084FC';
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(fx, fy, 5.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#C084FC';
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`Fate ${timelineAge}`, fx, fy - 10);
            ctx.restore();
          }
        }
      }

      ctx.restore();
    };

    const handleResize = () => {
      drawScene(loadedImage);
    };

    window.addEventListener('resize', handleResize);

    if (imageUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imageUrl;
      img.onload = () => {
        if (!active) return;
        loadedImage = img;
        drawScene(img);
      };
      img.onerror = () => {
        if (!active) return;
        drawScene(null);
      };
    } else {
      drawScene(null);
    }

    return () => {
      active = false;
      window.removeEventListener('resize', handleResize);
    };
  }, [
    imageUrl,
    features,
    roiBox,
    showHeart,
    showHead,
    showLife,
    showFate,
    showRoi,
    showGlow,
    showMounts,
    timelineActive,
    timelineAge,
  ]);

  const activeFeatureData =
    selectedFeature === 'heart'
      ? features.heart_line
      : selectedFeature === 'head'
      ? features.head_line
      : selectedFeature === 'life'
      ? features.life_line
      : selectedFeature === 'fate'
      ? features.fate_line
      : null;

  // Active milestone for current scrubbed age
  const currentMilestone =
    DEVELOPMENTAL_MILESTONES.slice().reverse().find((m) => timelineAge >= m.age) ||
    DEVELOPMENTAL_MILESTONES[0];

  return (
    <div className="w-full flex flex-col gap-6" ref={containerRef}>
      {/* Interactive Overlay Canvas */}
      <div className="relative rounded-2xl overflow-hidden border border-[rgba(200,170,110,0.25)] bg-[#070913] shadow-2xl flex justify-center items-center">
        <canvas ref={canvasRef} className="max-w-full block rounded-2xl" />

        {/* Floating Quick Action Overlay Bar */}
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#0B0E1B]/85 backdrop-blur-md border border-[rgba(200,170,110,0.2)] text-xs text-gray-300">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#C8AA6E]" />
            <span className="font-medium text-white hidden sm:inline">Palmar Vis</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMounts(!showMounts)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
                showMounts ? 'bg-[rgba(200,170,110,0.2)] text-[#C8AA6E] border border-[rgba(200,170,110,0.4)]' : 'bg-gray-800 text-gray-400'
              }`}
            >
              <Mountain className="w-3.5 h-3.5" />
              <span>3D Mounts</span>
            </button>

            <button
              onClick={() => setTimelineActive(!timelineActive)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
                timelineActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-gray-800 text-gray-400'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Timeline</span>
            </button>

            <button
              onClick={() => setShowGlow(!showGlow)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                showGlow ? 'bg-[rgba(200,170,110,0.2)] text-[#C8AA6E]' : 'bg-gray-800 text-gray-400'
              }`}
            >
              {showGlow ? 'Glow On' : 'Glow Off'}
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Visual Timeline Scrubber Panel */}
      {timelineActive && (
        <div className="glass-card p-5 rounded-2xl border border-emerald-500/30 bg-[#0B1020]/90 flex flex-col gap-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <h4 className="text-sm font-semibold text-white">Interactive Visual Timeline Calibration</h4>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Scrubbed Position:</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                Age {timelineAge}
              </span>
            </div>
          </div>

          {/* Scrubber Range Slider */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Age 18 (Emergence)</span>
              <span>Age 35 (Meridian Shift)</span>
              <span>Age 70+ (Elderhood)</span>
            </div>
            <input
              type="range"
              min={18}
              max={75}
              value={timelineAge}
              onChange={(e) => setTimelineAge(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-[#C8AA6E]"
            />
          </div>

          {/* Quick Milestone Selection Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-400 mr-1 flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-[#C8AA6E]" />
              Milestone Anchors:
            </span>
            {DEVELOPMENTAL_MILESTONES.map((ms) => (
              <button
                key={ms.age}
                onClick={() => setTimelineAge(ms.age)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${
                  Math.abs(timelineAge - ms.age) < 4
                    ? 'bg-[#C8AA6E] text-gray-950 font-bold shadow-md shadow-[#C8AA6E]/20 scale-105'
                    : 'bg-gray-800/80 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {ms.label} • {ms.shortName}
              </button>
            ))}
          </div>

          {/* Developmental Era Card */}
          <div className="p-4 rounded-xl bg-[#070913]/80 border border-[rgba(200,170,110,0.25)] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#C8AA6E] uppercase tracking-wider">
                Classical Palmar Chronology — Age {timelineAge}
              </span>
              <span className="text-[11px] text-gray-400 italic">Arc-Length Calibrated</span>
            </div>
            <h5 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentMilestone.color }} />
              {currentMilestone.eraName}
            </h5>
            <p className="text-xs text-gray-300 leading-relaxed">{currentMilestone.theme}</p>
            <div className="pt-2 border-t border-gray-800 text-xs">
              <span className="text-[#C8AA6E] font-medium block mb-1">
                Archetype: {currentMilestone.archetype}
              </span>
              <span className="text-gray-400 italic block">
                Reflective Inquiry: &quot;{currentMilestone.reflectiveQuery}&quot;
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Feature Selector and Toggles */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* Heart Line Toggle */}
        <button
          onClick={() => {
            setSelectedFeature('heart');
            setShowHeart(!showHeart);
          }}
          className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1.5 ${
            selectedFeature === 'heart'
              ? 'border-[#F43F5E] bg-[#F43F5E]/10'
              : 'border-[rgba(200,170,110,0.15)] bg-[#0D1122]/60 hover:border-gray-600'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-xs text-white flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F43F5E]" />
              Heart Line
            </span>
            {showHeart ? <Eye className="w-3.5 h-3.5 text-gray-400" /> : <EyeOff className="w-3.5 h-3.5 text-gray-600" />}
          </div>
          <span className="text-[11px] text-gray-400">
            {features.heart_line?.status === 'detected'
              ? 'Detected'
              : features.heart_line?.status === 'uncertain'
              ? 'Uncertain'
              : 'Not Detected'}
          </span>
        </button>

        {/* Head Line Toggle */}
        <button
          onClick={() => {
            setSelectedFeature('head');
            setShowHead(!showHead);
          }}
          className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1.5 ${
            selectedFeature === 'head'
              ? 'border-[#38BDF8] bg-[#38BDF8]/10'
              : 'border-[rgba(200,170,110,0.15)] bg-[#0D1122]/60 hover:border-gray-600'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-xs text-white flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#38BDF8]" />
              Head Line
            </span>
            {showHead ? <Eye className="w-3.5 h-3.5 text-gray-400" /> : <EyeOff className="w-3.5 h-3.5 text-gray-600" />}
          </div>
          <span className="text-[11px] text-gray-400">
            {features.head_line?.status === 'detected'
              ? 'Detected'
              : features.head_line?.status === 'uncertain'
              ? 'Uncertain'
              : 'Not Detected'}
          </span>
        </button>

        {/* Life Line Toggle */}
        <button
          onClick={() => {
            setSelectedFeature('life');
            setShowLife(!showLife);
          }}
          className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1.5 ${
            selectedFeature === 'life'
              ? 'border-[#34D399] bg-[#34D399]/10'
              : 'border-[rgba(200,170,110,0.15)] bg-[#0D1122]/60 hover:border-gray-600'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-xs text-white flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#34D399]" />
              Life Line
            </span>
            {showLife ? <Eye className="w-3.5 h-3.5 text-gray-400" /> : <EyeOff className="w-3.5 h-3.5 text-gray-600" />}
          </div>
          <span className="text-[11px] text-gray-400">
            {features.life_line?.status === 'detected'
              ? 'Detected'
              : features.life_line?.status === 'uncertain'
              ? 'Uncertain'
              : 'Not Detected'}
          </span>
        </button>

        {/* Fate Line Toggle */}
        <button
          onClick={() => {
            setSelectedFeature('fate');
            setShowFate(!showFate);
          }}
          className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1.5 ${
            selectedFeature === 'fate'
              ? 'border-[#C084FC] bg-[#C084FC]/10'
              : 'border-[rgba(200,170,110,0.15)] bg-[#0D1122]/60 hover:border-gray-600'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-xs text-white flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#C084FC]" />
              Fate Line
            </span>
            {showFate ? <Eye className="w-3.5 h-3.5 text-gray-400" /> : <EyeOff className="w-3.5 h-3.5 text-gray-600" />}
          </div>
          <span className="text-[11px] text-gray-400">
            {features.fate_line?.status === 'detected' ? 'Detected' : 'Absent / Subtle'}
          </span>
        </button>

        {/* 3D Mounts Toggle */}
        <button
          onClick={() => {
            setSelectedFeature('mounts');
            setShowMounts(!showMounts);
          }}
          className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1.5 col-span-2 sm:col-span-1 ${
            selectedFeature === 'mounts'
              ? 'border-[#C8AA6E] bg-[#C8AA6E]/15'
              : 'border-[rgba(200,170,110,0.15)] bg-[#0D1122]/60 hover:border-gray-600'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-xs text-white flex items-center gap-1.5">
              <Mountain className="w-3 h-3 text-[#C8AA6E]" />
              3D Mounts
            </span>
            {showMounts ? <Eye className="w-3.5 h-3.5 text-[#C8AA6E]" /> : <EyeOff className="w-3.5 h-3.5 text-gray-600" />}
          </div>
          <span className="text-[11px] text-[#C8AA6E]">Photometric 3D</span>
        </button>
      </div>

      {/* Feature Measurement Inspector Card */}
      {selectedFeature !== 'mounts' && activeFeatureData && (
        <div className="glass-card p-5 rounded-2xl flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-gray-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-[#C8AA6E]" />
              <h4 className="text-sm font-semibold text-white">
                {activeFeatureData.name} Analysis Details
              </h4>
            </div>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                activeFeatureData.status === 'detected'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : activeFeatureData.status === 'uncertain'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'bg-gray-800 text-gray-400'
              }`}
            >
              Status: {activeFeatureData.status}
            </span>
          </div>

          {activeFeatureData.status === 'detected' ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-[#070913]/60 p-3 rounded-xl border border-gray-800/80">
                <span className="text-gray-400 block mb-1">Observed Length Ratio</span>
                <span className="text-white font-mono font-medium text-sm">
                  {activeFeatureData.measurements.length_ratio ?? 'N/A'}
                </span>
                <span className="text-[10px] text-gray-400 block mt-0.5">Ratio relative to palm width</span>
              </div>
              <div className="bg-[#070913]/60 p-3 rounded-xl border border-gray-800/80">
                <span className="text-gray-400 block mb-1">Curvature Index</span>
                <span className="text-white font-mono font-medium text-sm">
                  {activeFeatureData.measurements.curvature_index ?? 'N/A'}
                </span>
                <span className="text-[10px] text-gray-400 block mt-0.5">1.0 = Linear, &gt;1.2 = Curved</span>
              </div>
              <div className="bg-[#070913]/60 p-3 rounded-xl border border-gray-800/80">
                <span className="text-gray-400 block mb-1">Line Trace Clarity Index</span>
                <span className="text-[#C8AA6E] font-mono font-medium text-sm">
                  {activeFeatureData.confidence !== null ? activeFeatureData.confidence : 'Not Calibrated'}
                </span>
                <span className="text-[10px] text-gray-400 block mt-0.5">Geometric visibility score — not predictive accuracy</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-amber-300/90 bg-amber-950/20 p-3 rounded-xl border border-amber-800/40">
              <p className="leading-relaxed">
                Unable to identify this feature reliably from the uploaded image. In accordance with Palmora AI integrity principles, we never fabricate lines or measurements that are not distinctly present.
              </p>
            </div>
          )}

          {activeFeatureData.confidence_explanation && (
            <p className="text-[11px] text-gray-400 italic">
              {activeFeatureData.confidence_explanation}
            </p>
          )}
        </div>
      )}

      {/* Topographic Mount Contouring (3D Elevation) Inspector Panel */}
      {(selectedFeature === 'mounts' || showMounts) && (
        <div className="glass-card p-5 rounded-2xl flex flex-col gap-4 border border-[rgba(200,170,110,0.3)] bg-[#0A0E1F]/90">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 pb-3">
            <div className="flex items-center gap-2">
              <Mountain className="w-4 h-4 text-[#C8AA6E]" />
              <h4 className="text-sm font-semibold text-white">
                Topographic Mount Contouring (Photometric 3D Elevation)
              </h4>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-[#C8AA6E]/20 text-[#C8AA6E] border border-[#C8AA6E]/40 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Surface Shading Evaluated
            </span>
          </div>

          <p className="text-xs text-gray-300 leading-relaxed">
            Using multi-band luminance contrast and local fleshiness convexity across the palmar disc,
            relative elevation is calibrated across the 6 major classical mounts.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PALM_MOUNTS.map((m) => {
              const mountData = (features.mount_topography as any)?.[m.key];
              const elevation: number = mountData?.relative_elevation ?? m.defaultElev;
              const prominence: string = mountData?.prominence ?? (elevation >= 0.6 ? 'developed' : 'moderate');
              const pct = Math.round(elevation * 100);

              return (
                <div key={m.key} className="p-3.5 rounded-xl bg-[#070913]/80 border border-gray-800/80 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{m.name}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${
                        prominence === 'developed' || prominence === 'prominent'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-gray-800 text-gray-300'
                      }`}
                    >
                      {prominence}
                    </span>
                  </div>

                  {/* Elevation progress bar */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px] text-gray-400">
                      <span>Relative Elevation</span>
                      <span className="font-mono text-[#C8AA6E] font-bold">{pct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#C8AA6E] to-emerald-400 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-gray-400 leading-snug">{m.symbolic}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
