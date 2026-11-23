import type { Project } from '../types';

export function formatRupiah(num: number | string | undefined | null): string {
  return 'Rp' + Number(num || 0).toLocaleString('id-ID');
}

export function parseDurationToSeconds(mmss: string): number | null {
  if (!mmss) return null;
  const clean = String(mmss).trim();
  const match = clean.match(/^(\d{1,3}):([0-5]\d)$/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

export function formatSecondsToMMSS(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatDateTimeID(iso?: string): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function formatDateLongID(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function safeExternalUrl(url?: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/src/assets/')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export function normalizeWhatsAppNumber(raw?: string): string {
  let n = String(raw || '').replace(/\D/g, '');
  if (n.startsWith('0')) n = '62' + n.slice(1);
  return n;
}

export function getProjectPaymentAccess(project: Project) {
  const dpLower = String(project.dpStatus || '').toLowerCase();
  const finalLower = String(project.finalPaymentStatus || '').toLowerCase();
  const prodLower = String(project.productionStatus || '').toLowerCase();

  const isFullyPaid =
    project.paymentStage === 'LUNAS' ||
    finalLower === 'lunas' ||
    dpLower.includes('lunas 100%') ||
    dpLower === 'lunas' ||
    prodLower.includes('7. pelunasan & penyerahan master');

  const isDpVerified =
    !isFullyPaid &&
    (project.paymentStage === 'DP_TERVERIFIKASI' ||
      project.paymentStage === 'PELUNASAN_KONFIRMASI_KLIEN' ||
      dpLower.includes('dp terverifikasi') ||
      dpLower.includes('dp 50% terverifikasi') ||
      dpLower.includes('dp 50% lunas'));

  const isDpSubmittedByClient = !isFullyPaid && !isDpVerified && project.paymentStage === 'DP_KONFIRMASI_KLIEN';
  const isFinalSubmittedByClient = !isFullyPaid && project.paymentStage === 'PELUNASAN_KONFIRMASI_KLIEN';
  const isAwaitingDp = !isFullyPaid && !isDpVerified && !isDpSubmittedByClient;

  return {
    isAwaitingDp,
    isDpSubmittedByClient,
    isDpVerified,
    isFinalSubmittedByClient,
    isFullyPaid,
    canDownloadLunasDocument: isFullyPaid && Boolean(project.canDownloadReceipt ?? true),
    canDownloadMasterFile: isFullyPaid && Boolean(project.canDownloadMaster ?? true),
  };
}

export function playNotificationChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now); // E5
    osc1.frequency.setValueAtTime(880, now + 0.09); // A5
    gain1.gain.setValueAtTime(0.08, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.36);
  } catch {
    // Browser blocked autoplay audio before gesture
  }
}
