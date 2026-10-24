import React from 'react';
import Link from 'next/link';
import { Compass, Sparkles, Home, Hand, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="w-full min-h-[75vh] flex flex-col items-center justify-center text-center px-4 sm:px-6 lg:px-8 py-20 relative">
      {/* Background celestial glow */}
      <div className="absolute w-72 h-72 sm:w-96 sm:h-96 rounded-full bg-gradient-to-tr from-[#C8AA6E]/10 via-[#7C3AED]/10 to-[#C8AA6E]/10 blur-3xl -z-10 pointer-events-none" />

      {/* Glowing icon */}
      <div className="relative mb-8">
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-[#0D1122] border border-[rgba(200,170,110,0.3)] shadow-[0_0_30px_rgba(200,170,110,0.2)] flex items-center justify-center">
          <Compass className="w-10 h-10 sm:w-12 sm:h-12 text-[#C8AA6E] animate-pulse" />
        </div>
        <div className="absolute -top-1 -right-1">
          <Sparkles className="w-6 h-6 text-[#E2C785]" />
        </div>
      </div>

      {/* Heading */}
      <span className="text-xs font-bold uppercase tracking-widest text-gold-gradient mb-2">
        Cosmic Coordinates Not Found
      </span>
      <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight max-w-xl">
        404 — Celestial Path Uncharted
      </h1>

      {/* Description */}
      <p className="mt-4 text-gray-300 text-sm sm:text-base max-w-md leading-relaxed">
        The page you are seeking has dissolved into the stars. Let us gently guide you back to familiar pathways.
      </p>

      {/* Navigation buttons */}
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/"
          className="px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider text-gray-300 hover:text-white border border-gray-700 bg-gray-900/60 hover:border-gray-500 transition-all flex items-center gap-2"
        >
          <Home className="w-4 h-4 text-[#C8AA6E]" />
          <span>Return Home</span>
        </Link>
        <Link
          href="/scan"
          className="btn-gold px-7 py-3 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg"
        >
          <Hand className="w-4 h-4 text-black" />
          <span>Scan Your Palm</span>
        </Link>
      </div>

      {/* Quick guide links */}
      <div className="mt-14 pt-8 border-t border-gray-800/80 flex flex-wrap items-center justify-center gap-6 text-xs text-gray-400">
        <Link href="/guides" className="hover:text-[#C8AA6E] transition-colors">
          Palmistry Guides
        </Link>
        <span>•</span>
        <Link href="/pricing" className="hover:text-[#C8AA6E] transition-colors">
          Transparent Pricing
        </Link>
        <span>•</span>
        <Link href="/privacy" className="hover:text-[#C8AA6E] transition-colors">
          Ephemeral Privacy
        </Link>
      </div>
    </div>
  );
}
