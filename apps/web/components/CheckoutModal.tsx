'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ShieldCheck,
  Check,
  Lock,
  X,
  CreditCard,
  QrCode,
  Globe,
  Loader2,
  ArrowRight,
  Zap,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
  createPayPalOrder,
  trackAnalyticsEvent,
} from '../lib/api';
import { saveUserEntitlement } from '../lib/storage';

export interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: 'premium_report' | 'dual_hand_report' | 'membership_monthly';
  onSuccess?: (product: string) => void;
  initialProvider?: 'razorpay' | 'paypal';
}

const PRODUCT_INFO = {
  premium_report: {
    title: 'Deep-Dive Reading Folio',
    subtitle: 'Calibrated Biometrics & Complete Life Insights',
    badge: 'Most Popular',
    priceInr: 399,
    priceUsd: 4.99,
    perks: [
      'High-Resolution 4K Archival PDF Folio (.pdf)',
      'Mount Topography & Hidden Minor Marks Analysis',
      'Life-Phase Age Transition Windows (Ages 28–34 & 45–52)',
      '5 In-Depth Consultation Questions (Money, Health, Career)',
      'One-time payment • Zero recurring subscription traps',
    ],
  },
  dual_hand_report: {
    title: 'Dual-Hand Evolution Report',
    subtitle: 'Innate Potential vs. Manifested Lived Reality',
    badge: 'Highest Depth',
    priceInr: 549,
    priceUsd: 6.99,
    perks: [
      'Comparative Synthesis of Dominant & Non-Dominant Palms',
      'Calibrated Growth & Alignment Index (0–100 Score)',
      '10 In-Depth Consultation Inquiries across Life Scopes',
      'Dual-Hand Archival Folio with Side-by-Side Contours',
      'One-time payment • Instant lifelong access',
    ],
  },
  membership_monthly: {
    title: 'Seeker Club Membership',
    subtitle: 'Quarterly Drift Tracking & Unlimited Guidance',
    badge: 'Continuous Growth',
    priceInr: 699,
    priceUsd: 7.99,
    perks: [
      'Unlimited Chiromancy Consultations (Money, Health, Career)',
      'Quarterly 90-Day Crease Drift & Habit Alignment Scans',
      'All PDF Presentation Themes (Midnight & Parchment)',
      'Priority LLM Synthesis with zero rate-limit queues',
      'Cancel anytime with a single click in Settings',
    ],
  },
};

export default function CheckoutModal({
  isOpen,
  onClose,
  product = 'premium_report',
  onSuccess,
  initialProvider = 'razorpay',
}: CheckoutModalProps) {
  const [selectedProduct, setSelectedProduct] = useState(product);
  const [provider, setProvider] = useState<'razorpay' | 'paypal'>(initialProvider);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setSelectedProduct(product);
  }, [product]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentInfo = PRODUCT_INFO[selectedProduct];

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

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);

    trackAnalyticsEvent('modal_checkout_initiated', {
      product: selectedProduct,
      provider,
    });

    try {
      if (provider === 'razorpay') {
        const order = await createRazorpayOrder({ product: selectedProduct });

        // Handle offline / development simulation mode
        if (order.order_id.startsWith('order_sim_')) {
          await verifyRazorpayPayment({
            razorpay_order_id: order.order_id,
            razorpay_payment_id: `pay_sim_${Date.now()}`,
            razorpay_signature: 'sim_signature',
            product: selectedProduct,
          });

          saveUserEntitlement(selectedProduct);
          setSuccess(true);
          trackAnalyticsEvent('checkout_completed', { product: selectedProduct, provider: 'razorpay_simulation' });
          setTimeout(() => {
            onSuccess?.(selectedProduct);
            onClose();
          }, 1200);
          return;
        }

        // Real live Razorpay checkout
        const isLoaded = await loadRazorpayScript();
        if (!isLoaded || !(window as any).Razorpay) {
          throw new Error('Razorpay payment gateway failed to load. Please try PayPal or retry.');
        }

        const rzp = new (window as any).Razorpay({
          key: order.key_id,
          amount: order.amount,
          currency: order.currency,
          name: 'Palmora AI',
          description: currentInfo.title,
          order_id: order.order_id,
          theme: { color: '#C8AA6E' },
          modal: {
            ondismiss: () => {
              setLoading(false);
            },
          },
          handler: async (response: any) => {
            try {
              await verifyRazorpayPayment({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                product: selectedProduct,
              });
              saveUserEntitlement(selectedProduct);
              setSuccess(true);
              trackAnalyticsEvent('checkout_completed', { product: selectedProduct, provider: 'razorpay' });
              setTimeout(() => {
                onSuccess?.(selectedProduct);
                onClose();
              }, 1200);
            } catch (err: any) {
              setError(err.message || 'Payment verification failed. Please contact support.');
            } finally {
              setLoading(false);
            }
          },
        });

        rzp.open();
      } else {
        // PayPal Flow
        const returnUrl = typeof window !== 'undefined'
          ? `${window.location.origin}/reading?payment_provider=paypal&product=${selectedProduct}`
          : 'http://localhost:3000/reading';

        const order = await createPayPalOrder({
          product: selectedProduct,
          return_url: returnUrl,
          cancel_url: typeof window !== 'undefined' ? window.location.href : 'http://localhost:3000/reading',
        });

        if (order.approve_url.includes('sim_paypal_token')) {
          saveUserEntitlement(selectedProduct);
          setSuccess(true);
          trackAnalyticsEvent('checkout_completed', { product: selectedProduct, provider: 'paypal_simulation' });
          setTimeout(() => {
            onSuccess?.(selectedProduct);
            onClose();
          }, 1200);
          return;
        }

        window.location.href = order.approve_url;
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setError(err.message || 'Unable to start checkout session. Please check connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="glass-card max-w-lg w-full p-6 sm:p-8 rounded-3xl border border-[#C8AA6E]/40 shadow-2xl relative flex flex-col gap-6 bg-[#0B0E1B] animate-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/5 transition-colors"
          aria-label="Close checkout modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 pr-8">
          <div className="w-12 h-12 rounded-2xl bg-[#C8AA6E]/20 border border-[#C8AA6E]/40 flex items-center justify-center text-[#C8AA6E] shrink-0 shadow-lg">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#C8AA6E] bg-[#C8AA6E]/15 px-2.5 py-0.5 rounded-full border border-[#C8AA6E]/30">
                {currentInfo.badge}
              </span>
              <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Zero Recurring Subscription Traps
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-extrabold text-white mt-1">
              {currentInfo.title}
            </h3>
          </div>
        </div>

        {/* Product Switcher Pills */}
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[#070913]/90 border border-gray-800">
          {(['premium_report', 'dual_hand_report', 'membership_monthly'] as const).map((key) => {
            const isSelected = selectedProduct === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedProduct(key)}
                className={`py-2 px-1 text-[11px] font-bold rounded-xl transition-all text-center truncate ${
                  isSelected
                    ? 'bg-[#C8AA6E] text-black shadow-md'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {key === 'premium_report'
                  ? 'Deep-Dive'
                  : key === 'dual_hand_report'
                  ? 'Dual-Hand'
                  : 'Seeker Club'}
              </button>
            );
          })}
        </div>

        {/* Price & Guarantee Display */}
        <div className="p-4 rounded-2xl bg-[#070913]/70 border border-[rgba(200,170,110,0.25)] flex items-center justify-between">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold font-mono text-white">
                {provider === 'razorpay' ? `₹${currentInfo.priceInr}` : `$${currentInfo.priceUsd}`}
              </span>
              <span className="text-xs text-gray-400">
                {selectedProduct === 'membership_monthly' ? '/ month' : 'one-time total'}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {selectedProduct === 'membership_monthly'
                ? 'Cancel anytime • No lock-in period'
                : 'Lifetime access • Yours forever'}
            </p>
          </div>

          {/* Payment Provider Toggle */}
          <div className="flex flex-col items-end gap-1.5">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Payment Via</span>
            <div className="inline-flex p-0.5 rounded-xl bg-black border border-gray-800 text-[11px]">
              <button
                type="button"
                onClick={() => setProvider('razorpay')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                  provider === 'razorpay'
                    ? 'bg-[#12162A] text-[#C8AA6E] border border-[#C8AA6E]/30'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                UPI / INR
              </button>
              <button
                type="button"
                onClick={() => setProvider('paypal')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                  provider === 'paypal'
                    ? 'bg-[#12162A] text-[#C8AA6E] border border-[#C8AA6E]/30'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Cards / USD
              </button>
            </div>
          </div>
        </div>

        {/* Perks Checklist */}
        <div className="flex flex-col gap-2.5">
          <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
            What You Unlock Instantly:
          </span>
          <div className="space-y-2">
            {currentInfo.perks.map((perk, i) => (
              <div key={i} className="flex items-start gap-2.5 text-xs text-gray-200">
                <CheckCircle2 className="w-4 h-4 text-[#C8AA6E] shrink-0 mt-0.5" />
                <span className="leading-relaxed">{perk}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Confirmation */}
        {success && (
          <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">Payment Verified! Unlocking your deep-dive reading...</span>
          </div>
        )}

        {/* Primary Checkout Action */}
        <div className="flex flex-col gap-2.5 pt-2 border-t border-gray-800">
          <button
            type="button"
            onClick={handleCheckout}
            disabled={loading || success}
            className="btn-gold w-full py-4 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-2xl disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99] transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-black" />
                <span>Opening Secure Checkout...</span>
              </>
            ) : success ? (
              <>
                <Check className="w-4 h-4 text-black" />
                <span>Unlocked Successfully!</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-black" />
                <span>
                  Unlock Now ({provider === 'razorpay' ? `₹${currentInfo.priceInr} via UPI` : `$${currentInfo.priceUsd} via PayPal/Card`})
                </span>
                <ArrowRight className="w-4 h-4 text-black" />
              </>
            )}
          </button>

          <p className="text-[11px] text-center text-gray-400">
            🔒 256-Bit SSL Encrypted • Instant In-Situ Unlock • Zero Biometric Storage Guarantee
          </p>
        </div>
      </div>
    </div>
  );
}
