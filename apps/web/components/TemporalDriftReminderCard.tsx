'use client';

import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Sparkles,
  Mail,
  Check,
  Download,
  RefreshCw,
  Bell,
} from 'lucide-react';
import { scheduleEvolutionReminder } from '../lib/api';

interface TemporalDriftReminderCardProps {
  readingId?: string;
}

export default function TemporalDriftReminderCard({ readingId }: TemporalDriftReminderCardProps) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDownloadIcs = () => {
    const now = new Date();
    const eventDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const formatIcsDate = (d: Date) =>
      `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T090000Z`;

    const startStr = formatIcsDate(eventDate);
    const endStr = formatIcsDate(new Date(eventDate.getTime() + 30 * 60 * 1000));

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Palmora AI//Temporal Crease Evolution//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:palmora_evolution_${Date.now()}@palmora.ai`,
      `DTSTAMP:${formatIcsDate(now)}`,
      `DTSTART:${startStr}`,
      `DTEND:${endStr}`,
      'SUMMARY:Palmora AI: 30-Day Palm Crease Evolution Rescan',
      'DESCRIPTION:Your palmar minor creases adapt over 30 to 90 days with lived shifts in career, physical vitality, and emotional regulation. Return to Palmora AI to rescan your palm and evaluate your biometric crease drift trajectory: https://palmora.ai/dashboard',
      'URL:https://palmora.ai/dashboard',
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT15M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Palmora AI Crease Evolution Check-in',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'palmora_30_day_crease_checkin.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleScheduleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await scheduleEvolutionReminder(email.trim(), readingId, 30);
      setScheduledDate(res.scheduled_date);
      setSuccessMessage(res.message);
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to register reminder.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full glass-card p-6 sm:p-8 rounded-3xl border border-[rgba(200,170,110,0.3)] bg-gradient-to-br from-[#0B0E1B] via-[#070913] to-[#12162A] shadow-2xl flex flex-col gap-5 text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#C8AA6E]/15 border border-[#C8AA6E]/30 flex items-center justify-center text-[#C8AA6E] shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#C8AA6E]">
              Temporal Morphometry
            </span>
            <h4 className="text-base font-bold text-white mt-0.5">
              30-Day Crease Drift Check-In
            </h4>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDownloadIcs}
          className="text-gray-300 hover:text-white px-3.5 py-2 rounded-xl border border-gray-800 hover:border-gray-700 bg-gray-900/60 flex items-center gap-2 self-start sm:self-center font-medium transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-[#C8AA6E]" />
          <span>Add to Calendar (.ics)</span>
        </button>
      </div>

      <p className="text-gray-300 leading-relaxed text-xs">
        Palm creases are not static blueprints—minor ridges and mount tension adapt dynamically over 30 to 90 days as your career, focus, and lifestyle evolve. Set a 30-day temporal check-in to track your trajectory over time.
      </p>

      {successMessage ? (
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 flex items-center gap-3">
          <Check className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <span className="font-semibold text-white">Check-In Confirmed for {scheduledDate}</span>
            <p className="text-[11px] text-gray-300 mt-0.5">{successMessage}</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleScheduleEmail} className="flex flex-col sm:flex-row items-center gap-2.5">
          <div className="relative flex-1 w-full">
            <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email for 30-day evolution reminder..."
              className="w-full bg-[#070913] border border-gray-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#C8AA6E] transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-gold px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 w-full sm:w-auto shrink-0 shadow-lg disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Scheduling...</span>
              </>
            ) : (
              <>
                <Bell className="w-3.5 h-3.5" />
                <span>Set 30-Day Check-in</span>
              </>
            )}
          </button>
        </form>
      )}

      {errorMessage && (
        <span className="text-[11px] text-rose-400">{errorMessage}</span>
      )}
    </div>
  );
}
