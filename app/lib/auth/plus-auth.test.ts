import { describe, expect, it } from 'vitest';
import {
  authenticatePlusUser,
  createPlusInvite,
  createPlusSession,
  createPlusUserFromInvite,
  deletePlusUser,
  destroyPlusSession,
  getPlusUserFromSession,
  revokePlusInvite,
} from './plus-auth';

// These exercise the in-memory fallback path (no SUPABASE_URL in the test
// environment) - the Supabase-backed path is verified against a real
// project once SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are configured.
function uniqueEmail(): string {
  return `test-${crypto.randomUUID()}@example.com`;
}

describe('plus-auth register/login', () => {
  it('registers with a valid invite, then logs in with the correct password', async () => {
    const invite = await createPlusInvite(24);
    const email = uniqueEmail();

    const { user, error } = await createPlusUserFromInvite({
      inviteToken: invite.token,
      email,
      password: 'correct horse battery staple',
    });

    expect(error).toBeUndefined();
    expect(user?.email).toBe(email.toLowerCase());

    const authed = await authenticatePlusUser(email, 'correct horse battery staple');
    expect(authed?.id).toBe(user?.id);
  });

  it('rejects login with the wrong password', async () => {
    const invite = await createPlusInvite(24);
    const email = uniqueEmail();
    await createPlusUserFromInvite({ inviteToken: invite.token, email, password: 'right-password' });

    const authed = await authenticatePlusUser(email, 'wrong-password');
    expect(authed).toBeNull();
  });

  it('rejects a second registration attempt using the same invite token', async () => {
    const invite = await createPlusInvite(24);
    const first = await createPlusUserFromInvite({
      inviteToken: invite.token,
      email: uniqueEmail(),
      password: 'password-one',
    });
    expect(first.user).toBeDefined();

    const second = await createPlusUserFromInvite({
      inviteToken: invite.token,
      email: uniqueEmail(),
      password: 'password-two',
    });
    expect(second.user).toBeUndefined();
    expect(second.error).toBe('Invite link already used');
  });

  it('rejects registration with a garbage token', async () => {
    const { user, error } = await createPlusUserFromInvite({
      inviteToken: 'not-a-real-token',
      email: uniqueEmail(),
      password: 'whatever',
    });
    expect(user).toBeUndefined();
    expect(error).toBe('Invalid invite link');
  });

  it('rejects registration after the invite has been revoked', async () => {
    const invite = await createPlusInvite(24);
    const revoked = await revokePlusInvite(invite.id);
    expect(revoked).toBe(true);

    const { user, error } = await createPlusUserFromInvite({
      inviteToken: invite.token,
      email: uniqueEmail(),
      password: 'whatever',
    });
    expect(user).toBeUndefined();
    expect(error).toBe('Invalid invite link');
  });
});

describe('plus-auth sessions', () => {
  it('creates a session and resolves the user from it', async () => {
    const invite = await createPlusInvite(24);
    const email = uniqueEmail();
    const { user } = await createPlusUserFromInvite({ inviteToken: invite.token, email, password: 'pw' });
    expect(user).toBeDefined();

    const token = await createPlusSession(user!.id);
    const resolved = await getPlusUserFromSession(token);
    expect(resolved?.id).toBe(user!.id);
  });

  it('no longer resolves a destroyed session', async () => {
    const invite = await createPlusInvite(24);
    const email = uniqueEmail();
    const { user } = await createPlusUserFromInvite({ inviteToken: invite.token, email, password: 'pw' });

    const token = await createPlusSession(user!.id);
    await destroyPlusSession(token);

    const resolved = await getPlusUserFromSession(token);
    expect(resolved).toBeNull();
  });

  it('returns null for a session token that never existed', async () => {
    const resolved = await getPlusUserFromSession('totally-made-up-token');
    expect(resolved).toBeNull();
  });

  it('invalidates sessions when the user is deleted', async () => {
    const invite = await createPlusInvite(24);
    const email = uniqueEmail();
    const { user } = await createPlusUserFromInvite({ inviteToken: invite.token, email, password: 'pw' });

    const token = await createPlusSession(user!.id);
    await deletePlusUser(user!.id);

    const resolved = await getPlusUserFromSession(token);
    expect(resolved).toBeNull();
  });
});
