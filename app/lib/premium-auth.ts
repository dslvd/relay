import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { getRedisClient, hasRedisConfigured } from '@/app/lib/redis-client';

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

interface FallbackStore {
  premiumUsers?: PremiumUserRecord[];
  premiumInvites?: PremiumInviteRecord[];
  premiumSessions?: PremiumSessionRecord[];
  premiumUsedInviteHashes?: string[];
  premiumRevokedInviteIds?: string[];
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const INVITE_SECRET = process.env.PREMIUM_INVITE_SECRET ?? process.env.ADMIN_PASSWORD ?? 'premium-invite-secret';

interface InviteTokenPayload {
  id: string;
  exp: number;
}

const REDIS_KEYS = {
  users: 'premium:users',
  invites: 'premium:invites',
  sessions: 'premium:sessions',
  usedInviteHashes: 'premium:used-invite-hashes',
  revokedInviteIds: 'premium:revoked-invite-ids',
};

function getStore() {
  const holder = global as FallbackStore;

  if (!holder.premiumUsers) holder.premiumUsers = [];
  if (!holder.premiumInvites) holder.premiumInvites = [];
  if (!holder.premiumSessions) holder.premiumSessions = [];
  if (!holder.premiumUsedInviteHashes) holder.premiumUsedInviteHashes = [];
  if (!holder.premiumRevokedInviteIds) holder.premiumRevokedInviteIds = [];

  return holder;
}

export async function checkPremiumStorageHealth(): Promise<{
  configured: boolean;
  ok: boolean;
  pong?: string;
  error?: string;
}> {
  if (!hasRedisConfigured()) {
    return {
      configured: false,
      ok: false,
      error: 'REDIS_URL is not set',
    };
  }

  try {
    const client = await getRedisClient();
    const pong = await client.ping();
    return {
      configured: true,
      ok: pong === 'PONG',
      pong,
    };
  } catch (error) {
    return {
      configured: true,
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function readUsers(): Promise<PremiumUserRecord[]> {
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    const data = await client.get(REDIS_KEYS.users);
    return data ? JSON.parse(data) : [];
  }
  const store = getStore();
  return [...(store.premiumUsers || [])];
}

async function writeUsers(users: PremiumUserRecord[]): Promise<void> {
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    await client.set(REDIS_KEYS.users, JSON.stringify(users));
    return;
  }
  const store = getStore();
  store.premiumUsers = users;
}

async function readInvites(): Promise<PremiumInviteRecord[]> {
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    const data = await client.get(REDIS_KEYS.invites);
    return data ? JSON.parse(data) : [];
  }
  const store = getStore();
  return [...(store.premiumInvites || [])];
}

async function writeInvites(invites: PremiumInviteRecord[]): Promise<void> {
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    await client.set(REDIS_KEYS.invites, JSON.stringify(invites));
    return;
  }
  const store = getStore();
  store.premiumInvites = invites;
}

async function readSessions(): Promise<PremiumSessionRecord[]> {
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    const data = await client.get(REDIS_KEYS.sessions);
    return data ? JSON.parse(data) : [];
  }
  const store = getStore();
  return [...(store.premiumSessions || [])];
}

async function writeSessions(sessions: PremiumSessionRecord[]): Promise<void> {
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    await client.set(REDIS_KEYS.sessions, JSON.stringify(sessions));
    return;
  }
  const store = getStore();
  store.premiumSessions = sessions;
}

async function readUsedInviteHashes(): Promise<string[]> {
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    const data = await client.get(REDIS_KEYS.usedInviteHashes);
    return data ? JSON.parse(data) : [];
  }
  const store = getStore();
  return [...(store.premiumUsedInviteHashes || [])];
}

async function writeUsedInviteHashes(hashes: string[]): Promise<void> {
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    await client.set(REDIS_KEYS.usedInviteHashes, JSON.stringify(hashes));
    return;
  }
  const store = getStore();
  store.premiumUsedInviteHashes = hashes;
}

async function readRevokedInviteIds(): Promise<string[]> {
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    const data = await client.get(REDIS_KEYS.revokedInviteIds);
    return data ? JSON.parse(data) : [];
  }
  const store = getStore();
  return [...(store.premiumRevokedInviteIds || [])];
}

async function writeRevokedInviteIds(ids: string[]): Promise<void> {
  if (hasRedisConfigured()) {
    const client = await getRedisClient();
    await client.set(REDIS_KEYS.revokedInviteIds, JSON.stringify(ids));
    return;
  }
  const store = getStore();
  store.premiumRevokedInviteIds = ids;
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

export async function listPremiumUsers(): Promise<PremiumUserRecord[]> {
  const users = await readUsers();
  return [...users].sort((a, b) => b.createdAt - a.createdAt);
}

export async function listPremiumInvites(): Promise<PremiumInviteRecord[]> {
  const invites = await readInvites();
  return [...invites].sort((a, b) => b.createdAt - a.createdAt);
}

export async function createPremiumInvite(ttlHours: number): Promise<PremiumInviteRecord> {
  const invites = await readInvites();
  const now = Date.now();
  const id = randomUUID();
  const expiresAt = now + Math.max(1, ttlHours) * 60 * 60 * 1000;
  const invite: PremiumInviteRecord = {
    id,
    token: createInviteToken({ id, exp: expiresAt }),
    createdAt: now,
    expiresAt,
  };

  invites.unshift(invite);
  await writeInvites(invites);
  return invite;
}

export async function revokePremiumInvite(inviteId: string): Promise<boolean> {
  const [revokedIds, invites] = await Promise.all([
    readRevokedInviteIds(),
    readInvites(),
  ]);

  if (!revokedIds.includes(inviteId)) {
    revokedIds.push(inviteId);
  }

  const before = invites.length;
  const filteredInvites = invites.filter((invite) => invite.id !== inviteId);

  await Promise.all([
    writeRevokedInviteIds(revokedIds),
    writeInvites(filteredInvites),
  ]);

  return filteredInvites.length !== before;
}

export async function deletePremiumUser(userId: string): Promise<boolean> {
  const [users, sessions] = await Promise.all([readUsers(), readSessions()]);
  const before = users.length;
  const filteredUsers = users.filter((user) => user.id !== userId);
  const filteredSessions = sessions.filter((session) => session.userId !== userId);

  await Promise.all([
    writeUsers(filteredUsers),
    writeSessions(filteredSessions),
  ]);

  return filteredUsers.length !== before;
}

export async function createPremiumUserFromInvite(input: {
  inviteToken: string;
  email: string;
  password: string;
}): Promise<{ user?: PremiumUserRecord; error?: string }> {
  const [usedInviteHashes, revokedInviteIds, invites, users] = await Promise.all([
    readUsedInviteHashes(),
    readRevokedInviteIds(),
    readInvites(),
    readUsers(),
  ]);

  const now = Date.now();
  const normalizedEmail = input.email.trim().toLowerCase();
  const inviteTokenHash = hashInviteToken(input.inviteToken);

  if (usedInviteHashes.includes(inviteTokenHash)) {
    return { error: 'Invite link already used' };
  }

  const parsedInvite = parseInviteToken(input.inviteToken);
  if (!parsedInvite) return { error: 'Invalid invite link' };
  if (parsedInvite.exp <= now) return { error: 'Invite link expired' };
  if (revokedInviteIds.includes(parsedInvite.id)) {
    return { error: 'Invalid invite link' };
  }

  const invite = invites.find((candidate) => safeEqual(candidate.token, input.inviteToken));
  if (invite) {
    if (invite.usedAt) return { error: 'Invite link already used' };
    if (invite.expiresAt <= now) return { error: 'Invite link expired' };
  }

  const existing = users.find((candidate) => candidate.email === normalizedEmail);
  if (existing) return { error: 'Email already registered' };

  const salt = randomBytes(16).toString('hex');
  const user: PremiumUserRecord = {
    id: randomUUID(),
    email: normalizedEmail,
    salt,
    passwordHash: hashPassword(input.password, salt),
    createdAt: now,
  };

  const updatedUsers = [...users, user];
  const updatedInvites = [...invites];

  if (invite) {
    const inviteIndex = updatedInvites.findIndex((candidate) => candidate.id === invite.id);
    if (inviteIndex >= 0) {
      updatedInvites[inviteIndex] = {
        ...updatedInvites[inviteIndex],
        usedAt: now,
        usedByUserId: user.id,
      };
    }
  }

  const updatedUsedHashes = [...usedInviteHashes, inviteTokenHash];

  await Promise.all([
    writeUsers(updatedUsers),
    writeInvites(updatedInvites),
    writeUsedInviteHashes(updatedUsedHashes),
  ]);

  return { user };
}

export async function authenticatePremiumUser(email: string, password: string): Promise<PremiumUserRecord | null> {
  const users = await readUsers();
  const normalizedEmail = email.trim().toLowerCase();
  const user = users.find((candidate) => candidate.email === normalizedEmail);
  if (!user) return null;

  const expected = hashPassword(password, user.salt);
  if (!safeEqual(expected, user.passwordHash)) return null;

  const updatedUsers = users.map((candidate) =>
    candidate.id === user.id
      ? { ...candidate, lastLoginAt: Date.now() }
      : candidate
  );

  await writeUsers(updatedUsers);
  return updatedUsers.find((candidate) => candidate.id === user.id) || null;
}

export async function createPremiumSession(userId: string): Promise<string> {
  const sessions = await readSessions();
  const now = Date.now();
  const token = generateToken();

  const updatedSessions = sessions
    .filter((session) => session.expiresAt > now)
    .concat({
      id: randomUUID(),
      token,
      userId,
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS,
    });

  await writeSessions(updatedSessions);

  return token;
}

export async function getPremiumUserFromSession(token: string): Promise<PremiumUserRecord | null> {
  const [sessions, users] = await Promise.all([readSessions(), readUsers()]);
  const now = Date.now();
  const activeSessions = sessions.filter((session) => session.expiresAt > now);

  if (activeSessions.length !== sessions.length) {
    await writeSessions(activeSessions);
  }

  const session = activeSessions.find((candidate) => safeEqual(candidate.token, token));
  if (!session) return null;

  return users.find((user) => user.id === session.userId) ?? null;
}

export async function destroyPremiumSession(token: string): Promise<void> {
  const sessions = await readSessions();
  const filteredSessions = sessions.filter((session) => !safeEqual(session.token, token));
  await writeSessions(filteredSessions);
}
