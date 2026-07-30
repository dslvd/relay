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

export async function sendPlusWelcomeEmail(to: string, setPasswordUrl: string): Promise<void> {
  if (!hasResendConfigured()) {
    // Dev/local fallback: log the link instead of failing the webhook, so
    // the provisioning flow is still testable without a Resend account.
    console.warn('[email] RESEND_API_KEY not set - Plus welcome/set-password link for', to, 'is:', setPasswordUrl);
    return;
  }

  const resend = getResendClient();
  const from = process.env.RESEND_FROM_EMAIL || 'Relay <onboarding@resend.dev>';

  const { error } = await resend.emails.send({
    from,
    to,
    subject: 'Your Relay Plus subscription is active',
    html: `
      <p>Thanks for subscribing to Relay Plus! Your account now has 80GB of storage and an 8GB per-file upload limit.</p>
      <p><a href="${setPasswordUrl}">Click here to set your password</a> and log in. This link expires in 1 hour.</p>
      <p>If you need a new link later, use "Forgot password" on the Relay Plus login page.</p>
    `,
  });

  if (error) {
    throw new Error(`Failed to send Plus welcome email: ${error.message}`);
  }
}

export async function sendAbuseReportEmail(report: {
  url: string;
  category: string;
  description: string;
  reporterEmail?: string;
}): Promise<void> {
  const to = process.env.ABUSE_REPORT_EMAIL || 'contactdslvd@gmail.com';

  if (!hasResendConfigured()) {
    // Dev/local fallback: log the report instead of failing the request, so
    // the report is still captured (and testable) without a Resend account.
    console.warn('[email] RESEND_API_KEY not set - abuse report:', report);
    return;
  }

  const resend = getResendClient();
  const from = process.env.RESEND_FROM_EMAIL || 'Relay <onboarding@resend.dev>';
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const { error } = await resend.emails.send({
    from,
    to,
    subject: `[Relay] Abuse report: ${report.category}`,
    html: `
      <p><strong>Reported URL:</strong> ${escape(report.url)}</p>
      <p><strong>Category:</strong> ${escape(report.category)}</p>
      <p><strong>Description:</strong><br>${escape(report.description).replace(/\n/g, '<br>')}</p>
      <p><strong>Reporter contact:</strong> ${report.reporterEmail ? escape(report.reporterEmail) : '(not provided)'}</p>
    `,
  });

  if (error) {
    throw new Error(`Failed to send abuse report email: ${error.message}`);
  }
}
