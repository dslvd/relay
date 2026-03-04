#!/bin/bash

# Quick cURL test script for Vercel Blob CDN API
# Usage: ./test-api.sh YOUR_API_KEY [BASE_URL]

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_KEY="${1:-YOUR_API_KEY_HERE}"
BASE_URL="${2:-http://localhost:3000}"
API_URL="${BASE_URL}/api/v1"

# Check if API key is provided
if [ "$API_KEY" = "YOUR_API_KEY_HERE" ]; then
    echo -e "${RED}Error: Please provide your API key${NC}"
    echo "Usage: ./test-api.sh YOUR_API_KEY [BASE_URL]"
    echo ""
    echo "Example:"
    echo "  ./test-api.sh vbc_abc123xyz http://localhost:3000"
    exit 1
fi

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}      Vercel Blob CDN API Test (cURL)${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo "API Key: ${API_KEY:0:15}..."
echo "Base URL: $BASE_URL"
echo ""

# Test 1: Get API Key Info
echo -e "${BLUE}------------------------------------------------${NC}"
echo -e "${BLUE}Test 1: Get API Key Info${NC}"
echo -e "${BLUE}------------------------------------------------${NC}"
echo ""

response=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $API_KEY" \
  "${API_URL}/info")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓ Success${NC}"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
else
    echo -e "${RED}✗ Failed (HTTP $http_code)${NC}"
    echo "$body"
fi

echo ""
read -p "Press Enter to continue..."
echo ""

# Test 2: List Files
echo -e "${BLUE}------------------------------------------------${NC}"
echo -e "${BLUE}Test 2: List Files${NC}"
echo -e "${BLUE}------------------------------------------------${NC}"
echo ""

response=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $API_KEY" \
  "${API_URL}/files?limit=5")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓ Success${NC}"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
else
    echo -e "${RED}✗ Failed (HTTP $http_code)${NC}"
    echo "$body"
fi

echo ""
read -p "Press Enter to continue..."
echo ""

# Test 3: Upload a File
echo -e "${BLUE}------------------------------------------------${NC}"
echo -e "${BLUE}Test 3: Upload a File${NC}"
echo -e "${BLUE}------------------------------------------------${NC}"
echo ""

# Create a test file
TEST_FILE="/tmp/cdn-test-$(date +%s).txt"
echo "Hello from CDN test at $(date)" > "$TEST_FILE"
FILE_SIZE=$(wc -c < "$TEST_FILE")

echo "Creating test file: $TEST_FILE"
echo "File size: $FILE_SIZE bytes"
echo ""

# Step 1: Get upload URL
echo "Step 1: Getting upload URL..."
response=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"filename\":\"test.txt\",\"contentType\":\"text/plain\",\"size\":$FILE_SIZE}" \
  "${API_URL}/upload")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓ Upload URL received${NC}"
    
    # Extract upload URL and file ID
    UPLOAD_URL=$(echo "$body" | jq -r '.data.uploadUrl' 2>/dev/null)
    FILE_ID=$(echo "$body" | jq -r '.data.fileId' 2>/dev/null)
    DOWNLOAD_URL=$(echo "$body" | jq -r '.data.downloadUrl' 2>/dev/null)
    
    echo "File ID: $FILE_ID"
    echo ""
    
    # Step 2: Upload the file
    echo "Step 2: Uploading file..."
    upload_response=$(curl -s -w "\n%{http_code}" \
      -X PUT \
      -H "Content-Type: text/plain" \
      --data-binary "@$TEST_FILE" \
      "$UPLOAD_URL")
    
    upload_http_code=$(echo "$upload_response" | tail -n1)
    
    if [ "$upload_http_code" = "200" ]; then
        echo -e "${GREEN}✓ File uploaded successfully${NC}"
        echo "Download URL: $DOWNLOAD_URL"
        
        # Save file ID for later tests
        echo "$FILE_ID" > /tmp/last_uploaded_file_id.txt
    else
        echo -e "${RED}✗ Upload failed (HTTP $upload_http_code)${NC}"
    fi
else
    echo -e "${RED}✗ Failed to get upload URL (HTTP $http_code)${NC}"
    echo "$body"
fi

# Clean up test file
rm -f "$TEST_FILE"

echo ""
read -p "Press Enter to continue..."
echo ""

# Test 4: Get File Info (if we uploaded a file)
if [ -f /tmp/last_uploaded_file_id.txt ]; then
    FILE_ID=$(cat /tmp/last_uploaded_file_id.txt)
    
    echo -e "${BLUE}------------------------------------------------${NC}"
    echo -e "${BLUE}Test 4: Get File Info${NC}"
    echo -e "${BLUE}------------------------------------------------${NC}"
    echo ""
    
    # URL encode the file ID
    ENCODED_FILE_ID=$(echo "$FILE_ID" | jq -sRr @uri)
    
    response=$(curl -s -w "\n%{http_code}" \
      -H "Authorization: Bearer $API_KEY" \
      "${API_URL}/files/${ENCODED_FILE_ID}")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✓ Success${NC}"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    else
        echo -e "${RED}✗ Failed (HTTP $http_code)${NC}"
        echo "$body"
    fi
    
    echo ""
    read -p "Press Enter to continue..."
    echo ""
    
    # Test 5: Delete File (optional)
    echo -e "${BLUE}------------------------------------------------${NC}"
    echo -e "${BLUE}Test 5: Delete File (optional)${NC}"
    echo -e "${BLUE}------------------------------------------------${NC}"
    echo ""
    
    read -p "Do you want to delete the test file? (y/N) " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        response=$(curl -s -w "\n%{http_code}" \
          -X DELETE \
          -H "Authorization: Bearer $API_KEY" \
          "${API_URL}/files/${ENCODED_FILE_ID}")
        
        http_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | sed '$d')
        
        if [ "$http_code" = "200" ]; then
            echo -e "${GREEN}✓ File deleted successfully${NC}"
            echo "$body" | jq '.' 2>/dev/null || echo "$body"
        elif [ "$http_code" = "403" ]; then
            echo -e "${YELLOW}⚠ Delete permission not granted (this is expected)${NC}"
            echo "$body"
        else
            echo -e "${RED}✗ Failed (HTTP $http_code)${NC}"
            echo "$body"
        fi
    else
        echo "Skipped deletion."
    fi
    
    # Clean up temp file
    rm -f /tmp/last_uploaded_file_id.txt
fi

echo ""
echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}              Tests Complete!${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo -e "${GREEN}✓ All tests finished${NC}"
echo ""
echo "Next steps:"
echo "  - Check the Developer Dashboard: ${BASE_URL}/developers"
echo "  - View API Documentation: ${BASE_URL}/developers/docs"
echo "  - Try the Node.js test: cd api-test && npm test"
echo "  - Or use the browser test: open api-test/test-browser.html"
echo ""
