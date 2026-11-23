import { Link } from 'react-router-dom';
import { useStudio } from '../context/StudioContext';

export function Footer() {
  const { siteContent, openWaModal } = useStudio();
  const settings = siteContent?.settings;

  return (
    <footer className="no-print border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 pb-20 md:pb-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1">
          <p className="font-display font-bold text-base text-slate-900 dark:text-slate-100">
            PrangArt Lab
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {settings?.studioAddress || 'Samarinda, Kalimantan Timur, Indonesia'} · {settings?.studioEmail || 'prangart.lab@gmail.com'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-slate-600 dark:text-slate-400">
          <Link to="/" className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
            Beranda
          </Link>
          <Link to="/portofolio" className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
            Portofolio
          </Link>
          <Link to="/pemesanan" className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
            Pemesanan
          </Link>
          <Link to="/klien" className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
            Ruang Klien
          </Link>
          <button
            type="button"
            onClick={() => openWaModal('Konsultasi Proyek')}
            className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
          >
            Diskusi WhatsApp
          </button>
        </div>
      </div>
    </footer>
  );
}
