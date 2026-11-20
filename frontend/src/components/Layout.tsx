/**
 * Layout — sidebar navigation + header + content area.
 *
 * Used as the wrapper for all authenticated pages. The sidebar provides
 * navigation between Dashboard, Charts, Calculator, and Settings. The
 * header shows the app name and a logout button.
 */

import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import {
  CalculatorIcon,
  ChartLineIcon,
  LayoutDashboardIcon,
  MenuIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
  XIcon,
} from './Icons';
import { LogoMark } from './Logo';

const navItems = [
  { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboardIcon },
  { to: '/charts', labelKey: 'nav.charts', icon: ChartLineIcon },
  { to: '/calculator', labelKey: 'nav.calculator', icon: CalculatorIcon },
  { to: '/settings', labelKey: 'nav.settings', icon: SettingsIcon },
];

export function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* ── Sidebar ───────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-brand-950 transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between px-6">
          <Link
            to="/"
            className="flex items-center gap-3 font-display text-3xl font-bold text-white"
          >
            <LogoMark variant="dark" size={42} className="shrink-0" />
            frekl.
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-gray-400 hover:text-white lg:hidden"
          >
            <XIcon size={18} />
          </button>
        </div>
        <nav className="mt-4 space-y-1 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-600 text-white hover:bg-brand-700'
                    : 'text-brand-100 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <item.icon size={18} className="shrink-0" />
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* ── Overlay for mobile ────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Main content ─────────────────────── */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-900 lg:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white lg:hidden"
          >
            <MenuIcon size={20} />
          </button>
          <div className="flex items-center gap-4">
            {/* ── Dark mode toggle ─────────────── */}
            <button
              onClick={toggleTheme}
              className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-sm dark:bg-gray-800"
              title={
                theme === 'light'
                  ? t('common.theme.toDark')
                  : t('common.theme.toLight')
              }
            >
              {theme === 'light' ? (
                <MoonIcon size={16} />
              ) : (
                <SunIcon size={16} />
              )}
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {user?.email}
            </span>
            <button
              onClick={handleLogout}
              className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              {t('common.actions.logout')}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
