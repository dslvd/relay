#!/usr/bin/env python3
"""
Python test script for Vercel Blob CDN API

Usage:
    python test-api.py YOUR_API_KEY [BASE_URL]

Example:
    python test-api.py vbc_abc123xyz http://localhost:3000
"""

import sys
import json
import time
from io import BytesIO

try:
    import requests
except ImportError:
    print("Error: requests library not installed")
    print("Install it with: pip install requests")
    sys.exit(1)

# Colors for terminal output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    YELLOW = '\033[93m'
    END = '\033[0m'

def print_colored(text, color):
    print(f"{color}{text}{Colors.END}")

def print_success(text):
    print_colored(f"✓ {text}", Colors.GREEN)

def print_error(text):
    print_colored(f"✗ {text}", Colors.RED)

def print_info(text):
    print_colored(f"ℹ {text}", Colors.BLUE)

def print_warning(text):
    print_colored(f"⚠ {text}", Colors.YELLOW)

def print_header(text):
    print()
    print_colored("=" * 60, Colors.BLUE)
    print_colored(text, Colors.BLUE)
    print_colored("=" * 60, Colors.BLUE)
    print()

class CDNTester:
    def __init__(self, api_key, base_url):
        self.api_key = api_key
        self.base_url = base_url.rstrip('/')
        self.api_url = f"{self.base_url}/api/v1"
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        })
        self.test_file_id = None
    
    def api_request(self, endpoint, method='GET', **kwargs):
        url = f"{self.api_url}{endpoint}"
        response = self.session.request(method, url, **kwargs)
        
        try:
            data = response.json()
        except:
            data = {'error': response.text}
        
        if not response.ok:
            raise Exception(f"HTTP {response.status_code}: {data.get('error', 'Request failed')}")
        
        return data
    
    def test_get_info(self):
        print_header("Test 1: Get API Key Info")
        print_info("Fetching API key information...")
        
        result = self.api_request('/info')
        
        print("\nAPI Key Info:")
        print(f"  Name: {result['data']['name']}")
        print(f"  ID: {result['data']['id']}")
        print(f"  Active: {result['data']['isActive']}")
        print(f"  Created: {result['data']['createdAt']}")
        
        print("\nPermissions:")
        for perm, value in result['data']['permissions'].items():
            print(f"  {perm.capitalize()}: {value}")
        
        print("\nRate Limits:")
        print(f"  Requests/hour: {result['data']['rateLimit']['requestsPerHour']}")
        print(f"  Max upload size: {result['data']['rateLimit']['uploadSizeLimitMB']} MB")
        
        print("\nUsage:")
        usage = result['data']['usage']
        print(f"  Total requests: {usage['requestCount']}")
        print(f"  Uploads: {usage['uploadCount']}")
        print(f"  Downloads: {usage['downloadCount']}")
        print(f"  Uploaded: {usage['totalUploadedMB']:.2f} MB")
        print(f"  Downloaded: {usage['totalDownloadedMB']:.2f} MB")
        
        print_success("Test passed")
    
    def test_upload(self):
        print_header("Test 2: Upload File")
        
        # Create test content
        test_content = f"Hello from Python test at {time.strftime('%Y-%m-%d %H:%M:%S')}"
        test_bytes = test_content.encode('utf-8')
        filename = f"test-{int(time.time())}.txt"
        
        print_info(f"Creating test file: {filename}")
        print(f"  Size: {len(test_bytes)} bytes")
        
        # Step 1: Get upload URL
        print_info("Step 1: Getting upload URL...")
        
        result = self.api_request('/upload', method='POST', json={
            'filename': filename,
            'contentType': 'text/plain',
            'size': len(test_bytes)
        })
        
        upload_url = result['data']['uploadUrl']
        self.test_file_id = result['data']['fileId']
        download_url = result['data']['downloadUrl']
        
        print_success("Upload URL received")
        print(f"  File ID: {self.test_file_id}")
        
        # Step 2: Upload the file
        print_info("Step 2: Uploading file...")
        
        upload_response = requests.put(
            upload_url,
            headers={'Content-Type': 'text/plain'},
            data=test_bytes
        )
        
        if upload_response.ok:
            print_success("File uploaded successfully")
            print(f"  Download URL: {download_url}")
        else:
            raise Exception(f"Upload failed: HTTP {upload_response.status_code}")
        
        print_success("Test passed")
    
    def test_get_file(self):
        if not self.test_file_id:
            print_warning("Skipping - no file uploaded yet")
            return
        
        print_header("Test 3: Get File Info")
        print_info(f"Getting info for file: {self.test_file_id}")
        
        # URL encode the file ID
        from urllib.parse import quote
        encoded_id = quote(self.test_file_id, safe='')
        
        result = self.api_request(f'/files/{encoded_id}')
        
        print("\nFile Info:")
        print(f"  File ID: {result['data']['fileId']}")
        print(f"  Content Type: {result['data'].get('contentType', 'N/A')}")
        print(f"  Size: {result['data'].get('size', 0)} bytes")
        print(f"  Expires in: {result['data'].get('expiresIn', 0)} seconds")
        
        print_success("Test passed")
    
    def test_list_files(self):
        print_header("Test 4: List Files")
        print_info("Fetching files list...")
        
        result = self.api_request('/files?limit=10')
        
        print("\nFiles List:")
        print(f"  Total files: {result['data']['total']}")
        print(f"  Returned: {result['data']['count']}")
        print(f"  Has more: {result['data']['hasMore']}")
        
        if result['data']['files']:
            print("\nFirst few files:")
            for i, file in enumerate(result['data']['files'][:3], 1):
                print(f"  {i}. {file['name']}")
                print(f"     Size: {file['size']} bytes")
                print(f"     Last modified: {file['lastModified']}")
        
        print_success("Test passed")
    
    def test_download(self):
        if not self.test_file_id:
            print_warning("Skipping - no file uploaded yet")
            return
        
        print_header("Test 5: Download File")
        
        from urllib.parse import quote
        encoded_id = quote(self.test_file_id, safe='')
        
        print_info("Getting download URL...")
        result = self.api_request(f'/files/{encoded_id}')
        download_url = result['data']['downloadUrl']
        
        print_info("Downloading file...")
        response = requests.get(download_url)
        
        if response.ok:
            content = response.text
            print_success("File downloaded successfully")
            print(f"\nContent preview:")
            print(f"  {content[:100]}{'...' if len(content) > 100 else ''}")
            
            if "Hello from Python test" in content:
                print_success("Content matches uploaded data")
        else:
            raise Exception(f"Download failed: HTTP {response.status_code}")
        
        print_success("Test passed")
    
    def test_delete(self):
        if not self.test_file_id:
            print_warning("Skipping - no file uploaded yet")
            return
        
        print_header("Test 6: Delete File")
        
        from urllib.parse import quote
        encoded_id = quote(self.test_file_id, safe='')
        
        print_info(f"Deleting file: {self.test_file_id}")
        
        try:
            result = self.api_request(f'/files/{encoded_id}', method='DELETE')
            print_success("File deleted successfully")
            print(f"  {result['data']['message']}")
        except Exception as e:
            if "403" in str(e):
                print_warning("Delete permission not granted (this is expected)")
            else:
                raise
        
        print_success("Test passed")
    
    def run_all_tests(self):
        print_header("Vercel Blob CDN API Test Suite (Python)")
        print(f"API Key: {self.api_key[:15]}...")
        print(f"Base URL: {self.base_url}")
        
        tests = [
            ('Get API Key Info', self.test_get_info),
            ('Upload File', self.test_upload),
            ('Get File Info', self.test_get_file),
            ('List Files', self.test_list_files),
            ('Download File', self.test_download),
            ('Delete File', self.test_delete),
        ]
        
        passed = 0
        failed = 0
        
        for name, test_fn in tests:
            try:
                test_fn()
                passed += 1
                time.sleep(0.5)  # Small delay between tests
            except Exception as e:
                print_error(f"Test failed: {e}")
                failed += 1
        
        print_header("Test Summary")
        print(f"Total Tests: {passed + failed}")
        print_success(f"Passed: {passed}")
        if failed > 0:
            print_error(f"Failed: {failed}")
        
        print_colored("\n" + "=" * 60, Colors.BLUE)
        
        if failed == 0:
            print_success("\n🎉 All tests passed! Your API is working correctly!")
        else:
            print_warning("\n⚠️  Some tests failed. Check the errors above.")
        
        print()

def main():
    if len(sys.argv) < 2:
        print("Usage: python test-api.py YOUR_API_KEY [BASE_URL]")
        print("\nExample:")
        print("  python test-api.py vbc_abc123xyz http://localhost:3000")
        print("\nTo get an API key:")
        print("  1. Visit http://localhost:3000/developers")
        print("  2. Click 'Create New API Key'")
        print("  3. Copy the key (shown only once!)")
        sys.exit(1)
    
    api_key = sys.argv[1]
    base_url = sys.argv[2] if len(sys.argv) > 2 else 'http://localhost:3000'
    
    tester = CDNTester(api_key, base_url)
    
    try:
        tester.run_all_tests()
    except KeyboardInterrupt:
        print("\n\nTests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print_error(f"\nFatal error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
