# Developer API System

A complete API system for developers to integrate CDN functionality into their applications.

## Features

✅ **API Key Management** - Generate & manage multiple API keys with granular permissions
✅ **File Upload** - Upload files via presigned URLs
✅ **File Download** - Retrieve files with presigned download URLs
✅ **File Listing** - List all files uploaded with your API key
✅ **File Deletion** - Remove files (with permission)
✅ **Usage Analytics** - Track uploads, downloads, and bandwidth
✅ **Rate Limiting** - Configurable rate limits per API key
✅ **Permissions System** - Fine-grained control (upload, download, delete, list)
✅ **Developer Dashboard** - Web UI for managing API keys
✅ **Comprehensive Documentation** - Complete API docs with code examples

## Quick Start

### 1. Create an API Key

Visit the Developer Dashboard at `/developers` and create a new API key:

```bash
# Navigate to your dashboard
https://your-domain.com/developers
```

Click "Create New API Key" and configure:
- **Name**: Identify your key (e.g., "Production Server")
- **Permissions**: Choose which operations are allowed
- **Rate Limit**: Set requests per hour and max upload size
- **Expiration**: Optional expiration date

⚠️ **Important**: Save your API key immediately - it's only shown once!

### 2. Use the API

Use your API key in the `Authorization` header:

```bash
curl -H "Authorization: Bearer vbc_your_api_key_here" \
  https://your-domain.com/api/v1/info
```

### 3. Upload a File

```javascript
// Step 1: Get presigned upload URL
const response = await fetch('https://your-domain.com/api/v1/upload', {
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

const { data } = await response.json();

// Step 2: Upload the file
await fetch(data.uploadUrl, {
  method: 'PUT',
  headers: {
    'Content-Type': file.type
  },
  body: file
});

// Done! Use data.downloadUrl to access the file
console.log('File uploaded:', data.downloadUrl);
```

## API Endpoints

### Base URL
```
https://your-domain.com/api/v1
```

### Endpoints

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/info` | Get API key info & usage | None |
| POST | `/upload` | Get presigned upload URL | `upload` |
| GET | `/files` | List all files | `list` |
| GET | `/files/:fileId` | Get file info & download URL | `download` |
| DELETE | `/files/:fileId` | Delete a file | `delete` |

## Authentication

Include your API key in every request using one of these methods:

**Header (Recommended)**:
```
Authorization: Bearer YOUR_API_KEY
```

**Query Parameter**:
```
?api_key=YOUR_API_KEY
```

## File Structure

```
app/
├── lib/
│   ├── data/
│   │   └── api-key-store.ts          # API key storage & management
│   └── api-auth.ts                   # API authentication middleware
├── api/
│   ├── v1/                           # Developer API endpoints
│   │   ├── upload/route.ts           # Upload file endpoint
│   │   ├── info/route.ts             # API key info endpoint
│   │   ├── files/
│   │   │   ├── route.ts              # List files endpoint
│   │   │   └── [fileId]/route.ts     # Get/Delete file endpoint
│   └── dev/                          # Developer dashboard API
│       └── keys/
│           ├── route.ts              # Create/List keys
│           └── [keyId]/route.ts      # Get/Update/Delete key
└── developers/
    ├── page.tsx                      # Developer dashboard UI
    └── docs/page.tsx                 # API documentation
```

## Storage

The system supports two storage backends:

1. **Redis** (Production) - When `REDIS_URL` is configured
2. **In-Memory** (Development) - Fallback for testing

API keys include:
- Hashed key for security (plain key never stored)
- Permissions (upload, download, delete, list)
- Rate limits (requests/hour, upload size)
- Usage statistics (requests, uploads, downloads, bandwidth)
- Metadata (name, creation date, expiration, etc.)

## Rate Limiting

Each API key has configurable rate limits:

- **Requests per hour**: Default 1000, configurable
- **Upload size limit**: Default 100MB, configurable
- **Per-key tracking**: Each key has independent limits

When rate limit is exceeded, API returns `429 Too Many Requests`.

## Permissions

Four permission types:

- **upload**: Create presigned upload URLs
- **download**: Get file info and download URLs
- **delete**: Delete files
- **list**: List uploaded files

Configure permissions when creating a key or update them later.

## Usage Analytics

Track usage for each API key:

- Request count
- Upload count & total bytes
- Download count & total bytes
- Last used timestamp

View analytics in the Developer Dashboard or via `/api/v1/info` endpoint.

## Error Handling

All errors return JSON with this structure:

```json
{
  "success": false,
  "error": "Error message"
}
```

Common status codes:

- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (invalid/missing API key)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (file doesn't exist)
- `413` - Payload Too Large (file exceeds limit)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

## Security Best Practices

1. **Never expose API keys** in client-side code
2. **Use environment variables** to store keys
3. **Set appropriate permissions** - only enable what's needed
4. **Monitor usage** regularly in the dashboard
5. **Rotate keys** periodically
6. **Set expiration dates** for temporary keys
7. **Revoke compromised keys** immediately

## Examples

### Node.js/Express Backend

```javascript
const express = require('express');
const fetch = require('node-fetch');
const multer = require('multer');

const app = express();
const upload = multer();

const API_KEY = process.env.CDN_API_KEY;
const CDN_API = 'https://your-domain.com/api/v1';

app.post('/upload', upload.single('file'), async (req, res) => {
  const file = req.file;
  
  // Get presigned URL
  const initRes = await fetch(`${CDN_API}/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      filename: file.originalname,
      contentType: file.mimetype,
      size: file.size
    })
  });
  
  const { data } = await initRes.json();
  
  // Upload file
  await fetch(data.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.mimetype
    },
    body: file.buffer
  });
  
  res.json({ url: data.downloadUrl });
});

app.listen(3000);
```

### Python/Flask Backend

```python
from flask import Flask, request, jsonify
import requests
import os

app = Flask(__name__)
API_KEY = os.environ.get('CDN_API_KEY')
CDN_API = 'https://your-domain.com/api/v1'

@app.route('/upload', methods=['POST'])
def upload():
    file = request.files['file']
    
    # Get presigned URL
    init_res = requests.post(
        f'{CDN_API}/upload',
        headers={'Authorization': f'Bearer {API_KEY}'},
        json={
            'filename': file.filename,
            'contentType': file.content_type,
            'size': len(file.read())
        }
    )
    file.seek(0)
    
    data = init_res.json()['data']
    
    # Upload file
    requests.put(
        data['uploadUrl'],
        headers={'Content-Type': file.content_type},
        data=file
    )
    
    return jsonify({'url': data['downloadUrl']})

if __name__ == '__main__':
    app.run()
```

### PHP Backend

```php
<?php
$apiKey = getenv('CDN_API_KEY');
$cdnApi = 'https://your-domain.com/api/v1';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['file'])) {
    $file = $_FILES['file'];
    
    // Get presigned URL
    $ch = curl_init("$cdnApi/upload");
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer $apiKey",
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'filename' => $file['name'],
        'contentType' => $file['type'],
        'size' => $file['size']
    ]));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);
    $data = json_decode($response, true)['data'];
    
    // Upload file
    $ch = curl_init($data['uploadUrl']);
    curl_setopt($ch, CURLOPT_PUT, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Content-Type: {$file['type']}"
    ]);
    curl_setopt($ch, CURLOPT_INFILE, fopen($file['tmp_name'], 'r'));
    curl_setopt($ch, CURLOPT_INFILESIZE, $file['size']);
    curl_exec($ch);
    
    echo json_encode(['url' => $data['downloadUrl']]);
}
```

## Testing

Test the API using cURL:

```bash
# Get API key info
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://your-domain.com/api/v1/info

# List files
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://your-domain.com/api/v1/files

# Upload a file
# Step 1: Get upload URL
RESPONSE=$(curl -X POST https://your-domain.com/api/v1/upload \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.txt","contentType":"text/plain","size":100}')

# Step 2: Extract upload URL and upload
UPLOAD_URL=$(echo $RESPONSE | jq -r '.data.uploadUrl')
curl -X PUT "$UPLOAD_URL" \
  -H "Content-Type: text/plain" \
  --data "Hello, World!"
```

## Troubleshooting

### "Invalid or expired API key"
- Check that you're using the correct API key
- Verify the key hasn't been revoked
- Check if the key has expired

### "Rate limit exceeded"
- Wait for the rate limit window to reset (1 hour)
- Check your key's rate limit in the dashboard
- Consider upgrading your rate limit

### "Insufficient permissions"
- Check which permissions your key has
- Update key permissions in the dashboard

### "File too large"
- Check your key's upload size limit
- Compress the file or split into chunks
- Request a higher limit

## Support

- **Dashboard**: [/developers](/developers)
- **Documentation**: [/developers/docs](/developers/docs)
- **Check Status**: Use `/api/v1/info` to check key status and usage

## License

This API system is part of the Vercel Blob CDN project.
