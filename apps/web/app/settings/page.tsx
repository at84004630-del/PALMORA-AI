'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Trash2,
  Lock,
  EyeOff,
  User,
  HardDrive,
  AlertTriangle,
  CheckCircle2,
  Download,
  Info,
} from 'lucide-react';
import { clearAllLocalUserData, getLocalReadings, getLocalDualReadings } from '../../lib/storage';
import { updateUserAccount } from '../../lib/api';

export default function SettingsPage() {
  const [retentionPolicy, setRetentionPolicy] = useState<'ephemeral' | 'save_readings_anonymized'>('ephemeral');
  const [profileName, setProfileName] = useState('Seeker');
  const [readingsCount, setReadingsCount] = useState(0);

  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    const singleCount = getLocalReadings().length;
    const dualCount = getLocalDualReadings().length;
    setReadingsCount(singleCount + dualCount);

    if (typeof window !== 'undefined') {
      const savedRetention = localStorage.getItem('palmora_retention_policy');
      if (savedRetention === 'ephemeral' || savedRetention === 'save_readings_anonymized') {
        setRetentionPolicy(savedRetention);
      }
      const savedName = localStorage.getItem('palmora_profile_name');
      if (savedName) setProfileName(savedName);
    }
  }, []);

  const handleSavePreferences = async () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('palmora_retention_policy', retentionPolicy);
    }
    try {
      await updateUserAccount({ retention_policy: retentionPolicy });
    } catch {
      // Local persistence is primary for guests
    }
    setFeedbackMessage('Privacy preferences successfully updated and saved.');
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  const handleClearHistory = () => {
    clearAllLocalUserData();
    setReadingsCount(0);
    setFeedbackMessage('All local readings and cached images have been purged.');
    setShowDeleteModal(false);
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  const handleExportData = () => {
    const singleReadings = getLocalReadings();
    const dualReadings = getLocalDualReadings();
    const exportBundle = {
      export_version: '1.0',
      exported_at: new Date().toISOString(),
      single_readings: singleReadings,
      dual_hand_readings: dualReadings,
      total_count: singleReadings.length + dualReadings.length,
    };
    const blob = new Blob([JSON.stringify(exportBundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `palmora_readings_export_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col gap-10">
      {/* Page Header */}
      <div>
        <span className="text-xs font-bold uppercase tracking-widest text-gold-gradient">
          Control & Transparency
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white mt-1 tracking-tight">
          Privacy & Account Settings
        </h1>
        <p className="text-gray-300 text-sm mt-2">
          Manage how your readings are preserved and review our zero-biometric-retention guarantees.
        </p>
      </div>

      {/* Success alert */}
      {feedbackMessage && (
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs sm:text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* 1. Image Retention Preferences */}
      <div className="glass-card p-6 sm:p-8 rounded-3xl flex flex-col gap-5 border border-gray-800">
        <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <EyeOff className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Photograph Retention Policy</h3>
            <span className="text-xs text-gray-400">
              Control whether palm images are retained after feature extraction
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <label className="p-4 rounded-2xl border border-[rgba(200,170,110,0.25)] bg-[#070913]/60 flex items-start gap-3 cursor-pointer hover:border-[#C8AA6E] transition-colors">
            <input
              type="radio"
              name="retention"
              checked={retentionPolicy === 'ephemeral'}
              onChange={() => setRetentionPolicy('ephemeral')}
              className="mt-1 text-[#C8AA6E] focus:ring-[#C8AA6E]"
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-white flex items-center gap-2">
                Ephemeral Processing (Recommended)
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono">
                  Default
                </span>
              </span>
              <p className="text-xs text-gray-400 leading-relaxed">
                Your uploaded palm photographs are processed purely in memory to compute crease coordinates and discarded immediately. No permanent image file is ever saved on disk or servers.
              </p>
            </div>
          </label>

          <label className="p-4 rounded-2xl border border-gray-800 bg-[#070913]/60 flex items-start gap-3 cursor-pointer hover:border-gray-700 transition-colors">
            <input
              type="radio"
              name="retention"
              checked={retentionPolicy === 'save_readings_anonymized'}
              onChange={() => setRetentionPolicy('save_readings_anonymized')}
              className="mt-1 text-[#C8AA6E] focus:ring-[#C8AA6E]"
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-white">
                Save Reading Text Only (Anonymized)
              </span>
              <p className="text-xs text-gray-400 leading-relaxed">
                Preserves only the written interpretive report and vector coordinates in your browser history. The original photograph is discarded immediately after scan.
              </p>
            </div>
          </label>
        </div>

        <div className="pt-2">
          <button
            onClick={handleSavePreferences}
            className="btn-gold px-6 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider"
          >
            Save Retention Preference
          </button>
        </div>
      </div>

      {/* 2. Biometric and Privacy Explanations */}
      <div className="glass-card p-6 sm:p-8 rounded-3xl flex flex-col gap-4 border border-gray-800">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-emerald-400" />
          <h3 className="text-lg font-bold text-white">Biometric Safety Guarantee</h3>
        </div>
        <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
          In strict compliance with GDPR, California Consumer Privacy Act (CCPA), and global data protection standards:
        </p>
        <ul className="list-disc list-inside text-xs sm:text-sm text-gray-400 space-y-2">
          <li>We <strong>never</strong> use palm images for biometric identification, surveillance, or facial recognition matching.</li>
          <li>We <strong>never</strong> sell or license user hand photographs to third parties or advertising brokers.</li>
          <li>We <strong>never</strong> infer health conditions, genetics, medical prognosis, or protected legal characteristics from hand appearance.</li>
          <li>All readings are strictly framed as traditional cultural folklore and mindfulness contemplation.</li>
        </ul>
      </div>

      {/* 3. Data Export & Deletion Controls */}
      <div className="glass-card p-6 sm:p-8 rounded-3xl flex flex-col gap-5 border border-rose-900/30">
        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white">Data Management & Purge</h3>
            <span className="text-xs text-gray-400">
              Download your data or wipe all local readings
            </span>
          </div>
          <span className="text-xs text-gray-400">
            {readingsCount} reading{readingsCount === 1 ? '' : 's'} on record
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={handleExportData}
            disabled={readingsCount === 0}
            className="px-5 py-2.5 rounded-xl text-xs font-medium border border-gray-700 bg-gray-900/60 text-gray-200 hover:text-white flex items-center gap-2 disabled:opacity-40"
          >
            <Download className="w-4 h-4 text-[#C8AA6E]" />
            <span>Export All Readings (JSON)</span>
          </button>

          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-rose-600/20 hover:bg-rose-600 border border-rose-500/40 text-rose-300 hover:text-white flex items-center gap-2 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            <span>Permanently Delete All Data</span>
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card p-6 sm:p-8 rounded-2xl max-w-sm w-full border border-rose-500/40 flex flex-col gap-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h4 className="text-lg font-bold text-white">Purge All Data?</h4>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              This will permanently delete all {readingsCount} saved readings, cached overlays, and account history from your browser. This action cannot be reversed.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-gray-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleClearHistory}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors"
              >
                Confirm Purge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
