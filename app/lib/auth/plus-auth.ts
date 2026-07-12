import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { getRedisClient, hasRedisConfigured } from '@/app/lib/data/redis-client';

export interface PlusUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: number;
  lastLoginAt?: number;
}

export interface PlusInviteRecord {
  id: string;
  token: string;
  createdAt: number;
  expiresAt: number;
  usedAt?: number;
  usedByUserId?: string;
}

interface PlusSessionRecord {
  id: string;
  token: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}

interface FallbackStore {
  plusUsers?: PlusUserRecord[];
  plusInvites?: PlusInviteRecord[];
  plusSessions?: PlusSessionRecord[];
  plusUsedInviteHashes?: string[];
  plusRevokedInviteIds?: string[];
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const INVITE_SECRET = process.env.PLUS_INVITE_SECRET ?? process.env.ADMIN_PASSWORD ?? 'plus-invite-secret';
const PLUS_AUTH_STATE_KEY = 'plus_auth_state';

interface D1QueryResponse<T = unknown> {
  success?: boolean;
  errors?: Array<{ message?: string }>;
  result?: Array<{
    success?: boolean;
    error?: string;
    results?: T[];
  }>;
}

interface InviteTokenPayload {
  id: string;
  exp: number;
}

interface PlusAuthState {
  users: PlusUserRecord[];
  invites: PlusInviteRecord[];
  sessions: PlusSessionRecord[];
  usedInviteHashes: string[];
  revokedInviteIds: string[];
}

const EMPTY_AUTH_STATE: PlusAuthState = {
  users: [],
  invites: [],
  sessions: [],
  usedInviteHashes: [],
  revokedInviteIds: [],
};

function getStore() {
  const holder = global as FallbackStore;

  if (!holder.plusUsers) holder.plusUsers = [];
  if (!holder.plusInvites) holder.plusInvites = [];
  if (!holder.plusSessions) holder.plusSessions = [];
  if (!holder.plusUsedInviteHashes) holder.plusUsedInviteHashes = [];
  if (!holder.plusRevokedInviteIds) holder.plusRevokedInviteIds = [];

  return holder;
}

function hasD1Configured(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
    process.env.CLOUDFLARE_D1_DATABASE_ID &&
    process.env.CLOUDFLARE_API_TOKEN
  );
}

function getD1Endpoint(): string {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;

  if (!accountId || !databaseId) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_D1_DATABASE_ID is missing');
  }

  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
}

async function d1Query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    throw new Error('CLOUDFLARE_API_TOKEN is missing');
  }

  const response = await fetch(getD1Endpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ sql, params }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`D1 request failed: ${response.status} ${errorText}`);
  }

  const payload = (await response.json()) as D1QueryResponse<T>;
  const topError = payload.errors?.[0]?.message;
  if (topError) {
    throw new Error(`D1 error: ${topError}`);
  }

  const result = payload.result?.[0];
  if (!result?.success) {
    throw new Error(result?.error || 'D1 query failed');
  }

  return result.results || [];
}

async function ensureD1Schema(): Promise<void> {
  await d1Query(
    `CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`
  );
}

function normalizeAuthState(input: unknown): PlusAuthState {
  const parsed = (input || {}) as Partial<PlusAuthState>;
  return {
    users: Array.isArray(parsed.users) ? parsed.users : [],
    invites: Array.isArray(parsed.invites) ? parsed.invites : [],
    sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    usedInviteHashes: Array.isArray(parsed.usedInviteHashes) ? parsed.usedInviteHashes : [],
    revokedInviteIds: Array.isArray(parsed.revokedInviteIds) ? parsed.revokedInviteIds : [],
  };
}

async function readAuthStateFromD1(): Promise<PlusAuthState> {
  await ensureD1Schema();
  const rows = await d1Query<{ value: string }>('SELECT value FROM app_state WHERE key = ? LIMIT 1', [PLUS_AUTH_STATE_KEY]);

  if (!rows.length || !rows[0].value) {
    return { ...EMPTY_AUTH_STATE };
  }

  try {
    return normalizeAuthState(JSON.parse(rows[0].value));
  } catch {
    return { ...EMPTY_AUTH_STATE };
  }
}

async function readAuthStateFromRedis(): Promise<PlusAuthState> {
  const client = await getRedisClient();
  const raw = await client.get(PLUS_AUTH_STATE_KEY);
  if (!raw) {
    return { ...EMPTY_AUTH_STATE };
  }

  try {
    return normalizeAuthState(JSON.parse(raw));
  } catch {
    return { ...EMPTY_AUTH_STATE };
  }
}

async function writeAuthStateToD1(state: PlusAuthState): Promise<void> {
  await ensureD1Schema();
  await d1Query(
    `INSERT INTO app_state (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`,
    [PLUS_AUTH_STATE_KEY, JSON.stringify(state), Date.now()]
  );
}

async function writeAuthStateToRedis(state: PlusAuthState): Promise<void> {
  const client = await getRedisClient();
  await client.set(PLUS_AUTH_STATE_KEY, JSON.stringify(state));
}

async function readAuthState(): Promise<PlusAuthState> {
  if (hasD1Configured()) {
    return readAuthStateFromD1();
  }

  if (hasRedisConfigured()) {
    return readAuthStateFromRedis();
  }

  const store = getStore();
  return {
    users: [...(store.plusUsers || [])],
    invites: [...(store.plusInvites || [])],
    sessions: [...(store.plusSessions || [])],
    usedInviteHashes: [...(store.plusUsedInviteHashes || [])],
    revokedInviteIds: [...(store.plusRevokedInviteIds || [])],
  };
}

async function writeAuthState(state: PlusAuthState): Promise<void> {
  if (hasD1Configured()) {
    await writeAuthStateToD1(state);
    return;
  }

  if (hasRedisConfigured()) {
    await writeAuthStateToRedis(state);
    return;
  }

  const store = getStore();
  store.plusUsers = state.users;
  store.plusInvites = state.invites;
  store.plusSessions = state.sessions;
  store.plusUsedInviteHashes = state.usedInviteHashes;
  store.plusRevokedInviteIds = state.revokedInviteIds;
}

export async function checkPlusStorageHealth(): Promise<{
  configured: boolean;
  ok: boolean;
  pong?: string;
  error?: string;
}> {
  if (!hasD1Configured()) {
    if (!hasRedisConfigured()) {
      return {
        configured: false,
        ok: false,
        error: 'CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, or CLOUDFLARE_API_TOKEN is missing',
      };
    }

    try {
      await getRedisClient();
      return { configured: true, ok: true, pong: 'REDIS_OK' };
    } catch (error) {
      return {
        configured: true,
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  try {
    await ensureD1Schema();
    return {
      configured: true,
      ok: true,
      pong: 'D1_OK',
    };
  } catch (error) {
    return {
      configured: true,
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function readUsers(): Promise<PlusUserRecord[]> {
  const state = await readAuthState();
  return [...state.users];
}

async function writeUsers(users: PlusUserRecord[]): Promise<void> {
  const state = await readAuthState();
  state.users = users;
  await writeAuthState(state);
}

async function readInvites(): Promise<PlusInviteRecord[]> {
  const state = await readAuthState();
  return [...state.invites];
}

async function writeInvites(invites: PlusInviteRecord[]): Promise<void> {
  const state = await readAuthState();
  state.invites = invites;
  await writeAuthState(state);
}

async function readSessions(): Promise<PlusSessionRecord[]> {
  const state = await readAuthState();
  return [...state.sessions];
}

async function writeSessions(sessions: PlusSessionRecord[]): Promise<void> {
  const state = await readAuthState();
  state.sessions = sessions;
  await writeAuthState(state);
}

async function readUsedInviteHashes(): Promise<string[]> {
  const state = await readAuthState();
  return [...state.usedInviteHashes];
}

async function writeUsedInviteHashes(hashes: string[]): Promise<void> {
  const state = await readAuthState();
  state.usedInviteHashes = hashes;
  await writeAuthState(state);
}

async function readRevokedInviteIds(): Promise<string[]> {
  const state = await readAuthState();
  return [...state.revokedInviteIds];
}

async function writeRevokedInviteIds(ids: string[]): Promise<void> {
  const state = await readAuthState();
  state.revokedInviteIds = ids;
  await writeAuthState(state);
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

export async function listPlusUsers(): Promise<PlusUserRecord[]> {
  const users = await readUsers();
  return [...users].sort((a, b) => b.createdAt - a.createdAt);
}

export async function listPlusInvites(): Promise<PlusInviteRecord[]> {
  const invites = await readInvites();
  return [...invites].sort((a, b) => b.createdAt - a.createdAt);
}

export async function createPlusInvite(ttlHours: number): Promise<PlusInviteRecord> {
  const invites = await readInvites();
  const now = Date.now();
  const id = randomUUID();
  const expiresAt = now + Math.max(1, ttlHours) * 60 * 60 * 1000;
  const invite: PlusInviteRecord = {
    id,
    token: createInviteToken({ id, exp: expiresAt }),
    createdAt: now,
    expiresAt,
  };

  invites.unshift(invite);
  await writeInvites(invites);
  return invite;
}

export async function revokePlusInvite(inviteId: string): Promise<boolean> {
  const state = await readAuthState();
  const revokedIds = [...state.revokedInviteIds];
  const invites = [...state.invites];

  if (!revokedIds.includes(inviteId)) {
    revokedIds.push(inviteId);
  }

  const before = invites.length;
  const filteredInvites = invites.filter((invite) => invite.id !== inviteId);

  state.revokedInviteIds = revokedIds;
  state.invites = filteredInvites;
  await writeAuthState(state);

  return filteredInvites.length !== before;
}

export async function deletePlusUser(userId: string): Promise<boolean> {
  const state = await readAuthState();
  const users = [...state.users];
  const sessions = [...state.sessions];
  const before = users.length;
  const filteredUsers = users.filter((user) => user.id !== userId);
  const filteredSessions = sessions.filter((session) => session.userId !== userId);

  state.users = filteredUsers;
  state.sessions = filteredSessions;
  await writeAuthState(state);

  return filteredUsers.length !== before;
}

export async function createPlusUserFromInvite(input: {
  inviteToken: string;
  email: string;
  password: string;
}): Promise<{ user?: PlusUserRecord; error?: string }> {
  const state = await readAuthState();
  const usedInviteHashes = [...state.usedInviteHashes];
  const revokedInviteIds = [...state.revokedInviteIds];
  const invites = [...state.invites];
  const users = [...state.users];

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
  if (!invite) return { error: 'Invalid invite link' };
  if (invite.usedAt) return { error: 'Invite link already used' };
  if (invite.expiresAt <= now) return { error: 'Invite link expired' };

  const existing = users.find((candidate) => candidate.email === normalizedEmail);
  if (existing) return { error: 'Email already registered' };

  const salt = randomBytes(16).toString('hex');
  const user: PlusUserRecord = {
    id: randomUUID(),
    email: normalizedEmail,
    salt,
    passwordHash: hashPassword(input.password, salt),
    createdAt: now,
  };

  const updatedUsers = [...users, user];
  const updatedInvites = invites.filter((candidate) => candidate.id !== invite.id);

  const updatedUsedHashes = [...usedInviteHashes, inviteTokenHash];
  const updatedRevokedInviteIds = revokedInviteIds.includes(invite.id)
    ? revokedInviteIds
    : [...revokedInviteIds, invite.id];

  state.users = updatedUsers;
  state.invites = updatedInvites;
  state.usedInviteHashes = updatedUsedHashes;
  state.revokedInviteIds = updatedRevokedInviteIds;
  await writeAuthState(state);

  return { user };
}

export async function authenticatePlusUser(email: string, password: string): Promise<PlusUserRecord | null> {
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

export async function createPlusSession(userId: string): Promise<string> {
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

export async function getPlusUserFromSession(token: string): Promise<PlusUserRecord | null> {
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

export async function destroyPlusSession(token: string): Promise<void> {
  const sessions = await readSessions();
  const filteredSessions = sessions.filter((session) => !safeEqual(session.token, token));
  await writeSessions(filteredSessions);
}
