import { jsPDF } from 'jspdf';
import {
  formatDateLongID,
  formatDateShortID,
  formatDateTimeID,
  formatRupiah,
  getProjectFinanceSummary,
  getProjectPaymentAccess,
} from './format';
import type { ClientUser, Project, StudioSettings } from '../types';

export type StudioPdfDocKind =
  | 'brief'
  | 'contract'
  | 'invoice_dp'
  | 'invoice_final'
  | 'receipt_dp'
  | 'receipt_final';

const OWNER_FULL_NAME = 'Fikri Yassaar Arrazaq, S.Sn.';
const OWNER_ROLE_LABEL = 'Founder & Music Director — PrangArt Lab';

let cachedLogoDataUrl: string | null | undefined;

/**
 * Loads the official PrangArt Lab PNG logo once and caches it as a PNG DataURL for jsPDF.
 */
async function loadBrandLogoDataUrl(): Promise<string | null> {
  if (cachedLogoDataUrl !== undefined) return cachedLogoDataUrl;
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch('/assets/brand/logo-dark.png', { cache: 'force-cache' });
    if (!res.ok) throw new Error('Logo HTTP error');
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Logo decode failed'));
        image.src = objectUrl;
      });
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      cachedLogoDataUrl = canvas.toDataURL('image/png');
      return cachedLogoDataUrl;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    cachedLogoDataUrl = null;
    return null;
  }
}

function sanitizeFileSlug(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

/**
 * Draws the official vector PrangArt Lab logo directly onto the PDF (Zero <img> tags).
 */
function drawPdfLogo(doc: jsPDF, x: number, y: number, size = 14) {
  const r = size * 0.22;
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(x, y, size, size, r, r, 'F');
  doc.setDrawColor(99, 102, 241); // indigo-500
  doc.setLineWidth(0.35);
  doc.roundedRect(x + 0.6, y + 0.6, size - 1.2, size - 1.2, r * 0.85, r * 0.85, 'S');

  // 5 Acoustic waveform bars
  const bars = [
    { offset: 0.22, h: 0.24, color: [129, 140, 248] as [number, number, number] },
    { offset: 0.35, h: 0.44, color: [165, 180, 252] as [number, number, number] },
    { offset: 0.48, h: 0.6, color: [255, 255, 255] as [number, number, number] },
    { offset: 0.61, h: 0.42, color: [165, 180, 252] as [number, number, number] },
    { offset: 0.74, h: 0.28, color: [129, 140, 248] as [number, number, number] },
  ];
  const barW = Math.max(0.8, size * 0.08);
  const midY = y + size * 0.47;
  for (const bar of bars) {
    const bh = size * bar.h;
    const bx = x + size * bar.offset - barW / 2;
    const by = midY - bh / 2;
    doc.setFillColor(bar.color[0], bar.color[1], bar.color[2]);
    doc.roundedRect(bx, by, barW, bh, barW / 2, barW / 2, 'F');
  }

  // Bottom bar underline
  doc.setDrawColor(99, 102, 241);
  doc.setLineWidth(0.45);
  doc.line(x + size * 0.2, y + size * 0.84, x + size * 0.8, y + size * 0.84);
}

/**
 * Draws a crisp vector circular official studio stamp directly onto the PDF.
 */
function drawPdfStamp(
  doc: jsPDF,
  cx: number,
  cy: number,
  badgeText: string,
  dateText: string,
  colorRgb: [number, number, number] = [67, 56, 202]
) {
  const outerR = 14.5;
  doc.setDrawColor(colorRgb[0], colorRgb[1], colorRgb[2]);
  doc.setLineWidth(0.75);
  doc.circle(cx, cy, outerR, 'S');

  doc.setLineWidth(0.3);
  doc.circle(cx, cy, outerR - 1.6, 'S');
  doc.circle(cx, cy, outerR - 4.8, 'S');

  // Top & bottom arc-style labels
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.2);
  doc.setTextColor(colorRgb[0], colorRgb[1], colorRgb[2]);
  doc.text('PRANGART LAB STUDIO', cx, cy - 6.6, { align: 'center' });
  doc.text('SAMARINDA · INDONESIA', cx, cy + 7.2, { align: 'center' });
  if (dateText) {
    doc.setFont('courier', 'bold');
    doc.setFontSize(4.8);
    doc.text(dateText, cx, cy + 10.2, { align: 'center' });
  }

  // Side dots
  doc.setFillColor(colorRgb[0], colorRgb[1], colorRgb[2]);
  doc.circle(cx - 10.8, cy, 0.55, 'F');
  doc.circle(cx + 10.8, cy, 0.55, 'F');

  // Center banner rectangle
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(colorRgb[0], colorRgb[1], colorRgb[2]);
  doc.setLineWidth(0.55);
  doc.roundedRect(cx - 15.5, cy - 3.3, 31, 6.6, 1.2, 1.2, 'FD');

  doc.setFont('courier', 'bold');
  doc.setFontSize(6.6);
  doc.setTextColor(colorRgb[0], colorRgb[1], colorRgb[2]);
  doc.text(badgeText, cx, cy + 1.1, { align: 'center' });
}

/**
 * Draws the handwritten vector signature of Fikri Yassaar Arrazaq, S.Sn.
 */
function drawPdfOwnerSignature(doc: jsPDF, x: number, y: number) {
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.55);
  // Stylized calligraphic cursive strokes using relative line segments
  doc.lines(
    [
      [2, -8, 6, -10, 7, -6],
      [1, 3, -6, 7, -8, 8],
      [5, -2, 12, -5, 14, -7],
      [-1, 3, -2, 6, 0, 6],
      [2, 0, 4, -5, 6, -5],
      [1, 0, 1, 5, 3, 5],
      [2, 0, 4, -6, 7, -7],
      [1, 0, -2, 9, -4, 12],
      [-1, 1, 1, -4, 6, -6],
      [3, -1, 4, 2, 7, 1],
      [3, -1, 5, -3, 8, -2],
      [2, 1, 3, 3, 6, 1],
    ],
    x + 2,
    y + 10,
    [1, 1],
    'S'
  );
  // Crossbar & underline flourish
  doc.setLineWidth(0.42);
  doc.line(x + 1, y + 5.5, x + 19, y + 3.5);
  doc.setDrawColor(67, 56, 202);
  doc.setLineWidth(0.35);
  doc.line(x + 1, y + 15.5, x + 46, y + 14.2);
}

/**
 * Draws header block with Studio Logo, Title, Studio Contact, and Document Metadata.
 */
function drawPdfHeader(
  doc: jsPDF,
  docLabel: string,
  refCode: string,
  dateLabel: string,
  settings?: StudioSettings,
  logoDataUrl?: string | null
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 16;

  // Top accent bar
  doc.setFillColor(67, 56, 202);
  doc.rect(0, 0, pageW, 3.2, 'F');

  // Official PrangArt Lab PNG Logo (fallback to vector if image unavailable)
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', margin, 9, 17, 17);
  } else {
    drawPdfLogo(doc, margin, 11, 14);
  }
  const textX = margin + 20.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(15, 23, 42);
  doc.text('PrangArt Lab', textX, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(100, 116, 139);
  doc.text('Music Production, Tari & Transkripsi Notasi Studio', textX, 20.5);
  const contactLine = `${settings?.studioAddress || 'Samarinda, Kalimantan Timur'} · ${
    settings?.studioEmail || 'prangart.lab@gmail.com'
  }${settings?.studioWhatsApp ? ` · WA ${settings.studioWhatsApp}` : ''}`;
  doc.text(contactLine, textX, 24.6);

  // Right metadata box
  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(67, 56, 202);
  doc.text(docLabel.toUpperCase(), pageW - margin, 15.5, { align: 'right' });

  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(`Ref: ${refCode}`, pageW - margin, 20, { align: 'right' });
  doc.text(dateLabel, pageW - margin, 24.3, { align: 'right' });

  // Separator line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(margin, 29.5, pageW - margin, 29.5);

  return 35.5;
}

function ensurePageSpace(doc: jsPDF, currentY: number, neededHeight: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (currentY + neededHeight > pageH - 18) {
    doc.addPage();
    return 18;
  }
  return currentY;
}

function drawSectionHeading(doc: jsPDF, y: number, title: string): number {
  const margin = 16;
  const nextY = ensurePageSpace(doc, y, 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(67, 56, 202);
  doc.text(title.toUpperCase(), margin, nextY);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, nextY + 1.8, doc.internal.pageSize.getWidth() - margin, nextY + 1.8);
  return nextY + 6.5;
}

function drawKeyValueRows(
  doc: jsPDF,
  startY: number,
  rows: { label: string; value: string; highlightColor?: [number, number, number] }[]
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 16;
  const col1W = 54;
  const col2W = pageW - margin * 2 - col1W - 6;
  let y = startY;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const valLines = doc.splitTextToSize(row.value || '-', col2W) as string[];
    const rowH = Math.max(7, valLines.length * 4.3 + 2.8);
    y = ensurePageSpace(doc, y, rowH + 2);

    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y - 4.2, pageW - margin * 2, rowH, 'F');
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(100, 116, 139);
    doc.text(row.label, margin + 2.5, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.4);
    if (row.highlightColor) {
      doc.setTextColor(row.highlightColor[0], row.highlightColor[1], row.highlightColor[2]);
      doc.setFont('helvetica', 'bold');
    } else {
      doc.setTextColor(15, 23, 42);
    }
    doc.text(valLines, margin + col1W + 4, y);
    y += rowH;
  }
  return y + 3;
}

function drawAuthorizationFooter(
  doc: jsPDF,
  y: number,
  stampLabel: string,
  dateStr: string,
  stampRgb: [number, number, number] = [67, 56, 202],
  secondParty?: { name: string; statusText: string }
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 16;
  const blockY = ensurePageSpace(doc, y, 48);

  if (secondParty) {
    // Left: Pihak Kedua, Right: Pihak Pertama (Studio)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('PIHAK KEDUA (KLIEN / PEMESAN)', margin + 4, blockY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(5, 150, 105);
    doc.text(secondParty.statusText, margin + 4, blockY + 14);
    doc.setDrawColor(203, 213, 225);
    doc.line(margin + 4, blockY + 26, margin + 68, blockY + 26);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(15, 23, 42);
    doc.text(secondParty.name, margin + 4, blockY + 30.5);
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(100, 116, 139);
    const noteLines = doc.splitTextToSize(
      'Dokumen ini diterbitkan secara resmi oleh sistem manajemen PrangArt Lab dan sah tanpa tanda tangan basah karena telah dilengkapi stempel & tanda tangan digital resmi pemilik studio.',
      pageW - margin * 2 - 74
    ) as string[];
    doc.text(noteLines, margin, blockY + 8);
  }

  const sigX = pageW - margin - 62;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Samarinda, ${dateStr}`, sigX, blockY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Pemilik & Pengelola Studio,', sigX, blockY + 4.5);

  drawPdfStamp(doc, sigX + 12, blockY + 18, stampLabel, dateStr, stampRgb);
  drawPdfOwnerSignature(doc, sigX + 14, blockY + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text(OWNER_FULL_NAME, sigX, blockY + 31.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.6);
  doc.setTextColor(100, 116, 139);
  doc.text(OWNER_ROLE_LABEL, sigX, blockY + 35.5);

  return blockY + 42;
}

/**
 * 1. Download Complete Order Data PDF ("Unduh Data Pemesanan (.pdf)")
 * Executive design with Studio Logo, Consumer Card, Works & Finishing Schedule, Financial Summary, Complete Specs, Synopsis & Notes.
 */
export async function downloadOrderDataPdf(project: Project, settings?: StudioSettings): Promise<void> {
  const logoDataUrl = await loadBrandLogoDataUrl();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 16;
  const fin = getProjectFinanceSummary(project);

  let y = drawPdfHeader(
    doc,
    'DATA PEMESANAN KARYA',
    project.id,
    formatDateLongID(project.createdAt),
    settings,
    logoDataUrl
  );

  // Executive Title Card
  doc.setFillColor(238, 242, 255); // indigo-50
  doc.setDrawColor(199, 210, 254); // indigo-200
  doc.roundedRect(margin, y, pageW - margin * 2, 22, 2.5, 2.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(project.judul, margin + 4, y + 7.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(67, 56, 202);
  doc.text(
    `${project.serviceLineLabel} · ${project.packageName} · Durasi ${project.durasi}`,
    margin + 4,
    y + 13
  );

  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Tahap Produksi: ${project.productionStatus} | Tgl Finishing: ${formatDateShortID(project.finishingDate)}`,
    margin + 4,
    y + 18.2
  );
  y += 28;

  // Section 1: Data Konsumen
  y = drawSectionHeading(doc, y, '1. Data Konsumen & Pemesan');
  y = drawKeyValueRows(doc, y, [
    { label: 'Nama Pemesan / Sanggar', value: project.clientName },
    { label: 'WhatsApp Aktif', value: project.clientWa || '-' },
    { label: 'Email Akun / Kontak', value: `${project.clientEmail} / ${project.contactEmail}` },
    { label: 'Persetujuan Kontrak SPK', value: project.contractAgreed ? `Disetujui Digital (${formatDateTimeID(project.contractAgreedAt || project.createdAt)})` : 'Belum disetujui' },
  ]);

  // Section 2: Keuangan & Pembayaran
  y = drawSectionHeading(doc, y, '2. Ringkasan Keuangan & Status Pembayaran');
  y = drawKeyValueRows(doc, y, [
    { label: 'Total Nilai Kontrak', value: formatRupiah(fin.totalPrice), highlightColor: [15, 23, 42] },
    { label: 'Kewajiban DP 50%', value: `${formatRupiah(fin.dpAmount)} (${project.dpStatus})` },
    { label: 'Kewajiban Pelunasan 50%', value: `${formatRupiah(fin.remainingAmount)} (${project.finalPaymentStatus})` },
    { label: 'Dana Masuk Terverifikasi', value: formatRupiah(fin.verifiedPaidAmount), highlightColor: [5, 150, 105] },
    {
      label: 'Sisa Tagihan / Piutang',
      value: formatRupiah(fin.outstandingAmount),
      highlightColor: fin.outstandingAmount > 0 ? [180, 83, 9] : [5, 150, 105],
    },
  ]);

  // Section 3: Jadwal Finishing & Hasil Karya
  y = drawSectionHeading(doc, y, '3. Jadwal Finishing & Tautan Hasil Karya');
  y = drawKeyValueRows(doc, y, [
    { label: 'Tanggal Pengajuan', value: formatDateTimeID(project.createdAt) },
    { label: 'Tanggal Finishing', value: project.finishingDate ? formatDateLongID(project.finishingDate) : 'Belum ditetapkan Admin', highlightColor: [67, 56, 202] },
    { label: 'Tautan Master / Hasil Karya', value: project.masterFileUrl || 'Belum diunggah studio' },
    { label: 'Catatan Finishing Studio', value: project.finishingNotes || '-' },
    { label: 'Tautan Referensi Klien', value: project.videoLink || '-' },
  ]);

  // Section 4: Data Lengkap Parameter Karya
  y = drawSectionHeading(doc, y, '4. Data Lengkap Spesifikasi Karya');
  y = drawKeyValueRows(
    doc,
    y,
    project.specs.length > 0
      ? project.specs.map((s) => ({ label: s.key, value: s.val }))
      : [{ label: 'Spesifikasi', value: 'Tidak ada parameter tambahan.' }]
  );

  if (project.sinopsis) {
    y = drawSectionHeading(doc, y, '5. Sinopsis Karya');
    const lines = doc.splitTextToSize(project.sinopsis, pageW - margin * 2 - 4) as string[];
    for (const line of lines) {
      y = ensurePageSpace(doc, y, 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.4);
      doc.setTextColor(30, 41, 59);
      doc.text(line, margin + 2, y);
      y += 4.5;
    }
    y += 4;
  }

  if (project.paymentConfirmations.length > 0) {
    y = drawSectionHeading(doc, y, 'Riwayat Konfirmasi Pembayaran Klien');
    y = drawKeyValueRows(
      doc,
      y,
      project.paymentConfirmations.map((pc) => ({
        label: `${pc.stage === 'DP_50' ? 'DP 50%' : 'Pelunasan 50%'} (${pc.transferDate})`,
        value: `${formatRupiah(pc.amount)} · Pengirim: ${pc.senderName} via ${pc.bankMethod}${
          pc.referenceNote ? ` · "${pc.referenceNote}"` : ''
        }`,
      }))
    );
  }

  const stampLabel = fin.isFullyPaid ? 'LUNAS 100%' : fin.isDpVerified ? 'DP TERVERIFIKASI' : 'ARSIP STUDIO';
  const stampRgb: [number, number, number] = fin.isFullyPaid ? [5, 150, 105] : [67, 56, 202];
  drawAuthorizationFooter(doc, y + 4, stampLabel, formatDateShortID(project.updatedAt), stampRgb);

  doc.save(`data-pemesanan-${sanitizeFileSlug(project.judul)}-${project.id.toLowerCase()}.pdf`);
}

/**
 * 2. Download Official Studio Documents as PDF (Invoice DP, Invoice Pelunasan, Kuitansi DP, Kuitansi Pelunasan, SPK, Brief)
 * All official Invoices, Receipts, and Contracts include Studio Logo + Official Stamp + Owner Signature.
 */
export async function downloadStudioDocPdf(
  kind: StudioPdfDocKind,
  project: Project,
  settings?: StudioSettings
): Promise<void> {
  const access = getProjectPaymentAccess(project);
  if (kind === 'receipt_dp' && !access.canDownloadDpReceipt) {
    throw new Error('Kuitansi DP 50% hanya dapat diunduh setelah DP diverifikasi Admin.');
  }
  if (kind === 'receipt_final' && !access.canDownloadLunasDocument) {
    throw new Error('Kuitansi Pelunasan 100% hanya dapat diunduh setelah pelunasan diverifikasi Admin.');
  }

  const logoDataUrl = await loadBrandLogoDataUrl();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 16;

  const docLabelMap: Record<StudioPdfDocKind, string> = {
    brief: 'KARTU BRIEF PRODUKSI',
    contract: 'SURAT PERJANJIAN KERJA SAMA',
    invoice_dp: 'INVOICE DP 50%',
    invoice_final: 'INVOICE PELUNASAN 50%',
    receipt_dp: 'KUITANSI RESMI DP 50%',
    receipt_final: 'KUITANSI PELUNASAN 100%',
  };

  let y = drawPdfHeader(
    doc,
    docLabelMap[kind],
    project.id,
    formatDateLongID(project.createdAt),
    settings,
    logoDataUrl
  );

  const hasBankConfigured = Boolean(
    settings?.studioBankName?.trim() &&
      settings?.studioBankAccount?.trim() &&
      settings.studioBankAccount.trim() !== '1234-5678-9012'
  );

  if (kind === 'brief') {
    y = drawSectionHeading(doc, y, 'Identitas & Ringkasan Proyek');
    y = drawKeyValueRows(doc, y, [
      { label: 'Judul Karya', value: project.judul },
      { label: 'Layanan & Paket', value: `${project.serviceLineLabel} — ${project.packageName}` },
      { label: 'Durasi Karya', value: project.durasi },
      { label: 'Nama Pemesan / Sanggar', value: project.clientName },
      { label: 'Kontak & Email', value: `${project.clientWa} · ${project.contactEmail}` },
      { label: 'Status Produksi', value: project.productionStatus, highlightColor: [67, 56, 202] },
      { label: 'Tanggal Finishing', value: formatDateShortID(project.finishingDate) },
    ]);

    y = drawSectionHeading(doc, y, 'Spesifikasi & Parameter Teknis');
    y = drawKeyValueRows(
      doc,
      y,
      project.specs.map((s) => ({ label: s.key, value: s.val }))
    );

    if (project.sinopsis) {
      y = drawSectionHeading(doc, y, 'Sinopsis Karya');
      const lines = doc.splitTextToSize(project.sinopsis, pageW - margin * 2 - 4) as string[];
      for (const line of lines) {
        y = ensurePageSpace(doc, y, 6);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.4);
        doc.setTextColor(30, 41, 59);
        doc.text(line, margin + 2, y);
        y += 4.5;
      }
      y += 4;
    }

    drawAuthorizationFooter(doc, y + 4, 'BRIEF STUDIO', formatDateShortID(project.createdAt), [67, 56, 202]);
    doc.save(`brief-${project.id.toLowerCase()}.pdf`);
    return;
  }

  if (kind === 'contract') {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('SURAT PERJANJIAN KERJA SAMA PRODUKSI MUSIK', pageW / 2, y + 2, { align: 'center' });
    doc.setFont('courier', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Nomor: ${project.id}/SPK-PA/PRANGART`, pageW / 2, y + 7, { align: 'center' });
    y += 14;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.6);
    doc.setTextColor(30, 41, 59);
    const intro = doc.splitTextToSize(
      `Pada hari ini, ${formatDateLongID(project.createdAt)}, telah disepakati Perjanjian Kerja Sama Produksi Musik antara:`,
      pageW - margin * 2
    ) as string[];
    doc.text(intro, margin, y);
    y += intro.length * 4.5 + 3;

    y = drawKeyValueRows(doc, y, [
      {
        label: 'I. PIHAK PERTAMA (STUDIO)',
        value: `PrangArt Lab · Perwakilan: ${OWNER_FULL_NAME} · ${settings?.studioAddress || 'Samarinda, Kalimantan Timur'}`,
      },
      {
        label: 'II. PIHAK KEDUA (KLIEN)',
        value: `${project.clientName} · WhatsApp: ${project.clientWa} · Email: ${project.contactEmail}`,
      },
    ]);

    const articles = [
      {
        title: 'PASAL 1 — OBJEK & SPESIFIKASI PEKERJAAN',
        body: `Pihak Pertama memproduksi karya berjudul "${project.judul}" (${project.serviceLineLabel} — ${project.packageName}, durasi ${project.durasi}). Target / tanggal finishing mengikuti jadwal produksi studio (${
          project.finishingDate ? formatDateLongID(project.finishingDate) : 'sesuai konfirmasi produksi'
        }).`,
      },
      {
        title: 'PASAL 2 — BIAYA & PEMBAYARAN BERTAHAP',
        body: `Total biaya yang disepakati sebesar ${formatRupiah(project.totalPrice)}. Pembayaran dilakukan dalam 2 tahap: DP 50% (${formatRupiah(
          project.dpAmount
        )}) sebelum produksi dimulai, dan pelunasan 50% (${formatRupiah(
          project.remainingAmount
        )}) sebelum penyerahan Master File dan Kuitansi Pelunasan resmi.`,
      },
      {
        title: 'PASAL 3 — REVISI, KONFIRMASI & HAK KARYA',
        body: 'Hak revisi mengikuti paket yang dipilih dalam koridor konsep awal. Klien melakukan konfirmasi transfer melalui Ruang Klien untuk verifikasi Admin. Kredit karya dicantumkan sebagai "Music by PrangArt Lab" kecuali disepakati perjanjian Full Buyout.',
      },
    ];

    for (const art of articles) {
      y = ensurePageSpace(doc, y, 22);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.6);
      doc.setTextColor(15, 23, 42);
      doc.text(art.title, margin, y);
      y += 4.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.4);
      doc.setTextColor(51, 65, 85);
      const bodyLines = doc.splitTextToSize(art.body, pageW - margin * 2) as string[];
      doc.text(bodyLines, margin, y);
      y += bodyLines.length * 4.3 + 4;
    }

    drawAuthorizationFooter(doc, y + 4, 'DISAHKAN STUDIO', formatDateShortID(project.createdAt), [67, 56, 202], {
      name: project.clientName,
      statusText: project.contractAgreed ? 'Disetujui secara digital' : 'Menunggu persetujuan',
    });
    doc.save(`spk-kontrak-${project.id.toLowerCase()}.pdf`);
    return;
  }

  if (kind === 'invoice_dp' || kind === 'invoice_final') {
    const isDp = kind === 'invoice_dp';
    const stageAmount = isDp ? project.dpAmount : project.remainingAmount;
    const isAlreadySettled = isDp ? access.canDownloadDpReceipt : access.isFullyPaid;

    // Banner Invoice
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, y, pageW - margin * 2, 24, 2.5, 2.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(isDp ? 'INVOICE PEMBAYARAN DP 50%' : 'INVOICE PELUNASAN AKHIR 50%', margin + 4, y + 7.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.4);
    doc.setTextColor(71, 85, 105);
    doc.text(`Ditagihkan Kepada: ${project.clientName} (${project.clientWa})`, margin + 4, y + 13);
    doc.text(`Email: ${project.contactEmail}`, margin + 4, y + 18);

    doc.setFont('courier', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(100, 116, 139);
    doc.text(`Total Proyek: ${formatRupiah(project.totalPrice)}`, pageW - margin - 4, y + 8, { align: 'right' });
    doc.setFontSize(12);
    doc.setTextColor(67, 56, 202);
    doc.text(formatRupiah(stageAmount), pageW - margin - 4, y + 15.5, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(isDp ? 'TAGIHAN DP 50%' : 'SISA PELUNASAN 50%', pageW - margin - 4, y + 20.5, { align: 'right' });

    y += 30;

    y = drawSectionHeading(doc, y, 'Rincian Tagihan Proyek');
    y = drawKeyValueRows(doc, y, [
      { label: 'ID Proyek', value: project.id },
      { label: 'Judul Karya', value: project.judul },
      { label: 'Layanan & Paket', value: `${project.serviceLineLabel} · ${project.packageName}` },
      { label: 'Durasi', value: project.durasi },
      { label: 'Total Nilai Kontrak', value: formatRupiah(project.totalPrice) },
      ...(isDp
        ? []
        : [{ label: 'Pembayaran DP 50% (Tahap 1)', value: `${formatRupiah(project.dpAmount)} (${project.dpStatus})` }]),
      {
        label: isDp ? 'Nominal Tagihan DP 50%' : 'Nominal Pelunasan 50%',
        value: formatRupiah(stageAmount),
        highlightColor: [67, 56, 202],
      },
      {
        label: 'Status Saat Ini',
        value: isDp ? project.dpStatus : project.finalPaymentStatus,
        highlightColor: isAlreadySettled ? [5, 150, 105] : [180, 83, 9],
      },
    ]);

    y = drawSectionHeading(doc, y, 'Informasi Rekening Pembayaran Resmi');
    y = drawKeyValueRows(
      doc,
      y,
      hasBankConfigured
        ? [
            { label: 'Bank / Tujuan Transfer', value: settings?.studioBankName || '-' },
            { label: 'Nomor Rekening', value: settings?.studioBankAccount || '-' },
            { label: 'Atas Nama', value: settings?.studioBankHolder || OWNER_FULL_NAME },
            { label: 'Konfirmasi Studio', value: 'Kirim bukti transfer melalui menu Konfirmasi Pembayaran di Ruang Klien.' },
          ]
        : [
            {
              label: 'Instruksi Transfer',
              value: `Hubungi Admin Studio via email (${settings?.studioEmail || 'prangart.lab@gmail.com'}) atau WhatsApp resmi untuk nomor rekening tujuan.`,
            },
          ]
    );

    const stampLabel = isAlreadySettled
      ? isDp
        ? 'DP 50% LUNAS'
        : 'LUNAS 100%'
      : 'INVOICE RESMI';
    const stampRgb: [number, number, number] = isAlreadySettled ? [5, 150, 105] : [67, 56, 202];
    drawAuthorizationFooter(doc, y + 4, stampLabel, formatDateShortID(project.updatedAt), stampRgb);

    doc.save(`${isDp ? 'invoice-dp' : 'invoice-pelunasan'}-${project.id.toLowerCase()}.pdf`);
    return;
  }

  // Kuitansi DP 50% atau Kuitansi Pelunasan 100%
  const isFinalReceipt = kind === 'receipt_final';
  const paidAmount = isFinalReceipt ? project.totalPrice : project.dpAmount;
  const confMatch = project.paymentConfirmations.find((c) =>
    isFinalReceipt ? c.stage === 'PELUNASAN_50' : c.stage === 'DP_50'
  );

  doc.setFillColor(236, 253, 245); // emerald-50
  doc.setDrawColor(167, 243, 208); // emerald-200
  doc.roundedRect(margin, y, pageW - margin * 2, 22, 2.5, 2.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(6, 95, 70);
  doc.text(
    isFinalReceipt ? 'KUITANSI & BUKTI PELUNASAN RESMI (100%)' : 'KUITANSI RESMI PEMBAYARAN DP 50%',
    pageW / 2,
    y + 9,
    { align: 'center' }
  );
  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(5, 150, 105);
  doc.text(
    `No. Kuitansi: ${project.id}/${isFinalReceipt ? 'KW-LUNAS' : 'KW-DP'} · Status: ${
      isFinalReceipt ? 'LUNAS 100%' : 'DP 50% TERVERIFIKASI'
    }`,
    pageW / 2,
    y + 15.5,
    { align: 'center' }
  );
  y += 28;

  y = drawSectionHeading(doc, y, 'Rincian Penerimaan Pembayaran');
  y = drawKeyValueRows(doc, y, [
    { label: 'Telah Diterima Dari', value: `${project.clientName} (${project.contactEmail})` },
    {
      label: 'Untuk Pembayaran',
      value: `${isFinalReceipt ? 'Pelunasan 100%' : 'Uang Muka / DP 50%'} Proyek "${project.judul}" (${
        project.serviceLineLabel
      } · ${project.packageName})`,
    },
    { label: 'Nilai Total Kontrak', value: formatRupiah(project.totalPrice) },
    {
      label: isFinalReceipt ? 'Nominal Total Diterima (Lunas)' : 'Nominal DP 50% Diterima',
      value: formatRupiah(paidAmount),
      highlightColor: [5, 150, 105],
    },
    ...(isFinalReceipt
      ? [
          { label: 'Sisa Kewajiban', value: 'Rp0 (Lunas 100%)' },
          {
            label: 'Tanggal Finishing',
            value: project.finishingDate ? formatDateLongID(project.finishingDate) : formatDateShortID(project.updatedAt),
          },
        ]
      : [
          {
            label: 'Sisa Pelunasan 50% Nanti',
            value: formatRupiah(project.remainingAmount),
            highlightColor: [180, 83, 9] as [number, number, number],
          },
        ]),
    ...(confMatch
      ? [
          {
            label: 'Detail Transfer Klien',
            value: `${confMatch.bankMethod} · Pengirim: ${confMatch.senderName} · Tgl: ${confMatch.transferDate}`,
          },
        ]
      : []),
    { label: 'Tanggal Verifikasi Admin', value: formatDateLongID(project.updatedAt) },
  ]);

  drawAuthorizationFooter(
    doc,
    y + 6,
    isFinalReceipt ? 'LUNAS 100%' : 'LUNAS DP 50%',
    formatDateShortID(project.updatedAt),
    [5, 150, 105]
  );

  doc.save(`${isFinalReceipt ? 'kuitansi-lunas' : 'kuitansi-dp'}-${project.id.toLowerCase()}.pdf`);
}

/**
 * 3. Download Master Studio Recap PDF (Landscape Executive Ledger)
 * Recaps Consumer Data, Artwork Results, Finishing Dates, Complete Works Info, Finance & Available Documents.
 */
export async function downloadMasterRecapPdf(
  projects: Project[],
  clients: ClientUser[],
  settings?: StudioSettings,
  filterLabel = 'Semua Proyek'
): Promise<void> {
  const logoDataUrl = await loadBrandLogoDataUrl();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;

  // Header
  doc.setFillColor(67, 56, 202);
  doc.rect(0, 0, pageW, 3, 'F');
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', margin, 7.5, 16, 16);
  } else {
    drawPdfLogo(doc, margin, 9, 13);
  }

  const titleX = margin + 19;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('PrangArt Lab — Laporan Rekapitulasi Studio', titleX, 14.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Rekap Konsumen, Hasil Karya, Tanggal Finishing, Keuangan & Dokumen · Filter: ${filterLabel}`,
    titleX,
    19.5
  );
  doc.setFont('courier', 'normal');
  doc.text(`Dicetak: ${formatDateTimeID(new Date().toISOString())}`, pageW - margin, 14.5, { align: 'right' });

  // Financial Aggregates
  let totalContract = 0;
  let totalCollected = 0;
  let totalOutstanding = 0;
  let finishedCount = 0;
  for (const p of projects) {
    const fin = getProjectFinanceSummary(p);
    totalContract += fin.totalPrice;
    totalCollected += fin.verifiedPaidAmount;
    totalOutstanding += fin.outstandingAmount;
    if (fin.isFullyPaid || p.finishingDate) finishedCount += 1;
  }

  let y = 27;
  const cardW = (pageW - margin * 2 - 9) / 4;
  const kpis = [
    { label: 'Total Karya Direkap', val: `${projects.length} Proyek (${finishedCount} Selesai/Finishing)`, rgb: [15, 23, 42] as [number, number, number] },
    { label: 'Total Nilai Kontrak', val: formatRupiah(totalContract), rgb: [67, 56, 202] as [number, number, number] },
    { label: 'Dana Masuk Terverifikasi', val: formatRupiah(totalCollected), rgb: [5, 150, 105] as [number, number, number] },
    { label: 'Sisa Tagihan / Piutang', val: formatRupiah(totalOutstanding), rgb: [180, 83, 9] as [number, number, number] },
  ];

  kpis.forEach((k, idx) => {
    const kx = margin + idx * (cardW + 3);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(kx, y, cardW, 15, 2, 2, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(k.label, kx + 3, y + 5);
    doc.setFont('courier', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(k.rgb[0], k.rgb[1], k.rgb[2]);
    doc.text(k.val, kx + 3, y + 11.2);
  });

  y += 21;

  // Table Header: Projects & Finance
  const drawTableHeader = (ty: number) => {
    doc.setFillColor(15, 23, 42);
    doc.rect(margin, ty, pageW - margin * 2, 7.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(255, 255, 255);
    doc.text('ID / Tgl Pesan', margin + 2, ty + 5);
    doc.text('Konsumen & Kontak', margin + 35, ty + 5);
    doc.text('Judul Karya / Lini / Durasi', margin + 84, ty + 5);
    doc.text('Tgl Finishing', margin + 152, ty + 5);
    doc.text('Kontrak', margin + 180, ty + 5);
    doc.text('Terbayar', margin + 206, ty + 5);
    doc.text('Piutang', margin + 232, ty + 5);
    doc.text('Status & Master', margin + 254, ty + 5);
    return ty + 9.5;
  };

  y = drawTableHeader(y);

  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];
    const fin = getProjectFinanceSummary(p);
    if (y > doc.internal.pageSize.getHeight() - 24) {
      doc.addPage();
      y = drawTableHeader(14);
    }

    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y - 4, pageW - margin * 2, 11, 'F');
    }

    doc.setFont('courier', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(67, 56, 202);
    doc.text(p.id, margin + 2, y);
    doc.setTextColor(100, 116, 139);
    doc.text(formatDateShortID(p.createdAt), margin + 2, y + 4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42);
    doc.text(p.clientName.slice(0, 26), margin + 35, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(`${p.clientWa || '-'} · ${p.clientEmail.slice(0, 24)}`, margin + 35, y + 4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42);
    doc.text(p.judul.slice(0, 36), margin + 84, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(`${p.serviceLineLabel} · ${p.packageName} (${p.durasi})`, margin + 84, y + 4);

    doc.setFont('courier', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(51, 65, 85);
    doc.text(formatDateShortID(p.finishingDate), margin + 152, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.4);
    doc.text(p.productionStatus.slice(0, 18), margin + 152, y + 4);

    doc.setFont('courier', 'normal');
    doc.setFontSize(7.1);
    doc.setTextColor(15, 23, 42);
    doc.text(formatRupiah(fin.totalPrice), margin + 180, y);
    doc.setTextColor(5, 150, 105);
    doc.text(formatRupiah(fin.verifiedPaidAmount), margin + 206, y);
    doc.setTextColor(fin.outstandingAmount > 0 ? 180 : 100, fin.outstandingAmount > 0 ? 83 : 116, fin.outstandingAmount > 0 ? 9 : 139);
    doc.text(formatRupiah(fin.outstandingAmount), margin + 232, y);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(fin.isFullyPaid ? 5 : 67, fin.isFullyPaid ? 150 : 56, fin.isFullyPaid ? 105 : 202);
    doc.text(fin.isFullyPaid ? 'LUNAS 100%' : fin.isDpVerified ? 'DP VERIFIED' : 'MENUNGGU DP', margin + 254, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.4);
    doc.setTextColor(100, 116, 139);
    doc.text(p.masterFileUrl ? 'Master: Ada' : 'Master: Belum', margin + 254, y + 4);

    y += 11.5;
  }

  // Client Summary Section on new block/page if needed
  y += 6;
  if (y > doc.internal.pageSize.getHeight() - 55) {
    doc.addPage();
    y = 16;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(67, 56, 202);
  doc.text(`REKAP DATA KONSUMEN (${clients.length} AKUN TERDAFTAR)`, margin, y);
  y += 4;

  // Footer Stamp & Owner Signature
  drawAuthorizationFooter(doc, y + 2, 'REKAP RESMI', formatDateShortID(new Date().toISOString()), [67, 56, 202]);

  doc.save(`rekap-studio-prangart-${new Date().toISOString().slice(0, 10)}.pdf`);
}
