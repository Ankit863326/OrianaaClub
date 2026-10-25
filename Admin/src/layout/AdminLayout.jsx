// This layout provides shared navigation, the mobile drawer, and admin logout.
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Activity, BookOpen, CalendarDays, CreditCard, FileText, LayoutDashboard, LogOut, Mail, Menu, Shield, Users, Wallet, X, ClipboardList, Settings, UserRoundCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { errorMessage } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { adminApi } from '../api/admin.js';
import { Button, Toast } from '../components/ui.jsx';

const navigation = [
  { title: 'WORKSPACE', links: [['Dashboard', '/', LayoutDashboard], ['Members', '/members', Users], ['Payments', '/payments', CreditCard]] },
  { title: 'MANAGEMENT', links: [['Blog Posts', '/posts', FileText], ['Events', '/events', CalendarDays], ['Enquiries', '/enquiries', Mail], ['Administrators', '/admins', Shield]] },
  { title: 'MEMBERSHIP', links: [['Plans', '/membership/plans', BookOpen], ['Members', '/membership/members', Users], ['Draft Members', '/membership/drafts', Users], ['Points', '/points', Wallet], ['Bills', '/membership/bills', ClipboardList], ['Pending Queue', '/membership/queue', UserRoundCheck], ['Reports', '/membership/reports', Activity], ['Audit Log', '/membership/audit', FileText], ['Settings', '/membership/settings', Settings]] },
  { title: 'SYSTEM', links: [['Reports', '/reports', Activity], ['Audit Log', '/audit-log', FileText], ['Email Log', '/email-log', Mail]] },
];
const titles = Object.fromEntries(navigation.flatMap((section) => section.links.map(([label, path]) => [path, label])));

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingPayments, setPendingPayments] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    adminApi.dashboard().then((data) => {
      if (mounted) setPendingPayments(Number(data.pendingBankTransfers || 0));
    }).catch((failure) => {
      if (mounted) setError(errorMessage(failure));
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => setDrawerOpen(false), [location.pathname]);

  async function signOut() {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('[admin-auth] Logout request failed:', error.message);
      navigate('/login', { replace: true });
    }
  }

  const sidebar = <div className="flex h-full flex-col">
    <Link to="/" className="flex items-center gap-3 px-5 py-6">
      <span className="grid size-11 place-items-center rounded-xl border border-gold/40 bg-gold/10 font-display text-xl font-bold text-gold">OC</span>
      <span><strong className="block font-display text-lg text-white">OrianaaClub</strong><small className="mt-0.5 block text-xs tracking-wide text-slate-400">Admin Panel</small></span>
    </Link>
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-5">
      {navigation.map((section) => <div key={section.title}>
        <p className="px-3 pb-2 text-[10px] font-bold tracking-[.17em] text-slate-500">{section.title}</p>
        <div className="space-y-1">{section.links.map(([label, path, Icon]) => <NavLink
          key={path}
          to={path}
          end={path === '/'}
          className={({ isActive }) => `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${isActive ? 'bg-gold font-semibold text-midnight' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
        >
          <Icon size={18} /><span className="flex-1">{label}</span>
          {path === '/payments' && pendingPayments > 0 && <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-midnight">{pendingPayments}</span>}
        </NavLink>)}</div>
      </div>)}
    </nav>
    <div className="border-t border-white/10 p-4">
      <p className="truncate text-sm font-semibold text-white">{user?.firstName || 'Administrator'}</p>
      <p className="truncate text-xs text-slate-400">{user?.email}</p>
      <Button variant="secondary" className="mt-3 w-full border-white/15 bg-white/5 text-slate-200 hover:bg-white/10" onClick={signOut}><LogOut size={16} />Log out</Button>
    </div>
  </div>;

  return <div className="min-h-screen bg-slate-50">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/10 bg-midnight lg:flex">{sidebar}</aside>
    {drawerOpen && <div className="fixed inset-0 z-40 lg:hidden">
      <button className="absolute inset-0 bg-midnight/60" onClick={() => setDrawerOpen(false)} aria-label="Close navigation drawer" />
      <aside className="relative h-full w-[min(19rem,88vw)] bg-midnight shadow-2xl">{sidebar}<button className="absolute right-3 top-4 rounded-lg p-2 text-slate-300" onClick={() => setDrawerOpen(false)} aria-label="Close menu"><X size={20} /></button></aside>
    </div>}
    <div className="min-h-screen lg:pl-64">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-7">
        <div className="flex items-center gap-3"><button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setDrawerOpen(true)} aria-label="Open navigation"><Menu size={21} /></button><h2 className="font-display text-lg text-slate-800">{titles[location.pathname] || 'Admin workspace'}</h2></div>
        <div className="flex items-center gap-3">
          <div className="max-w-32 text-right sm:max-w-52"><p className="truncate text-xs font-semibold text-slate-800 sm:text-sm">{user?.firstName || 'Administrator'}</p><p className="hidden truncate text-xs text-slate-500 sm:block">{user?.email}</p></div>
          <Button variant="secondary" className="px-3 py-2" onClick={signOut}><LogOut size={16} /><span className="hidden sm:inline">Logout</span></Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
        {error && <Toast kind="error" onDismiss={() => setError('')}>{error}</Toast>}
        <motion.div key={location.pathname} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
          <Outlet />
        </motion.div>
      </main>
    </div>
  </div>;
}
