import React from 'react';
import Link from 'next/link';
import { AlertCircle, ScrollText, CheckCircle2 } from 'lucide-react';

export default function TermsOfServicePage() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col gap-10">
      <div>
        <span className="text-xs font-bold uppercase tracking-widest text-gold-gradient">
          Terms & Disclaimers
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white mt-1 tracking-tight">
          Terms of Service
        </h1>
        <p className="text-gray-400 text-sm mt-2">
          Effective Date: October 2026 • Version 1.0
        </p>
      </div>

      <div className="glass-card p-8 sm:p-10 rounded-3xl border border-gray-800 text-gray-300 text-sm leading-relaxed space-y-6">
        {/* Prominent Cultural / Entertainment Box */}
        <div className="p-5 rounded-2xl bg-[#070913] border border-[rgba(200,170,110,0.3)] text-amber-200 text-xs sm:text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#C8AA6E] shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-white">Entertainment & Cultural Folklore Notice</span>
            <p className="leading-relaxed text-gray-300">
              Palmora AI provides cultural interpretations and mindfulness reflections based on historical palmistry folklore. Palmistry is not a scientifically verified method for personality evaluation, relationship outcome prediction, financial guidance, or medical assessment.
            </p>
          </div>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-[#C8AA6E]" />
            1. Acceptance of Terms
          </h2>
          <p>
            By accessing or using the Palmora AI platform, you agree to these Terms of Service. If you disagree with any part of these terms, please do not use our application.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">2. Prohibited Relying Decisions</h2>
          <p>
            You expressly acknowledge and agree that:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-2 text-gray-400">
            <li>You will <strong>not</strong> make medical, diagnostic, pharmacological, or healthcare decisions based on interpretations provided by Palmora AI.</li>
            <li>You will <strong>not</strong> make investment, financial, legal, or commercial decisions based on reading results.</li>
            <li>You will <strong>not</strong> make irrevocable interpersonal or marital decisions based on palmistry symbolism.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">3. Integrity in Computer Vision</h2>
          <p>
            We strive to provide genuine computer vision analysis. If a crease cannot be detected with sufficient signal from your photograph, our system reports &ldquo;Unable to identify this feature reliably&rdquo; rather than fabricating measurements. We do not manufacture synthetic accuracy percentages.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">4. Subscription and Monetization Terms</h2>
          <p>
            Test prices displayed on our platform are experimental and clearly labeled. When payment processing is active, subscriptions will renew according to the chosen billing cycle unless canceled prior to the renewal date. Free introductory readings require no credit card.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">5. Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with applicable consumer protection and international arbitration principles.
          </p>
        </section>
      </div>

      <div className="text-center">
        <Link href="/" className="text-xs text-[#C8AA6E] hover:underline">
          ← Return to Palmora AI Homepage
        </Link>
      </div>
    </div>
  );
}
