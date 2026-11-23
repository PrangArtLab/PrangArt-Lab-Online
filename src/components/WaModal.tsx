import { MessageCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useStudio } from '../context/StudioContext';
import { normalizeWhatsAppNumber } from '../lib/format';

export function WaModal() {
  const { waModalState, closeWaModal, clientUser, siteContent, showToast } = useStudio();
  const [name, setName] = useState('');
  const [intent, setIntent] = useState('');

  useEffect(() => {
    if (waModalState.open) {
      setName(clientUser?.name || '');
      setIntent(waModalState.presetIntent || '');
    }
  }, [waModalState.open, waModalState.presetIntent, clientUser?.name]);

  if (!waModalState.open) return null;

  const previewText = `Halo Admin PrangArt Lab,\nSaya ${name.trim() || '[Nama Anda]'}.\n\n${intent.trim() || 'Saya ingin berkonsultasi mengenai rencana produksi musik.'}`;
  const rawWa = siteContent?.settings?.studioWhatsApp || '';
  const waNumber = normalizeWhatsAppNumber(rawWa);

  const handleCopyAndOpen = () => {
    if (!waNumber) {
      showToast(
        'Nomor Studio Belum Diatur',
        'Admin perlu mengatur nomor WhatsApp studio pada menu Pengaturan Studio.',
        'warning'
      );
      return;
    }
    const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(previewText)}`;
    navigator.clipboard?.writeText(previewText).catch(() => {});
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.click();
    showToast('Pesan Disiapkan', 'Tautan WhatsApp dibuka dan draf pesan disalin ke clipboard.');
    closeWaModal();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 dark:bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-[0_24px_48px_-16px_rgba(15,23,42,0.22)] dark:shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <MessageCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-lg font-display font-bold text-slate-950 dark:text-slate-100">
              Diskusi dengan PrangArt Lab
            </h2>
          </div>
          <button
            type="button"
            onClick={closeWaModal}
            aria-label="Tutup dialog"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="wa-modal-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nama Anda / Instansi
            </label>
            <input
              id="wa-modal-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Siti Aminah / Sanggar Mahakam"
              className="w-full rounded-xl border border-slate-300/90 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 shadow-[inset_0_1px_2px_rgba(15,23,42,0.03)] dark:shadow-none hover:border-slate-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/15 focus:outline-none dark:focus:border-indigo-500 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="wa-modal-intent" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Topik Konsultasi / Pesan
            </label>
            <textarea
              id="wa-modal-intent"
              rows={3}
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              placeholder="Ceritakan singkat kebutuhan musik, durasi, atau jadwal pentas Anda..."
              className="w-full rounded-xl border border-slate-300/90 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 shadow-[inset_0_1px_2px_rgba(15,23,42,0.03)] dark:shadow-none hover:border-slate-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/15 focus:outline-none dark:focus:border-indigo-500 transition-colors"
            />
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              Pratinjau Pesan WhatsApp
            </span>
            <pre className="whitespace-pre-wrap rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950 p-3.5 text-xs text-slate-700 dark:text-slate-300 font-sans leading-relaxed">
              {previewText}
            </pre>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={closeWaModal}
            className="px-4 py-2.5 rounded-xl border border-slate-300/90 dark:border-slate-800 bg-white dark:bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleCopyAndOpen}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-[0_6px_14px_-4px_rgba(5,150,105,0.4)] dark:shadow-none text-white text-xs font-semibold transition-all cursor-pointer"
          >
            Lanjutkan ke WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
