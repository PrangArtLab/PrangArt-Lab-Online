import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  ClientUser,
  Project,
  ServiceCatalog,
  SiteContent,
  StudioNotification,
} from '../src/types.ts';
import { DEFAULT_SERVICE_CATALOG, DEFAULT_SITE_CONTENT, TRACKER_MILESTONES } from './catalog.ts';

export interface StoredUser extends ClientUser {
  passwordSalt: string;
  passwordHash: string;
}

export interface AdminCredential {
  salt: string;
  hash: string;
}

export interface AIQuotaRecord {
  date: string;
  count: number;
  lastTimestamp: number;
}

export interface StoreSchema {
  adminCredential: AdminCredential | null;
  users: StoredUser[];
  projects: Project[];
  notifications: StudioNotification[];
  catalog: ServiceCatalog;
  siteContent: SiteContent;
  aiQuota: Record<string, AIQuotaRecord>;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'prangart-store.json');

// Session signing key: read from env or generate ephemeral in-memory secret
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

export function hashPassword(password: string, salt?: string): { salt: string; hash: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return { salt: actualSalt, hash: derived };
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export interface SessionPayload {
  role: 'client' | 'admin';
  userId?: string;
  email?: string;
  name: string;
  exp: number;
}

export function signSessionToken(payload: Omit<SessionPayload, 'exp'>, ttlMs = 12 * 60 * 60 * 1000): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Date.now() + ttlMs,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token?: string | null): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed || typeof parsed.exp !== 'number' || parsed.exp <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function buildSeedStore(): StoreSchema {
  const demoPass = hashPassword('1234');
  const demoUser: StoredUser = {
    id: 'usr-demo-siti',
    name: 'Siti Aminah (Sanggar Tari)',
    email: 'siti@sanggar.id',
    wa: '081234567890',
    passwordSalt: demoPass.salt,
    passwordHash: demoPass.hash,
    createdAt: '2026-11-20T09:00:00.000Z',
    updatedAt: '2026-11-20T09:00:00.000Z',
  };

  const demoProject: Project = {
    id: 'PAL-20261120-01',
    clientId: demoUser.id,
    clientEmail: demoUser.email,
    clientName: 'Sanggar Seni Pesona Mahakam',
    contactEmail: demoUser.email,
    clientWa: demoUser.wa,
    judul: 'Tari Gema Sungai Mahakam',
    durasi: '05:30',
    serviceLine: 'tari',
    serviceLineLabel: 'Musik Iringan Tari',
    packageKey: 'standar',
    packageName: 'Paket Standar',
    contractAgreed: true,
    contractAgreedAt: '2026-11-20T09:15:00.000Z',
    hasVocalAddon: false,
    addonAmount: 0,
    sorakOption: 'Ya, Tambahkan Sorak',
    totalPrice: 1500000,
    dpAmount: 750000,
    remainingAmount: 750000,
    paymentStage: 'DP_TERVERIFIKASI',
    dpStatus: 'DP 50% Terverifikasi',
    finalPaymentStatus: 'Belum Lunas',
    canDownloadReceipt: false,
    canDownloadMaster: false,
    productionStatus: TRACKER_MILESTONES[2],
    specs: [
      { key: 'Persetujuan Kontrak PrangArt Studios', val: 'Disetujui Klien' },
      { key: 'Sanggar / Komunitas / Instansi / Individu', val: 'Sanggar Seni Pesona Mahakam' },
      { key: 'Kota, Provinsi', val: 'Samarinda, Kalimantan Timur' },
      { key: 'Nama Lengkap Koreografer', val: 'Siti Aminah, S.Sn.' },
      { key: 'Jenis Tari', val: 'Tari kreasi' },
      { key: 'Latar Belakang Budaya / Daerah Tari', val: 'Budaya Kutai & Dayak Kenyah' },
      { key: 'Struktur Tari / Suasana Dipilih', val: 'Opening, Orientasi Suasana Cerita, Klimaks, Penutup' },
      { key: 'Tambahan Sorak', val: 'Ya, Tambahkan Sorak' },
    ],
    videoLink: 'https://drive.google.com/example-latihan-gema-mahakam',
    sinopsis:
      'Karya tari "Tari Gema Sungai Mahakam" menggambarkan harmoni kehidupan masyarakat pesisir sungai di Kalimantan Timur dalam merawat tradisi leluhur di tengah arus zaman.',
    paymentConfirmations: [
      {
        id: 'pay-demo-1',
        stage: 'DP_50',
        amount: 750000,
        senderName: 'Siti Aminah',
        bankMethod: 'Transfer BCA',
        transferDate: '2026-11-20',
        referenceNote: 'Transfer DP 50% Tari Gema Sungai Mahakam',
        submittedAt: '2026-11-20T09:40:00.000Z',
      },
    ],
    notes: [
      {
        id: 'note-demo-1',
        authorRole: 'client',
        authorName: 'Siti Aminah',
        message: 'Mohon aksen gong pada transisi menit 03:10 dibuat lebih tegas untuk penanda masuknya klimaks.',
        createdAt: '2026-11-20T10:05:00.000Z',
      },
    ],
    createdAt: '2026-11-20T09:15:00.000Z',
    updatedAt: '2026-11-20T10:05:00.000Z',
  };

  const demoNotif: StudioNotification = {
    id: 'notif-demo-1',
    recipientRole: 'admin',
    type: 'REVISION_NOTE',
    title: 'Catatan Produksi dari Siti Aminah',
    message: 'Klien menambahkan catatan untuk proyek "Tari Gema Sungai Mahakam".',
    projectId: demoProject.id,
    actorName: 'Siti Aminah',
    actorEmail: demoUser.email,
    read: false,
    createdAt: '2026-11-20T10:05:00.000Z',
  };

  return {
    adminCredential: null,
    users: [demoUser],
    projects: [demoProject],
    notifications: [demoNotif],
    catalog: JSON.parse(JSON.stringify(DEFAULT_SERVICE_CATALOG)),
    siteContent: JSON.parse(JSON.stringify(DEFAULT_SITE_CONTENT)),
    aiQuota: {},
  };
}

class StudioStore {
  private data: StoreSchema;

  constructor() {
    this.data = this.load();
  }

  private load(): StoreSchema {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, 'utf8');
        const parsed = JSON.parse(raw) as Partial<StoreSchema>;
        const seed = buildSeedStore();
        return {
          adminCredential: parsed.adminCredential ?? null,
          users: Array.isArray(parsed.users) ? parsed.users : seed.users,
          projects: Array.isArray(parsed.projects) ? parsed.projects : seed.projects,
          notifications: Array.isArray(parsed.notifications) ? parsed.notifications : seed.notifications,
          catalog: parsed.catalog ?? seed.catalog,
          siteContent: parsed.siteContent ?? seed.siteContent,
          aiQuota: parsed.aiQuota ?? {},
        };
      }
    } catch (err) {
      console.error('Failed to read store, initializing fresh store:', err);
    }
    const fresh = buildSeedStore();
    this.persistData(fresh);
    return fresh;
  }

  private persistData(nextData: StoreSchema): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpPath = `${STORE_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(nextData, null, 2), 'utf8');
    fs.renameSync(tmpPath, STORE_PATH);
  }

  save(): void {
    this.persistData(this.data);
  }

  get state(): StoreSchema {
    return this.data;
  }

  toPublicUser(user: StoredUser): ClientUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      wa: user.wa,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

export const store = new StudioStore();
