import { Bell, LogOut, Monitor, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useStudio } from '../context/StudioContext';
import { useTheme, type ThemeMode } from '../context/ThemeContext';

export function Navbar() {
  const { mode, setMode } = useTheme();
  const { clientUser, adminToken, unreadCount, logoutClient, logoutAdmin } = useStudio();
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const navigate = useNavigate();

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap shrink-0 py-1.5 text-sm font-medium transition-colors border-b-2 ${
      isActive
        ? 'text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400'
        : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-slate-100'
    }`;

  const themeOptions: { value: ThemeMode; label: string }[] = [
    { value: 'light', label: 'Mode Terang' },
    { value: 'dark', label: 'Mode Gelap' },
    { value: 'auto', label: 'Ikuti Perangkat' },
  ];

  const mobileItems = [
    { to: '/', label: 'Beranda' },
    { to: '/portofolio', label: 'Portofolio' },
    ...(!adminToken ? [{ to: '/pemesanan', label: 'Pemesanan' }] : []),
    ...(!adminToken ? [{ to: '/klien', label: 'Klien' }] : []),
    ...(!clientUser ? [{ to: '/admin', label: 'Admin' }] : []),
  ];

  return (
    <>
      <header className="no-print sticky top-0 z-40 h-16 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <Link
            to="/"
            className="text-lg font-display font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0"
          >
            PrangArt Lab
          </Link>

          {/* Zone 2: Clean Single-Line Nav Links */}
          <nav className="hidden md:flex items-center gap-7" aria-label="Navigasi utama">
            <NavLink to="/" end className={navLinkClass}>
              Beranda
            </NavLink>
            <NavLink to="/portofolio" className={navLinkClass}>
              Portofolio
            </NavLink>
            {!adminToken && (
              <NavLink to="/pemesanan" className={navLinkClass}>
                Pemesanan
              </NavLink>
            )}
            {!adminToken && (
              <NavLink to="/klien" className={navLinkClass}>
                Ruang Klien
              </NavLink>
            )}
            {!clientUser && (
              <NavLink to="/admin" className={navLinkClass}>
                Admin
              </NavLink>
            )}
          </nav>

          {/* Zone 3: Primary Action + Theme Control */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="relative">
              <button
                type="button"
                onClick={() => setThemeMenuOpen((o) => !o)}
                aria-label="Pilih tema tampilan"
                className="h-10 w-10 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-indigo-500/50 transition-colors flex items-center justify-center cursor-pointer"
              >
                {mode === 'dark' ? (
                  <Moon className="w-4 h-4" />
                ) : mode === 'light' ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Monitor className="w-4 h-4" />
                )}
              </button>
              {themeMenuOpen && (
                <div
                  onMouseLeave={() => setThemeMenuOpen(false)}
                  className="absolute right-0 mt-2 w-44 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg py-1 z-50"
                >
                  {themeOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setMode(opt.value);
                        setThemeMenuOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
                        mode === opt.value
                          ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/50'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {adminToken ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/admin')}
                  className="relative h-10 px-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:border-indigo-500 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Panel Admin</span>
                  {unreadCount > 0 && (
                    <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-indigo-600 text-white tabular-nums">
                      {unreadCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    logoutAdmin();
                    navigate('/');
                  }}
                  aria-label="Keluar Admin"
                  className="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Keluar</span>
                </button>
              </div>
            ) : clientUser ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/klien')}
                  className="h-10 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span className="max-w-[110px] truncate">{clientUser.name.split(' ')[0]}</span>
                  {unreadCount > 0 && (
                    <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-white/20 text-white tabular-nums">
                      {unreadCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    logoutClient();
                    navigate('/');
                  }}
                  aria-label="Keluar Akun"
                  className="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Keluar</span>
                </button>
              </div>
            ) : (
              <Link
                to="/klien"
                className="h-10 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors flex items-center whitespace-nowrap shrink-0"
              >
                Masuk Klien
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Compact Mobile Bottom Navigation (within 15% sticky height budget) */}
      <nav
        className="no-print md:hidden fixed bottom-0 inset-x-0 z-40 h-14 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 flex items-center justify-around"
        aria-label="Navigasi seluler"
      >
        {mobileItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                isActive
                  ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60'
                  : 'text-slate-600 dark:text-slate-400'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
