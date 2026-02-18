'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import LogoLoader from '../../components/LogoLoader';

interface UploadRecord {
  url: string;
  filename: string;
  timestamp: number;
  size: number;
}

export default function AltDownloadPage() {
  const params = useParams();
  const pathArray = Array.isArray(params.path) ? params.path : [params.path];
  const filename = pathArray[pathArray.length - 1];
  
  const [fileData, setFileData] = useState<UploadRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const downloadUrl = `/d/${pathArray.join('/')}`;

  useEffect(() => {
    const fetchFileData = async () => {
      try {
        // Track page view
        fetch('/api/analytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'pageview', path: `/alt-download/${pathArray.join('/')}` })
        }).catch(() => {}); // Silently fail
        
        const response = await fetch('/api/history', { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          const records = data.history || [];
          const file = records.find((r: UploadRecord) => r.url.includes(pathArray.join('/')));
          if (file) {
            setFileData(file);
            
            // Update last access time when viewing the download page
            const filename = pathArray[pathArray.length - 1];
            fetch('/api/access', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename })
            }).catch(err => console.error('Failed to update access time:', err));
          } else {
            setNotFound(true);
          }
        }
      } catch (error) {
        console.error('Failed to fetch file data:', error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchFileData();
  }, [pathArray]);

  if (loading) {
    return <LogoLoader />;
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">File Not Found</h1>
          <p className="text-gray-600">The file you're looking for doesn't exist or has expired.</p>
        </div>
      </div>
    );
  }

  // Auto-download when page loads
  useEffect(() => {
    if (fileData && !loading) {
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileData.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [fileData, loading, downloadUrl]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Downloading Your File</h1>
        {fileData && (
          <>
            <p className="text-lg mb-2">{fileData.filename}</p>
            <p className="text-gray-600 mb-6">Your download should start automatically...</p>
            <a
              href={downloadUrl}
              className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Click here if it doesn't start
            </a>
          </>
        )}
      </div>
    </div>
  );
}
