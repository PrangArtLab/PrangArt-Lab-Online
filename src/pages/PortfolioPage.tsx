import { Music2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStudio } from '../context/StudioContext';
import { safeExternalUrl } from '../lib/format';

type PortfolioFilter = 'Semua' | 'Musik Tari' | 'Musik Non-Tari' | 'Transkripsi';

export function PortfolioPage() {
  const { siteContent, adminToken } = useStudio();
  const [filter, setFilter] = useState<PortfolioFilter>('Semua');

  const items = siteContent?.portfolio || [];
  const filtered =
    filter === 'Semua' ? items : items.filter((item) => item.category === filter);

  const categories: PortfolioFilter[] = ['Semua', 'Musik Tari', 'Musik Non-Tari', 'Transkripsi'];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 dark:border-slate-800 pb-8">
        <div className="space-y-2 max-w-2xl">
          <p className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">
            Portofolio Studio
          </p>
          <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Karya produksi dan partitur terpilih.
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Daftar karya diperbarui secara langsung oleh studio. Filter berdasarkan lini layanan di sebelah kanan.
          </p>
        </div>

        {/* Segmented Filter Control */}
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 self-start md:self-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilter(cat)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                filter === cat
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Belum ada karya portofolio pada kategori &ldquo;{filter}&rdquo;.
          </p>
          {filter !== 'Semua' && (
            <button
              type="button"
              onClick={() => setFilter('Semua')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              Tampilkan semua kategori
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((item) => {
            const imgUrl = safeExternalUrl(item.image);
            const demoUrl = safeExternalUrl(item.audioDemoUrl);
            return (
              <article
                key={item.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-slate-400 p-6">
                        <Music2 className="w-8 h-8" />
                        <span className="text-xs">{item.category}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-6 space-y-2.5">
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        {item.category}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{item.culture}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{item.duration}</span>
                    </div>
                    <h2 className="text-lg font-display font-bold text-slate-900 dark:text-slate-100">
                      {item.title}
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="px-6 pb-6 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-500 tabular-nums">Tahun {item.year}</span>
                  {demoUrl ? (
                    <a
                      href={demoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Dengar Pratinjau
                    </a>
                  ) : !adminToken ? (
                    <Link
                      to="/pemesanan"
                      className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Pesan Karya Serupa
                    </Link>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
