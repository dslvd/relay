# API Test Scripts

Test the Relay file API (`/api/files/*`) to ensure everything is working correctly.

## Quick Start

Choose the method that works best for you:

### Method 1: Shell Script (Fastest - No dependencies!)

```bash
# Just run it!
./test-api.sh YOUR_API_KEY http://localhost:3000
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

No dependencies to install - Node 18+ has native `fetch`/`FormData`/`Blob`.

1. **Get your API key:**
   - Visit `http://localhost:3000/api` (or your deployed URL)
   - Create an API key
   - Copy the API key (it's only shown once!)

2. **Edit the test script:**
   ```bash
   # Open test-api.js and replace:
   const API_KEY = 'YOUR_API_KEY_HERE'; // Replace with your actual key
   const BASE_URL = 'http://localhost:3000'; // Or your deployed URL
   ```

3. **Run the tests:**
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
   - API Key: Your generated API key (optional - anonymous uploads work too)
   - Base URL: `http://localhost:3000` or your deployed URL

3. **Run tests:**
   - Click individual test buttons to test specific endpoints
   - Or click "Run All Tests" to test everything

## What Gets Tested

### ✓ Test 1: Upload File
- Endpoint: `POST /api/files/upload`
- Single-shot multipart/form-data upload
- Returns the file record (id, shortId, url, ...)

### ✓ Test 2: Get File Info
- Endpoint: `GET /api/files/info?file_code=SHORT_ID`
- Public lookup by short ID (no API key required)

### ✓ Test 3: List Files
- Endpoint: `GET /api/files/list`
- Tests pagination and the `q`/`mimeType` filters
- Shows files uploaded with your API key

### ✓ Test 4: Download File
- Endpoint: `GET /api/files/download/{fileId}`
- Fetches a presigned URL, then downloads and verifies content

### ✓ Test 5: Delete File
- Endpoint: `DELETE /api/files/delete?fileId=FILE_ID`
- Tests file deletion (if permission is granted)

### ✓ Test 6: Batch Delete
- Endpoint: `POST /api/files/batch-delete`
- Uploads two throwaway files, then deletes both in one call

## Expected Output (Node.js)

```
============================================================
       Relay File API Test Suite
============================================================

Configuration:
  API Key: vbc_abc123...
  Base URL: http://localhost:3000

============================================================
Testing: Upload File
============================================================

Upload Result:
  ID: 7f3a1c9e-4b82-4d15-9a67-2e8c5f1d3b90
  Short ID: k7Qm2Xrs
  URL: https://.../dl/...

✓ Upload File - PASSED

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
- Get one from the `/api` dashboard

### Error: "Invalid or expired API key"
- Check that your API key is correct
- Verify the key hasn't been revoked
- Ensure the key hasn't expired

### Error: "Rate limit exceeded"
- Wait for the rate limit window to reset (1 hour)
- Check your key's rate limit in the dashboard

### Error: "Storage limit exceeded" (HTTP 507)
- Your key has hit its total storage quota (10GB by default)
- Delete some files or raise `rateLimit.storageLimit` on the key

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
  ['Upload File', testUpload],
  // ['Delete File', testDelete],  // Skip this
];
```

## API Response Examples

### Successful Response
```json
{
  "success": true,
  "data": {
    "id": "7f3a1c9e-4b82-4d15-9a67-2e8c5f1d3b90",
    "shortId": "k7Qm2Xrs",
    "name": "photo.png",
    "url": "https://...",
    "viewUrl": "https://.../i/k7Qm2Xrs"
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
    node test-api.js
  env:
    API_KEY: ${{ secrets.RELAY_API_KEY }}
    BASE_URL: ${{ secrets.RELAY_BASE_URL }}
```

## Files in This Directory

- `test-api.sh` - Shell script (no dependencies, works anywhere!)
- `test-api.py` - Python test script (requires `requests`)
- `test-api.js` - Node.js test script (no dependencies, Node 18+)
- `test-browser.html` - Browser-based test interface (no installation)
- `package.json` - `npm test` entry point
- `README.md` - This file

## Which Test Method Should I Use?

| Method | Best For | Pros | Cons |
|--------|----------|------|------|
| **Shell Script** | Quick tests, CI/CD | No dependencies, fast | Requires bash/curl |
| **Python** | Python developers | Easy to read, modify | Requires Python + requests |
| **Node.js** | Automation, CI/CD | Good for npm projects | Requires Node 18+ |
| **Browser** | Manual testing, demos | Visual, interactive | Not automated |

## Support

If tests fail or you encounter issues:

1. Check the error messages - they're descriptive
2. Verify your API key in the dashboard
3. Check your API key permissions
4. Review the API documentation at `/docs`
5. Check the console for detailed error logs

## Next Steps

After verifying your API works:

1. Try the client libraries in `../client-library/`
2. Read the full API docs at `/docs`, including the new "Webhooks" page for
   getting notified on `file.created`/`file.deleted` instead of polling
3. Integrate the API into your application
4. Monitor usage in the developer dashboard

Happy testing! 🚀
