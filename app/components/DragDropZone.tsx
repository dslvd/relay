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
          // ...existing code...
