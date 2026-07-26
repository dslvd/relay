"""
Python Client Library for the Relay file API

Targets /api/files/* (see /docs on your deployment). The older /api/v1/*
surface this client used to call is deprecated - see
app/lib/auth/api-auth.ts's withDeprecatedApiAuth.

Usage:
    from vblob_cdn_client import VBlobCDN

    cdn = VBlobCDN('your-api-key', 'https://your-domain.com')

    with open('image.png', 'rb') as f:
        result = cdn.upload(f, 'image.png', 'image/png')
        print(f'URL: {result["url"]}')

    files = cdn.list_files(q='invoice')
    info = cdn.get_file_info(result['shortId'])
    cdn.delete_file(result['id'])

Files above a few MB should use the multipart endpoints
(/api/files/multipart/init, batch-urls, complete, abort) documented at
/docs - this lightweight client only covers the single-shot upload path.
"""

import json
from typing import Optional, Dict, Any, BinaryIO, List, Union

try:
    import requests
except ImportError:
    raise ImportError("Install the 'requests' library: pip install requests")


class VBlobCDNError(Exception):
    """Exception raised for API errors."""

    def __init__(self, message: str, status_code: Optional[int] = None, response: Optional[Dict] = None):
        super().__init__(message)
        self.status_code = status_code
        self.response = response


class VBlobCDN:
    """Client for interacting with the Relay file API."""

    def __init__(self, api_key: Optional[str], base_url: str, timeout: int = 30):
        """
        Args:
            api_key: Your API key (optional - omit for anonymous requests)
            base_url: Base URL of your Relay deployment (e.g. 'https://your-domain.com')
            timeout: Request timeout in seconds (default: 30)
        """
        self.api_key = api_key
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self.session = requests.Session()
        if api_key:
            self.session.headers.update({'Authorization': f'Bearer {api_key}'})

    def _request(self, method: str, path: str, **kwargs) -> Dict[str, Any]:
        url = f'{self.base_url}{path}'
        response = self.session.request(method, url, timeout=self.timeout, **kwargs)

        try:
            data = response.json()
        except ValueError:
            data = {'error': response.text}

        if not response.ok or data.get('success') is False:
            raise VBlobCDNError(data.get('error', 'Request failed'), response.status_code, data)

        return data

    def upload(self, file: BinaryIO, filename: str, content_type: Optional[str] = None, folder_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Upload a file in one call.

        Anonymous (no API key) uploads are capped at 25GB and expire after
        15 days; key-owned uploads are capped by the key's
        rateLimit.uploadSizeLimit and total storage quota.

        Returns the file record: id, name, size, url, viewUrl, mimeType,
        createdAt, isAnonymous, expiresAt, shortId.
        """
        files = {'file': (filename, file, content_type or 'application/octet-stream')}
        data = {}
        if folder_id:
            data['folderId'] = folder_id

        result = self._request('POST', '/api/files/upload', files=files, data=data)
        return result['data']

    def remote_upload(self, url: str, folder_id: Optional[str] = None) -> Dict[str, Any]:
        """Have the server fetch a URL and store it. Same limits as upload()."""
        body: Dict[str, Any] = {'url': url}
        if folder_id:
            body['folderId'] = folder_id
        result = self._request('POST', '/api/files/remote-upload', json=body)
        return result['data']

    def list_files(
        self,
        page: Optional[int] = None,
        limit: Optional[int] = None,
        folder_id: Optional[str] = None,
        q: Optional[str] = None,
        mime_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        List files uploaded with this API key. Requires the "list" permission.

        q: case-insensitive substring match on filename.
        mime_type: prefix match on MIME type, e.g. "image/".
        """
        params = {}
        if page is not None:
            params['page'] = page
        if limit is not None:
            params['limit'] = limit
        if folder_id is not None:
            params['folderId'] = folder_id
        if q is not None:
            params['q'] = q
        if mime_type is not None:
            params['mimeType'] = mime_type

        return self._request('GET', '/api/files/list', params=params)

    def get_file_info(self, short_id_or_ids: Union[str, List[str]]) -> List[Dict[str, Any]]:
        """Look up one or more files by their short ID (public - no API key needed)."""
        codes = ','.join(short_id_or_ids) if isinstance(short_id_or_ids, list) else short_id_or_ids
        result = self._request('GET', '/api/files/info', params={'file_code': codes})
        return result['result']

    def get_download_url(self, file_id: str) -> Dict[str, Any]:
        """Get a fresh presigned download URL for a file by its UUID (public - no API key needed)."""
        result = self._request('GET', f'/api/files/download/{file_id}')
        return result['data']

    def download_file(self, file_id: str) -> bytes:
        """Download a file's content."""
        info = self.get_download_url(file_id)
        response = requests.get(info['url'], timeout=self.timeout)
        if not response.ok:
            raise VBlobCDNError('Failed to download file', response.status_code)
        return response.content

    def delete_file(self, file_id: str, deletion_token: Optional[str] = None) -> None:
        """
        Delete a file by its UUID. Owner keys authenticate via the
        Authorization header; anonymous uploads need their deletion token
        instead.
        """
        params = {'fileId': file_id}
        if deletion_token:
            params['token'] = deletion_token
        self._request('DELETE', '/api/files/delete', params=params)

    def batch_delete_files(self, file_ids: List[str]) -> Dict[str, Any]:
        """Delete up to 100 key-owned files in one call. Requires the "delete" permission."""
        result = self._request('POST', '/api/files/batch-delete', json={'fileIds': file_ids})
        return result['data']

    def close(self):
        self.session.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


if __name__ == '__main__':
    import os

    api_key = os.environ.get('CDN_API_KEY')
    base_url = os.environ.get('CDN_BASE_URL', 'https://your-domain.com')

    if not api_key:
        print('Error: CDN_API_KEY environment variable not set')
        exit(1)

    with VBlobCDN(api_key, base_url) as cdn:
        files = cdn.list_files(limit=10)
        print(f'Total files: {files["pagination"]["total"]}')
        for f in files['data']:
            print(f'  - {f["name"]} ({f["size"]} bytes)')
