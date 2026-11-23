import { GoogleGenAI } from '@google/genai';
import crypto from 'crypto';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import http from 'http';
import path from 'path';
import { WebSocket, WebSocketServer } from 'ws';
import { DEFAULT_SERVICE_CATALOG, DEFAULT_SITE_CONTENT, TRACKER_MILESTONES } from './server/catalog.ts';
import {
  hashPassword,
  signSessionToken,
  store,
  verifyPassword,
  verifySessionToken,
  type SessionPayload,
} from './server/store.ts';
import type {
  PaymentConfirmation,
  PortfolioItem,
  Project,
  ProjectNote,
  ServiceLineKey,
  StudioNotification,
  TestimonialItem,
} from './src/types.ts';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

// Admin brute-force lock state (in-memory + reset on valid login)
let adminFailedAttempts = 0;
let adminLockedUntil = 0;
const MAX_ADMIN_FAILS = 5;
const ADMIN_LOCK_MS = 5 * 60 * 1000;

interface AuthedRequest extends Request {
  session?: SessionPayload;
}

function getBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7).trim();
}

function requireClient(req: AuthedRequest, res: Response, next: NextFunction): void {
  const session = verifySessionToken(getBearerToken(req));
  if (!session || session.role !== 'client' || !session.email) {
    res.status(401).json({ error: 'Silakan masuk sebagai klien terlebih dahulu.' });
    return;
  }
  req.session = session;
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  const session = verifySessionToken(getBearerToken(req));
  if (!session || session.role !== 'admin') {
    res.status(401).json({ error: 'Sesi admin tidak valid atau telah berakhir.' });
    return;
  }
  req.session = session;
  next();
}

function isSafeHttpUrl(val?: string): boolean {
  if (!val) return true;
  const trimmed = val.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith('/src/assets/')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function timingSafeTextEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Track connected WebSocket clients
interface TrackedSocket {
  ws: WebSocket;
  role: 'public' | 'client' | 'admin';
  email?: string;
}

const sockets = new Set<TrackedSocket>();

function broadcastToAdmins(event: Record<string, unknown>): void {
  const msg = JSON.stringify(event);
  for (const client of sockets) {
    if (client.role === 'admin' && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(msg);
    }
  }
}

function broadcastToClient(email: string, event: Record<string, unknown>): void {
  const normalized = email.trim().toLowerCase();
  const msg = JSON.stringify(event);
  for (const client of sockets) {
    if (
      client.role === 'client' &&
      client.email === normalized &&
      client.ws.readyState === WebSocket.OPEN
    ) {
      client.ws.send(msg);
    }
  }
}

function broadcastAll(event: Record<string, unknown>): void {
  const msg = JSON.stringify(event);
  for (const client of sockets) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(msg);
    }
  }
}

function createNotification(input: Omit<StudioNotification, 'id' | 'read' | 'createdAt'>): StudioNotification {
  const notif: StudioNotification = {
    ...input,
    id: `notif-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    read: false,
    createdAt: new Date().toISOString(),
  };
  store.state.notifications.unshift(notif);
  // Keep latest 200 notifications
  if (store.state.notifications.length > 200) {
    store.state.notifications = store.state.notifications.slice(0, 200);
  }
  store.save();

  if (notif.recipientRole === 'admin') {
    broadcastToAdmins({ type: 'notification:new', notification: notif });
  } else if (notif.recipientRole === 'client' && notif.recipientEmail) {
    broadcastToClient(notif.recipientEmail, { type: 'notification:new', notification: notif });
  }
  return notif;
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // ================= PUBLIC ROUTES =================
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  app.get('/api/bootstrap', (_req, res) => {
    res.json({
      catalog: store.state.catalog,
      siteContent: store.state.siteContent,
      milestones: TRACKER_MILESTONES,
    });
  });

  // ================= CLIENT AUTH ROUTES =================
  app.post('/api/auth/register', (req, res) => {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const wa = String(req.body?.wa || '').trim();
    const password = String(req.body?.password || '');

    if (!name || !email || !wa || password.length < 4) {
      res.status(400).json({ error: 'Nama, email, nomor WhatsApp, dan kata sandi (min. 4 karakter) wajib diisi.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Format email tidak valid.' });
      return;
    }

    const exists = store.state.users.some((u) => u.email === email);
    if (exists) {
      res.status(409).json({ error: 'Email sudah terdaftar. Silakan langsung masuk.' });
      return;
    }

    const { salt, hash } = hashPassword(password);
    const now = new Date().toISOString();
    const newUser = {
      id: `usr-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      name,
      email,
      wa,
      passwordSalt: salt,
      passwordHash: hash,
      createdAt: now,
      updatedAt: now,
    };

    store.state.users.push(newUser);
    store.save();

    const pubUser = store.toPublicUser(newUser);
    const token = signSessionToken({ role: 'client', userId: newUser.id, email: newUser.email, name: newUser.name });

    createNotification({
      recipientRole: 'admin',
      type: 'CLIENT_REGISTERED',
      title: 'Klien Baru Mendaftar',
      message: `${name} (${email} · WA: ${wa}) baru saja mendaftarkan akun di Ruang Klien.`,
      actorName: name,
      actorEmail: email,
    });
    broadcastToAdmins({ type: 'client:updated', user: pubUser });

    res.status(201).json({ token, user: pubUser });
  });

  app.post('/api/auth/login', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      res.status(400).json({ error: 'Email dan kata sandi wajib diisi.' });
      return;
    }

    const user = store.state.users.find((u) => u.email === email);
    if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      res.status(401).json({ error: 'Email atau kata sandi salah.' });
      return;
    }

    const pubUser = store.toPublicUser(user);
    const token = signSessionToken({ role: 'client', userId: user.id, email: user.email, name: user.name });
    res.json({ token, user: pubUser });
  });

  app.get('/api/auth/me', requireClient, (req: AuthedRequest, res) => {
    const email = req.session!.email!;
    const user = store.state.users.find((u) => u.email === email);
    if (!user) {
      res.status(404).json({ error: 'Akun tidak ditemukan.' });
      return;
    }
    res.json({ user: store.toPublicUser(user) });
  });

  app.put('/api/auth/profile', requireClient, (req: AuthedRequest, res) => {
    const email = req.session!.email!;
    const name = String(req.body?.name || '').trim();
    const wa = String(req.body?.wa || '').trim();

    if (!name) {
      res.status(400).json({ error: 'Nama lengkap wajib diisi.' });
      return;
    }

    const user = store.state.users.find((u) => u.email === email);
    if (!user) {
      res.status(404).json({ error: 'Akun tidak ditemukan.' });
      return;
    }

    user.name = name;
    user.wa = wa;
    user.updatedAt = new Date().toISOString();

    // Update contact WA on existing projects belonging to this client so Admin always sees latest contact
    const updatedProjects: Project[] = [];
    for (const p of store.state.projects) {
      if (p.clientEmail === email) {
        p.clientWa = wa || p.clientWa;
        p.updatedAt = user.updatedAt;
        updatedProjects.push(p);
      }
    }

    store.save();
    const pubUser = store.toPublicUser(user);

    for (const p of updatedProjects) {
      broadcastToAdmins({ type: 'project:updated', project: p });
      broadcastToClient(email, { type: 'project:updated', project: p });
    }

    createNotification({
      recipientRole: 'admin',
      type: 'CLIENT_PROFILE_UPDATED',
      title: 'Pembaruan Profil Klien',
      message: `${name} (${email}) memperbarui kontak profil (WA: ${wa || '-'}).`,
      actorName: name,
      actorEmail: email,
    });
    broadcastToAdmins({ type: 'client:updated', user: pubUser });

    res.json({ user: pubUser });
  });

  app.put('/api/auth/password', requireClient, (req: AuthedRequest, res) => {
    const email = req.session!.email!;
    const oldPassword = String(req.body?.oldPassword || '');
    const newPassword = String(req.body?.newPassword || '');

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'Kata sandi baru minimal 6 karakter.' });
      return;
    }
    if (newPassword === oldPassword) {
      res.status(400).json({ error: 'Gunakan kata sandi yang berbeda dari sebelumnya.' });
      return;
    }

    const user = store.state.users.find((u) => u.email === email);
    if (!user || !verifyPassword(oldPassword, user.passwordSalt, user.passwordHash)) {
      res.status(401).json({ error: 'Kata sandi lama tidak sesuai.' });
      return;
    }

    const { salt, hash } = hashPassword(newPassword);
    user.passwordSalt = salt;
    user.passwordHash = hash;
    user.updatedAt = new Date().toISOString();
    store.save();

    res.json({ ok: true });
  });

  // ================= CLIENT ORDERS & INTERACTIONS =================
  app.get('/api/client/projects', requireClient, (req: AuthedRequest, res) => {
    const email = req.session!.email!;
    const projects = store.state.projects.filter(
      (p) => p.clientEmail.toLowerCase() === email || p.contactEmail.toLowerCase() === email
    );
    const notifications = store.state.notifications.filter(
      (n) => n.recipientRole === 'client' && n.recipientEmail?.toLowerCase() === email
    );
    res.json({ projects, notifications });
  });

  app.post('/api/client/notifications/:id/read', requireClient, (req: AuthedRequest, res) => {
    const email = req.session!.email!;
    const notif = store.state.notifications.find(
      (n) => n.id === req.params.id && n.recipientRole === 'client' && n.recipientEmail?.toLowerCase() === email
    );
    if (notif) {
      notif.read = true;
      store.save();
    }
    res.json({ ok: true });
  });

  app.post('/api/client/notifications/read-all', requireClient, (req: AuthedRequest, res) => {
    const email = req.session!.email!;
    for (const n of store.state.notifications) {
      if (n.recipientRole === 'client' && n.recipientEmail?.toLowerCase() === email) {
        n.read = true;
      }
    }
    store.save();
    res.json({ ok: true });
  });

  app.post('/api/orders', requireClient, (req: AuthedRequest, res) => {
    const email = req.session!.email!;
    const body = req.body || {};

    const serviceLine = String(body.serviceLine || '') as ServiceLineKey;
    if (!['tari', 'digital', 'transkripsi'].includes(serviceLine)) {
      res.status(400).json({ error: 'Jenis layanan tidak valid.' });
      return;
    }

    const judul = String(body.judul || '').trim();
    const durasi = String(body.durasi || '').trim();
    const clientName = String(body.clientName || req.session!.name).trim();
    const clientWa = String(body.clientWa || '').trim();
    const contactEmail = String(body.contactEmail || email).trim().toLowerCase();
    const packageKey = String(body.packageKey || 'dasar').trim();
    const packageName = String(body.packageName || 'Paket Dasar').trim();
    const videoLink = String(body.videoLink || '').trim();
    const totalPrice = Math.max(0, Math.round(Number(body.totalPrice || 0)));
    const addonAmount = Math.max(0, Math.round(Number(body.addonAmount || 0)));

    if (!judul || !durasi || !clientName || !clientWa) {
      res.status(400).json({ error: 'Judul karya, durasi, nama pemesan, dan WhatsApp wajib diisi.' });
      return;
    }
    if (!isSafeHttpUrl(videoLink)) {
      res.status(400).json({ error: 'Tautan referensi harus menggunakan http:// atau https://.' });
      return;
    }
    if (totalPrice <= 0) {
      res.status(400).json({ error: 'Total biaya pesanan harus lebih dari Rp0.' });
      return;
    }

    const svc = store.state.catalog[serviceLine];
    const now = new Date().toISOString();
    const dpAmount = Math.round(totalPrice / 2);

    const newProject: Project = {
      id: `PAL-${Date.now()}`,
      clientId: req.session!.userId,
      clientEmail: email,
      clientName,
      contactEmail,
      clientWa,
      judul,
      durasi,
      serviceLine,
      serviceLineLabel: svc.label,
      packageKey,
      packageName,
      contractAgreed: Boolean(body.contractAgreed),
      contractAgreedAt: body.contractAgreed ? now : undefined,
      hasVocalAddon: Boolean(body.hasVocalAddon),
      addonAmount,
      sorakOption: body.sorakOption ? String(body.sorakOption) : null,
      totalPrice,
      dpAmount,
      remainingAmount: totalPrice - dpAmount,
      paymentStage: 'MENUNGGU_DP',
      dpStatus: 'Menunggu Pembayaran DP 50%',
      finalPaymentStatus: 'Belum Lunas',
      canDownloadReceipt: false,
      canDownloadMaster: false,
      productionStatus: TRACKER_MILESTONES[0],
      specs: Array.isArray(body.specs)
        ? body.specs.map((s: { key?: unknown; val?: unknown }) => ({
            key: String(s?.key || ''),
            val: String(s?.val || ''),
          }))
        : [],
      videoLink,
      sinopsis: serviceLine === 'tari' ? String(body.sinopsis || '').trim() : '',
      paymentConfirmations: [],
      notes: [],
      createdAt: now,
      updatedAt: now,
    };

    store.state.projects.unshift(newProject);
    store.save();

    broadcastToAdmins({ type: 'project:created', project: newProject });
    broadcastToClient(email, { type: 'project:created', project: newProject });

    createNotification({
      recipientRole: 'admin',
      type: 'ORDER_CREATED',
      title: `Pengajuan Baru: ${judul}`,
      message: `${clientName} mengajukan ${svc.label} (${packageName}) senilai Rp${totalPrice.toLocaleString('id-ID')}.`,
      projectId: newProject.id,
      actorName: clientName,
      actorEmail: email,
    });

    res.status(201).json({ project: newProject });
  });

  app.post('/api/orders/:id/confirm-payment', requireClient, (req: AuthedRequest, res) => {
    const email = req.session!.email!;
    const project = store.state.projects.find((p) => p.id === req.params.id);
    if (!project || project.clientEmail.toLowerCase() !== email) {
      res.status(404).json({ error: 'Proyek tidak ditemukan.' });
      return;
    }

    const stage = req.body?.stage === 'PELUNASAN_50' ? 'PELUNASAN_50' : 'DP_50';
    const senderName = String(req.body?.senderName || '').trim();
    const bankMethod = String(req.body?.bankMethod || '').trim();
    const transferDate = String(req.body?.transferDate || '').trim();
    const referenceNote = String(req.body?.referenceNote || '').trim();
    const proofUrl = String(req.body?.proofUrl || '').trim();
    const amount = Math.round(Number(req.body?.amount || (stage === 'DP_50' ? project.dpAmount : project.remainingAmount)));

    if (!senderName || !bankMethod || !transferDate || amount <= 0) {
      res.status(400).json({ error: 'Nama pengirim, bank/metode, tanggal transfer, dan nominal wajib diisi.' });
      return;
    }
    if (!isSafeHttpUrl(proofUrl)) {
      res.status(400).json({ error: 'Tautan bukti transfer harus diawali http:// atau https://.' });
      return;
    }

    const confirmation: PaymentConfirmation = {
      id: `pay-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      stage,
      amount,
      senderName,
      bankMethod,
      transferDate,
      referenceNote,
      proofUrl: proofUrl || undefined,
      submittedAt: new Date().toISOString(),
    };

    project.paymentConfirmations.unshift(confirmation);
    if (stage === 'DP_50') {
      project.paymentStage = 'DP_KONFIRMASI_KLIEN';
      project.dpStatus = 'Konfirmasi DP Dikirim Klien (Menunggu Verifikasi Admin)';
    } else {
      project.paymentStage = 'PELUNASAN_KONFIRMASI_KLIEN';
      project.finalPaymentStatus = 'Konfirmasi Pelunasan Dikirim Klien (Menunggu Verifikasi Admin)';
    }
    project.updatedAt = new Date().toISOString();
    store.save();

    broadcastToAdmins({ type: 'project:updated', project });
    broadcastToClient(email, { type: 'project:updated', project });

    createNotification({
      recipientRole: 'admin',
      type: stage === 'DP_50' ? 'DP_CONFIRMED' : 'FINAL_CONFIRMED',
      title: stage === 'DP_50' ? `Konfirmasi DP 50%: ${project.judul}` : `Konfirmasi Pelunasan: ${project.judul}`,
      message: `${senderName} mengirim konfirmasi ${stage === 'DP_50' ? 'DP 50%' : 'Pelunasan'} sebesar Rp${amount.toLocaleString('id-ID')} via ${bankMethod}.`,
      projectId: project.id,
      actorName: project.clientName,
      actorEmail: email,
    });

    res.json({ project });
  });

  app.post('/api/orders/:id/notes', requireClient, (req: AuthedRequest, res) => {
    const email = req.session!.email!;
    const project = store.state.projects.find((p) => p.id === req.params.id);
    if (!project || project.clientEmail.toLowerCase() !== email) {
      res.status(404).json({ error: 'Proyek tidak ditemukan.' });
      return;
    }

    const message = String(req.body?.message || '').trim();
    if (!message) {
      res.status(400).json({ error: 'Isi catatan atau pesan tidak boleh kosong.' });
      return;
    }

    const note: ProjectNote = {
      id: `note-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      authorRole: 'client',
      authorName: req.session!.name || project.clientName,
      message,
      createdAt: new Date().toISOString(),
    };

    project.notes.push(note);
    project.updatedAt = note.createdAt;
    store.save();

    broadcastToAdmins({ type: 'project:updated', project });
    broadcastToClient(email, { type: 'project:updated', project });

    createNotification({
      recipientRole: 'admin',
      type: 'REVISION_NOTE',
      title: `Pesan / Revisi Klien: ${project.judul}`,
      message: `${note.authorName}: "${message.slice(0, 140)}${message.length > 140 ? '…' : ''}"`,
      projectId: project.id,
      actorName: note.authorName,
      actorEmail: email,
    });

    res.status(201).json({ project, note });
  });

  // ================= SERVER-SIDE GEMINI AI SYNOPSIS =================
  app.get('/api/ai/quota', requireClient, (req: AuthedRequest, res) => {
    const email = req.session!.email!;
    const today = new Date().toISOString().slice(0, 10);
    const rec = store.state.aiQuota[email];
    const active = rec && rec.date === today ? rec : { date: today, count: 0, lastTimestamp: 0 };
    res.json({
      limit: 2,
      cooldownMs: 2 * 60 * 1000,
      used: active.count,
      remaining: Math.max(0, 2 - active.count),
      lastTimestamp: active.lastTimestamp,
    });
  });

  app.post('/api/ai/synopsis', requireClient, async (req: AuthedRequest, res) => {
    const email = req.session!.email!;
    const today = new Date().toISOString().slice(0, 10);
    const rec = store.state.aiQuota[email];
    const quota = rec && rec.date === today ? rec : { date: today, count: 0, lastTimestamp: 0 };
    const AI_DAILY_LIMIT = 2;
    const AI_COOLDOWN_MS = 2 * 60 * 1000;

    if (quota.count >= AI_DAILY_LIMIT) {
      res.status(429).json({ error: 'Batas generate AI (2x per hari) sudah tercapai untuk hari ini.' });
      return;
    }
    const elapsed = Date.now() - quota.lastTimestamp;
    if (quota.lastTimestamp > 0 && elapsed < AI_COOLDOWN_MS) {
      const waitSec = Math.ceil((AI_COOLDOWN_MS - elapsed) / 1000);
      res.status(429).json({ error: `Jeda aktif — harap tunggu ${waitSec} detik sebelum generate berikutnya.` });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.status(503).json({
        error: 'GEMINI_API_KEY belum dikonfigurasi pada panel Secrets AI Studio.',
      });
      return;
    }

    const b = req.body || {};
    const judul = String(b.judul || '').trim();
    if (!judul) {
      res.status(400).json({ error: 'Judul karya tari wajib diisi terlebih dahulu.' });
      return;
    }

    const val = (k: string) => String(b[k] || '').trim() || '(Belum tersedia / dikosongkan)';
    const prompt = `Susun sinopsis karya tari profesional, puitis namun komunikatif dan siap dicantumkan dalam naskah produksi/program pertunjukan, tanpa kalimat pengantar atau penutup meta.
Gunakan Bahasa Indonesia baku yang hidup (2-3 paragraf ringkas namun padat makna).

Data Karya Tari:
1. Judul Karya: ${judul}
2. Koreografer: ${val('koreografer')}
3. Asal / Latar Budaya Daerah: ${val('asal')}
4. Jenis Tari: ${val('jenis')}
5. Tema Karya: ${val('tema')}
6. Latar Belakang Penciptaan: ${val('latar')}
7. Sumber Inspirasi: ${val('inspirasi')}
8. Gagasan Utama: ${val('gagasan')}
9. Gambaran / Substansi Tarian: ${val('gambaran')}
10. Perkembangan Penyajian (Awal - Tengah - Akhir): ${val('perkembangan')}
11. Karakter Gerakan: ${val('karakter')}
12. Sumber Gerak Tari: ${val('sumberGerak')}
13. Gambaran Musik Pengiring: ${val('musik')}
14. Alat Musik / Instrumen: ${val('instrumen')}
15. Kostum & Tata Rias: ${val('kostum')}
16. Makna & Filosofi: ${val('makna')}
17. Pesan untuk Penonton: ${val('pesan')}`;

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'Anda adalah dramaturg dan penulis seni pertunjukan tari profesional di Indonesia. Hasilkan hanya teks sinopsis akhir dalam Bahasa Indonesia.',
        },
      });

      const text = (response.text || '').trim();
      if (!text) {
        res.status(502).json({ error: 'Model AI tidak mengembalikan teks sinopsis.' });
        return;
      }

      const nextQuota = {
        date: today,
        count: quota.count + 1,
        lastTimestamp: Date.now(),
      };
      store.state.aiQuota[email] = nextQuota;
      store.save();

      res.json({
        synopsis: text,
        quota: {
          limit: AI_DAILY_LIMIT,
          cooldownMs: AI_COOLDOWN_MS,
          used: nextQuota.count,
          remaining: Math.max(0, AI_DAILY_LIMIT - nextQuota.count),
          lastTimestamp: nextQuota.lastTimestamp,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal menghubungi layanan Gemini AI.';
      console.error('Gemini API synopsis error:', err);
      res.status(502).json({ error: `Gagal menghasilkan sinopsis AI: ${message}` });
    }
  });

  // ================= ADMIN AUTH & DASHBOARD ROUTES =================
  app.get('/api/admin/status', (_req, res) => {
    const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
    const configured = Boolean(envPasscode || store.state.adminCredential);
    res.json({
      configured,
      viaEnv: Boolean(envPasscode),
    });
  });

  // First-run setup (only when no env passcode and no claimed credential exist)
  app.post('/api/admin/setup', (req, res) => {
    const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
    if (envPasscode || store.state.adminCredential) {
      res.status(409).json({ error: 'PIN Admin sudah dikonfigurasi. Silakan masuk dengan PIN Anda.' });
      return;
    }

    const passcode = String(req.body?.passcode || '').trim();
    if (passcode.length < 4) {
      res.status(400).json({ error: 'PIN / Kata Sandi Admin minimal 4 karakter.' });
      return;
    }

    store.state.adminCredential = hashPassword(passcode);
    store.save();

    const token = signSessionToken({ role: 'admin', name: 'Admin PrangArt Lab' }, 8 * 60 * 60 * 1000);
    res.status(201).json({ token });
  });

  app.post('/api/admin/login', (req, res) => {
    const now = Date.now();
    if (adminLockedUntil > now) {
      const waitMin = Math.ceil((adminLockedUntil - now) / 60000);
      res.status(429).json({ error: `Terlalu banyak percobaan salah. Coba lagi dalam ${waitMin} menit.` });
      return;
    }

    const passcode = String(req.body?.passcode || '').trim();
    const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();

    let valid = false;
    if (envPasscode) {
      valid = timingSafeTextEqual(passcode, envPasscode);
    } else if (store.state.adminCredential) {
      valid = verifyPassword(
        passcode,
        store.state.adminCredential.salt,
        store.state.adminCredential.hash
      );
    } else {
      res.status(400).json({ error: 'PIN Admin belum dibuat. Silakan selesaikan pengaturan awal.' });
      return;
    }

    if (!valid) {
      adminFailedAttempts += 1;
      if (adminFailedAttempts >= MAX_ADMIN_FAILS) {
        adminFailedAttempts = 0;
        adminLockedUntil = now + ADMIN_LOCK_MS;
        res.status(429).json({ error: 'Terlalu banyak PIN salah. Akses dikunci selama 5 menit.' });
        return;
      }
      res.status(401).json({ error: 'PIN / Kata Sandi Admin salah.' });
      return;
    }

    adminFailedAttempts = 0;
    adminLockedUntil = 0;
    const token = signSessionToken({ role: 'admin', name: 'Admin PrangArt Lab' }, 8 * 60 * 60 * 1000);
    res.json({ token });
  });

  app.post('/api/admin/change-passcode', requireAdmin, (req, res) => {
    const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
    if (envPasscode) {
      res.status(400).json({ error: 'PIN Admin diatur melalui variabel environment ADMIN_PASSCODE.' });
      return;
    }
    const newPasscode = String(req.body?.newPasscode || '').trim();
    if (newPasscode.length < 4) {
      res.status(400).json({ error: 'PIN baru minimal 4 karakter.' });
      return;
    }
    store.state.adminCredential = hashPassword(newPasscode);
    store.save();
    res.json({ ok: true });
  });

  app.get('/api/admin/dashboard', requireAdmin, (_req, res) => {
    const adminNotifs = store.state.notifications.filter((n) => n.recipientRole === 'admin');
    res.json({
      projects: store.state.projects,
      notifications: adminNotifs,
      users: store.state.users.map((u) => store.toPublicUser(u)),
      catalog: store.state.catalog,
      siteContent: store.state.siteContent,
    });
  });

  app.post('/api/admin/notifications/:id/read', requireAdmin, (req, res) => {
    const notif = store.state.notifications.find(
      (n) => n.id === req.params.id && n.recipientRole === 'admin'
    );
    if (notif) {
      notif.read = true;
      store.save();
      broadcastToAdmins({ type: 'notification:read', id: notif.id });
    }
    res.json({ ok: true });
  });

  app.post('/api/admin/notifications/read-all', requireAdmin, (_req, res) => {
    for (const n of store.state.notifications) {
      if (n.recipientRole === 'admin') {
        n.read = true;
      }
    }
    store.save();
    broadcastToAdmins({ type: 'notification:read_all' });
    res.json({ ok: true });
  });

  app.patch('/api/admin/projects/:id', requireAdmin, (req, res) => {
    const project = store.state.projects.find((p) => p.id === req.params.id);
    if (!project) {
      res.status(404).json({ error: 'Proyek tidak ditemukan.' });
      return;
    }

    const body = req.body || {};
    const now = new Date().toISOString();
    let clientNotifTitle = '';
    let clientNotifMsg = '';
    let clientNotifType: StudioNotification['type'] = 'STATUS_UPDATED';

    if (body.action === 'VERIFY_DP') {
      project.paymentStage = 'DP_TERVERIFIKASI';
      project.dpStatus = 'DP 50% Terverifikasi';
      if (project.productionStatus === TRACKER_MILESTONES[0] || project.productionStatus === TRACKER_MILESTONES[1]) {
        project.productionStatus = TRACKER_MILESTONES[2];
      }
      clientNotifType = 'PAYMENT_VERIFIED';
      clientNotifTitle = `DP 50% Diverifikasi: ${project.judul}`;
      clientNotifMsg = 'Pembayaran DP 50% Anda telah diverifikasi Admin. Produksi resmi dimulai.';
    } else if (body.action === 'VERIFY_LUNAS') {
      project.paymentStage = 'LUNAS';
      project.dpStatus = 'Lunas 100%';
      project.finalPaymentStatus = 'Lunas';
      project.productionStatus = TRACKER_MILESTONES[6];
      project.canDownloadReceipt = true;
      project.canDownloadMaster = true;
      clientNotifType = 'PAYMENT_VERIFIED';
      clientNotifTitle = `Pelunasan 100% Terverifikasi: ${project.judul}`;
      clientNotifMsg = 'Bukti Lunas / Kuitansi Resmi dan akses Master File sekarang sudah terbuka di Ruang Klien.';
    } else {
      if (typeof body.productionStatus === 'string' && TRACKER_MILESTONES.includes(body.productionStatus)) {
        project.productionStatus = body.productionStatus;
        clientNotifType = 'STATUS_UPDATED';
        clientNotifTitle = `Progres Diperbarui: ${project.judul}`;
        clientNotifMsg = `Status produksi kini pada tahap "${body.productionStatus}".`;
      }
      if (typeof body.masterFileUrl === 'string') {
        const cleanUrl = body.masterFileUrl.trim();
        if (!isSafeHttpUrl(cleanUrl)) {
          res.status(400).json({ error: 'Tautan Master File harus diawali http:// atau https://.' });
          return;
        }
        project.masterFileUrl = cleanUrl;
        if (cleanUrl) {
          clientNotifType = 'MASTER_UPLOADED';
          clientNotifTitle = `Master File Disiapkan: ${project.judul}`;
          clientNotifMsg = project.canDownloadMaster
            ? 'Tautan Master File telah tersedia dan siap diunduh di Ruang Klien.'
            : 'Tautan Master File telah disiapkan Admin (terbuka otomatis setelah pelunasan 100%).';
        }
      }
    }

    if (typeof body.adminReply === 'string' && body.adminReply.trim()) {
      const replyNote: ProjectNote = {
        id: `note-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        authorRole: 'admin',
        authorName: 'Admin PrangArt Lab',
        message: body.adminReply.trim(),
        createdAt: now,
      };
      project.notes.push(replyNote);
      clientNotifType = 'ADMIN_REPLY';
      clientNotifTitle = `Balasan Studio: ${project.judul}`;
      clientNotifMsg = `Admin: "${replyNote.message.slice(0, 140)}${replyNote.message.length > 140 ? '…' : ''}"`;
    }

    project.updatedAt = now;
    store.save();

    broadcastToAdmins({ type: 'project:updated', project });
    broadcastToClient(project.clientEmail, { type: 'project:updated', project });

    if (clientNotifTitle) {
      createNotification({
        recipientRole: 'client',
        recipientEmail: project.clientEmail,
        type: clientNotifType,
        title: clientNotifTitle,
        message: clientNotifMsg,
        projectId: project.id,
        actorName: 'Admin PrangArt Lab',
      });
    }

    res.json({ project });
  });

  app.delete('/api/admin/projects/:id', requireAdmin, (req, res) => {
    const idx = store.state.projects.findIndex((p) => p.id === req.params.id);
    if (idx < 0) {
      res.status(404).json({ error: 'Proyek tidak ditemukan.' });
      return;
    }
    const [removed] = store.state.projects.splice(idx, 1);
    store.save();
    broadcastToAdmins({ type: 'project:deleted', id: removed.id });
    broadcastToClient(removed.clientEmail, { type: 'project:deleted', id: removed.id });
    res.json({ ok: true });
  });

  app.put('/api/admin/catalog', requireAdmin, (req, res) => {
    if (!req.body?.catalog) {
      res.status(400).json({ error: 'Data katalog tidak valid.' });
      return;
    }
    store.state.catalog = req.body.catalog;
    store.save();
    broadcastAll({ type: 'catalog:updated', catalog: store.state.catalog });
    res.json({ catalog: store.state.catalog });
  });

  app.post('/api/admin/catalog/reset', requireAdmin, (_req, res) => {
    store.state.catalog = JSON.parse(JSON.stringify(DEFAULT_SERVICE_CATALOG));
    store.save();
    broadcastAll({ type: 'catalog:updated', catalog: store.state.catalog });
    res.json({ catalog: store.state.catalog });
  });

  app.put('/api/admin/site-content', requireAdmin, (req, res) => {
    const body = req.body || {};
    if (Array.isArray(body.portfolio)) {
      for (const item of body.portfolio as PortfolioItem[]) {
        if (item.image && !isSafeHttpUrl(item.image)) {
          res.status(400).json({ error: 'URL gambar portofolio harus menggunakan http:// atau https://.' });
          return;
        }
      }
      store.state.siteContent.portfolio = body.portfolio;
    }
    if (Array.isArray(body.testimonials)) {
      store.state.siteContent.testimonials = body.testimonials as TestimonialItem[];
    }
    if (body.settings && typeof body.settings === 'object') {
      store.state.siteContent.settings = {
        ...store.state.siteContent.settings,
        ...body.settings,
      };
    }
    store.save();
    broadcastAll({ type: 'siteContent:updated', siteContent: store.state.siteContent });
    res.json({ siteContent: store.state.siteContent });
  });

  app.post('/api/admin/site-content/reset', requireAdmin, (_req, res) => {
    store.state.siteContent = JSON.parse(JSON.stringify(DEFAULT_SITE_CONTENT));
    store.save();
    broadcastAll({ type: 'siteContent:updated', siteContent: store.state.siteContent });
    res.json({ siteContent: store.state.siteContent });
  });

  // ================= VITE / STATIC FRONTEND =================
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  // ================= HTTP + WEBSOCKET SERVER =================
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    const tracked: TrackedSocket = { ws, role: 'public' };
    sockets.add(tracked);

    ws.send(JSON.stringify({ type: 'ws:connected', timestamp: Date.now() }));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as { type?: string; token?: string };
        if (msg.type === 'auth' && msg.token) {
          const session = verifySessionToken(msg.token);
          if (session?.role === 'admin') {
            tracked.role = 'admin';
            tracked.email = undefined;
            ws.send(JSON.stringify({ type: 'ws:authenticated', role: 'admin' }));
          } else if (session?.role === 'client' && session.email) {
            tracked.role = 'client';
            tracked.email = session.email.toLowerCase();
            ws.send(JSON.stringify({ type: 'ws:authenticated', role: 'client', email: tracked.email }));
          }
        } else if (msg.type === 'logout') {
          tracked.role = 'public';
          tracked.email = undefined;
        }
      } catch {
        // Ignore malformed socket frames
      }
    });

    ws.on('close', () => {
      sockets.delete(tracked);
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`PrangArt Lab server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
