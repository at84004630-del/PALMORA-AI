'use client';

import React from 'react';
import Link from 'next/link';
import { Hand, Shield, Sparkles, HeartHandshake, EyeOff } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-[rgba(200,170,110,0.15)] bg-[#05070E] py-14 px-4 sm:px-6 lg:px-8 text-gray-400 text-sm">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10">
        {/* Brand Lockup */}
        <div className="md:col-span-2 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1E243A] to-[#0D1122] border border-[rgba(200,170,110,0.3)] flex items-center justify-center">
              <Hand className="w-5 h-5 text-[#C8AA6E]" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">
              Palmora <span className="text-xs uppercase tracking-widest text-[#C8AA6E] font-semibold">AI</span>
            </span>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed max-w-md">
            Scan your palm. Explore your story. Uncover classical palmistry folklore and mindful self-reflection through modern computer vision.
          </p>
          <div className="flex items-center gap-2 text-xs text-emerald-400/90 pt-1">
            <EyeOff className="w-4 h-4" />
            <span>Zero biometric retention by default. Images processed ephemerally.</span>
          </div>
        </div>

        {/* Product Navigation */}
        <div className="flex flex-col gap-3">
          <h4 className="text-white text-xs font-semibold uppercase tracking-wider text-gold-gradient">
            Explore
          </h4>
          <Link href="/scan" className="hover:text-[#C8AA6E] transition-colors">
            Scan My Palm
          </Link>
          <Link href="/guides" className="hover:text-[#C8AA6E] transition-colors">
            Educational Guides
          </Link>
          <Link href="/dashboard" className="hover:text-[#C8AA6E] transition-colors">
            My Saved Readings
          </Link>
          <Link href="/pricing" className="hover:text-[#C8AA6E] transition-colors">
            Plans & Reports
          </Link>
          <Link href="/settings" className="hover:text-[#C8AA6E] transition-colors">
            Privacy Preferences
          </Link>
        </div>

        {/* Legal & Cultural Disclaimers */}
        <div className="flex flex-col gap-3">
          <h4 className="text-white text-xs font-semibold uppercase tracking-wider text-gold-gradient">
            Trust & Legal
          </h4>
          <Link href="/privacy" className="hover:text-[#C8AA6E] transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-[#C8AA6E] transition-colors">
            Terms of Service
          </Link>
          <Link href="/delete-account" className="hover:text-rose-400 transition-colors">
            Delete Account / Data
          </Link>
          <Link href="/#disclaimer" className="hover:text-[#C8AA6E] transition-colors">
            Cultural Folklore Notice
          </Link>
        </div>
      </div>

      {/* Mandatory Prominent Entertainment Disclaimer */}
      <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-gray-800/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400">
        <p className="leading-relaxed text-center sm:text-left max-w-3xl">
          <strong className="text-gray-300">Important Disclaimer:</strong> Palmora AI is built exclusively for cultural appreciation, contemplative self-discovery, and entertainment. Palmistry is an ancient folklore tradition, not an empirically verified science, psychological diagnosis, or predictive guarantee.
        </p>
        <span className="text-gray-400 shrink-0">
          © 2026 Palmora AI. All rights reserved.
        </span>
      </div>
    </footer>
  );
}
