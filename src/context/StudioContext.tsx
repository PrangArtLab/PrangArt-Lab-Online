import {
  onIdTokenChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  OperationType,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  testFirestoreConnection,
} from '../firebase';
import {
  ADMIN_EMAIL,
  DEFAULT_SERVICE_CATALOG,
  DEFAULT_SITE_CONTENT,
  TRACKER_MILESTONES as DEFAULT_MILESTONES,
} from '../lib/catalogDefaults';
import { playNotificationChime } from '../lib/format';
import type {
  AdminProfile,
  ClientUser,
  PaymentConfirmation,
  Project,
  ProjectNote,
  ServiceCatalog,
  ServiceLineKey,
  SiteContent,
  StudioNotification,
  ToastMessage,
} from '../types';

export const TRACKER_MILESTONES: string[] = DEFAULT_MILESTONES;

interface ConfirmPaymentPayload {
  stage: 'DP_50' | 'PELUNASAN_50';
  amount: number;
  senderName: string;
  bankMethod: string;
  transferDate: string;
  referenceNote: string;
  proofUrl?: string;
}

interface OrderPreset {
  serviceLine: ServiceLineKey;
  packageKey: string;
}

interface StudioContextValue {
  bootLoading: boolean;
  wsConnected: boolean;
  catalog: ServiceCatalog | null;
  siteContent: SiteContent | null;
  // Independent Client Session & State
  clientUser: ClientUser | null;
  clientToken: string | null;
  clientProjects: Project[];
  clientNotifications: StudioNotification[];
  clientUnreadCount: number;
  // Independent Admin Session & State
  adminProfile: AdminProfile | null;
  adminToken: string | null;
  adminProjects: Project[];
  adminNotifications: StudioNotification[];
  adminUnreadCount: number;
  registeredClients: ClientUser[];
  // UI Preferences & Modals
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  toasts: ToastMessage[];
  showToast: (title: string, message: string, type?: ToastMessage['type']) => void;
  dismissToast: (id: string) => void;
  waModalState: { open: boolean; presetIntent: string };
  openWaModal: (presetIntent?: string) => void;
  closeWaModal: () => void;
  orderPreset: OrderPreset;
  setOrderPreset: React.Dispatch<React.SetStateAction<OrderPreset>>;
  // Client Auth & Actions (Firebase Google Auth + Firestore)
  getFreshToken: () => Promise<string | null>;
  loginClientWithGoogle: () => Promise<void>;
  logoutClient: () => Promise<void>;
  updateClientProfile: (name: string, wa: string) => Promise<void>;
  refreshClientData: () => Promise<void>;
  submitOrder: (payload: Record<string, unknown>) => Promise<Project>;
  confirmPayment: (projectId: string, payload: ConfirmPaymentPayload) => Promise<Project>;
  addClientNote: (projectId: string, message: string) => Promise<Project>;
  markClientNotificationRead: (id: string) => Promise<void>;
  markAllClientNotificationsRead: () => Promise<void>;
  // Admin Auth & Actions (Firebase Google Auth + Firestore)
  loginAdminWithGoogle: () => Promise<void>;
  logoutAdmin: () => Promise<void>;
  refreshAdminDashboard: () => Promise<void>;
  adminUpdateProject: (
    projectId: string,
    payload: {
      action?: 'VERIFY_DP' | 'VERIFY_LUNAS';
      productionStatus?: string;
      masterFileUrl?: string;
      finishingDate?: string;
      finishingNotes?: string;
      adminReply?: string;
    }
  ) => Promise<Project>;
  adminDeleteProject: (projectId: string) => Promise<void>;
  markAdminNotificationRead: (id: string) => Promise<void>;
  markAllAdminNotificationsRead: () => Promise<void>;
  saveAdminCatalog: (catalog: ServiceCatalog) => Promise<void>;
  resetAdminCatalog: () => Promise<void>;
  saveAdminSiteContent: (content: Partial<SiteContent>) => Promise<void>;
  resetAdminSiteContent: () => Promise<void>;
}

const StudioContext = createContext<StudioContextValue | null>(null);

const SOUND_PREF_KEY = 'pal_sound_enabled';
const ORDER_PRESET_KEY = 'pal_order_preset';

function tsToIso(value: unknown): string {
  if (!value) return new Date().toISOString();
  if (typeof value === 'string') return value;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

function makeDocId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function readableFirestoreErr(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    try {
      const parsed = JSON.parse(err.message) as { error?: string };
      if (parsed?.error) return parsed.error;
    } catch {
      return err.message || fallback;
    }
  }
  return fallback;
}

function logSnapshotError(operationType: OperationType, path: string, err: unknown) {
  const errInfo = {
    error: err instanceof Error ? err.message : String(err),
    operationType,
    path,
    authUid: auth.currentUser?.uid || null,
  };
  console.error('Firestore Snapshot Error:', JSON.stringify(errInfo));
}

function rethrowReadableFirestoreError(
  err: unknown,
  operationType: OperationType,
  path: string,
  fallback: string
): never {
  try {
    handleFirestoreError(err, operationType, path);
  } catch (wrapped) {
    throw new Error(readableFirestoreErr(wrapped, fallback));
  }
}

function mapRawProject(id: string, data: Record<string, unknown>): Project {
  return {
    id,
    clientId: String(data.clientId || ''),
    clientEmail: String(data.clientEmail || ''),
    clientName: String(data.clientName || ''),
    contactEmail: String(data.contactEmail || ''),
    clientWa: String(data.clientWa || ''),
    judul: String(data.judul || ''),
    durasi: String(data.durasi || ''),
    serviceLine: (data.serviceLine as ServiceLineKey) || 'tari',
    serviceLineLabel: String(data.serviceLineLabel || ''),
    packageKey: String(data.packageKey || 'dasar'),
    packageName: String(data.packageName || ''),
    contractAgreed: Boolean(data.contractAgreed),
    contractAgreedAt: data.contractAgreedAt ? String(data.contractAgreedAt) : undefined,
    hasVocalAddon: Boolean(data.hasVocalAddon),
    addonAmount: Number(data.addonAmount || 0),
    sorakOption: data.sorakOption ? String(data.sorakOption) : null,
    totalPrice: Number(data.totalPrice || 0),
    dpAmount: Number(data.dpAmount || 0),
    remainingAmount: Number(data.remainingAmount || 0),
    paymentStage: (data.paymentStage as Project['paymentStage']) || 'MENUNGGU_DP',
    dpStatus: String(data.dpStatus || 'Menunggu Pembayaran DP 50%'),
    finalPaymentStatus: String(data.finalPaymentStatus || 'Belum Lunas'),
    canDownloadReceipt: Boolean(data.canDownloadReceipt),
    canDownloadMaster: Boolean(data.canDownloadMaster),
    masterFileUrl: data.masterFileUrl ? String(data.masterFileUrl) : undefined,
    productionStatus: String(data.productionStatus || DEFAULT_MILESTONES[0]),
    finishingDate: data.finishingDate ? String(data.finishingDate) : undefined,
    finishingNotes: data.finishingNotes ? String(data.finishingNotes) : undefined,
    specs: Array.isArray(data.specs) ? (data.specs as Project['specs']) : [],
    videoLink: data.videoLink ? String(data.videoLink) : undefined,
    sinopsis: data.sinopsis ? String(data.sinopsis) : undefined,
    paymentConfirmations: [],
    notes: [],
    createdAt: tsToIso(data.createdAt),
    updatedAt: tsToIso(data.updatedAt),
  };
}

function mapRawNotification(id: string, data: Record<string, unknown>): StudioNotification {
  return {
    id,
    recipientRole: (data.recipientRole as 'admin' | 'client') || 'admin',
    recipientUid: data.recipientUid ? String(data.recipientUid) : undefined,
    recipientEmail: data.recipientEmail ? String(data.recipientEmail) : undefined,
    type: (data.type as StudioNotification['type']) || 'ORDER_CREATED',
    title: String(data.title || ''),
    message: String(data.message || ''),
    projectId: data.projectId ? String(data.projectId) : undefined,
    actorUid: data.actorUid ? String(data.actorUid) : undefined,
    actorName: String(data.actorName || ''),
    actorEmail: data.actorEmail ? String(data.actorEmail) : undefined,
    read: Boolean(data.read),
    createdAt: tsToIso(data.createdAt),
  };
}

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [bootLoading, setBootLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [catalog, setCatalog] = useState<ServiceCatalog | null>(DEFAULT_SERVICE_CATALOG);
  const [siteContent, setSiteContent] = useState<SiteContent | null>(DEFAULT_SITE_CONTENT);

  // Firebase Auth User & Fresh ID Token
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [isAdminVerified, setIsAdminVerified] = useState(false);

  // Client Workspace State
  const [clientUser, setClientUser] = useState<ClientUser | null>(null);
  const [rawClientProjects, setRawClientProjects] = useState<Project[]>([]);
  const [clientConfirmations, setClientConfirmations] = useState<Record<string, PaymentConfirmation[]>>({});
  const [clientNotes, setClientNotes] = useState<Record<string, ProjectNote[]>>({});
  const [clientNotifications, setClientNotifications] = useState<StudioNotification[]>([]);

  // Admin Dashboard State
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [rawAdminProjects, setRawAdminProjects] = useState<Project[]>([]);
  const [adminConfirmations, setAdminConfirmations] = useState<Record<string, PaymentConfirmation[]>>({});
  const [adminNotes, setAdminNotes] = useState<Record<string, ProjectNote[]>>({});
  const [adminNotifications, setAdminNotifications] = useState<StudioNotification[]>([]);
  const [registeredClients, setRegisteredClients] = useState<ClientUser[]>([]);

  // Persisted UI State
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(SOUND_PREF_KEY);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  const [orderPreset, setOrderPreset] = useState<OrderPreset>(() => {
    try {
      const raw = localStorage.getItem(ORDER_PRESET_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<OrderPreset>;
        if (parsed.serviceLine && parsed.packageKey) {
          return { serviceLine: parsed.serviceLine, packageKey: parsed.packageKey };
        }
      }
    } catch {
      // ignore
    }
    return { serviceLine: 'tari', packageKey: 'dasar' };
  });

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [waModalState, setWaModalState] = useState({ open: false, presetIntent: '' });

  const soundEnabledRef = useRef(true);
  soundEnabledRef.current = soundEnabled;

  const seenClientNotifIdsRef = useRef<Set<string>>(new Set());
  const clientNotifsInitializedRef = useRef(false);
  const seenAdminNotifIdsRef = useRef<Set<string>>(new Set());
  const adminNotifsInitializedRef = useRef(false);

  const setSoundEnabled = useCallback((v: boolean) => {
    setSoundEnabledState(v);
    try {
      localStorage.setItem(SOUND_PREF_KEY, String(v));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(ORDER_PRESET_KEY, JSON.stringify(orderPreset));
    } catch {
      // ignore
    }
  }, [orderPreset]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (title: string, message: string, type: ToastMessage['type'] = 'success') => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [{ id, title, message, type }, ...prev].slice(0, 5));
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5200);
    },
    []
  );

  const openWaModal = useCallback((presetIntent = '') => {
    setWaModalState({ open: true, presetIntent });
  }, []);

  const closeWaModal = useCallback(() => {
    setWaModalState((prev) => ({ ...prev, open: false }));
  }, []);

  // Ensure client /users/{uid} profile exists in Firestore
  const ensureClientUserProfile = useCallback(async (user: User): Promise<ClientUser> => {
    const userRef = doc(db, 'users', user.uid);
    try {
      const existingSnap = await getDocFromServer(userRef);
      if (existingSnap.exists()) {
        const d = existingSnap.data();
        return {
          id: existingSnap.id,
          uid: String(d.uid || user.uid),
          name: String(d.name || user.displayName || user.email || 'Klien'),
          email: String(d.email || user.email || '').toLowerCase(),
          wa: String(d.wa || ''),
          role: 'client',
          createdAt: tsToIso(d.createdAt),
          updatedAt: tsToIso(d.updatedAt),
        };
      }

      const cleanName = (user.displayName || user.email?.split('@')[0] || 'Klien Baru').slice(0, 120);
      const cleanEmail = (user.email || '').toLowerCase();
      await setDoc(userRef, {
        id: user.uid,
        uid: user.uid,
        name: cleanName,
        email: cleanEmail,
        wa: '',
        role: 'client',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Notify Admin of new registered client in real-time
      const notifId = makeDocId('notif');
      await setDoc(doc(db, 'notifications', notifId), {
        id: notifId,
        recipientRole: 'admin',
        recipientUid: 'ADMIN',
        type: 'CLIENT_REGISTERED',
        title: 'Klien Baru Bergabung',
        message: `${cleanName} (${cleanEmail}) masuk ke Ruang Klien via Google.`,
        actorUid: user.uid,
        actorName: cleanName,
        actorEmail: cleanEmail,
        read: false,
        createdAt: serverTimestamp(),
      });

      return {
        id: user.uid,
        uid: user.uid,
        name: cleanName,
        email: cleanEmail,
        wa: '',
        role: 'client',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      // Ensure client profile creation errors propagate cleanly
    } catch (err) {
      rethrowReadableFirestoreError(
        err,
        OperationType.WRITE,
        `users/${user.uid}`,
        'Gagal membuat atau memuat profil akun klien.'
      );
    }
  }, []);

  const getFreshToken = useCallback(async (): Promise<string | null> => {
    const current = auth.currentUser;
    if (!current) return null;
    try {
      const fresh = await current.getIdToken();
      setIdToken(fresh);
      return fresh;
    } catch {
      return idToken;
    }
  }, [idToken]);

  // Seed default config/catalog & config/siteContent if admin signs in and docs don't exist yet,
  // and remove unmodified legacy stock sample portfolio/testimonials once if previously seeded.
  const seedStudioConfigIfMissing = useCallback(async () => {
    try {
      const [catSnap, siteSnap, testSnap] = await Promise.all([
        getDocFromServer(doc(db, 'config', 'catalog')).catch(() => null),
        getDocFromServer(doc(db, 'config', 'siteContent')).catch(() => null),
        getDocFromServer(doc(db, 'test', 'connection')).catch(() => null),
      ]);

      if (testSnap && !testSnap.exists()) {
        await setDoc(doc(db, 'test', 'connection'), { ok: true }).catch(() => {});
      }
      if (catSnap && !catSnap.exists()) {
        await setDoc(doc(db, 'config', 'catalog'), {
          ...DEFAULT_SERVICE_CATALOG,
          updatedAt: new Date().toISOString(),
        });
      }
      if (siteSnap && !siteSnap.exists()) {
        await setDoc(doc(db, 'config', 'siteContent'), {
          ...DEFAULT_SITE_CONTENT,
          updatedAt: new Date().toISOString(),
        });
      } else if (siteSnap && siteSnap.exists()) {
        const data = siteSnap.data();
        const stockPfTitles = new Map([
          ['pf-1', 'Gema Mahakam — Garapan Tari Kontemporer'],
          ['pf-2', 'Skor Dokumenter "Senja di Tepian Sungai"'],
          ['pf-3', 'Partitur Lengkap Repertoar Tingkilan Klasik'],
        ]);
        const stockTmNames = new Map([
          ['tm-1', 'Siti Aminah'],
          ['tm-2', 'Raka Mahendra'],
          ['tm-3', 'Dian Kusumawardhani'],
        ]);

        const rawPortfolio = Array.isArray(data.portfolio) ? (data.portfolio as { id?: string; title?: string }[]) : [];
        const rawTestimonials = Array.isArray(data.testimonials) ? (data.testimonials as { id?: string; name?: string }[]) : [];
        const filteredPortfolio = rawPortfolio.filter(
          (p) => !(p?.id && stockPfTitles.get(p.id) === p.title)
        );
        const filteredTestimonials = rawTestimonials.filter(
          (t) => !(t?.id && stockTmNames.get(t.id) === t.name)
        );

        const rawSettings = (data.settings || {}) as Record<string, string>;
        const cleanedSettings = {
          ...rawSettings,
          studioWhatsApp:
            rawSettings.studioWhatsApp === '6281234567890' ? '' : rawSettings.studioWhatsApp || '',
          studioBankName:
            rawSettings.studioBankName === 'Bank BCA / Mandiri (Sesuaikan di Pengaturan Admin)'
              ? ''
              : rawSettings.studioBankName || '',
          studioBankAccount:
            rawSettings.studioBankAccount === '1234-5678-9012' ? '' : rawSettings.studioBankAccount || '',
        };

        const changed =
          filteredPortfolio.length !== rawPortfolio.length ||
          filteredTestimonials.length !== rawTestimonials.length ||
          cleanedSettings.studioWhatsApp !== (rawSettings.studioWhatsApp || '') ||
          cleanedSettings.studioBankName !== (rawSettings.studioBankName || '') ||
          cleanedSettings.studioBankAccount !== (rawSettings.studioBankAccount || '');

        if (changed) {
          await setDoc(
            doc(db, 'config', 'siteContent'),
            {
              portfolio: filteredPortfolio,
              testimonials: filteredTestimonials,
              settings: cleanedSettings,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        }
      }
    } catch (err) {
      console.error('Seed studio config warning:', err);
    }
  }, []);

  // 1. Startup Firestore connection test + public real-time config listeners
  useEffect(() => {
    let active = true;
    void testFirestoreConnection().then((ok) => {
      if (active) setWsConnected(ok);
    });

    const unsubCatalog = onSnapshot(
      doc(db, 'config', 'catalog'),
      (snap) => {
        if (!active) return;
        setWsConnected(true);
        if (snap.exists()) {
          const data = snap.data();
          if (data.tari && data.digital && data.transkripsi) {
            setCatalog({
              tari: data.tari,
              digital: data.digital,
              transkripsi: data.transkripsi,
            } as ServiceCatalog);
          }
        }
      },
      (err) => {
        console.error('Catalog snapshot error:', err);
      }
    );

    const unsubSite = onSnapshot(
      doc(db, 'config', 'siteContent'),
      (snap) => {
        if (!active) return;
        setWsConnected(true);
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data.portfolio) && Array.isArray(data.testimonials) && data.settings) {
            setSiteContent({
              portfolio: data.portfolio,
              testimonials: data.testimonials,
              settings: data.settings,
            } as SiteContent);
          }
        }
      },
      (err) => {
        console.error('SiteContent snapshot error:', err);
      }
    );

    return () => {
      active = false;
      unsubCatalog();
      unsubSite();
    };
  }, []);

  // 2. Firebase Auth state & role resolution
  useEffect(() => {
    const unsub = onIdTokenChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setIdToken(null);
        setClientUser(null);
        setAdminProfile(null);
        setIsAdminVerified(false);
        setRawClientProjects([]);
        setClientConfirmations({});
        setClientNotes({});
        setClientNotifications([]);
        setRawAdminProjects([]);
        setAdminConfirmations({});
        setAdminNotes({});
        setAdminNotifications([]);
        setRegisteredClients([]);
        seenClientNotifIdsRef.current.clear();
        clientNotifsInitializedRef.current = false;
        seenAdminNotifIdsRef.current.clear();
        adminNotifsInitializedRef.current = false;
        setBootLoading(false);
        return;
      }

      try {
        const token = await user.getIdToken();
        setIdToken(token);

        const emailLower = (user.email || '').toLowerCase();
        let hasAdminDoc = false;
        if (user.emailVerified && emailLower !== ADMIN_EMAIL) {
          try {
            const adminSnap = await getDocFromServer(doc(db, 'admins', user.uid));
            hasAdminDoc = adminSnap.exists();
          } catch {
            hasAdminDoc = false;
          }
        }

        const adminOk = Boolean(user.emailVerified && (emailLower === ADMIN_EMAIL || hasAdminDoc));
        setIsAdminVerified(adminOk);
        if (adminOk) {
          setAdminProfile({
            uid: user.uid,
            email: emailLower,
            name: user.displayName || 'Admin PrangArt Lab',
          });
          void seedStudioConfigIfMissing();
        } else {
          setAdminProfile(null);
        }

        if (user.emailVerified) {
          const profile = await ensureClientUserProfile(user).catch(() => null);
          if (profile) {
            setClientUser(profile);
          }
        }
      } catch (err) {
        console.error('Auth state hydration error:', err);
      } finally {
        setBootLoading(false);
      }
    });

    return () => unsub();
  }, [ensureClientUserProfile, seedStudioConfigIfMissing]);

  // 3. Client Real-Time Firestore Listeners (user doc, projects, subcollections, notifications)
  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified) return;
    const uid = firebaseUser.uid;
    const subUnsubs = new Map<string, { conf: Unsubscribe; notes: Unsubscribe }>();

    const unsubUser = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setClientUser({
            id: snap.id,
            uid: String(d.uid || uid),
            name: String(d.name || firebaseUser.displayName || 'Klien'),
            email: String(d.email || firebaseUser.email || '').toLowerCase(),
            wa: String(d.wa || ''),
            role: 'client',
            createdAt: tsToIso(d.createdAt),
            updatedAt: tsToIso(d.updatedAt),
          });
        }
      },
      (err) => logSnapshotError(OperationType.GET, `users/${uid}`, err)
    );

    const qProjects = query(collection(db, 'projects'), where('clientId', '==', uid));
    const unsubProjects = onSnapshot(
      qProjects,
      (snapshot) => {
        setWsConnected(true);
        const list = snapshot.docs
          .map((d) => mapRawProject(d.id, d.data() as Record<string, unknown>))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setRawClientProjects(list);

        const activeIds = new Set(list.map((p) => p.id));
        for (const [pid, pair] of subUnsubs.entries()) {
          if (!activeIds.has(pid)) {
            pair.conf();
            pair.notes();
            subUnsubs.delete(pid);
          }
        }

        for (const proj of list) {
          if (!subUnsubs.has(proj.id)) {
            const qConf = query(
              collection(db, 'projects', proj.id, 'confirmations'),
              where('clientId', '==', uid)
            );
            const unsubConf = onSnapshot(
              qConf,
              (cSnap) => {
                const confs: PaymentConfirmation[] = cSnap.docs
                  .map((cd) => {
                    const c = cd.data();
                    return {
                      id: cd.id,
                      clientId: String(c.clientId || uid),
                      stage: (c.stage as PaymentConfirmation['stage']) || 'DP_50',
                      amount: Number(c.amount || 0),
                      senderName: String(c.senderName || ''),
                      bankMethod: String(c.bankMethod || ''),
                      transferDate: String(c.transferDate || ''),
                      referenceNote: String(c.referenceNote || ''),
                      proofUrl: c.proofUrl ? String(c.proofUrl) : undefined,
                      submittedAt: tsToIso(c.submittedAt),
                    };
                  })
                  .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
                setClientConfirmations((prev) => ({ ...prev, [proj.id]: confs }));
              },
              (err) => logSnapshotError(OperationType.LIST, `projects/${proj.id}/confirmations`, err)
            );

            const qNotes = query(
              collection(db, 'projects', proj.id, 'notes'),
              where('clientId', '==', uid)
            );
            const unsubNotes = onSnapshot(
              qNotes,
              (nSnap) => {
                const notes: ProjectNote[] = nSnap.docs
                  .map((nd) => {
                    const n = nd.data();
                    return {
                      id: nd.id,
                      clientId: String(n.clientId || uid),
                      authorUid: String(n.authorUid || ''),
                      authorRole: (n.authorRole as 'client' | 'admin') || 'client',
                      authorName: String(n.authorName || ''),
                      message: String(n.message || ''),
                      createdAt: tsToIso(n.createdAt),
                    };
                  })
                  .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                setClientNotes((prev) => ({ ...prev, [proj.id]: notes }));
              },
              (err) => logSnapshotError(OperationType.LIST, `projects/${proj.id}/notes`, err)
            );

            subUnsubs.set(proj.id, { conf: unsubConf, notes: unsubNotes });
          }
        }
      },
      (err) => {
        logSnapshotError(OperationType.LIST, 'projects', err);
        setWsConnected(false);
      }
    );

    const qClientNotifs = query(
      collection(db, 'notifications'),
      where('recipientUid', '==', uid),
      where('recipientRole', '==', 'client')
    );
    const unsubNotifs = onSnapshot(
      qClientNotifs,
      (snapshot) => {
        const list = snapshot.docs
          .map((d) => mapRawNotification(d.id, d.data() as Record<string, unknown>))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setClientNotifications(list);

        if (!clientNotifsInitializedRef.current) {
          list.forEach((n) => seenClientNotifIdsRef.current.add(n.id));
          clientNotifsInitializedRef.current = true;
        } else {
          for (const n of list) {
            if (!seenClientNotifIdsRef.current.has(n.id)) {
              seenClientNotifIdsRef.current.add(n.id);
              if (!n.read) {
                showToast(n.title, n.message, 'info');
                if (soundEnabledRef.current) playNotificationChime();
              }
            }
          }
        }
      },
      (err) => logSnapshotError(OperationType.LIST, 'notifications', err)
    );

    return () => {
      unsubUser();
      unsubProjects();
      unsubNotifs();
      for (const pair of subUnsubs.values()) {
        pair.conf();
        pair.notes();
      }
      subUnsubs.clear();
    };
  }, [firebaseUser, showToast]);

  // 4. Admin Real-Time Firestore Listeners (all projects, notifications, users)
  useEffect(() => {
    if (!firebaseUser || !isAdminVerified) return;
    const subUnsubs = new Map<string, { conf: Unsubscribe; notes: Unsubscribe }>();

    const unsubProjects = onSnapshot(
      collection(db, 'projects'),
      (snapshot) => {
        setWsConnected(true);
        const list = snapshot.docs
          .map((d) => mapRawProject(d.id, d.data() as Record<string, unknown>))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setRawAdminProjects(list);

        const activeIds = new Set(list.map((p) => p.id));
        for (const [pid, pair] of subUnsubs.entries()) {
          if (!activeIds.has(pid)) {
            pair.conf();
            pair.notes();
            subUnsubs.delete(pid);
          }
        }

        for (const proj of list) {
          if (!subUnsubs.has(proj.id)) {
            const unsubConf = onSnapshot(
              collection(db, 'projects', proj.id, 'confirmations'),
              (cSnap) => {
                const confs: PaymentConfirmation[] = cSnap.docs
                  .map((cd) => {
                    const c = cd.data();
                    return {
                      id: cd.id,
                      clientId: String(c.clientId || ''),
                      stage: (c.stage as PaymentConfirmation['stage']) || 'DP_50',
                      amount: Number(c.amount || 0),
                      senderName: String(c.senderName || ''),
                      bankMethod: String(c.bankMethod || ''),
                      transferDate: String(c.transferDate || ''),
                      referenceNote: String(c.referenceNote || ''),
                      proofUrl: c.proofUrl ? String(c.proofUrl) : undefined,
                      submittedAt: tsToIso(c.submittedAt),
                    };
                  })
                  .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
                setAdminConfirmations((prev) => ({ ...prev, [proj.id]: confs }));
              },
              (err) => logSnapshotError(OperationType.LIST, `projects/${proj.id}/confirmations`, err)
            );

            const unsubNotes = onSnapshot(
              collection(db, 'projects', proj.id, 'notes'),
              (nSnap) => {
                const notes: ProjectNote[] = nSnap.docs
                  .map((nd) => {
                    const n = nd.data();
                    return {
                      id: nd.id,
                      clientId: String(n.clientId || ''),
                      authorUid: String(n.authorUid || ''),
                      authorRole: (n.authorRole as 'client' | 'admin') || 'client',
                      authorName: String(n.authorName || ''),
                      message: String(n.message || ''),
                      createdAt: tsToIso(n.createdAt),
                    };
                  })
                  .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                setAdminNotes((prev) => ({ ...prev, [proj.id]: notes }));
              },
              (err) => logSnapshotError(OperationType.LIST, `projects/${proj.id}/notes`, err)
            );

            subUnsubs.set(proj.id, { conf: unsubConf, notes: unsubNotes });
          }
        }
      },
      (err) => {
        logSnapshotError(OperationType.LIST, 'projects', err);
        setWsConnected(false);
      }
    );

    const qAdminNotifs = query(collection(db, 'notifications'), where('recipientRole', '==', 'admin'));
    const unsubNotifs = onSnapshot(
      qAdminNotifs,
      (snapshot) => {
        const list = snapshot.docs
          .map((d) => mapRawNotification(d.id, d.data() as Record<string, unknown>))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setAdminNotifications(list);

        if (!adminNotifsInitializedRef.current) {
          list.forEach((n) => seenAdminNotifIdsRef.current.add(n.id));
          adminNotifsInitializedRef.current = true;
        } else {
          for (const n of list) {
            if (!seenAdminNotifIdsRef.current.has(n.id)) {
              seenAdminNotifIdsRef.current.add(n.id);
              if (!n.read) {
                showToast(n.title, n.message, 'info');
                if (soundEnabledRef.current) playNotificationChime();
              }
            }
          }
        }
      },
      (err) => logSnapshotError(OperationType.LIST, 'notifications', err)
    );

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const list: ClientUser[] = snapshot.docs
          .map((d) => {
            const u = d.data();
            return {
              id: d.id,
              uid: String(u.uid || d.id),
              name: String(u.name || ''),
              email: String(u.email || '').toLowerCase(),
              wa: String(u.wa || ''),
              role: 'client' as const,
              createdAt: tsToIso(u.createdAt),
              updatedAt: tsToIso(u.updatedAt),
            };
          })
          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setRegisteredClients(list);
      },
      (err) => logSnapshotError(OperationType.LIST, 'users', err)
    );

    return () => {
      unsubProjects();
      unsubNotifs();
      unsubUsers();
      for (const pair of subUnsubs.values()) {
        pair.conf();
        pair.notes();
      }
      subUnsubs.clear();
    };
  }, [firebaseUser, isAdminVerified, showToast]);

  // Compose hydrated projects with confirmations + notes
  const clientProjects = useMemo(
    () =>
      rawClientProjects.map((p) => ({
        ...p,
        paymentConfirmations: clientConfirmations[p.id] || [],
        notes: clientNotes[p.id] || [],
      })),
    [rawClientProjects, clientConfirmations, clientNotes]
  );

  const adminProjects = useMemo(
    () =>
      rawAdminProjects.map((p) => ({
        ...p,
        paymentConfirmations: adminConfirmations[p.id] || [],
        notes: adminNotes[p.id] || [],
      })),
    [rawAdminProjects, adminConfirmations, adminNotes]
  );

  // ================= AUTH ACTIONS =================
  const loginClientWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    if (!result.user.emailVerified) {
      throw new Error('Email akun Google Anda belum terverifikasi.');
    }
    const profile = await ensureClientUserProfile(result.user);
    setClientUser(profile);
    showToast('Berhasil Masuk', `Selamat datang di Ruang Klien, ${profile.name}.`);
  };

  const logoutClient = async () => {
    await signOut(auth);
    showToast('Keluar Akun', 'Sesi Google Anda telah diakhiri.', 'info');
  };

  const loginAdminWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const emailLower = (user.email || '').toLowerCase();

    let hasAdminDoc = false;
    if (user.emailVerified && emailLower !== ADMIN_EMAIL) {
      try {
        const adminSnap = await getDocFromServer(doc(db, 'admins', user.uid));
        hasAdminDoc = adminSnap.exists();
      } catch {
        hasAdminDoc = false;
      }
    }

    const adminOk = Boolean(user.emailVerified && (emailLower === ADMIN_EMAIL || hasAdminDoc));
    if (!adminOk) {
      throw new Error(
        `Akun Google (${user.email || '-'}) tidak terdaftar sebagai Admin Studio (${ADMIN_EMAIL}).`
      );
    }

    setIsAdminVerified(true);
    setAdminProfile({
      uid: user.uid,
      email: emailLower,
      name: user.displayName || 'Admin PrangArt Lab',
    });
    await seedStudioConfigIfMissing();
    showToast('Akses Admin Dibuka', `Terhubung real-time ke Firestore sebagai ${emailLower}.`);
  };

  const logoutAdmin = async () => {
    await signOut(auth);
    showToast('Keluar Panel Admin', 'Sesi Admin telah diakhiri.', 'info');
  };

  // ================= CLIENT FIRESTORE ACTIONS =================
  const refreshClientData = useCallback(async () => {
    const ok = await testFirestoreConnection();
    setWsConnected(ok);
  }, []);

  const updateClientProfile = async (name: string, wa: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Silakan masuk terlebih dahulu.');
    const cleanName = name.trim().slice(0, 120);
    const cleanWa = wa.trim().slice(0, 40);
    if (!cleanName) throw new Error('Nama lengkap wajib diisi.');

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name: cleanName,
        wa: cleanWa,
        updatedAt: serverTimestamp(),
      });

      // Sync latest name/WA onto existing projects belonging to this client
      await Promise.all(
        rawClientProjects.map((p) =>
          updateDoc(doc(db, 'projects', p.id), {
            clientName: cleanName,
            clientWa: cleanWa || p.clientWa,
            updatedAt: serverTimestamp(),
          })
        )
      );

      const notifId = makeDocId('notif');
      await setDoc(doc(db, 'notifications', notifId), {
        id: notifId,
        recipientRole: 'admin',
        recipientUid: 'ADMIN',
        type: 'CLIENT_PROFILE_UPDATED',
        title: 'Pembaruan Profil Klien',
        message: `${cleanName} (${user.email}) memperbarui kontak profil (WA: ${cleanWa || '-'}).`,
        actorUid: user.uid,
        actorName: cleanName,
        actorEmail: (user.email || '').toLowerCase(),
        read: false,
        createdAt: serverTimestamp(),
      });
      showToast('Profil Tersimpan', 'Data kontak disinkronkan real-time ke proyek dan Admin.');
    } catch (err) {
      rethrowReadableFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`, 'Gagal menyimpan profil.');
    }
  };

  const submitOrder = async (payload: Record<string, unknown>): Promise<Project> => {
    const user = auth.currentUser;
    if (!user || !user.email) throw new Error('Silakan masuk dengan Google terlebih dahulu.');

    const svcKey = String(payload.serviceLine || 'tari') as ServiceLineKey;
    const svc = (catalog || DEFAULT_SERVICE_CATALOG)[svcKey];
    const totalPrice = Math.max(1, Math.round(Number(payload.totalPrice || 0)));
    const dpAmount = Math.round(totalPrice / 2);
    const remainingAmount = totalPrice - dpAmount;
    const projectId = `PAL-${Date.now()}`;
    const nowIso = new Date().toISOString();

    const clientName = String(payload.clientName || clientUser?.name || user.displayName || 'Klien').trim().slice(0, 160);
    const clientWa = String(payload.clientWa || clientUser?.wa || '-').trim().slice(0, 40);
    const contactEmail = String(payload.contactEmail || user.email).trim().toLowerCase().slice(0, 180);
    const clientEmail = user.email.toLowerCase();
    const judul = String(payload.judul || '').trim().slice(0, 200);
    const durasi = String(payload.durasi || '').trim().slice(0, 40);
    const packageKey = String(payload.packageKey || 'dasar').trim().slice(0, 40);
    const packageName = String(payload.packageName || 'Paket Dasar').trim().slice(0, 140);
    const specs = Array.isArray(payload.specs) ? payload.specs.slice(0, 35) : [];

    const docData: Record<string, unknown> = {
      id: projectId,
      clientId: user.uid,
      clientEmail,
      clientName,
      contactEmail,
      clientWa,
      judul,
      durasi,
      serviceLine: svcKey,
      serviceLineLabel: svc.label.slice(0, 80),
      packageKey,
      packageName,
      contractAgreed: Boolean(payload.contractAgreed),
      hasVocalAddon: Boolean(payload.hasVocalAddon),
      addonAmount: Math.max(0, Math.round(Number(payload.addonAmount || 0))),
      sorakOption: payload.sorakOption ? String(payload.sorakOption).slice(0, 120) : null,
      totalPrice,
      dpAmount,
      remainingAmount,
      paymentStage: 'MENUNGGU_DP',
      dpStatus: 'Menunggu Pembayaran DP 50%',
      finalPaymentStatus: 'Belum Lunas',
      canDownloadReceipt: false,
      canDownloadMaster: false,
      productionStatus: DEFAULT_MILESTONES[0],
      specs,
      videoLink: String(payload.videoLink || '').trim().slice(0, 1000),
      sinopsis: svcKey === 'tari' ? String(payload.sinopsis || '').trim().slice(0, 10000) : '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (payload.contractAgreed) {
      docData.contractAgreedAt = nowIso;
    }

    try {
      await setDoc(doc(db, 'projects', projectId), docData);

      // Save WhatsApp onto user profile if still empty
      if (clientUser && !clientUser.wa && clientWa && clientWa !== '-') {
        await updateDoc(doc(db, 'users', user.uid), {
          name: clientName,
          wa: clientWa,
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }

      const notifId = makeDocId('notif');
      await setDoc(doc(db, 'notifications', notifId), {
        id: notifId,
        recipientRole: 'admin',
        recipientUid: 'ADMIN',
        type: 'ORDER_CREATED',
        title: `Pengajuan Baru: ${judul}`,
        message: `${clientName} mengajukan ${svc.label} (${packageName}) senilai Rp${totalPrice.toLocaleString('id-ID')}.`,
        projectId,
        actorUid: user.uid,
        actorName: clientName,
        actorEmail: clientEmail,
        read: false,
        createdAt: serverTimestamp(),
      });

      showToast(
        'Pengajuan Terkirim',
        'Proyek tersimpan di Firebase & Admin langsung menerima notifikasi real-time.'
      );
      return mapRawProject(projectId, { ...docData, createdAt: nowIso, updatedAt: nowIso });
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.CREATE, `projects/${projectId}`);
      } catch (wrapped) {
        throw new Error(readableFirestoreErr(wrapped, 'Gagal mengirim pesanan ke Firebase.'));
      }
    }
  };

  const confirmPayment = async (projectId: string, payload: ConfirmPaymentPayload): Promise<Project> => {
    const user = auth.currentUser;
    const project = clientProjects.find((p) => p.id === projectId);
    if (!user || !project) throw new Error('Proyek atau sesi pengguna tidak ditemukan.');

    const confId = makeDocId('pay');
    const cleanProof = payload.proofUrl?.trim() ? payload.proofUrl.trim().slice(0, 1000) : null;
    const confData: Record<string, unknown> = {
      id: confId,
      clientId: user.uid,
      stage: payload.stage,
      amount: Math.max(1, Math.round(Number(payload.amount))),
      senderName: payload.senderName.trim().slice(0, 140),
      bankMethod: payload.bankMethod.trim().slice(0, 80),
      transferDate: payload.transferDate.trim().slice(0, 40),
      referenceNote: payload.referenceNote.trim().slice(0, 500),
      submittedAt: serverTimestamp(),
    };
    if (cleanProof) {
      confData.proofUrl = cleanProof;
    }

    try {
      await setDoc(doc(db, 'projects', projectId, 'confirmations', confId), confData);

      const projPatch =
        payload.stage === 'DP_50'
          ? {
              paymentStage: 'DP_KONFIRMASI_KLIEN',
              dpStatus: 'Konfirmasi DP Dikirim Klien (Menunggu Verifikasi Admin)',
              updatedAt: serverTimestamp(),
            }
          : {
              paymentStage: 'PELUNASAN_KONFIRMASI_KLIEN',
              finalPaymentStatus: 'Konfirmasi Pelunasan Dikirim Klien (Menunggu Verifikasi Admin)',
              updatedAt: serverTimestamp(),
            };
      await updateDoc(doc(db, 'projects', projectId), projPatch);

      const notifId = makeDocId('notif');
      await setDoc(doc(db, 'notifications', notifId), {
        id: notifId,
        recipientRole: 'admin',
        recipientUid: 'ADMIN',
        type: payload.stage === 'DP_50' ? 'DP_CONFIRMED' : 'FINAL_CONFIRMED',
        title:
          payload.stage === 'DP_50'
            ? `Konfirmasi DP 50%: ${project.judul}`
            : `Konfirmasi Pelunasan: ${project.judul}`,
        message: `${confData.senderName} mengirim konfirmasi ${
          payload.stage === 'DP_50' ? 'DP 50%' : 'Pelunasan'
        } sebesar Rp${Number(confData.amount).toLocaleString('id-ID')} via ${confData.bankMethod}.`,
        projectId,
        actorUid: user.uid,
        actorName: project.clientName,
        actorEmail: project.clientEmail,
        read: false,
        createdAt: serverTimestamp(),
      });

      showToast('Konfirmasi Terkirim', 'Data transfer tersimpan & Admin menerima notifikasi seketika.');
      return project;
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.UPDATE, `projects/${projectId}`);
      } catch (wrapped) {
        throw new Error(readableFirestoreErr(wrapped, 'Gagal mengirim konfirmasi pembayaran.'));
      }
    }
  };

  const addClientNote = async (projectId: string, message: string): Promise<Project> => {
    const user = auth.currentUser;
    const project = clientProjects.find((p) => p.id === projectId);
    if (!user || !project) throw new Error('Proyek tidak ditemukan.');
    const cleanMsg = message.trim().slice(0, 3000);
    if (!cleanMsg) throw new Error('Pesan tidak boleh kosong.');

    const noteId = makeDocId('note');
    const authorName = (clientUser?.name || user.displayName || project.clientName).slice(0, 140);

    try {
      await setDoc(doc(db, 'projects', projectId, 'notes', noteId), {
        id: noteId,
        clientId: user.uid,
        authorUid: user.uid,
        authorRole: 'client',
        authorName,
        message: cleanMsg,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'projects', projectId), {
        updatedAt: serverTimestamp(),
      });

      const notifId = makeDocId('notif');
      await setDoc(doc(db, 'notifications', notifId), {
        id: notifId,
        recipientRole: 'admin',
        recipientUid: 'ADMIN',
        type: 'REVISION_NOTE',
        title: `Pesan / Revisi Klien: ${project.judul}`,
        message: `${authorName}: "${cleanMsg.slice(0, 140)}${cleanMsg.length > 140 ? '…' : ''}"`,
        projectId,
        actorUid: user.uid,
        actorName: authorName,
        actorEmail: project.clientEmail,
        read: false,
        createdAt: serverTimestamp(),
      });

      showToast('Catatan Terkirim', 'Pesan tersimpan di Firebase dan Admin menerima notifikasi.');
      return project;
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.CREATE, `projects/${projectId}/notes/${noteId}`);
      } catch (wrapped) {
        throw new Error(readableFirestoreErr(wrapped, 'Gagal mengirim catatan.'));
      }
    }
  };

  const markClientNotificationRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      console.error('Mark client notification error:', err);
    }
  };

  const markAllClientNotificationsRead = async () => {
    const unread = clientNotifications.filter((n) => !n.read);
    await Promise.all(unread.map((n) => updateDoc(doc(db, 'notifications', n.id), { read: true }).catch(() => {})));
  };

  // ================= ADMIN FIRESTORE ACTIONS =================
  const refreshAdminDashboard = useCallback(async () => {
    const ok = await testFirestoreConnection();
    setWsConnected(ok);
  }, []);

  const adminUpdateProject = async (
    projectId: string,
    payload: {
      action?: 'VERIFY_DP' | 'VERIFY_LUNAS';
      productionStatus?: string;
      masterFileUrl?: string;
      finishingDate?: string;
      finishingNotes?: string;
      adminReply?: string;
    }
  ): Promise<Project> => {
    const user = auth.currentUser;
    const project = adminProjects.find((p) => p.id === projectId);
    if (!user || !isAdminVerified || !project) {
      throw new Error('Proyek atau otorisasi Admin tidak valid.');
    }

    const patch: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    let notifTitle = '';
    let notifMsg = '';
    let notifType: StudioNotification['type'] = 'STATUS_UPDATED';

    if (payload.action === 'VERIFY_DP') {
      patch.paymentStage = 'DP_TERVERIFIKASI';
      patch.dpStatus = 'DP 50% Terverifikasi';
      if (
        project.productionStatus === DEFAULT_MILESTONES[0] ||
        project.productionStatus === DEFAULT_MILESTONES[1]
      ) {
        patch.productionStatus = DEFAULT_MILESTONES[2];
      }
      notifType = 'PAYMENT_VERIFIED';
      notifTitle = `DP 50% Diverifikasi: ${project.judul}`;
      notifMsg = 'Pembayaran DP 50% Anda telah diverifikasi Admin. Produksi resmi dimulai.';
    } else if (payload.action === 'VERIFY_LUNAS') {
      patch.paymentStage = 'LUNAS';
      patch.dpStatus = 'Lunas 100%';
      patch.finalPaymentStatus = 'Lunas';
      patch.productionStatus = DEFAULT_MILESTONES[6];
      patch.canDownloadReceipt = true;
      patch.canDownloadMaster = true;
      if (!project.finishingDate) {
        patch.finishingDate = new Date().toISOString().slice(0, 10);
      }
      notifType = 'PAYMENT_VERIFIED';
      notifTitle = `Pelunasan 100% Terverifikasi: ${project.judul}`;
      notifMsg = 'Bukti Lunas / Kuitansi Resmi dan akses Master File kini terbuka di Ruang Klien.';
    } else {
      if (typeof payload.productionStatus === 'string' && DEFAULT_MILESTONES.includes(payload.productionStatus)) {
        patch.productionStatus = payload.productionStatus;
        if (payload.productionStatus === DEFAULT_MILESTONES[6] && !project.finishingDate && typeof payload.finishingDate !== 'string') {
          patch.finishingDate = new Date().toISOString().slice(0, 10);
        }
        notifType = 'STATUS_UPDATED';
        notifTitle = `Progres Diperbarui: ${project.judul}`;
        notifMsg = `Status produksi kini pada tahap "${payload.productionStatus}".`;
      }
      if (typeof payload.masterFileUrl === 'string') {
        const cleanUrl = payload.masterFileUrl.trim().slice(0, 1000);
        patch.masterFileUrl = cleanUrl || null;
        if (cleanUrl) {
          notifType = 'MASTER_UPLOADED';
          notifTitle = `Master File Disiapkan: ${project.judul}`;
          notifMsg = project.canDownloadMaster
            ? 'Tautan Master File telah tersedia dan siap diunduh di Ruang Klien.'
            : 'Tautan Master File telah disiapkan Admin (terbuka otomatis setelah pelunasan 100%).';
        }
      }
      if (typeof payload.finishingDate === 'string') {
        const cleanDate = payload.finishingDate.trim().slice(0, 40);
        patch.finishingDate = cleanDate || null;
        if (cleanDate && !notifTitle) {
          notifType = 'STATUS_UPDATED';
          notifTitle = `Tanggal Finishing Ditetapkan: ${project.judul}`;
          notifMsg = `Jadwal / tanggal finishing proyek tercatat pada ${cleanDate}.`;
        }
      }
      if (typeof payload.finishingNotes === 'string') {
        const cleanFinishingNotes = payload.finishingNotes.trim().slice(0, 1000);
        patch.finishingNotes = cleanFinishingNotes || null;
      }
    }

    try {
      await updateDoc(doc(db, 'projects', projectId), patch);

      if (typeof payload.adminReply === 'string' && payload.adminReply.trim()) {
        const cleanReply = payload.adminReply.trim().slice(0, 3000);
        const noteId = makeDocId('note');
        await setDoc(doc(db, 'projects', projectId, 'notes', noteId), {
          id: noteId,
          clientId: project.clientId || '',
          authorUid: user.uid,
          authorRole: 'admin',
          authorName: 'Admin PrangArt Lab',
          message: cleanReply,
          createdAt: serverTimestamp(),
        });
        notifType = 'ADMIN_REPLY';
        notifTitle = `Balasan Studio: ${project.judul}`;
        notifMsg = `Admin: "${cleanReply.slice(0, 140)}${cleanReply.length > 140 ? '…' : ''}"`;
      }

      if (notifTitle && project.clientId) {
        const notifId = makeDocId('notif');
        await setDoc(doc(db, 'notifications', notifId), {
          id: notifId,
          recipientRole: 'client',
          recipientUid: project.clientId,
          recipientEmail: project.clientEmail,
          type: notifType,
          title: notifTitle,
          message: notifMsg,
          projectId,
          actorUid: user.uid,
          actorName: 'Admin PrangArt Lab',
          actorEmail: (user.email || '').toLowerCase(),
          read: false,
          createdAt: serverTimestamp(),
        });
      }

      showToast('Proyek Diperbarui', 'Perubahan tersimpan di Firestore & klien menerima notifikasi real-time.');
      return project;
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.UPDATE, `projects/${projectId}`);
      } catch (wrapped) {
        throw new Error(readableFirestoreErr(wrapped, 'Gagal memperbarui proyek.'));
      }
    }
  };

  const adminDeleteProject = async (projectId: string) => {
    try {
      const [confSnap, notesSnap] = await Promise.all([
        getDocs(collection(db, 'projects', projectId, 'confirmations')),
        getDocs(collection(db, 'projects', projectId, 'notes')),
      ]);
      await Promise.all([
        ...confSnap.docs.map((d) => deleteDoc(d.ref)),
        ...notesSnap.docs.map((d) => deleteDoc(d.ref)),
      ]);
      await deleteDoc(doc(db, 'projects', projectId));
      showToast('Proyek Dihapus', 'Data proyek dan catatan berhasil dihapus dari Firestore.', 'info');
    } catch (err) {
      rethrowReadableFirestoreError(err, OperationType.DELETE, `projects/${projectId}`, 'Gagal menghapus proyek.');
    }
  };

  const markAdminNotificationRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      console.error('Mark admin notification error:', err);
    }
  };

  const markAllAdminNotificationsRead = async () => {
    const unread = adminNotifications.filter((n) => !n.read);
    await Promise.all(unread.map((n) => updateDoc(doc(db, 'notifications', n.id), { read: true }).catch(() => {})));
  };

  const saveAdminCatalog = async (nextCatalog: ServiceCatalog) => {
    try {
      await setDoc(
        doc(db, 'config', 'catalog'),
        {
          ...nextCatalog,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      showToast('Katalog Tersimpan', 'Tarif dan fasilitas layanan diperbarui real-time ke seluruh halaman.');
    } catch (err) {
      rethrowReadableFirestoreError(err, OperationType.UPDATE, 'config/catalog', 'Gagal menyimpan katalog layanan.');
    }
  };

  const resetAdminCatalog = async () => {
    try {
      const fresh = JSON.parse(JSON.stringify(DEFAULT_SERVICE_CATALOG)) as ServiceCatalog;
      await setDoc(doc(db, 'config', 'catalog'), {
        ...fresh,
        updatedAt: new Date().toISOString(),
      });
      showToast('Katalog Direset', 'Tarif dan deskripsi dikembalikan ke standar awal.');
    } catch (err) {
      rethrowReadableFirestoreError(err, OperationType.UPDATE, 'config/catalog', 'Gagal mereset katalog.');
    }
  };

  const saveAdminSiteContent = async (content: Partial<SiteContent>) => {
    try {
      // Read authoritative Firestore doc from server first so partial updates never overwrite existing data
      const serverSnap = await getDocFromServer(doc(db, 'config', 'siteContent')).catch(() => null);
      const serverData = serverSnap?.exists() ? (serverSnap.data() as Partial<SiteContent>) : null;
      const base: SiteContent = {
        portfolio: Array.isArray(serverData?.portfolio)
          ? serverData.portfolio
          : siteContent?.portfolio ?? DEFAULT_SITE_CONTENT.portfolio,
        testimonials: Array.isArray(serverData?.testimonials)
          ? serverData.testimonials
          : siteContent?.testimonials ?? DEFAULT_SITE_CONTENT.testimonials,
        settings: serverData?.settings
          ? { ...DEFAULT_SITE_CONTENT.settings, ...serverData.settings }
          : siteContent?.settings ?? DEFAULT_SITE_CONTENT.settings,
      };

      const merged: SiteContent = {
        portfolio: content.portfolio ?? base.portfolio,
        testimonials: content.testimonials ?? base.testimonials,
        settings: content.settings ? { ...base.settings, ...content.settings } : base.settings,
      };

      await setDoc(
        doc(db, 'config', 'siteContent'),
        {
          ...merged,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      showToast('Konten Tersimpan', 'Portofolio, testimoni, atau pengaturan studio diperbarui.');
    } catch (err) {
      rethrowReadableFirestoreError(err, OperationType.UPDATE, 'config/siteContent', 'Gagal menyimpan konten studio.');
    }
  };

  const resetAdminSiteContent = async () => {
    try {
      // Preserve active studio bank & contact settings while clearing portfolio & testimonials
      const serverSnap = await getDocFromServer(doc(db, 'config', 'siteContent')).catch(() => null);
      const serverData = serverSnap?.exists() ? (serverSnap.data() as Partial<SiteContent>) : null;
      const preservedSettings = serverData?.settings || siteContent?.settings || DEFAULT_SITE_CONTENT.settings;
      await setDoc(
        doc(db, 'config', 'siteContent'),
        {
          portfolio: [],
          testimonials: [],
          settings: preservedSettings,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      showToast('Konten Dikosongkan', 'Portofolio dan testimoni dikosongkan sementara pengaturan studio tetap dipertahankan.');
    } catch (err) {
      rethrowReadableFirestoreError(err, OperationType.UPDATE, 'config/siteContent', 'Gagal mereset konten studio.');
    }
  };

  const clientUnreadCount = clientNotifications.filter((n) => !n.read).length;
  const adminUnreadCount = adminNotifications.filter((n) => !n.read).length;

  return (
    <StudioContext.Provider
      value={{
        bootLoading,
        wsConnected,
        catalog,
        siteContent,
        clientUser,
        clientToken: idToken,
        clientProjects,
        clientNotifications,
        clientUnreadCount,
        adminProfile,
        adminToken: isAdminVerified ? idToken : null,
        adminProjects,
        adminNotifications,
        adminUnreadCount,
        registeredClients,
        soundEnabled,
        setSoundEnabled,
        toasts,
        showToast,
        dismissToast,
        waModalState,
        openWaModal,
        closeWaModal,
        orderPreset,
        setOrderPreset,
        getFreshToken,
        loginClientWithGoogle,
        logoutClient,
        updateClientProfile,
        refreshClientData,
        submitOrder,
        confirmPayment,
        addClientNote,
        markClientNotificationRead,
        markAllClientNotificationsRead,
        loginAdminWithGoogle,
        logoutAdmin,
        refreshAdminDashboard,
        adminUpdateProject,
        adminDeleteProject,
        markAdminNotificationRead,
        markAllAdminNotificationsRead,
        saveAdminCatalog,
        resetAdminCatalog,
        saveAdminSiteContent,
        resetAdminSiteContent,
      }}
    >
      {children}
    </StudioContext.Provider>
  );
}

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error('useStudio must be used inside StudioProvider');
  return ctx;
}
