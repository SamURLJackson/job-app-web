'use client';
import { useState, useEffect } from 'react';
import { ExternalLink, Check, X, ChevronDown, ChevronUp, Mail, Building2, Star } from 'lucide-react';
import clsx from 'clsx';

const SCORE_COLOR = (s) =>
  s >= 9 ? 'bg-sage text-white' :
  s >= 7 ? 'bg-sage/20 text-sage-700' :
  s >= 5 ? 'bg-amber/20 text-amber-dark' :
           'bg-ink-100 text-ink-400';

function JobCard({ job, onStatusChange }) {
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState(false);

  async function updateStatus(status) {
    setUpdating(true);
    await fetch(`/api/jobs/${job.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    onStatusChange(job.id, status);
    setUpdating(false);
  }

  return (
    <div className={clsx(
      'card mb-3 overflow-hidden transition-all duration-200',
      job.status === 'applied' && 'opacity-60',
      job.status === 'skipped' && 'opacity-40'
    )}>
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Score badge */}
          <div className={clsx('score-badge flex-shrink-0 mt-0.5', SCORE_COLOR(job.score))}>
            {job.score}
          </div>

          {/* Job info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-medium text-ink text-sm leading-snug">{job.title}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <Building2 size={11} className="text-ink-300 flex-shrink-0" />
                  <span className="text-xs text-ink-400">{job.company}</span>
                  {job.salary_note && (
                    <>
                      <span className="text-ink-200">·</span>
                      <span className="text-xs text-sage font-medium">{job.salary_note}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-xs bg-ink-50 text-ink-400 px-2 py-0.5 rounded-full">{job.source}</span>
                {job.is_email_apply && (
                  <span className="text-xs bg-sage/10 text-sage px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Mail size={9} /> Email
                  </span>
                )}
              </div>
            </div>

            {/* Reason */}
            {job.score_reason && (
              <p className="text-xs text-ink-400 mt-2 leading-relaxed line-clamp-2">{job.score_reason}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-ink-50">
          <a href={job.url} target="_blank" rel="noopener noreferrer"
            className="btn-primary flex items-center gap-1.5 text-xs py-2 px-4">
            Apply Now <ExternalLink size={11} />
          </a>
          {job.status !== 'applied' && (
            <button onClick={() => updateStatus('applied')} disabled={updating}
              className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-4">
              <Check size={11} /> Mark Applied
            </button>
          )}
          {job.status !== 'skipped' && (
            <button onClick={() => updateStatus('skipped')} disabled={updating}
              className="text-xs text-ink-300 hover:text-ink-500 px-3 py-2 rounded-xl hover:bg-ink-50 transition-all flex items-center gap-1">
              <X size={11} /> Skip
            </button>
          )}
          {job.cover_letter && (
            <button onClick={() => setExpanded(!expanded)}
              className="ml-auto text-xs text-ink-400 hover:text-ink flex items-center gap-1 transition-colors">
              Cover letter {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          )}
        </div>
      </div>

      {/* Cover letter */}
      {expanded && job.cover_letter && (
        <div className="px-5 pb-5 border-t border-ink-50">
          <div className="mt-4 bg-ink-50/50 rounded-xl p-4">
            <p className="text-xs font-medium text-ink-400 uppercase tracking-wider mb-3">Generated Cover Letter</p>
            <p className="text-xs text-ink-600 leading-relaxed whitespace-pre-wrap">{job.cover_letter}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function QueuePage() {
  const [jobs, setJobs] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/jobs?status=${filter}`)
      .then(r => r.json())
      .then(data => { setJobs(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filter]);

  function handleStatusChange(id, status) {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status } : j));
  }

  const counts = { pending: 0, applied: 0, skipped: 0 };
  jobs.forEach(j => { if (counts[j.status] !== undefined) counts[j.status]++; });

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="font-display text-4xl text-ink mb-1">Apply Queue</h1>
        <p className="text-ink-400 text-sm">Jobs scored by Claude, ready for you to apply.</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-ink-50 rounded-xl p-1 mb-6 w-fit">
        {[
          { key: 'pending', label: 'Pending' },
          { key: 'applied', label: 'Applied' },
          { key: 'skipped', label: 'Skipped' },
        ].map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
              filter === t.key ? 'bg-white text-ink shadow-sm' : 'text-ink-400 hover:text-ink'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Job list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 rounded-full border-2 border-ink-200 border-t-sage animate-spin" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-16">
          <Star size={28} className="text-ink-200 mx-auto mb-3" />
          <p className="text-ink-400 text-sm">
            {filter === 'pending' ? 'No pending jobs. Run the pipeline to find new matches.' :
             filter === 'applied' ? "You haven't marked anything as applied yet." :
             "Nothing skipped."}
          </p>
        </div>
      ) : (
        <div className="animate-fade-up" style={{ animationFillMode: 'forwards' }}>
          {jobs.map(job => (
            <JobCard key={job.id} job={job} onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}
    </div>
  );
}
