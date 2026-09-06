'use client';

import { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { Eye, EyeOff, AlertCircle, ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { useForcedTheme } from '@/lib/theme-provider';
import { BrandWordmark } from '@/components/ui/BrandWordmark';

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
  // Art-directed against a dark backdrop, so it renders dark whatever the
  // user prefers. This does not persist — they land in their own theme.
  useForcedTheme('dark');

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [signupStep, setSignupStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const err = searchParams.get('error');
    if (err) setError(err);
  }, [searchParams]);

  const handleNextStep = () => {
    setError('');
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please ensure both password fields match.');
      return;
    }
    setSignupStep(2);
  };

  const [demoLoading, setDemoLoading] = useState(false);

  const handleDemoSignIn = async () => {
    setDemoLoading(true);
    setError('');
    setSuccessMsg('');
    setEmail('demo@veracity.ai');
    setPassword('DemoVeracity2026!');

    try {
      const res = await fetch('/api/auth/demo', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || data.error) {
        // Fallback directly via browser client
        let authRes = await supabase.auth.signInWithPassword({
          email: 'demo@veracity.ai',
          password: 'DemoVeracity2026!',
        });
        if (authRes.error) {
          await supabase.auth.signUp({
            email: 'demo@veracity.ai',
            password: 'DemoVeracity2026!',
          });
          authRes = await supabase.auth.signInWithPassword({
            email: 'demo@veracity.ai',
            password: 'DemoVeracity2026!',
          });
        }
        if (authRes.error) {
          setError(authRes.error.message);
          setDemoLoading(false);
          return;
        }
      }

      try {
        const { saveUserProfile } = await import('@/lib/user-profile');
        saveUserProfile({
          company: 'Veracity Enterprise Lab',
          role: 'VP of Market Intelligence & Growth',
          websiteUrl: 'https://veracity.ai',
          onboarded: true,
        });
      } catch {}

      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError(err?.message || 'Failed to sign in demo user.');
    } finally {
      setDemoLoading(false);
    }
  };

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
      if (!company.trim() || !role.trim()) {
        setError('Please enter your Company Name and Executive Role to complete signup.');
        setLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match. Please ensure both password fields match.');
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else {
        try {
          const { saveUserProfile } = await import('@/lib/user-profile');
          saveUserProfile({
            company: company.trim(),
            role: role.trim(),
            websiteUrl: websiteUrl.trim(),
            onboarded: true,
          });
        } catch { }
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

      <div className="relative z-20 min-h-screen flex pointer-events-none">
        {/* Left branding */}
        <div className="hidden lg:flex lg:w-[52%] flex-col justify-between p-10 xl:p-14 min-h-screen">
          <div className="auth-card pointer-events-auto w-fit px-5 py-4">
            <div className="flex items-center gap-3">
              <img
                src="/robot.avif"
                alt=""
                width={48}
                height={52}
                className="brand-mascot h-12 w-auto shrink-0"
                draggable={false}
              />
              <div className="min-w-0">
                <BrandWordmark size="md" />
                <p className="auth-muted text-sm font-medium tracking-wide mt-1.5">
                  Growth Intelligence Platform
                </p>
              </div>
            </div>
          </div>

          <div className="auth-card p-8 max-w-md pointer-events-auto my-auto">
            <p className="label-mono mb-3">Why teams use it</p>
            <blockquote className="font-display text-xl font-bold leading-snug tracking-tight mb-6">
              Boardroom-quality growth intelligence in minutes - not weeks.
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
        <div className="flex-1 flex items-center justify-center p-3 sm:p-8 max-h-screen overflow-y-auto">
          <div className="w-full max-w-[420px] pointer-events-auto my-auto max-h-[calc(100vh-1rem)] flex flex-col justify-center py-2">
            <div className="lg:hidden mb-2 sm:mb-3 shrink-0 auth-card w-fit px-3.5 py-2.5 sm:px-4 sm:py-3">
              <div className="flex items-center gap-2 sm:gap-2.5">
                <img
                  src="/robot.avif"
                  alt=""
                  width={40}
                  height={44}
                  className="brand-mascot h-8 sm:h-10 w-auto shrink-0"
                  draggable={false}
                />
                <div className="min-w-0">
                  <BrandWordmark size="sm" />
                  <p className="auth-muted text-[11px] sm:text-xs font-medium tracking-wide mt-0.5 sm:mt-1">
                    Growth Intelligence Platform
                  </p>
                </div>
              </div>
            </div>

            <div className="auth-card p-5 sm:p-7 w-full flex flex-col justify-between min-h-0 max-h-[calc(100vh-2rem)] overflow-y-auto pr-2 sm:pr-3">
              <div>
                <h2 className="font-display text-lg sm:text-xl font-extrabold tracking-tight mb-1">
                  {mode === 'signin' ? 'Sign in' : 'Create account'}
                </h2>
                <p className="auth-muted text-xs sm:text-sm mb-3 sm:mb-4">
                  {mode === 'signin'
                    ? 'Access your intelligence workspace.'
                    : signupStep === 1
                      ? 'Step 1: Set up your login credentials.'
                      : 'Step 2: Define your company profile.'}
                </p>
              </div>

              {mode === 'signup' && (
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 rounded-full transition-all ${signupStep === 1 ? 'w-8 bg-accent' : 'w-4 bg-accent/30'}`} />
                    <span className={`h-1.5 rounded-full transition-all ${signupStep === 2 ? 'w-8 bg-accent' : 'w-4 bg-accent/30'}`} />
                    <span className="text-[11px] font-mono text-muted-foreground ml-1">
                      {signupStep} / 2
                    </span>
                  </div>
                  {signupStep === 2 && (
                    <button
                      type="button"
                      onClick={() => setSignupStep(1)}
                      className="text-[11px] font-mono text-accent hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <ArrowLeft size={12} /> Back to Step 1
                    </button>
                  )}
                </div>
              )}

              {(mode === 'signin' || (mode === 'signup' && signupStep === 1)) && (
                <>
                  <button
                    type="button"
                    onClick={handleDemoSignIn}
                    disabled={demoLoading || loading || googleLoading}
                    className="w-full mb-3 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent/20 hover:bg-accent/30 border border-accent/45 text-accent font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer min-h-11 active:scale-[0.98]"
                  >
                    {demoLoading ? (
                      <span className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                    ) : (
                      <Sparkles size={16} className="text-accent shrink-0" />
                    )}
                    <span>Demo user</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={googleLoading || loading || demoLoading}
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
                    <span className="auth-divider-label text-[10px] font-semibold uppercase tracking-widest">or email</span>
                    <div className="auth-divider flex-1 h-px" />
                  </div>
                </>
              )}

              <form onSubmit={handleEmailAuth} className="flex flex-col gap-3.5">
                {mode === 'signup' && signupStep === 2 && (
                  <>
                    <div>
                      <label className="label-mono auth-muted block mb-1.5">Company / Product Name <span className="text-accent">*</span></label>
                      <input
                        type="text"
                        value={company}
                        onChange={e => setCompany(e.target.value)}
                        required
                        placeholder="e.g. Vector Agents"
                        className="auth-input w-full h-11 px-3.5 text-sm outline-none"
                      />
                    </div>

                    <div>
                      <label className="label-mono auth-muted block mb-1.5">Executive Role / Title <span className="text-accent">*</span></label>
                      <input
                        type="text"
                        value={role}
                        onChange={e => setRole(e.target.value)}
                        required
                        placeholder="e.g. VP of Product, CEO"
                        className="auth-input w-full h-11 px-3.5 text-sm outline-none"
                      />
                    </div>

                    <div>
                      <label className="label-mono auth-muted block mb-1.5">Website URL (Optional)</label>
                      <input
                        type="url"
                        value={websiteUrl}
                        onChange={e => setWebsiteUrl(e.target.value)}
                        placeholder="https://vectoragents.ai"
                        className="auth-input w-full h-11 px-3.5 text-sm outline-none"
                      />
                    </div>
                  </>
                )}

                {(mode === 'signin' || (mode === 'signup' && signupStep === 1)) && (
                  <>
                    <div>
                      <label className="label-mono auth-muted block mb-1.5">Email <span className="text-accent">*</span></label>
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
                      <label className="label-mono auth-muted block mb-1.5">Password <span className="text-accent">*</span></label>
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
                  </>
                )}

                {mode === 'signup' && signupStep === 1 && (
                  <div>
                    <label className="label-mono auth-muted block mb-1.5">
                      Confirm Password <span className="text-accent">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                        placeholder="••••••••"
                        className={`auth-input w-full h-11 px-3.5 pr-11 text-sm outline-none ${confirmPassword && password !== confirmPassword ? 'border-red-500/80 focus:border-red-500' : ''
                          }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(v => !v)}
                        className="auth-eye absolute right-2 top-1/2 -translate-y-1/2 p-2"
                        aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      >
                        {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {confirmPassword && password !== confirmPassword && (
                      <span className="text-[11px] font-medium text-red-400 mt-1 block">
                        ✕ Passwords do not match
                      </span>
                    )}
                  </div>
                )}

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

                {mode === 'signup' && signupStep === 1 ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="bg-gradient-signature w-full h-11 font-semibold text-sm text-white flex items-center justify-center gap-2 mt-1 cursor-pointer hover:opacity-95 transition-opacity"
                  >
                    <span>Next: Company Profile</span>
                    <ArrowRight size={15} />
                  </button>
                ) : (
                  <div className="flex items-center gap-2 mt-1">
                    {mode === 'signup' && signupStep === 2 && (
                      <button
                        type="button"
                        onClick={() => setSignupStep(1)}
                        className="auth-btn-secondary px-4 h-11 text-sm font-semibold cursor-pointer flex items-center gap-1.5"
                      >
                        <ArrowLeft size={14} />
                        <span>Back</span>
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={loading || googleLoading}
                      className="bg-gradient-signature flex-1 h-11 font-semibold text-sm text-white disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {loading ? (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : mode === 'signin' ? 'Sign in' : 'Create account'}
                    </button>
                  </div>
                )}
              </form>

              <p className="auth-muted text-center text-sm mt-5">
                {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === 'signin' ? 'signup' : 'signin');
                    setSignupStep(1);
                    setError('');
                    setSuccessMsg('');
                  }}
                  className="text-accent font-semibold hover:underline focus-ring rounded cursor-pointer"
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
      <path d="M47.532 24.5528C47.532 22.9214 47.3997 21.2811 47.1175 19.6761H24.48V28.9181H37.4434C36.9055 31.8988 35.177 34.5356 32.6461 36.2111V42.2078H40.3801C44.9217 38.0278 47.532 31.8547 47.532 24.5528Z" fill="#4285F4" />
      <path d="M24.48 48.0016C30.9529 48.0016 36.4116 45.8764 40.3888 42.2078L32.6549 36.2111C30.5031 37.675 27.7252 38.5039 24.4888 38.5039C18.2275 38.5039 12.9187 34.2798 11.0139 28.6006H3.03296V34.7825C7.10718 42.8868 15.4056 48.0016 24.48 48.0016Z" fill="#34A853" />
      <path d="M11.0051 28.6006C9.99973 25.6199 9.99973 22.3922 11.0051 19.4115V13.2296H3.03298C-0.371021 20.0112 -0.371021 28.0009 3.03298 34.7825L11.0051 28.6006Z" fill="#FBBC04" />
      <path d="M24.48 9.49932C27.9016 9.44641 31.2086 10.7339 33.6866 13.0973L40.5387 6.24523C36.2 2.17101 30.4414 -0.068932 24.48 0.00161733C15.4055 0.00161733 7.10718 5.11644 3.03296 13.2296L11.005 19.4115C12.901 13.7235 18.2187 9.49932 24.48 9.49932Z" fill="#EA4335" />
    </svg>
  );
}
