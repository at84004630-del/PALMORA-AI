import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { BookOpen, Compass, Sparkles, ShieldCheck, Camera, HelpCircle, ArrowRight, Hand } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Palmistry & AI Vision Guides — Educational Hub',
  description:
    'Comprehensive, evidence-based guides on traditional palmistry folklore, anatomical crease development, computer vision technology, and privacy practices.',
};

const GUIDES = [
  {
    slug: 'heart-line-meaning',
    title: 'What the Heart Line Traditionally Represents in Classical Palmistry',
    description:
      'Explore the cultural symbolism of the distal transverse flexion crease across Western chiromancy and Samudrika Shastra, from curved emotional expression to straight analytical detachment.',
    category: 'Cultural Palmistry',
    readTime: '6 min read',
    icon: Sparkles,
  },
  {
    slug: 'major-palm-lines-difference',
    title: 'The Three Major Creases: Distinguishing Heart, Head, and Life Lines',
    description:
      'Understand how traditional palmistry categorizes the three primary palmar flexion creases, their anatomical origins in fetal development, and how symbolic roles differ.',
    category: 'Cultural Palmistry',
    readTime: '8 min read',
    icon: Compass,
  },
  {
    slug: 'how-ai-palm-scanning-works',
    title: 'How AI Palm Scanning Works: Computer Vision vs Generative Storytelling',
    description:
      'A transparent breakdown of Palmora’s 5-stage pipeline: edge detection, Euclidean distance palm localization, morphological filtering, and why visual extraction must be separated from LLMs.',
    category: 'Technology & AI',
    readTime: '7 min read',
    icon: Hand,
  },
  {
    slug: 'how-to-photograph-your-palm',
    title: 'How to Take a Usable Palm Photograph: Lighting, Contrast & Angles',
    description:
      'Avoid blurry captures and false rejections with our practical photography guide. Learn the optimal distance, flat palm positioning, and lighting contrast for crisp crease detection.',
    category: 'Practical Guide',
    readTime: '4 min read',
    icon: Camera,
  },
  {
    slug: 'what-ai-palm-reading-can-and-cannot-do',
    title: 'What AI Palm Reading Can and Cannot Establish: Ethical Boundaries',
    description:
      'Why palm lines cannot predict your future, health lifespan, or romantic destiny, and why Palmora treats chiromancy as reflective cultural contemplation rather than deterministic truth.',
    category: 'Ethics & Reality',
    readTime: '5 min read',
    icon: HelpCircle,
  },
  {
    slug: 'palm-photo-privacy-and-retention',
    title: 'How Palmora Handles Uploaded Photos: Ephemeral In-Memory Processing',
    description:
      'Our zero-retention privacy architecture explained: in-memory byte buffers, instant post-analysis garbage collection, no biometric facial or fingerprint matching, and no unconsented training.',
    category: 'Privacy & Safety',
    readTime: '5 min read',
    icon: ShieldCheck,
  },
];

export default function GuidesHubPage() {
  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col gap-12">
      {/* Header Banner */}
      <div className="glass-card p-8 sm:p-12 rounded-3xl border border-[rgba(200,170,110,0.3)] shadow-2xl flex flex-col gap-4 text-center sm:text-left">
        <div className="flex items-center justify-center sm:justify-start gap-2">
          <BookOpen className="w-5 h-5 text-[#C8AA6E]" />
          <span className="text-xs font-bold uppercase tracking-widest text-gold-gradient">
            Knowledge Base & Educational Archive
          </span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
          Demystifying Palmistry & AI Vision
        </h1>
        <p className="text-gray-300 text-sm sm:text-base max-w-2xl leading-relaxed">
          We believe in complete transparency. Explore authentic cultural traditions, the anatomical origin of flexion creases, how computer vision extracts palm metrics, and why we refuse to make predictive claims.
        </p>
      </div>

      {/* Guides Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {GUIDES.map((guide) => {
          const Icon = guide.icon;
          return (
            <Link
              key={guide.slug}
              href={`/guides/${guide.slug}`}
              className="glass-card glass-card-hover p-6 sm:p-8 rounded-2xl border border-[rgba(200,170,110,0.2)] flex flex-col justify-between gap-6 group transition-all"
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="px-2.5 py-1 rounded-md bg-[rgba(200,170,110,0.1)] border border-[rgba(200,170,110,0.25)] text-[#C8AA6E] font-medium">
                    {guide.category}
                  </span>
                  <span className="text-gray-400">{guide.readTime}</span>
                </div>
                <div className="flex items-start gap-3 mt-1">
                  <div className="w-9 h-9 rounded-xl bg-gray-900/80 border border-gray-800 flex items-center justify-center shrink-0 group-hover:border-[#C8AA6E]/60 transition-colors">
                    <Icon className="w-4 h-4 text-[#C8AA6E]" />
                  </div>
                  <h2 className="text-lg font-bold text-white group-hover:text-[#C8AA6E] transition-colors leading-snug">
                    {guide.title}
                  </h2>
                </div>
                <p className="text-xs sm:text-sm text-gray-300 leading-relaxed pl-12">
                  {guide.description}
                </p>
              </div>

              <div className="pt-4 border-t border-gray-800/80 flex items-center justify-between text-xs font-semibold text-[#C8AA6E] pl-12">
                <span>Read Full Guide</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* CTA Box */}
      <div className="glass-card p-8 rounded-3xl border border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
        <div>
          <h3 className="text-lg font-bold text-white">Ready to examine your own palm creases?</h3>
          <p className="text-xs text-gray-400 mt-1">
            Experience our in-browser computer vision detector with full ephemeral privacy.
          </p>
        </div>
        <Link
          href="/scan"
          className="btn-gold px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shrink-0 shadow-lg"
        >
          <Sparkles className="w-4 h-4" />
          <span>Start Free Scan</span>
        </Link>
      </div>
    </div>
  );
}
