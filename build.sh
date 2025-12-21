#!/bin/bash
set -e

echo "🚀 Building Bridge single binary..."

# Build frontend
echo "📦 Step 1: Building frontend..."
cd frontend
npm install
npm run build
cd ..

# Copy dist to backend
echo "📁 Step 2: Copying frontend dist to backend..."
rm -rf backend/dist
cp -r frontend/dist backend/dist

# Build Go binary
echo "🔨 Step 3: Compiling Go binary with embedded frontend..."
cd backend
go build -o bridge .
cd ..

echo ""
echo "✅ Build complete!"
echo ""
echo "To run Bridge:"
echo "  ./backend/bridge"
echo ""
echo "Then open http://localhost:8080 in your browser"
