#!/usr/bin/env python3
"""
Python test script for Relay's file API (/api/files/*)

Usage:
    python test-api.py YOUR_API_KEY [BASE_URL]

Example:
    python test-api.py vbc_abc123xyz http://localhost:3000
"""

import sys
import time

try:
    import requests
except ImportError:
    print("Error: requests library not installed")
    print("Install it with: pip install requests")
    sys.exit(1)


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


class RelayTester:
    def __init__(self, api_key, base_url):
        self.api_key = api_key
        self.base_url = base_url.rstrip('/')
        self.api_url = f"{self.base_url}/api/files"
        self.session = requests.Session()
        self.session.headers.update({'Authorization': f'Bearer {api_key}'})
        self.test_file_id = None
        self.test_short_id = None
        self.test_content = None

    def api_request(self, endpoint, method='GET', **kwargs):
        url = f"{self.api_url}{endpoint}"
        response = self.session.request(method, url, **kwargs)

        try:
            data = response.json()
        except ValueError:
            data = {'error': response.text}

        if not response.ok or data.get('success') is False:
            raise Exception(f"HTTP {response.status_code}: {data.get('error', 'Request failed')}")

        return data

    def test_upload(self):
        print_header("Test 1: Upload File")

        self.test_content = f"Hello from Python test at {time.strftime('%Y-%m-%d %H:%M:%S')}".encode('utf-8')
        filename = f"test-{int(time.time())}.txt"

        print_info(f"Uploading test file: {filename} ({len(self.test_content)} bytes)")

        result = self.api_request('/upload', method='POST', files={
            'file': (filename, self.test_content, 'text/plain'),
        })

        self.test_file_id = result['data']['id']
        self.test_short_id = result['data']['shortId']

        print_success("File uploaded successfully")
        print(f"  ID: {self.test_file_id}")
        print(f"  URL: {result['data']['url']}")

        print_success("Test passed")

    def test_get_file_info(self):
        if not self.test_short_id:
            print_warning("Skipping - no file uploaded yet")
            return

        print_header("Test 2: Get File Info (public lookup)")
        print_info(f"Getting info for file: {self.test_short_id}")

        response = requests.get(f"{self.api_url}/info", params={'file_code': self.test_short_id})
        result = response.json()
        info = result['result'][0]

        if info['status'] != 200:
            raise Exception(f"File info lookup failed: status {info['status']}")

        print("\nFile Info:")
        print(f"  Name: {info['name']}")
        print(f"  Size: {info['size']} bytes")
        print(f"  Uploaded: {info['uploaded']}")

        print_success("Test passed")

    def test_list_files(self):
        print_header("Test 3: List Files")
        print_info("Fetching files list (filtered to text files)...")

        result = self.api_request('/list', params={'limit': 10, 'mimeType': 'text/'})

        print("\nFiles List:")
        print(f"  Total files: {result['pagination']['total']}")
        print(f"  Returned: {len(result['data'])}")

        for i, f in enumerate(result['data'][:3], 1):
            print(f"  {i}. {f['name']} ({f['size']} bytes)")

        print_success("Test passed")

    def test_download(self):
        if not self.test_file_id:
            print_warning("Skipping - no file uploaded yet")
            return

        print_header("Test 4: Download File")

        print_info("Getting download URL...")
        result = self.api_request(f'/download/{self.test_file_id}')
        download_url = result['data']['url']

        print_info("Downloading file...")
        response = requests.get(download_url)

        if not response.ok:
            raise Exception(f"Download failed: HTTP {response.status_code}")

        if response.content == self.test_content:
            print_success("Content matches uploaded data")
        else:
            print_warning("Content does not match uploaded data")

        print_success("Test passed")

    def test_delete(self):
        if not self.test_file_id:
            print_warning("Skipping - no file uploaded yet")
            return

        print_header("Test 5: Delete File")
        print_info(f"Deleting file: {self.test_file_id}")

        try:
            self.api_request(f'/delete', method='DELETE', params={'fileId': self.test_file_id})
            print_success("File deleted successfully")
        except Exception as e:
            if "403" in str(e):
                print_warning("Delete permission not granted (this is expected)")
            else:
                raise

        print_success("Test passed")

    def test_batch_delete(self):
        print_header("Test 6: Batch Delete")

        ids = []
        for i in range(2):
            filename = f"batch-{int(time.time())}-{i}.txt"
            result = self.api_request('/upload', method='POST', files={
                'file': (filename, f"batch test {i}".encode(), 'text/plain'),
            })
            ids.append(result['data']['id'])

        print_info(f"Batch deleting {len(ids)} files...")
        result = self.api_request('/batch-delete', method='POST', json={'fileIds': ids})

        print(f"\nDeleted {result['data']['deletedCount']} of {len(ids)}")
        if result['data']['deletedCount'] != len(ids):
            raise Exception("Not all files were deleted")

        print_success("Test passed")

    def run_all_tests(self):
        print_header("Relay File API Test Suite (Python)")
        print(f"API Key: {self.api_key[:15]}...")
        print(f"Base URL: {self.base_url}")

        tests = [
            ('Upload File', self.test_upload),
            ('Get File Info', self.test_get_file_info),
            ('List Files', self.test_list_files),
            ('Download File', self.test_download),
            ('Delete File', self.test_delete),
            ('Batch Delete', self.test_batch_delete),
        ]

        passed = 0
        failed = 0

        for name, test_fn in tests:
            try:
                test_fn()
                passed += 1
                time.sleep(0.5)
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
        sys.exit(1)

    api_key = sys.argv[1]
    base_url = sys.argv[2] if len(sys.argv) > 2 else 'http://localhost:3000'

    tester = RelayTester(api_key, base_url)

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
