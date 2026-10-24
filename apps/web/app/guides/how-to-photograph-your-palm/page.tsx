import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Camera, ArrowLeft, Sun, CheckCircle2, XCircle, Sparkles, AlertCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'How to Take a Usable Palm Photograph: Lighting, Contrast & Angles',
  description:
    'A practical guide to capturing high-quality palm images for reliable computer vision analysis, avoiding blur, overexposure, and clipping.',
  alternates: {
    canonical: '/guides/how-to-photograph-your-palm',
  },
};

export default function HowToPhotographPalmGuide() {
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
          <Camera className="w-4 h-4 text-purple-400" />
          <span>Capture Guidance</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
          How to Photograph Your Palm for Reliable Analysis
        </h1>
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
          <span>By Palmora Support & Quality Team</span>
          <span>•</span>
          <span>4 min read</span>
          <span>•</span>
          <span>Updated October 2026</span>
        </div>
      </header>

      {/* Checklist Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-emerald-950/20 border border-emerald-600/30 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>Recommended Best Practices</span>
          </div>
          <ul className="text-xs text-gray-300 space-y-2 list-disc pl-4">
            <li>Even, diffuse lighting (natural daylight or soft lamp light).</li>
            <li>Hold your hand open and completely flat at a natural angle.</li>
            <li>Fill roughly 60% to 80% of the camera viewfinder with your palm.</li>
            <li>Keep the palm upright with fingers pointing toward the top.</li>
            <li>Ensure the camera lens is clean and focused on the center palm disc.</li>
          </ul>
        </div>

        <div className="p-5 rounded-2xl bg-rose-950/20 border border-rose-600/30 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
            <XCircle className="w-5 h-5 shrink-0" />
            <span>Common Capture Mistakes</span>
          </div>
          <ul className="text-xs text-gray-300 space-y-2 list-disc pl-4">
            <li>Direct camera flash (blows out skin creases and causes glare).</li>
            <li>Cupping the hand or bending fingers forward (casts shadows).</li>
            <li>Extreme low light or heavy dark shadows across the lower palm.</li>
            <li>Holding the hand sideways or upside down.</li>
            <li>Cropping out the wrist base or knuckles against the image edge.</li>
          </ul>
        </div>
      </div>

      <div className="prose prose-invert prose-gold max-w-none flex flex-col gap-8 text-sm sm:text-base text-gray-300 leading-relaxed">
        <section className="flex flex-col gap-3">
          <h2 className="text-xl sm:text-2xl font-bold text-white">1. Lighting: The Crucial Variable</h2>
          <p>
            Palmar flexion creases are shallow anatomical grooves on the skin surface. When light is completely flat and harsh (such as direct smartphone flash), the shadow inside the crease is obliterated, making lines invisible to computer vision filters.
          </p>
          <p>
            The ideal lighting is <strong>soft, angled ambient light</strong>. Standing near a window during daytime or holding your hand under an indirect room lamp provides enough subtle cross-illumination to reveal both primary and secondary creases without blowing out skin highlights.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl sm:text-2xl font-bold text-white">2. Palm Posture: Flat vs Cupped</h2>
          <p>
            Many people instinctively curl their fingers inward when holding their hand in front of a camera. Cupping the palm creates deep artificial shadows between the thenar and hypothenar mounds that our algorithms might mistake for an occluded or invalid capture.
          </p>
          <p>
            Spread your fingers comfortably and keep your palm relaxed but flat, as if resting gently on a flat tabletop.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl sm:text-2xl font-bold text-white">3. What Happens If the Photo Fails Quality Checks?</h2>
          <p>
            Unlike competitors who silently accept unusable photos and invent random fortunes, Palmora AI will immediately provide actionable feedback if your image fails our quality gate:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li><strong>Blur Warning:</strong> Prompts you to hold still or clean the lens.</li>
            <li><strong>Low Contrast Warning:</strong> Advises moving to a brighter area.</li>
            <li><strong>Clipping Warning:</strong> Reminds you to pull your hand back slightly so the full palm disc fits in frame.</li>
            <li><strong>Orientation Warning:</strong> Reminds you to position your fingers facing upward.</li>
          </ul>
        </section>
      </div>

      <div className="mt-8 pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-white font-bold block text-sm">Ready to take a scan?</span>
          <span className="text-xs text-gray-400">Position your hand and test with real-time feedback.</span>
        </div>
        <Link
          href="/scan"
          className="btn-gold px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2"
        >
          <Camera className="w-4 h-4" />
          <span>Launch Palm Scanner</span>
        </Link>
      </div>
    </article>
  );
}
