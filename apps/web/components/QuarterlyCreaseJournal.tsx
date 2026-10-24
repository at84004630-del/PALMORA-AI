'use client';

import React, { useState, useEffect } from 'react';
import type {
  CreaseJournalEntry,
  HabitAlignmentSummary,
  MindfulnessHabit,
  TemporalDriftReport,
} from '@palmora/shared-types';
import {
  saveCreaseJournalEntry,
  getCreaseJournalEntries,
  deleteCreaseJournalEntry,
  calculateHabitAlignment,
} from '../lib/storage';

interface QuarterlyCreaseJournalProps {
  driftReport?: TemporalDriftReport | null;
}

export function QuarterlyCreaseJournal({ driftReport }: QuarterlyCreaseJournalProps) {
  const [entries, setEntries] = useState<CreaseJournalEntry[]>([]);
  const [summary, setSummary] = useState<HabitAlignmentSummary | null>(null);

  // Form State
  const [selectedHabits, setSelectedHabits] = useState<MindfulnessHabit[]>(['meditation']);
  const [stressRating, setStressRating] = useState<number>(2);
  const [mindfulnessMinutes, setMindfulnessMinutes] = useState<number>(20);
  const [reflectionText, setReflectionText] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  useEffect(() => {
    loadJournal();
  }, [driftReport]);

  const loadJournal = () => {
    const list = getCreaseJournalEntries();
    setEntries(list);
    const calculated = calculateHabitAlignment(list, driftReport);
    setSummary(calculated);
  };

  const handleToggleHabit = (habit: MindfulnessHabit) => {
    if (selectedHabits.includes(habit)) {
      setSelectedHabits(selectedHabits.filter((h) => h !== habit));
    } else {
      setSelectedHabits([...selectedHabits, habit]);
    }
  };

  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedHabits.length === 0) return;

    saveCreaseJournalEntry({
      date: new Date().toISOString(),
      habits_completed: selectedHabits,
      stress_rating: stressRating,
      mindfulness_minutes: mindfulnessMinutes,
      reflection_text: reflectionText.trim() || 'Mindful presence session completed.',
    });

    setReflectionText('');
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
    loadJournal();
  };

  const handleDelete = (id: string) => {
    deleteCreaseJournalEntry(id);
    loadJournal();
  };

  const habitOptions: { id: MindfulnessHabit; label: string; icon: string }[] = [
    { id: 'meditation', label: 'Meditation & Breathwork', icon: '🧘' },
    { id: 'circadian_sleep', label: 'Circadian Sleep Rhythm', icon: '🌙' },
    { id: 'movement_vitality', label: 'Physical Movement', icon: '🏃' },
    { id: 'deep_focus', label: 'Deep Focus & Digital Fasting', icon: '⚡' },
    { id: 'emotional_boundaries', label: 'Emotional Boundary Clearing', icon: '🛡️' },
  ];

  return (
    <div className="space-y-8">
      {/* Overview Analytics Bar */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-white/10 bg-black/40 p-4">
            <span className="text-[10px] uppercase tracking-wider text-stone-400">Total Check-Ins</span>
            <div className="text-2xl font-serif font-bold text-white mt-1">{summary.total_checkins}</div>
          </div>

          <div className="rounded-xl border border-gold-500/20 bg-gold-950/10 p-4">
            <span className="text-[10px] uppercase tracking-wider text-gold-400">Current Streak</span>
            <div className="text-2xl font-serif font-bold text-gold-300 mt-1">
              {summary.current_streak_days} <span className="text-xs font-normal">days</span>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4">
            <span className="text-[10px] uppercase tracking-wider text-emerald-400">Tension Softening</span>
            <div className="text-2xl font-serif font-bold text-emerald-300 mt-1">
              ~{summary.correlated_tension_reduction_pct}%
            </div>
          </div>

          <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-4">
            <span className="text-[10px] uppercase tracking-wider text-cyan-400">Alignment Score</span>
            <div className="text-2xl font-serif font-bold text-cyan-300 mt-1">
              {summary.habit_alignment_score}
            </div>
          </div>
        </div>
      )}

      {/* Clinical Mindfulness Insight Banner */}
      {summary && summary.clinical_mindfulness_insight && (
        <div className="rounded-2xl border border-gold-500/30 bg-gradient-to-r from-gold-950/20 via-stone-900/60 to-black p-5 text-xs text-stone-300 leading-relaxed flex items-start gap-3">
          <span className="text-lg text-gold-400">🌿</span>
          <div>
            <span className="font-semibold text-white">Somatic Crease Correlation:</span>{' '}
            {summary.clinical_mindfulness_insight}
          </div>
        </div>
      )}

      {/* New Journal Check-In Form */}
      <div className="rounded-2xl border border-white/10 bg-stone-900/60 p-6 backdrop-blur-md">
        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-white/10">
          <span className="text-xl">✍️</span>
          <div>
            <h3 className="text-lg font-serif text-white">New Mindfulness & Crease Check-In</h3>
            <p className="text-xs text-stone-400">Log habits to correlate intentional lifestyle shifts with softening palmar tension.</p>
          </div>
        </div>

        <form onSubmit={handleSaveEntry} className="space-y-6">
          {/* Habits Checkboxes */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-400 font-semibold mb-3">
              Habits Practiced
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {habitOptions.map((opt) => {
                const active = selectedHabits.includes(opt.id);
                return (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => handleToggleHabit(opt.id)}
                    className={`flex items-center gap-2 p-3 rounded-xl border text-xs text-left transition-all ${
                      active
                        ? 'bg-gold-500/15 border-gold-500/40 text-gold-200 shadow-[0_0_12px_rgba(217,119,6,0.15)]'
                        : 'bg-black/30 border-white/5 text-stone-400 hover:border-white/20'
                    }`}
                  >
                    <span className="text-base">{opt.icon}</span>
                    <span className="font-medium">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sliders: Stress & Mindfulness Minutes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-stone-400">Current Stress Rating</span>
                <span className="text-white font-mono">
                  {stressRating} / 5 ({['Serene', 'Mild', 'Moderate', 'Elevated', 'Overwhelmed'][stressRating - 1]})
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                value={stressRating}
                onChange={(e) => setStressRating(parseInt(e.target.value))}
                className="w-full accent-gold-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-stone-400">Mindfulness Investment</span>
                <span className="text-white font-mono">{mindfulnessMinutes} minutes</span>
              </div>
              <input
                type="range"
                min="5"
                max="90"
                step="5"
                value={mindfulnessMinutes}
                onChange={(e) => setMindfulnessMinutes(parseInt(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Qualitative Reflection */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-400 font-semibold mb-2">
              Qualitative Reflection & Somatic Notes
            </label>
            <textarea
              rows={3}
              value={reflectionText}
              onChange={(e) => setReflectionText(e.target.value)}
              placeholder="Notice any shifts in nervous tension, emotional pacing, or clarity..."
              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-stone-400 focus:outline-none focus:border-gold-500/50"
            />
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between pt-2">
            {saveSuccess ? (
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
                <span>✓</span> Check-in recorded! Crease drift model updated.
              </span>
            ) : (
              <span className="text-[11px] text-stone-400">Entries stored in secure private local storage.</span>
            )}

            <button
              type="submit"
              disabled={selectedHabits.length === 0}
              className="px-5 py-2.5 rounded-xl bg-gold-500 hover:bg-gold-400 text-black font-semibold text-xs shadow-[0_0_15px_rgba(217,119,6,0.3)] transition-all disabled:opacity-40"
            >
              Record Check-In
            </button>
          </div>
        </form>
      </div>

      {/* Journal History */}
      {entries.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-xs uppercase tracking-wider text-stone-400 font-semibold">
            Past Check-In History ({entries.length})
          </h4>

          <div className="space-y-3">
            {entries.slice(0, 10).map((entry) => (
              <div
                key={entry.id}
                className="rounded-xl border border-white/5 bg-stone-900/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-gold-400 font-mono text-[11px]">
                      {new Date(entry.date).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="text-stone-400">•</span>
                    <span className="text-stone-300 font-medium">
                      Stress {entry.stress_rating}/5
                    </span>
                    <span className="text-stone-400">•</span>
                    <span className="text-cyan-300">{entry.mindfulness_minutes}m mindful</span>
                  </div>

                  <p className="text-stone-300 italic">"{entry.reflection_text}"</p>

                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {entry.habits_completed.map((h) => (
                      <span
                        key={h}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-stone-300"
                      >
                        {h.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(entry.id)}
                  className="text-stone-400 hover:text-red-400 text-xs self-end sm:self-center transition-colors p-1"
                  title="Delete entry"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
