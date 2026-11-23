import { LogIn, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useStudio } from '../context/StudioContext';

interface ClientAuthCardProps {
  onSuccess?: () => void;
  compactTitle?: string;
}

export function ClientAuthCard({ onSuccess, compactTitle }: ClientAuthCardProps) {
  const { loginClientWithGoogle, showToast } = useStudio();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      await loginClientWithGoogle();
      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal masuk dengan akun Google.';
      setErrorMsg(msg);
      showToast('Gagal Masuk', msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 sm:p-8 shadow-sm space-y-6">
      <div>
        <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">
          Ruang Klien · Firebase Real-Time
        </span>
        <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100 mt-1">
          {compactTitle || 'Masuk ke Ruang Klien'}
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
          Gunakan akun Google Anda untuk mengajukan pesanan, memantau progres produksi secara langsung, mengirim konfirmasi DP/pelunasan, serta berdiskusi dengan Admin Studio.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-2 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Autentikasi Aman & Sinkronisasi Seketika</span>
        </div>
        <p className="leading-relaxed">
          Setiap perubahan status pembayaran, balasan catatan revisi, dan akses Master File tersimpan di Cloud Firestore serta mengirimkan notifikasi real-time.
        </p>
      </div>

      {errorMsg && (
        <p className="text-xs font-medium text-red-600 dark:text-red-400" role="alert">
          {errorMsg}
        </p>
      )}

      <button
        type="button"
        disabled={loading}
        onClick={() => void handleGoogleSignIn()}
        className="w-full py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
      >
        <LogIn className="w-4 h-4" />
        <span>{loading ? 'Menghubungkan ke Google...' : 'Masuk / Daftar dengan Google'}</span>
      </button>
    </div>
  );
}
