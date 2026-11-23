# Security Specification: PrangArt Lab Music Production Studio

## 1. Roles & Trust Boundaries
- **Public (Unauthenticated)**: Can only read non-PII catalog (`/config/catalog`), public studio portfolio/testimonials/contact settings (`/config/siteContent`), and health check (`/test/connection`). Cannot read or list `/users`, `/projects`, `/admins`, or `/notifications`.
- **Client (`request.auth != null && request.auth.token.email_verified == true`)**:
  - Owns their `/users/{uid}` document. Cannot change `role`, `uid`, `email`, or `createdAt`, and cannot list other clients.
  - Can create `/projects/{projectId}` only with `clientId == request.auth.uid`, valid `MENUNGGU_DP` initial stage, `canDownloadReceipt == false`, `canDownloadMaster == false`, and `request.time` timestamps.
  - Can update ONLY payment-confirmation-in-progress fields (`paymentStage`, `dpStatus`, `finalPaymentStatus`, `clientWa`, `clientName`, `updatedAt`) when transitioning from `MENUNGGU_DP` -> `DP_KONFIRMASI_KLIEN` or `DP_TERVERIFIKASI` -> `PELUNASAN_KONFIRMASI_KLIEN`, or refreshing `updatedAt` on notes/profile sync. Cannot set `DP_TERVERIFIKASI`, `LUNAS`, `canDownloadMaster: true`, `canDownloadReceipt: true`, or modify `totalPrice`/`dpAmount`/`remainingAmount`/`clientId`.
  - Can add confirmations (`/projects/{projectId}/confirmations/{confId}`) and client notes (`/projects/{projectId}/notes/{noteId}`) only when owning the parent project and matching `clientId == request.auth.uid`.
  - Can create `admin`-targeted notifications (`recipientRole == 'admin'`) with `actorUid == request.auth.uid` and `read == false`, and can mark their own `client` notifications as `read: true`.
- **Admin (`request.auth.token.email == 'prangart.lab@gmail.com' && request.auth.token.email_verified == true` OR `/admins/{uid}` exists)**:
  - Full operational control over verification (`DP_TERVERIFIKASI`, `LUNAS`, `canDownloadReceipt`, `canDownloadMaster`, `productionStatus`, `masterFileUrl`), replies (`/notes`), deleting projects, updating `/config/catalog` and `/config/siteContent`, reading client list `/users`, and managing notifications.

## 2. Data Invariants & Field Bounds
- Document IDs validated via `^[a-zA-Z0-9_-]{3,80}$`.
- Strings bounded cleanly (`judul <= 180`, `message <= 3000`, `sinopsis <= 8000`, `specs <= 30 items`).
- Server timestamps (`request.time`) strictly required for `createdAt` / `updatedAt` / `submittedAt`.
- Subcollections used for `confirmations` and `notes` to prevent unbounded parent document arrays.

## 3. Dirty Dozen Attack Payloads (Must All Be REJECTED by Rules)
1. **Unauthenticated PII / Project Read**: Anonymous request attempts `get(/projects/{id})` or `list(/users)` -> DENY.
2. **Cross-Tenant Project Read**: Client B attempts `get(/projects/{clientAProjectId})` -> DENY.
3. **Client Enumeration (List /users)**: Client A attempts `list(/users)` -> DENY.
4. **Role Escalation via User Update**: Client A updates `/users/{uidA}` with `{ role: 'admin' }` -> DENY.
5. **Fake Admin Registration**: Client A attempts `create(/admins/{uidA})` -> DENY.
6. **Self-Verification Fraud on Project Create**: Client A creates `/projects/{id}` with `paymentStage: 'LUNAS'` or `canDownloadMaster: true` -> DENY.
7. **Self-Verification Fraud on Project Update**: Client A updates `/projects/{id}` with `paymentStage: 'LUNAS'`, `canDownloadReceipt: true`, or alters `totalPrice: 1` -> DENY.
8. **Ownership Hijack**: Client B creates a project with `clientId: uidA` or updates Client A's project -> DENY.
9. **Note Author Spoofing**: Client A writes a note to `/projects/{id}/notes/{noteId}` claiming `authorRole: 'admin'` -> DENY.
10. **Cross-Tenant Subcollection Injection**: Client B writes confirmation/note under Client A's project -> DENY.
11. **Notification Tampering / Spam**: Client A sends notification with `recipientRole: 'client'` to Client B or marks admin notification as read -> DENY.
12. **Catalog / Public Content Defacement**: Client A attempts to overwrite `/config/catalog` or `/config/siteContent` -> DENY.
