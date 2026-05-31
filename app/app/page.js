'use client';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      if (session.user.onboarded) {
        router.push('/dashboard');
      } else {
        router.push('/onboarding');
      }
    }
  }, [status, session, router]);

  return (
    <main className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Background texture */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #0D0D0D 1px, transparent 0)', backgroundSize: '24px 24px' }} />

      {/* Decorative blobs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-sage/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -right-32 w-80 h-80 bg-amber/10 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-md w-full text-center animate-fade-up">
        {/* Logo mark */}
        <div className="inline-flex items-center justify-center w-16 h-16 bg-ink rounded-2xl mb-8 shadow-lg">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M4 8h20M4 14h14M4 20h8" stroke="#F9F7F2" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="22" cy="20" r="4" fill="#7C9E87"/>
          </svg>
        </div>

        <h1 className="font-display text-5xl text-ink mb-3 leading-tight">
          Job Agent
        </h1>
        <p className="text-ink-400 text-lg mb-2 font-body">
          Your automated job search pipeline.
        </p>
        <p className="text-ink-300 text-sm mb-10 font-body">
          Sourcing → Scoring → Applying, while you sleep.
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-2 justify-center mb-10">
          {['Claude AI Scoring', 'Auto Email Apply', 'Manual Apply Queue', 'Custom Job Matching'].map(f => (
            <span key={f} className="text-xs bg-white border border-ink-100 text-ink-400 px-3 py-1.5 rounded-full font-body">
              {f}
            </span>
          ))}
        </div>

        <button
          onClick={() => signIn('google')}
          className="w-full flex items-center justify-center gap-3 bg-white border border-ink-200 text-ink px-6 py-4 rounded-2xl font-body font-medium text-sm shadow-sm hover:shadow-md hover:border-ink-300 transition-all duration-200 active:scale-[0.99]"
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
            <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.826.957 4.039l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <p className="text-xs text-ink-300 mt-6 font-body">
          By signing in you agree to let Job Agent search and apply on your behalf.
        </p>
      </div>
    </main>
  );
}
