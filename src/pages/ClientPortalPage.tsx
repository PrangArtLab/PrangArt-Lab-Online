import {
  Bell,
  CheckCheck,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Lock,
  MessageSquare,
  Plus,
  Send,
  ShieldCheck,
} from 'lucide-react';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClientAuthCard } from '../components/ClientAuthCard';
import { DocumentsModal, type DocumentModalKind } from '../components/DocumentsModal';
import { TRACKER_MILESTONES, useStudio } from '../context/StudioContext';
import {
  formatDateTimeID,
  formatRupiah,
  getProjectPaymentAccess,
  normalizeWhatsAppNumber,
  safeExternalUrl,
} from '../lib/format';
import type { Project } from '../types';

export function ClientPortalPage() {
  const {
    clientUser,
    projects,
    notifications,
    unreadCount,
    wsConnected,
    siteContent,
    confirmPayment,
    addClientNote,
    updateClientProfile,
    changeClientPassword,
    markNotificationRead,
    markAllNotificationsRead,
    showToast,
  } = useStudio();

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileWa, setProfileWa] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPassFields, setShowPassFields] = useState(false);
  const [passSaving, setPassSaving] = useState(false);

  if (!clientUser) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
        <ClientAuthCard />
      </div>
    );
  }

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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass !== confirmPass) {
      showToast('Tidak Cocok', 'Konfirmasi kata sandi baru tidak sama.', 'warning');
      return;
    }
    setPassSaving(true);
    try {
      await changeClientPassword(oldPass, newPass);
      setOldPass('');
      setNewPass('');
      setConfirmPass('');
    } catch (err: unknown) {
      showToast('Gagal Ubah Sandi', err instanceof Error ? err.message : 'Error', 'error');
    } finally {
      setPassSaving(false);
    }
  };

  const studioBank = siteContent?.settings;
  const studioWa = normalizeWhatsAppNumber(studioBank?.studioWhatsApp);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14 pb-24 space-y-8">
      {/* Workspace Header */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-indigo-600 dark:text-indigo-400 font-semibold">Ruang Klien</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <span
                className={`w-2 h-2 rounded-full ${
                  wsConnected ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              {wsConnected ? 'Sinkronisasi Real-Time Aktif' : 'Menghubungkan Ulang...'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-slate-100">
            Halo, {clientUser.name}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {clientUser.email} · WhatsApp: {clientUser.wa || '-'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              setProfileName(clientUser.name);
              setProfileWa(clientUser.wa);
              setSettingsOpen((v) => !v);
            }}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-indigo-500 cursor-pointer"
          >
            {settingsOpen ? 'Tutup Pengaturan Akun' : 'Pengaturan Akun'}
          </button>
          <Link
            to="/pemesanan"
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Ajukan Pesanan Baru</span>
          </Link>
        </div>
      </div>

      {/* Real-Time Notifications Panel from Admin */}
      {notifications.length > 0 && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-sm font-display font-bold text-slate-900 dark:text-slate-100">
                Pembaruan Terbaru dari Studio ({unreadCount} belum dibaca)
              </h2>
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

          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-56 overflow-y-auto">
            {notifications.slice(0, 8).map((n) => (
              <div
                key={n.id}
                onClick={() => !n.read && void markNotificationRead(n.id)}
                className={`py-3 flex items-start justify-between gap-4 text-xs cursor-pointer ${
                  n.read ? 'opacity-70' : 'font-medium'
                }`}
              >
                <div>
                  <div className="text-slate-900 dark:text-slate-100 font-semibold">{n.title}</div>
                  <div className="text-slate-600 dark:text-slate-400 mt-0.5">{n.message}</div>
                </div>
                <div className="text-[11px] font-mono text-slate-500 whitespace-nowrap shrink-0">
                  {formatDateTimeID(n.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Account Settings Panel */}
      {settingsOpen && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <h3 className="text-base font-display font-bold text-slate-900 dark:text-slate-100">
                Profil & Kontak Aktif
              </h3>
              <div>
                <label className="block text-xs font-semibold mb-1.5">Nama Lengkap / Sanggar</label>
                <input
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5">Nomor WhatsApp</label>
                <input
                  required
                  value={profileWa}
                  onChange={(e) => setProfileWa(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={profileSaving}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
              >
                {profileSaving ? 'Menyimpan...' : 'Simpan Profil'}
              </button>
            </form>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-display font-bold text-slate-900 dark:text-slate-100">
                  Ganti Kata Sandi
                </h3>
                <button
                  type="button"
                  onClick={() => setShowPassFields((v) => !v)}
                  className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 inline-flex items-center gap-1 cursor-pointer"
                >
                  {showPassFields ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showPassFields ? 'Sembunyikan' : 'Tampilkan'}</span>
                </button>
              </div>
              <input
                type={showPassFields ? 'text' : 'password'}
                required
                value={oldPass}
                onChange={(e) => setOldPass(e.target.value)}
                placeholder="Kata sandi lama"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 text-sm"
              />
              <input
                type={showPassFields ? 'text' : 'password'}
                required
                minLength={6}
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="Kata sandi baru (min. 6 karakter)"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 text-sm"
              />
              <input
                type={showPassFields ? 'text' : 'password'}
                required
                minLength={6}
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                placeholder="Ulangi kata sandi baru"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 text-sm"
              />
              <button
                type="submit"
                disabled={passSaving}
                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold cursor-pointer"
              >
                {passSaving ? 'Memperbarui...' : 'Perbarui Kata Sandi'}
              </button>
            </form>
          </div>
        </section>
      )}

      {/* Projects List */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-bold text-slate-900 dark:text-slate-100">
            Proyek Anda ({projects.length})
          </h2>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-12 text-center space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Belum ada pengajuan proyek pada akun Anda.
            </p>
            <Link
              to="/pemesanan"
              className="inline-flex px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
            >
              Buat Pesanan Pertama
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {projects.map((project) => {
              const access = getProjectPaymentAccess(project);
              const milestoneIdx = Math.max(
                0,
                TRACKER_MILESTONES.indexOf(project.productionStatus)
              );
              const masterUrl = safeExternalUrl(project.masterFileUrl);

              return (
                <article
                  key={project.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6"
                >
                  {/* Header Row */}
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
                    <div className="space-y-1">
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                          {project.serviceLineLabel}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{project.packageName}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{project.id}</span>
                      </div>
                      <h3 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">
                        {project.judul}
                      </h3>
                      <p className="text-xs text-slate-500 font-mono tabular-nums">
                        Durasi {project.durasi} · Total {formatRupiah(project.totalPrice)} · Diajukan {formatDateTimeID(project.createdAt)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setDocModal({ project, kind: 'brief' })}
                        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-indigo-500 inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Brief</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDocModal({ project, kind: 'contract' })}
                        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-indigo-500 cursor-pointer"
                      >
                        Kontrak SPK
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDocModal({
                            project,
                            kind: access.isDpVerified || access.isFinalSubmittedByClient ? 'invoice_final' : 'invoice_dp',
                          })
                        }
                        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-indigo-500 cursor-pointer"
                      >
                        Invoice
                      </button>
                    </div>
                  </div>

                  {/* 7-Step Milestone Progress */}
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

                  {/* Payment Access & Confirmation Block */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-5 space-y-4">
                    {access.isAwaitingDp && (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
                            <Clock className="w-4 h-4" />
                            <span>Tahap 1: Menunggu Pembayaran DP 50% ({formatRupiah(project.dpAmount)})</span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          Transfer DP 50% ke <strong>{studioBank?.studioBankName}</strong> No. Rek{' '}
                          <strong className="font-mono">{studioBank?.studioBankAccount}</strong> a.n.{' '}
                          <strong>{studioBank?.studioBankHolder}</strong>, lalu kirim konfirmasi agar Admin langsung menerima notifikasi & memverifikasi.
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
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs font-bold text-sky-700 dark:text-sky-400">
                            <ShieldCheck className="w-4 h-4" />
                            <span>
                              {access.isFinalSubmittedByClient
                                ? 'Konfirmasi Pelunasan Dikirim — Menunggu Verifikasi Admin'
                                : `DP 50% Terverifikasi · Sisa Pelunasan: ${formatRupiah(project.remainingAmount)}`}
                            </span>
                          </div>
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
                          <span>Pembayaran Lunas 100% Terverifikasi</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Terima kasih. Seluruh kewajiban pembayaran telah lunas. Anda dapat mengunduh Bukti Lunas Resmi dan Master File proyek Anda.
                        </p>
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setDocModal({ project, kind: 'receipt' })}
                            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Bukti Lunas / Kuitansi</span>
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
                        <span>Bukti Lunas Resmi & Master File terbuka otomatis setelah pelunasan 100% diverifikasi Admin.</span>
                      </div>
                    )}
                  </div>

                  {/* Client & Admin Notes Thread */}
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
                        className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 text-xs"
                      />
                      <button
                        type="button"
                        disabled={noteLoadingId === project.id}
                        onClick={() => void handleSendNote(project.id)}
                        className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Kirim</span>
                      </button>
                    </div>
                  </div>

                  {/* Specs Summary */}
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

      {/* PAYMENT CONFIRMATION MODAL */}
      {payModalProject && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitPaymentConfirm}
            className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 shadow-2xl"
          >
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-display font-bold text-slate-900 dark:text-slate-100">
                {payModalProject.stage === 'DP_50'
                  ? 'Konfirmasi Pembayaran DP 50%'
                  : 'Konfirmasi Pelunasan 50%'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">{payModalProject.project.judul}</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Nama Pengirim Rekening *</label>
                <input
                  required
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Bank / E-Wallet *</label>
                  <input
                    required
                    value={bankMethod}
                    onChange={(e) => setBankMethod(e.target.value)}
                    placeholder="BCA / Mandiri / QRIS"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Tanggal Transfer *</label>
                  <input
                    type="date"
                    required
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Nominal Ditransfer (Rp) *</label>
                <input
                  type="number"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Tautan Bukti Transfer (Google Drive / Gambar — Opsional)</label>
                <input
                  type="url"
                  value={proofUrl}
                  onChange={(e) => setProofUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Catatan Tambahan (Opsional)</label>
                <input
                  value={referenceNote}
                  onChange={(e) => setReferenceNote(e.target.value)}
                  placeholder="Contoh: Berita transfer DP Tari Mahakam"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm"
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
