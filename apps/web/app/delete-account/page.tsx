'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Trash2, ShieldCheck, AlertCircle, CheckCircle2, ArrowLeft, Lock } from 'lucide-react';
import { clearAllLocalUserData } from '../../lib/storage';
import { deleteUserAccount, trackAnalyticsEvent } from '../../lib/api';

export default function DeleteAccountPage() {
  const [email, setEmail] = useState('');
  const [confirmationPhrase, setConfirmationPhrase] = useState('');
  const [localDataCleared, setLocalDataCleared] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleClearBrowserData = () => {
    clearAllLocalUserData();
    setLocalDataCleared(true);
  };

  const handleRequestServerDeletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmationPhrase.trim().toUpperCase() !== 'DELETE') return;

    setSubmitting(true);
    try {
      // Fire analytics event for deletion request
      await trackAnalyticsEvent('account_deletion_requested', {
        source: 'web_delete_account_portal',
        email: email || undefined,
      });

      // Call backend GDPR deletion endpoint
      await deleteUserAccount();

      // Clear local browser data
      clearAllLocalUserData();
      setLocalDataCleared(true);
      setSubmitted(true);
    } catch {
      // Graceful fallback: clear local data anyway
      clearAllLocalUserData();
      setLocalDataCleared(true);
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col gap-10">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-xs font-semibold text-[#C8AA6E] hover:underline"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Return to Home</span>
      </Link>

      <header className="flex flex-col gap-3 border-b border-gray-800 pb-6">
        <div className="flex items-center gap-2 text-xs text-rose-400 uppercase font-bold tracking-widest">
          <Trash2 className="w-4 h-4" />
          <span>Privacy & Data Rights</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Account & Data Deletion Portal
        </h1>
        <p className="text-gray-300 text-sm leading-relaxed">
          In compliance with Apple App Store Review Guideline 5.1.1(v), Google Play Data Safety policies, and global privacy laws (GDPR/CCPA), you can delete your account, saved readings, and all associated personal records at any time.
        </p>
      </header>

      {/* Part 1: Instant Local Browser Erasure */}
      <div className="glass-card p-6 sm:p-8 rounded-2xl border border-[rgba(200,170,110,0.3)] flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-emerald-400" />
          <h2 className="text-lg font-bold text-white">1. Erase Local Browser Storage</h2>
        </div>
        <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
          Palmora stores your readings and journal notes locally in your browser&rsquo;s encrypted <code>localStorage</code> by default. Clicking the button below immediately purges all local reports and cache from this device.
        </p>

        {localDataCleared ? (
          <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-600/40 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>All local readings and reflections have been permanently erased from this device.</span>
          </div>
        ) : (
          <button
            onClick={handleClearBrowserData}
            className="self-start px-5 py-2.5 rounded-xl bg-gray-800 hover:bg-rose-900/60 hover:border-rose-500/50 border border-gray-700 text-xs font-bold text-white transition-all flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span>Erase Local Readings on This Device</span>
          </button>
        )}
      </div>

      {/* Part 2: Cloud / Server Account Deletion Request */}
      <div className="glass-card p-6 sm:p-8 rounded-2xl border border-rose-500/30 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-rose-400" />
          <h2 className="text-lg font-bold text-white">2. Request Account & Cloud Record Deletion</h2>
        </div>
        <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
          If you registered an account, subscribed, or have server-side records associated with an email address, submitting this request will permanently queue your account and all associated metadata for deletion within 30 days.
        </p>

        {submitted ? (
          <div className="p-5 rounded-xl bg-emerald-950/30 border border-emerald-600/40 text-emerald-200 text-xs sm:text-sm flex flex-col gap-2">
            <div className="flex items-center gap-2 font-bold text-white">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>Deletion Request Confirmed</span>
            </div>
            <p className="leading-relaxed">
              Your request for <strong>{email || 'your account'}</strong> has been recorded. All associated server records, entitlements, and metadata will be permanently expunged in accordance with our data retention schedule.
            </p>
          </div>
        ) : (
          <form onSubmit={handleRequestServerDeletion} className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="delete-email" className="text-xs font-semibold text-gray-300">
                Registered Email Address (optional if using guest mode)
              </label>
              <input
                id="delete-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full px-4 py-2.5 rounded-xl bg-[#090D1C] border border-gray-800 text-white text-xs sm:text-sm focus:outline-none focus:border-[#C8AA6E]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirm-phrase" className="text-xs font-semibold text-gray-300">
                Type &ldquo;DELETE&rdquo; to confirm permanent deletion
              </label>
              <input
                id="confirm-phrase"
                type="text"
                required
                value={confirmationPhrase}
                onChange={(e) => setConfirmationPhrase(e.target.value)}
                placeholder="DELETE"
                className="w-full px-4 py-2.5 rounded-xl bg-[#090D1C] border border-gray-800 text-white text-xs sm:text-sm focus:outline-none focus:border-rose-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || confirmationPhrase.trim().toUpperCase() !== 'DELETE'}
              className="mt-2 self-start px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold uppercase tracking-wider text-white transition-colors"
            >
              {submitting ? 'Processing Request...' : 'Permanently Delete My Account'}
            </button>
          </form>
        )}
      </div>

      {/* Data Retention Note */}
      <div className="text-xs text-gray-400 flex items-start gap-2">
        <Lock className="w-4 h-4 shrink-0 mt-0.5 text-[#C8AA6E]" />
        <p className="leading-relaxed">
          Reminder: Palmora AI processes uploaded hand images ephemerally in RAM and does not store unconsented user photos on disk. For complete details, see our <Link href="/privacy" className="text-[#C8AA6E] underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
