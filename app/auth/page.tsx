'use client';

import { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { Eye, EyeOff, AlertCircle, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/lib/theme-provider';

/** Spline Viewer scene (.splinecode) */
const ROBOT_SCENE =
  'https://prod.spline.design/jvo0ld6GvAywAP1G/scene.splinecode';

const InteractiveRobotSpline = dynamic(
  () => import('@/components/ui/interactive-3d-robot').then((m) => m.InteractiveRobotSpline),
  { ssr: false, loading: () => <div className="absolute inset-0" aria-hidden /> },
);

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { isDark, toggle } = useTheme();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const err = searchParams.get('error');
    if (err) setError(err);
  }, [searchParams]);

  const handleGoogleSignIn = () => {
    setGoogleLoading(true);
    setError('');
    window.location.href = '/api/auth/google';
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else {
        router.push('/');
        router.refresh();
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else {
        router.push('/');
        router.refresh();
      }
    }

    setLoading(false);
  };

  return (
    <div className="auth-page min-h-screen relative overflow-hidden">
      {/* Full-page Spline background */}
      <div className="auth-robot-bg absolute inset-0 z-0 overflow-hidden">
        <InteractiveRobotSpline
          scene={ROBOT_SCENE}
          className="auth-robot-viewer"
        />
      </div>

      {/* Theme toggle */}
      <button
        type="button"
        onClick={toggle}
        className="auth-theme-toggle pointer-events-auto absolute top-5 right-5 z-30 w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDark ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <div className="relative z-20 min-h-screen flex pointer-events-none">
        {/* Left branding */}
        <div className="hidden lg:flex lg:w-[52%] flex-col justify-between p-10 xl:p-14 min-h-screen">
          <div className="auth-card pointer-events-auto w-fit px-5 py-4">
            <picture>
              <source srcSet="/logo.avif" type="image/avif" />
              <img
                src="/logo.png"
                alt="Veracity"
                width={160}
                height={54}
                className="auth-logo h-14 w-auto max-w-[280px] object-left object-contain"
                draggable={false}
              />
            </picture>
            <p className="auth-muted text-sm font-medium tracking-wide mt-2 pl-0.5">
              Growth Intelligence Platform
            </p>
          </div>

          <div className="auth-card p-8 max-w-md pointer-events-auto my-auto">
            <p className="label-mono mb-3">Why teams use it</p>
            <blockquote className="font-display text-xl font-bold leading-snug tracking-tight mb-6">
              Boardroom-quality growth intelligence in minutes — not weeks.
            </blockquote>
            <div className="grid grid-cols-3 gap-3">
              {[
                { stat: '6+', label: 'Domains' },
                { stat: '16+', label: 'Signals' },
                { stat: '<5m', label: 'To brief' },
              ].map(({ stat, label }) => (
                <div key={label} className="auth-stat px-3 py-3 text-center">
                  <div className="font-display font-extrabold text-accent text-lg">{stat}</div>
                  <div className="auth-stat-label text-[11px] font-medium mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right — sign-in */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-[400px] pointer-events-auto">
            <div className="lg:hidden mb-8 auth-card w-fit px-4 py-3">
              <picture>
                <source srcSet="/logo.avif" type="image/avif" />
                <img
                  src="/logo.png"
                  alt="Veracity"
                  width={140}
                  height={47}
                  className="auth-logo h-12 w-auto max-w-[220px] object-left object-contain"
                  draggable={false}
                />
              </picture>
            </div>

            <div className="auth-card p-7 sm:p-8">
              <h2 className="font-display text-xl font-extrabold tracking-tight mb-1">
                {mode === 'signin' ? 'Sign in' : 'Create account'}
              </h2>
              <p className="auth-muted text-sm mb-6">
                {mode === 'signin'
                  ? 'Access your intelligence workspace.'
                  : 'Set up access in under a minute.'}
              </p>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading || loading}
                className="auth-btn-secondary w-full flex items-center justify-center gap-3 px-4 py-2.5 text-sm font-semibold disabled:opacity-60 mb-4 min-h-11"
              >
                {googleLoading ? (
                  <span className="w-4 h-4 border-2 border-current/20 border-t-accent rounded-full animate-spin" />
                ) : (
                  <GoogleIcon />
                )}
                Continue with Google
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="auth-divider flex-1 h-px" />
                <span className="auth-divider-label text-[10px] font-semibold uppercase tracking-widest">or</span>
                <div className="auth-divider flex-1 h-px" />
              </div>

              <form onSubmit={handleEmailAuth} className="flex flex-col gap-3.5">
                <div>
                  <label className="label-mono auth-muted block mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="you@company.com"
                    className="auth-input w-full h-11 px-3.5 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="label-mono auth-muted block mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="••••••••"
                      className="auth-input w-full h-11 px-3.5 pr-11 text-sm outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="auth-eye absolute right-2 top-1/2 -translate-y-1/2 p-2"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-xl auth-stat text-sm">
                    <AlertCircle size={15} className="mt-0.5 shrink-0 text-accent" />
                    {error}
                  </div>
                )}
                {successMsg && (
                  <div className="p-3 rounded-xl auth-stat text-sm text-accent">
                    {successMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || googleLoading}
                  className="bg-gradient-signature w-full h-11 font-semibold text-sm text-white disabled:opacity-60 flex items-center justify-center gap-2 mt-1"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : mode === 'signin' ? 'Sign in' : 'Create account'}
                </button>
              </form>

              <p className="auth-muted text-center text-sm mt-5">
                {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
                <button
                  type="button"
                  onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setSuccessMsg(''); }}
                  className="text-accent font-semibold hover:underline focus-ring rounded"
                >
                  {mode === 'signin' ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="auth-suspense min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-current/30 border-t-accent rounded-full animate-spin text-slate-400 dark:text-slate-500" />
      </div>
    }>
      <AuthForm />
    </Suspense>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M47.532 24.5528C47.532 22.9214 47.3997 21.2811 47.1175 19.6761H24.48V28.9181H37.4434C36.9055 31.8988 35.177 34.5356 32.6461 36.2111V42.2078H40.3801C44.9217 38.0278 47.532 31.8547 47.532 24.5528Z" fill="#4285F4"/>
      <path d="M24.48 48.0016C30.9529 48.0016 36.4116 45.8764 40.3888 42.2078L32.6549 36.2111C30.5031 37.675 27.7252 38.5039 24.4888 38.5039C18.2275 38.5039 12.9187 34.2798 11.0139 28.6006H3.03296V34.7825C7.10718 42.8868 15.4056 48.0016 24.48 48.0016Z" fill="#34A853"/>
      <path d="M11.0051 28.6006C9.99973 25.6199 9.99973 22.3922 11.0051 19.4115V13.2296H3.03298C-0.371021 20.0112 -0.371021 28.0009 3.03298 34.7825L11.0051 28.6006Z" fill="#FBBC04"/>
      <path d="M24.48 9.49932C27.9016 9.44641 31.2086 10.7339 33.6866 13.0973L40.5387 6.24523C36.2 2.17101 30.4414 -0.068932 24.48 0.00161733C15.4055 0.00161733 7.10718 5.11644 3.03296 13.2296L11.005 19.4115C12.901 13.7235 18.2187 9.49932 24.48 9.49932Z" fill="#EA4335"/>
    </svg>
  );
}
