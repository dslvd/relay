import type { Metadata } from 'next';
import Link from 'next/link';
import Card from '../components/PolicyCard';

export const metadata: Metadata = {
  title: 'Acceptable Use Policy',
  description: 'Rules for what can and cannot be shared on Relay, and how violations are handled.',
  alternates: { canonical: '/acceptable-use' },
};

export default function AcceptableUsePage() {
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
          Policy
        </div>
        <h1 style={{ margin: '0.9rem 0 0.6rem', fontSize: 'clamp(2rem, 3.5vw, 3rem)', letterSpacing: '-0.02em' }}>
          Acceptable Use Policy
        </h1>
        <p style={{ margin: 0, color: 'rgba(245, 245, 245, 0.7)', fontSize: '1rem' }}>
          Last updated {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>

        <div style={{ marginTop: '2rem', display: 'grid', gap: '1.5rem' }}>
          <Card title="Overview">
            <p style={textStyle}>
              Relay is a file and code-sharing service. To keep it safe and legal for everyone, the following
              content and activity are prohibited, whether uploaded directly or linked to through Relay&apos;s
              remote-upload feature. This policy applies to every user of Relay, on both the free and Relay Plus
              tiers.
            </p>
          </Card>

          <Card title="Prohibited content and activity">
            <p style={textStyle}>You may not use Relay to store, share, or distribute:</p>
            <ul style={{ margin: '0.6rem 0 0', paddingLeft: '1.2rem', listStyle: 'disc' }}>
              <li><strong>Illegal content</strong> — material that is illegal to possess, create, or distribute under applicable law.</li>
              <li><strong>Child sexual abuse material (CSAM)</strong> — strictly prohibited with zero tolerance. Any account found sharing CSAM is permanently terminated, the content is removed immediately, and the matter is reported to the National Center for Missing &amp; Exploited Children (NCMEC) and law enforcement as required by law.</li>
              <li><strong>Malware and ransomware</strong> — viruses, ransomware, spyware, or other software designed to damage, disable, or gain unauthorized access to systems or data.</li>
              <li><strong>Copyright-infringing material</strong> — content shared without the rights, license, or permission of the copyright owner. See our <Link href="/dmca" style={{ color: '#7ef4cb' }}>DMCA Policy</Link> for the takedown process.</li>
              <li><strong>Phishing and scam content</strong> — pages, files, or links designed to impersonate a person or organization, or to deceive someone into giving up credentials, payment details, or other sensitive information.</li>
              <li><strong>Any other content that violates applicable law</strong> — including but not limited to content that facilitates fraud, harassment, or the sale of illegal goods or services.</li>
            </ul>
          </Card>

          <Card title="What happens if you violate this policy">
            <p style={textStyle}>Depending on the severity and nature of the violation, we may:</p>
            <ul style={{ margin: '0.6rem 0 0', paddingLeft: '1.2rem', listStyle: 'disc' }}>
              <li>Remove the specific file or link in question</li>
              <li>Disable or permanently terminate the associated account</li>
              <li>Block the associated IP address or device from further uploads</li>
              <li>Preserve relevant records and report the activity to law enforcement or another appropriate authority, where required or appropriate</li>
            </ul>
            <p style={textStyle}>
              We do not provide advance warning before taking action on serious violations (CSAM, malware,
              active phishing campaigns).
            </p>
          </Card>

          <Card title="How we enforce this policy">
            <p style={textStyle}>
              Relay is primarily a self-service platform — we don&apos;t manually review every file before it&apos;s
              shared. Enforcement instead combines automated checks with reactive review:
            </p>
            <ul style={{ margin: '0.6rem 0 0', paddingLeft: '1.2rem', listStyle: 'disc' }}>
              <li><strong>Automated file scanning</strong> — uploads are checked against VirusTotal before being deduplicated/shared further.</li>
              <li><strong>Automatic expiration</strong> — files are deleted after 15 days of no activity, limiting how long any single piece of content stays available.</li>
              <li><strong>Rate limiting</strong> — upload and API rate limits reduce the ability to mass-upload abusive content.</li>
              <li><strong>IP and filename blacklisting</strong> — known-bad sources and file patterns are blocked from uploading at all.</li>
              <li><strong>Reactive review</strong> — reports submitted through our <Link href="/report-abuse" style={{ color: '#7ef4cb' }}>abuse reporting form</Link> or DMCA process are logged and reviewed by an administrator, who can remove content and blacklist the source.</li>
            </ul>
          </Card>

          <Card title="Reporting a violation">
            <p style={textStyle}>
              If you find content on Relay that violates this policy, please use our{' '}
              <Link href="/report-abuse" style={{ color: '#7ef4cb' }}>abuse reporting form</Link>. Copyright
              claims should go through our <Link href="/dmca" style={{ color: '#7ef4cb' }}>DMCA process</Link>{' '}
              instead. If you believe you&apos;ve found CSAM, please also report it directly to NCMEC at{' '}
              <a href="https://report.cybertip.org" target="_blank" rel="noreferrer" style={{ color: '#7ef4cb' }}>report.cybertip.org</a>.
            </p>
          </Card>

          <Card title="Disclaimer">
            <p style={textStyle}>
              This page is provided for informational purposes only and does not constitute legal advice. It
              works alongside our <Link href="/terms" style={{ color: '#7ef4cb' }}>Terms of Service</Link>, which
              govern your use of Relay.
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
            href="/report-abuse"
            style={{ padding: '0.7rem 1.2rem', borderRadius: '999px', border: '1px solid rgba(255, 255, 255, 0.35)', color: '#f5f5f5', textDecoration: 'none' }}
          >
            Report abuse
          </Link>
        </div>
      </section>
    </main>
  );
}
