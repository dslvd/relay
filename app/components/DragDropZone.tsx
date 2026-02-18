'use client';

import { useRef, useState } from 'react';

interface DragDropZoneProps {
  onFileSelect: (files: FileList) => void;
  onRemoteUrlSubmit?: (url: string) => void;
  isDragging?: boolean;
}

export default function DragDropZone({
  onFileSelect,
  onRemoteUrlSubmit,
  isDragging: externalIsDragging = false,
}: DragDropZoneProps) {
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState('');

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.add('drag-over');
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.remove('drag-over');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.remove('drag-over');
    }
    const files = e.dataTransfer.files;
    if (files.length) {
      onFileSelect(files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onFileSelect(e.target.files);
    }
  };

  const handleRemoteUrlSubmit = () => {
    if (remoteUrl.trim() && onRemoteUrlSubmit) {
      onRemoteUrlSubmit(remoteUrl);
      setRemoteUrl('');
    }
  };

  const displayIsDragging = isDragging || externalIsDragging;

  return (
    <div
      ref={dropZoneRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-full max-w-2xl mx-auto bg-slate-900 border-2 border-dashed border-slate-700 rounded-2xl p-14 cursor-pointer transition-all duration-300 relative overflow-hidden ${
        displayIsDragging
          ? 'border-purple-500 transform -translate-y-0.5 shadow-lg shadow-purple-500/30 bg-purple-500/5'
          : 'hover:border-purple-500 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-purple-500/15'
      }`}
    >
      <div className="absolute inset-0 bg-gradient-radial from-purple-500/10 to-transparent opacity-0 transition-opacity duration-300 pointer-events-none"
        style={{
          opacity: displayIsDragging ? 1 : 0,
          background: displayIsDragging 
            ? 'radial-gradient(ellipse at center, rgba(124,106,247,0.06) 0%, transparent 70%)'
            : 'transparent'
        }}
      />
      
      <div className="relative z-10">
        {/* Icon */}
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 bg-slate-800 border border-slate-700 rounded-2xl flex items-center justify-center text-3xl transition-transform duration-300"
            style={{
              transform: displayIsDragging ? 'scale(1.08) rotate(-3deg)' : 'scale(1) rotate(0deg)'
            }}
          >
            📂
          </div>
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-center mb-2 font-syne">
          Drop your files here
        </h3>

        {/* Subtitle */}
        <p className="text-slate-400 text-sm text-center mb-6">
          Supports any file type up to 10 GB<br />
          Files are stored for 30 days
        </p>

        {/* File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
        />

        {/* Action Buttons */}
        <div className="flex gap-3 justify-center mb-5">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-5 py-2 bg-purple-600 text-white rounded-lg font-mono text-sm font-medium cursor-pointer transition-all hover:bg-purple-700 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-purple-600/50"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Choose file
          </button>
        </div>

        {/* Divider */}
        {onRemoteUrlSubmit && (
          <>
            <div className="flex items-center gap-4 text-slate-500 text-xs my-5">
              <div className="flex-1 h-px bg-slate-700"></div>
              <span className="px-2">or paste a URL to upload remotely</span>
              <div className="flex-1 h-px bg-slate-700"></div>
            </div>

            {/* Remote URL Input */}
            <div className="flex gap-0 rounded-lg overflow-hidden border border-slate-700 transition-colors hover:border-purple-500 focus-within:border-purple-500">
              <input
                type="url"
                value={remoteUrl}
                onChange={(e) => setRemoteUrl(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleRemoteUrlSubmit()}
                placeholder="https://example.com/file.zip"
                className="flex-1 bg-slate-800 border-none px-4 py-2.5 text-white font-mono text-sm outline-none placeholder-slate-500"
              />
              <button
                onClick={handleRemoteUrlSubmit}
                className="px-5 bg-slate-800 border-l border-slate-700 text-purple-400 cursor-pointer font-mono text-sm transition-colors hover:bg-purple-500/10"
              >
                Fetch →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
