export type ServiceLineKey = 'tari' | 'digital' | 'transkripsi';

export interface PackageSpec {
  label: string;
  price: number;
  maxSeconds?: number;
  isCustom?: boolean;
  billingUnit?: 'per_min_inst' | 'per_min_complete';
  badge?: string;
  summary: string;
  features: string[];
  workflow: string;
}

export interface ServiceLine {
  label: string;
  addonPrice: number;
  overview: string;
  packages: Record<string, PackageSpec>;
}

export type ServiceCatalog = Record<ServiceLineKey, ServiceLine>;

export type PaymentStage =
  | 'MENUNGGU_DP'
  | 'DP_KONFIRMASI_KLIEN'
  | 'DP_TERVERIFIKASI'
  | 'PELUNASAN_KONFIRMASI_KLIEN'
  | 'LUNAS';

export interface ProjectSpecItem {
  key: string;
  val: string;
}

export interface PaymentConfirmation {
  id: string;
  stage: 'DP_50' | 'PELUNASAN_50';
  amount: number;
  senderName: string;
  bankMethod: string;
  transferDate: string;
  referenceNote: string;
  proofUrl?: string;
  submittedAt: string;
}

export interface ProjectNote {
  id: string;
  authorRole: 'client' | 'admin';
  authorName: string;
  message: string;
  createdAt: string;
}

export interface Project {
  id: string;
  clientId?: string;
  clientEmail: string;
  clientName: string;
  contactEmail: string;
  clientWa: string;
  judul: string;
  durasi: string;
  serviceLine: ServiceLineKey;
  serviceLineLabel: string;
  packageKey: string;
  packageName: string;
  contractAgreed: boolean;
  contractAgreedAt?: string;
  hasVocalAddon: boolean;
  addonAmount: number;
  sorakOption: string | null;
  totalPrice: number;
  dpAmount: number;
  remainingAmount: number;
  paymentStage: PaymentStage;
  dpStatus: string;
  finalPaymentStatus: string;
  canDownloadReceipt: boolean;
  canDownloadMaster: boolean;
  masterFileUrl?: string;
  productionStatus: string;
  specs: ProjectSpecItem[];
  videoLink?: string;
  sinopsis?: string;
  paymentConfirmations: PaymentConfirmation[];
  notes: ProjectNote[];
  createdAt: string;
  updatedAt: string;
}

export interface ClientUser {
  id: string;
  name: string;
  email: string;
  wa: string;
  createdAt?: string;
  updatedAt?: string;
}

export type NotificationType =
  | 'ORDER_CREATED'
  | 'DP_CONFIRMED'
  | 'FINAL_CONFIRMED'
  | 'REVISION_NOTE'
  | 'CLIENT_PROFILE_UPDATED'
  | 'CLIENT_REGISTERED'
  | 'STATUS_UPDATED'
  | 'PAYMENT_VERIFIED'
  | 'MASTER_UPLOADED'
  | 'ADMIN_REPLY';

export interface StudioNotification {
  id: string;
  recipientRole: 'admin' | 'client';
  recipientEmail?: string;
  type: NotificationType;
  title: string;
  message: string;
  projectId?: string;
  actorName: string;
  actorEmail?: string;
  read: boolean;
  createdAt: string;
}

export interface PortfolioItem {
  id: string;
  title: string;
  category: 'Musik Tari' | 'Musik Non-Tari' | 'Transkripsi';
  culture: string;
  duration: string;
  year: string;
  image?: string;
  audioDemoUrl?: string;
  description: string;
}

export interface TestimonialItem {
  id: string;
  name: string;
  role: string;
  quote: string;
  outcome: string;
}

export interface StudioSettings {
  studioWhatsApp: string;
  studioEmail: string;
  studioAddress: string;
  studioBankName: string;
  studioBankAccount: string;
  studioBankHolder: string;
}

export interface SiteContent {
  portfolio: PortfolioItem[];
  testimonials: TestimonialItem[];
  settings: StudioSettings;
}

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
}
