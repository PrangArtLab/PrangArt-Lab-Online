import { Download, Printer, X } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { formatDateLongID, formatRupiah, getProjectPaymentAccess } from '../lib/format';
import type { Project } from '../types';

export type DocumentModalKind = 'brief' | 'contract' | 'invoice_dp' | 'invoice_final' | 'receipt';

interface DocumentsModalProps {
  project: Project | null;
  kind: DocumentModalKind | null;
  onClose: () => void;
}

export function DocumentsModal({ project, kind, onClose }: DocumentsModalProps) {
  const { siteContent } = useStudio();

  if (!project || !kind) return null;

  const access = getProjectPaymentAccess(project);
  const settings = siteContent?.settings;

  const titles: Record<DocumentModalKind, string> = {
    brief: `Brief Produksi — ${project.judul}`,
    contract: `Surat Perjanjian Kerja Sama — ${project.id}`,
    invoice_dp: `Invoice DP 50% — ${project.id}`,
    invoice_final: `Invoice Pelunasan 50% — ${project.id}`,
    receipt: `Bukti Lunas & Kuitansi Resmi — ${project.id}`,
  };

  const handleDownloadHtml = () => {
    const contentEl = document.getElementById('printable-document-sheet');
    if (!contentEl) return;
    const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>${titles[kind]}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; max-width: 820px; margin: 36px auto; padding: 0 20px; line-height: 1.6; }
  h1, h2, h3 { margin: 0 0 8px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  td, th { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-size: 13px; vertical-align: top; }
  th { background: #f8fafc; }
  .muted { color: #475569; font-size: 12px; }
  .box { border: 1px solid #cbd5e1; padding: 14px; border-radius: 8px; margin: 14px 0; background: #f8fafc; }
</style>
</head>
<body>${contentEl.innerHTML}</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${kind}-${project.id.toLowerCase()}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
        <div className="no-print flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-display font-bold text-slate-900 dark:text-slate-100 truncate">
            {titles[kind]}
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
              onClick={handleDownloadHtml}
              className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh Dokumen</span>
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
            {/* Document Header */}
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h1 className="text-lg font-display font-bold text-slate-900 dark:text-slate-100">
                  PrangArt Lab — Music Production Studio
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {settings?.studioAddress || 'Samarinda, Kalimantan Timur, Indonesia'} · {settings?.studioEmail || 'prangart.lab@gmail.com'}
                </p>
              </div>
              <div className="text-xs font-mono text-right">
                <div className="font-semibold text-slate-900 dark:text-slate-100">{project.id}</div>
                <div className="text-slate-500">{formatDateLongID(project.createdAt)}</div>
              </div>
            </div>

            {kind === 'brief' && (
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
                    <span className="text-slate-500 block">Kontak & Email</span>
                    <strong className="text-slate-900 dark:text-slate-100">
                      {project.clientWa} · {project.contactEmail}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Judul Karya</span>
                    <strong className="text-slate-900 dark:text-slate-100">{project.judul}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Status Produksi Saat Ini</span>
                    <strong className="text-indigo-600 dark:text-indigo-400">{project.productionStatus}</strong>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Spesifikasi & Parameter Teknis
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

            {kind === 'contract' && (
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
                    <p>PrangArt Lab (PrangArt Studios) · Perwakilan: Fikri Yassaar Arrazaq, S.Sn. · {settings?.studioAddress}</p>
                  </div>
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                    <strong className="text-indigo-600 dark:text-indigo-400 block">II. PIHAK KEDUA (KLIEN / PEMESAN)</strong>
                    <p>
                      {project.clientName} · WhatsApp: {project.clientWa} · Email: {project.contactEmail}
                    </p>
                  </div>
                </div>
                <div>
                  <strong>PASAL 1 — OBJEK & SPESIFIKASI PEKERJAAN</strong>
                  <p className="mt-1">
                    Pihak Pertama memproduksi karya berjudul <strong>{project.judul}</strong> ({project.serviceLineLabel} — {project.packageName}, durasi {project.durasi}).
                  </p>
                </div>
                <div>
                  <strong>PASAL 2 — BIAYA & PEMBAYARAN BERTAHAP</strong>
                  <p className="mt-1">
                    Total biaya yang disepakati sebesar <strong>{formatRupiah(project.totalPrice)}</strong>. Pembayaran dilakukan dalam 2 tahap: DP 50% (<strong>{formatRupiah(project.dpAmount)}</strong>) sebelum produksi dimulai, dan pelunasan 50% (<strong>{formatRupiah(project.remainingAmount)}</strong>) sebelum penyerahan Master File dan Bukti Lunas resmi.
                  </p>
                </div>
                <div>
                  <strong>PASAL 3 — REVISI, KONFIRMASI & HAK KARYA</strong>
                  <p className="mt-1">
                    Hak revisi mengikuti paket yang dipilih dalam koridor konsep awal. Klien wajib melakukan konfirmasi pembayaran melalui Ruang Klien agar Admin Studio memverifikasi. Kredit karya dicantumkan sebagai &ldquo;Music by PrangArt Lab&rdquo; kecuali disepakati perjanjian Full Buyout.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 text-center">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                    <span className="text-slate-500 block">PIHAK PERTAMA</span>
                    <strong className="block mt-6">PrangArt Lab</strong>
                    <span className="text-[11px] text-slate-500">Fikri Yassaar Arrazaq, S.Sn.</span>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                    <span className="text-slate-500 block">PIHAK KEDUA</span>
                    <strong className="block mt-6">{project.clientName}</strong>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                      {project.contractAgreed ? 'Disetujui secara digital' : 'Menunggu persetujuan'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {(kind === 'invoice_dp' || kind === 'invoice_final') && (
              <div className="space-y-5 text-xs">
                <div className="flex flex-wrap justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold">
                      {kind === 'invoice_dp' ? 'INVOICE PEMBAYARAN DP 50%' : 'INVOICE PELUNASAN AKHIR 50%'}
                    </h2>
                    <p className="text-slate-500 mt-0.5">Ditagihkan kepada: <strong>{project.clientName}</strong></p>
                  </div>
                  <div className="font-mono text-right">
                    <div>Total Proyek: {formatRupiah(project.totalPrice)}</div>
                    <div className="text-base font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                      Tagihan Tahap Ini: {formatRupiah(kind === 'invoice_dp' ? project.dpAmount : project.remainingAmount)}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Proyek</span>
                    <span className="font-semibold">{project.judul} ({project.serviceLineLabel})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Paket Layanan</span>
                    <span>{project.packageName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status Saat Ini</span>
                    <span className="font-semibold">{kind === 'invoice_dp' ? project.dpStatus : project.finalPaymentStatus}</span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-1">
                  <strong className="block text-slate-900 dark:text-slate-100">Informasi Rekening Pembayaran Studio</strong>
                  <p>Bank / Tujuan: <strong>{settings?.studioBankName}</strong></p>
                  <p>Nomor Rekening: <strong className="font-mono">{settings?.studioBankAccount}</strong></p>
                  <p>Atas Nama: <strong>{settings?.studioBankHolder}</strong></p>
                  <p className="text-slate-500 pt-1">
                    Setelah melakukan transfer, silakan kirim konfirmasi langsung melalui tombol &ldquo;Konfirmasi Pembayaran&rdquo; di Ruang Klien.
                  </p>
                </div>
              </div>
            )}

            {kind === 'receipt' && (
              <div className="space-y-5 text-xs">
                {!access.canDownloadLunasDocument ? (
                  <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-5 text-amber-800 dark:text-amber-300">
                    Bukti Lunas Resmi baru diterbitkan setelah Admin memverifikasi pelunasan 100%.
                  </div>
                ) : (
                  <>
                    <div className="text-center border-b border-slate-200 dark:border-slate-800 pb-4">
                      <h2 className="text-base font-bold uppercase tracking-wide">KUITANSI & BUKTI PELUNASAN RESMI</h2>
                      <p className="font-mono text-slate-500 mt-1">Ref: {project.id} · Status: LUNAS 100%</p>
                    </div>
                    <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <div className="px-4 py-3 flex justify-between">
                        <span className="text-slate-500">Telah Diterima Dari</span>
                        <strong>{project.clientName}</strong>
                      </div>
                      <div className="px-4 py-3 flex justify-between">
                        <span className="text-slate-500">Untuk Pembayaran</span>
                        <strong>{project.judul} ({project.serviceLineLabel} · {project.packageName})</strong>
                      </div>
                      <div className="px-4 py-3 flex justify-between">
                        <span className="text-slate-500">Nominal Total Lunas</span>
                        <strong className="font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                          {formatRupiah(project.totalPrice)}
                        </strong>
                      </div>
                      <div className="px-4 py-3 flex justify-between">
                        <span className="text-slate-500">Tanggal Verifikasi</span>
                        <span>{formatDateLongID(project.updatedAt)}</span>
                      </div>
                    </div>
                    <p className="text-slate-500">
                      Dokumen ini sah diterbitkan oleh PrangArt Lab dan menandakan seluruh kewajiban pembayaran proyek telah diselesaikan.
                    </p>
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
