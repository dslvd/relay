#!/bin/bash

# Quick cURL test script for Relay's file API (/api/files/*)
# Usage: ./test-api.sh YOUR_API_KEY [BASE_URL]

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_KEY="${1:-YOUR_API_KEY_HERE}"
BASE_URL="${2:-http://localhost:3000}"
API_URL="${BASE_URL}/api/files"

if [ "$API_KEY" = "YOUR_API_KEY_HERE" ]; then
    echo -e "${RED}Error: Please provide your API key${NC}"
    echo "Usage: ./test-api.sh YOUR_API_KEY [BASE_URL]"
    echo ""
    echo "Example:"
    echo "  ./test-api.sh vbc_abc123xyz http://localhost:3000"
    exit 1
fi

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}      Relay File API Test (cURL)${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo "API Key: ${API_KEY:0:15}..."
echo "Base URL: $BASE_URL"
echo ""

# Test 1: Upload a File
echo -e "${BLUE}------------------------------------------------${NC}"
echo -e "${BLUE}Test 1: Upload a File${NC}"
echo -e "${BLUE}------------------------------------------------${NC}"
echo ""

TEST_FILE="/tmp/relay-test-$(date +%s).txt"
echo "Hello from Relay test at $(date)" > "$TEST_FILE"
FILE_SIZE=$(wc -c < "$TEST_FILE")

echo "Creating test file: $TEST_FILE ($FILE_SIZE bytes)"
echo ""

response=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "Authorization: Bearer $API_KEY" \
  -F "file=@${TEST_FILE};type=text/plain" \
  "${API_URL}/upload")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓ File uploaded successfully${NC}"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"

    FILE_ID=$(echo "$body" | jq -r '.data.id' 2>/dev/null)
    SHORT_ID=$(echo "$body" | jq -r '.data.shortId' 2>/dev/null)
    echo "$FILE_ID" > /tmp/relay_last_file_id.txt
    echo "$SHORT_ID" > /tmp/relay_last_short_id.txt
else
    echo -e "${RED}✗ Upload failed (HTTP $http_code)${NC}"
    echo "$body"
fi

rm -f "$TEST_FILE"

echo ""
read -p "Press Enter to continue..."
echo ""

if [ -f /tmp/relay_last_file_id.txt ]; then
    FILE_ID=$(cat /tmp/relay_last_file_id.txt)
    SHORT_ID=$(cat /tmp/relay_last_short_id.txt)

    # Test 2: Get File Info (public lookup)
    echo -e "${BLUE}------------------------------------------------${NC}"
    echo -e "${BLUE}Test 2: Get File Info (public)${NC}"
    echo -e "${BLUE}------------------------------------------------${NC}"
    echo ""

    response=$(curl -s -w "\n%{http_code}" "${API_URL}/info?file_code=${SHORT_ID}")
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

    # Test 3: List Files
    echo -e "${BLUE}------------------------------------------------${NC}"
    echo -e "${BLUE}Test 3: List Files${NC}"
    echo -e "${BLUE}------------------------------------------------${NC}"
    echo ""

    response=$(curl -s -w "\n%{http_code}" \
      -H "Authorization: Bearer $API_KEY" \
      "${API_URL}/list?limit=5")

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

    # Test 4: Get download URL
    echo -e "${BLUE}------------------------------------------------${NC}"
    echo -e "${BLUE}Test 4: Get Download URL${NC}"
    echo -e "${BLUE}------------------------------------------------${NC}"
    echo ""

    response=$(curl -s -w "\n%{http_code}" "${API_URL}/download/${FILE_ID}")
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
          "${API_URL}/delete?fileId=${FILE_ID}")

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

    rm -f /tmp/relay_last_file_id.txt /tmp/relay_last_short_id.txt
fi

echo ""
echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}              Tests Complete!${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo -e "${GREEN}✓ All tests finished${NC}"
echo ""
echo "Next steps:"
echo "  - Check the API dashboard: ${BASE_URL}/api"
echo "  - View API documentation: ${BASE_URL}/docs"
echo "  - Try the Node.js test: cd api-test && npm test"
echo "  - Or use the browser test: open api-test/test-browser.html"
echo ""
