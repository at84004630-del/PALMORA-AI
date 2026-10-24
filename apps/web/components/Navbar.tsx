'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, Menu, X, Hand, Compass, ShieldCheck, History, CreditCard } from 'lucide-react';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile drawer on route navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Handle escape key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navLinks = [
    { label: 'How It Works', href: '/#how-it-works' },
    { label: 'Readings', href: '/#features' },
    { label: 'Guides', href: '/guides' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Dashboard', href: '/dashboard' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[rgba(200,170,110,0.15)] bg-[#070913]/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1E243A] to-[#0D1122] border border-[rgba(200,170,110,0.3)] flex items-center justify-center group-hover:border-[#C8AA6E] transition-all shadow-[0_0_15px_rgba(200,170,110,0.15)]">
            <Hand className="w-5 h-5 text-[#C8AA6E] group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
              Palmora <span className="text-xs uppercase tracking-widest text-[#C8AA6E] font-semibold px-1.5 py-0.5 rounded bg-[rgba(200,170,110,0.1)] border border-[rgba(200,170,110,0.2)]">AI</span>
            </span>
            <span className="text-[10px] text-gray-400 font-medium tracking-wide">
              Scan your palm. Explore your story.
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8" aria-label="Main Navigation">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className={`text-sm font-medium transition-colors hover:text-[#C8AA6E] ${
                pathname === link.href ? 'text-[#C8AA6E]' : 'text-gray-300'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop Action CTAs */}
        <div className="hidden md:flex items-center gap-4">
          <Link
            href="/settings"
            className="text-xs text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-1.5"
            title="Privacy and Settings"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400/80" />
            <span>Privacy</span>
          </Link>
          <Link
            href="/scan"
            className="btn-gold px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-2 shadow-lg"
          >
            <Sparkles className="w-4 h-4" />
            <span>Read My Palm</span>
          </Link>
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex md:hidden items-center gap-3">
          <Link
            href="/scan"
            className="btn-gold px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Scan</span>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-gray-300 hover:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8AA6E]"
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-18 z-40 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#0B0E1B] border-b border-[rgba(200,170,110,0.2)] px-6 py-8 flex flex-col gap-6 shadow-2xl">
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-base font-medium text-gray-200 hover:text-[#C8AA6E] py-2 border-b border-gray-800 flex items-center justify-between"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span>{link.label}</span>
                  <span className="text-gray-500">→</span>
                </Link>
              ))}
              <Link
                href="/settings"
                className="text-base font-medium text-gray-200 hover:text-[#C8AA6E] py-2 border-b border-gray-800 flex items-center justify-between"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Privacy & Data Retention
                </span>
                <span className="text-gray-500">→</span>
              </Link>
            </div>

            <div className="pt-4 flex flex-col gap-3">
              <Link
                href="/scan"
                className="btn-gold w-full py-3 rounded-xl text-center text-sm font-semibold flex items-center justify-center gap-2 shadow-lg"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Sparkles className="w-4 h-4" />
                <span>Start Palm Reading</span>
              </Link>
              <p className="text-[11px] text-gray-400 text-center">
                Strictly cultural symbolism & reflection. Ephemeral data processing.
              </p>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
