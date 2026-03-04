"""
Python Client Library for Vercel Blob CDN API

Usage:
    from vblob_cdn_client import VBlobCDN

    cdn = VBlobCDN('your-api-key', 'https://your-domain.com')

    # Upload a file
    with open('image.png', 'rb') as f:
        result = cdn.upload(f, 'image.png', 'image/png')
        print(f'Download URL: {result["downloadUrl"]}')

    # List files
    files = cdn.list_files()
    
    # Get file info
    info = cdn.get_file(file_id)
    
    # Delete a file
    cdn.delete_file(file_id)
"""

import json
import requests
from typing import Optional, Dict, Any, BinaryIO, List
from urllib.parse import urljoin, quote


class VBlobCDNError(Exception):
    """Exception raised for API errors."""
    
    def __init__(self, message: str, status_code: Optional[int] = None, response: Optional[Dict] = None):
        super().__init__(message)
        self.status_code = status_code
        self.response = response


class VBlobCDN:
    """Client for interacting with Vercel Blob CDN API."""
    
    def __init__(self, api_key: str, base_url: str, timeout: int = 30):
        """
        Initialize the CDN client.
        
        Args:
            api_key: Your API key
            base_url: Base URL of the CDN (e.g., 'https://your-domain.com')
            timeout: Request timeout in seconds (default: 30)
        """
        self.api_key = api_key
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        })
    
    def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """
        Make an API request.
        
        Args:
            method: HTTP method (GET, POST, DELETE, etc.)
            endpoint: API endpoint (e.g., '/info')
            **kwargs: Additional arguments for requests
            
        Returns:
            Response data
            
        Raises:
            VBlobCDNError: If the request fails
        """
        url = urljoin(self.base_url, f'/api/v1{endpoint}')
        
        try:
            response = self.session.request(
                method,
                url,
                timeout=self.timeout,
                **kwargs
            )
            
            data = response.json()
            
            if not response.ok:
                raise VBlobCDNError(
                    data.get('error', 'Request failed'),
                    response.status_code,
                    data
                )
            
            return data.get('data', {})
            
        except requests.exceptions.RequestException as e:
            raise VBlobCDNError(str(e))
    
    def get_info(self) -> Dict[str, Any]:
        """
        Get API key information and usage statistics.
        
        Returns:
            Dictionary containing API key info and usage stats
        """
        return self._request('GET', '/info')
    
    def upload(
        self,
        file: BinaryIO,
        filename: str,
        content_type: Optional[str] = None
    ) -> Dict[str, str]:
        """
        Upload a file to the CDN.
        
        Args:
            file: File object to upload
            filename: Name of the file
            content_type: MIME type of the file (optional)
            
        Returns:
            Dictionary with fileId, downloadUrl, and directDownloadUrl
            
        Example:
            with open('image.png', 'rb') as f:
                result = cdn.upload(f, 'image.png', 'image/png')
                print(result['downloadUrl'])
        """
        # Get file size
        file.seek(0, 2)  # Seek to end
        size = file.tell()
        file.seek(0)  # Seek back to start
        
        # Step 1: Get presigned upload URL
        upload_data = self._request(
            'POST',
            '/upload',
            json={
                'filename': filename,
                'contentType': content_type or 'application/octet-stream',
                'size': size
            }
        )
        
        # Step 2: Upload the file
        upload_response = requests.put(
            upload_data['uploadUrl'],
            headers={
                'Content-Type': content_type or 'application/octet-stream'
            },
            data=file,
            timeout=self.timeout
        )
        
        if not upload_response.ok:
            raise VBlobCDNError(
                'Failed to upload file',
                upload_response.status_code
            )
        
        return {
            'fileId': upload_data['fileId'],
            'downloadUrl': upload_data['downloadUrl'],
            'directDownloadUrl': upload_data['directDownloadUrl']
        }
    
    def get_file(self, file_id: str) -> Dict[str, Any]:
        """
        Get information about a file.
        
        Args:
            file_id: ID of the file
            
        Returns:
            Dictionary with file information
        """
        return self._request('GET', f'/files/{quote(file_id, safe="")}')
    
    def list_files(
        self,
        limit: Optional[int] = None,
        prefix: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        List files uploaded with this API key.
        
        Args:
            limit: Maximum number of files to return
            prefix: Filter files by key prefix
            
        Returns:
            Dictionary with files list and metadata
        """
        params = {}
        if limit is not None:
            params['limit'] = limit
        if prefix is not None:
            params['prefix'] = prefix
        
        return self._request('GET', '/files', params=params)
    
    def delete_file(self, file_id: str) -> None:
        """
        Delete a file.
        
        Args:
            file_id: ID of the file to delete
        """
        self._request('DELETE', f'/files/{quote(file_id, safe="")}')
    
    def download_file(self, file_id: str) -> bytes:
        """
        Download a file's content.
        
        Args:
            file_id: ID of the file
            
        Returns:
            File content as bytes
        """
        file_info = self.get_file(file_id)
        
        response = requests.get(
            file_info['downloadUrl'],
            timeout=self.timeout
        )
        
        if not response.ok:
            raise VBlobCDNError(
                'Failed to download file',
                response.status_code
            )
        
        return response.content
    
    def file_exists(self, file_id: str) -> bool:
        """
        Check if a file exists.
        
        Args:
            file_id: ID of the file
            
        Returns:
            True if file exists, False otherwise
        """
        try:
            self.get_file(file_id)
            return True
        except VBlobCDNError as e:
            if e.status_code == 404:
                return False
            raise
    
    def close(self):
        """Close the session."""
        self.session.close()
    
    def __enter__(self):
        """Context manager entry."""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.close()


# Example usage
if __name__ == '__main__':
    import os
    
    # Get API key from environment
    api_key = os.environ.get('CDN_API_KEY')
    base_url = os.environ.get('CDN_BASE_URL', 'https://your-domain.com')
    
    if not api_key:
        print('Error: CDN_API_KEY environment variable not set')
        exit(1)
    
    # Create client
    with VBlobCDN(api_key, base_url) as cdn:
        # Get API info
        info = cdn.get_info()
        print(f'API Key: {info["name"]}')
        print(f'Uploads: {info["usage"]["uploadCount"]}')
        print(f'Downloads: {info["usage"]["downloadCount"]}')
        print()
        
        # List files
        files = cdn.list_files(limit=10)
        print(f'Total files: {files["total"]}')
        for file in files['files']:
            print(f'  - {file["name"]} ({file["size"]} bytes)')
