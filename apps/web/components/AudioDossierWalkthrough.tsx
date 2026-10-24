'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { PalmReadingReport } from '@palmora/shared-types';

interface AudioDossierWalkthroughProps {
  report: PalmReadingReport;
  onClose?: () => void;
}

interface Chapter {
  id: string;
  title: string;
  sectionKey: string;
  narrative: string;
}

export function AudioDossierWalkthrough({ report, onClose }: AudioDossierWalkthroughProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentChapterIdx, setCurrentChapterIdx] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(0.95); // gentle contemplative cadence
  const [ambientToneOn, setAmbientToneOn] = useState<boolean>(true);
  const [speechSupported, setSpeechSupported] = useState<boolean>(true);
  const [musicVolume, setMusicVolume] = useState<number>(0.15); // Gentle whisper background volume
  const [isDucked, setIsDucked] = useState<boolean>(true);

  // Web Audio Context for ambient contemplative 432 Hz Solfeggio drone
  const audioCtxRef = useRef<AudioContext | null>(null);
  const droneGainRef = useRef<GainNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const osc1Ref = useRef<OscillatorNode | null>(null);
  const osc2Ref = useRef<OscillatorNode | null>(null);

  // Speech utterance ref
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Construct Chapters from report
  const chapters: Chapter[] = [
    {
      id: 'intro',
      title: 'Introduction & Palmar Orientation',
      sectionKey: 'overview',
      narrative: `Welcome to your Palmora personal palm dossier. ${report.reading_title}. This reading provides contemplative symbolic reflections on your observable palmar morphology, designed to guide mindfulness and self-discovery.`,
    },
    {
      id: 'heart',
      title: report.love_reading?.title || 'Heart Line: Emotional Expression',
      sectionKey: 'love',
      narrative: `${report.love_reading?.title || 'Heart Line'}. In traditional palmistry, ${report.love_reading?.traditional_interpretation || ''} ${report.love_reading?.reflective_prompts?.[0] ? 'Consider this reflection: ' + report.love_reading.reflective_prompts[0] : ''}`,
    },
    {
      id: 'head',
      title: report.career_reading?.title || 'Head Line: Cognitive Temperament',
      sectionKey: 'career',
      narrative: `${report.career_reading?.title || 'Head Line'}. Regarding cognitive focus and vocational direction, ${report.career_reading?.traditional_interpretation || ''} ${report.career_reading?.reflective_prompts?.[0] ? 'Mindful inquiry: ' + report.career_reading.reflective_prompts[0] : ''}`,
    },
    {
      id: 'life',
      title: report.personality_reading?.title || 'Life Line: Vitality & Pacing',
      sectionKey: 'personality',
      narrative: `${report.personality_reading?.title || 'Life Line'}. Regarding stamina and lifestyle rhythm, ${report.personality_reading?.traditional_interpretation || ''} ${report.personality_reading?.reflective_prompts?.[0] ? 'Contemplative inquiry: ' + report.personality_reading.reflective_prompts[0] : ''}`,
    },
    {
      id: 'synthesis',
      title: 'Holistic Synthesis & Mindfulness Guidance',
      sectionKey: 'synthesis',
      narrative: `In overall synthesis: ${report.overall_synthesis || ''} Take a grounding breath and carry these insights forward with intentional clarity and compassion.`,
    },
  ];

  useEffect(() => {
    if (typeof window !== 'undefined' && !('speechSynthesis' in window)) {
      setSpeechSupported(false);
    }

    const handleOtherAudio = (e: Event) => {
      const ce = e as CustomEvent;
      if (ce.detail !== 'walkthrough') {
        stopPlayback();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('palmora_audio_play', handleOtherAudio);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('palmora_audio_play', handleOtherAudio);
      }
      stopPlayback();
    };
  }, []);

  const getTargetGain = (duck: boolean, volume = musicVolume): number => {
    if (!ambientToneOn) return 0.00001;
    // Ultra-soft whisper backing: 0.005 when talking (never disturbs speech), 0.018 during pauses
    return duck ? volume * 0.006 : volume * 0.020;
  };

  const applyDroneGain = (duck: boolean, volume = musicVolume) => {
    if (droneGainRef.current && audioCtxRef.current) {
      const target = getTargetGain(duck, volume);
      droneGainRef.current.gain.linearRampToValueAtTime(
        Math.max(0.00001, target),
        audioCtxRef.current.currentTime + 0.3
      );
    }
  };

  // Web Audio 432 Hz Solfeggio ambient drone with Lowpass filtering and soft sines
  const startAmbientTone = () => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }

      if (droneGainRef.current) {
        applyDroneGain(true);
        return;
      }

      const ctx = audioCtxRef.current;

      // 1. Warm Lowpass Filter (eliminates all harsh buzzing high harmonics)
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(180, ctx.currentTime);
      filter.Q.setValueAtTime(0.7, ctx.currentTime);
      filter.connect(ctx.destination);
      filterRef.current = filter;

      // 2. Master Gain Node with gentle ramp
      const gain = ctx.createGain();
      const initialGain = getTargetGain(true);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(initialGain, ctx.currentTime + 0.5);
      gain.connect(filter);
      droneGainRef.current = gain;

      // 3. Primary 108 Hz Sub-harmonic Sine (Meditative fundamental)
      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(108, ctx.currentTime);
      osc1.connect(gain);
      osc1.start();
      osc1Ref.current = osc1;

      // 4. Soft 162 Hz Pure Sine overtone (gentle perfect fifth harmonic, NO harsh triangle)
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(162, ctx.currentTime);
      const osc2Gain = ctx.createGain();
      osc2Gain.gain.setValueAtTime(0.35, ctx.currentTime);
      osc2.connect(osc2Gain);
      osc2Gain.connect(gain);
      osc2.start();
      osc2Ref.current = osc2;
    } catch (e) {
      console.warn('Ambient drone audio context initialization skipped:', e);
    }
  };

  const stopAmbientTone = () => {
    try {
      if (droneGainRef.current && audioCtxRef.current) {
        droneGainRef.current.gain.linearRampToValueAtTime(0.00001, audioCtxRef.current.currentTime + 0.3);
        setTimeout(() => {
          osc1Ref.current?.stop();
          osc2Ref.current?.stop();
          osc1Ref.current?.disconnect();
          osc2Ref.current?.disconnect();
          droneGainRef.current?.disconnect();
          filterRef.current?.disconnect();
          osc1Ref.current = null;
          osc2Ref.current = null;
          droneGainRef.current = null;
          filterRef.current = null;
        }, 300);
      }
    } catch {
      // ignore cleanup errors
    }
  };

  const playChapter = (index: number) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    window.dispatchEvent(new CustomEvent('palmora_audio_play', { detail: 'walkthrough' }));
    setCurrentChapterIdx(index);

    const chapter = chapters[index];
    if (!chapter) return;

    const utterance = new SpeechSynthesisUtterance(chapter.narrative);
    utterance.rate = playbackRate;
    utterance.pitch = 0.98; // gentle warm pitch

    // Prefer high quality natural voices if available
    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(
      (v) =>
        (v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel') || v.name.includes('Karen') || v.name.includes('Serena')))
    ) || voices.find((v) => v.lang.startsWith('en'));

    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    utterance.onstart = () => {
      setIsDucked(true);
      applyDroneGain(true);
    };

    utterance.onend = () => {
      setIsDucked(false);
      applyDroneGain(false); // subtle swell between chapters
      if (index < chapters.length - 1) {
        // Auto-advance to next chapter with 1s contemplative pause
        setTimeout(() => {
          playChapter(index + 1);
        }, 1000);
      } else {
        setIsPlaying(false);
        stopAmbientTone();
      }
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      setIsDucked(false);
      stopAmbientTone();
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);

    if (ambientToneOn) {
      startAmbientTone();
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      window.speechSynthesis.pause();
      setIsPlaying(false);
      setIsDucked(false);
      stopAmbientTone();
    } else {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setIsPlaying(true);
        setIsDucked(true);
        if (ambientToneOn) {
          startAmbientTone();
          applyDroneGain(true);
        }
      } else {
        playChapter(currentChapterIdx);
      }
    }
  };

  const stopPlayback = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setIsDucked(false);
    stopAmbientTone();
  };

  const nextChapter = () => {
    if (currentChapterIdx < chapters.length - 1) {
      playChapter(currentChapterIdx + 1);
    }
  };

  const prevChapter = () => {
    if (currentChapterIdx > 0) {
      playChapter(currentChapterIdx - 1);
    }
  };

  return (
    <div className="rounded-2xl border border-gold-500/30 bg-gradient-to-b from-stone-900/90 via-stone-950/95 to-black p-6 backdrop-blur-xl shadow-[0_0_40px_rgba(217,119,6,0.15)] text-stone-200">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-gold-500/10 border border-gold-500/30 flex items-center justify-center text-gold-400">
            🎙️
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-widest text-gold-400 font-semibold">
              Voice-Guided Walkthrough
            </span>
            <h3 className="text-base sm:text-lg font-serif font-medium text-white">
              Audio Reading Dossier
            </h3>
          </div>
        </div>

        {onClose && (
          <button
            onClick={() => {
              stopPlayback();
              onClose();
            }}
            className="text-stone-400 hover:text-white text-sm p-1.5 transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {!speechSupported && (
        <div className="my-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300">
          Speech synthesis is not supported on this browser device. Please listen on Chrome, Safari, or Edge.
        </div>
      )}

      {/* Active Chapter Card */}
      <div className="my-5 p-4 rounded-xl bg-black/40 border border-white/10">
        <div className="flex items-center justify-between text-xs text-stone-400 mb-1">
          <span>
            Chapter {currentChapterIdx + 1} of {chapters.length}
          </span>
          <span className="text-gold-400/80 font-mono">
            {Math.round(((currentChapterIdx + 1) / chapters.length) * 100)}% Complete
          </span>
        </div>
        <h4 className="text-base font-serif text-white font-medium mb-2">
          {chapters[currentChapterIdx].title}
        </h4>
        <p className="text-xs text-stone-300 line-clamp-3 leading-relaxed">
          {chapters[currentChapterIdx].narrative}
        </p>
      </div>

      {/* Chapters Scrubber */}
      <div className="flex items-center gap-1.5 mb-5">
        {chapters.map((ch, idx) => (
          <button
            key={ch.id}
            onClick={() => playChapter(idx)}
            className={`flex-1 h-1.5 rounded-full transition-all ${
              idx === currentChapterIdx
                ? 'bg-gold-400 shadow-[0_0_8px_rgba(217,119,6,0.6)]'
                : idx < currentChapterIdx
                ? 'bg-gold-500/40'
                : 'bg-white/10 hover:bg-white/20'
            }`}
            title={ch.title}
          />
        ))}
      </div>

      {/* Primary Audio Controls */}
      <div className="flex items-center justify-between gap-4 py-2 border-t border-b border-white/10">
        <div className="flex items-center gap-3">
          <button
            onClick={prevChapter}
            disabled={currentChapterIdx === 0}
            className="text-stone-400 hover:text-white disabled:opacity-30 transition-opacity p-2"
            title="Previous Section"
          >
            ⏮
          </button>

          <button
            onClick={togglePlay}
            className="w-12 h-12 rounded-full bg-gold-500 hover:bg-gold-400 text-black flex items-center justify-center font-bold text-lg shadow-[0_0_20px_rgba(217,119,6,0.4)] transition-transform active:scale-95"
          >
            {isPlaying ? '⏸' : '▶'}
          </button>

          <button
            onClick={nextChapter}
            disabled={currentChapterIdx === chapters.length - 1}
            className="text-stone-400 hover:text-white disabled:opacity-30 transition-opacity p-2"
            title="Next Section"
          >
            ⏭
          </button>
        </div>

        {/* Cadence Speed Selector */}
        <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-lg p-1 text-xs">
          {[
            { label: '0.85x', rate: 0.85 },
            { label: '1.0x', rate: 0.98 },
            { label: '1.15x', rate: 1.15 },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => {
                setPlaybackRate(item.rate);
                if (isPlaying) playChapter(currentChapterIdx);
              }}
              className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                Math.abs(playbackRate - item.rate) < 0.05
                  ? 'bg-gold-500/20 text-gold-300 font-semibold'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Ambient Volume Slider & Mute Toggle */}
        <div className="flex items-center gap-2">
          {ambientToneOn && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/10 text-[11px] text-stone-400" title="Ambient Music Volume">
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
                  applyDroneGain(isDucked, vol);
                }}
                className="w-14 sm:w-20 h-1 accent-amber-400 bg-stone-700 rounded cursor-pointer"
              />
            </div>
          )}

          <button
            onClick={() => {
              const next = !ambientToneOn;
              setAmbientToneOn(next);
              if (next && isPlaying) {
                startAmbientTone();
                applyDroneGain(true);
              } else {
                stopAmbientTone();
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
              ambientToneOn
                ? 'bg-gold-500/10 border-gold-500/40 text-gold-300'
                : 'bg-black/30 border-white/10 text-stone-400 hover:text-stone-200'
            }`}
            title="Toggle 432 Hz Solfeggio meditative harmonic drone backing"
          >
            <span>{ambientToneOn ? '🎶' : '🔇'}</span>
            <span className="hidden sm:inline">{ambientToneOn ? 'Ambient On' : 'Music Muted'}</span>
          </button>
        </div>
      </div>

      <div className="pt-3 text-[11px] text-stone-400 text-center flex items-center justify-center gap-2">
        <span>✨ Contemplative Ambient Audio Walkthrough</span>
        <span>•</span>
        <span>Synthesized Natural Cadence</span>
      </div>
    </div>
  );
}
