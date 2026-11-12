'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Camera,
  Upload,
  RefreshCw,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Info,
  Hand,
  Sun,
  ShieldCheck,
  ChevronRight,
  Maximize2,
  Lock,
  EyeOff,
  Check,
  X,
  ArrowRight,
  BookOpen,
  Zap,
  ZapOff,
  ZoomIn,
} from 'lucide-react';
import {
  validatePalmImage,
  analyzePalmImage,
  compareReadings,
  generateReading,
  ImageQualityMetrics,
  PalmAnalysisResult,
  trackAnalyticsEvent,
} from '../../lib/api';
import {
  saveCurrentAnalysis,
  saveCurrentImagePreview,
  saveLocalReading,
  saveLocalDualReading,
  isFeatureUnlocked,
} from '../../lib/storage';

import { reportCameraFailure } from '../../lib/sentry';
import { PalmFramingReticle, AlignmentStatus, GuideScale } from '../../components/PalmFramingReticle';
import { PalmFramingGuideModal } from '../../components/PalmFramingGuideModal';
import { onDeviceSegmenter } from '../../lib/onnxCreaseSegmenter';

export default function ScanPage() {
  const router = useRouter();

  // Scan type: 'single' (traditional) | 'dual' (dominant vs non-dominant comparison)
  const [scanType, setScanType] = useState<'single' | 'dual'>('single');
  const [dominantHand, setDominantHand] = useState<'right' | 'left'>('right');
  const [dualStep, setDualStep] = useState<1 | 2>(1);
  const [nonDominantAnalysis, setNonDominantAnalysis] = useState<PalmAnalysisResult | null>(null);
  const [nonDominantPreviewUrl, setNonDominantPreviewUrl] = useState<string | null>(null);
  const [nonDominantFile, setNonDominantFile] = useState<File | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [showDualUnlockModal, setShowDualUnlockModal] = useState(false);
  const [pendingDualAnalyses, setPendingDualAnalyses] = useState<{
    dominant: PalmAnalysisResult;
    nonDominant: PalmAnalysisResult;
  } | null>(null);

  // Mode: 'select' | 'camera' | 'preview'
  const [mode, setMode] = useState<'select' | 'camera' | 'preview'>('select');

  // Pre-warm ONNX WebAssembly engine on mount for 60 FPS on-device inference
  useEffect(() => {
    onDeviceSegmenter.initSession().catch((err) => {
      console.warn('Pre-warming onnxruntime session:', err);
    });
  }, []);

  // Restore Dual-Hand Step 1 if the user refreshed or changed orientation during Step 2
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const cachedAnalysis = sessionStorage.getItem('palmora_dual_analysis_nd');
      const cachedPreview = sessionStorage.getItem('palmora_dual_preview_nd');
      if (cachedAnalysis) {
        const parsed = JSON.parse(cachedAnalysis);
        if (parsed?.analysis_id) {
          setNonDominantAnalysis(parsed);
          if (cachedPreview) setNonDominantPreviewUrl(cachedPreview);
          setScanType('dual');
          setDualStep(2);
        }
      }
    } catch (e) {
      console.warn('Failed to restore dual hand session', e);
    }
  }, []);

  const handleResetDualScan = () => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('palmora_dual_analysis_nd');
        sessionStorage.removeItem('palmora_dual_preview_nd');
        sessionStorage.removeItem('palmora_dual_preview_dom');
      } catch (_) {}
    }
    setNonDominantAnalysis(null);
    setNonDominantPreviewUrl(null);
    setNonDominantFile(null);
    setPendingDualAnalyses(null);
    setShowDualUnlockModal(false);
    setDualStep(1);
  };
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  // Visual Guide & Alignment state
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [guideScale, setGuideScale] = useState<GuideScale>('normal');
  const [alignmentStatus, setAlignmentStatus] = useState<AlignmentStatus>('no_hand');
  const [alignmentMessage, setAlignmentMessage] = useState<string>('');
  const [frameFill, setFrameFill] = useState<number>(0);
  const [autoSnapEnabled, setAutoSnapEnabled] = useState(true);
  const [autoSnapCountdown, setAutoSnapCountdown] = useState<number | null>(null);

  const samplerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const steadyCountRef = useRef<number>(0);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const samplerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownActiveRef = useRef<boolean>(false);
  const countdownValueRef = useRef<number | null>(null);
  const absentFramesRef = useRef<number>(0);
  const autoSnapEnabledRef = useRef<boolean>(autoSnapEnabled);
  const capturePhotoRef = useRef<() => void>(() => {});

  // Privacy disclosure acceptance
  const [privacyConsent, setPrivacyConsent] = useState(true);

  // Synchronize autoSnapEnabled ref and cancel active countdown if toggled off
  useEffect(() => {
    autoSnapEnabledRef.current = autoSnapEnabled;
    if (!autoSnapEnabled && countdownActiveRef.current) {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      countdownActiveRef.current = false;
      countdownValueRef.current = null;
      absentFramesRef.current = 0;
      setAutoSnapCountdown(null);
    }
  }, [autoSnapEnabled]);

  // Camera states
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [streamActive, setStreamActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isFrontCamera, setIsFrontCamera] = useState(false);

  // Validation & Processing states
  const [isValidating, setIsValidating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState<string>('Isolating Palmar Topography...');
  const [qualityMetrics, setQualityMetrics] = useState<ImageQualityMetrics | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stopCameraStream = () => {
    // 0. Cancel live sampler and countdown timers
    if (samplerIntervalRef.current) {
      clearInterval(samplerIntervalRef.current);
      samplerIntervalRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    countdownActiveRef.current = false;
    countdownValueRef.current = null;
    absentFramesRef.current = 0;
    setAutoSnapCountdown(null);
    steadyCountRef.current = 0;

    // 1. Stop any tracks tracked by streamRef
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      } catch (e) {
        console.warn('Error stopping track in streamRef:', e);
      }
      streamRef.current = null;
    }

    // 2. Stop any tracks attached to the video DOM element
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      try {
        stream.getTracks().forEach((track) => {
          track.stop();
        });
      } catch (e) {
        console.warn('Error stopping track in videoRef:', e);
      }
      videoRef.current.srcObject = null;
    }
    setStreamActive(false);
  };

  // Referral tracking and robust camera teardown on mount/unmount/pagehide
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const ref = urlParams.get('ref');
      if (ref) {
        localStorage.setItem('palmora_referred_by', ref);
        trackAnalyticsEvent('referral_visit', { referral_code: ref });
      }

      const handleUnload = () => {
        stopCameraStream();
      };
      window.addEventListener('beforeunload', handleUnload);
      window.addEventListener('pagehide', handleUnload);

      return () => {
        window.removeEventListener('beforeunload', handleUnload);
        window.removeEventListener('pagehide', handleUnload);
        stopCameraStream();
      };
    }

    return () => {
      stopCameraStream();
    };
  }, []);

  // Synchronize stream with videoRef whenever mode switches to 'camera'
  useEffect(() => {
    if (mode === 'camera' && streamRef.current && videoRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch((err) => {
          console.warn('Video play delayed/interrupted:', err);
        });
      }
    }
  }, [mode, streamActive]);

  // Real-time camera video alignment & quality analyzer ticker
  useEffect(() => {
    if (mode !== 'camera' || !streamActive) {
      if (samplerIntervalRef.current) {
        clearInterval(samplerIntervalRef.current);
        samplerIntervalRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      countdownActiveRef.current = false;
      countdownValueRef.current = null;
      absentFramesRef.current = 0;
      setAutoSnapCountdown(null);
      steadyCountRef.current = 0;
      return;
    }

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      if (!samplerCanvasRef.current) {
        samplerCanvasRef.current = document.createElement('canvas');
        samplerCanvasRef.current.width = 120;
        samplerCanvasRef.current.height = 160;
      }
      const canvas = samplerCanvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      try {
        // Trigger on-device 60 FPS ONNX WebAssembly crease segmentation
        onDeviceSegmenter.segmentFrame(video).catch(() => {});

        ctx.drawImage(video, 0, 0, 120, 160);
        const imgData = ctx.getImageData(0, 0, 120, 160);
        const d = imgData.data;

        let totalBrightness = 0;
        let skinCount = 0;
        let sumX = 0;
        let sumY = 0;
        let glareCount = 0;

        let coreSkin = 0;
        let coreTotal = 0;
        let wristSkin = 0;
        let wristTotal = 0;
        let cornerSkin = 0;
        let cornerTotal = 0;
        let fingerSkin = 0;
        let fingerTotal = 0;
        let darkHairTotal = 0;

        // Framing envelope: x: 14..106, y: 18..148 (matches canonical hand silhouette)
        let zonePixels = 0;
        for (let y = 18; y < 148; y += 2) {
          for (let x = 14; x < 106; x += 2) {
            zonePixels++;
            const idx = (y * 120 + x) * 4;
            const r = d[idx];
            const g = d[idx + 1];
            const b = d[idx + 2];

            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            totalBrightness += lum;

            // Direct light source / specular bulb flare check (e.g. ceiling lights shining directly into camera)
            if (lum >= 246 && (r + g + b) >= 700) {
              glareCount++;
            }

            // Fitzpatrick I-VI inclusive skin chrominance test
            // Uses normalized r-g space + shadow/lighting safety checks
            const rgbSum = r + g + b;
            let isSkin = false;
            if (rgbSum > 60 && lum >= 28) {
              const rn = r / rgbSum;
              const gn = g / rgbSum;
              // Human skin chromaticity envelope across light, medium, and deep skin tones
              const isSkinChrominance = rn >= 0.28 && rn <= 0.68 && gn >= 0.20 && gn <= 0.44;
              // Channel hierarchy: red dominates or equals green, and distinctly exceeds blue
              const isSkinBalance = r >= g * 0.88 && r >= b + 2;

              if (isSkinChrominance && isSkinBalance) {
                isSkin = true;
                skinCount++;
                sumX += x;
                sumY += y;
              }
            }

            // Central Palm Core disc: x: 36..84, y: 65..115 (must contain palm disk)
            if (x >= 36 && x <= 84 && y >= 65 && y <= 115) {
              coreTotal++;
              if (isSkin) coreSkin++;
            }

            // Upper Finger zone: x: 38..82, y: 18..52 (an upright open palm MUST have fingers extending here)
            if (x >= 38 && x <= 82 && y >= 18 && y <= 52) {
              fingerTotal++;
              if (isSkin) fingerSkin++;
              if (lum < 52) darkHairTotal++;
            }

            // Wrist Base anchor: x: 36..84, y: 130..148 (must enter from bottom)
            if (x >= 36 && x <= 84 && y >= 130 && y <= 148) {
              wristTotal++;
              if (isSkin) wristSkin++;
            }

            // Top Outer Corners: x: 14..32 or 88..106, y: 18..45 (should be empty background around fingers)
            if ((x <= 32 || x >= 88) && y <= 45) {
              cornerTotal++;
              if (isSkin) cornerSkin++;
            }
          }
        }

        const avgBrightness = zonePixels > 0 ? totalBrightness / zonePixels : 120;
        const coverage = zonePixels > 0 ? skinCount / zonePixels : 0;
        const centroidX = skinCount > 0 ? sumX / skinCount / 120 : 0.5;
        const centroidY = skinCount > 0 ? sumY / skinCount / 160 : 0.5;

        const coreCoverage = coreTotal > 0 ? coreSkin / coreTotal : 0;
        const wristCoverage = wristTotal > 0 ? wristSkin / wristTotal : 0;
        const cornerCoverage = cornerTotal > 0 ? cornerSkin / cornerTotal : 0;
        const fingerCoverage = fingerTotal > 0 ? fingerSkin / fingerTotal : 0;
        const darkHairRatio = fingerTotal > 0 ? darkHairTotal / fingerTotal : 0;

        let newStatus: AlignmentStatus = 'no_hand';
        let newMsg = '';

        const fillPercent = Math.min(100, Math.round(coverage * 100));
        setFrameFill(fillPercent);

        if (glareCount >= 18) {
          newStatus = 'backlight_glare';
          newMsg = '⚠️ Harsh backlight: Point camera away from ceiling lights';
        } else if (cornerCoverage > 0.40 && avgBrightness > 195 && coreCoverage < 0.50) {
          newStatus = 'backlight_glare';
          newMsg = '☀️ Bright window behind you: Turn to face the light';
        } else if (coreCoverage > 0.65 && fingerCoverage < 0.14) {
          newStatus = 'too_far';
          newMsg = '📐 Hold palm flat and parallel to camera';
        } else if (avgBrightness < 45) {
          newStatus = 'too_dark';
          newMsg = 'Lighting is dim: Face towards a light source';
        } else if (avgBrightness > 235) {
          newStatus = 'too_bright';
          newMsg = 'Too much glare: Shield direct lighting';
        } else if (cornerCoverage > 0.45 && coreCoverage < 0.35) {
          // Room background (e.g. wooden wardrobe, doors, walls) filling the frame without a hand
          newStatus = 'background_interference';
          newMsg = 'Room background detected: Place palm inside the outline';
        } else if (coreCoverage >= 0.30 && (fingerCoverage < 0.16 || darkHairRatio > 0.28)) {
          // User face / head framed in the webcam reticle instead of an open palm
          newStatus = 'no_hand';
          newMsg = '👤 Face detected: Please hold up your open palm inside the guide';
        } else if (coreCoverage < 0.28 || coverage < 0.16) {
          newStatus = 'no_hand';
          newMsg = 'Position your open palm inside the outline';
        } else if (coverage < 0.28 || coreCoverage < 0.40) {
          newStatus = 'too_far';
          newMsg = 'Bring palm closer to camera';
        } else if (coverage > 0.88 || (coreCoverage > 0.95 && cornerCoverage > 0.42)) {
          newStatus = 'too_close';
          newMsg = 'Move hand back slightly';
        } else if (centroidX < 0.33) {
          newStatus = 'shift_right';
          newMsg = 'Shift hand slightly right 👉';
        } else if (centroidX > 0.67) {
          newStatus = 'shift_left';
          newMsg = 'Shift hand slightly left 👈';
        } else if (wristCoverage < 0.12 && coverage < 0.50) {
          newStatus = 'no_hand';
          newMsg = 'Anchor wrist at bottom line of guide';
        } else if (fingerCoverage < 0.16 && coverage < 0.65) {
          newStatus = 'no_hand';
          newMsg = 'Extend fingers toward top of guide';
        } else {
          newStatus = 'optimal';
          newMsg = '✨ Perfect alignment! Click "Snap Photo Now" below';
        }

        setAlignmentStatus(newStatus);
        setAlignmentMessage(newMsg);

        // Manual capture: User clicks "Snap Photo Now" when aligned
        // No automatic snapping
      } catch (e) {
        // Ignore canvas read errors
      }
    }, 200);

    samplerIntervalRef.current = interval;

    return () => {
      clearInterval(interval);
      samplerIntervalRef.current = null;
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      countdownActiveRef.current = false;
      countdownValueRef.current = null;
      absentFramesRef.current = 0;
    };
  }, [mode, streamActive]);

  const startCamera = async () => {
    setCameraError(null);
    setErrorMessage(null);
    setMode('camera');
    trackAnalyticsEvent('scan_started', { source: 'live_camera' });

    // Step 1: Force-release any lingering stream to avoid 'Device in use' hardware locks
    stopCameraStream();

    // Small tick to allow OS/DirectShow driver to release physical lock
    await new Promise((resolve) => setTimeout(resolve, 80));

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is not supported by your current browser. Please upload a photograph instead.');
      setMode('select');
      return;
    }

    // Progressive constraint cascade:
    // 1. Mobile-ideal rear camera
    // 2. Front webcam (desktop / laptop default)
    // 3. Fallback generic unconstrained video
    const constraintCandidates: MediaStreamConstraints[] = [
      {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      },
      {
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      },
      {
        video: true,
      },
    ];

    let activeStream: MediaStream | null = null;
    let lastError: any = null;

    for (const constraints of constraintCandidates) {
      try {
        activeStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (activeStream) {
          lastError = null;
          break;
        }
      } catch (err: any) {
        lastError = err;
        // If user explicitly denied permission or device is busy/in-use,
        // no need to loop through remaining constraints as hardware is locked
        if (
          err.name === 'NotAllowedError' ||
          err.name === 'PermissionDeniedError' ||
          err.name === 'NotReadableError' ||
          err.name === 'AbortError'
        ) {
          break;
        }
      }
    }

    if (activeStream) {
      streamRef.current = activeStream;
      const track = activeStream.getVideoTracks()[0];
      const trackSettings = track?.getSettings?.();
      const isFront = trackSettings?.facingMode === 'user' || (!trackSettings?.facingMode && (typeof navigator !== 'undefined' && !navigator.userAgent.includes('Mobi')));
      setIsFrontCamera(Boolean(isFront));

      if (videoRef.current) {
        videoRef.current.srcObject = activeStream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('Video play interrupted:', playErr);
        }
      }
      setStreamActive(true);
    } else {
      stopCameraStream();
      console.warn('Camera initialization could not acquire stream:', lastError?.message || lastError);
      reportCameraFailure(lastError, constraintCandidates[0]);

      let friendlyMessage = 'Camera access was unavailable. Please upload a photograph instead.';
      const errName = lastError?.name || '';
      const errMsg = (lastError?.message || '').toLowerCase();

      if (
        errName === 'NotReadableError' ||
        errMsg.includes('device in use') ||
        errMsg.includes('could not start video source') ||
        errMsg.includes('hardware error')
      ) {
        friendlyMessage =
          'Your webcam is currently locked or in use by another application (such as Zoom, Microsoft Teams, Windows Camera, OBS, or another browser window). Please close any app using the camera, or upload a photo directly.';
      } else if (
        errName === 'NotAllowedError' ||
        errName === 'PermissionDeniedError'
      ) {
        friendlyMessage =
          'Camera permission was denied. Please allow camera permissions in your browser address bar, or upload a photo directly.';
      } else if (
        errName === 'NotFoundError' ||
        errName === 'DevicesNotFoundError'
      ) {
        friendlyMessage =
          'No camera hardware was detected on this device. Please upload a photo instead.';
      } else if (errName === 'OverconstrainedError') {
        friendlyMessage =
          'The camera does not support the requested video format. Please upload a photo instead.';
      }

      setCameraError(friendlyMessage);
      setMode('select');
    }
  };

  const handleCancelCountdown = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    countdownActiveRef.current = false;
    countdownValueRef.current = null;
    absentFramesRef.current = 0;
    setAutoSnapCountdown(null);
    steadyCountRef.current = 0;
  };


/**
 * Downscales images to max 1280px on their longest dimension and compresses to JPEG (quality 0.85).
 * If isFrontCamera is true, horizontally flips the canvas so that left and right hands match
 * natural human hand anatomy rather than raw unmirrored sensor data.
 */
async function optimizeImageForUpload(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  isFrontCamera: boolean = false
): Promise<File> {
  const MAX_DIMENSION = 1280;
  let srcWidth = 0;
  let srcHeight = 0;

  if ('videoWidth' in source) {
    srcWidth = source.videoWidth || 1280;
    srcHeight = source.videoHeight || 720;
  } else if ('naturalWidth' in source) {
    srcWidth = source.naturalWidth;
    srcHeight = source.naturalHeight;
  } else {
    srcWidth = source.width;
    srcHeight = source.height;
  }

  let targetWidth = srcWidth;
  let targetHeight = srcHeight;
  if (srcWidth > MAX_DIMENSION || srcHeight > MAX_DIMENSION) {
    if (srcWidth > srcHeight) {
      targetWidth = MAX_DIMENSION;
      targetHeight = Math.round((srcHeight * MAX_DIMENSION) / srcWidth);
    } else {
      targetHeight = MAX_DIMENSION;
      targetWidth = Math.round((srcWidth * MAX_DIMENSION) / srcHeight);
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not initialize 2D canvas context');

  // Draw source directly without horizontal inversion to preserve true biological left/right handedness
  ctx.drawImage(source, 0, 0, targetWidth, targetHeight);

  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Image compression failed'));
        const optimizedFile = new File([blob], 'palm_capture.jpg', { type: 'image/jpeg' });
        resolve(optimizedFile);
      },
      'image/jpeg',
      0.85
    );
  });
}

  const capturePhotoFromCamera = async () => {

    // Reset any active countdown timers before triggering capture
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    countdownActiveRef.current = false;
    countdownValueRef.current = null;
    absentFramesRef.current = 0;
    setAutoSnapCountdown(null);
    steadyCountRef.current = 0;

    if (!videoRef.current) return;
    const video = videoRef.current;

    try {
      const optimizedFile = await optimizeImageForUpload(video, isFrontCamera);
      const previewUrl = URL.createObjectURL(optimizedFile);
      handleImageChosen(optimizedFile, previewUrl);
    } catch (err) {
      console.error('Camera capture optimization failed:', err);
    }

    stopCameraStream();
  };

  capturePhotoRef.current = capturePhotoFromCamera;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    trackAnalyticsEvent('scan_started', { source: 'file_upload' });

    if (file.size > 25 * 1024 * 1024) {
      setErrorMessage('File size exceeds 25MB. Please select a smaller photograph.');
      trackAnalyticsEvent('upload_rejected', { reason: 'file_size_exceeded' });
      return;
    }

    // Downscale large phone photos client-side to prevent backend memory exhaustion
    const img = new Image();
    const tempUrl = URL.createObjectURL(file);
    img.onload = async () => {
      URL.revokeObjectURL(tempUrl);
      try {
        let finalFile = file;
        if (img.naturalWidth > 1280 || img.naturalHeight > 1280 || file.size > 1024 * 1024) {
          finalFile = await optimizeImageForUpload(img, false);
        }
        const previewUrl = URL.createObjectURL(finalFile);
        handleImageChosen(finalFile, previewUrl);
      } catch (err) {
        const previewUrl = URL.createObjectURL(file);
        handleImageChosen(file, previewUrl);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(tempUrl);
      const previewUrl = URL.createObjectURL(file);
      handleImageChosen(file, previewUrl);
    };
    img.src = tempUrl;
  };

  const handleImageChosen = async (file: File, previewUrl: string) => {
    setSelectedFile(file);
    setImagePreviewUrl(previewUrl);
    setMode('preview');
    setErrorMessage(null);
    setQualityMetrics(null);

    setIsValidating(true);
    try {
      const metrics = await validatePalmImage(file);
      setQualityMetrics(metrics);
      if (!metrics.is_usable && metrics.issues.length > 0) {
        if (!metrics.hand_detected) {
          setErrorMessage(metrics.issues.join(' '));
        }
        trackAnalyticsEvent('upload_rejected', { issues: metrics.issues });
      }
    } catch (err: any) {
      console.error('Validation error:', err);
      setQualityMetrics(null);
      setErrorMessage(
        err.message || 'Unable to connect to the palm validation service. Please ensure the backend API is running and try again.'
      );
      trackAnalyticsEvent('scan_failed', { stage: 'pre_flight_validation', error: String(err) });
    } finally {
      setIsValidating(false);
    }
  };

  const runAnalysisAndProceed = async () => {
    if (!selectedFile || !imagePreviewUrl) return;

    setIsAnalyzing(true);
    setAnalysisStage('Isolating Palmar Topography...');
    setErrorMessage(null);

    const timer1 = setTimeout(() => {
      setAnalysisStage('Extracting Epidermal Crease Vectors...');
    }, 1400);
    const timer2 = setTimeout(() => {
      setAnalysisStage('Calibrating 3D Mount Elevations...');
    }, 3000);
    const timer3 = setTimeout(() => {
      setAnalysisStage('Finalizing Biometric Ensembling...');
    }, 4500);

    try {
      const analysisResult = await analyzePalmImage(selectedFile);

      if (scanType === 'single') {
        saveCurrentAnalysis(analysisResult);
        saveCurrentImagePreview(analysisResult.isolated_bokeh_image_base64 || selectedFile);
        trackAnalyticsEvent('scan_completed', {
          analysis_id: analysisResult.analysis_id,
          hand_side: analysisResult.detected_hand_side,
          scan_type: 'single',
        });
        router.push('/analysis');
        return;
      }

      // Dual-hand flow: Step 1 (Non-Dominant Palm)
      if (dualStep === 1) {
        setNonDominantAnalysis(analysisResult);
        const previewNd = analysisResult.isolated_bokeh_image_base64 || imagePreviewUrl;
        setNonDominantPreviewUrl(previewNd);
        setNonDominantFile(selectedFile);
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem('palmora_dual_analysis_nd', JSON.stringify(analysisResult));
          } catch {}
        }
        if (typeof window !== 'undefined' && imagePreviewUrl) {
          try {
            sessionStorage.setItem('palmora_dual_preview_nd', imagePreviewUrl);
            if (selectedFile && typeof FileReader !== 'undefined') {
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  if (reader.result) {
                    sessionStorage.setItem('palmora_dual_preview_nd', reader.result as string);
                  }
                } catch {}
              };
              reader.readAsDataURL(selectedFile);
            }
          } catch {}
        }
        trackAnalyticsEvent('dual_scan_step1_completed', {
          analysis_id: analysisResult.analysis_id,
          dominant_hand: dominantHand,
        });
        setDualStep(2);
        stopCameraStream();
        // Clear active selection for Step 2 while preserving Step 1 analysis & preview
        setSelectedFile(null);
        setImagePreviewUrl(null);
        setQualityMetrics(null);
        setMode('select');
        return;
      }

      // Step 2: Compare both hands
      setIsComparing(true);
      if (typeof window !== 'undefined' && imagePreviewUrl) {
        try {
          sessionStorage.setItem('palmora_dual_preview_dom', imagePreviewUrl);
          if (selectedFile && typeof FileReader !== 'undefined') {
            const reader = new FileReader();
            reader.onload = () => {
              try {
                if (reader.result) {
                  sessionStorage.setItem('palmora_dual_preview_dom', reader.result as string);
                }
              } catch {}
            };
            reader.readAsDataURL(selectedFile);
          }
        } catch {}
      }
      trackAnalyticsEvent('dual_scan_step2_completed', {
        dominant_analysis_id: analysisResult.analysis_id,
        non_dominant_analysis_id: nonDominantAnalysis?.analysis_id,
      });

      const dualUnlocked = typeof isFeatureUnlocked === 'function' ? isFeatureUnlocked('dual_hand_synthesis') : false;
      if (!dualUnlocked) {
        setPendingDualAnalyses({
          dominant: analysisResult,
          nonDominant: nonDominantAnalysis!,
        });
        setShowDualUnlockModal(true);
        setIsAnalyzing(false);
        setIsComparing(false);
        return;
      }

      const dualReport = await compareReadings({
        non_dominant_analysis_id: nonDominantAnalysis!.analysis_id,
        dominant_analysis_id: analysisResult.analysis_id,
        non_dominant_features: nonDominantAnalysis!.features,
        dominant_features: analysisResult.features,
        dominant_hand: dominantHand,
      });

      saveLocalDualReading(dualReport);
      trackAnalyticsEvent('dual_comparison_generated', {
        reading_id: dualReport.id,
        growth_index: dualReport.growth_index,
      });
      router.push(`/reading?id=${dualReport.id}&mode=dual`);
    } catch (err: any) {
      console.error('Analysis error:', err);
      setErrorMessage(err.message || 'Unable to process image. Please try another photograph.');
      trackAnalyticsEvent('scan_failed', { error: err.message, scan_type: scanType });
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      setIsAnalyzing(false);
      setIsComparing(false);
    }
  };

  const handleProceedWithSingleReport = async () => {
    if (!pendingDualAnalyses) return;
    setIsComparing(true);
    try {
      const singleReport = await generateReading({
        analysis_id: pendingDualAnalyses.dominant.analysis_id,
        features: pendingDualAnalyses.dominant.features,
        tier: 'free',
      });
      saveLocalReading({
        ...singleReport,
        features: pendingDualAnalyses.dominant.features || singleReport.features,
        roi_box: pendingDualAnalyses.dominant.palm_roi_box || singleReport.roi_box,
      });
      saveCurrentAnalysis(pendingDualAnalyses.dominant);
      setShowDualUnlockModal(false);
      router.push(`/reading?id=${singleReport.id}`);
    } catch (err: any) {
      console.error('Single report generation error:', err);
      setErrorMessage(err.message || 'Unable to generate reading.');
    } finally {
      setIsComparing(false);
    }
  };

  const handleRetakeStep1 = () => {
    setDualStep(1);
    setNonDominantAnalysis(null);
    if (nonDominantPreviewUrl && nonDominantPreviewUrl.startsWith('blob:') && nonDominantPreviewUrl !== imagePreviewUrl) {
      URL.revokeObjectURL(nonDominantPreviewUrl);
    }
    setNonDominantPreviewUrl(null);
    setNonDominantFile(null);
    resetSelection();
  };

  const handleUseSameImageForStep2 = () => {
    if (!nonDominantFile || !nonDominantPreviewUrl) return;
    handleImageChosen(nonDominantFile, nonDominantPreviewUrl);
  };

  const resetSelection = () => {
    stopCameraStream();
    if (imagePreviewUrl && imagePreviewUrl.startsWith('blob:') && imagePreviewUrl !== nonDominantPreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setSelectedFile(null);
    setImagePreviewUrl(null);
    setQualityMetrics(null);
    setErrorMessage(null);
    setMode('select');
  };

  const nonDominantHandLabel = dominantHand === 'right' ? 'Left' : 'Right';
  const dominantHandLabel = dominantHand === 'right' ? 'Right' : 'Left';

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col items-center">
      {/* Mode Switcher: Single Palm vs Dual-Hand Evolution */}
      <div className="w-full max-w-xl mb-6 p-1 rounded-2xl bg-[#0B0E1B] border border-gray-800 grid grid-cols-2 text-xs">
        <button
          type="button"
          onClick={() => {
            if (scanType !== 'single') {
              setScanType('single');
              resetSelection();
              setDualStep(1);
            }
          }}
          className={`py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
            scanType === 'single'
              ? 'bg-[#C8AA6E] text-black shadow-lg shadow-[#C8AA6E]/20'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Hand className="w-4 h-4" />
          <span>Single Palm Reflection</span>
        </button>
        <button
          type="button"
          onClick={() => {
            if (scanType !== 'dual') {
              setScanType('dual');
              resetSelection();
            }
          }}
          className={`py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 relative ${
            scanType === 'dual'
              ? 'bg-gradient-to-r from-[#C8AA6E] to-[#E2C785] text-black shadow-lg shadow-[#C8AA6E]/20'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4 text-purple-600" />
          <span>Dual-Hand Evolution</span>
        </button>
      </div>

      {/* Journey Indicator */}
      {scanType === 'single' ? (
        <div className="w-full max-w-xl flex items-center justify-between text-xs mb-8 text-gray-400">
          <div className="flex items-center gap-1.5 text-[#C8AA6E] font-bold">
            <span className="w-5 h-5 rounded-full bg-[#C8AA6E]/20 border border-[#C8AA6E] flex items-center justify-center text-[10px]">
              1
            </span>
            <span>Capture / Select</span>
          </div>
          <div className="w-8 h-[1px] bg-gray-800" />
          <div className={`flex items-center gap-1.5 ${mode === 'preview' ? 'text-[#C8AA6E] font-bold' : ''}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${mode === 'preview' ? 'bg-[#C8AA6E]/20 border border-[#C8AA6E]' : 'bg-gray-900 border border-gray-800'}`}>
              2
            </span>
            <span>Quality Check</span>
          </div>
          <div className="w-8 h-[1px] bg-gray-800" />
          <div className="flex items-center gap-1.5 text-gray-500">
            <span className="w-5 h-5 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center text-[10px]">
              3
            </span>
            <span>Crease Overlay</span>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-xl flex items-center justify-between text-xs mb-8 text-gray-400">
          <div className={`flex items-center gap-1.5 ${dualStep === 1 ? 'text-[#C8AA6E] font-bold' : 'text-emerald-400 font-medium'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${dualStep === 1 ? 'bg-[#C8AA6E]/20 border border-[#C8AA6E]' : 'bg-emerald-950 border border-emerald-500 text-emerald-400'}`}>
              {dualStep > 1 ? '✓' : '1'}
            </span>
            <span>Innate ({nonDominantHandLabel})</span>
          </div>
          <div className={`w-8 h-[1px] ${dualStep === 2 ? 'bg-[#C8AA6E]' : 'bg-gray-800'}`} />
          <div className={`flex items-center gap-1.5 ${dualStep === 2 ? 'text-[#C8AA6E] font-bold' : 'text-gray-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${dualStep === 2 ? 'bg-[#C8AA6E]/20 border border-[#C8AA6E]' : 'bg-gray-900 border border-gray-800'}`}>
              2
            </span>
            <span>Manifested ({dominantHandLabel})</span>
          </div>
          <div className="w-8 h-[1px] bg-gray-800" />
          <div className="flex items-center gap-1.5 text-gray-500">
            <span className="w-5 h-5 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center text-[10px]">
              3
            </span>
            <span>Comparative Synthesis</span>
          </div>
        </div>
      )}

      {/* Dual Step 2 Active Status & Retake Option */}
      {scanType === 'dual' && dualStep === 2 && (
        <div className="w-full max-w-xl flex items-center justify-between bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-xl text-xs text-amber-300 mb-6">
          <span className="flex items-center gap-2">
            <span className="text-emerald-400 font-bold">✓</span> Hand 1 ({nonDominantHandLabel}) preserved. Now scanning Hand 2 ({dominantHandLabel}).
          </span>
          <button
            type="button"
            onClick={handleResetDualScan}
            className="underline hover:text-amber-200 ml-2 font-medium shrink-0"
          >
            Retake Hand 1
          </button>
        </div>
      )}

      {/* Dual Unlock Recovery Banner if modal was dismissed */}
      {pendingDualAnalyses && !showDualUnlockModal && (
        <div className="w-full max-w-xl mb-6 p-4 bg-purple-950/40 border border-purple-500/30 rounded-2xl flex items-center justify-between gap-3 shadow-lg">
          <div className="text-xs text-purple-200">
            <span className="font-bold text-white">Dual-Hand Evolution Ready:</span> Both hands captured. Unlock comparative synthesis to view report.
          </div>
          <button
            type="button"
            onClick={() => setShowDualUnlockModal(true)}
            className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl shadow-md shrink-0 transition-colors"
          >
            Unlock Synthesis
          </button>
        </div>
      )}

      {/* Header */}
      <div className="text-center max-w-2xl mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-gold-gradient">
          {scanType === 'single' ? 'Interactive Palm Scanner' : 'Chirological Dual-Hand Evolution'}
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white mt-2 tracking-tight">
          {scanType === 'single'
            ? 'Capture Your Palm'
            : dualStep === 1
            ? `Step 1: Scan ${nonDominantHandLabel} Palm (Innate Potential)`
            : `Step 2: Scan ${dominantHandLabel} Palm (Manifested Life)`}
        </h1>
        <p className="text-gray-300 text-sm sm:text-base mt-3 leading-relaxed">
          {scanType === 'single'
            ? 'Position your open palm flat under bright, even lighting. Our computer vision engine analyzes real creases in real-time.'
            : dualStep === 1
            ? `Scan your non-dominant (${nonDominantHandLabel}) palm to map your constitutional temperament, subconscious gifts, and inborn baseline.`
            : `Now scan your active dominant (${dominantHandLabel}) palm to evaluate conscious adaptations, career direction, and lived evolution.`}
        </p>
      </div>

      {/* Dual Mode Dominant Hand Config & Explanation */}
      {scanType === 'dual' && (
        <div className="w-full max-w-xl mb-6 p-4.5 rounded-2xl bg-[#0D1122]/90 border border-[rgba(200,170,110,0.3)] text-xs flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white flex items-center gap-2">
              <Hand className="w-4 h-4 text-[#C8AA6E]" /> Dominant Writing Hand:
            </span>
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/50 border border-gray-800">
              <button
                type="button"
                onClick={() => {
                  if (dualStep === 1) setDominantHand('right');
                }}
                disabled={dualStep === 2}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  dominantHand === 'right' ? 'bg-[#C8AA6E] text-black shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                Right Hand
              </button>
              <button
                type="button"
                onClick={() => {
                  if (dualStep === 1) setDominantHand('left');
                }}
                disabled={dualStep === 2}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  dominantHand === 'left' ? 'bg-[#C8AA6E] text-black shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                Left Hand
              </button>
            </div>
          </div>

          {dualStep === 2 && nonDominantAnalysis && (
            <div className="pt-2 border-t border-gray-800 flex items-center justify-between text-[11px]">
              <span className="text-emerald-400 flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4" /> Non-Dominant Baseline Secured
              </span>
              <button
                type="button"
                onClick={handleRetakeStep1}
                className="text-gray-400 hover:text-rose-400 transition-colors underline"
              >
                Retake Step 1
              </button>
            </div>
          )}
        </div>
      )}

      {/* Ephemeral Privacy Disclosure (Pre-Flight) */}
      <div className="w-full max-w-2xl mb-8 p-4.5 rounded-2xl bg-[#0B0E1B] border border-gray-800 text-xs text-gray-300 flex items-start gap-3">
        <EyeOff className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white">Ephemeral Privacy Guarantee</span>
            <span className="text-[10px] text-emerald-400 font-mono">Zero Biometric Retention</span>
          </div>
          <p className="text-gray-400 leading-relaxed text-[11px]">
            Your photograph is analyzed in-memory to trace crease vectors and is discarded immediately. We do not store raw photos or use them for facial/biometric identification or public AI training.
          </p>
        </div>
      </div>

      {/* Main Scanner Container */}
      <div className="w-full glass-card p-6 sm:p-10 rounded-3xl border border-[rgba(200,170,110,0.3)] shadow-2xl flex flex-col items-center">
        {/* Error notification */}
        {(errorMessage || cameraError) && (
          <div className="w-full mb-6 p-4 rounded-2xl bg-amber-950/40 border border-amber-600/40 text-amber-200 text-xs sm:text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1.5 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">Notice</span>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setCameraError(null);
                  }}
                  className="text-amber-400/80 hover:text-white transition-colors p-0.5 rounded-lg hover:bg-amber-900/30"
                  aria-label="Dismiss notice"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <span className="leading-relaxed">{errorMessage || cameraError}</span>
              {cameraError && (
                <div className="flex flex-wrap items-center gap-2.5 mt-2">
                  <label className="py-2 px-4 rounded-xl bg-[#C8AA6E] text-black font-bold text-xs cursor-pointer hover:bg-[#E2C785] transition-all flex items-center gap-1.5 shadow-md">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Photo Instead</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="py-2 px-3.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white text-xs border border-gray-700 transition-all flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Camera</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODE: Select (Initial) */}
        {mode === 'select' && (
          <div className="w-full flex flex-col items-center gap-6 py-4">
            {/* Step 1 Completion Banner (when in Dual-Hand Step 2) */}
            {scanType === 'dual' && dualStep === 2 && nonDominantAnalysis && (
              <div className="w-full max-w-xl p-4.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-xs flex items-center justify-between gap-4 shadow-lg">
                <div className="flex items-center gap-3">
                  {nonDominantPreviewUrl ? (
                    <img
                      src={nonDominantPreviewUrl}
                      alt="Step 1 Palm"
                      className="w-14 h-14 rounded-xl object-cover border border-emerald-500/40 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-emerald-900/50 flex items-center justify-center text-emerald-300 shrink-0">
                      <Hand className="w-6 h-6" />
                    </div>
                  )}
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-white flex items-center gap-1.5 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Hand 1 ({nonDominantHandLabel} Palm) Analyzed
                    </span>
                    <span className="text-[11px] text-gray-300">
                      Innate baseline secured. Next, provide your active {dominantHandLabel} palm to complete comparison.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRetakeStep1}
                  className="text-[11px] text-gray-400 hover:text-white underline shrink-0"
                >
                  Retake Hand 1
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-xl">
              {/* Camera Trigger */}
              <button
                onClick={startCamera}
                className="p-8 rounded-2xl border border-[rgba(200,170,110,0.25)] bg-[#0D1122]/70 hover:bg-[#0D1122] hover:border-[#C8AA6E] transition-all flex flex-col items-center text-center gap-4 group"
              >
                <div className="w-16 h-16 rounded-2xl bg-[rgba(200,170,110,0.1)] border border-[rgba(200,170,110,0.3)] flex items-center justify-center text-[#C8AA6E] group-hover:scale-110 transition-transform">
                  <Camera className="w-8 h-8" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-lg font-bold text-white">Use Camera</span>
                  <span className="text-xs text-gray-400">
                    Live capture with alignment guide
                  </span>
                </div>
              </button>

              {/* Upload Trigger */}
              <label className="p-8 rounded-2xl border border-[rgba(200,170,110,0.25)] bg-[#0D1122]/70 hover:bg-[#0D1122] hover:border-[#C8AA6E] transition-all flex flex-col items-center text-center gap-4 cursor-pointer group">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onClick={(e) => {
                    (e.target as HTMLInputElement).value = '';
                  }}
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="w-16 h-16 rounded-2xl bg-[rgba(124,58,237,0.1)] border border-[rgba(124,58,237,0.3)] flex items-center justify-center text-[#A78BFA] group-hover:scale-110 transition-transform">
                  <Upload className="w-8 h-8" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-lg font-bold text-white">Upload Photograph</span>
                  <span className="text-xs text-gray-400">
                    JPEG, PNG, WebP up to 10MB
                  </span>
                </div>
              </label>
            </div>

            {/* Quick Demo: Use same photo for hand 2 */}
            {scanType === 'dual' && dualStep === 2 && nonDominantFile && (
              <button
                type="button"
                onClick={handleUseSameImageForStep2}
                className="w-full max-w-xl py-3.5 px-4 rounded-2xl bg-[rgba(200,170,110,0.12)] border border-[rgba(200,170,110,0.35)] hover:border-[#C8AA6E] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all hover:bg-[rgba(200,170,110,0.22)] shadow-md"
              >
                <Sparkles className="w-4 h-4 text-[#C8AA6E]" />
                <span>Use Same Photo for {dominantHandLabel} Palm (Instant Reflection Test)</span>
              </button>
            )}

            {/* Preparation Guidelines */}
            <div className="w-full max-w-xl p-5 rounded-2xl bg-[#070913]/60 border border-gray-800 text-xs text-gray-300 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-2.5">
                <Sun className="w-4 h-4 text-[#C8AA6E] shrink-0" />
                <span>Bright, even light</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Hand className="w-4 h-4 text-[#C8AA6E] shrink-0" />
                <span>Open palm flat</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Maximize2 className="w-4 h-4 text-[#C8AA6E] shrink-0" />
                <span>65-75% frame fill</span>
              </div>
            </div>

            {/* Palm Framing Guide Quick Trigger */}
            <div className="w-full max-w-xl p-3.5 rounded-2xl bg-[rgba(200,170,110,0.06)] border border-[rgba(200,170,110,0.22)] flex items-center justify-between gap-3 text-xs shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[rgba(200,170,110,0.15)] flex items-center justify-center text-[#C8AA6E] shrink-0">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-white text-xs">Unsure how to frame your palm?</span>
                  <span className="text-[11px] text-gray-400">View real-world photo distance, lighting, and finger positioning guidance</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGuideModalOpen(true)}
                className="px-3 py-1.5 rounded-xl border border-[rgba(200,170,110,0.35)] bg-[#070913] text-[11px] font-semibold text-[#C8AA6E] hover:text-white hover:border-[#C8AA6E] transition-colors shrink-0 flex items-center gap-1"
              >
                <span>View Guide</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* MODE: Camera (Live Feed) */}
        {mode === 'camera' && (
          <div className="w-full flex flex-col items-center gap-5">
            <div className="relative w-full max-w-md aspect-[3/4] rounded-2xl overflow-hidden border-2 border-[rgba(200,170,110,0.4)] bg-black flex items-center justify-center shadow-2xl">
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className={`w-full h-full object-cover ${isFrontCamera ? '-scale-x-100' : ''}`}
              />

              {/* Anatomical Hand Silhouette Alignment Guide & Real-Time Feedback */}
              <PalmFramingReticle
                handSide={
                  scanType === 'dual'
                    ? dualStep === 1
                      ? dominantHand === 'right' ? 'left' : 'right'
                      : dominantHand
                    : dominantHand
                }
                targetLabel={
                  scanType === 'dual'
                    ? dualStep === 1
                      ? `Step 1: ${nonDominantHandLabel} Palm (Innate)`
                      : `Step 2: ${dominantHandLabel} Palm (Active)`
                    : `${dominantHandLabel} Palm`
                }
                status={alignmentStatus}
                statusMessage={alignmentMessage}
                guideScale={guideScale}
                autoSnapCountdown={null}
                fillPercentage={frameFill}
                onScaleChange={setGuideScale}
                onCancelCountdown={handleCancelCountdown}
              />
            </div>

            {/* Camera Control Bar: Auto-Snap, Framing Guide, Manual Snap */}
            <div className="w-full max-w-md flex flex-col items-center gap-3">
              <div className="w-full flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setIsGuideModalOpen(true)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white border border-gray-800 bg-gray-900/70 hover:bg-gray-800 transition-colors flex items-center gap-1.5 shadow-sm"
                  title="View optimal hand framing instructions"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[#C8AA6E]" />
                  <span>Framing Guide</span>
                </button>



                <button
                  onClick={resetSelection}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white border border-gray-800 bg-gray-900/70 hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
              </div>

              {/* Main Manual Snap Button */}
              <button
                onClick={capturePhotoFromCamera}
                className="w-full btn-gold py-3.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl hover:scale-[1.01] transition-transform"
              >
                <Camera className="w-4 h-4" />
                <span>Snap Photo Now</span>
              </button>

              {/* Direct Alternative: Upload Photo */}
              <label className="w-full py-2.5 px-4 rounded-xl border border-gray-800 hover:border-gray-700 bg-gray-900/40 hover:bg-gray-900/80 text-gray-400 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5 text-[#C8AA6E]" />
                <span>Laptop angle awkward? Upload photo from phone</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onClick={(e) => {
                    (e.target as HTMLInputElement).value = '';
                  }}
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}

        {/* MODE: Preview & Validation */}
        {mode === 'preview' && imagePreviewUrl && (
          <div className="w-full flex flex-col items-center gap-6">
            {/* Dual Mode: Hand 1 vs Hand 2 Contrast Bar */}
            {scanType === 'dual' && dualStep === 2 && nonDominantPreviewUrl && (
              <div className="w-full max-w-md p-3.5 rounded-2xl bg-[#0B0E1B] border border-gray-800 text-xs flex items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-2.5">
                  <img
                    src={nonDominantPreviewUrl}
                    alt="Hand 1 baseline"
                    className="w-12 h-12 rounded-xl object-cover border border-emerald-500/40 shrink-0"
                  />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-white">Hand 1: {nonDominantHandLabel} Palm</span>
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Innate Mapped
                    </span>
                  </div>
                </div>
                <span className="text-gray-500 text-xs font-bold uppercase">vs</span>
                <div className="text-right">
                  <span className="text-[11px] font-bold text-[#C8AA6E]">Hand 2: {dominantHandLabel} Palm</span>
                  <span className="text-[10px] text-gray-300 block">Manifested Reality</span>
                </div>
              </div>
            )}

            {/* Target Hand Guidance & 1-Click Swap */}
            {scanType === 'dual' && (
              <div className="w-full max-w-md p-3 rounded-2xl bg-[#0D1122]/90 border border-[rgba(200,170,110,0.3)] flex items-center justify-between gap-3 text-xs shadow-md">
                <div className="flex items-center gap-2">
                  <Hand className="w-4 h-4 text-[#C8AA6E]" />
                  <span className="text-gray-300">
                    Step {dualStep}: <strong className="text-white capitalize">{dualStep === 1 ? nonDominantHandLabel : dominantHandLabel} Palm</strong> expected
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setDominantHand(prev => (prev === 'right' ? 'left' : 'right'))}
                  className="px-2.5 py-1 rounded-lg border border-[rgba(200,170,110,0.3)] bg-[#070913] text-[11px] font-semibold text-[#C8AA6E] hover:text-white transition-colors"
                  title="Swap dominant hand assignment"
                >
                  Swap Hand
                </button>
              </div>
            )}

            <div className="relative w-full max-w-md aspect-[3/4] sm:aspect-square rounded-2xl overflow-hidden border border-[rgba(200,170,110,0.3)] bg-black flex items-center justify-center">
              <img
                src={imagePreviewUrl}
                alt="Palm photograph preview"
                className="w-full h-full object-contain"
              />

              {isValidating && (
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-8 h-8 text-[#C8AA6E] animate-spin" />
                  <span className="text-xs text-white font-medium">
                    Validating resolution, focus, and illumination...
                  </span>
                </div>
              )}

              {isAnalyzing && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center gap-3 p-6 text-center z-20 animate-in fade-in duration-200">
                  <div className="relative flex items-center justify-center">
                    <RefreshCw className="w-10 h-10 text-[#C8AA6E] animate-spin" />
                    <Sparkles className="w-4 h-4 text-[#C8AA6E] absolute" />
                  </div>
                  <span className="text-sm text-white font-bold tracking-wide">
                    {analysisStage}
                  </span>
                  <span className="text-[11px] text-[#C8AA6E]/90 font-medium">
                    5-Pass Test-Time Ensembling in progress
                  </span>
                  <div className="w-48 h-1.5 bg-gray-800 rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-gradient-to-r from-[#C8AA6E] via-amber-200 to-[#C8AA6E] animate-pulse rounded-full w-full" />
                  </div>
                </div>
              )}
            </div>

            {/* Warning when no hand is detected in photo */}
            {qualityMetrics && !qualityMetrics.hand_detected && (
              <div className="w-full max-w-md p-4.5 rounded-2xl bg-amber-950/60 border border-amber-500/50 text-amber-200 text-xs flex flex-col gap-2.5 shadow-xl">
                <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                  <span>No Open Palm Detected</span>
                </div>
                <p className="text-gray-300 leading-relaxed text-[11px]">
                  The photograph appears to show room background, ceiling, or an obstructed angle rather than an open palm. Please retake the photo with your palm open flat, or upload a clear photo taken on your phone.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="btn-gold py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Retake with Camera</span>
                  </button>
                  <label className="py-2 px-3.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-semibold text-xs cursor-pointer border border-gray-700 flex items-center gap-1.5 transition-colors">
                    <Upload className="w-3.5 h-3.5 text-[#C8AA6E]" />
                    <span>Upload from Phone</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onClick={(e) => {
                        (e.target as HTMLInputElement).value = '';
                      }}
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Validation Feedback Status */}
            {qualityMetrics && (
              <div className="w-full max-w-md p-5 rounded-2xl bg-[#0B0E1B] border border-gray-800 text-xs flex flex-col gap-3">
                <div className="flex items-center justify-between font-semibold">
                  <span className="text-white">Image Quality Assessment:</span>
                  <span
                    className={
                      qualityMetrics.is_usable
                        ? 'text-emerald-400 flex items-center gap-1'
                        : 'text-amber-400 flex items-center gap-1'
                    }
                  >
                    {qualityMetrics.is_usable ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" /> Ready for Crease Analysis
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4" /> Quality Issue Detected
                      </>
                    )}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-gray-400 text-[11px] pt-1 border-t border-gray-800/80">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 uppercase font-semibold">Hand Presence</span>
                    <strong className={qualityMetrics.hand_detected ? 'text-emerald-400' : 'text-amber-400'}>
                      {qualityMetrics.hand_detected ? '✓ Detected' : '⚠ Uncertain Presence'}
                    </strong>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 uppercase font-semibold">Orientation</span>
                    <strong className="text-white capitalize">{qualityMetrics.hand_orientation || 'Upright'}</strong>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 uppercase font-semibold">Focus & Sharpness</span>
                    <div className="flex items-center gap-1">
                      <strong className="text-white">{qualityMetrics.blur_score.toFixed(0)}</strong>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded ${
                        qualityMetrics.blur_score >= 100
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                          : qualityMetrics.blur_score >= 30
                          ? 'bg-emerald-950/40 text-emerald-400'
                          : 'bg-amber-950/60 text-amber-400 border border-amber-500/30'
                      }`}>
                        {qualityMetrics.blur_score >= 100 ? 'Crisp' : qualityMetrics.blur_score >= 30 ? 'Adequate' : 'Soft'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 uppercase font-semibold">Lighting & Exposure</span>
                    <div className="flex items-center gap-1">
                      <strong className="text-white">{qualityMetrics.brightness_score.toFixed(0)}</strong>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded ${
                        qualityMetrics.brightness_score >= 60 && qualityMetrics.brightness_score <= 200
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-950/60 text-amber-400 border border-amber-500/30'
                      }`}>
                        {qualityMetrics.brightness_score >= 60 && qualityMetrics.brightness_score <= 200
                          ? 'Optimal'
                          : qualityMetrics.brightness_score < 60
                          ? 'Dim'
                          : 'High Glare'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actionable Retake Guidance Display */}
                {qualityMetrics.actionable_guidance && qualityMetrics.actionable_guidance.length > 0 && (
                  <div className="mt-2 p-3 rounded-xl bg-[#070913]/80 border border-gray-800 text-[11px] flex flex-col gap-1.5">
                    <span className="font-semibold text-[#C8AA6E] flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Retake Recommendations:
                    </span>
                    <ul className="list-disc list-inside text-gray-300 space-y-0.5">
                      {qualityMetrics.actionable_guidance.map((guide, idx) => (
                        <li key={idx}>{guide}</li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => setIsGuideModalOpen(true)}
                      className="mt-1 w-full py-2 px-3 rounded-xl bg-[rgba(200,170,110,0.12)] border border-[rgba(200,170,110,0.35)] text-[11px] font-semibold text-[#C8AA6E] hover:text-white hover:bg-[rgba(200,170,110,0.2)] transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>View Visual Framing Guide for Better Results</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={resetSelection}
                disabled={isAnalyzing || isComparing}
                className="px-6 py-3 rounded-full text-xs font-semibold text-gray-300 hover:text-white border border-gray-700 bg-gray-900/60 transition-colors"
              >
                Retake / Replace
              </button>
              <button
                onClick={runAnalysisAndProceed}
                disabled={isAnalyzing || isValidating || isComparing || (qualityMetrics !== null && !qualityMetrics.hand_detected)}
                className="btn-gold px-8 py-3 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                title={qualityMetrics && !qualityMetrics.hand_detected ? 'Please retake with an open palm visible to proceed' : ''}
              >
                {isAnalyzing || isComparing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{isComparing ? 'Synthesizing Dual-Hand Evolution...' : analysisStage}</span>
                  </>
                ) : scanType === 'dual' ? (
                  dualStep === 1 ? (
                    <>
                      <Sparkles className="w-4 h-4 text-[#C8AA6E]" />
                      <span>Analyze {nonDominantHandLabel} Palm & Proceed to Hand 2 →</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-purple-700" />
                      <span>Synthesize Dual-Hand Evolution ✨</span>
                    </>
                  )
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Analyze Palm Features</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Dual-Hand Evolution Gated Synthesis Modal */}
        {showDualUnlockModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="glass-card max-w-lg w-full p-6 sm:p-8 rounded-3xl border border-[rgba(200,170,110,0.3)] bg-[#0B0E1B] shadow-2xl relative flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-start justify-between border-b border-gray-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0 shadow-lg">
                    <Sparkles className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-purple-300 bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20">
                      Dual-Hand Evolution Tier
                    </span>
                    <h3 className="text-xl font-bold text-white mt-1">
                      Unlock Side-by-Side Evolution Synthesis
                    </h3>
                  </div>
                </div>
                <button
                  onClick={() => setShowDualUnlockModal(false)}
                  className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-gray-800/60 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-[#070913]/90 border border-gray-800/80 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Both Palms Successfully Validated by Computer Vision</span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Your non-dominant (innate subconscious) and dominant (manifested lived reality) palms have both been measured with computer vision. Unlocking the Dual Evolution Report synthesizes:
                </p>
                <ul className="text-xs text-gray-400 space-y-1.5 mt-1 list-disc list-inside">
                  <li>Complete side-by-side growth index & divergence calculation</li>
                  <li>Innate vs. Manifested crease overlay breakdown</li>
                  <li>10 dedicated chiromancy consultation questions</li>
                  <li>Luxe 4-page High-Resolution PDF Folio</li>
                </ul>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <Link
                  href="/pricing?product=dual_hand_report"
                  className="btn-gold w-full py-3.5 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl hover:scale-[1.02] transition-transform text-center"
                >
                  <span>Unlock Dual-Hand Report ($6.99 / ₹549)</span>
                  <ArrowRight className="w-4 h-4 text-black" />
                </Link>

                <button
                  onClick={handleProceedWithSingleReport}
                  disabled={isComparing}
                  className="py-3 px-4 rounded-xl border border-gray-800 bg-[#070913]/80 hover:bg-[#070913] text-xs font-medium text-gray-300 hover:text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {isComparing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-[#C8AA6E]" />
                      <span>Generating Free Reading...</span>
                    </>
                  ) : (
                    <span>Proceed with Dominant Hand Free Reading Instead</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Real Photo Palm Framing & Quality Guide Modal */}
        <PalmFramingGuideModal
          isOpen={isGuideModalOpen}
          onClose={() => setIsGuideModalOpen(false)}
          dominantHand={dominantHand}
          targetHandLabel={
            scanType === 'dual'
              ? dualStep === 1
                ? `${nonDominantHandLabel} Palm`
                : `${dominantHandLabel} Palm`
              : `${dominantHandLabel} Palm`
          }
        />
      </div>
    </div>
  );
}
