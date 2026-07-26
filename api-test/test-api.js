/**
 * API Test Script for Relay's file API (/api/files/*)
 *
 * This script tests the main /api/files endpoints end to end.
 *
 * Setup:
 * 1. npm install (Node 18+ has native fetch/FormData/Blob - no extra deps needed)
 * 2. Set your API key and base URL below
 * 3. Run: node test-api.js
 */

// ===== CONFIGURATION =====
const API_KEY = 'YOUR_API_KEY_HERE'; // Replace with your actual API key
const BASE_URL = 'http://localhost:3000'; // Or your deployed URL
// =========================

const API_URL = `${BASE_URL}/api/files`;

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) { log(`✓ ${message}`, 'green'); }
function logError(message) { log(`✗ ${message}`, 'red'); }
function logInfo(message) { log(`ℹ ${message}`, 'blue'); }
function logWarning(message) { log(`⚠ ${message}`, 'yellow'); }

async function testEndpoint(name, testFn) {
  log(`\n${'='.repeat(60)}`, 'blue');
  log(`Testing: ${name}`, 'blue');
  log('='.repeat(60), 'blue');

  try {
    await testFn();
    logSuccess(`${name} - PASSED`);
    return true;
  } catch (error) {
    logError(`${name} - FAILED`);
    logError(`Error: ${error.message}`);
    if (error.response) console.log('Response:', error.response);
    return false;
  }
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok || data.success === false) {
    const error = new Error(data.error || 'Request failed');
    error.response = data;
    error.status = response.status;
    throw error;
  }

  return data;
}

// Test 1: Upload File
async function testUpload() {
  logInfo('Creating and uploading test file...');

  const testContent = 'Hello from API test! This is a test file created at ' + new Date().toISOString();
  const testFileName = `test-${Date.now()}.txt`;

  const form = new FormData();
  form.append('file', new Blob([testContent], { type: 'text/plain' }), testFileName);

  const result = await apiRequest('/upload', { method: 'POST', body: form });

  console.log('\nUpload Result:');
  console.log('  ID:', result.data.id);
  console.log('  Short ID:', result.data.shortId);
  console.log('  URL:', result.data.url);

  global.testFileId = result.data.id;
  global.testShortId = result.data.shortId;
  global.testContent = testContent;

  logSuccess('File uploaded successfully!');
}

// Test 2: Get File Info (public, by short ID)
async function testGetFileInfo() {
  if (!global.testShortId) throw new Error('No test file uploaded yet.');

  logInfo(`Getting info for file: ${global.testShortId}`);

  const response = await fetch(`${API_URL}/info?file_code=${global.testShortId}`);
  const result = await response.json();
  const info = result.result[0];

  if (info.status !== 200) throw new Error(`File info lookup failed: status ${info.status}`);

  console.log('\nFile Info:');
  console.log('  Name:', info.name);
  console.log('  Size:', info.size, 'bytes');
  console.log('  Uploaded:', info.uploaded);
}

// Test 3: List Files
async function testListFiles() {
  logInfo('Listing files (filtered to text files)...');

  const result = await apiRequest('/list?limit=10&mimeType=text/');

  console.log('\nFiles List:');
  console.log('  Total files:', result.pagination.total);
  console.log('  Returned:', result.data.length);

  result.data.slice(0, 3).forEach((f, i) => {
    console.log(`  ${i + 1}. ${f.name} (${f.size} bytes)`);
  });
}

// Test 4: Download File
async function testDownload() {
  if (!global.testFileId) throw new Error('No test file uploaded yet.');

  logInfo('Getting download URL...');
  const result = await apiRequest(`/download/${global.testFileId}`);

  logInfo('Downloading file...');
  const response = await fetch(result.data.url);
  if (!response.ok) throw new Error(`Download failed with status ${response.status}`);

  const content = await response.text();
  console.log('\nDownloaded Content:');
  console.log('  Length:', content.length, 'bytes');

  if (content === global.testContent) {
    logSuccess('Content matches uploaded data!');
  } else {
    logWarning('Content does not match expected data');
  }
}

// Test 5: Delete File
async function testDelete() {
  if (!global.testFileId) throw new Error('No test file uploaded yet.');

  logInfo(`Deleting file: ${global.testFileId}`);

  try {
    await apiRequest(`/delete?fileId=${global.testFileId}`, { method: 'DELETE' });
    logSuccess('File deleted successfully!');
  } catch (error) {
    if (error.status === 403) {
      logWarning('Delete permission not granted for this API key (expected if you disabled it)');
    } else {
      throw error;
    }
  }
}

// Test 6: Batch Delete
async function testBatchDelete() {
  logInfo('Uploading two throwaway files for batch delete...');

  const ids = [];
  for (let i = 0; i < 2; i++) {
    const form = new FormData();
    form.append('file', new Blob([`batch test ${i}`], { type: 'text/plain' }), `batch-${Date.now()}-${i}.txt`);
    const result = await apiRequest('/upload', { method: 'POST', body: form });
    ids.push(result.data.id);
  }

  logInfo(`Batch deleting ${ids.length} files...`);
  const result = await apiRequest('/batch-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileIds: ids }),
  });

  console.log('\nBatch Delete Result:');
  console.log('  Deleted:', result.data.deletedCount, 'of', ids.length);

  if (result.data.deletedCount !== ids.length) {
    throw new Error('Not all files were deleted');
  }
  logSuccess('Batch delete succeeded!');
}

async function runTests() {
  log('\n' + '='.repeat(60), 'blue');
  log('       Relay File API Test Suite', 'blue');
  log('='.repeat(60), 'blue');

  if (API_KEY === 'YOUR_API_KEY_HERE') {
    logError('\n✗ Please set your API_KEY in the script before running tests!');
    logInfo('1. Visit http://localhost:3000/api (or /developers, depending on your deployment)');
    logInfo('2. Create an API key');
    logInfo('3. Replace YOUR_API_KEY_HERE with your actual key');
    process.exit(1);
  }

  console.log(`\nConfiguration:`);
  console.log(`  API Key: ${API_KEY.substring(0, 10)}...`);
  console.log(`  Base URL: ${BASE_URL}`);

  const results = { passed: 0, failed: 0 };

  const tests = [
    ['Upload File', testUpload],
    ['Get File Info', testGetFileInfo],
    ['List Files', testListFiles],
    ['Download File', testDownload],
    ['Delete File', testDelete],
    ['Batch Delete', testBatchDelete],
  ];

  for (const [name, testFn] of tests) {
    const success = await testEndpoint(name, testFn);
    if (success) results.passed++; else results.failed++;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  log('\n' + '='.repeat(60), 'blue');
  log('                    Test Summary', 'blue');
  log('='.repeat(60), 'blue');
  console.log(`\nTotal Tests: ${results.passed + results.failed}`);
  logSuccess(`Passed: ${results.passed}`);
  if (results.failed > 0) logError(`Failed: ${results.failed}`);

  log('\n' + '='.repeat(60), 'blue');

  if (results.failed === 0) {
    logSuccess('\n🎉 All tests passed! Your API is working correctly!');
  } else {
    logWarning('\n⚠️  Some tests failed. Check the errors above.');
  }

  console.log('');
}

runTests().catch((error) => {
  logError('\nFatal error running tests:');
  console.error(error);
  process.exit(1);
});
