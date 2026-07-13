import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'crypto';
import { getSupabaseClient, hasSupabaseConfigured } from '@/app/lib/data/supabase-client';

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
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const INVITE_SECRET = process.env.PLUS_INVITE_SECRET ?? process.env.ADMIN_PASSWORD ?? 'plus-invite-secret';

interface InviteTokenPayload {
  id: string;
  exp: number;
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  salt: string;
  created_at: number;
  last_login_at: number | null;
}

interface InviteRow {
  id: string;
  token: string;
  created_at: number;
  expires_at: number;
  used_at: number | null;
  used_by_user_id: string | null;
}

function userFromRow(row: UserRow): PlusUserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    salt: row.salt,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at ?? undefined,
  };
}

function inviteFromRow(row: InviteRow): PlusInviteRecord {
  return {
    id: row.id,
    token: row.token,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    usedAt: row.used_at ?? undefined,
    usedByUserId: row.used_by_user_id ?? undefined,
  };
}

function getStore(): FallbackStore {
  const holder = global as FallbackStore;
  if (!holder.plusUsers) holder.plusUsers = [];
  if (!holder.plusInvites) holder.plusInvites = [];
  if (!holder.plusSessions) holder.plusSessions = [];
  return holder;
}

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
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

// scrypt is a slow, memory-hard KDF - unlike a raw SHA-256 hash, it can't be
// brute-forced cheaply at scale (e.g. on GPUs), which matters because this
// hashes user-chosen passwords (low entropy) rather than random tokens.
const SCRYPT_KEY_LENGTH = 64;

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString('hex');
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

export async function checkPlusStorageHealth(): Promise<{
  configured: boolean;
  ok: boolean;
  pong?: string;
  error?: string;
}> {
  if (!hasSupabaseConfigured()) {
    return {
      configured: false,
      ok: false,
      error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing',
    };
  }

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('plus_users').select('id').limit(1);
    if (error) throw error;
    return { configured: true, ok: true, pong: 'SUPABASE_OK' };
  } catch (error) {
    return {
      configured: true,
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function listPlusUsers(): Promise<PlusUserRecord[]> {
  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('plus_users')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as UserRow[]).map(userFromRow);
  }

  const store = getStore();
  return [...(store.plusUsers || [])].sort((a, b) => b.createdAt - a.createdAt);
}

export async function listPlusInvites(): Promise<PlusInviteRecord[]> {
  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('plus_invites')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as InviteRow[]).map(inviteFromRow);
  }

  const store = getStore();
  return [...(store.plusInvites || [])].sort((a, b) => b.createdAt - a.createdAt);
}

export async function createPlusInvite(ttlHours: number): Promise<PlusInviteRecord> {
  const now = Date.now();
  const id = randomUUID();
  const expiresAt = now + Math.max(1, ttlHours) * 60 * 60 * 1000;
  const token = createInviteToken({ id, exp: expiresAt });
  const invite: PlusInviteRecord = { id, token, createdAt: now, expiresAt };

  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('plus_invites').insert({
      id,
      token,
      created_at: now,
      expires_at: expiresAt,
    });
    if (error) throw error;
    return invite;
  }

  const store = getStore();
  store.plusInvites = [invite, ...(store.plusInvites || [])];
  return invite;
}

export async function revokePlusInvite(inviteId: string): Promise<boolean> {
  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('plus_invites').delete().eq('id', inviteId).select('id');
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  }

  const store = getStore();
  const before = (store.plusInvites || []).length;
  store.plusInvites = (store.plusInvites || []).filter((invite) => invite.id !== inviteId);
  return store.plusInvites.length !== before;
}

export async function deletePlusUser(userId: string): Promise<boolean> {
  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('plus_users').delete().eq('id', userId).select('id');
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  }

  const store = getStore();
  const before = (store.plusUsers || []).length;
  store.plusUsers = (store.plusUsers || []).filter((user) => user.id !== userId);
  store.plusSessions = (store.plusSessions || []).filter((session) => session.userId !== userId);
  return store.plusUsers.length !== before;
}

export async function createPlusUserFromInvite(input: {
  inviteToken: string;
  email: string;
  password: string;
}): Promise<{ user?: PlusUserRecord; error?: string }> {
  const now = Date.now();
  const normalizedEmail = input.email.trim().toLowerCase();

  const parsedInvite = parseInviteToken(input.inviteToken);
  if (!parsedInvite) return { error: 'Invalid invite link' };
  if (parsedInvite.exp <= now) return { error: 'Invite link expired' };

  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();

    const { data: inviteRow, error: inviteError } = await supabase
      .from('plus_invites')
      .select('*')
      .eq('id', parsedInvite.id)
      .maybeSingle();
    if (inviteError) throw inviteError;
    if (!inviteRow || !safeEqual((inviteRow as InviteRow).token, input.inviteToken)) {
      return { error: 'Invalid invite link' };
    }
    if ((inviteRow as InviteRow).used_at) return { error: 'Invite link already used' };
    if ((inviteRow as InviteRow).expires_at <= now) return { error: 'Invite link expired' };

    const salt = randomBytes(16).toString('hex');
    const userId = randomUUID();
    const user: PlusUserRecord = {
      id: userId,
      email: normalizedEmail,
      salt,
      passwordHash: hashPassword(input.password, salt),
      createdAt: now,
    };

    const { error: insertError } = await supabase.from('plus_users').insert({
      id: user.id,
      email: user.email,
      password_hash: user.passwordHash,
      salt: user.salt,
      created_at: user.createdAt,
    });
    if (insertError) {
      if (insertError.code === '23505') return { error: 'Email already registered' };
      throw insertError;
    }

    // Compare-and-swap: only succeeds if nobody else claimed this invite
    // between our read above and this write.
    const { data: claimed, error: claimError } = await supabase
      .from('plus_invites')
      .update({ used_at: now, used_by_user_id: userId })
      .eq('id', parsedInvite.id)
      .is('used_at', null)
      .select('id');
    if (claimError) throw claimError;
    if (!claimed || claimed.length === 0) {
      await supabase.from('plus_users').delete().eq('id', userId);
      return { error: 'Invite link already used' };
    }

    return { user };
  }

  const store = getStore();
  const invites = store.plusInvites || [];
  const invite = invites.find((candidate) => candidate.id === parsedInvite.id);
  if (!invite || !safeEqual(invite.token, input.inviteToken)) return { error: 'Invalid invite link' };
  if (invite.usedAt) return { error: 'Invite link already used' };
  if (invite.expiresAt <= now) return { error: 'Invite link expired' };

  const users = store.plusUsers || [];
  if (users.some((candidate) => candidate.email === normalizedEmail)) {
    return { error: 'Email already registered' };
  }

  const salt = randomBytes(16).toString('hex');
  const user: PlusUserRecord = {
    id: randomUUID(),
    email: normalizedEmail,
    salt,
    passwordHash: hashPassword(input.password, salt),
    createdAt: now,
  };

  store.plusUsers = [...users, user];
  store.plusInvites = invites.map((candidate) =>
    candidate.id === invite.id ? { ...candidate, usedAt: now, usedByUserId: user.id } : candidate
  );

  return { user };
}

export async function authenticatePlusUser(email: string, password: string): Promise<PlusUserRecord | null> {
  const normalizedEmail = email.trim().toLowerCase();

  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('plus_users').select('*').eq('email', normalizedEmail).maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const user = userFromRow(data as UserRow);
    const expected = hashPassword(password, user.salt);
    if (!safeEqual(expected, user.passwordHash)) return null;

    const lastLoginAt = Date.now();
    const { error: updateError } = await supabase
      .from('plus_users')
      .update({ last_login_at: lastLoginAt })
      .eq('id', user.id);
    if (updateError) throw updateError;

    return { ...user, lastLoginAt };
  }

  const store = getStore();
  const users = store.plusUsers || [];
  const user = users.find((candidate) => candidate.email === normalizedEmail);
  if (!user) return null;

  const expected = hashPassword(password, user.salt);
  if (!safeEqual(expected, user.passwordHash)) return null;

  const lastLoginAt = Date.now();
  store.plusUsers = users.map((candidate) => (candidate.id === user.id ? { ...candidate, lastLoginAt } : candidate));
  return { ...user, lastLoginAt };
}

export async function createPlusSession(userId: string): Promise<string> {
  const now = Date.now();
  const token = generateToken();
  const expiresAt = now + SESSION_TTL_MS;

  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('plus_sessions').insert({
      id: randomUUID(),
      token,
      user_id: userId,
      created_at: now,
      expires_at: expiresAt,
    });
    if (error) throw error;
    return token;
  }

  const store = getStore();
  const sessions = store.plusSessions || [];
  store.plusSessions = sessions
    .filter((session) => session.expiresAt > now)
    .concat({ id: randomUUID(), token, userId, createdAt: now, expiresAt });

  return token;
}

export async function getPlusUserFromSession(token: string): Promise<PlusUserRecord | null> {
  const now = Date.now();

  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data: session, error } = await supabase
      .from('plus_sessions')
      .select('*')
      .eq('token', token)
      .gt('expires_at', now)
      .maybeSingle();
    if (error) throw error;
    if (!session) return null;

    const { data: userRow, error: userError } = await supabase
      .from('plus_users')
      .select('*')
      .eq('id', session.user_id)
      .maybeSingle();
    if (userError) throw userError;
    return userRow ? userFromRow(userRow as UserRow) : null;
  }

  const store = getStore();
  const activeSessions = (store.plusSessions || []).filter((session) => session.expiresAt > now);
  if (activeSessions.length !== (store.plusSessions || []).length) {
    store.plusSessions = activeSessions;
  }

  const session = activeSessions.find((candidate) => safeEqual(candidate.token, token));
  if (!session) return null;

  return (store.plusUsers || []).find((user) => user.id === session.userId) ?? null;
}

export async function destroyPlusSession(token: string): Promise<void> {
  if (hasSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('plus_sessions').delete().eq('token', token);
    if (error) throw error;
    return;
  }

  const store = getStore();
  store.plusSessions = (store.plusSessions || []).filter((session) => !safeEqual(session.token, token));
}

declare global {
  var plusUsers: PlusUserRecord[] | undefined;
  var plusInvites: PlusInviteRecord[] | undefined;
  var plusSessions: PlusSessionRecord[] | undefined;
}
