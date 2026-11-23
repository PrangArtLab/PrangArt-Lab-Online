import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStudio } from '../context/StudioContext';
import { safeExternalUrl } from '../lib/format';

type PortfolioFilter = 'Semua' | 'Musik Tari' | 'Musik Non-Tari' | 'Transkripsi';

const FILTER_KEY = 'pal_portfolio_filter';

export function PortfolioPage() {
  const { siteContent } = useStudio();
  const [filter, setFilter] = useState<PortfolioFilter>(() => {
    try {
      const saved = localStorage.getItem(FILTER_KEY) as PortfolioFilter | null;
      if (saved && ['Semua', 'Musik Tari', 'Musik Non-Tari', 'Transkripsi'].includes(saved)) {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'Semua';
  });

  useEffect(() => {
    try {
      localStorage.setItem(FILTER_KEY, filter);
    } catch {
      // ignore
    }
  }, [filter]);

  const items = siteContent?.portfolio || [];
  const filtered =
    filter === 'Semua' ? items : items.filter((item) => item.category === filter);

  const categories: PortfolioFilter[] = ['Semua', 'Musik Tari', 'Musik Non-Tari', 'Transkripsi'];

  return (
    <div className="bg-slate-50 dark:bg-slate-950">
      <section className="border-b border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-950 bg-[radial-gradient(ellipse_at_top_left,_rgba(79,70,229,0.06),_transparent_55%)] dark:bg-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <p className="text-xs font-mono font-semibold text-indigo-700 dark:text-indigo-400">
                Portofolio Studio
              </p>
              <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-slate-950 dark:text-slate-100">
                Karya produksi dan partitur terpilih.
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Arsip karya diperbarui langsung oleh studio tanpa media gambar agar fokus pada karakter musikal dan keterangan produksi.
              </p>
            </div>

            {/* Segmented Filter Control */}
            <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100/90 dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 self-start md:self-auto">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFilter(cat)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    filter === cat
                      ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-slate-100 shadow-[0_1px_3px_rgba(15,23,42,0.08)] dark:shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14 space-y-10 pb-24">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:shadow-none p-12 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-300">
              {items.length === 0
                ? 'Daftar portofolio publik belum dipublikasikan. Studio sedang mengkurasi karya pilihan terbaru.'
                : `Belum ada karya portofolio pada kategori "${filter}".`}
            </p>
            {items.length === 0 ? (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Anda tetap dapat mengajukan proyek atau berkonsultasi langsung melalui formulir pemesanan.
              </p>
            ) : filter !== 'Semua' ? (
              <button
                type="button"
                onClick={() => setFilter('Semua')}
                className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                Tampilkan semua kategori
              </button>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((item) => {
              const demoUrl = safeExternalUrl(item.audioDemoUrl);
              return (
                <article
                  key={item.id}
                  className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-14px_rgba(15,23,42,0.09)] dark:shadow-none hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:-translate-y-0.5 dark:hover:translate-y-0 transition-all duration-200 p-6 flex flex-col justify-between gap-6"
                >
                  <div className="space-y-3">
                    <div className="text-xs text-slate-600 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                      <span className="font-semibold text-indigo-700 dark:text-indigo-400">
                        {item.category}
                      </span>
                      <span className="font-mono tabular-nums">{item.duration}</span>
                    </div>
                    <h2 className="text-lg font-display font-bold text-slate-950 dark:text-slate-100">
                      {item.title}
                    </h2>
                    <p className="text-xs font-mono text-slate-600 dark:text-slate-400">
                      {item.culture}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-600 dark:text-slate-400 tabular-nums">Tahun {item.year}</span>
                    {demoUrl ? (
                      <a
                        href={demoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-indigo-700 dark:text-indigo-400 hover:underline"
                      >
                        Dengar Pratinjau
                      </a>
                    ) : (
                      <Link
                        to="/pemesanan"
                        className="font-semibold text-indigo-700 dark:text-indigo-400 hover:underline"
                      >
                        Pesan Karya Serupa
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
