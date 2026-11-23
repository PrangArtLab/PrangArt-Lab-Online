import { Eye, EyeOff } from 'lucide-react';
import React, { useState } from 'react';
import { useStudio } from '../context/StudioContext';

interface ClientAuthCardProps {
  onSuccess?: () => void;
  compactTitle?: string;
}

export function ClientAuthCard({ onSuccess, compactTitle }: ClientAuthCardProps) {
  const { loginClient, registerClient, showToast } = useStudio();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regWa, setRegWa] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await loginClient(email, password);
      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal masuk.';
      showToast('Gagal Masuk', msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await registerClient(regName, regEmail, regWa, regPassword);
      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mendaftar.';
      showToast('Gagal Daftar', msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setMode('login');
    setEmail('siti@sanggar.id');
    setPassword('1234');
  };

  return (
    <div className="w-full max-w-md mx-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 sm:p-8 shadow-sm space-y-6">
      <div>
        <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">
          Ruang Klien
        </span>
        <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100 mt-1">
          {compactTitle || (mode === 'login' ? 'Masuk ke Akun Klien' : 'Daftar Akun Klien')}
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
          {mode === 'login'
            ? 'Pantau progres produksi, konfirmasi DP/pelunasan, kirim catatan revisi, dan unduh master.'
            : 'Buat akun klien untuk menghubungkan pesanan Anda secara langsung dengan Admin Studio.'}
        </p>
      </div>

      {/* Mode Switcher */}
      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setMode('login')}
          className={`py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            mode === 'login'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Masuk
        </button>
        <button
          type="button"
          onClick={() => setMode('register')}
          className={`py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            mode === 'register'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Daftar Akun
        </button>
      </div>

      {mode === 'login' ? (
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="client-login-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Email
            </label>
            <input
              id="client-login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@sanggar.id"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label htmlFor="client-login-pass" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Kata Sandi
            </label>
            <div className="relative">
              <input
                id="client-login-pass"
                type={showPass ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 pr-11 text-sm text-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                aria-label="Tampilkan atau sembunyikan kata sandi"
                className="absolute inset-y-0 right-0 px-3.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            {loading ? 'Memproses...' : 'Masuk ke Ruang Klien'}
          </button>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              Akun trial: <span className="font-mono">siti@sanggar.id</span> · sandi: <span className="font-mono">1234</span>
            </span>
            <button
              type="button"
              onClick={fillDemo}
              className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
            >
              Isi Otomatis
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label htmlFor="reg-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nama Lengkap / Sanggar / Instansi
            </label>
            <input
              id="reg-name"
              type="text"
              required
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
              placeholder="Contoh: Sanggar Tari Mahakam"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Email Aktif
            </label>
            <input
              id="reg-email"
              type="email"
              required
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              placeholder="nama@contoh.com"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label htmlFor="reg-wa" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              No. WhatsApp Aktif
            </label>
            <input
              id="reg-wa"
              type="tel"
              required
              value={regWa}
              onChange={(e) => setRegWa(e.target.value)}
              placeholder="081234567890"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label htmlFor="reg-pass" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Kata Sandi (Min. 4 karakter)
            </label>
            <div className="relative">
              <input
                id="reg-pass"
                type={showPass ? 'text' : 'password'}
                required
                minLength={4}
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="Buat kata sandi"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 pr-11 text-sm text-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                aria-label="Tampilkan atau sembunyikan kata sandi"
                className="absolute inset-y-0 right-0 px-3.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            {loading ? 'Mendaftarkan...' : 'Buat Akun Klien'}
          </button>
        </form>
      )}
    </div>
  );
}
