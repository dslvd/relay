'use client';

import { useState, useEffect } from 'react';

interface UploadResultProps {
  isVisible: boolean;
  uploadProgress: number;
  uploadStatus: string;
  shareLink?: string;
}

export default function UploadResult({
  isVisible,
  uploadProgress,
  uploadStatus,
  shareLink = 'https://rootz.so/f/abc123de',
}: UploadResultProps) {
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareLink).catch(() => {});
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (!isVisible) return null;

  return (
    <div style={{
      width: '100%',
      maxWidth: '420px',
      margin: '2rem auto 0',
      background: '#fff',
      borderRadius: '14px',
      boxShadow: '0 2px 16px #eaeaea',
      padding: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.2rem',
    }}>
      {/* Progress Bar */}
      <div style={{ width: '100%', height: '4px', background: '#f2f2f2', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ height: '100%', background: '#222', width: `${uploadProgress}%`, transition: 'width 0.2s' }} />
      </div>
      {/* Status Header */}
      <div style={{
        padding: '0.7rem 0',
        color: '#222',
        fontWeight: 500,
        fontSize: '1rem',
        textAlign: 'center',
        borderBottom: '1px solid #f2f2f2',
      }}>
        <span style={{ marginRight: '0.5rem' }}>✔</span>
        <span>{uploadStatus}</span>
      </div>
      {/* Share Link Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
        <div style={{
          flex: 1,
          background: '#f7f7f7',
          borderRadius: '8px',
          padding: '0.7rem 1rem',
          fontFamily: 'monospace',
          fontSize: '0.92rem',
          color: '#888',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>{shareLink}</div>
        <button
          onClick={copyToClipboard}
          style={{
            padding: '0.7rem 1.2rem',
            borderRadius: '8px',
            border: 'none',
            fontFamily: 'monospace',
            fontSize: '0.92rem',
            background: isCopied ? '#222' : '#f2f2f2',
            color: isCopied ? '#fff' : '#222',
            cursor: 'pointer',
            transition: 'background 0.2s',
            fontWeight: 500,
          }}
        >
          {isCopied ? 'Copied!' : 'Copy link'}
        </button>
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slideUp {
          animation: slideUp 0.4s ease;
        }
      `}</style>
    </div>
  );
}
