'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Music,
  Radio,
} from 'lucide-react';
import type { PalmReadingReport, DualHandReadingReport } from '@palmora/shared-types';

interface AmbientAudioOracleProps {
  report?: PalmReadingReport;
  dualReport?: DualHandReadingReport | null;
}

export default function AmbientAudioOracle({ report, dualReport }: AmbientAudioOracleProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [ambientChimes, setAmbientChimes] = useState<boolean>(true);
  const [speechRate, setSpeechRate] = useState<number>(0.9);
  const [supported, setSupported] = useState<boolean>(true);

  const [musicVolume, setMusicVolume] = useState<number>(0.2); // 20% soft whisper level
  const [isDucked, setIsDucked] = useState<boolean>(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const osc1Ref = useRef<OscillatorNode | null>(null);
  const osc2Ref = useRef<OscillatorNode | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setSupported(false);
    }

    const handleOtherAudio = (e: Event) => {
      const ce = e as CustomEvent;
      if (ce.detail !== 'oracle') {
        stopAll();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('palmora_audio_play', handleOtherAudio);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('palmora_audio_play', handleOtherAudio);
      }
      stopAll();
    };
  }, []);

  const getTargetGain = (duck: boolean, volume = musicVolume): number => {
    if (!ambientChimes) return 0.00001;
    // Duck to ultra-quiet background whisper (0.005 max) during speech so speech is 100% intelligible
    return duck ? volume * 0.008 : volume * 0.024;
  };

  const initWebAudioDrone = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      if (masterGainRef.current) {
        applyDroneVolume(true);
        return;
      }

      // 1. Warm Low-Pass Filter to eliminate harsh buzzing or high frequencies
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(180, ctx.currentTime);
      filter.Q.setValueAtTime(0.7, ctx.currentTime);
      filter.connect(ctx.destination);
      filterRef.current = filter;

      // 2. Master Gain (with gentle ramp)
      const masterGain = ctx.createGain();
      const initialGain = getTargetGain(true);
      masterGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(initialGain, ctx.currentTime + 0.5);
      masterGain.connect(filter);
      masterGainRef.current = masterGain;

      // 3. Gentle 108 Hz Sub-octave Sine (Meditative Solfeggio fundamental)
      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(108, ctx.currentTime);
      osc1.connect(masterGain);
      osc1.start();
      osc1Ref.current = osc1;

      // 4. Soft 162 Hz Pure Sine overtone (Musical perfect fifth, pure soothing sine, NO harsh triangle)
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(162, ctx.currentTime);
      const osc2Gain = ctx.createGain();
      osc2Gain.gain.setValueAtTime(0.4, ctx.currentTime);
      osc2.connect(osc2Gain);
      osc2Gain.connect(masterGain);
      osc2.start();
      osc2Ref.current = osc2;
    } catch {
      // AudioContext policy restriction
    }
  };

  const applyDroneVolume = (duck: boolean) => {
    if (masterGainRef.current && audioCtxRef.current) {
      const target = getTargetGain(duck);
      masterGainRef.current.gain.linearRampToValueAtTime(
        Math.max(0.00001, target),
        audioCtxRef.current.currentTime + 0.3
      );
    }
  };

  const setDroneMute = (mute: boolean) => {
    if (masterGainRef.current && audioCtxRef.current) {
      const target = mute ? 0.00001 : getTargetGain(isDucked);
      masterGainRef.current.gain.linearRampToValueAtTime(
        target,
        audioCtxRef.current.currentTime + 0.3
      );
    }
  };

  const getNarrationScript = (): string => {
    if (dualReport) {
      return (
        `Welcome to your dual-hand palmar synthesis. ${dualReport.reading_title}. ` +
        `Your overall evolutionary trajectory is summarized as follows: ${dualReport.overall_evolution_synthesis}. ` +
        (dualReport.comparative_sections || [])
          .map((s) => `${s.line_name}. ${s.evolution_narrative}. Recommendation: ${s.growth_recommendation}.`)
          .join(' ')
      );
    }
    if (report) {
      return (
        `Welcome to your personal palmar synthesis. ${report.reading_title}. ` +
        `Synthesis: ${report.overall_synthesis}. ` +
        `Regarding emotional harmony: ${report.love_reading.traditional_interpretation}. ` +
        `Regarding career and strategic purpose: ${report.career_reading.traditional_interpretation}. ` +
        `Regarding vitality and equilibrium: ${report.personality_reading.traditional_interpretation}.`
      );
    }
    return 'Your personal palm reading reflection is ready.';
  };

  const handlePlay = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (isPaused) {
      window.speechSynthesis.resume();
      setIsDucked(true);
      applyDroneVolume(true);
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    stopAll();

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('palmora_audio_play', { detail: 'oracle' }));
    }

    // Start soft, filtered ambient meditation drone
    if (ambientChimes) {
      initWebAudioDrone();
      setIsDucked(true);
      applyDroneVolume(true);
    }

    const script = getNarrationScript();
    const utterance = new SpeechSynthesisUtterance(script);
    utterance.rate = speechRate;
    utterance.pitch = 0.95;

    // Pick soothing natural voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) =>
        v.lang.startsWith('en') &&
        (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Serena'))
    );
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => {
      setIsDucked(true);
      applyDroneVolume(true);
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setIsDucked(false);
      setDroneMute(true);
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setIsDucked(false);
      setDroneMute(true);
    };

    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
    setIsPaused(false);
  };

  const handlePause = () => {
    if (typeof window === 'undefined') return;
    window.speechSynthesis.pause();
    setIsDucked(false);
    setDroneMute(true);
    setIsPaused(true);
    setIsPlaying(false);
  };

  const stopAll = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsDucked(false);
    setDroneMute(true);
    setIsPlaying(false);
    setIsPaused(false);

    try {
      if (osc1Ref.current) {
        osc1Ref.current.stop();
        osc1Ref.current.disconnect();
        osc1Ref.current = null;
      }
      if (osc2Ref.current) {
        osc2Ref.current.stop();
        osc2Ref.current.disconnect();
        osc2Ref.current = null;
      }
      if (masterGainRef.current) {
        masterGainRef.current.disconnect();
        masterGainRef.current = null;
      }
      if (filterRef.current) {
        filterRef.current.disconnect();
        filterRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    } catch {
      // ignore node teardown errors
    }
  };

  if (!supported) return null;

  return (
    <div className="w-full glass-card p-4 sm:p-5 rounded-2xl border border-[rgba(200,170,110,0.35)] bg-gradient-to-r from-[#070913] via-[#0E1326] to-[#070913] shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 print:hidden">
      <div className="flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-[#C8AA6E]/20 border border-[#C8AA6E]/40 flex items-center justify-center text-[#C8AA6E] shrink-0 shadow-lg">
          {isPlaying ? (
            <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
          ) : (
            <Music className="w-5 h-5 text-[#C8AA6E]" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#C8AA6E]">
              Audio Sanctuary
            </span>
            {isPlaying && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-semibold animate-pulse">
                Speaking Oracle
              </span>
            )}
            {ambientChimes && isPlaying && (
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300/90 font-mono">
                Ducked 20%
              </span>
            )}
          </div>
          <h4 className="text-xs sm:text-sm font-bold text-white mt-0.5">
            Ambient Audio Oracle Narration
          </h4>
        </div>
      </div>

      {/* Audio Controls */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Play/Pause Button */}
        {!isPlaying ? (
          <button
            type="button"
            onClick={handlePlay}
            className="btn-gold px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg hover:scale-105 transition-transform"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isPaused ? 'Resume Oracle' : 'Listen to Synthesis'}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handlePause}
            className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 flex items-center gap-2 shadow-lg transition-colors"
          >
            <Pause className="w-3.5 h-3.5 fill-current" />
            <span>Pause</span>
          </button>
        )}

        {/* Restart Button */}
        {(isPlaying || isPaused) && (
          <button
            type="button"
            onClick={() => {
              stopAll();
              setTimeout(handlePlay, 100);
            }}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            title="Restart Narration"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}

        {/* Music Volume Slider */}
        {ambientChimes && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-black/40 border border-gray-800 text-[11px] text-gray-400" title="Background Music Volume">
            <span>🎶</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={musicVolume}
              onChange={(e) => {
                const vol = parseFloat(e.target.value);
                setMusicVolume(vol);
                if (masterGainRef.current && audioCtxRef.current) {
                  masterGainRef.current.gain.linearRampToValueAtTime(
                    getTargetGain(isDucked, vol),
                    audioCtxRef.current.currentTime + 0.1
                  );
                }
              }}
              className="w-16 h-1 accent-[#C8AA6E] bg-gray-700 rounded cursor-pointer"
            />
          </div>
        )}

        {/* 432 Hz Drone Toggle */}
        <button
          type="button"
          onClick={() => {
            const next = !ambientChimes;
            setAmbientChimes(next);
            if (next && isPlaying) {
              initWebAudioDrone();
              applyDroneVolume(true);
            } else {
              setDroneMute(true);
            }
          }}
          className={`px-3 py-2 rounded-xl text-[11px] font-semibold border transition-all flex items-center gap-1.5 ${
            ambientChimes
              ? 'bg-[#C8AA6E]/20 border-[#C8AA6E]/40 text-[#C8AA6E]'
              : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'
          }`}
          title="Toggle 432Hz ambient meditation resonance backing"
        >
          {ambientChimes ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          <span>{ambientChimes ? 'Ambient On' : 'Music Muted'}</span>
        </button>
      </div>
    </div>
  );
}
