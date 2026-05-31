'use client';
import { useState, useEffect } from 'react';
import { Upload, Save, Check, AlertTriangle, ExternalLink } from 'lucide-react';

const PLATFORM_ACCOUNTS = [
  { id: 'linkedin', name: 'LinkedIn', url: 'https://www.linkedin.com/signup', color: '#0A66C2' },
  { id: 'indeed',   name: 'Indeed',   url: 'https://secure.indeed.com/account/register', color: '#2164F3' },
  { id: 'dice',     name: 'Dice',     url: 'https://www.dice.com/dashboard/register', color: '#EB1C26' },
  { id: 'builtin',  name: 'Built In', url: 'https://builtin.com/join', color: '#00B4D8' },
];

export default function SettingsPage() {
  const [form, setForm] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/user/settings')
      .then(r => r.json())
      .then(data => setForm(data));
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave() {
    setSaving(true);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => {
      if (v !== null && v !== undefined) fd.append(k, v);
    });
    if (resumeFile) fd.append('resume', resumeFile);
    await fetch('/api/user/settings', { method: 'POST', body: fd });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (!form) return (
    <div className="p-8 flex items-center justify-center min-h-64">
      <div className="w-5 h-5 rounded-full border-2 border-ink-200 border-t-sage animate-spin" />
    </div>
  );

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="font-display text-4xl text-ink mb-1">Settings</h1>
        <p className="text-ink-400 text-sm">Update your resume, job preferences, and profile.</p>
      </div>

      <div className="space-y-6">
        {/* Profile */}
        <section className="card p-6">
          <h2 className="font-display text-xl text-ink mb-5">Profile</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Full name</label>
              <input className="input" value={form.your_name ?? ''} onChange={e => set('your_name', e.target.value)} />
            </div>
            <div>
              <label className="label">Email (used in application emails)</label>
              <input className="input" type="email" value={form.your_email ?? ''} onChange={e => set('your_email', e.target.value)} />
            </div>
            <div>
              <label className="label">Your skills</label>
              <textarea className="input h-24 resize-none" value={form.skills_text ?? ''} onChange={e => set('skills_text', e.target.value)}
                placeholder="Okta, ZTNA, Zero Trust, Infrastructure as Code..." />
            </div>
          </div>
        </section>

        {/* Resume */}
        <section className="card p-6">
          <h2 className="font-display text-xl text-ink mb-2">Resume</h2>
          {form.resume_filename && (
            <p className="text-xs text-sage mb-4 flex items-center gap-1.5">
              <Check size={12} /> Current file: <span className="font-mono">{form.resume_filename}</span>
            </p>
          )}
          <label className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 ${
            resumeFile ? 'border-sage bg-sage/5' : 'border-ink-200 hover:border-ink-300 bg-ink-50/30'
          }`}>
            <input type="file" accept=".pdf" className="hidden" onChange={e => setResumeFile(e.target.files[0])} />
            {resumeFile ? (
              <div className="text-center">
                <Check size={22} className="text-sage mx-auto mb-1.5" />
                <p className="text-sm font-medium text-ink">{resumeFile.name}</p>
                <p className="text-xs text-ink-400 mt-0.5">Click to replace</p>
              </div>
            ) : (
              <div className="text-center">
                <Upload size={20} className="text-ink-300 mx-auto mb-1.5" />
                <p className="text-sm text-ink-500">Upload new resume PDF</p>
              </div>
            )}
          </label>
        </section>

        {/* Job search */}
        <section className="card p-6">
          <h2 className="font-display text-xl text-ink mb-5">Job Search</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Job titles <span className="text-ink-300 font-normal normal-case tracking-normal">(comma-separated)</span></label>
              <textarea className="input h-20 resize-none" value={form.job_titles?.join(', ') ?? ''}
                onChange={e => set('job_titles', e.target.value.split(',').map(t => t.trim()).filter(Boolean))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Minimum salary ($/yr)</label>
                <input className="input" type="number" value={form.salary_floor ?? ''} onChange={e => set('salary_floor', parseInt(e.target.value))} placeholder="e.g. 60000" />
              </div>
              <div>
                <label className="label">Match accuracy (1–10)</label>
                <div className="flex items-center gap-3 mt-1">
                  <input type="range" min="1" max="10" value={form.score_threshold ?? 7}
                    onChange={e => set('score_threshold', parseInt(e.target.value))} className="flex-1 accent-sage" />
                  <span className="w-8 text-center font-mono text-sage font-medium text-sm">{form.score_threshold ?? 7}</span>
                </div>
                <p className="text-xs text-ink-300 mt-1">
                  {(form.score_threshold ?? 7) <= 4 ? 'Wide net' :
                   (form.score_threshold ?? 7) <= 6 ? 'Balanced' :
                   (form.score_threshold ?? 7) <= 8 ? 'Selective' : 'Strict'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Base location</label>
                <input className="input" value={form.location ?? ''} onChange={e => set('location', e.target.value)} />
              </div>
              <div>
                <label className="label">Radius (miles)</label>
                <input className="input" type="number" value={form.location_radius ?? 50} onChange={e => set('location_radius', parseInt(e.target.value))} />
              </div>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.remote_only ?? true} onChange={e => set('remote_only', e.target.checked)} className="w-4 h-4 accent-sage" />
              <span className="text-sm text-ink">Remote / hybrid only</span>
            </label>
          </div>
        </section>

        {/* Platform accounts warning */}
        <section className="card p-6 border-amber/30">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={15} className="text-amber-dark" />
            <h2 className="font-display text-xl text-ink">Platform Accounts Required</h2>
          </div>
          <p className="text-xs text-ink-400 mb-4">
            Job Agent can find and score jobs from these platforms, but applications must be submitted through their own sites with your own account. These jobs appear in your <strong>Manual Apply Queue</strong>.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {PLATFORM_ACCOUNTS.map(p => (
              <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-ink-50/50 rounded-xl border border-ink-100 hover:border-ink-200 transition-all group">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                <span className="text-sm font-medium text-ink">{p.name}</span>
                <ExternalLink size={11} className="text-ink-300 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            ))}
          </div>
        </section>

        {/* Save */}
        <div className="flex justify-end pb-8">
          <button onClick={handleSave} disabled={saving} className="btn-sage flex items-center gap-2 px-6">
            {saved ? (
              <><Check size={14} /> Saved!</>
            ) : saving ? (
              'Saving...'
            ) : (
              <><Save size={14} /> Save Changes</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
