import type { Metadata } from 'next';
import Link from 'next/link';
import Card from '../components/PolicyCard';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms governing your use of Relay.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  const textStyle: React.CSSProperties = { margin: '0.6rem 0 0' };

  return (
    <main style={{
      minHeight: '100vh',
      padding: '6rem 6vw 4rem',
      background: 'radial-gradient(ellipse at 30% 20%, #1a1035 0%, #0a0a0a 55%), radial-gradient(ellipse at 75% 80%, #0d1f2d 0%, #0a0a0a 60%)',
      backgroundAttachment: 'fixed',
      color: '#f5f5f5',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <section style={{
        width: 'min(980px, 92vw)',
        borderRadius: '28px',
        border: '1px solid rgba(255, 255, 255, 0.16)',
        background: 'rgba(255, 255, 255, 0.04)',
        padding: '3rem',
        boxShadow: '0 22px 60px rgba(0, 0, 0, 0.45)'
      }}>
        <div style={{ fontSize: '0.8rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(245, 245, 245, 0.55)' }}>
          Legal
        </div>
        <h1 style={{ margin: '0.9rem 0 0.6rem', fontSize: 'clamp(2rem, 3.5vw, 3rem)', letterSpacing: '-0.02em' }}>
          Terms of Service
        </h1>
        <p style={{ margin: 0, color: 'rgba(245, 245, 245, 0.7)', fontSize: '1rem' }}>
          Last updated {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>

        <div style={{ marginTop: '2rem', display: 'grid', gap: '1.5rem' }}>
          <Card title="1. Acceptance of these terms">
            <p style={textStyle}>
              By accessing or using Relay (the &quot;Service&quot;), you agree to be bound by these Terms of
              Service and our <Link href="/acceptable-use" style={{ color: '#7ef4cb' }}>Acceptable Use Policy</Link>.
              If you do not agree, do not use the Service.
            </p>
          </Card>

          <Card title="2. The service">
            <p style={textStyle}>
              Relay lets you upload files and code snippets and share them via a link. Free accounts are
              anonymous — no sign-up is required. Relay Plus is a paid subscription that adds a higher per-file
              upload limit and a personal storage vault accessible via a Relay Plus account.
            </p>
            <p style={textStyle}>
              We may change, limit, or discontinue any part of the Service, including storage limits, retention
              periods, and features, at any time. We&apos;ll make a reasonable effort to communicate material
              changes that affect paying subscribers.
            </p>
          </Card>

          <Card title="3. Your responsibilities">
            <ul style={{ margin: '0.6rem 0 0', paddingLeft: '1.2rem', listStyle: 'disc' }}>
              <li>You are solely responsible for the content you upload and for having the legal right to share it.</li>
              <li>You must comply with our <Link href="/acceptable-use" style={{ color: '#7ef4cb' }}>Acceptable Use Policy</Link> at all times.</li>
              <li>If you create a Relay Plus account, you&apos;re responsible for keeping your login credentials confidential and for all activity under your account.</li>
              <li>You must not attempt to circumvent rate limits, storage limits, or abuse-prevention measures.</li>
            </ul>
          </Card>

          <Card title="4. Content ownership and license">
            <p style={textStyle}>
              You retain all ownership rights to the files and content you upload. By uploading content, you
              grant Relay a limited, non-exclusive, worldwide license to host, store, transmit, and display that
              content solely for the purpose of operating the Service — for example, generating a shareable
              download link and file previews.
            </p>
            <p style={textStyle}>
              We do not claim ownership of your content and do not sell or use it for purposes unrelated to
              providing the Service.
            </p>
          </Card>

          <Card title="5. Service limitations and no warranty">
            <p style={textStyle}>
              The Service is provided &quot;as is&quot; and &quot;as available,&quot; without warranties of any
              kind, express or implied, including merchantability, fitness for a particular purpose, or
              non-infringement. We do not guarantee that the Service will be uninterrupted, secure, or error-free.
            </p>
            <p style={textStyle}>
              Free-tier files are automatically deleted after a period of inactivity (currently 15 days) as
              described on our homepage. Relay Plus storage limits are described on our{' '}
              <Link href="/pricing" style={{ color: '#7ef4cb' }}>pricing page</Link>. We recommend keeping your
              own backup of anything important — Relay is a sharing tool, not a long-term archival service.
            </p>
          </Card>

          <Card title="6. Limitation of liability">
            <p style={textStyle}>
              To the fullest extent permitted by law, Relay and its operator will not be liable for any indirect,
              incidental, special, consequential, or punitive damages, or any loss of data, profits, or revenue,
              arising from your use of or inability to use the Service, including content lost through automatic
              expiration, service interruption, or account termination.
            </p>
          </Card>

          <Card title="7. Termination">
            <p style={textStyle}>
              We may suspend or terminate access to the Service, without prior notice, for violations of these
              Terms or the Acceptable Use Policy, or where required by law. Relay Plus subscribers may cancel
              their subscription at any time; cancellation stops future billing but does not retroactively
              refund past charges except where required by law or stated otherwise at checkout.
            </p>
          </Card>

          <Card title="8. Reporting content and copyright">
            <p style={textStyle}>
              If you believe content on Relay infringes your copyright, see our{' '}
              <Link href="/dmca" style={{ color: '#7ef4cb' }}>DMCA Policy</Link>. To report content that
              otherwise violates our Acceptable Use Policy, use our{' '}
              <Link href="/report-abuse" style={{ color: '#7ef4cb' }}>abuse reporting form</Link>.
            </p>
          </Card>

          <Card title="9. Changes to these terms">
            <p style={textStyle}>
              We may update these Terms from time to time. Material changes will be reflected by updating the
              &quot;Last updated&quot; date above. Continued use of the Service after changes take effect
              constitutes acceptance of the revised Terms.
            </p>
          </Card>

          <Card title="10. Contact">
            <p style={textStyle}>
              Questions about these Terms can be sent to{' '}
              <a href="mailto:matthew@xstlo.com" style={{ color: '#7ef4cb' }}>matthew@xstlo.com</a>.
            </p>
          </Card>
        </div>

        <div style={{ marginTop: '2.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link
            href="/"
            style={{
              padding: '0.7rem 1.2rem', borderRadius: '999px', background: 'rgba(233,236,242,0.18)',
              backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(233,236,242,0.35)',
              color: '#eef1f6', textDecoration: 'none', fontWeight: 700, boxShadow: '0 2px 12px rgba(0,0,0,0.25)'
            }}
          >
            Back to home
          </Link>
          <Link
            href="/acceptable-use"
            style={{ padding: '0.7rem 1.2rem', borderRadius: '999px', border: '1px solid rgba(255, 255, 255, 0.35)', color: '#f5f5f5', textDecoration: 'none' }}
          >
            Acceptable Use Policy
          </Link>
        </div>
      </section>
    </main>
  );
}
