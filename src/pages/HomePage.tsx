import { ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { StudioBrandLogo } from '../components/StudioBrandMarks';
import { useStudio } from '../context/StudioContext';
import { formatRupiah, safeExternalUrl } from '../lib/format';
import type { ServiceLineKey } from '../types';

export function HomePage() {
  const { catalog, siteContent, openWaModal, setOrderPreset } = useStudio();
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

  const productionStandards = [
    {
      step: '01',
      title: 'Pengajuan & Kontrak SPK Digital',
      detail: 'Rincian brief, tempo, durasi, dan perjanjian kerja sama tercatat otomatis sejak awal.',
    },
    {
      step: '02',
      title: 'Pelacakan Progres 7 Tahap',
      detail: 'Setiap perpindahan milestone produksi, pengiriman draf, dan catatan revisi tersinkron real-time.',
    },
    {
      step: '03',
      title: 'Verifikasi DP 50% & Master File',
      detail: 'Bukti Lunas / Kuitansi resmi dan tautan unduhan Master WAV 24-bit terbuka otomatis setelah verifikasi.',
    },
  ];

  return (
    <div className="bg-slate-50 dark:bg-slate-950">
      {/* 1. PROPOSITION (HERO — Official Studio Identity & Editorial Typography) */}
      <section className="relative overflow-hidden bg-[radial-gradient(ellipse_at_top_left,_rgba(79,70,229,0.08),_transparent_58%),radial-gradient(ellipse_at_top_right,_rgba(14,165,233,0.05),_transparent_52%)] dark:bg-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16 lg:pt-14 lg:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
              <div className="flex items-center gap-4">
                <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-[0_2px_12px_-3px_rgba(15,23,42,0.08)] dark:shadow-none shrink-0">
                  <StudioBrandLogo kind="full" variant="auto" className="w-14 h-14 sm:w-16 sm:h-16 shrink-0" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-mono font-semibold text-indigo-700 dark:text-indigo-400 tracking-wide">
                    PrangArt Lab · Music Production Studio
                  </p>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Kalimantan Timur · Indonesia
                  </p>
                </div>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold tracking-tight text-slate-950 dark:text-slate-100 leading-[1.08] text-balance">
                Wujudkan musik yang menyatu dengan panggung dan visi Anda.
              </h1>
              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
                Dari komposisi iringan tari berkarakter, aransemen lagu dan scoring film, hingga transkripsi partitur presisi — terhubung langsung dengan Ruang Klien untuk pemantauan progres secara nyata.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  to="/pemesanan"
                  className="px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-[0_8px_20px_-6px_rgba(79,70,229,0.5)] dark:shadow-none text-white text-sm font-semibold transition-all inline-flex items-center gap-2 whitespace-nowrap"
                >
                  <span>Mulai Pemesanan</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/klien"
                  className="px-6 py-3.5 rounded-xl border border-slate-300/90 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:shadow-none hover:border-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm font-semibold transition-all whitespace-nowrap"
                >
                  Buka Ruang Klien
                </Link>
                <button
                  type="button"
                  onClick={() => openWaModal('Konsultasi Konsep Musik')}
                  className="px-5 py-3.5 rounded-xl text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/30 hover:underline text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
                >
                  Konsultasi WhatsApp
                </button>
              </div>
            </div>

            <div className="lg:col-span-5 flex">
              <div className="w-full rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_18px_36px_-18px_rgba(15,23,42,0.12)] dark:shadow-none overflow-hidden flex flex-col justify-between">
                <div className="px-7 py-5 bg-slate-50/90 dark:bg-slate-950/50 border-b border-slate-200/80 dark:border-slate-800 space-y-1.5">
                  <p className="text-xs font-mono font-semibold text-indigo-700 dark:text-indigo-400">
                    Alur Kerja Studio
                  </p>
                  <h2 className="text-lg font-display font-bold text-slate-950 dark:text-slate-100">
                    Standar Produksi Terdokumentasi
                  </h2>
                </div>

                <div className="p-7 space-y-5 flex-1 flex flex-col justify-center">
                  {productionStandards.map((item) => (
                    <div key={item.step} className="flex items-start gap-3.5">
                      <span className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-900/70 font-mono text-xs font-bold text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0 tabular-nums">
                        {item.step}
                      </span>
                      <div className="space-y-1">
                        <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                          {item.title}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          {item.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="px-7 py-4 bg-slate-50/70 dark:bg-slate-950/40 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                  <span>Output: WAV 24-bit / PDF Partitur</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-300">DP 50% · Lunas 50%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. CAPABILITIES / SERVICES */}
      <section className="border-t border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/50 py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-mono font-semibold text-indigo-700 dark:text-indigo-400">
              Layanan Utama
            </p>
            <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-slate-950 dark:text-slate-100 text-balance">
              Tiga lini produksi terstruktur dengan kontrak dan alur revisi yang transparan.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {serviceCards.map((svc) => (
              <article
                key={svc.key}
                className="group rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-14px_rgba(15,23,42,0.09)] dark:shadow-none hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:-translate-y-0.5 dark:hover:translate-y-0 hover:shadow-[0_16px_32px_-16px_rgba(79,70,229,0.2)] dark:hover:shadow-none transition-all duration-200 p-7 flex flex-col justify-between gap-6"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <span className="font-mono font-bold text-indigo-700 dark:text-indigo-400">
                      {svc.index}
                    </span>
                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                      Mulai {svc.startingFrom}
                    </span>
                  </div>
                  <h3 className="text-lg font-display font-bold text-slate-950 dark:text-slate-100 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
                    {svc.title}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {svc.desc}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleSelectService(svc.key)}
                    className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 hover:underline inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Pilih & Hitung Estimasi</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 3. PROOF / PORTFOLIO & TESTIMONIALS (Pure Typography, Zero Images) */}
      <section className="border-t border-slate-200/90 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950 py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs font-mono font-semibold text-indigo-700 dark:text-indigo-400">
                Portofolio Pilihan
              </p>
              <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-slate-950 dark:text-slate-100">
                Karya yang diproduksi sesuai dramaturgi dan kebutuhan panggung.
              </h2>
            </div>
            <Link
              to="/portofolio"
              className="text-sm font-semibold text-indigo-700 dark:text-indigo-400 hover:underline inline-flex items-center gap-1.5"
            >
              <span>Lihat Semua Karya</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {portfolioPreview.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:shadow-none p-10 text-center space-y-2">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-300">
                Arsip portofolio publik sedang dikurasi dan diperbarui langsung oleh tim studio.
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Silakan hubungi studio via WhatsApp untuk mendengar contoh sampel karya yang relevan dengan kebutuhan produksi Anda.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {portfolioPreview.map((item) => {
                const demoUrl = safeExternalUrl(item.audioDemoUrl);
                return (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-14px_rgba(15,23,42,0.09)] dark:shadow-none hover:border-indigo-300 dark:hover:border-indigo-500/40 transition-all duration-200 p-6 flex flex-col justify-between gap-5"
                  >
                    <div className="space-y-3">
                      <div className="text-xs text-slate-600 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                        <span className="font-semibold text-indigo-700 dark:text-indigo-400">
                          {item.category}
                        </span>
                        <span className="font-mono tabular-nums">
                          {item.duration} · {item.year}
                        </span>
                      </div>
                      <h3 className="text-base font-display font-bold text-slate-950 dark:text-slate-100">
                        {item.title}
                      </h3>
                      <p className="text-xs font-mono text-slate-600 dark:text-slate-400">
                        {item.culture}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    {demoUrl && (
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                        <a
                          href={demoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 hover:underline self-start"
                        >
                          Dengar Pratinjau Audio
                        </a>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          {testimonials.length > 0 && (
            <div className="pt-8 border-t border-slate-200/90 dark:border-slate-800 space-y-8">
              <div className="space-y-2">
                <p className="text-xs font-mono font-semibold text-indigo-700 dark:text-indigo-400">
                  Testimoni Klien
                </p>
                <h2 className="text-2xl font-display font-bold text-slate-950 dark:text-slate-100">
                  Pengalaman kolaborasi dari koreografer, sutradara, dan peneliti.
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {testimonials.map((t) => (
                  <article
                    key={t.id}
                    className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-14px_rgba(15,23,42,0.09)] dark:shadow-none p-6 flex flex-col justify-between gap-5"
                  >
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      &ldquo;{t.quote}&rdquo;
                    </p>
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-1">
                      <div className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                        {t.name}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">{t.role}</div>
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
        <div className="relative overflow-hidden rounded-2xl bg-slate-950 dark:bg-slate-900 border border-slate-800 shadow-[0_20px_40px_-20px_rgba(15,23,42,0.38)] dark:shadow-none p-8 sm:p-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-indigo-500/15 blur-3xl" aria-hidden="true" />
          <div className="relative flex items-start gap-5 max-w-2xl">
            <StudioBrandLogo kind="emblem" variant="light-ink" className="w-14 h-14 hidden sm:block shrink-0 opacity-95" />
            <div className="space-y-2">
              <p className="text-xs font-mono font-semibold text-emerald-400">
                Siap Memulai Produksi
              </p>
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-white text-balance">
                Diskusikan kebutuhan karya atau ajukan pemesanan langsung sekarang.
              </h2>
            </div>
          </div>
          <div className="relative flex flex-wrap gap-3 shrink-0">
            <Link
              to="/pemesanan"
              className="px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors whitespace-nowrap"
            >
              Isi Formulir Pesanan
            </Link>
            <button
              type="button"
              onClick={() => openWaModal('Diskusi Proyek Baru')}
              className="px-6 py-3.5 rounded-xl bg-white text-slate-950 hover:bg-slate-100 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
            >
              Chat Produser via WA
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
