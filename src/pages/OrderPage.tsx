import { Check, CheckCircle2, FileText, Plus, Sparkles, Trash2, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClientAuthCard } from '../components/ClientAuthCard';
import { useStudio } from '../context/StudioContext';
import {
  formatDateLongID,
  formatRupiah,
  formatSecondsToMMSS,
  parseDurationToSeconds,
  safeExternalUrl,
} from '../lib/format';
import type { ProjectSpecItem, ServiceLineKey } from '../types';

interface StandarSegment {
  id: string;
  durasi: string;
  struktur: string;
  nuansa: string;
  link: string;
}

interface ProSegment {
  id: string;
  label: string;
  bpm: string;
  durasi: string;
  link: string;
  desc: string;
}

const DEFAULT_STRUKTUR_OPTIONS = [
  'Opening',
  'Orientasi Suasana Cerita',
  'Bagian Tengah',
  'Klimaks',
  'Penutup',
];

export function OrderPage() {
  const {
    catalog,
    clientUser,
    clientToken,
    orderPreset,
    setOrderPreset,
    submitOrder,
    showToast,
    adminToken,
  } = useStudio();
  const navigate = useNavigate();

  const [serviceLine, setServiceLine] = useState<ServiceLineKey>(orderPreset.serviceLine || 'tari');
  const [packageKey, setPackageKey] = useState<string>(orderPreset.packageKey || 'dasar');
  const [customPrice, setCustomPrice] = useState<string>('');
  const [contractAgreed, setContractAgreed] = useState(false);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authPurpose, setAuthPurpose] = useState<'submit' | 'ai'>('submit');
  const [submitting, setSubmitting] = useState(false);

  // Common Identity & Work Fields
  const [sanggar, setSanggar] = useState('');
  const [kotaProvinsi, setKotaProvinsi] = useState('');
  const [wa, setWa] = useState('');
  const [email, setEmail] = useState('');
  const [koreografer, setKoreografer] = useState('');
  const [judul, setJudul] = useState('');
  const [jenisTari, setJenisTari] = useState('Tari tradisional');
  const [jenisTariOther, setJenisTariOther] = useState('');
  const [budayaDaerah, setBudayaDaerah] = useState('');
  const [durasi, setDurasi] = useState('');
  const [videoLink, setVideoLink] = useState('');
  const [hasVocalAddon, setHasVocalAddon] = useState(false);

  // Tari Specs
  const [nuansaDasar, setNuansaDasar] = useState('Sakral / Ritual');
  const [nuansaOther, setNuansaOther] = useState('');
  const [instrumenTari, setInstrumenTari] = useState('');
  const [sorakOption, setSorakOption] = useState('Tidak Perlu Sorak');
  const [strukturOptions, setStrukturOptions] = useState<string[]>(DEFAULT_STRUKTUR_OPTIONS);
  const [selectedStruktur, setSelectedStruktur] = useState<string[]>(['Opening']);
  const [newStrukturInput, setNewStrukturInput] = useState('');
  const [standarSegments, setStandarSegments] = useState<StandarSegment[]>([
    { id: 'seg-1', durasi: '00:00 – 00:30', struktur: 'Opening', nuansa: '', link: '' },
  ]);
  const [proIntroMode, setProIntroMode] = useState(
    'Diawali musik pembuka terlebih dahulu, kemudian penari masuk'
  );
  const [proSegments, setProSegments] = useState<ProSegment[]>([
    { id: 'pro-1', label: 'Video 1 / Tempo 1', bpm: '', durasi: '', link: '', desc: '' },
  ]);
  const [customScale, setCustomScale] = useState('Tari Tunggal / Duet / Trio');
  const [customInstruments, setCustomInstruments] = useState('');
  const [customDeliverables, setCustomDeliverables] = useState('');

  // Non-Tari Specs
  const [nonTariJenis, setNonTariJenis] = useState('Aransemen Lagu Orisinal');
  const [nonTariGenre, setNonTariGenre] = useState('');
  const [nonTariNuansa, setNonTariNuansa] = useState('');
  const [nonTariTempoKey, setNonTariTempoKey] = useState('');
  const [nonTariInstrumen, setNonTariInstrumen] = useState('');
  const [nonTariStruktur, setNonTariStruktur] = useState('');
  const [nonTariLirik, setNonTariLirik] = useState('');
  const [nonTariPlatform, setNonTariPlatform] = useState('');
  const [nonTariOutput, setNonTariOutput] = useState('Master WAV (24-bit) + MP3 (320kbps)');
  const [nonTariCustomCount, setNonTariCustomCount] = useState('');
  const [nonTariCustomLicense, setNonTariCustomLicense] = useState('Lisensi Standar (Kredit PrangArt Lab)');
  const [nonTariCustomDetail, setNonTariCustomDetail] = useState('');

  // Transkripsi Specs
  const [transInstrumentCount, setTransInstrumentCount] = useState<number>(1);
  const [transJenis, setTransJenis] = useState('Melodi Utama + Simbol Akor');
  const [transFormatNotasi, setTransFormatNotasi] = useState('Not Balok (Staff Notation)');
  const [transInstrumen, setTransInstrumen] = useState('');
  const [transFileOutput, setTransFileOutput] = useState('PDF Siap Cetak');
  const [transBagianWaktu, setTransBagianWaktu] = useState('Full dari awal hingga akhir (00:00 – Ending)');
  const [transNadaBirama, setTransNadaBirama] = useState('');
  const [transTujuan, setTransTujuan] = useState('');
  const [transCatatan, setTransCatatan] = useState('');
  const [transCustomCount, setTransCustomCount] = useState('');
  const [transCustomStandard, setTransCustomStandard] = useState('Partitur Pertunjukan / Orkestrasi');
  const [transCustomDetail, setTransCustomDetail] = useState('');

  // Synopsis & AI State
  const [synopsisMode, setSynopsisMode] = useState<'manual' | 'ai'>('manual');
  const [sinopsis, setSinopsis] = useState('');
  const [aiPreview, setAiPreview] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiQuotaInfo, setAiQuotaInfo] = useState<{
    limit: number;
    used: number;
    remaining: number;
    lastTimestamp: number;
    cooldownMs: number;
  } | null>(null);
  const [aiFields, setAiFields] = useState({
    tema: '',
    latar: '',
    inspirasi: '',
    gagasan: '',
    gambaran: '',
    perkembangan: '',
    karakter: '',
    sumberGerak: '',
    musik: '',
    instrumen: '',
    kostum: '',
    makna: '',
    pesan: '',
  });

  // Sync preset when navigated from HomePage
  useEffect(() => {
    setServiceLine(orderPreset.serviceLine);
    setPackageKey(orderPreset.packageKey);
  }, [orderPreset]);

  // Autofill client identity from logged-in user
  useEffect(() => {
    if (clientUser) {
      setSanggar((prev) => prev || clientUser.name);
      setWa((prev) => prev || clientUser.wa);
      setEmail((prev) => prev || clientUser.email);
    }
  }, [clientUser]);

  // Fetch AI quota when client is signed in & AI mode opened
  useEffect(() => {
    if (clientToken && synopsisMode === 'ai') {
      fetch('/api/ai/quota', {
        headers: { Authorization: `Bearer ${clientToken}` },
      })
        .then((r) => r.json())
        .then((data) => {
          if (typeof data.remaining === 'number') setAiQuotaInfo(data);
        })
        .catch(() => {});
    }
  }, [clientToken, synopsisMode]);

  const activeSvc = catalog?.[serviceLine];
  const activePkg =
    activeSvc?.packages?.[packageKey] ||
    (activeSvc ? Object.values(activeSvc.packages)[0] : undefined);

  const handleSelectServiceLine = (nextSvc: ServiceLineKey) => {
    setServiceLine(nextSvc);
    const nextPkg = catalog?.[nextSvc]?.packages?.[packageKey] ? packageKey : 'dasar';
    setPackageKey(nextPkg);
    setOrderPreset({ serviceLine: nextSvc, packageKey: nextPkg });
    setCustomPrice('');
    if (nextSvc === 'transkripsi') {
      setHasVocalAddon(false);
    }
  };

  const handleSelectPackage = (nextPkg: string) => {
    setPackageKey(nextPkg);
    setOrderPreset({ serviceLine, packageKey: nextPkg });
    setCustomPrice('');
  };

  // Duration calculation & validation
  const durationSeconds = useMemo(() => parseDurationToSeconds(durasi), [durasi]);
  const billableMinutes = useMemo(() => {
    if (durationSeconds === null || durationSeconds <= 0) return 1;
    return Math.max(1, Math.ceil(durationSeconds / 60));
  }, [durationSeconds]);

  const durationOverLimit = useMemo(() => {
    if (serviceLine === 'transkripsi') return false;
    if (!activePkg || packageKey === 'custom' || activePkg.isCustom || !activePkg.maxSeconds) {
      return false;
    }
    return durationSeconds !== null && durationSeconds > activePkg.maxSeconds;
  }, [serviceLine, activePkg, packageKey, durationSeconds]);

  const pricing = useMemo(() => {
    if (!activeSvc || !activePkg) {
      return {
        isCustomPkg: false,
        basePrice: 0,
        addonAmount: 0,
        totalPrice: 0,
        breakdownNote: '',
      };
    }

    const isCustomPkg = packageKey === 'custom' || Boolean(activePkg.isCustom);
    const parsedCustom = customPrice ? Math.max(0, Math.round(Number(customPrice))) : 0;

    let basePrice = 0;
    let breakdownNote = '';

    if (isCustomPkg) {
      basePrice = parsedCustom;
    } else if (parsedCustom > 0) {
      basePrice = parsedCustom;
      breakdownNote = 'Harga kesepakatan khusus';
    } else if (serviceLine === 'transkripsi') {
      const rate = Number(activePkg.price || 0);
      if (packageKey === 'komplet' || activePkg.billingUnit === 'per_min_complete') {
        basePrice = rate * billableMinutes;
        breakdownNote = `${formatRupiah(rate)} × ${billableMinutes} mnt (min. 1 mnt, full ensemble)`;
      } else {
        const inst = Math.max(1, transInstrumentCount);
        basePrice = rate * billableMinutes * inst;
        breakdownNote = `${formatRupiah(rate)} × ${billableMinutes} mnt × ${inst} instrumen`;
      }
    } else {
      basePrice = Number(activePkg.price || 0);
    }

    const addonPrice = Number(activeSvc.addonPrice || 250000);
    const addonAmount = serviceLine !== 'transkripsi' && hasVocalAddon ? addonPrice : 0;
    const totalPrice = basePrice + addonAmount;

    return {
      isCustomPkg,
      basePrice,
      addonAmount,
      totalPrice,
      breakdownNote,
    };
  }, [
    activeSvc,
    activePkg,
    packageKey,
    customPrice,
    serviceLine,
    billableMinutes,
    transInstrumentCount,
    hasVocalAddon,
  ]);

  const handleAddCustomStruktur = () => {
    const val = newStrukturInput.trim();
    if (!val) {
      showToast('Isi Struktur', 'Ketik nama suasana atau struktur tari terlebih dahulu.', 'warning');
      return;
    }
    if (!strukturOptions.includes(val)) {
      setStrukturOptions((prev) => [...prev, val]);
    }
    if (!selectedStruktur.includes(val)) {
      setSelectedStruktur((prev) => [...prev, val]);
    }
    setNewStrukturInput('');
  };

  const handleGenerateAISynopsis = async () => {
    if (!clientToken) {
      showToast('Masuk Diperlukan', 'Silakan masuk ke akun klien terlebih dahulu untuk menggunakan Asisten AI.', 'warning');
      setAuthPurpose('ai');
      setAuthModalOpen(true);
      return;
    }
    if (!judul.trim()) {
      showToast('Judul Kosong', 'Isi Judul Tari / Nama Karya pada Langkah 02 terlebih dahulu.', 'warning');
      return;
    }

    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/synopsis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clientToken}`,
        },
        body: JSON.stringify({
          judul: judul.trim(),
          koreografer: koreografer.trim(),
          asal: budayaDaerah.trim() || kotaProvinsi.trim(),
          jenis: jenisTari === 'Lain-lain' ? jenisTariOther.trim() || 'Lain-lain' : jenisTari,
          ...aiFields,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Gagal menyusun sinopsis AI.');
      }
      setAiPreview(data.synopsis);
      if (data.quota) setAiQuotaInfo(data.quota);
      showToast('Sinopsis AI Siap', 'Tinjau hasil sinopsis di bawah lalu klik Gunakan ke Kolom Sinopsis.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menghasilkan sinopsis.';
      showToast('Gagal Generate AI', msg, 'error');
    } finally {
      setAiLoading(false);
    }
  };

  const buildOrderPayload = (): Record<string, unknown> | null => {
    if (!activeSvc || !activePkg) return null;

    const requiresContract = serviceLine === 'tari' || serviceLine === 'digital';
    if (requiresContract && !contractAgreed) {
      showToast(
        'Persetujuan Diperlukan',
        'Harap centang persetujuan Perjanjian Produksi Musik PrangArt Studios.',
        'warning'
      );
      return null;
    }

    if (durationOverLimit && activePkg.maxSeconds) {
      showToast(
        'Durasi Melebihi Batas Paket',
        `Batas maksimal paket ini adalah ${formatSecondsToMMSS(activePkg.maxSeconds)} menit. Pilih paket lebih tinggi atau Paket Custom.`,
        'error'
      );
      return null;
    }

    if (pricing.isCustomPkg && pricing.basePrice <= 0) {
      showToast(
        'Harga Kesepakatan Kosong',
        'Untuk Paket Custom, wajib mengisi nominal Harga Kesepakatan (Rp) sesuai hasil diskusi.',
        'error'
      );
      return null;
    }

    if (videoLink.trim() && !safeExternalUrl(videoLink.trim())) {
      showToast('Tautan Tidak Valid', 'Tautan referensi harus diawali https:// atau http://.', 'error');
      return null;
    }

    const specs: ProjectSpecItem[] = [];
    const pushSpec = (key: string, val?: string) => {
      if (val && val.trim()) specs.push({ key, val: val.trim() });
    };

    if (requiresContract) {
      specs.push({ key: 'Persetujuan Kontrak PrangArt Studios', val: 'Disetujui Klien' });
    }
    pushSpec('Pemesan / Sanggar / Instansi', sanggar);
    pushSpec('Kota, Provinsi', kotaProvinsi);
    pushSpec('Nomor WhatsApp Aktif', wa);
    pushSpec('Email', email);

    if (serviceLine === 'tari') {
      pushSpec('Nama Lengkap Koreografer', koreografer);
      pushSpec('Jenis Tari', jenisTari === 'Lain-lain' ? jenisTariOther || 'Lain-lain' : jenisTari);
      pushSpec('Latar Belakang Budaya / Daerah', budayaDaerah);

      if (packageKey === 'dasar') {
        pushSpec('Nuansa Musik', nuansaDasar === 'Other' ? nuansaOther : nuansaDasar);
        pushSpec('Instrumen Dominan', instrumenTari);
      } else if (packageKey === 'standar') {
        pushSpec('Struktur Tari / Suasana', selectedStruktur.join(', '));
        const segText = standarSegments
          .map(
            (s, i) =>
              `Bagian ${i + 1} [${s.durasi || '-'}] ${s.struktur || '-'} → ${s.nuansa || '-'}${
                s.link ? ` (Link: ${s.link})` : ''
              }`
          )
          .join(' | ');
        pushSpec('Urutan Nuansa & Durasi', segText);
      } else if (packageKey === 'pro') {
        pushSpec('Awal Masuk Musik & Tari', proIntroMode);
        const proText = proSegments
          .map(
            (s) =>
              `${s.label || 'Bagian'} (${s.bpm || '-'}, ${s.durasi || '-'}): ${s.desc || '-'}${
                s.link ? ` [GDrive: ${s.link}]` : ''
              }`
          )
          .join(' | ');
        pushSpec('Rincian Video, Tempo & Nuansa (Pro)', proText);
      } else {
        pushSpec('Skala & Format Garapan', customScale);
        pushSpec('Kebutuhan Instrumen Khusus', customInstruments);
        pushSpec('Awal Masuk Musik & Tari', proIntroMode);
        const proText = proSegments
          .map(
            (s) =>
              `${s.label || 'Babak'} (${s.bpm || '-'}, ${s.durasi || '-'}): ${s.desc || '-'}${
                s.link ? ` [GDrive: ${s.link}]` : ''
              }`
          )
          .join(' | ');
        pushSpec('Rincian Babak & Durasi (Custom)', proText);
        pushSpec('Output File & Teknis Tambahan', customDeliverables);
      }
      pushSpec('Tambahan Sorak', sorakOption);
    } else if (serviceLine === 'digital') {
      pushSpec('Jenis Kebutuhan Produksi', nonTariJenis);
      pushSpec('Genre / Gaya Musik', nonTariGenre);
      pushSpec('Nuansa / Mood Utama', nonTariNuansa);
      pushSpec('Tempo (BPM) & Nada Dasar', nonTariTempoKey);
      pushSpec('Susunan Instrumen', nonTariInstrumen);
      pushSpec('Struktur Lagu / Alur Dinamika', nonTariStruktur);
      pushSpec('Lirik / Naskah Voice Over', nonTariLirik);
      pushSpec('Target Platform Rilis', nonTariPlatform);
      pushSpec('Format File Output', nonTariOutput);
      if (packageKey === 'custom') {
        pushSpec('Jumlah Trek / Lagu (Custom)', nonTariCustomCount);
        pushSpec('Lisensi / Hak Pakai (Custom)', nonTariCustomLicense);
        pushSpec('Detail Khusus Paket Custom', nonTariCustomDetail);
      }
    } else {
      pushSpec('Menit Terhitung (Min. 1 Menit)', `${billableMinutes} Menit`);
      if (packageKey !== 'komplet' && packageKey !== 'custom') {
        pushSpec('Jumlah Instrumen', `${transInstrumentCount} Instrumen`);
      }
      if (pricing.breakdownNote) {
        pushSpec('Rincian Kalkulasi Tarif', pricing.breakdownNote);
      }
      pushSpec('Jenis Transkripsi', transJenis);
      pushSpec('Format Notasi', transFormatNotasi);
      pushSpec('Daftar Instrumen', transInstrumen);
      pushSpec('Format File Hasil', transFileOutput);
      pushSpec('Bagian Audio Ditranskripsi', transBagianWaktu);
      pushSpec('Nada Dasar & Birama', transNadaBirama);
      pushSpec('Tujuan Penggunaan Partitur', transTujuan);
      pushSpec('Catatan Teknis Khusus', transCatatan);
      if (packageKey === 'custom') {
        pushSpec('Jumlah Repertoar (Custom)', transCustomCount);
        pushSpec('Standar Penulisan / Analisis', transCustomStandard);
        pushSpec('Detail Khusus Transkripsi', transCustomDetail);
      }
    }

    if (pricing.addonAmount > 0) {
      specs.push({
        key: 'Tambahan Vokal / Session Player',
        val: `+ ${formatRupiah(pricing.addonAmount)}`,
      });
    }

    const resolvedPackageName = pricing.breakdownNote
      ? `${activePkg.label} (${pricing.breakdownNote})`
      : pricing.isCustomPkg || Number(customPrice) > 0
      ? `${activePkg.label} (Kesepakatan)`
      : activePkg.label;

    return {
      serviceLine,
      packageKey,
      packageName: resolvedPackageName,
      clientName: sanggar.trim(),
      contactEmail: email.trim().toLowerCase(),
      clientWa: wa.trim(),
      judul: judul.trim(),
      durasi: durasi.trim(),
      contractAgreed: requiresContract ? contractAgreed : true,
      hasVocalAddon: pricing.addonAmount > 0,
      addonAmount: pricing.addonAmount,
      sorakOption: serviceLine === 'tari' ? sorakOption : null,
      totalPrice: pricing.totalPrice,
      specs,
      videoLink: videoLink.trim(),
      sinopsis: serviceLine === 'tari' ? sinopsis.trim() : '',
    };
  };

  const executeOrderSubmit = async (payload: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      await submitOrder(payload);
      navigate('/klien');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengirim pengajuan.';
      showToast('Gagal Mengirim', msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = buildOrderPayload();
    if (!payload) return;

    if (!clientToken) {
      setAuthPurpose('submit');
      setAuthModalOpen(true);
      showToast(
        'Masuk untuk Melanjutkan',
        'Masuk atau buat akun klien agar pengajuan Anda langsung terhubung dengan Admin.',
        'info'
      );
      return;
    }

    await executeOrderSubmit(payload);
  };

  if (adminToken) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">
          Sesi Admin Sedang Aktif
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Keluar dari Panel Admin terlebih dahulu jika Anda ingin membuat pengajuan baru sebagai Klien.
        </p>
        <button
          type="button"
          onClick={() => navigate('/admin')}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
        >
          Kembali ke Panel Admin
        </button>
      </div>
    );
  }

  if (!catalog || !activeSvc || !activePkg) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-sm text-slate-500">
        Memuat katalog layanan studio...
      </div>
    );
  }

  const inputCls =
    'w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14 pb-24">
      <div className="mb-8 space-y-1">
        <p className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">
          Formulir Pemesanan & Estimasi Biaya
        </p>
        <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-slate-100">
          Ajukan Produksi Musik Baru
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Semua data yang Anda kirimkan langsung masuk ke Ruang Klien dan memberi notifikasi real-time kepada Admin Studio.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-8 space-y-8">
          {/* LANGKAH 01 */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6">
            <div>
              <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                01. Layanan & Paket
              </span>
              <h2 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100 mt-1">
                Pilih Lini Layanan dan Paket
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(['tari', 'digital', 'transkripsi'] as ServiceLineKey[]).map((key) => {
                const svc = catalog[key];
                const active = serviceLine === key;
                const subMap: Record<ServiceLineKey, string> = {
                  tari: 'Komposisi & aransemen iringan pertunjukan tari',
                  digital: 'Produksi lagu, jingle, mars & scoring video',
                  transkripsi: 'Penulisan ulang audio menjadi not balok & angka',
                };
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectServiceLine(key)}
                    className={`p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                      active
                        ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:border-indigo-400'
                    }`}
                  >
                    <span className="text-sm font-bold block">{svc.label}</span>
                    <span className="text-xs opacity-80 block mt-1 leading-snug">{subMap[key]}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.entries(activeSvc.packages).map(([k, pkg]) => {
                const selected = packageKey === k;
                const isCustom = k === 'custom' || Boolean(pkg.isCustom);
                let priceText = formatRupiah(pkg.price);
                if (isCustom) {
                  priceText =
                    selected && Number(customPrice) > 0
                      ? formatRupiah(customPrice)
                      : 'Sesuai Kesepakatan';
                } else if (serviceLine === 'transkripsi') {
                  priceText =
                    k === 'komplet' || pkg.billingUnit === 'per_min_complete'
                      ? `${formatRupiah(pkg.price)} / mnt`
                      : `${formatRupiah(pkg.price)} / mnt / instrumen`;
                }

                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => handleSelectPackage(k)}
                    className={`p-5 rounded-xl border text-left flex flex-col justify-between transition-colors cursor-pointer ${
                      selected
                        ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-indigo-400'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {pkg.label}
                        </span>
                        {pkg.badge && (
                          <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400">
                            {pkg.badge}
                          </span>
                        )}
                      </div>
                      <div className="text-lg font-mono font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                        {priceText}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {pkg.summary}
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-200/70 dark:border-slate-800 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                      {selected ? 'Terpilih · Rincian di bawah' : 'Klik untuk memilih'}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Detail Paket Terpilih */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                    Fasilitas & Alur Kerja
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {activeSvc.label} — {activePkg.label}
                  </h3>
                </div>
                <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                  {activePkg.badge}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {activeSvc.overview}
              </p>
              <ul className="space-y-1.5">
                {activePkg.features.map((feat, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                <strong className="text-slate-900 dark:text-slate-100">Alur: </strong>
                {activePkg.workflow}
              </div>
            </div>

            {/* Custom Agreed Price Input */}
            <div>
              <label htmlFor="custom-price" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {pricing.isCustomPkg
                  ? 'Nominal Harga Kesepakatan Paket Custom (Rp) *'
                  : 'Harga Kesepakatan Khusus (Rp) — Opsional jika ada penyesuaian hasil diskusi'}
              </label>
              <input
                id="custom-price"
                type="number"
                min={0}
                required={pricing.isCustomPkg}
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                placeholder={
                  pricing.isCustomPkg
                    ? 'Wajib isi nominal kesepakatan (contoh: 2500000)'
                    : 'Kosongkan jika mengikuti tarif standar paket'
                }
                className={inputCls}
              />
            </div>
          </section>

          {/* LANGKAH 02 */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6">
            <div>
              <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                02. Identitas & Spesifikasi Karya
              </span>
              <h2 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100 mt-1">
                Data Pemesan dan Rincian Produksi
              </h2>
            </div>

            {(serviceLine === 'tari' || serviceLine === 'digital') && (
              <div className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/30 p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-slate-700 dark:text-slate-300">
                    Sebelum memesan, tinjau ketentuan resmi <strong>Perjanjian Produksi Musik PrangArt Lab</strong>.
                  </p>
                  <button
                    type="button"
                    onClick={() => setContractModalOpen(true)}
                    className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Baca Perjanjian Produksi</span>
                  </button>
                </div>

                <label className="flex items-start gap-3 pt-2 border-t border-indigo-200/70 dark:border-indigo-900 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={contractAgreed}
                    onChange={(e) => setContractAgreed(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-indigo-600"
                  />
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                    Saya menyetujui bahwa proses produksi musik mengikuti kontrak kerja sama resmi PrangArt Lab. *
                  </span>
                </label>
              </div>
            )}

            {/* Common Identity Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {serviceLine === 'tari'
                    ? 'Nama Sanggar / Instansi / Individu *'
                    : serviceLine === 'digital'
                    ? 'Nama Pemesan / Brand / Instansi *'
                    : 'Nama Pemesan / Institusi *'}
                </label>
                <input
                  required
                  value={sanggar}
                  onChange={(e) => setSanggar(e.target.value)}
                  placeholder="Contoh: Sanggar Seni Mahakam"
                  className={inputCls}
                />
              </div>

              {serviceLine !== 'transkripsi' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Kota, Provinsi *
                  </label>
                  <input
                    required
                    value={kotaProvinsi}
                    onChange={(e) => setKotaProvinsi(e.target.value)}
                    placeholder="Contoh: Samarinda, Kalimantan Timur"
                    className={inputCls}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Nomor WhatsApp Aktif *
                </label>
                <input
                  type="tel"
                  required
                  value={wa}
                  onChange={(e) => setWa(e.target.value)}
                  placeholder="081234567890"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Email Aktif *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@contoh.com"
                  className={inputCls}
                />
              </div>

              {serviceLine === 'tari' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Nama Lengkap Koreografer *
                    </label>
                    <input
                      required
                      value={koreografer}
                      onChange={(e) => setKoreografer(e.target.value)}
                      placeholder="Nama lengkap penata tari"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Jenis Tari *
                    </label>
                    <select
                      value={jenisTari}
                      onChange={(e) => setJenisTari(e.target.value)}
                      className={inputCls}
                    >
                      <option value="Tari tradisional">Tari tradisional</option>
                      <option value="Tari kreasi">Tari kreasi</option>
                      <option value="Lain-lain">Lain-lain (Isi manual)</option>
                    </select>
                    {jenisTari === 'Lain-lain' && (
                      <input
                        required
                        value={jenisTariOther}
                        onChange={(e) => setJenisTariOther(e.target.value)}
                        placeholder="Tuliskan jenis tari Anda..."
                        className={`${inputCls} mt-2`}
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Latar Belakang Budaya / Daerah *
                    </label>
                    <input
                      required
                      value={budayaDaerah}
                      onChange={(e) => setBudayaDaerah(e.target.value)}
                      placeholder="Contoh: Budaya Kutai / Dayak Kenyah"
                      className={inputCls}
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Judul Karya / Proyek *
                </label>
                <input
                  required
                  value={judul}
                  onChange={(e) => setJudul(e.target.value)}
                  placeholder="Judul karya atau repertoar"
                  className={inputCls}
                />
              </div>

              <div className={serviceLine === 'transkripsi' ? 'sm:col-span-2' : ''}>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Estimasi Durasi (MM:SS) *
                </label>
                <input
                  required
                  value={durasi}
                  onChange={(e) => setDurasi(e.target.value)}
                  placeholder="Contoh: 05:30"
                  className={`${inputCls} font-mono`}
                />
                {durationOverLimit && activePkg.maxSeconds && (
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium mt-1.5">
                    Batas maksimal {activePkg.label} adalah {formatSecondsToMMSS(activePkg.maxSeconds)} menit. Pilih paket lebih tinggi atau Paket Custom.
                  </p>
                )}
              </div>
            </div>

            {/* PACKAGE-SPECIFIC FIELDS */}
            <div className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-5">
              {serviceLine === 'tari' && packageKey === 'dasar' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Spesifikasi Musik Tari — Paket Dasar
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">Nuansa Musik Utama *</label>
                      <select
                        value={nuansaDasar}
                        onChange={(e) => setNuansaDasar(e.target.value)}
                        className={inputCls}
                      >
                        <option value="Sakral / Ritual">Sakral / Ritual</option>
                        <option value="Ceria / Enerjik">Ceria / Enerjik</option>
                        <option value="Dramatis">Dramatis</option>
                        <option value="Misterius">Misterius</option>
                        <option value="Other">Lainnya (Tulis sendiri)</option>
                      </select>
                      {nuansaDasar === 'Other' && (
                        <input
                          required
                          value={nuansaOther}
                          onChange={(e) => setNuansaOther(e.target.value)}
                          placeholder="Sebutkan nuansa musik..."
                          className={`${inputCls} mt-2`}
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">
                        Instrumen Dominan (Opsional)
                      </label>
                      <input
                        value={instrumenTari}
                        onChange={(e) => setInstrumenTari(e.target.value)}
                        placeholder="Contoh: Gendang, Gong, Sape, Suling..."
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>
              )}

              {serviceLine === 'tari' && packageKey === 'standar' && (
                <div className="space-y-5">
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold">
                      Struktur Tari / Suasana (Pilih satu atau lebih) *
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {strukturOptions.map((item) => (
                        <label
                          key={item}
                          className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={selectedStruktur.includes(item)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStruktur((prev) => [...prev, item]);
                              } else {
                                setSelectedStruktur((prev) => prev.filter((x) => x !== item));
                              }
                            }}
                            className="accent-indigo-600"
                          />
                          <span>{item}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={newStrukturInput}
                        onChange={(e) => setNewStrukturInput(e.target.value)}
                        placeholder="Tambah nama struktur baru..."
                        className={inputCls}
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomStruktur}
                        className="px-4 py-2 rounded-xl border border-indigo-600 text-indigo-600 dark:text-indigo-400 text-xs font-semibold whitespace-nowrap cursor-pointer"
                      >
                        + Tambah
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-semibold">
                        Urutan Nuansa & Durasi per Bagian *
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setStandarSegments((prev) => [
                            ...prev,
                            { id: `seg-${Date.now()}`, durasi: '', struktur: '', nuansa: '', link: '' },
                          ])
                        }
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Bagian</span>
                      </button>
                    </div>

                    <div className="space-y-3">
                      {standarSegments.map((seg, idx) => (
                        <div
                          key={seg.id}
                          className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                              Bagian {idx + 1}
                            </span>
                            {standarSegments.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setStandarSegments((prev) => prev.filter((x) => x.id !== seg.id))
                                }
                                className="text-xs text-red-600 dark:text-red-400 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Hapus</span>
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <input
                              required
                              value={seg.durasi}
                              onChange={(e) =>
                                setStandarSegments((prev) =>
                                  prev.map((x) => (x.id === seg.id ? { ...x, durasi: e.target.value } : x))
                                )
                              }
                              placeholder="Durasi (cth: 00:00 - 01:15)"
                              className={`${inputCls} font-mono`}
                            />
                            <input
                              required
                              value={seg.struktur}
                              onChange={(e) =>
                                setStandarSegments((prev) =>
                                  prev.map((x) => (x.id === seg.id ? { ...x, struktur: e.target.value } : x))
                                )
                              }
                              placeholder="Nama Adegan (cth: Opening)"
                              className={inputCls}
                            />
                            <input
                              required
                              value={seg.nuansa}
                              onChange={(e) =>
                                setStandarSegments((prev) =>
                                  prev.map((x) => (x.id === seg.id ? { ...x, nuansa: e.target.value } : x))
                                )
                              }
                              placeholder="Nuansa & Tempo (cth: Misterius lambat)"
                              className={inputCls}
                            />
                            <input
                              type="url"
                              value={seg.link}
                              onChange={(e) =>
                                setStandarSegments((prev) =>
                                  prev.map((x) => (x.id === seg.id ? { ...x, link: e.target.value } : x))
                                )
                              }
                              placeholder="Link Referensi (Opsional)"
                              className={inputCls}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {serviceLine === 'tari' && (packageKey === 'pro' || packageKey === 'custom') && (
                <div className="space-y-5">
                  {packageKey === 'custom' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold mb-1.5">Skala & Format Garapan *</label>
                        <select
                          value={customScale}
                          onChange={(e) => setCustomScale(e.target.value)}
                          className={inputCls}
                        >
                          <option value="Tari Tunggal / Duet / Trio">Tari Tunggal / Duet / Trio</option>
                          <option value="Tari Kelompok / Massal">Tari Kelompok / Massal</option>
                          <option value="Sendratari / Teater Tari">Sendratari / Teater Tari</option>
                          <option value="Musik Parade / Karnaval Budaya">Musik Parade / Karnaval Budaya</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1.5">Kebutuhan Instrumen Khusus *</label>
                        <input
                          required
                          value={customInstruments}
                          onChange={(e) => setCustomInstruments(e.target.value)}
                          placeholder="Contoh: Full Gambus + Perkusi + String"
                          className={inputCls}
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold mb-1.5">
                      Keterangan Awal Masuknya Musik & Tari *
                    </label>
                    {packageKey === 'pro' ? (
                      <select
                        value={proIntroMode}
                        onChange={(e) => setProIntroMode(e.target.value)}
                        className={inputCls}
                      >
                        <option value="Diawali musik pembuka terlebih dahulu, kemudian penari masuk">
                          Diawali musik pembuka terlebih dahulu, kemudian penari masuk
                        </option>
                        <option value="Hanya diberi kode/isyarat musik, lalu penari langsung masuk ke gerakan">
                          Hanya diberi kode/isyarat musik, lalu penari langsung masuk ke gerakan
                        </option>
                        <option value="Musik dan gerakan tari masuk bersamaan sejak detik pertama">
                          Musik dan gerakan tari masuk bersamaan sejak detik pertama
                        </option>
                      </select>
                    ) : (
                      <input
                        required
                        value={proIntroMode}
                        onChange={(e) => setProIntroMode(e.target.value)}
                        placeholder="Jelaskan kode/intro awal masuk tari..."
                        className={inputCls}
                      />
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-semibold">
                        Rincian Video Google Drive, Tempo (BPM) & Durasi per Bagian *
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setProSegments((prev) => [
                            ...prev,
                            {
                              id: `pro-${Date.now()}`,
                              label: `Bagian ${prev.length + 1}`,
                              bpm: '',
                              durasi: '',
                              link: '',
                              desc: '',
                            },
                          ])
                        }
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Bagian</span>
                      </button>
                    </div>

                    {proSegments.map((seg, idx) => (
                      <div
                        key={seg.id}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                            Segmen {idx + 1}
                          </span>
                          {proSegments.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setProSegments((prev) => prev.filter((x) => x.id !== seg.id))
                              }
                              className="text-xs text-red-600 dark:text-red-400 cursor-pointer"
                            >
                              Hapus
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <input
                            required
                            value={seg.label}
                            onChange={(e) =>
                              setProSegments((prev) =>
                                prev.map((x) => (x.id === seg.id ? { ...x, label: e.target.value } : x))
                              )
                            }
                            placeholder="Label (Video 1)"
                            className={inputCls}
                          />
                          <input
                            required
                            value={seg.bpm}
                            onChange={(e) =>
                              setProSegments((prev) =>
                                prev.map((x) => (x.id === seg.id ? { ...x, bpm: e.target.value } : x))
                              )
                            }
                            placeholder="Tempo (120 BPM)"
                            className={`${inputCls} font-mono`}
                          />
                          <input
                            required
                            value={seg.durasi}
                            onChange={(e) =>
                              setProSegments((prev) =>
                                prev.map((x) => (x.id === seg.id ? { ...x, durasi: e.target.value } : x))
                              )
                            }
                            placeholder="00:00 - 01:15"
                            className={`${inputCls} font-mono`}
                          />
                        </div>
                        <input
                          type="url"
                          value={seg.link}
                          onChange={(e) =>
                            setProSegments((prev) =>
                              prev.map((x) => (x.id === seg.id ? { ...x, link: e.target.value } : x))
                            )
                          }
                          placeholder="Tautan Video Google Drive Bagian Ini (Opsional)"
                          className={inputCls}
                        />
                        <textarea
                          required
                          rows={2}
                          value={seg.desc}
                          onChange={(e) =>
                            setProSegments((prev) =>
                              prev.map((x) => (x.id === seg.id ? { ...x, desc: e.target.value } : x))
                            )
                          }
                          placeholder="Urutan nuansa musik & keterangan masuknya penari..."
                          className={inputCls}
                        />
                      </div>
                    ))}
                  </div>

                  {packageKey === 'custom' && (
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">
                        Kebutuhan Output File & Teknis Tambahan *
                      </label>
                      <input
                        required
                        value={customDeliverables}
                        onChange={(e) => setCustomDeliverables(e.target.value)}
                        placeholder="Contoh: Master WAV + MP3 + Stems per instrumen + Click track"
                        className={inputCls}
                      />
                    </div>
                  )}
                </div>
              )}

              {serviceLine === 'tari' && (
                <div className="space-y-2">
                  <span className="block text-xs font-semibold">Tambahan Sorak (Khusus Musik Tari) *</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {['Tidak Perlu Sorak', 'Ya, Tambahkan Sorak'].map((opt) => (
                      <label
                        key={opt}
                        className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 cursor-pointer text-xs font-medium"
                      >
                        <input
                          type="radio"
                          name="sorak"
                          checked={sorakOption === opt}
                          onChange={() => setSorakOption(opt)}
                          className="accent-indigo-600"
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* MUSIK NON-TARI FIELDS */}
              {serviceLine === 'digital' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">Jenis Kebutuhan Produksi *</label>
                      <select
                        value={nonTariJenis}
                        onChange={(e) => setNonTariJenis(e.target.value)}
                        className={inputCls}
                      >
                        <option value="Aransemen Lagu Orisinal">Aransemen Lagu Orisinal</option>
                        <option value="Aransemen Ulang / Cover / Remix">Aransemen Ulang / Cover / Remix</option>
                        <option value="Scoring Film / Video / Konten">Scoring Film / Video / Konten</option>
                        <option value="Jingle Brand / Iklan">Jingle Brand / Iklan</option>
                        <option value="Mars / Himne Instansi">Mars / Himne Instansi</option>
                        <option value="Backsound Podcast / Game">Backsound Podcast / Game</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">Genre / Gaya Musik *</label>
                      <input
                        required
                        value={nonTariGenre}
                        onChange={(e) => setNonTariGenre(e.target.value)}
                        placeholder="Contoh: Pop Akustik, Sinematik Orkestra, Folk"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">Nuansa / Mood Utama *</label>
                      <input
                        required
                        value={nonTariNuansa}
                        onChange={(e) => setNonTariNuansa(e.target.value)}
                        placeholder="Contoh: Hangat, Megah, Melankolis"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">Tempo (BPM) & Nada Dasar</label>
                      <input
                        value={nonTariTempoKey}
                        onChange={(e) => setNonTariTempoKey(e.target.value)}
                        placeholder="Contoh: 95 BPM, C Mayor"
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Susunan Instrumen *</label>
                    <input
                      required
                      value={nonTariInstrumen}
                      onChange={(e) => setNonTariInstrumen(e.target.value)}
                      placeholder="Contoh: Piano, Gitar Akustik, Bass, Drum, String Section"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Struktur Lagu / Alur Dinamika *</label>
                    <textarea
                      required
                      rows={3}
                      value={nonTariStruktur}
                      onChange={(e) => setNonTariStruktur(e.target.value)}
                      placeholder="Contoh: Intro lembut → Verse → Chorus megah → Bridge → Outro"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Lirik / Naskah Voice Over (Opsional)</label>
                    <textarea
                      rows={2}
                      value={nonTariLirik}
                      onChange={(e) => setNonTariLirik(e.target.value)}
                      placeholder="Tempel lirik atau naskah narasi jika ada"
                      className={inputCls}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">Target Penggunaan / Platform *</label>
                      <input
                        required
                        value={nonTariPlatform}
                        onChange={(e) => setNonTariPlatform(e.target.value)}
                        placeholder="Contoh: Spotify, YouTube, Film Pendek"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">Format File Output *</label>
                      <select
                        value={nonTariOutput}
                        onChange={(e) => setNonTariOutput(e.target.value)}
                        className={inputCls}
                      >
                        <option value="Master WAV (24-bit) + MP3 (320kbps)">Master WAV (24-bit) + MP3 (320kbps)</option>
                        <option value="Master WAV + MP3 + Minus One / Karaoke">Master WAV + MP3 + Minus One / Karaoke</option>
                        <option value="Full Package + Stems / Multitrack Terpisah">Full Package + Stems / Multitrack Terpisah</option>
                      </select>
                    </div>
                  </div>
                  {packageKey === 'custom' && (
                    <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/30 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          required
                          value={nonTariCustomCount}
                          onChange={(e) => setNonTariCustomCount(e.target.value)}
                          placeholder="Jumlah Trek / Lagu *"
                          className={inputCls}
                        />
                        <select
                          value={nonTariCustomLicense}
                          onChange={(e) => setNonTariCustomLicense(e.target.value)}
                          className={inputCls}
                        >
                          <option value="Lisensi Standar (Kredit PrangArt Lab)">Lisensi Standar (Kredit PrangArt Lab)</option>
                          <option value="Lisensi Komersial / Iklan Nasional">Lisensi Komersial / Iklan Nasional</option>
                          <option value="Full Buyout / Hak Cipta Eksklusif Klien">Full Buyout / Hak Cipta Eksklusif Klien</option>
                        </select>
                      </div>
                      <textarea
                        required
                        rows={2}
                        value={nonTariCustomDetail}
                        onChange={(e) => setNonTariCustomDetail(e.target.value)}
                        placeholder="Rincian teknis kustom (live recording, loudness, sinkronisasi timecode) *"
                        className={inputCls}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* TRANSKRIPSI FIELDS */}
              {serviceLine === 'transkripsi' && (
                <div className="space-y-4">
                  {packageKey !== 'custom' && (
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                      {packageKey !== 'komplet' ? (
                        <div>
                          <label className="block text-xs font-semibold mb-1.5">
                            Jumlah Instrumen / Jalur Suara *
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={transInstrumentCount}
                            onChange={(e) =>
                              setTransInstrumentCount(Math.max(1, Number(e.target.value || 1)))
                            }
                            className={`${inputCls} font-mono font-bold`}
                          />
                        </div>
                      ) : (
                        <div className="text-xs text-slate-600 dark:text-slate-400">
                          <strong className="text-slate-900 dark:text-slate-100 block">
                            Cakupan Full Ensemble
                          </strong>
                          Semua instrumen dalam rekaman tercakup dalam 1 tarif per menit (minimal 1 menit).
                        </div>
                      )}
                      <div className="text-xs">
                        <span className="text-slate-500 block">Kalkulasi Durasi Terhitung</span>
                        <strong className="font-mono text-indigo-600 dark:text-indigo-400 tabular-nums">
                          {pricing.breakdownNote || `${billableMinutes} menit × ${formatRupiah(activePkg.price)}`}
                        </strong>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">Jenis Transkripsi *</label>
                      <select
                        value={transJenis}
                        onChange={(e) => setTransJenis(e.target.value)}
                        className={inputCls}
                      >
                        <option value="Melodi Utama + Simbol Akor">Melodi Utama + Simbol Akor</option>
                        <option value="Vokal + Iringan Piano/Gitar">Vokal + Iringan Piano/Gitar</option>
                        <option value="Instrumen Solo (Piano / Biola / Gitar / Suling)">
                          Instrumen Solo (Piano / Biola / Gitar / Suling)
                        </option>
                        <option value="Ensambel / Full Band / Orkestra">Ensambel / Full Band / Orkestra</option>
                        <option value="Musik Tradisional / Etnomusikologi">Musik Tradisional / Etnomusikologi</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">Format Notasi *</label>
                      <select
                        value={transFormatNotasi}
                        onChange={(e) => setTransFormatNotasi(e.target.value)}
                        className={inputCls}
                      >
                        <option value="Not Balok (Staff Notation)">Not Balok (Staff Notation)</option>
                        <option value="Not Angka">Not Angka</option>
                        <option value="Not Balok + Not Angka (Gabungan)">Not Balok + Not Angka (Gabungan)</option>
                        <option value="Not Balok + Tablatur (TAB)">Not Balok + Tablatur (TAB)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5">
                      Daftar Instrumen yang Ditranskripsi *
                    </label>
                    <input
                      required
                      value={transInstrumen}
                      onChange={(e) => setTransInstrumen(e.target.value)}
                      placeholder="Contoh: Vokal Soprano, Piano, Biola, Kendang"
                      className={inputCls}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">Format File Hasil *</label>
                      <select
                        value={transFileOutput}
                        onChange={(e) => setTransFileOutput(e.target.value)}
                        className={inputCls}
                      >
                        <option value="PDF Siap Cetak">PDF Siap Cetak</option>
                        <option value="PDF + Audio Simulasi MIDI / MP3">PDF + Audio Simulasi MIDI / MP3</option>
                        <option value="PDF + MIDI + File Proyek (Sibelius / MuseScore / MusicXML)">
                          PDF + MIDI + File Proyek (Sibelius / MuseScore / MusicXML)
                        </option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">Bagian Audio Ditranskripsi *</label>
                      <input
                        required
                        value={transBagianWaktu}
                        onChange={(e) => setTransBagianWaktu(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">Nada Dasar & Birama</label>
                      <input
                        value={transNadaBirama}
                        onChange={(e) => setTransNadaBirama(e.target.value)}
                        placeholder="Contoh: G Mayor, 4/4"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5">Tujuan Penggunaan Partitur *</label>
                      <input
                        required
                        value={transTujuan}
                        onChange={(e) => setTransTujuan(e.target.value)}
                        placeholder="Contoh: Skripsi/Tesis, Lomba, Dokumentasi"
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Catatan Teknis (Opsional)</label>
                    <textarea
                      rows={2}
                      value={transCatatan}
                      onChange={(e) => setTransCatatan(e.target.value)}
                      placeholder="Contoh: Sertakan lirik di bawah notasi vokal"
                      className={inputCls}
                    />
                  </div>

                  {packageKey === 'custom' && (
                    <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/30 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          required
                          value={transCustomCount}
                          onChange={(e) => setTransCustomCount(e.target.value)}
                          placeholder="Jumlah Repertoar / Karya *"
                          className={inputCls}
                        />
                        <select
                          value={transCustomStandard}
                          onChange={(e) => setTransCustomStandard(e.target.value)}
                          className={inputCls}
                        >
                          <option value="Partitur Pertunjukan / Orkestrasi">Partitur Pertunjukan / Orkestrasi</option>
                          <option value="Transkripsi Deskriptif Etnomusikologi (Skripsi/Tesis)">
                            Transkripsi Deskriptif Etnomusikologi (Skripsi/Tesis)
                          </option>
                          <option value="Transkripsi Preskriptif / Bahan Ajar">
                            Transkripsi Preskriptif / Bahan Ajar
                          </option>
                        </select>
                      </div>
                      <textarea
                        required
                        rows={2}
                        value={transCustomDetail}
                        onChange={(e) => setTransCustomDetail(e.target.value)}
                        placeholder="Jelaskan kebutuhan sistem laras tradisi atau simbol khusus *"
                        className={inputCls}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Reference Link */}
              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  {serviceLine === 'transkripsi'
                    ? 'Tautan Audio / Video Sumber (Google Drive / YouTube) *'
                    : 'Tautan Video / Lagu Referensi (Google Drive / YouTube — Opsional)'}
                </label>
                <input
                  type="url"
                  required={serviceLine === 'transkripsi'}
                  value={videoLink}
                  onChange={(e) => setVideoLink(e.target.value)}
                  placeholder="https://drive.google.com/... atau https://youtube.com/..."
                  className={inputCls}
                />
              </div>

              {/* Vocal Add-on */}
              {serviceLine !== 'transkripsi' && (
                <label className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 cursor-pointer">
                  <div>
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 block">
                      Tambahan Vokal / Session Player
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      + {formatRupiah(activeSvc.addonPrice)}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={hasVocalAddon}
                    onChange={(e) => setHasVocalAddon(e.target.checked)}
                    className="w-5 h-5 accent-indigo-600"
                  />
                </label>
              )}
            </div>
          </section>

          {/* LANGKAH 03 */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6">
            <div>
              <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                03. {serviceLine === 'tari' ? 'Sinopsis Karya & Ketentuan' : 'Ketentuan Layanan'}
              </span>
              <h2 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100 mt-1">
                {serviceLine === 'tari' ? 'Penyusunan Sinopsis Tari' : 'Aturan & Prosedur Studio'}
              </h2>
            </div>

            {serviceLine === 'tari' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Sinopsis Karya Tari *
                  </label>
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setSynopsisMode('manual')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                        synopsisMode === 'manual'
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Ketik Manual
                    </button>
                    <button
                      type="button"
                      onClick={() => setSynopsisMode('ai')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                        synopsisMode === 'ai'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Bantu Susun dengan AI</span>
                    </button>
                  </div>
                </div>

                {synopsisMode === 'ai' && (
                  <div className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-slate-50 dark:bg-slate-950 p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        Asisten Dramaturgi AI (Tinjau kembali sebelum digunakan)
                      </span>
                      {aiQuotaInfo && (
                        <span className="font-mono text-slate-600 dark:text-slate-400 tabular-nums">
                          Kuota Hari Ini: {aiQuotaInfo.used}/{aiQuotaInfo.limit}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        value={aiFields.tema}
                        onChange={(e) => setAiFields((p) => ({ ...p, tema: e.target.value }))}
                        placeholder="Tema karya"
                        className={inputCls}
                      />
                      <input
                        value={aiFields.karakter}
                        onChange={(e) => setAiFields((p) => ({ ...p, karakter: e.target.value }))}
                        placeholder="Karakter gerak (lembut, tegas, dinamis)"
                        className={inputCls}
                      />
                      <input
                        value={aiFields.musik}
                        onChange={(e) => setAiFields((p) => ({ ...p, musik: e.target.value }))}
                        placeholder="Gambaran musik pengiring"
                        className={inputCls}
                      />
                      <input
                        value={aiFields.instrumen}
                        onChange={(e) => setAiFields((p) => ({ ...p, instrumen: e.target.value }))}
                        placeholder="Alat musik / instrumen"
                        className={inputCls}
                      />
                      <textarea
                        rows={2}
                        value={aiFields.latar}
                        onChange={(e) => setAiFields((p) => ({ ...p, latar: e.target.value }))}
                        placeholder="Latar belakang & sumber inspirasi karya..."
                        className={inputCls}
                      />
                      <textarea
                        rows={2}
                        value={aiFields.perkembangan}
                        onChange={(e) => setAiFields((p) => ({ ...p, perkembangan: e.target.value }))}
                        placeholder="Alur perkembangan penyajian (awal - tengah - akhir)..."
                        className={inputCls}
                      />
                      <textarea
                        rows={2}
                        value={aiFields.makna}
                        onChange={(e) => setAiFields((p) => ({ ...p, makna: e.target.value }))}
                        placeholder="Makna, filosofi & pesan untuk penonton..."
                        className={`${inputCls} sm:col-span-2`}
                      />
                    </div>

                    <button
                      type="button"
                      disabled={aiLoading}
                      onClick={handleGenerateAISynopsis}
                      className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
                    >
                      {aiLoading ? 'Menyusun Sinopsis dengan Gemini...' : 'Susun Draf Sinopsis dengan AI'}
                    </button>

                    {aiPreview && (
                      <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            Hasil Draf AI
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSinopsis(aiPreview);
                              showToast('Ditempel', 'Hasil AI dimasukkan ke kolom Sinopsis Final.');
                            }}
                            className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
                          >
                            Gunakan ke Kolom Sinopsis
                          </button>
                        </div>
                        <textarea
                          rows={5}
                          readOnly
                          value={aiPreview}
                          className={inputCls}
                        />
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                    Sinopsis Final *
                  </label>
                  <textarea
                    required
                    rows={5}
                    value={sinopsis}
                    onChange={(e) => setSinopsis(e.target.value)}
                    placeholder="Ketik sinopsis karya tari Anda di sini..."
                    className={inputCls}
                  />
                </div>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-5 text-xs text-slate-600 dark:text-slate-400 space-y-2 leading-relaxed">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Ketentuan & Aturan Layanan Studio
              </h3>
              <p>1. Permintaan di luar batas paket standar (durasi &gt; 07:00 menit) menggunakan Paket Custom sesuai kesepakatan.</p>
              <p>2. Revisi mengikuti kualifikasi paket dalam koridor konsep awal; revisi ekstra di luar batas dikenakan Rp250.000 per sesi.</p>
              <p>3. Produksi dimulai setelah DP 50% dikonfirmasi klien dan diverifikasi Admin. Bukti Lunas & Master File terbuka setelah pelunasan 100%.</p>
            </div>
          </section>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            {submitting ? 'Mengirim Pengajuan ke Studio...' : 'Kirim Pengajuan Pesanan'}
          </button>
        </div>

        {/* RIGHT STICKY COST SUMMARY */}
        <aside className="lg:col-span-4 lg:sticky lg:top-24">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
              <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                Ringkasan Estimasi Biaya
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Layanan</span>
                <span className="font-semibold text-right text-slate-900 dark:text-slate-100">
                  {activeSvc.label}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">{activePkg.label}</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                  {pricing.isCustomPkg && pricing.basePrice === 0
                    ? 'Isi nominal'
                    : formatRupiah(pricing.basePrice)}
                </span>
              </div>
              {pricing.breakdownNote && (
                <div className="text-[11px] text-slate-500 font-mono">{pricing.breakdownNote}</div>
              )}
              {pricing.addonAmount > 0 && (
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Tambahan Vokal / Player</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    + {formatRupiah(pricing.addonAmount)}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Total Estimasi
                </span>
                <span className="text-2xl font-mono font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                  {pricing.isCustomPkg && pricing.totalPrice === 0
                    ? 'Menunggu'
                    : formatRupiah(pricing.totalPrice)}
                </span>
              </div>
              {pricing.totalPrice > 0 && (
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>DP Awal 50%</span>
                  <span className="font-mono font-semibold tabular-nums">
                    {formatRupiah(Math.round(pricing.totalPrice / 2))}
                  </span>
                </div>
              )}
            </div>
          </div>
        </aside>
      </form>

      {/* CONTRACT READER MODAL */}
      {contractModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-display font-bold text-slate-900 dark:text-slate-100">
                Perjanjian Kerja Sama Produksi Musik
              </h3>
              <button
                type="button"
                onClick={() => setContractModalOpen(false)}
                aria-label="Tutup perjanjian"
                className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
              <p>
                Tanggal berlaku: <strong>{formatDateLongID()}</strong> — antara <strong>PrangArt Lab</strong> (Pihak Pertama) dan <strong>{sanggar || '[Nama Pemesan]'}</strong> (Pihak Kedua).
              </p>
              <p>
                <strong>Pasal 1 (Objek):</strong> Produksi {activeSvc.label} ({activePkg.label}) untuk karya berjudul <strong>{judul || '[Judul Karya]'}</strong> dengan durasi <strong>{durasi || '[Durasi]'}</strong>.
              </p>
              <p>
                <strong>Pasal 2 (Biaya & Tahap Bayar):</strong> Total nilai produksi sebesar <strong>{formatRupiah(pricing.totalPrice)}</strong>. Pembayaran DP 50% (<strong>{formatRupiah(Math.round(pricing.totalPrice / 2))}</strong>) wajib dikonfirmasi melalui Ruang Klien sebelum pengerjaan dimulai, dan pelunasan 50% sebelum penyerahan Master File & Bukti Lunas.
              </p>
              <p>
                <strong>Pasal 3 (Revisi & Hak Karya):</strong> Hak revisi sesuai batas paket pada konsep awal. Pencantuman kredit produksi: &ldquo;Music by PrangArt Lab&rdquo;.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setContractAgreed(true);
                  setContractModalOpen(false);
                  showToast('Disetujui', 'Persetujuan Perjanjian Produksi telah dicentang.');
                }}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Saya Setuju & Tutup</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INLINE AUTH MODAL WHEN GUEST SUBMITS ORDER */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-md">
            <button
              type="button"
              onClick={() => setAuthModalOpen(false)}
              aria-label="Tutup dialog masuk"
              className="absolute top-4 right-4 z-10 p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <ClientAuthCard
              compactTitle={authPurpose === 'ai' ? 'Masuk untuk Asisten Sinopsis AI' : 'Masuk untuk Mengirim Pesanan'}
              onSuccess={() => {
                setAuthModalOpen(false);
                if (authPurpose === 'submit') {
                  const payload = buildOrderPayload();
                  if (payload) {
                    void executeOrderSubmit(payload);
                  }
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
