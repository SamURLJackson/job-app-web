'use client';
import { useSession, signOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard, ListTodo, Settings, LogOut,
  Zap, ChevronRight
} from 'lucide-react';
import clsx from 'clsx';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/queue',     label: 'Apply Queue', icon: ListTodo },
  { href: '/settings',  label: 'Settings',    icon: Settings },
];

export default function AppLayout({ children }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-ink-200 border-t-sage animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-ink-100 flex flex-col py-6 px-4 fixed left-0 top-0 bottom-0 z-20">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5 px-2 mb-8">
          <div className="w-8 h-8 bg-ink rounded-lg flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 28 28" fill="none">
              <path d="M4 8h20M4 14h14M4 20h8" stroke="#F9F7F2" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="22" cy="20" r="4" fill="#7C9E87"/>
            </svg>
          </div>
          <span className="font-display text-lg text-ink leading-none">Job Agent</span>
        </Link>

        {/* Nav */}
        <nav className="flex-1 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            return (
              <Link key={href} href={href} className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-ink text-cream'
                  : 'text-ink-500 hover:bg-ink-50 hover:text-ink'
              )}>
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-ink-100 pt-4">
          <div className="flex items-center gap-3 px-2 mb-3">
            {session?.user?.image && (
              <img src={session.user.image} alt="" className="w-8 h-8 rounded-full flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-ink truncate">{session?.user?.name}</p>
              <p className="text-xs text-ink-300 truncate">{session?.user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-ink-400 hover:text-ink rounded-xl hover:bg-ink-50 transition-all duration-150"
          >
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 ml-60">
        {children}
      </div>
    </div>
  );
}
