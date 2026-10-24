import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Hand, ArrowLeft, Cpu, Sparkles, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'How AI Palm Scanning Works: Computer Vision vs Generative Storytelling',
  description:
    'A deep dive into Palmora’s computer vision architecture: morphological crease extraction, Euclidean distance palm discs, and the strict separation between CV and LLMs.',
  alternates: {
    canonical: '/guides/how-ai-palm-scanning-works',
  },
};

export default function HowAiScanningWorksGuide() {
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
          <Cpu className="w-4 h-4 text-emerald-400" />
          <span>Architecture & Computer Vision</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
          How AI Palm Scanning Works: Computer Vision vs Generative Storytelling
        </h1>
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
          <span>By Palmora Engineering</span>
          <span>•</span>
          <span>7 min read</span>
          <span>•</span>
          <span>Updated October 2026</span>
        </div>
      </header>

      {/* Architecture Alert */}
      <div className="p-4 rounded-2xl bg-[#091122] border border-emerald-500/30 text-xs text-emerald-200 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1">
          <strong className="text-white">Core Architectural Rule</strong>
          <p className="leading-relaxed text-emerald-300">
            Palmora AI never sends raw hand photographs directly to large language models (LLMs). LLMs are prone to hallucinating non-existent features when presented with images. All visual feature extraction is executed by deterministic, local computer vision algorithms before any textual interpretation occurs.
          </p>
        </div>
      </div>

      <div className="prose prose-invert prose-gold max-w-none flex flex-col gap-8 text-sm sm:text-base text-gray-300 leading-relaxed">
        <section className="flex flex-col gap-3">
          <h2 className="text-xl sm:text-2xl font-bold text-white">1. The 5-Stage Analysis Pipeline</h2>
          <p>
            When an image is submitted to Palmora, it passes through five strictly segregated stages:
          </p>
          <ol className="list-decimal pl-6 space-y-3 text-gray-300">
            <li>
              <strong>Stage 1 — Image Pre-Flight Validation:</strong> The server checks MIME type, byte integrity, and decode stability without writing the image to disk.
            </li>
            <li>
              <strong>Stage 2 — Hand Localization & Palm Disc Calculation:</strong> Using Otsu skin thresholding and the Euclidean Distance Transform (EDT), the algorithm calculates the largest inscribed circle inside the palm. This defines the palm disc center (Cx, Cy) and radius R_disc, making analysis invariant to finger length or posture.
            </li>
            <li>
              <strong>Stage 3 — Crease Morphological Enhancement:</strong> Applying directional Black-Hat morphological filtering and Gabor-like filters isolates narrow dark valley structures (creases) from uniform skin tone.
            </li>
            <li>
              <strong>Stage 4 — Coordinate-Relative Feature Extraction:</strong> Creases are grouped into anatomical vertical bands relative to $C_y$. Polynomial spline regression fits continuous coordinate paths to the heart, head, and life lines.
            </li>
            <li>
              <strong>Stage 5 — Evidence-Linked Synthesis:</strong> Only verified, observed metrics (length, curvature index, starting point) are matched to documented historical interpretation records. If a line cannot be detected with high confidence, the system explicitly marks it as <em>uncertain/not detected</em> and offers a retake rather than hallucinating.
            </li>
          </ol>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl sm:text-2xl font-bold text-white">2. Why Competitors Hallucinate (The Black-Box Flaw)</h2>
          <p>
            Many consumer astrology and palmistry apps simply pass user photos to generalized multimodal AI APIs with a prompt like <em>&ldquo;Read this user&rsquo;s palm and predict their career.&rdquo;</em>
          </p>
          <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-600/30 text-rose-200 text-xs sm:text-sm flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <strong className="text-white">Why This Fails Users</strong>
              <p className="leading-relaxed">
                Multimodal LLMs cannot reliably trace subtle skin ridges. When faced with poor lighting or occlusion, they invent lines that do not exist, producing generic, flattery-filled horoscopes that have zero relationship to the user&rsquo;s actual hand.
              </p>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl sm:text-2xl font-bold text-white">3. Inspectable Coordinate Metadata</h2>
          <p>
            Every reading in Palmora includes full interactive visual overlays. Users can toggle the detected crease paths directly on their screen to verify that the extracted lines correspond precisely to their actual physical palm. Transparency builds genuine trust.
          </p>
        </section>
      </div>

      <div className="mt-8 pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-white font-bold block text-sm">Experience the CV pipeline firsthand</span>
          <span className="text-xs text-gray-400">Deterministic crease detection with real-time feedback.</span>
        </div>
        <Link
          href="/scan"
          className="btn-gold px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          <span>Test The Detector</span>
        </Link>
      </div>
    </article>
  );
}
