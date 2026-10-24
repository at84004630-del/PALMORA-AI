import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Sparkles, ArrowLeft, Heart, Shield, BookOpen } from 'lucide-react';

export const metadata: Metadata = {
  title: 'What the Heart Line Traditionally Represents in Classical Palmistry',
  description:
    'A cultural and anatomical exploration of the heart line (distal transverse crease), contrasting emotional expression traditions with biological facts.',
  alternates: {
    canonical: '/guides/heart-line-meaning',
  },
};

export default function HeartLineGuide() {
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
          <Heart className="w-4 h-4 text-rose-400" />
          <span>Cultural Palmistry & Anatomy</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
          What the Heart Line Traditionally Represents
        </h1>
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
          <span>By Palmora Research Editorial</span>
          <span>•</span>
          <span>6 min read</span>
          <span>•</span>
          <span>Updated October 2026</span>
        </div>
      </header>

      {/* Transparency Callout */}
      <div className="p-4 rounded-2xl bg-[#0E1326] border border-[rgba(200,170,110,0.3)] text-xs text-gray-300 flex items-start gap-3">
        <BookOpen className="w-5 h-5 text-[#C8AA6E] shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1">
          <strong className="text-white">Cultural Perspective & Scope</strong>
          <p className="leading-relaxed">
            In human anatomy, the heart line is the <em>distal transverse palmar flexion crease</em>, which forms in utero between weeks 7 and 14 to allow the fingers to fold over the palm. Traditional palmistry uses this crease as a symbolic metaphor for emotional temperament. It does not reflect cardiovascular health, medical conditions, or romantic destinies.
          </p>
        </div>
      </div>

      <div className="prose prose-invert prose-gold max-w-none flex flex-col gap-8 text-sm sm:text-base text-gray-300 leading-relaxed">
        <section className="flex flex-col gap-3">
          <h2 className="text-xl sm:text-2xl font-bold text-white">1. Anatomical Identity vs Traditional Symbolism</h2>
          <p>
            Anatomically, the palm has three primary flexion creases formed by deep fascial attachments to underlying metacarpal bones. The highest horizontal crease—running from the ulnar border (under the pinky finger) toward the radial border (under the index and middle fingers)—is clinically termed the <strong>distal transverse crease</strong>.
          </p>
          <p>
            Across historical traditions dating back over 2,500 years—including Hellenistic chiromancy recorded in Aristotle’s pseudo-epigraphs and Indian <em>Samudrika Shastra</em>—this crease was poetically dubbed the <strong>Mensalis</strong> (table line) or the <strong>Heart Line (Hridaya Rekha)</strong>. It was regarded as the seat of affection, empathy, relationship orientation, and emotional communication.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl sm:text-2xl font-bold text-white">2. Major Curvature Variations in Traditional Folklore</h2>
          <p>
            In traditional chiromancy, practitioners primarily categorize the heart line by its curvature, termination point, and depth:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>
              <strong>Upwardly Curved Line Ending under the Jupiter Mount (Index Finger):</strong> Traditionally associated with high relational idealism, open emotional warmth, and demonstrative affection. Individuals with this pattern are culturally said to invest deeply in shared emotional harmony.
            </li>
            <li>
              <strong>Straight, Horizontal Line Ending under Saturn (Middle Finger):</strong> Traditionally interpreted as reflecting emotional restraint, pragmatic decision-making in relationships, and a preference for personal autonomy. Feelings are internalized rather than publicly broadcasted.
            </li>
            <li>
              <strong>Long Line Crossing the Full Palm:</strong> In Western folklore, often linked with deep, lifelong loyalty, but with a tendency toward vulnerability if relational boundaries are not maintained.
            </li>
            <li>
              <strong>Branched or Forked Termination (The &ldquo;Writer&rsquo;s Fork&rdquo;):</strong> When the line splits into two or three delicate branches toward the index and middle fingers, classical sources interpreted this as an ability to balance head and heart—empathy paired with practical discernment.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl sm:text-2xl font-bold text-white">3. How Modern Computer Vision Measures the Line</h2>
          <p>
            Rather than relying on vague human impression, Palmora AI calculates explicit geometric metrics from your palm image:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-2">
            <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800">
              <span className="text-xs text-[#C8AA6E] font-bold block mb-1">Normalized Length</span>
              <span className="text-xs text-gray-400">Ratio of crease arc length relative to maximum palmar disc diameter.</span>
            </div>
            <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800">
              <span className="text-xs text-[#C8AA6E] font-bold block mb-1">Curvature Index</span>
              <span className="text-xs text-gray-400">Calculated as arc length divided by chord distance between endpoints.</span>
            </div>
            <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800">
              <span className="text-xs text-[#C8AA6E] font-bold block mb-1">Termination Angle</span>
              <span className="text-xs text-gray-400">Vector direction toward the index or middle metacarpal base.</span>
            </div>
          </div>
          <p>
            These measured metrics are then linked directly to established historical interpretation records without making ungrounded leaps or extrapolating personal biometric secrets.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl sm:text-2xl font-bold text-white">4. Reflective Contemplation: Using Folklore for Self-Discovery</h2>
          <p>
            At Palmora, we encourage using these traditional associations as mirrors for mindfulness. Regardless of what your crease geometry reveals:
          </p>
          <blockquote className="border-l-2 border-[#C8AA6E] pl-4 italic text-gray-300 my-2">
            &ldquo;Are you currently communicating your emotional needs clearly with the people who matter most? Where could you benefit from greater vulnerability or stronger boundaries?&rdquo;
          </blockquote>
          <p>
            The value of palmistry lies not in fatalism, but in prompting genuine, contemplative inquiry into how you love, express, and connect with others.
          </p>
        </section>
      </div>

      <div className="mt-8 pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-white font-bold block text-sm">Want to see your heart line analyzed?</span>
          <span className="text-xs text-gray-400">Free, private, and instant scan using your device camera.</span>
        </div>
        <Link
          href="/scan"
          className="btn-gold px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          <span>Analyze My Palm</span>
        </Link>
      </div>
    </article>
  );
}
