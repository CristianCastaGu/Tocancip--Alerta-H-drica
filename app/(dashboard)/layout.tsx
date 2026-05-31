'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Droplets, LayoutDashboard, History, Settings, Shield,
  LogOut, Menu, X, ChevronRight,
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

const navItems = [
  { href: '/dashboard',      label: 'Dashboard',    icon: LayoutDashboard, roles: ['ADMIN', 'OPERADOR', 'VISOR'] },
  { href: '/historial',      label: 'Historial',    icon: History,         roles: ['ADMIN', 'OPERADOR', 'VISOR'] },
  { href: '/configuracion',  label: 'Configuración',icon: Settings,        roles: ['ADMIN'] },
  { href: '/auditoria',      label: 'Auditoría',    icon: Shield,          roles: ['ADMIN'] },
];

const roleStyles: Record<string, string> = {
  ADMIN:    'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  OPERADOR: 'text-accent border',
  VISOR:    'border',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Droplets className="w-8 h-8 text-accent animate-pulse" />
      </div>
    );
  }
  if (!session) return null;

  const userRole = (session.user as { role?: string })?.role ?? 'VISOR';
  const visibleNav = navItems.filter((item) => item.roles.includes(userRole));

  const Sidebar = () => (
    <aside className="flex flex-col h-full bg-card sidebar-border-r">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 sidebar-border-b">
        <div
          className="flex items-center justify-center w-9 h-9 rounded-lg"
          style={{ background: 'color-mix(in srgb, var(--tw-accent) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--tw-accent) 35%, transparent)' }}
        >
          <Droplets className="w-5 h-5 text-accent" />
        </div>
        <div>
          <p className="text-sm font-bold text-primary leading-tight">TAH</p>
          <p className="text-xs leading-tight" style={{ color: 'var(--tw-secondary)' }}>Tocancipá</p>
        </div>
        <ThemeToggle className="ml-auto" />
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleNav.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`nav-link ${isActive ? 'active' : ''}`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">{item.label}</span>
              {isActive && <ChevronRight className="w-3 h-3 ml-auto text-accent" />}
            </Link>
          );
        })}
      </nav>

      {/* Usuario */}
      <div className="px-3 py-4 sidebar-border-b" style={{ borderTop: '1px solid var(--tw-border)' }}>
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'color-mix(in srgb, var(--tw-accent) 20%, transparent)' }}
          >
            <span className="text-accent text-xs font-bold uppercase">
              {session.user?.name?.charAt(0) ?? '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-primary truncate">{session.user?.name}</p>
            <span className={`text-xs px-1.5 py-0.5 rounded ${roleStyles[userRole] ?? 'border'}`}
              style={{ borderColor: 'var(--tw-border)', color: 'var(--tw-secondary)' }}>
              {userRole}
            </span>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm"
          style={{ color: 'var(--tw-secondary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#f87171';
            e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--tw-secondary)';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar desktop */}
      <div className="hidden lg:flex lg:w-56 lg:flex-shrink-0">
        <div className="w-full"><Sidebar /></div>
      </div>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" style={{ background: 'var(--tw-overlay)' }}
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar mobile */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 lg:hidden
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar />
      </div>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header mobile */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-card sidebar-border-b">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--tw-secondary)' }}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <Droplets className="w-5 h-5 text-accent" />
            <span className="text-sm font-bold text-primary">TAH · Tocancipá</span>
          </div>
          <ThemeToggle className="ml-auto" />
        </header>

        {/* Página */}
        <main className="flex-1 overflow-y-auto bg-background p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
