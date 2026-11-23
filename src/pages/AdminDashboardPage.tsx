import {
  Bell,
  CheckCheck,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Lock,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { DocumentsModal, type DocumentModalKind } from '../components/DocumentsModal';
import { TRACKER_MILESTONES, useStudio } from '../context/StudioContext';
import {
  formatDateTimeID,
  formatRupiah,
  getProjectPaymentAccess,
  normalizeWhatsAppNumber,
  safeExternalUrl,
} from '../lib/format';
import type { PortfolioItem, Project, ServiceCatalog, ServiceLineKey, StudioSettings, TestimonialItem } from '../types';

type AdminTab = 'projects' | 'catalog' | 'content' | 'clients';

export function AdminDashboardPage() {
  const {
    adminToken,
    adminConfigured,
    adminViaEnv,
    clientUser,
    wsConnected,
    soundEnabled,
    setSoundEnabled,
    projects,
    notifications,
    unreadCount,
    registeredClients,
    catalog,
    siteContent,
    setupAdminPasscode,
    loginAdmin,
    logoutClient,
    changeAdminPasscode,
    refreshAdminDashboard,
    adminUpdateProject,
    adminDeleteProject,
    markNotificationRead,
    markAllNotificationsRead,
    saveAdminCatalog,
    resetAdminCatalog,
    saveAdminSiteContent,
    resetAdminSiteContent,
    showToast,
  } = useStudio();

  // Auth Gate state
  const [passcodeInput, setPasscodeInput] = useState('');
  const [confirmPasscodeInput, setConfirmPasscodeInput] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Dashboard state
  const [activeTab, setActiveTab] = useState<AdminTab>('projects');
  const [notifOpen, setNotifOpen] = useState(true);
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_verify' | 'in_progress' | 'lunas'>('all');
  const [focusedProjectId, setFocusedProjectId] = useState<string | null>(null);
  const [docModal, setDocModal] = useState<{ project: Project | null; kind: DocumentModalKind | null }>({
    project: null,
    kind: null,
  });

  // Per-project inline inputs
  const [masterInputs, setMasterInputs] = useState<Record<string, string>>({});
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});

  // Catalog draft state
  const [catalogDraft, setCatalogDraft] = useState<ServiceCatalog | null>(null);
  const [catalogSaving, setCatalogSaving] = useState(false);

  // Site Content & Settings draft state
  const [newPortfolio, setNewPortfolio] = useState<Omit<PortfolioItem, 'id'>>({
    title: '',
    category: 'Musik Tari',
    culture: '',
    duration: '05:00',
    year: String(new Date().getFullYear()),
    image: '',
    audioDemoUrl: '',
    description: '',
  });
  const [newTestimonial, setNewTestimonial] = useState<Omit<TestimonialItem, 'id'>>({
    name: '',
    role: '',
    quote: '',
    outcome: '',
  });
  const [settingsDraft, setSettingsDraft] = useState<StudioSettings | null>(null);
  const [newAdminPin, setNewAdminPin] = useState('');

  useEffect(() => {
    if (catalog) {
      setCatalogDraft(JSON.parse(JSON.stringify(catalog)) as ServiceCatalog);
    }
  }, [catalog]);

  useEffect(() => {
    if (siteContent?.settings) {
      setSettingsDraft({ ...siteContent.settings });
    }
  }, [siteContent?.settings]);

  const kpiStats = useMemo(() => {
    let pendingVerify = 0;
    let inProgress = 0;
    let completed = 0;
    for (const p of projects) {
      const acc = getProjectPaymentAccess(p);
      if (acc.isFullyPaid) completed += 1;
      else if (acc.isDpSubmittedByClient || acc.isFinalSubmittedByClient) pendingVerify += 1;
      else if (acc.isDpVerified) inProgress += 1;
    }
    return { total: projects.length, pendingVerify, inProgress, completed };
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return projects.filter((p) => {
      const acc = getProjectPaymentAccess(p);
      if (statusFilter === 'pending_verify' && !acc.isDpSubmittedByClient && !acc.isFinalSubmittedByClient && !acc.isAwaitingDp) {
        return false;
      }
      if (statusFilter === 'in_progress' && !acc.isDpVerified) return false;
      if (statusFilter === 'lunas' && !acc.isFullyPaid) return false;

      if (!q) return true;
      return (
        p.judul.toLowerCase().includes(q) ||
        p.clientName.toLowerCase().includes(q) ||
        p.clientEmail.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
      );
    });
  }, [projects, searchQuery, statusFilter]);

  const displayedNotifications = useMemo(() => {
    return notifFilter === 'unread' ? notifications.filter((n) => !n.read) : notifications;
  }, [notifications, notifFilter]);

  if (clientUser) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-5">
        <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">
          Sesi Klien Sedang Aktif
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Anda sedang masuk sebagai Klien ({clientUser.email}). Keluar dari akun klien terlebih dahulu sebelum membuka Panel Admin.
        </p>
        <button
          type="button"
          onClick={() => logoutClient()}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors cursor-pointer"
        >
          Keluar dari Sesi Klien & Buka Login Admin
        </button>
      </div>
    );
  }

  // Admin Gate (First-run Setup or Login)
  if (!adminToken) {
    const handleAuthSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setAuthError('');
      setAuthLoading(true);
      try {
        if (adminConfigured === false) {
          if (passcodeInput !== confirmPasscodeInput) {
            const msg = 'Konfirmasi PIN Admin tidak sesuai.';
            setAuthError(msg);
            showToast('Tidak Cocok', msg, 'warning');
            return;
          }
          await setupAdminPasscode(passcodeInput);
        } else {
          await loginAdmin(passcodeInput);
        }
        setPasscodeInput('');
        setConfirmPasscodeInput('');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'PIN / Kata Sandi Admin salah.';
        setAuthError(msg);
        showToast('Akses Ditolak', msg, 'error');
      } finally {
        setAuthLoading(false);
      }
    };

    return (
      <div className="max-w-md mx-auto px-4 py-16 lg:py-24">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 sm:p-8 shadow-sm space-y-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">
              <Lock className="w-3.5 h-3.5" />
              <span>Admin Studio</span>
            </div>
            <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">
              {adminConfigured === false ? 'Buat PIN Admin Pertama Kali' : 'Masuk Panel Admin'}
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {adminConfigured === false
                ? 'Belum ada PIN Admin yang tersimpan. Tentukan PIN atau kata sandi Admin untuk mengamankan studio Anda.'
                : 'Masukkan PIN Admin untuk mengelola pesanan klien, verifikasi pembayaran, dan notifikasi real-time.'}
            </p>
          </div>

          {adminViaEnv && (
            <div className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/70 dark:bg-indigo-950/30 p-3.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              PIN Admin saat ini aktif melalui variabel rahasia <strong className="font-mono">ADMIN_PASSCODE</strong> pada panel{' '}
              <strong>Settings → Secrets</strong>. Untuk mengganti atau mereset PIN, ubah nilai{' '}
              <strong className="font-mono">ADMIN_PASSCODE</strong> pada panel Secrets lalu muat ulang server.
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5">
                {adminConfigured === false ? 'PIN / Kata Sandi Baru (Min. 4 karakter)' : 'PIN Admin'}
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  minLength={4}
                  value={passcodeInput}
                  onChange={(e) => {
                    setPasscodeInput(e.target.value);
                    if (authError) setAuthError('');
                  }}
                  placeholder="Masukkan PIN Admin"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 pr-11 text-sm font-mono tracking-wider"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label="Lihat PIN"
                  className="absolute inset-y-0 right-0 px-3.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {adminConfigured === false && (
              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  Konfirmasi PIN / Kata Sandi Admin
                </label>
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  minLength={4}
                  value={confirmPasscodeInput}
                  onChange={(e) => {
                    setConfirmPasscodeInput(e.target.value);
                    if (authError) setAuthError('');
                  }}
                  placeholder="Ulangi PIN Admin"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm font-mono tracking-wider"
                />
              </div>
            )}

            {authError && (
              <p className="text-xs font-medium text-red-600 dark:text-red-400" role="alert">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={authLoading || adminConfigured === null}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              {authLoading
                ? 'Memverifikasi...'
                : adminConfigured === false
                ? 'Simpan & Buka Panel Admin'
                : 'Masuk Panel Admin'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const jumpToProject = (projectId?: string, notifId?: string) => {
    if (notifId) void markNotificationRead(notifId);
    if (!projectId) return;
    setActiveTab('projects');
    setStatusFilter('all');
    setSearchQuery('');
    setFocusedProjectId(projectId);
    setTimeout(() => {
      document.getElementById(`admin-proj-${projectId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  };

  const handleSaveCatalog = async () => {
    if (!catalogDraft) return;
    setCatalogSaving(true);
    try {
      await saveAdminCatalog(catalogDraft);
    } catch (err: unknown) {
      showToast('Gagal Simpan', err instanceof Error ? err.message : 'Error', 'error');
    } finally {
      setCatalogSaving(false);
    }
  };

  const handleAddPortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteContent) return;
    const nextItem: PortfolioItem = {
      ...newPortfolio,
      id: `pf-${Date.now()}`,
    };
    try {
      await saveAdminSiteContent({ portfolio: [nextItem, ...siteContent.portfolio] });
      setNewPortfolio({
        title: '',
        category: 'Musik Tari',
        culture: '',
        duration: '05:00',
        year: String(new Date().getFullYear()),
        image: '',
        audioDemoUrl: '',
        description: '',
      });
    } catch (err: unknown) {
      showToast('Gagal Tambah', err instanceof Error ? err.message : 'Error', 'error');
    }
  };

  const handleRemovePortfolio = async (id: string) => {
    if (!siteContent) return;
    await saveAdminSiteContent({
      portfolio: siteContent.portfolio.filter((p) => p.id !== id),
    });
  };

  const handleAddTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteContent) return;
    const nextItem: TestimonialItem = {
      ...newTestimonial,
      id: `tm-${Date.now()}`,
    };
    await saveAdminSiteContent({ testimonials: [nextItem, ...siteContent.testimonials] });
    setNewTestimonial({ name: '', role: '', quote: '', outcome: '' });
  };

  const handleRemoveTestimonial = async (id: string) => {
    if (!siteContent) return;
    await saveAdminSiteContent({
      testimonials: siteContent.testimonials.filter((t) => t.id !== id),
    });
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsDraft) return;
    await saveAdminSiteContent({ settings: settingsDraft });
  };

  const handleChangeAdminPin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await changeAdminPasscode(newAdminPin);
      setNewAdminPin('');
    } catch (err: unknown) {
      showToast('Gagal Ganti PIN', err instanceof Error ? err.message : 'Error', 'error');
    }
  };

  const inputCls =
    'w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 pb-24 space-y-8">
      {/* Top Toolbar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">Admin Studio</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <span
                className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}
              />
              {wsConnected ? 'WebSocket Real-Time Aktif' : 'Menghubungkan...'}
            </span>
          </div>
          <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">
            Dashboard Produksi & Aktivitas Klien
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5 cursor-pointer"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-indigo-600" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{soundEnabled ? 'Suara Aktif' : 'Bisu'}</span>
          </button>

          <button
            type="button"
            onClick={() => setNotifOpen((o) => !o)}
            className="h-9 px-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center gap-2 cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Notifikasi Real-Time</span>
            <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[11px] tabular-nums">
              {unreadCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => void refreshAdminDashboard()}
            className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Muat Ulang</span>
          </button>
        </div>
      </div>

      {/* Real-Time Notification Center */}
      {notifOpen && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-display font-bold text-slate-900 dark:text-slate-100">
                Feed Notifikasi Aktivitas Klien
              </h2>
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setNotifFilter('all')}
                  className={`px-2.5 py-1 rounded-md font-medium cursor-pointer ${
                    notifFilter === 'all'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-500'
                  }`}
                >
                  Semua ({notifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => setNotifFilter('unread')}
                  className={`px-2.5 py-1 rounded-md font-medium cursor-pointer ${
                    notifFilter === 'unread'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-500'
                  }`}
                >
                  Belum Dibaca ({unreadCount})
                </button>
              </div>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllNotificationsRead()}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Tandai Semua Dibaca</span>
              </button>
            )}
          </div>

          {displayedNotifications.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              Belum ada notifikasi pada filter ini. Setiap pesanan baru, konfirmasi DP/pelunasan, atau catatan klien akan muncul otomatis di sini.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto">
              {displayedNotifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => jumpToProject(n.projectId, n.id)}
                  className={`py-3 px-2 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                    n.read ? 'opacity-65' : ''
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 text-xs">
                      {!n.read && (
                        <span className="font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                          BARU
                        </span>
                      )}
                      <strong className="text-slate-900 dark:text-slate-100">{n.title}</strong>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{n.message}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-[11px] font-mono text-slate-500">
                    <span>{formatDateTimeID(n.createdAt)}</span>
                    {n.projectId && (
                      <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                        Buka Proyek →
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <span className="text-xs text-slate-500">Total Proyek</span>
          <div className="text-2xl font-mono font-bold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
            {kpiStats.total}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <span className="text-xs text-slate-500">Menunggu Verifikasi Bayar</span>
          <div className="text-2xl font-mono font-bold text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
            {kpiStats.pendingVerify}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <span className="text-xs text-slate-500">Dalam Produksi (DP Sah)</span>
          <div className="text-2xl font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-1 tabular-nums">
            {kpiStats.inProgress}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <span className="text-xs text-slate-500">Lunas & Selesai</span>
          <div className="text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
            {kpiStats.completed}
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 self-start w-fit">
        {(
          [
            { key: 'projects', label: `Proyek & Pembayaran (${projects.length})` },
            { key: 'catalog', label: 'Katalog Tarif' },
            { key: 'content', label: 'Portofolio, Testimoni & Pengaturan' },
            { key: 'clients', label: `Data Klien (${registeredClients.length})` },
          ] as { key: AdminTab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === tab.key
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: PROJECTS & CLIENT SUBMISSIONS */}
      {activeTab === 'projects' && (
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari judul karya, nama klien, email, atau ID proyek..."
              className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm"
            />
            <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              {(
                [
                  { k: 'all', l: 'Semua' },
                  { k: 'pending_verify', l: 'Perlu Cek Bayar' },
                  { k: 'in_progress', l: 'Produksi' },
                  { k: 'lunas', l: 'Lunas' },
                ] as const
              ).map((f) => (
                <button
                  key={f.k}
                  type="button"
                  onClick={() => setStatusFilter(f.k)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    statusFilter === f.k
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-500'
                  }`}
                >
                  {f.l}
                </button>
              ))}
            </div>
          </div>

          {filteredProjects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center text-sm text-slate-500">
              Tidak ada proyek yang cocok dengan filter saat ini.
            </div>
          ) : (
            <div className="space-y-6">
              {filteredProjects.map((p) => {
                const access = getProjectPaymentAccess(p);
                const clientWa = normalizeWhatsAppNumber(p.clientWa);
                const isFocused = focusedProjectId === p.id;
                const masterVal = masterInputs[p.id] ?? p.masterFileUrl ?? '';

                return (
                  <article
                    key={p.id}
                    id={`admin-proj-${p.id}`}
                    className={`rounded-2xl border bg-white dark:bg-slate-900 p-6 space-y-5 transition-colors ${
                      isFocused
                        ? 'border-indigo-600 ring-2 ring-indigo-600/20'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                      <div className="space-y-1">
                        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5">
                          <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                            {p.id}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{p.serviceLineLabel}</span>
                          <span aria-hidden="true">·</span>
                          <span>{p.packageName}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">Durasi {p.durasi}</span>
                        </div>
                        <h3 className="text-lg font-display font-bold text-slate-900 dark:text-slate-100">
                          {p.judul}
                        </h3>
                        <div className="text-xs text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-2">
                          <strong>{p.clientName}</strong>
                          <span>·</span>
                          <span>{p.contactEmail}</span>
                          <span>·</span>
                          {clientWa ? (
                            <a
                              href={`https://wa.me/${clientWa}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                            >
                              WA: {p.clientWa}
                            </a>
                          ) : (
                            <span>WA: {p.clientWa}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
                        <div className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                          Total {formatRupiah(p.totalPrice)} (DP {formatRupiah(p.dpAmount)})
                        </div>
                        <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                          {access.isFullyPaid
                            ? 'Lunas 100% Terverifikasi'
                            : access.isFinalSubmittedByClient
                            ? 'Klien Konfirmasi Pelunasan (Perlu Verifikasi)'
                            : access.isDpVerified
                            ? 'DP 50% Terverifikasi'
                            : access.isDpSubmittedByClient
                            ? 'Klien Konfirmasi DP 50% (Perlu Verifikasi)'
                            : 'Menunggu Pembayaran DP 50%'}
                        </div>
                      </div>
                    </div>

                    {/* Client Payment Confirmations Received */}
                    {p.paymentConfirmations.length > 0 && (
                      <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20 p-4 space-y-2.5">
                        <span className="text-xs font-bold text-amber-800 dark:text-amber-300 block">
                          Konfirmasi Pembayaran yang Diisi Klien ({p.paymentConfirmations.length})
                        </span>
                        <div className="space-y-2">
                          {p.paymentConfirmations.map((pc) => {
                            const proofLink = safeExternalUrl(pc.proofUrl);
                            return (
                              <div
                                key={pc.id}
                                className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 text-xs flex flex-wrap items-center justify-between gap-2"
                              >
                                <div className="space-y-0.5">
                                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                                    {pc.stage === 'DP_50' ? 'DP 50%' : 'Pelunasan 50%'} ·{' '}
                                    <span className="font-mono">{formatRupiah(pc.amount)}</span> via {pc.bankMethod}
                                  </div>
                                  <div className="text-slate-600 dark:text-slate-400">
                                    Pengirim: <strong>{pc.senderName}</strong> · Tgl Transfer: {pc.transferDate}
                                    {pc.referenceNote ? ` · Catatan: "${pc.referenceNote}"` : ''}
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  {proofLink && (
                                    <a
                                      href={proofLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline inline-flex items-center gap-1"
                                    >
                                      <span>Lihat Bukti</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                  <span className="font-mono text-[11px] text-slate-500">
                                    {formatDateTimeID(pc.submittedAt)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Action Controls */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                      <div className="lg:col-span-5 flex flex-wrap gap-2">
                        {!access.isDpVerified && !access.isFullyPaid && (
                          <button
                            type="button"
                            onClick={() => void adminUpdateProject(p.id, { action: 'VERIFY_DP' })}
                            className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Verifikasi DP 50%</span>
                          </button>
                        )}
                        {!access.isFullyPaid && (
                          <button
                            type="button"
                            onClick={() => void adminUpdateProject(p.id, { action: 'VERIFY_LUNAS' })}
                            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Verifikasi Lunas 100%</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDocModal({ project: p, kind: 'brief' })}
                          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Brief</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDocModal({ project: p, kind: 'contract' })}
                          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                        >
                          SPK
                        </button>
                        {access.isFullyPaid && (
                          <button
                            type="button"
                            onClick={() => setDocModal({ project: p, kind: 'receipt' })}
                            className="px-3 py-2 rounded-xl border border-emerald-500 text-emerald-700 dark:text-emerald-400 text-xs font-semibold cursor-pointer"
                          >
                            Kuitansi Lunas
                          </button>
                        )}
                      </div>

                      <div className="lg:col-span-3">
                        <select
                          aria-label="Ubah status milestone produksi"
                          value={p.productionStatus}
                          onChange={(e) =>
                            void adminUpdateProject(p.id, { productionStatus: e.target.value })
                          }
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                        >
                          {TRACKER_MILESTONES.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="lg:col-span-4 flex gap-2">
                        <input
                          type="url"
                          value={masterVal}
                          onChange={(e) =>
                            setMasterInputs((prev) => ({ ...prev, [p.id]: e.target.value }))
                          }
                          placeholder="Tautan Master File (https://...)"
                          className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            void adminUpdateProject(p.id, { masterFileUrl: masterVal.trim() })
                          }
                          className="px-3 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold shrink-0 cursor-pointer"
                        >
                          Simpan Link
                        </button>
                      </div>
                    </div>

                    {/* Client Inputs & Synopsis Drawer */}
                    <details className="text-xs border-t border-slate-100 dark:border-slate-800 pt-4">
                      <summary className="cursor-pointer font-semibold text-indigo-600 dark:text-indigo-400">
                        Lihat Semua Data Isian Klien ({p.specs.length} spesifikasi
                        {p.sinopsis ? ' + Sinopsis' : ''}
                        {p.videoLink ? ' + Referensi' : ''})
                      </summary>
                      <div className="mt-3 space-y-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4">
                        {p.specs.map((s, idx) => (
                          <div
                            key={idx}
                            className="grid grid-cols-1 sm:grid-cols-3 gap-1 py-1.5 border-b border-slate-200/60 dark:border-slate-800/60 last:border-0"
                          >
                            <span className="text-slate-500 font-medium">{s.key}</span>
                            <span className="sm:col-span-2 text-slate-900 dark:text-slate-100">{s.val}</span>
                          </div>
                        ))}
                        {p.videoLink && (
                          <div className="pt-2">
                            <span className="text-slate-500 font-medium">Referensi Klien: </span>
                            <a
                              href={safeExternalUrl(p.videoLink) || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 dark:text-indigo-400 underline break-all"
                            >
                              {p.videoLink}
                            </a>
                          </div>
                        )}
                        {p.sinopsis && (
                          <div className="pt-2">
                            <span className="text-slate-500 font-medium block mb-1">Sinopsis Tari:</span>
                            <p className="text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                              {p.sinopsis}
                            </p>
                          </div>
                        )}
                      </div>
                    </details>

                    {/* Notes & Admin Reply */}
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Catatan Klien & Balasan Studio ({p.notes.length})</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => void adminDeleteProject(p.id)}
                          className="text-xs text-red-600 dark:text-red-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus Proyek</span>
                        </button>
                      </div>

                      {p.notes.length > 0 && (
                        <div className="space-y-2 max-h-44 overflow-y-auto">
                          {p.notes.map((n) => (
                            <div
                              key={n.id}
                              className={`rounded-xl px-3.5 py-2.5 text-xs border ${
                                n.authorRole === 'admin'
                                  ? 'border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/30'
                                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950'
                              }`}
                            >
                              <div className="flex justify-between gap-2 mb-0.5">
                                <strong>{n.authorName}</strong>
                                <span className="font-mono text-[11px] text-slate-500">
                                  {formatDateTimeID(n.createdAt)}
                                </span>
                              </div>
                              <p className="text-slate-700 dark:text-slate-300">{n.message}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <input
                          value={replyInputs[p.id] || ''}
                          onChange={(e) =>
                            setReplyInputs((prev) => ({ ...prev, [p.id]: e.target.value }))
                          }
                          placeholder="Tulis balasan atau progres untuk klien (klien menerima notifikasi langsung)..."
                          className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const txt = (replyInputs[p.id] || '').trim();
                            if (!txt) return;
                            void adminUpdateProject(p.id, { adminReply: txt }).then(() => {
                              setReplyInputs((prev) => ({ ...prev, [p.id]: '' }));
                            });
                          }}
                          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Balas Klien</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* TAB 2: CATALOG EDITOR */}
      {activeTab === 'catalog' && catalogDraft && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-display font-bold text-slate-900 dark:text-slate-100">
                Pengaturan Tarif, Fasilitas & Alur Layanan
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Perubahan langsung disinkronkan ke halaman Pemesanan Klien.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void resetAdminCatalog()}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
              >
                Reset Standar
              </button>
              <button
                type="button"
                disabled={catalogSaving}
                onClick={() => void handleSaveCatalog()}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
              >
                {catalogSaving ? 'Menyimpan...' : 'Simpan Katalog'}
              </button>
            </div>
          </div>

          <div className="space-y-8">
            {(['tari', 'digital', 'transkripsi'] as ServiceLineKey[]).map((svcKey) => {
              const svc = catalogDraft[svcKey];
              return (
                <div
                  key={svcKey}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-5 space-y-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                    <h3 className="text-sm font-display font-bold text-indigo-600 dark:text-indigo-400">
                      {svc.label}
                    </h3>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500">Add-on Vokal/Player (Rp):</span>
                      <input
                        type="number"
                        value={svc.addonPrice}
                        onChange={(e) =>
                          setCatalogDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  [svcKey]: { ...prev[svcKey], addonPrice: Number(e.target.value || 0) },
                                }
                              : prev
                          )
                        }
                        className="w-32 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {Object.entries(svc.packages).map(([pkgKey, pkg]) => {
                      const isCustom = pkgKey === 'custom' || Boolean(pkg.isCustom);
                      return (
                        <div
                          key={pkgKey}
                          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                                Label Paket
                              </label>
                              <input
                                value={pkg.label}
                                onChange={(e) =>
                                  setCatalogDraft((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          [svcKey]: {
                                            ...prev[svcKey],
                                            packages: {
                                              ...prev[svcKey].packages,
                                              [pkgKey]: { ...pkg, label: e.target.value },
                                            },
                                          },
                                        }
                                      : prev
                                  )
                                }
                                className={inputCls}
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                                Harga (Rp)
                              </label>
                              <input
                                type="number"
                                readOnly={isCustom}
                                value={pkg.price}
                                onChange={(e) =>
                                  setCatalogDraft((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          [svcKey]: {
                                            ...prev[svcKey],
                                            packages: {
                                              ...prev[svcKey].packages,
                                              [pkgKey]: { ...pkg, price: Number(e.target.value || 0) },
                                            },
                                          },
                                        }
                                      : prev
                                  )
                                }
                                className={`${inputCls} font-mono ${isCustom ? 'opacity-60' : ''}`}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                              Ringkasan
                            </label>
                            <textarea
                              rows={2}
                              value={pkg.summary}
                              onChange={(e) =>
                                setCatalogDraft((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        [svcKey]: {
                                          ...prev[svcKey],
                                          packages: {
                                            ...prev[svcKey].packages,
                                            [pkgKey]: { ...pkg, summary: e.target.value },
                                          },
                                        },
                                      }
                                    : prev
                                )
                              }
                              className={inputCls}
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                              Fasilitas (1 poin per baris)
                            </label>
                            <textarea
                              rows={3}
                              value={pkg.features.join('\n')}
                              onChange={(e) =>
                                setCatalogDraft((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        [svcKey]: {
                                          ...prev[svcKey],
                                          packages: {
                                            ...prev[svcKey].packages,
                                            [pkgKey]: {
                                              ...pkg,
                                              features: e.target.value
                                                .split('\n')
                                                .map((l) => l.trim())
                                                .filter(Boolean),
                                            },
                                          },
                                        },
                                      }
                                    : prev
                                )
                              }
                              className={inputCls}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* TAB 3: PUBLIC CONTENT & STUDIO SETTINGS */}
      {activeTab === 'content' && siteContent && settingsDraft && (
        <section className="space-y-8">
          {/* Studio Settings + Admin PIN */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form
              onSubmit={handleSaveSettings}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
            >
              <h2 className="text-base font-display font-bold text-slate-900 dark:text-slate-100">
                Pengaturan Kontak & Rekening Studio
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Nomor WhatsApp Studio (62...)</label>
                  <input
                    required
                    value={settingsDraft.studioWhatsApp}
                    onChange={(e) =>
                      setSettingsDraft((p) => (p ? { ...p, studioWhatsApp: e.target.value } : p))
                    }
                    className={`${inputCls} font-mono`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Email Studio</label>
                  <input
                    type="email"
                    required
                    value={settingsDraft.studioEmail}
                    onChange={(e) =>
                      setSettingsDraft((p) => (p ? { ...p, studioEmail: e.target.value } : p))
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Nama Bank / E-Wallet</label>
                  <input
                    required
                    value={settingsDraft.studioBankName}
                    onChange={(e) =>
                      setSettingsDraft((p) => (p ? { ...p, studioBankName: e.target.value } : p))
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Nomor Rekening</label>
                  <input
                    required
                    value={settingsDraft.studioBankAccount}
                    onChange={(e) =>
                      setSettingsDraft((p) => (p ? { ...p, studioBankAccount: e.target.value } : p))
                    }
                    className={`${inputCls} font-mono`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Atas Nama Rekening</label>
                  <input
                    required
                    value={settingsDraft.studioBankHolder}
                    onChange={(e) =>
                      setSettingsDraft((p) => (p ? { ...p, studioBankHolder: e.target.value } : p))
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Alamat / Kota Studio</label>
                  <input
                    required
                    value={settingsDraft.studioAddress}
                    onChange={(e) =>
                      setSettingsDraft((p) => (p ? { ...p, studioAddress: e.target.value } : p))
                    }
                    className={inputCls}
                  />
                </div>
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
              >
                Simpan Pengaturan Studio
              </button>
            </form>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
              <h2 className="text-base font-display font-bold text-slate-900 dark:text-slate-100">
                Keamanan & Reset Konten
              </h2>
              {adminViaEnv ? (
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  PIN Admin saat ini dikelola melalui variabel environment <code className="font-mono">ADMIN_PASSCODE</code>.
                </p>
              ) : (
                <form onSubmit={handleChangeAdminPin} className="space-y-3">
                  <label className="block text-xs font-semibold">Ubah PIN Admin Baru (Min. 4 karakter)</label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      required
                      minLength={4}
                      value={newAdminPin}
                      onChange={(e) => setNewAdminPin(e.target.value)}
                      placeholder="PIN Admin baru"
                      className={`${inputCls} font-mono`}
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold shrink-0 cursor-pointer"
                    >
                      Ubah PIN
                    </button>
                  </div>
                </form>
              )}

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <span className="text-xs text-slate-500">
                  Kembalikan daftar portofolio & testimoni ke bawaan studio:
                </span>
                <button
                  type="button"
                  onClick={() => void resetAdminSiteContent()}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer shrink-0"
                >
                  Reset Konten Publik
                </button>
              </div>
            </div>
          </div>

          {/* Portfolio & Testimonial Managers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
              <h2 className="text-base font-display font-bold text-slate-900 dark:text-slate-100">
                Kelola Portofolio ({siteContent.portfolio.length})
              </h2>
              <form onSubmit={handleAddPortfolio} className="space-y-3">
                <input
                  required
                  value={newPortfolio.title}
                  onChange={(e) => setNewPortfolio((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Judul karya portofolio *"
                  className={inputCls}
                />
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={newPortfolio.category}
                    onChange={(e) =>
                      setNewPortfolio((p) => ({
                        ...p,
                        category: e.target.value as PortfolioItem['category'],
                      }))
                    }
                    className={inputCls}
                  >
                    <option value="Musik Tari">Musik Tari</option>
                    <option value="Musik Non-Tari">Musik Non-Tari</option>
                    <option value="Transkripsi">Transkripsi</option>
                  </select>
                  <input
                    required
                    value={newPortfolio.culture}
                    onChange={(e) => setNewPortfolio((p) => ({ ...p, culture: e.target.value }))}
                    placeholder="Budaya / Gaya Musik *"
                    className={inputCls}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    required
                    value={newPortfolio.duration}
                    onChange={(e) => setNewPortfolio((p) => ({ ...p, duration: e.target.value }))}
                    placeholder="Durasi (05:30)"
                    className={`${inputCls} font-mono`}
                  />
                  <input
                    required
                    value={newPortfolio.year}
                    onChange={(e) => setNewPortfolio((p) => ({ ...p, year: e.target.value }))}
                    placeholder="Tahun"
                    className={`${inputCls} font-mono`}
                  />
                </div>
                <input
                  type="url"
                  value={newPortfolio.image || ''}
                  onChange={(e) => setNewPortfolio((p) => ({ ...p, image: e.target.value }))}
                  placeholder="URL Gambar Sampul (Opsional, https://...)"
                  className={inputCls}
                />
                <textarea
                  required
                  rows={2}
                  value={newPortfolio.description}
                  onChange={(e) => setNewPortfolio((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Deskripsi singkat karya *"
                  className={inputCls}
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Portofolio</span>
                </button>
              </form>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 pt-2">
                {siteContent.portfolio.map((item) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <strong className="text-slate-900 dark:text-slate-100 block">{item.title}</strong>
                      <span className="text-slate-500">
                        {item.category} · {item.duration}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleRemovePortfolio(item.id)}
                      className="text-red-600 dark:text-red-400 font-semibold hover:underline cursor-pointer"
                    >
                      Hapus
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
              <h2 className="text-base font-display font-bold text-slate-900 dark:text-slate-100">
                Kelola Testimoni ({siteContent.testimonials.length})
              </h2>
              <form onSubmit={handleAddTestimonial} className="space-y-3">
                <input
                  required
                  value={newTestimonial.name}
                  onChange={(e) => setNewTestimonial((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Nama klien *"
                  className={inputCls}
                />
                <input
                  required
                  value={newTestimonial.role}
                  onChange={(e) => setNewTestimonial((p) => ({ ...p, role: e.target.value }))}
                  placeholder="Jabatan / Sanggar / Instansi *"
                  className={inputCls}
                />
                <input
                  value={newTestimonial.outcome}
                  onChange={(e) => setNewTestimonial((p) => ({ ...p, outcome: e.target.value }))}
                  placeholder="Hasil / Paket yang dipakai (cth: Selesai 7 hari · Paket Pro)"
                  className={inputCls}
                />
                <textarea
                  required
                  rows={3}
                  value={newTestimonial.quote}
                  onChange={(e) => setNewTestimonial((p) => ({ ...p, quote: e.target.value }))}
                  placeholder="Isi testimoni *"
                  className={inputCls}
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Testimoni</span>
                </button>
              </form>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 pt-2">
                {siteContent.testimonials.map((t) => (
                  <div key={t.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <strong className="text-slate-900 dark:text-slate-100 block">{t.name}</strong>
                      <span className="text-slate-500">{t.role}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleRemoveTestimonial(t.id)}
                      className="text-red-600 dark:text-red-400 font-semibold hover:underline cursor-pointer"
                    >
                      Hapus
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* TAB 4: REGISTERED CLIENTS */}
      {activeTab === 'clients' && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-base font-display font-bold text-slate-900 dark:text-slate-100">
              Akun Klien Terdaftar ({registeredClients.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-semibold">Nama Klien</th>
                  <th className="px-6 py-3 font-semibold">Email</th>
                  <th className="px-6 py-3 font-semibold">WhatsApp</th>
                  <th className="px-6 py-3 font-semibold text-right">Jumlah Proyek</th>
                  <th className="px-6 py-3 font-semibold text-right">Terdaftar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {registeredClients.map((u) => {
                  const count = projects.filter((p) => p.clientEmail === u.email).length;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                      <td className="px-6 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                        {u.name}
                      </td>
                      <td className="px-6 py-3.5 text-slate-600 dark:text-slate-400">{u.email}</td>
                      <td className="px-6 py-3.5 font-mono text-slate-600 dark:text-slate-400">
                        {u.wa || '-'}
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono font-bold tabular-nums">
                        {count}
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono text-slate-500">
                        {formatDateTimeID(u.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <DocumentsModal
        project={docModal.project}
        kind={docModal.kind}
        onClose={() => setDocModal({ project: null, kind: null })}
      />
    </div>
  );
}
