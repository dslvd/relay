'use client';

import { useState, useRef } from 'react';
import { upload } from '@vercel/blob/client';

export default function Home() {
  const [url, setUrl] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUrl('');

    try {
      const blob = await upload(`cdn/${file.name}`, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
      });

      setUrl(`${window.location.origin}/${blob.pathname}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700&display=swap');

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          background: #0a0a0a;
          color: #f5f5f0;
          font-family: 'Open Sans', sans-serif;
          min-height: 100vh;
          overflow-x: hidden;
        }

        body::before {
          content: '';
          position: fixed;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: 
            radial-gradient(circle at 20% 30%, rgba(88, 101, 242, 0.08) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(88, 101, 242, 0.06) 0%, transparent 50%);
          animation: bgRotate 20s linear infinite;
          z-index: -1;
        }

        @keyframes bgRotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <main style={{ 
        padding: '4rem 6vw',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        <h1 style={{
          fontFamily: "'Open Sans', sans-serif",
          fontSize: '2rem',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #5865F2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: '2rem',
          animation: 'fadeSlideIn 1s ease-out',
          textAlign: 'center'
        }}>
          CDN Uploader
        </h1>

        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            fontFamily: "'Open Sans', sans-serif",
            padding: '0.75rem 1.75rem',
            fontSize: '0.95rem',
            fontWeight: 700,
            color: uploading ? '#666666' : '#f5f5f0',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '2px solid',
            borderColor: uploading ? '#666666' : '#f5f5f0',
            borderRadius: '50px',
            cursor: uploading ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s',
            position: 'relative',
            overflow: 'hidden',
            animation: 'fadeSlideIn 1s ease-out 0.2s backwards',
            zIndex: 1
          }}
          onMouseEnter={(e) => {
            if (!uploading) {
              e.currentTarget.style.borderColor = '#5865F2';
              e.currentTarget.style.color = '#0a0a0a';
              e.currentTarget.style.background = '#5865F2';
            }
          }}
          onMouseLeave={(e) => {
            if (!uploading) {
              e.currentTarget.style.borderColor = '#f5f5f0';
              e.currentTarget.style.color = '#f5f5f0';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            }
          }}
        >
          {uploading ? 'Uploading...' : 'Choose File'}
        </button>

        {uploading && (
          <p style={{
            marginTop: '2rem',
            fontSize: '1.1rem',
            color: '#666666',
            fontStyle: 'italic',
            animation: 'fadeSlideIn 0.5s ease-out'
          }}>
            Uploading…
          </p>
        )}

        {url && (
          <div style={{
            marginTop: '3rem',
            animation: 'fadeSlideIn 0.8s ease-out',
            textAlign: 'center',
            width: '100%'
          }}>
            <p style={{
              fontSize: '1.5rem',
              marginBottom: '1rem',
              color: '#00d9ff'
            }}>
              ✅ Uploaded:
            </p>
            <a 
              href={url} 
              target="_blank" 
              rel="noreferrer"
              style={{
                color: '#f5f5f0',
                fontSize: '1rem',
                wordBreak: 'break-all',
                textDecoration: 'none',
                padding: '1rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                display: 'block',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 51, 102, 0.1)';
                e.currentTarget.style.borderColor = '#ff3366';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
            >
              {url}
            </a>
            <p style={{
              marginTop: '1rem',
              opacity: 0.7,
              fontSize: '0.95rem',
              color: '#666666'
            }}>
              Use that link as your CDN URL.
            </p>
          </div>
        )}
      </main>
    </>
  );
}