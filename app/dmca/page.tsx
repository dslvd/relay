export default function DmcaPage() {
  return (
    <main style={{
      minHeight: '100vh',
      padding: '6rem 6vw 4rem',
      background: 'radial-gradient(circle at 15% 20%, rgba(255, 255, 255, 0.06) 0%, transparent 45%), radial-gradient(circle at 85% 70%, rgba(255, 255, 255, 0.05) 0%, transparent 45%), #0a0a0a',
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
        <div style={{
          fontSize: '0.8rem',
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          color: 'rgba(245, 245, 245, 0.55)'
        }}>
          DMCA
        </div>
        <h1 style={{
          margin: '0.9rem 0 0.6rem',
          fontSize: 'clamp(2rem, 3.5vw, 3rem)',
          letterSpacing: '-0.02em'
        }}>
          Copyright & Takedown Policy
        </h1>
        <p style={{
          margin: 0,
          color: 'rgba(245, 245, 245, 0.7)',
          fontSize: '1rem'
        }}>
          Relay respects intellectual property rights and responds to valid DMCA notices.
        </p>

        <div style={{
          marginTop: '2rem',
          display: 'grid',
          gap: '1.5rem'
        }}>
          <div style={{
            padding: '1.2rem 1.4rem',
            borderRadius: '18px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            background: 'rgba(255, 255, 255, 0.03)'
          }}>
            <h2 style={{
              margin: 0,
              fontSize: '1.1rem'
            }}>
              Submit a takedown notice
            </h2>
            <ul style={{
              margin: '0.75rem 0 0',
              paddingLeft: '1.2rem',
              color: 'rgba(245, 245, 245, 0.72)',
              lineHeight: 1.6
            }}>
              <li>Identify the copyrighted work you believe is infringed.</li>
              <li>Provide the exact URL(s) to the allegedly infringing material.</li>
              <li>Include your contact information (name, email, address).</li>
              <li>Include a statement of good faith belief and accuracy under penalty of perjury.</li>
              <li>Provide your physical or electronic signature.</li>
            </ul>
          </div>

          <div style={{
            padding: '1.2rem 1.4rem',
            borderRadius: '18px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            background: 'rgba(255, 255, 255, 0.03)'
          }}>
            <h2 style={{
              margin: 0,
              fontSize: '1.1rem'
            }}>
              Counter-notice
            </h2>
            <p style={{
              margin: '0.75rem 0 0',
              color: 'rgba(245, 245, 245, 0.72)',
              lineHeight: 1.6
            }}>
              If you believe material was removed in error, you may submit a counter-notice with your
              contact details, the URL(s), a statement under penalty of perjury, and your consent to
              jurisdiction in your local federal district court.
            </p>
          </div>

          <div style={{
            padding: '1.2rem 1.4rem',
            borderRadius: '18px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            background: 'rgba(255, 255, 255, 0.03)'
          }}>
            <h2 style={{
              margin: 0,
              fontSize: '1.1rem'
            }}>
              Designated agent
            </h2>
            <p style={{
              margin: '0.75rem 0 0',
              color: 'rgba(245, 245, 245, 0.72)',
              lineHeight: 1.6
            }}>
              Email: dmca@yourdomain.com
              <br />
              Address: 123 Placeholder Ave, Suite 100, City, ST 00000
            </p>
          </div>
        </div>

        <div style={{
          marginTop: '2.5rem',
          display: 'flex',
          gap: '0.75rem',
          flexWrap: 'wrap'
        }}>
          <a
            href="/"
            style={{
              padding: '0.7rem 1.2rem',
              borderRadius: '999px',
              background: '#ffffff',
              color: '#0a0a0a',
              textDecoration: 'none',
              fontWeight: 700
            }}
          >
            Back to home
          </a>
          <a
            href="mailto:dmca@yourdomain.com"
            style={{
              padding: '0.7rem 1.2rem',
              borderRadius: '999px',
              border: '1px solid rgba(255, 255, 255, 0.35)',
              color: '#f5f5f5',
              textDecoration: 'none'
            }}
          >
            Email DMCA agent
          </a>
        </div>
      </section>
    </main>
  );
}
