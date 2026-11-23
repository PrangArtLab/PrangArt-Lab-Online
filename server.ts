import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import { getApps as getAdminApps, initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { DEFAULT_SERVICE_CATALOG, DEFAULT_SITE_CONTENT, TRACKER_MILESTONES } from './server/catalog.ts';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

// Initialize firebase-admin auth ONLY (token verification works on any project without IAM)
let firebaseAdminAuth: ReturnType<typeof getAdminAuth> | null = null;
try {
  const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(cfgPath)) {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) as { projectId?: string };
    if (cfg.projectId) {
      const adminApp = getAdminApps().length
        ? getAdminApps()[0]
        : initializeAdminApp({ projectId: cfg.projectId });
      firebaseAdminAuth = getAdminAuth(adminApp);
    }
  }
} catch (err) {
  console.error('Firebase Admin Auth init warning:', err);
}

interface AuthedRequest extends Request {
  firebaseUser?: {
    uid: string;
    email: string;
  };
}

// Per-user AI daily quota persistence (simple server memory + local quota file)
const AI_QUOTA_PATH = path.resolve(process.cwd(), 'data', 'ai-quota.json');
const AI_DAILY_LIMIT = 2;
const AI_COOLDOWN_MS = 2 * 60 * 1000;

interface QuotaRecord {
  date: string;
  count: number;
  lastTimestamp: number;
}

function readQuotaMap(): Record<string, QuotaRecord> {
  try {
    if (fs.existsSync(AI_QUOTA_PATH)) {
      return JSON.parse(fs.readFileSync(AI_QUOTA_PATH, 'utf-8')) as Record<string, QuotaRecord>;
    }
  } catch {
    // ignore corrupt file
  }
  return {};
}

function writeQuotaMap(map: Record<string, QuotaRecord>): void {
  try {
    fs.mkdirSync(path.dirname(AI_QUOTA_PATH), { recursive: true });
    fs.writeFileSync(AI_QUOTA_PATH, JSON.stringify(map, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist AI quota:', err);
  }
}

async function requireFirebaseUser(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Silakan masuk dengan Google terlebih dahulu.' });
    return;
  }
  if (!firebaseAdminAuth) {
    res.status(503).json({ error: 'Verifikasi Firebase Auth belum siap pada server.' });
    return;
  }

  const token = header.slice(7).trim();
  try {
    const decoded = await firebaseAdminAuth.verifyIdToken(token);
    if (!decoded.uid || !decoded.email || decoded.email_verified === false) {
      res.status(401).json({ error: 'Akun Google belum terverifikasi.' });
      return;
    }
    req.firebaseUser = {
      uid: decoded.uid,
      email: decoded.email.toLowerCase(),
    };
    next();
  } catch {
    res.status(401).json({ error: 'Sesi login Google kedaluwarsa atau tidak valid. Silakan masuk ulang.' });
  }
}

function isRetryableGeminiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('503') || msg.includes('429') || msg.includes('UNAVAILABLE') || msg.includes('RESOURCE_EXHAUSTED');
}

async function generateWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries && isRetryableGeminiError(err)) {
        const delayMs = 900 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      firebaseAuthConfigured: Boolean(firebaseAdminAuth),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/bootstrap', (_req, res) => {
    res.json({
      catalog: DEFAULT_SERVICE_CATALOG,
      siteContent: DEFAULT_SITE_CONTENT,
      milestones: TRACKER_MILESTONES,
    });
  });

  // ================= SERVER-SIDE GEMINI AI SYNOPSIS =================
  app.get('/api/ai/quota', requireFirebaseUser, (req: AuthedRequest, res) => {
    const uid = req.firebaseUser!.uid;
    const today = new Date().toISOString().slice(0, 10);
    const map = readQuotaMap();
    const rec = map[uid];
    const active = rec && rec.date === today ? rec : { date: today, count: 0, lastTimestamp: 0 };
    res.json({
      limit: AI_DAILY_LIMIT,
      cooldownMs: AI_COOLDOWN_MS,
      used: active.count,
      remaining: Math.max(0, AI_DAILY_LIMIT - active.count),
      lastTimestamp: active.lastTimestamp,
    });
  });

  app.post('/api/ai/synopsis', requireFirebaseUser, async (req: AuthedRequest, res) => {
    const uid = req.firebaseUser!.uid;
    const today = new Date().toISOString().slice(0, 10);
    const map = readQuotaMap();
    const rec = map[uid];
    const quota = rec && rec.date === today ? rec : { date: today, count: 0, lastTimestamp: 0 };

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
        error: 'GEMINI_API_KEY belum dikonfigurasi pada server.',
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

      const response = await generateWithRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            systemInstruction:
              'Anda adalah dramaturg dan penulis seni pertunjukan tari profesional di Indonesia. Hasilkan hanya teks sinopsis akhir dalam Bahasa Indonesia.',
          },
        })
      );

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
      map[uid] = nextQuota;
      writeQuotaMap(map);

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

  const server = http.createServer(app);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`PrangArt Lab server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
