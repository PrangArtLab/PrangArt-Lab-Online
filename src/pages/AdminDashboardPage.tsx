import {
  Bell,
  BookOpen,
  Calendar,
  CheckCheck,
  CheckCircle2,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Lock,
  LogIn,
  LogOut,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { DocumentsModal, type DocumentModalKind } from '../components/DocumentsModal';
import { TRACKER_MILESTONES, useStudio } from '../context/StudioContext';
import {
  formatDateShortID,
  formatDateTimeID,
  formatRupiah,
  getProjectFinanceSummary,
  getProjectPaymentAccess,
  normalizeWhatsAppNumber,
  safeExternalUrl,
} from '../lib/format';
import { downloadMasterRecapPdf, downloadOrderDataPdf } from '../lib/pdfExport';
import type { PortfolioItem, Project, ServiceCatalog, ServiceLineKey, StudioSettings, TestimonialItem } from '../types';

type AdminTab = 'overview' | 'projects' | 'recap' | 'catalog' | 'content' | 'clients';

const ADMIN_TAB_KEY = 'pal_admin_tab';
const ADMIN_SEARCH_KEY = 'pal_admin_search';
const ADMIN_STATUS_FILTER_KEY = 'pal_admin_status_filter';

export function AdminDashboardPage() {
  const {
    bootLoading,
    adminToken,
    adminProfile,
    wsConnected,
    soundEnabled,
    setSoundEnabled,
    adminProjects,
    adminNotifications,
    adminUnreadCount,
    registeredClients,
    catalog,
    siteContent,
    clientUser,
    loginAdminWithGoogle,
    logoutAdmin,
    refreshAdminDashboard,
    adminUpdateProject,
    adminDeleteProject,
    markAdminNotificationRead,
    markAllAdminNotificationsRead,
    saveAdminCatalog,
    resetAdminCatalog,
    saveAdminSiteContent,
    resetAdminSiteContent,
    showToast,
  } = useStudio();

  // Admin Login Gate State
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Persisted Sidebar Dashboard State
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    try {
      const saved = localStorage.getItem(ADMIN_TAB_KEY) as AdminTab | null;
      if (saved && ['overview', 'projects', 'recap', 'catalog', 'content', 'clients'].includes(saved)) {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'overview';
  });

  const [searchQuery, setSearchQuery] = useState<string>(() => {
    try {
      return localStorage.getItem(ADMIN_SEARCH_KEY) || '';
    } catch {
      return '';
    }
  });

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_verify' | 'in_progress' | 'lunas'>(() => {
    try {
      const saved = localStorage.getItem(ADMIN_STATUS_FILTER_KEY);
      if (saved && ['all', 'pending_verify', 'in_progress', 'lunas'].includes(saved)) {
        return saved as 'all' | 'pending_verify' | 'in_progress' | 'lunas';
      }
    } catch {
      // ignore
    }
    return 'all';
  });

  const [notifFilter, setNotifFilter] = useState<'all' | 'unread'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [focusedProjectId, setFocusedProjectId] = useState<string | null>(null);
  const [docModal, setDocModal] = useState<{ project: Project | null; kind: DocumentModalKind | null }>({
    project: null,
    kind: null,
  });

  // Per-project inline inputs & loading/confirmation states
  const [masterInputs, setMasterInputs] = useState<Record<string, string>>({});
  const [finishingDateInputs, setFinishingDateInputs] = useState<Record<string, string>>({});
  const [finishingNotesInputs, setFinishingNotesInputs] = useState<Record<string, string>>({});
  const [busyProjectId, setBusyProjectId] = useState<string | null>(null);
  const [confirmDeleteProjectId, setConfirmDeleteProjectId] = useState<string | null>(null);
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});

  // Recap & Finance Tab Filter States
  const [recapView, setRecapView] = useState<'works' | 'finance' | 'clients'>('works');
  const [recapSearch, setRecapSearch] = useState('');
  const [recapServiceFilter, setRecapServiceFilter] = useState<'all' | ServiceLineKey>('all');
  const [recapPayFilter, setRecapPayFilter] = useState<'all' | 'awaiting_dp' | 'dp_paid' | 'lunas'>('all');

  // Catalog draft state
  const [catalogDraft, setCatalogDraft] = useState<ServiceCatalog | null>(null);
  const [catalogSaving, setCatalogSaving] = useState(false);

  // Site Content & Settings draft state (Text-only Portfolio, Zero Images)
  const [editingPortfolioId, setEditingPortfolioId] = useState<string | null>(null);
  const [newPortfolio, setNewPortfolio] = useState<Omit<PortfolioItem, 'id'>>({
    title: '',
    category: 'Musik Tari',
    culture: '',
    duration: '05:00',
    year: String(new Date().getFullYear()),
    audioDemoUrl: '',
    description: '',
  });
  const [editingTestimonialId, setEditingTestimonialId] = useState<string | null>(null);
  const [newTestimonial, setNewTestimonial] = useState<Omit<TestimonialItem, 'id'>>({
    name: '',
    role: '',
    quote: '',
    outcome: '',
  });
  const [settingsDraft, setSettingsDraft] = useState<StudioSettings | null>(null);
  const [contentSaving, setContentSaving] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(ADMIN_TAB_KEY, activeTab);
    } catch {
      // ignore
    }
  }, [activeTab]);

  useEffect(() => {
    try {
      localStorage.setItem(ADMIN_SEARCH_KEY, searchQuery);
    } catch {
      // ignore
    }
  }, [searchQuery]);

  useEffect(() => {
    try {
      localStorage.setItem(ADMIN_STATUS_FILTER_KEY, statusFilter);
    } catch {
      // ignore
    }
  }, [statusFilter]);

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
    for (const p of adminProjects) {
      const acc = getProjectPaymentAccess(p);
      if (acc.isFullyPaid) completed += 1;
      else if (acc.isDpSubmittedByClient || acc.isFinalSubmittedByClient) pendingVerify += 1;
      else if (acc.isDpVerified) inProgress += 1;
    }
    return { total: adminProjects.length, pendingVerify, inProgress, completed };
  }, [adminProjects]);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return adminProjects.filter((p) => {
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
  }, [adminProjects, searchQuery, statusFilter]);

  const displayedNotifications = useMemo(() => {
    return notifFilter === 'unread'
      ? adminNotifications.filter((n) => !n.read)
      : adminNotifications;
  }, [adminNotifications, notifFilter]);

  const recapProjects = useMemo(() => {
    const q = recapSearch.trim().toLowerCase();
    return adminProjects.filter((p) => {
      if (recapServiceFilter !== 'all' && p.serviceLine !== recapServiceFilter) return false;
      const fin = getProjectFinanceSummary(p);
      if (recapPayFilter === 'awaiting_dp' && (fin.isDpVerified || fin.isFullyPaid)) return false;
      if (recapPayFilter === 'dp_paid' && (!fin.isDpVerified || fin.isFullyPaid)) return false;
      if (recapPayFilter === 'lunas' && !fin.isFullyPaid) return false;
      if (!q) return true;
      return (
        p.judul.toLowerCase().includes(q) ||
        p.clientName.toLowerCase().includes(q) ||
        p.clientEmail.toLowerCase().includes(q) ||
        p.clientWa.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
      );
    });
  }, [adminProjects, recapSearch, recapServiceFilter, recapPayFilter]);

  const recapTotals = useMemo(() => {
    let totalContract = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;
    let finishedCount = 0;
    let dpObligation = 0;
    for (const p of recapProjects) {
      const fin = getProjectFinanceSummary(p);
      totalContract += fin.totalPrice;
      totalCollected += fin.verifiedPaidAmount;
      totalOutstanding += fin.outstandingAmount;
      dpObligation += fin.dpAmount;
      if (fin.isFullyPaid || Boolean(p.finishingDate)) finishedCount += 1;
    }
    return { totalContract, totalCollected, totalOutstanding, finishedCount, dpObligation };
  }, [recapProjects]);

  const recapConsumers = useMemo(() => {
    const map = new Map<
      string,
      {
        email: string;
        name: string;
        wa: string;
        projects: Project[];
        totalSpend: number;
        totalPaid: number;
        totalOutstanding: number;
        createdAt?: string;
      }
    >();

    for (const c of registeredClients) {
      const key = c.email.toLowerCase();
      map.set(key, {
        email: c.email,
        name: c.name,
        wa: c.wa,
        projects: [],
        totalSpend: 0,
        totalPaid: 0,
        totalOutstanding: 0,
        createdAt: c.createdAt,
      });
    }

    for (const p of adminProjects) {
      const key = p.clientEmail.toLowerCase();
      const existing = map.get(key) || {
        email: p.clientEmail,
        name: p.clientName,
        wa: p.clientWa,
        projects: [],
        totalSpend: 0,
        totalPaid: 0,
        totalOutstanding: 0,
        createdAt: p.createdAt,
      };
      const fin = getProjectFinanceSummary(p);
      existing.projects.push(p);
      existing.totalSpend += fin.totalPrice;
      existing.totalPaid += fin.verifiedPaidAmount;
      existing.totalOutstanding += fin.outstandingAmount;
      if (!existing.wa && p.clientWa) existing.wa = p.clientWa;
      if (!existing.name && p.clientName) existing.name = p.clientName;
      map.set(key, existing);
    }

    const q = recapSearch.trim().toLowerCase();
    return Array.from(map.values())
      .filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.wa.toLowerCase().includes(q)
      )
      .sort((a, b) => b.totalSpend - a.totalSpend || b.projects.length - a.projects.length);
  }, [registeredClients, adminProjects, recapSearch]);

  if (bootLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center text-sm text-slate-500">
        Memulihkan sesi Panel Admin...
      </div>
    );
  }

  // Independent Admin Login Gate (Firebase Google Sign-In restricted to official studio admin)
  if (!adminToken) {
    const handleGoogleAdminLogin = async () => {
      setAuthError('');
      setAuthLoading(true);
      try {
        await loginAdminWithGoogle();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Akun Google tidak memiliki akses Admin.';
        setAuthError(msg);
        showToast('Akses Admin Ditolak', msg, 'error');
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
              <span>Admin Studio · Firebase Real-Time</span>
            </div>
            <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">
              Masuk Panel Admin
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Masuk dengan akun Google resmi pengelola studio (<span className="font-mono">prangart.lab@gmail.com</span>) untuk memantau notifikasi real-time Firestore, memverifikasi pembayaran klien, dan memperbarui status produksi.
            </p>
          </div>

          {clientUser && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 p-3.5 text-xs text-amber-800 dark:text-amber-300">
              Saat ini Anda masuk sebagai klien ({clientUser.email}). Silakan klik tombol di bawah untuk memilih akun Google Admin.
            </div>
          )}

          {authError && (
            <p className="text-xs font-medium text-red-600 dark:text-red-400" role="alert">
              {authError}
            </p>
          )}

          <button
            type="button"
            disabled={authLoading}
            onClick={() => void handleGoogleAdminLogin()}
            className="w-full py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>{authLoading ? 'Memverifikasi Akses Admin...' : 'Masuk Panel Admin dengan Google'}</span>
          </button>
        </div>
      </div>
    );
  }

  const handlePartialRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAdminDashboard();
      showToast('Data Disinkronkan', 'Proyek, klien, dan notifikasi diperbarui via AJAX.', 'info');
    } finally {
      setRefreshing(false);
    }
  };

  const jumpToProject = (projectId?: string, notifId?: string) => {
    if (notifId) void markAdminNotificationRead(notifId);
    if (!projectId) return;
    setActiveTab('projects');
    setStatusFilter('all');
    setSearchQuery('');
    setFocusedProjectId(projectId);
    setTimeout(() => {
      document.getElementById(`admin-proj-${projectId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  };

  const runProjectUpdate = async (
    projectId: string,
    payload: Parameters<typeof adminUpdateProject>[1],
    onSuccess?: () => void
  ) => {
    setBusyProjectId(projectId);
    try {
      await adminUpdateProject(projectId, payload);
      onSuccess?.();
    } catch (err: unknown) {
      showToast('Gagal Memperbarui Proyek', err instanceof Error ? err.message : 'Terjadi kesalahan.', 'error');
    } finally {
      setBusyProjectId(null);
    }
  };

  const runDeleteProject = async (projectId: string) => {
    setBusyProjectId(projectId);
    try {
      await adminDeleteProject(projectId);
      setConfirmDeleteProjectId(null);
    } catch (err: unknown) {
      showToast('Gagal Hapus Proyek', err instanceof Error ? err.message : 'Terjadi kesalahan.', 'error');
    } finally {
      setBusyProjectId(null);
    }
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

  const handleResetCatalog = async () => {
    setCatalogSaving(true);
    try {
      await resetAdminCatalog();
    } catch (err: unknown) {
      showToast('Gagal Reset Katalog', err instanceof Error ? err.message : 'Error', 'error');
    } finally {
      setCatalogSaving(false);
    }
  };

  const resetPortfolioForm = () => {
    setEditingPortfolioId(null);
    setNewPortfolio({
      title: '',
      category: 'Musik Tari',
      culture: '',
      duration: '05:00',
      year: String(new Date().getFullYear()),
      audioDemoUrl: '',
      description: '',
    });
  };

  const handleSavePortfolioItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteContent) return;
    if (newPortfolio.audioDemoUrl?.trim() && !safeExternalUrl(newPortfolio.audioDemoUrl.trim())) {
      showToast('Tautan Demo Tidak Valid', 'Gunakan tautan URL yang diawali https:// atau http://.', 'error');
      return;
    }
    setContentSaving(true);
    try {
      const cleanItem: Omit<PortfolioItem, 'id'> = {
        ...newPortfolio,
        title: newPortfolio.title.trim(),
        culture: newPortfolio.culture.trim(),
        duration: newPortfolio.duration.trim(),
        year: newPortfolio.year.trim(),
        audioDemoUrl: newPortfolio.audioDemoUrl?.trim() || '',
        description: newPortfolio.description.trim(),
      };
      if (editingPortfolioId) {
        const updatedList = siteContent.portfolio.map((item) =>
          item.id === editingPortfolioId ? { ...cleanItem, id: editingPortfolioId } : item
        );
        await saveAdminSiteContent({ portfolio: updatedList });
      } else {
        const nextItem: PortfolioItem = {
          ...cleanItem,
          id: `pf-${Date.now()}`,
        };
        await saveAdminSiteContent({ portfolio: [nextItem, ...siteContent.portfolio] });
      }
      resetPortfolioForm();
    } catch (err: unknown) {
      showToast('Gagal Simpan Portofolio', err instanceof Error ? err.message : 'Error', 'error');
    } finally {
      setContentSaving(false);
    }
  };

  const handleRemovePortfolio = async (id: string) => {
    if (!siteContent) return;
    setContentSaving(true);
    try {
      await saveAdminSiteContent({
        portfolio: siteContent.portfolio.filter((p) => p.id !== id),
      });
      if (editingPortfolioId === id) resetPortfolioForm();
    } catch (err: unknown) {
      showToast('Gagal Hapus Portofolio', err instanceof Error ? err.message : 'Error', 'error');
    } finally {
      setContentSaving(false);
    }
  };

  const resetTestimonialForm = () => {
    setEditingTestimonialId(null);
    setNewTestimonial({ name: '', role: '', quote: '', outcome: '' });
  };

  const handleSaveTestimonialItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteContent) return;
    setContentSaving(true);
    try {
      const cleanItem: Omit<TestimonialItem, 'id'> = {
        name: newTestimonial.name.trim(),
        role: newTestimonial.role.trim(),
        quote: newTestimonial.quote.trim(),
        outcome: newTestimonial.outcome?.trim() || '',
      };
      if (editingTestimonialId) {
        const updatedList = siteContent.testimonials.map((item) =>
          item.id === editingTestimonialId ? { ...cleanItem, id: editingTestimonialId } : item
        );
        await saveAdminSiteContent({ testimonials: updatedList });
      } else {
        const nextItem: TestimonialItem = {
          ...cleanItem,
          id: `tm-${Date.now()}`,
        };
        await saveAdminSiteContent({ testimonials: [nextItem, ...siteContent.testimonials] });
      }
      resetTestimonialForm();
    } catch (err: unknown) {
      showToast('Gagal Simpan Testimoni', err instanceof Error ? err.message : 'Error', 'error');
    } finally {
      setContentSaving(false);
    }
  };

  const handleRemoveTestimonial = async (id: string) => {
    if (!siteContent) return;
    setContentSaving(true);
    try {
      await saveAdminSiteContent({
        testimonials: siteContent.testimonials.filter((t) => t.id !== id),
      });
      if (editingTestimonialId === id) resetTestimonialForm();
    } catch (err: unknown) {
      showToast('Gagal Hapus Testimoni', err instanceof Error ? err.message : 'Error', 'error');
    } finally {
      setContentSaving(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsDraft) return;
    setContentSaving(true);
    try {
      await saveAdminSiteContent({ settings: settingsDraft });
    } catch (err: unknown) {
      showToast('Gagal Simpan Pengaturan', err instanceof Error ? err.message : 'Error', 'error');
    } finally {
      setContentSaving(false);
    }
  };

  const handleResetSiteContent = async () => {
    setContentSaving(true);
    try {
      await resetAdminSiteContent();
      resetPortfolioForm();
      resetTestimonialForm();
    } catch (err: unknown) {
      showToast('Gagal Kosongkan Konten', err instanceof Error ? err.message : 'Error', 'error');
    } finally {
      setContentSaving(false);
    }
  };

  const inputCls =
    'w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100';

  const handleExportRecapCsv = () => {
    const esc = (v: string | number | undefined | null) =>
      `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headers = [
      'ID Proyek',
      'Tanggal Pesan',
      'Nama Konsumen',
      'Email',
      'WhatsApp',
      'Judul Karya',
      'Layanan',
      'Paket',
      'Durasi',
      'Tanggal Finishing',
      'Status Produksi',
      'Nilai Kontrak (Rp)',
      'DP 50% (Rp)',
      'Dana Masuk Terverifikasi (Rp)',
      'Sisa Tagihan (Rp)',
      'Status DP',
      'Status Pelunasan',
      'Tautan Hasil Karya (Master)',
      'Catatan Finishing Studio',
    ];
    const lines = [headers.map(esc).join(',')];
    for (const p of recapProjects) {
      const fin = getProjectFinanceSummary(p);
      lines.push(
        [
          p.id,
          formatDateShortID(p.createdAt),
          p.clientName,
          p.contactEmail,
          p.clientWa,
          p.judul,
          p.serviceLineLabel,
          p.packageName,
          p.durasi,
          p.finishingDate || '',
          p.productionStatus,
          fin.totalPrice,
          fin.dpAmount,
          fin.verifiedPaidAmount,
          fin.outstandingAmount,
          p.dpStatus,
          p.finalPaymentStatus,
          p.masterFileUrl || '',
          p.finishingNotes || '',
        ]
          .map(esc)
          .join(',')
      );
    }
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rekap-studio-prangart-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('CSV Diunduh', 'File rekapitulasi CSV siap dibuka di Excel / Google Sheets.', 'success');
  };

  const navItems: { key: AdminTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      key: 'overview',
      label: 'Ringkasan & Notifikasi',
      icon: <LayoutDashboard className="w-4 h-4 shrink-0" />,
      badge: adminUnreadCount,
    },
    {
      key: 'projects',
      label: 'Proyek & Pembayaran',
      icon: <FolderKanban className="w-4 h-4 shrink-0" />,
      badge: kpiStats.pendingVerify > 0 ? kpiStats.pendingVerify : adminProjects.length,
    },
    {
      key: 'recap',
      label: 'Rekapitulasi & Keuangan',
      icon: <FileSpreadsheet className="w-4 h-4 shrink-0" />,
      badge: adminProjects.length,
    },
    {
      key: 'catalog',
      label: 'Katalog Tarif',
      icon: <BookOpen className="w-4 h-4 shrink-0" />,
    },
    {
      key: 'content',
      label: 'Konten & Studio',
      icon: <Settings className="w-4 h-4 shrink-0" />,
    },
    {
      key: 'clients',
      label: 'Data Klien',
      icon: <Users className="w-4 h-4 shrink-0" />,
      badge: registeredClients.length,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10 pb-24">
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* DEDICATED ADMIN SIDEBAR */}
        <aside className="w-full lg:w-68 shrink-0 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-6 lg:sticky lg:top-24">
          <div className="space-y-1 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center justify-between gap-2 text-xs font-mono">
              <span className="text-indigo-600 dark:text-indigo-400 font-semibold">Dashboard Admin</span>
              <span className="inline-flex items-center gap-1.5 text-slate-500">
                <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {wsConnected ? 'Live' : '...'}
              </span>
            </div>
            <h1 className="text-lg font-display font-bold text-slate-900 dark:text-slate-100 truncate">
              {adminProfile?.name || 'Admin PrangArt Lab'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {adminProfile?.email || 'prangart.lab@gmail.com'}
            </p>
          </div>

          <nav className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-1.5" aria-label="Menu Panel Admin">
            {navItems.map((item) => {
              const active = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTab(item.key)}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                    active
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    {item.icon}
                    <span className="truncate">{item.label}</span>
                  </span>
                  {typeof item.badge === 'number' && item.badge > 0 && (
                    <span
                      className={`font-mono text-[11px] px-1.5 py-0.5 rounded tabular-nums ${
                        active
                          ? 'bg-white/20 text-white'
                          : item.key === 'overview'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 cursor-pointer"
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-indigo-600" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>{soundEnabled ? 'Suara Notifikasi Aktif' : 'Notifikasi Bisu'}</span>
            </button>

            <button
              type="button"
              disabled={refreshing}
              onClick={() => void handlePartialRefresh()}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-indigo-500 flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Menyegarkan...' : 'Segarkan Data'}</span>
            </button>

            <button
              type="button"
              onClick={() => void logoutAdmin()}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar Panel Admin</span>
            </button>
          </div>
        </aside>

        {/* ISOLATED ADMIN VIEWPORT */}
        <div className="flex-1 min-w-0 w-full space-y-6">
          {/* TAB 1: OVERVIEW & REAL-TIME NOTIFICATIONS */}
          {activeTab === 'overview' && (
            <section className="space-y-6">
              <div>
                <h2 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">
                  Ringkasan Studio & Notifikasi Real-Time
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Setiap pengajuan baru, konfirmasi DP/pelunasan, pembaruan profil, dan catatan klien masuk seketika di sini.
                </p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                  <span className="text-xs text-slate-500">Total Proyek</span>
                  <div className="text-2xl font-mono font-bold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
                    {kpiStats.total}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                  <span className="text-xs text-slate-500">Perlu Cek Bayar</span>
                  <div className="text-2xl font-mono font-bold text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
                    {kpiStats.pendingVerify}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                  <span className="text-xs text-slate-500">Dalam Produksi</span>
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

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <h3 className="text-sm font-display font-bold text-slate-900 dark:text-slate-100">
                        Aktivitas Klien Langsung
                      </h3>
                    </div>
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
                        Semua ({adminNotifications.length})
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
                        Belum Dibaca ({adminUnreadCount})
                      </button>
                    </div>
                  </div>

                  {adminUnreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => void markAllAdminNotificationsRead()}
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Tandai Semua Dibaca</span>
                    </button>
                  )}
                </div>

                {displayedNotifications.length === 0 ? (
                  <p className="text-xs text-slate-500 py-8 text-center">
                    Belum ada notifikasi pada filter ini. Setiap pesanan baru, konfirmasi DP/pelunasan, atau catatan klien akan muncul otomatis di sini.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {displayedNotifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => jumpToProject(n.projectId, n.id)}
                        className={`py-3.5 px-2 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
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
              </div>
            </section>
          )}

          {/* TAB 2: PROJECTS & CLIENT SUBMISSIONS */}
          {activeTab === 'projects' && (
            <section className="space-y-6">
              <div>
                <h2 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">
                  Proyek & Verifikasi Pembayaran ({adminProjects.length})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Periksa data isian klien, verifikasi DP 50% / Pelunasan 100%, perbarui tahap produksi, dan balas catatan revisi.
                </p>
              </div>

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
                    const finishingDateVal = finishingDateInputs[p.id] ?? p.finishingDate ?? '';
                    const finishingNotesVal = finishingNotesInputs[p.id] ?? p.finishingNotes ?? '';

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
                              {p.finishingDate && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                    Finishing {formatDateShortID(p.finishingDate)}
                                  </span>
                                </>
                              )}
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

                        {/* Verification Actions + Full Document Download Suite */}
                        <div className="flex flex-wrap items-center gap-2">
                          {!access.isDpVerified && !access.isFullyPaid && (
                            <button
                              type="button"
                              disabled={busyProjectId === p.id}
                              onClick={() => void runProjectUpdate(p.id, { action: 'VERIFY_DP' })}
                              className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Verifikasi DP 50%</span>
                            </button>
                          )}
                          {!access.isFullyPaid && (
                            <button
                              type="button"
                              disabled={busyProjectId === p.id}
                              onClick={() => void runProjectUpdate(p.id, { action: 'VERIFY_LUNAS' })}
                              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Verifikasi Lunas 100%</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              downloadOrderDataPdf(p, siteContent?.settings);
                              showToast('PDF Diunduh', `Data pemesanan ${p.id} diunduh sebagai PDF.`, 'success');
                            }}
                            className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Data Pesanan (.pdf)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDocModal({ project: p, kind: 'order_pdf' })}
                            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Brief / Rincian</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDocModal({ project: p, kind: 'contract' })}
                            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                          >
                            SPK
                          </button>
                          <button
                            type="button"
                            onClick={() => setDocModal({ project: p, kind: 'invoice_dp' })}
                            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                          >
                            Invoice DP
                          </button>
                          <button
                            type="button"
                            onClick={() => setDocModal({ project: p, kind: 'invoice_final' })}
                            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                          >
                            Invoice Pelunasan
                          </button>
                          {access.canDownloadDpReceipt && (
                            <button
                              type="button"
                              onClick={() => setDocModal({ project: p, kind: 'receipt_dp' })}
                              className="px-3 py-2 rounded-xl border border-emerald-500/70 text-emerald-700 dark:text-emerald-400 text-xs font-semibold cursor-pointer"
                            >
                              Kuitansi DP
                            </button>
                          )}
                          {access.canDownloadLunasDocument && (
                            <button
                              type="button"
                              onClick={() => setDocModal({ project: p, kind: 'receipt_final' })}
                              className="px-3 py-2 rounded-xl border border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold cursor-pointer"
                            >
                              Kuitansi Lunas
                            </button>
                          )}
                        </div>

                        {/* Production Stage, Finishing Date, Master Link & Finishing Notes */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                          <div className="lg:col-span-4">
                            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                              Tahap Produksi
                            </label>
                            <select
                              aria-label="Ubah status milestone produksi"
                              disabled={busyProjectId === p.id}
                              value={p.productionStatus}
                              onChange={(e) =>
                                void runProjectUpdate(p.id, { productionStatus: e.target.value })
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

                          <div className="lg:col-span-4">
                            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                              Tanggal Finishing
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="date"
                                value={finishingDateVal}
                                onChange={(e) =>
                                  setFinishingDateInputs((prev) => ({ ...prev, [p.id]: e.target.value }))
                                }
                                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono"
                              />
                              <button
                                type="button"
                                disabled={busyProjectId === p.id}
                                onClick={() =>
                                  void runProjectUpdate(p.id, {
                                    finishingDate: finishingDateVal,
                                    finishingNotes: finishingNotesVal,
                                  })
                                }
                                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-indigo-500 shrink-0 cursor-pointer"
                              >
                                Simpan Tgl
                              </button>
                            </div>
                          </div>

                          <div className="lg:col-span-4">
                            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                              Tautan Hasil Karya / Master File
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="url"
                                value={masterVal}
                                onChange={(e) =>
                                  setMasterInputs((prev) => ({ ...prev, [p.id]: e.target.value }))
                                }
                                placeholder="https://drive.google.com/..."
                                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                              />
                              <button
                                type="button"
                                disabled={busyProjectId === p.id}
                                onClick={() => {
                                  const trimmed = masterVal.trim();
                                  if (trimmed && !safeExternalUrl(trimmed)) {
                                    showToast('Tautan Tidak Valid', 'Pastikan URL Master File diawali https:// atau http://.', 'error');
                                    return;
                                  }
                                  void runProjectUpdate(p.id, { masterFileUrl: trimmed });
                                }}
                                className="px-3 py-2 rounded-xl bg-slate-900 dark:bg-white disabled:opacity-60 text-white dark:text-slate-900 text-xs font-semibold shrink-0 cursor-pointer"
                              >
                                Simpan Link
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            value={finishingNotesVal}
                            onChange={(e) =>
                              setFinishingNotesInputs((prev) => ({ ...prev, [p.id]: e.target.value }))
                            }
                            placeholder="Catatan hasil karya & finishing studio (format WAV/MP3, stem, keterangan partitur)..."
                            className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
                          />
                          <button
                            type="button"
                            disabled={busyProjectId === p.id}
                            onClick={() =>
                              void runProjectUpdate(p.id, {
                                finishingDate: finishingDateVal,
                                finishingNotes: finishingNotesVal,
                              })
                            }
                            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-indigo-500 shrink-0 cursor-pointer"
                          >
                            Simpan Catatan Finishing
                          </button>
                        </div>

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

                        <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5">
                              <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Catatan Klien & Balasan Studio ({p.notes.length})</span>
                            </span>
                            {confirmDeleteProjectId === p.id ? (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-red-600 dark:text-red-400 font-semibold">Yakin hapus permanen?</span>
                                <button
                                  type="button"
                                  disabled={busyProjectId === p.id}
                                  onClick={() => void runDeleteProject(p.id)}
                                  className="px-2.5 py-1 rounded-lg bg-red-600 text-white font-semibold cursor-pointer"
                                >
                                  Ya, Hapus
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteProjectId(null)}
                                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold cursor-pointer"
                                >
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteProjectId(p.id)}
                                className="text-xs text-red-600 dark:text-red-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Hapus Proyek</span>
                              </button>
                            )}
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
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const txt = (replyInputs[p.id] || '').trim();
                                  if (!txt || busyProjectId === p.id) return;
                                  void runProjectUpdate(p.id, { adminReply: txt }, () =>
                                    setReplyInputs((prev) => ({ ...prev, [p.id]: '' }))
                                  );
                                }
                              }}
                              placeholder="Tulis balasan atau progres untuk klien (klien menerima notifikasi langsung)..."
                              className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
                            />
                            <button
                              type="button"
                              disabled={busyProjectId === p.id}
                              onClick={() => {
                                const txt = (replyInputs[p.id] || '').trim();
                                if (!txt) return;
                                void runProjectUpdate(p.id, { adminReply: txt }, () =>
                                  setReplyInputs((prev) => ({ ...prev, [p.id]: '' }))
                                );
                              }}
                              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
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

          {/* TAB 2B: REKAPITULASI DATA KONSUMEN, HASIL KARYA, TANGGAL FINISHING, KEUANGAN & DOKUMEN */}
          {activeTab === 'recap' && (
            <section className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">
                    Rekapitulasi Studio, Keuangan &amp; Dokumen
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Rekap data konsumen, hasil karya, tanggal finishing, data lengkap karya, laporan keuangan, serta akses cepat seluruh Invoice, Kuitansi &amp; PDF Pemesanan.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      downloadMasterRecapPdf(
                        recapProjects,
                        registeredClients,
                        siteContent?.settings,
                        `${recapServiceFilter === 'all' ? 'Semua Lini' : recapServiceFilter} · ${recapPayFilter}`
                      );
                      showToast('PDF Rekap Diunduh', 'Buku rekapitulasi studio berhasil diunduh sebagai PDF.', 'success');
                    }}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh Rekap (.pdf)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportRecapCsv}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-indigo-500 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Unduh CSV / Excel</span>
                  </button>
                </div>
              </div>

              {/* Financial & Output Summary KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                  <span className="text-xs text-slate-500">Total Nilai Kontrak</span>
                  <div className="text-xl font-mono font-bold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
                    {formatRupiah(recapTotals.totalContract)}
                  </div>
                  <span className="text-[11px] text-slate-500">{recapProjects.length} proyek terfilter</span>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                  <span className="text-xs text-slate-500">Dana Masuk Terverifikasi</span>
                  <div className="text-xl font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                    {formatRupiah(recapTotals.totalCollected)}
                  </div>
                  <span className="text-[11px] text-slate-500">DP &amp; Pelunasan tervalidasi</span>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                  <span className="text-xs text-slate-500">Sisa Tagihan / Piutang</span>
                  <div className="text-xl font-mono font-bold text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
                    {formatRupiah(recapTotals.totalOutstanding)}
                  </div>
                  <span className="text-[11px] text-slate-500">Menunggu DP / Pelunasan</span>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                  <span className="text-xs text-slate-500">Karya Finishing / Selesai</span>
                  <div className="text-xl font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-1 tabular-nums">
                    {recapTotals.finishedCount} / {recapProjects.length}
                  </div>
                  <span className="text-[11px] text-slate-500">Memiliki jadwal/selesai</span>
                </div>
              </div>

              {/* Filter Bar + Recap Sub-View Tabs */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
                <div className="flex flex-col lg:flex-row gap-3">
                  <input
                    type="search"
                    value={recapSearch}
                    onChange={(e) => setRecapSearch(e.target.value)}
                    placeholder="Cari nama konsumen, WhatsApp, email, judul karya, atau ID..."
                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-2 text-xs"
                  />
                  <select
                    value={recapServiceFilter}
                    onChange={(e) => setRecapServiceFilter(e.target.value as 'all' | ServiceLineKey)}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                  >
                    <option value="all">Semua Layanan</option>
                    <option value="tari">Musik Tari</option>
                    <option value="digital">Musik Non-Tari</option>
                    <option value="transkripsi">Transkripsi Notasi</option>
                  </select>
                  <select
                    value={recapPayFilter}
                    onChange={(e) =>
                      setRecapPayFilter(e.target.value as 'all' | 'awaiting_dp' | 'dp_paid' | 'lunas')
                    }
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                  >
                    <option value="all">Semua Status Bayar</option>
                    <option value="awaiting_dp">Menunggu DP</option>
                    <option value="dp_paid">DP Terverifikasi (Belum Lunas)</option>
                    <option value="lunas">Lunas 100%</option>
                  </select>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  {(
                    [
                      { key: 'works', label: 'Karya, Tanggal Finishing & Dokumen' },
                      { key: 'finance', label: 'Rincian Keuangan & Transfer' },
                      { key: 'clients', label: `Data Konsumen (${recapConsumers.length})` },
                    ] as const
                  ).map((sub) => (
                    <button
                      key={sub.key}
                      type="button"
                      onClick={() => setRecapView(sub.key)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                        recapView === sub.key
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* SUB-VIEW 1: KARYA, TANGGAL FINISHING, HASIL KARYA & DOKUMEN */}
              {recapView === 'works' && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Karya &amp; Data Lengkap</th>
                          <th className="px-4 py-3 font-semibold">Konsumen</th>
                          <th className="px-4 py-3 font-semibold">Tgl Finishing &amp; Hasil Karya</th>
                          <th className="px-4 py-3 font-semibold">Status &amp; Keuangan</th>
                          <th className="px-4 py-3 font-semibold">Dokumen Resmi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {recapProjects.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                              Belum ada data proyek sesuai filter.
                            </td>
                          </tr>
                        ) : (
                          recapProjects.map((p) => {
                            const fin = getProjectFinanceSummary(p);
                            const masterUrl = safeExternalUrl(p.masterFileUrl);
                            const waNum = normalizeWhatsAppNumber(p.clientWa);
                            return (
                              <tr key={p.id} className="align-top hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                                <td className="px-4 py-3.5 space-y-1 min-w-[210px]">
                                  <div className="font-mono text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                                    {p.id} · {formatDateShortID(p.createdAt)}
                                  </div>
                                  <div className="font-bold text-slate-900 dark:text-slate-100">{p.judul}</div>
                                  <div className="text-slate-500">
                                    {p.serviceLineLabel} · {p.packageName} ({p.durasi})
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {p.specs.length} parameter{p.sinopsis ? ' · Sinopsis terisi' : ''}
                                  </div>
                                </td>
                                <td className="px-4 py-3.5 space-y-1 min-w-[160px]">
                                  <div className="font-semibold text-slate-900 dark:text-slate-100">{p.clientName}</div>
                                  <div className="text-slate-500">{p.contactEmail}</div>
                                  {waNum ? (
                                    <a
                                      href={`https://wa.me/${waNum}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-mono text-emerald-600 dark:text-emerald-400 hover:underline block"
                                    >
                                      {p.clientWa}
                                    </a>
                                  ) : (
                                    <span className="font-mono text-slate-500">{p.clientWa || '-'}</span>
                                  )}
                                </td>
                                <td className="px-4 py-3.5 space-y-1.5 min-w-[190px]">
                                  <div className="inline-flex items-center gap-1.5 font-mono font-semibold text-slate-800 dark:text-slate-200">
                                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>{p.finishingDate ? formatDateShortID(p.finishingDate) : 'Belum ditetapkan'}</span>
                                  </div>
                                  <div className="text-slate-500">{p.productionStatus}</div>
                                  {masterUrl ? (
                                    <a
                                      href={masterUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                                    >
                                      <span>Buka Hasil Karya</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  ) : (
                                    <span className="block text-[11px] text-slate-400">Master file belum diunggah</span>
                                  )}
                                  {p.finishingNotes && (
                                    <p className="text-[11px] text-slate-500 line-clamp-2">{p.finishingNotes}</p>
                                  )}
                                </td>
                                <td className="px-4 py-3.5 space-y-1 font-mono min-w-[155px]">
                                  <div className="font-bold text-slate-900 dark:text-slate-100">
                                    {formatRupiah(fin.totalPrice)}
                                  </div>
                                  <div className="text-emerald-600 dark:text-emerald-400">
                                    Masuk: {formatRupiah(fin.verifiedPaidAmount)}
                                  </div>
                                  <div className={fin.outstandingAmount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}>
                                    Sisa: {formatRupiah(fin.outstandingAmount)}
                                  </div>
                                </td>
                                <td className="px-4 py-3.5 min-w-[230px]">
                                  <div className="flex flex-wrap gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => downloadOrderDataPdf(p, siteContent?.settings)}
                                      className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-semibold text-[11px] cursor-pointer"
                                    >
                                      Data PDF
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDocModal({ project: p, kind: 'order_pdf' })}
                                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold text-[11px] cursor-pointer"
                                    >
                                      Data Lengkap
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDocModal({ project: p, kind: 'contract' })}
                                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold text-[11px] cursor-pointer"
                                    >
                                      SPK
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDocModal({ project: p, kind: 'invoice_dp' })}
                                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold text-[11px] cursor-pointer"
                                    >
                                      Inv DP
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDocModal({ project: p, kind: 'invoice_final' })}
                                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold text-[11px] cursor-pointer"
                                    >
                                      Inv Lunas
                                    </button>
                                    {fin.canDownloadDpReceipt && (
                                      <button
                                        type="button"
                                        onClick={() => setDocModal({ project: p, kind: 'receipt_dp' })}
                                        className="px-2.5 py-1 rounded-lg border border-emerald-500 text-emerald-700 dark:text-emerald-400 font-semibold text-[11px] cursor-pointer"
                                      >
                                        Kui DP
                                      </button>
                                    )}
                                    {fin.canDownloadLunasDocument && (
                                      <button
                                        type="button"
                                        onClick={() => setDocModal({ project: p, kind: 'receipt_final' })}
                                        className="px-2.5 py-1 rounded-lg border border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] cursor-pointer"
                                      >
                                        Kui Lunas
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SUB-VIEW 2: RINCIAN KEUANGAN & TRANSFER */}
              {recapView === 'finance' && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Proyek &amp; Konsumen</th>
                          <th className="px-4 py-3 font-semibold text-right">Kontrak</th>
                          <th className="px-4 py-3 font-semibold">Tahap DP 50%</th>
                          <th className="px-4 py-3 font-semibold">Tahap Pelunasan 50%</th>
                          <th className="px-4 py-3 font-semibold text-right">Dana Masuk</th>
                          <th className="px-4 py-3 font-semibold text-right">Sisa Piutang</th>
                          <th className="px-4 py-3 font-semibold">Dokumen Bayar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {recapProjects.map((p) => {
                          const fin = getProjectFinanceSummary(p);
                          const dpConf = p.paymentConfirmations.find((c) => c.stage === 'DP_50');
                          const finalConf = p.paymentConfirmations.find((c) => c.stage === 'PELUNASAN_50');
                          return (
                            <tr key={p.id} className="align-top hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                              <td className="px-4 py-3.5">
                                <div className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400">{p.id}</div>
                                <div className="font-bold text-slate-900 dark:text-slate-100">{p.judul}</div>
                                <div className="text-slate-500">{p.clientName}</div>
                              </td>
                              <td className="px-4 py-3.5 text-right font-mono font-bold tabular-nums">
                                {formatRupiah(fin.totalPrice)}
                              </td>
                              <td className="px-4 py-3.5 space-y-0.5">
                                <div className="font-mono font-semibold">{formatRupiah(fin.dpAmount)}</div>
                                <div className="text-[11px] text-slate-500">{p.dpStatus}</div>
                                {dpConf && (
                                  <div className="text-[11px] text-slate-500">
                                    {dpConf.bankMethod} · {dpConf.transferDate}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3.5 space-y-0.5">
                                <div className="font-mono font-semibold">{formatRupiah(fin.remainingAmount)}</div>
                                <div className="text-[11px] text-slate-500">{p.finalPaymentStatus}</div>
                                {finalConf && (
                                  <div className="text-[11px] text-slate-500">
                                    {finalConf.bankMethod} · {finalConf.transferDate}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                {formatRupiah(fin.verifiedPaidAmount)}
                              </td>
                              <td className="px-4 py-3.5 text-right font-mono font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                                {formatRupiah(fin.outstandingAmount)}
                              </td>
                              <td className="px-4 py-3.5">
                                <div className="flex flex-wrap gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setDocModal({ project: p, kind: 'invoice_dp' })}
                                    className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-[11px] font-semibold cursor-pointer"
                                  >
                                    Inv DP
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDocModal({ project: p, kind: 'invoice_final' })}
                                    className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-[11px] font-semibold cursor-pointer"
                                  >
                                    Inv Lunas
                                  </button>
                                  {fin.canDownloadDpReceipt && (
                                    <button
                                      type="button"
                                      onClick={() => setDocModal({ project: p, kind: 'receipt_dp' })}
                                      className="px-2 py-1 rounded border border-emerald-500 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold cursor-pointer"
                                    >
                                      Kui DP
                                    </button>
                                  )}
                                  {fin.canDownloadLunasDocument && (
                                    <button
                                      type="button"
                                      onClick={() => setDocModal({ project: p, kind: 'receipt_final' })}
                                      className="px-2 py-1 rounded border border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold cursor-pointer"
                                    >
                                      Kui Lunas
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-slate-50 dark:bg-slate-950 border-t-2 border-slate-200 dark:border-slate-800 font-mono font-bold">
                        <tr>
                          <td className="px-4 py-3 font-sans">TOTAL ({recapProjects.length} PROYEK)</td>
                          <td className="px-4 py-3 text-right">{formatRupiah(recapTotals.totalContract)}</td>
                          <td className="px-4 py-3 text-slate-500">{formatRupiah(recapTotals.dpObligation)}</td>
                          <td className="px-4 py-3 text-slate-500">-</td>
                          <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">
                            {formatRupiah(recapTotals.totalCollected)}
                          </td>
                          <td className="px-4 py-3 text-right text-amber-600 dark:text-amber-400">
                            {formatRupiah(recapTotals.totalOutstanding)}
                          </td>
                          <td className="px-4 py-3" />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* SUB-VIEW 3: REKAP DATA KONSUMEN */}
              {recapView === 'clients' && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Konsumen / Sanggar</th>
                          <th className="px-4 py-3 font-semibold">Kontak Email &amp; WA</th>
                          <th className="px-4 py-3 font-semibold">Riwayat Karya</th>
                          <th className="px-4 py-3 font-semibold text-right">Total Nilai Order</th>
                          <th className="px-4 py-3 font-semibold text-right">Dana Terbayar</th>
                          <th className="px-4 py-3 font-semibold text-right">Sisa Tagihan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {recapConsumers.map((c) => {
                          const waNum = normalizeWhatsAppNumber(c.wa);
                          return (
                            <tr key={c.email} className="align-top hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                              <td className="px-4 py-3.5">
                                <div className="font-bold text-slate-900 dark:text-slate-100">{c.name}</div>
                                <div className="text-[11px] font-mono text-slate-500">
                                  {c.projects.length} proyek
                                </div>
                              </td>
                              <td className="px-4 py-3.5 space-y-0.5">
                                <div className="text-slate-600 dark:text-slate-400">{c.email}</div>
                                {waNum ? (
                                  <a
                                    href={`https://wa.me/${waNum}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-mono text-emerald-600 dark:text-emerald-400 hover:underline block"
                                  >
                                    {c.wa}
                                  </a>
                                ) : (
                                  <span className="font-mono text-slate-400">-</span>
                                )}
                              </td>
                              <td className="px-4 py-3.5">
                                {c.projects.length === 0 ? (
                                  <span className="text-slate-400">Belum memesan proyek</span>
                                ) : (
                                  <ul className="space-y-1">
                                    {c.projects.map((proj) => (
                                      <li key={proj.id}>
                                        <button
                                          type="button"
                                          onClick={() => jumpToProject(proj.id)}
                                          className="text-indigo-600 dark:text-indigo-400 hover:underline text-left cursor-pointer"
                                        >
                                          {proj.judul} ({formatDateShortID(proj.finishingDate)})
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-right font-mono font-bold tabular-nums">
                                {formatRupiah(c.totalSpend)}
                              </td>
                              <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                {formatRupiah(c.totalPaid)}
                              </td>
                              <td className="px-4 py-3.5 text-right font-mono font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                                {formatRupiah(c.totalOutstanding)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* TAB 3: CATALOG EDITOR */}
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
                    disabled={catalogSaving}
                    onClick={() => void handleResetCatalog()}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer disabled:opacity-60"
                  >
                    Reset Standar
                  </button>
                  <button
                    type="button"
                    disabled={catalogSaving}
                    onClick={() => void handleSaveCatalog()}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
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

          {/* TAB 4: PUBLIC CONTENT & STUDIO SETTINGS */}
          {activeTab === 'content' && siteContent && settingsDraft && (
            <section className="space-y-8">
              {(!settingsDraft.studioWhatsApp?.trim() ||
                !settingsDraft.studioBankAccount?.trim() ||
                !settingsDraft.studioBankName?.trim()) && (
                <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 p-4 text-xs text-amber-900 dark:text-amber-200">
                  <strong>Lengkapi Pengaturan Studio:</strong> Nomor WhatsApp studio dan/atau rekening pembayaran masih kosong. Isi kontak & rekening tujuan resmi di bawah agar tombol WhatsApp klien dan Invoice DP 50% tampil lengkap.
                </div>
              )}

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
                        placeholder="628xxxxxxxxxx"
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
                        placeholder="Contoh: Bank BCA"
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
                        placeholder="Nomor rekening aktif"
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
                    disabled={contentSaving}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
                  >
                    {contentSaving ? 'Menyimpan...' : 'Simpan Pengaturan Studio'}
                  </button>
                </form>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
                  <h2 className="text-base font-display font-bold text-slate-900 dark:text-slate-100">
                    Keamanan Firebase & Reset Konten
                  </h2>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-2 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Terverifikasi Google Auth ({adminProfile?.email || 'prangart.lab@gmail.com'})</span>
                    </div>
                    <p className="leading-relaxed">
                      Hak akses Admin dilindungi langsung oleh Cloud Firestore Security Rules dan verifikasi token Google. Semua aktivitas klien masuk secara real-time.
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-500">
                      Kosongkan seluruh portofolio & testimoni untuk pengisian ulang manual:
                    </span>
                    <button
                      type="button"
                      disabled={contentSaving}
                      onClick={() => void handleResetSiteContent()}
                      className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer shrink-0 disabled:opacity-60"
                    >
                      Kosongkan Konten Publik
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-base font-display font-bold text-slate-900 dark:text-slate-100">
                      Kelola Portofolio Manual ({siteContent.portfolio.length})
                    </h2>
                    {editingPortfolioId && (
                      <button
                        type="button"
                        onClick={resetPortfolioForm}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                      >
                        Batalkan Edit
                      </button>
                    )}
                  </div>
                  <form onSubmit={handleSavePortfolioItem} className="space-y-3">
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
                      value={newPortfolio.audioDemoUrl || ''}
                      onChange={(e) => setNewPortfolio((p) => ({ ...p, audioDemoUrl: e.target.value }))}
                      placeholder="Tautan Pratinjau Audio (Opsional, https://...)"
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
                      disabled={contentSaving}
                      className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{editingPortfolioId ? 'Simpan Perubahan Portofolio' : 'Tambah Portofolio'}</span>
                    </button>
                  </form>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800 pt-2">
                    {siteContent.portfolio.length === 0 ? (
                      <p className="text-xs text-slate-500 py-4 text-center">
                        Portofolio masih kosong. Gunakan formulir di atas untuk mengisi karya secara manual.
                      </p>
                    ) : (
                      siteContent.portfolio.map((item) => (
                        <div key={item.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <strong className="text-slate-900 dark:text-slate-100 block truncate">{item.title}</strong>
                            <span className="text-slate-500">
                              {item.category} · {item.duration} · {item.year}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPortfolioId(item.id);
                                setNewPortfolio({
                                  title: item.title,
                                  category: item.category,
                                  culture: item.culture,
                                  duration: item.duration,
                                  year: item.year,
                                  audioDemoUrl: item.audioDemoUrl || '',
                                  description: item.description,
                                });
                              }}
                              className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              disabled={contentSaving}
                              onClick={() => void handleRemovePortfolio(item.id)}
                              className="text-red-600 dark:text-red-400 font-semibold hover:underline cursor-pointer"
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-base font-display font-bold text-slate-900 dark:text-slate-100">
                      Kelola Testimoni Manual ({siteContent.testimonials.length})
                    </h2>
                    {editingTestimonialId && (
                      <button
                        type="button"
                        onClick={resetTestimonialForm}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                      >
                        Batalkan Edit
                      </button>
                    )}
                  </div>
                  <form onSubmit={handleSaveTestimonialItem} className="space-y-3">
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
                      disabled={contentSaving}
                      className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{editingTestimonialId ? 'Simpan Perubahan Testimoni' : 'Tambah Testimoni'}</span>
                    </button>
                  </form>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800 pt-2">
                    {siteContent.testimonials.length === 0 ? (
                      <p className="text-xs text-slate-500 py-4 text-center">
                        Testimoni masih kosong. Gunakan formulir di atas untuk menambahkan testimoni nyata klien secara manual.
                      </p>
                    ) : (
                      siteContent.testimonials.map((t) => (
                        <div key={t.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <strong className="text-slate-900 dark:text-slate-100 block truncate">{t.name}</strong>
                            <span className="text-slate-500 block truncate">{t.role}</span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTestimonialId(t.id);
                                setNewTestimonial({
                                  name: t.name,
                                  role: t.role,
                                  quote: t.quote,
                                  outcome: t.outcome || '',
                                });
                              }}
                              className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              disabled={contentSaving}
                              onClick={() => void handleRemoveTestimonial(t.id)}
                              className="text-red-600 dark:text-red-400 font-semibold hover:underline cursor-pointer"
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* TAB 5: REGISTERED CLIENTS */}
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
                      const count = adminProjects.filter((p) => p.clientEmail === u.email).length;
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
        </div>
      </div>

      <DocumentsModal
        project={docModal.project}
        kind={docModal.kind}
        onClose={() => setDocModal({ project: null, kind: null })}
      />
    </div>
  );
}
