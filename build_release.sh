#!/bin/bash
set -e

VERSION="${VERSION:-dev}"
BUILD_TIME=$(date -u '+%Y-%m-%d_%H:%M:%S')
LDFLAGS="-s -w -X main.Version=${VERSION} -X main.BuildTime=${BUILD_TIME}"

echo "🚀 Building Bridge Release Binaries"
echo "   Version: ${VERSION}"
echo "   Build Time: ${BUILD_TIME}"
echo ""

# Step 1: Build frontend
echo "📦 Step 1: Building frontend..."
cd frontend
npm install --silent
npm run build
cd ..

# Step 2: Copy dist to backend
echo "📁 Step 2: Embedding frontend assets..."
rm -rf backend/dist
cp -r frontend/dist backend/dist

# Step 3: Create bin directory
echo "🗂️  Step 3: Preparing output directory..."
rm -rf bin
mkdir -p bin

# Step 4: Build for all platforms
cd backend

echo "🔨 Step 4: Cross-compiling binaries..."
echo ""

# Linux AMD64
echo "   → Linux (amd64)..."
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="${LDFLAGS}" -o ../bin/bridge-linux-amd64 .

# Linux ARM64
echo "   → Linux (arm64)..."
CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -ldflags="${LDFLAGS}" -o ../bin/bridge-linux-arm64 .

# macOS Intel
echo "   → macOS (amd64 - Intel)..."
CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 go build -ldflags="${LDFLAGS}" -o ../bin/bridge-darwin-amd64 .

# macOS Apple Silicon
echo "   → macOS (arm64 - Apple Silicon)..."
CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -ldflags="${LDFLAGS}" -o ../bin/bridge-darwin-arm64 .

# Windows AMD64
echo "   → Windows (amd64)..."
CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -ldflags="${LDFLAGS}" -o ../bin/bridge-windows-amd64.exe .

cd ..

# Step 5: Show results
echo ""
echo "✅ Build complete! Binaries in ./bin/:"
echo ""
ls -lh bin/
echo ""
echo "📝 To run:"
echo "   Linux/macOS: ./bin/bridge-<platform>-<arch>"
echo "   Windows:     .\\bin\\bridge-windows-amd64.exe"
