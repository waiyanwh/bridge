#!/bin/bash

# Ensure we're in the backend directory
cd "$(dirname "$0")"

# Create dummy dist directory if it doesn't exist
if [ ! -d "dist" ]; then
    echo "Creating dummy dist directory for development..."
    mkdir -p dist
    touch dist/index.html
    echo "<h1>Backend Development Mode</h1><p>Run frontend separately.</p>" > dist/index.html
fi

# Run the backend
echo "Starting backend..."
go run .
