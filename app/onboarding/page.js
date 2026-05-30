'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  User, Briefcase, MapPin, DollarSign, Sliders,
  Upload, ArrowRight, ArrowLeft, Check, AlertTriangle
} from 'lucide-react';

const STEPS = [
  { id: 'profile',   label: 'Profile',   icon: User },
  { id: 'resume',    label: 'Resume',    icon: Upload },
  { id: 'search',    label: 'Search',    icon: Briefcase },
  { id: 'platforms', label: 'Platforms', icon: AlertTriangle },
];

const PLATFORM_ACCOUNTS = [
  {
    id: 'linkedin',
    name: 'LinkedIn',
    url: 'https://www.linkedin.com/signup',
    color: '#0A66C2',
    reason: 'LinkedIn requires you to apply through their platform with your own account. Job Agent will surface these jobs in your queue with a direct link.',
  },
  {
    id: 'indeed',
    name: 'Indeed',
    url: 'https://secure.indeed.com/account/register',
    color: '#2164F3',
    reason: 'Indeed applications go through their platform. Your queue will include a link to apply directly.',
  },
  {
    id: 'dice',
    name: 'Dice',
    url: 'https://www.dice.com/dashboard/register',
    color: '#EB1C26',
    reason: 'Dice job applications require a Dice account. These appear in your manual apply queue.',
  },
  {
    id: 'builtin',
    name: 'Built In',
    url: 'https://builtin.com/join',
    color: '#00B4D8',
    reason: 'Built In routes applications through their platform. Job Agent will queue these for you to submit manually.',
  },
];

export default function OnboardingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [resumeFile, setResumeFile] = useState(null);

  const [form, setForm] = useState({
    your_name: session?.user?.name ?? '',
    your_email: session?.user?.email ?? '',
    skills_text: '',
    job_titles: 'IT Manager, Systems Engineer, Systems Administrator',
    salary_floor: '110000',
    score_threshold: '7',
    location: 'Salt Lake City, UT',
    location_radius: '50',
    remote_only: true,
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit() {
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (resumeFile) fd.append('resume', resumeFile);

      const res = await fetch('/api/user/settings', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Failed to save settings');
      router.push('/dashboard');
    } catch (e) {
      alert('Error saving settings: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-cream flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-ink rounded-xl mb-4">
            <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
              <path d="M4 8h20M4 14h14M4 20h8" stroke="#F9F7F2" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="22" cy="20" r="4" fill="#7C9E87"/>
            </svg>
          </div>
          <h1 className="font-display text-3xl text-ink mb-1">Let's get you set up</h1>
          <p className="text-ink-400 text-sm">This takes about 3 minutes.</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = i === step;
            const done = i < step;
            return (
              <div key={s.id} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                  active ? 'bg-ink text-cream' :
                  done   ? 'bg-sage/20 text-sage-700' :
                           'bg-ink-50 text-ink-300'
                }`}>
                  {done ? <Check size={11} /> : <Icon size={11} />}
                  {s.label}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-6 h-px ${i < step ? 'bg-sage-300' : 'bg-ink-100'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step panels */}
        <div className="card p-8 shadow-sm animate-fade-up">

          {/* Step 0: Profile */}
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="font-display text-2xl text-ink mb-1">Your profile</h2>
              <p className="text-ink-400 text-sm mb-6">This is used in application emails sent on your behalf.</p>
              <div>
                <label className="label">Full name</label>
                <input className="input" value={form.your_name} onChange={e => set('your_name', e.target.value)} placeholder="Reese Spaulding" />
              </div>
              <div>
                <label className="label">Email address</label>
                <input className="input" type="email" value={form.your_email} onChange={e => set('your_email', e.target.value)} placeholder="you@email.com" />
              </div>
              <div>
                <label className="label">Your skills <span className="text-ink-300 font-normal normal-case tracking-normal">(used to fine-tune job matching)</span></label>
                <textarea
                  className="input h-28 resize-none"
                  value={form.skills_text}
                  onChange={e => set('skills_text', e.target.value)}
                  placeholder="Okta, ZTNA, Zero Trust, Infrastructure as Code, Vendor Management, Google Workspace, Azure AD, Jamf, Intune..."
                />
              </div>
            </div>
          )}

          {/* Step 1: Resume */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="font-display text-2xl text-ink mb-1">Your resume</h2>
              <p className="text-ink-400 text-sm mb-6">Upload your resume PDF. Claude uses the text to score job fit. The PDF is attached to email applications.</p>
              <label className={`flex flex-col items-center justify-center w-full h-44 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 ${
                resumeFile ? 'border-sage bg-sage/5' : 'border-ink-200 bg-ink-50/50 hover:border-ink-300'
              }`}>
                <input type="file" accept=".pdf" className="hidden" onChange={e => setResumeFile(e.target.files[0])} />
                {resumeFile ? (
                  <div className="text-center">
                    <Check size={28} className="text-sage mx-auto mb-2" />
                    <p className="text-sm font-medium text-ink">{resumeFile.name}</p>
                    <p className="text-xs text-ink-400 mt-1">Click to replace</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload size={24} className="text-ink-300 mx-auto mb-2" />
                    <p className="text-sm text-ink-500">Click to upload your resume PDF</p>
                    <p className="text-xs text-ink-300 mt-1">PDF only, max 5MB</p>
                  </div>
                )}
              </label>
              {!resumeFile && (
                <p className="text-xs text-amber-dark bg-amber/10 border border-amber/20 rounded-xl px-4 py-3">
                  ⚠️ You can skip this and add your resume later, but email applications won't work until it's uploaded.
                </p>
              )}
            </div>
          )}

          {/* Step 2: Job search config */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="font-display text-2xl text-ink mb-1">Job search settings</h2>
              <p className="text-ink-400 text-sm mb-6">Customize how the agent finds and filters jobs for you.</p>
              <div>
                <label className="label">Job titles to search <span className="text-ink-300 font-normal normal-case tracking-normal">(comma-separated)</span></label>
                <textarea
                  className="input h-20 resize-none"
                  value={form.job_titles}
                  onChange={e => set('job_titles', e.target.value)}
                  placeholder="IT Manager, Systems Engineer, DevOps Engineer"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Minimum salary ($/yr)</label>
                  <input className="input" type="number" value={form.salary_floor} onChange={e => set('salary_floor', e.target.value)} placeholder="110000" />
                </div>
                <div>
                  <label className="label">
                    Match accuracy
                    <span className="text-ink-300 font-normal normal-case tracking-normal ml-1">(1–10 threshold)</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input type="range" min="1" max="10" value={form.score_threshold} onChange={e => set('score_threshold', e.target.value)} className="flex-1 accent-sage" />
                    <span className="w-8 text-center font-mono font-medium text-sage text-sm">{form.score_threshold}</span>
                  </div>
                  <p className="text-xs text-ink-300 mt-1">
                    {form.score_threshold <= 4 ? 'Wide net — many matches' :
                     form.score_threshold <= 6 ? 'Balanced — good matches' :
                     form.score_threshold <= 8 ? 'Selective — strong matches' :
                                                 'Strict — only near-perfect fits'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Base location</label>
                  <input className="input" value={form.location} onChange={e => set('location', e.target.value)} placeholder="Salt Lake City, UT" />
                </div>
                <div>
                  <label className="label">Radius (miles)</label>
                  <input className="input" type="number" value={form.location_radius} onChange={e => set('location_radius', e.target.value)} placeholder="50" />
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.remote_only} onChange={e => set('remote_only', e.target.checked)} className="w-4 h-4 accent-sage" />
                <span className="text-sm text-ink">Remote / hybrid only (recommended)</span>
              </label>
            </div>
          )}

          {/* Step 3: Platform account warnings */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="font-display text-2xl text-ink mb-1">Platform accounts</h2>
              <p className="text-ink-400 text-sm mb-2">
                Job Agent can <strong>find</strong> jobs on these platforms and send <strong>email</strong> applications automatically.
                However, some platforms require you to apply through their own site with your own account.
              </p>
              <div className="bg-amber/10 border border-amber/25 rounded-xl px-4 py-3 text-sm text-amber-dark mb-4">
                ⚠️ These jobs will appear in your <strong>Manual Apply Queue</strong> — Job Agent will surface them with a direct link so you can apply in one click.
              </div>
              <div className="space-y-3">
                {PLATFORM_ACCOUNTS.map(p => (
                  <div key={p.id} className="flex items-start gap-4 p-4 bg-ink-50/50 rounded-xl border border-ink-100">
                    <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: p.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-sm text-ink">{p.name}</span>
                        <a href={p.url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-sage hover:underline">
                          Create account →
                        </a>
                      </div>
                      <p className="text-xs text-ink-400">{p.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-ink-300 pt-2">
                Jobs that accept direct email applications will be sent automatically — no action needed on your end.
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            className="btn-secondary flex items-center gap-2 disabled:invisible"
          >
            <ArrowLeft size={14} /> Back
          </button>

          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)} className="btn-primary flex items-center gap-2">
              Continue <ArrowRight size={14} />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={saving} className="btn-sage flex items-center gap-2">
              {saving ? 'Saving...' : 'Finish setup'} {!saving && <Check size={14} />}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
