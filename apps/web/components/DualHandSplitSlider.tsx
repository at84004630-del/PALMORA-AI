'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Compass, MoveHorizontal } from 'lucide-react';
import type { PalmFeatures } from '@palmora/shared-types';
import PalmOverlayCanvas from './PalmOverlayCanvas';

interface DualHandSplitSliderProps {
  innateFeatures: PalmFeatures;
  manifestedFeatures: PalmFeatures;
  innateImageUrl?: string | null;
  manifestedImageUrl?: string | null;
  nonDominantHand?: string;
  dominantHand?: string;
}

export default function DualHandSplitSlider({
  innateFeatures,
  manifestedFeatures,
  innateImageUrl,
  manifestedImageUrl,
  nonDominantHand = 'left',
  dominantHand = 'right',
}: DualHandSplitSliderProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [sliderPos, setSliderPos] = useState<number>(50); // percentage 0 to 100
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const clampedX = Math.max(0, Math.min(rect.width, x));
    const percent = (clampedX / rect.width) * 100;
    setSliderPos(percent);
  }, []);

  const handleMouseDown = () => setIsDragging(true);
  const handleTouchStart = () => setIsDragging(true);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      handleMove(e.clientX);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || !e.touches[0]) return;
      handleMove(e.touches[0].clientX);
    };
    const onStop = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onStop);
      window.addEventListener('touchmove', onTouchMove);
      window.addEventListener('touchend', onStop);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onStop);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onStop);
    };
  }, [isDragging, handleMove]);

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Informative Sub-Header */}
      <div className="flex items-center justify-between text-xs px-2">
        <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-indigo-400" />
          <span>Innate Blueprint ({nonDominantHand})</span>
        </span>
        <span className="text-[11px] text-gray-400 flex items-center gap-1">
          <MoveHorizontal className="w-3.5 h-3.5 text-[#C8AA6E]" />
          <span>Drag slider to compare divergence</span>
        </span>
        <span className="font-semibold text-[#C8AA6E] flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#C8AA6E]" />
          <span>Manifested Path ({dominantHand})</span>
        </span>
      </div>

      {/* Split Slider Viewport */}
      <div
        ref={containerRef}
        className="relative w-full aspect-square max-h-[520px] rounded-3xl overflow-hidden select-none border border-[rgba(200,170,110,0.35)] shadow-2xl bg-[#070913] cursor-ew-resize"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Under layer: Manifested Reality (Dominant Hand) */}
        <div className="absolute inset-0 w-full h-full">
          <PalmOverlayCanvas
            imageUrl={manifestedImageUrl || null}
            features={manifestedFeatures}
          />
          <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full border border-[rgba(200,170,110,0.3)] text-[10px] text-[#C8AA6E] font-semibold">
            Right: Manifested Path ({dominantHand})
          </div>
        </div>

        {/* Top layer clipped: Innate Blueprint (Non-Dominant Hand) */}
        <div
          className="absolute inset-0 w-full h-full overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
        >
          <PalmOverlayCanvas
            imageUrl={innateImageUrl || null}
            features={innateFeatures}
          />
          <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full border border-indigo-500/30 text-[10px] text-indigo-300 font-semibold">
            Left: Innate Potential ({nonDominantHand})
          </div>
        </div>

        {/* Vertical Divider Line with Stylized Gold Thumb */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-gradient-to-b from-[#C8AA6E]/40 via-[#C8AA6E] to-[#C8AA6E]/40 shadow-[0_0_12px_rgba(200,170,110,0.8)] pointer-events-none"
          style={{ left: `${sliderPos}%` }}
        >
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-[#070913] border-2 border-[#C8AA6E] shadow-xl flex items-center justify-center text-[#C8AA6E]">
            <MoveHorizontal className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
