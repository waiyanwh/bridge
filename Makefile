.PHONY: all build clean frontend backend dev release

VERSION ?= dev
BUILD_TIME := $(shell date -u '+%Y-%m-%d_%H:%M:%S')
LDFLAGS := -s -w -X main.Version=$(VERSION) -X main.BuildTime=$(BUILD_TIME)

# Default target
all: build

# Build everything into a single binary (for current platform)
build: frontend backend
	@echo "✅ Build complete! Run ./backend/bridge to start"

# Build frontend
frontend:
	@echo "📦 Building frontend..."
	cd frontend && npm install && npm run build
	@echo "📁 Copying dist to backend..."
	rm -rf backend/dist
	cp -r frontend/dist backend/dist

# Build backend with embedded frontend (current platform)
backend:
	@echo "🔨 Building Go binary..."
	cd backend && CGO_ENABLED=0 go build -ldflags="$(LDFLAGS)" -o bridge .
	@echo "✅ Binary created: backend/bridge"

# Clean build artifacts
clean:
	rm -rf frontend/dist
	rm -rf backend/dist
	rm -f backend/bridge
	rm -rf bin

# Development mode (run separately)
dev:
	@echo "Run these in separate terminals:"
	@echo "  Terminal 1: cd frontend && npm run dev"
	@echo "  Terminal 2: cd backend && go run ."

# ============================================
# Release builds (cross-compilation)
# ============================================

release: frontend release-all
	@echo ""
	@echo "✅ Release build complete! Binaries in ./bin/"
	@ls -lh bin/

release-all: release-prep release-linux release-darwin release-windows

release-prep:
	@echo "📁 Preparing release..."
	rm -rf backend/dist
	cp -r frontend/dist backend/dist
	rm -rf bin
	mkdir -p bin

release-linux:
	@echo "🐧 Building for Linux..."
	cd backend && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="$(LDFLAGS)" -o ../bin/bridge-linux-amd64 .
	cd backend && CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -ldflags="$(LDFLAGS)" -o ../bin/bridge-linux-arm64 .

release-darwin:
	@echo "🍎 Building for macOS..."
	cd backend && CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 go build -ldflags="$(LDFLAGS)" -o ../bin/bridge-darwin-amd64 .
	cd backend && CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -ldflags="$(LDFLAGS)" -o ../bin/bridge-darwin-arm64 .

release-windows:
	@echo "🪟 Building for Windows..."
	cd backend && CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -ldflags="$(LDFLAGS)" -o ../bin/bridge-windows-amd64.exe .

# Individual platform builds (for testing)
build-linux:
	cd frontend && npm install && npm run build
	rm -rf backend/dist && cp -r frontend/dist backend/dist
	cd backend && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="$(LDFLAGS)" -o bridge-linux-amd64 .

build-darwin:
	cd frontend && npm install && npm run build
	rm -rf backend/dist && cp -r frontend/dist backend/dist
	cd backend && CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 go build -ldflags="$(LDFLAGS)" -o bridge-darwin-amd64 .

build-windows:
	cd frontend && npm install && npm run build
	rm -rf backend/dist && cp -r frontend/dist backend/dist
	cd backend && CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -ldflags="$(LDFLAGS)" -o bridge-windows-amd64.exe .
