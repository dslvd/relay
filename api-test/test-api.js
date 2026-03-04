/**
 * API Test Script for Vercel Blob CDN
 * 
 * This script tests all the main API endpoints to ensure they're working correctly.
 * 
 * Setup:
 * 1. npm install node-fetch
 * 2. Set your API key and base URL below
 * 3. Run: node test-api.js
 */

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// ===== CONFIGURATION =====
const API_KEY = 'vbc_882aea743695ce990c8a91736c5b6e0f70be28870b5385a4c0e7e790481bfc3e'; // Replace with your actual API key
const BASE_URL = 'https://relaycdn.vercel.app'; // Change to your deployed URL
// =========================

const API_URL = `${BASE_URL}/api/v1`;

// Color codes for terminal output
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

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'blue');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

// Test helper function
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
    if (error.response) {
      console.log('Response:', error.response);
    }
    return false;
  }
}

// API request helper
async function apiRequest(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error || 'Request failed');
    error.response = data;
    error.status = response.status;
    throw error;
  }

  return data;
}

// Test 1: Get API Key Info
async function testGetInfo() {
  logInfo('Requesting API key information...');
  
  const result = await apiRequest('/info');
  
  console.log('\nAPI Key Info:');
  console.log('  Name:', result.data.name);
  console.log('  ID:', result.data.id);
  console.log('  Active:', result.data.isActive);
  console.log('  Created:', result.data.createdAt);
  console.log('\nPermissions:');
  console.log('  Upload:', result.data.permissions.upload);
  console.log('  Download:', result.data.permissions.download);
  console.log('  Delete:', result.data.permissions.delete);
  console.log('  List:', result.data.permissions.list);
  console.log('\nRate Limits:');
  console.log('  Requests/hour:', result.data.rateLimit.requestsPerHour);
  console.log('  Max upload size:', result.data.rateLimit.uploadSizeLimitMB, 'MB');
  console.log('\nUsage:');
  console.log('  Total requests:', result.data.usage.requestCount);
  console.log('  Uploads:', result.data.usage.uploadCount);
  console.log('  Downloads:', result.data.usage.downloadCount);
  console.log('  Uploaded:', result.data.usage.totalUploadedMB, 'MB');
  console.log('  Downloaded:', result.data.usage.totalDownloadedMB, 'MB');
}

// Test 2: Upload a File
async function testUpload() {
  logInfo('Creating test file...');
  
  // Create a test file
  const testContent = 'Hello from API test! This is a test file created at ' + new Date().toISOString();
  const testFileName = `test-${Date.now()}.txt`;
  
  logInfo('Requesting upload URL...');
  
  // Step 1: Get presigned upload URL
  const uploadInit = await apiRequest('/upload', {
    method: 'POST',
    body: JSON.stringify({
      filename: testFileName,
      contentType: 'text/plain',
      size: Buffer.byteLength(testContent),
    }),
  });
  
  console.log('\nUpload Details:');
  console.log('  File ID:', uploadInit.data.fileId);
  console.log('  Download URL:', uploadInit.data.downloadUrl);
  console.log('  Direct URL:', uploadInit.data.directDownloadUrl);
  
  logInfo('Uploading file to presigned URL...');
  
  // Step 2: Upload the file
  const uploadResponse = await fetch(uploadInit.data.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'text/plain',
    },
    body: testContent,
  });
  
  if (!uploadResponse.ok) {
    throw new Error(`Upload failed with status ${uploadResponse.status}`);
  }
  
  logSuccess('File uploaded successfully!');
  
  // Store file ID for later tests
  global.testFileId = uploadInit.data.fileId;
  global.testDownloadUrl = uploadInit.data.downloadUrl;
  
  return uploadInit.data;
}

// Test 3: Get File Info
async function testGetFile() {
  if (!global.testFileId) {
    throw new Error('No test file ID available. Run upload test first.');
  }
  
  logInfo(`Getting info for file: ${global.testFileId}`);
  
  const result = await apiRequest(`/files/${encodeURIComponent(global.testFileId)}`);
  
  console.log('\nFile Info:');
  console.log('  File ID:', result.data.fileId);
  console.log('  Content Type:', result.data.contentType);
  console.log('  Size:', result.data.size, 'bytes');
  console.log('  Download URL:', result.data.downloadUrl);
  console.log('  Direct URL:', result.data.directDownloadUrl);
  console.log('  Expires in:', result.data.expiresIn, 'seconds');
}

// Test 4: List Files
async function testListFiles() {
  logInfo('Listing files...');
  
  const result = await apiRequest('/files?limit=10');
  
  console.log('\nFiles List:');
  console.log('  Total files:', result.data.total);
  console.log('  Returned:', result.data.count);
  console.log('  Has more:', result.data.hasMore);
  
  if (result.data.files.length > 0) {
    console.log('\nFirst few files:');
    result.data.files.slice(0, 3).forEach((file, i) => {
      console.log(`  ${i + 1}. ${file.name}`);
      console.log(`     Size: ${file.size} bytes`);
      console.log(`     Last modified: ${file.lastModified}`);
    });
  }
}

// Test 5: Download File
async function testDownload() {
  if (!global.testDownloadUrl) {
    throw new Error('No test download URL available. Run upload test first.');
  }
  
  logInfo('Downloading file...');
  
  const response = await fetch(global.testDownloadUrl);
  
  if (!response.ok) {
    throw new Error(`Download failed with status ${response.status}`);
  }
  
  const content = await response.text();
  
  console.log('\nDownloaded Content:');
  console.log('  Length:', content.length, 'bytes');
  console.log('  Content:', content.substring(0, 100) + (content.length > 100 ? '...' : ''));
  
  if (content.includes('Hello from API test!')) {
    logSuccess('Content matches uploaded data!');
  } else {
    logWarning('Content does not match expected data');
  }
}

// Test 6: Delete File (if permission is granted)
async function testDelete() {
  if (!global.testFileId) {
    throw new Error('No test file ID available. Run upload test first.');
  }
  
  logInfo(`Deleting file: ${global.testFileId}`);
  
  try {
    const result = await apiRequest(`/files/${encodeURIComponent(global.testFileId)}`, {
      method: 'DELETE',
    });
    
    console.log('\nDelete Result:');
    console.log('  Message:', result.data.message);
    console.log('  File ID:', result.data.fileId);
    
    logSuccess('File deleted successfully!');
  } catch (error) {
    if (error.status === 403) {
      logWarning('Delete permission not granted for this API key (this is expected if you disabled delete permission)');
    } else {
      throw error;
    }
  }
}

// Main test runner
async function runTests() {
  log('\n' + '='.repeat(60), 'blue');
  log('       Vercel Blob CDN API Test Suite', 'blue');
  log('='.repeat(60), 'blue');
  
  // Validate configuration
  if (API_KEY === 'YOUR_API_KEY_HERE') {
    logError('\n✗ Please set your API_KEY in the script before running tests!');
    logInfo('1. Visit http://localhost:3000/developers');
    logInfo('2. Create an API key');
    logInfo('3. Replace YOUR_API_KEY_HERE with your actual key');
    process.exit(1);
  }
  
  console.log(`\nConfiguration:`);
  console.log(`  API Key: ${API_KEY.substring(0, 10)}...`);
  console.log(`  Base URL: ${BASE_URL}`);
  
  const results = {
    passed: 0,
    failed: 0,
  };
  
  // Run all tests
  const tests = [
    ['Get API Key Info', testGetInfo],
    ['Upload File', testUpload],
    ['Get File Info', testGetFile],
    ['List Files', testListFiles],
    ['Download File', testDownload],
    ['Delete File', testDelete],
  ];
  
  for (const [name, testFn] of tests) {
    const success = await testEndpoint(name, testFn);
    if (success) {
      results.passed++;
    } else {
      results.failed++;
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  log('\n' + '='.repeat(60), 'blue');
  log('                    Test Summary', 'blue');
  log('='.repeat(60), 'blue');
  console.log(`\nTotal Tests: ${results.passed + results.failed}`);
  logSuccess(`Passed: ${results.passed}`);
  if (results.failed > 0) {
    logError(`Failed: ${results.failed}`);
  }
  
  log('\n' + '='.repeat(60), 'blue');
  
  if (results.failed === 0) {
    logSuccess('\n🎉 All tests passed! Your API is working correctly!');
  } else {
    logWarning('\n⚠️  Some tests failed. Check the errors above.');
  }
  
  console.log('');
}

// Run the tests
runTests().catch((error) => {
  logError('\nFatal error running tests:');
  console.error(error);
  process.exit(1);
});
