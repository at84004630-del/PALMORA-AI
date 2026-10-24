'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Sparkles,
  Check,
  ShieldCheck,
  CreditCard,
  AlertCircle,
  Clock,
  Compass,
  RotateCcw,
  CheckCircle2,
  Lock,
  RefreshCw,
  QrCode,
  Globe,
  Wallet,
  Zap,
  Eye,
  X,
  Layers,
  TrendingUp,
  Heart,
  Briefcase,
} from 'lucide-react';
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
  createPayPalOrder,
  trackAnalyticsEvent,
} from '../../lib/api';

function PricingContent() {
  const searchParams = useSearchParams();
  const [paymentProvider, setPaymentProvider] = useState<'razorpay' | 'paypal'>('razorpay');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [purchasingProduct, setPurchasingProduct] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);
  const [previewingPlan, setPreviewingPlan] = useState<'premium_report' | 'dual_hand_report' | null>(null);

  // A/B Experiment variant support
  const experimentVariant = searchParams.get('variant') || searchParams.get('experiment') || 'trust_first_v1';

  // Approved Trust-First Pricing Model
  const PRICES = {
    razorpay: {
      currencySymbol: '₹',
      free: 0,
      deepDiveReport: 399,
      dualHandReport: 549,
      membershipMonthly: 699,
      membershipAnnualMonthlyEquivalent: 524,
    },
    paypal: {
      currencySymbol: '$',
      free: 0,
      deepDiveReport: 4.99,
      dualHandReport: 6.99,
      membershipMonthly: 7.99,
      membershipAnnualMonthlyEquivalent: 5.99,
    },
  };

  const currentPrices = PRICES[paymentProvider];

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') return resolve(false);
      if ((window as any).Razorpay) return resolve(true);

      const existingScript = document.getElementById('razorpay-checkout-js');
      if (existingScript) return resolve(true);

      const script = document.createElement('script');
      script.id = 'razorpay-checkout-js';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePurchase = async (
    product: 'premium_report' | 'dual_hand_report' | 'membership_monthly',
    productName: string
  ) => {
    setPurchasingProduct(product);
    setPurchaseError(null);
    setPurchaseSuccess(null);

    trackAnalyticsEvent('checkout_initiated', {
      product,
      provider: paymentProvider,
      billing_cycle: billingCycle,
    });

    try {
      if (paymentProvider === 'razorpay') {
        // --- RAZORPAY / UPI / CARDS (INR) ---
        const order = await createRazorpayOrder({ product });

        // Offline / Simulation handler
        if (order.order_id.startsWith('order_sim_')) {
          setPurchaseSuccess('Test simulated purchase successful! Unlocking your report...');
          await verifyRazorpayPayment({
            razorpay_order_id: order.order_id,
            razorpay_payment_id: `pay_sim_${Date.now()}`,
            razorpay_signature: 'sim_signature',
            product,
          });
          setTimeout(() => {
            window.location.href = `/reading?payment_id=${order.order_id}&product=${product}`;
          }, 1000);
          return;
        }

        const scriptLoaded = await loadRazorpayScript();
        if (!scriptLoaded) {
          throw new Error('Unable to connect to Razorpay payment network. Please check your connection.');
        }

        const options = {
          key: order.key_id,
          amount: order.amount,
          currency: order.currency,
          name: 'Palmora AI',
          description: productName,
          order_id: order.order_id,
          handler: async function (response: any) {
            try {
              await verifyRazorpayPayment({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                product,
              });
              trackAnalyticsEvent('payment_success', {
                provider: 'razorpay',
                product,
                payment_id: response.razorpay_payment_id,
              });
              window.location.href = `/reading?payment_id=${response.razorpay_payment_id}&product=${product}`;
            } catch (verErr: any) {
              setPurchaseError(verErr.message || 'Signature verification failed. Please contact support.');
            }
          },
          theme: {
            color: '#C8AA6E',
            backdrop_color: 'rgba(7, 9, 19, 0.88)',
          },
          modal: {
            ondismiss: function () {
              setPurchasingProduct(null);
            },
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', function (resp: any) {
          setPurchaseError(resp.error?.description || 'Payment was declined or failed.');
          setPurchasingProduct(null);
        });
        rzp.open();
      } else {
        // --- PAYPAL / GLOBAL CARDS (USD) ---
        const returnUrl = `${window.location.origin}/reading?payment_provider=paypal&product=${product}&token={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${window.location.origin}/pricing`;

        const data = await createPayPalOrder({
          product,
          return_url: returnUrl,
          cancel_url: cancelUrl,
        });

        if (data.approve_url) {
          window.location.href = data.approve_url;
        } else {
          throw new Error('No approval redirect received from PayPal.');
        }
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setPurchaseError(err.message || 'Unable to initiate checkout. Please try again.');
      setPurchasingProduct(null);
    }
  };

  useEffect(() => {
    trackAnalyticsEvent('pricing_viewed', {
      experiment_variant: experimentVariant,
      billing_cycle: billingCycle,
      provider: paymentProvider,
    });
  }, [experimentVariant, billingCycle, paymentProvider]);

  const plans = [
    {
      name: 'Free Discovery',
      badge: 'Zero Commitment',
      price: `${currentPrices.currencySymbol}0`,
      period: 'forever',
      description: 'Experience real computer vision palm line extraction with instant visual validation.',
      features: [
        '1 complimentary complete palm reading',
        'Real-time image quality validation',
        'Interactive SVG crease trajectory overlay',
        'Core Heart, Head & Life line analysis',
        '1 targeted AI consultation follow-up',
        'Zero photo storage / 100% ephemeral privacy',
      ],
      ctaText: 'Start Free Scan',
      ctaHref: '/scan',
      product: null,
      highlighted: false,
    },
    {
      name: 'Deep-Dive Report',
      badge: 'Most Popular',
      price: `${currentPrices.currencySymbol}${currentPrices.deepDiveReport}`,
      period: 'one-time',
      description: 'Comprehensive single-hand report with deep biometric curvature metrics and PDF export.',
      features: [
        'Complete line-by-line biometric depth report',
        'Calibrated curvature & continuity metrics',
        'Archetypal hand shape & elemental profile',
        'Full high-resolution PDF download',
        '5 targeted AI consultation follow-up queries',
        'Permanent local/encrypted account storage',
      ],
      ctaText: `Unlock Deep-Dive (${currentPrices.currencySymbol}${currentPrices.deepDiveReport})`,
      ctaHref: '#',
      product: 'premium_report' as const,
      highlighted: true,
    },
    {
      name: 'Dual-Hand Evolution',
      badge: 'Best Value',
      price: `${currentPrices.currencySymbol}${currentPrices.dualHandReport}`,
      period: 'one-time',
      description: 'Comparative dual-hand analysis contrasting inborn potential against lived reality.',
      features: [
        'Dominant vs. Non-dominant hand comparison',
        'Innate temperament vs manifested reality',
        'Dual-hand destiny divergence synthesis',
        'High-resolution side-by-side PDF export',
        '10 targeted AI consultation queries',
        'Full priority computer vision extraction',
      ],
      ctaText: `Unlock Dual-Hand (${currentPrices.currencySymbol}${currentPrices.dualHandReport})`,
      ctaHref: '#',
      product: 'dual_hand_report' as const,
      highlighted: false,
    },
    {
      name: 'Seeker Club',
      badge: 'Continuous Growth',
      price:
        billingCycle === 'monthly'
          ? `${currentPrices.currencySymbol}${currentPrices.membershipMonthly}`
          : `${currentPrices.currencySymbol}${currentPrices.membershipAnnualMonthlyEquivalent}`,
      period: billingCycle === 'monthly' ? 'per month' : 'per mo (billed annually)',
      description: 'Ongoing temporal crease tracking to monitor how your palm lines adapt over time.',
      features: [
        'Unlimited scans & readings across all devices',
        'Temporal crease change timeline tracking',
        'Seasonal palm evolution forecasts',
        'Priority GPU serverless processing queue',
        'Unlimited AI palm consultation queries',
        'VIP access to new cultural reading models',
      ],
      ctaText:
        billingCycle === 'monthly'
          ? `Join Seeker Club (${currentPrices.currencySymbol}${currentPrices.membershipMonthly}/mo)`
          : `Join Seeker Club (${currentPrices.currencySymbol}${currentPrices.membershipAnnualMonthlyEquivalent}/mo)`,
      ctaHref: '#',
      product: 'membership_monthly' as const,
      highlighted: false,
    },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col items-center">
      {/* Header */}
      <div className="text-center max-w-3xl mb-10">
        <span className="text-xs font-bold uppercase tracking-widest text-[#C8AA6E] flex items-center justify-center gap-1.5 mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Trust-First Freemium & Micro-Transactions</span>
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
          Transparent, Honest Pricing
        </h1>
        <p className="text-gray-300 text-sm sm:text-base mt-3 leading-relaxed">
          Verify genuine OpenCV computer vision accuracy with your free reading. Upgrade only when you want deeper biometric synthesis, dual-hand evolution tracking, or temporal archives.
        </p>

        {/* Payment Medium Selector (Razorpay / UPI vs PayPal) */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Choose Payment Method & Currency:
          </span>
          <div className="inline-flex p-1.5 rounded-2xl border border-gray-800 bg-[#0B0E1B] shadow-inner gap-2 max-w-md w-full sm:w-auto">
            <button
              onClick={() => setPaymentProvider('razorpay')}
              className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                paymentProvider === 'razorpay'
                  ? 'bg-[#C8AA6E] text-black shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-gray-900/60'
              }`}
            >
              <QrCode className="w-4 h-4 shrink-0" />
              <span>UPI & Cards (₹ INR)</span>
            </button>
            <button
              onClick={() => setPaymentProvider('paypal')}
              className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                paymentProvider === 'paypal'
                  ? 'bg-[#C8AA6E] text-black shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-gray-900/60'
              }`}
            >
              <Globe className="w-4 h-4 shrink-0" />
              <span>PayPal & Global ($ USD)</span>
            </button>
          </div>
          <p className="text-[11px] text-gray-400 flex items-center gap-1.5 mt-1">
            {paymentProvider === 'razorpay' ? (
              <>
                <Zap className="w-3.5 h-3.5 text-[#C8AA6E]" />
                <span>Instant UPI (Google Pay, PhonePe, Paytm, BHIM), Indian NetBanking & Debit/Credit Cards</span>
              </>
            ) : (
              <>
                <Wallet className="w-3.5 h-3.5 text-[#C8AA6E]" />
                <span>PayPal Account Balance & All Major International Credit/Debit Cards</span>
              </>
            )}
          </p>
        </div>

        {/* Monthly vs Annual Toggle */}
        <div className="mt-6 inline-flex items-center gap-2 p-1 rounded-full border border-gray-800 bg-[#0B0E1B]">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-5 py-2 rounded-full text-xs font-semibold transition-all ${
              billingCycle === 'monthly'
                ? 'bg-[#C8AA6E] text-black shadow-md font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Monthly Billing
          </button>
          <button
            onClick={() => setBillingCycle('annual')}
            className={`px-5 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
              billingCycle === 'annual'
                ? 'bg-[#C8AA6E] text-black shadow-md font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <span>Annual (Save 25%)</span>
          </button>
        </div>
      </div>

      {/* Success Notice */}
      {purchaseSuccess && (
        <div className="w-full max-w-3xl mb-8 p-4.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs sm:text-sm flex items-start gap-3 shadow-lg">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-white">Payment Approved</span>
            <span>{purchaseSuccess}</span>
          </div>
        </div>
      )}

      {/* Purchase Notice / Error */}
      {purchaseError && (
        <div className="w-full max-w-3xl mb-8 p-4.5 rounded-2xl bg-amber-950/40 border border-amber-600/40 text-amber-200 text-xs sm:text-sm flex items-start gap-3 shadow-lg">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-white">Payment Notice</span>
            <span>{purchaseError}</span>
          </div>
        </div>
      )}

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
        {plans.map((plan, idx) => (
          <div
            key={idx}
            className={`glass-card p-6 sm:p-7 rounded-3xl flex flex-col justify-between relative transition-all duration-300 hover:border-[#C8AA6E]/60 ${
              plan.highlighted
                ? 'border-[#C8AA6E] bg-gradient-to-b from-[#161B2E] to-[#0A0D18] shadow-[0_0_35px_rgba(200,170,110,0.18)]'
                : 'border-gray-800 bg-[#0B0E1B]'
            }`}
          >
            {plan.highlighted && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#C8AA6E] to-[#E6C687] text-[#070913] text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full shadow-lg">
                {plan.badge}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white">{plan.name}</h3>
                {!plan.highlighted && (
                  <span className="text-[10px] font-semibold text-gray-400 bg-gray-900 px-2 py-0.5 rounded-md border border-gray-800">
                    {plan.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-2 min-h-[44px] leading-relaxed">{plan.description}</p>

              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">{plan.price}</span>
                <span className="text-[11px] text-gray-400">/{plan.period}</span>
              </div>

              <div className="mt-6 border-t border-gray-800/80 pt-5 flex flex-col gap-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#C8AA6E]">
                  What's Included
                </span>
                {plan.features.map((feat, fIdx) => (
                  <div key={fIdx} className="flex items-start gap-2 text-xs text-gray-300">
                    <Check className="w-3.5 h-3.5 text-[#C8AA6E] shrink-0 mt-0.5" />
                    <span className="leading-tight">{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-5 border-t border-gray-800/80">
              {plan.product ? (
                <button
                  onClick={() => handlePurchase(plan.product, plan.name)}
                  disabled={purchasingProduct === plan.product}
                  className={`w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-center flex items-center justify-center gap-2 transition-all ${
                    plan.highlighted ? 'btn-gold shadow-lg' : 'bg-gray-800 hover:bg-gray-700 text-white'
                  } disabled:opacity-50`}
                >
                  {purchasingProduct === plan.product ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Opening Checkout...</span>
                    </>
                  ) : (
                    <>
                      {paymentProvider === 'razorpay' ? (
                        <QrCode className="w-3.5 h-3.5" />
                      ) : (
                        <CreditCard className="w-3.5 h-3.5" />
                      )}
                      <span>{plan.ctaText}</span>
                    </>
                  )}
                </button>
              ) : (
                <Link
                  href={plan.ctaHref}
                  className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-center block transition-all bg-gray-800 hover:bg-gray-700 text-white"
                >
                  {plan.ctaText}
                </Link>
              )}

              {plan.product && (plan.product === 'premium_report' || plan.product === 'dual_hand_report') && (
                <button
                  type="button"
                  onClick={() => setPreviewingPlan(plan.product as any)}
                  className="w-full mt-2.5 py-1.5 text-[11px] font-semibold text-[#C8AA6E] hover:text-[#f3dfb5] flex items-center justify-center gap-1.5 transition-colors group"
                >
                  <Eye className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                  <span>Preview Sample Dossier ↗</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Transparent Billing Standards */}
      <div className="w-full max-w-4xl mt-16 p-8 rounded-3xl bg-[#090D1C] border border-gray-800 grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs text-gray-300">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <RotateCcw className="w-4 h-4 text-[#C8AA6E]" />
            <span>14-Day Refund Guarantee</span>
          </div>
          <p className="leading-relaxed text-gray-400">
            If any purchased report fails to deliver insightful reflections, request a full refund within 14 days with no justification required.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>1-Click Easy Cancellation</span>
          </div>
          <p className="leading-relaxed text-gray-400">
            Cancel memberships at any time directly from your dashboard settings. No dark patterns, hidden fees, or retention quizzes.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Lock className="w-4 h-4 text-[#C8AA6E]" />
            <span>Ephemeral Privacy By Default</span>
          </div>
          <p className="leading-relaxed text-gray-400">
            Biometric photographs are analyzed strictly in memory and immediately discarded. Only anonymized geometric curvature vectors are retained if you choose to save.
          </p>
        </div>
      </div>

      {/* Satisfaction & Safety Guarantee */}
      <div className="mt-12 text-center max-w-xl text-xs text-gray-400 flex flex-col items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-emerald-400" />
        <p>
          All readings are backed by transparent computer vision metadata. Supported across UPI (GPay/PhonePe/Paytm), RuPay, NetBanking, Visa, MasterCard, and PayPal worldwide.
        </p>
      </div>

      {/* SAMPLE REPORT PREVIEW MODAL */}
      {previewingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto glass-card p-6 sm:p-8 rounded-3xl border border-[rgba(200,170,110,0.4)] bg-[#070913] shadow-2xl flex flex-col gap-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-gray-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#C8AA6E]/15 border border-[#C8AA6E]/30 flex items-center justify-center text-[#C8AA6E] shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#C8AA6E]">
                    Authentic Sample Dossier
                  </span>
                  <h3 className="text-xl font-bold text-white">
                    {previewingPlan === 'premium_report'
                      ? 'Sample Deep-Dive Palm Analysis'
                      : 'Sample Dual-Hand Evolution Synthesis'}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setPreviewingPlan(null)}
                className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            {previewingPlan === 'premium_report' ? (
              <div className="flex flex-col gap-4 text-xs">
                {/* Elemental Archetype Sample Badge */}
                <div className="p-4 rounded-2xl bg-[#0B0E1B] border border-sky-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Classified Archetype</span>
                    <h4 className="text-base font-bold text-white mt-0.5">Air Philosopher Hand</h4>
                    <p className="text-[11px] text-gray-400">Long square palm with delicate, highly segmented minor crease webs.</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-extrabold text-sky-300">0.28</span>
                    <span className="block text-[10px] text-gray-500">Chord-Arc Deflection</span>
                  </div>
                </div>

                {/* Biometric Curvature Highlights */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="p-3 rounded-xl bg-[#090D1C] border border-gray-800 flex flex-col gap-1">
                    <span className="text-[10px] text-gray-400 font-semibold">Heart Line Deflection</span>
                    <span className="text-sm font-bold text-[#F43F5E]">0.28 (Deep Arc)</span>
                    <span className="text-[10px] text-gray-500">Receptive empathy into resilient commitment</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#090D1C] border border-gray-800 flex flex-col gap-1">
                    <span className="text-[10px] text-gray-400 font-semibold">Head Line Deflection</span>
                    <span className="text-sm font-bold text-[#38BDF8]">0.12 (Linear Trajectory)</span>
                    <span className="text-[10px] text-gray-500">Methodical logic & pragmatic strategy</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#090D1C] border border-gray-800 flex flex-col gap-1">
                    <span className="text-[10px] text-gray-400 font-semibold">Life Line Continuity</span>
                    <span className="text-sm font-bold text-[#34D399]">96% Unbroken</span>
                    <span className="text-[10px] text-gray-500">Sustained vitality pacing & stamina</span>
                  </div>
                </div>

                {/* Report Excerpt */}
                <div className="p-4 rounded-2xl bg-[#0B0E1B] border border-gray-800 flex flex-col gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#C8AA6E]">Traditional Lore Synthesis Excerpt</span>
                  <p className="text-gray-300 leading-relaxed italic">
                    &ldquo;Your Heart line demonstrates marked curvature terminating between the mounts of Jupiter and Saturn, indicating a rare equilibrium between high romantic idealism and pragmatic emotional discretion. Observed depth reflects emotional resilience developed through deliberate boundaries.&rdquo;
                  </p>
                </div>

                {/* Entitlement Checklist */}
                <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-emerald-300 flex items-center justify-between">
                  <span>✓ Includes 5 Interactive AI Inquiries & 300 DPI Archival PDF Folio</span>
                  <span className="text-[11px] font-bold text-white">One-Time Fee</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4 text-xs">
                {/* Growth Index Sample Badge */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 to-[#0B0E1B] border border-purple-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">Evolution Alignment</span>
                    <h4 className="text-base font-bold text-white mt-0.5">88.4% Manifestation Congruence</h4>
                    <p className="text-[11px] text-gray-400">Balanced Congruence: Inherited blueprint translated steadily into conscious career trajectory.</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-extrabold text-purple-300">10 Inquiries</span>
                    <span className="block text-[10px] text-gray-500">Consultation Quota</span>
                  </div>
                </div>

                {/* Innate vs Manifested Excerpt */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-[#0B0E1B] border border-gray-800 flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Left Palm (Innate Blueprint)</span>
                    <p className="text-gray-300 text-[11px] leading-relaxed">
                      Intuitive receptivity, early caution in vocational assertion, strong natural musical or poetic appreciation.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#0B0E1B] border border-gray-800 flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#C8AA6E]">Right Palm (Manifested Path)</span>
                    <p className="text-gray-300 text-[11px] leading-relaxed">
                      Distinctly reinforced secondary crease depth, decisive executive responsibility, deepened perseverance under pressure.
                    </p>
                  </div>
                </div>

                {/* Divergence Evaluation */}
                <div className="p-4 rounded-2xl bg-[#090D1C] border border-gray-800 flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#C8AA6E]">Evolutionary Divergence</span>
                  <p className="text-gray-300 leading-relaxed italic">
                    &ldquo;The divergence between your radial margin arcs reveals an individual who has actively outgrown early familial conditioning, developing sovereign authority in vocational choices.&rdquo;
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/20 text-purple-300 flex items-center justify-between">
                  <span>✓ Includes Dual-Hand Synthesis, 10 Consultations & Side-by-Side PDF</span>
                  <span className="text-[11px] font-bold text-white">One-Time Fee</span>
                </div>
              </div>
            )}

            {/* Modal Footer CTA */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-800">
              <span className="text-xs text-gray-400">
                14-day refund guarantee included
              </span>
              <button
                onClick={() => {
                  const prod = previewingPlan;
                  const name = prod === 'premium_report' ? 'Deep-Dive Report' : 'Dual-Hand Evolution';
                  setPreviewingPlan(null);
                  handlePurchase(prod, name);
                }}
                className="btn-gold px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {previewingPlan === 'premium_report'
                    ? `Unlock My Deep-Dive (${currentPrices.currencySymbol}${currentPrices.deepDiveReport})`
                    : `Unlock My Dual-Hand (${currentPrices.currencySymbol}${currentPrices.dualHandReport})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center text-xs text-gray-400">
          Loading pricing options...
        </div>
      }
    >
      <PricingContent />
    </Suspense>
  );
}
