import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Compass, ArrowLeft, BookOpen, Sparkles, Layers } from 'lucide-react';

export const metadata: Metadata = {
  title: 'The Three Major Creases: Distinguishing Heart, Head, and Life Lines',
  description:
    'A clear comparison between the three primary palmar flexion creases—their anatomical development, geometric paths, and historical palmistry roles.',
  alternates: {
    canonical: '/guides/major-palm-lines-difference',
  },
};

export default function MajorPalmLinesGuide() {
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
          <Layers className="w-4 h-4 text-cyan-400" />
          <span>Comparative Palmistry</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
          The Three Major Creases: Heart, Head, and Life Lines
        </h1>
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
          <span>By Palmora Research Editorial</span>
          <span>•</span>
          <span>8 min read</span>
          <span>•</span>
          <span>Updated October 2026</span>
        </div>
      </header>

      {/* Overview Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-800 bg-[#0A0D18]">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead className="bg-[#121626] text-white border-b border-gray-800">
            <tr>
              <th className="p-4 font-bold text-[#C8AA6E]">Traditional Line</th>
              <th className="p-4 font-bold">Anatomical Name</th>
              <th className="p-4 font-bold">Origin & Path</th>
              <th className="p-4 font-bold">Traditional Domain</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/80 text-gray-300">
            <tr>
              <td className="p-4 font-semibold text-rose-300">Heart Line</td>
              <td className="p-4">Distal Transverse Crease</td>
              <td className="p-4">Runs under base of fingers toward pinky</td>
              <td className="p-4">Emotional temperament, empathy, relational style</td>
            </tr>
            <tr>
              <td className="p-4 font-semibold text-amber-300">Head Line</td>
              <td className="p-4">Proximal Transverse Crease</td>
              <td className="p-4">Starts between thumb & index, cuts across center</td>
              <td className="p-4">Cognitive approach, reasoning, creative vs analytical focus</td>
            </tr>
            <tr>
              <td className="p-4 font-semibold text-emerald-300">Life Line</td>
              <td className="p-4">Radial Longitudinal Crease</td>
              <td className="p-4">Arcs tightly around the base of the thumb (Thenar)</td>
              <td className="p-4">Physical vitality, grounded resilience, routine preferences</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="prose prose-invert prose-gold max-w-none flex flex-col gap-8 text-sm sm:text-base text-gray-300 leading-relaxed">
        <section className="flex flex-col gap-3">
          <h2 className="text-xl sm:text-2xl font-bold text-white">1. Anatomical Genesis of the Three Creases</h2>
          <p>
            Long before an infant grasps their first object, the palmar creases appear during embryological development around week 11 of gestation. The three major lines are not produced by folding or repetitive work after birth; rather, they are genetically and structurally programmed skin hinge joints that facilitate hand articulation.
          </p>
          <p>
            Because these creases correspond to metacarpal bone mechanics, almost every human hand exhibits variations of these three primary tracks. In approximately 1 in 30 individuals, the distal and proximal transverse creases merge into a single continuous crease known medically as the <em>simian crease</em> or <em>single transverse palmar crease</em>.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl sm:text-2xl font-bold text-white">2. The Head Line (Cognitive Focus & Problem Solving)</h2>
          <p>
            The head line (proximal transverse crease) traditionally symbolizes how a person processes information and approaches obstacles:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>
              <strong>Straight and Linear:</strong> In classical European chiromancy, associated with practical logic, deductive reasoning, and structured, method-driven work habits.
            </li>
            <li>
              <strong>Curving downward toward the Luna mount (wrist base):</strong> Associated with imaginative synthesis, artistic intuition, and lateral problem-solving.
            </li>
            <li>
              <strong>Joined with the Life Line at origin:</strong> Historically interpreted as a cautious, deliberate start to projects, emphasizing careful planning before commitment.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl sm:text-2xl font-bold text-white">3. The Life Line (Debunking the Lifespan Myth)</h2>
          <p>
            One of the most persistent and harmful misconceptions in popular culture is that the length of the life line indicates chronological lifespan or age of death. <strong>This is completely false and medically baseless.</strong>
          </p>
          <p>
            In authentic historical traditions, such as classical Vedic palmistry, the radial longitudinal crease was read as an indicator of <em>vital energy (Ojas)</em>, environmental adaptability, and relationship with one&rsquo;s physical surroundings:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>
              <strong>Wide, sweeping arc into the palm:</strong> Associated with high physical stamina, enthusiasm for travel, and an expansive lifestyle.
            </li>
            <li>
              <strong>Narrow, tight arc hugging the thumb:</strong> Associated with a preference for quiet routines, domestic stability, and conservation of personal energy.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl sm:text-2xl font-bold text-white">4. Synthesis: How the Three Lines Interact</h2>
          <p>
            Authentic palmistry never examines a single line in isolation. The synergy between the heart (emotion), head (reason), and life (vitality) lines represents the dynamic equilibrium of the individual. When your lines are analyzed in Palmora, our computer vision detector measures the distance and angular relationships between all three detected creases simultaneously, providing a coherent synthesis rather than disconnected snippets.
          </p>
        </section>
      </div>

      <div className="mt-8 pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-white font-bold block text-sm">Curious where your three creases lie?</span>
          <span className="text-xs text-gray-400">Discover precise line contours in seconds.</span>
        </div>
        <Link
          href="/scan"
          className="btn-gold px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          <span>Scan All 3 Creases</span>
        </Link>
      </div>
    </article>
  );
}
