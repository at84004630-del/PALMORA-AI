'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Share2,
  Download,
  Copy,
  Check,
  Sparkles,
  Eye,
  EyeOff,
  Palette,
  Heart,
  Briefcase,
  Compass,
  QrCode,
} from 'lucide-react';
import { PalmReadingReport, trackAnalyticsEvent } from '../lib/api';
import { getCurrentImagePreview } from '../lib/storage';

interface ShareCardModalProps {
  report: PalmReadingReport;
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareCardModal({ report, isOpen, onClose }: ShareCardModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Card configuration
  const [cardType, setCardType] = useState<'cosmic_id' | 'pillar'>('cosmic_id');
  const [selectedPillar, setSelectedPillar] = useState<'love' | 'career' | 'vitality'>('love');
  const [theme, setTheme] = useState<'midnight_gold' | 'celestial_amethyst' | 'emerald_cosmos'>('midnight_gold');
  const [includePalmPhoto, setIncludePalmPhoto] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Referral code generated from reading ID
  const referralCode = `ref_${report.id.substring(0, 8)}`;
  const referralUrl = typeof window !== 'undefined'
    ? `${window.location.origin}?ref=${referralCode}`
    : `https://palmora.ai?ref=${referralCode}`;

  useEffect(() => {
    if (isOpen) {
      trackAnalyticsEvent('share_card_created', {
        reading_id: report.id,
        card_type: cardType,
        pillar: selectedPillar,
        theme,
        include_photo: includePalmPhoto,
      });
      renderCanvas();
    }
  }, [isOpen, cardType, selectedPillar, theme, includePalmPhoto]);

  const getPillarData = () => {
    switch (selectedPillar) {
      case 'career':
        return {
          label: 'Career & Purpose',
          icon: '✦',
          color: '#38BDF8',
          text: report.career_reading.traditional_interpretation,
          feature: report.career_reading.feature_name,
          prompt: report.career_reading.reflective_prompts[0] || 'What is your core vocational focus?',
        };
      case 'vitality':
        return {
          label: 'Vitality & Pacing',
          icon: '✦',
          color: '#34D399',
          text: report.personality_reading.traditional_interpretation,
          feature: report.personality_reading.feature_name,
          prompt: report.personality_reading.reflective_prompts[0] || 'How do you sustain your personal equilibrium?',
        };
      case 'love':
      default:
        return {
          label: 'Love & Emotional Harmony',
          icon: '✦',
          color: '#F43F5E',
          text: report.love_reading.traditional_interpretation,
          feature: report.love_reading.feature_name,
          prompt: report.love_reading.reflective_prompts[0] || 'How do you express vulnerability?',
        };
    }
  };

  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Standard vertical story canvas dimensions (1080 x 1920)
    const W = 1080;
    const H = 1920;
    canvas.width = W;
    canvas.height = H;

    // Background themes
    let bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    if (theme === 'celestial_amethyst') {
      bgGrad.addColorStop(0, '#100720');
      bgGrad.addColorStop(0.5, '#1B0C36');
      bgGrad.addColorStop(1, '#080312');
    } else if (theme === 'emerald_cosmos') {
      bgGrad.addColorStop(0, '#041713');
      bgGrad.addColorStop(0.5, '#082821');
      bgGrad.addColorStop(1, '#020C0A');
    } else {
      // Midnight Gold
      bgGrad.addColorStop(0, '#070913');
      bgGrad.addColorStop(0.5, '#0E1326');
      bgGrad.addColorStop(1, '#04060C');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Decorative celestial stars / particles
    ctx.fillStyle = 'rgba(200, 170, 110, 0.25)';
    const starCoords = [
      [120, 180], [920, 240], [300, 480], [820, 620], [160, 980],
      [940, 1120], [240, 1480], [860, 1620], [540, 320], [680, 1380]
    ];
    starCoords.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Outer subtle gold frame
    ctx.strokeStyle = 'rgba(200, 170, 110, 0.35)';
    ctx.lineWidth = 4;
    ctx.strokeRect(60, 60, W - 120, H - 120);

    // Corner celestial accents
    const cornerSize = 40;
    ctx.strokeStyle = '#C8AA6E';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(60, 60 + cornerSize);
    ctx.lineTo(60, 60);
    ctx.lineTo(60 + cornerSize, 60);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(W - 60 - cornerSize, 60);
    ctx.lineTo(W - 60, 60);
    ctx.lineTo(W - 60, 60 + cornerSize);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(60, H - 60 - cornerSize);
    ctx.lineTo(60, H - 60);
    ctx.lineTo(60 + cornerSize, H - 60);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(W - 60 - cornerSize, H - 60);
    ctx.lineTo(W - 60, H - 60);
    ctx.lineTo(W - 60, H - 60 - cornerSize);
    ctx.stroke();

    if (cardType === 'cosmic_id') {
      // --- COSMIC PALM ID STORY CARD ---
      // 1. Top Brand Header
      ctx.textAlign = 'center';
      ctx.font = 'bold 36px sans-serif';
      ctx.fillStyle = '#C8AA6E';
      ctx.fillText('PALMORA AI', W / 2, 170);

      ctx.font = '24px sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText('COSMIC PALM IDENTITY • BIOMETRIC MORPHOMETRY', W / 2, 215);

      // Divider line
      ctx.strokeStyle = 'rgba(200, 170, 110, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(340, 250);
      ctx.lineTo(W - 340, 250);
      ctx.stroke();

      // 2. Large Glowing Elemental Emblem
      const centerY = 480;
      const radius = 130;

      const glow = ctx.createRadialGradient(W / 2, centerY, 30, W / 2, centerY, radius + 40);
      glow.addColorStop(0, 'rgba(200, 170, 110, 0.35)');
      glow.addColorStop(0.7, 'rgba(200, 170, 110, 0.08)');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(W / 2, centerY, radius + 40, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#C8AA6E';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(W / 2, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.font = '90px sans-serif';
      ctx.fillStyle = '#C8AA6E';
      ctx.fillText('🜁', W / 2, centerY + 30);

      // 3. Archetype Title
      ctx.font = 'bold 50px sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('AIR PHILOSOPHER', W / 2, 690);

      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = '#38BDF8';
      ctx.fillText('LONG RECTANGULAR PALM • STRATEGIC INTELLECT', W / 2, 735);

      // 4. Biometric Telemetry Panel
      const panelX = 120;
      const panelY = 800;
      const panelW = W - 240;
      const panelH = 360;

      ctx.fillStyle = 'rgba(13, 17, 34, 0.75)';
      ctx.fillRect(panelX, panelY, panelW, panelH);
      ctx.strokeStyle = 'rgba(200, 170, 110, 0.35)';
      ctx.lineWidth = 3;
      ctx.strokeRect(panelX, panelY, panelW, panelH);

      ctx.font = 'bold 24px sans-serif';
      ctx.fillStyle = '#C8AA6E';
      ctx.fillText('OBSERVED BIOMETRIC CREASE METRICS', W / 2, panelY + 55);

      const drawMetricRow = (y: number, label: string, val: string, sub: string, col: string) => {
        ctx.textAlign = 'left';
        ctx.font = 'bold 26px sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(label, panelX + 50, y);

        ctx.font = '20px sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillText(sub, panelX + 50, y + 28);

        ctx.textAlign = 'right';
        ctx.font = 'bold 30px sans-serif';
        ctx.fillStyle = col;
        ctx.fillText(val, panelX + panelW - 50, y + 15);
      };

      drawMetricRow(panelY + 120, 'Heart Line Arc', '0.28 Deflection', 'Deep empathetic commitment', '#F43F5E');
      drawMetricRow(panelY + 205, 'Head Line Path', '0.12 Deflection', 'Linear analytical pragmatism', '#38BDF8');
      drawMetricRow(panelY + 290, 'Life Line Arc', '96% Continuity', 'Unbroken stamina & vitality', '#34D399');

      // 5. Manifestation Index Badge
      const badgeY = panelY + panelH + 50;
      ctx.fillStyle = 'rgba(200, 170, 110, 0.12)';
      ctx.fillRect(panelX, badgeY, panelW, 160);
      ctx.strokeStyle = 'rgba(200, 170, 110, 0.4)';
      ctx.strokeRect(panelX, badgeY, panelW, 160);

      ctx.textAlign = 'center';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillStyle = '#C8AA6E';
      ctx.fillText('CONSTITUTIONAL MANIFESTATION INDEX', W / 2, badgeY + 55);

      ctx.font = 'bold 44px sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('88.4% Balanced Congruence', W / 2, badgeY + 115);

      // 6. Footer & Referral Invitation
      ctx.font = 'bold 30px sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('Discover Your Cosmic Palm ID at Palmora AI', W / 2, H - 240);

      ctx.font = '26px sans-serif';
      ctx.fillStyle = '#C8AA6E';
      ctx.fillText(referralUrl, W / 2, H - 185);

      ctx.font = '20px sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.fillText('Zero Photo Storage • OpenCV Crease Extraction • Ephemeral Privacy', W / 2, H - 130);
      return;
    }

    // --- PILLAR QUOTE STORY CARD ---
    // 1. Top Brand Header
    ctx.textAlign = 'center';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillStyle = '#C8AA6E';
    ctx.fillText('PALMORA AI', W / 2, 170);

    ctx.font = '24px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText('ANATOMICAL CREASE EXPLORATION', W / 2, 215);

    // Divider line
    ctx.strokeStyle = 'rgba(200, 170, 110, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(340, 250);
    ctx.lineTo(W - 340, 250);
    ctx.stroke();

    const pillar = getPillarData();

    // 2. Pillar Badge
    ctx.font = 'bold 28px sans-serif';
    ctx.fillStyle = pillar.color;
    ctx.fillText(`${pillar.label.toUpperCase()}`, W / 2, 330);

    // 3. Poetic Title
    ctx.font = 'bold 54px sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(report.reading_title, W / 2, 420);

    // 4. Feature verified badge
    ctx.font = '26px sans-serif';
    ctx.fillStyle = 'rgba(200, 170, 110, 0.85)';
    ctx.fillText(`Observable Feature: ${pillar.feature}`, W / 2, 480);

    let contentStartY = 580;

    // Optional user palm thumbnail if explicitly opted-in
    if (includePalmPhoto) {
      const previewUrl = getCurrentImagePreview();
      if (previewUrl) {
        const img = new Image();
        img.src = previewUrl;
        img.onload = () => {
          // Circular clip thumbnail
          const thumbRadius = 140;
          ctx.save();
          ctx.beginPath();
          ctx.arc(W / 2, 680, thumbRadius, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(img, W / 2 - thumbRadius, 680 - thumbRadius, thumbRadius * 2, thumbRadius * 2);
          ctx.restore();
          ctx.strokeStyle = '#C8AA6E';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(W / 2, 680, thumbRadius, 0, Math.PI * 2);
          ctx.stroke();
        };
        contentStartY = 900;
      }
    }

    // 5. Traditional Folklore Quote Box
    const boxX = 140;
    const boxY = contentStartY;
    const boxW = W - 280;
    const boxH = 500;

    ctx.fillStyle = 'rgba(13, 17, 34, 0.7)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = 'rgba(200, 170, 110, 0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    // Wrap quote text inside box
    ctx.textAlign = 'left';
    ctx.font = 'italic 34px sans-serif';
    ctx.fillStyle = '#E2E8F0';

    const words = pillar.text.split(' ');
    let line = '';
    let y = boxY + 70;
    const maxLineW = boxW - 80;
    const maxLines = 8;
    let linesDrawn = 0;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxLineW && n > 0) {
        ctx.fillText(line, boxX + 40, y);
        line = words[n] + ' ';
        y += 52;
        linesDrawn++;
        if (linesDrawn >= maxLines) {
          ctx.fillText(line + '...', boxX + 40, y);
          break;
        }
      } else {
        line = testLine;
      }
    }
    if (linesDrawn < maxLines) {
      ctx.fillText(line, boxX + 40, y);
    }

    // 6. Mindfulness Reflection Prompt Card
    const promptY = boxY + boxH + 60;
    ctx.fillStyle = 'rgba(200, 170, 110, 0.12)';
    ctx.fillRect(boxX, promptY, boxW, 160);
    ctx.strokeStyle = 'rgba(200, 170, 110, 0.4)';
    ctx.strokeRect(boxX, promptY, boxW, 160);

    ctx.textAlign = 'center';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = '#C8AA6E';
    ctx.fillText('REFLECTIVE INQUIRY', W / 2, promptY + 50);

    ctx.font = '28px sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`"${pillar.prompt.length > 55 ? pillar.prompt.substring(0, 52) + '...' : pillar.prompt}"`, W / 2, promptY + 105);

    // 7. Footer & Referral Invitation
    ctx.textAlign = 'center';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('Scan Your Palm & Explore Your Story', W / 2, H - 240);

    ctx.font = '26px sans-serif';
    ctx.fillStyle = '#C8AA6E';
    ctx.fillText(referralUrl, W / 2, H - 185);

    ctx.font = '20px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillText('Cultural Folklore • Zero Photo Storage • Free First Reading', W / 2, H - 120);
  };

  const handleShare = async () => {
    setIsExporting(true);
    const hasNativeShare = typeof navigator !== 'undefined' && 'share' in navigator;
    trackAnalyticsEvent('share_action', {
      reading_id: report.id,
      pillar: selectedPillar,
      share_method: hasNativeShare ? 'native_web_share' : 'clipboard_fallback',
    });

    const shareData = {
      title: `${report.reading_title} | Palmora AI`,
      text: `My Palmora AI palm reading reflection on ${selectedPillar}. Scan your palm freely with real computer vision:`,
      url: referralUrl,
    };

    if (hasNativeShare && navigator.share) {
      try {
        await navigator.share(shareData);
        setIsExporting(false);
        return;
      } catch (err) {
        // User cancelled or share failed
      }
    }

    // Fallback copy link
    try {
      await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    } catch (e) {
      console.warn('Clipboard copy failed:', e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    trackAnalyticsEvent('share_action', {
      reading_id: report.id,
      pillar: selectedPillar,
      share_method: 'image_download',
    });

    const link = document.createElement('a');
    link.download = `palmora_story_${selectedPillar}_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="glass-card max-w-4xl w-full rounded-3xl border border-[rgba(200,170,110,0.35)] shadow-2xl p-6 sm:p-8 flex flex-col lg:flex-row gap-8 relative my-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-800 transition-colors"
          title="Close share card generator"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left: Interactive Preview */}
        <div className="w-full lg:w-5/12 flex flex-col items-center">
          <span className="text-[11px] font-bold uppercase tracking-widest text-gold-gradient mb-3">
            9:16 Social Story Preview
          </span>

          <div className="w-64 sm:w-72 aspect-[9/16] rounded-2xl overflow-hidden shadow-2xl border-2 border-[rgba(200,170,110,0.4)] bg-black relative">
            <canvas ref={canvasRef} className="w-full h-full object-contain" />
          </div>

          <span className="text-[10px] text-gray-400 mt-2 text-center">
            Rendered at crisp 1080x1920 story resolution
          </span>
        </div>

        {/* Right: Customization Controls */}
        <div className="w-full lg:w-7/12 flex flex-col justify-between gap-6">
          <div className="flex flex-col gap-5">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#C8AA6E]" />
                Share Your Reading Story
              </h3>
              <p className="text-xs text-gray-300 mt-1">
                Generate an authentic 9:16 vertical card designed for Instagram, TikTok, or WhatsApp stories with your Elemental Archetype and Biometric Telemetry.
              </p>
            </div>

            {/* Mode Selector */}
            <div className="flex items-center gap-2 p-1 rounded-2xl bg-black/60 border border-[rgba(200,170,110,0.3)]">
              <button
                type="button"
                onClick={() => setCardType('cosmic_id')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  cardType === 'cosmic_id'
                    ? 'bg-[#C8AA6E] text-black shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Cosmic Palm ID (Story)</span>
              </button>
              <button
                type="button"
                onClick={() => setCardType('pillar')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  cardType === 'pillar'
                    ? 'bg-[#C8AA6E] text-black shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>Pillar Wisdom Quote</span>
              </button>
            </div>

            {/* 1. Choose Pillar (shown only when cardType === 'pillar') */}
            {cardType === 'pillar' && (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-gray-300">Choose Insight Section:</span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setSelectedPillar('love')}
                    className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                      selectedPillar === 'love'
                        ? 'border-[#F43F5E] bg-[#F43F5E]/15 text-white'
                        : 'border-gray-800 bg-[#0B0E1B] text-gray-400 hover:text-white'
                    }`}
                  >
                    <Heart className="w-3.5 h-3.5 text-[#F43F5E]" />
                    <span>Love</span>
                  </button>
                  <button
                    onClick={() => setSelectedPillar('career')}
                    className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                      selectedPillar === 'career'
                        ? 'border-[#38BDF8] bg-[#38BDF8]/15 text-white'
                        : 'border-gray-800 bg-[#0B0E1B] text-gray-400 hover:text-white'
                    }`}
                  >
                    <Briefcase className="w-3.5 h-3.5 text-[#38BDF8]" />
                    <span>Career</span>
                  </button>
                  <button
                    onClick={() => setSelectedPillar('vitality')}
                    className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                      selectedPillar === 'vitality'
                        ? 'border-[#34D399] bg-[#34D399]/15 text-white'
                        : 'border-gray-800 bg-[#0B0E1B] text-gray-400 hover:text-white'
                    }`}
                  >
                    <Compass className="w-3.5 h-3.5 text-[#34D399]" />
                    <span>Vitality</span>
                  </button>
                </div>
              </div>
            )}

            {/* 2. Choose Theme */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-gray-300">Card Color Aesthetic:</span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'midnight_gold', name: 'Midnight Gold', bg: 'bg-[#C8AA6E]/20 text-[#C8AA6E] border-[#C8AA6E]' },
                  { id: 'celestial_amethyst', name: 'Celestial Amethyst', bg: 'bg-[#A855F7]/20 text-[#A855F7] border-[#A855F7]' },
                  { id: 'emerald_cosmos', name: 'Emerald Cosmos', bg: 'bg-[#10B981]/20 text-[#10B981] border-[#10B981]' },
                ].map((th) => (
                  <button
                    key={th.id}
                    onClick={() => setTheme(th.id as any)}
                    className={`p-2 rounded-xl border text-[11px] font-medium transition-all ${
                      theme === th.id
                        ? `${th.bg} shadow-md`
                        : 'border-gray-800 bg-[#0B0E1B] text-gray-400 hover:text-white'
                    }`}
                  >
                    {th.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Photo Privacy Toggle */}
            <div className="p-3.5 rounded-2xl border border-gray-800 bg-[#070913]/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {includePalmPhoto ? (
                  <Eye className="w-4 h-4 text-[#C8AA6E]" />
                ) : (
                  <EyeOff className="w-4 h-4 text-emerald-400" />
                )}
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">Include Palm Photo Thumbnail</span>
                  <span className="text-[10px] text-gray-400">
                    {includePalmPhoto
                      ? 'Photo thumbnail visible on card'
                      : 'Photo hidden (Strict privacy active)'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setIncludePalmPhoto(!includePalmPhoto)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  includePalmPhoto
                    ? 'bg-[#C8AA6E] text-black font-bold'
                    : 'bg-gray-800 text-gray-300 hover:text-white'
                }`}
              >
                {includePalmPhoto ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* 4. Referral Info Box */}
            <div className="p-3 rounded-xl border border-gray-800 bg-[#0B0E1B] flex items-center justify-between text-xs">
              <span className="text-gray-400 text-[11px]">Your Referral Link:</span>
              <span className="font-mono text-[#C8AA6E] text-[11px] truncate max-w-[200px]">
                {referralUrl}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-gray-800">
            <button
              onClick={handleShare}
              disabled={isExporting}
              className="btn-gold flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl"
            >
              <Share2 className="w-4 h-4" />
              <span>{copiedLink ? 'Link Copied!' : 'Share Story Card'}</span>
            </button>

            <button
              onClick={handleDownloadImage}
              className="px-4 py-3 rounded-xl border border-gray-700 bg-gray-900/70 hover:bg-gray-800 text-gray-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Download full 1080x1920 PNG image"
            >
              <Download className="w-4 h-4 text-[#C8AA6E]" />
              <span>Download PNG</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
