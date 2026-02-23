import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'crypto';

export interface PremiumUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: number;
  lastLoginAt?: number;
}

export interface PremiumInviteRecord {
  id: string;
  token: string;
  createdAt: number;
  expiresAt: number;
  usedAt?: number;
  usedByUserId?: string;
}

interface PremiumSessionRecord {
  id: string;
  token: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const INVITE_SECRET = process.env.PREMIUM_INVITE_SECRET ?? process.env.ADMIN_PASSWORD ?? 'premium-invite-secret';

interface InviteTokenPayload {
  id: string;
  exp: number;
}

function getStore() {
  const holder = global as {
    premiumUsers?: PremiumUserRecord[];
    premiumInvites?: PremiumInviteRecord[];
    premiumSessions?: PremiumSessionRecord[];
    premiumUsedInviteHashes?: string[];
    premiumRevokedInviteIds?: string[];
  };

  if (!holder.premiumUsers) holder.premiumUsers = [];
  if (!holder.premiumInvites) holder.premiumInvites = [];
  if (!holder.premiumSessions) holder.premiumSessions = [];
  if (!holder.premiumUsedInviteHashes) holder.premiumUsedInviteHashes = [];
  if (!holder.premiumRevokedInviteIds) holder.premiumRevokedInviteIds = [];

  return holder;
}

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function signInvitePayload(payloadEncoded: string): string {
  return createHmac('sha256', INVITE_SECRET).update(payloadEncoded).digest('base64url');
}

function createInviteToken(payload: InviteTokenPayload): string {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signInvitePayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function parseInviteToken(token: string): InviteTokenPayload | null {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  const expectedSignature = signInvitePayload(encodedPayload);
  if (!safeEqual(signature, expectedSignature)) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(encodedPayload)) as InviteTokenPayload;
    if (!parsed?.id || typeof parsed.exp !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function hashPassword(password: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${password}`).digest('hex');
}

function generateToken(): string {
  return randomBytes(24).toString('hex');
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export function listPremiumUsers(): PremiumUserRecord[] {
  const store = getStore();
  return [...store.premiumUsers!].sort((a, b) => b.createdAt - a.createdAt);
}

export function listPremiumInvites(): PremiumInviteRecord[] {
  const store = getStore();
  return [...store.premiumInvites!].sort((a, b) => b.createdAt - a.createdAt);
}

export function createPremiumInvite(ttlHours: number): PremiumInviteRecord {
  const store = getStore();
  const now = Date.now();
  const id = randomUUID();
  const expiresAt = now + Math.max(1, ttlHours) * 60 * 60 * 1000;
  const invite: PremiumInviteRecord = {
    id,
    token: createInviteToken({ id, exp: expiresAt }),
    createdAt: now,
    expiresAt,
  };

  store.premiumInvites!.unshift(invite);
  return invite;
}

export function revokePremiumInvite(inviteId: string): boolean {
  const store = getStore();
  if (!store.premiumRevokedInviteIds!.includes(inviteId)) {
    store.premiumRevokedInviteIds!.push(inviteId);
  }
  const before = store.premiumInvites!.length;
  store.premiumInvites = store.premiumInvites!.filter((invite) => invite.id !== inviteId);
  return store.premiumInvites.length !== before;
}

export function deletePremiumUser(userId: string): boolean {
  const store = getStore();
  const before = store.premiumUsers!.length;
  store.premiumUsers = store.premiumUsers!.filter((user) => user.id !== userId);
  store.premiumSessions = store.premiumSessions!.filter((session) => session.userId !== userId);
  return store.premiumUsers.length !== before;
}

export function createPremiumUserFromInvite(input: {
  inviteToken: string;
  email: string;
  password: string;
}): { user?: PremiumUserRecord; error?: string } {
  const store = getStore();
  const now = Date.now();
  const normalizedEmail = input.email.trim().toLowerCase();
  const inviteTokenHash = hashInviteToken(input.inviteToken);

  if (store.premiumUsedInviteHashes!.includes(inviteTokenHash)) {
    return { error: 'Invite link already used' };
  }

  const parsedInvite = parseInviteToken(input.inviteToken);
  if (!parsedInvite) return { error: 'Invalid invite link' };
  if (parsedInvite.exp <= now) return { error: 'Invite link expired' };
  if (store.premiumRevokedInviteIds!.includes(parsedInvite.id)) {
    return { error: 'Invalid invite link' };
  }

  const invite = store.premiumInvites!.find((candidate) => safeEqual(candidate.token, input.inviteToken));
  if (invite) {
    if (invite.usedAt) return { error: 'Invite link already used' };
    if (invite.expiresAt <= now) return { error: 'Invite link expired' };
  }

  const existing = store.premiumUsers!.find((candidate) => candidate.email === normalizedEmail);
  if (existing) return { error: 'Email already registered' };

  const salt = randomBytes(16).toString('hex');
  const user: PremiumUserRecord = {
    id: randomUUID(),
    email: normalizedEmail,
    salt,
    passwordHash: hashPassword(input.password, salt),
    createdAt: now,
  };

  store.premiumUsers!.push(user);
  if (invite) {
    invite.usedAt = now;
    invite.usedByUserId = user.id;
  }
  store.premiumUsedInviteHashes!.push(inviteTokenHash);

  return { user };
}

export function authenticatePremiumUser(email: string, password: string): PremiumUserRecord | null {
  const store = getStore();
  const normalizedEmail = email.trim().toLowerCase();
  const user = store.premiumUsers!.find((candidate) => candidate.email === normalizedEmail);
  if (!user) return null;

  const expected = hashPassword(password, user.salt);
  if (!safeEqual(expected, user.passwordHash)) return null;

  user.lastLoginAt = Date.now();
  return user;
}

export function createPremiumSession(userId: string): string {
  const store = getStore();
  const now = Date.now();
  const token = generateToken();

  store.premiumSessions = store.premiumSessions!
    .filter((session) => session.expiresAt > now)
    .concat({
      id: randomUUID(),
      token,
      userId,
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS,
    });

  return token;
}

export function getPremiumUserFromSession(token: string): PremiumUserRecord | null {
  const store = getStore();
  const now = Date.now();
  store.premiumSessions = store.premiumSessions!.filter((session) => session.expiresAt > now);

  const session = store.premiumSessions!.find((candidate) => safeEqual(candidate.token, token));
  if (!session) return null;

  return store.premiumUsers!.find((user) => user.id === session.userId) ?? null;
}

export function destroyPremiumSession(token: string): void {
  const store = getStore();
  store.premiumSessions = store.premiumSessions!.filter((session) => !safeEqual(session.token, token));
}
