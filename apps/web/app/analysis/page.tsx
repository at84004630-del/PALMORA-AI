'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Sparkles,
  ArrowRight,
  Hand,
  RefreshCw,
  Compass,
  Heart,
  Briefcase,
  AlertCircle,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import PalmOverlayCanvas from '../../components/PalmOverlayCanvas';
import {
  PalmAnalysisResult,
  generateReading,
  PalmReadingReport,
} from '../../lib/api';
import {
  getCurrentAnalysis,
  getCurrentImagePreview,
  saveCurrentAnalysis,
  saveLocalReading,
  revokeCurrentImagePreview,
} from '../../lib/storage';

const SAMPLE_ANALYSIS: PalmAnalysisResult = {
  analysis_id: 'sample-preview-scan',
  analysis_version: '1.3',
  detector_model: 'multiscale_crease_extractor_v1.3',
  detected_hand_side: 'right',
  palm_roi_box: [0.15, 0.20, 0.85, 0.80],
  image_quality: {
    is_usable: true,
    hand_detected: true,
    palm_visible: true,
    hand_orientation: 'upright',
    hand_facing: 'palm_facing',
    occlusion_detected: false,
    cropping_issues: [],
    blur_score: 85.4,
    brightness_score: 142.1,
    contrast_score: 48.7,
    width: 800,
    height: 800,
    issues: [],
    actionable_guidance: ['Lighting and framing optimal.'],
  },
  features: {
    heart_line: {
      name: 'Heart Line',
      status: 'detected',
      path: [
        { x: 0.72, y: 0.38 },
        { x: 0.60, y: 0.39 },
        { x: 0.48, y: 0.38 },
        { x: 0.38, y: 0.35 },
      ],
      measurements: {
        curvature: 0.18,
        length_ratio: 0.62,
        continuity_score: 0.94,
        start_zone: 'Percussion edge beneath pinky',
        termination_zone: 'Jupiter / Saturn mount interval',
      },
      confidence: 0.89,
      confidence_explanation: 'Strong, continuous, well-defined polyline across upper palm.',
    },
    head_line: {
      name: 'Head Line',
      status: 'detected',
      path: [
        { x: 0.32, y: 0.44 },
        { x: 0.42, y: 0.47 },
        { x: 0.55, y: 0.52 },
        { x: 0.68, y: 0.57 },
      ],
      measurements: {
        curvature: 0.12,
        length_ratio: 0.58,
        continuity_score: 0.91,
        start_zone: 'Radial edge near life line',
        termination_zone: 'Upper Luna mount',
      },
      confidence: 0.86,
      confidence_explanation: 'Clear diagonal ridge extending steadily across central palm.',
    },
    life_line: {
      name: 'Life Line',
      status: 'detected',
      path: [
        { x: 0.32, y: 0.43 },
        { x: 0.36, y: 0.54 },
        { x: 0.42, y: 0.68 },
        { x: 0.48, y: 0.80 },
      ],
      measurements: {
        curvature: 0.28,
        length_ratio: 0.71,
        continuity_score: 0.96,
        start_zone: 'Radial margin between index & thumb',
        termination_zone: 'Lower wrist base encircling Thenar mount',
      },
      confidence: 0.92,
      confidence_explanation: 'Deep arc encircling the Thenar eminence with high continuity.',
    },
    fate_line: {
      name: 'Fate Line',
      status: 'detected',
      path: [
        { x: 0.50, y: 0.78 },
        { x: 0.51, y: 0.62 },
        { x: 0.50, y: 0.46 },
      ],
      measurements: {
        curvature: 0.04,
        length_ratio: 0.45,
        continuity_score: 0.82,
        start_zone: 'Central palm base',
        termination_zone: 'Saturn mount',
      },
      confidence: 0.82,
      confidence_explanation: 'Vertical line ascending toward the base of the middle finger.',
    },
  },
  disclaimer: 'This computer vision analysis is provided for personal reflection and exploratory entertainment purposes only.',
};

export default function AnalysisPage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [analysis, setAnalysis] = useState<PalmAnalysisResult | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [userIntention, setUserIntention] = useState<string>('General Self-Reflection & Harmony');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
    const storedAnalysis = getCurrentAnalysis();
    const storedImage = getCurrentImagePreview();

    if (storedAnalysis) {
      setAnalysis(storedAnalysis);
      setImageUrl(storedImage || '');
    }
  }, []);

  const handleGenerateReport = async () => {
    if (!analysis) return;
    setIsGenerating(true);
    try {
      const isSample = analysis.analysis_id?.startsWith('sample');
      const report: PalmReadingReport = await generateReading({
        analysis_id: isSample ? undefined : analysis.analysis_id,
        features: analysis.features,
        user_notes: userIntention,
        tier: 'free',
      });

      // Save to local storage history with physical features preserved
      saveLocalReading({
        ...report,
        features: analysis.features || report.features,
        roi_box: analysis.palm_roi_box || report.roi_box,
      });

      // Transition to reading view
      router.push(`/reading?id=${report.id}`);
    } catch (err: any) {
      console.error('Reading generation failed:', err);
      setErrorMessage(err.message || 'Unable to generate reading. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const loadSampleScan = () => {
    saveCurrentAnalysis(SAMPLE_ANALYSIS);
    setAnalysis(SAMPLE_ANALYSIS);
  };

  if (!isMounted) {
    return (
      <div className="w-full min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
        <RefreshCw className="w-8 h-8 text-[#C8AA6E] animate-spin" />
        <span className="text-gray-400 text-sm font-medium">Loading palm analysis...</span>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="w-full min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
        <Hand className="w-12 h-12 text-[#C8AA6E]/60 animate-pulse" />
        <h2 className="text-xl font-bold text-white">No Active Palm Scan Detected</h2>
        <p className="text-gray-400 text-sm max-w-md">
          To inspect real computer vision crease overlays and curvature measurements, please capture or upload a palm photograph first.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-3">
          <Link
            href="/scan"
            className="btn-gold px-6 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider"
          >
            Scan My Palm
          </Link>
          <button
            onClick={loadSampleScan}
            className="px-5 py-2.5 rounded-full text-xs font-semibold text-gray-300 hover:text-white border border-gray-700 bg-gray-900/60 transition-colors flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#C8AA6E]" />
            <span>Load Sample Verification Scan</span>
          </button>
        </div>
      </div>
    );
  }

  const intentions = [
    { title: 'General Harmony', desc: 'Holistic balance across heart, mind, and vitality' },
    { title: 'Love & Empathy', desc: 'Deep dive into communication and relationship values' },
    { title: 'Career & Ambition', desc: 'Clarity around long-term goals and strategic focus' },
    { title: 'Vitality & Balance', desc: 'Mindfulness regarding personal rhythm and energy' },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col items-center">
      {/* Page Header */}
      <div className="text-center max-w-2xl mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-gold-gradient">
          Computer Vision Feature Verification
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white mt-2 tracking-tight">
          Observable Crease Overlay
        </h1>
        <p className="text-gray-300 text-sm mt-2 leading-relaxed">
          Review the detected physical features extracted from your image. You can toggle individual crease lines to inspect their measurements.
        </p>
      </div>

      {/* Error Notice */}
      {errorMessage && (
        <div className="w-full mb-6 p-4 rounded-2xl bg-amber-950/40 border border-amber-600/40 text-amber-200 text-xs sm:text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-white">Notice</span>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Main Interactive Canvas Section */}
      <div className="w-full flex flex-col lg:flex-row gap-8 items-start">
        {/* Left: Canvas Overlay */}
        <div className="w-full lg:w-7/12">
          <PalmOverlayCanvas
            imageUrl={imageUrl}
            features={analysis.features}
            roiBox={analysis.palm_roi_box}
            quality={analysis.image_quality}
          />
        </div>

        {/* Right: Synthesis & Intention Configuration */}
        <div className="w-full lg:w-5/12 flex flex-col gap-6">
          {/* Analysis Metadata Summary */}
          <div className="glass-card p-6 rounded-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2.5">
              <span className="text-xs uppercase font-bold text-gold-gradient">Vision Metadata</span>
              <span className="text-[11px] text-gray-400 font-mono">v{analysis.analysis_version}</span>
            </div>
            <div className="flex flex-col gap-2 text-xs text-gray-300">
              <div className="flex justify-between">
                <span className="text-gray-400">Hand Identified:</span>
                <span className="font-medium capitalize text-white">{analysis.detected_hand_side} Hand</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Detector Model:</span>
                <span className="font-mono text-[11px] text-gray-300">{analysis.detector_model}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Heart Line Status:</span>
                <span className="text-emerald-400 font-medium capitalize">{analysis.features.heart_line.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Head Line Status:</span>
                <span className="text-emerald-400 font-medium capitalize">{analysis.features.head_line.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Life Line Status:</span>
                <span className="text-emerald-400 font-medium capitalize">{analysis.features.life_line.status}</span>
              </div>
            </div>
          </div>

          {/* Intention / Focus Selector */}
          <div className="glass-card p-6 rounded-2xl flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Compass className="w-4 h-4 text-[#C8AA6E]" />
                Select Your Focus Intention
              </h3>
              <p className="text-[11px] text-gray-400 mt-1">
                Personalize which area of self-reflection to emphasize in your report narrative.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {intentions.map((item) => (
                <button
                  key={item.title}
                  onClick={() => setUserIntention(item.title)}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-0.5 ${
                    userIntention === item.title
                      ? 'border-[#C8AA6E] bg-[rgba(200,170,110,0.12)]'
                      : 'border-gray-800 bg-[#070913]/60 hover:border-gray-700'
                  }`}
                >
                  <span className="text-xs font-semibold text-white">{item.title}</span>
                  <span className="text-[11px] text-gray-400">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Primary CTA */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleGenerateReport}
              disabled={isGenerating}
              className="btn-gold w-full py-4 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-2xl disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Synthesizing Reading...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate My Reading Report</span>
                </>
              )}
            </button>

            <Link
              href="/scan"
              className="text-center text-xs text-gray-400 hover:text-white transition-colors"
            >
              ← Retake or Upload Another Photo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
