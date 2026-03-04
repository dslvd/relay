# API Test Scripts

Test your Vercel Blob CDN API to ensure everything is working correctly.

## Quick Start

Choose the method that works best for you:

### Method 1: Shell Script (Fastest - No dependencies!)

```bash
# Just run it!
./test-api.sh vbc_d21b75615fa1a2f20aa6fbff8e6e5378158ec1b2f79804926f862ebbc9154eed http://localhost:3000
```

### Method 2: Python Script (Great for Python developers)

```bash
# Install requests if needed
pip install requests

# Run the tests
python test-api.py YOUR_API_KEY http://localhost:3000
# or
./test-api.py YOUR_API_KEY http://localhost:3000
```

### Method 3: Node.js Test Script (Best for automation)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Get your API key:**
   - Visit `http://localhost:3000/developers` (or your deployed URL)
   - Click "Create New API Key"
   - Copy the API key (it's only shown once!)

3. **Edit the test script:**
   ```bash
   # Open test-api.js and replace:
   const API_KEY = 'YOUR_API_KEY_HERE'; // Replace with your actual key
   const BASE_URL = 'http://localhost:3000'; // Or your deployed URL
   ```

4. **Run the tests:**
   ```bash
   node test-api.js
   # or
   npm test
   ```

### Method 4: Browser Test (Interactive - No installation needed!)

1. **Open the HTML file:**
   ```bash
   # Just open test-browser.html in your browser
   open test-browser.html
   ```

2. **Enter your configuration:**
   - API Key: Your generated API key
   - Base URL: `http://localhost:3000` or your deployed URL

3. **Run tests:**
   - Click individual test buttons to test specific endpoints
   - Or click "Run All Tests" to test everything

## What Gets Tested

### ✓ Test 1: Get API Key Info
- Endpoint: `GET /api/v1/info`
- Tests authentication
- Shows API key details, permissions, and usage stats

### ✓ Test 2: Upload File
- Endpoint: `POST /api/v1/upload`
- Tests file upload flow
- Creates a test file and uploads it
- Returns download URLs

### ✓ Test 3: Get File Info
- Endpoint: `GET /api/v1/files/[fileId]`
- Tests file metadata retrieval
- Gets info about the uploaded file

### ✓ Test 4: List Files
- Endpoint: `GET /api/v1/files`
- Tests file listing
- Shows all files uploaded with your API key

### ✓ Test 5: Download File
- Tests downloading the uploaded file
- Verifies content matches what was uploaded

### ✓ Test 6: Delete File
- Endpoint: `DELETE /api/v1/files/[fileId]`
- Tests file deletion (if permission is granted)
- Cleans up the test file

## Expected Output (Node.js)

```
============================================================
       Vercel Blob CDN API Test Suite
============================================================

Configuration:
  API Key: vbc_abc123...
  Base URL: http://localhost:3000

============================================================
Testing: Get API Key Info
============================================================

API Key Info:
  Name: Test Key
  ID: abc123
  Active: true
  Created: 2026-03-04T...

Permissions:
  Upload: true
  Download: true
  Delete: false
  List: true

Rate Limits:
  Requests/hour: 1000
  Max upload size: 100 MB

Usage:
  Total requests: 5
  Uploads: 2
  Downloads: 3
  Uploaded: 1.5 MB
  Downloaded: 2.3 MB

✓ Get API Key Info - PASSED

... (more tests)

============================================================
                    Test Summary
============================================================

Total Tests: 6
✓ Passed: 6

============================================================

🎉 All tests passed! Your API is working correctly!
```

## Troubleshooting

### Error: "Please set your API_KEY"
- You need to replace `YOUR_API_KEY_HERE` with your actual API key
- Get one from `/developers` dashboard

### Error: "fetch is not defined" (Node.js)
- Make sure you installed dependencies: `npm install`
- Or install node-fetch manually: `npm install node-fetch@2`

### Error: "Invalid or expired API key"
- Check that your API key is correct
- Verify the key hasn't been revoked
- Ensure the key hasn't expired

### Error: "Rate limit exceeded"
- Wait for the rate limit window to reset (1 hour)
- Check your key's rate limit in the dashboard

### Error: "Connection refused"
- Make sure your dev server is running: `npm run dev`
- Check that BASE_URL is correct

### Error: "Insufficient permissions"
- Some tests require specific permissions (e.g., delete)
- This is normal if you disabled certain permissions
- The test will show a warning instead of failing

## Advanced Usage

### Test Against Production

```javascript
// In test-api.js, change:
const BASE_URL = 'https://your-production-domain.com';
```

### Test Specific Endpoints Only

```javascript
// Comment out tests you don't want to run:
const tests = [
  ['Get API Key Info', testGetInfo],
  // ['Upload File', testUpload],  // Skip this
  // ['Delete File', testDelete],  // Skip this
];
```

### Custom Test File

```javascript
// In testUpload(), change the test content:
const testContent = 'Your custom test data here';
const testFileName = 'your-custom-name.txt';
```

## API Response Examples

### Successful Response
```json
{
  "success": true,
  "data": {
    "fileId": "d/api/abc123/...",
    "downloadUrl": "https://...",
    "directDownloadUrl": "https://..."
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Invalid API key"
}
```

## CI/CD Integration

You can integrate these tests into your CI/CD pipeline:

```yaml
# Example GitHub Actions
- name: Test API
  run: |
    cd api-test
    npm install
    node test-api.js
  env:
    API_KEY: ${{ secrets.CDN_API_KEY }}
    BASE_URL: ${{ secrets.CDN_BASE_URL }}
```

## Files in This Directory

- `test-api.sh` - Shell script (no dependencies, works anywhere!)
- `test-api.py` - Python test script (requires `requests`)
- `test-api.js` - Node.js test script (requires `node-fetch`)
- `test-browser.html` - Browser-based test interface (no installation)
- `package.json` - Node.js dependencies
- `README.md` - This file

## Which Test Method Should I Use?

| Method | Best For | Pros | Cons |
|--------|----------|------|------|
| **Shell Script** | Quick tests, CI/CD | No dependencies, fast | Requires bash/curl |
| **Python** | Python developers | Easy to read, modify | Requires Python + requests |
| **Node.js** | Automation, CI/CD | Good for npm projects | Requires Node.js + dependencies |
| **Browser** | Manual testing, demos | Visual, interactive | Not automated |

## Support

If tests fail or you encounter issues:

1. Check the error messages - they're descriptive
2. Verify your API key in the dashboard
3. Check your API key permissions
4. Review the API documentation at `/developers/docs`
5. Check the console for detailed error logs

## Next Steps

After verifying your API works:

1. Try the client libraries in `../client-library/`
2. Read the full API docs at `/developers/docs`
3. Integrate the API into your application
4. Monitor usage in the developer dashboard

Happy testing! 🚀
