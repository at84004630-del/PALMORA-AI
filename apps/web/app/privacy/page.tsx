import React from 'react';
import Link from 'next/link';
import { ShieldCheck, EyeOff, Lock, UserCheck } from 'lucide-react';

export default function PrivacyPolicyPage() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col gap-10">
      <div>
        <span className="text-xs font-bold uppercase tracking-widest text-gold-gradient">
          Legal & Privacy Commitment
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white mt-1 tracking-tight">
          Privacy Policy
        </h1>
        <p className="text-gray-400 text-sm mt-2">
          Effective Date: October 2026 • Version 1.0
        </p>
      </div>

      <div className="glass-card p-8 sm:p-10 rounded-3xl border border-gray-800 text-gray-300 text-sm leading-relaxed space-y-6">
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <EyeOff className="w-5 h-5 text-emerald-400" />
            1. Ephemeral Photograph Processing
          </h2>
          <p>
            At Palmora AI, we believe your personal photographs belong exclusively to you. When you upload or capture a photograph of your palm, our system processes the image <strong>in-memory</strong> to identify geometric landmarks and crease vectors.
          </p>
          <p>
            Once vector analysis is complete, the original photograph is immediately erased from server memory. We do not maintain persistent databases of raw user hand photographs unless you explicitly configure persistent encrypted storage.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-emerald-400" />
            2. Biometric and Identity Data Exclusions
          </h2>
          <p>
            Palmora AI does not perform biometric identification, individual authentication, or facial recognition matching. We do not use palm crease patterns to identify persons across databases. We categorically prohibit the sale, licensing, or commercial transfer of your visual data to data brokers, advertising networks, or law enforcement registries.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#C8AA6E]" />
            3. Data Minimization & Privacy-Preserving Telemetry
          </h2>
          <p>
            We collect minimal, privacy-conscious product usage milestones (such as whether a scan completed or which plan was visited) to monitor service reliability. <strong>We strictly prohibit sending palm photographs, landmark coordinates, or personalized report texts into analytics trackers.</strong>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-[#C8AA6E]" />
            4. User Rights (GDPR & CCPA Compliance)
          </h2>
          <p>
            Regardless of your geographic location, you enjoy the right to:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-2 text-gray-400">
            <li>Access and download your complete reading history in open JSON format.</li>
            <li>Permanently delete your profile and all associated data with one click.</li>
            <li>Opt out of any non-essential data processing.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">5. Contact Our Privacy Team</h2>
          <p>
            If you have questions regarding our data handling practices or wish to submit a formal data deletion inquiry, please reach out to our privacy officer at <span className="text-[#C8AA6E]">privacy@palmora.ai</span>.
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
