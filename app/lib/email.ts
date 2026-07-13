import { Resend } from 'resend';

let client: Resend | null = null;

function hasResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function getResendClient(): Resend {
  if (client) return client;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is not set');
  }
  client = new Resend(apiKey);
  return client;
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  if (!hasResendConfigured()) {
    // Dev/local fallback: log the link instead of failing the request, so
    // the reset flow is still testable without a Resend account.
    console.warn('[email] RESEND_API_KEY not set - password reset link for', to, 'is:', resetUrl);
    return;
  }

  const resend = getResendClient();
  const from = process.env.RESEND_FROM_EMAIL || 'Relay <onboarding@resend.dev>';

  const { error } = await resend.emails.send({
    from,
    to,
    subject: 'Reset your Relay Plus password',
    html: `
      <p>Someone requested a password reset for your Relay Plus account.</p>
      <p><a href="${resetUrl}">Click here to set a new password</a>. This link expires in 1 hour.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
  });

  if (error) {
    throw new Error(`Failed to send password reset email: ${error.message}`);
  }
}
