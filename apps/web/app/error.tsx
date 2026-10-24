'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { RefreshCw, AlertCircle, Home, Sparkles } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log exception safely without exposing biometric or private user data
    console.error('[Palmora Error Boundary Captured]:', error.message, error.digest);
  }, [error]);

  return (
    <div className="w-full min-h-[75vh] flex flex-col items-center justify-center text-center px-4 sm:px-6 lg:px-8 py-20 relative">
      {/* Background glow */}
      <div className="absolute w-72 h-72 rounded-full bg-gradient-to-tr from-rose-900/10 via-[#7C3AED]/10 to-[#C8AA6E]/10 blur-3xl -z-10 pointer-events-none" />

      {/* Icon */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-3xl bg-[#0D1122] border border-rose-500/30 shadow-[0_0_30px_rgba(244,63,94,0.15)] flex items-center justify-center">
          <AlertCircle className="w-10 h-10 text-rose-400" />
        </div>
        <div className="absolute -top-1 -right-1">
          <Sparkles className="w-5 h-5 text-[#C8AA6E]" />
        </div>
      </div>

      {/* Heading */}
      <span className="text-xs font-bold uppercase tracking-widest text-rose-400 mb-2">
        Unexpected Anomaly
      </span>
      <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight max-w-xl">
        A Temporary Pause in Reflection
      </h1>

      {/* Explanation */}
      <p className="mt-4 text-gray-300 text-sm sm:text-base max-w-md leading-relaxed">
        An unexpected application state occurred. Your personal photographs and private local data remain secure and uncompromised.
      </p>

      {/* Action buttons */}
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <button
          onClick={() => reset()}
          className="btn-gold px-7 py-3 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg"
        >
          <RefreshCw className="w-4 h-4 text-black" />
          <span>Try Again</span>
        </button>
        <Link
          href="/"
          className="px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider text-gray-300 hover:text-white border border-gray-700 bg-gray-900/60 hover:border-gray-500 transition-all flex items-center gap-2"
        >
          <Home className="w-4 h-4 text-[#C8AA6E]" />
          <span>Return to Home</span>
        </Link>
      </div>

      {error.digest && (
        <span className="mt-12 text-[11px] text-gray-600 font-mono">
          Ref: {error.digest}
        </span>
      )}
    </div>
  );
}
