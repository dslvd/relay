'use client';

import { useState } from 'react';

export default function ApiDocumentation() {
  const [selectedLang, setSelectedLang] = useState<'curl' | 'javascript' | 'python' | 'php'>('curl');

  return (
    <div className="min-h-screen bg-[#0b0b0d] text-white">
      <div className="max-w-5xl mx-auto p-8">
        <div className="mb-12">
          <h1 className="text-5xl font-bold mb-4">API Documentation</h1>
          <p className="text-xl text-gray-400">
            Complete guide to integrating our CDN API into your applications
          </p>
        </div>

        {/* Getting Started */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-4">Getting Started</h2>
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10 space-y-4">
            <p>
              To use our API, you&apos;ll need an API key. Visit the{' '}
              <a href="/developers" className="text-blue-400 hover:underline">
                Developer Dashboard
              </a>{' '}
              to create one.
            </p>
            <p>
              All API requests must include your API key in the <code className="bg-black/30 px-2 py-1 rounded">Authorization</code> header:
            </p>
            <pre className="bg-black/50 p-4 rounded-lg overflow-x-auto text-sm">
              <code>Authorization: Bearer YOUR_API_KEY</code>
            </pre>
            <p className="text-gray-400 text-sm">
              Alternatively, you can pass it as a query parameter: <code className="bg-black/30 px-2 py-1 rounded">?api_key=YOUR_API_KEY</code>
            </p>
          </div>
        </section>

        {/* Base URL */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-4">Base URL</h2>
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
            <pre className="bg-black/50 p-4 rounded-lg overflow-x-auto">
              <code>https://your-domain.com/api/v1</code>
            </pre>
          </div>
        </section>

        {/* Language Selector */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setSelectedLang('curl')}
            className={`px-4 py-2 rounded-lg transition ${selectedLang === 'curl' ? 'bg-white text-black' : 'bg-white/10 hover:bg-white/20'}`}
          >
            cURL
          </button>
          <button
            onClick={() => setSelectedLang('javascript')}
            className={`px-4 py-2 rounded-lg transition ${selectedLang === 'javascript' ? 'bg-white text-black' : 'bg-white/10 hover:bg-white/20'}`}
          >
            JavaScript
          </button>
          <button
            onClick={() => setSelectedLang('python')}
            className={`px-4 py-2 rounded-lg transition ${selectedLang === 'python' ? 'bg-white text-black' : 'bg-white/10 hover:bg-white/20'}`}
          >
            Python
          </button>
          <button
            onClick={() => setSelectedLang('php')}
            className={`px-4 py-2 rounded-lg transition ${selectedLang === 'php' ? 'bg-white text-black' : 'bg-white/10 hover:bg-white/20'}`}
          >
            PHP
          </button>
        </div>

        {/* Endpoints */}
        <div className="space-y-12">
          {/* API Info */}
          <section>
            <h2 className="text-3xl font-bold mb-4">Get API Key Info</h2>
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10 space-y-4">
              <div className="flex items-center gap-4">
                <span className="bg-blue-500 text-white px-3 py-1 rounded font-mono text-sm">GET</span>
                <code className="text-lg">/api/v1/info</code>
              </div>
              <p className="text-gray-400">Retrieve information about your API key, including usage statistics and rate limits.</p>
              
              {selectedLang === 'curl' && (
                <pre className="bg-black/50 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  https://your-domain.com/api/v1/info`}</code>
                </pre>
              )}
              
              {selectedLang === 'javascript' && (
                <pre className="bg-black/50 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{`const response = await fetch('https://your-domain.com/api/v1/info', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
});
const data = await response.json();
console.log(data);`}</code>
                </pre>
              )}
              
              {selectedLang === 'python' && (
                <pre className="bg-black/50 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{`import requests

response = requests.get(
    'https://your-domain.com/api/v1/info',
    headers={'Authorization': 'Bearer YOUR_API_KEY'}
)
data = response.json()
print(data)`}</code>
                </pre>
              )}
              
              {selectedLang === 'php' && (
                <pre className="bg-black/50 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{`<?php
$ch = curl_init('https://your-domain.com/api/v1/info');
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer YOUR_API_KEY'
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
$data = json_decode($response, true);
print_r($data);`}</code>
                </pre>
              )}

              <div>
                <h4 className="font-bold mb-2">Response</h4>
                <pre className="bg-black/50 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{`{
  "success": true,
  "data": {
    "id": "abc123",
    "name": "My API Key",
    "createdAt": "2026-03-04T10:00:00.000Z",
    "lastUsedAt": "2026-03-04T12:30:00.000Z",
    "isActive": true,
    "permissions": {
      "upload": true,
      "download": true,
      "delete": false,
      "list": true
    },
    "rateLimit": {
      "requestsPerHour": 1000,
      "uploadSizeLimit": 104857600,
      "uploadSizeLimitMB": 100
    },
    "usage": {
      "requestCount": 150,
      "uploadCount": 25,
      "downloadCount": 100,
      "totalBytesUploaded": 524288000,
      "totalBytesDownloaded": 1048576000,
      "totalUploadedMB": 500.00,
      "totalDownloadedMB": 1000.00
    }
  }
}`}</code>
                </pre>
              </div>
            </div>
          </section>

          {/* Upload File */}
          <section>
            <h2 className="text-3xl font-bold mb-4">Upload File</h2>
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10 space-y-4">
              <div className="flex items-center gap-4">
                <span className="bg-green-500 text-white px-3 py-1 rounded font-mono text-sm">POST</span>
                <code className="text-lg">/api/v1/upload</code>
              </div>
              <p className="text-gray-400">Get a presigned upload URL to upload your file directly to our CDN.</p>
              
              <div>
                <h4 className="font-bold mb-2">Request Body</h4>
                <pre className="bg-black/50 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{`{
  "filename": "image.png",
  "contentType": "image/png",
  "size": 1024000
}`}</code>
                </pre>
              </div>
              
              {selectedLang === 'curl' && (
                <pre className="bg-black/50 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{`# Step 1: Get upload URL
curl -X POST https://your-domain.com/api/v1/upload \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "filename": "image.png",
    "contentType": "image/png",
    "size": 1024000
  }'

# Step 2: Upload file to the URL
curl -X PUT "UPLOAD_URL_FROM_RESPONSE" \\
  -H "Content-Type: image/png" \\
  --data-binary @image.png`}</code>
                </pre>
              )}
              
              {selectedLang === 'javascript' && (
                <pre className="bg-black/50 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{`// Step 1: Get upload URL
const file = document.querySelector('input[type="file"]').files[0];

const initResponse = await fetch('https://your-domain.com/api/v1/upload', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    filename: file.name,
    contentType: file.type,
    size: file.size
  })
});

const { data } = await initResponse.json();

// Step 2: Upload file
await fetch(data.uploadUrl, {
  method: 'PUT',
  headers: {
    'Content-Type': file.type
  },
  body: file
});

console.log('Download URL:', data.downloadUrl);`}</code>
                </pre>
              )}
              
              {selectedLang === 'python' && (
                <pre className="bg-black/50 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{`import requests

# Step 1: Get upload URL
with open('image.png', 'rb') as f:
    file_size = len(f.read())

response = requests.post(
    'https://your-domain.com/api/v1/upload',
    headers={'Authorization': 'Bearer YOUR_API_KEY'},
    json={
        'filename': 'image.png',
        'contentType': 'image/png',
        'size': file_size
    }
)
data = response.json()['data']

# Step 2: Upload file
with open('image.png', 'rb') as f:
    requests.put(
        data['uploadUrl'],
        headers={'Content-Type': 'image/png'},
        data=f
    )

print('Download URL:', data['downloadUrl'])`}</code>
                </pre>
              )}
              
              {selectedLang === 'php' && (
                <pre className="bg-black/50 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{`<?php
// Step 1: Get upload URL
$file = 'image.png';
$size = filesize($file);

$ch = curl_init('https://your-domain.com/api/v1/upload');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer YOUR_API_KEY',
    'Content-Type: application/json'
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    'filename' => 'image.png',
    'contentType' => 'image/png',
    'size' => $size
]));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
$data = json_decode($response, true)['data'];

// Step 2: Upload file
$ch = curl_init($data['uploadUrl']);
curl_setopt($ch, CURLOPT_PUT, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: image/png'
]);
curl_setopt($ch, CURLOPT_INFILE, fopen($file, 'r'));
curl_setopt($ch, CURLOPT_INFILESIZE, $size);
curl_exec($ch);

echo 'Download URL: ' . $data['downloadUrl'];`}</code>
                </pre>
              )}

              <div>
                <h4 className="font-bold mb-2">Response</h4>
                <pre className="bg-black/50 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{`{
  "success": true,
  "data": {
    "uploadUrl": "https://presigned-url...",
    "method": "PUT",
    "fileId": "d/api/abc123/1234567890-xyz/image.png",
    "downloadUrl": "https://your-domain.com/api/v1/files/...",
    "directDownloadUrl": "https://your-domain.com/d/...",
    "expiresIn": 300,
    "headers": {
      "Content-Type": "image/png"
    }
  }
}`}</code>
                </pre>
              </div>
            </div>
          </section>

          {/* Get File */}
          <section>
            <h2 className="text-3xl font-bold mb-4">Get File Info</h2>
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10 space-y-4">
              <div className="flex items-center gap-4">
                <span className="bg-blue-500 text-white px-3 py-1 rounded font-mono text-sm">GET</span>
                <code className="text-lg">/api/v1/files/:fileId</code>
              </div>
              <p className="text-gray-400">Get information and download URL for a specific file.</p>
              
              {selectedLang === 'curl' && (
                <pre className="bg-black/50 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  https://your-domain.com/api/v1/files/FILE_ID`}</code>
                </pre>
              )}
              
              {selectedLang === 'javascript' && (
                <pre className="bg-black/50 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{`const response = await fetch(
  'https://your-domain.com/api/v1/files/FILE_ID',
  {
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY'
    }
  }
);
const data = await response.json();`}</code>
                </pre>
              )}
              
              {selectedLang === 'python' && (
                <pre className="bg-black/50 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{`response = requests.get(
    'https://your-domain.com/api/v1/files/FILE_ID',
    headers={'Authorization': 'Bearer YOUR_API_KEY'}
)
data = response.json()`}</code>
                </pre>
              )}
              
              {selectedLang === 'php' && (
                <pre className="bg-black/50 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{`$ch = curl_init('https://your-domain.com/api/v1/files/FILE_ID');
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer YOUR_API_KEY'
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
$data = json_decode($response, true);`}</code>
                </pre>
              )}

              <div>
                <h4 className="font-bold mb-2">Response</h4>
                <pre className="bg-black/50 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{`{
  "success": true,
  "data": {
    "fileId": "d/api/abc123/...",
    "downloadUrl": "https://presigned-download-url...",
    "directDownloadUrl": "https://your-domain.com/d/...",
    "contentType": "image/png",
    "size": 1024000,
    "expiresIn": 3600
  }
}`}</code>
                </pre>
              </div>
            </div>
          </section>

          {/* List Files */}
          <section>
            <h2 className="text-3xl font-bold mb-4">List Files</h2>
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10 space-y-4">
              <div className="flex items-center gap-4">
                <span className="bg-blue-500 text-white px-3 py-1 rounded font-mono text-sm">GET</span>
                <code className="text-lg">/api/v1/files</code>
              </div>
              <p className="text-gray-400">List all files uploaded with your API key.</p>
              
              <div>
                <h4 className="font-bold mb-2">Query Parameters</h4>
                <ul className="list-disc list-inside text-sm space-y-1 text-gray-400">
                  <li><code className="bg-black/30 px-2 py-1 rounded">limit</code> - Maximum number of files to return (default: 100, max: 1000)</li>
                  <li><code className="bg-black/30 px-2 py-1 rounded">prefix</code> - Filter files by key prefix</li>
                </ul>
              </div>
              
              {selectedLang === 'curl' && (
                <pre className="bg-black/50 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  "https://your-domain.com/api/v1/files?limit=50"`}</code>
                </pre>
              )}
              
              {selectedLang === 'javascript' && (
                <pre className="bg-black/50 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{`const response = await fetch(
  'https://your-domain.com/api/v1/files?limit=50',
  {
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY'
    }
  }
);
const data = await response.json();`}</code>
                </pre>
              )}
              
              {selectedLang === 'python' && (
                <pre className="bg-black/50 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{`response = requests.get(
    'https://your-domain.com/api/v1/files',
    headers={'Authorization': 'Bearer YOUR_API_KEY'},
    params={'limit': 50}
)
data = response.json()`}</code>
                </pre>
              )}
              
              {selectedLang === 'php' && (
                <pre className="bg-black/50 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{`$ch = curl_init('https://your-domain.com/api/v1/files?limit=50');
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer YOUR_API_KEY'
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
$data = json_decode($response, true);`}</code>
                </pre>
              )}

              <div>
                <h4 className="font-bold mb-2">Response</h4>
                <pre className="bg-black/50 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{`{
  "success": true,
  "data": {
    "files": [
      {
        "fileId": "d/api/abc123/...",
        "name": "image.png",
        "size": 1024000,
        "lastModified": "2026-03-04T12:30:00.000Z",
        "downloadUrl": "https://your-domain.com/api/v1/files/...",
        "directDownloadUrl": "https://your-domain.com/d/..."
      }
    ],
    "count": 1,
    "total": 1,
    "hasMore": false
  }
}`}</code>
                </pre>
              </div>
            </div>
          </section>

          {/* Delete File */}
          <section>
            <h2 className="text-3xl font-bold mb-4">Delete File</h2>
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10 space-y-4">
              <div className="flex items-center gap-4">
                <span className="bg-red-500 text-white px-3 py-1 rounded font-mono text-sm">DELETE</span>
                <code className="text-lg">/api/v1/files/:fileId</code>
              </div>
              <p className="text-gray-400">Delete a specific file. Requires <code className="bg-black/30 px-2 py-1 rounded">delete</code> permission.</p>
              
              {selectedLang === 'curl' && (
                <pre className="bg-black/50 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{`curl -X DELETE \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  https://your-domain.com/api/v1/files/FILE_ID`}</code>
                </pre>
              )}
              
              {selectedLang === 'javascript' && (
                <pre className="bg-black/50 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{`const response = await fetch(
  'https://your-domain.com/api/v1/files/FILE_ID',
  {
    method: 'DELETE',
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY'
    }
  }
);
const data = await response.json();`}</code>
                </pre>
              )}
              
              {selectedLang === 'python' && (
                <pre className="bg-black/50 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{`response = requests.delete(
    'https://your-domain.com/api/v1/files/FILE_ID',
    headers={'Authorization': 'Bearer YOUR_API_KEY'}
)
data = response.json()`}</code>
                </pre>
              )}
              
              {selectedLang === 'php' && (
                <pre className="bg-black/50 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{`$ch = curl_init('https://your-domain.com/api/v1/files/FILE_ID');
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer YOUR_API_KEY'
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
$data = json_decode($response, true);`}</code>
                </pre>
              )}

              <div>
                <h4 className="font-bold mb-2">Response</h4>
                <pre className="bg-black/50 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{`{
  "success": true,
  "data": {
    "message": "File deleted successfully",
    "fileId": "d/api/abc123/..."
  }
}`}</code>
                </pre>
              </div>
            </div>
          </section>
        </div>

        {/* Error Codes */}
        <section className="mt-12 mb-12">
          <h2 className="text-3xl font-bold mb-4">Error Codes</h2>
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2">Code</th>
                  <th className="text-left py-2">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                <tr>
                  <td className="py-2 font-mono">400</td>
                  <td className="py-2 text-gray-400">Bad Request - Invalid parameters</td>
                </tr>
                <tr>
                  <td className="py-2 font-mono">401</td>
                  <td className="py-2 text-gray-400">Unauthorized - Invalid or missing API key</td>
                </tr>
                <tr>
                  <td className="py-2 font-mono">403</td>
                  <td className="py-2 text-gray-400">Forbidden - Insufficient permissions</td>
                </tr>
                <tr>
                  <td className="py-2 font-mono">404</td>
                  <td className="py-2 text-gray-400">Not Found - Resource doesn&apos;t exist</td>
                </tr>
                <tr>
                  <td className="py-2 font-mono">413</td>
                  <td className="py-2 text-gray-400">Payload Too Large - File exceeds size limit</td>
                </tr>
                <tr>
                  <td className="py-2 font-mono">429</td>
                  <td className="py-2 text-gray-400">Too Many Requests - Rate limit exceeded</td>
                </tr>
                <tr>
                  <td className="py-2 font-mono">500</td>
                  <td className="py-2 text-gray-400">Internal Server Error</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Rate Limits */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-4">Rate Limits</h2>
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10 space-y-4">
            <p>Each API key has configurable rate limits:</p>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li><strong className="text-white">Requests per hour:</strong> Configurable when creating the key (default: 1000/hour)</li>
              <li><strong className="text-white">Upload size limit:</strong> Configurable per key (default: 100MB)</li>
            </ul>
            <p className="text-sm text-gray-400">
              When you exceed your rate limit, you&apos;ll receive a <code className="bg-black/30 px-2 py-1 rounded">429</code> status code.
              Wait for the rate limit window to reset before making more requests.
            </p>
          </div>
        </section>

        {/* Support */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-4">Need Help?</h2>
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
            <p className="mb-4">
              If you have questions or need assistance, please visit the{' '}
              <a href="/developers" className="text-blue-400 hover:underline">
                Developer Dashboard
              </a>{' '}
              or check your API key usage statistics.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
