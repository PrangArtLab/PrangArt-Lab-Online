import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { playNotificationChime } from '../lib/format';
import type {
  ClientUser,
  Project,
  ServiceCatalog,
  ServiceLineKey,
  SiteContent,
  StudioNotification,
  ToastMessage,
} from '../types';

export const TRACKER_MILESTONES: string[] = [
  '1. Menunggu Verifikasi & Kontrak',
  '2. Pembayaran DP 50%',
  '3. Penyusunan Konsep & Aransemen Awal',
  '4. Pengiriman Draf Pertama',
  '5. Tahap Revisi & Penyempurnaan',
  '6. Mixing & Mastering Final',
  '7. Pelunasan & Penyerahan Master File',
];

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
  clientUser: ClientUser | null;
  clientToken: string | null;
  adminToken: string | null;
  adminConfigured: boolean | null;
  adminViaEnv: boolean;
  projects: Project[];
  notifications: StudioNotification[];
  registeredClients: ClientUser[];
  unreadCount: number;
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
  // Client Auth
  loginClient: (email: string, password: string) => Promise<void>;
  registerClient: (name: string, email: string, wa: string, password: string) => Promise<void>;
  logoutClient: () => void;
  updateClientProfile: (name: string, wa: string) => Promise<void>;
  changeClientPassword: (oldPassword: string, newPassword: string) => Promise<void>;
  refreshClientData: () => Promise<void>;
  // Client Orders & Interactions
  submitOrder: (payload: Record<string, unknown>) => Promise<Project>;
  confirmPayment: (projectId: string, payload: ConfirmPaymentPayload) => Promise<Project>;
  addClientNote: (projectId: string, message: string) => Promise<Project>;
  // Admin Auth & Actions
  refreshAdminStatus: () => Promise<void>;
  setupAdminPasscode: (passcode: string) => Promise<void>;
  loginAdmin: (passcode: string) => Promise<void>;
  logoutAdmin: () => void;
  changeAdminPasscode: (newPasscode: string) => Promise<void>;
  refreshAdminDashboard: () => Promise<void>;
  adminUpdateProject: (
    projectId: string,
    payload: {
      action?: 'VERIFY_DP' | 'VERIFY_LUNAS';
      productionStatus?: string;
      masterFileUrl?: string;
      adminReply?: string;
    }
  ) => Promise<Project>;
  adminDeleteProject: (projectId: string) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  saveAdminCatalog: (catalog: ServiceCatalog) => Promise<void>;
  resetAdminCatalog: () => Promise<void>;
  saveAdminSiteContent: (content: Partial<SiteContent>) => Promise<void>;
  resetAdminSiteContent: () => Promise<void>;
}

const StudioContext = createContext<StudioContextValue | null>(null);

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [bootLoading, setBootLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [catalog, setCatalog] = useState<ServiceCatalog | null>(null);
  const [siteContent, setSiteContent] = useState<SiteContent | null>(null);

  // Tokens held strictly in React memory (not localStorage/sessionStorage)
  const [clientToken, setClientToken] = useState<string | null>(null);
  const [clientUser, setClientUser] = useState<ClientUser | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(null);

  const [adminConfigured, setAdminConfigured] = useState<boolean | null>(null);
  const [adminViaEnv, setAdminViaEnv] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [notifications, setNotifications] = useState<StudioNotification[]>([]);
  const [registeredClients, setRegisteredClients] = useState<ClientUser[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [waModalState, setWaModalState] = useState({ open: false, presetIntent: '' });
  const [orderPreset, setOrderPreset] = useState<OrderPreset>({
    serviceLine: 'tari',
    packageKey: 'dasar',
  });

  const wsRef = useRef<WebSocket | null>(null);
  const adminTokenRef = useRef<string | null>(null);
  const clientTokenRef = useRef<string | null>(null);
  const soundEnabledRef = useRef(true);

  adminTokenRef.current = adminToken;
  clientTokenRef.current = clientToken;
  soundEnabledRef.current = soundEnabled;

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

  const apiFetch = useCallback(
    async <T,>(url: string, options: RequestInit = {}, tokenOverride?: string | null): Promise<T> => {
      const headers = new Headers(options.headers || {});
      if (!headers.has('Content-Type') && options.body) {
        headers.set('Content-Type', 'application/json');
      }
      if (tokenOverride) {
        headers.set('Authorization', `Bearer ${tokenOverride}`);
      }
      const res = await fetch(url, { ...options, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Permintaan gagal (${res.status})`);
      }
      return data as T;
    },
    []
  );

  const refreshBootstrap = useCallback(async () => {
    try {
      const data = await apiFetch<{ catalog: ServiceCatalog; siteContent: SiteContent }>('/api/bootstrap');
      setCatalog(data.catalog);
      setSiteContent(data.siteContent);
    } catch (err) {
      console.error('Bootstrap error:', err);
    } finally {
      setBootLoading(false);
    }
  }, [apiFetch]);

  const refreshAdminStatus = useCallback(async () => {
    try {
      const data = await apiFetch<{ configured: boolean; viaEnv: boolean }>('/api/admin/status');
      setAdminConfigured(data.configured);
      setAdminViaEnv(data.viaEnv);
    } catch (err) {
      console.error('Admin status error:', err);
    }
  }, [apiFetch]);

  const refreshClientData = useCallback(async () => {
    const token = clientTokenRef.current;
    if (!token) return;
    try {
      const data = await apiFetch<{ projects: Project[]; notifications: StudioNotification[] }>(
        '/api/client/projects',
        {},
        token
      );
      setProjects(data.projects);
      setNotifications(data.notifications);
    } catch (err) {
      console.error('Client refresh error:', err);
    }
  }, [apiFetch]);

  const refreshAdminDashboard = useCallback(async () => {
    const token = adminTokenRef.current;
    if (!token) return;
    try {
      const data = await apiFetch<{
        projects: Project[];
        notifications: StudioNotification[];
        users: ClientUser[];
        catalog: ServiceCatalog;
        siteContent: SiteContent;
      }>('/api/admin/dashboard', {}, token);
      setProjects(data.projects);
      setNotifications(data.notifications);
      setRegisteredClients(data.users);
      setCatalog(data.catalog);
      setSiteContent(data.siteContent);
    } catch (err) {
      console.error('Admin dashboard refresh error:', err);
    }
  }, [apiFetch]);

  useEffect(() => {
    void refreshBootstrap();
    void refreshAdminStatus();
  }, [refreshBootstrap, refreshAdminStatus]);

  // Real-Time WebSocket Connection with Reconnect & State Sync
  useEffect(() => {
    let active = true;
    let reconnectTimer: number | undefined;
    let attempts = 0;

    const connect = () => {
      if (!active) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!active) return;
        setWsConnected(true);
        attempts = 0;
        // Authenticate socket based on active session token
        const activeToken = adminTokenRef.current || clientTokenRef.current;
        if (activeToken) {
          ws.send(JSON.stringify({ type: 'auth', token: activeToken }));
          if (adminTokenRef.current) {
            void refreshAdminDashboard();
          } else if (clientTokenRef.current) {
            void refreshClientData();
          }
        }
      };

      ws.onmessage = (event) => {
        if (!active) return;
        try {
          const msg = JSON.parse(event.data) as {
            type: string;
            project?: Project;
            id?: string;
            notification?: StudioNotification;
            catalog?: ServiceCatalog;
            siteContent?: SiteContent;
            user?: ClientUser;
          };

          if (msg.type === 'project:created' && msg.project) {
            const incoming = msg.project;
            setProjects((prev) => {
              if (prev.some((p) => p.id === incoming.id)) return prev;
              return [incoming, ...prev];
            });
          } else if (msg.type === 'project:updated' && msg.project) {
            const incoming = msg.project;
            setProjects((prev) => {
              const exists = prev.some((p) => p.id === incoming.id);
              if (!exists) return [incoming, ...prev];
              return prev.map((p) => (p.id === incoming.id ? incoming : p));
            });
          } else if (msg.type === 'project:deleted' && msg.id) {
            setProjects((prev) => prev.filter((p) => p.id !== msg.id));
          } else if (msg.type === 'notification:new' && msg.notification) {
            const n = msg.notification;
            setNotifications((prev) => {
              if (prev.some((item) => item.id === n.id)) return prev;
              return [n, ...prev];
            });
            showToast(n.title, n.message, 'info');
            if (soundEnabledRef.current) {
              playNotificationChime();
            }
          } else if (msg.type === 'notification:read' && msg.id) {
            setNotifications((prev) =>
              prev.map((n) => (n.id === msg.id ? { ...n, read: true } : n))
            );
          } else if (msg.type === 'notification:read_all') {
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
          } else if (msg.type === 'catalog:updated' && msg.catalog) {
            setCatalog(msg.catalog);
          } else if (msg.type === 'siteContent:updated' && msg.siteContent) {
            setSiteContent(msg.siteContent);
          } else if (msg.type === 'client:updated' && msg.user) {
            const u = msg.user;
            setRegisteredClients((prev) => {
              const exists = prev.some((c) => c.id === u.id);
              if (!exists) return [u, ...prev];
              return prev.map((c) => (c.id === u.id ? u : c));
            });
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (!active) return;
        setWsConnected(false);
        const delay = Math.min(8000, 1000 * Math.pow(1.5, attempts));
        attempts += 1;
        reconnectTimer = window.setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      active = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [refreshAdminDashboard, refreshClientData, showToast]);

  // Re-authenticate WebSocket whenever active session token changes
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const token = adminToken || clientToken;
    if (token) {
      ws.send(JSON.stringify({ type: 'auth', token }));
    } else {
      ws.send(JSON.stringify({ type: 'logout' }));
    }
  }, [adminToken, clientToken]);

  // ================= CLIENT AUTH ACTIONS =================
  const loginClient = async (email: string, password: string) => {
    const data = await apiFetch<{ token: string; user: ClientUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    // Ensure single active role session cleanly
    setAdminToken(null);
    adminTokenRef.current = null;
    setClientToken(data.token);
    setClientUser(data.user);
    clientTokenRef.current = data.token;
    await refreshClientData();
    showToast('Berhasil Masuk', `Selamat datang kembali, ${data.user.name}.`);
  };

  const registerClient = async (name: string, email: string, wa: string, password: string) => {
    const data = await apiFetch<{ token: string; user: ClientUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, wa, password }),
    });
    setAdminToken(null);
    adminTokenRef.current = null;
    setClientToken(data.token);
    setClientUser(data.user);
    clientTokenRef.current = data.token;
    await refreshClientData();
    showToast('Pendaftaran Berhasil', `Akun ${data.user.name} telah aktif dan terhubung.`);
  };

  const logoutClient = () => {
    setClientToken(null);
    clientTokenRef.current = null;
    setClientUser(null);
    setProjects([]);
    setNotifications([]);
    showToast('Keluar Akun', 'Anda telah keluar dari Ruang Klien.', 'info');
  };

  const updateClientProfile = async (name: string, wa: string) => {
    const data = await apiFetch<{ user: ClientUser }>(
      '/api/auth/profile',
      { method: 'PUT', body: JSON.stringify({ name, wa }) },
      clientTokenRef.current
    );
    setClientUser(data.user);
    showToast('Profil Tersimpan', 'Data kontak diperbarui dan disinkronkan ke studio.');
  };

  const changeClientPassword = async (oldPassword: string, newPassword: string) => {
    await apiFetch<{ ok: boolean }>(
      '/api/auth/password',
      { method: 'PUT', body: JSON.stringify({ oldPassword, newPassword }) },
      clientTokenRef.current
    );
    showToast('Kata Sandi Diubah', 'Gunakan kata sandi baru pada sesi masuk berikutnya.');
  };

  // ================= CLIENT ORDER ACTIONS =================
  const submitOrder = async (payload: Record<string, unknown>): Promise<Project> => {
    const data = await apiFetch<{ project: Project }>(
      '/api/orders',
      { method: 'POST', body: JSON.stringify(payload) },
      clientTokenRef.current
    );
    setProjects((prev) =>
      prev.some((p) => p.id === data.project.id) ? prev : [data.project, ...prev]
    );
    showToast(
      'Pengajuan Terkirim',
      'Proyek tercatat dan Admin menerima notifikasi real-time. Silakan lakukan pembayaran DP 50%.'
    );
    return data.project;
  };

  const confirmPayment = async (projectId: string, payload: ConfirmPaymentPayload): Promise<Project> => {
    const data = await apiFetch<{ project: Project }>(
      `/api/orders/${projectId}/confirm-payment`,
      { method: 'POST', body: JSON.stringify(payload) },
      clientTokenRef.current
    );
    setProjects((prev) => prev.map((p) => (p.id === data.project.id ? data.project : p)));
    showToast(
      'Konfirmasi Terkirim',
      'Data transfer berhasil dikirim ke Admin untuk verifikasi segera.'
    );
    return data.project;
  };

  const addClientNote = async (projectId: string, message: string): Promise<Project> => {
    const data = await apiFetch<{ project: Project }>(
      `/api/orders/${projectId}/notes`,
      { method: 'POST', body: JSON.stringify({ message }) },
      clientTokenRef.current
    );
    setProjects((prev) => prev.map((p) => (p.id === data.project.id ? data.project : p)));
    showToast('Catatan Terkirim', 'Pesan Anda langsung diteruskan ke Admin Studio.');
    return data.project;
  };

  // ================= ADMIN AUTH & DASHBOARD ACTIONS =================
  const setupAdminPasscode = async (passcode: string) => {
    const data = await apiFetch<{ token: string }>('/api/admin/setup', {
      method: 'POST',
      body: JSON.stringify({ passcode }),
    });
    setClientToken(null);
    clientTokenRef.current = null;
    setClientUser(null);
    setAdminToken(data.token);
    adminTokenRef.current = data.token;
    setAdminConfigured(true);
    await refreshAdminDashboard();
    showToast('PIN Admin Dibuat', 'Panel Admin aktif dan terhubung secara real-time.');
  };

  const loginAdmin = async (passcode: string) => {
    const data = await apiFetch<{ token: string }>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ passcode }),
    });
    setClientToken(null);
    clientTokenRef.current = null;
    setClientUser(null);
    setAdminToken(data.token);
    adminTokenRef.current = data.token;
    await refreshAdminDashboard();
    showToast('Akses Admin Dibuka', 'Terhubung ke notifikasi real-time aktivitas klien.');
  };

  const logoutAdmin = () => {
    setAdminToken(null);
    adminTokenRef.current = null;
    setProjects([]);
    setNotifications([]);
    setRegisteredClients([]);
    showToast('Keluar Admin', 'Sesi Admin telah diakhiri.', 'info');
  };

  const changeAdminPasscode = async (newPasscode: string) => {
    await apiFetch<{ ok: boolean }>(
      '/api/admin/change-passcode',
      { method: 'POST', body: JSON.stringify({ newPasscode }) },
      adminTokenRef.current
    );
    showToast('PIN Diperbarui', 'PIN Admin baru berhasil disimpan.');
  };

  const adminUpdateProject = async (
    projectId: string,
    payload: {
      action?: 'VERIFY_DP' | 'VERIFY_LUNAS';
      productionStatus?: string;
      masterFileUrl?: string;
      adminReply?: string;
    }
  ): Promise<Project> => {
    const data = await apiFetch<{ project: Project }>(
      `/api/admin/projects/${projectId}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      adminTokenRef.current
    );
    setProjects((prev) => prev.map((p) => (p.id === data.project.id ? data.project : p)));
    showToast('Proyek Diperbarui', 'Pembaruan tersimpan dan klien menerima notifikasi langsung.');
    return data.project;
  };

  const adminDeleteProject = async (projectId: string) => {
    await apiFetch<{ ok: boolean }>(
      `/api/admin/projects/${projectId}`,
      { method: 'DELETE' },
      adminTokenRef.current
    );
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    showToast('Proyek Dihapus', 'Data proyek telah dihapus dari server.', 'info');
  };

  const markNotificationRead = async (id: string) => {
    const activeAdmin = adminTokenRef.current;
    const activeClient = clientTokenRef.current;
    const endpoint = activeAdmin
      ? `/api/admin/notifications/${id}/read`
      : `/api/client/notifications/${id}/read`;
    const token = activeAdmin || activeClient;
    if (!token) return;
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await apiFetch(endpoint, { method: 'POST' }, token).catch(() => {});
  };

  const markAllNotificationsRead = async () => {
    const activeAdmin = adminTokenRef.current;
    const activeClient = clientTokenRef.current;
    const endpoint = activeAdmin
      ? '/api/admin/notifications/read-all'
      : '/api/client/notifications/read-all';
    const token = activeAdmin || activeClient;
    if (!token) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await apiFetch(endpoint, { method: 'POST' }, token).catch(() => {});
  };

  const saveAdminCatalog = async (nextCatalog: ServiceCatalog) => {
    const data = await apiFetch<{ catalog: ServiceCatalog }>(
      '/api/admin/catalog',
      { method: 'PUT', body: JSON.stringify({ catalog: nextCatalog }) },
      adminTokenRef.current
    );
    setCatalog(data.catalog);
    showToast('Katalog Tersimpan', 'Tarif dan fasilitas layanan diperbarui ke seluruh halaman.');
  };

  const resetAdminCatalog = async () => {
    const data = await apiFetch<{ catalog: ServiceCatalog }>(
      '/api/admin/catalog/reset',
      { method: 'POST' },
      adminTokenRef.current
    );
    setCatalog(data.catalog);
    showToast('Katalog Direset', 'Tarif dan deskripsi dikembalikan ke standar awal.');
  };

  const saveAdminSiteContent = async (content: Partial<SiteContent>) => {
    const data = await apiFetch<{ siteContent: SiteContent }>(
      '/api/admin/site-content',
      { method: 'PUT', body: JSON.stringify(content) },
      adminTokenRef.current
    );
    setSiteContent(data.siteContent);
    showToast('Konten Tersimpan', 'Portofolio, testimoni, atau pengaturan studio diperbarui.');
  };

  const resetAdminSiteContent = async () => {
    const data = await apiFetch<{ siteContent: SiteContent }>(
      '/api/admin/site-content/reset',
      { method: 'POST' },
      adminTokenRef.current
    );
    setSiteContent(data.siteContent);
    showToast('Konten Direset', 'Konten publik dikembalikan ke bawaan studio.');
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <StudioContext.Provider
      value={{
        bootLoading,
        wsConnected,
        catalog,
        siteContent,
        clientUser,
        clientToken,
        adminToken,
        adminConfigured,
        adminViaEnv,
        projects,
        notifications,
        registeredClients,
        unreadCount,
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
        loginClient,
        registerClient,
        logoutClient,
        updateClientProfile,
        changeClientPassword,
        refreshClientData,
        submitOrder,
        confirmPayment,
        addClientNote,
        refreshAdminStatus,
        setupAdminPasscode,
        loginAdmin,
        logoutAdmin,
        changeAdminPasscode,
        refreshAdminDashboard,
        adminUpdateProject,
        adminDeleteProject,
        markNotificationRead,
        markAllNotificationsRead,
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
