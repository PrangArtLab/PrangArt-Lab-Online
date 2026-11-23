import { Download, Printer, X } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import {
  formatDateLongID,
  formatDateShortID,
  formatDateTimeID,
  formatRupiah,
  getProjectFinanceSummary,
  getProjectPaymentAccess,
} from '../lib/format';
import { downloadOrderDataPdf, downloadStudioDocPdf, type StudioPdfDocKind } from '../lib/pdfExport';
import type { Project } from '../types';
import { OwnerSignatureSvg, StudioLogoSvg, StudioStampSvg } from './StudioBrandMarks';

export type DocumentModalKind =
  | 'brief'
  | 'order_pdf'
  | 'contract'
  | 'invoice_dp'
  | 'invoice_final'
  | 'receipt_dp'
  | 'receipt_final'
  | 'receipt';

interface DocumentsModalProps {
  project: Project | null;
  kind: DocumentModalKind | null;
  onClose: () => void;
}

const OWNER_NAME = 'Fikri Yassaar Arrazaq, S.Sn.';
const OWNER_TITLE = 'Founder & Music Director — PrangArt Lab';

export function DocumentsModal({ project, kind, onClose }: DocumentsModalProps) {
  const { siteContent, showToast } = useStudio();

  if (!project || !kind) return null;

  const normalizedKind: Exclude<DocumentModalKind, 'receipt'> =
    kind === 'receipt' ? 'receipt_final' : kind;

  const access = getProjectPaymentAccess(project);
  const fin = getProjectFinanceSummary(project);
  const settings = siteContent?.settings;

  const titles: Record<Exclude<DocumentModalKind, 'receipt'>, string> = {
    brief: `Brief Produksi — ${project.judul}`,
    order_pdf: `Data Pemesanan & Produksi Lengkap — ${project.id}`,
    contract: `Surat Perjanjian Kerja Sama — ${project.id}`,
    invoice_dp: `Invoice DP 50% — ${project.id}`,
    invoice_final: `Invoice Pelunasan 50% — ${project.id}`,
    receipt_dp: `Kuitansi Resmi DP 50% — ${project.id}`,
    receipt_final: `Kuitansi Pelunasan Resmi 100% — ${project.id}`,
  };

  const hasBankConfigured = Boolean(
    settings?.studioBankName?.trim() &&
      settings?.studioBankAccount?.trim() &&
      settings.studioBankAccount.trim() !== '1234-5678-9012'
  );

  const handleDownloadPdf = () => {
    try {
      if (normalizedKind === 'order_pdf') {
        downloadOrderDataPdf(project, settings);
      } else {
        downloadStudioDocPdf(normalizedKind as StudioPdfDocKind, project, settings);
      }
      showToast('PDF Diunduh', `${titles[normalizedKind]} berhasil diunduh sebagai file PDF.`, 'success');
    } catch (err: unknown) {
      showToast(
        'Gagal Mengunduh PDF',
        err instanceof Error ? err.message : 'Terjadi kendala saat membuat PDF.',
        'error'
      );
    }
  };

  const renderAuthorizationStampBlock = (
    stampLabel: string,
    variant: 'indigo' | 'emerald' = 'indigo',
    dateIso?: string
  ) => (
    <div className="pt-5 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
      <p className="text-[11px] text-slate-500 max-w-sm leading-relaxed">
        Dokumen resmi ini diterbitkan oleh PrangArt Lab dan dilengkapi logo studio, stempel verifikasi, serta tanda tangan digital pemilik studio yang sah.
      </p>
      <div className="flex flex-col items-center sm:items-end text-center sm:text-right shrink-0">
        <span className="text-[11px] text-slate-500">
          Samarinda, {formatDateShortID(dateIso || project.updatedAt)}
        </span>
        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
          Pemilik &amp; Pengelola Studio
        </span>
        <div className="relative flex items-center justify-center my-1.5 min-h-[82px] min-w-[210px]">
          <StudioStampSvg
            label={stampLabel}
            dateText={formatDateShortID(dateIso || project.updatedAt)}
            variant={variant}
            className="w-24 h-24 opacity-90 mr-20"
          />
          <OwnerSignatureSvg className="w-40 h-14 absolute right-0 top-1/2 -translate-y-1/2" />
        </div>
        <strong className="text-xs text-slate-900 dark:text-slate-100">{OWNER_NAME}</strong>
        <span className="text-[11px] text-slate-500">{OWNER_TITLE}</span>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
        <div className="no-print flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-display font-bold text-slate-900 dark:text-slate-100 truncate">
            {titles[normalizedKind]}
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup dokumen"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-6 sm:p-8 text-sm text-slate-800 dark:text-slate-200">
          <div id="printable-document-sheet" className="space-y-6">
            {/* Document Header with Vector Studio Logo */}
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3.5">
                <StudioLogoSvg className="w-11 h-11 shrink-0" />
                <div>
                  <h1 className="text-lg font-display font-bold text-slate-900 dark:text-slate-100 leading-tight">
                    PrangArt Lab — Music Production Studio
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {settings?.studioAddress || 'Samarinda, Kalimantan Timur, Indonesia'} ·{' '}
                    {settings?.studioEmail || 'prangart.lab@gmail.com'}
                  </p>
                </div>
              </div>
              <div className="text-xs font-mono text-right">
                <div className="font-semibold text-indigo-600 dark:text-indigo-400">{project.id}</div>
                <div className="text-slate-500">{formatDateLongID(project.createdAt)}</div>
              </div>
            </div>

            {normalizedKind === 'brief' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Kartu Brief Produksi Karya
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {project.serviceLineLabel} · {project.packageName} · Durasi {project.durasi}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 text-xs">
                  <div>
                    <span className="text-slate-500 block">Nama Pemesan / Sanggar</span>
                    <strong className="text-slate-900 dark:text-slate-100">{project.clientName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Kontak &amp; Email</span>
                    <strong className="text-slate-900 dark:text-slate-100">
                      {project.clientWa} · {project.contactEmail}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Judul Karya</span>
                    <strong className="text-slate-900 dark:text-slate-100">{project.judul}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Status &amp; Tanggal Finishing</span>
                    <strong className="text-indigo-600 dark:text-indigo-400">
                      {project.productionStatus} · Finishing: {formatDateShortID(project.finishingDate)}
                    </strong>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Spesifikasi &amp; Parameter Teknis
                  </h3>
                  <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
                    {project.specs.map((spec, idx) => (
                      <div key={idx} className="px-4 py-2.5 grid grid-cols-1 sm:grid-cols-3 gap-1 text-xs">
                        <span className="font-medium text-slate-500 dark:text-slate-400">{spec.key}</span>
                        <span className="sm:col-span-2 text-slate-900 dark:text-slate-100">{spec.val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {project.sinopsis && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Sinopsis Karya Tari
                    </h3>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 text-xs leading-relaxed whitespace-pre-line">
                      {project.sinopsis}
                    </div>
                  </div>
                )}

                {project.videoLink && (
                  <div className="text-xs">
                    <span className="font-semibold text-slate-500">Tautan Referensi: </span>
                    <span className="font-mono break-all text-indigo-600 dark:text-indigo-400">
                      {project.videoLink}
                    </span>
                  </div>
                )}
              </div>
            )}

            {normalizedKind === 'order_pdf' && (
              <div className="space-y-5 text-xs">
                <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/30 p-4 space-y-1">
                  <span className="font-mono text-[11px] font-bold uppercase text-indigo-600 dark:text-indigo-400">
                    RINGKASAN DATA PEMESANAN &amp; PRODUKSI
                  </span>
                  <h2 className="text-lg font-display font-bold text-slate-900 dark:text-slate-100">
                    {project.judul}
                  </h2>
                  <p className="text-slate-600 dark:text-slate-300">
                    {project.serviceLineLabel} · {project.packageName} · Durasi {project.durasi} · Status:{' '}
                    <strong>{project.productionStatus}</strong>
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2">
                    <h3 className="font-bold uppercase tracking-wider text-[11px] text-indigo-600 dark:text-indigo-400">
                      Data Konsumen
                    </h3>
                    <div className="space-y-1">
                      <p><span className="text-slate-500">Nama / Sanggar:</span> <strong>{project.clientName}</strong></p>
                      <p><span className="text-slate-500">WhatsApp:</span> <strong className="font-mono">{project.clientWa}</strong></p>
                      <p><span className="text-slate-500">Email:</span> {project.contactEmail}</p>
                      <p><span className="text-slate-500">Tgl Pesan:</span> {formatDateTimeID(project.createdAt)}</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2">
                    <h3 className="font-bold uppercase tracking-wider text-[11px] text-indigo-600 dark:text-indigo-400">
                      Data Keuangan &amp; Finishing
                    </h3>
                    <div className="space-y-1 font-mono">
                      <p><span className="text-slate-500 font-sans">Nilai Kontrak:</span> <strong>{formatRupiah(fin.totalPrice)}</strong></p>
                      <p><span className="text-slate-500 font-sans">Terbayar:</span> <strong className="text-emerald-600 dark:text-emerald-400">{formatRupiah(fin.verifiedPaidAmount)}</strong></p>
                      <p><span className="text-slate-500 font-sans">Sisa Tagihan:</span> <strong className="text-amber-600 dark:text-amber-400">{formatRupiah(fin.outstandingAmount)}</strong></p>
                      <p><span className="text-slate-500 font-sans">Tgl Finishing:</span> <strong>{formatDateShortID(project.finishingDate)}</strong></p>
                    </div>
                  </div>
                </div>

                {(project.masterFileUrl || project.finishingNotes) && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-1.5">
                    <h3 className="font-bold uppercase tracking-wider text-[11px] text-slate-500">
                      Hasil Karya &amp; Catatan Finishing
                    </h3>
                    {project.masterFileUrl && (
                      <p className="font-mono break-all text-indigo-600 dark:text-indigo-400">
                        Master File: {project.masterFileUrl}
                      </p>
                    )}
                    {project.finishingNotes && (
                      <p className="text-slate-700 dark:text-slate-300">{project.finishingNotes}</p>
                    )}
                  </div>
                )}

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Spesifikasi Lengkap Karya
                  </h3>
                  <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
                    {project.specs.map((spec, idx) => (
                      <div key={idx} className="px-4 py-2 grid grid-cols-1 sm:grid-cols-3 gap-1">
                        <span className="font-medium text-slate-500 dark:text-slate-400">{spec.key}</span>
                        <span className="sm:col-span-2 text-slate-900 dark:text-slate-100">{spec.val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {project.sinopsis && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-1">
                    <strong className="text-slate-600 dark:text-slate-400 block">Sinopsis Karya:</strong>
                    <p className="leading-relaxed whitespace-pre-line">{project.sinopsis}</p>
                  </div>
                )}

                {renderAuthorizationStampBlock(
                  fin.isFullyPaid ? 'LUNAS 100%' : fin.isDpVerified ? 'DP TERVERIFIKASI' : 'ARSIP STUDIO',
                  fin.isFullyPaid ? 'emerald' : 'indigo'
                )}
              </div>
            )}

            {normalizedKind === 'contract' && (
              <div className="space-y-4 text-xs leading-relaxed">
                <div className="text-center space-y-1">
                  <h2 className="text-base font-bold uppercase">SURAT PERJANJIAN KERJA SAMA PRODUKSI MUSIK</h2>
                  <p className="font-mono text-slate-500">Nomor: {project.id}/SPK-PA/PRANGART</p>
                </div>
                <p>
                  Pada hari ini, <strong>{formatDateLongID(project.createdAt)}</strong>, telah disepakati Perjanjian Kerja Sama Produksi Musik antara:
                </p>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-3">
                  <div>
                    <strong className="text-indigo-600 dark:text-indigo-400 block">I. PIHAK PERTAMA (STUDIO PRODUKSI)</strong>
                    <p>PrangArt Lab (PrangArt Studios) · Perwakilan: {OWNER_NAME} · {settings?.studioAddress}</p>
                  </div>
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                    <strong className="text-indigo-600 dark:text-indigo-400 block">II. PIHAK KEDUA (KLIEN / PEMESAN)</strong>
                    <p>
                      {project.clientName} · WhatsApp: {project.clientWa} · Email: {project.contactEmail}
                    </p>
                  </div>
                </div>
                <div>
                  <strong>PASAL 1 — OBJEK &amp; SPESIFIKASI PEKERJAAN</strong>
                  <p className="mt-1">
                    Pihak Pertama memproduksi karya berjudul <strong>{project.judul}</strong> ({project.serviceLineLabel} — {project.packageName}, durasi {project.durasi}).
                    {project.finishingDate ? ` Jadwal finishing ditetapkan pada ${formatDateLongID(project.finishingDate)}.` : ''}
                  </p>
                </div>
                <div>
                  <strong>PASAL 2 — BIAYA &amp; PEMBAYARAN BERTAHAP</strong>
                  <p className="mt-1">
                    Total biaya yang disepakati sebesar <strong>{formatRupiah(project.totalPrice)}</strong>. Pembayaran dilakukan dalam 2 tahap: DP 50% (<strong>{formatRupiah(project.dpAmount)}</strong>) sebelum produksi dimulai, dan pelunasan 50% (<strong>{formatRupiah(project.remainingAmount)}</strong>) sebelum penyerahan Master File dan Kuitansi Pelunasan resmi.
                  </p>
                </div>
                <div>
                  <strong>PASAL 3 — REVISI, KONFIRMASI &amp; HAK KARYA</strong>
                  <p className="mt-1">
                    Hak revisi mengikuti paket yang dipilih dalam koridor konsep awal. Klien wajib melakukan konfirmasi pembayaran melalui Ruang Klien agar Admin Studio memverifikasi. Kredit karya dicantumkan sebagai &ldquo;Music by PrangArt Lab&rdquo; kecuali disepakati perjanjian Full Buyout.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-center flex flex-col items-center">
                    <span className="text-slate-500 block">PIHAK KEDUA (PEMESAN)</span>
                    <div className="h-20 flex items-center justify-center">
                      <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                        {project.contractAgreed ? 'Disetujui Secara Digital' : 'Menunggu Persetujuan'}
                      </span>
                    </div>
                    <strong className="block">{project.clientName}</strong>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-center flex flex-col items-center">
                    <span className="text-slate-500 block">PIHAK PERTAMA (STUDIO)</span>
                    <div className="relative flex items-center justify-center my-1 h-20 w-48">
                      <StudioStampSvg
                        label="DISAHKAN STUDIO"
                        dateText={formatDateShortID(project.createdAt)}
                        variant="indigo"
                        className="w-20 h-20 opacity-85 mr-16"
                      />
                      <OwnerSignatureSvg className="w-32 h-12 absolute right-0" />
                    </div>
                    <strong className="block">{OWNER_NAME}</strong>
                    <span className="text-[11px] text-slate-500">PrangArt Lab</span>
                  </div>
                </div>
              </div>
            )}

            {(normalizedKind === 'invoice_dp' || normalizedKind === 'invoice_final') && (
              <div className="space-y-5 text-xs">
                <div className="flex flex-wrap justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold">
                      {normalizedKind === 'invoice_dp'
                        ? 'INVOICE PEMBAYARAN DP 50%'
                        : 'INVOICE PELUNASAN AKHIR 50%'}
                    </h2>
                    <p className="text-slate-500 mt-0.5">
                      Ditagihkan kepada: <strong>{project.clientName}</strong> ({project.clientWa})
                    </p>
                  </div>
                  <div className="font-mono text-right">
                    <div>Total Proyek: {formatRupiah(project.totalPrice)}</div>
                    <div className="text-base font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                      Tagihan Tahap Ini:{' '}
                      {formatRupiah(
                        normalizedKind === 'invoice_dp' ? project.dpAmount : project.remainingAmount
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-1.5">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Proyek</span>
                    <span className="font-semibold text-right">
                      {project.judul} ({project.serviceLineLabel})
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Paket Layanan &amp; Durasi</span>
                    <span>
                      {project.packageName} · {project.durasi}
                    </span>
                  </div>
                  {normalizedKind === 'invoice_final' && (
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">DP 50% (Tahap 1)</span>
                      <span className="font-mono">
                        {formatRupiah(project.dpAmount)} ({project.dpStatus})
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Status Pembayaran Tahap Ini</span>
                    <span className="font-semibold">
                      {normalizedKind === 'invoice_dp'
                        ? project.dpStatus
                        : project.finalPaymentStatus}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-1">
                  <strong className="block text-slate-900 dark:text-slate-100">
                    Informasi Rekening Pembayaran Studio
                  </strong>
                  {hasBankConfigured ? (
                    <>
                      <p>Bank / Tujuan: <strong>{settings?.studioBankName}</strong></p>
                      <p>Nomor Rekening: <strong className="font-mono">{settings?.studioBankAccount}</strong></p>
                      <p>Atas Nama: <strong>{settings?.studioBankHolder}</strong></p>
                    </>
                  ) : (
                    <p className="text-amber-700 dark:text-amber-400">
                      Detail rekening tujuan sedang diperbarui. Silakan hubungi Admin Studio melalui WhatsApp atau email ({settings?.studioEmail || 'prangart.lab@gmail.com'}) untuk konfirmasi nomor rekening tujuan resmi.
                    </p>
                  )}
                  <p className="text-slate-500 pt-1">
                    Setelah melakukan transfer, kirim konfirmasi langsung melalui tombol &ldquo;Konfirmasi Pembayaran&rdquo; di Ruang Klien.
                  </p>
                </div>

                {renderAuthorizationStampBlock(
                  normalizedKind === 'invoice_dp'
                    ? access.canDownloadDpReceipt
                      ? 'DP 50% LUNAS'
                      : 'INVOICE RESMI'
                    : access.isFullyPaid
                    ? 'LUNAS 100%'
                    : 'INVOICE RESMI',
                  (normalizedKind === 'invoice_dp' && access.canDownloadDpReceipt) ||
                    (normalizedKind === 'invoice_final' && access.isFullyPaid)
                    ? 'emerald'
                    : 'indigo'
                )}
              </div>
            )}

            {normalizedKind === 'receipt_dp' && (
              <div className="space-y-5 text-xs">
                {!access.canDownloadDpReceipt ? (
                  <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-5 text-amber-800 dark:text-amber-300">
                    Kuitansi DP 50% diterbitkan setelah Admin Studio memverifikasi pembayaran DP 50%.
                  </div>
                ) : (
                  <>
                    <div className="text-center border-b border-slate-200 dark:border-slate-800 pb-4">
                      <h2 className="text-base font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                        KUITANSI RESMI PEMBAYARAN DP 50%
                      </h2>
                      <p className="font-mono text-slate-500 mt-1">
                        No: {project.id}/KW-DP · Status: DP 50% TERVERIFIKASI
                      </p>
                    </div>
                    <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <div className="px-4 py-3 flex justify-between gap-4">
                        <span className="text-slate-500">Telah Diterima Dari</span>
                        <strong>{project.clientName}</strong>
                      </div>
                      <div className="px-4 py-3 flex justify-between gap-4">
                        <span className="text-slate-500">Untuk Pembayaran</span>
                        <strong className="text-right">
                          DP 50% Proyek {project.judul} ({project.serviceLineLabel} · {project.packageName})
                        </strong>
                      </div>
                      <div className="px-4 py-3 flex justify-between gap-4">
                        <span className="text-slate-500">Nominal DP 50% Diterima</span>
                        <strong className="font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                          {formatRupiah(project.dpAmount)}
                        </strong>
                      </div>
                      <div className="px-4 py-3 flex justify-between gap-4">
                        <span className="text-slate-500">Sisa Pelunasan 50%</span>
                        <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                          {access.isFullyPaid ? 'Rp0 (Sudah Lunas 100%)' : formatRupiah(project.remainingAmount)}
                        </span>
                      </div>
                    </div>

                    {renderAuthorizationStampBlock('LUNAS DP 50%', 'emerald')}
                  </>
                )}
              </div>
            )}

            {normalizedKind === 'receipt_final' && (
              <div className="space-y-5 text-xs">
                {!access.canDownloadLunasDocument ? (
                  <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-5 text-amber-800 dark:text-amber-300">
                    Kuitansi Pelunasan Resmi 100% baru diterbitkan setelah Admin memverifikasi pelunasan 100%.
                  </div>
                ) : (
                  <>
                    <div className="text-center border-b border-slate-200 dark:border-slate-800 pb-4">
                      <h2 className="text-base font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                        KUITANSI &amp; BUKTI PELUNASAN RESMI (100%)
                      </h2>
                      <p className="font-mono text-slate-500 mt-1">
                        No: {project.id}/KW-LUNAS · Status: LUNAS 100%
                      </p>
                    </div>
                    <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <div className="px-4 py-3 flex justify-between gap-4">
                        <span className="text-slate-500">Telah Diterima Dari</span>
                        <strong>{project.clientName}</strong>
                      </div>
                      <div className="px-4 py-3 flex justify-between gap-4">
                        <span className="text-slate-500">Untuk Pembayaran</span>
                        <strong className="text-right">
                          Pelunasan 100% {project.judul} ({project.serviceLineLabel} · {project.packageName})
                        </strong>
                      </div>
                      <div className="px-4 py-3 flex justify-between gap-4">
                        <span className="text-slate-500">Nominal Total Lunas</span>
                        <strong className="font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                          {formatRupiah(project.totalPrice)}
                        </strong>
                      </div>
                      <div className="px-4 py-3 flex justify-between gap-4">
                        <span className="text-slate-500">Tanggal Finishing &amp; Verifikasi</span>
                        <span>
                          {project.finishingDate ? `Finishing ${formatDateShortID(project.finishingDate)} · ` : ''}
                          {formatDateLongID(project.updatedAt)}
                        </span>
                      </div>
                    </div>

                    {renderAuthorizationStampBlock('LUNAS 100%', 'emerald')}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
