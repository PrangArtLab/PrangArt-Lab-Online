import { ArrowRight, Music2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useStudio } from '../context/StudioContext';
import { formatRupiah, safeExternalUrl } from '../lib/format';
import type { ServiceLineKey } from '../types';

export function HomePage() {
  const { catalog, siteContent, openWaModal, setOrderPreset, adminToken } = useStudio();
  const navigate = useNavigate();

  const handleSelectService = (svcKey: ServiceLineKey) => {
    setOrderPreset({ serviceLine: svcKey, packageKey: 'dasar' });
    navigate('/pemesanan');
  };

  const portfolioPreview = (siteContent?.portfolio || []).slice(0, 3);
  const testimonials = (siteContent?.testimonials || []).slice(0, 3);

  const serviceCards: {
    index: string;
    key: ServiceLineKey;
    title: string;
    startingFrom: string;
    desc: string;
  }[] = [
    {
      index: '01.',
      key: 'tari',
      title: 'Komposisi Musik Iringan Tari',
      startingFrom: catalog ? formatRupiah(catalog.tari.packages.dasar.price) : 'Rp1.000.000',
      desc: 'Musik panggung orisinal yang mengikuti dramaturgi gerak, peralihan tempo, dan karakter budaya tradisional maupun kreasi baru.',
    },
    {
      index: '02.',
      key: 'digital',
      title: 'Aransemen & Scoring Non-Tari',
      startingFrom: catalog ? formatRupiah(catalog.digital.packages.dasar.price) : 'Rp1.000.000',
      desc: 'Produksi lagu orisinal, mars instansi, jingle brand, dan scoring film dengan standar mixing serta mastering siap rilis.',
    },
    {
      index: '03.',
      key: 'transkripsi',
      title: 'Transkripsi Partitur & Notasi',
      startingFrom: catalog ? `${formatRupiah(catalog.transkripsi.packages.dasar.price)} / mnt` : 'Rp75.000 / mnt',
      desc: 'Alih audio rekaman menjadi not balok, not angka, atau full score orkestra lengkap dengan simulasi MIDI untuk riset dan pertunjukan.',
    },
  ];

  return (
    <div className="bg-slate-50 dark:bg-slate-950">
      {/* 1. PROPOSITION (HERO) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16 lg:pt-14 lg:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
            <p className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400 tracking-wide">
              PrangArt Lab · Music Production Studio · Kalimantan Timur
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-[1.08] text-balance">
              Wujudkan musik yang menyatu dengan panggung dan visi Anda.
            </h1>
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
              Dari komposisi iringan tari berkarakter, aransemen lagu dan scoring film, hingga transkripsi partitur presisi — terhubung langsung dengan Ruang Klien untuk pemantauan progres secara nyata.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {!adminToken ? (
                <Link
                  to="/pemesanan"
                  className="px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                >
                  <span>Mulai Pemesanan</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <Link
                  to="/admin"
                  className="px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                >
                  <span>Buka Panel Admin</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
              <button
                type="button"
                onClick={() => openWaModal('Konsultasi Konsep Musik')}
                className="px-6 py-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 hover:border-indigo-500 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
              >
                Konsultasi WhatsApp
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 flex">
            <div className="w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-200 dark:bg-slate-900 relative min-h-[280px]">
              <img
                src="/src/assets/images/studio_hero_production_1795405927298.jpg"
                alt="Ruang produksi akustik PrangArt Lab dengan konsol mixing dan instrumen tradisional"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 2. CAPABILITIES / SERVICES */}
      <section className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">
              Layanan Utama
            </p>
            <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-slate-900 dark:text-slate-100 text-balance">
              Tiga lini produksi terstruktur dengan kontrak dan alur revisi yang transparan.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {serviceCards.map((svc) => (
              <article
                key={svc.key}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 flex flex-col justify-between gap-6"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                      {svc.index}
                    </span>
                    <span className="font-mono tabular-nums">Mulai {svc.startingFrom}</span>
                  </div>
                  <h3 className="text-lg font-display font-bold text-slate-900 dark:text-slate-100">
                    {svc.title}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {svc.desc}
                  </p>
                </div>

                {!adminToken && (
                  <button
                    type="button"
                    onClick={() => handleSelectService(svc.key)}
                    className="self-start text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Pilih & Hitung Estimasi</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 3. PROOF / PORTFOLIO & TESTIMONIALS */}
      <section className="border-t border-slate-200 dark:border-slate-800 py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                Portofolio Pilihan
              </p>
              <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Karya yang diproduksi sesuai dramaturgi dan kebutuhan panggung.
              </h2>
            </div>
            <Link
              to="/portofolio"
              className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1.5"
            >
              <span>Lihat Semua Karya</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {portfolioPreview.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-sm text-slate-500">
              Portofolio belum tersedia. Admin dapat menambahkannya dari Panel Admin.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {portfolioPreview.map((item) => {
                const imgUrl = safeExternalUrl(item.image);
                return (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col"
                  >
                    <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center">
                      {imgUrl ? (
                        <img
                          src={imgUrl}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-slate-400 p-6 text-center">
                          <Music2 className="w-8 h-8" />
                          <span className="text-xs">{item.category}</span>
                        </div>
                      )}
                    </div>
                    <div className="p-6 space-y-2.5 flex-1">
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                          {item.category}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{item.duration}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{item.year}</span>
                      </div>
                      <h3 className="text-base font-display font-bold text-slate-900 dark:text-slate-100">
                        {item.title}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {testimonials.length > 0 && (
            <div className="pt-8 border-t border-slate-200 dark:border-slate-800 space-y-8">
              <div className="space-y-2">
                <p className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                  Testimoni Klien
                </p>
                <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">
                  Pengalaman kolaborasi dari koreografer, sutradara, dan peneliti.
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {testimonials.map((t) => (
                  <article
                    key={t.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between gap-5"
                  >
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      &ldquo;{t.quote}&rdquo;
                    </p>
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-1">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {t.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{t.role}</div>
                      {t.outcome && (
                        <div className="text-xs font-mono text-emerald-700 dark:text-emerald-400 pt-1">
                          {t.outcome}
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 4. CONVERSION CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="rounded-2xl bg-slate-900 dark:bg-slate-900 border border-slate-800 p-8 sm:p-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <p className="text-xs font-mono font-semibold text-emerald-400">
              Siap Memulai Produksi
            </p>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-white text-balance">
              Diskusikan kebutuhan karya atau ajukan pemesanan langsung sekarang.
            </h2>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            {!adminToken && (
              <Link
                to="/pemesanan"
                className="px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors whitespace-nowrap"
              >
                Isi Formulir Pesanan
              </Link>
            )}
            <button
              type="button"
              onClick={() => openWaModal('Diskusi Proyek Baru')}
              className="px-6 py-3.5 rounded-xl bg-white text-slate-900 hover:bg-slate-100 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
            >
              Chat Produser via WA
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
