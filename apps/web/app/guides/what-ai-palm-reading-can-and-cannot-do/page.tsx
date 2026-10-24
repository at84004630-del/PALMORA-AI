import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { HelpCircle, ArrowLeft, ShieldAlert, CheckCircle2, XCircle, Sparkles } from 'lucide-react';

export const metadata: Metadata = {
  title: 'What AI Palm Reading Can and Cannot Establish: Ethical Boundaries',
  description:
    'An honest discussion of the capabilities and boundaries of AI palm analysis. Why palmistry cannot predict medical health, longevity, or destiny.',
  alternates: {
    canonical: '/guides/what-ai-palm-reading-can-and-cannot-do',
  },
};

export default function WhatAiCanAndCannotDoGuide() {
  return (
    <article className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col gap-10">
      <Link
        href="/guides"
        className="inline-flex items-center gap-2 text-xs font-semibold text-[#C8AA6E] hover:underline"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Knowledge Hub</span>
      </Link>

      <header className="flex flex-col gap-4 border-b border-gray-800 pb-8">
        <div className="flex items-center gap-2 text-xs text-[#C8AA6E] uppercase font-bold tracking-widest">
          <HelpCircle className="w-4 h-4 text-amber-400" />
          <span>Ethics & Product Integrity</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
          What AI Palm Reading Can and Cannot Establish
        </h1>
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
          <span>By Palmora Ethics & Safety Board</span>
          <span>•</span>
          <span>5 min read</span>
          <span>•</span>
          <span>Updated October 2026</span>
        </div>
      </header>

      {/* Direct Boundary Statement */}
      <div className="p-5 rounded-2xl bg-[#140D07] border border-amber-600/30 text-xs sm:text-sm text-amber-200 flex items-start gap-3">
        <ShieldAlert className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1">
          <strong className="text-white text-base">Our Uncompromising Commitment</strong>
          <p className="leading-relaxed">
            Palmora AI will never make deterministic claims about your lifespan, medical diagnoses, wealth accumulation, or romantic destiny. We believe that deceptive pseudoscience harms user well-being. Palmistry is an ancient cultural folklore tradition, best enjoyed as a creative and reflective lens for contemplative self-inquiry.
          </p>
        </div>
      </div>

      <div className="prose prose-invert prose-gold max-w-none flex flex-col gap-8 text-sm sm:text-base text-gray-300 leading-relaxed">
        <section className="flex flex-col gap-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white">What Palmora AI CAN Do</h2>
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-600/20 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block text-xs sm:text-sm mb-1">Accurately Detect Physical Palmar Creases</strong>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Using mathematical morphological filters, we extract real pixel coordinates, curvature metrics, and termination points from your hand photograph.
                </p>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-600/20 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block text-xs sm:text-sm mb-1">Connect Features to Documented Historical Traditions</strong>
                <p className="text-xs text-gray-300 leading-relaxed">
                  We link observed crease structures to attributed passages from classical Western chiromancy, Samudrika Shastra, and Chinese Shouxiang, citing the cultural origin of each interpretation.
                </p>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-600/20 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block text-xs sm:text-sm mb-1">Provide Mindful Reflection Prompts</strong>
                <p className="text-xs text-gray-300 leading-relaxed">
                  We translate ancient metaphors into constructive, open-ended questions about how you manage stress, express affection, and prioritize career goals.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white">What Palmora AI CANNOT Do (And Never Will)</h2>
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-600/20 flex items-start gap-3">
              <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block text-xs sm:text-sm mb-1">Predict Future Events or Longevity</strong>
                <p className="text-xs text-gray-300 leading-relaxed">
                  No line on your palm can reveal when you will marry, how long you will live, or whether you will experience financial windfalls. Your future is shaped by choices, actions, and circumstance.
                </p>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-600/20 flex items-start gap-3">
              <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block text-xs sm:text-sm mb-1">Perform Medical Diagnosis or Genetic Screening</strong>
                <p className="text-xs text-gray-300 leading-relaxed">
                  While certain chromosomal conditions (such as Trisomy 21) have known dermatoglyphic associations in clinical genetics, Palmora is purely an entertainment and cultural application and must never be used for medical assessment.
                </p>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-600/20 flex items-start gap-3">
              <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block text-xs sm:text-sm mb-1">Identify or Track Individual Biometrics</strong>
                <p className="text-xs text-gray-300 leading-relaxed">
                  We do not extract ridge minutiae (fingerprints) or perform person-identification. Your palm image is never compared against an identity database.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-8 pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-white font-bold block text-sm">Experience palmistry with honest framing</span>
          <span className="text-xs text-gray-400">Discover your lines without manipulation or fear tactics.</span>
        </div>
        <Link
          href="/scan"
          className="btn-gold px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          <span>Explore Your Story</span>
        </Link>
      </div>
    </article>
  );
}
