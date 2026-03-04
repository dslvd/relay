#!/bin/bash

# Quick Setup & Troubleshooting Script
# This helps you create your first API key and test the system

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

BASE_URL="${1:-http://localhost:3000}"

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}   CDN API Quick Setup & Troubleshooting${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Step 1: Check if server is running
echo -e "${BLUE}Step 1: Checking if server is running...${NC}"
if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL" | grep -q "200\|301\|302"; then
    echo -e "${GREEN}✓ Server is running at $BASE_URL${NC}"
else
    echo -e "${RED}✗ Server is not responding at $BASE_URL${NC}"
    echo ""
    echo "Please start your development server first:"
    echo "  cd .. && npm run dev"
    exit 1
fi

echo ""

# Step 2: Check developer dashboard
echo -e "${BLUE}Step 2: Checking developer dashboard...${NC}"
DASHBOARD_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/developers")

if [ "$DASHBOARD_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Developer dashboard is accessible${NC}"
else
    echo -e "${RED}✗ Developer dashboard returned HTTP $DASHBOARD_CODE${NC}"
fi

echo ""

# Step 3: Check API endpoint
echo -e "${BLUE}Step 3: Checking API endpoint...${NC}"
API_RESPONSE=$(curl -s "$BASE_URL/api/v1/info")

if echo "$API_RESPONSE" | grep -q "API key is required"; then
    echo -e "${GREEN}✓ API endpoint is working (authentication required)${NC}"
elif echo "$API_RESPONSE" | grep -q "error"; then
    echo -e "${YELLOW}⚠ API responded with: $API_RESPONSE${NC}"
else
    echo -e "${RED}✗ Unexpected API response${NC}"
fi

echo ""
echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}              Setup Instructions${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo "To create your first API key:"
echo ""
echo -e "${GREEN}1.${NC} Open your browser and visit:"
echo -e "   ${BLUE}$BASE_URL/developers${NC}"
echo ""
echo -e "${GREEN}2.${NC} Click the '+ Create New API Key' button"
echo ""
echo -e "${GREEN}3.${NC} Configure your key:"
echo "   - Give it a name (e.g., 'Test Key')"
echo "   - Keep all permissions enabled for testing"
echo "   - Click 'Create API Key'"
echo ""
echo -e "${GREEN}4.${NC} ${YELLOW}IMPORTANT${NC}: Copy the key immediately!"
echo "   - It starts with 'vbc_'"
echo "   - It's only shown once"
echo "   - Save it somewhere safe"
echo ""
echo -e "${GREEN}5.${NC} Test your API key:"
echo "   ${BLUE}./test-api.sh YOUR_API_KEY${NC}"
echo ""
echo -e "${BLUE}================================================${NC}"
echo ""

# Try to open browser automatically
if command -v open &> /dev/null; then
    read -p "Would you like to open the dashboard now? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Opening $BASE_URL/developers in your browser..."
        open "$BASE_URL/developers"
    fi
elif command -v xdg-open &> /dev/null; then
    read -p "Would you like to open the dashboard now? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Opening $BASE_URL/developers in your browser..."
        xdg-open "$BASE_URL/developers"
    fi
fi

echo ""
echo -e "${BLUE}Quick Test Command:${NC}"
echo -e "  ${GREEN}./test-api.sh YOUR_API_KEY_HERE${NC}"
echo ""
echo -e "${BLUE}Alternative Test Methods:${NC}"
echo "  Python:  python test-api.py YOUR_API_KEY"
echo "  Node.js: Edit test-api.js then run: node test-api.js"
echo "  Browser: Open test-browser.html (most visual!)"
echo ""
