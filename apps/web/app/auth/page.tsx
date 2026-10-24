'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Hand,
  Sparkles,
  Lock,
  Mail,
  User,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { createBrowserClient } from '../../lib/supabase';

export default function AuthPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'signin' | 'signup' | 'recovery'>('signin');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    const supabase = createBrowserClient();
    if (!supabase) {
      setErrorMessage('Authentication service is currently unconfigured in this environment.');
      setLoading(false);
      return;
    }

    try {
      if (tab === 'signin') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setSuccessMessage('Signed in successfully! Redirecting...');
        setTimeout(() => router.push('/dashboard'), 1000);
      } else if (tab === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName || 'Seeker',
            },
          },
        });
        if (error) throw error;
        setSuccessMessage('Account created! Welcome to Palmora AI.');
        setTimeout(() => router.push('/dashboard'), 1000);
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth` : undefined,
        });
        if (error) throw error;
        setSuccessMessage(`If an account exists for ${email}, a password recovery link has been dispatched.`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 py-16 flex flex-col items-center">
      {/* Brand Icon */}
      <Link href="/" className="flex items-center gap-2.5 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1E243A] to-[#0D1122] border border-[rgba(200,170,110,0.3)] flex items-center justify-center">
          <Hand className="w-5 h-5 text-[#C8AA6E]" />
        </div>
        <span className="text-xl font-bold tracking-tight text-white">
          Palmora <span className="text-xs uppercase text-[#C8AA6E] font-semibold">AI</span>
        </span>
      </Link>

      <div className="w-full glass-card p-8 rounded-3xl border border-[rgba(200,170,110,0.25)] shadow-2xl flex flex-col gap-6">
        {/* Tabs: Sign In / Sign Up */}
        <div className="grid grid-cols-2 p-1 rounded-xl bg-[#070913] border border-gray-800 text-xs font-semibold">
          <button
            onClick={() => {
              setTab('signin');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`py-2 rounded-lg transition-all ${
              tab === 'signin' ? 'bg-[#C8AA6E] text-black shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setTab('signup');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`py-2 rounded-lg transition-all ${
              tab === 'signup' ? 'bg-[#C8AA6E] text-black shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Notices */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {tab === 'signup' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-300">Display Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your preferred name"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#070913]/80 border border-gray-800 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#C8AA6E]"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-300">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#070913]/80 border border-gray-800 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#C8AA6E]"
              />
            </div>
          </div>

          {tab !== 'recovery' && (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-medium text-gray-300">Password</label>
                {tab === 'signin' && (
                  <button
                    type="button"
                    onClick={() => setTab('recovery')}
                    className="text-[11px] text-[#C8AA6E] hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#070913]/80 border border-gray-800 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#C8AA6E]"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-gold w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg mt-2 disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : tab === 'signin' ? (
              <span>Sign In to Archive</span>
            ) : tab === 'signup' ? (
              <span>Create Account</span>
            ) : (
              <span>Send Recovery Link</span>
            )}
          </button>
        </form>

        {tab === 'recovery' && (
          <button
            onClick={() => setTab('signin')}
            className="text-xs text-gray-400 hover:text-white text-center"
          >
            ← Back to Sign In
          </button>
        )}

        {/* Anonymous trial callout */}
        <div className="pt-4 border-t border-gray-800/80 text-center">
          <p className="text-xs text-gray-400">
            Want to test before signing up?{' '}
            <Link href="/scan" className="text-[#C8AA6E] font-medium hover:underline">
              Try a guest reading free →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
