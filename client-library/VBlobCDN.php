<?php
/**
 * PHP Client Library for the Relay file API
 *
 * Targets /api/files/* (see /docs on your deployment). The older
 * /api/v1/* surface this client used to call is deprecated - see
 * app/lib/auth/api-auth.ts's withDeprecatedApiAuth.
 *
 * Usage:
 * ```php
 * require_once 'VBlobCDN.php';
 *
 * $cdn = new VBlobCDN('your-api-key', 'https://your-domain.com');
 *
 * $result = $cdn->upload('/path/to/file.png', 'image.png', 'image/png');
 * echo 'URL: ' . $result['url'];
 *
 * $files = $cdn->listFiles(['q' => 'invoice']);
 * $info = $cdn->getFileInfo($result['shortId']);
 * $cdn->deleteFile($result['id']);
 * ```
 *
 * Files above a few MB should use the multipart endpoints
 * (/api/files/multipart/init, batch-urls, complete, abort) documented at
 * /docs - this lightweight client only covers the single-shot upload path.
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
     * @param string|null $apiKey Your API key (optional - omit for anonymous requests)
     * @param string $baseUrl Base URL of your Relay deployment
     * @param int $timeout Request timeout in seconds (default: 30)
     */
    public function __construct($apiKey, $baseUrl, $timeout = 30) {
        $this->apiKey = $apiKey;
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->timeout = $timeout;
    }

    /**
     * @throws VBlobCDNException
     */
    private function request($method, $path, $curlOptions = []) {
        $url = $this->baseUrl . $path;

        $ch = curl_init($url);

        $headers = [];
        if ($this->apiKey) {
            $headers[] = 'Authorization: Bearer ' . $this->apiKey;
        }

        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, $this->timeout);
        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
        } elseif ($method === 'DELETE') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
        }

        foreach ($curlOptions as $key => $value) {
            if ($key === CURLOPT_HTTPHEADER) {
                $headers = array_merge($headers, $value);
            } else {
                curl_setopt($ch, $key, $value);
            }
        }
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

        $response = curl_exec($ch);
        $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new VBlobCDNException($error);
        }

        $data = json_decode($response, true);

        if ($statusCode >= 400 || (isset($data['success']) && $data['success'] === false)) {
            $message = isset($data['error']) ? $data['error'] : 'Request failed';
            throw new VBlobCDNException($message, $statusCode, $data);
        }

        return $data;
    }

    /**
     * Upload a file in one call. Anonymous (no API key) uploads are capped
     * at 25GB and expire after 15 days; key-owned uploads are capped by
     * the key's rateLimit.uploadSizeLimit and total storage quota.
     *
     * @return array id, name, size, url, viewUrl, mimeType, createdAt, isAnonymous, expiresAt, shortId
     */
    public function upload($filePath, $filename, $contentType = null, $folderId = null) {
        if (!file_exists($filePath)) {
            throw new VBlobCDNException("File not found: $filePath");
        }
        if ($contentType === null) {
            $contentType = mime_content_type($filePath) ?: 'application/octet-stream';
        }

        $fields = ['file' => new CURLFile($filePath, $contentType, $filename)];
        if ($folderId !== null) {
            $fields['folderId'] = $folderId;
        }

        $result = $this->request('POST', '/api/files/upload', [CURLOPT_POSTFIELDS => $fields]);
        return $result['data'];
    }

    /** Have the server fetch a URL and store it. Same limits as upload(). */
    public function remoteUpload($url, $folderId = null) {
        $body = ['url' => $url];
        if ($folderId !== null) {
            $body['folderId'] = $folderId;
        }

        $result = $this->request('POST', '/api/files/remote-upload', [
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS => json_encode($body),
        ]);
        return $result['data'];
    }

    /**
     * List files uploaded with this API key. Requires the "list" permission.
     * Options: page, limit, folderId, q (filename substring), mimeType (prefix match).
     */
    public function listFiles($options = []) {
        $query = http_build_query($options);
        $result = $this->request('GET', '/api/files/list' . ($query ? "?$query" : ''));
        return $result;
    }

    /**
     * Look up one or more files by their short ID (public - no API key needed).
     * @param string|array $shortIdOrIds
     */
    public function getFileInfo($shortIdOrIds) {
        $codes = is_array($shortIdOrIds) ? implode(',', $shortIdOrIds) : $shortIdOrIds;
        $result = $this->request('GET', '/api/files/info?file_code=' . urlencode($codes));
        return $result['result'];
    }

    /** Get a fresh presigned download URL for a file by its UUID (public - no API key needed). */
    public function getDownloadUrl($fileId) {
        $result = $this->request('GET', '/api/files/download/' . urlencode($fileId));
        return $result['data'];
    }

    /** Download a file's content. */
    public function downloadFile($fileId) {
        $info = $this->getDownloadUrl($fileId);

        $ch = curl_init($info['url']);
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
     * Delete a file by its UUID. Owner keys authenticate via the
     * Authorization header; anonymous uploads need their deletion token
     * instead.
     */
    public function deleteFile($fileId, $deletionToken = null) {
        $params = ['fileId' => $fileId];
        if ($deletionToken !== null) {
            $params['token'] = $deletionToken;
        }
        $this->request('DELETE', '/api/files/delete?' . http_build_query($params));
    }

    /** Delete up to 100 key-owned files in one call. Requires the "delete" permission. */
    public function batchDeleteFiles($fileIds) {
        $result = $this->request('POST', '/api/files/batch-delete', [
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS => json_encode(['fileIds' => $fileIds]),
        ]);
        return $result['data'];
    }
}

// Example usage
if (basename(__FILE__) == basename($_SERVER['PHP_SELF'] ?? '')) {
    $apiKey = getenv('CDN_API_KEY');
    $baseUrl = getenv('CDN_BASE_URL') ?: 'https://your-domain.com';

    if (!$apiKey) {
        die("Error: CDN_API_KEY environment variable not set\n");
    }

    try {
        $cdn = new VBlobCDN($apiKey, $baseUrl);

        $files = $cdn->listFiles(['limit' => 10]);
        echo "Total files: {$files['pagination']['total']}\n";
        foreach ($files['data'] as $file) {
            echo "  - {$file['name']} ({$file['size']} bytes)\n";
        }
    } catch (VBlobCDNException $e) {
        echo "Error: " . $e->getMessage() . "\n";
        if ($e->statusCode) {
            echo "Status Code: {$e->statusCode}\n";
        }
    }
}
