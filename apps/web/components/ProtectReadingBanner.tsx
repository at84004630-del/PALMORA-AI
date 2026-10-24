'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  Mail,
  Check,
  Copy,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { requestMagicLink } from '../lib/api';

interface ProtectReadingBannerProps {
  readingId: string;
}

export default function ProtectReadingBanner({ readingId }: ProtectReadingBannerProps) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [recoveryUrl, setRecoveryUrl] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setErrorMessage('Please provide a valid email address.');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await requestMagicLink(email.trim(), readingId);
      setSuccessMessage(res.message);
      if (typeof window !== 'undefined') {
        const fullUrl = `${window.location.origin}${res.recovery_url}`;
        setRecoveryUrl(fullUrl);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to generate protection link.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = () => {
    if (!recoveryUrl && typeof window !== 'undefined') {
      const fallbackUrl = window.location.href;
      navigator.clipboard.writeText(fallbackUrl);
    } else if (recoveryUrl) {
      navigator.clipboard.writeText(recoveryUrl);
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  return (
    <div className="w-full glass-card p-6 sm:p-7 rounded-3xl border border-[rgba(200,170,110,0.35)] bg-gradient-to-r from-[#0B0E1B] via-[#0D1224] to-[#070913] shadow-2xl flex flex-col gap-4 text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#C8AA6E]/15 border border-[#C8AA6E]/30 flex items-center justify-center text-[#C8AA6E] shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#C8AA6E]">
                Device Portability & Safety
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 font-medium">
                No Password Needed
              </span>
            </div>
            <h4 className="text-base font-bold text-white mt-0.5">
              Protect Your Reading Across Devices
            </h4>
          </div>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="text-gray-300 hover:text-white px-3 py-1.5 rounded-xl border border-gray-800 hover:border-gray-700 bg-gray-900/60 flex items-center gap-1.5 self-start sm:self-center font-medium transition-colors"
        >
          {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-[#C8AA6E]" />}
          <span>{copiedLink ? 'Copied Private Link' : 'Copy Direct Access URL'}</span>
        </button>
      </div>

      <p className="text-gray-300 leading-relaxed text-xs">
        Ensure you never lose access to your reading if you close this browser or switch from mobile to desktop. Enter your email to receive a private cryptographic recovery token.
      </p>

      {successMessage ? (
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 flex flex-col gap-2">
          <div className="flex items-center gap-2 font-semibold text-white">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>Reading Protection Link Dispatched</span>
          </div>
          <p className="text-[11px] text-gray-300">{successMessage}</p>
          {recoveryUrl && (
            <div className="mt-1 flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={recoveryUrl}
                className="flex-1 bg-[#070913] border border-gray-800 rounded-xl px-3 py-1.5 text-[10px] text-gray-300 font-mono select-all truncate"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="btn-gold px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1"
              >
                {copiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-2.5">
          <div className="relative flex-1 w-full">
            <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email to save access..."
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
                <span>Sending...</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>Email Recovery Link</span>
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
