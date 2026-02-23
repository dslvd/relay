import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';

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

function getStore() {
  const holder = global as {
    premiumUsers?: PremiumUserRecord[];
    premiumInvites?: PremiumInviteRecord[];
    premiumSessions?: PremiumSessionRecord[];
  };

  if (!holder.premiumUsers) holder.premiumUsers = [];
  if (!holder.premiumInvites) holder.premiumInvites = [];
  if (!holder.premiumSessions) holder.premiumSessions = [];

  return holder;
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
  const invite: PremiumInviteRecord = {
    id: randomUUID(),
    token: generateToken(),
    createdAt: now,
    expiresAt: now + Math.max(1, ttlHours) * 60 * 60 * 1000,
  };

  store.premiumInvites!.unshift(invite);
  return invite;
}

export function revokePremiumInvite(inviteId: string): boolean {
  const store = getStore();
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

  const invite = store.premiumInvites!.find((candidate) => safeEqual(candidate.token, input.inviteToken));
  if (!invite) return { error: 'Invalid invite link' };
  if (invite.usedAt) return { error: 'Invite link already used' };
  if (invite.expiresAt <= now) return { error: 'Invite link expired' };

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
  invite.usedAt = now;
  invite.usedByUserId = user.id;

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
