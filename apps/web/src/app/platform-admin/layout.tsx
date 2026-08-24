'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Bell,
  Building2,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  User as UserIcon,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const NAV_ITEMS = [
  { to: '/platform-admin/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { to: '/platform-admin/hospitals', label: 'Hospitals', icon: <Building2 size={18} /> },
  { to: '/platform-admin/users', label: 'Users', icon: <Users size={18} /> },
];

export default function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => pathname === path || pathname.startsWith(`${path}/`);
  const currentSection = NAV_ITEMS.find((item) => isActive(item.to));

  const displayName = user?.name || user?.email;
  const getInitials = (name?: string | null) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };
  const userInitials = getInitials(displayName);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setShowProfileMenu(false);
      }
    };
    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showProfileMenu]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (notificationsRef.current && !notificationsRef.current.contains(target)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showNotifications]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-canvas">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-violet/20 border-t-brand-violet" />
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  if (!user.isPlatformAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-canvas px-4">
        <div className="text-center max-w-sm">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-status-warning-soft rounded-2xl mb-6">
            <ShieldAlert className="text-status-warning w-8 h-8" />
          </div>
          <h1 className="font-display tracking-tight text-xl font-bold text-ink-900 mb-2">Platform admin access required</h1>
          <p className="text-sm text-ink-700 mb-6">You don&apos;t have permission to view this page.</p>
          <button
            onClick={() => router.push('/select-hospital')}
            className="inline-flex items-center px-5 py-2.5 border border-border text-sm font-medium rounded-lg text-ink-700 bg-surface-paper hover:bg-surface-canvas transition-all"
          >
            Back to hospitals
          </button>
        </div>
      </div>
    );
  }

  const navigateTo = (path: string) => {
    router.push(path);
    setIsOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-surface-canvas">
      {/* Desktop Sidebar */}
      <aside
        className="hidden md:flex md:flex-col md:flex-shrink-0 bg-night-bg text-white sticky top-0 self-start h-screen transition-all duration-300 ease-in-out shadow-2xl border-r border-night-border z-50"
        style={{ width: sidebarExpanded ? '240px' : '72px' }}
      >
        <div className="p-4 border-b border-night-border">
          <button
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            className={`flex items-center gap-3 w-full ${sidebarExpanded ? '' : 'justify-center'}`}
            aria-label={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <div className="w-9 h-9 bg-brand-violet hover:bg-brand-violet-hover rounded-lg flex items-center justify-center flex-shrink-0 shadow-md transition-colors">
              <Settings className="text-white" size={18} />
            </div>
            {sidebarExpanded && (
              <div className="flex-1 min-w-0 text-left">
                <h1 className="font-display tracking-tight text-base font-bold text-white truncate">Agam Plus</h1>
                <p className="text-[10px] text-night-muted font-medium tracking-wider uppercase truncate">Platform Admin</p>
              </div>
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {sidebarExpanded && (
            <div className="px-3 pb-1 text-[10px] font-semibold text-night-muted uppercase tracking-wider">Manage</div>
          )}
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.to);
            return (
              <button
                key={item.to}
                onClick={() => navigateTo(item.to)}
                className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 w-full text-left border-l-2 ${
                  active
                    ? 'bg-night-active text-white border-status-open'
                    : 'text-night-muted hover:bg-night-hover hover:text-white border-transparent'
                }`}
                title={!sidebarExpanded ? item.label : undefined}
                aria-label={item.label}
              >
                <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">{item.icon}</div>
                {sidebarExpanded && (
                  <span className={`text-sm truncate ${active ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-night-border p-4">
          <div className={`flex items-center gap-2 ${sidebarExpanded ? '' : 'justify-center'}`}>
            <span className="w-2 h-2 rounded-full bg-status-open flex-shrink-0" />
            {sidebarExpanded && (
              <div className="min-w-0">
                <div className="text-xs font-medium text-white truncate">All systems normal</div>
                <div className="text-[10px] text-night-muted truncate">Platform admin console</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Navbar */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-night-bg text-white flex items-center justify-between px-4 py-4 shadow-2xl z-50 border-b border-night-border">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="hover:bg-white/15 p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center"
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
          >
            {isOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-base font-bold truncate text-white">Agam Plus - Platform Admin</span>
            <span className="text-xs text-white/70 font-medium truncate">{currentSection ? currentSection.label : 'Dashboard'}</span>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      <div className={`fixed inset-0 z-40 md:hidden transition-all duration-300 ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setIsOpen(false)}
        />
        <aside
          className={`absolute top-0 left-0 w-80 h-full bg-night-bg text-white shadow-2xl p-6 transform transition-transform duration-300 flex flex-col border-r border-night-border ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="mt-20 mb-6">
            <div className="w-full bg-white/10 backdrop-blur-md rounded-xl p-4 shadow-lg border border-white/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-violet-soft flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-brand-violet">{userInitials}</span>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <h2 className="font-display tracking-tight text-base font-bold text-white truncate">{displayName}</h2>
                  <p className="text-sm text-white/70 truncate">Platform Admin</p>
                </div>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-1.5 overflow-y-auto mb-4">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.to);
              return (
                <button
                  key={item.to}
                  onClick={() => navigateTo(item.to)}
                  className={`group relative flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 w-full text-left ${
                    active ? 'bg-white/20 text-white shadow-lg backdrop-blur-md border border-white/30' : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                  aria-label={item.label}
                >
                  {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full" />}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                        active ? 'bg-white/30 text-white' : 'bg-white/10 text-white/80 group-hover:bg-white/20 group-hover:text-white'
                      }`}
                    >
                      {item.icon}
                    </div>
                    <span className={`text-sm font-medium truncate ${active ? 'font-semibold' : ''}`}>{item.label}</span>
                  </div>
                </button>
              );
            })}
          </nav>

          <div className="border-t border-white/10 pt-4">
            <button
              onClick={() => logout()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm text-white hover:bg-status-danger/20 hover:shadow-sm transition-all duration-200 font-semibold border border-white/20"
            >
              <LogOut size={18} />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>
      </div>

      {/* Main Content */}
      <main className="flex-1 min-w-0 min-h-screen mt-16 md:mt-0 transition-all duration-300">
        {/* Desktop Top Bar */}
        <header className="hidden md:flex items-center justify-between gap-4 px-6 py-3 bg-surface-paper border-b border-border sticky top-0 z-30">
          <div className="flex items-center gap-1.5 text-sm min-w-0">
            <span className="text-ink-500 truncate">Agam Plus</span>
            <span className="text-ink-500">/</span>
            <span className="text-ink-500 truncate">Platform Admin</span>
            <span className="text-ink-500">/</span>
            <span className="text-ink-900 font-semibold truncate">{currentSection ? currentSection.label : 'Dashboard'}</span>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Search */}
            <div className="relative hidden lg:block">
              <Search className="w-4 h-4 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search anything"
                className="pl-9 pr-14 py-2 rounded-lg border border-border bg-surface-canvas text-sm w-64 focus:outline-none focus:ring-2 focus:ring-brand-violet/30 focus:border-brand-violet placeholder:text-ink-500"
              />
              <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-ink-500 bg-surface-paper border border-border rounded px-1.5 py-0.5">
                ⌘K
              </kbd>
            </div>

            {/* Notifications */}
            <div className="relative" ref={notificationsRef}>
              <button
                onClick={() => setShowNotifications((prev) => !prev)}
                className="p-2 rounded-lg text-ink-700 hover:bg-surface-canvas transition-colors"
                aria-label="Notifications"
              >
                <Bell size={18} />
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-surface-paper rounded-xl shadow-2xl border border-border overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-border text-sm font-semibold text-ink-900">Notifications</div>
                  <div className="px-4 py-6 text-sm text-ink-500 text-center">No new notifications</div>
                </div>
              )}
            </div>

            {/* Profile trigger */}
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setShowProfileMenu((prev) => !prev)}
                className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-lg hover:bg-surface-canvas transition-colors flex-shrink-0"
                aria-label="Profile menu"
              >
                <div className="w-9 h-9 rounded-full bg-brand-violet-soft flex items-center justify-center text-brand-violet flex-shrink-0">
                  <span className="text-sm font-semibold">{userInitials}</span>
                </div>
                <div className="hidden xl:block text-left min-w-0">
                  <div className="text-sm font-semibold text-ink-900 truncate max-w-[140px]">{displayName}</div>
                  <div className="text-xs text-ink-500 truncate">Platform admin</div>
                </div>
                <ChevronDown size={16} className="text-ink-500 flex-shrink-0" />
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-surface-paper rounded-xl shadow-2xl border border-border overflow-hidden z-50">
                  <div className="w-full flex items-center gap-3 px-4 py-3 border-b border-border text-left">
                    <div className="w-10 h-10 rounded-full bg-brand-violet-soft flex items-center justify-center text-brand-violet flex-shrink-0">
                      <span className="text-sm font-semibold">{userInitials}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-ink-900 truncate">{displayName}</div>
                      <div className="text-xs text-ink-500 truncate">{user.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-ink-700 border-b border-border">
                    <ShieldCheck size={16} className="text-brand-violet flex-shrink-0" />
                    <span>Platform Admin</span>
                  </div>

                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      router.push('/select-hospital');
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-surface-canvas transition-colors text-left"
                  >
                    <UserIcon size={16} />
                    <span>Switch to Hospital View</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-status-danger hover:bg-status-danger-soft transition-colors text-left border-t border-border"
                  >
                    <LogOut size={16} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="p-4 md:p-6 max-w-[1600px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
