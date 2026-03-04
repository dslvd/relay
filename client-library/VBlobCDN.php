<?php
/**
 * PHP Client Library for Vercel Blob CDN API
 * 
 * Usage:
 * ```php
 * require_once 'VBlobCDN.php';
 * 
 * $cdn = new VBlobCDN('your-api-key', 'https://your-domain.com');
 * 
 * // Upload a file
 * $result = $cdn->upload('/path/to/file.png', 'image.png', 'image/png');
 * echo 'Download URL: ' . $result['downloadUrl'];
 * 
 * // List files
 * $files = $cdn->listFiles();
 * 
 * // Get file info
 * $info = $cdn->getFile($fileId);
 * 
 * // Delete a file
 * $cdn->deleteFile($fileId);
 * ```
 */

class VBlobCDNException extends Exception {
    public $statusCode;
    public $response;
    
    public function __construct($message, $statusCode = null, $response = null) {
        parent::__construct($message);
        $this->statusCode = $statusCode;
        $this->response = $response;
    }
}

class VBlobCDN {
    private $apiKey;
    private $baseUrl;
    private $timeout;
    
    /**
     * Initialize the CDN client
     * 
     * @param string $apiKey Your API key
     * @param string $baseUrl Base URL of the CDN
     * @param int $timeout Request timeout in seconds (default: 30)
     */
    public function __construct($apiKey, $baseUrl, $timeout = 30) {
        $this->apiKey = $apiKey;
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->timeout = $timeout;
    }
    
    /**
     * Make an API request
     * 
     * @param string $method HTTP method
     * @param string $endpoint API endpoint
     * @param mixed $data Request data
     * @param array $headers Additional headers
     * @return array Response data
     * @throws VBlobCDNException
     */
    private function request($method, $endpoint, $data = null, $headers = []) {
        $url = $this->baseUrl . '/api/v1' . $endpoint;
        
        $ch = curl_init($url);
        
        $defaultHeaders = [
            'Authorization: Bearer ' . $this->apiKey,
            'Content-Type: application/json'
        ];
        
        $allHeaders = array_merge($defaultHeaders, $headers);
        
        curl_setopt($ch, CURLOPT_HTTPHEADER, $allHeaders);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, $this->timeout);
        
        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            if ($data !== null) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            }
        } elseif ($method === 'DELETE') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
        } elseif ($method === 'PUT') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
            if ($data !== null) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
            }
        }
        
        $response = curl_exec($ch);
        $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        
        curl_close($ch);
        
        if ($error) {
            throw new VBlobCDNException($error);
        }
        
        $responseData = json_decode($response, true);
        
        if ($statusCode >= 400) {
            $errorMessage = isset($responseData['error']) ? $responseData['error'] : 'Request failed';
            throw new VBlobCDNException($errorMessage, $statusCode, $responseData);
        }
        
        return isset($responseData['data']) ? $responseData['data'] : [];
    }
    
    /**
     * Get API key information and usage statistics
     * 
     * @return array API key info and usage stats
     */
    public function getInfo() {
        return $this->request('GET', '/info');
    }
    
    /**
     * Upload a file to the CDN
     * 
     * @param string $filePath Path to the file to upload
     * @param string $filename Name of the file
     * @param string $contentType MIME type of the file (optional)
     * @return array Upload result with fileId, downloadUrl, and directDownloadUrl
     * @throws VBlobCDNException
     */
    public function upload($filePath, $filename, $contentType = null) {
        if (!file_exists($filePath)) {
            throw new VBlobCDNException("File not found: $filePath");
        }
        
        $size = filesize($filePath);
        
        if ($contentType === null) {
            $contentType = mime_content_type($filePath) ?: 'application/octet-stream';
        }
        
        // Step 1: Get presigned upload URL
        $uploadData = $this->request('POST', '/upload', [
            'filename' => $filename,
            'contentType' => $contentType,
            'size' => $size
        ]);
        
        // Step 2: Upload the file
        $ch = curl_init($uploadData['uploadUrl']);
        curl_setopt($ch, CURLOPT_PUT, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: ' . $contentType
        ]);
        curl_setopt($ch, CURLOPT_INFILE, fopen($filePath, 'r'));
        curl_setopt($ch, CURLOPT_INFILESIZE, $size);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, $this->timeout);
        
        $uploadResponse = curl_exec($ch);
        $uploadStatusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $uploadError = curl_error($ch);
        
        curl_close($ch);
        
        if ($uploadError || $uploadStatusCode >= 400) {
            throw new VBlobCDNException('Failed to upload file', $uploadStatusCode);
        }
        
        return [
            'fileId' => $uploadData['fileId'],
            'downloadUrl' => $uploadData['downloadUrl'],
            'directDownloadUrl' => $uploadData['directDownloadUrl']
        ];
    }
    
    /**
     * Upload file content from a string or resource
     * 
     * @param mixed $content File content (string or resource)
     * @param string $filename Name of the file
     * @param string $contentType MIME type
     * @return array Upload result
     */
    public function uploadContent($content, $filename, $contentType = 'application/octet-stream') {
        $size = is_string($content) ? strlen($content) : fstat($content)['size'];
        
        // Step 1: Get presigned upload URL
        $uploadData = $this->request('POST', '/upload', [
            'filename' => $filename,
            'contentType' => $contentType,
            'size' => $size
        ]);
        
        // Step 2: Upload the content
        $ch = curl_init($uploadData['uploadUrl']);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: ' . $contentType
        ]);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $content);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, $this->timeout);
        
        $uploadResponse = curl_exec($ch);
        $uploadStatusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $uploadError = curl_error($ch);
        
        curl_close($ch);
        
        if ($uploadError || $uploadStatusCode >= 400) {
            throw new VBlobCDNException('Failed to upload content', $uploadStatusCode);
        }
        
        return [
            'fileId' => $uploadData['fileId'],
            'downloadUrl' => $uploadData['downloadUrl'],
            'directDownloadUrl' => $uploadData['directDownloadUrl']
        ];
    }
    
    /**
     * Get information about a file
     * 
     * @param string $fileId ID of the file
     * @return array File information
     */
    public function getFile($fileId) {
        return $this->request('GET', '/files/' . urlencode($fileId));
    }
    
    /**
     * List files uploaded with this API key
     * 
     * @param int $limit Maximum number of files to return
     * @param string $prefix Filter files by key prefix
     * @return array List of files
     */
    public function listFiles($limit = null, $prefix = null) {
        $params = [];
        if ($limit !== null) {
            $params[] = 'limit=' . $limit;
        }
        if ($prefix !== null) {
            $params[] = 'prefix=' . urlencode($prefix);
        }
        
        $query = !empty($params) ? '?' . implode('&', $params) : '';
        
        return $this->request('GET', '/files' . $query);
    }
    
    /**
     * Delete a file
     * 
     * @param string $fileId ID of the file to delete
     */
    public function deleteFile($fileId) {
        $this->request('DELETE', '/files/' . urlencode($fileId));
    }
    
    /**
     * Download a file's content
     * 
     * @param string $fileId ID of the file
     * @return string File content
     */
    public function downloadFile($fileId) {
        $fileInfo = $this->getFile($fileId);
        
        $ch = curl_init($fileInfo['downloadUrl']);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, $this->timeout);
        
        $content = curl_exec($ch);
        $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        
        curl_close($ch);
        
        if ($error || $statusCode >= 400) {
            throw new VBlobCDNException('Failed to download file', $statusCode);
        }
        
        return $content;
    }
    
    /**
     * Check if a file exists
     * 
     * @param string $fileId ID of the file
     * @return bool True if file exists
     */
    public function fileExists($fileId) {
        try {
            $this->getFile($fileId);
            return true;
        } catch (VBlobCDNException $e) {
            if ($e->statusCode === 404) {
                return false;
            }
            throw $e;
        }
    }
}

// Example usage
if (basename(__FILE__) == basename($_SERVER['PHP_SELF'])) {
    // Get API key from environment
    $apiKey = getenv('CDN_API_KEY');
    $baseUrl = getenv('CDN_BASE_URL') ?: 'https://your-domain.com';
    
    if (!$apiKey) {
        die("Error: CDN_API_KEY environment variable not set\n");
    }
    
    try {
        $cdn = new VBlobCDN($apiKey, $baseUrl);
        
        // Get API info
        $info = $cdn->getInfo();
        echo "API Key: {$info['name']}\n";
        echo "Uploads: {$info['usage']['uploadCount']}\n";
        echo "Downloads: {$info['usage']['downloadCount']}\n";
        echo "\n";
        
        // List files
        $files = $cdn->listFiles(10);
        echo "Total files: {$files['total']}\n";
        foreach ($files['files'] as $file) {
            echo "  - {$file['name']} ({$file['size']} bytes)\n";
        }
        
    } catch (VBlobCDNException $e) {
        echo "Error: " . $e->getMessage() . "\n";
        if ($e->statusCode) {
            echo "Status Code: {$e->statusCode}\n";
        }
    }
}
