import type { Metadata } from 'next';
import Link from 'next/link';
import Card from '../components/PolicyCard';

export const metadata: Metadata = {
  title: 'DMCA Policy',
  description: 'Relay DMCA takedown policy and copyright infringement reporting process.',
  alternates: { canonical: '/dmca' },
  robots: { index: false, follow: true },
};

export default function DmcaPage() {
  const textStyle: React.CSSProperties = { margin: '0.75rem 0 0', lineHeight: 1.6 };

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
          DMCA
        </div>
        <h1 style={{ margin: '0.9rem 0 0.6rem', fontSize: 'clamp(2rem, 3.5vw, 3rem)', letterSpacing: '-0.02em' }}>
          DMCA Takedown Policy
        </h1>
        <p style={{ margin: 0, color: 'rgba(245, 245, 245, 0.7)', fontSize: '1rem' }}>
          Information for copyright holders and DMCA agents regarding takedown requests.
        </p>

        <div style={{ marginTop: '2rem', display: 'grid', gap: '1.5rem' }}>
          <Card title="Overview">
            <p style={textStyle}>
              Relay respects the intellectual property rights of others and expects our users to do the same. We
              are committed to responding to valid DMCA takedown notices in accordance with the Digital
              Millennium Copyright Act (DMCA) and other applicable copyright laws.
            </p>
            <p style={textStyle}>
              While we cannot prevent all users from uploading copyrighted content, we take copyright
              infringement seriously and will promptly remove files when we receive a valid takedown request.
            </p>
          </Card>

          <Card title="Filing a DMCA takedown request">
            <p style={textStyle}>
              If you believe that content hosted on Relay infringes your copyright, you may submit a DMCA
              takedown notice. To comply with 17 U.S.C. § 512(c)(3), your notice must include:
            </p>
            <ul style={{ margin: '0.75rem 0 0', paddingLeft: '1.2rem', listStyle: 'disc', lineHeight: 1.6 }}>
              <li><strong>Identification of the copyrighted work:</strong> A description or link to the copyrighted work that you claim has been infringed.</li>
              <li><strong>Identification of the infringing material:</strong> The specific URL(s) or file link(s) where the allegedly infringing content is located on Relay.</li>
              <li><strong>Your contact information:</strong> Your full name, mailing address, telephone number, and email address.</li>
              <li><strong>Good faith statement:</strong> A statement that you have a good faith belief that the use of the material is not authorized by the copyright owner, its agent, or the law.</li>
              <li><strong>Accuracy statement:</strong> A statement that the information in your notice is accurate and, under penalty of perjury, that you are the copyright owner or authorized to act on behalf of the copyright owner.</li>
              <li><strong>Physical or electronic signature:</strong> Your physical or electronic signature (or that of the person authorized to act on behalf of the copyright owner).</li>
            </ul>
          </Card>

          <Card title="How to submit a takedown request">
            <p style={textStyle}>Please send your DMCA takedown notice to our designated agent:</p>
            <p style={{ margin: '0.9rem 0 0', fontWeight: 600 }}>Designated DMCA Agent</p>
            <p style={{ margin: '0.5rem 0 0' }}>
              Email: contactdslvd@gmail.com
              <br />
              Subject Line: DMCA Takedown Request
            </p>
            <p style={textStyle}>
              Please include all required information listed above in your email. Incomplete notices may delay
              our response.
            </p>
          </Card>

          <Card title="Our response process">
            <p style={textStyle}>Upon receipt of a valid DMCA takedown notice, we will:</p>
            <ul style={{ margin: '0.75rem 0 0', paddingLeft: '1.2rem', listStyle: 'disc', lineHeight: 1.6 }}>
              <li>Review the notice for completeness and validity</li>
              <li>Remove or disable access to the allegedly infringing content</li>
              <li>Notify the user who uploaded the content (if identifiable), including instructions for filing a counter-notice</li>
              <li>Respond to the copyright holder confirming the action taken</li>
            </ul>
            <p style={textStyle}>We typically process valid takedown requests within 24–48 hours of receipt.</p>
          </Card>

          <Card title="Counter-notification process">
            <p style={textStyle}>
              If content you uploaded was removed in response to a DMCA notice and you believe it was removed by
              mistake or misidentification, you may submit a counter-notice. To comply with 17 U.S.C. § 512(g),
              your counter-notice must include:
            </p>
            <ul style={{ margin: '0.75rem 0 0', paddingLeft: '1.2rem', listStyle: 'disc', lineHeight: 1.6 }}>
              <li>Your physical or electronic signature.</li>
              <li>Identification of the material that was removed and its location before removal.</li>
              <li>A statement, under penalty of perjury, that you have a good faith belief the material was removed as a result of mistake or misidentification.</li>
              <li>Your name, address, and telephone number, and a statement that you consent to the jurisdiction of the federal district court for your judicial district (or, if outside the U.S., an appropriate judicial district), and that you will accept service of process from the person who filed the original takedown notice.</li>
            </ul>
            <p style={textStyle}>
              Send counter-notices to the same designated agent email above with the subject line{' '}
              <strong>&quot;DMCA Counter-Notice.&quot;</strong> Upon receiving a valid counter-notice, we will
              forward it to the original complaining party. If we do not receive notice that the complaining
              party has filed a court action within 10–14 business days, we may restore the content.
            </p>
          </Card>

          <Card title="Repeat infringers">
            <p style={textStyle}>
              In accordance with the DMCA, we maintain a policy of terminating the accounts of users who are
              repeat infringers of copyright. Users who repeatedly upload infringing content may have their
              accounts permanently suspended.
            </p>
          </Card>

          <Card title="Disclaimer">
            <p style={textStyle}>
              This page is provided for informational purposes only and does not constitute legal advice. If you
              have questions about copyright law or the DMCA process, please consult with a qualified legal
              professional.
            </p>
            <p style={textStyle}>
              By using Relay, users agree not to upload copyrighted material without proper authorization.
              However, as a file hosting service, we cannot monitor all uploaded content and rely on copyright
              holders to notify us of infringements. See also our{' '}
              <Link href="/acceptable-use" style={{ color: '#7ef4cb' }}>Acceptable Use Policy</Link> and{' '}
              <Link href="/terms" style={{ color: '#7ef4cb' }}>Terms of Service</Link>.
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
          <a
            href="mailto:contactdslvd@gmail.com?subject=DMCA%20Takedown%20Request"
            style={{ padding: '0.7rem 1.2rem', borderRadius: '999px', border: '1px solid rgba(255, 255, 255, 0.35)', color: '#f5f5f5', textDecoration: 'none' }}
          >
            Contact DMCA agent
          </a>
        </div>
      </section>
    </main>
  );
}
