'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { trackAnalyticsEvent } from '../lib/api';
import {
  Sparkles,
  Hand,
  Heart,
  Briefcase,
  UserCheck,
  Camera,
  Cpu,
  ScrollText,
  ShieldCheck,
  Lock,
  EyeOff,
  ChevronRight,
  HelpCircle,
  Compass,
} from 'lucide-react';

export default function LandingPage() {
  useEffect(() => {
    trackAnalyticsEvent('landing_view');
  }, []);

  const faqs = [
    {
      q: 'How does Palmora AI read my palm photograph?',
      a: 'Palmora AI uses real computer vision to analyze observable creases on your open hand. It detects the major anatomical creases—traditionally known as the Heart Line, Head Line, and Life Line—and extracts measurable physical attributes like curvature, continuity, and relative length. These verified measurements are then mapped to classical cultural symbolism and reflective mindfulness prompts.',
    },
    {
      q: 'Is palmistry scientifically proven?',
      a: 'No. Palmora AI is designed strictly for contemplative self-reflection, mindfulness, and entertainment. Palmistry is an ancient cultural folklore tradition. We never claim palm creases determine your future, lifespan, relationship destiny, or financial success.',
    },
    {
      q: 'Do you store or sell my palm photographs?',
      a: 'No. We adhere to a privacy-first, ephemeral processing model. Your palm photo is analyzed in real-time in memory to extract visual line coordinates and is immediately discarded unless you specifically opt into saved history. We never use your palm photographs for biometric identification, surveillance, or AI training.',
    },
    {
      q: 'Can I try a free reading before subscribing?',
      a: 'Yes. Every new visitor can experience a complete complimentary reading with our full computer vision feature overlay and summary report with no credit card required.',
    },
    {
      q: 'What kind of lighting or camera do I need?',
      a: 'Any smartphone camera or desktop webcam works well! Simply place your open palm flat against a plain, neutral background under bright, indirect light, and keep the camera steady so your hand creases are in clear focus.',
    },
  ];

  return (
    <div className="w-full flex flex-col items-center">
      {/* 1. Hero Section */}
      <section className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-20 flex flex-col items-center text-center">
        {/* Subtle pill badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[rgba(200,170,110,0.25)] bg-[rgba(13,17,34,0.6)] backdrop-blur-md mb-8">
          <Sparkles className="w-3.5 h-3.5 text-[#C8AA6E]" />
          <span className="text-xs font-medium text-gray-200">
            Ancient Chiromancy Meets Modern Vision
          </span>
        </div>

        {/* Hero Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-4xl leading-[1.12]">
          Your palm. Your story.{' '}
          <span className="text-gold-gradient block sm:inline">
            A new perspective.
          </span>
        </h1>

        {/* Supporting Subtext */}
        <p className="mt-6 text-lg sm:text-xl text-gray-300 max-w-2xl leading-relaxed">
          Explore the timeless folklore of traditional palmistry through respectful computer vision. Uncover symbolic reflections on communication, career focus, and vitality.
        </p>

        {/* Primary & Secondary CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <Link
            href="/scan"
            className="btn-gold w-full sm:w-auto px-8 py-4 rounded-full text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-3 shadow-2xl"
          >
            <Sparkles className="w-4 h-4" />
            <span>Read My Palm</span>
          </Link>
          <a
            href="#how-it-works"
            className="w-full sm:w-auto px-7 py-4 rounded-full text-sm font-semibold text-gray-300 hover:text-white border border-[rgba(200,170,110,0.25)] bg-[#0D1122]/40 hover:bg-[#0D1122]/80 backdrop-blur-sm transition-all text-center"
          >
            Explore How It Works
          </a>
        </div>

        {/* Hero Interactive Palm Visual Card */}
        <div className="mt-16 w-full max-w-3xl relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-[#C8AA6E]/20 via-[#7C3AED]/20 to-[#C8AA6E]/20 rounded-3xl blur-xl opacity-70" />
          <div className="relative glass-card p-6 sm:p-10 rounded-3xl border border-[rgba(200,170,110,0.3)] shadow-2xl flex flex-col items-center">
            {/* Visual Scan Grid Illustration */}
            <div className="relative w-64 h-72 sm:w-80 sm:h-96 rounded-2xl border border-[rgba(200,170,110,0.2)] bg-[#070913] flex items-center justify-center overflow-hidden">
              {/* Radar pulse effect */}
              <div className="absolute w-48 h-48 rounded-full border border-[rgba(200,170,110,0.3)] animate-radar" />
              <div className="absolute w-64 h-64 rounded-full border border-[rgba(124,58,237,0.2)] animate-ping opacity-25" />

              {/* Hand Vector Silhouette */}
              <div className="relative z-10 flex flex-col items-center justify-center text-center">
                <Hand className="w-32 h-32 sm:w-40 sm:h-40 text-[#C8AA6E]/80 drop-shadow-[0_0_20px_rgba(200,170,110,0.3)]" />
                {/* Simulated anatomical overlays */}
                <span className="text-[11px] font-mono text-[#C8AA6E] mt-3 tracking-widest uppercase">
                  Anatomical Crease Extraction
                </span>
              </div>

              {/* Floating Feature Pins */}
              <div className="absolute top-16 right-4 sm:right-8 bg-[#0D1122]/90 border border-[#F43F5E]/40 px-2.5 py-1 rounded-full text-[10px] text-[#F43F5E] font-medium backdrop-blur-sm shadow-md">
                Heart Line (Emotional)
              </div>
              <div className="absolute top-36 left-3 sm:left-6 bg-[#0D1122]/90 border border-[#38BDF8]/40 px-2.5 py-1 rounded-full text-[10px] text-[#38BDF8] font-medium backdrop-blur-sm shadow-md">
                Head Line (Intellect)
              </div>
              <div className="absolute bottom-16 right-6 sm:right-10 bg-[#0D1122]/90 border border-[#34D399]/40 px-2.5 py-1 rounded-full text-[10px] text-[#34D399] font-medium backdrop-blur-sm shadow-md">
                Life Line (Vitality)
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-center items-center gap-6 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Real Computer Vision
              </span>
              <span className="flex items-center gap-1.5">
                <EyeOff className="w-4 h-4 text-emerald-400" />
                Zero Photo Storage
              </span>
              <span className="flex items-center gap-1.5">
                <ScrollText className="w-4 h-4 text-[#C8AA6E]" />
                Traditional Lore Grounded
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Three Feature Pillars (Love, Career, Personality) */}
      <section id="features" className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-gray-800/60">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-xs uppercase font-bold tracking-widest text-gold-gradient">
            Personalized Interpretation Pillars
          </h2>
          <h3 className="mt-3 text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Three dimensions of self-reflection
          </h3>
          <p className="mt-4 text-gray-400 text-sm sm:text-base leading-relaxed">
            Each section of your reading is grounded in tangible visual features rather than generic horoscopes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Pillar 1: Love Reading */}
          <div className="glass-card glass-card-hover p-8 rounded-3xl flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-[#F43F5E]/15 border border-[#F43F5E]/30 flex items-center justify-center text-[#F43F5E] mb-6">
                <Heart className="w-6 h-6" />
              </div>
              <h4 className="text-xl font-bold text-white">Love & Connections</h4>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#F43F5E] mt-1 mb-4">
                Heart Line (Distal Transverse Crease)
              </p>
              <p className="text-gray-300 text-sm leading-relaxed">
                Examines the upper transverse trajectory of your palm. Traditional chiromancy associates its curvature with interpersonal warmth, emotional expression, and communication preferences in partnership.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-800/80 text-xs text-gray-400 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F43F5E]" />
              <span>Grounded in observable curvature metrics</span>
            </div>
          </div>

          {/* Pillar 2: Career Reading */}
          <div className="glass-card glass-card-hover p-8 rounded-3xl flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-[#38BDF8]/15 border border-[#38BDF8]/30 flex items-center justify-center text-[#38BDF8] mb-6">
                <Briefcase className="w-6 h-6" />
              </div>
              <h4 className="text-xl font-bold text-white">Career & Purpose</h4>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#38BDF8] mt-1 mb-4">
                Head Line (Proximal Transverse Crease)
              </p>
              <p className="text-gray-300 text-sm leading-relaxed">
                Analyzes the mid-palm crease. Historical lore reflects on pragmatic focus versus imaginative problem-solving, encouraging mindfulness around your intellectual pacing and professional values.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-800/80 text-xs text-gray-400 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8]" />
              <span>Evaluated through slope and continuity</span>
            </div>
          </div>

          {/* Pillar 3: Personality Reading */}
          <div className="glass-card glass-card-hover p-8 rounded-3xl flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-[#34D399]/15 border border-[#34D399]/30 flex items-center justify-center text-[#34D399] mb-6">
                <Compass className="w-6 h-6" />
              </div>
              <h4 className="text-xl font-bold text-white">Vitality & Temperament</h4>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#34D399] mt-1 mb-4">
                Life Line (Thenar Radial Crease)
              </p>
              <p className="text-gray-300 text-sm leading-relaxed">
                Traces the radial arch embracing the base of your thumb. Historically viewed as a symbol of personal rhythm, resilience, and sensory vitality—never physical lifespan or medical health.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-800/80 text-xs text-gray-400 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34D399]" />
              <span>Interprets radius and contour depth</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Three-Step Process */}
      <section id="how-it-works" className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-gray-800/60">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-xs uppercase font-bold tracking-widest text-gold-gradient">
            Simple, Transparent Workflow
          </h2>
          <h3 className="mt-3 text-3xl sm:text-4xl font-bold text-white tracking-tight">
            How Palmora AI Works in 3 Steps
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="glass-card p-8 rounded-3xl flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-[rgba(200,170,110,0.1)] border border-[rgba(200,170,110,0.3)] flex items-center justify-center text-[#C8AA6E] font-bold text-lg mb-6">
              1
            </div>
            <h4 className="text-lg font-bold text-white mb-2">Capture or Upload</h4>
            <p className="text-gray-400 text-sm leading-relaxed">
              Use your phone or webcam to snap a clear photo of your open palm. Our client validates lighting, focus, and hand presence instantly.
            </p>
          </div>

          <div className="glass-card p-8 rounded-3xl flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-[rgba(200,170,110,0.1)] border border-[rgba(200,170,110,0.3)] flex items-center justify-center text-[#C8AA6E] font-bold text-lg mb-6">
              2
            </div>
            <h4 className="text-lg font-bold text-white mb-2">Computer Vision Analysis</h4>
            <p className="text-gray-400 text-sm leading-relaxed">
              Our algorithms segment the palm and apply directional ridge filtering to locate major creases. You receive an interactive visual overlay.
            </p>
          </div>

          <div className="glass-card p-8 rounded-3xl flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-[rgba(200,170,110,0.1)] border border-[rgba(200,170,110,0.3)] flex items-center justify-center text-[#C8AA6E] font-bold text-lg mb-6">
              3
            </div>
            <h4 className="text-lg font-bold text-white mb-2">Reflective Cultural Report</h4>
            <p className="text-gray-400 text-sm leading-relaxed">
              Receive your grounded Love, Career, and Personality reports accompanied by thoughtful mindfulness questions you can save or share.
            </p>
          </div>
        </div>

        <div className="mt-14 text-center">
          <Link
            href="/scan"
            className="btn-gold px-8 py-3.5 rounded-full text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-2 shadow-xl"
          >
            <Sparkles className="w-4 h-4" />
            <span>Try It Now (No Sign-Up Required)</span>
          </Link>
        </div>
      </section>

      {/* 4. Privacy & Data Handling Guarantee */}
      <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="glass-card p-8 sm:p-12 rounded-3xl border border-[rgba(200,170,110,0.25)] flex flex-col sm:flex-row items-center gap-8">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div className="flex flex-col gap-2 text-center sm:text-left">
            <h3 className="text-xl font-bold text-white">
              Privacy by Design & Ephemeral Processing
            </h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              We treat palm photographs with the utmost respect. Photos are processed purely in-memory to extract crease vectors and are discarded immediately. We do not use palm photos for biometric profiling, identity verification, or public model training.
            </p>
            <div className="pt-2">
              <Link href="/settings" className="text-xs font-semibold text-[#C8AA6E] hover:underline">
                View our complete data retention options →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 5. FAQ Section */}
      <section className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-gray-800/60">
        <div className="text-center mb-14">
          <h2 className="text-xs uppercase font-bold tracking-widest text-gold-gradient">
            Frequently Asked Questions
          </h2>
          <h3 className="mt-3 text-3xl font-bold text-white tracking-tight">
            Everything you need to know
          </h3>
        </div>

        <div className="flex flex-col gap-4">
          {faqs.map((faq, idx) => (
            <div key={idx} className="glass-card p-6 rounded-2xl border border-gray-800">
              <h4 className="text-base font-semibold text-white mb-2 flex items-start gap-2.5">
                <HelpCircle className="w-5 h-5 text-[#C8AA6E] shrink-0 mt-0.5" />
                <span>{faq.q}</span>
              </h4>
              <p className="text-gray-300 text-sm leading-relaxed pl-7.5">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Bottom Final CTA */}
      <section className="w-full bg-gradient-to-b from-transparent to-[#0B0E1B] py-20 px-4 sm:px-6 lg:px-8 border-t border-[rgba(200,170,110,0.15)] flex flex-col items-center text-center">
        <div className="max-w-3xl flex flex-col items-center">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Ready to explore what your palm reveals?
          </h2>
          <p className="mt-4 text-gray-300 text-base max-w-xl">
            Experience traditional palmistry through a thoughtful, modern lens. Fast, private, and grounded in verified visual features.
          </p>
          <div className="mt-8">
            <Link
              href="/scan"
              className="btn-gold px-9 py-4 rounded-full text-sm font-bold uppercase tracking-wider inline-flex items-center gap-3 shadow-2xl"
            >
              <Sparkles className="w-4 h-4" />
              <span>Read My Palm</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
