'use client';
import { useSession } from 'next-auth/react';
import { useState, useEffect, useCallback } from 'react';
import {
  Play, RefreshCw, CheckCircle, Clock, AlertCircle,
  Briefcase, Mail, ListTodo, TrendingUp, ChevronRight, Zap
} from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  color: 'text-ink-400',  bg: 'bg-ink-50',    icon: Clock },
  running:  { label: 'Running',  color: 'text-amber',    bg: 'bg-amber/10',  icon: RefreshCw },
  complete: { label: 'Complete', color: 'text-sage',     bg: 'bg-sage/10',   icon: CheckCircle },
  failed:   { label: 'Failed',   color: 'text-red-500',  bg: 'bg-red-50',    icon: AlertCircle },
};

function StatCard({ label, value, sub, icon: Icon, delay = '' }) {
  return (
    <div className={`card p-5 animate-fade-up opacity-0 ${delay}`} style={{ animationFillMode: 'forwards' }}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs text-ink-400 font-medium uppercase tracking-wider">{label}</span>
        <div className="w-7 h-7 bg-ink-50 rounded-lg flex items-center justify-center">
          <Icon size={13} className="text-ink-400" />
        </div>
      </div>
      <p className="font-display text-3xl text-ink leading-none mb-1">{value ?? '—'}</p>
      {sub && <p className="text-xs text-ink-300">{sub}</p>}
    </div>
  );
}

function RunRow({ run }) {
  const cfg = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  const date = new Date(run.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex items-center gap-4 py-3 border-b border-ink-50 last:border-0">
      <div className={clsx('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0', cfg.bg, cfg.color)}>
        <Icon size={10} className={run.status === 'running' ? 'animate-spin' : ''} />
        {cfg.label}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-ink-400 truncate">{date}</p>
      </div>
      <div className="flex items-center gap-4 text-xs text-ink-400 font-mono flex-shrink-0">
        <span>{run.jobs_fetched ?? 0} fetched</span>
        <span className="text-sage font-medium">{run.jobs_qualified ?? 0} qualified</span>
        <span>{run.emails_sent ?? 0} emailed</span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [runs, setRuns] = useState([]);
  const [stats, setStats] = useState(null);
  const [triggering, setTriggering] = useState(false);
  const [lastRun, setLastRun] = useState(null);

  const fetchData = useCallback(async () => {
    const [runsRes, statsRes] = await Promise.all([
      fetch('/api/pipeline/runs'),
      fetch('/api/jobs/stats'),
    ]);
    if (runsRes.ok) setRuns(await runsRes.json());
    if (statsRes.ok) setStats(await statsRes.json());
  }, []);

  useEffect(() => {
    fetchData();
    // Poll every 15s if a run is active
    const interval = setInterval(() => {
      if (runs.some(r => r.status === 'running')) fetchData();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchData, runs]);

  async function triggerPipeline() {
    setTriggering(true);
    try {
      const res = await fetch('/api/pipeline/trigger', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Trigger failed');
      setTimeout(fetchData, 2000);
    } catch (e) {
      alert('Failed to start pipeline: ' + e.message);
    } finally {
      setTriggering(false);
    }
  }

  const activeRun = runs.find(r => r.status === 'running');
  const firstName = session?.user?.name?.split(' ')[0] ?? 'there';

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display text-4xl text-ink mb-1">
            Hey, {firstName}
          </h1>
          <p className="text-ink-400 text-sm">
            {activeRun
              ? '⚡ Pipeline is running right now...'
              : `Last run: ${runs[0] ? new Date(runs[0].started_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Never'}`
            }
          </p>
        </div>
        <button
          onClick={triggerPipeline}
          disabled={triggering || !!activeRun}
          className={clsx(
            'flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition-all duration-200',
            activeRun
              ? 'bg-amber/15 text-amber-dark cursor-default'
              : 'btn-primary'
          )}
        >
          {activeRun ? (
            <><RefreshCw size={14} className="animate-spin" /> Running...</>
          ) : triggering ? (
            <><RefreshCw size={14} className="animate-spin" /> Starting...</>
          ) : (
            <><Play size={14} /> Run Pipeline</>
          )}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Runs"      value={stats?.total_runs}      icon={RefreshCw}  delay="stagger-1" />
        <StatCard label="Jobs Qualified"  value={stats?.total_qualified} icon={TrendingUp} delay="stagger-2" />
        <StatCard label="Emails Sent"     value={stats?.total_emailed}   icon={Mail}       delay="stagger-3" sub="auto-applied" />
        <StatCard label="Pending Apply"   value={stats?.pending_queue}   icon={ListTodo}   delay="stagger-4" sub="in your queue" />
      </div>

      {/* Active run banner */}
      {activeRun && (
        <div className="bg-amber/10 border border-amber/25 rounded-2xl p-5 mb-6 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Zap size={15} className="text-amber-dark" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">Pipeline is running</p>
              <p className="text-xs text-ink-400">GitHub Actions is fetching, scoring, and processing jobs. This usually takes 3–8 minutes.</p>
            </div>
          </div>
        </div>
      )}

      {/* Recent runs */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl text-ink">Recent runs</h2>
          <button onClick={fetchData} className="text-xs text-ink-400 hover:text-ink flex items-center gap-1 transition-colors">
            <RefreshCw size={11} /> Refresh
          </button>
        </div>
        {runs.length === 0 ? (
          <div className="text-center py-8">
            <Play size={24} className="text-ink-200 mx-auto mb-3" />
            <p className="text-sm text-ink-400">No runs yet. Hit "Run Pipeline" to start.</p>
          </div>
        ) : (
          runs.slice(0, 8).map(r => <RunRow key={r.id} run={r} />)
        )}
      </div>

      {/* Queue shortcut */}
      <Link href="/queue" className="card-hover p-5 flex items-center gap-4 block">
        <div className="w-10 h-10 bg-sage/10 rounded-xl flex items-center justify-center flex-shrink-0">
          <ListTodo size={18} className="text-sage" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-ink text-sm">Manual Apply Queue</p>
          <p className="text-xs text-ink-400">
            {stats?.pending_queue > 0
              ? `${stats.pending_queue} jobs waiting for you to apply`
              : 'No pending jobs right now'}
          </p>
        </div>
        <ChevronRight size={16} className="text-ink-300" />
      </Link>
    </div>
  );
}
