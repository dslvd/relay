# 🚨 Getting "Invalid or expired API key" Error?

This means you need to create an API key first! Here's how:

## Step-by-Step Solution

### 1. Open the Developer Dashboard

```bash
# If your server is running at localhost:3000
open http://localhost:3000/developers
# Or just visit it in your browser
```

### 2. Create Your First API Key

1. Click the **"+ Create New API Key"** button
2. Fill in the form:
   - **Name:** `Test Key` (or whatever you want)
   - **Permissions:** Keep all checked (upload, download, delete, list)
   - **Requests Per Hour:** 1000 (default is fine)
   - **Max Upload Size:** 100 MB (default is fine)
   - Leave expiration empty (no expiration)

3. Click **"Create API Key"**

### 3. Copy Your API Key

⚠️ **CRITICAL:** The API key is only shown ONCE!

- It looks like: `vbc_a1b2c3d4e5f6...` (starts with `vbc_`)
- Copy it immediately and save it somewhere safe
- Click "I've Saved My Key" after copying

### 4. Test Your API Key

Now run the test again with your actual API key:

```bash
# Method 1: Shell script (fastest)
./test-api.sh vbc_your_actual_api_key_here

# Method 2: Python
python test-api.py vbc_your_actual_api_key_here

# Method 3: Node.js (edit the file first)
# Open test-api.js and replace YOUR_API_KEY_HERE on line 12
# Then run:
node test-api.js

# Method 4: Browser (easiest)
open test-browser.html
# Enter your API key in the form
```

## Quick Diagnostic

Run this to check if everything is set up:

```bash
chmod +x setup.sh
./setup.sh
```

This will:
- ✓ Check if your server is running
- ✓ Check if the dashboard is accessible
- ✓ Check if the API endpoint is working
- ✓ Give you step-by-step instructions
- ✓ Optionally open the dashboard in your browser

## Common Issues

### Issue 1: "Server is not responding"
**Solution:** Start your dev server first:
```bash
cd ..
npm run dev
```

### Issue 2: "I forgot to copy my API key"
**Solution:** No problem! Just create a new one:
1. Go to `/developers`
2. Delete the old key (optional)
3. Create a new key
4. This time, copy it immediately!

### Issue 3: "I copied the wrong thing"
**Solution:** Make sure you copied the full key:
- ✓ Correct: `vbc_1234567890abcdef...` (long string starting with vbc_)
- ✗ Wrong: Just part of it, or something else

### Issue 4: "The dashboard shows 'No API keys yet'"
**Solution:** Click the "+ Create New API Key" button to create one

## Example: Full Workflow

1. **Start server:**
   ```bash
   cd /Users/matthewestilo/vercel-blob-cdn/vercel-blob-cdn
   npm run dev
   ```

2. **Open dashboard:**
   ```
   Visit: http://localhost:3000/developers
   ```

3. **Create key and copy it:**
   ```
   Click "Create New API Key" → Copy the key shown
   ```

4. **Test it:**
   ```bash
   cd api-test
   ./test-api.sh vbc_your_copied_key_here
   ```

5. **See success! 🎉**
   ```
   ✓ Get API Key Info - PASSED
   ✓ Upload File - PASSED
   ✓ List Files - PASSED
   ...
   ```

## Visual Guide

```
        Browser                    Your App
           |                          |
           | 1. Visit /developers    |
           |------------------------>|
           |                          |
           | 2. Click "Create Key"   |
           |------------------------>|
           |                          |
           | 3. Show API Key ONCE!   |
           |<------------------------|
           |   vbc_abc123...         |
           |                          |
           | 4. Copy & Save It! ⚠️    |
           |                          |
           
        Test Script
           |
           | 5. Use API Key
           |------------------------>|
           |   Authorization: Bearer |
           |   vbc_abc123...         |
           |                          |
           | 6. Success! ✓           |
           |<------------------------|
```

## Still Having Issues?

1. **Check the server logs** - Look for any errors in your terminal
2. **Try the browser test** - It's the most visual: `open test-browser.html`
3. **Verify the URL** - Make sure you're using the right base URL
4. **Check Redis** - If using Redis, make sure it's running

## Need Help?

Run the diagnostic script:
```bash
./setup.sh
```

It will diagnose your setup and guide you through the process!

---

**TL;DR:** Visit `http://localhost:3000/developers`, create an API key, copy it (only shown once!), then run: `./test-api.sh YOUR_API_KEY`
