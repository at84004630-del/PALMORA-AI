import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ShieldCheck, ArrowLeft, Lock, Trash2, EyeOff, Server, Sparkles } from 'lucide-react';

export const metadata: Metadata = {
  title: 'How Palmora Handles Uploaded Photos: Ephemeral In-Memory Processing',
  description:
    'Our privacy-by-design architecture: in-memory byte decodes, instant RAM garbage collection, zero biometric tracking, and no unconsented model training.',
  alternates: {
    canonical: '/guides/palm-photo-privacy-and-retention',
  },
};

export default function PhotoPrivacyGuide() {
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
          <Lock className="w-4 h-4 text-emerald-400" />
          <span>Privacy & Data Safety</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
          How Palmora Handles Uploaded Photographs
        </h1>
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
          <span>By Palmora Privacy & Security Office</span>
          <span>•</span>
          <span>5 min read</span>
          <span>•</span>
          <span>Updated October 2026</span>
        </div>
      </header>

      {/* 3 Pillars Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-[#081020] border border-gray-800 flex flex-col gap-2">
          <EyeOff className="w-5 h-5 text-emerald-400" />
          <strong className="text-white text-sm">Ephemeral In-Memory</strong>
          <p className="text-xs text-gray-300 leading-relaxed">
            Raw photograph bytes reside only in volatile RAM during analysis and are immediately purged.
          </p>
        </div>
        <div className="p-5 rounded-2xl bg-[#081020] border border-gray-800 flex flex-col gap-2">
          <Trash2 className="w-5 h-5 text-emerald-400" />
          <strong className="text-white text-sm">Zero Disk Storage</strong>
          <p className="text-xs text-gray-300 leading-relaxed">
            By default, user hand images are never written to server hard drives or cloud object buckets.
          </p>
        </div>
        <div className="p-5 rounded-2xl bg-[#081020] border border-gray-800 flex flex-col gap-2">
          <Server className="w-5 h-5 text-emerald-400" />
          <strong className="text-white text-sm">Zero Model Training</strong>
          <p className="text-xs text-gray-300 leading-relaxed">
            We never use user photos to train AI models without explicit, affirmative opt-in consent.
          </p>
        </div>
      </div>

      <div className="prose prose-invert prose-gold max-w-none flex flex-col gap-8 text-sm sm:text-base text-gray-300 leading-relaxed">
        <section className="flex flex-col gap-3">
          <h2 className="text-xl sm:text-2xl font-bold text-white">1. The Life of an Uploaded Palm Image</h2>
          <p>
            When you select or capture a palm photo on Palmora:
          </p>
          <ol className="list-decimal pl-6 space-y-2 text-gray-300">
            <li>Your browser encrypts the image payload and transfers it over TLS 1.3 to our API endpoint.</li>
            <li>The API receives the payload directly into an in-memory byte buffer (Python <code>bytes</code> via FastAPI).</li>
            <li>OpenCV decodes the raw buffer into a NumPy matrix in volatile memory.</li>
            <li>The computer vision pipeline extracts pixel coordinates, curvature indices, and quality scores.</li>
            <li>Once feature coordinates are structured into JSON, the raw image buffer is explicitly dereferenced and garbage collected by the runtime.</li>
            <li>Only the resulting non-biometric geometric coordinates and reading text are returned to your browser.</li>
          </ol>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl sm:text-2xl font-bold text-white">2. Where Are Saved Readings Stored?</h2>
          <p>
            When you choose to save a reading to your archive, the report is saved directly in your browser&rsquo;s <code>localStorage</code> by default. We do not require you to create an account or link your identity to read your palm.
          </p>
          <p>
            If you ever wish to erase your archive, you can click &ldquo;Delete Reading&rdquo; on any individual report or use our one-click &ldquo;Clear All Local Data&rdquo; button in <Link href="/settings" className="text-[#C8AA6E] underline">Privacy Preferences</Link>.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl sm:text-2xl font-bold text-white">3. Non-Biometric Classification</h2>
          <p>
            Palmora is engineered to extract macro palmar flexion creases (the gross folds across the hand), not friction ridge minutiae (fingerprints). We do not record or compare biometric vectors against law enforcement, immigration, or identity registries.
          </p>
        </section>
      </div>

      <div className="mt-8 pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-white font-bold block text-sm">Experience private, ephemeral palmistry</span>
          <span className="text-xs text-gray-400">Zero data retention by default. Complete control in your hands.</span>
        </div>
        <Link
          href="/scan"
          className="btn-gold px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          <span>Scan Privately</span>
        </Link>
      </div>
    </article>
  );
}
