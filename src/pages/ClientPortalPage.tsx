import {
  Bell,
  CheckCheck,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  FolderKanban,
  Lock,
  LogOut,
  MessageSquare,
  PlusCircle,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { ClientAuthCard } from '../components/ClientAuthCard';
import { DocumentsModal, type DocumentModalKind } from '../components/DocumentsModal';
import { OrderWorkspace } from '../components/OrderWorkspace';
import { TRACKER_MILESTONES, useStudio } from '../context/StudioContext';
import {
  formatDateShortID,
  formatDateTimeID,
  formatRupiah,
  getProjectPaymentAccess,
  normalizeWhatsAppNumber,
  safeExternalUrl,
} from '../lib/format';
import { downloadOrderDataPdf } from '../lib/pdfExport';
import type { Project } from '../types';

type ClientTab = 'projects' | 'order' | 'notifications' | 'settings';

const CLIENT_TAB_KEY = 'pal_client_tab';

export function ClientPortalPage() {
  const {
    bootLoading,
    clientUser,
    clientProjects,
    clientNotifications,
    clientUnreadCount,
    wsConnected,
    siteContent,
    refreshClientData,
    logoutClient,
    confirmPayment,
    addClientNote,
    updateClientProfile,
    markClientNotificationRead,
    markAllClientNotificationsRead,
    showToast,
  } = useStudio();

  const [activeTab, setActiveTab] = useState<ClientTab>(() => {
    try {
      const saved = localStorage.getItem(CLIENT_TAB_KEY) as ClientTab | null;
      if (saved && ['projects', 'order', 'notifications', 'settings'].includes(saved)) {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'projects';
  });

  useEffect(() => {
    try {
      localStorage.setItem(CLIENT_TAB_KEY, activeTab);
    } catch {
      // ignore
    }
  }, [activeTab]);

  const [refreshing, setRefreshing] = useState(false);

  const [docModal, setDocModal] = useState<{ project: Project | null; kind: DocumentModalKind | null }>({
    project: null,
    kind: null,
  });

  // Payment confirmation modal/form state
  const [payModalProject, setPayModalProject] = useState<{
    project: Project;
    stage: 'DP_50' | 'PELUNASAN_50';
  } | null>(null);
  const [senderName, setSenderName] = useState('');
  const [bankMethod, setBankMethod] = useState('Transfer BCA');
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payAmount, setPayAmount] = useState('');
  const [referenceNote, setReferenceNote] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);

  // Project note inputs keyed by projectId
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [noteLoadingId, setNoteLoadingId] = useState<string | null>(null);

  // Account settings state
  const [profileName, setProfileName] = useState('');
  const [profileWa, setProfileWa] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    if (clientUser) {
      setProfileName(clientUser.name);
      setProfileWa(clientUser.wa);
    }
  }, [clientUser]);

  if (bootLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center text-sm text-slate-500">
        Memulihkan sesi Ruang Klien...
      </div>
    );
  }

  if (!clientUser) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
        <ClientAuthCard />
      </div>
    );
  }

  const handlePartialRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshClientData();
      showToast('Data Diperbarui', 'Status proyek dan notifikasi berhasil disinkronkan via AJAX.', 'info');
    } finally {
      setRefreshing(false);
    }
  };

  const openPayConfirm = (project: Project, stage: 'DP_50' | 'PELUNASAN_50') => {
    setPayModalProject({ project, stage });
    setSenderName(clientUser.name || project.clientName);
    setPayAmount(String(stage === 'DP_50' ? project.dpAmount : project.remainingAmount));
    setTransferDate(new Date().toISOString().slice(0, 10));
    setReferenceNote('');
    setProofUrl('');
  };

  const handleSubmitPaymentConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModalProject) return;
    if (Number(payAmount) <= 0) {
      showToast('Nominal Tidak Valid', 'Masukkan nominal transfer yang valid (lebih dari Rp0).', 'error');
      return;
    }
    if (proofUrl.trim() && !safeExternalUrl(proofUrl.trim())) {
      showToast('Tautan Bukti Tidak Valid', 'Pastikan tautan bukti transfer diawali https:// atau http://.', 'error');
      return;
    }
    setPaySubmitting(true);
    try {
      await confirmPayment(payModalProject.project.id, {
        stage: payModalProject.stage,
        amount: Number(payAmount),
        senderName,
        bankMethod,
        transferDate,
        referenceNote,
        proofUrl,
      });
      setPayModalProject(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengirim konfirmasi pembayaran.';
      showToast('Gagal Konfirmasi', msg, 'error');
    } finally {
      setPaySubmitting(false);
    }
  };

  const handleSendNote = async (projectId: string) => {
    const msg = (noteInputs[projectId] || '').trim();
    if (!msg) return;
    setNoteLoadingId(projectId);
    try {
      await addClientNote(projectId, msg);
      setNoteInputs((prev) => ({ ...prev, [projectId]: '' }));
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Gagal mengirim catatan.';
      showToast('Gagal Mengirim', errMsg, 'error');
    } finally {
      setNoteLoadingId(null);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      await updateClientProfile(profileName || clientUser.name, profileWa);
    } catch (err: unknown) {
      showToast('Gagal Simpan Profil', err instanceof Error ? err.message : 'Error', 'error');
    } finally {
      setProfileSaving(false);
    }
  };

  const studioBank = siteContent?.settings;
  const studioWa = normalizeWhatsAppNumber(studioBank?.studioWhatsApp);
  const hasStudioBank = Boolean(
    studioBank?.studioBankName?.trim() &&
      studioBank?.studioBankAccount?.trim() &&
      studioBank.studioBankAccount.trim() !== '1234-5678-9012'
  );

  const navItems: { key: ClientTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      key: 'projects',
      label: 'Proyek Saya',
      icon: <FolderKanban className="w-4 h-4 shrink-0" />,
      badge: clientProjects.length,
    },
    {
      key: 'order',
      label: 'Ajukan Pesanan',
      icon: <PlusCircle className="w-4 h-4 shrink-0" />,
    },
    {
      key: 'notifications',
      label: 'Notifikasi Studio',
      icon: <Bell className="w-4 h-4 shrink-0" />,
      badge: clientUnreadCount,
    },
    {
      key: 'settings',
      label: 'Pengaturan Akun',
      icon: <Settings className="w-4 h-4 shrink-0" />,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10 pb-24">
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* DEDICATED CLIENT SIDEBAR */}
        <aside className="w-full lg:w-68 shrink-0 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_28px_-14px_rgba(15,23,42,0.09)] dark:shadow-none p-5 space-y-6 lg:sticky lg:top-24">
          <div className="space-y-1 border-b border-slate-200/80 dark:border-slate-800 pb-4">
            <div className="flex items-center justify-between gap-2 text-xs font-mono">
              <span className="text-indigo-700 dark:text-indigo-400 font-semibold">Dashboard Klien</span>
              <span className={`font-semibold ${wsConnected ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {wsConnected ? 'Live' : '...'}
              </span>
            </div>
            <h1 className="text-lg font-display font-bold text-slate-950 dark:text-slate-100 truncate">
              {clientUser.name}
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 truncate">{clientUser.email}</p>
          </div>

          <nav className="grid grid-cols-2 lg:grid-cols-1 gap-1.5" aria-label="Menu Ruang Klien">
            {navItems.map((item) => {
              const active = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTab(item.key)}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 transition-all cursor-pointer ${
                    active
                      ? 'bg-indigo-600 text-white shadow-[0_6px_14px_-6px_rgba(79,70,229,0.5)] dark:shadow-none'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800'
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
                          : item.key === 'notifications'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 space-y-2">
            <button
              type="button"
              disabled={refreshing}
              onClick={() => void handlePartialRefresh()}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300/90 dark:border-slate-800 bg-white dark:bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Menyegarkan...' : 'Segarkan Data'}</span>
            </button>

            <button
              type="button"
              onClick={() => void logoutClient()}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar Akun Klien</span>
            </button>
          </div>
        </aside>

        {/* ISOLATED VIEWPORT CONTENT (NO STACKING) */}
        <div className="flex-1 min-w-0 w-full space-y-6">
          {!clientUser.wa?.trim() && activeTab !== 'settings' && (
            <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
              <span>
                Nomor WhatsApp Anda belum dilengkapi. Lengkapi nomor aktif agar Admin Studio mudah berkoordinasi terkait draf & revisi.
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold cursor-pointer shrink-0"
              >
                Lengkapi Nomor WhatsApp
              </button>
            </div>
          )}
          {/* TAB 1: PROYEK SAYA */}
          {activeTab === 'projects' && (
            <section className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">
                    Proyek & Pembayaran Anda ({clientProjects.length})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pantau milestone, kirim konfirmasi transfer DP 50% / Pelunasan, dan kelola catatan revisi.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('order')}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Ajukan Pesanan Baru</span>
                </button>
              </div>

              {clientProjects.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-12 text-center space-y-4">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Belum ada pengajuan proyek pada akun Anda.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('order')}
                    className="inline-flex px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    Buat Pesanan Pertama
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {clientProjects.map((project) => {
                    const access = getProjectPaymentAccess(project);
                    const milestoneIdx = Math.max(
                      0,
                      TRACKER_MILESTONES.indexOf(project.productionStatus)
                    );
                    const masterUrl = safeExternalUrl(project.masterFileUrl);

                    return (
                      <article
                        key={project.id}
                        className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_28px_-14px_rgba(15,23,42,0.09)] dark:shadow-none p-6 sm:p-8 space-y-6"
                      >
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-5">
                          <div className="space-y-1">
                            <div className="text-xs text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-1.5">
                              <span className="font-semibold text-indigo-700 dark:text-indigo-400">
                                {project.serviceLineLabel}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{project.packageName}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">{project.id}</span>
                            </div>
                            <h3 className="text-xl font-display font-bold text-slate-950 dark:text-slate-100">
                              {project.judul}
                            </h3>
                            <p className="text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                              Durasi {project.durasi} · Total {formatRupiah(project.totalPrice)} · Diajukan {formatDateTimeID(project.createdAt)}
                              {project.finishingDate ? ` · Finishing ${formatDateShortID(project.finishingDate)}` : ''}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                void downloadOrderDataPdf(project, studioBank)
                                  .then(() => {
                                    showToast('PDF Diunduh', `Data pemesanan ${project.id} berhasil diunduh sebagai PDF.`, 'success');
                                  })
                                  .catch((err: unknown) => {
                                    showToast(
                                      'Gagal Mengunduh PDF',
                                      err instanceof Error ? err.message : 'Terjadi kendala saat membuat PDF.',
                                      'error'
                                    );
                                  });
                              }}
                              className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 shadow-[0_1px_2px_rgba(79,70,229,0.28)] dark:shadow-none text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Data Pesanan (.pdf)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDocModal({ project, kind: 'order_pdf' })}
                              className="px-3 py-2 rounded-lg border border-slate-300/90 dark:border-slate-800 bg-white dark:bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Brief / Rincian</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDocModal({ project, kind: 'contract' })}
                              className="px-3 py-2 rounded-lg border border-slate-300/90 dark:border-slate-800 bg-white dark:bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                            >
                              Kontrak SPK
                            </button>
                            <button
                              type="button"
                              onClick={() => setDocModal({ project, kind: 'invoice_dp' })}
                              className="px-3 py-2 rounded-lg border border-slate-300/90 dark:border-slate-800 bg-white dark:bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                            >
                              Invoice DP
                            </button>
                            <button
                              type="button"
                              onClick={() => setDocModal({ project, kind: 'invoice_final' })}
                              className="px-3 py-2 rounded-lg border border-slate-300/90 dark:border-slate-800 bg-white dark:bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                            >
                              Invoice Pelunasan
                            </button>
                            {access.canDownloadDpReceipt && (
                              <button
                                type="button"
                                onClick={() => setDocModal({ project, kind: 'receipt_dp' })}
                                className="px-3 py-2 rounded-lg border border-emerald-500/80 bg-emerald-50/40 dark:bg-transparent text-emerald-700 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-50 dark:hover:bg-emerald-950/30 cursor-pointer transition-colors"
                              >
                                Kuitansi DP
                              </button>
                            )}
                            {access.canDownloadLunasDocument && (
                              <button
                                type="button"
                                onClick={() => setDocModal({ project, kind: 'receipt_final' })}
                                className="px-3 py-2 rounded-lg border border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold cursor-pointer transition-colors"
                              >
                                Kuitansi Lunas
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              Tahap Produksi: <strong className="text-indigo-600 dark:text-indigo-400">{project.productionStatus}</strong>
                            </span>
                            <span className="font-mono text-slate-500 tabular-nums">
                              Langkah {milestoneIdx + 1} / {TRACKER_MILESTONES.length}
                            </span>
                          </div>
                          <div className="grid grid-cols-7 gap-1.5">
                            {TRACKER_MILESTONES.map((step, idx) => (
                              <div
                                key={step}
                                title={step}
                                className={`h-2 rounded-full transition-colors ${
                                  idx <= milestoneIdx
                                    ? 'bg-indigo-600 dark:bg-indigo-500'
                                    : 'bg-slate-200 dark:bg-slate-800'
                                }`}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-5 space-y-4">
                          {access.isAwaitingDp && (
                            <>
                              <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
                                <Clock className="w-4 h-4" />
                                <span>Tahap 1: Menunggu Pembayaran DP 50% ({formatRupiah(project.dpAmount)})</span>
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                {hasStudioBank ? (
                                  <>
                                    Transfer DP 50% ke <strong>{studioBank?.studioBankName}</strong> No. Rek{' '}
                                    <strong className="font-mono">{studioBank?.studioBankAccount}</strong> a.n.{' '}
                                    <strong>{studioBank?.studioBankHolder}</strong>, lalu kirim konfirmasi agar Admin langsung menerima notifikasi & memverifikasi.
                                  </>
                                ) : (
                                  <>
                                    Detail rekening tujuan belum terpasang pada profil studio. Hubungi Admin melalui WhatsApp terlebih dahulu sebelum transfer, lalu kirim konfirmasi melalui tombol di bawah ini.
                                  </>
                                )}
                              </p>
                              <div className="flex flex-wrap items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => openPayConfirm(project, 'DP_50')}
                                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                  <span>Konfirmasi Pembayaran DP 50%</span>
                                </button>
                                {studioWa && (
                                  <a
                                    href={`https://wa.me/${studioWa}?text=${encodeURIComponent(
                                      `Halo PrangArt Lab, saya ingin konfirmasi pembayaran DP 50% untuk proyek "${project.judul}" (${project.id}) sebesar ${formatRupiah(project.dpAmount)}.`
                                    )}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-emerald-500"
                                  >
                                    Kirim Bukti via WA
                                  </a>
                                )}
                              </div>
                            </>
                          )}

                          {access.isDpSubmittedByClient && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                <Clock className="w-4 h-4" />
                                <span>Konfirmasi DP 50% Telah Dikirim — Menunggu Verifikasi Admin</span>
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-400">
                                Admin Studio telah menerima notifikasi konfirmasi transfer Anda dan sedang melakukan pengecekan.
                              </p>
                            </div>
                          )}

                          {(access.isDpVerified || access.isFinalSubmittedByClient) && (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-xs font-bold text-sky-700 dark:text-sky-400">
                                <ShieldCheck className="w-4 h-4" />
                                <span>
                                  {access.isFinalSubmittedByClient
                                    ? 'Konfirmasi Pelunasan Dikirim — Menunggu Verifikasi Admin'
                                    : `DP 50% Terverifikasi · Sisa Pelunasan: ${formatRupiah(project.remainingAmount)}`}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-400">
                                Proyek sedang diproduksi sesuai milestone. Setelah karya selesai, konfirmasikan pelunasan sisa 50% untuk membuka Bukti Lunas Resmi & Master File.
                              </p>
                              {!access.isFinalSubmittedByClient && (
                                <button
                                  type="button"
                                  onClick={() => openPayConfirm(project, 'PELUNASAN_50')}
                                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                  <span>Konfirmasi Pelunasan 50% ({formatRupiah(project.remainingAmount)})</span>
                                </button>
                              )}
                            </div>
                          )}

                          {access.isFullyPaid && (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="w-4 h-4" />
                                <span>
                                  Pembayaran Lunas 100% Terverifikasi
                                  {project.finishingDate ? ` · Selesai ${formatDateShortID(project.finishingDate)}` : ''}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-400">
                                Terima kasih. Seluruh kewajiban pembayaran telah lunas. Anda dapat mengunduh Kuitansi Pelunasan Resmi (berstempel &amp; bertanda tangan pemilik) serta Master File karya Anda.
                              </p>
                              {project.finishingNotes && (
                                <p className="text-xs text-slate-700 dark:text-slate-300 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2">
                                  <strong>Catatan Hasil Karya Studio:</strong> {project.finishingNotes}
                                </p>
                              )}
                              <div className="flex flex-wrap items-center gap-2.5">
                                <button
                                  type="button"
                                  onClick={() => setDocModal({ project, kind: 'receipt_final' })}
                                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Kuitansi Pelunasan Resmi</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDocModal({ project, kind: 'receipt_dp' })}
                                  className="px-3.5 py-2.5 rounded-xl border border-emerald-500/70 text-emerald-700 dark:text-emerald-400 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Kuitansi DP</span>
                                </button>
                                {masterUrl ? (
                                  <a
                                    href={masterUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    <span>Unduh Master File</span>
                                  </a>
                                ) : (
                                  <span className="text-xs text-slate-500">
                                    Tautan Master File sedang disiapkan oleh Admin Studio.
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {!access.isFullyPaid && (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1 border-t border-slate-200/70 dark:border-slate-800">
                              <Lock className="w-3 h-3" />
                              <span>Kuitansi Pelunasan Resmi 100% &amp; Master File terbuka otomatis setelah pelunasan diverifikasi Admin.</span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                            <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            <span>Diskusi & Catatan Revisi ({project.notes.length})</span>
                          </div>

                          {project.notes.length > 0 && (
                            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                              {project.notes.map((n) => (
                                <div
                                  key={n.id}
                                  className={`rounded-xl px-4 py-3 text-xs border ${
                                    n.authorRole === 'admin'
                                      ? 'border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/30'
                                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <strong className="text-slate-900 dark:text-slate-100">
                                      {n.authorName}
                                    </strong>
                                    <span className="font-mono text-[11px] text-slate-500">
                                      {formatDateTimeID(n.createdAt)}
                                    </span>
                                  </div>
                                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                                    {n.message}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="flex gap-2">
                            <input
                              value={noteInputs[project.id] || ''}
                              onChange={(e) =>
                                setNoteInputs((prev) => ({ ...prev, [project.id]: e.target.value }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  void handleSendNote(project.id);
                                }
                              }}
                              placeholder="Tulis catatan revisi, penanda menit, atau pertanyaan untuk Admin..."
                              className="flex-1 rounded-xl border border-slate-300/90 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 shadow-[inset_0_1px_2px_rgba(15,23,42,0.03)] dark:shadow-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/15 focus:outline-none dark:focus:border-indigo-500"
                            />
                            <button
                              type="button"
                              disabled={noteLoadingId === project.id}
                              onClick={() => void handleSendNote(project.id)}
                              className="px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Kirim</span>
                            </button>
                          </div>
                        </div>

                        <details className="text-xs border-t border-slate-100 dark:border-slate-800 pt-4">
                          <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
                            Lihat Rincian Pengajuan & Sinopsis yang Dikirim
                          </summary>
                          <div className="mt-3 space-y-2">
                            {project.specs.map((s, idx) => (
                              <div key={idx} className="grid grid-cols-1 sm:grid-cols-3 gap-1 py-1 border-b border-slate-100 dark:border-slate-800/70">
                                <span className="text-slate-500">{s.key}</span>
                                <span className="sm:col-span-2 text-slate-900 dark:text-slate-100">{s.val}</span>
                              </div>
                            ))}
                            {project.sinopsis && (
                              <div className="pt-2">
                                <span className="text-slate-500 block mb-1">Sinopsis Karya:</span>
                                <p className="text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                                  {project.sinopsis}
                                </p>
                              </div>
                            )}
                          </div>
                        </details>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* TAB 2: AJUKAN PESANAN BARU (ISOLATED VIEW) */}
          {activeTab === 'order' && (
            <section className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_28px_-14px_rgba(15,23,42,0.09)] dark:shadow-none p-6 sm:p-8">
              <OrderWorkspace
                embedded
                onSubmitted={() => {
                  setActiveTab('projects');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </section>
          )}

          {/* TAB 3: NOTIFIKASI STUDIO */}
          {activeTab === 'notifications' && (
            <section className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_28px_-14px_rgba(15,23,42,0.09)] dark:shadow-none p-6 sm:p-8 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-display font-bold text-slate-950 dark:text-slate-100">
                    Notifikasi Real-Time dari Studio ({clientUnreadCount} belum dibaca)
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    Verifikasi pembayaran, perubahan tahap produksi, balasan studio, dan Master File muncul otomatis.
                  </p>
                </div>
                {clientUnreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      void markAllClientNotificationsRead().catch((err) =>
                        showToast('Gagal', err instanceof Error ? err.message : 'Gagal memperbarui notifikasi.', 'error')
                      )
                    }
                    className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Tandai Semua Dibaca</span>
                  </button>
                )}
              </div>

              {clientNotifications.length === 0 ? (
                <p className="text-sm text-slate-600 dark:text-slate-400 py-10 text-center">
                  Belum ada notifikasi aktivitas studio untuk akun Anda.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {clientNotifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => !n.read && void markClientNotificationRead(n.id)}
                      className={`py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs cursor-pointer ${
                        n.read ? 'opacity-65' : ''
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {!n.read && (
                            <span className="font-mono text-[10px] font-bold text-indigo-700 dark:text-indigo-400">
                              BARU
                            </span>
                          )}
                          <strong className="text-slate-950 dark:text-slate-100">{n.title}</strong>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400">{n.message}</p>
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 whitespace-nowrap shrink-0">
                        {formatDateTimeID(n.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* TAB 4: PENGATURAN AKUN (ISOLATED VIEW) */}
          {activeTab === 'settings' && (
            <section className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_28px_-14px_rgba(15,23,42,0.09)] dark:shadow-none p-6 sm:p-8 space-y-8">
              <div className="border-b border-slate-200/80 dark:border-slate-800 pb-4">
                <h2 className="text-lg font-display font-bold text-slate-950 dark:text-slate-100">
                  Pengaturan Profil & Keamanan Akun
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Perubahan profil dan nomor WhatsApp langsung disinkronkan ke proyek dan Admin Studio.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <h3 className="text-sm font-display font-bold text-slate-950 dark:text-slate-100">
                    Profil & Kontak Aktif
                  </h3>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Email Terdaftar</label>
                    <input
                      disabled
                      value={clientUser.email}
                      className="w-full rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-950/60 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Nama Lengkap / Sanggar</label>
                    <input
                      required
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full rounded-xl border border-slate-300/90 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 shadow-[inset_0_1px_2px_rgba(15,23,42,0.03)] dark:shadow-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/15 focus:outline-none dark:focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Nomor WhatsApp</label>
                    <input
                      required
                      value={profileWa}
                      onChange={(e) => setProfileWa(e.target.value)}
                      className="w-full rounded-xl border border-slate-300/90 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 shadow-[inset_0_1px_2px_rgba(15,23,42,0.03)] dark:shadow-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/15 focus:outline-none dark:focus:border-indigo-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-[0_6px_14px_-4px_rgba(79,70,229,0.4)] dark:shadow-none text-white text-xs font-semibold cursor-pointer transition-all"
                  >
                    {profileSaving ? 'Menyimpan...' : 'Simpan Profil'}
                  </button>
                </form>

                <div className="space-y-4">
                  <h3 className="text-sm font-display font-bold text-slate-950 dark:text-slate-100">
                    Keamanan Akun & Sinkronisasi Firebase
                  </h3>
                  <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950 p-5 space-y-3 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Terhubung dengan Autentikasi Google</span>
                    </div>
                    <p className="leading-relaxed">
                      Keamanan kata sandi dan verifikasi dua langkah dikelola langsung oleh akun Google Anda (<strong>{clientUser.email}</strong>).
                    </p>
                    <p className="leading-relaxed">
                      Semua data pesanan, konfirmasi pembayaran, dan catatan revisi tersinkronisasi real-time melalui Cloud Firestore.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      {/* PAYMENT CONFIRMATION MODAL */}
      {payModalProject && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 dark:bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitPaymentConfirm}
            className="w-full max-w-md rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 shadow-[0_24px_48px_-16px_rgba(15,23,42,0.24)] dark:shadow-2xl"
          >
            <div className="border-b border-slate-200/80 dark:border-slate-800 pb-3">
              <h3 className="text-base font-display font-bold text-slate-950 dark:text-slate-100">
                {payModalProject.stage === 'DP_50'
                  ? 'Konfirmasi Pembayaran DP 50%'
                  : 'Konfirmasi Pelunasan 50%'}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{payModalProject.project.judul}</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Nama Pengirim Rekening *</label>
                <input
                  required
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300/90 dark:border-slate-800 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm shadow-[inset_0_1px_2px_rgba(15,23,42,0.03)] dark:shadow-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/15 focus:outline-none dark:focus:border-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Bank / E-Wallet *</label>
                  <input
                    required
                    value={bankMethod}
                    onChange={(e) => setBankMethod(e.target.value)}
                    placeholder="BCA / Mandiri / QRIS"
                    className="w-full rounded-xl border border-slate-300/90 dark:border-slate-800 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm shadow-[inset_0_1px_2px_rgba(15,23,42,0.03)] dark:shadow-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/15 focus:outline-none dark:focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Tanggal Transfer *</label>
                  <input
                    type="date"
                    required
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300/90 dark:border-slate-800 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm font-mono shadow-[inset_0_1px_2px_rgba(15,23,42,0.03)] dark:shadow-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/15 focus:outline-none dark:focus:border-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Nominal Ditransfer (Rp) *</label>
                <input
                  type="number"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full rounded-xl border border-slate-300/90 dark:border-slate-800 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm font-mono shadow-[inset_0_1px_2px_rgba(15,23,42,0.03)] dark:shadow-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/15 focus:outline-none dark:focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Tautan Bukti Transfer (Google Drive — Opsional)</label>
                <input
                  type="url"
                  value={proofUrl}
                  onChange={(e) => setProofUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full rounded-xl border border-slate-300/90 dark:border-slate-800 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm shadow-[inset_0_1px_2px_rgba(15,23,42,0.03)] dark:shadow-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/15 focus:outline-none dark:focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Catatan Tambahan (Opsional)</label>
                <input
                  value={referenceNote}
                  onChange={(e) => setReferenceNote(e.target.value)}
                  placeholder="Contoh: Berita transfer DP Tari Mahakam"
                  className="w-full rounded-xl border border-slate-300/90 dark:border-slate-800 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm shadow-[inset_0_1px_2px_rgba(15,23,42,0.03)] dark:shadow-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/15 focus:outline-none dark:focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPayModalProject(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={paySubmitting}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
              >
                {paySubmitting ? 'Mengirim...' : 'Kirim Konfirmasi ke Admin'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DOCUMENT VIEWER MODAL */}
      <DocumentsModal
        project={docModal.project}
        kind={docModal.kind}
        onClose={() => setDocModal({ project: null, kind: null })}
      />
    </div>
  );
}
