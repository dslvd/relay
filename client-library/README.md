# Client Libraries for Vercel Blob CDN API

Pre-built client libraries in multiple languages to easily integrate with the CDN API.

## Available Libraries

- **JavaScript/TypeScript** - `vblob-cdn-client.ts`
- **Python** - `vblob_cdn_client.py`
- **PHP** - `VBlobCDN.php`

## Installation

### JavaScript/TypeScript

```bash
# Copy the file to your project
cp vblob-cdn-client.ts your-project/src/lib/

# Or install dependencies
npm install node-fetch  # If using Node.js
```

### Python

```bash
# Copy the file to your project
cp vblob_cdn_client.py your-project/

# Install dependencies
pip install requests
```

### PHP

```bash
# Copy the file to your project
cp VBlobCDN.php your-project/
```

## Quick Start

### JavaScript/TypeScript

```typescript
import { VBlobCDN } from './vblob-cdn-client';

const cdn = new VBlobCDN('your-api-key', 'https://your-domain.com');

// Upload a file
const file = document.querySelector('input[type="file"]').files[0];
const result = await cdn.upload(file);
console.log('Download URL:', result.downloadUrl);

// List files
const files = await cdn.listFiles({ limit: 50 });
console.log('Total files:', files.total);

// Get file info
const info = await cdn.getFile('file-id');

// Delete a file
await cdn.deleteFile('file-id');

// Get API key info
const apiInfo = await cdn.getInfo();
console.log('Usage:', apiInfo.usage);
```

### Node.js Example

```javascript
const { VBlobCDN } = require('./vblob-cdn-client');
const fs = require('fs');

const cdn = new VBlobCDN(process.env.CDN_API_KEY, 'https://your-domain.com');

// Upload from file system
async function uploadFile(filePath) {
  const file = fs.readFileSync(filePath);
  const result = await cdn.upload(
    file,
    'uploaded-file.png',
    'image/png'
  );
  console.log('Uploaded:', result.downloadUrl);
}

uploadFile('./image.png');
```

### Python

```python
from vblob_cdn_client import VBlobCDN

cdn = VBlobCDN('your-api-key', 'https://your-domain.com')

# Upload a file
with open('image.png', 'rb') as f:
    result = cdn.upload(f, 'image.png', 'image/png')
    print(f'Download URL: {result["downloadUrl"]}')

# List files
files = cdn.list_files(limit=50)
print(f'Total files: {files["total"]}')

# Get file info
info = cdn.get_file('file-id')

# Delete a file
cdn.delete_file('file-id')

# Get API key info
api_info = cdn.get_info()
print(f'Usage: {api_info["usage"]}')

# Using context manager (auto-cleanup)
with VBlobCDN('your-api-key', 'https://your-domain.com') as cdn:
    files = cdn.list_files()
```

### PHP

```php
<?php
require_once 'VBlobCDN.php';

$cdn = new VBlobCDN('your-api-key', 'https://your-domain.com');

try {
    // Upload a file
    $result = $cdn->upload('/path/to/image.png', 'image.png', 'image/png');
    echo 'Download URL: ' . $result['downloadUrl'];
    
    // List files
    $files = $cdn->listFiles(50);
    echo 'Total files: ' . $files['total'];
    
    // Get file info
    $info = $cdn->getFile('file-id');
    
    // Delete a file
    $cdn->deleteFile('file-id');
    
    // Get API key info
    $apiInfo = $cdn->getInfo();
    print_r($apiInfo['usage']);
    
    // Upload from string content
    $content = 'Hello, World!';
    $result = $cdn->uploadContent($content, 'hello.txt', 'text/plain');
    
} catch (VBlobCDNException $e) {
    echo 'Error: ' . $e->getMessage();
    echo 'Status: ' . $e->statusCode;
}
```

## API Reference

### Constructor

#### JavaScript/TypeScript
```typescript
new VBlobCDN(apiKey: string, baseUrl: string, timeout?: number)
```

#### Python
```python
VBlobCDN(api_key: str, base_url: str, timeout: int = 30)
```

#### PHP
```php
new VBlobCDN($apiKey, $baseUrl, $timeout = 30)
```

### Methods

All libraries support the same core methods:

#### `getInfo()`
Get API key information and usage statistics.

**Returns**: Object with API key details, permissions, rate limits, and usage stats

---

#### `upload(file, filename?, contentType?)`
Upload a file to the CDN.

**Parameters**:
- `file` - File to upload (File, Blob, Buffer, or file handle)
- `filename` - Name for the file (optional for File objects)
- `contentType` - MIME type (optional)

**Returns**: Object with `fileId`, `downloadUrl`, and `directDownloadUrl`

---

#### `getFile(fileId)`
Get information about a specific file.

**Parameters**:
- `fileId` - ID of the file

**Returns**: Object with file information and download URL

---

#### `listFiles(options?)`
List files uploaded with this API key.

**Parameters**:
- `options` - Options object with:
  - `limit` - Max files to return (default: 100, max: 1000)
  - `prefix` - Filter by key prefix

**Returns**: Object with `files` array, `count`, `total`, and `hasMore`

---

#### `deleteFile(fileId)`
Delete a file.

**Parameters**:
- `fileId` - ID of the file to delete

**Returns**: void

---

#### `downloadFile(fileId)`
Download file content.

**Parameters**:
- `fileId` - ID of the file

**Returns**: File content (Blob, bytes, or string depending on language)

---

#### `fileExists(fileId)`
Check if a file exists.

**Parameters**:
- `fileId` - ID of the file

**Returns**: Boolean

## Error Handling

### JavaScript/TypeScript

```typescript
import { VBlobCDN, VBlobCDNError } from './vblob-cdn-client';

try {
  const result = await cdn.upload(file);
} catch (error) {
  if (error instanceof VBlobCDNError) {
    console.error('API Error:', error.message);
    console.error('Status Code:', error.statusCode);
    console.error('Response:', error.response);
  }
}
```

### Python

```python
from vblob_cdn_client import VBlobCDN, VBlobCDNError

try:
    result = cdn.upload(file, 'file.png')
except VBlobCDNError as e:
    print(f'API Error: {e}')
    print(f'Status Code: {e.status_code}')
    print(f'Response: {e.response}')
```

### PHP

```php
try {
    $result = $cdn->upload('file.png', 'file.png');
} catch (VBlobCDNException $e) {
    echo 'API Error: ' . $e->getMessage();
    echo 'Status Code: ' . $e->statusCode;
    print_r($e->response);
}
```

## Complete Examples

### React File Upload Component

```typescript
import { useState } from 'react';
import { VBlobCDN } from './vblob-cdn-client';

function FileUpload() {
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState('');
  
  const cdn = new VBlobCDN(
    process.env.REACT_APP_CDN_API_KEY!,
    process.env.REACT_APP_CDN_BASE_URL!
  );
  
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const result = await cdn.upload(file);
      setUrl(result.downloadUrl);
      alert('Upload successful!');
    } catch (error) {
      alert('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <div>
      <input type="file" onChange={handleUpload} disabled={uploading} />
      {uploading && <p>Uploading...</p>}
      {url && <p>Download: <a href={url}>{url}</a></p>}
    </div>
  );
}
```

### Python Flask Upload Endpoint

```python
from flask import Flask, request, jsonify
from vblob_cdn_client import VBlobCDN, VBlobCDNError
import os

app = Flask(__name__)
cdn = VBlobCDN(os.environ['CDN_API_KEY'], os.environ['CDN_BASE_URL'])

@app.route('/upload', methods=['POST'])
def upload():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    
    try:
        result = cdn.upload(
            file.stream,
            file.filename,
            file.content_type
        )
        return jsonify(result)
    except VBlobCDNError as e:
        return jsonify({'error': str(e)}), e.status_code or 500

@app.route('/files', methods=['GET'])
def list_files():
    try:
        files = cdn.list_files(limit=50)
        return jsonify(files)
    except VBlobCDNError as e:
        return jsonify({'error': str(e)}), e.status_code or 500

if __name__ == '__main__':
    app.run(debug=True)
```

### PHP Upload Form Handler

```php
<?php
require_once 'VBlobCDN.php';

$cdn = new VBlobCDN(
    getenv('CDN_API_KEY'),
    getenv('CDN_BASE_URL')
);

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['file'])) {
    try {
        $file = $_FILES['file'];
        
        // Validate file
        if ($file['error'] !== UPLOAD_ERR_OK) {
            throw new Exception('Upload failed');
        }
        
        // Upload to CDN
        $result = $cdn->upload(
            $file['tmp_name'],
            $file['name'],
            $file['type']
        );
        
        // Return success
        header('Content-Type: application/json');
        echo json_encode([
            'success' => true,
            'url' => $result['downloadUrl']
        ]);
        
    } catch (VBlobCDNException $e) {
        http_response_code($e->statusCode ?: 500);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'error' => $e->getMessage()
        ]);
    }
}
?>
```

## Environment Variables

Set these environment variables for easier configuration:

```bash
# Your API key
CDN_API_KEY=vbc_your_api_key_here

# Base URL of your CDN
CDN_BASE_URL=https://your-domain.com
```

## Testing

### JavaScript/TypeScript

```bash
node -e "
const { VBlobCDN } = require('./vblob-cdn-client');
const cdn = new VBlobCDN(process.env.CDN_API_KEY, process.env.CDN_BASE_URL);
cdn.getInfo().then(console.log);
"
```

### Python

```bash
python -c "
from vblob_cdn_client import VBlobCDN
import os
cdn = VBlobCDN(os.environ['CDN_API_KEY'], os.environ['CDN_BASE_URL'])
print(cdn.get_info())
"
```

### PHP

```bash
php -r "
require 'VBlobCDN.php';
\$cdn = new VBlobCDN(getenv('CDN_API_KEY'), getenv('CDN_BASE_URL'));
print_r(\$cdn->getInfo());
"
```

## Best Practices

1. **Store API keys securely** - Use environment variables, never hardcode
2. **Handle errors gracefully** - Always wrap API calls in try-catch blocks
3. **Set appropriate timeouts** - Configure based on your file sizes
4. **Monitor usage** - Check API key usage regularly
5. **Use presigned URLs** - Don't proxy files through your server
6. **Validate files** - Check file types and sizes before uploading

## Support

- **Dashboard**: Access at `/developers`
- **Documentation**: Full API docs at `/developers/docs`
- **API Info**: Check status with `getInfo()` method

## License

These client libraries are part of the Vercel Blob CDN project.
