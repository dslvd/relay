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
    <div className="w-full max-w-2xl mx-auto mt-5 bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden animate-slideUp">
      {/* Progress Bar */}
      <div className="w-full h-1 bg-slate-800 relative overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 transition-all duration-100"
          style={{ width: `${uploadProgress}%` }}
        />
      </div>

      {/* Status Header */}
      <div className="px-5 py-4 bg-cyan-500/10 border-b border-slate-700 flex items-center gap-2.5 text-cyan-400 text-sm font-medium">
        <span>✔</span>
        <span>{uploadStatus}</span>
      </div>

      {/* Share Link Row */}
      <div className="px-5 py-4 flex items-center gap-3">
        <div className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 font-mono text-xs text-slate-400 whitespace-nowrap overflow-hidden text-ellipsis">
          {shareLink}
        </div>
        <button
          onClick={copyToClipboard}
          className={`px-4 py-2.5 rounded-lg border-none font-mono text-xs cursor-pointer transition-all whitespace-nowrap ${
            isCopied
              ? 'bg-cyan-400 text-slate-900'
              : 'bg-purple-600 text-white hover:bg-purple-700'
          }`}
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
