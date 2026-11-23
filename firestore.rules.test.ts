/**
 * Security Rules Specification Matrix for PrangArt Lab Firestore Rules.
 * Documents the exact allow/deny expectations for each of the Dirty Dozen attack payloads
 * and valid operational workflows defined in security_spec.md.
 */

export interface SecurityExpectation {
  id: string;
  actor: 'anon' | 'clientA' | 'clientB' | 'admin';
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  expected: 'ALLOW' | 'DENY';
  rationale: string;
}

export const SECURITY_EXPECTATIONS: SecurityExpectation[] = [
  {
    id: 'DD-01',
    actor: 'anon',
    operation: 'get',
    path: '/projects/proj-1',
    expected: 'DENY',
    rationale: 'Unauthenticated users cannot read project records containing client PII.',
  },
  {
    id: 'DD-02',
    actor: 'clientB',
    operation: 'get',
    path: '/projects/proj-clientA',
    expected: 'DENY',
    rationale: 'Clients cannot read projects owned by another UID.',
  },
  {
    id: 'DD-03',
    actor: 'clientA',
    operation: 'list',
    path: '/users',
    expected: 'DENY',
    rationale: 'Prevent user enumeration across client accounts.',
  },
  {
    id: 'DD-04',
    actor: 'clientA',
    operation: 'update',
    path: '/users/uidA',
    expected: 'DENY',
    rationale: 'Cannot escalate role field from client to admin.',
  },
  {
    id: 'DD-05',
    actor: 'clientA',
    operation: 'create',
    path: '/admins/uidA',
    expected: 'DENY',
    rationale: 'Only existing admin can register admin docs.',
  },
  {
    id: 'DD-06',
    actor: 'clientA',
    operation: 'create',
    path: '/projects/proj-fraud',
    expected: 'DENY',
    rationale: 'New orders must start with paymentStage == MENUNGGU_DP and locked receipt/master.',
  },
  {
    id: 'DD-07',
    actor: 'clientA',
    operation: 'update',
    path: '/projects/proj-clientA',
    expected: 'DENY',
    rationale: 'Client cannot set paymentStage to LUNAS or alter pricing/receipt flags.',
  },
  {
    id: 'DD-08',
    actor: 'clientB',
    operation: 'create',
    path: '/projects/proj-hijack',
    expected: 'DENY',
    rationale: 'clientId must equal request.auth.uid on client order creation.',
  },
  {
    id: 'DD-09',
    actor: 'clientA',
    operation: 'create',
    path: '/projects/proj-clientA/notes/note-spoof',
    expected: 'DENY',
    rationale: 'Client note creation strictly enforces authorRole == client and authorUid == request.auth.uid.',
  },
  {
    id: 'DD-10',
    actor: 'clientB',
    operation: 'create',
    path: '/projects/proj-clientA/confirmations/conf-inj',
    expected: 'DENY',
    rationale: 'Parent project ownership is verified on subcollection create.',
  },
  {
    id: 'DD-11',
    actor: 'clientA',
    operation: 'create',
    path: '/notifications/notif-spam',
    expected: 'DENY',
    rationale: 'Clients may only emit unread notifications addressed to admin with their own actorUid.',
  },
  {
    id: 'DD-12',
    actor: 'clientA',
    operation: 'update',
    path: '/config/catalog',
    expected: 'DENY',
    rationale: 'Catalog and public site content are admin-only writable.',
  },
  {
    id: 'OK-01',
    actor: 'anon',
    operation: 'get',
    path: '/config/catalog',
    expected: 'ALLOW',
    rationale: 'Public landing and order estimator pages read non-PII catalog.',
  },
  {
    id: 'OK-02',
    actor: 'admin',
    operation: 'update',
    path: '/projects/proj-clientA',
    expected: 'ALLOW',
    rationale: 'Verified admin can approve DP/Pelunasan, update milestone, and set masterFileUrl.',
  },
];
